import { calculateSimilarity } from "./fuzzy-match";

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  url: string;
  state?: {
    name: string;
  };
  team?: {
    name: string;
    key: string;
  };
  assignee?: {
    id: string;
    name: string;
    email: string;
  };
  labels?: {
    nodes: Array<{
      name: string;
    }>;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface SentryError {
  id: string;
  title: string;
  level: string;
  lastSeen: string;
  count: number;
  userCount: number;
  projectType: "Frontend" | "Backend";
  culprit?: string;
  metadata?: any;
  linearIssue?: {
    id: string;
    identifier: string;
    title: string;
    url: string;
  };
}

const FUZZY_MATCH_THRESHOLD = 70; // 70% similarity required

/**
 * Match a Sentry error with Linear issues using multiple strategies
 * @param sentryError The Sentry error to match
 * @param linearIssues Array of Linear issues to search through
 * @returns Matched Linear issue or undefined
 */
export function matchLinearIssue(
  sentryError: SentryError,
  linearIssues: LinearIssue[]
): { id: string; identifier: string; title: string; url: string } | undefined {
  const sentryTitle = sentryError.title.toLowerCase().trim();
  const sentryId = sentryError.id.toString();

  let bestMatch: LinearIssue | null = null;
  let bestScore = 0;

  for (const issue of linearIssues) {
    const linearTitle = issue.title.toLowerCase().trim();
    const linearDescription = (issue.description || "").toLowerCase();
    const linearUrl = (issue.url || "").toLowerCase();

    // Priority 1: Check if Linear description or title contains the Sentry error ID (100% match)
    if (linearDescription.includes(sentryId) || linearTitle.includes(sentryId)) {
      console.log(`✅ Match found by ID: ${issue.identifier} contains Sentry ID ${sentryId}`);
      bestMatch = issue;
      bestScore = 100;
      break;
    }

    // Priority 2: Check if Linear URL contains the Sentry error ID (100% match)
    if (linearUrl.includes(sentryId)) {
      console.log(`✅ Match found by URL: ${issue.identifier} URL contains Sentry ID ${sentryId}`);
      bestMatch = issue;
      bestScore = 100;
      break;
    }

    // Priority 3: Fuzzy matching by title similarity
    const similarity = calculateSimilarity(sentryTitle, linearTitle);

    if (similarity >= FUZZY_MATCH_THRESHOLD && similarity > bestScore) {
      bestScore = similarity;
      bestMatch = issue;
    }
  }

  if (bestMatch) {
    if (bestScore === 100) {
      console.log(`🔗 Sentry error ${sentryId} matched with Linear issue ${bestMatch.identifier} (exact match)`);
    } else {
      console.log(
        `🔗 Sentry error ${sentryId} matched with Linear issue ${bestMatch.identifier} (${bestScore.toFixed(1)}% similarity)`
      );
    }
  } else {
    console.log(`❌ No match found for Sentry error ${sentryId} (${sentryTitle.substring(0, 50)}...)`);
  }

  return bestMatch
    ? {
        id: bestMatch.id,
        identifier: bestMatch.identifier,
        title: bestMatch.title,
        url: bestMatch.url,
      }
    : undefined;
}
