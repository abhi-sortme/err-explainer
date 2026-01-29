import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { explainError } from "@/lib/openai";

export const dynamic = 'force-dynamic'; // Force dynamic rendering since we use auth headers

export async function POST(request: Request) {
  try {
    const session = await auth();
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        error: "OpenAI API key not configured",
        message: "Please set OPENAI_API_KEY in your environment variables.",
      }, { status: 500 });
    }

    const body = await request.json();
    const { errorDetails } = body;

    if (!errorDetails) {
      return NextResponse.json({
        error: "Error details are required",
      }, { status: 400 });
    }

    const explanation = await explainError(errorDetails);

    return NextResponse.json({ explanation });
  } catch (error) {
    console.error("Error generating AI explanation:", error);
    return NextResponse.json(
      {
        error: "Failed to generate explanation",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
