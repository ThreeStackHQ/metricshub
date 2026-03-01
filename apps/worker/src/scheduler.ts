/**
 * MetricsHub Worker — Job Scheduler
 *
 * Registers repeating jobs:
 *   - full-sync → every 1 hour (3600 seconds)
 *
 * Idempotent: safe to call on every startup.
 */

import { syncQueue } from "./queue";
import type { FullSyncJobData } from "./queue";

const SYNC_INTERVAL_MS = 60 * 60 * 1_000; // 1 hour
const FULL_SYNC_JOB_KEY = "metricshub:full-sync";

export async function upsertScheduledJobs(): Promise<void> {
  const jobData: FullSyncJobData = {
    triggeredAt: new Date().toISOString(),
  };

  // Register hourly repeating job
  await syncQueue.add("full-sync", jobData, {
    repeat: {
      every: SYNC_INTERVAL_MS,
    },
    jobId: FULL_SYNC_JOB_KEY,
  });

  console.log("[scheduler] ✅ Registered full-sync repeating job (every 1 hour)");

  // Run once immediately on startup
  await syncQueue.add(
    "full-sync",
    { triggeredAt: new Date().toISOString() },
    { jobId: `${FULL_SYNC_JOB_KEY}:startup` }
  );

  console.log("[scheduler] ✅ Queued immediate startup sync");
}

export async function listScheduledJobs(): Promise<void> {
  const repeatableJobs = await syncQueue.getRepeatableJobs();
  if (repeatableJobs.length === 0) {
    console.log("[scheduler] No repeating jobs registered");
    return;
  }
  console.log(`[scheduler] Repeating jobs (${repeatableJobs.length}):`);
  for (const job of repeatableJobs) {
    const next = job.next ? new Date(job.next).toISOString() : "N/A";
    console.log(`  - ${job.name} | every ${job.every}ms | next: ${next}`);
  }
}
