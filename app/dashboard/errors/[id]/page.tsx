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
}

interface AIExplanation {
  explanation: string;
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

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-indigo-900 dark:to-purple-900">
        <div className="text-center">
          <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent"></div>
          <div className="text-lg font-medium text-gray-700 dark:text-gray-300">Loading error details...</div>
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-indigo-900 dark:to-purple-900">
      {/* Animated background */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 opacity-10 blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-gradient-to-br from-indigo-400 to-blue-400 opacity-10 blur-3xl animate-pulse" style={{ animationDelay: "1s" }}></div>
      </div>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-white/20 bg-white/80 backdrop-blur-xl dark:border-gray-700/30 dark:bg-gray-800/80 shadow-lg">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Dashboard
              </Link>
              <div className="h-6 w-px bg-gray-300 dark:bg-gray-600"></div>
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-2">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h1 className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-xl font-bold text-transparent dark:from-indigo-400 dark:to-purple-400">
                  Error Details
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {session.user?.image && (
                <img
                  src={session.user.image}
                  alt={session.user.name || "User"}
                  className="h-8 w-8 rounded-full ring-2 ring-indigo-500"
                />
              )}
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="rounded-lg bg-gradient-to-r from-red-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-lg transition-all hover:from-red-600 hover:to-pink-600 hover:shadow-xl hover:scale-105"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {error ? (
          <div className="rounded-2xl bg-white/80 backdrop-blur-xl p-8 shadow-xl dark:bg-gray-800/80 border border-white/20 dark:border-gray-700/30">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <svg className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">Error Loading Details</h3>
              <div className="mb-4 rounded-lg bg-red-50 p-4 text-left dark:bg-red-900/20">
                <p className="text-sm text-red-800 dark:text-red-300 whitespace-pre-line">{error}</p>
              </div>
              {errorId && (
                <div className="mb-4 rounded-lg bg-gray-50 p-4 text-left dark:bg-gray-900/50">
                  <p className="text-xs font-mono text-gray-600 dark:text-gray-400">
                    Error ID: {errorId}
                  </p>
                </div>
              )}
              <div className="mb-4 rounded-lg bg-blue-50 p-4 text-left dark:bg-blue-900/20">
                <p className="text-xs font-semibold text-blue-900 dark:text-blue-200 mb-2">Troubleshooting:</p>
                <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
                  <li>Check that your Sentry auth token has <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">event:read</code> scope</li>
                  <li>Verify the error ID is correct: {errorId}</li>
                  <li>Check your server console for detailed error logs</li>
                  <li>Make sure the error exists in your Sentry project</li>
                </ul>
              </div>
              <button
                onClick={() => fetchErrorDetails(true)}
                className="mt-4 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-2 font-semibold text-white transition-all hover:shadow-lg hover:scale-105"
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
              <div className="rounded-2xl bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-8 shadow-xl dark:from-indigo-900/20 dark:via-purple-900/20 dark:to-pink-900/20 border border-indigo-200 dark:border-indigo-800">
                <div className="mb-6 flex items-center gap-3">
                  <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-3">
                    <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">AI Error Explanation</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Understanding this error in simple terms</p>
                  </div>
                  <div className="ml-auto">
                    <span className={`inline-flex rounded-full px-4 py-2 text-xs font-bold ${
                      aiExplanation.severity === "critical" ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" :
                      aiExplanation.severity === "high" ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" :
                      aiExplanation.severity === "medium" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" :
                      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                    }`}>
                      {aiExplanation.severity.toUpperCase()} SEVERITY
                    </span>
                  </div>
                </div>

                {/* Overview */}
                <div className="mb-6 rounded-xl bg-white/60 p-6 dark:bg-gray-800/60">
                  <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Overview</h3>
                  <div className="mb-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-900/50">
                    <p className="font-mono text-sm text-gray-800 dark:text-gray-200 break-words">
                      {aiExplanation.overview}
                    </p>
                  </div>
                </div>

                {/* AI Error Explanation */}
                <div className="mb-6 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 p-6 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800">
                  <div className="mb-3 flex items-center gap-2">
                    <svg className="h-5 w-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">AI Error Explanation</h3>
                  </div>
                  <p className="text-base leading-relaxed text-gray-700 dark:text-gray-300">
                    {aiExplanation.aiErrorExplanation}
                  </p>
                </div>

                {/* Detailed Breakdown */}
                <div className="mb-6 rounded-xl bg-white/60 p-6 dark:bg-gray-800/60">
                  <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Detailed Breakdown</h3>
                  <div className="space-y-4">
                    <div>
                      <h4 className="mb-2 font-semibold text-gray-800 dark:text-gray-200">What Happened?</h4>
                      <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                        {aiExplanation.detailedBreakdown.whatHappened}
                      </p>
                    </div>
                    <div>
                      <h4 className="mb-2 font-semibold text-gray-800 dark:text-gray-200">Where Did It Happen?</h4>
                      <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                        {aiExplanation.detailedBreakdown.whereItHappened}
                      </p>
                    </div>
                    <div>
                      <h4 className="mb-2 font-semibold text-gray-800 dark:text-gray-200">Why Did It Happen?</h4>
                      <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                        {aiExplanation.detailedBreakdown.whyItHappened}
                      </p>
                    </div>
                    <div>
                      <h4 className="mb-2 font-semibold text-gray-800 dark:text-gray-200">When Does It Happen?</h4>
                      <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                        {aiExplanation.detailedBreakdown.whenItHappened}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Error Components */}
                {aiExplanation.errorComponents && aiExplanation.errorComponents.length > 0 && (
                  <div className="mb-6 rounded-xl bg-white/60 p-6 dark:bg-gray-800/60">
                    <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Problematic Components</h3>
                    <div className="space-y-4">
                      {aiExplanation.errorComponents.map((component, index) => (
                        <div key={index} className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/50">
                          <h4 className="mb-2 font-semibold text-gray-900 dark:text-white">
                            {component.component}
                          </h4>
                          <p className="mb-2 text-sm font-medium text-red-600 dark:text-red-400">
                            Issue: {component.issue}
                          </p>
                          <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                            {component.explanation}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Impact Analysis */}
                <div className="mb-6 rounded-xl bg-white/60 p-6 dark:bg-gray-800/60">
                  <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Impact Analysis</h3>
                  <div className="space-y-4">
                    <div>
                      <h4 className="mb-2 font-semibold text-gray-800 dark:text-gray-200">👥 User Impact</h4>
                      <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                        {aiExplanation.impact.userImpact}
                      </p>
                    </div>
                    <div>
                      <h4 className="mb-2 font-semibold text-gray-800 dark:text-gray-200">⚙️ System Impact</h4>
                      <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                        {aiExplanation.impact.systemImpact}
                      </p>
                    </div>
                    <div>
                      <h4 className="mb-2 font-semibold text-gray-800 dark:text-gray-200">💼 Business Impact</h4>
                      <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                        {aiExplanation.impact.businessImpact}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Possible Causes */}
                <div className="mb-6 rounded-xl bg-white/60 p-6 dark:bg-gray-800/60">
                  <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Possible Causes</h3>
                  <div className="space-y-4">
                    {aiExplanation.possibleCauses.map((cause, index) => (
                      <div key={index} className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/50 border-l-4 border-l-indigo-500">
                        <div className="mb-2 flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                            {index + 1}
                          </span>
                          <h4 className="font-semibold text-gray-900 dark:text-white">{cause.cause}</h4>
                          <span className={`ml-auto rounded-full px-2 py-1 text-xs font-semibold ${
                            cause.likelihood === "high" ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" :
                            cause.likelihood === "medium" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" :
                            "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                          }`}>
                            {cause.likelihood.toUpperCase()} LIKELIHOOD
                          </span>
                        </div>
                        {cause.codeReference && (
                          <div className="mb-2 ml-8 flex items-start gap-2 rounded bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2">
                            <svg className="mt-0.5 h-4 w-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                            </svg>
                            <div className="flex-1">
                              <div className="text-xs font-semibold text-indigo-900 dark:text-indigo-200 mb-1">📍 Code Location:</div>
                              <code className="text-xs font-mono text-indigo-900 dark:text-indigo-200 break-all">
                                {cause.codeReference}
                              </code>
                            </div>
                          </div>
                        )}
                        <p className="ml-8 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                          {cause.explanation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Suggested Fixes */}
                <div className="mb-6 rounded-xl bg-white/60 p-6 dark:bg-gray-800/60">
                  <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Concrete Solutions</h3>
                  <div className="space-y-4">
                    {aiExplanation.suggestedFixes.map((fix, index) => (
                      <div key={index} className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                        <div className="mb-3 flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-xs font-semibold text-green-600 dark:bg-green-900/30 dark:text-green-400">
                              ✓
                            </span>
                            <h4 className="font-semibold text-gray-900 dark:text-white">{fix.fix}</h4>
                          </div>
                          <div className="flex gap-2">
                            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                              fix.priority === "high" ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" :
                              fix.priority === "medium" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" :
                              "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                            }`}>
                              {fix.priority.toUpperCase()} PRIORITY
                            </span>
                            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                              fix.difficulty === "easy" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" :
                              fix.difficulty === "medium" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" :
                              "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                            }`}>
                              {fix.difficulty.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="ml-8">
                          <p className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-300">Step-by-step instructions:</p>
                          <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
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
                  <div className="rounded-xl bg-white/60 p-6 dark:bg-gray-800/60">
                    <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Prevention Tips</h3>
                    <ul className="space-y-2">
                      {aiExplanation.preventionTips.map((tip, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                          <span className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                            💡
                          </span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
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
