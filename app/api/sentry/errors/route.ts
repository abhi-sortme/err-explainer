import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic'; // Force dynamic rendering since we use auth headers
// Cache this route for 60 seconds (revalidate every minute)
export const revalidate = 60;

export async function GET() {
  try {
    const session = await auth();
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get Sentry credentials from environment variables
    const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
    const sentryOrg = process.env.SENTRY_ORG;
    const sentryFrontendProject = process.env.SENTRY_FRONTEND_PROJECT;
    const sentryBackendProject = process.env.SENTRY_BACKEND_PROJECT;
    // Fallback to old variable name for backward compatibility
    const sentryProject = process.env.SENTRY_PROJECT;

    if (!sentryAuthToken || !sentryOrg) {
      return NextResponse.json({
        errors: [],
        message: "Sentry credentials not configured. Please set SENTRY_AUTH_TOKEN and SENTRY_ORG environment variables.",
      });
    }

    // Determine which projects to fetch
    const projects: Array<{ slug: string; type: "frontend" | "backend" }> = [];
    
    if (sentryFrontendProject) {
      projects.push({ slug: sentryFrontendProject, type: "frontend" });
    }
    if (sentryBackendProject) {
      projects.push({ slug: sentryBackendProject, type: "backend" });
    }
    // Fallback to single project if new variables not set
    if (projects.length === 0 && sentryProject) {
      projects.push({ slug: sentryProject, type: "frontend" });
    }
    
    if (projects.length === 0) {
      return NextResponse.json({
        errors: [],
        message: "No projects configured. Please set SENTRY_FRONTEND_PROJECT and/or SENTRY_BACKEND_PROJECT environment variables.",
      });
    }

    // First, verify the token works by checking organizations
    // This helps diagnose 403 errors
    let orgCheckUrl = `https://sentry.io/api/0/organizations/${sentryOrg}/`;
    const orgResponse = await fetch(orgCheckUrl, {
      headers: {
        Authorization: `Bearer ${sentryAuthToken}`,
        "Content-Type": "application/json",
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!orgResponse.ok) {
      let errorDetails = "";
      try {
        const errorData = await orgResponse.json();
        errorDetails = errorData.detail || errorData.message || JSON.stringify(errorData);
      } catch {
        const errorText = await orgResponse.text();
        errorDetails = errorText || "No error details available";
      }

      console.error("Sentry Org API error:", {
        status: orgResponse.status,
        statusText: orgResponse.statusText,
        url: orgCheckUrl,
        errorDetails,
        org: sentryOrg,
      });

      let userMessage = "";
      if (orgResponse.status === 403) {
        userMessage = `403 Forbidden - Cannot access organization "${sentryOrg}". Please verify:\n\n1. ✅ Your auth token has 'org:read' scope\n2. ✅ Your organization slug is correct (check URL: sentry.io/organizations/[slug]/)\n3. ✅ Your account has access to this organization\n4. ✅ Token is not expired\n\nError details: ${errorDetails}`;
      } else if (orgResponse.status === 401) {
        userMessage = `401 Unauthorized - Invalid auth token. Please verify your SENTRY_AUTH_TOKEN is correct.\n\nError details: ${errorDetails}`;
      } else if (orgResponse.status === 404) {
        userMessage = `404 Not Found - Organization "${sentryOrg}" not found. Please check the organization slug in your Sentry URL.\n\nError details: ${errorDetails}`;
      } else {
        userMessage = `Failed to access Sentry organization: ${orgResponse.status} ${orgResponse.statusText}\n\nError details: ${errorDetails}`;
      }

      return NextResponse.json({
        errors: [],
        message: userMessage,
        details: errorDetails,
      });
    }

    // Fetch errors from all configured projects
    const allErrors: Array<{
      id: string;
      title: string;
      level: string;
      lastSeen: string;
      count: number;
      userCount: number;
      project: string;
      projectType: "frontend" | "backend";
      culprit: string;
    }> = [];

    const errors: string[] = [];

    for (const project of projects) {
      try {
        const url = `https://sentry.io/api/0/projects/${sentryOrg}/${project.slug}/issues/`;
        
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${sentryAuthToken}`,
            "Content-Type": "application/json",
          },
          next: { revalidate: 60 }, // Cache for 60 seconds
        });

        if (!response.ok) {
          let errorDetails = "";
          try {
            const errorData = await response.json();
            errorDetails = errorData.detail || errorData.message || JSON.stringify(errorData);
          } catch {
            const errorText = await response.text();
            errorDetails = errorText || "No error details available";
          }
          
          console.error(`Sentry API error for ${project.type} project:`, {
            status: response.status,
            statusText: response.statusText,
            url,
            errorDetails,
            org: sentryOrg,
            project: project.slug,
          });

          errors.push(`Failed to fetch ${project.type} project (${project.slug}): ${response.status} ${response.statusText}`);
          continue; // Continue with other projects
        }

        const data = await response.json();

        // Transform Sentry errors to our format
        const projectErrors = data.map((issue: any) => ({
          id: issue.id,
          title: issue.title,
          level: issue.level || "error",
          lastSeen: issue.lastSeen,
          count: typeof issue.count === 'number' ? issue.count : parseInt(String(issue.count || 0), 10),
          userCount: typeof issue.userCount === 'number' ? issue.userCount : parseInt(String(issue.userCount || 0), 10),
          project: project.slug,
          projectType: project.type,
          culprit: issue.culprit || "",
        }));

        allErrors.push(...projectErrors);
      } catch (error) {
        console.error(`Error fetching ${project.type} project errors:`, error);
        errors.push(`Error fetching ${project.type} project (${project.slug}): ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    // Sort by last seen (most recent first)
    allErrors.sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());

    return NextResponse.json({ 
      errors: allErrors,
      warnings: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error fetching Sentry errors:", error);
    return NextResponse.json(
      {
        errors: [],
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
