"use server";
// 绑定 Riot 账号 (ADR-0011), 头像, 偏好 and 注销 (PRD-v2 §3.1, §3.5).
import { and, eq, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb, schema } from "@/lib/db";
import { isBanned, releaseRiotAccount } from "@/lib/deckServer";
import { riotAccount, RiotAccountError, warmPlayer } from "@/lib/riotAccount";
import { riotIdProblem } from "@/lib/api";
import { POSITIONS } from "@/lib/labels";
import { profileIconIds } from "@/lib/profileIcons";
import { bioProblem, LANGUAGES, pick, PLAY_TIMES, VOICES, type Voice } from "@/lib/profile";

const MAX_POSITIONS = 2;

export type ActionState = { error?: string; ok?: string };

async function memberId() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

async function boundElsewhere(puuid: string, me: string) {
  const db = await getDb();
  const other = await db.select({ id: schema.members.id }).from(schema.members)
    .where(and(eq(schema.members.puuid, puuid), ne(schema.members.id, me))).limit(1);
  return other.length > 0;
}

/** 绑定: typing a Riot ID binds it at once, 未验证 until Riot Sign On can prove it (ADR-0011).
 *  The 头像 starts as the icon they wear in game. */
export async function bindRiot(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await memberId();
  const riotId = String(form.get("riot_id") ?? "").trim();
  const problem = riotIdProblem(riotId);
  if (!riotId || problem) return { error: problem ?? "请输入 Riot ID" };
  let account;
  try {
    account = await riotAccount(riotId);
  } catch (e) {
    return { error: e instanceof RiotAccountError ? e.message : "查询失败，请稍后再试" };
  }
  if (await boundElsewhere(account.puuid, me)) return { error: "这个 Riot 账号已经被别的会员绑定。如果这是你的号，请在 Discord 联系网站管理员" };

  const db = await getDb();
  // a Riot account paused under an earlier membership stays paused (PRD-v2 §8)
  const banned = await isBanned(db, account.puuid);
  try {
    await db.update(schema.members)
      .set({ puuid: account.puuid, riotId: account.riot_id, boundAt: new Date(), verifiedAt: null,
        avatarIconId: account.profile_icon_id, ...(banned ? { suspendedAt: new Date() } : {}) })
      .where(eq(schema.members.id, me));
  } catch {
    // members.puuid is unique: someone else bound it a moment ago
    return { error: "这个 Riot 账号已经被别的会员绑定。如果这是你的号，请在 Discord 联系网站管理员" };
  }
  await db.insert(schema.memberPrefs).values({ memberId: me }).onConflictDoNothing();
  warmPlayer(account.riot_id);
  revalidatePath("/", "layout");
  return { ok: "绑定成功" };
}

/** 解绑: frees the Riot account, say after a typo, and ends their 互选 (releaseRiotAccount).
 *  Not while paused or reported, so nobody sheds a Riot account before the pause records it (PRD-v2 §8). */
export async function unbindRiot(_: ActionState): Promise<ActionState> {
  const me = await memberId();
  const db = await getDb();
  const [m] = await db.select().from(schema.members).where(eq(schema.members.id, me));
  const [reported] = await db.select({ id: schema.reports.id }).from(schema.reports)
    .where(and(eq(schema.reports.toMember, me), eq(schema.reports.status, "open"))).limit(1);
  if (m.suspendedAt || reported) return { error: "你有待处理的举报，暂时不能换 Riot 账号" };
  await releaseRiotAccount(db, me);
  revalidatePath("/", "layout");
  return {};
}

/** 头像: any summoner icon from the list, or back to the one they wear in game right now. */
export async function setAvatar(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await memberId();
  const db = await getDb();
  let icon = Number(form.get("icon"));
  if (form.get("icon") === "game") {
    const [m] = await db.select().from(schema.members).where(eq(schema.members.id, me));
    if (!m.riotId) return { error: "先绑定 Riot 账号" };
    let account;
    try {
      account = await riotAccount(m.riotId);
    } catch (e) {
      return { error: e instanceof RiotAccountError ? e.message : "查询失败，请稍后再试" };
    }
    // a renamed Riot ID can belong to someone else now
    if (account.puuid !== m.puuid) return { error: "这个 Riot ID 现在属于另一个账号，请重新绑定" };
    icon = account.profile_icon_id;
  } else if (!(await profileIconIds()).has(icon)) {
    return { error: "没有这个头像" };
  }
  await db.update(schema.members).set({ avatarIconId: icon }).where(eq(schema.members.id, me));
  revalidatePath("/", "layout");
  return { ok: "头像已更新" };
}

export async function savePrefs(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await memberId();
  const positions = form.getAll("positions").map(String).filter((p) => POSITIONS.includes(p));
  if (positions.length > MAX_POSITIONS) return { error: `想打的位置最多选 ${MAX_POSITIONS} 个` };
  const bio = String(form.get("bio") ?? "").replace(/\s+/g, " ").trim();
  const problem = bioProblem(bio);
  if (problem) return { error: problem };
  const voice = String(form.get("voice") ?? "");
  const prefs = {
    positions,
    bio,
    languages: pick(form.getAll("languages"), LANGUAGES),
    voice: (VOICES as readonly string[]).includes(voice) ? (voice as Voice) : null,
    playTimes: pick(form.getAll("play_times"), PLAY_TIMES),
    recommendOptIn: form.get("recommend_opt_in") === "on",
    showDiscord: form.get("show_discord") === "on",
    notifyDiscord: form.get("notify_discord") === "on",
  };
  const db = await getDb();
  await db.insert(schema.memberPrefs).values({ memberId: me, ...prefs })
    .onConflictDoUpdate({ target: schema.memberPrefs.memberId, set: prefs });
  revalidatePath("/account");
  return { ok: "已保存" };
}

/** 注销: deletes the 会员 and, by cascade, their login and 偏好 (PRD-v2 §3.5, §9). */
export async function deleteAccount() {
  const me = await memberId();
  const db = await getDb();
  await db.delete(schema.members).where(eq(schema.members.id, me));
  const jar = await cookies();
  for (const name of ["authjs.session-token", "__Secure-authjs.session-token"]) jar.delete(name);
  redirect("/");
}
