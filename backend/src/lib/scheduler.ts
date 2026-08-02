// Parent: REQ-1661 — first background-job infra in this backend. Opt-in via
// SCHEDULE_JOBS_ENABLED (default off) so a developer restarting the backend
// locally many times a day never triggers a real admin email by accident;
// a real deployment sets it to "true" explicitly. In-process node-cron
// (rather than a hosted scheduler) matches this project's "no new
// infrastructure beyond measured need" convention — a single backend
// instance doesn't need distributed-cron coordination.

import cron from "node-cron";
import { runLowStockDigestJob, runWeeklySalesSummaryJob } from "../services/scheduledJobs.service";

export function startScheduledJobs(): void {
  if (process.env.SCHEDULE_JOBS_ENABLED !== "true") {
    console.log("Scheduled jobs disabled (set SCHEDULE_JOBS_ENABLED=true to enable).");
    return;
  }

  // Daily at 08:00 server time — low/out-of-stock digest (REQ-1654's logic, on a timer).
  cron.schedule("0 8 * * *", () => {
    runLowStockDigestJob().catch((error) => console.error("Scheduled low-stock digest failed:", error));
  });

  // Weekly Monday 08:00 server time — AI-narrated sales summary (REQ-1613's chain, on a timer).
  cron.schedule("0 8 * * 1", () => {
    runWeeklySalesSummaryJob().catch((error) => console.error("Scheduled weekly sales summary failed:", error));
  });

  console.log("Scheduled jobs registered: daily low-stock digest (08:00), weekly sales summary (Mon 08:00).");
}
