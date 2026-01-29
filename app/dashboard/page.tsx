"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSentryErrors } from "@/lib/hooks/useSentryErrors";
import { useLinearIssues } from "@/lib/hooks/useLinearIssues";
import { matchLinearIssue, type SentryError, type LinearIssue } from "@/lib/utils/linear-matcher";
import { calculateErrorStats, getLevelColor } from "@/lib/utils/error-stats";

export default function DashboardPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    // Fetch Sentry errors and Linear issues using custom hooks
    const { data, error: swrError, isLoading, mutate } = useSentryErrors(status === "authenticated");
    const { data: linearData } = useLinearIssues(status === "authenticated");

    const linearIssues: LinearIssue[] = linearData?.issues || [];

    // Debug: Log Linear issues
    useEffect(() => {
        if (linearIssues.length > 0) {
            console.log("📋 Total Linear issues fetched:", linearIssues.length);
            console.log("📋 Sample Linear issue:", linearIssues[0]);
            console.log("📋 All Linear issue titles:", linearIssues.map((i: LinearIssue) => `${i.identifier}: ${i.title}`));
        } else {
            console.log("⚠️ No Linear issues fetched!");
        }
    }, [linearIssues]);

    // Enrich errors with Linear issue information
    const errorsWithLinear: SentryError[] = (data?.errors || []).map((error: SentryError) => ({
        ...error,
        linearIssue: matchLinearIssue(error, linearIssues),
    }));

    const errors = errorsWithLinear;

    // Debug: Log Sentry errors
    useEffect(() => {
        if (errors.length > 0) {
            console.log("🔴 Total Sentry errors:", errors.length);
            console.log("🔴 Sample Sentry error:", errors[0]);
            console.log("🔴 All Sentry error IDs:", errors.map(e => `${e.id}: ${e.title.substring(0, 50)}`));
        }
    }, [errors]);

    const error = swrError?.message || data?.message || null;
    const loading = isLoading;

    // Calculate statistics
    const stats = calculateErrorStats(errors);

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

    const handleRefresh = () => {
        mutate(undefined, { revalidate: true });
        setCurrentPage(1);
    };

    if (status === "loading") {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                <div className="text-center">
                    <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-purple-600 border-r-transparent shadow-lg shadow-purple-500/50"></div>
                    <div className="text-lg font-medium text-gray-300">Loading dashboard...</div>
                </div>
            </div>
        );
    }

    if (!session) {
        return null;
    }

    return (
        <div className="relative min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
            {/* Animated background orbs */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-600/20 rounded-full blur-3xl animate-pulse delay-700"></div>
                <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
            </div>

            {/* Neural network pattern overlay */}
            <div className="fixed inset-0 opacity-10 pointer-events-none">
                <div className="absolute inset-0" style={{
                    backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(139, 92, 246, 0.3) 1px, transparent 0)',
                    backgroundSize: '40px 40px'
                }}></div>
            </div>

            <div className="relative p-8">
                {/* Header */}
                <div className="mb-8 flex justify-between items-center">
                    <div>
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl shadow-lg shadow-purple-500/50">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                            </div>
                            <div>
                                <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                                    AI Error Explainer
                                </h1>
                                <p className="text-gray-400 mt-1 flex items-center gap-2">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-600/20 text-purple-300 border border-purple-500/30">
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M13 7H7v6h6V7z" />
                                            <path fillRule="evenodd" d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2zM5 5h10v10H5V5z" clipRule="evenodd" />
                                        </svg>
                                        Powered by GPT-4
                                    </span>
                                    Welcome back, {session.user?.name}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleRefresh}
                            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-200 flex items-center gap-2 shadow-lg shadow-purple-500/30"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Refresh
                        </button>
                        <button
                            onClick={() => signOut({ callbackUrl: "/login" })}
                            className="px-4 py-2 bg-slate-800/80 backdrop-blur-sm border border-slate-700 text-gray-300 rounded-lg hover:bg-slate-700 transition-all duration-200"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium text-gray-400">Total Errors</h3>
                            <div className="p-2 bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-lg">
                                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                        </div>
                        <p className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                            {stats.totalErrors.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500 mt-2">Total error occurrences</p>
                    </div>

                    <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium text-gray-400">Error Issues</h3>
                            <div className="p-2 bg-gradient-to-br from-red-600/20 to-pink-600/20 rounded-lg">
                                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                        <p className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                            {stats.errorLevelIssues.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500 mt-2">Critical errors</p>
                    </div>

                    <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium text-gray-400">Warnings</h3>
                            <div className="p-2 bg-gradient-to-br from-yellow-600/20 to-orange-600/20 rounded-lg">
                                <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                        </div>
                        <p className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                            {stats.warningLevelIssues.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500 mt-2">Warning level issues</p>
                    </div>

                    <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium text-gray-400">Affected Users</h3>
                            <div className="p-2 bg-gradient-to-br from-cyan-600/20 to-blue-600/20 rounded-lg">
                                <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                            </div>
                        </div>
                        <p className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                            {stats.affectedUsers.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500 mt-2">Total affected users</p>
                    </div>
                </div>

                {/* Project Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-gradient-to-br from-cyan-600/20 to-blue-600/20 rounded-lg">
                                <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <h3 className="text-sm font-medium text-gray-400">Frontend Errors</h3>
                        </div>
                        <p className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                            {stats.frontendErrors.toLocaleString()}
                        </p>
                    </div>

                    <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-gradient-to-br from-orange-600/20 to-red-600/20 rounded-lg">
                                <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                                </svg>
                            </div>
                            <h3 className="text-sm font-medium text-gray-400">Backend Errors</h3>
                        </div>
                        <p className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
                            {stats.backendErrors.toLocaleString()}
                        </p>
                    </div>
                </div>

                {/* Errors Table */}
                <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden">
                    <div className="p-6 border-b border-slate-700/50">
                        <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                            Sentry Errors
                        </h2>
                        <p className="text-gray-400 text-sm mt-1">
                            {errors.length} total issues • Page {currentPage} of {totalPages || 1}
                        </p>
                    </div>

                    {loading ? (
                        <div className="flex justify-center items-center py-20">
                            <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-purple-600 border-r-transparent shadow-lg shadow-purple-500/50"></div>
                        </div>
                    ) : error ? (
                        <div className="p-8 text-center">
                            <div className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {error}
                            </div>
                        </div>
                    ) : errors.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-green-600/20 to-cyan-600/20 mb-4">
                                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-gray-300 mb-2">No errors found</h3>
                            <p className="text-gray-500">Your application is running smoothly!</p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border-b border-slate-700/50">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Error</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Level</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Project</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Count</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Exists in Linear</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700/30">
                                        {paginatedErrors.map((err) => (
                                            <tr key={err.id} className="hover:bg-slate-700/20 transition-colors">
                                                <td className="px-6 py-4 w-1/3">
                                                    <div className="flex items-start gap-3">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-gray-200 truncate max-w-md" title={err.title}>
                                                                {err.title}
                                                            </p>
                                                            <p className="text-xs text-gray-500 mt-1">{err.culprit || "Unknown location"}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-3 py-1 text-xs font-semibold rounded-lg ${getLevelColor(err.level)}`}>
                                                        {err.level.toUpperCase()}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-3 py-1 text-xs font-semibold rounded-lg ${err.projectType === "Frontend"
                                                            ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                                                            : "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                                                        }`}>
                                                        {err.projectType}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-300">{Number(err.count).toLocaleString()}</td>
                                                <td className="px-6 py-4">
                                                    {err.linearIssue ? (
                                                        <a
                                                            href={err.linearIssue.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition-colors"
                                                        >
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                            </svg>
                                                            Yes ({err.linearIssue.identifier})
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                            </svg>
                                                        </a>
                                                    ) : (
                                                        <span className="px-3 py-1 text-xs font-semibold rounded-lg bg-red-500/20 text-red-400 border border-red-500/30">
                                                            No
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Link
                                                        href={`/dashboard/errors/${err.id}`}
                                                        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-medium rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-200 shadow-lg shadow-purple-500/30"
                                                    >
                                                        View Details
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                                        </svg>
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="px-6 py-4 border-t border-slate-700/50 bg-slate-900/50">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm text-gray-400">
                                            Showing <span className="font-medium text-purple-400">{startIndex + 1}</span> to{" "}
                                            <span className="font-medium text-purple-400">{Math.min(endIndex, errors.length)}</span> of{" "}
                                            <span className="font-medium text-purple-400">{errors.length}</span> errors
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                                disabled={currentPage === 1}
                                                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-medium rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-purple-500/30"
                                            >
                                                Previous
                                            </button>
                                            <div className="flex items-center gap-1">
                                                {Array.from({ length: totalPages }, (_, i) => i + 1)
                                                    .filter(page => {
                                                        if (totalPages <= 7) return true;
                                                        if (page === 1 || page === totalPages) return true;
                                                        if (Math.abs(page - currentPage) <= 1) return true;
                                                        return false;
                                                    })
                                                    .map((page, index, array) => (
                                                        <div key={page} className="flex items-center">
                                                            {index > 0 && array[index - 1] !== page - 1 && (
                                                                <span className="px-2 text-gray-500">...</span>
                                                            )}
                                                            <button
                                                                onClick={() => setCurrentPage(page)}
                                                                className={`min-w-10 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${currentPage === page
                                                                        ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/50"
                                                                        : "bg-slate-800/80 text-gray-400 hover:bg-slate-700"
                                                                    }`}
                                                            >
                                                                {page}
                                                            </button>
                                                        </div>
                                                    ))}
                                            </div>
                                            <button
                                                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                                                disabled={currentPage === totalPages}
                                                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-medium rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-purple-500/30"
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
