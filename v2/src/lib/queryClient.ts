/**
 * The single TanStack Query client. Exported from its own module (not created
 * inside App) so non-React code — the auth listener — can invalidate queries
 * after it writes: e.g. accepting an invitation must refresh the circle
 * doc + circle evidence, which otherwise would not refetch on their own.
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
