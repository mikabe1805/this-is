// Feature flags for gating new features and experiments
export const featureFlags = {
  explore_stacks: false,    // Legacy deck view in Explore (post-refresh: single feed)
  search_v2: false,         // Use refreshed Search page (the legacy SearchV2 has add-to-tags / make-a-hub)
} as const;
