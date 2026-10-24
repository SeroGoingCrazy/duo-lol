"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Heart, LockKeyhole, X } from "lucide-react";
import ChampionIcon from "@/components/ChampionIcon";
import ChampionPairTable from "@/components/ChampionPairTable";
import PositionIcon from "@/components/PositionIcon";
import { Avatar } from "@/components/ProfileIconPicker";
import ScoreBadge, { ScoreCalculation, ScoreHelp, scoreSummary } from "@/components/ScoreBadge";
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
export default function SwipeCard({ p, info, fling, onSwiped, onSwipeStart, likesYou = false, demo = false }: {
  p: DeckCard;
  info: Record<string, ChampionInfo>;
  fling: Swipe | null;               // set by the buttons or arrow keys to throw the card out
  onSwiped: (s: Swipe) => void;
  onSwipeStart: (s: Swipe) => void;
  likesYou?: boolean;
  demo?: boolean;
}) {
  const [page, setPage] = useState(0);
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState<Swipe | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ id: number; x: number; y: number; lastX: number; lastT: number; velocity: number; axis: "x" | "y" | null } | null>(null);
  const committed = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const card = useRef<HTMLDivElement>(null);
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
  // A champion can occur in several positions; rank observed games across all of them.
  const championGames = new Map<string, number>();
  for (const c of p.champions ?? []) championGames.set(c.champion, (championGames.get(c.champion) ?? 0) + c.games);
  const commonChampions = [...championGames].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3);

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
      <div className="swipe-profile-header shrink-0 px-4 pb-2 pt-2 sm:px-6 sm:pb-5 sm:pt-4">
        <div className="mb-2 grid grid-cols-3 gap-2 sm:mb-5" data-testid="card-page" aria-label={t("卡片详情")}>
          {PAGES.map((name, i) => (
            <button
              key={name} type="button" aria-pressed={i === page}
              onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onClick={() => setPage(i)}
              className={cn("cursor-pointer border-t-[3px] pb-1 pt-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:pt-2",
                i === page ? "border-primary font-semibold text-foreground" : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground")}
            >
              {t(name)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Avatar url={p.avatar ?? null} size={44} />
          <div className="min-w-0 flex-1">
            <div className="mb-1 hidden text-xs text-muted-foreground sm:block">{t("推荐给你的搭子")}</div>
            <h2 className="text-lg font-bold tracking-tight sm:text-2xl">{t("{role}玩家", { role: t.position(p.roles.b) })}</h2>
            <div className="mt-1 flex flex-wrap gap-1.5 sm:mt-2">
              <Badge>{t.tier(p.tier, p.division)}</Badge>
              {likesYou && <Badge className="gap-1 bg-good/10 text-good" data-testid="likes-you-badge"><Heart className="size-3" />{demo ? (t.lang === "zh" ? "模拟喜欢" : "Simulated like") : t("喜欢了你")}</Badge>}
              {p.profile?.looking_now && <Badge className="gap-1 bg-good/10 text-good" data-testid="looking-badge"><span className="size-1.5 rounded-full bg-good" />{t("现在想打")}</Badge>}
            </div>
          </div>
        </div>
        {p.profile && <ProfileLine profile={p.profile} />}
      </div>

      <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-4 py-2 sm:px-6 sm:py-5" data-testid="card-content">
        {page === 0 && (
          <>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground sm:text-sm">{t("搭配评分（百分位）")} <ScoreHelp /></div>
                <div className="[&_[aria-label]]:text-4xl sm:[&_[aria-label]]:text-7xl"><ScoreBadge score={p.score} /></div>
                {p.score != null && <div className="mt-1 text-[11px] text-muted-foreground sm:mt-2 sm:text-xs">{scoreSummary({ ...p, score: p.score }, t)}</div>}
              </div>
            </div>
            <ScoreCalculation prediction={p} />
            <div className="mt-2 grid grid-cols-2 gap-2 sm:mt-5 sm:gap-3" data-testid="card-roles">
              {([[t("你打"), p.roles.a], [t("TA 打"), p.roles.b]] as const).map(([who, role]) => (
                <div key={who} className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-muted/70 px-2 py-1 sm:block sm:p-3">
                  <div className="text-xs text-muted-foreground">{who}</div>
                  <div className="text-xs font-semibold sm:mt-1 sm:text-base"><PositionIcon position={role} size={18} showLabel /></div>
                </div>
              ))}
            </div>
            <span className="sr-only">{t("你打{a}，TA 打{b}", { a: t.position(p.roles.a), b: t.position(p.roles.b) })}</span>
            <div className="mt-2 sm:mt-5" data-testid="card-champions">
                <div className="mb-1 flex items-center justify-between gap-2 sm:mb-3">
                  <h3 className="text-xs font-medium text-muted-foreground">{t.lang === "zh" ? "TA 常用英雄" : "Their most played"}</h3>
                  <button type="button" onClick={() => setPage(1)} className="flex items-center gap-1 text-xs text-primary hover:underline">{t.lang === "zh" ? "看英雄组合" : "See champion pairs"} <ArrowRight className="size-3" /></button>
                </div>
                {commonChampions.length ? <div className="flex gap-2">
                  {commonChampions.map(([champion, games]) => <div key={champion} className="flex min-w-0 flex-1 items-center gap-1.5">
                    <ChampionIcon champion={champion} size={28} />
                    <div className="min-w-0 text-[11px]"><span className="block truncate font-medium">{championName(info, champion, t.lang)}</span><span className="text-muted-foreground">{t.lang === "zh" ? `${games} 场` : `${games} games`}</span></div>
                  </div>)}
                </div> : <p className="text-xs text-muted-foreground">{t.lang === "zh" ? "暂无已收录英雄战绩" : "No recorded champion history yet"}</p>}
                <p className="mt-1 text-[10px] text-muted-foreground sm:mt-2 sm:text-xs" data-testid="card-games">{p.games == null
                  ? (t.lang === "zh" ? "战绩样本暂不可用" : "Game sample unavailable")
                  : (t.lang === "zh" ? `基于已收录的本赛季 ${p.games} 场单双排` : `Based on ${p.games} recorded Solo/Duo games this season`)}</p>
              </div>
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
      <div className="flex shrink-0 items-center justify-center gap-1 border-t px-2 py-1.5 text-[10px] text-muted-foreground sm:px-4 sm:py-3 sm:text-[11px]"><LockKeyhole className="size-3" />{demo ? (t.lang === "zh" ? "仅演示，不产生真实互选" : "Demo only · no real match") : t("互选后解锁 Riot ID")}<span className="mx-1">·</span>{t("点左右翻页 {n} / {total}", { n: page + 1, total: PAGES.length })}</div>

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
    <div className="mt-1 space-y-1 sm:mt-3 sm:space-y-1.5" data-testid="card-profile">
      {profile.bio && <p className="line-clamp-1 text-xs leading-snug sm:line-clamp-2 sm:text-sm">{profile.bio}</p>}
      {tags.length > 0 && <p className="truncate text-xs text-muted-foreground">{tags.join(" · ")}</p>}
    </div>
  );
}
