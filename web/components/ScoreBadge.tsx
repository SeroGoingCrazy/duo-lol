"use client";
import { Info } from "lucide-react";
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
  if (!r.score_by_roles) return t(r.score >= 50 ? "比 {n}% 的组合更好" : "只比 {n}% 的组合好", { n: r.score });
  const roles = `${t.position(r.roles.a)}+${t.position(r.roles.b)}`;
  return t(r.score >= 50 ? "比 {n}% 的{roles}组合更好" : "只比 {n}% 的{roles}组合好", { n: r.score, roles });
}

export default function ScoreBadge({ score, size = "lg" }: { score: number | null; size?: "lg" | "sm" }) {
  const t = useT();
  if (score == null) {
    return <span className="text-sm text-muted-foreground" data-testid="score">{t("评分校准中")}</span>;
  }
  return (
    <span className="inline-flex items-baseline gap-1" data-testid="score">
      <span className={cn("font-bold tabular-nums", scoreTone(score), size === "lg" ? "text-6xl leading-none" : "text-2xl")}>{score}</span>
      {t.lang === "zh" && <span className="text-sm text-muted-foreground">分</span>}
    </span>
  );
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
