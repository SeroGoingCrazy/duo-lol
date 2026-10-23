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
| deck_loaded | Recommendations loaded, including an empty deck |
| first_swipe | First successful like or pass |
| mutual_like | Mutual like, with simulated events in demo mode only |

Example query (run against the app database with existing authorized admin access):

```sql
SELECT event, mode, count(*) AS tab_sessions
FROM app.funnel_events
WHERE created_at >= now() - interval '7 days'
GROUP BY event, mode
ORDER BY mode, event;
```

Measure the new-member path with ordered milestones in the same tab, keeping demo swipes separate:

```sql
WITH steps AS (
  SELECT session,
    min(created_at) FILTER (WHERE event = 'login_viewed') AS login,
    min(created_at) FILTER (WHERE event = 'account_viewed') AS authenticated,
    min(created_at) FILTER (WHERE event = 'riot_bound') AS bound,
    min(created_at) FILTER (WHERE event = 'recommendation_enabled') AS opted_in,
    min(created_at) FILTER (WHERE event = 'first_swipe' AND mode = 'member') AS swiped
  FROM app.funnel_events
  WHERE created_at >= now() - interval '7 days'
  GROUP BY session
)
SELECT count(*) FILTER (WHERE login IS NOT NULL) AS login_views,
  count(*) FILTER (WHERE authenticated >= login) AS authenticated,
  count(*) FILTER (WHERE authenticated >= login AND bound >= authenticated) AS bound,
  count(*) FILTER (WHERE authenticated >= login AND bound >= authenticated AND opted_in >= bound) AS opted_in,
  count(*) FILTER (WHERE authenticated >= login AND bound >= authenticated AND opted_in >= bound AND swiped >= opted_in) AS swiped
FROM steps;
```

Returning members may skip binding or opt-in; don't interpret those skips as onboarding failures. No public analytics read endpoint is exposed.
