import { pct, type PairResult } from "@/lib/api";

export default function PairResultView({ r }: { r: PairResult }) {
  return (
    <div className="panel" data-testid="pair-result">
      <div className="muted">预测胜率</div>
      <div className="big" data-testid="win-rate">{pct(r.win_rate)}</div>
      <div className={r.win_rate_delta >= 0 ? "good" : "bad"} data-testid="win-rate-delta">
        比你们各自单排{r.win_rate_delta >= 0 ? "高" : "低"} {pct(Math.abs(r.win_rate_delta))}
        <span className="muted">（单排基线 {pct(r.solo_baselines.a)} / {pct(r.solo_baselines.b)}）</span>
      </div>

      <h3>建议位置</h3>
      <div data-testid="roles">{r.a.riot_id} 打 <b>{r.roles.a}</b>，{r.b.riot_id} 打 <b>{r.roles.b}</b></div>

      <h3>最佳英雄组合</h3>
      <table data-testid="top-pairs">
        <thead><tr><th>{r.a.riot_id}</th><th>{r.b.riot_id}</th><th>预测胜率</th></tr></thead>
        <tbody>
          {r.top_pairs.map((p) => (
            <tr key={`${p.champion_a}-${p.champion_b}`}>
              <td>{p.champion_a}</td><td>{p.champion_b}</td><td>{pct(p.win_rate)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>理由</h3>
      <ul className="reasons" data-testid="reasons">
        {r.reasons.map((x) => <li key={x}>{x}</li>)}
      </ul>
      {r.notes.length > 0 && (
        <ul className="reasons muted">{r.notes.map((x) => <li key={x}>{x}</li>)}</ul>
      )}
    </div>
  );
}
