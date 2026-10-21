"use client";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** 搭配评分: the 预测胜率's percentile among real 组合 (data/score_scale.py); 50 = a typical 组合. */
export function scoreTone(score: number) {
  return score >= 50 ? "text-good" : "text-bad";
}

export function scoreSummary(score: number) {
  return score >= 50 ? `比 ${score}% 的组合更好` : `只比 ${score}% 的组合好`;
}

export default function ScoreBadge({ score, size = "lg" }: { score: number | null; size?: "lg" | "sm" }) {
  if (score == null) {
    return <span className="text-sm text-muted-foreground" data-testid="score">评分校准中</span>;
  }
  return (
    <span className="inline-flex items-baseline gap-1" data-testid="score">
      <span className={cn("font-bold tabular-nums", scoreTone(score), size === "lg" ? "text-6xl leading-none" : "text-2xl")}>{score}</span>
      <span className="text-sm text-muted-foreground">分</span>
    </span>
  );
}

export function ScoreHelp() {
  return (
    <Tooltip>
      <TooltipTrigger className="inline-flex cursor-help items-center text-muted-foreground" aria-label="评分怎么算">
        <Info className="size-4" />
      </TooltipTrigger>
      <TooltipContent>
        双排的预测胜率大多集中在 50% 附近，差 1% 已经很明显。评分把预测胜率放进推荐池里所有可双排组合的胜率分布（按正态分布）里看排第几：
        50 分是普通水平，84 分比 84% 的组合好，高于 50 分就算不错。
        评分只说明这两个人搭配得合不合适，不是任何一个人的实力、段位或隐藏分。
      </TooltipContent>
    </Tooltip>
  );
}
