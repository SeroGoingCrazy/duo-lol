import type { Metadata } from "next";
import { desc, eq, inArray, isNotNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDb, schema } from "@/lib/db";
import { isAdmin, SUSPEND_AFTER } from "@/lib/deckServer";
import { getT } from "@/lib/lang";
import { dismissReports, restoreMember, suspendMember, unbindRiotId } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("管理") };
}
export const dynamic = "force-dynamic";

/** Report queue (PRD-v2 §8, M3), for the site's own admins, so its body stays in Chinese: open reports grouped by the reported 会员, plus everyone paused. */
export default async function AdminPage({ searchParams }: { searchParams: Promise<{ unbound?: string }> }) {
  const { unbound } = await searchParams;
  if (!(await isAdmin((await auth())?.user?.id))) notFound();
  const db = await getDb();
  const { members, reports } = schema;
  const open = await db.select().from(reports).where(eq(reports.status, "open")).orderBy(desc(reports.createdAt));
  const suspended = await db.select().from(members).where(isNotNull(members.suspendedAt));
  const ids = [...new Set([...open.map((r) => r.toMember), ...open.map((r) => r.fromMember)])];
  const names = new Map((ids.length ? await db.select().from(members).where(inArray(members.id, ids)) : [])
    .map((m) => [m.id, m.riotId ?? m.name ?? m.id]));
  const byTarget = new Map<string, typeof open>();
  for (const r of open) byTarget.set(r.toMember, [...(byTarget.get(r.toMember) ?? []), r]);
  const pausedIds = new Set(suspended.map((m) => m.id));
  const hidden = (id: string) => <input type="hidden" name="member" value={id} />;

  return (
    <>
      <h1 className="mb-1 text-2xl font-bold tracking-tight lg:text-3xl">管理</h1>
      <p className="mb-5 text-sm text-muted-foreground">被 {SUSPEND_AFTER} 名不同会员举报的人会自动暂停推荐，等你处理。</p>
      <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
        <Card data-testid="report-queue">
          <CardTitle>待处理举报 {byTarget.size}</CardTitle>
          {byTarget.size === 0 ? <p className="text-sm text-muted-foreground">没有待处理的举报。</p> : (
            <ul className="space-y-3">
              {[...byTarget].map(([target, rs]) => (
                <li key={target} className="rounded-lg border p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="font-medium">{names.get(target)}</span>
                    <span className="text-xs text-muted-foreground">{rs.length} 条{pausedIds.has(target) && " · 已暂停"}</span>
                  </div>
                  <ul className="mb-3 space-y-1 text-sm">
                    {rs.map((r) => <li key={r.id}><span className="text-muted-foreground">{names.get(r.fromMember)}：</span>{r.reason}</li>)}
                  </ul>
                  <div className="flex flex-wrap gap-2">
                    <form action={dismissReports}>{hidden(target)}<Button variant="outline">驳回</Button></form>
                    {!pausedIds.has(target) && <form action={suspendMember}>{hidden(target)}<Button variant="outline">暂停推荐</Button></form>}
                    {pausedIds.has(target) && <form action={restoreMember}>{hidden(target)}<Button variant="outline">恢复</Button></form>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card data-testid="suspended">
          <CardTitle>已暂停推荐 {suspended.length}</CardTitle>
          {suspended.length === 0 ? <p className="text-sm text-muted-foreground">没有被暂停的会员。</p> : (
            <ul className="space-y-2">
              {suspended.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                  <span>{m.riotId ?? m.name}</span>
                  <form action={restoreMember}>{hidden(m.id)}<Button variant="outline">恢复</Button></form>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card data-testid="unbind">
          <CardTitle>解除 Riot 绑定</CardTitle>
          <p className="mb-3 text-sm text-muted-foreground">绑定暂时不验证（ADR-0011）。有人说自己的 Riot ID 被别人绑了，核实后在这里解除，对方的会员资料保留。</p>
          <form action={unbindRiotId} className="flex flex-wrap gap-2">
            <Input name="riot_id" aria-label="要解除的 Riot ID" placeholder="Name#NA1" required autoComplete="off" className="min-w-0 flex-1" />
            <Button variant="outline">解除绑定</Button>
          </form>
          {unbound !== undefined && (
            <p className="mt-3 text-sm" role="status">{unbound ? `已解除 ${unbound} 的绑定，相关互选已取消。` : "没有会员绑定这个 Riot ID。"}</p>
          )}
        </Card>
      </div>
    </>
  );
}
