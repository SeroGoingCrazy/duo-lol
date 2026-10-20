// Champion icons and Chinese names from Riot Data Dragon. Match-V5 championName is Data Dragon's
// champion id, except for the one champion whose casing differs.

const DDRAGON = "https://ddragon.leagueoflegends.com";
// Used until (or if) versions.json can't be fetched; champions newer than it show a placeholder.
const FALLBACK_VERSION = "15.20.1";
const ID_FIXES: Record<string, string> = { FiddleSticks: "Fiddlesticks" };

export type ChampionInfo = { id: string; name: string; title: string; english: string };

let version: Promise<string> | null = null;
let info: Promise<Record<string, ChampionInfo>> | null = null;

/** Latest Data Dragon version, fetched once per page load. */
export function ddragonVersion(): Promise<string> {
  version ??= fetch(`${DDRAGON}/api/versions.json`)
    .then((r) => r.json())
    .then((v: string[]) => v[0] ?? FALLBACK_VERSION)
    .catch(() => FALLBACK_VERSION);
  return version;
}

const ddragonId = (champion: string) => ID_FIXES[champion] ?? champion;

export function championIconUrl(champion: string, ver: string) {
  return `${DDRAGON}/cdn/${ver}/img/champion/${encodeURIComponent(ddragonId(champion))}.png`;
}

/** {Match-V5 champion id: Chinese name (盲僧), title (李青) and English name (Lee Sin)}; {} if unreachable. */
export function championInfo(): Promise<Record<string, ChampionInfo>> {
  info ??= ddragonVersion().then(async (ver) => {
    const [zh, en] = await Promise.all(
      ["zh_CN", "en_US"].map((lang) =>
        fetch(`${DDRAGON}/cdn/${ver}/data/${lang}/champion.json`).then((r) => r.json()).then((j) => j.data ?? {}),
      ),
    );
    const out: Record<string, ChampionInfo> = {};
    for (const [id, c] of Object.entries<{ name: string; title: string }>(zh)) {
      out[id] = { id, name: c.name, title: c.title, english: en[id]?.name ?? id };
    }
    for (const [wrong, right] of Object.entries(ID_FIXES)) if (out[right]) out[wrong] = out[right];
    return out;
  }).catch(() => ({}));
  return info;
}
