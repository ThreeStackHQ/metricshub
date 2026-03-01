/**
 * MetricsHub — Metrics Calculation Library
 *
 * Computes SaaS metrics from a snapshot of Stripe subscription data.
 *
 * All monetary values are in **cents** (smallest currency unit) to avoid
 * floating-point rounding errors.
 *
 * Key metrics calculated:
 *   - MRR / ARR
 *   - Active / new / churned subscriber counts
 *   - Churn rate (% of subscribers lost in a period)
 *   - Net Revenue Retention (NRR)
 *   - ARPU (Average Revenue Per User)
 *   - LTV (Lifetime Value estimate)
 *   - MRR movement breakdown (new, expansion, contraction, churn, net-new)
 */

import type { StripeSubscription } from "./stripe-client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MetricsInput {
  /** All subscriptions for the connected Stripe account (any status). */
  subscriptions: StripeSubscription[];

  /**
   * Optional: subscriptions from the *previous* period.
   * When provided, enables NRR, net-new MRR, and movement calculations.
   */
  previousSubscriptions?: StripeSubscription[];

  /**
   * Date range for "new this period" / "churned this period" calculations.
   * Defaults to last 30 days if omitted.
   */
  periodStart?: Date;
  periodEnd?: Date;
}

export interface MetricsResult {
  // ── Revenue ──────────────────────────────────────────────────────────────
  /** Monthly Recurring Revenue in cents. */
  mrr: number;
  /** Annual Recurring Revenue in cents (MRR × 12). */
  arr: number;

  // ── Subscribers ──────────────────────────────────────────────────────────
  /** Subscriptions with status "active" or "trialing". */
  activeSubscribers: number;
  /** New subscriptions created within the period. */
  newSubscribers: number;
  /** Subscriptions that were canceled within the period. */
  churnedSubscribers: number;
  /** Subscriptions currently in trial. */
  trialSubscribers: number;

  // ── MRR Movement (in cents) ──────────────────────────────────────────────
  /** MRR contributed by new subscribers this period. */
  newMrr: number;
  /** MRR increase from existing subscribers upgrading. */
  expansionMrr: number;
  /** MRR decrease from existing subscribers downgrading. */
  contractionMrr: number;
  /** MRR lost from churned subscribers this period. */
  churnMrr: number;
  /** Net MRR change = newMrr + expansionMrr - contractionMrr - churnMrr. */
  netNewMrr: number;

  // ── Rates ─────────────────────────────────────────────────────────────────
  /** Churn rate in basis points (100bps = 1%). 0 if no subscribers. */
  churnRateBps: number;
  /** Trial-to-paid conversion rate in basis points. */
  trialToPaidRateBps: number;

  // ── Per-user metrics (in cents) ──────────────────────────────────────────
  /** Average Revenue Per User = MRR / activeSubscribers. */
  arpu: number;
  /**
   * Lifetime Value estimate = ARPU / monthly_churn_rate.
   * Returns 0 if churn rate is 0 (avoids divide-by-zero).
   */
  ltv: number;

  // ── Net Revenue Retention ─────────────────────────────────────────────────
  /**
   * NRR in basis points.
   * = (currentMrr from previous cohort) / previousMrr × 10000
   * Returns 0 if no previous period data.
   */
  nrrBps: number;
}

// ─── Interval → monthly multiplier ──────────────────────────────────────────

const MONTHLY_FACTOR: Record<string, number> = {
  day: 30,
  week: 4.348214, // avg weeks per month
  month: 1,
  year: 1 / 12,
};

/**
 * Convert a subscription's billed amount to monthly equivalent (in cents).
 * Uses items[0] if present, falls back to top-level plan.
 */
export function subscriptionMrrCents(sub: StripeSubscription): number {
  let totalCents = 0;

  if (sub.items.data.length > 0) {
    for (const item of sub.items.data) {
      const unitAmount = item.price.unit_amount ?? 0;
      const interval = item.price.recurring?.interval ?? "month";
      const intervalCount = item.price.recurring?.interval_count ?? 1;
      const quantity = item.quantity ?? 1;
      const factor = (MONTHLY_FACTOR[interval] ?? 1) / intervalCount;
      totalCents += Math.round(unitAmount * quantity * factor);
    }
  } else {
    // Fallback: top-level plan (older Stripe API)
    const amount = sub.plan?.amount ?? 0;
    const interval = sub.plan?.interval ?? "month";
    const intervalCount = sub.plan?.interval_count ?? 1;
    const factor = (MONTHLY_FACTOR[interval] ?? 1) / intervalCount;
    totalCents += Math.round(amount * factor);
  }

  return totalCents;
}

/**
 * Determine if a subscription is "active" (contributing to MRR).
 */
export function isActiveRevenue(sub: StripeSubscription): boolean {
  return sub.status === "active" || sub.status === "trialing";
}

// ─── Core calculation ────────────────────────────────────────────────────────

/**
 * Calculate all SaaS metrics from Stripe subscription data.
 */
export function calculateMetrics(input: MetricsInput): MetricsResult {
  const {
    subscriptions: subs,
    previousSubscriptions: prevSubs,
    periodStart,
    periodEnd,
  } = input;

  const now = new Date();
  const end = periodEnd ?? now;
  const start = periodStart ?? new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

  const startTs = Math.floor(start.getTime() / 1000);
  const endTs = Math.floor(end.getTime() / 1000);

  // ── Active subscribers & MRR ──────────────────────────────────────────────

  const activeSubs = subs.filter(isActiveRevenue);
  const trialSubs = subs.filter((s) => s.status === "trialing");

  const mrr = activeSubs.reduce(
    (sum, sub) => sum + subscriptionMrrCents(sub),
    0
  );
  const arr = Math.round(mrr * 12);

  // ── New subscribers this period ───────────────────────────────────────────

  const newSubs = subs.filter(
    (s) =>
      s.created >= startTs &&
      s.created <= endTs &&
      (s.status === "active" || s.status === "trialing")
  );

  const newMrr = newSubs.reduce(
    (sum, s) => sum + subscriptionMrrCents(s),
    0
  );

  // ── Churned subscribers this period ──────────────────────────────────────

  const churnedSubs = subs.filter(
    (s) =>
      s.status === "canceled" &&
      s.canceled_at !== undefined &&
      s.canceled_at !== null &&
      s.canceled_at >= startTs &&
      s.canceled_at <= endTs
  );

  const churnMrr = churnedSubs.reduce(
    (sum, s) => sum + subscriptionMrrCents(s),
    0
  );

  // ── Churn rate ─────────────────────────────────────────────────────────────
  // Churn rate = churned / (active at start of period)
  // Active at start: subscriptions created before period start and not yet canceled

  const activeAtStart = subs.filter(
    (s) =>
      s.created < startTs &&
      (s.status === "active" ||
        s.status === "trialing" ||
        (s.status === "canceled" &&
          s.canceled_at !== undefined &&
          s.canceled_at !== null &&
          s.canceled_at >= startTs))
  );

  const churnRateBps =
    activeAtStart.length > 0
      ? Math.round((churnedSubs.length / activeAtStart.length) * 10000)
      : 0;

  // ── Trial-to-paid conversion rate ─────────────────────────────────────────

  const trialToPaidRateBps = (() => {
    // Approximation: active non-trial subs / (active + trial)
    const totalActive = activeSubs.length;
    const paid = activeSubs.filter((s) => s.status === "active").length;
    return totalActive > 0
      ? Math.round((paid / totalActive) * 10000)
      : 0;
  })();

  // ── ARPU & LTV ────────────────────────────────────────────────────────────

  const arpu =
    activeSubs.length > 0 ? Math.round(mrr / activeSubs.length) : 0;

  const monthlyChurnRate = churnRateBps / 10000;
  const ltv =
    monthlyChurnRate > 0 ? Math.round(arpu / monthlyChurnRate) : 0;

  // ── MRR movement: expansion & contraction ─────────────────────────────────

  let expansionMrr = 0;
  let contractionMrr = 0;

  if (prevSubs && prevSubs.length > 0) {
    // Build previous MRR map by subscription ID
    const prevMrrMap = new Map<string, number>();
    for (const s of prevSubs) {
      if (isActiveRevenue(s)) {
        prevMrrMap.set(s.id, subscriptionMrrCents(s));
      }
    }

    // Compare current active subs to previous period
    for (const sub of activeSubs) {
      const prevMrr = prevMrrMap.get(sub.id);
      if (prevMrr === undefined) continue; // new subscriber (counted in newMrr)

      const currentMrr = subscriptionMrrCents(sub);
      const delta = currentMrr - prevMrr;

      if (delta > 0) expansionMrr += delta;
      else if (delta < 0) contractionMrr += Math.abs(delta);
    }
  }

  const netNewMrr = newMrr + expansionMrr - contractionMrr - churnMrr;

  // ── NRR ───────────────────────────────────────────────────────────────────

  let nrrBps = 0;

  if (prevSubs && prevSubs.length > 0) {
    const prevMrr = prevSubs
      .filter(isActiveRevenue)
      .reduce((sum, s) => sum + subscriptionMrrCents(s), 0);

    if (prevMrr > 0) {
      // NRR = current MRR from previous cohort / previous MRR
      // Previous cohort: subs that existed in prev period AND are still active
      const prevIds = new Set(prevSubs.filter(isActiveRevenue).map((s) => s.id));
      const cohortMrr = activeSubs
        .filter((s) => prevIds.has(s.id))
        .reduce((sum, s) => sum + subscriptionMrrCents(s), 0);

      nrrBps = Math.round((cohortMrr / prevMrr) * 10000);
    }
  }

  return {
    mrr,
    arr,
    activeSubscribers: activeSubs.length,
    newSubscribers: newSubs.length,
    churnedSubscribers: churnedSubs.length,
    trialSubscribers: trialSubs.length,
    newMrr,
    expansionMrr,
    contractionMrr,
    churnMrr,
    netNewMrr,
    churnRateBps,
    trialToPaidRateBps,
    arpu,
    ltv,
    nrrBps,
  };
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

/**
 * Format cents as a currency string (e.g. 9900 → "$99.00").
 */
export function formatCurrency(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Format basis points as a percentage string (e.g. 250 → "2.50%").
 */
export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

/**
 * Format a MetricsResult into a human-readable summary (useful for debugging
 * or the weekly digest email).
 */
export function formatMetricsSummary(
  metrics: MetricsResult,
  currency = "usd"
): string {
  const fmt = (cents: number) => formatCurrency(cents, currency);
  const pct = (bps: number) => formatBps(bps);

  return [
    `MRR: ${fmt(metrics.mrr)} | ARR: ${fmt(metrics.arr)}`,
    `Active: ${metrics.activeSubscribers} | New: ${metrics.newSubscribers} | Churned: ${metrics.churnedSubscribers}`,
    `Churn Rate: ${pct(metrics.churnRateBps)} | NRR: ${pct(metrics.nrrBps)}`,
    `ARPU: ${fmt(metrics.arpu)} | LTV: ${fmt(metrics.ltv)}`,
    `Net New MRR: ${fmt(metrics.netNewMrr)} (new: ${fmt(metrics.newMrr)}, expansion: ${fmt(metrics.expansionMrr)}, contraction: -${fmt(metrics.contractionMrr)}, churn: -${fmt(metrics.churnMrr)})`,
  ].join("\n");
}
