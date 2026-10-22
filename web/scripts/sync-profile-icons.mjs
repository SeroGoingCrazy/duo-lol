// List every summoner icon a 会员 can pick as their 头像 into public/profileicons/icons.json:
// the ids Data Dragon serves images for, with Chinese and English titles from CommunityDragon for search.
// Only the list is vendored; the picker loads the images from Data Dragon's CDN (about 6000 of them).
// Run after a patch adds icons: `npm run sync-profile-icons`, then commit public/profileicons/.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DDRAGON = "https://ddragon.leagueoflegends.com";
const CDRAGON = "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "profileicons");

async function json(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

const [version] = await json(`${DDRAGON}/api/versions.json`);
const { data } = await json(`${DDRAGON}/cdn/${version}/data/en_US/profileicon.json`);
const en = new Map((await json(`${CDRAGON}/default/v1/summoner-icons.json`)).map((i) => [i.id, i]));
const zh = new Map((await json(`${CDRAGON}/zh_cn/v1/summoner-icons.json`)).map((i) => [i.id, i.title]));

// [id, Chinese title, English title, year released], newest first so the picker opens on recent icons
const icons = Object.keys(data).map(Number).map((id) => {
  const { title = "", yearReleased = 0 } = en.get(id) ?? {};
  return [id, zh.get(id) || title, title, yearReleased];
})
  .sort((a, b) => b[3] - a[3] || b[0] - a[0]);
await mkdir(OUT, { recursive: true });
await writeFile(join(OUT, "icons.json"), `${JSON.stringify({ version, icons })}\n`);
console.log(`Data Dragon ${version}: ${icons.length} summoner icons in public/profileicons/icons.json`);
