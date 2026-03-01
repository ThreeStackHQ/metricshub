/**
 * MetricsHub Worker — Job Processors
 *
 * Job types:
 *   1. "full-sync"         — Syncs all Stripe connections for all users
 *   2. "connection-sync"   — Syncs a specific Stripe connection
 */

import { Worker, Job } from "bullmq";
import { syncAllConnections, syncConnection } from "./sync";
import { db, stripeConnections } from "@metricshub/db";
import { eq } from "@metricshub/db";
import {
  connection,
  SYNC_QUEUE_NAME,
  type FullSyncJobData,
  type ConnectionSyncJobData,
} from "./queue";

// ─── Full Sync Processor ──────────────────────────────────────────────────────

async function processFullSync(job: Job<FullSyncJobData>): Promise<void> {
  console.log(`[full-sync] 🔄 Starting full sync (triggeredAt=${job.data.triggeredAt})`);

  await job.updateProgress(5);

  const results = await syncAllConnections();

  await job.updateProgress(90);

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const totalSubs = results.reduce((s, r) => s + (r.subscriptionCount ?? 0), 0);

  console.log(
    `[full-sync] ✅ Done: ${succeeded} connections synced, ${failed} failed, ` +
      `${totalSubs} total subscriptions processed`
  );

  await job.updateProgress(100);
}

// ─── Connection Sync Processor ────────────────────────────────────────────────

async function processConnectionSync(
  job: Job<ConnectionSyncJobData>
): Promise<void> {
  const { connectionId } = job.data;

  console.log(`[connection-sync] 🔄 Syncing connection ${connectionId}...`);

  await job.updateProgress(10);

  // Fetch the connection from DB
  const connection = await db.query.stripeConnections.findFirst({
    where: eq(stripeConnections.id, connectionId),
  });

  if (!connection) {
    throw new Error(`Connection ${connectionId} not found`);
  }

  await job.updateProgress(30);

  const result = await syncConnection(connection);

  await job.updateProgress(100);

  if (!result.success) {
    throw new Error(result.error ?? "Unknown sync error");
  }

  console.log(
    `[connection-sync] ✅ Done: ${result.subscriptionCount} subs, ` +
      `MRR=${result.metrics?.mrr}¢`
  );
}

// ─── Worker Factory ───────────────────────────────────────────────────────────

export function createSyncWorker(): Worker {
  const worker = new Worker<FullSyncJobData | ConnectionSyncJobData>(
    SYNC_QUEUE_NAME,
    async (job: Job) => {
      if (job.name === "full-sync") {
        await processFullSync(job as Job<FullSyncJobData>);
      } else if (job.name === "connection-sync") {
        await processConnectionSync(job as Job<ConnectionSyncJobData>);
      } else {
        console.warn(`[worker] Unknown job type: ${job.name}`);
      }
    },
    {
      connection,
      concurrency: 3,
      autorun: false,
    }
  );

  worker.on("completed", (job: Job) => {
    console.log(`[worker] ✅ Completed: ${job.name}#${job.id}`);
  });

  worker.on("failed", (job: Job | undefined, err: Error) => {
    console.error(
      `[worker] ❌ Failed: ${job?.name ?? "?"}#${job?.id ?? "?"}`,
      err.message
    );
  });

  worker.on("error", (err: Error) => {
    console.error("[worker] Worker error:", err.message);
  });

  return worker;
}
