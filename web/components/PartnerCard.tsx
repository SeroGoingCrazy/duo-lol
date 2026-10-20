"use client";
import ChampionLabel from "@/components/ChampionLabel";
import CopyButton from "@/components/CopyButton";
import PositionIcon from "@/components/PositionIcon";
import ScoreBadge from "@/components/ScoreBadge";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { pct, points, type Partner } from "@/lib/api";
import type { ChampionInfo } from "@/lib/champions";
import { positionLabel, tierLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";

export default function PartnerCard({ p, rank, info }: { p: Partner; rank: number; info: Record<string, ChampionInfo> }) {
  const best = p.top_pairs[0];
  const up = p.win_rate_delta >= 0;
  return (
    <Card className="flex h-full flex-wrap items-center gap-4 p-4" data-testid="partner">
      <div className="w-6 text-center text-lg font-bold text-muted-foreground">{rank}</div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-semibold">{p.riot_id}</span>
          <Badge>{tierLabel(p.tier, p.division)}</Badge>
          <CopyButton text={p.riot_id} />
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <span className="flex items-center gap-2">
            <span className="text-muted-foreground">你</span><PositionIcon position={p.roles.a} showLabel />
            {best && <ChampionLabel champion={best.champion_a} info={info} size={28} />}
          </span>
          <span className="flex items-center gap-2">
            <span className="text-muted-foreground">TA</span><PositionIcon position={p.roles.b} showLabel />
            {best && <ChampionLabel champion={best.champion_b} info={info} size={28} />}
          </span>
        </div>
        <div className="sr-only">你打{positionLabel(p.roles.a)}，TA 打{positionLabel(p.roles.b)}</div>
      </div>
      <div className="text-right">
        <ScoreBadge score={p.score} size="sm" />
        <div className="text-xs text-muted-foreground">预测胜率 <b className="win-rate text-foreground">{pct(p.win_rate)}</b></div>
        <div className={cn("text-xs", up ? "text-good" : "text-bad")}>比单排平均{up ? "高" : "低"} {points(p.win_rate_delta)}</div>
      </div>
    </Card>
  );
}
