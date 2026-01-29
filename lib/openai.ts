import OpenAI from "openai";
import { getCachedExplanation, saveCachedExplanation } from "./cache";

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
    codeReference: string;
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
    // Normalize data for cache key generation
    const normalizedMetadata = {
      type: errorDetails.metadata?.type || '',
      value: String(errorDetails.metadata?.value || '').substring(0, 200), // Limit length for consistency
    };
    
    // Check cache first
    const cached = getCachedExplanation({
      title: String(errorDetails.title || '').trim(),
      culprit: String(errorDetails.culprit || '').trim(),
      metadata: normalizedMetadata,
    });
    
    if (cached) {
      console.log('✅ Using cached AI explanation - no OpenAI API call needed!');
      return cached;
    }
    
    console.log('🔄 Cache miss - generating new AI explanation...');
    
    // Extract comprehensive error information from Sentry data
    let errorMessage = "";
    let stackTrace = "";
    let codeContext = "";
    let exceptionDetails = "";
    let breadcrumbs = "";
    
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
      
      // Extract stack trace with line numbers
      if (errorDetails.metadata.stacktrace) {
        const stack = errorDetails.metadata.stacktrace;
        if (Array.isArray(stack.frames)) {
          stackTrace += "Stack Trace (most relevant frames):\n";
          stack.frames.slice(-5).reverse().forEach((frame: any, idx: number) => {
            stackTrace += `  ${idx + 1}. ${frame.filename || 'unknown'}:${frame.lineno || '?'} in ${frame.function || 'anonymous'}\n`;
            if (frame.context_line) {
              stackTrace += `     Line ${frame.lineno}: ${frame.context_line}\n`;
            }
          });
        } else {
          stackTrace = JSON.stringify(errorDetails.metadata.stacktrace).substring(0, 1000);
        }
      } else if (errorDetails.metadata.stack) {
        stackTrace = String(errorDetails.metadata.stack).substring(0, 1000);
      }
    }

    // Extract detailed event information
    let latestEventInfo = "";
    if (errorDetails.events && errorDetails.events.length > 0) {
      const latestEvent = errorDetails.events[0];
      latestEventInfo += "=== LATEST EVENT DETAILS ===\n";
      
      if (latestEvent.message) {
        latestEventInfo += `Message: ${latestEvent.message}\n`;
      }
      if (latestEvent.platform) {
        latestEventInfo += `Platform: ${latestEvent.platform}\n`;
      }
      if (latestEvent.timestamp) {
        latestEventInfo += `Timestamp: ${latestEvent.timestamp}\n`;
      }
      if (latestEvent.user) {
        latestEventInfo += `User: ${JSON.stringify(latestEvent.user)}\n`;
      }
      
      // Extract exception details
      if (latestEvent.entries) {
        latestEvent.entries.forEach((entry: any) => {
          if (entry.type === 'exception' && entry.data?.values) {
            exceptionDetails += "=== EXCEPTION DETAILS ===\n";
            entry.data.values.forEach((exc: any) => {
              exceptionDetails += `Type: ${exc.type}\n`;
              exceptionDetails += `Value: ${exc.value}\n`;
              if (exc.stacktrace?.frames) {
                exceptionDetails += "Code Context:\n";
                exc.stacktrace.frames.slice(-3).reverse().forEach((frame: any) => {
                  exceptionDetails += `  File: ${frame.filename}:${frame.lineno} in ${frame.function}\n`;
                  if (frame.pre_context && frame.context_line && frame.post_context) {
                    exceptionDetails += `  Code:\n`;
                    frame.pre_context?.slice(-2).forEach((line: string, i: number) => {
                      exceptionDetails += `    ${frame.lineno - 2 + i}| ${line}\n`;
                    });
                    exceptionDetails += `  → ${frame.lineno}| ${frame.context_line} ← ERROR HERE\n`;
                    frame.post_context?.slice(0, 2).forEach((line: string, i: number) => {
                      exceptionDetails += `    ${frame.lineno + 1 + i}| ${line}\n`;
                    });
                  }
                });
              }
            });
          }
          
          // Extract breadcrumbs
          if (entry.type === 'breadcrumbs' && entry.data?.values) {
            breadcrumbs += "=== USER ACTIONS BEFORE ERROR ===\n";
            entry.data.values.slice(-5).forEach((crumb: any) => {
              breadcrumbs += `  [${crumb.timestamp}] ${crumb.category}: ${crumb.message || JSON.stringify(crumb.data)}\n`;
            });
          }
        });
      }
      
      // Extract request context
      if (latestEvent.request) {
        latestEventInfo += `\nRequest Context:\n`;
        latestEventInfo += `  URL: ${latestEvent.request.url}\n`;
        latestEventInfo += `  Method: ${latestEvent.request.method}\n`;
        if (latestEvent.request.query_string) {
          latestEventInfo += `  Query: ${latestEvent.request.query_string}\n`;
        }
      }
      
      // Extract context/environment data
      if (latestEvent.contexts) {
        latestEventInfo += `\nEnvironment:\n`;
        if (latestEvent.contexts.runtime) {
          latestEventInfo += `  Runtime: ${latestEvent.contexts.runtime.name} ${latestEvent.contexts.runtime.version}\n`;
        }
        if (latestEvent.contexts.os) {
          latestEventInfo += `  OS: ${latestEvent.contexts.os.name} ${latestEvent.contexts.os.version}\n`;
        }
        if (latestEvent.contexts.browser) {
          latestEventInfo += `  Browser: ${latestEvent.contexts.browser.name} ${latestEvent.contexts.browser.version}\n`;
        }
      }
    }

    // Build comprehensive context from error details - USE ALL SENTRY DATA
    const errorContext = `
=== ERROR INFORMATION ===
Error Title: ${errorDetails.title}
Error Level: ${errorDetails.level}
Error Type: ${errorDetails.type || "Not specified"}
Platform: ${errorDetails.platform || "Not specified"}

=== WHERE IT HAPPENED ===
Location/File: ${errorDetails.culprit || "Unknown"}
Logger: ${errorDetails.logger || "Not specified"}

=== ERROR MESSAGE ===
${errorMessage || errorDetails.title}

${stackTrace ? `\n=== STACK TRACE WITH LINE NUMBERS ===\n${stackTrace}\n` : ""}

${exceptionDetails ? `\n${exceptionDetails}\n` : ""}

${breadcrumbs ? `\n${breadcrumbs}\n` : ""}

${latestEventInfo ? `\n${latestEventInfo}\n` : ""}

=== COMPLETE METADATA ===
${JSON.stringify(errorDetails.metadata, null, 2).substring(0, 2000)}

=== TAGS & ENVIRONMENT ===
${errorDetails.tags ? `Tags: ${errorDetails.tags.map(t => `${t.key}=${t.value}`).join(", ")}\n` : ""}

=== OCCURRENCE PATTERN ===
First Seen: ${errorDetails.firstSeen || "Unknown"}
Last Seen: ${errorDetails.lastSeen || "Unknown"}
Occurrence Count: ${errorDetails.count || 0} times
Affected Users: ${errorDetails.userCount || 0} users
${errorDetails.count && errorDetails.count > 1 ? 'This is a recurring issue!' : 'First occurrence'}
`;

    const prompt = `You are a friendly, empathetic AI Error Detective 🔍 - like having a super smart friend who's great at explaining complex technical stuff in a fun, relatable way. Your explanations should feel PERSONAL, ENGAGING, and UNIQUE - never generic or robotic!

Given the following error information, provide an EXCEPTIONAL, conversational explanation that makes the person feel understood and confident they can fix this:

${errorContext}

YOUR UNIQUE STYLE:
✨ Be conversational and warm - write like you're explaining to a friend over coffee
🎯 Use CLEAR, DIRECT analogies only when they genuinely help understanding (e.g., "Think of your database like a library with strict rules...")
💡 Show empathy - acknowledge frustration ("I know errors can be frustrating, but here's the good news...")
🔥 Be specific and clear - use concrete, real-world examples, NOT abstract metaphors
🚀 Be optimistic and encouraging - focus on solutions, not just problems
⚡ Avoid confusing metaphors - NO abstract phrases like "where the music stopped" or "the stage where drama unfolded"
✅ Use REAL paraphrases - explain what actually happened in plain, direct language

CRITICAL REQUIREMENTS:
1. Start with empathy - acknowledge the frustration
2. Use unique, creative language - NO generic phrases like "there was an issue" or "something went wrong"
3. Paint a picture with analogies - make technical concepts visual and relatable
4. Be specific about EXACTLY what broke and where
5. Explain in a way that makes the person feel "Ah-ha! Now I get it!"
6. Give actionable steps that build confidence

Please provide your response in the following JSON format:
{
  "overview": "The exact error title/message as it appears (e.g., 'Illuminate\\Database\\QueryException: SQLSTATE[23000]: Integrity constraint violation...')",
  "aiErrorExplanation": "A clear, warm, conversational explanation that:
    - Starts with empathy or acknowledgment (e.g., 'Ah, this is a classic case of...' or 'Here's what's happening...')
    - Uses DIRECT, CLEAR language - explain what actually happened, NOT abstract metaphors
    - Specifically names the table/field/component/file involved
    - Explains WHY it happened in simple, concrete terms
    - Uses real-world examples ONLY when they genuinely clarify (e.g., 'like trying to add a book to a library shelf that doesn't exist')
    - Ends with an encouraging note
    Keep it 4-5 sentences. Be SPECIFIC and CLEAR - avoid confusing metaphors like 'music stopped playing' or 'stage where drama unfolded'. Use REAL paraphrases!",
  "detailedBreakdown": {
    "whatHappened": "Explain clearly what exactly happened - be specific about the action that failed. Use concrete, direct language. NO abstract metaphors. (3-4 sentences)",
    "whereItHappened": "Pinpoint the EXACT location - mention specific file names, functions, or components with line numbers if available. Be direct and clear. (2-3 sentences)",
    "whyItHappened": "Explain the root cause clearly. Use simple, direct language. Only use analogies if they genuinely help understanding (e.g., 'like trying to reference something that doesn't exist'). (3-4 sentences)",
    "whenItHappened": "Explain the trigger conditions in clear, everyday language. When does this error occur? Be specific. (2-3 sentences)"
  },
  "severity": "low" | "medium" | "high" | "critical",
  "impact": {
    "userImpact": "Explain what users actually experience - be specific and empathetic. (e.g., 'Users will see a blank screen when trying to checkout' not 'users may experience issues') (2-3 sentences)",
    "systemImpact": "Describe the system impact in visual, relatable terms. (e.g., 'Your database is refusing new orders like a bouncer at a full club') (2-3 sentences)",
    "businessImpact": "Connect it to real business outcomes in plain language. Be direct and clear. (1-2 sentences)"
  },
  "errorComponents": [
    {
      "component": "Specific component/file/function name",
      "issue": "What's broken - be specific and clear",
      "explanation": "Explain clearly what's wrong with this component. Use direct language, avoid abstract metaphors. (2-3 clear sentences)"
    }
  ],
  "possibleCauses": [
    {
      "cause": "A specific, relatable cause (not generic)",
      "likelihood": "low" | "medium" | "high",
      "codeReference": "EXACT file path, line number, and function where this cause originates (e.g., 'app/Http/Controllers/TransactionController.php:45 in createTransaction()' or 'src/components/Header.tsx:120'). If multiple locations, list the most relevant one. ALWAYS include this based on stack trace!",
      "explanation": "Tell the detective story - why this could be the culprit. Reference the SPECIFIC code location and what's happening there. Use analogies. (3-4 sentences with personality and code context)"
    }
  ],
  "suggestedFixes": [
    {
      "fix": "A specific, actionable solution (not 'check the logs' or 'verify settings' unless truly specific)",
      "priority": "low" | "medium" | "high",
      "steps": [
        "Step 1: Open [specific file] and look for [specific thing]...",
        "Step 2: Change [specific value] from X to Y because...",
        "Step 3: Test by [specific action]...",
        "Make each step feel like a mini-tutorial with confidence-building language"
      ],
      "difficulty": "easy" | "medium" | "hard"
    }
  ],
  "preventionTips": [
    "Specific, actionable tip with personality (e.g., 'Always double-check that merchant exists before creating transactions - think of it like verifying an address before shipping a package')",
    "Another unique tip with context",
    "One more memorable tip that shows real understanding"
  ]
}

GOLDEN RULES FOR EXCEPTIONAL EXPLANATIONS:
🎯 BE SPECIFIC - Name exact files, tables, fields, functions, LINE NUMBERS
📍 USE CODE REFERENCES - Always point to specific file:line locations from the stack trace
✅ BE CLEAR AND DIRECT - Use real paraphrases, NOT abstract metaphors like "music stopped" or "stage where drama unfolded"
💡 USE CONCRETE LANGUAGE - Explain what actually happened in plain terms
🎨 USE ANALOGIES SPARINGLY - Only when they genuinely clarify (e.g., "like a library rule" is clear, "where music stopped" is confusing)
❤️ BE EMPATHETIC - Show you understand frustration
🔥 BE MEMORABLE - Make them say "Wow, that makes so much sense!" through clarity, not confusion
⚡ BE ACTIONABLE - Give concrete next steps with exact locations
📊 USE ALL DATA - Reference breadcrumbs, request context, environment info
🚫 NEVER BE GENERIC - Avoid phrases like "something went wrong", "there was an issue", "the system encountered an error"
🚫 NO CONFUSING METAPHORS - Avoid abstract phrases that don't directly relate to the error

CRITICAL: 
- In "possibleCauses", ALWAYS include the exact file path and line number from the stack trace
- Use REAL paraphrases - explain what actually happened, not abstract concepts
- If you use an analogy, make sure it directly relates to the technical issue (e.g., "like trying to add a book to a shelf that doesn't exist" for database foreign key errors)

Think: If you were explaining this to your non-technical friend at a coffee shop, what would you say to make them go "Ohhh, I get it now!" with clarity and understanding, not confusion!`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an exceptionally creative and empathetic AI Error Detective. You explain technical errors with personality, warmth, and memorable analogies - like a brilliant friend who makes complex things crystal clear. Your explanations are NEVER generic or corporate - they're engaging, specific, and make people feel understood. Always respond with valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.9, // Higher temperature for more creative, unique responses
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error("No response from OpenAI");
    }

    const parsed = JSON.parse(responseContent) as ErrorExplanation;
    
    // Save to cache with normalized data (reuse normalizedMetadata from above)
    saveCachedExplanation(
      {
        title: String(errorDetails.title || '').trim(),
        culprit: String(errorDetails.culprit || '').trim(),
        metadata: normalizedMetadata,
      },
      parsed
    );
    
    return parsed;
  } catch (error) {
    console.error("Error explaining error with OpenAI:", error);
    
    // Fallback explanation if OpenAI fails
    return {
      overview: errorDetails.title,
      aiErrorExplanation: `Heads up! Your ${errorDetails.platform || 'application'} just hit a snag. Think of it like a traffic jam in your code - ${errorDetails.title.substring(0, 100)}${errorDetails.title.length > 100 ? '...' : ''}. The good news? We can work through this together. This happened ${errorDetails.count && errorDetails.count > 1 ? `${errorDetails.count} times` : 'recently'}, affecting ${errorDetails.userCount || 'some'} users. Let's dig into what's causing this roadblock.`,
      detailedBreakdown: {
        whatHappened: `Here's the situation: ${errorDetails.title}. Imagine your code tried to do something but hit an unexpected obstacle - like trying to open a door that's suddenly locked. The ${errorDetails.level} level tells us this needs attention${errorDetails.count && errorDetails.count > 10 ? ', especially since it\'s happening frequently' : ''}.`,
        whereItHappened: errorDetails.culprit ? `The trouble is brewing in ${errorDetails.culprit}. That's your starting point for investigation - think of it as the crime scene where everything went sideways.` : "The exact location is playing hide and seek with us, but we'll track it down through the error details.",
        whyItHappened: `Root causes can vary, but typically this kind of ${errorDetails.level} error happens when there's a mismatch between what your code expects and what it actually receives. It's like ordering pizza and getting sushi - both are food, but not what you asked for! We'll need to investigate the specific circumstances.`,
        whenItHappened: `This has been showing up ${errorDetails.firstSeen ? `since ${new Date(errorDetails.firstSeen).toLocaleDateString()}` : 'recently'}, with the most recent occurrence ${errorDetails.lastSeen ? `on ${new Date(errorDetails.lastSeen).toLocaleDateString()}` : 'just now'}. ${errorDetails.count && errorDetails.count > 5 ? 'The frequency suggests this isn\'t a one-off - there\'s a pattern here worth investigating.' : 'Keep an eye on whether this becomes a repeat visitor.'}`,
      },
      severity: errorDetails.level === "error" || errorDetails.level === "fatal" ? "high" : "medium",
      impact: {
        userImpact: errorDetails.userCount && errorDetails.userCount > 0 ? `${errorDetails.userCount} user${errorDetails.userCount > 1 ? 's have' : ' has'} bumped into this. They're likely seeing error messages, failed actions, or features that won't cooperate - definitely not the experience you want them to have.` : "Users encountering this will hit a wall trying to use this feature. It's the digital equivalent of a 'Sorry, we're closed' sign when they expect to walk right in.",
        systemImpact: `Your ${errorDetails.platform || 'application'} is throwing up red flags in ${errorDetails.culprit || 'a key area'}. Think of it like a cog in a machine that's stopped turning - it might affect just this feature, or it could have ripple effects depending on how central this component is to your app.`,
        businessImpact: errorDetails.count && errorDetails.count > 10 ? "With this many occurrences, it's affecting your user experience and potentially your reputation. Time to roll up those sleeves!" : "While one error won't sink the ship, addressing it quickly shows users you care about quality.",
      },
      errorComponents: [
        {
          component: errorDetails.culprit || "Unknown Component",
          issue: `An error occurred in this component`,
          explanation: errorDetails.culprit ? `The error happened in ${errorDetails.culprit}. This component tried to perform an operation but encountered a problem that prevented it from completing successfully. Check this file for the specific issue causing the error.` : "The exact location is still being determined. Review the error details above to identify where the problem occurred.",
        },
      ],
      possibleCauses: [
        {
          cause: "Data mismatch - the classic 'expecting an apple, got an orange' scenario",
          likelihood: "high",
          codeReference: errorDetails.culprit || "See error location above",
          explanation: `Your code was expecting data in a certain format or with certain values, but what showed up was different. Like planning for 10 guests and 100 people show up - technically both are 'people' but the scale is all wrong. Check ${errorDetails.culprit || 'the error location'} for data validation.`,
        },
        {
          cause: "Configuration hiccup - settings playing hide and seek",
          likelihood: "medium",
          codeReference: errorDetails.culprit || "Configuration files",
          explanation: `Something in your environment variables, config files, or settings isn't quite right. Imagine trying to call someone but having the wrong phone number - the system is there, but you can't connect.`,
        },
        {
          cause: "External dependency having a bad day",
          likelihood: "medium",
          codeReference: errorDetails.culprit || "External service call",
          explanation: `If your ${errorDetails.platform || 'app'} relies on databases, APIs, or other services, one of them might be slow, down, or returning unexpected responses. It's like showing up to a meeting and the other person is a no-show.`,
        },
      ],
      suggestedFixes: [
        {
          fix: `Deep dive into ${errorDetails.culprit || 'the error location'} - play detective!`,
          priority: "high",
          steps: [
            `Open your error tracking (Sentry, logs, etc.) and look for this specific error: "${errorDetails.title.substring(0, 60)}${errorDetails.title.length > 60 ? '...' : ''}"`,
            "Check what data or input was being processed when this happened - look for patterns in user actions or data that trigger it",
            `Review the code in ${errorDetails.culprit || 'the error location'} - what assumptions is it making about the data it receives?`,
            "Add defensive checks or validation to handle unexpected cases gracefully"
          ],
          difficulty: "medium",
        },
        {
          fix: "Run a full health check on your configuration and dependencies",
          priority: "high",
          steps: [
            "Double-check all environment variables are set correctly (database URLs, API keys, etc.)",
            "Verify external services (databases, APIs) are responding and healthy",
            "Test with fresh data to rule out corrupted records or edge cases",
            "Review recent deployments - did anything change right before this started?"
          ],
          difficulty: "medium",
        },
        {
          fix: "Set up better monitoring so you catch this faster next time",
          priority: "medium",
          steps: [
            `Add more detailed logging around ${errorDetails.culprit || 'critical operations'} to capture context when errors occur`,
            "Set up alerts for this specific error type so you know immediately when it happens",
            "Create a dashboard to track error frequency and patterns",
            "Consider adding user-friendly error messages that guide users on what to do when this happens"
          ],
          difficulty: "easy",
        },
      ],
      preventionTips: [
        `Always validate data before processing it - think 'trust but verify'. Add checks for data types, required fields, and value ranges before your code tries to use them.`,
        `Build in graceful fallbacks: If something fails, have a Plan B so users see a helpful message instead of a crash. Like having a backup battery for your flashlight.`,
        `Test with real-world messy data, not just perfect test cases. Users will find creative ways to break things - anticipate the unexpected!`,
        `Keep your dependencies and libraries updated, but test changes in a safe environment first. Outdated packages can have known bugs that are already fixed in newer versions.`
      ],
    };
  }
}
