"use client";
import { useState } from "react";
import { HeartHandshake } from "lucide-react";
import CopyButton from "@/components/CopyButton";
import PositionIcon from "@/components/PositionIcon";
import { type DeckCard } from "@/lib/api";
import { useT } from "@/components/LangProvider";
import { cn } from "@/lib/utils";

type Tab = "mutual" | "likes";

/** Secondary panel: 互选 reveals the Riot ID; 喜欢我的人 keeps it hidden. */
export default function DeckSidebar({ mutual, likes, onOpen, className, disabled = false, actions }: {
  mutual: DeckCard[];
  likes: DeckCard[];
  onOpen: (p: DeckCard) => void;      // put a 喜欢我的人 card on top of the 牌堆
  className?: string;
  disabled?: boolean;
  actions?: (p: DeckCard) => React.ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("mutual");
  const t = useT();
  const tabButton = (key: Tab, label: string, n: number) => (
    <button
      type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
      className={cn("cursor-pointer rounded-md px-3 py-1.5 text-sm transition-colors",
        tab === key ? "bg-accent font-semibold text-foreground" : "text-muted-foreground hover:text-foreground")}
    >
      {label} <span className="tabular-nums">{n}</span>
    </button>
  );
  const score = (p: DeckCard) => <span className="font-semibold tabular-nums">{p.score ?? "–"}{t.lang === "zh" && <span className="text-xs font-normal text-muted-foreground"> 分</span>}</span>;

  return (
    <aside className={cn("flex min-h-0 flex-col rounded-2xl border bg-card p-5", className)} data-testid="deck-sidebar">
      <h2 className="mb-4 flex items-center gap-2 font-semibold"><HeartHandshake className="size-5 text-primary" />{t("你的搭子")}</h2>
      <div className="flex gap-1" role="tablist">
        {tabButton("mutual", t("互选"), mutual.length)}
        {tabButton("likes", t("喜欢我的人"), likes.length)}
      </div>
      <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
        {tab === "mutual" && (
          mutual.length === 0
            ? <div className="rounded-xl bg-muted/60 px-4 py-7 text-center"><HeartHandshake className="mx-auto mb-3 size-8 text-muted-foreground/60" /><p className="mb-2 text-sm font-medium">{t("下一位搭子，等你发现")}</p><p className="text-xs leading-relaxed text-muted-foreground">{t("遇到合适的玩家就右滑喜欢。")}<br />{t("互选后，在这里找到 TA 的 Riot ID。")}</p></div>
            : <ul className="space-y-2" data-testid="mutual-list">
                {mutual.map((p) => (
                  <li key={p.id} className="rounded-lg border bg-background/40 p-3">
                    <div className="flex items-center gap-3">
                      <PositionIcon position={p.roles.b} size={22} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1"><span className="truncate font-medium">{p.riot_id}</span>{p.riot_id && <CopyButton text={p.riot_id} />}</div>
                        <div className="text-xs text-muted-foreground">{p.discord ? t("Discord：{name}", { name: p.discord }) : t.tier(p.tier, p.division)}</div>
                      </div>
                      {score(p)}
                    </div>
                    {actions && <div className="mt-2 flex flex-wrap gap-1 border-t pt-2">{actions(p)}</div>}
                  </li>
                ))}
              </ul>
        )}
        {tab === "likes" && (
          likes.length === 0
            ? <p className="text-sm text-muted-foreground">{t("暂时没有新的人喜欢你。")}</p>
            : <ul className="space-y-2" data-testid="likes-list">
                {likes.map((p) => (
                  <li key={p.id}>
                    <button type="button" disabled={disabled} onClick={() => onOpen(p)}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-lg border bg-background/40 p-3 text-left transition-colors hover:bg-accent disabled:opacity-50">
                      <PositionIcon position={p.roles.b} size={22} />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{t("{tier} 玩家", { tier: t.tier(p.tier, p.division) })}</div>
                        <div className="text-xs text-muted-foreground">{t("点开看卡片，右滑就互选")}</div>
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
