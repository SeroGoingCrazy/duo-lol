"use client";
import { useState } from "react";
import Nav from "@/components/Nav";
import LookupProgress from "@/components/LookupProgress";
import { ApiError, ensurePlayer, findPartners, pct, type Partner } from "@/lib/api";

export default function FindPage() {
  const [me, setMe] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const [partners, setPartners] = useState<Partner[] | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setPartners(null); setBusy(true);
    try {
      const player = await ensurePlayer(me.trim(), (done, total) => setProgress({ done, total }));
      setProgress(null);
      if (player.insufficient_data) {
        setError(`${player.riot_id} 本赛季单双排不足 20 场，暂时没法推荐搭子。`);
        return;
      }
      setPartners((await findPartners(player.riot_id)).partners);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false); setProgress(null);
    }
  }

  return (
    <>
      <Nav current="find" />
      <h1>找搭子：谁和你一起双排胜率最高？</h1>
      <form className="row panel" onSubmit={submit}>
        <input aria-label="你的 Riot ID" placeholder="你的 Riot ID，如 Name#NA1" value={me} onChange={(e) => setMe(e.target.value)} required />
        <button disabled={busy || !me.includes("#")}>找搭子</button>
      </form>
      {progress && <LookupProgress label={me} {...progress} />}
      {error && <div className="panel error" role="alert">{error}</div>}
      {partners && partners.length === 0 && <div className="panel">推荐池里暂时没有能和你双排的玩家。</div>}
      {partners && partners.length > 0 && (
        <ol data-testid="partners" style={{ paddingLeft: 20 }}>
          {partners.map((p) => (
            <li key={p.riot_id} className="panel">
              <b>{p.riot_id}</b> <span className="muted">{p.tier}</span>
              <div>预测胜率 <b>{pct(p.win_rate)}</b>，你打 {p.roles.a}，TA 打 {p.roles.b}</div>
              <ul className="reasons">{p.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
            </li>
          ))}
        </ol>
      )}
      <div className="muted">只显示 Riot ID 和理由，不提供联系方式。</div>
    </>
  );
}
