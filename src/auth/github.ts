import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import dotenv from "dotenv";

dotenv.config();

// GitHub Configuration
const GITHUB_CONFIG = {
  owner: process.env.GITHUB_OWNER,
  repo: process.env.GITHUB_REPO,
  baseTargetPath: process.env.BASE_TARGET_PATH || "data",
  baseBranch: process.env.BASE_BRANCH || "main",
};

// Initialize GitHub client
function initializeGitHub(): Octokit {
  // Option 1: Personal Access Token
  if (process.env.GITHUB_TOKEN) {
    return new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });
  }

  // Option 2: GitHub App
  if (process.env.GITHUB_APP_ID) {
    return new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: process.env.GITHUB_APP_ID,
        privateKey: process.env.GITHUB_APP_PRIVATE_KEY,
        installationId: process.env.GITHUB_APP_INSTALLATION_ID,
      },
    });
  }

  throw new Error("No GitHub authentication method configured");
}

export { initializeGitHub, GITHUB_CONFIG };
