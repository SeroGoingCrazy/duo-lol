"use client";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import ChampionPicker from "@/components/ChampionPicker";
import PositionIcon from "@/components/PositionIcon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { POSITIONS, type Pick, type Player, type SelfReport } from "@/lib/api";
import { useT } from "@/components/LangProvider";
import { SELF_REPORT_TIERS } from "@/lib/labels";
import { useChampionInfo } from "@/lib/useChampionInfo";
import { cn } from "@/lib/utils";

const MAX_PICKS = 5;
const MAX_ROLES = 2;

/** 数据不足 fallback (PRD §2.3): up to 5 自选英雄 in up to 2 positions; 未定级 players also pick a tier. */
export default function SelfReportForm({ player, champions, initial, step, className, onSubmit }: {
  player: Player; champions: string[]; initial?: SelfReport; step?: string; className?: string; onSubmit: (r: SelfReport) => void;
}) {
  const info = useChampionInfo();
  const t = useT();
  const [picks, setPicks] = useState<Pick[]>(initial?.picks ?? [{ champion: "", position: "" }]);
  const [tier, setTier] = useState(initial?.tier ?? "");
  const [tried, setTried] = useState(false);

  const roles = new Set(picks.map((p) => p.position).filter(Boolean));
  // Without the champion list (API down) any picked name is accepted; the API scores unknown ones at 50%.
  const known = (c: string) => c !== "" && (champions.length === 0 || champions.includes(c));
  const rowError = (p: Pick) => (!known(p.champion) ? t("请选择英雄") : !p.position ? t("请选择位置") : null);
  const tooManyRoles = roles.size > MAX_ROLES;
  const needTier = player.unranked;
  const valid = picks.every((p) => !rowError(p)) && !tooManyRoles && (!needTier || tier !== "");

  const update = (i: number, patch: Partial<Pick>) => setPicks(picks.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  function submit() {
    setTried(true);
    if (valid) onSubmit({ picks, ...(needTier ? { tier } : {}) });
  }

  return (
    <Card data-testid="self-report" className={cn("space-y-4", className)}>
      <div>
        {step && <div className="mb-1 text-xs font-medium text-primary">{step}</div>}
        <div className="font-semibold">{t("{id} 本赛季单双排只有 {n} 场", { id: player.riot_id, n: player.games })}</div>
        <div className="mt-1 text-sm text-muted-foreground">
          {t("不到 20 场，没法用战绩预测。选几个常玩的英雄（最多 {picks} 个、{roles} 个位置），我们按这些英雄在{tier}的全服胜率来估算。",
            { picks: MAX_PICKS, roles: MAX_ROLES, tier: needTier ? t("你所选段位") : t.tier(player.tier) })}
        </div>
      </div>

      {needTier && (
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">{t("本赛季还没定级，选一个接近的段位")}</div>
          <Select value={tier} onValueChange={setTier}>
            <SelectTrigger aria-label={t("段位")} aria-invalid={tried && !tier} className="sm:w-48"><SelectValue placeholder={t("选择段位")} /></SelectTrigger>
            <SelectContent>
              {SELF_REPORT_TIERS.map((x) => <SelectItem key={x} value={x}>{t.tier(x)}</SelectItem>)}
            </SelectContent>
          </Select>
          {tried && !tier && <div className="text-xs text-bad">{t("请选择段位")}</div>}
        </div>
      )}

      <div className="space-y-2">
        {picks.map((p, i) => {
          const err = tried ? rowError(p) : null;
          return (
            <div key={i}>
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <ChampionPicker champions={champions} info={info} value={p.champion} label={t("英雄 {n}", { n: i + 1 })} position={p.position}
                    invalid={!!err && !known(p.champion)} onChange={(c) => update(i, { champion: c })} />
                </div>
                <Select value={p.position} onValueChange={(v) => update(i, { position: v })}>
                  <SelectTrigger aria-label={t("位置 {n}", { n: i + 1 })} aria-invalid={!!err && !p.position} className="w-32">
                    <SelectValue placeholder={t("位置")} />
                  </SelectTrigger>
                  <SelectContent>
                    {POSITIONS.map((pos) => (
                      <SelectItem key={pos} value={pos}><PositionIcon position={pos} size={16} showLabel /></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="ghost" size="icon" className="mt-1" aria-label={t("删除第 {n} 个", { n: i + 1 })}
                  disabled={picks.length === 1} onClick={() => setPicks(picks.filter((_, j) => j !== i))}>
                  <X />
                </Button>
              </div>
              {err && <div className="mt-1 text-xs text-bad">{t("第 {n} 行：{err}", { n: i + 1, err })}</div>}
            </div>
          );
        })}
        {tooManyRoles && (
          <div className="text-xs text-bad">
            {t("最多 {n} 个位置，现在选了 {roles}", { n: MAX_ROLES, roles: [...roles].map(t.position).join(t.lang === "en" ? ", " : "、") })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={picks.length >= MAX_PICKS}
          onClick={() => setPicks([...picks, { champion: "", position: picks[picks.length - 1].position }])}>
          <Plus />{t("再加一个")}
        </Button>
        <Button type="button" onClick={submit}>{t("用这些英雄估算")}</Button>
      </div>
    </Card>
  );
}
