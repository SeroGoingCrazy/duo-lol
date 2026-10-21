"use server";
// 管理员处理举报 (PRD-v2 M3): 驳回, 暂停推荐 (封号), 恢复.
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb, schema } from "@/lib/db";
import { isAdmin } from "@/lib/deckServer";

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
  await db.update(schema.members).set({ suspendedAt: new Date() }).where(eq(schema.members.id, id));
  await db.update(schema.reports).set({ status: "suspended", handledAt: new Date() })
    .where(and(eq(schema.reports.toMember, id), eq(schema.reports.status, "open")));
  revalidatePath("/admin");
}

/** Back into the 推荐池; their open reports are closed as dismissed so they don't re-trigger the auto pause. */
export async function restoreMember(form: FormData) {
  const db = await admin();
  const id = memberOf(form);
  await db.update(schema.members).set({ suspendedAt: null }).where(eq(schema.members.id, id));
  await db.update(schema.reports).set({ status: "dismissed", handledAt: new Date() })
    .where(and(eq(schema.reports.toMember, id), eq(schema.reports.status, "open")));
  revalidatePath("/admin");
}
