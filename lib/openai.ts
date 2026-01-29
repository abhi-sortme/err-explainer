import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ErrorExplanation {
  overview: string;
  aiErrorExplanation: string;
  detailedBreakdown: {
    whatHappened: string;
    whereItHappened: string;
    whyItHappened: string;
    whenItHappened: string;
  };
  severity: "low" | "medium" | "high" | "critical";
  impact: {
    userImpact: string;
    systemImpact: string;
    businessImpact: string;
  };
  errorComponents: Array<{
    component: string;
    issue: string;
    explanation: string;
  }>;
  possibleCauses: Array<{
    cause: string;
    likelihood: "low" | "medium" | "high";
    explanation: string;
  }>;
  suggestedFixes: Array<{
    fix: string;
    priority: "low" | "medium" | "high";
    steps: string[];
    difficulty: "easy" | "medium" | "hard";
  }>;
  preventionTips: string[];
}

export async function explainError(errorDetails: {
  title: string;
  level: string;
  culprit: string;
  metadata: any;
  logger?: string;
  type?: string;
  platform?: string;
  tags?: Array<{ key: string; value: string }>;
  firstSeen?: string;
  lastSeen?: string;
  count?: number;
  userCount?: number;
  events?: any[];
}): Promise<ErrorExplanation> {
  try {
    // Extract stack trace or error message from metadata if available
    let errorMessage = "";
    let stackTrace = "";
    
    if (errorDetails.metadata) {
      if (errorDetails.metadata.value) {
        errorMessage = String(errorDetails.metadata.value);
      }
      if (errorDetails.metadata.function) {
        errorMessage += ` in function: ${errorDetails.metadata.function}`;
      }
      if (errorDetails.metadata.filename) {
        errorMessage += ` at file: ${errorDetails.metadata.filename}`;
      }
      if (errorDetails.metadata.type) {
        errorMessage += ` (Type: ${errorDetails.metadata.type})`;
      }
      // Try to get stack trace from various metadata fields
      if (errorDetails.metadata.stacktrace) {
        stackTrace = JSON.stringify(errorDetails.metadata.stacktrace);
      } else if (errorDetails.metadata.stack) {
        stackTrace = String(errorDetails.metadata.stack);
      }
    }

    // Get latest event details if available
    let latestEventInfo = "";
    if (errorDetails.events && errorDetails.events.length > 0) {
      const latestEvent = errorDetails.events[0];
      if (latestEvent.message) {
        latestEventInfo += `Latest Event Message: ${latestEvent.message}\n`;
      }
      if (latestEvent.platform) {
        latestEventInfo += `Platform: ${latestEvent.platform}\n`;
      }
    }

    // Build comprehensive context from error details
    const errorContext = `
=== ERROR INFORMATION ===
Error Title: ${errorDetails.title}
Error Level: ${errorDetails.level}
Error Type: ${errorDetails.type || "Not specified"}
Platform: ${errorDetails.platform || "Not specified"}

=== WHERE IT HAPPENED ===
Location/File: ${errorDetails.culprit || "Unknown"}
Logger: ${errorDetails.logger || "Not specified"}

=== ERROR DETAILS ===
${errorMessage ? `Error Message: ${errorMessage}\n` : ""}
${stackTrace ? `Stack Trace (first 500 chars): ${stackTrace.substring(0, 500)}\n` : ""}
${latestEventInfo ? `\n${latestEventInfo}` : ""}

=== METADATA ===
${JSON.stringify(errorDetails.metadata, null, 2)}

=== ADDITIONAL INFO ===
${errorDetails.tags ? `Tags: ${errorDetails.tags.map(t => `${t.key}=${t.value}`).join(", ")}\n` : ""}
First Seen: ${errorDetails.firstSeen || "Unknown"}
Last Seen: ${errorDetails.lastSeen || "Unknown"}
Occurrence Count: ${errorDetails.count || 0}
Affected Users: ${errorDetails.userCount || 0}
`;

    const prompt = `You are an AI Error Explainer. Your job is to explain technical errors in EXTREMELY DETAILED, simple, non-technical language that ANYONE can understand - even someone with no programming knowledge.

Given the following error information, provide a COMPREHENSIVE, human-friendly explanation that breaks down EVERY aspect of the error:

${errorContext}

CRITICAL REQUIREMENTS:
1. Explain EVERY part of the error in plain English
2. Identify EXACTLY which component/file/function is causing the problem
3. Explain WHY each part is problematic
4. Provide CONCRETE, ACTIONABLE solutions with step-by-step instructions
5. Use analogies and simple language - avoid ALL technical jargon
6. Make it so clear that a non-developer can understand and potentially fix it

Please provide your response in the following JSON format:
{
  "overview": "The exact error title/message as it appears (e.g., 'Illuminate\\Database\\QueryException: SQLSTATE[23000]: Integrity constraint violation...')",
  "aiErrorExplanation": "A friendly, human explanation starting with 'It looks like you got...' or similar conversational tone. Explain what the error means in simple terms, what table/field/component is involved, and why it happened. Keep it conversational and easy to understand (3-4 sentences)",
  "detailedBreakdown": {
    "whatHappened": "Detailed explanation of what exactly happened (3-4 sentences)",
    "whereItHappened": "Clear explanation of the exact location/file/component where the error occurred (2-3 sentences)",
    "whyItHappened": "Explanation of why this error occurred - the root cause (3-4 sentences)",
    "whenItHappened": "Context about when this error occurs (timing, frequency, triggers) (2-3 sentences)"
  },
  "severity": "low" | "medium" | "high" | "critical",
  "impact": {
    "userImpact": "How this affects end users in plain language (2-3 sentences)",
    "systemImpact": "How this affects the system/application (2-3 sentences)",
    "businessImpact": "How this affects business operations (1-2 sentences)"
  },
  "errorComponents": [
    {
      "component": "Name of the component/file/function",
      "issue": "What's wrong with this component",
      "explanation": "Detailed explanation in plain English (2-3 sentences)"
    }
  ],
  "possibleCauses": [
    {
      "cause": "A possible cause in plain language",
      "likelihood": "low" | "medium" | "high",
      "explanation": "Why this might be the cause (2-3 sentences)"
    }
  ],
  "suggestedFixes": [
    {
      "fix": "A concrete solution in plain language",
      "priority": "low" | "medium" | "high",
      "steps": ["Step 1: Do this...", "Step 2: Then do this...", "Step 3: Finally..."],
      "difficulty": "easy" | "medium" | "hard"
    }
  ],
  "preventionTips": [
    "Tip 1 to prevent this error",
    "Tip 2 to prevent this error",
    "Tip 3 to prevent this error"
  ]
}

IMPORTANT:
- Break down EVERY technical term into simple language
- Provide SPECIFIC file names, function names, or components mentioned in the error
- Give CONCRETE steps, not vague suggestions
- Explain what each part means in non-technical terms
- Use real-world analogies when helpful`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a helpful AI assistant that explains technical errors in simple, non-technical language. Always respond with valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error("No response from OpenAI");
    }

    const parsed = JSON.parse(responseContent) as ErrorExplanation;
    return parsed;
  } catch (error) {
    console.error("Error explaining error with OpenAI:", error);
    
    // Fallback explanation if OpenAI fails
    return {
      overview: errorDetails.title,
      aiErrorExplanation: `It looks like you got a ${errorDetails.level} error in your application. ${errorDetails.title}. This happened because something went wrong in the system.`,
      detailedBreakdown: {
        whatHappened: `An error occurred: ${errorDetails.title}`,
        whereItHappened: errorDetails.culprit || "The error location is unknown",
        whyItHappened: "The exact cause needs to be investigated",
        whenItHappened: "This error has been occurring in your application",
      },
      severity: errorDetails.level === "error" || errorDetails.level === "fatal" ? "high" : "medium",
      impact: {
        userImpact: "Users may experience issues with this feature",
        systemImpact: "This error may affect the application's functionality",
        businessImpact: "This could impact user experience",
      },
      errorComponents: [
        {
          component: errorDetails.culprit || "Unknown component",
          issue: "An error occurred in this component",
          explanation: "This component encountered an issue that needs to be addressed",
        },
      ],
      possibleCauses: [
        {
          cause: "Unexpected input or data",
          likelihood: "medium",
          explanation: "The application may have received data it wasn't expecting",
        },
        {
          cause: "Configuration issue",
          likelihood: "medium",
          explanation: "There may be a problem with how the application is configured",
        },
        {
          cause: "External service problem",
          likelihood: "low",
          explanation: "An external service the application depends on may be having issues",
        },
      ],
      suggestedFixes: [
        {
          fix: "Check the error logs for more details",
          priority: "high",
          steps: ["Open the error logs", "Look for this error", "Note the time and context"],
          difficulty: "easy",
        },
        {
          fix: "Verify configuration settings",
          priority: "medium",
          steps: ["Check configuration files", "Verify all settings are correct", "Restart the application"],
          difficulty: "medium",
        },
        {
          fix: "Contact support if the issue persists",
          priority: "low",
          steps: ["Document the error", "Collect error logs", "Contact technical support"],
          difficulty: "easy",
        },
      ],
      preventionTips: [
        "Monitor error logs regularly",
        "Test changes before deploying",
        "Keep dependencies updated",
      ],
    };
  }
}
