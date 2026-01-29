import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic'; // Force dynamic rendering since we use auth headers

export async function POST(request: Request) {
  try {
    const session = await auth();
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { errorId, aiExplanation, linearIssueId, assigneeId } = body;

    if (!errorId || !aiExplanation) {
      return NextResponse.json(
        { error: "Error ID and AI explanation are required" },
        { status: 400 }
      );
    }

    // Get Linear API credentials from environment variables
    // Linear API key format: lin_api_xxxxx or can be a Personal API Key
    const linearApiKey = process.env.LINEAR_API_KEY;

    if (!linearApiKey) {
      return NextResponse.json(
        { 
          error: "Linear API key not configured",
          message: "Please set LINEAR_API_KEY environment variable. Get your API key from https://linear.app/settings/api"
        },
        { status: 500 }
      );
    }

    // If linearIssueId is not provided, try to find it from Sentry tags
    let issueId = linearIssueId;
    
    if (!issueId) {
      // Fetch error details from Sentry to get tags
      const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
      if (sentryAuthToken) {
        try {
          const sentryResponse = await fetch(
            `https://sentry.io/api/0/issues/${errorId}/`,
            {
              headers: {
                Authorization: `Bearer ${sentryAuthToken}`,
                "Content-Type": "application/json",
              },
            }
          );

          if (sentryResponse.ok) {
            const sentryData = await sentryResponse.json();
            const tags = sentryData.tags || [];
            
            console.log("Sentry tags:", JSON.stringify(tags, null, 2));
            
            // Look for Linear issue ID in tags (common patterns: linear:issue_id, linear_issue_id, etc.)
            const linearTag = tags.find(
              (tag: any) =>
                tag.key?.toLowerCase().includes("linear") &&
                tag.value
            );
            
            if (linearTag?.value) {
              // Extract issue ID from various formats
              // Could be: "ABC-123", "https://linear.app/workspace/issue/ABC-123", or just "ABC-123"
              const match = linearTag.value.match(/([A-Z]+-\d+)/);
              if (match) {
                issueId = match[1];
              } else {
                issueId = linearTag.value;
              }
              console.log("Found Linear issue ID from tags:", issueId);
            }
            
            // Also check metadata for Linear references
            if (!issueId && sentryData.metadata) {
              const metadataStr = JSON.stringify(sentryData.metadata);
              const metadataMatch = metadataStr.match(/([A-Z]+-\d+)/);
              if (metadataMatch) {
                issueId = metadataMatch[1];
                console.log("Found Linear issue ID from metadata:", issueId);
              }
            }
            
            // Check all tag values for Linear issue pattern
            if (!issueId) {
              for (const tag of tags) {
                if (tag.value) {
                  const match = String(tag.value).match(/([A-Z]+-\d+)/);
                  if (match) {
                    issueId = match[1];
                    console.log(`Found Linear issue ID in tag ${tag.key}:`, issueId);
                    break;
                  }
                }
              }
            }
          }
        } catch (err) {
          console.error("Failed to fetch Sentry tags:", err);
        }
      }
    }

    if (!issueId) {
      return NextResponse.json(
        { 
          error: "Linear issue ID not found",
          message: "Please provide a Linear issue ID or ensure Sentry tags contain the Linear issue reference."
        },
        { status: 400 }
      );
    }

    // Format the AI explanation for Linear
    const formattedDescription = formatAIExplanationForLinear(aiExplanation);

    // First, we need to find the issue by identifier (e.g., "ABC-123")
    // Linear GraphQL API requires the issue ID (UUID), not the identifier
    // So we'll first query to get the issue ID from the identifier
    let linearIssueUuid: string = issueId;
    
    // If issueId looks like an identifier (ABC-123), we need to find the actual UUID
    if (issueId.match(/^[A-Z]+-\d+$/)) {
      const findIssueQuery = {
        query: `
          query FindIssue($identifier: String!) {
            issue(identifier: $identifier) {
              id
              identifier
              title
            }
          }
        `,
        variables: {
          identifier: issueId,
        },
      };

      const findResponse = await fetch("https://api.linear.app/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: linearApiKey,
        },
        body: JSON.stringify(findIssueQuery),
      });

      if (findResponse.ok) {
        const findData = await findResponse.json();
        if (findData.data?.issue?.id) {
          linearIssueUuid = findData.data.issue.id;
        } else {
          return NextResponse.json(
            { 
              error: "Linear issue not found",
              message: `Could not find Linear issue with identifier: ${issueId}`
            },
            { status: 404 }
          );
        }
      }
    }

    // Update Linear issue description
    const linearResponse = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: linearApiKey,
      },
      body: JSON.stringify({
        query: `
          mutation UpdateIssue($issueId: String!, $description: String, $assigneeId: String) {
            issueUpdate(id: $issueId, input: { description: $description, assigneeId: $assigneeId }) {
              success
              issue {
                id
                identifier
                title
                description
                assignee {
                  id
                  name
                  email
                }
                url
              }
            }
          }
        `,
        variables: {
          issueId: linearIssueUuid,
          description: formattedDescription,
          assigneeId: assigneeId || null,
        },
      }),
    });

    if (!linearResponse.ok) {
      const errorText = await linearResponse.text();
      console.error("Linear API error:", errorText);
      return NextResponse.json(
        { 
          error: "Failed to update Linear issue",
          details: errorText 
        },
        { status: linearResponse.status }
      );
    }

    const linearData = await linearResponse.json();

    if (linearData.errors) {
      return NextResponse.json(
        { 
          error: "Linear API error",
          details: linearData.errors 
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      issue: linearData.data?.issueUpdate?.issue,
      message: "AI explanation forwarded to Linear successfully",
    });
  } catch (error) {
    console.error("Error forwarding to Linear:", error);
    return NextResponse.json(
      {
        error: "Failed to forward to Linear",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}

function formatAIExplanationForLinear(aiExplanation: any): string {
  let description = `# 🐛 Error Summary\n\n`;
  
  // Severity badge
  if (aiExplanation.severity) {
    const severityEmoji = {
      critical: "🔴",
      high: "🟠",
      medium: "🟡",
      low: "🟢"
    };
    description += `**Severity:** ${severityEmoji[aiExplanation.severity as keyof typeof severityEmoji] || "⚪"} ${aiExplanation.severity.toUpperCase()}\n\n`;
  }

  // Brief Overview (truncate if too long)
  if (aiExplanation.overview) {
    const overview = aiExplanation.overview.length > 200 
      ? aiExplanation.overview.substring(0, 200) + "..."
      : aiExplanation.overview;
    description += `## 📋 Overview\n${overview}\n\n`;
  }

  // Main AI Explanation (condensed)
  if (aiExplanation.aiErrorExplanation) {
    const mainExplanation = aiExplanation.aiErrorExplanation.length > 300
      ? aiExplanation.aiErrorExplanation.substring(0, 300) + "..."
      : aiExplanation.aiErrorExplanation;
    description += `## 💡 What's Wrong?\n${mainExplanation}\n\n`;
  }

  // Top 2-3 Most Likely Causes (prioritize high likelihood)
  if (aiExplanation.possibleCauses && aiExplanation.possibleCauses.length > 0) {
    description += `## 🔍 Top Causes\n\n`;
    const sortedCauses = [...aiExplanation.possibleCauses].sort((a: any, b: any) => {
      const likelihoodOrder: { [key: string]: number } = { high: 3, medium: 2, low: 1 };
      return (likelihoodOrder[b.likelihood] || 0) - (likelihoodOrder[a.likelihood] || 0);
    });
    
    sortedCauses.slice(0, 3).forEach((cause: any, index: number) => {
      description += `${index + 1}. **${cause.cause}** (${cause.likelihood.toUpperCase()})`;
      if (cause.codeReference) {
        description += ` - \`${cause.codeReference}\``;
      }
      description += `\n`;
    });
    description += `\n`;
  }

  // Top 2-3 Recommended Fixes (prioritize high priority, easy difficulty)
  if (aiExplanation.suggestedFixes && aiExplanation.suggestedFixes.length > 0) {
    description += `## ✅ Recommended Solutions\n\n`;
    const sortedFixes = [...aiExplanation.suggestedFixes].sort((a: any, b: any) => {
      const priorityOrder: { [key: string]: number } = { high: 3, medium: 2, low: 1 };
      const difficultyOrder: { [key: string]: number } = { easy: 1, medium: 2, hard: 3 };
      const aScore = (priorityOrder[a.priority] || 0) * 10 - (difficultyOrder[a.difficulty] || 0);
      const bScore = (priorityOrder[b.priority] || 0) * 10 - (difficultyOrder[b.difficulty] || 0);
      return bScore - aScore;
    });
    
    sortedFixes.slice(0, 3).forEach((fix: any, index: number) => {
      description += `${index + 1}. **${fix.fix}** (${fix.priority.toUpperCase()} priority, ${fix.difficulty.toUpperCase()})\n`;
      if (fix.steps && fix.steps.length > 0) {
        // Show only first 2-3 steps
        fix.steps.slice(0, 3).forEach((step: string, stepIndex: number) => {
          description += `   ${stepIndex + 1}. ${step}\n`;
        });
        if (fix.steps.length > 3) {
          description += `   ... and ${fix.steps.length - 3} more step(s)\n`;
        }
      }
      description += `\n`;
    });
  }

  // Key Impact (condensed)
  if (aiExplanation.impact) {
    description += `## 📊 Impact\n\n`;
    if (aiExplanation.impact.userImpact) {
      const userImpact = aiExplanation.impact.userImpact.length > 150
        ? aiExplanation.impact.userImpact.substring(0, 150) + "..."
        : aiExplanation.impact.userImpact;
      description += `👥 **Users:** ${userImpact}\n\n`;
    }
    if (aiExplanation.impact.systemImpact) {
      const systemImpact = aiExplanation.impact.systemImpact.length > 150
        ? aiExplanation.impact.systemImpact.substring(0, 150) + "..."
        : aiExplanation.impact.systemImpact;
      description += `⚙️ **System:** ${systemImpact}\n\n`;
    }
  }

  // Quick prevention tip (if available)
  if (aiExplanation.preventionTips && aiExplanation.preventionTips.length > 0) {
    description += `## 💡 Prevention\n${aiExplanation.preventionTips[0]}\n\n`;
  }

  description += `---\n*Summary generated by BugBuddy AI Error Explainer*\n`;

  return description;
}
