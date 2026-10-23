"use client";
import { useT } from "@/components/LangProvider";
import PlayerLookupPreview from "@/components/PlayerLookupPreview";
import { Card } from "@/components/ui/card";
import type { LookupUpdate } from "@/lib/api";

const STAGES: Record<LookupUpdate["stage"], string> = {
  account: "正在查找美服玩家…",
  rank: "正在读取单双排段位…",
  history: "正在读取本赛季对局列表…",
  matches: "正在读取对局详情…",
  analysis: "正在整理英雄熟练度…",
  done: "玩家数据已就绪",
};

/** Only the match-download stage has measurable progress; never invent a completion estimate. */
export default function LookupProgress({ label, hint, progress }: {
  label: string; hint?: string; progress?: LookupUpdate | null;
}) {
  const t = useT();
  const determinate = progress?.stage === "matches" && progress.total > 0;
  const done = progress ? Math.max(0, Math.min(progress.done, progress.total)) : 0;
  return (
    <Card data-testid="progress" className="space-y-3" aria-busy="true">
      <div role="status" aria-live="polite" className="space-y-1">
        <div className="text-sm">{label}</div>
        {progress && <div className="text-xs text-muted-foreground">{t(STAGES[progress.stage] ?? STAGES.account)}</div>}
      </div>
      {progress?.preview && <PlayerLookupPreview player={progress.preview} />}
      <div className="relative h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar"
        aria-label={progress ? t(STAGES[progress.stage] ?? STAGES.account) : label}
        aria-valuemin={determinate ? 0 : undefined} aria-valuemax={determinate ? progress.total : undefined}
        aria-valuenow={determinate ? done : undefined}>
        {determinate ? (
          <span className="absolute inset-y-0 left-0 rounded-full bg-neon transition-[width]" style={{ width: `${done / progress.total * 100}%` }} />
        ) : <span className="animate-indeterminate absolute inset-y-0 left-0 w-2/5 rounded-full bg-neon" />}
      </div>
      {determinate && <p className="text-xs tabular-nums text-muted-foreground" data-testid="lookup-match-count">{t("已处理 {done} / {total} 场对局", { done, total: progress.total })}</p>}
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}
