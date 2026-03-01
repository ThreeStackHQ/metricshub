/**
 * MetricsHub Worker — Queue Setup
 *
 * Queue: "stripe-sync" — syncs Stripe data and calculates metrics every hour.
 */

import { Queue } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import IORedis from "ioredis";

// ─── Redis Connection ─────────────────────────────────────────────────────────

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

export const redisConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
});

redisConnection.on("error", (err: Error) => {
  console.error("[redis] Connection error:", err.message);
});

redisConnection.on("connect", () => {
  console.log("[redis] Connected ✅");
});

// Cast to BullMQ ConnectionOptions (ioredis version mismatch workaround)
export const connection = redisConnection as unknown as ConnectionOptions;

// ─── Queue Names ──────────────────────────────────────────────────────────────

export const SYNC_QUEUE_NAME = "stripe-sync";

// ─── Queue Definitions ────────────────────────────────────────────────────────

/** The main sync queue — processes Stripe data sync jobs. */
export const syncQueue = new Queue(SYNC_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 10_000, // 10s, 20s, 40s
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

// ─── Job Data Types ───────────────────────────────────────────────────────────

/** Full sync: processes all connections for all users. */
export interface FullSyncJobData {
  triggeredAt: string; // ISO timestamp
}

/** Single-connection sync: processes one specific Stripe connection. */
export interface ConnectionSyncJobData {
  connectionId: string;
  userId: string;
  triggeredAt: string;
}
