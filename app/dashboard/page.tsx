"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";

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

// Fetcher function for SWR
const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to fetch errors");
    }
    const data = await res.json();
    return data;
};

export default function DashboardPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    // Use SWR for data fetching with automatic caching and revalidation
    const { data, error: swrError, isLoading, mutate } = useSWR(
        status === "authenticated" ? "/api/sentry/errors" : null,
        fetcher,
        {
            refreshInterval: 60000, // Auto-refresh every 60 seconds
            revalidateOnFocus: false, // Don't refetch on window focus
            revalidateOnReconnect: true, // Refetch when reconnecting
            dedupingInterval: 60000, // Dedupe requests within 60 seconds
        }
    );

    const errors = data?.errors || [];
    const error = swrError?.message || data?.message || null;
    const loading = isLoading;

    // Pagination calculations
    const totalPages = Math.ceil(errors.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedErrors = errors.slice(startIndex, endIndex);

    // Reset to page 1 when errors change
    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(1);
        }
    }, [errors.length, currentPage, totalPages]);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/login");
        }
    }, [status, router]);

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

    // Calculate real stats from actual error data
    // Ensure count is a number to avoid string concatenation
    const totalErrors = errors.reduce((sum, err) => {
        const count = typeof err.count === 'number' ? err.count : parseInt(String(err.count || 0), 10);
        return sum + (isNaN(count) ? 0 : count);
    }, 0); // Total number of error occurrences

    const uniqueIssues = errors.length; // Number of unique error issues
    const errorLevelIssues = errors.filter((err) => err.level.toLowerCase() === "error" || err.level.toLowerCase() === "fatal").length; // Critical errors
    const warningLevelIssues = errors.filter((err) => err.level.toLowerCase() === "warning").length; // Warnings

    // Calculate unique affected users (sum of userCount from all errors, ensuring it's a number)
    const affectedUsers = errors.reduce((sum, err) => {
        const userCount = typeof err.userCount === 'number' ? err.userCount : parseInt(String(err.userCount || 0), 10);
        return sum + (isNaN(userCount) ? 0 : userCount);
    }, 0);

    const frontendErrors = errors.filter((err) => err.projectType === "frontend").length;
    const backendErrors = errors.filter((err) => err.projectType === "backend").length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 dark:from-gray-950 dark:via-indigo-950 dark:to-gray-950 relative overflow-hidden">
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
                        <div className="flex items-center gap-3">
                            <div className="relative rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-cyan-500 p-2 shadow-lg shadow-purple-500/50">
                                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-cyan-500 opacity-75 blur-sm"></div>
                                <svg className="relative h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                            </div>
                            <div className="flex flex-col">
                                <h1 className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-xl font-bold text-transparent">
                                    AI Error Explainer
                                </h1>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="hidden sm:block rounded-lg bg-purple-500/10 border border-purple-500/20 px-4 py-2 text-sm font-medium text-purple-300 backdrop-blur-sm">
                                {session.user?.email}
                            </div>
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
                                className="rounded-lg bg-gradient-to-r from-red-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-red-500/30 transition-all hover:from-red-600 hover:to-pink-600 hover:shadow-xl hover:shadow-red-500/50 hover:scale-105"
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
                    <div className="group relative overflow-hidden rounded-2xl bg-slate-800/60 backdrop-blur-xl p-6 shadow-2xl shadow-red-500/10 border border-red-500/20 transition-all hover:scale-105 hover:shadow-red-500/20 hover:border-red-500/40">
                        <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-pink-500/20 opacity-0 transition-opacity group-hover:opacity-100"></div>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl"></div>
                        <div className="relative">
                            <div className="mb-2 flex items-center justify-between relative z-10">
                                <span className="text-sm font-medium text-red-300/80">Total Errors</span>
                                <div className="rounded-lg bg-red-500/20 p-2 border border-red-500/30">
                                    <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                            </div>
                            <div className="text-3xl font-bold text-white relative z-10">{totalErrors.toLocaleString()}</div>
                        </div>
                    </div>

                    <div className="group relative overflow-hidden rounded-2xl bg-slate-800/60 backdrop-blur-xl p-6 shadow-2xl shadow-yellow-500/10 border border-yellow-500/20 transition-all hover:scale-105 hover:shadow-yellow-500/20 hover:border-yellow-500/40">
                        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 opacity-0 transition-opacity group-hover:opacity-100"></div>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl"></div>
                        <div className="relative z-10">
                            <div className="mb-2 flex items-center justify-between">
                                <span className="text-sm font-medium text-yellow-300/80">Error Issues</span>
                                <div className="rounded-lg bg-yellow-500/20 p-2 border border-yellow-500/30">
                                    <svg className="h-5 w-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                            </div>
                            <div className="text-3xl font-bold text-white">{errorLevelIssues.toLocaleString()}</div>
                        </div>
                    </div>

                    <div className="group relative overflow-hidden rounded-2xl bg-slate-800/60 backdrop-blur-xl p-6 shadow-2xl shadow-cyan-500/10 border border-cyan-500/20 transition-all hover:scale-105 hover:shadow-cyan-500/20 hover:border-cyan-500/40">
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 opacity-0 transition-opacity group-hover:opacity-100"></div>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl"></div>
                        <div className="relative z-10">
                            <div className="mb-2 flex items-center justify-between">
                                <span className="text-sm font-medium text-cyan-300/80">Warnings</span>
                                <div className="rounded-lg bg-cyan-500/20 p-2 border border-cyan-500/30">
                                    <svg className="h-5 w-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                            </div>
                            <div className="text-3xl font-bold text-white">{warningLevelIssues.toLocaleString()}</div>
                        </div>
                    </div>

                    <div className="group relative overflow-hidden rounded-2xl bg-slate-800/60 backdrop-blur-xl p-6 shadow-2xl shadow-purple-500/10 border border-purple-500/20 transition-all hover:scale-105 hover:shadow-purple-500/20 hover:border-purple-500/40">
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-pink-500/20 opacity-0 transition-opacity group-hover:opacity-100"></div>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl"></div>
                        <div className="relative z-10">
                            <div className="mb-2 flex items-center justify-between">
                                <span className="text-sm font-medium text-purple-300/80">Affected Users</span>
                                <div className="rounded-lg bg-purple-500/20 p-2 border border-purple-500/30">
                                    <svg className="h-5 w-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                </div>
                            </div>
                            <div className="text-3xl font-bold text-white">{affectedUsers.toLocaleString()}</div>
                        </div>
                    </div>
                </div>

                {/* Project Type Stats */}
                <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-800/60 backdrop-blur-xl p-6 shadow-2xl shadow-blue-500/10 border border-blue-500/20 hover:border-blue-500/40 transition-all">
                        <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm font-medium text-blue-300/80">Frontend Errors</span>
                            <div className="rounded-lg bg-blue-500/20 p-2 border border-blue-500/30">
                                <span className="text-lg">🖥️</span>
                            </div>
                        </div>
                        <div className="text-2xl font-bold text-blue-400">{frontendErrors}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-800/60 backdrop-blur-xl p-6 shadow-2xl shadow-orange-500/10 border border-orange-500/20 hover:border-orange-500/40 transition-all">
                        <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm font-medium text-orange-300/80">Backend Errors</span>
                            <div className="rounded-lg bg-orange-500/20 p-2 border border-orange-500/30">
                                <span className="text-lg">⚙️</span>
                            </div>
                        </div>
                        <div className="text-2xl font-bold text-orange-400">{backendErrors}</div>
                    </div>
                </div>

                {/* Header */}
                <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <h2 className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-3xl font-bold text-transparent">
                                Sentry Errors
                            </h2>
                        </div>
                        <p className="mt-1 text-sm text-gray-400">
                            Monitor and track all your application errors with AI-powered insights
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            mutate(undefined, { revalidate: true });
                            setCurrentPage(1); // Reset to first page on refresh
                        }}
                        disabled={loading}
                        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-600 px-6 py-3 font-semibold text-white shadow-lg shadow-purple-500/30 transition-all hover:shadow-xl hover:shadow-purple-500/50 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
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
                    <div className="mb-6 animate-fade-in rounded-xl border border-red-500/30 bg-gradient-to-r from-red-900/40 to-pink-900/40 p-6 shadow-2xl shadow-red-500/20 backdrop-blur-xl">
                        <div className="flex items-start gap-3">
                            <svg className="h-6 w-6 flex-shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="flex-1">
                                <h3 className="mb-2 font-bold text-red-300">Sentry API Error</h3>
                                <div className="whitespace-pre-line text-sm text-red-200">
                                    {error}
                                </div>
                                <div className="mt-4 rounded-lg bg-red-900/30 border border-red-500/30 p-3">
                                    <p className="text-xs font-semibold text-red-300">Quick Fix:</p>
                                    <ol className="mt-2 list-inside list-decimal space-y-1 text-xs text-red-200">
                                        <li>Go to <a href="https://sentry.io/settings/account/api/auth-tokens/" target="_blank" rel="noopener noreferrer" className="underline text-red-300 hover:text-red-200">Sentry Auth Tokens</a> and create a new token</li>
                                        <li>Make sure it has <code className="rounded bg-red-800/50 px-1 border border-red-500/30">org:read</code>, <code className="rounded bg-red-800/50 px-1 border border-red-500/30">project:read</code>, and <code className="rounded bg-red-800/50 px-1 border border-red-500/30">event:read</code> scopes</li>
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
                            <table className="min-w-full divide-y divide-purple-500/20">
                                <thead className="bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-cyan-500/10">
                                    <tr>
                                        <th className="w-1/4 px-4 py-4 text-left text-xs font-bold uppercase tracking-wider text-purple-300">
                                            Error
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-purple-300">
                                            Level
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-purple-300">
                                            Count
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-purple-300">
                                            Users
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-purple-300">
                                            Last Seen
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-purple-300">
                                            Project / Type
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-purple-300">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-purple-500/10 bg-slate-800/30">
                                    {paginatedErrors.map((error, index) => (
                                        <tr
                                            key={error.id}
                                            className="transition-all hover:bg-gradient-to-r hover:from-purple-500/10 hover:to-pink-500/10"
                                            style={{ animationDelay: `${index * 50}ms` }}
                                        >
                                            <td className="px-4 py-4 max-w-xs">
                                                <div className="text-sm font-semibold text-white truncate" title={error.title}>
                                                    {error.title}
                                                </div>
                                                <div className="mt-1 text-xs text-gray-400 truncate" title={error.culprit}>
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
                                                <div className="text-sm font-semibold text-white">
                                                    {error.count.toLocaleString()}
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4">
                                                <div className="text-sm font-semibold text-white">
                                                    {error.userCount.toLocaleString()}
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-400">
                                                {new Date(error.lastSeen).toLocaleString()}
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4">
                                                <div className="flex flex-col gap-2">
                                                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border ${error.projectType === "frontend"
                                                        ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                                                        : "bg-orange-500/20 text-orange-300 border-orange-500/30"
                                                        }`}>
                                                        {error.projectType === "frontend" ? "🖥️ Frontend" : "⚙️ Backend"}
                                                    </span>
                                                    <span className="inline-flex items-center rounded-full bg-slate-700/50 border border-purple-500/20 px-2 py-0.5 text-xs font-mono text-purple-300">
                                                        {error.project}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4">
                                                <Link
                                                    href={`/dashboard/errors/${error.id}`}
                                                    className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-purple-500/30 transition-all hover:shadow-lg hover:shadow-purple-500/50 hover:scale-105"
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

                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between border-t border-purple-500/20 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-cyan-500/10 px-6 py-4 backdrop-blur-sm">
                                <div className="flex items-center gap-2 text-sm text-purple-300">
                                    <span>
                                        Showing <span className="font-semibold text-white">{startIndex + 1}</span> to{" "}
                                        <span className="font-semibold text-white">{Math.min(endIndex, errors.length)}</span> of{" "}
                                        <span className="font-semibold text-white">{errors.length}</span> errors
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        disabled={currentPage === 1}
                                        className="flex items-center gap-1 rounded-lg border border-purple-500/30 bg-slate-800/60 px-4 py-2 text-sm font-medium text-purple-300 transition-all hover:bg-purple-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                        </svg>
                                        Previous
                                    </button>

                                    {/* Page Numbers */}
                                    <div className="flex items-center gap-1">
                                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                                            // Show first page, last page, current page, and pages around current
                                            if (
                                                pageNum === 1 ||
                                                pageNum === totalPages ||
                                                (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                                            ) {
                                                return (
                                                    <button
                                                        key={pageNum}
                                                        onClick={() => setCurrentPage(pageNum)}
                                                        className={`min-w-[2.5rem] rounded-lg border px-3 py-2 text-sm font-medium transition-all ${currentPage === pageNum
                                                            ? "border-purple-500 bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30"
                                                            : "border-purple-500/30 bg-slate-800/60 text-purple-300 hover:bg-purple-500/20"
                                                            }`}
                                                    >
                                                        {pageNum}
                                                    </button>
                                                );
                                            } else if (
                                                pageNum === currentPage - 2 ||
                                                pageNum === currentPage + 2
                                            ) {
                                                return (
                                                    <span key={pageNum} className="px-2 text-purple-400/50">
                                                        ...
                                                    </span>
                                                );
                                            }
                                            return null;
                                        })}
                                    </div>

                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                        disabled={currentPage === totalPages}
                                        className="flex items-center gap-1 rounded-lg border border-purple-500/30 bg-slate-800/60 px-4 py-2 text-sm font-medium text-purple-300 transition-all hover:bg-purple-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        Next
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
