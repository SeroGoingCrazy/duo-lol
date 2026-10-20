// Champion icons from Riot Data Dragon. Match-V5 championName is Data Dragon's champion id,
// except for the one champion whose casing differs.

const DDRAGON = "https://ddragon.leagueoflegends.com";
// Used until (or if) versions.json can't be fetched; champions newer than it show a placeholder.
const FALLBACK_VERSION = "15.20.1";
const ID_FIXES: Record<string, string> = { FiddleSticks: "Fiddlesticks" };

let version: Promise<string> | null = null;

/** Latest Data Dragon version, fetched once per page load. */
export function ddragonVersion(): Promise<string> {
  version ??= fetch(`${DDRAGON}/api/versions.json`)
    .then((r) => r.json())
    .then((v: string[]) => v[0] ?? FALLBACK_VERSION)
    .catch(() => FALLBACK_VERSION);
  return version;
}

export function championIconUrl(champion: string, ver: string) {
  const id = ID_FIXES[champion] ?? champion;
  return `${DDRAGON}/cdn/${ver}/img/champion/${encodeURIComponent(id)}.png`;
}
