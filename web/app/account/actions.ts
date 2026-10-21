"use server";
// 绑定 Riot 账号 with 头像验证 (ADR-0005), 偏好 and 注销 (PRD-v2 §3.1, §3.5).
import { and, eq, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb, schema } from "@/lib/db";
import { isBanned } from "@/lib/deckServer";
import { riotAccount, RiotAccountError, warmPlayer } from "@/lib/riotAccount";
import { riotIdProblem } from "@/lib/api";
import { POSITIONS } from "@/lib/labels";
import { bioProblem, LANGUAGES, PLAY_TIMES, VOICES, type Voice } from "@/lib/profile";

// Summoner icons 0-28 are the starter icons every League account owns, so anyone can switch to one.
const STARTER_ICONS = 29;
const CHALLENGE_MINUTES = 10;
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

export async function startVerification(_: ActionState, form: FormData): Promise<ActionState> {
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
  if (await boundElsewhere(account.puuid, me)) return { error: "这个 Riot 账号已经绑定了别的会员" };

  // any starter icon except the one they already wear, so wearing it proves they can change it
  const offset = 1 + Math.floor(Math.random() * (STARTER_ICONS - 1));
  const iconId = (account.profile_icon_id + offset) % STARTER_ICONS;
  const challenge = {
    memberId: me, puuid: account.puuid, riotId: account.riot_id, iconId,
    expiresAt: new Date(Date.now() + CHALLENGE_MINUTES * 60_000),
  };
  const db = await getDb();
  await db.insert(schema.verificationChallenges).values(challenge)
    .onConflictDoUpdate({ target: schema.verificationChallenges.memberId, set: challenge });
  revalidatePath("/account");
  return {};
}

export async function checkVerification(_: ActionState): Promise<ActionState> {
  const me = await memberId();
  const db = await getDb();
  const [challenge] = await db.select().from(schema.verificationChallenges)
    .where(eq(schema.verificationChallenges.memberId, me));
  if (!challenge || challenge.expiresAt < new Date()) return { error: "验证已过期，请重新输入 Riot ID" };
  let account;
  try {
    account = await riotAccount(challenge.riotId);
  } catch (e) {
    return { error: e instanceof RiotAccountError ? e.message : "查询失败，请稍后再试" };
  }
  if (account.puuid !== challenge.puuid) return { error: "这个 Riot ID 现在属于另一个账号，请重新开始" };
  if (account.profile_icon_id !== challenge.iconId) {
    return { error: `还没读到新头像：你现在戴的是 #${account.profile_icon_id}，需要换成 #${challenge.iconId}。换好后等几秒再点验证。` };
  }
  if (await boundElsewhere(account.puuid, me)) return { error: "这个 Riot 账号已经绑定了别的会员" };

  // a Riot account paused under an earlier membership stays paused (PRD-v2 §8)
  const banned = await isBanned(db, account.puuid);
  await db.update(schema.members)
    .set({ puuid: account.puuid, riotId: account.riot_id, verifiedAt: new Date(), ...(banned ? { suspendedAt: new Date() } : {}) })
    .where(eq(schema.members.id, me));
  await db.insert(schema.memberPrefs).values({ memberId: me }).onConflictDoNothing();
  await db.delete(schema.verificationChallenges).where(eq(schema.verificationChallenges.memberId, me));
  warmPlayer(account.riot_id);
  revalidatePath("/account");
  return { ok: "绑定成功" };
}

export async function cancelVerification() {
  const me = await memberId();
  const db = await getDb();
  await db.delete(schema.verificationChallenges).where(eq(schema.verificationChallenges.memberId, me));
  revalidatePath("/account");
}

export async function savePrefs(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await memberId();
  const positions = form.getAll("positions").map(String).filter((p) => POSITIONS.includes(p));
  if (positions.length > MAX_POSITIONS) return { error: `想打的位置最多选 ${MAX_POSITIONS} 个` };
  const bio = String(form.get("bio") ?? "").replace(/\s+/g, " ").trim();
  const problem = bioProblem(bio);
  if (problem) return { error: problem };
  const among = <T extends string>(name: string, allowed: readonly T[]) =>
    [...new Set(form.getAll(name).map(String))].filter((x): x is T => (allowed as readonly string[]).includes(x));
  const voice = String(form.get("voice") ?? "");
  const prefs = {
    positions,
    bio,
    languages: among("languages", LANGUAGES),
    voice: (VOICES as readonly string[]).includes(voice) ? (voice as Voice) : null,
    playTimes: among("play_times", PLAY_TIMES),
    recommendOptIn: form.get("recommend_opt_in") === "on",
    showDiscord: form.get("show_discord") === "on",
  };
  const db = await getDb();
  await db.insert(schema.memberPrefs).values({ memberId: me, ...prefs })
    .onConflictDoUpdate({ target: schema.memberPrefs.memberId, set: prefs });
  revalidatePath("/account");
  return { ok: "已保存" };
}

/** 注销: deletes the 会员 and, by cascade, their login, 偏好 and 头像验证 (PRD-v2 §3.5, §9). */
export async function deleteAccount() {
  const me = await memberId();
  const db = await getDb();
  await db.delete(schema.members).where(eq(schema.members.id, me));
  const jar = await cookies();
  for (const name of ["authjs.session-token", "__Secure-authjs.session-token"]) jar.delete(name);
  redirect("/");
}
