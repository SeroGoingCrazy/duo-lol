import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { BindRiotCard, DeleteAccountCard, PrefsCard } from "@/components/AccountForms";
import { Avatar, AvatarCard } from "@/components/ProfileIconPicker";
import FunnelEvent from "@/components/FunnelEvent";
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
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <div className="min-w-0 space-y-4" data-testid="account-preferences-column">
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
        <div className="min-w-0 space-y-4" data-testid="account-settings-column">
          <AvatarCard current={member.avatarIconId} currentUrl={avatar} bound={bound} />
          <DeleteAccountCard />
        </div>
      </div>
    </>
  );
}
