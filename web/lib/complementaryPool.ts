// Empty-牌堆 encouragement counts only; no member identities or predictions leave this helper.
import { and, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";
import { schema } from "@/lib/db";
import { ACTIVE_DAYS, DeckError, swiper } from "@/lib/deckServer";

/** The 推荐池 has at least one distinct role assignment with mine. As in profile.passes(),
 *  an empty 想打的位置 means any role. Already-swiped members remain in this pool count;
 *  it is not a promise of new cards, rank compatibility, or passing my 牌堆筛选. */
export async function complementaryPoolCount() {
  const { me, prefs, db } = await swiper({ forSafety: true });
  if (me.suspendedAt) throw new DeckError(403, "你的账号因被举报暂停推荐，等待管理员处理", "suspended");
  const { members, memberPrefs, blocks } = schema;
  const positions = prefs?.positions ?? [];
  // With two roles (or any role), a distinct assignment is always possible. With one,
  // only someone who also wants solely that role cannot complement it.
  const complementary = positions.length === 1
    ? sql`${memberPrefs.positions} <> ARRAY[${positions[0]}]::text[]`
    : undefined;
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` })
    .from(members).innerJoin(memberPrefs, eq(memberPrefs.memberId, members.id))
    .where(and(eq(memberPrefs.recommendOptIn, true), isNull(members.suspendedAt),
      isNotNull(members.boundAt), isNotNull(members.puuid), isNotNull(members.riotId),
      gte(members.lastActiveAt, new Date(Date.now() - ACTIVE_DAYS * 86_400_000)),
      sql`${members.id} <> ${me.id}`, complementary,
      sql`not exists (select 1 from ${blocks} where
        (${blocks.fromMember} = ${me.id} and ${blocks.toMember} = ${members.id}) or
        (${blocks.toMember} = ${me.id} and ${blocks.fromMember} = ${members.id}))`));
  return { count, opted_in: prefs?.recommendOptIn ?? false };
}
