// Copy every champion portrait from Riot Data Dragon into public/champions/.
// Run after a patch adds champions: `npm run sync-icons`, then commit public/champions/.
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DDRAGON = "https://ddragon.leagueoflegends.com";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "champions");

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res;
}

const [version] = await (await get(`${DDRAGON}/api/versions.json`)).json();
const { data } = await (await get(`${DDRAGON}/cdn/${version}/data/en_US/champion.json`)).json();
await mkdir(OUT, { recursive: true });
const have = new Set(await readdir(OUT));

let added = 0;
for (const { id } of Object.values(data)) {
  const file = `${id}.png`;
  if (have.has(file)) continue;
  const png = await get(`${DDRAGON}/cdn/${version}/img/champion/${file}`);
  await writeFile(join(OUT, file), Buffer.from(await png.arrayBuffer()));
  added++;
}
await writeFile(join(OUT, "VERSION"), `${version}\n`);
console.log(`Data Dragon ${version}: ${Object.keys(data).length} champions, ${added} new icons in public/champions/`);
