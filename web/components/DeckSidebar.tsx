"use client";
import { useId, useState } from "react";
import { HeartHandshake } from "lucide-react";
import Link from "next/link";
import CopyButton from "@/components/CopyButton";
import { RiotVerifiedBadge } from "@/components/AccountForms";
import { Avatar } from "@/components/ProfileIconPicker";
import PositionIcon from "@/components/PositionIcon";
import { playerPath, type DeckCard } from "@/lib/api";
import { useT } from "@/components/LangProvider";
import { cn } from "@/lib/utils";

type Tab = "mutual" | "likes";

/** Secondary panel: 互选 reveals the Riot ID; 喜欢我的人 keeps it hidden. */
export default function DeckSidebar({ mutual, likes, onOpen, className, disabled = false, actions, demo = false }: {
  mutual: DeckCard[];
  likes: DeckCard[];
  onOpen: (p: DeckCard) => void;      // put a 喜欢我的人 card on top of the 牌堆
  className?: string;
  disabled?: boolean;
  actions?: (p: DeckCard) => React.ReactNode;
  demo?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("mutual");
  const [mobileOpen, setMobileOpen] = useState(false);
  const panelId = useId();
  const t = useT();
  const tabButton = (key: Tab, label: string, n: number, mobile = false) => (
    <button
      type="button" role={mobile ? undefined : "tab"} aria-selected={mobile ? undefined : tab === key}
      aria-expanded={mobile ? mobileOpen && tab === key : undefined} aria-controls={panelId}
      onClick={() => { setTab(key); setMobileOpen((open) => tab !== key || !open); }}
      className={cn("cursor-pointer rounded-full border bg-card px-3 py-1.5 text-xs transition-colors lg:rounded-md lg:border-0 lg:text-sm",
        tab === key ? "bg-accent font-semibold text-foreground" : "text-muted-foreground hover:text-foreground")}
    >
      {label} <span className="tabular-nums">{n}</span>
    </button>
  );
  const score = (p: DeckCard) => <span className="font-semibold tabular-nums">{p.score ?? "–"}{t.lang === "zh" && <span className="text-xs font-normal text-muted-foreground"> 分</span>}</span>;

  return (
    <aside className={cn("flex min-h-0 flex-col rounded-2xl lg:border lg:bg-card lg:p-5", className)} data-testid="deck-sidebar">
      <h2 className="mb-4 hidden items-center gap-2 font-semibold lg:flex"><HeartHandshake className="size-5 text-primary" />{demo ? (t.lang === "zh" ? "模拟互动" : "Simulated activity") : t("你的搭子")}</h2>
      {demo && <p className="mb-3 hidden text-xs text-muted-foreground lg:block">{t.lang === "zh" ? "下方全部为演示记录，不代表对方的真实意愿。" : "All activity below is simulated and does not reflect these players’ intent."}</p>}
      <div className="flex justify-center gap-2 lg:hidden" role="group" aria-label={t("你的搭子")} data-testid="deck-counts">
        {tabButton("mutual", demo ? t("模拟互选") : t("互选"), mutual.length, true)}
        {tabButton("likes", demo ? t("模拟喜欢") : t("喜欢我的人"), likes.length, true)}
      </div>
      <div className="hidden gap-1 lg:flex" role="tablist" aria-label={t("你的搭子")}>
        {tabButton("mutual", demo ? (t.lang === "zh" ? "模拟互选" : "Demo matches") : t("互选"), mutual.length)}
        {tabButton("likes", demo ? (t.lang === "zh" ? "模拟喜欢" : "Demo likes") : t("喜欢我的人"), likes.length)}
      </div>
      <div id={panelId} role="tabpanel" className={cn("mt-2 min-h-0 flex-1 overflow-y-auto rounded-xl border bg-card p-3 lg:mt-4 lg:block lg:rounded-none lg:border-0 lg:p-0", mobileOpen ? "block" : "hidden")}>
        {tab === "mutual" && (
          mutual.length === 0
            ? <div className="rounded-xl bg-muted/60 px-4 py-7 text-center"><HeartHandshake className="mx-auto mb-3 size-8 text-muted-foreground/60" /><p className="mb-2 text-sm font-medium">{demo ? (t.lang === "zh" ? "试试右滑，体验模拟互选" : "Swipe right to try a demo match") : t("下一位搭子，等你发现")}</p>{!demo && <p className="text-xs leading-relaxed text-muted-foreground">{t("遇到合适的玩家就右滑喜欢。")}<br />{t("互选后，在这里找到 TA 的 Riot ID。")}</p>}</div>
            : <ul className="space-y-2" data-testid="mutual-list">
                {mutual.map((p) => (
                  <li key={p.id} className="rounded-lg border bg-background/40 p-3">
                    <div className="flex items-center gap-3">
                      {p.avatar !== undefined && <Avatar url={p.avatar} size={36} />}
                      <PositionIcon position={p.roles.b} size={22} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">{demo ? <span className="font-medium">{t.lang === "zh" ? "演示候选" : "Demo candidate"}</span> : <>{p.riot_id ? <Link href={playerPath(p.riot_id)} className="truncate font-medium text-foreground">{p.riot_id}</Link> : null}{p.riot_id && <CopyButton text={p.riot_id} />}{p.riot_verified === false && <RiotVerifiedBadge verified={false} />}</>}</div>
                        <div className="text-xs text-muted-foreground">{!demo && p.discord ? t("Discord：{name}", { name: p.discord }) : t.tier(p.tier, p.division)}</div>
                      </div>
                      {score(p)}
                    </div>
                    {p.duo_record && (
                      <div className="mt-2 text-xs text-muted-foreground" data-testid="duo-record">
                        {p.duo_record.games > 0
                          ? t("本赛季一起打了 {n} 局，赢 {w} 局", { n: p.duo_record.games, w: p.duo_record.wins })
                          : t("还没一起打过单双排")}
                      </div>
                    )}
                    {actions && <div className="mt-2 flex flex-wrap gap-1 border-t pt-2">{actions(p)}</div>}
                  </li>
                ))}
              </ul>
        )}
        {tab === "likes" && (
          likes.length === 0
            ? <p className="text-sm text-muted-foreground">{demo ? (t.lang === "zh" ? "暂无模拟喜欢。" : "No simulated likes.") : t("暂时没有新的人喜欢你。")}</p>
            : <ul className="space-y-2" data-testid="likes-list">
                {likes.map((p) => (
                  <li key={p.id}>
                    <button type="button" disabled={disabled} onClick={() => { onOpen(p); setMobileOpen(false); }}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-lg border bg-background/40 p-3 text-left transition-colors hover:bg-accent disabled:opacity-50">
                      <PositionIcon position={p.roles.b} size={22} />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{t("{tier} 玩家", { tier: t.tier(p.tier, p.division) })}</div>
                        <div className="text-xs text-muted-foreground">{demo ? (t.lang === "zh" ? "点开体验模拟互选" : "Open to try a simulated match") : t("点开看卡片，右滑就互选")}</div>
                      </div>
                      {score(p)}
                    </button>
                  </li>
                ))}
              </ul>
        )}
      </div>
    </aside>
  );
}
