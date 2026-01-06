import { Worker } from "bullmq";
import { connection } from "./queue.js";
import {
  transformWebhookToGitHubFormat,
  createPRWithChanges,
} from "./github-interactor.js";

const githubWorker = new Worker(
  "github-pr-creation",
  async (job) => {
    console.log("Processing GitHub PR job:", job.id);

    const { event, receivedAt } = job.data;

    if (!event) {
      console.warn("⚠️ Missing event object, skipping GitHub PR job", job.id);
      return;
    }

    try {
      // Transform the Monday.com data to GitHub format
      const formattedData = transformWebhookToGitHubFormat({
        ...event,
        receivedAt,
      });

      console.log("Transformed data:", JSON.stringify(formattedData, null, 2));

      // Create PR with the formatted data
      const prUrl = await createPRWithChanges(formattedData);

      console.log("✅ PR created successfully:", prUrl);

      // Return the PR URL for job result
      return {
        success: true,
        prUrl,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("❌ Failed to create GitHub PR:", error);
      throw error; // This will mark the job as failed
    }
  },
  {
    connection,
  }
);

/* ---------------- Worker Events ---------------- */

githubWorker.on("completed", (job, result) => {
  console.log("GitHub PR job completed:", job.id, "Result:", result);
});

githubWorker.on("failed", (job, err) => {
  console.error("❌ GitHub PR job failed:", job?.id, err.message);
});

githubWorker.on("error", (err) => {
  console.error("❌ GitHub worker error:", err);
});

console.log("GitHub PR Worker running…");
