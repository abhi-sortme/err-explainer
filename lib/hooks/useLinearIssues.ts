import useSWR from "swr";

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.message || "Failed to fetch Linear issues");
  }
  return response.json();
};

/**
 * Custom hook to fetch Linear issues with automatic caching and revalidation
 * @param isAuthenticated Whether the user is authenticated
 * @returns SWR response with Linear issues data
 */
export function useLinearIssues(isAuthenticated: boolean) {
  // Only fetch on client-side to prevent SSR/build-time API calls
  const shouldFetch = typeof window !== 'undefined' && isAuthenticated;
  
  return useSWR(
    shouldFetch ? "/api/linear/issues" : null,
    fetcher,
    {
      refreshInterval: 120000, // Refresh every 2 minutes
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 120000,
    }
  );
}
