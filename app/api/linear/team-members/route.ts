import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic'; // Force dynamic rendering since we use auth headers
export const revalidate = 300; // Cache for 5 minutes

export async function GET() {
  try {
    const session = await auth();
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const linearApiKey = process.env.LINEAR_API_KEY;
    
    if (!linearApiKey) {
      return NextResponse.json(
        { 
          error: "Linear API key not configured",
          message: "Please set LINEAR_API_KEY environment variable"
        },
        { status: 500 }
      );
    }

    // Fetch team members from the "Sortme" team
    // First, find the team by name, then get its members
    const query = {
      query: `
        query GetSortmeTeamMembers {
          teams(filter: { name: { eq: "Sortme" } }) {
            nodes {
              id
              name
              key
              members {
                nodes {
                  id
                  name
                  email
                  displayName
                  avatarUrl
                  active
                }
              }
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
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Linear API error:", errorText);
      return NextResponse.json(
        { 
          error: "Failed to fetch Linear team members",
          details: errorText
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (data.errors) {
      console.error("Linear API GraphQL errors:", data.errors);
      return NextResponse.json(
        { 
          error: "Linear API error",
          details: data.errors
        },
        { status: 400 }
      );
    }

    const teams = data.data?.teams?.nodes || [];
    const sortmeTeam = teams.find((team: any) => team.name === "Sortme");
    
    if (!sortmeTeam) {
      return NextResponse.json({ members: [] });
    }

    const members = sortmeTeam.members?.nodes || [];
    
    // Filter only active members
    const activeMembers = members.filter((member: any) => member.active !== false);

    return NextResponse.json({ members: activeMembers });
  } catch (error) {
    console.error("Error fetching Linear team members:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch Linear team members",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
