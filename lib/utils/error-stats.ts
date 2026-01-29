import { SentryError } from "./linear-matcher";

export interface ErrorStats {
  totalErrors: number;
  errorLevelIssues: number;
  warningLevelIssues: number;
  affectedUsers: number;
  frontendErrors: number;
  backendErrors: number;
}

/**
 * Calculate statistics from an array of Sentry errors
 * @param errors Array of Sentry errors
 * @returns Calculated statistics
 */
export function calculateErrorStats(errors: SentryError[]): ErrorStats {
  const totalErrors = errors.reduce((sum, err) => sum + Number(err.count || 0), 0);
  const errorLevelIssues = errors.filter((err) => err.level === "error").length;
  const warningLevelIssues = errors.filter((err) => err.level === "warning").length;
  
  const uniqueUsers = new Set<number>();
  errors.forEach((err) => {
    if (err.userCount && err.userCount > 0) {
      uniqueUsers.add(err.userCount);
    }
  });
  const affectedUsers = errors.reduce((sum, err) => sum + Number(err.userCount || 0), 0);

  const frontendErrors = errors.filter((err) => 
    err.projectType?.toLowerCase() === "frontend" || err.projectType === "Frontend"
  ).length;
  const backendErrors = errors.filter((err) => 
    err.projectType?.toLowerCase() === "backend" || err.projectType === "Backend"
  ).length;

  return {
    totalErrors,
    errorLevelIssues,
    warningLevelIssues,
    affectedUsers,
    frontendErrors,
    backendErrors,
  };
}

/**
 * Get color classes for error level badges
 * @param level Error level (error, warning, info, debug)
 * @returns Tailwind CSS classes for the badge
 */
export function getLevelColor(level: string): string {
  switch (level) {
    case "error":
      return "bg-red-500/20 text-red-400 border border-red-500/30";
    case "warning":
      return "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30";
    case "info":
      return "bg-blue-500/20 text-blue-400 border border-blue-500/30";
    default:
      return "bg-gray-500/20 text-gray-400 border border-gray-500/30";
  }
}
