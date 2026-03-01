export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import {
  db,
  metricsSnapshots,
  stripeConnections,
  eq,
  and,
  gte,
  desc,
  inArray,
} from "@metricshub/db";
import { z } from "zod";

// ─── Validation ────────────────────────────────────────────────────────────────

const querySchema = z.object({
  connection_id: z.string().uuid().optional(),
  date_range: z
    .enum(["30", "90", "365"])
    .optional()
    .default("30")
    .transform(Number),
});

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Format ISO date string YYYY-MM-DD, offset by N days */
function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

// ─── GET /api/metrics ──────────────────────────────────────────────────────────
// Query params:
//   connection_id  — (optional) filter to a single connection UUID
//   date_range     — 30 | 90 | 365  (days, default 30)
//
// Returns: { connections, snapshots, summary }
// ──────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  // Parse query params
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query params", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const { connection_id, date_range } = parsed.data;

  const sinceDate = daysAgo(date_range);

  // ── 1. Resolve which connection IDs to query ─────────────────────────────
  let connectionIds: string[];

  if (connection_id) {
    // Verify the connection belongs to this user
    const [conn] = await db
      .select({ id: stripeConnections.id })
      .from(stripeConnections)
      .where(
        and(
          eq(stripeConnections.id, connection_id),
          eq(stripeConnections.userId, userId)
        )
      )
      .limit(1);

    if (!conn) {
      return NextResponse.json(
        { error: "Connection not found or access denied" },
        { status: 404 }
      );
    }
    connectionIds = [connection_id];
  } else {
    // Get all connections for this user
    const connections = await db
      .select({
        id: stripeConnections.id,
        stripeAccountId: stripeConnections.stripeAccountId,
        displayName: stripeConnections.displayName,
        livemode: stripeConnections.livemode,
        lastSyncAt: stripeConnections.lastSyncAt,
      })
      .from(stripeConnections)
      .where(eq(stripeConnections.userId, userId))
      .orderBy(desc(stripeConnections.connectedAt));

    if (connections.length === 0) {
      return NextResponse.json(
        { connections: [], snapshots: [], summary: null },
        { status: 200 }
      );
    }
    connectionIds = connections.map((c) => c.id);

    // ── 2. Fetch snapshots ─────────────────────────────────────────────────
    const snapshots = await db
      .select()
      .from(metricsSnapshots)
      .where(
        and(
          inArray(metricsSnapshots.connectionId, connectionIds),
          gte(metricsSnapshots.snapshotDate, sinceDate)
        )
      )
      .orderBy(desc(metricsSnapshots.snapshotDate));

    // ── 3. Compute summary (latest snapshot per connection) ───────────────
    const latestByConnection: Record<string, typeof snapshots[number]> = {};
    for (const snap of snapshots) {
      if (!latestByConnection[snap.connectionId]) {
        latestByConnection[snap.connectionId] = snap;
      }
    }

    const summary = computeAggregateSummary(
      Object.values(latestByConnection)
    );

    return NextResponse.json(
      {
        connections,
        snapshots,
        summary,
        meta: {
          date_range,
          since_date: sinceDate,
          total_snapshots: snapshots.length,
        },
      },
      { status: 200 }
    );
  }

  // ── Single connection path ────────────────────────────────────────────────
  const [connection] = await db
    .select({
      id: stripeConnections.id,
      stripeAccountId: stripeConnections.stripeAccountId,
      displayName: stripeConnections.displayName,
      livemode: stripeConnections.livemode,
      lastSyncAt: stripeConnections.lastSyncAt,
    })
    .from(stripeConnections)
    .where(eq(stripeConnections.id, connectionIds[0]))
    .limit(1);

  const snapshots = await db
    .select()
    .from(metricsSnapshots)
    .where(
      and(
        eq(metricsSnapshots.connectionId, connectionIds[0]),
        gte(metricsSnapshots.snapshotDate, sinceDate)
      )
    )
    .orderBy(desc(metricsSnapshots.snapshotDate));

  const summary =
    snapshots.length > 0 ? computeAggregateSummary([snapshots[0]]) : null;

  return NextResponse.json(
    {
      connections: [connection],
      snapshots,
      summary,
      meta: {
        date_range,
        since_date: sinceDate,
        total_snapshots: snapshots.length,
      },
    },
    { status: 200 }
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

type Snapshot = {
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
};

/**
 * Aggregate latest snapshots across connections:
 * - Sum MRR/ARR/subscriber counts
 * - Average rates
 */
function computeAggregateSummary(snapshots: Snapshot[]) {
  if (snapshots.length === 0) return null;

  const sum = (key: keyof Snapshot) =>
    snapshots.reduce((acc, s) => acc + (s[key] ?? 0), 0);

  const avg = (key: keyof Snapshot) =>
    snapshots.length > 0 ? Math.round(sum(key) / snapshots.length) : 0;

  return {
    mrr: sum("mrr"),
    arr: sum("arr"),
    activeSubscribers: sum("activeSubscribers"),
    newSubscribers: sum("newSubscribers"),
    churnedSubscribers: sum("churnedSubscribers"),
    trialSubscribers: sum("trialSubscribers"),
    newMrr: sum("newMrr"),
    expansionMrr: sum("expansionMrr"),
    contractionMrr: sum("contractionMrr"),
    churnMrr: sum("churnMrr"),
    netNewMrr: sum("netNewMrr"),
    churnRateBps: avg("churnRateBps"),
    trialToPaidRateBps: avg("trialToPaidRateBps"),
    arpu: avg("arpu"),
    ltv: avg("ltv"),
  };
}
