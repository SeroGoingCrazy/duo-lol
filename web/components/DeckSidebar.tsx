"use client";
import { useState } from "react";
import CopyButton from "@/components/CopyButton";
import PositionIcon from "@/components/PositionIcon";
import { type Partner } from "@/lib/api";
import { tierLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";

type Tab = "mutual" | "likes";

/** Left column: 互选 (Riot ID shown, PRD-v2 §3.3) and 喜欢我的人 (Riot ID still hidden). */
export default function DeckSidebar({ mutual, likes, onOpen, className }: {
  mutual: Partner[];
  likes: Partner[];
  onOpen: (p: Partner) => void;      // put a 喜欢我的人 card on top of the 牌堆
  className?: string;
}) {
  const [tab, setTab] = useState<Tab>("mutual");
  const tabButton = (key: Tab, label: string, n: number) => (
    <button
      type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
      className={cn("cursor-pointer rounded-md px-3 py-1.5 text-sm transition-colors",
        tab === key ? "bg-accent font-semibold text-foreground" : "text-muted-foreground hover:text-foreground")}
    >
      {label} <span className="tabular-nums">{n}</span>
    </button>
  );
  const score = (p: Partner) => <span className="font-semibold tabular-nums">{p.score ?? "–"}<span className="text-xs font-normal text-muted-foreground"> 分</span></span>;

  return (
    <aside className={cn("flex min-h-0 flex-col rounded-xl border bg-card p-5 shadow-sm", className)} data-testid="deck-sidebar">
      <div className="flex gap-1" role="tablist">
        {tabButton("mutual", "互选", mutual.length)}
        {tabButton("likes", "喜欢我的人", likes.length)}
      </div>
      <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
        {tab === "mutual" && (
          mutual.length === 0
            ? <p className="text-sm text-muted-foreground">还没有互选。双方都右滑喜欢后，会在这里看到对方的 Riot ID。</p>
            : <ul className="space-y-2" data-testid="mutual-list">
                {mutual.map((p) => (
                  <li key={p.riot_id} className="flex items-center gap-3 rounded-lg border bg-background/40 p-3">
                    <PositionIcon position={p.roles.b} size={22} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1"><span className="truncate font-medium">{p.riot_id}</span><CopyButton text={p.riot_id} /></div>
                      <div className="text-xs text-muted-foreground">{tierLabel(p.tier, p.division)}</div>
                    </div>
                    {score(p)}
                  </li>
                ))}
              </ul>
        )}
        {tab === "likes" && (
          likes.length === 0
            ? <p className="text-sm text-muted-foreground">暂时没有新的人喜欢你。</p>
            : <ul className="space-y-2" data-testid="likes-list">
                {likes.map((p) => (
                  <li key={p.riot_id}>
                    <button type="button" onClick={() => onOpen(p)}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-lg border bg-background/40 p-3 text-left transition-colors hover:bg-accent">
                      <PositionIcon position={p.roles.b} size={22} />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{tierLabel(p.tier, p.division)} 玩家</div>
                        <div className="text-xs text-muted-foreground">点开看卡片，右滑就互选</div>
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
