/**
 * MetricsHub Worker — Stripe Sync & Metrics Calculation
 *
 * For each connected Stripe account:
 *   1. Decrypt OAuth access token
 *   2. Fetch all subscriptions via Stripe API (auto-paginated)
 *   3. Calculate SaaS metrics (MRR, ARR, churn rate, NRR, etc.)
 *   4. Upsert a metrics_snapshot record for today's date
 *   5. Update connection's lastSyncAt
 *
 * Uses Stripe SDK with the user's OAuth access token (read_only scope).
 */

import Stripe from "stripe";
import {
  db,
  stripeConnections,
  metricsSnapshots,
} from "@metricshub/db";
import type { StripeConnection } from "@metricshub/db";
import { eq, sql } from "@metricshub/db";
import { decrypt } from "./encrypt";

// ─── Stripe Subscription Types ────────────────────────────────────────────────

type StripeStatus = Stripe.Subscription["status"];

// ─── MRR Helpers ─────────────────────────────────────────────────────────────

/** Convert a Stripe subscription's plan to a monthly MRR amount in cents. */
function subscriptionMrrCents(sub: Stripe.Subscription): number {
  const item = sub.items.data[0];
  if (!item?.price) return 0;

  const amount = item.price.unit_amount ?? 0;
  const interval = item.price.recurring?.interval;
  const intervalCount = item.price.recurring?.interval_count ?? 1;

  if (!interval || amount === 0) return 0;

  // Normalize to monthly cents
  switch (interval) {
    case "day":
      return Math.round((amount * 30) / intervalCount);
    case "week":
      return Math.round((amount * (52 / 12)) / intervalCount);
    case "month":
      return Math.round(amount / intervalCount);
    case "year":
      return Math.round(amount / (12 * intervalCount));
    default:
      return 0;
  }
}

function isActive(status: StripeStatus): boolean {
  return status === "active" || status === "trialing";
}

// ─── Metrics Calculation ──────────────────────────────────────────────────────

interface SyncMetrics {
  mrr: number;
  arr: number;
  activeSubscribers: number;
  newSubscribers: number;
  churnedSubscribers: number;
  trialSubscribers: number;
  newMrr: number;
  expansionMrr: number;
  contractionMrr: number;
  churnMrr: number;
  netNewMrr: number;
  churnRateBps: number;
  trialToPaidRateBps: number;
  arpu: number;
  ltv: number;
}

function calculateMetrics(
  currentSubs: Stripe.Subscription[],
  periodStart: Date
): SyncMetrics {
  const activeSubs = currentSubs.filter((s) => isActive(s.status));
  const trialSubs = currentSubs.filter((s) => s.status === "trialing");
  const canceledThisPeriod = currentSubs.filter(
    (s) =>
      s.status === "canceled" &&
      s.canceled_at != null &&
      s.canceled_at * 1000 >= periodStart.getTime()
  );
  const newThisPeriod = currentSubs.filter(
    (s) => s.start_date * 1000 >= periodStart.getTime()
  );

  const mrr = activeSubs.reduce((sum, s) => sum + subscriptionMrrCents(s), 0);
  const arr = mrr * 12;
  const activeCount = activeSubs.length;
  const trialCount = trialSubs.length;

  // MRR movement (simplified — new vs churned)
  const newMrr = newThisPeriod
    .filter((s) => isActive(s.status))
    .reduce((sum, s) => sum + subscriptionMrrCents(s), 0);

  const churnMrr = canceledThisPeriod.reduce(
    (sum, s) => sum + subscriptionMrrCents(s),
    0
  );

  const netNewMrr = newMrr - churnMrr;

  // Churn rate in basis points (churned / (active + churned) * 10000)
  const totalForChurnCalc = activeCount + canceledThisPeriod.length;
  const churnRateBps =
    totalForChurnCalc > 0
      ? Math.round((canceledThisPeriod.length / totalForChurnCalc) * 10_000)
      : 0;

  // Trial-to-paid: paid subs that started in period / all subs started in period
  const newPaidThisPeriod = newThisPeriod.filter(
    (s) => s.status === "active"
  ).length;
  const trialToPaidRateBps =
    newThisPeriod.length > 0
      ? Math.round((newPaidThisPeriod / newThisPeriod.length) * 10_000)
      : 0;

  // ARPU = MRR / activeSubscribers
  const arpu = activeCount > 0 ? Math.round(mrr / activeCount) : 0;

  // LTV = ARPU / monthly_churn_rate (guard against zero)
  const monthlyChurnRate = churnRateBps / 10_000;
  const ltv = monthlyChurnRate > 0 ? Math.round(arpu / monthlyChurnRate) : 0;

  return {
    mrr,
    arr,
    activeSubscribers: activeCount,
    newSubscribers: newThisPeriod.length,
    churnedSubscribers: canceledThisPeriod.length,
    trialSubscribers: trialCount,
    newMrr,
    expansionMrr: 0, // Requires plan-level tracking across periods (future)
    contractionMrr: 0, // Requires plan-level tracking across periods (future)
    churnMrr,
    netNewMrr,
    churnRateBps,
    trialToPaidRateBps,
    arpu,
    ltv,
  };
}

// ─── Fetch all Stripe subscriptions (auto-paginated) ─────────────────────────

async function fetchAllSubscriptions(
  stripe: Stripe
): Promise<Stripe.Subscription[]> {
  const all: Stripe.Subscription[] = [];
  let startingAfter: string | undefined;

  while (true) {
    const params: Stripe.SubscriptionListParams = {
      limit: 100,
      status: "all",
    };
    if (startingAfter) params.starting_after = startingAfter;

    const page = await stripe.subscriptions.list(params);
    all.push(...page.data);

    if (!page.has_more || page.data.length === 0) break;
    startingAfter = page.data[page.data.length - 1]!.id;
  }

  return all;
}

// ─── Single Connection Sync ───────────────────────────────────────────────────

export interface SyncResult {
  connectionId: string;
  success: boolean;
  metrics?: SyncMetrics;
  error?: string;
  subscriptionCount?: number;
}

export async function syncConnection(
  connection: StripeConnection
): Promise<SyncResult> {
  const { id: connectionId } = connection;

  try {
    // 1. Decrypt the OAuth access token
    const accessToken = decrypt({
      enc: connection.accessTokenEnc,
      iv: connection.accessTokenIv,
      tag: connection.accessTokenTag,
    });

    // 2. Init Stripe client with the user's OAuth token
    const stripe = new Stripe(accessToken, {
      apiVersion: "2023-10-16",
    });

    console.log(`[sync] 🔄 Fetching subscriptions for connection ${connectionId}...`);

    // 3. Fetch all subscriptions
    const subscriptions = await fetchAllSubscriptions(stripe);

    console.log(
      `[sync] Fetched ${subscriptions.length} subscriptions for connection ${connectionId}`
    );

    // 4. Calculate metrics for last 30 days
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - 30);

    const metrics = calculateMetrics(subscriptions, periodStart);

    // 5. Upsert today's metrics snapshot
    const today = new Date().toISOString().split("T")[0]!; // YYYY-MM-DD

    await db
      .insert(metricsSnapshots)
      .values({
        userId: connection.userId,
        connectionId,
        snapshotDate: today,
        ...metrics,
      })
      .onConflictDoUpdate({
        target: [metricsSnapshots.connectionId, metricsSnapshots.snapshotDate],
        set: {
          ...metrics,
          // Note: createdAt stays the same (not updated on conflict)
        },
      });

    // 6. Update lastSyncAt on the connection
    await db
      .update(stripeConnections)
      .set({ lastSyncAt: new Date(), updatedAt: new Date() })
      .where(eq(stripeConnections.id, connectionId));

    console.log(
      `[sync] ✅ Connection ${connectionId}: MRR=${metrics.mrr}¢, ` +
        `active=${metrics.activeSubscribers}, churn=${(metrics.churnRateBps / 100).toFixed(2)}%`
    );

    return {
      connectionId,
      success: true,
      metrics,
      subscriptionCount: subscriptions.length,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[sync] ❌ Connection ${connectionId} failed: ${error}`);
    return { connectionId, success: false, error };
  }
}

// ─── Full Sync (all connections) ─────────────────────────────────────────────

export async function syncAllConnections(): Promise<SyncResult[]> {
  // Fetch all active Stripe connections
  const connections = await db
    .select()
    .from(stripeConnections)
    .where(
      // Only sync connections that have never synced or are stale (>55 min)
      sql`(${stripeConnections.lastSyncAt} IS NULL OR 
           ${stripeConnections.lastSyncAt} < NOW() - INTERVAL '55 minutes')`
    );

  if (connections.length === 0) {
    console.log("[sync] No connections to sync");
    return [];
  }

  console.log(`[sync] Syncing ${connections.length} Stripe connection(s)...`);

  // Process connections sequentially to avoid rate limiting
  const results: SyncResult[] = [];
  for (const connection of connections) {
    const result = await syncConnection(connection);
    results.push(result);

    // Small delay between connections to be kind to Stripe API
    if (connections.length > 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(
    `[sync] ✅ Full sync complete: ${succeeded} succeeded, ${failed} failed`
  );

  return results;
}
