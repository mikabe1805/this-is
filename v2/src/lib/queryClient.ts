/**
 * The single TanStack Query client. Exported from its own module (not created
 * inside App) so non-React code — the auth listener — can invalidate queries
 * after it writes: e.g. seeding the tastemaker follows must refresh the user
 * doc + the friend feed, which otherwise wouldn't refetch on their own.
 */
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
