"use client";
import { useState } from "react";
import Nav from "@/components/Nav";
import LookupProgress from "@/components/LookupProgress";
import { ApiError, ensurePlayer, findPartners, pct, type Partner } from "@/lib/api";

export default function FindPage() {
  const [me, setMe] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [partners, setPartners] = useState<Partner[] | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setPartners(null); setBusy(true);
    try {
      setLoading(`正在读取 ${me.trim()} 本赛季的单双排对局…`);
      const player = await ensurePlayer(me.trim());
      if (player.insufficient_data) {
        setError(`${player.riot_id} 本赛季单双排不足 20 场，暂时没法推荐搭子。`);
        return;
      }
      setLoading("正在计算推荐搭子…");
      setPartners((await findPartners(player.riot_id)).partners);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false); setLoading("");
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
      {loading && (
        <LookupProgress label={loading} hint={loading.startsWith("正在读取") ? "第一次查询的玩家大约需要 2 分钟，之后会缓存。" : undefined} />
      )}
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
