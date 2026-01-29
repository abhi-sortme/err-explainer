"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface ErrorDetails {
  id: string;
  title: string;
  level: string;
  status: string;
  count: number;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  culprit: string;
  permalink: string;
  project: string;
  projectType?: "frontend" | "backend";
  metadata: any;
  tags: Array<{ key: string; value: string }>;
  assignedTo: any;
  logger: string;
  type: string;
  numComments: number;
  isPublic: boolean;
  platform: string;
  events: any[];
  linearIssue?: {
    id: string;
    identifier: string;
    title: string;
    url: string;
  };
}

interface AIExplanation {
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
    codeReference?: string;
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

export default function ErrorDetailsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const errorId = params?.id as string;

  const [errorDetails, setErrorDetails] = useState<ErrorDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiExplanation, setAiExplanation] = useState<AIExplanation | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const [lastAIFetchTime, setLastAIFetchTime] = useState<number>(0);
  const [linearLoading, setLinearLoading] = useState(false);
  const [linearError, setLinearError] = useState<string | null>(null);
  const [linearSuccess, setLinearSuccess] = useState<string | null>(null);
  const [showLinearInput, setShowLinearInput] = useState(false);
  const [manualLinearId, setManualLinearId] = useState("");
  const CACHE_DURATION = 120 * 1000; // 2 minutes for error details
  const AI_CACHE_DURATION = 300 * 1000; // 5 minutes for AI explanations

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated" && errorId) {
      // Check if we have cached data and it's still fresh
      const now = Date.now();
      if (errorDetails && errorDetails.id === errorId && lastFetchTime > 0 && (now - lastFetchTime) < CACHE_DURATION) {
        setLoading(false);
        // Also check if we need to fetch AI explanation
        if (!aiExplanation && (lastAIFetchTime === 0 || (now - lastAIFetchTime) >= AI_CACHE_DURATION)) {
          fetchAIExplanation(errorDetails);
        }
        return; // Use cached data
      }
      fetchErrorDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, errorId]);

  const fetchErrorDetails = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      console.log("Fetching error details for ID:", errorId);
      // API route has revalidate=120, so it's cached server-side
      // Client-side caching is handled by React state
      const response = await fetch(`/api/sentry/errors/${errorId}`, {
        cache: forceRefresh ? 'no-store' : 'default', // Allow bypassing cache if force refresh
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error("API Error:", data);
        const errorMessage = data.error || data.message || data.details || "Failed to fetch error details";
        if (data.debug) {
          console.error("Debug info:", data.debug);
        }
        throw new Error(errorMessage);
      }
      
      // The API returns { data: errorDetails }
      if (data.data) {
        setErrorDetails(data.data);
        setLastFetchTime(Date.now()); // Update cache timestamp
        // Fetch AI explanation after error details are loaded (if not cached)
        const now = Date.now();
        if (!aiExplanation || (now - lastAIFetchTime) >= AI_CACHE_DURATION) {
          fetchAIExplanation(data.data);
        }
      } else {
        // Fallback: try to use data directly
        setErrorDetails(data);
        setLastFetchTime(Date.now());
        const now = Date.now();
        if (!aiExplanation || (now - lastAIFetchTime) >= AI_CACHE_DURATION) {
          fetchAIExplanation(data);
        }
      }
    } catch (err) {
      console.error("Error fetching details:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const fetchAIExplanation = async (details: ErrorDetails, forceRefresh = false) => {
    try {
      setAiLoading(true);
      setAiError(null);
      
      // Check if we already have a cached explanation (client-side check)
      // The server-side cache in lib/openai.ts will also check, but this prevents unnecessary API calls
      if (!forceRefresh && aiExplanation && lastAIFetchTime > 0) {
        const now = Date.now();
        if ((now - lastAIFetchTime) < AI_CACHE_DURATION) {
          console.log('✅ Using client-side cached AI explanation');
          setAiLoading(false);
          return; // Use existing cached explanation
        }
      }
      
      // API route will check server-side cache (lib/openai.ts)
      // If cached, it returns immediately without calling OpenAI
      const response = await fetch("/api/ai/explain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: forceRefresh ? 'no-store' : 'default',
        body: JSON.stringify({
          errorDetails: {
            title: details.title,
            level: details.level,
            culprit: details.culprit,
            metadata: details.metadata,
            logger: details.logger,
            type: details.type,
            platform: details.platform,
            tags: details.tags,
            firstSeen: details.firstSeen,
            lastSeen: details.lastSeen,
            count: details.count,
            userCount: details.userCount,
            events: details.events,
          },
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to generate AI explanation");
      }

      if (data.explanation) {
        setAiExplanation(data.explanation);
        setLastAIFetchTime(Date.now()); // Update AI cache timestamp
      }
    } catch (err) {
      console.error("Error fetching AI explanation:", err);
      setAiError(err instanceof Error ? err.message : "Failed to generate explanation");
    } finally {
      setAiLoading(false);
    }
  };

  const forwardToLinear = async (manualIssueId?: string) => {
    if (!aiExplanation || !errorDetails) {
      setLinearError("AI explanation is not available");
      return;
    }

    console.log("Starting forwardToLinear...");

    setLinearLoading(true);
    setLinearError(null);
    setLinearSuccess(null);
    setShowLinearInput(false);

    try {
      // Priority 1: Use manual input if provided
      let linearIssueId: string | undefined = manualIssueId;
      
      // Priority 2: Use matched Linear issue from dashboard
      if (!linearIssueId && errorDetails.linearIssue) {
        linearIssueId = errorDetails.linearIssue.identifier;
        console.log("Using matched Linear issue:", linearIssueId);
      }
      
      // Priority 3: Check tags for Linear issue ID (legacy)
      if (!linearIssueId) {
        const linearTag = errorDetails.tags?.find(
          (tag) => tag.key?.toLowerCase().includes("linear") && tag.value
        );
        
        if (linearTag?.value) {
          const tagValueStr = typeof linearTag.value === 'string' 
            ? linearTag.value 
            : JSON.stringify(linearTag.value);
          
          const match = tagValueStr.match(/([A-Z]+-\d+)/);
          linearIssueId = match ? match[1] : tagValueStr;
        }
        
        // Also check metadata for Linear references
        if (!linearIssueId && errorDetails.metadata) {
          const metadataStr = JSON.stringify(errorDetails.metadata).toLowerCase();
          const metadataMatch = metadataStr.match(/([a-z]+-\d+)/);
          if (metadataMatch) {
            linearIssueId = metadataMatch[1].toUpperCase();
          }
        }
      }

      // Ensure linearIssueId is a string
      if (linearIssueId && typeof linearIssueId !== 'string') {
        console.error("linearIssueId is not a string! Type:", typeof linearIssueId);
        linearIssueId = String(linearIssueId);
      }

      // If still no Linear issue ID found, show input dialog
      if (!linearIssueId) {
        setLinearLoading(false);
        setShowLinearInput(true);
        return;
      }

      console.log("Using Linear issue ID:", linearIssueId);

      // Create a clean serializable copy using a safer approach
      // Convert to string first, then parse back to remove all React internals
      const toPlainText = (val: any): any => {
        if (val === null || val === undefined) return val;
        if (typeof val === 'string') return val;
        if (typeof val === 'number' || typeof val === 'boolean') return val;
        if (Array.isArray(val)) {
          return val.map(toPlainText);
        }
        if (typeof val === 'object') {
          // Check if it's a DOM/React element by checking constructor name
          const constructorName = val.constructor?.name;
          if (constructorName && (constructorName.includes('Element') || constructorName === 'FiberNode')) {
            // Extract text content if it's a DOM element
            return val.textContent || val.innerText || String(val);
          }
          
          // For plain objects, recursively clean all properties
          const cleaned: any = {};
          try {
            for (const key in val) {
              // Skip React internal properties
              if (key.startsWith('_') || key.startsWith('__') || key.startsWith('$$')) continue;
              if (!val.hasOwnProperty(key)) continue;
              
              try {
                cleaned[key] = toPlainText(val[key]);
              } catch (err) {
                // Skip properties that can't be accessed
                console.warn(`Skipping property ${key}:`, err);
              }
            }
          } catch (err) {
            return String(val);
          }
          return cleaned;
        }
        return String(val);
      };

      console.log("Cleaning AI explanation...");
      const plainAIExplanation = {
        overview: toPlainText(aiExplanation.overview),
        aiErrorExplanation: toPlainText(aiExplanation.aiErrorExplanation),
        severity: toPlainText(aiExplanation.severity),
        impact: {
          userImpact: toPlainText(aiExplanation.impact?.userImpact),
          systemImpact: toPlainText(aiExplanation.impact?.systemImpact),
          businessImpact: toPlainText(aiExplanation.impact?.businessImpact),
        },
        detailedBreakdown: {
          whatHappened: toPlainText(aiExplanation.detailedBreakdown?.whatHappened),
          whereItHappened: toPlainText(aiExplanation.detailedBreakdown?.whereItHappened),
          whyItHappened: toPlainText(aiExplanation.detailedBreakdown?.whyItHappened),
          whenItHappened: toPlainText(aiExplanation.detailedBreakdown?.whenItHappened),
        },
        errorComponents: toPlainText(aiExplanation.errorComponents) || [],
        possibleCauses: toPlainText(aiExplanation.possibleCauses) || [],
        suggestedFixes: toPlainText(aiExplanation.suggestedFixes) || [],
        preventionTips: toPlainText(aiExplanation.preventionTips) || [],
      };

      console.log("Cleaned AI explanation successfully");

      // Test serialization before sending
      let requestBody;
      try {
        requestBody = {
          errorId: String(errorDetails.id),
          aiExplanation: plainAIExplanation,
          linearIssueId: String(linearIssueId),
          assigneeId: errorDetails.assignedTo?.id ? String(errorDetails.assignedTo.id) : null,
        };
        
        // Test if it can be serialized
        const testSerialize = JSON.stringify(requestBody);
        console.log("Serialization test passed, sending request...");
      } catch (serializeError) {
        console.error("Serialization test failed:", serializeError);
        throw new Error("Failed to prepare data for Linear. The AI explanation contains unsupported data types.");
      }

      const response = await fetch("/api/linear/forward", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      
      console.log("Linear API response:", data);

      if (!response.ok) {
        // Log detailed error information
        console.error("Linear API error details:", {
          error: data.error,
          message: data.message,
          details: data.details,
          fullResponse: data
        });
        
        // If error is about missing/invalid Linear issue ID, show input dialog
        const errorMessage = JSON.stringify(data).toLowerCase();
        if (
          errorMessage.includes("linear issue id") || 
          errorMessage.includes("entity not found") ||
          errorMessage.includes("could not find") ||
          errorMessage.includes("issue not found")
        ) {
          const issueIdStr = linearIssueId ? String(linearIssueId) : '';
          setLinearError(`Could not find Linear issue${issueIdStr ? ` "${issueIdStr}"` : ''}. Please enter the correct issue ID.`);
          setShowLinearInput(true);
          return;
        }
        
        // For other errors, show the error message
        const errorMsg = data.details?.[0]?.extensions?.userPresentableMessage || 
                        data.details?.[0]?.message ||
                        data.message || 
                        data.error || 
                        "Failed to forward to Linear";
        throw new Error(errorMsg);
      }

      setLinearSuccess(
        data.issue?.url 
          ? `Successfully forwarded to Linear: ${data.issue.identifier}`
          : "Successfully forwarded to Linear"
      );
      
      // Clear success message after 5 seconds
      setTimeout(() => setLinearSuccess(null), 5000);
    } catch (err) {
      console.error("Error forwarding to Linear:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to forward to Linear";
      setLinearError(errorMessage);
      
      // If it's about missing Linear ID, show input dialog
      if (errorMessage.includes("Linear issue ID") || errorMessage.includes("not found")) {
        setShowLinearInput(true);
      }
    } finally {
      setLinearLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-center">
          <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent"></div>
          <div className="text-lg font-medium text-purple-300">AI is analyzing error details...</div>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case "error":
        return "bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/50";
      case "warning":
        return "bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg shadow-yellow-500/50";
      case "info":
        return "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/50";
      case "fatal":
        return "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/50";
      default:
        return "bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow-lg shadow-gray-500/50";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "resolved":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "unresolved":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      case "ignored":
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
      default:
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* AI-Powered Animated Background */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        {/* Animated gradient orbs */}
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-cyan-500 opacity-20 blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-gradient-to-br from-indigo-500 via-blue-500 to-purple-500 opacity-20 blur-3xl animate-pulse" style={{ animationDelay: "1s" }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10 blur-3xl animate-pulse" style={{ animationDelay: "2s" }}></div>
        
        {/* Neural network pattern overlay */}
        <div className="absolute inset-0 opacity-5" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '40px 40px'
        }}></div>
        
        {/* Animated grid lines */}
        <div className="absolute inset-0 opacity-10">
            <div className="h-full w-full" style={{
                backgroundImage: `
                    linear-gradient(rgba(139, 92, 246, 0.1) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(139, 92, 246, 0.1) 1px, transparent 1px)
                `,
                backgroundSize: '50px 50px',
                animation: 'gridMove 20s linear infinite'
            }}></div>
        </div>
      </div>
      
      {/* Add CSS animation for grid */}
      <style jsx>{`
        @keyframes gridMove {
            0% { transform: translate(0, 0); }
            100% { transform: translate(50px, 50px); }
        }
      `}</style>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-purple-500/20 bg-slate-900/80 backdrop-blur-xl shadow-2xl shadow-purple-500/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 rounded-lg border border-purple-500/30 bg-slate-800/60 px-3 py-2 text-sm font-medium text-purple-300 transition-all hover:bg-purple-500/20"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Dashboard
              </Link>
              <div className="h-6 w-px bg-purple-500/30"></div>
              <div className="flex items-center gap-3">
                <div className="relative rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-cyan-500 p-2 shadow-lg shadow-purple-500/50">
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-cyan-500 opacity-75 blur-sm"></div>
                  <svg className="relative h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h1 className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-xl font-bold text-transparent">
                  Error Details
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {session.user?.image && (
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 opacity-75 blur"></div>
                  <img
                    src={session.user.image}
                    alt={session.user.name || "User"}
                    className="relative h-8 w-8 rounded-full ring-2 ring-purple-500/50"
                  />
                </div>
              )}
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="rounded-lg bg-gradient-to-r from-red-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-red-500/30 transition-all hover:shadow-xl hover:shadow-red-500/50 hover:scale-105"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {error ? (
          <div className="rounded-2xl bg-red-900/40 backdrop-blur-xl p-8 shadow-2xl border border-red-500/30">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20 border border-red-500/30">
                <svg className="h-8 w-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="mb-2 text-xl font-semibold text-red-300">Error Loading Details</h3>
              <div className="mb-4 rounded-lg bg-red-900/30 border border-red-500/30 p-4 text-left">
                <p className="text-sm text-red-200 whitespace-pre-line">{error}</p>
              </div>
              {errorId && (
                <div className="mb-4 rounded-lg bg-slate-800/50 border border-purple-500/20 p-4 text-left">
                  <p className="text-xs font-mono text-purple-300">
                    Error ID: {errorId}
                  </p>
                </div>
              )}
              <div className="mb-4 rounded-lg bg-cyan-900/30 border border-cyan-500/30 p-4 text-left">
                <p className="text-xs font-semibold text-cyan-300 mb-2">Troubleshooting:</p>
                <ul className="text-xs text-cyan-200 space-y-1 list-disc list-inside">
                  <li>Check that your Sentry auth token has <code className="bg-cyan-800/50 border border-cyan-500/30 px-1 rounded">event:read</code> scope</li>
                  <li>Verify the error ID is correct: {errorId}</li>
                  <li>Check your server console for detailed error logs</li>
                  <li>Make sure the error exists in your Sentry project</li>
                </ul>
              </div>
              <button
                onClick={() => fetchErrorDetails(true)}
                className="mt-4 rounded-lg bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-600 px-6 py-2 font-semibold text-white shadow-lg shadow-purple-500/30 transition-all hover:shadow-xl hover:shadow-purple-500/50 hover:scale-105"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : errorDetails ? (
          <div className="space-y-6">
            {/* AI Explanation Card - Prominently Displayed */}
            {aiLoading ? (
              <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 p-8 shadow-xl dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800">
                <div className="flex items-center gap-4">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent"></div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">AI is analyzing this error...</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Generating a human-friendly explanation</p>
                  </div>
                </div>
              </div>
            ) : aiError ? (
              <div className="rounded-2xl bg-yellow-50 p-6 shadow-xl dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                <div className="flex items-start gap-3">
                  <svg className="h-6 w-6 flex-shrink-0 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-200">AI Explanation Unavailable</h3>
                    <p className="text-sm text-yellow-800 dark:text-yellow-300">{aiError}</p>
                    <button
                      onClick={() => errorDetails && fetchAIExplanation(errorDetails, true)}
                      className="mt-2 text-sm font-medium text-yellow-900 underline dark:text-yellow-200"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              </div>
            ) : aiExplanation ? (
              <div className="rounded-2xl bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-cyan-500/20 backdrop-blur-xl p-8 shadow-2xl border border-purple-500/30 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
                <div className="relative z-10">
                  <div className="mb-6 flex items-center gap-3 flex-wrap">
                    <div className="relative rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-cyan-500 p-3 shadow-lg shadow-purple-500/50">
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-cyan-500 opacity-75 blur-sm"></div>
                      <svg className="relative h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">AI Error Explanation</h2>
                      <p className="text-sm text-purple-300/70">Understanding this error in simple terms</p>
                    </div>
                    <div className="ml-auto">
                      <span className={`inline-flex rounded-full px-4 py-2 text-xs font-bold border ${
                        aiExplanation.severity === "critical" ? "bg-red-500/20 text-red-300 border-red-500/30" :
                        aiExplanation.severity === "high" ? "bg-orange-500/20 text-orange-300 border-orange-500/30" :
                        aiExplanation.severity === "medium" ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" :
                        "bg-green-500/20 text-green-300 border-green-500/30"
                      }`}>
                        {aiExplanation.severity.toUpperCase()} SEVERITY
                      </span>
                    </div>
                  </div>

                {/* Overview */}
                <div className="mb-6 rounded-xl bg-slate-800/60 backdrop-blur-xl p-6 shadow-xl border border-purple-500/20">
                  <h3 className="mb-3 text-lg font-semibold text-white">Overview</h3>
                  <div className="mb-4 rounded-lg bg-slate-900/50 p-4 border border-purple-500/20">
                    <p className="font-mono text-sm text-purple-200 break-words">
                      {aiExplanation.overview}
                    </p>
                  </div>
                </div>

                {/* AI Error Explanation */}
                <div className="mb-6 rounded-xl bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-cyan-500/20 backdrop-blur-xl p-6 border border-purple-500/30 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl"></div>
                  <div className="relative z-10">
                    <div className="mb-3 flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 p-2">
                          <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-semibold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">AI Error Explanation</h3>
                      </div>
                      <button
                        onClick={() => forwardToLinear()}
                        disabled={linearLoading}
                        className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 transition-all hover:shadow-xl hover:shadow-purple-500/50 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                      >
                        {linearLoading ? (
                          <>
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                            <span>Forwarding...</span>
                          </>
                        ) : (
                          <>
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                            <span>Forward to Linear</span>
                          </>
                        )}
                      </button>
                    </div>
                    {linearError && (
                      <div className="mb-3 rounded-lg bg-red-900/40 border border-red-500/30 p-3">
                        <p className="text-sm text-red-300">{linearError}</p>
                      </div>
                    )}
                    {linearSuccess && (
                      <div className="mb-3 rounded-lg bg-green-900/40 border border-green-500/30 p-3">
                        <p className="text-sm text-green-300">{linearSuccess}</p>
                      </div>
                    )}
                    {showLinearInput && (
                      <div className="mb-3 rounded-lg bg-slate-800/80 border border-purple-500/30 p-4">
                        <p className="text-sm text-purple-300 mb-3">
                          {linearError ? linearError : "Linear issue ID not found in Sentry tags. Please enter the Linear issue identifier (e.g., ABC-123):"}
                        </p>
                        <p className="text-xs text-gray-400 mb-3">
                          💡 Tip: You can find the issue ID in your Linear workspace. It looks like "TEAM-123" (e.g., ENG-456, PRODUCT-789).
                        </p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={manualLinearId}
                            onChange={(e) => setManualLinearId(e.target.value)}
                            placeholder="e.g., ABC-123"
                            className="flex-1 rounded-lg bg-slate-900/50 border border-purple-500/30 px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && manualLinearId.trim()) {
                                forwardToLinear(manualLinearId.trim());
                              }
                            }}
                          />
                          <button
                            onClick={() => forwardToLinear(manualLinearId.trim())}
                            disabled={!manualLinearId.trim() || linearLoading}
                            className="rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 transition-all hover:shadow-xl hover:shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Forward
                          </button>
                          <button
                            onClick={() => {
                              setShowLinearInput(false);
                              setManualLinearId("");
                              setLinearError(null);
                            }}
                            className="rounded-lg bg-slate-700/50 border border-purple-500/30 px-4 py-2 text-sm font-semibold text-purple-300 transition-all hover:bg-slate-700/70"
                          >
                            Cancel
                          </button>
                        </div>
                        {errorDetails.tags && errorDetails.tags.length > 0 && (
                          <p className="text-xs text-gray-400 mt-2">
                            Available tags: {errorDetails.tags.map(t => `${t.key}=${t.value}`).join(", ")}
                          </p>
                        )}
                      </div>
                    )}
                    <p className="text-base leading-relaxed text-purple-100">
                      {aiExplanation.aiErrorExplanation}
                    </p>
                  </div>
                </div>

                {/* Detailed Breakdown */}
                <div className="mb-6 rounded-xl bg-slate-800/60 backdrop-blur-xl p-6 shadow-xl border border-purple-500/20">
                  <h3 className="mb-4 text-lg font-semibold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">Detailed Breakdown</h3>
                  <div className="space-y-4">
                    <div className="rounded-lg bg-slate-900/50 p-4 border border-purple-500/10">
                      <h4 className="mb-2 font-semibold text-purple-300">What Happened?</h4>
                      <p className="text-sm leading-relaxed text-gray-300">
                        {aiExplanation.detailedBreakdown.whatHappened}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-900/50 p-4 border border-purple-500/10">
                      <h4 className="mb-2 font-semibold text-purple-300">Where Did It Happen?</h4>
                      <p className="text-sm leading-relaxed text-gray-300">
                        {aiExplanation.detailedBreakdown.whereItHappened}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-900/50 p-4 border border-purple-500/10">
                      <h4 className="mb-2 font-semibold text-purple-300">Why Did It Happen?</h4>
                      <p className="text-sm leading-relaxed text-gray-300">
                        {aiExplanation.detailedBreakdown.whyItHappened}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-900/50 p-4 border border-purple-500/10">
                      <h4 className="mb-2 font-semibold text-purple-300">When Does It Happen?</h4>
                      <p className="text-sm leading-relaxed text-gray-300">
                        {aiExplanation.detailedBreakdown.whenItHappened}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Error Components */}
                {aiExplanation.errorComponents && aiExplanation.errorComponents.length > 0 && (
                  <div className="mb-6 rounded-xl bg-slate-800/60 backdrop-blur-xl p-6 shadow-xl border border-purple-500/20">
                    <h3 className="mb-4 text-lg font-semibold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">Problematic Components</h3>
                    <div className="space-y-4">
                      {aiExplanation.errorComponents.map((component, index) => (
                        <div key={index} className="rounded-lg border border-purple-500/20 bg-slate-900/50 p-4">
                          <h4 className="mb-2 font-semibold text-white">
                            {component.component}
                          </h4>
                          <p className="mb-2 text-sm font-medium text-red-400">
                            Issue: {component.issue}
                          </p>
                          <p className="text-sm leading-relaxed text-gray-300">
                            {component.explanation}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Impact Analysis */}
                <div className="mb-6 rounded-xl bg-slate-800/60 backdrop-blur-xl p-6 shadow-xl border border-purple-500/20">
                  <h3 className="mb-4 text-lg font-semibold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">Impact Analysis</h3>
                  <div className="space-y-4">
                    <div className="rounded-lg bg-slate-900/50 p-4 border border-purple-500/10">
                      <h4 className="mb-2 font-semibold text-purple-300">👥 User Impact</h4>
                      <p className="text-sm leading-relaxed text-gray-300">
                        {aiExplanation.impact.userImpact}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-900/50 p-4 border border-purple-500/10">
                      <h4 className="mb-2 font-semibold text-purple-300">⚙️ System Impact</h4>
                      <p className="text-sm leading-relaxed text-gray-300">
                        {aiExplanation.impact.systemImpact}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-900/50 p-4 border border-purple-500/10">
                      <h4 className="mb-2 font-semibold text-purple-300">💼 Business Impact</h4>
                      <p className="text-sm leading-relaxed text-gray-300">
                        {aiExplanation.impact.businessImpact}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Possible Causes */}
                <div className="mb-6 rounded-xl bg-slate-800/60 backdrop-blur-xl p-6 shadow-xl border border-purple-500/20">
                  <h3 className="mb-4 text-lg font-semibold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">Possible Causes</h3>
                  <div className="space-y-4">
                    {aiExplanation.possibleCauses.map((cause, index) => (
                      <div key={index} className="rounded-lg border border-purple-500/20 bg-slate-900/50 p-4 border-l-4 border-l-purple-500">
                        <div className="mb-2 flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-xs font-semibold text-white shadow-lg shadow-purple-500/30">
                            {index + 1}
                          </span>
                          <h4 className="font-semibold text-white">{cause.cause}</h4>
                          <span className={`ml-auto rounded-full px-2 py-1 text-xs font-semibold border ${
                            cause.likelihood === "high" ? "bg-red-500/20 text-red-300 border-red-500/30" :
                            cause.likelihood === "medium" ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" :
                            "bg-gray-500/20 text-gray-300 border-gray-500/30"
                          }`}>
                            {cause.likelihood.toUpperCase()} LIKELIHOOD
                          </span>
                        </div>
                        {cause.codeReference && (
                          <div className="mb-2 ml-8 flex items-start gap-2 rounded bg-purple-500/10 border border-purple-500/30 px-3 py-2">
                            <svg className="mt-0.5 h-4 w-4 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                            </svg>
                            <div className="flex-1">
                              <div className="text-xs font-semibold text-purple-300 mb-1">📍 Code Location:</div>
                              <code className="text-xs font-mono text-purple-200 break-all">
                                {cause.codeReference}
                              </code>
                            </div>
                          </div>
                        )}
                        <p className="ml-8 text-sm leading-relaxed text-gray-300">
                          {cause.explanation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Suggested Fixes */}
                <div className="mb-6 rounded-xl bg-slate-800/60 backdrop-blur-xl p-6 shadow-xl border border-purple-500/20">
                  <h3 className="mb-4 text-lg font-semibold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">Concrete Solutions</h3>
                  <div className="space-y-4">
                    {aiExplanation.suggestedFixes.map((fix, index) => (
                      <div key={index} className="rounded-lg border border-green-500/30 bg-green-900/20 p-4">
                        <div className="mb-3 flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-500 text-xs font-semibold text-white shadow-lg shadow-green-500/30">
                              ✓
                            </span>
                            <h4 className="font-semibold text-white">{fix.fix}</h4>
                          </div>
                          <div className="flex gap-2">
                            <span className={`rounded-full px-2 py-1 text-xs font-semibold border ${
                              fix.priority === "high" ? "bg-red-500/20 text-red-300 border-red-500/30" :
                              fix.priority === "medium" ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" :
                              "bg-gray-500/20 text-gray-300 border-gray-500/30"
                            }`}>
                              {fix.priority.toUpperCase()} PRIORITY
                            </span>
                            <span className={`rounded-full px-2 py-1 text-xs font-semibold border ${
                              fix.difficulty === "easy" ? "bg-green-500/20 text-green-300 border-green-500/30" :
                              fix.difficulty === "medium" ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" :
                              "bg-red-500/20 text-red-300 border-red-500/30"
                            }`}>
                              {fix.difficulty.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="ml-8">
                          <p className="mb-2 text-xs font-semibold text-gray-300">Step-by-step instructions:</p>
                          <ol className="list-decimal list-inside space-y-1 text-sm text-gray-300">
                            {fix.steps.map((step, stepIndex) => (
                              <li key={stepIndex}>{step}</li>
                            ))}
                          </ol>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Prevention Tips */}
                {aiExplanation.preventionTips && aiExplanation.preventionTips.length > 0 && (
                  <div className="rounded-xl bg-slate-800/60 backdrop-blur-xl p-6 shadow-xl border border-purple-500/20">
                    <h3 className="mb-4 text-lg font-semibold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">Prevention Tips</h3>
                    <ul className="space-y-2">
                      {aiExplanation.preventionTips.map((tip, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-gray-300">
                          <span className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-cyan-500/20 border border-cyan-500/30 text-xs font-semibold text-cyan-300">
                            💡
                          </span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                </div>
              </div>
            ) : null}

            {/* Header Card */}
            <div className="rounded-2xl bg-white/80 backdrop-blur-xl p-8 shadow-xl dark:bg-gray-800/80 border border-white/20 dark:border-gray-700/30">
              <div className="mb-6 flex items-start justify-between">
                <div className="flex-1">
                  <div className="mb-4 flex items-center gap-3">
                    <span className={`inline-flex rounded-full px-4 py-2 text-sm font-bold ${getLevelColor(errorDetails.level)}`}>
                      {errorDetails.level.toUpperCase()}
                    </span>
                    <span className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${getStatusColor(errorDetails.status)}`}>
                      {errorDetails.status}
                    </span>
                    {errorDetails.projectType && (
                      <span className={`inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-semibold ${
                        errorDetails.projectType === "frontend" 
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" 
                          : "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                      }`}>
                        {errorDetails.projectType === "frontend" ? "🖥️ Frontend" : "⚙️ Backend"}
                      </span>
                    )}
                  </div>
                  <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
                    {errorDetails.title}
                  </h1>
                  {errorDetails.culprit && (
                    <p className="text-lg text-gray-600 dark:text-gray-400 font-mono">
                      {errorDetails.culprit}
                    </p>
                  )}
                </div>
                {errorDetails.permalink && (
                  <a
                    href={errorDetails.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:scale-105"
                  >
                    <span>View in Sentry</span>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-xl bg-gradient-to-br from-red-50 to-pink-50 p-4 dark:from-red-900/20 dark:to-pink-900/20">
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Count</div>
                  <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{errorDetails.count.toLocaleString()}</div>
                </div>
                <div className="rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 p-4 dark:from-blue-900/20 dark:to-cyan-900/20">
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Affected Users</div>
                  <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{errorDetails.userCount.toLocaleString()}</div>
                </div>
                <div className="rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 p-4 dark:from-purple-900/20 dark:to-indigo-900/20">
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">First Seen</div>
                  <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                    {new Date(errorDetails.firstSeen).toLocaleString()}
                  </div>
                </div>
                <div className="rounded-xl bg-gradient-to-br from-yellow-50 to-orange-50 p-4 dark:from-yellow-900/20 dark:to-orange-900/20">
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Last Seen</div>
                  <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                    {new Date(errorDetails.lastSeen).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Metadata Card */}
              <div className="rounded-2xl bg-white/80 backdrop-blur-xl p-6 shadow-xl dark:bg-gray-800/80 border border-white/20 dark:border-gray-700/30">
                <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">Metadata</h2>
                <div className="space-y-3">
                  {errorDetails.logger && (
                    <div>
                      <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Logger</div>
                      <div className="mt-1 font-mono text-sm text-gray-900 dark:text-white">{errorDetails.logger}</div>
                    </div>
                  )}
                  {errorDetails.type && (
                    <div>
                      <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Type</div>
                      <div className="mt-1 text-sm text-gray-900 dark:text-white">{errorDetails.type}</div>
                    </div>
                  )}
                  {errorDetails.platform && (
                    <div>
                      <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Platform</div>
                      <div className="mt-1 text-sm text-gray-900 dark:text-white">{errorDetails.platform}</div>
                    </div>
                  )}
                  {errorDetails.project && (
                    <div>
                      <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Project</div>
                      <div className="mt-1 text-sm text-gray-900 dark:text-white">{errorDetails.project}</div>
                    </div>
                  )}
                  {Object.keys(errorDetails.metadata).length > 0 && (
                    <div>
                      <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Additional Info</div>
                      <pre className="mt-2 overflow-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-900 dark:bg-gray-900 dark:text-gray-100">
                        {JSON.stringify(errorDetails.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>

              {/* Tags Card */}
              <div className="rounded-2xl bg-white/80 backdrop-blur-xl p-6 shadow-xl dark:bg-gray-800/80 border border-white/20 dark:border-gray-700/30">
                <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">Tags</h2>
                {errorDetails.tags && errorDetails.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {errorDetails.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center rounded-full bg-gradient-to-r from-indigo-100 to-purple-100 px-3 py-1 text-xs font-medium text-indigo-800 dark:from-indigo-900/30 dark:to-purple-900/30 dark:text-indigo-300"
                      >
                        <span className="font-semibold">{tag.key}:</span>
                        <span className="ml-1">{tag.value}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No tags available</p>
                )}
              </div>
            </div>

            {/* Recent Events */}
            {errorDetails.events && errorDetails.events.length > 0 && (
              <div className="rounded-2xl bg-white/80 backdrop-blur-xl p-6 shadow-xl dark:bg-gray-800/80 border border-white/20 dark:border-gray-700/30">
                <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">Recent Events</h2>
                <div className="space-y-3">
                  {errorDetails.events.map((event, index) => (
                    <div
                      key={index}
                      className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-mono text-sm text-gray-900 dark:text-white">
                          {event.id || `Event ${index + 1}`}
                        </div>
                        {event.dateCreated && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(event.dateCreated).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}
