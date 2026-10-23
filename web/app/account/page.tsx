import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { BindRiotCard, DeleteAccountCard, PrefsCard } from "@/components/AccountForms";
import { Avatar, AvatarCard } from "@/components/ProfileIconPicker";
import FunnelEvent from "@/components/FunnelEvent";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDb, schema } from "@/lib/db";
import { avatarUrl } from "@/lib/profileIcons";
import { riotAccount } from "@/lib/riotAccount";
import { getT } from "@/lib/lang";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("我的账号") };
}

export default async function AccountPage() {
  const me = (await auth())?.user?.id;
  if (!me) redirect("/login");
  const t = await getT();
  const db = await getDb();
  const [member] = await db.select().from(schema.members).where(eq(schema.members.id, me));
  const [prefs] = await db.select().from(schema.memberPrefs).where(eq(schema.memberPrefs.memberId, me));
  const bound = !!member.boundAt;
  if (bound && member.avatarIconId == null) {
    // bound before 头像 existed (migration 0006): start from the in-game icon, as a new binding does
    const account = await riotAccount(member.riotId!).catch(() => null);
    if (account?.puuid === member.puuid) {
      member.avatarIconId = account.profile_icon_id;
      await db.update(schema.members).set({ avatarIconId: account.profile_icon_id }).where(eq(schema.members.id, me));
    }
  }
  const avatar = await avatarUrl(member.avatarIconId);
  const optedIn = !!prefs?.recommendOptIn;
  const ready = bound && optedIn && !member.suspendedAt;
  const step = !bound ? 1 : !optedIn ? 2 : 3;
  const steps = [
    { title: t("绑定 Riot 账号"), href: "#binding", done: bound },
    { title: t("偏好与推荐"), href: "#recommendation", done: bound && optedIn },
    { title: t("开始找搭子"), href: ready ? "/find" : null, done: false },
  ];

  return (
    <>
      <FunnelEvent event="account_viewed" />
      <div className="mb-5 flex items-center gap-4">
        <Avatar url={avatar} size={56} />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">{t("我的账号")}</h1>
          <p className="text-sm text-muted-foreground">{t("Discord：")}{member.name}{bound && <> · {member.riotId}</>}</p>
        </div>
      </div>
      <Card className="mb-5" data-testid="onboarding">
        <h2 className="text-lg font-semibold">{ready ? t("准备好了，去认识真实会员") : t("三步开始找搭子")}</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-3" aria-label={t("找搭子步骤")}>
          {steps.map((item, i) => (
            <li key={item.title} aria-current={step === i + 1 ? "step" : undefined}
              className="flex items-center gap-2 text-sm">
              <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${item.done ? "bg-good/15 text-good" : step === i + 1 ? "bg-neon-a/15 text-neon-a" : "bg-muted text-muted-foreground"}`}>
                {item.done ? <Check className="size-4" aria-label={t("已完成")} /> : i + 1}
              </span>
              {item.href ? <Link href={item.href} className="hover:underline">{item.title}</Link> : <span className="text-muted-foreground">{item.title}</span>}
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-muted-foreground">
          {member.suspendedAt ? t("你的账号因被举报暂停推荐，等待管理员处理。")
            : ready ? t("已开启被推荐。Riot ID 和联系方式只在互选后展示。")
            : !bound ? t("先绑定美服 Riot ID，再选择是否加入推荐池。头像和更多资料可以稍后完善。")
            : t("下一步：选择想打的位置，并明确同意被推荐；保存后即可和真实会员互滑。")}
        </p>
        {ready && <Button asChild className="mt-4"><Link href="/find">{t("开始找搭子")}<ArrowRight /></Link></Button>}
      </Card>
      <div className="space-y-4">
        <div id="binding" className="scroll-mt-6">
          <BindRiotCard riotId={bound ? member.riotId : null} verified={!!member.verifiedAt} />
        </div>
        <div id="recommendation" className="scroll-mt-6">
          <PrefsCard
            bound={bound}
            suspended={!!member.suspendedAt}
            prefs={prefs ?? { positions: [], recommendOptIn: false, showDiscord: false, notifyDiscord: false, bio: "", languages: [], voice: null, playTimes: [] }}
            discordName={member.name ?? ""}
          />
        </div>
      </div>
      <h2 className="mb-3 mt-8 text-sm font-semibold text-muted-foreground">{t("其他账号设置")}</h2>
      <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
        <AvatarCard current={member.avatarIconId} currentUrl={avatar} bound={bound} />
        <DeleteAccountCard />
      </div>
    </>
  );
}
