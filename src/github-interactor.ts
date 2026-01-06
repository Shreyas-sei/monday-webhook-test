import { initializeGitHub } from "./auth/github.js";
import { GITHUB_CONFIG } from "./auth/github.js";

const octokit = initializeGitHub();

/* ---------------- Data Transformation ---------------- */

function transformWebhookToGitHubFormat(event: any): any {
  // TODO: Implement specific data transformation logic here
  // This transforms Monday.com webhook data to the desired GitHub file format

  const c =
    event.column_values || event.columnValues || event?.pulse?.column_values;

  if (!c) {
    throw new Error("No column values found in event");
  }

  // Example transformation - customize this based on your needs
  const transformedData = {
    timestamp: new Date().toISOString(),
    source: "monday.com",
    eventType: event.type,
    data: {
      projectName: c.text_mkr6cypr?.text || c.text_mkr6cypr?.value || "",
      marketSector: c.color_mkr65y7p?.label?.text || "",
      website: c.link_mkr62c24?.url || "",
      docs: c.link_mkr61z2y?.url || "",
      contracts:
        c.long_text_mkr6h69e?.text || c.long_text_mkr6h69e?.value || "",
      email: c.email_mkr6crn7?.email || "",
      // Add more fields as needed
    },
    metadata: {
      receivedAt: event.receivedAt || new Date().toISOString(),
      processedAt: new Date().toISOString(),
    },
  };

  return transformedData;
}

/* ---------------- PR Creation Functions ---------------- */

async function createPRWithChanges(formattedData: any): Promise<string> {
  const { owner, repo, targetFile, baseBranch } = GITHUB_CONFIG;
  const branchName = `auto-update-${Date.now()}`;

  try {
    console.log("Creating PR with formatted data...");

    // 1. Get the base branch reference
    const { data: baseRef } = await octokit.rest.git.getRef({
      owner: owner as string,
      repo: repo as string,
      ref: `heads/${baseBranch}`,
    });

    console.log("Base branch SHA:", baseRef.object.sha);

    // 2. Create new branch from base
    await octokit.rest.git.createRef({
      owner: owner as string,
      repo: repo as string,
      ref: `refs/heads/${branchName}`,
      sha: baseRef.object.sha,
    });

    console.log("Created new branch:", branchName);

    // 3. Get current file content (if it exists)
    let currentFileSha: string | undefined;
    try {
      const { data: currentFile } = await octokit.rest.repos.getContent({
        owner: owner as string,
        repo: repo as string,
        path: targetFile,
        ref: baseBranch,
      });

      if ("sha" in currentFile) {
        currentFileSha = currentFile.sha;
      }
    } catch (error) {
      console.log("File does not exist, will create new file");
    }

    // 4. Prepare file content
    const fileContent = JSON.stringify(formattedData, null, 2);
    const encodedContent = Buffer.from(fileContent).toString("base64");

    // 5. Create or update the file
    const updateParams: any = {
      owner,
      repo,
      path: targetFile,
      message: `Auto-update: Monday.com data formatting (${new Date().toISOString()})`,
      content: encodedContent,
      branch: branchName,
    };

    if (currentFileSha) {
      updateParams.sha = currentFileSha;
    }

    await octokit.rest.repos.createOrUpdateFileContents(updateParams);

    console.log("File updated successfully");

    // 6. Create Pull Request
    const { data: pr } = await octokit.rest.pulls.create({
      owner: owner as string,
      repo: repo as string,
      title: `Auto-update: Monday.com webhook data`,
      head: branchName,
      base: baseBranch,
      body: generatePRDescription(formattedData, targetFile),
    });

    console.log("PR created:", pr.html_url);
    return pr.html_url;
  } catch (error) {
    console.error("Error creating PR:", error);
    throw error;
  }
}

function generatePRDescription(formattedData: any, targetFile: string): string {
  return `## Auto-generated PR from Monday.com

This PR was automatically created from Monday.com webhook data.

**Changes:**
- Updated \`${targetFile}\` with formatted webhook data
- Timestamp: ${new Date().toISOString()}

**Data Summary:**
\`\`\`json
${JSON.stringify(formattedData, null, 2).substring(0, 500)}${
    JSON.stringify(formattedData, null, 2).length > 500 ? "..." : ""
  }
\`\`\`

**Project Details:**
- **Project Name:** ${formattedData.data?.projectName || "N/A"}
- **Market Sector:** ${formattedData.data?.marketSector || "N/A"}
- **Website:** ${formattedData.data?.website || "N/A"}

_This PR was created automatically by the Monday.com webhook handler._`;
}

export { transformWebhookToGitHubFormat, createPRWithChanges };
