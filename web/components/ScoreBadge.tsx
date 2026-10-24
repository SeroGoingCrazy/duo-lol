"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { animate, useReducedMotion } from "motion/react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useT } from "@/components/LangProvider";
import type { T } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** 搭配评分: the 预测胜率's percentile among real 组合 in the same two positions (data/score_scale.py, ADR-0010);
 *  50 = a typical 组合 there. */
export function scoreTone(score: number) {
  return score >= 50 ? "text-good" : "text-bad";
}

export function scoreSummary(r: { score: number; roles: { a: string; b: string }; score_by_roles?: boolean }, t: T) {
  // A rounded 100th percentile must not claim to beat every possible pair.
  const n = Math.max(1, Math.round(100 - r.score));
  if (!r.score_by_roles) return r.score >= 100
    ? t("超过几乎所有可双排组合")
    : t("在可双排组合里排前 {n}%", { n });
  const roles = `${t.position(r.roles.a)} + ${t.position(r.roles.b)}`;
  return r.score >= 100
    ? t("超过几乎所有{roles}组合", { roles })
    : t("在{roles}组合里排前 {n}%", { n, roles });
}

export default function ScoreBadge({ score, size = "lg" }: { score: number | null; size?: "lg" | "sm" }) {
  const t = useT();
  if (score == null) {
    return <span className="text-sm text-muted-foreground" data-testid="score">{t("评分校准中")}</span>;
  }
  const lg = size === "lg";
  return (
    <span className="inline-flex items-baseline gap-1" data-testid="score">
      {/* the big score is the page's one neon moment: gradient when good, and it counts up when it appears */}
      <span className={cn("font-bold tabular-nums", lg && score >= 50 ? "text-neon drop-shadow-[0_0_22px_color-mix(in_srgb,var(--neon-a)_55%,transparent)]" : scoreTone(score),
        lg ? "text-6xl leading-none tracking-tight sm:text-7xl" : "text-2xl")} aria-label={String(score)}>
        {lg ? <CountUp to={score} /> : score}
      </span>
      {t.lang === "zh" && <span className="text-sm text-muted-foreground">{t("分")}</span>}
    </span>
  );
}

/** Keep the main comparison in percentiles; raw prediction details are opt-in. */
export function ScoreCalculation({ prediction, children }: {
  prediction: { win_rate: number; win_rate_delta: number };
  children?: ReactNode;
}) {
  const t = useT();
  const up = prediction.win_rate_delta >= 0;
  return (
    <details className="mt-2 text-xs text-muted-foreground" data-testid="score-calculation"
      onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}>
      <summary className="w-fit cursor-pointer rounded-sm py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t("怎么算的")}</summary>
      <div className="space-y-1 pt-1">
        <div>{t("预测胜率")} <span className="win-rate font-medium tabular-nums text-foreground" data-testid="win-rate">{t.pct(prediction.win_rate)}</span></div>
        <div data-testid="win-rate-delta">{t(up ? "比你们单排平均高 {pts}" : "比你们单排平均低 {pts}", { pts: t.points(prediction.win_rate_delta) })}</div>
        {children}
      </div>
    </details>
  );
}

function CountUp({ to }: { to: number }) {
  const still = useReducedMotion();
  const [shown, setShown] = useState(still ? to : 0);
  useEffect(() => {
    if (still) { setShown(to); return; }
    const run = animate(0, to, { duration: 0.9, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setShown(Math.round(v)) });
    return () => run.stop();
  }, [to, still]);
  return <>{shown}</>;
}

export function ScoreHelp() {
  const t = useT();
  return (
    <Tooltip>
      <TooltipTrigger className="inline-flex cursor-help items-center text-muted-foreground" aria-label={t("评分怎么算")}>
        <Info className="size-4" />
      </TooltipTrigger>
      <TooltipContent>
        {t("双排的预测胜率大多集中在 50% 附近，差 1% 已经很明显。评分把预测胜率放进推荐池里同样两个位置、可双排的组合的胜率分布（按正态分布）里看排第几：")}{" "}
        {t("50 分是普通水平，84 分比 84% 的组合好，高于 50 分就算不错。")}{" "}
        {t("评分只说明这两个人搭配得合不合适，不是任何一个人的实力、段位或隐藏分。")}
      </TooltipContent>
    </Tooltip>
  );
}
