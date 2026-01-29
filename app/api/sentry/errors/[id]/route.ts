import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { matchLinearIssue, type SentryError, type LinearIssue } from "@/lib/utils/linear-matcher";

export const dynamic = 'force-dynamic'; // Force dynamic rendering since we use auth headers
// Cache error details for 120 seconds (2 minutes)
export const revalidate = 120;

// Helper function to fetch Linear issues from Sortme/Triage
async function fetchLinearIssues(linearApiKey: string): Promise<LinearIssue[]> {
  try {
    const query = {
      query: `
        query GetSortmeTriageIssues {
          issues(
            filter: {
              team: {
                name: { eq: "Sortme" }
              }
              state: {
                name: { eq: "Triage" }
              }
            }
            first: 100
            orderBy: updatedAt
          ) {
            nodes {
              id
              identifier
              title
              description
              url
            }
          }
        }
      `,
    };

    const response = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: linearApiKey,
      },
      body: JSON.stringify(query),
      next: { revalidate: 120 },
    });

    if (response.ok) {
      const data = await response.json();
      return data.data?.issues?.nodes || [];
    }
  } catch (error) {
    console.error("Failed to fetch Linear issues:", error);
  }
  return [];
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: errorId } = await params;
    
    if (!errorId) {
      return NextResponse.json({
        error: "Error ID is required",
      }, { status: 400 });
    }

    // Get Sentry credentials from environment variables
    const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
    const sentryOrg = process.env.SENTRY_ORG;
    const sentryFrontendProject = process.env.SENTRY_FRONTEND_PROJECT;
    const sentryBackendProject = process.env.SENTRY_BACKEND_PROJECT;
    const sentryProject = process.env.SENTRY_PROJECT; // Fallback

    if (!sentryAuthToken || !sentryOrg) {
      return NextResponse.json({
        error: "Sentry credentials not configured",
        message: "Please set SENTRY_AUTH_TOKEN and SENTRY_ORG environment variables.",
      }, { status: 500 });
    }

    console.log("Fetching error details for ID:", errorId);
    console.log("Organization:", sentryOrg);

    // Fetch error details from Sentry API
    // Try the direct issues endpoint first
    let url = `https://sentry.io/api/0/issues/${errorId}/`;
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${sentryAuthToken}`,
        "Content-Type": "application/json",
      },
      next: { revalidate: 120 }, // Cache for 2 minutes
    });

    if (!response.ok) {
      // If direct endpoint fails, try project-specific endpoints
      if (response.status === 404) {
        console.log("Direct endpoint failed, trying project-specific endpoints");
        
        // Try frontend project first
        if (sentryFrontendProject) {
          const frontendUrl = `https://sentry.io/api/0/projects/${sentryOrg}/${sentryFrontendProject}/issues/${errorId}/`;
          const frontendResponse = await fetch(frontendUrl, {
            headers: {
              Authorization: `Bearer ${sentryAuthToken}`,
              "Content-Type": "application/json",
            },
            next: { revalidate: 120 },
          });

          if (frontendResponse.ok) {
            const issueData = await frontendResponse.json();
            return await processIssueData(issueData, errorId, sentryFrontendProject, sentryAuthToken, sentryFrontendProject, sentryBackendProject);
          }
        }

        // Try backend project
        if (sentryBackendProject) {
          const backendUrl = `https://sentry.io/api/0/projects/${sentryOrg}/${sentryBackendProject}/issues/${errorId}/`;
          const backendResponse = await fetch(backendUrl, {
            headers: {
              Authorization: `Bearer ${sentryAuthToken}`,
              "Content-Type": "application/json",
            },
            next: { revalidate: 120 },
          });

          if (backendResponse.ok) {
            const issueData = await backendResponse.json();
            return await processIssueData(issueData, errorId, sentryBackendProject, sentryAuthToken, sentryFrontendProject, sentryBackendProject);
          }
        }

        // Try fallback project if configured
        if (sentryProject) {
          const fallbackUrl = `https://sentry.io/api/0/projects/${sentryOrg}/${sentryProject}/issues/${errorId}/`;
          const fallbackResponse = await fetch(fallbackUrl, {
            headers: {
              Authorization: `Bearer ${sentryAuthToken}`,
              "Content-Type": "application/json",
            },
            next: { revalidate: 120 },
          });

          if (fallbackResponse.ok) {
            const issueData = await fallbackResponse.json();
            return await processIssueData(issueData, errorId, sentryProject, sentryAuthToken, sentryFrontendProject, sentryBackendProject);
          }
        }

        // All endpoints failed
        let errorDetails = "";
        try {
          const errorData = await response.json();
          errorDetails = errorData.detail || errorData.message || JSON.stringify(errorData);
        } catch {
          const errorText = await response.text();
          errorDetails = errorText || "No error details available";
        }

        return NextResponse.json({
          error: `Failed to fetch error details: ${response.status} ${response.statusText}`,
          details: errorDetails,
          debug: {
            errorId,
            org: sentryOrg,
            frontendProject: sentryFrontendProject,
            backendProject: sentryBackendProject,
            fallbackProject: sentryProject,
            url,
          },
        }, { status: response.status });
      } else {
        let errorDetails = "";
        try {
          const errorData = await response.json();
          errorDetails = errorData.detail || errorData.message || JSON.stringify(errorData);
        } catch {
          const errorText = await response.text();
          errorDetails = errorText || "No error details available";
        }

        console.error("Sentry API error:", {
          status: response.status,
          statusText: response.statusText,
          url,
          errorId,
          errorDetails,
        });

        return NextResponse.json({
          error: `Failed to fetch error details: ${response.status} ${response.statusText}`,
          details: errorDetails,
          debug: {
            errorId,
            org: sentryOrg,
            url,
          },
        }, { status: response.status });
      }
    }

    const issueData = await response.json();
    // Try to get project from issue data
    const issueProjectSlug = issueData.project?.slug || sentryFrontendProject || sentryBackendProject || sentryProject || "default";
    return await processIssueData(issueData, errorId, issueProjectSlug, sentryAuthToken, sentryFrontendProject, sentryBackendProject);
  } catch (error) {
    console.error("Error fetching Sentry error details:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch error details",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}

async function processIssueData(issueData: any, errorId: string, projectSlug: string, sentryAuthToken: string, sentryFrontendProject?: string, sentryBackendProject?: string) {
  // Determine project type based on project slug
  let projectType: "frontend" | "backend" = "frontend";
  if (sentryFrontendProject && projectSlug === sentryFrontendProject) {
    projectType = "frontend";
  } else if (sentryBackendProject && projectSlug === sentryBackendProject) {
    projectType = "backend";
  } else if (sentryBackendProject && !sentryFrontendProject) {
    // If only backend project is configured, assume backend
    projectType = "backend";
  }
  // Fetch recent events for this issue
  const eventsUrl = `https://sentry.io/api/0/issues/${errorId}/events/`;
  let events = [];
  try {
    const eventsResponse = await fetch(eventsUrl, {
      headers: {
        Authorization: `Bearer ${sentryAuthToken}`,
        "Content-Type": "application/json",
      },
      next: { revalidate: 120 }, // Cache for 2 minutes
    });
    if (eventsResponse.ok) {
      events = await eventsResponse.json();
    }
  } catch (err) {
    console.error("Failed to fetch events:", err);
  }

  // Fetch Linear issues and match with this error
  let linearIssue = undefined;
  const linearApiKey = process.env.LINEAR_API_KEY;
  if (linearApiKey) {
    try {
      const linearIssues = await fetchLinearIssues(linearApiKey);
      const sentryError: SentryError = {
        id: String(issueData.id || errorId),
        title: issueData.title || "",
        level: issueData.level || "error",
        lastSeen: issueData.lastSeen || new Date().toISOString(),
        count: issueData.count || 0,
        userCount: issueData.userCount || 0,
        projectType: projectType === "frontend" ? "Frontend" : "Backend",
        culprit: issueData.culprit,
        metadata: issueData.metadata,
      };
      linearIssue = matchLinearIssue(sentryError, linearIssues);
    } catch (err) {
      console.error("Failed to match Linear issue:", err);
      // Continue without Linear issue if matching fails
    }
  }

  // Transform the data
  const errorDetails = {
    id: issueData.id,
    title: issueData.title,
    level: issueData.level || "error",
    status: issueData.status,
    count: issueData.count || 0,
    userCount: issueData.userCount || 0,
    firstSeen: issueData.firstSeen,
    lastSeen: issueData.lastSeen,
    culprit: issueData.culprit || "",
    permalink: issueData.permalink || "",
    project: projectSlug,
    projectType: projectType,
    metadata: issueData.metadata || {},
    tags: issueData.tags || [],
    assignedTo: issueData.assignedTo || null,
    logger: issueData.logger || "",
    type: issueData.type || "",
    numComments: issueData.numComments || 0,
    isPublic: issueData.isPublic || false,
    platform: issueData.platform || "",
    events: events.slice(0, 10), // Limit to 10 most recent events
    linearIssue: linearIssue,
  };

  return NextResponse.json({ data: errorDetails });
}
