import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic'; // Force dynamic rendering since we use auth headers

export async function GET() {
  try {
    const session = await auth();
    
    if (!session) {
      console.error("❌ Linear API: Unauthorized - no session");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const linearApiKey = process.env.LINEAR_API_KEY;
    console.log("🔑 Linear API key present:", !!linearApiKey);
    
    if (!linearApiKey) {
      console.error("❌ Linear API key not configured");
      return NextResponse.json(
        { 
          error: "Linear API key not configured",
          message: "Please set LINEAR_API_KEY environment variable"
        },
        { status: 500 }
      );
    }

    // Fetch issues with "Sentry" label from Linear
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
              state {
                name
              }
              team {
                name
                key
              }
              assignee {
                id
                name
                email
              }
              labels {
                nodes {
                  name
                }
              }
              createdAt
              updatedAt
            }
          }
        }
      `,
    };

    console.log("🚀 Fetching Linear issues from 'Sortme' team in 'Triage' state (last 100, ordered by update time)...");
    
    const response = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: linearApiKey,
      },
      body: JSON.stringify(query),
      next: { revalidate: 120 }, // Cache for 2 minutes
    });

    console.log("📡 Linear API response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Linear API HTTP error:", response.status, errorText);
      return NextResponse.json(
        { 
          error: "Failed to fetch Linear issues",
          details: errorText,
          status: response.status
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("📦 Linear API raw response:", JSON.stringify(data, null, 2));

    if (data.errors) {
      console.error("❌ Linear API GraphQL errors:", data.errors);
      return NextResponse.json(
        { 
          error: "Linear API error",
          details: data.errors 
        },
        { status: 400 }
      );
    }

    const issues = data.data?.issues?.nodes || [];
    
    // Log for debugging
    console.log("✅ Fetched Linear issues from Sortme/Triage:", issues.length);
    if (issues.length > 0) {
      console.log("📋 First 5 Linear issues:");
      issues.slice(0, 5).forEach((issue: any) => {
        const labels = issue.labels?.nodes?.map((l: any) => l.name).join(', ') || 'No labels';
        const team = issue.team?.name || 'No team';
        const state = issue.state?.name || 'No state';
        console.log(`  - ${issue.identifier} [${team}/${state}]: ${issue.title}`);
        console.log(`    Labels: ${labels}`);
        console.log(`    Description preview: ${issue.description?.substring(0, 150) || 'No description'}`);
        console.log(`    ---`);
      });
    } else {
      console.warn("⚠️ No Linear issues found in 'Sortme' team with 'Triage' state!");
      console.log("💡 Make sure you have issues in the 'Sortme' team with state 'Triage'");
    }
    
    return NextResponse.json({ 
      issues,
      count: issues.length 
    });
  } catch (error) {
    console.error("Error fetching Linear issues:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch Linear issues",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
