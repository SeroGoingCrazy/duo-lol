"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Heart, RotateCcw, X } from "lucide-react";
import CopyButton from "@/components/CopyButton";
import DeckSidebar from "@/components/DeckSidebar";
import SwipeCard from "@/components/SwipeCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { DeckCard } from "@/lib/api";
import type { ChampionInfo } from "@/lib/champions";
import type { Swipe } from "@/lib/deck";
import { tierLabel } from "@/lib/labels";

/** The 牌堆 on screen, shared by the demo (ADR-0008) and the 会员 deck: card, buttons, keys, sidebar, 互选 dialog.
 *  The parent owns the data; onSwipe resolves to the 互选 card (with Riot ID) when a 喜欢 made one. */
export default function DeckStage({ remaining, total, mutual, likes, info, canUndo, onSwipe, onUndo, empty, cardActions, mutualActions, paused = false }: {
  remaining: DeckCard[];
  total: number;
  mutual: DeckCard[];
  likes: DeckCard[];
  info: Record<string, ChampionInfo>;
  canUndo: boolean;
  onSwipe: (c: DeckCard, s: Swipe) => Promise<DeckCard | null>;
  onUndo: () => Promise<string | null>;   // the card id to bring back on top
  empty: React.ReactNode;
  cardActions?: (c: DeckCard) => React.ReactNode;     // 拉黑 / 举报 under the buttons
  mutualActions?: (c: DeckCard) => React.ReactNode;   // 取消互选 / 拉黑 / 举报 in the 互选 list
  paused?: boolean;                                    // a dialog of the parent's is open: arrow keys do nothing
}) {
  const [focus, setFocus] = useState<string | null>(null);   // a card opened from 喜欢我的人 or brought back by 撤销
  const [fling, setFling] = useState<Swipe | null>(null);
  const [matched, setMatched] = useState<DeckCard | null>(null);
  const likeIds = new Set(likes.map((c) => c.id));
  const top = (focus && remaining.find((c) => c.id === focus)) || remaining[0] || null;
  const behind = remaining.find((c) => c !== top) ?? null;

  async function swiped(s: Swipe) {
    if (!top) return;
    const c = top;
    setFling(null);
    setFocus(null);
    const match = await onSwipe(c, s);
    if (match) setMatched(match);
  }

  async function undo() {
    if (fling) return;
    const id = await onUndo();
    if (id) setFocus(id);
  }

  // ← 跳过, → 喜欢, as on Tinder's web app; not while typing in a field
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!top || fling || matched || paused || e.repeat || e.altKey || e.ctrlKey || e.metaKey || (e.target as HTMLElement).closest("input, textarea, select, button, a, [contenteditable], [role=combobox], [role=tab], [role=dialog]")) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        setFling(e.key === "ArrowLeft" ? "pass" : "like");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [top, fling, matched, paused]);

  return (
    <>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start" data-testid="deck">
        <div className="swipe-stage min-w-0 rounded-3xl px-2 pb-5 pt-4 sm:px-6">
          <div className="mx-auto mb-4 flex max-w-[30rem] items-center justify-between px-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">为你推荐 <span className="ml-2 font-normal text-muted-foreground">按预测胜率排序</span></span>
            <span aria-live="polite">剩余 {remaining.length} / {total}</span>
          </div>
          <div className="relative mx-auto h-[33rem] max-w-[30rem] sm:h-[35rem]">
            {top ? (
              <>
                {behind && <><div className="absolute inset-x-6 inset-y-0 translate-y-4 rounded-3xl border bg-card opacity-40" aria-hidden /><div className="absolute inset-x-3 inset-y-0 translate-y-2 rounded-3xl border bg-card opacity-80" aria-hidden /></>}
                <div className="absolute inset-0">
                  <SwipeCard key={top.id} p={top} info={info} fling={fling} onSwipeStart={setFling} onSwiped={swiped} likesYou={likeIds.has(top.id)} />
                </div>
              </>
            ) : (
              <Card className="flex h-full flex-col items-center justify-center gap-3 text-center" data-testid="deck-empty">{empty}</Card>
            )}
          </div>

          <div className="mt-7 flex items-end justify-center gap-7" data-testid="gamepad">
            <div className="flex flex-col items-center gap-2">
            <Button variant="outline" className="size-12 rounded-full bg-card p-0 text-muted-foreground" aria-label="撤销上一次跳过" disabled={!canUndo || !!fling} onClick={undo}>
              <RotateCcw className="size-5!" />
            </Button>
            <span className="text-xs text-muted-foreground">撤销</span>
            </div>
            <div className="flex flex-col items-center gap-2">
            <Button variant="outline" className="size-16 rounded-full bg-card p-0 shadow-sm hover:border-bad/40 hover:bg-bad/10 hover:text-bad" aria-label="跳过" disabled={!top || !!fling} onClick={() => setFling("pass")}>
              <X className="size-7!" />
            </Button>
            <span className="text-xs text-muted-foreground">跳过</span>
            </div>
            <div className="flex flex-col items-center gap-2">
            <Button className="size-16 rounded-full bg-good p-0 text-white shadow-lg shadow-good/20 hover:bg-good/90" aria-label="喜欢" disabled={!top || !!fling} onClick={() => setFling("like")}>
              <Heart className="size-7!" />
            </Button>
            <span className="text-xs text-muted-foreground">喜欢</span>
            </div>
          </div>
          <p className="mt-5 flex items-center justify-center gap-2 text-[11px] text-muted-foreground"><ArrowLeft className="size-3" /> 左滑跳过 <span className="mx-1">·</span> 右滑喜欢 <ArrowRight className="size-3" /><span className="hidden sm:inline">，也可使用方向键</span></p>
          {top && cardActions && <div className="mt-2 flex justify-center gap-1">{cardActions(top)}</div>}
        </div>
        <DeckSidebar className="max-h-96 lg:mt-12 lg:max-h-[35rem]" mutual={mutual} likes={likes} disabled={!!fling}
          onOpen={(c) => { if (!fling) setFocus(c.id); }} actions={mutualActions} />
      </div>

      {matched && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="match-title" data-testid="match-dialog">
          <Card className="w-full max-w-sm space-y-4 text-center">
            <h2 id="match-title" className="text-2xl font-bold text-good">互选成功</h2>
            <p className="text-sm text-muted-foreground">你们互相喜欢了。在游戏客户端里加对方好友，一起排位吧。</p>
            <div className="space-y-1">
              <div className="text-lg font-semibold" data-testid="match-riot-id">{matched.riot_id}</div>
              {matched.discord && <div className="text-sm" data-testid="match-discord">Discord：{matched.discord}</div>}
              <div className="text-xs text-muted-foreground">{tierLabel(matched.tier, matched.division)} · 搭配评分 {matched.score ?? "–"}</div>
            </div>
            <div className="flex justify-center gap-2">
              {matched.riot_id && <CopyButton text={matched.riot_id} />}
              <Button autoFocus onClick={() => setMatched(null)}>继续滑</Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
