import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { BindRiotCard, DeleteAccountCard, PrefsCard } from "@/components/AccountForms";
import { Avatar, AvatarCard } from "@/components/ProfileIconPicker";
import { getDb, schema } from "@/lib/db";
import { avatarUrl } from "@/lib/profileIcons";
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
  const avatar = await avatarUrl(member.avatarIconId);

  return (
    <>
      <div className="mb-5 flex items-center gap-4">
        <Avatar url={avatar} size={56} />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">{t("我的账号")}</h1>
          <p className="text-sm text-muted-foreground">{t("Discord：")}{member.name}{bound && <> · {member.riotId}</>}</p>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
        <BindRiotCard riotId={bound ? member.riotId : null} verified={!!member.verifiedAt} />
        <AvatarCard current={member.avatarIconId} currentUrl={avatar} bound={bound} />
        <PrefsCard
          verified={bound}
          prefs={prefs ?? { positions: [], recommendOptIn: false, showDiscord: false, notifyDiscord: false, bio: "", languages: [], voice: null, playTimes: [] }}
          discordName={member.name ?? ""}
        />
        <DeleteAccountCard />
      </div>
    </>
  );
}
