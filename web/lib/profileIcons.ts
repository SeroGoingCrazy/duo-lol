// Summoner icons a 会员 can pick as their 头像: the list is vendored in public/profileicons/icons.json
// (`npm run sync-profile-icons`), the images come from Data Dragon's CDN at the same patch.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { profileIconUrl, type ProfileIconList } from "@/lib/profileIconUrl";

let list: Promise<ProfileIconList> | undefined;
function iconList() {
  list ??= readFile(path.join(process.cwd(), "public", "profileicons", "icons.json"), "utf8").then(JSON.parse);
  return list;
}

let ids: Promise<Set<number>> | undefined;
export function profileIconIds() {
  ids ??= iconList().then((l) => new Set(l.icons.map(([id]) => id)));
  return ids;
}

/** Turns summoner icon ids into 头像 images; null when there is none to show. */
export async function avatarUrls() {
  const { version } = await iconList();
  return (iconId: number | null | undefined) => (iconId == null ? null : profileIconUrl(version, iconId));
}

export async function avatarUrl(iconId: number | null | undefined) {
  return (await avatarUrls())(iconId);
}

/** A 会员's 头像 image, for the nav. */
export async function memberAvatar(memberId: string | undefined) {
  if (!memberId) return null;
  const db = await getDb();
  const [m] = await db.select({ icon: schema.members.avatarIconId }).from(schema.members).where(eq(schema.members.id, memberId));
  return avatarUrl(m?.icon);
}
