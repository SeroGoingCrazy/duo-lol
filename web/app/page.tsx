"use client";
import { useEffect, useState } from "react";
import Nav from "@/components/Nav";
import LookupProgress from "@/components/LookupProgress";
import PairResultView from "@/components/PairResultView";
import SelfReportForm from "@/components/SelfReportForm";
import { ApiError, ensurePlayer, listChampions, predictPair, type PairResult, type Pick, type Player } from "@/lib/api";

export default function PairPage() {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);   // player being read
  const [error, setError] = useState("");
  const [result, setResult] = useState<PairResult | null>(null);
  const [players, setPlayers] = useState<[Player, Player] | null>(null);
  const [picks, setPicks] = useState<{ a?: Pick[]; b?: Pick[] }>({});
  const [champions, setChampions] = useState<string[]>([]);

  // Without the list the picker still accepts typed names; the API scores unknown ones at 50%.
  useEffect(() => { listChampions().then(setChampions).catch(() => setChampions([])); }, []);

  // Once both players are loaded, predict as soon as everyone 数据不足 has 自选英雄.
  useEffect(() => {
    if (!players) return;
    const [pa, pb] = players;
    if ((pa.insufficient_data && !picks.a) || (pb.insufficient_data && !picks.b)) return;
    let stale = false;   // a newer submit replaces players; ignore this answer then
    setBusy(true);
    predictPair(pa.riot_id, pb.riot_id, picks.a, picks.b)
      .then((r) => { if (!stale) setResult(r); })
      .catch((e) => { if (!stale) setError(e instanceof ApiError ? e.message : String(e)); })
      .finally(() => { if (!stale) setBusy(false); });
    return () => { stale = true; };
  }, [players, picks]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setResult(null); setPlayers(null); setPicks({}); setBusy(true);
    try {
      const loaded: Player[] = [];
      for (const id of [a, b]) {
        setLoadingId(id.trim());
        loaded.push(await ensurePlayer(id.trim()));
      }
      setPlayers([loaded[0], loaded[1]]);
      setBusy(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
      setBusy(false);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <>
      <Nav current="pair" />
      <h1>查组合：你们俩一起双排能赢多少？</h1>
      <form className="row panel" onSubmit={submit}>
        <input aria-label="玩家 A" placeholder="玩家 A 的 Riot ID，如 Name#NA1" value={a} onChange={(e) => setA(e.target.value)} required />
        <input aria-label="玩家 B" placeholder="玩家 B 的 Riot ID" value={b} onChange={(e) => setB(e.target.value)} required />
        <button disabled={busy || !a.includes("#") || !b.includes("#")}>预测</button>
      </form>
      {loadingId && (
        <LookupProgress label={`正在读取 ${loadingId} 本赛季的单双排对局…`} hint="第一次查询的玩家大约需要 2 分钟，之后会缓存。" />
      )}
      {!loadingId && busy && <LookupProgress label="正在计算预测胜率…" />}
      {error && <div className="panel error" role="alert">{error}</div>}
      {players?.[0].insufficient_data && !picks.a && (
        <SelfReportForm riotId={players[0].riot_id} champions={champions} onSubmit={(p) => setPicks((x) => ({ ...x, a: p }))} />
      )}
      {players?.[1].insufficient_data && !picks.b && (players[0].insufficient_data ? picks.a : true) && (
        <SelfReportForm riotId={players[1].riot_id} champions={champions} onSubmit={(p) => setPicks((x) => ({ ...x, b: p }))} />
      )}
      {result && <PairResultView r={result} />}
    </>
  );
}
