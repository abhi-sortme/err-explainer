import useSWR from "swr";

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.message || "Failed to fetch errors");
  }
  return response.json();
};

/**
 * Custom hook to fetch Sentry errors with automatic caching and revalidation
 * @param isAuthenticated Whether the user is authenticated
 * @returns SWR response with errors data
 */
export function useSentryErrors(isAuthenticated: boolean) {
  return useSWR(
    isAuthenticated ? "/api/sentry/errors" : null,
    fetcher,
    {
      refreshInterval: 60000, // Refresh every 60 seconds
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 60000,
    }
  );
}
