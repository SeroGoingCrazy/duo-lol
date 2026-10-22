// 找搭子: a bound 会员 who 同意被推荐 swipes real 会员 (PRD-v2 §3.2); everyone else gets the demo (ADR-0008).
import Link from "next/link";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import DemoDeck from "@/components/DemoDeck";
import MemberDeck from "@/components/MemberDeck";
import { getDb, schema } from "@/lib/db";
import { getT } from "@/lib/lang";

export const dynamic = "force-dynamic";

export default async function FindPage() {
  const id = (await auth())?.user?.id;
  const t = await getT();
  if (!id) {
    return <DemoDeck notice={<>{t("这是演示版：牌堆来自已收录的玩家，对方的喜欢是模拟的。")}<Link href="/login">{t("登录")}</Link>{t("并绑定 Riot 账号后，就能和真实会员互滑。")}</>} />;
  }
  const db = await getDb();
  const [row] = await db.select().from(schema.members).leftJoin(schema.memberPrefs, eq(schema.memberPrefs.memberId, schema.members.id))
    .where(eq(schema.members.id, id));
  const me = row?.members;
  if (me?.boundAt && me.riotId && row.member_prefs?.recommendOptIn && !me.suspendedAt) return <MemberDeck riotId={me.riotId} />;
  const missing = me?.suspendedAt ? t("你的账号因被举报暂停推荐，等待管理员处理。")
    : !me?.boundAt ? t("先在我的账号里绑定 Riot 账号，")
    : t("先在我的账号里开启“同意被推荐”，");
  return <DemoDeck notice={<>{t("这是演示版。")}{missing}{!me?.suspendedAt && <><Link href="/account">{t("去我的账号")}</Link>{t("，完成后就能和真实会员互滑。")}</>}</>} />;
}
