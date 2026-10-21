// 牌堆, 喜欢 / 跳过, 互选, 拉黑 and 举报 for 会员 (PRD-v2 §3.2-3.4, §6.1, §8). Server only.
// The site applies the hard filters on its own tables; the Python API scores and ranks what is left (ADR-0006).
import { and, desc, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb, schema } from "@/lib/db";
import { API_URL } from "@/lib/riotAccount";
import { POSITIONS, riotIdKey, type DeckCard, type Partner, type SelfReport } from "@/lib/api";
import { SELF_REPORT_TIERS } from "@/lib/labels";
import { REPORT_REASONS } from "@/lib/reportReasons";

export const DAILY_LIKES = 100;        // §8: a cap against liking everyone; it never affects the order
export const ACTIVE_DAYS = 14;         // §3.2: only 会员 seen in the last 14 days are dealt
export const SUSPEND_AFTER = 3;        // §8: reports from this many different 会员 pause recommendations
const DECK_LIMIT = 200;                // data/api.py MAX_DECK
const MAX_CANDIDATES = 4000;           // under data/api.py MAX_CANDIDATES, leaving room for 互选

const { members, memberPrefs, swipes, mutualLikes, blocks, reports, authAccounts, riotBans } = schema;
type Db = Awaited<ReturnType<typeof getDb>>;
type Member = typeof members.$inferSelect;

export class DeckError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); }
}

/** The logged-in 会员 and their 偏好, or a DeckError saying what is missing before they can swipe.
 *  forSafety: 拉黑, 举报 and the 互选 list only need a bound account, so someone who left the 推荐池 can still use them. */
export async function swiper({ forSafety = false } = {}) {
  const id = (await auth())?.user?.id;
  if (!id) throw new DeckError(401, "请先登录", "login");
  const db = await getDb();
  const [row] = await db.select().from(members).leftJoin(memberPrefs, eq(memberPrefs.memberId, members.id))
    .where(eq(members.id, id));
  if (!row) throw new DeckError(401, "请先登录", "login");
  const { members: me, member_prefs: prefs } = row;
  if (!me.verifiedAt || !me.puuid || !me.riotId) throw new DeckError(403, "先在我的账号里绑定 Riot 账号", "unverified");
  if (forSafety) return { me, prefs, db };
  if (!prefs?.recommendOptIn) throw new DeckError(403, "先在我的账号里开启“同意被推荐”，别人才能看到你", "opt_in");
  if (me.suspendedAt) throw new DeckError(403, "你的账号因被举报暂停推荐，等待管理员处理", "suspended");
  return { me, prefs, db };
}

const pairKey = (a: string, b: string) => (a < b ? [a, b] : [b, a]) as [string, string];

/** Everyone `me` must never see: blocked either way. */
async function blockedIds(db: Db, me: string) {
  const rows = await db.select({ from: blocks.fromMember, to: blocks.toMember }).from(blocks)
    .where(or(eq(blocks.fromMember, me), eq(blocks.toMember, me)));
  return new Set(rows.map((r) => (r.from === me ? r.to : r.from)));
}

async function activeMutualIds(db: Db, me: string) {
  const rows = await db.select().from(mutualLikes)
    .where(and(isNull(mutualLikes.cancelledAt), or(eq(mutualLikes.memberA, me), eq(mutualLikes.memberB, me))));
  return new Map(rows.map((r) => [r.memberA === me ? r.memberB : r.memberA, r.createdAt]));
}

async function score(me: Member, report: SelfReport | null | undefined, others: { member: Member; report: SelfReport | null }[]) {
  if (others.length === 0) return new Map<string, Partner>();
  const res = await fetch(`${API_URL}/api/recommendations`, {
    method: "POST", headers: { "content-type": "application/json" }, cache: "no-store",
    body: JSON.stringify({
      riot_id: me.riotId, self_report: report ?? null, limit: DECK_LIMIT,
      candidates: others.map((o) => ({ puuid: o.member.puuid, riot_id: o.member.riotId, self_report: o.report })),
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 422 && body.detail?.insufficient_data) throw new DeckError(422, "数据不足，请先选几个常玩英雄", "insufficient_data");
  if (res.status === 409) throw new DeckError(409, "还在读取你的对局，请稍后再试", "not_cached");
  if (!res.ok) throw new DeckError(502, typeof body.detail === "string" ? body.detail : "预测服务暂时不可用");
  const byPuuid = new Map(others.map((o) => [o.member.puuid!, o.member.id]));
  const byRiotId = new Map(others.map((o) => [riotIdKey(o.member.riotId!), o.member.id]));
  const out = new Map<string, Partner>();
  for (const p of body.partners as (Partner & { puuid: string })[]) {
    const id = byPuuid.get(p.puuid) ?? byRiotId.get(riotIdKey(p.riot_id));
    if (id) out.set(id, p);
  }
  return out;
}

/** Strip what a card must not show before 互选: the Riot ID and the puuid. */
function card(id: string, p: Partner): DeckCard {
  const { riot_id: _r, puuid: _p, ...rest } = p as Partner & { puuid?: string };
  return { ...rest, id };
}

const unscored = (id: string): DeckCard => ({
  id, tier: "", division: null, win_rate: 0, win_rate_delta: 0, score: null, roles: { a: "", b: "" }, top_pairs: [], reasons: [],
});

/** GET /api/deck: the 牌堆 (best 预测胜率 first), who likes me, and my 互选 with their Riot IDs. */
export async function deck() {
  const { me, prefs, db } = await swiper();
  const since = new Date(Date.now() - ACTIVE_DAYS * 86_400_000);
  const hidden = await blockedIds(db, me.id);
  const mutual = await activeMutualIds(db, me.id);
  const swiped = new Map((await db.select({ to: swipes.toMember, action: swipes.action }).from(swipes)
    .where(eq(swipes.fromMember, me.id))).map((r) => [r.to, r.action]));
  const likers = new Set((await db.select({ from: swipes.fromMember }).from(swipes)
    .where(and(eq(swipes.toMember, me.id), eq(swipes.action, "like")))).map((r) => r.from));

  // 推荐池: verified, 同意被推荐, active, not suspended; then my own exclusions.
  const pool = await db.select().from(members).innerJoin(memberPrefs, eq(memberPrefs.memberId, members.id))
    .where(and(eq(memberPrefs.recommendOptIn, true), isNull(members.suspendedAt), gte(members.lastActiveAt, since),
      sql`${members.puuid} is not null`, sql`${members.id} <> ${me.id}`));
  const mutualRows = mutual.size
    ? await db.select().from(members).innerJoin(memberPrefs, eq(memberPrefs.memberId, members.id))
      .where(inArray(members.id, [...mutual.keys()]))
    : [];
  pool.sort((a, b) => +b.members.lastActiveAt! - +a.members.lastActiveAt!);   // most recently active first if capped
  const unseen = pool.filter((r) => !hidden.has(r.members.id) && !swiped.has(r.members.id) && !mutual.has(r.members.id))
    .slice(0, MAX_CANDIDATES);
  const asCandidate = (r: (typeof pool)[number]) => ({ member: r.members, report: r.member_prefs.selfReport ?? null });
  // scored apart, so 互选 never take 牌堆 slots and keep their own score
  const scored = await score(me, prefs?.selfReport, unseen.map(asCandidate));
  const scoredMutual = await score(me, prefs?.selfReport, mutualRows.filter((r) => !hidden.has(r.members.id)).map(asCandidate));

  const cards: DeckCard[] = [];
  for (const r of unseen) {
    const p = scored.get(r.members.id);
    if (p) cards.push(card(r.members.id, p));
  }
  cards.sort((a, b) => b.win_rate - a.win_rate);
  // a 互选 stays listed even if the pair can no longer be scored (say, one of them climbed out of duo range)
  const mutualCards: DeckCard[] = mutualRows
    .filter((r) => !hidden.has(r.members.id))
    .map((r) => {
      const p = scoredMutual.get(r.members.id);
      return { ...(p ? card(r.members.id, p) : unscored(r.members.id)), riot_id: r.members.riotId!,
        discord: r.member_prefs.showDiscord ? r.members.name : null };
    })
    .sort((a, b) => +mutual.get(b.id)! - +mutual.get(a.id)!);
  const lastPass = await latestPass(db, me.id);
  return {
    cards, likes_you: cards.filter((c) => likers.has(c.id)).map((c) => c.id), mutual: mutualCards,
    likes_remaining: DAILY_LIKES - (await likesToday(db, me.id)), can_undo: lastPass !== null,
    retry_after: cards.length === 0 ? 60 : null,
  };
}

async function likesToday(db: Db, me: string) {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(swipes)
    .where(and(eq(swipes.fromMember, me), eq(swipes.action, "like"), gte(swipes.createdAt, new Date(Date.now() - 86_400_000))));
  return n;
}

async function latestPass(db: Db, me: string) {
  const [last] = await db.select().from(swipes).where(eq(swipes.fromMember, me)).orderBy(desc(swipes.createdAt)).limit(1);
  return last?.action === "pass" ? last.toMember : null;
}

async function contact(db: Db, id: string) {
  const [row] = await db.select().from(members).leftJoin(memberPrefs, eq(memberPrefs.memberId, members.id)).where(eq(members.id, id));
  if (!row) return null;   // 注销 a moment ago
  return { riot_id: row.members.riotId!, discord: row.member_prefs?.showDiscord ? row.members.name : null };
}

/** POST /api/swipes: record 喜欢 or 跳过; a 喜欢 back from them makes a 互选 at once (PRD-v2 §2.1). */
export async function swipe(to: string, action: "like" | "pass") {
  const { me, db } = await swiper();
  if (to === me.id) throw new DeckError(400, "不能滑自己");
  // only someone who could be dealt to me right now: bound, 同意被推荐, not paused, not blocked
  const [target] = await db.select({ id: members.id }).from(members).innerJoin(memberPrefs, eq(memberPrefs.memberId, members.id))
    .where(and(eq(members.id, to), eq(memberPrefs.recommendOptIn, true), isNull(members.suspendedAt), sql`${members.puuid} is not null`));
  if (!target || (await blockedIds(db, me.id)).has(to)) throw new DeckError(404, "这名会员已经不在推荐池里");
  const [a, b] = pairKey(me.id, to);
  const matched = await db.transaction(async (tx) => {
    // both 喜欢 at the same instant: the pair lock makes the second one see the first and create the 互选
    // and my own lock makes parallel 喜欢 to different people respect the daily cap
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${me.id}))`);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${a + "|" + b}))`);
    if (action === "like" && (await likesToday(tx as unknown as Db, me.id)) >= DAILY_LIKES) {
      throw new DeckError(429, `今天的 ${DAILY_LIKES} 次喜欢已经用完，明天再来`, "likes_exhausted");
    }
    const inserted = await tx.insert(swipes).values({ fromMember: me.id, toMember: to, action }).onConflictDoNothing().returning();
    if (inserted.length === 0) throw new DeckError(409, "已经滑过这名会员");
    if (action !== "like") return false;
    const [back] = await tx.select().from(swipes)
      .where(and(eq(swipes.fromMember, to), eq(swipes.toMember, me.id), eq(swipes.action, "like")));
    if (!back) return false;
    await tx.insert(mutualLikes).values({ memberA: a, memberB: b })
      .onConflictDoUpdate({ target: [mutualLikes.memberA, mutualLikes.memberB], set: { cancelledAt: null, createdAt: new Date() } });
    return true;
  });
  const match = matched ? await contact(db, to) : null;
  return { mutual_like: match !== null, match, likes_remaining: DAILY_LIKES - (await likesToday(db, me.id)) };
}

/** POST /api/swipes/undo: only the latest swipe, and only if it was a 跳过. */
export async function undo() {
  const { me, db } = await swiper();
  const to = await latestPass(db, me.id);
  if (!to) throw new DeckError(409, "只能撤销最近一次跳过");
  await db.delete(swipes).where(and(eq(swipes.fromMember, me.id), eq(swipes.toMember, to)));
  return { undone: to };
}

/** GET /api/mutual-likes: the only place a Riot ID is returned. */
export async function mutualLikesOf() {
  const { me, db } = await swiper({ forSafety: true });
  const hidden = await blockedIds(db, me.id);
  const mutual = await activeMutualIds(db, me.id);
  const out = [];
  for (const [id, at] of mutual) {
    const c = hidden.has(id) ? null : await contact(db, id);
    if (c) out.push({ id, ...c, created_at: at });
  }
  return out.sort((a, b) => +b.created_at - +a.created_at);
}

/** DELETE /api/mutual-likes: cancel quietly; it disappears for both, and neither re-enters the other's 牌堆. */
export async function cancelMutual(other: string) {
  const { me, db } = await swiper({ forSafety: true });
  const [a, b] = pairKey(me.id, other);
  await db.update(mutualLikes).set({ cancelledAt: new Date() })
    .where(and(eq(mutualLikes.memberA, a), eq(mutualLikes.memberB, b), isNull(mutualLikes.cancelledAt)));
  return { ok: true };
}

async function blockPair(db: Db, me: string, to: string) {
  await db.insert(blocks).values({ fromMember: me, toMember: to }).onConflictDoNothing();
  const [a, b] = pairKey(me, to);
  await db.update(mutualLikes).set({ cancelledAt: new Date() })
    .where(and(eq(mutualLikes.memberA, a), eq(mutualLikes.memberB, b), isNull(mutualLikes.cancelledAt)));
}

async function existing(db: Db, me: string, to: string) {
  if (to === me) throw new DeckError(400, "不能对自己这样做");
  const [target] = await db.select().from(members).where(eq(members.id, to));
  if (!target) throw new DeckError(404, "这名会员已经注销");
  return target;
}

/** POST /api/blocks: from now on the two never see each other; a 互选 between them ends too. */
export async function block(to: string) {
  const { me, db } = await swiper({ forSafety: true });
  await existing(db, me.id, to);
  await blockPair(db, me.id, to);
  return { ok: true };
}

/** Out of every 牌堆, and remembered by Riot account so 注销 and re-registering doesn't undo it. */
export async function pause(db: Db, target: Member) {
  await db.update(members).set({ suspendedAt: new Date() }).where(and(eq(members.id, target.id), isNull(members.suspendedAt)));
  if (target.puuid) await db.insert(riotBans).values({ puuid: target.puuid }).onConflictDoNothing();
}

export async function unpause(db: Db, target: Member) {
  await db.update(members).set({ suspendedAt: null }).where(eq(members.id, target.id));
  if (target.puuid) await db.delete(riotBans).where(eq(riotBans.puuid, target.puuid));
}

/** Is this Riot account paused from an earlier membership? Checked when it is bound again. By puuid only:
 *  a Riot ID can be renamed and taken by someone else. */
export async function isBanned(db: Db, puuid: string) {
  const rows = await db.select().from(riotBans).where(eq(riotBans.puuid, puuid));
  return rows.length > 0;
}

/** POST /api/reports: also blocks them; reports from SUSPEND_AFTER different 会员 pause their recommendations. */
export async function report(to: string, reason: string, detail: string) {
  if (!REPORT_REASONS.includes(reason as (typeof REPORT_REASONS)[number])) throw new DeckError(400, "请选择举报理由");
  const { me, db } = await swiper({ forSafety: true });
  const target = await existing(db, me.id, to);
  const text = detail.trim().slice(0, 500);
  await db.insert(reports).values({ fromMember: me.id, toMember: to, reason: text ? `${reason}：${text}` : reason });
  await blockPair(db, me.id, to);
  const [{ n }] = await db.select({ n: sql<number>`count(distinct ${reports.fromMember})::int` }).from(reports)
    .where(and(eq(reports.toMember, to), eq(reports.status, "open")));
  if (n >= SUSPEND_AFTER) await pause(db, target);
  return { ok: true };
}

/** POST /api/self-report: 自选英雄 for a 数据不足 会员, used for their own 牌堆 and on others' cards.
 *  Same limits as the 查组合 form (PRD §2.3): up to 5 champions in up to 2 positions. */
export async function saveSelfReport(r: SelfReport) {
  const id = (await auth())?.user?.id;
  if (!id) throw new DeckError(401, "请先登录", "login");
  const picks = (r.picks ?? []).slice(0, 5).filter((p) => p && typeof p.champion === "string" && p.champion
    && (POSITIONS as readonly string[]).includes(p.position)).map((p) => ({ champion: p.champion, position: p.position }));
  if (picks.length === 0) throw new DeckError(400, "至少选一个英雄");
  if (new Set(picks.map((p) => p.position)).size > 2) throw new DeckError(400, "自选英雄最多覆盖 2 个位置");
  const tier = typeof r.tier === "string" && SELF_REPORT_TIERS.includes(r.tier) ? r.tier : undefined;
  const db = await getDb();
  const selfReport = { tier, picks };
  await db.insert(memberPrefs).values({ memberId: id, selfReport })
    .onConflictDoUpdate({ target: memberPrefs.memberId, set: { selfReport } });
  return { ok: true };
}

/** Admins are listed by login account in ADMIN_ACCOUNTS, e.g. "discord:1234,dev:admin". */
export async function isAdmin(memberId: string | undefined) {
  const listed = (process.env.ADMIN_ACCOUNTS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!memberId || listed.length === 0) return false;
  const db = await getDb();
  const rows = await db.select().from(authAccounts).where(eq(authAccounts.userId, memberId));
  return rows.some((r) => listed.includes(`${r.provider}:${r.providerAccountId}`));
}

/** Route helper: JSON body or a DeckError as { detail, code }. */
export async function respond(fn: () => Promise<unknown>) {
  try {
    return Response.json(await fn());
  } catch (e) {
    if (e instanceof DeckError) return Response.json({ detail: e.message, code: e.code }, { status: e.status });
    throw e;
  }
}
