import { initializeGitHub } from "./auth/github.js";
import { GITHUB_CONFIG } from "./auth/github.js";

const octokit = initializeGitHub();

/* ---------------- Data Transformation ---------------- */

function transformWebhookToGitHubFormat(event: any): any {
  console.log("Transforming webhook event to GitHub format:", event);
  const c =
    event.column_values || event.columnValues || event?.pulse?.column_values;

  if (!c) {
    throw new Error("No column values found in event");
  }

  // Extract data from Monday.com columns (updated field mapping)
  const projectName = c.text_mkr6cypr?.text || c.text_mkr6cypr?.value || "";
  const marketSector = c.color_mkr65y7p?.label?.text || "";
  const projectDesc = c.text_mkr6qyhd?.text || c.text_mkr6qyhd?.value || "";
  const website = c.link_mkr62c24?.url || "";
  const docs = c.link_mkr61z2y?.url || "";
  const contractsText =
    c.long_text_mkr6h69e?.text || c.long_text_mkr6h69e?.value || "";
  const email = c.email_mkr6crn7?.email || "";
  const github = c.linkpu5n23wn?.url || ""; 
  const twitter = c.linkf82j245c?.url || "";
  const telegramCommunity = c.linkwitzcip0?.url || ""; 
  const discord = c.link6ua963o8?.url || "";
  const coingeckoId =
    c.short_textbhlznjhg?.text || c.short_textbhlznjhg?.value || "";
  const telegramHandle =
    c.short_textsvrja3l1?.text || c.short_textsvrja3l1?.value || ""; 

  // Transform to awesome-sei format
  const awesomeData = {
    name: projectName,
    description:
      projectDesc || `${projectName} - A project in the ${marketSector} sector`,
    categories: transformMarketSectorToCategories(marketSector),
    addresses: parseContractAddresses(contractsText),
    links: {
      project: website || undefined,
      twitter: twitter || undefined,
      github: github || undefined,
      docs: docs || undefined,
      communityDiscord: discord || undefined,
      communityTelegram: telegramCommunity || undefined,
      email: email || undefined,
      coingecko: coingeckoId || undefined,
      telegram: telegramHandle || undefined,
    },
  };

  // Remove undefined values to keep JSON clean
  return removeUndefinedValues(awesomeData);
}

function transformMarketSectorToCategories(marketSector: string): string[] {
  // Map Monday.com market sectors to awesome-sei categories
  const sectorMap: Record<string, string[]> = {
    GameFi: ["Gaming::Games"],
    Gaming: ["Gaming::Games"],
    DeFi: ["DeFi::Lending", "DeFi::Trading"],
    NFT: ["NFT::Marketplaces"],
    Infrastructure: ["Infrastructure::Tools"],
    // Add more mappings as needed
  };

  return sectorMap[marketSector] || ["Other"];
}
function parseContractAddresses(contractsText: string): Record<string, string> {
  if (!contractsText) return {};

  const addresses: Record<string, string> = {};

  // First, split by lines to handle line-separated format
  let lines = contractsText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  // If we only have one line, check if it's comma-separated pairs
  if (lines.length === 1) {
    const singleLine = lines[0] as string;
    const parts = singleLine.split(",").map((part) => part.trim());

    // If we have an even number of parts (pairs), it's likely comma-separated format
    // Example: "TradingRouter,0x123,Marketplace,0x456" = 4 parts = 2 pairs
    if (parts.length > 2 && parts.length % 2 === 0) {
      lines = [];
      // Group every 2 parts into contract pairs
      for (let i = 0; i < parts.length; i += 2) {
        if (i + 1 < parts.length) {
          lines.push(`${parts[i]}, ${parts[i + 1]}`);
        }
      }
    }
  }

  // Now process each line as ContractName, Address
  for (const line of lines) {
    // Split by comma and clean up
    const parts = line
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    // Expected format: ContractName, Address
    // e.g., "TradingRouter, 0x3894085Ef7Ff0f0aeDf52E2A2704928d1Ec074F1"
    if (parts.length >= 2) {
      const [contractName, address] = parts as [string, string];
      addresses[contractName] = address;
    }
  }

  return addresses;
}

function removeUndefinedValues(obj: any): any {
  const cleaned: any = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null && value !== "") {
      if (typeof value === "object" && !Array.isArray(value)) {
        const cleanedNested = removeUndefinedValues(value);
        if (Object.keys(cleanedNested).length > 0) {
          cleaned[key] = cleanedNested;
        }
      } else if (Array.isArray(value) && value.length > 0) {
        cleaned[key] = value;
      } else if (typeof value !== "object") {
        cleaned[key] = value;
      }
    }
  }

  return cleaned;
}

/* ---------------- PR Creation Functions ---------------- */

async function createPRWithChanges(formattedData: any): Promise<string> {
  const { owner, repo, targetFile, baseBranch } = GITHUB_CONFIG;
  const branchName = `auto-update-${Date.now()}`;

  try {
    console.log("Creating PR with formatted data...");

    // 1. Get the base branch reference
    const { data: baseRef } = await octokit.rest.git.getRef({
      owner: owner!,
      repo: repo!,
      ref: `heads/${baseBranch}`,
    });

    console.log("Base branch SHA:", baseRef.object.sha);

    // 2. Create new branch from base
    await octokit.rest.git.createRef({
      owner: owner!,
      repo: repo!,
      ref: `refs/heads/${branchName}`,
      sha: baseRef.object.sha,
    });

    console.log("Created new branch:", branchName);

    // 3. Get current file content (if it exists)
    let currentFileSha: string | undefined;
    try {
      const { data: currentFile } = await octokit.rest.repos.getContent({
        owner: owner!,
        repo: repo!,
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
      owner: owner!,
      repo: repo!,
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

This PR adds a new project to the awesome-sei repository.

**Project:** ${formattedData.name}
**Categories:** ${formattedData.categories?.join(", ") || "N/A"}

**Changes:**
- Updated \`${targetFile}\` with new project data
- Timestamp: ${new Date().toISOString()}

**Project Details:**
\`\`\`json
${JSON.stringify(formattedData, null, 2)}
\`\`\`

_This PR was created automatically from Monday.com webhook data._`;
}

export { transformWebhookToGitHubFormat, createPRWithChanges };
