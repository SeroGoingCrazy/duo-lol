// Champion icons are Riot Data Dragon portraits copied into public/champions/ by
// scripts/sync-champion-icons.mjs, so the site needs no network to show them.
// Match-V5 championName is Data Dragon's champion id, except for the one champion whose casing differs.

const ID_FIXES: Record<string, string> = { FiddleSticks: "Fiddlesticks" };

export function championIconUrl(champion: string) {
  const id = ID_FIXES[champion] ?? champion;
  return `/champions/${encodeURIComponent(id)}.png`;
}
