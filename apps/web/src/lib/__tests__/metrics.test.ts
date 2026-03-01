/**
 * Unit tests for the MetricsHub metrics calculation library.
 * Run with: pnpm test
 */

import {
  calculateMetrics,
  subscriptionMrrCents,
  formatCurrency,
  formatBps,
} from "../metrics";
import type { StripeSubscription } from "../stripe-client";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const now = Math.floor(Date.now() / 1000);
const daysAgo = (d: number) => now - d * 24 * 60 * 60;

function makeSub(
  overrides: Partial<StripeSubscription> & { monthly_cents?: number }
): StripeSubscription {
  const { monthly_cents = 1000, ...rest } = overrides;
  return {
    id: `sub_${Math.random().toString(36).slice(2)}`,
    customer: `cus_test`,
    status: "active",
    plan: {
      id: "price_monthly",
      amount: monthly_cents,
      currency: "usd",
      interval: "month",
      interval_count: 1,
      nickname: "Monthly",
      product: "prod_test",
    },
    items: {
      data: [
        {
          id: `si_test`,
          price: {
            id: "price_monthly",
            unit_amount: monthly_cents,
            currency: "usd",
            recurring: { interval: "month", interval_count: 1 },
            product: "prod_test",
          },
          quantity: 1,
        },
      ],
    },
    current_period_start: daysAgo(15),
    current_period_end: daysAgo(-15),
    cancel_at: null,
    cancel_at_period_end: false,
    canceled_at: null,
    trial_end: null,
    created: daysAgo(60),
    ...rest,
  };
}

// ─── subscriptionMrrCents ─────────────────────────────────────────────────────

describe("subscriptionMrrCents", () => {
  test("monthly subscription returns amount as-is", () => {
    const sub = makeSub({ monthly_cents: 2900 });
    expect(subscriptionMrrCents(sub)).toBe(2900);
  });

  test("annual subscription divides by 12", () => {
    const sub = makeSub({});
    sub.items.data[0].price.unit_amount = 34800; // $348/yr
    sub.items.data[0].price.recurring = { interval: "year", interval_count: 1 };
    expect(subscriptionMrrCents(sub)).toBe(2900); // $29/mo
  });

  test("weekly subscription multiplies by 4.348...", () => {
    const sub = makeSub({});
    sub.items.data[0].price.unit_amount = 690; // $6.90/wk
    sub.items.data[0].price.recurring = { interval: "week", interval_count: 1 };
    const mrr = subscriptionMrrCents(sub);
    expect(mrr).toBeGreaterThan(2900); // ~$30/mo
    expect(mrr).toBeLessThan(3100);
  });

  test("quantity is factored in", () => {
    const sub = makeSub({ monthly_cents: 1000 });
    sub.items.data[0].quantity = 5;
    expect(subscriptionMrrCents(sub)).toBe(5000);
  });
});

// ─── calculateMetrics ─────────────────────────────────────────────────────────

describe("calculateMetrics — basic", () => {
  test("empty subscriptions returns zeros", () => {
    const result = calculateMetrics({ subscriptions: [] });
    expect(result.mrr).toBe(0);
    expect(result.activeSubscribers).toBe(0);
    expect(result.churnRateBps).toBe(0);
    expect(result.arpu).toBe(0);
  });

  test("MRR sums active subscriptions", () => {
    const subs = [
      makeSub({ monthly_cents: 1000 }),
      makeSub({ monthly_cents: 2000 }),
      makeSub({ monthly_cents: 5000, status: "canceled", canceled_at: daysAgo(100) }),
    ];
    const result = calculateMetrics({ subscriptions: subs });
    expect(result.mrr).toBe(3000);
    expect(result.arr).toBe(36000);
    expect(result.activeSubscribers).toBe(2);
  });

  test("ARPU = MRR / active subscribers", () => {
    const subs = [
      makeSub({ monthly_cents: 1000 }),
      makeSub({ monthly_cents: 3000 }),
    ];
    const result = calculateMetrics({ subscriptions: subs });
    expect(result.arpu).toBe(2000); // (1000 + 3000) / 2
  });

  test("trialing subscriptions count as active", () => {
    const subs = [
      makeSub({ status: "trialing", trial_end: daysAgo(-14) }),
    ];
    const result = calculateMetrics({ subscriptions: subs });
    expect(result.activeSubscribers).toBe(1);
    expect(result.trialSubscribers).toBe(1);
    expect(result.mrr).toBeGreaterThan(0);
  });
});

describe("calculateMetrics — new & churned", () => {
  test("counts new subscribers created within period", () => {
    const periodStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const periodEnd = new Date();

    const subs = [
      makeSub({ created: daysAgo(15) }), // within period
      makeSub({ created: daysAgo(45) }), // outside period
    ];

    const result = calculateMetrics({ subscriptions: subs, periodStart, periodEnd });
    expect(result.newSubscribers).toBe(1);
  });

  test("counts churned subscribers within period", () => {
    const periodStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const periodEnd = new Date();

    const subs = [
      makeSub({ status: "canceled", canceled_at: daysAgo(10) }), // within period
      makeSub({ status: "canceled", canceled_at: daysAgo(60) }), // outside period
      makeSub({}), // active
    ];

    const result = calculateMetrics({ subscriptions: subs, periodStart, periodEnd });
    expect(result.churnedSubscribers).toBe(1);
  });
});

describe("calculateMetrics — NRR & movement", () => {
  test("NRR = 100% when no change between periods", () => {
    const sub = makeSub({ monthly_cents: 1000 });
    const result = calculateMetrics({
      subscriptions: [sub],
      previousSubscriptions: [sub],
    });
    expect(result.nrrBps).toBe(10000); // 100%
  });

  test("expansion MRR detected when subscription value increases", () => {
    const id = "sub_expanded";
    const prev = makeSub({ id, monthly_cents: 1000 });
    const curr = makeSub({ id, monthly_cents: 2000 });

    const result = calculateMetrics({
      subscriptions: [curr],
      previousSubscriptions: [prev],
    });
    expect(result.expansionMrr).toBe(1000);
    expect(result.contractionMrr).toBe(0);
  });

  test("contraction MRR detected when subscription value decreases", () => {
    const id = "sub_contracted";
    const prev = makeSub({ id, monthly_cents: 3000 });
    const curr = makeSub({ id, monthly_cents: 1000 });

    const result = calculateMetrics({
      subscriptions: [curr],
      previousSubscriptions: [prev],
    });
    expect(result.contractionMrr).toBe(2000);
    expect(result.expansionMrr).toBe(0);
  });
});

// ─── Formatting helpers ───────────────────────────────────────────────────────

describe("formatCurrency", () => {
  test("formats cents as USD", () => {
    expect(formatCurrency(9900)).toBe("$99.00");
    expect(formatCurrency(100000)).toBe("$1,000.00");
    expect(formatCurrency(0)).toBe("$0.00");
  });
});

describe("formatBps", () => {
  test("formats basis points as percentage", () => {
    expect(formatBps(1000)).toBe("10.00%");
    expect(formatBps(250)).toBe("2.50%");
    expect(formatBps(0)).toBe("0.00%");
  });
});
