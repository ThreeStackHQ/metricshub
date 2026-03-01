/**
 * POST /api/stripe/webhook
 *
 * Handles incoming Stripe webhook events for MetricsHub.
 *
 * Two categories of events:
 *
 * 1. MetricsHub's own billing events (no `account` header):
 *    - customer.subscription.created  → create/update subscriptions row
 *    - customer.subscription.updated  → update tier/status/period
 *    - customer.subscription.deleted  → mark as canceled
 *    - invoice.payment_failed         → mark subscription past_due
 *    - invoice.payment_succeeded      → mark subscription active
 *
 * 2. Connected-account events (with `Stripe-Account` header):
 *    - customer.subscription.*        → mark connection for re-sync
 *      (clears last_sync_at so the BullMQ worker picks it up next cycle)
 *
 * Security: raw body is verified with Stripe-Signature header (HMAC-SHA256).
 * Important: Next.js must NOT parse this body. We read it as text.
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY          — MetricsHub's own Stripe secret key
 *   STRIPE_WEBHOOK_SECRET      — Signing secret for platform webhook endpoint
 *   STRIPE_CONNECT_WEBHOOK_SECRET — Signing secret for Connect webhook endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { db, subscriptions, stripeConnections, eq } from "@metricshub/db";

// ─── Stripe subscription event payload (minimal subset) ────────────────────

interface StripeSubscriptionObject {
  id: string;
  customer: string;
  status:
    | "active"
    | "trialing"
    | "past_due"
    | "canceled"
    | "unpaid"
    | "incomplete"
    | "incomplete_expired";
  items: {
    data: Array<{
      price: {
        id: string;
        product: string;
      };
    }>;
  };
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  trial_end: number | null;
}

interface StripeInvoiceObject {
  id: string;
  customer: string;
  subscription: string | null;
  status: "draft" | "open" | "void" | "paid" | "uncollectible";
  amount_due: number;
}

interface StripeEvent {
  id: string;
  type: string;
  account?: string; // present for Connect events
  data: {
    object: Record<string, unknown>;
  };
}

// ─── Stripe signature verification ──────────────────────────────────────────

/**
 * Verify a Stripe webhook signature using HMAC-SHA256.
 * Replicates what `stripe.webhooks.constructEvent` does, without the SDK.
 *
 * @param payload - raw request body string
 * @param sigHeader - value of the Stripe-Signature header
 * @param secret - webhook signing secret (whsec_...)
 * @returns parsed event object or throws on invalid signature
 */
async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string
): Promise<StripeEvent> {
  const parts = sigHeader.split(",").reduce(
    (acc, part) => {
      const [k, v] = part.split("=");
      if (k === "t") acc.timestamp = v;
      if (k === "v1") acc.signatures.push(v);
      return acc;
    },
    { timestamp: "", signatures: [] as string[] }
  );

  if (!parts.timestamp || parts.signatures.length === 0) {
    throw new Error("Invalid Stripe-Signature header");
  }

  // Reject events older than 5 minutes (replay attack prevention)
  const ts = parseInt(parts.timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > 300) {
    throw new Error("Stripe webhook timestamp too old");
  }

  const signedPayload = `${parts.timestamp}.${payload}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signedPayload)
  );

  const expected = Buffer.from(signatureBuffer).toString("hex");

  const isValid = parts.signatures.some((sig) => {
    try {
      // Timing-safe comparison
      if (sig.length !== expected.length) return false;
      const a = Buffer.from(sig, "hex");
      const b = Buffer.from(expected, "hex");
      return crypto.subtle && a.length === b.length
        ? !Buffer.compare(a, b)
        : sig === expected;
    } catch {
      return false;
    }
  });

  if (!isValid) {
    throw new Error("Stripe webhook signature verification failed");
  }

  return JSON.parse(payload) as StripeEvent;
}

// ─── Plan tier mapping ───────────────────────────────────────────────────────

function tierFromPriceId(
  priceId: string
): "free" | "pro" {
  const proIds = (process.env.STRIPE_PRICE_PRO ?? "").split(",");
  if (proIds.includes(priceId)) return "pro";
  return "free";
}

// ─── Event handlers ─────────────────────────────────────────────────────────

async function handleSubscriptionUpsert(sub: StripeSubscriptionObject) {
  const priceId = sub.items.data[0]?.price?.id ?? "";
  const tier = tierFromPriceId(priceId);

  const mapStatus = (
    s: StripeSubscriptionObject["status"]
  ): "active" | "canceled" | "past_due" | "trialing" => {
    if (s === "active") return "active";
    if (s === "canceled" || s === "incomplete_expired") return "canceled";
    if (s === "past_due" || s === "unpaid") return "past_due";
    if (s === "trialing") return "trialing";
    return "active";
  };

  await db
    .update(subscriptions)
    .set({
      tier,
      status: mapStatus(sub.status),
      stripeSubscriptionId: sub.id,
      stripePriceId: priceId,
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.stripeCustomerId, sub.customer));
}

async function handleSubscriptionDeleted(sub: StripeSubscriptionObject) {
  await db
    .update(subscriptions)
    .set({
      tier: "free",
      status: "canceled",
      stripeSubscriptionId: null,
      stripePriceId: null,
      cancelAtPeriodEnd: false,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.stripeCustomerId, sub.customer));
}

/**
 * Mark the connected Stripe account for re-sync.
 * The BullMQ worker checks last_sync_at and picks up stale connections.
 */
async function markConnectionForResync(stripeAccountId: string) {
  await db
    .update(stripeConnections)
    .set({ lastSyncAt: null, updatedAt: new Date() })
    .where(eq(stripeConnections.stripeAccountId, stripeAccountId));
}

// ─── Route handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Read raw body (must not be parsed by Next.js)
  const rawBody = await request.text();
  const sigHeader = request.headers.get("stripe-signature");

  if (!sigHeader) {
    return NextResponse.json({ error: "Missing Stripe-Signature" }, { status: 400 });
  }

  // Detect if this is a Connect event (has Stripe-Account header)
  const connectedAccountId = request.headers.get("stripe-account");
  const isConnectEvent = !!connectedAccountId;

  // Choose signing secret
  const webhookSecret = isConnectEvent
    ? process.env.STRIPE_CONNECT_WEBHOOK_SECRET
    : process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("[webhook] Missing webhook secret env var");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  let event: StripeEvent;

  try {
    event = await verifyStripeSignature(rawBody, sigHeader, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Signature error";
    console.error("[webhook] Signature verification failed:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  console.log(`[webhook] ${event.type}${isConnectEvent ? ` (acct: ${connectedAccountId})` : ""}`);

  try {
    if (isConnectEvent && connectedAccountId) {
      // ── Connected-account events: mark for re-sync ──────────────────────
      if (
        event.type === "customer.subscription.created" ||
        event.type === "customer.subscription.updated" ||
        event.type === "customer.subscription.deleted"
      ) {
        await markConnectionForResync(connectedAccountId);
        console.log(`[webhook] Marked ${connectedAccountId} for re-sync`);
      }
    } else {
      // ── Platform events: own billing ────────────────────────────────────
      switch (event.type) {
        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const sub = event.data.object as StripeSubscriptionObject;
          await handleSubscriptionUpsert(sub);
          break;
        }

        case "customer.subscription.deleted": {
          const sub = event.data.object as StripeSubscriptionObject;
          await handleSubscriptionDeleted(sub);
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object as StripeInvoiceObject;
          // Mark subscription as past_due
          await db
            .update(subscriptions)
            .set({ status: "past_due", updatedAt: new Date() })
            .where(eq(subscriptions.stripeCustomerId, invoice.customer));
          break;
        }

        case "invoice.payment_succeeded": {
          const invoice = event.data.object as StripeInvoiceObject;
          // Re-activate subscription if it was past_due
          await db
            .update(subscriptions)
            .set({ status: "active", updatedAt: new Date() })
            .where(eq(subscriptions.stripeCustomerId, invoice.customer));
          break;
        }

        default:
          // Unhandled event type — acknowledge and ignore
          console.log(`[webhook] Unhandled event type: ${event.type}`);
      }
    }
  } catch (err) {
    console.error("[webhook] Handler error:", err);
    // Return 200 to prevent Stripe from retrying DB errors immediately
    // Log to your error tracker (e.g. Sentry) in production
    return NextResponse.json({ received: true, warning: "Handler error — check logs" });
  }

  return NextResponse.json({ received: true });
}

// Disable Next.js body parsing — Stripe requires the raw body for HMAC
export const config = {
  api: {
    bodyParser: false,
  },
};
