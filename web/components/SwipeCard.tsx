"use client";
import { useEffect, useRef, useState } from "react";
import ChampionPairTable from "@/components/ChampionPairTable";
import PositionIcon from "@/components/PositionIcon";
import ScoreBadge, { ScoreHelp, scoreSummary } from "@/components/ScoreBadge";
import { Badge } from "@/components/ui/badge";
import { CardTitle } from "@/components/ui/card";
import { pct, points, type Partner } from "@/lib/api";
import type { ChampionInfo } from "@/lib/champions";
import type { Swipe } from "@/lib/deck";
import { POSITION_LABELS, positionLabel, tierLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";

// A drag past this share of the card's width (or a quick flick) counts as a swipe; less springs back.
const SWIPE_SHARE = 0.25;
const FLICK_PX_PER_MS = 0.6;
const PAGES = ["搭配评分", "英雄组合", "理由"];

/** The model's 理由 name positions and champions by their Riot ids; show them in Chinese. */
function localizeReason(text: string, info: Record<string, ChampionInfo>, champions: string[]) {
  let out = text.replace(/\b(TOP|JUNGLE|MIDDLE|BOTTOM|UTILITY)\b/g, (code) => POSITION_LABELS[code] ?? code);
  for (const c of champions) if (info[c]) out = out.replaceAll(c, info[c].name);
  return out;
}

/** 卡片 (CONTEXT.md): three pages flipped like Tinder's photos. Riot ID stays hidden until 互选. */
export default function SwipeCard({ p, info, fling, onSwiped, likesYou = false }: {
  p: Partner;
  info: Record<string, ChampionInfo>;
  fling: Swipe | null;               // set by the buttons or arrow keys to throw the card out
  onSwiped: (s: Swipe) => void;
  likesYou?: boolean;
}) {
  const [page, setPage] = useState(0);
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState<Swipe | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; t: number; moved: boolean } | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const up = p.win_rate_delta >= 0;

  function leave(s: Swipe) {
    if (leaving) return;
    setLeaving(s);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => onSwiped(s), reduced ? 0 : 220);
  }

  useEffect(() => { if (fling) leave(fling); }, [fling]);   // eslint-disable-line react-hooks/exhaustive-deps

  function onPointerDown(e: React.PointerEvent) {
    if (leaving) return;
    drag.current = { x: e.clientX, t: e.timeStamp, moved: false };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const d = e.clientX - drag.current.x;
    if (Math.abs(d) > 6) drag.current.moved = true;
    setDx(d);
  }

  function onPointerUp(e: React.PointerEvent) {
    const start = drag.current;
    drag.current = null;
    setDragging(false);
    if (!start) return;
    const width = card.current?.offsetWidth ?? 400;
    const d = e.clientX - start.x;
    const speed = Math.abs(d) / Math.max(1, e.timeStamp - start.t);
    if (start.moved && (Math.abs(d) > width * SWIPE_SHARE || speed > FLICK_PX_PER_MS)) {
      leave(d > 0 ? "like" : "pass");
      return;
    }
    setDx(0);
    if (!start.moved) {
      // a tap on the left or right half flips the page, like Tinder's photos
      const rect = card.current!.getBoundingClientRect();
      const right = e.clientX - rect.left > rect.width / 2;
      setPage((n) => Math.min(PAGES.length - 1, Math.max(0, n + (right ? 1 : -1))));
    }
  }

  const x = leaving ? (leaving === "like" ? 1 : -1) * 1.5 * (card.current?.offsetWidth ?? 400) : dx;
  const hint = leaving ?? (dx > 20 ? "like" : dx < -20 ? "pass" : null);
  const hintOpacity = leaving ? 1 : Math.min(1, Math.abs(dx) / 120);
  const best = p.top_pairs[0];

  return (
    <div
      ref={card}
      data-testid="swipe-card"
      className={cn(
        "relative flex h-full select-none flex-col rounded-xl border bg-card p-5 shadow-sm touch-pan-y",
        dragging ? "" : "transition-transform duration-200 ease-out motion-reduce:transition-none",
      )}
      style={{ transform: `translateX(${x}px) rotate(${x / 40}deg)` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { drag.current = null; setDragging(false); setDx(0); }}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1" data-testid="card-page">
          {PAGES.map((name, i) => (
            <button
              key={name} type="button" aria-pressed={i === page}
              onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onClick={() => setPage(i)}
              className={cn("cursor-pointer rounded-md px-3 py-1.5 text-sm transition-colors",
                i === page ? "bg-accent font-semibold text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge>{tierLabel(p.tier, p.division)}</Badge>
          {likesYou && <Badge className="bg-good/15 text-good">喜欢了你</Badge>}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {page === 0 && (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-sm text-muted-foreground">搭配评分 <ScoreHelp /></div>
                <ScoreBadge score={p.score} />
                {p.score != null && <div className="mt-2 text-sm text-muted-foreground">{scoreSummary(p.score)}</div>}
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">预测胜率</div>
                <div className="win-rate text-2xl font-semibold tabular-nums">{pct(p.win_rate)}</div>
                <div className={cn("text-sm", up ? "text-good" : "text-bad")}>比单排平均{up ? "高" : "低"} {points(p.win_rate_delta)}</div>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2" data-testid="card-roles">
              {([["你", p.roles.a], ["TA", p.roles.b]] as const).map(([who, role]) => (
                <div key={who} className="min-w-0 rounded-lg border bg-background/40 p-3">
                  <div className="text-xs text-muted-foreground">{who}打</div>
                  <div className="mt-1 font-semibold"><PositionIcon position={role} showLabel /></div>
                </div>
              ))}
            </div>
            <span className="sr-only">你打{positionLabel(p.roles.a)}，TA 打{positionLabel(p.roles.b)}</span>
          </>
        )}
        {page === 1 && (
          <>
            <CardTitle>建议位置和最佳英雄组合</CardTitle>
            <ChampionPairTable a="你" b="TA" roles={p.roles} pairs={p.top_pairs} info={info} />
          </>
        )}
        {page === 2 && (
          <>
            <CardTitle>为什么推荐 TA</CardTitle>
            <ul className="space-y-2 text-sm" data-testid="reasons">
              {p.reasons.map((r) => (
                <li key={r} className="rounded-lg border bg-background/40 px-3 py-2">
                  {localizeReason(r, info, best ? p.top_pairs.flatMap((t) => [t.champion_a, t.champion_b]) : [])}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {hint && (
        <Badge
          className={cn("pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 border px-3 py-1 text-sm font-semibold shadow-sm",
            hint === "like" ? "border-good bg-card text-good" : "border-bad bg-card text-bad")}
          style={{ opacity: hintOpacity }}
          aria-hidden
        >
          {hint === "like" ? "喜欢" : "跳过"}
        </Badge>
      )}
    </div>
  );
}
