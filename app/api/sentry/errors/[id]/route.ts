import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Cache error details for 120 seconds (2 minutes)
export const revalidate = 120;

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
      // If direct endpoint fails, try project-specific endpoint
      if (response.status === 404) {
        console.log("Direct endpoint failed, trying project-specific endpoint");
        url = `https://sentry.io/api/0/projects/${sentryOrg}/${projectSlug}/issues/${errorId}/`;
        
          const projectResponse = await fetch(url, {
            headers: {
              Authorization: `Bearer ${sentryAuthToken}`,
              "Content-Type": "application/json",
            },
            next: { revalidate: 120 }, // Cache for 2 minutes
          });

        if (!projectResponse.ok) {
          let errorDetails = "";
          try {
            const errorData = await projectResponse.json();
            errorDetails = errorData.detail || errorData.message || JSON.stringify(errorData);
          } catch {
            const errorText = await projectResponse.text();
            errorDetails = errorText || "No error details available";
          }

          console.error("Sentry API error:", {
            status: projectResponse.status,
            statusText: projectResponse.statusText,
            url,
            errorId,
            errorDetails,
          });

          return NextResponse.json({
            error: `Failed to fetch error details: ${projectResponse.status} ${projectResponse.statusText}`,
            details: errorDetails,
            debug: {
              errorId,
              org: sentryOrg,
              project: projectSlug,
              url,
            },
          }, { status: projectResponse.status });
        }

        // Use project response if successful
        const issueData = await projectResponse.json();
        // Extract project slug from URL
        const extractedProjectSlug = url.split('/projects/')[1]?.split('/')[0] || projectSlug || "default";
        return await processIssueData(issueData, errorId, extractedProjectSlug, sentryAuthToken, sentryFrontendProject, sentryBackendProject);
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
            project: projectSlug,
            url,
          },
        }, { status: response.status });
      }
    }

    const issueData = await response.json();
    // Try to get project from issue data, or use a default
    const issueProjectSlug = issueData.project?.slug || projectSlug || "default";
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
  };

  return NextResponse.json({ data: errorDetails });
}
