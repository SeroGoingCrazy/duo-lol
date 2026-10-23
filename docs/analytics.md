# First-party funnel counts

`POST /api/analytics` accepts only an allowlisted event, mode (`public`, `demo`, `member`) and a random UUID stored in `sessionStorage`. No member ID, Riot ID, Discord name, URL, form content, or arbitrary properties are collected. Do Not Track disables collection. Writes are best effort and do not block product actions.

Migration `0007_funnel_events` adds `app.funnel_events`. Its primary key deduplicates each milestone per browser tab session and mode, including React remounts and refreshes. `created_at` is the first occurrence. Events older than 30 days are removed during ingestion, checked at most hourly per server process. This is a tab-session funnel, not unique people or cross-device attribution. Browser blocking, closed tabs and failed requests can undercount; client events are diagnostic, not authoritative business totals.

| Event | Trigger |
| --- | --- |
| home_viewed | Home page mounted, including shared results |
| find_viewed | Find page mounted, with the actual demo or member mode, including direct visits |
| pair_started | A pair lookup submitted or a shared pair link starts loading; anchor clicks are excluded |
| pair_completed | Pair prediction returned successfully |
| login_viewed | Login page mounted |
| account_viewed | Authenticated account page mounted; this includes returning sessions, not only new logins |
| riot_bound | Binding succeeded |
| recommendation_enabled | Saving preferences changed opt-in from off to on |
| deck_loaded | Recommendation request succeeded, including an empty result; retained for compatibility |
| deck_empty | Recommendation request succeeded with zero cards, in demo or member mode; loading, failed requests and exhausting cards by swiping do not count |
| first_card_viewed | At least 1% of a real card first intersects the viewport while the tab is visible, in demo or member mode; a successful request alone does not count |
| first_swipe | First successful like or pass |
| mutual_like | Mutual like, with simulated events in demo mode only |

These are tab-session milestones, not mutually exclusive outcomes or per-request counts. A session can load an empty deck, clear its filters and later view a card, producing both `deck_empty` and `first_card_viewed`. Empty then populated is therefore not a failed onboarding session. A populated response below the fold or in a background tab produces `deck_loaded` without `first_card_viewed` until the card is shown. Card visibility is a viewport/tab signal, not proof of attention. Repeated visibility changes and card changes send at most one impression per mounted deck; the database also deduplicates refreshes and remounts by session and mode.

Example query (run against the app database with existing authorized admin access):

```sql
SELECT event, mode, count(*) AS tab_sessions
FROM app.funnel_events
WHERE created_at >= now() - interval '7 days'
GROUP BY event, mode
ORDER BY mode, event;
```

Inspect deck milestones separately for demo and member mode. `loaded_without_card_view` includes empty results and successful responses never exposed; `loaded_no_empty_or_view` highlights successful sessions with neither an empty result nor an observed card. The latter is diagnostic: missing/blocked events and the reporting window can also explain it. The empty and viewed columns overlap when a session recovers.

```sql
WITH decks AS (
  SELECT session, mode,
    bool_or(event = 'deck_loaded') AS loaded,
    bool_or(event = 'deck_empty') AS empty,
    bool_or(event = 'first_card_viewed') AS viewed
  FROM app.funnel_events
  WHERE created_at >= now() - interval '7 days'
    AND mode IN ('demo', 'member')
  GROUP BY session, mode
)
SELECT mode,
  count(*) FILTER (WHERE loaded) AS loaded,
  count(*) FILTER (WHERE loaded AND empty) AS loaded_empty,
  count(*) FILTER (WHERE loaded AND viewed) AS first_card_viewed,
  count(*) FILTER (WHERE loaded AND NOT viewed) AS loaded_without_card_view,
  count(*) FILTER (WHERE loaded AND NOT empty AND NOT viewed) AS loaded_no_empty_or_view
FROM decks
GROUP BY mode;
```

Measure the new-member path with ordered milestones in the same tab, keeping demo activity separate. `loaded_empty` is a diagnostic branch, not a required step before viewing a card:

```sql
WITH steps AS (
  SELECT session,
    min(created_at) FILTER (WHERE event = 'login_viewed') AS login,
    min(created_at) FILTER (WHERE event = 'account_viewed') AS authenticated,
    min(created_at) FILTER (WHERE event = 'riot_bound') AS bound,
    min(created_at) FILTER (WHERE event = 'recommendation_enabled') AS opted_in,
    min(created_at) FILTER (WHERE event = 'deck_loaded' AND mode = 'member') AS loaded,
    min(created_at) FILTER (WHERE event = 'deck_empty' AND mode = 'member') AS empty,
    min(created_at) FILTER (WHERE event = 'first_card_viewed' AND mode = 'member') AS viewed,
    min(created_at) FILTER (WHERE event = 'first_swipe' AND mode = 'member') AS swiped
  FROM app.funnel_events
  WHERE created_at >= now() - interval '7 days'
  GROUP BY session
)
SELECT count(*) FILTER (WHERE login IS NOT NULL) AS login_views,
  count(*) FILTER (WHERE authenticated >= login) AS authenticated,
  count(*) FILTER (WHERE authenticated >= login AND bound >= authenticated) AS bound,
  count(*) FILTER (WHERE authenticated >= login AND bound >= authenticated AND opted_in >= bound) AS opted_in,
  count(*) FILTER (WHERE authenticated >= login AND bound >= authenticated AND opted_in >= bound AND loaded >= opted_in) AS loaded,
  count(*) FILTER (WHERE authenticated >= login AND bound >= authenticated AND opted_in >= bound AND loaded >= opted_in AND empty >= loaded) AS loaded_empty,
  count(*) FILTER (WHERE authenticated >= login AND bound >= authenticated AND opted_in >= bound AND loaded >= opted_in AND viewed >= loaded) AS first_card_viewed,
  count(*) FILTER (WHERE authenticated >= login AND bound >= authenticated AND opted_in >= bound AND loaded >= opted_in AND viewed >= loaded AND swiped >= viewed) AS swiped
FROM steps;
```

Returning members may skip binding or opt-in; don't interpret those skips as onboarding failures. These ordered counts use first occurrence timestamps, so a milestone already recorded earlier in the tab session cannot be attributed again to a later attempt. No public analytics read endpoint is exposed.
