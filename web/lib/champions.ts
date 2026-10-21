// Champion icons are Riot Data Dragon portraits copied into public/champions/ by
// scripts/sync-champion-icons.mjs, so the site needs no network to show them. The same script
// writes public/champions/names.json (Chinese and English names); until it has been re-run,
// names are fetched from Data Dragon in the browser.
// Match-V5 championName is Data Dragon's champion id, except for the one champion whose casing differs.

const DDRAGON = "https://ddragon.leagueoflegends.com";
const ID_FIXES: Record<string, string> = { FiddleSticks: "Fiddlesticks" };

export type ChampionInfo = { id: string; name: string; title: string; english: string };

let info: Promise<Record<string, ChampionInfo>> | null = null;

const ddragonId = (champion: string) => ID_FIXES[champion] ?? champion;

export function championIconUrl(champion: string) {
  return `/champions/${encodeURIComponent(ddragonId(champion))}.png`;
}

async function fromDataDragon(): Promise<Record<string, ChampionInfo>> {
  const ver = (await (await fetch("/champions/VERSION")).text()).trim();
  const [zh, en] = await Promise.all(
    ["zh_CN", "en_US"].map((lang) =>
      fetch(`${DDRAGON}/cdn/${ver}/data/${lang}/champion.json`).then((r) => r.json()).then((j) => j.data ?? {}),
    ),
  );
  const out: Record<string, ChampionInfo> = {};
  for (const [id, c] of Object.entries<{ name: string; title: string }>(zh)) {
    out[id] = { id, name: c.name, title: c.title, english: en[id]?.name ?? id };
  }
  return out;
}

/** {Match-V5 champion id: Chinese name (盲僧), title (李青) and English name (Lee Sin)}; {} if unavailable. */
export function championInfo(): Promise<Record<string, ChampionInfo>> {
  info ??= fetch("/champions/names.json")
    .then((r) => (r.ok ? r.json() : fromDataDragon()))
    .then((out: Record<string, ChampionInfo>) => {
      for (const [wrong, right] of Object.entries(ID_FIXES)) if (out[right]) out[wrong] = out[right];
      return out;
    })
    .catch(() => ({}));
  return info;
}

/** The name to show: Chinese (盲僧) or English (Lee Sin); the id if Data Dragon is unreachable. */
export function championName(info: Record<string, ChampionInfo>, champion: string, lang: "zh" | "en") {
  const c = info[champion];
  return c ? (lang === "en" ? c.english : c.name) : champion;
}
