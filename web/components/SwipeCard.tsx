"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Heart, LockKeyhole, X } from "lucide-react";
import ChampionIcon from "@/components/ChampionIcon";
import ChampionPairTable from "@/components/ChampionPairTable";
import PositionIcon from "@/components/PositionIcon";
import ScoreBadge, { ScoreHelp, scoreSummary } from "@/components/ScoreBadge";
import { Badge } from "@/components/ui/badge";
import { CardTitle } from "@/components/ui/card";
import { useT } from "@/components/LangProvider";
import type { DeckCard } from "@/lib/api";
import { LANGUAGE_LABELS, PLAY_TIME_LABELS, type MemberProfile } from "@/lib/profile";
import { championName, type ChampionInfo } from "@/lib/champions";
import type { T } from "@/lib/i18n";
import type { Swipe } from "@/lib/deck";
import { cn } from "@/lib/utils";

// A drag past this share of the card's width (or a quick flick) counts as a swipe; less springs back.
const SWIPE_SHARE = 0.25;
const FLICK_PX_PER_MS = 0.6;
const PAGES = ["搭配评分", "英雄组合", "理由"];   // translated where shown

/** The model's 理由 name positions and champions by their Riot ids; show them in the page's language. */
function localizeReason(text: string, info: Record<string, ChampionInfo>, champions: string[], t: T) {
  let out = t.api(text).replace(/\b(TOP|JUNGLE|MIDDLE|BOTTOM|UTILITY)\b/g, (code) => t.position(code));
  for (const c of champions) if (info[c]) out = out.replaceAll(c, championName(info, c, t.lang));
  return out;
}

/** 卡片 (CONTEXT.md): three pages flipped like Tinder's photos. Riot ID stays hidden until 互选. */
export default function SwipeCard({ p, info, fling, onSwiped, onSwipeStart, likesYou = false }: {
  p: DeckCard;
  info: Record<string, ChampionInfo>;
  fling: Swipe | null;               // set by the buttons or arrow keys to throw the card out
  onSwiped: (s: Swipe) => void;
  onSwipeStart: (s: Swipe) => void;
  likesYou?: boolean;
}) {
  const [page, setPage] = useState(0);
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState<Swipe | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ id: number; x: number; y: number; lastX: number; lastT: number; velocity: number; axis: "x" | "y" | null } | null>(null);
  const committed = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const up = p.win_rate_delta >= 0;
  const t = useT();

  function leave(s: Swipe) {
    if (committed.current) return;
    committed.current = true;
    setLeaving(s);
    onSwipeStart(s);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    timer.current = setTimeout(() => onSwiped(s), reduced ? 0 : 240);
  }

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => { if (fling) leave(fling); }, [fling]);   // eslint-disable-line react-hooks/exhaustive-deps

  function onPointerDown(e: React.PointerEvent) {
    if (committed.current || !e.isPrimary || e.button !== 0 || (e.target as HTMLElement).closest("button, a, input, [role=tab]")) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, lastX: e.clientX, lastT: e.timeStamp, velocity: 0, axis: null };
  }

  function onPointerMove(e: React.PointerEvent) {
    const start = drag.current;
    if (!start || start.id !== e.pointerId) return;
    const d = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (!start.axis && Math.max(Math.abs(d), Math.abs(dy)) > 10) {
      start.axis = Math.abs(d) > Math.abs(dy) * 1.2 ? "x" : "y";
      if (start.axis === "x") {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(true);
      }
    }
    if (start.axis !== "x") return;
    start.velocity = (e.clientX - start.lastX) / Math.max(1, e.timeStamp - start.lastT);
    start.lastX = e.clientX;
    start.lastT = e.timeStamp;
    setDx(d);
  }

  function onPointerUp(e: React.PointerEvent) {
    const start = drag.current;
    if (!start || start.id !== e.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    const width = card.current?.offsetWidth ?? 400;
    const d = e.clientX - start.x;
    const speed = e.timeStamp - start.lastT < 100 ? start.velocity : 0;
    if (start.axis === "x" && (Math.abs(d) > width * SWIPE_SHARE || (Math.abs(d) > 40 && Math.abs(speed) > FLICK_PX_PER_MS && Math.sign(speed) === Math.sign(d)))) {
      leave(d > 0 ? "like" : "pass");
      return;
    }
    setDx(0);
    if (!start.axis && Math.abs(d) < 10 && Math.abs(e.clientY - start.y) < 10) {
      // a tap on the left or right half flips the page, like Tinder's photos
      const rect = card.current!.getBoundingClientRect();
      const right = e.clientX - rect.left > rect.width / 2;
      setPage((n) => Math.min(PAGES.length - 1, Math.max(0, n + (right ? 1 : -1))));
    }
  }

  const x = leaving ? (leaving === "like" ? 1 : -1) * (window.innerWidth + 400) : dx;
  const hint = leaving ?? (dx > 20 ? "like" : dx < -20 ? "pass" : null);
  const hintOpacity = leaving ? 1 : Math.min(1, Math.abs(dx) / 120);
  const best = p.top_pairs[0];

  return (
    <div
      ref={card}
      data-testid="swipe-card"
      className={cn(
        "swipe-profile relative flex h-full select-none flex-col overflow-hidden rounded-3xl border bg-card touch-pan-y",
        dragging ? "cursor-grabbing" : "transition-transform duration-200 ease-out motion-reduce:transition-none",
      )}
      style={{ transform: `translateX(${x}px) rotate(${Math.max(-18, Math.min(18, x / 30))}deg)` }}
      onDragStart={(e) => e.preventDefault()}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { drag.current = null; setDragging(false); setDx(0); }}
      onLostPointerCapture={(e) => {
        // Touch implicitly captures the child under the finger. Transferring that
        // capture to the card emits a bubbling event; it must not cancel the drag.
        if (e.target !== e.currentTarget) return;
        drag.current = null; setDragging(false); setDx(0);
      }}
    >
      <div className="swipe-profile-header shrink-0 px-5 pb-4 pt-4 sm:px-6 sm:pb-5">
        <div className="mb-3 grid grid-cols-3 gap-2 sm:mb-5" data-testid="card-page" aria-label={t("卡片详情")}>
          {PAGES.map((name, i) => (
            <button
              key={name} type="button" aria-pressed={i === page}
              onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onClick={() => setPage(i)}
              className={cn("cursor-pointer border-t-[3px] pb-1 pt-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                i === page ? "border-primary font-semibold text-foreground" : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground")}
            >
              {t(name)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-card shadow-sm sm:size-16">
            <PositionIcon position={p.roles.b} size={38} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 text-xs text-muted-foreground">{t("推荐给你的搭子")}</div>
            <h2 className="text-2xl font-bold tracking-tight">{t("{role}玩家", { role: t.position(p.roles.b) })}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge>{t.tier(p.tier, p.division)}</Badge>
              {likesYou && <Badge className="gap-1 bg-good/10 text-good"><Heart className="size-3" />{t("喜欢了你")}</Badge>}
              {p.profile?.looking_now && <Badge className="gap-1 bg-good/10 text-good" data-testid="looking-badge"><span className="size-1.5 rounded-full bg-good" />{t("现在想打")}</Badge>}
            </div>
          </div>
        </div>
        {p.profile && <ProfileLine profile={p.profile} />}
      </div>

      <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-5 py-3 sm:px-6 sm:py-5" data-testid="card-content">
        {page === 0 && (
          <>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-sm text-muted-foreground">{t("搭配评分")} <ScoreHelp /></div>
                <ScoreBadge score={p.score} />
                {p.score != null && <div className="mt-2 text-xs text-muted-foreground">{scoreSummary(p.score, t)}</div>}
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">{t("预测胜率")}</div>
                <div className="win-rate text-2xl font-semibold tabular-nums">{t.pct(p.win_rate)}</div>
                <div className={cn("mt-1 max-w-36 text-xs", up ? "text-good" : "text-bad")}>{t(up ? "比单排基线平均高" : "比单排基线平均低")}<br />{t.points(p.win_rate_delta)}</div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:mt-5" data-testid="card-roles">
              {([[t("你打"), p.roles.a], [t("TA 打"), p.roles.b]] as const).map(([who, role]) => (
                <div key={who} className="min-w-0 rounded-xl bg-muted/70 p-2.5 sm:p-3">
                  <div className="text-xs text-muted-foreground">{who}</div>
                  <div className="mt-1 font-semibold"><PositionIcon position={role} showLabel /></div>
                </div>
              ))}
            </div>
            <span className="sr-only">{t("你打{a}，TA 打{b}", { a: t.position(p.roles.a), b: t.position(p.roles.b) })}</span>
            {best && (
              <div className="mt-3 sm:mt-5">
                <div className="mb-2 flex items-center justify-between sm:mb-3">
                  <h3 className="text-xs font-medium text-muted-foreground">{t("试试这个英雄组合")}</h3>
                  <button type="button" onClick={() => setPage(1)} className="flex items-center gap-1 text-xs text-primary hover:underline">{t("查看全部")} <ArrowRight className="size-3" /></button>
                </div>
                <div className="flex items-center gap-3 rounded-xl border p-2.5 sm:p-3">
                  <ChampionIcon champion={best.champion_a} size={40} />
                  <div className="min-w-0 flex-1 text-sm"><span className="block truncate font-medium">{championName(info, best.champion_a, t.lang)}</span><span className="text-xs text-muted-foreground">{t("你")}</span></div>
                  <span className="text-muted-foreground">+</span>
                  <ChampionIcon champion={best.champion_b} size={40} />
                  <div className="min-w-0 flex-1 text-sm"><span className="block truncate font-medium">{championName(info, best.champion_b, t.lang)}</span><span className="text-xs text-muted-foreground">{t("TA")}</span></div>
                </div>
              </div>
            )}
          </>
        )}
        {page === 1 && (
          <>
            <CardTitle>{t("建议位置和最佳英雄组合")}</CardTitle>
            <ChampionPairTable a={t("你")} b={t("TA")} roles={p.roles} pairs={p.top_pairs} info={info} />
          </>
        )}
        {page === 2 && (
          <>
            <CardTitle>{t("为什么推荐 TA")}</CardTitle>
            <p className="mb-4 mt-2 text-xs text-muted-foreground">{t("根据位置分配与英雄组合给出的推荐理由")}</p>
            <ul className="space-y-3 text-sm" data-testid="reasons">
              {p.reasons.map((r) => (
                <li key={r} className="flex items-start gap-3 rounded-xl bg-muted/70 p-3 leading-relaxed">
                  <Check className="mt-1 size-4 shrink-0 text-primary" />
                  {localizeReason(r, info, best ? p.top_pairs.flatMap((x) => [x.champion_a, x.champion_b]) : [], t)}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <div className="flex shrink-0 items-center justify-center gap-1.5 border-t px-4 py-3 text-[11px] text-muted-foreground"><LockKeyhole className="size-3" />{t("互选后解锁 Riot ID")}<span className="mx-1">·</span>{t("点左右翻页 {n} / {total}", { n: page + 1, total: PAGES.length })}</div>

      {hint && (
        <Badge
          className={cn("pointer-events-none absolute top-24 border-2 bg-card px-5 py-3 text-2xl font-bold shadow-lg",
            hint === "like" ? "left-6 -rotate-12 border-good text-good" : "right-6 rotate-12 border-bad text-bad")}
          style={{ opacity: hintOpacity }}
          aria-hidden
        >
          {hint === "like" ? <Heart className="mr-2 size-6" /> : <X className="mr-2 size-6" />}{t(hint === "like" ? "喜欢" : "跳过")}
        </Badge>
      )}
    </div>
  );
}

/** 简介 and the 会员's own tags under the card's title. */
function ProfileLine({ profile }: { profile: MemberProfile }) {
  const t = useT();
  const tags = [
    ...profile.languages.map((l) => LANGUAGE_LABELS[l] ?? l),
    ...(profile.voice ? [t(profile.voice === "voice" ? "开麦" : "只打字")] : []),
    ...profile.play_times.map((p) => t(PLAY_TIME_LABELS[p] ?? p)),
  ];
  if (!profile.bio && tags.length === 0) return null;
  return (
    <div className="mt-3 space-y-1.5" data-testid="card-profile">
      {profile.bio && <p className="line-clamp-2 text-sm leading-snug">{profile.bio}</p>}
      {tags.length > 0 && <p className="truncate text-xs text-muted-foreground">{tags.join(" · ")}</p>}
    </div>
  );
}
