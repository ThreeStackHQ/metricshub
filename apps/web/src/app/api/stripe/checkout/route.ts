/**
 * Sprint 2.4 — Stripe Billing Integration
 *
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout Session for MetricsHub's subscription.
 * Returns { url } for client-side redirect.
 *
 * Plans:
 *   - pro  → Pro  $9/mo  (priceId: STRIPE_PRICE_PRO)
 *
 * Limits:
 *   Free: 1 Stripe connection, 30 days of history
 *   Pro:  3 Stripe connections, unlimited history
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY      — MetricsHub platform secret key
 *   STRIPE_PRICE_PRO       — Stripe Price ID for $9/mo plan
 *   NEXT_PUBLIC_APP_URL    — App base URL (for success/cancel redirects)
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@/auth";
import { db, subscriptions, users, eq } from "@metricshub/db";
import { z } from "zod";

// ─── Stripe Client ────────────────────────────────────────────────────────────

function getStripe(): Stripe {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key, { apiVersion: "2023-10-16" });
}

// ─── Request Schema ────────────────────────────────────────────────────────────

const CheckoutBodySchema = z.object({
  plan: z.enum(["pro"]),
  // Optional: billing_portal=true returns portal URL for existing customers
  billingPortal: z.boolean().optional().default(false),
});

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Auth check
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse + validate body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CheckoutBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid plan. Must be 'pro'" },
      { status: 400 }
    );
  }

  const { plan, billingPortal } = parsed.data;
  const priceId = process.env["STRIPE_PRICE_PRO"];

  if (!priceId) {
    return NextResponse.json(
      { error: "STRIPE_PRICE_PRO not configured" },
      { status: 500 }
    );
  }

  const appUrl =
    process.env["NEXT_PUBLIC_APP_URL"] ?? "https://app.metricshub.threestack.io";

  // 3. Load user details
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // 4. Get existing subscription record
  const [existingSub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, session.user.id))
    .limit(1);

  const stripeCustomerId = existingSub?.stripeCustomerId ?? undefined;

  // 5. Return billing portal if requested (manage existing subscription)
  if (billingPortal && stripeCustomerId) {
    try {
      const stripe = getStripe();
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: `${appUrl}/settings/billing`,
      });
      return NextResponse.json({ url: portalSession.url, type: "portal" });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: "Failed to create billing portal session", details: errMsg },
        { status: 500 }
      );
    }
  }

  // 6. If already on Pro and active, redirect to billing portal
  if (existingSub?.tier === "pro" && existingSub.status === "active" && stripeCustomerId) {
    try {
      const stripe = getStripe();
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: `${appUrl}/settings/billing`,
      });
      return NextResponse.json({ url: portalSession.url, type: "portal" });
    } catch {
      // Fall through to checkout
    }
  }

  // 7. Create Stripe Checkout Session
  try {
    const stripe = getStripe();

    const checkoutParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/settings/billing?success=1&plan=${plan}`,
      cancel_url: `${appUrl}/settings/billing?canceled=1`,
      client_reference_id: session.user.id,
      metadata: {
        userId: session.user.id,
        plan,
      },
      subscription_data: {
        metadata: {
          userId: session.user.id,
          plan,
        },
      },
    };

    // Attach to existing Stripe customer
    if (stripeCustomerId) {
      checkoutParams.customer = stripeCustomerId;
    } else {
      checkoutParams.customer_email = user.email;
    }

    const checkoutSession = await stripe.checkout.sessions.create(checkoutParams);

    if (!checkoutSession.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: checkoutSession.url, type: "checkout" });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[checkout] Stripe error: ${errMsg}`);
    return NextResponse.json(
      { error: "Failed to create checkout session", details: errMsg },
      { status: 500 }
    );
  }
}
