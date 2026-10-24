import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import WelcomeForm from "@/components/WelcomeForm";
import { getDb, schema } from "@/lib/db";
import { getT } from "@/lib/lang";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("完成两步，开始找搭子") };
}

/** After 绑定, choose roles and explicitly consent before entering the 推荐池. */
export default async function WelcomePage() {
  const id = (await auth())?.user?.id;
  if (!id) redirect("/login");
  const db = await getDb();
  const [row] = await db.select().from(schema.members)
    .leftJoin(schema.memberPrefs, eq(schema.memberPrefs.memberId, schema.members.id))
    .where(eq(schema.members.id, id));
  if (!row?.members.boundAt || !row.members.riotId) redirect("/account#binding");
  if (row.members.suspendedAt) redirect("/account");
  const t = await getT();

  return (
    <div className="mx-auto max-w-xl py-4 sm:py-8">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("完成两步，开始找搭子")}</h1>
      <p className="mb-6 mt-2 text-sm text-muted-foreground">
        {t("绑定成功")} · <span data-testid="bound-riot-id">{row.members.riotId}</span>
      </p>
      <WelcomeForm positions={row.member_prefs?.positions ?? []} alreadyJoined={!!row.member_prefs?.recommendOptIn} />
    </div>
  );
}
