import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get Sentry credentials from environment variables
    const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
    const sentryOrg = process.env.SENTRY_ORG;
    const sentryProject = process.env.SENTRY_PROJECT;

    if (!sentryAuthToken || !sentryOrg) {
      return NextResponse.json({
        errors: [],
        message: "Sentry credentials not configured. Please set SENTRY_AUTH_TOKEN and SENTRY_ORG environment variables.",
      });
    }

    // Fetch errors from Sentry API
    const projectSlug = sentryProject || "default";
    const url = `https://sentry.io/api/0/projects/${sentryOrg}/${projectSlug}/issues/`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${sentryAuthToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Sentry API error:", errorText);
      return NextResponse.json({
        errors: [],
        message: `Failed to fetch from Sentry API: ${response.status} ${response.statusText}`,
      });
    }

    const data = await response.json();

    // Transform Sentry errors to our format
    const errors = data.map((issue: any) => ({
      id: issue.id,
      title: issue.title,
      level: issue.level || "error",
      lastSeen: issue.lastSeen,
      count: issue.count || 0,
      userCount: issue.userCount || 0,
      project: projectSlug,
      culprit: issue.culprit || "",
    }));

    return NextResponse.json({ errors });
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
