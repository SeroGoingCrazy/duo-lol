"use server";
// 管理员处理举报 (PRD-v2 M3): 驳回, 暂停推荐 (封号), 恢复; and 解绑 a Riot ID someone else bound (ADR-0011).
import { and, eq, isNotNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb, schema } from "@/lib/db";
import { riotIdKey } from "@/lib/api";
import { isAdmin, pause, releaseRiotAccount, unpause } from "@/lib/deckServer";

async function admin() {
  if (!(await isAdmin((await auth())?.user?.id))) throw new Error("not an admin");
  return getDb();
}

const memberOf = (form: FormData) => String(form.get("member") ?? "");

export async function dismissReports(form: FormData) {
  const db = await admin();
  await db.update(schema.reports).set({ status: "dismissed", handledAt: new Date() })
    .where(and(eq(schema.reports.toMember, memberOf(form)), eq(schema.reports.status, "open")));
  revalidatePath("/admin");
}

export async function suspendMember(form: FormData) {
  const db = await admin();
  const id = memberOf(form);
  const [target] = await db.select().from(schema.members).where(eq(schema.members.id, id));
  if (target) await pause(db, target);
  await db.update(schema.reports).set({ status: "suspended", handledAt: new Date() })
    .where(and(eq(schema.reports.toMember, id), eq(schema.reports.status, "open")));
  revalidatePath("/admin");
}

/** Back into the 推荐池; their open reports are closed as dismissed so they don't re-trigger the auto pause. */
export async function restoreMember(form: FormData) {
  const db = await admin();
  const id = memberOf(form);
  const [target] = await db.select().from(schema.members).where(eq(schema.members.id, id));
  if (target) await unpause(db, target);
  await db.update(schema.reports).set({ status: "dismissed", handledAt: new Date() })
    .where(and(eq(schema.reports.toMember, id), eq(schema.reports.status, "open")));
  revalidatePath("/admin");
}

/** 绑定 has no proof until RSO (ADR-0011), so when the real owner of a Riot ID asks, an admin frees it.
 *  The member who bound it keeps their membership (and any pause) but loses the account and its 互选.
 *  A pause they caused on the Riot account itself is lifted, since it belongs to the real owner. */
export async function unbindRiotId(form: FormData) {
  const db = await admin();
  const key = riotIdKey(String(form.get("riot_id") ?? ""));
  const bound = await db.select().from(schema.members).where(isNotNull(schema.members.riotId));
  const target = bound.find((m) => riotIdKey(m.riotId!) === key);
  if (target) {
    await releaseRiotAccount(db, target.id);
    await db.delete(schema.riotBans).where(eq(schema.riotBans.puuid, target.puuid!));
  }
  revalidatePath("/", "layout");
  redirect(`/admin?unbound=${encodeURIComponent(target ? target.riotId! : "")}`);
}
