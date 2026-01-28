import { initializeGitHub } from "./auth/github.js";
import { GITHUB_CONFIG } from "./auth/github.js";

const octokit = initializeGitHub();

function generateTargetFilePath(projectName: string): string {
  const sanitizedName = sanitizeProjectName(projectName);
  return `${GITHUB_CONFIG.baseTargetPath}/${sanitizedName}.json`;
}

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

  // Ethereum address regex (0x followed by 40 hex characters)
  const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

  // Function to check if a string is a valid Ethereum address
  const isValidAddress = (address: string): boolean => {
    return ETH_ADDRESS_REGEX.test(address.trim());
  };

  // Function to clean and normalize text
  const cleanText = (text: string): string => {
    return text.trim().replace(/[""'']/g, '"'); // Normalize quotes
  };

  // Split by lines first
  let lines = contractsText
    .split(/\r?\n/)
    .map((line) => cleanText(line))
    .filter((line) => line.length > 0);

  // If single line, try to split it into multiple entries
  if (lines.length === 1) {
    const singleLine = lines[0] as string;

    // Try different delimiters in order of preference
    const delimiters = [";", "|", "\t"];
    let bestSplit = [singleLine];

    for (const delimiter of delimiters) {
      if (singleLine.includes(delimiter)) {
        const parts = singleLine
          .split(delimiter)
          .map((p) => p.trim())
          .filter((p) => p);
        if (parts.length > 1) {
          bestSplit = parts;
          break;
        }
      }
    }

    // If no other delimiter worked, try comma but be more careful
    if (bestSplit.length === 1 && singleLine.includes(",")) {
      const commaParts = singleLine
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p);

      // Check if it looks like comma-separated pairs
      if (commaParts.length >= 2 && commaParts.length % 2 === 0) {
        // Verify that every second item looks like an address
        let isValidPairFormat = true;
        for (let i = 1; i < commaParts.length; i += 2) {
          if (!isValidAddress(commaParts[i]!)) {
            isValidPairFormat = false;
            break;
          }
        }

        if (isValidPairFormat) {
          bestSplit = [];
          for (let i = 0; i < commaParts.length; i += 2) {
            if (i + 1 < commaParts.length) {
              bestSplit.push(`${commaParts[i]}, ${commaParts[i + 1]}`);
            }
          }
        }
      }
    }

    lines = bestSplit;
  }

  // Process each line
  for (const line of lines) {
    if (!line.trim()) continue;

    let contractName = "";
    let address = "";

    // Try different separators: colon, comma, equals, space
    const separators = [":", ",", "="];
    let parsed = false;

    for (const separator of separators) {
      if (line.includes(separator)) {
        const parts = line
          .split(separator)
          .map((p) => p.trim())
          .filter((p) => p);

        if (parts.length >= 2) {
          // For comma separator, be more careful about multiple parts
          if (separator === "," && parts.length > 2) {
            // Try to find the address part - look for 0x pattern
            let addressIndex = -1;
            let nameIndex = -1;

            for (let i = 0; i < parts.length; i++) {
              const part = parts[i]!;
              if (
                part.toLowerCase().startsWith("0x") ||
                /^[a-fA-F0-9]+$/.test(part)
              ) {
                addressIndex = i;
                // Find the closest non-address part as name
                if (i > 0 && !parts[i - 1]!.toLowerCase().startsWith("0x")) {
                  nameIndex = i - 1;
                } else if (
                  i < parts.length - 1 &&
                  !parts[i + 1]!.toLowerCase().startsWith("0x")
                ) {
                  nameIndex = i + 1;
                }
                break;
              }
            }

            if (addressIndex >= 0 && nameIndex >= 0) {
              contractName = parts[nameIndex]!;
              address = parts[addressIndex]!;
              parsed = true;
              break;
            }
          }

          // Standard two-part parsing
          if (!parsed) {
            const [first, second] = parts as [string, string];

            // Check if first part looks like an address (starts with 0x or is hex)
            const firstLooksLikeAddress =
              first.toLowerCase().startsWith("0x") ||
              /^[a-fA-F0-9]+$/.test(first);
            const secondLooksLikeAddress =
              second.toLowerCase().startsWith("0x") ||
              /^[a-fA-F0-9]+$/.test(second);

            if (firstLooksLikeAddress && !secondLooksLikeAddress) {
              // address, name format
              contractName = second;
              address = first;
              parsed = true;
              break;
            } else if (!firstLooksLikeAddress && secondLooksLikeAddress) {
              // name, address format
              contractName = first;
              address = second;
              parsed = true;
              break;
            }
          }
        }
      }
    }

    // Try space separator last (more ambiguous)
    if (!parsed && line.includes(" ")) {
      const parts = line
        .split(/\s+/)
        .map((p) => p.trim())
        .filter((p) => p);

      if (parts.length >= 2) {
        // Look for address-like patterns
        const addressPart = parts.find(
          (part) =>
            part.toLowerCase().startsWith("0x") || /^[a-fA-F0-9]+$/.test(part),
        );

        if (addressPart) {
          address = addressPart;
          contractName = parts
            .filter((part) => part !== addressPart)
            .join(" ")
            .trim();
          parsed = true;
        }
      }
    }

    // Final validation and cleaning
    if (parsed && contractName && address) {
      // Clean contract name
      contractName = contractName
        .replace(/^[,:\s=]+|[,:\s=]+$/g, "") // Remove leading/trailing separators
        .replace(/[""'']/g, "") // Remove quotes
        .trim();

      // Ensure address has 0x prefix if it looks like hex
      if (
        !address.toLowerCase().startsWith("0x") &&
        /^[a-fA-F0-9]+$/.test(address)
      ) {
        address = `0x${address}`;
      }

      // Store the result (even if address validation fails, let the caller decide)
      if (contractName && address) {
        addresses[contractName] = address;
      }
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

/* ---------------- Helper Functions ---------------- */

/**
 * Sanitize project name for use in Git branch names
 * - Convert to lowercase
 * - Replace spaces and special characters with hyphens
 * - Remove consecutive hyphens
 * - Trim hyphens from start/end
 */
function sanitizeProjectName(projectName: string): string {
  if (!projectName) {
    return "unknown-project";
  }

  return projectName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-") // Replace non-alphanumeric with hyphens
    .replace(/-+/g, "-") // Replace consecutive hyphens with single hyphen
    .replace(/^-+|-+$/g, "") // Remove leading/trailing hyphens
    .substring(0, 50); // Limit length for file system compatibility
}

/**
 * Check if a branch already exists
 */
async function branchExists(branchName: string): Promise<boolean> {
  const { owner, repo } = GITHUB_CONFIG;

  try {
    await octokit.rest.git.getRef({
      owner: owner!,
      repo: repo!,
      ref: `heads/${branchName}`,
    });
    return true;
  } catch (error: any) {
    if (error.status === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * Generate a unique branch name based on project name
 */
async function generateUniqueBranchName(projectName: string): Promise<string> {
  const sanitizedName = sanitizeProjectName(projectName);
  let branchName = `auto-update-${sanitizedName}`;

  // Check if branch exists, if so, add timestamp to make it unique
  if (await branchExists(branchName)) {
    branchName = `auto-update-${sanitizedName}-${Date.now()}`;
  }

  return branchName;
}

/* ---------------- PR Creation Functions ---------------- */

async function createPRWithChanges(formattedData: any): Promise<string> {
  const { owner, repo, baseBranch } = GITHUB_CONFIG;

  const targetFile = generateTargetFilePath(formattedData.name);

  // Generate branch name based on project name
  const branchName = await generateUniqueBranchName(formattedData.name);

  try {
    console.log(
      `Creating PR with formatted data for project: ${formattedData.name}`,
    );
    console.log(`Using branch name: ${branchName}`);

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
      message: `Auto-update: Add ${formattedData.name} project data (${new Date().toISOString()})`,
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
      title: `Auto-update: Add ${formattedData.name} project`,
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
