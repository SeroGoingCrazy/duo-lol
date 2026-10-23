// A closed vocabulary: never accept Riot IDs, member IDs, URLs, free text or arbitrary properties.
export const FUNNEL_EVENTS = ["home_viewed", "find_viewed", "pair_started", "pair_completed", "login_viewed", "account_viewed", "riot_bound", "recommendation_enabled", "deck_loaded", "first_swipe", "mutual_like"] as const;
export const FUNNEL_MODES = ["public", "demo", "member"] as const;
export type FunnelEventName = typeof FUNNEL_EVENTS[number];
export type FunnelMode = typeof FUNNEL_MODES[number];
