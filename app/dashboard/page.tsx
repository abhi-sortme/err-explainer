"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface SentryError {
    id: string;
    title: string;
    level: string;
    lastSeen: string;
    count: number;
    userCount: number;
    project: string;
    projectType: "frontend" | "backend";
    culprit: string;
}

export default function DashboardPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [errors, setErrors] = useState<SentryError[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastFetchTime, setLastFetchTime] = useState<number>(0);
    const CACHE_DURATION = 60 * 1000; // 60 seconds in milliseconds

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/login");
        }
    }, [status, router]);

    useEffect(() => {
        if (status === "authenticated") {
            // Check if we have cached data and it's still fresh
            const now = Date.now();
            if (errors.length > 0 && lastFetchTime > 0 && (now - lastFetchTime) < CACHE_DURATION) {
                setLoading(false);
                return; // Use cached data
            }
            fetchErrors();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status]);

    const fetchErrors = async (forceRefresh = false) => {
        try {
            setLoading(true);
            setError(null);
            // API route has revalidate=60, so it's cached server-side
            // Client-side caching is handled by React state
            const response = await fetch("/api/sentry/errors", {
                cache: forceRefresh ? 'no-store' : 'default', // Allow bypassing cache if force refresh
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || "Failed to fetch errors");
            }
            const data = await response.json();
            setErrors(data.errors || []);
            setLastFetchTime(Date.now()); // Update cache timestamp
            if (data.message) {
                setError(data.message);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    if (status === "loading") {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-indigo-900 dark:to-purple-900">
                <div className="text-center">
                    <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent"></div>
                    <div className="text-lg font-medium text-gray-700 dark:text-gray-300">Loading dashboard...</div>
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

    const totalErrors = errors.reduce((sum, err) => sum + err.count, 0);
    const totalUsers = errors.reduce((sum, err) => sum + err.userCount, 0);
    const errorCount = errors.filter((err) => err.level.toLowerCase() === "error").length;
    const warningCount = errors.filter((err) => err.level.toLowerCase() === "warning").length;
    const frontendErrors = errors.filter((err) => err.projectType === "frontend").length;
    const backendErrors = errors.filter((err) => err.projectType === "backend").length;

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
                        <div className="flex items-center gap-3">
                            <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-2">
                                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
              <h1 className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-xl font-bold text-transparent dark:from-indigo-400 dark:to-purple-400">
                AI Error Explainer
              </h1>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="hidden sm:block rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                                {session.user?.email}
                            </div>
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
                {/* Stats Cards */}
                <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="group relative overflow-hidden rounded-2xl bg-white/80 backdrop-blur-xl p-6 shadow-xl transition-all hover:scale-105 dark:bg-gray-800/80 border border-white/20 dark:border-gray-700/30">
                        <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-pink-500/10 opacity-0 transition-opacity group-hover:opacity-100"></div>
                        <div className="relative">
                            <div className="mb-2 flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Errors</span>
                                <div className="rounded-lg bg-red-100 p-2 dark:bg-red-900/30">
                                    <svg className="h-5 w-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                            </div>
                            <div className="text-3xl font-bold text-gray-900 dark:text-white">{totalErrors.toLocaleString()}</div>
                        </div>
                    </div>

                    <div className="group relative overflow-hidden rounded-2xl bg-white/80 backdrop-blur-xl p-6 shadow-xl transition-all hover:scale-105 dark:bg-gray-800/80 border border-white/20 dark:border-gray-700/30">
                        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 opacity-0 transition-opacity group-hover:opacity-100"></div>
                        <div className="relative">
                            <div className="mb-2 flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Error Issues</span>
                                <div className="rounded-lg bg-yellow-100 p-2 dark:bg-yellow-900/30">
                                    <svg className="h-5 w-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                            </div>
                            <div className="text-3xl font-bold text-gray-900 dark:text-white">{errorCount}</div>
                        </div>
                    </div>

                    <div className="group relative overflow-hidden rounded-2xl bg-white/80 backdrop-blur-xl p-6 shadow-xl transition-all hover:scale-105 dark:bg-gray-800/80 border border-white/20 dark:border-gray-700/30">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 opacity-0 transition-opacity group-hover:opacity-100"></div>
                        <div className="relative">
                            <div className="mb-2 flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Warnings</span>
                                <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
                                    <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                            </div>
                            <div className="text-3xl font-bold text-gray-900 dark:text-white">{warningCount}</div>
                        </div>
                    </div>

                <div className="group relative overflow-hidden rounded-2xl bg-white/80 backdrop-blur-xl p-6 shadow-xl transition-all hover:scale-105 dark:bg-gray-800/80 border border-white/20 dark:border-gray-700/30">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-indigo-500/10 opacity-0 transition-opacity group-hover:opacity-100"></div>
                    <div className="relative">
                        <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Affected Users</span>
                            <div className="rounded-lg bg-purple-100 p-2 dark:bg-purple-900/30">
                                <svg className="h-5 w-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                            </div>
                        </div>
                        <div className="text-3xl font-bold text-gray-900 dark:text-white">{totalUsers.toLocaleString()}</div>
                    </div>
                </div>
            </div>

            {/* Project Type Stats */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-white/80 backdrop-blur-xl p-6 shadow-xl dark:bg-gray-800/80 border border-white/20 dark:border-gray-700/30">
                    <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Frontend Errors</span>
                        <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
                            <span className="text-lg">🖥️</span>
                        </div>
                    </div>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{frontendErrors}</div>
                </div>
                <div className="rounded-2xl bg-white/80 backdrop-blur-xl p-6 shadow-xl dark:bg-gray-800/80 border border-white/20 dark:border-gray-700/30">
                    <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Backend Errors</span>
                        <div className="rounded-lg bg-orange-100 p-2 dark:bg-orange-900/30">
                            <span className="text-lg">⚙️</span>
                        </div>
                    </div>
                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{backendErrors}</div>
                </div>
            </div>

                {/* Header */}
                <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                        <h2 className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-3xl font-bold text-transparent dark:from-indigo-400 dark:to-purple-400">
                            Sentry Errors
                        </h2>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                            Monitor and track all your application errors
                        </p>
                    </div>
                    <button
                        onClick={fetchErrors}
                        disabled={loading}
                        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:from-indigo-700 hover:to-purple-700 hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                        {loading ? (
                            <>
                                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                                <span>Refreshing...</span>
                            </>
                        ) : (
                            <>
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                <span>Refresh</span>
                            </>
                        )}
                    </button>
                </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 animate-fade-in rounded-xl border border-red-200 bg-gradient-to-r from-red-50 to-pink-50 p-6 shadow-lg dark:border-red-800 dark:from-red-900/20 dark:to-pink-900/20">
            <div className="flex items-start gap-3">
              <svg className="h-6 w-6 flex-shrink-0 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <h3 className="mb-2 font-bold text-red-900 dark:text-red-200">Sentry API Error</h3>
                <div className="whitespace-pre-line text-sm text-red-800 dark:text-red-300">
                  {error}
                </div>
                <div className="mt-4 rounded-lg bg-red-100 p-3 dark:bg-red-900/30">
                  <p className="text-xs font-semibold text-red-900 dark:text-red-200">Quick Fix:</p>
                  <ol className="mt-2 list-inside list-decimal space-y-1 text-xs text-red-800 dark:text-red-300">
                    <li>Go to <a href="https://sentry.io/settings/account/api/auth-tokens/" target="_blank" rel="noopener noreferrer" className="underline">Sentry Auth Tokens</a> and create a new token</li>
                    <li>Make sure it has <code className="rounded bg-red-200 px-1 dark:bg-red-800">org:read</code>, <code className="rounded bg-red-200 px-1 dark:bg-red-800">project:read</code>, and <code className="rounded bg-red-200 px-1 dark:bg-red-800">event:read</code> scopes</li>
                    <li>Verify your organization and project slugs match exactly (case-sensitive)</li>
                    <li>Restart your dev server after updating .env.local</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        )}

                {/* Content */}
                {loading && errors.length === 0 ? (
                    <div className="flex items-center justify-center rounded-2xl bg-white/80 backdrop-blur-xl p-12 shadow-xl dark:bg-gray-800/80 border border-white/20 dark:border-gray-700/30">
                        <div className="text-center">
                            <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent"></div>
                            <div className="text-lg font-medium text-gray-700 dark:text-gray-300">Loading errors...</div>
                        </div>
                    </div>
                ) : errors.length === 0 ? (
                    <div className="rounded-2xl bg-white/80 backdrop-blur-xl p-12 text-center shadow-xl dark:bg-gray-800/80 border border-white/20 dark:border-gray-700/30">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30">
                            <svg className="h-8 w-8 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">No errors found</h3>
                        <p className="text-gray-600 dark:text-gray-400">
                            {error ? error : "Make sure your Sentry credentials are configured correctly."}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-2xl bg-white/80 backdrop-blur-xl shadow-xl dark:bg-gray-800/80 border border-white/20 dark:border-gray-700/30">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                                            Error
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                                            Level
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                                            Count
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                                            Users
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                                            Last Seen
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                                            Project / Type
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800/50">
                                    {errors.map((error, index) => (
                                        <tr
                                            key={error.id}
                                            className="transition-all hover:bg-gradient-to-r hover:from-indigo-50/50 hover:to-purple-50/50 dark:hover:from-indigo-900/10 dark:hover:to-purple-900/10"
                                            style={{ animationDelay: `${index * 50}ms` }}
                                        >
                                            <td className="whitespace-nowrap px-6 py-4">
                                                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                                    {error.title}
                                                </div>
                                                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                    {error.culprit}
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4">
                                                <span
                                                    className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${getLevelColor(error.level)}`}
                                                >
                                                    {error.level.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4">
                                                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                                    {error.count.toLocaleString()}
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4">
                                                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                                    {error.userCount.toLocaleString()}
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                                                {new Date(error.lastSeen).toLocaleString()}
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4">
                                                <div className="flex flex-col gap-2">
                                                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                                                        error.projectType === "frontend" 
                                                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" 
                                                            : "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                                                    }`}>
                                                        {error.projectType === "frontend" ? "🖥️ Frontend" : "⚙️ Backend"}
                                                    </span>
                                                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                                        {error.project}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4">
                                                <Link
                                                    href={`/dashboard/errors/${error.id}`}
                                                    className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-md transition-all hover:from-indigo-700 hover:to-purple-700 hover:shadow-lg hover:scale-105"
                                                >
                                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                    </svg>
                                                    View Details
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
