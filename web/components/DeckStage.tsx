"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight, Heart, RotateCcw, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import CopyButton from "@/components/CopyButton";
import DeckSidebar from "@/components/DeckSidebar";
import SwipeCard from "@/components/SwipeCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { DeckCard } from "@/lib/api";
import { trackFunnel } from "@/lib/analytics";
import type { ChampionInfo } from "@/lib/champions";
import type { Swipe } from "@/lib/deck";
import { useT } from "@/components/LangProvider";

/** The 牌堆 on screen, shared by the demo (ADR-0008) and the 会员 deck: card, buttons, keys, sidebar, 互选 dialog.
 *  The parent owns the data; onSwipe resolves to the 互选 card (with Riot ID) when a 喜欢 made one. */
export default function DeckStage({ remaining, total, mutual, likes, info, canUndo, onSwipe, onUndo, empty, cardActions, mutualActions, paused = false, demo = false }: {
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
  demo?: boolean;                                      // simulated activity must never look like a real member response
}) {
  const t = useT();
  const still = useReducedMotion();
  const [focus, setFocus] = useState<string | null>(null);   // a card opened from 喜欢我的人 or brought back by 撤销
  const [fling, setFling] = useState<Swipe | null>(null);
  const [matched, setMatched] = useState<DeckCard | null>(null);
  const cardArea = useRef<HTMLDivElement>(null);
  const visibleCard = useRef<HTMLDivElement>(null);
  const firstCardViewed = useRef(false);
  const [cardTop, setCardTop] = useState<number>();
  const likeIds = new Set(likes.map((c) => c.id));
  const top = (focus && remaining.find((c) => c.id === focus)) || remaining[0] || null;
  const behind = remaining.find((c) => c !== top) ?? null;

  // A loaded response is not an impression: wait for a real card in a visible tab's viewport.
  useEffect(() => {
    const card = visibleCard.current;
    if (!top || !card || firstCardViewed.current || paused || matched) return;
    const observer = new IntersectionObserver((entries) => {
      if (firstCardViewed.current || document.visibilityState !== "visible") return;
      if (!entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.01)) return;
      firstCardViewed.current = true;
      trackFunnel("first_card_viewed", demo ? "demo" : "member");
      observer.disconnect();
    }, { threshold: 0.01 });
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible" || firstCardViewed.current) return;
      // Ask for fresh geometry: the page may have moved while its tab was hidden.
      observer.unobserve(card);
      observer.observe(card);
    };
    observer.observe(card);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [top?.id, demo, paused, matched]);

  // Reserve the real header and controls; dvh also follows mobile browser chrome.
  // Use document coordinates so scrolling does not resize the card under a finger.
  useEffect(() => {
    const area = cardArea.current;
    if (!area) return;
    const fit = () => {
      const top = area.getBoundingClientRect().top + window.scrollY;
      setCardTop(top);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(area.parentElement!.parentElement!);
    window.addEventListener("resize", fit);
    return () => { observer.disconnect(); window.removeEventListener("resize", fit); };
  }, []);

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
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-8" data-testid="deck">
        <div className="swipe-stage min-w-0 rounded-3xl px-1 pb-3 pt-2 sm:px-6 sm:pb-5 sm:pt-4">
          <div className="mx-auto mb-2 flex max-w-[30rem] items-center justify-between px-1 text-xs text-muted-foreground sm:mb-4">
            <span className="font-medium text-foreground">{t("为你推荐")} <span className="ml-2 font-normal text-muted-foreground">{t("按预测胜率排序")}</span></span>
            <span aria-live="polite">{t("剩余 {n} / {total}", { n: remaining.length, total })}</span>
          </div>
          <div ref={cardArea} className="relative mx-auto h-[clamp(19rem,calc(100dvh-var(--deck-top,16rem)-8rem),35rem)] max-w-[30rem] sm:h-[clamp(19rem,calc(100dvh-var(--deck-top,16rem)-10rem),35rem)]"
            style={{ "--deck-top": cardTop == null ? undefined : `${cardTop}px` } as CSSProperties}>
            {top ? (
              <>
                {behind && <><div className="absolute inset-x-6 inset-y-0 translate-y-4 rounded-3xl border bg-card opacity-40" aria-hidden /><div className="absolute inset-x-3 inset-y-0 translate-y-2 rounded-3xl border bg-card opacity-80" aria-hidden /></>}
                <div ref={visibleCard} className="absolute inset-0">
                  <SwipeCard key={top.id} p={top} info={info} fling={fling} onSwipeStart={setFling} onSwiped={swiped} likesYou={likeIds.has(top.id)} demo={demo} />
                </div>
              </>
            ) : (
              <Card className="flex h-full flex-col items-center justify-center gap-3 text-center" data-testid="deck-empty">{empty}</Card>
            )}
          </div>

          <div className="sticky bottom-0 z-10 mt-3 flex items-end justify-center gap-7 bg-background/95 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:static sm:mt-5 sm:bg-transparent sm:py-0" data-testid="gamepad">
            <div className="flex flex-col items-center gap-1 sm:gap-2">
            <Button variant="outline" className="size-10 rounded-full bg-card p-0 text-muted-foreground sm:size-12" aria-label={t("撤销上一次跳过")} disabled={!canUndo || !!fling} onClick={undo}>
              <RotateCcw className="size-5!" />
            </Button>
            <span className="text-xs text-muted-foreground">{t("撤销")}</span>
            </div>
            <div className="flex flex-col items-center gap-1 sm:gap-2">
            <Button variant="outline" className="size-12 rounded-full bg-card p-0 hover:border-bad/40 hover:bg-bad/10 hover:text-bad sm:size-16" aria-label={t("跳过")} disabled={!top || !!fling} onClick={() => setFling("pass")}>
              <X className="size-7!" />
            </Button>
            <span className="text-xs text-muted-foreground">{t("跳过")}</span>
            </div>
            <div className="flex flex-col items-center gap-1 sm:gap-2">
            <Button className="size-12 rounded-full bg-good bg-none p-0 text-good-foreground shadow-[0_0_28px_-4px_var(--good)] hover:bg-good/90 sm:size-16" aria-label={t("喜欢")} disabled={!top || !!fling} onClick={() => setFling("like")}>
              <Heart className="size-7!" />
            </Button>
            <span className="text-xs text-muted-foreground">{t("喜欢")}</span>
            </div>
          </div>
          <p className="mt-3 hidden items-center justify-center gap-2 text-[11px] text-muted-foreground sm:flex"><ArrowLeft className="size-3" /> {t("左滑跳过")} <span className="mx-1">·</span> {t("右滑喜欢")} <ArrowRight className="size-3" /><span>{t("，也可使用方向键")}</span></p>
          {top && cardActions && <div className="mt-2 flex justify-center gap-1">{cardActions(top)}</div>}
        </div>
        <DeckSidebar className="order-first max-h-96 lg:order-last lg:mt-12 lg:max-h-[35rem]" mutual={mutual} likes={likes} disabled={!!fling} demo={demo}
          onOpen={(c) => { if (!fling) setFocus(c.id); }} actions={mutualActions} />
      </div>

      {matched && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="match-title" data-testid="match-dialog">
          <motion.div className="w-full max-w-sm" initial={still ? false : { opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}>
          <Card className="space-y-4 text-center">
            <h2 id="match-title" className="text-neon text-3xl font-bold">{demo ? (t.lang === "zh" ? "模拟互选" : "Demo match") : t("互选成功")}</h2>
            <p className="text-sm text-muted-foreground">{demo
              ? (t.lang === "zh" ? "这是演示效果，对方没有向你表达喜欢，也不会收到通知。注册并加入推荐池后才能与会员真实互选。" : "This is a simulation. This player has not liked you and receives no notification. Join the member pool to make real matches.")
              : t("你们互相喜欢了。在游戏客户端里加对方好友，一起排位吧。")}</p>
            <div className="space-y-1">
              {!demo && <div className="text-lg font-semibold" data-testid="match-riot-id">{matched.riot_id}</div>}
              {!demo && matched.discord && <div className="text-sm" data-testid="match-discord">{t("Discord：{name}", { name: matched.discord })}</div>}
              <div className="text-xs text-muted-foreground">{t.tier(matched.tier, matched.division)} · {t("搭配评分")} {matched.score ?? "–"}</div>
            </div>
            <div className="flex justify-center gap-2">
              {!demo && matched.riot_id && <CopyButton text={matched.riot_id} />}
              <Button autoFocus onClick={() => setMatched(null)}>{t("继续滑")}</Button>
            </div>
          </Card>
          </motion.div>
        </div>
      )}
    </>
  );
}
