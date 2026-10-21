"use client";
import ChampionPairTable from "@/components/ChampionPairTable";
import CopyButton from "@/components/CopyButton";
import PlayerCard from "@/components/PlayerCard";
import ScoreBadge, { ScoreHelp, scoreSummary } from "@/components/ScoreBadge";
import { Card, CardTitle } from "@/components/ui/card";
import { useT } from "@/components/LangProvider";
import type { PairResult } from "@/lib/api";
import { useChampionInfo } from "@/lib/useChampionInfo";
import { cn } from "@/lib/utils";

/** shareable: the result came from the two Riot IDs alone, so ?a=&b= reproduces it (not when 自选英雄 were used). */
export default function PairResultView({ r, shareable = true }: { r: PairResult; shareable?: boolean }) {
  const info = useChampionInfo();
  const t = useT();
  const up = r.win_rate_delta >= 0;
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:items-start" data-testid="pair-result">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-sm text-muted-foreground">{t("搭配评分")} <ScoreHelp /></div>
            <ScoreBadge score={r.score} />
            {r.score != null && <div className="mt-2 text-sm text-muted-foreground">{scoreSummary(r.score, t)}</div>}
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">{t("预测胜率")}</div>
            <div className="text-2xl font-semibold tabular-nums" data-testid="win-rate">{t.pct(r.win_rate)}</div>
            <div className={cn("text-sm", up ? "text-good" : "text-bad")} data-testid="win-rate-delta">
              {t(up ? "比你们单排平均高 {pts}" : "比你们单排平均低 {pts}", { pts: t.points(r.win_rate_delta) })}
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <PlayerCard player={r.a} role={r.roles.a} info={info} />
          <PlayerCard player={r.b} role={r.roles.b} info={info} />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{t("单排基线：{a} {pa}，{b} {pb}", { a: r.a.riot_id, pa: t.pct(r.solo_baselines.a), b: r.b.riot_id, pb: t.pct(r.solo_baselines.b) })}</span>
          {/* the page keeps ?a=&b= in the address, so the link reopens this result */}
          {shareable && <CopyButton text={() => window.location.href} label={t("复制分享链接")} />}
        </div>
      </Card>

      <Card>
        <CardTitle>{t("建议位置和最佳英雄组合")}</CardTitle>
        <ChampionPairTable a={r.a.riot_id} b={r.b.riot_id} roles={r.roles} pairs={r.top_pairs} info={info} />
      </Card>

      {r.notes.length > 0 && (
        <ul className="space-y-1 text-xs text-muted-foreground xl:col-span-2" data-testid="notes">
          {r.notes.map((x) => <li key={x}>* {t.api(x)}</li>)}
        </ul>
      )}
    </div>
  );
}
