"use client";
import { useState } from "react";
import { POSITIONS, type Pick } from "@/lib/api";

const MAX_PICKS = 5;
const MAX_ROLES = 2;

/** 数据不足 fallback (PRD §2.3): up to 5 自选英雄 in up to 2 positions. */
export default function SelfReportForm({
  riotId,
  champions,
  onSubmit,
}: {
  riotId: string;
  champions: string[];
  onSubmit: (picks: Pick[]) => void;
}) {
  const [picks, setPicks] = useState<Pick[]>([{ champion: "", position: "MIDDLE" }]);
  const roles = new Set(picks.map((p) => p.position));
  const valid = picks.every((p) => champions.includes(p.champion)) && roles.size <= MAX_ROLES;

  const update = (i: number, patch: Partial<Pick>) =>
    setPicks(picks.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  return (
    <div className="panel" data-testid="self-report">
      <div>
        <b>{riotId}</b> 本赛季单双排不足 20 场，没法用战绩预测。请选你常玩的英雄（最多 {MAX_PICKS} 个、{MAX_ROLES} 个位置），
        我们按这些英雄在你段位的全服胜率来估算。
      </div>
      <datalist id="champions">
        {champions.map((c) => <option key={c} value={c} />)}
      </datalist>
      {picks.map((p, i) => (
        <form className="row" key={i} style={{ marginTop: 8 }} onSubmit={(e) => e.preventDefault()}>
          <input list="champions" placeholder="英雄（英文名）" aria-label={`英雄 ${i + 1}`}
            value={p.champion} onChange={(e) => update(i, { champion: e.target.value })} />
          <select aria-label={`位置 ${i + 1}`} value={p.position} onChange={(e) => update(i, { position: e.target.value })}>
            {POSITIONS.map((pos) => <option key={pos}>{pos}</option>)}
          </select>
        </form>
      ))}
      {roles.size > MAX_ROLES && <div className="error">最多选 {MAX_ROLES} 个位置</div>}
      <div className="row" style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button type="button" disabled={picks.length >= MAX_PICKS}
          onClick={() => setPicks([...picks, { champion: "", position: picks[picks.length - 1].position }])}>
          再加一个
        </button>
        <button type="button" disabled={!valid} onClick={() => onSubmit(picks)}>用这些英雄估算</button>
      </div>
    </div>
  );
}
