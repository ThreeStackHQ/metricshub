import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  date,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const subscriptionTierEnum = pgEnum("subscription_tier", [
  "free",
  "pro",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "trialing",
  "past_due",
  "canceled",
  "unpaid",
  "incomplete",
]);

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    name: text("name"),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_idx").on(t.email),
  })
);

// ─── Stripe Connections ───────────────────────────────────────────────────────
// Stores the user's connected Stripe account (OAuth).
// Access token is encrypted with AES-256-GCM.

export const stripeConnections = pgTable(
  "stripe_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),

    // The connected Stripe account ID (acct_xxx)
    stripeAccountId: text("stripe_account_id").notNull(),

    // Display name of the Stripe account
    displayName: text("display_name"),
    email: text("email"),
    livemode: boolean("livemode").default(false).notNull(),

    // AES-256-GCM encrypted access token
    accessTokenEnc: text("access_token_enc").notNull(),
    accessTokenIv: text("access_token_iv").notNull(),
    accessTokenTag: text("access_token_tag").notNull(),

    // AES-256-GCM encrypted refresh token (nullable)
    refreshTokenEnc: text("refresh_token_enc"),
    refreshTokenIv: text("refresh_token_iv"),
    refreshTokenTag: text("refresh_token_tag"),

    // OAuth scope granted
    scope: text("scope"),

    // When the last successful sync ran
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),

    connectedAt: timestamp("connected_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    userIdx: index("stripe_connections_user_idx").on(t.userId),
    accountIdx: uniqueIndex("stripe_connections_account_idx").on(
      t.stripeAccountId
    ),
  })
);

// ─── Metrics Snapshots ────────────────────────────────────────────────────────
// Daily snapshots of Stripe metrics per connected account.
// All monetary values are stored in cents.

export const metricsSnapshots = pgTable(
  "metrics_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    connectionId: uuid("connection_id")
      .references(() => stripeConnections.id, { onDelete: "cascade" })
      .notNull(),

    // The date this snapshot represents (UTC date)
    snapshotDate: date("snapshot_date").notNull(),

    // Core metrics (in cents)
    mrr: integer("mrr").default(0).notNull(), // Monthly Recurring Revenue
    arr: integer("arr").default(0).notNull(), // Annual Recurring Revenue

    // Subscriber counts
    activeSubscribers: integer("active_subscribers").default(0).notNull(),
    newSubscribers: integer("new_subscribers").default(0).notNull(),
    churnedSubscribers: integer("churned_subscribers").default(0).notNull(),
    trialSubscribers: integer("trial_subscribers").default(0).notNull(),

    // MRR movement (in cents)
    newMrr: integer("new_mrr").default(0).notNull(), // MRR from new subscribers
    expansionMrr: integer("expansion_mrr").default(0).notNull(), // MRR from upgrades
    contractionMrr: integer("contraction_mrr").default(0).notNull(), // MRR from downgrades
    churnMrr: integer("churn_mrr").default(0).notNull(), // MRR lost to churn
    netNewMrr: integer("net_new_mrr").default(0).notNull(), // Net MRR change

    // Rates (in basis points: 100bps = 1%)
    churnRateBps: integer("churn_rate_bps").default(0).notNull(),
    trialToPaidRateBps: integer("trial_to_paid_rate_bps").default(0).notNull(),

    // Per-user metrics (in cents)
    arpu: integer("arpu").default(0).notNull(), // Avg Revenue Per User
    ltv: integer("ltv").default(0).notNull(), // Lifetime Value estimate

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    userDateIdx: index("metrics_snapshots_user_date_idx").on(
      t.userId,
      t.snapshotDate
    ),
    connectionDateIdx: uniqueIndex("metrics_snapshots_connection_date_idx").on(
      t.connectionId,
      t.snapshotDate
    ),
  })
);

// ─── Subscriptions ────────────────────────────────────────────────────────────
// MetricsHub's own billing — the user's plan subscription.

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),

    // MetricsHub Stripe billing fields
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripePriceId: text("stripe_price_id"),

    tier: subscriptionTierEnum("tier").default("free").notNull(),
    status: subscriptionStatusEnum("status").default("active").notNull(),

    currentPeriodStart: timestamp("current_period_start", {
      withTimezone: true,
    }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),

    trialEnd: timestamp("trial_end", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    userIdx: uniqueIndex("subscriptions_user_idx").on(t.userId),
    stripeCustomerIdx: index("subscriptions_stripe_customer_idx").on(
      t.stripeCustomerId
    ),
    stripeSubscriptionIdx: index("subscriptions_stripe_subscription_idx").on(
      t.stripeSubscriptionId
    ),
  })
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many, one }) => ({
  stripeConnections: many(stripeConnections),
  metricsSnapshots: many(metricsSnapshots),
  subscription: one(subscriptions, {
    fields: [users.id],
    references: [subscriptions.userId],
  }),
}));

export const stripeConnectionsRelations = relations(
  stripeConnections,
  ({ one, many }) => ({
    user: one(users, {
      fields: [stripeConnections.userId],
      references: [users.id],
    }),
    metricsSnapshots: many(metricsSnapshots),
  })
);

export const metricsSnapshotsRelations = relations(
  metricsSnapshots,
  ({ one }) => ({
    user: one(users, {
      fields: [metricsSnapshots.userId],
      references: [users.id],
    }),
    connection: one(stripeConnections, {
      fields: [metricsSnapshots.connectionId],
      references: [stripeConnections.id],
    }),
  })
);

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
}));

// ─── TypeScript types ─────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type StripeConnection = typeof stripeConnections.$inferSelect;
export type NewStripeConnection = typeof stripeConnections.$inferInsert;

export type MetricsSnapshot = typeof metricsSnapshots.$inferSelect;
export type NewMetricsSnapshot = typeof metricsSnapshots.$inferInsert;

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;

export type SubscriptionTier = (typeof subscriptionTierEnum.enumValues)[number];
export type SubscriptionStatus =
  (typeof subscriptionStatusEnum.enumValues)[number];
