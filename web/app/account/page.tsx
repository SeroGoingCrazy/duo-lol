import type { Metadata } from "next";
import { readFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { BindRiotCard, DeleteAccountCard, PrefsCard } from "@/components/AccountForms";
import { getDb, schema } from "@/lib/db";
import { getT } from "@/lib/lang";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("我的账号") };
}

// Summoner icons come from Data Dragon at the same patch as the vendored champion icons.
const DDRAGON_VERSION = readFileSync(path.join(process.cwd(), "public", "champions", "VERSION"), "utf8").trim();
const iconUrl = (id: number) => `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/${id}.png`;

export default async function AccountPage() {
  const me = (await auth())?.user?.id;
  if (!me) redirect("/login");
  const t = await getT();
  const db = await getDb();
  const [member] = await db.select().from(schema.members).where(eq(schema.members.id, me));
  const [challenge] = await db.select().from(schema.verificationChallenges).where(eq(schema.verificationChallenges.memberId, me));
  const [prefs] = await db.select().from(schema.memberPrefs).where(eq(schema.memberPrefs.memberId, me));
  const pending = challenge && challenge.expiresAt > new Date()
    ? { riotId: challenge.riotId, iconId: challenge.iconId, iconUrl: iconUrl(challenge.iconId) }
    : null;

  return (
    <>
      <h1 className="mb-1 text-2xl font-bold tracking-tight lg:text-3xl">{t("我的账号")}</h1>
      <p className="mb-5 text-sm text-muted-foreground">{t("Discord：")}{member.name}</p>
      <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
        <BindRiotCard riotId={member.verifiedAt ? member.riotId : null} pending={pending} />
        <PrefsCard
          verified={!!member.verifiedAt}
          prefs={prefs ?? { positions: [], recommendOptIn: false, showDiscord: false, notifyDiscord: false, bio: "", languages: [], voice: null, playTimes: [] }}
          discordName={member.name ?? ""}
        />
        <DeleteAccountCard />
      </div>
    </>
  );
}
