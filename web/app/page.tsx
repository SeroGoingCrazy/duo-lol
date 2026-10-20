"use client";
import { useEffect, useRef, useState } from "react";
import Nav from "@/components/Nav";
import LookupProgress from "@/components/LookupProgress";
import PairResultView from "@/components/PairResultView";
import RiotIdField from "@/components/RiotIdField";
import SelfReportForm from "@/components/SelfReportForm";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ApiError, ensurePlayer, listChampions, predictPair, riotIdKey, riotIdProblem,
  type PairResult, type Player, type SelfReport,
} from "@/lib/api";

const FIRST_LOOKUP_HINT = "第一次查询的玩家大约需要 2 分钟，之后会缓存。";

export default function PairPage() {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);   // player being read
  const [error, setError] = useState("");
  const [result, setResult] = useState<PairResult | null>(null);
  const [players, setPlayers] = useState<[Player, Player] | null>(null);
  const [reports, setReports] = useState<{ a?: SelfReport; b?: SelfReport }>({});
  const [drafts, setDrafts] = useState<{ a?: SelfReport; b?: SelfReport }>({});   // last 自选英雄, prefilled on 修改
  const [champions, setChampions] = useState<string[]>([]);
  const started = useRef(false);

  const same = a.includes("#") && b.includes("#") && riotIdKey(a) === riotIdKey(b);
  const ready = !riotIdProblem(a) && !riotIdProblem(b) && a.trim() !== "" && b.trim() !== "" && !same;

  useEffect(() => { listChampions().then(setChampions).catch(() => setChampions([])); }, []);

  // A shared link (?a=...&b=...) fills the form and runs at once.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const q = new URLSearchParams(window.location.search);
    const qa = q.get("a"), qb = q.get("b");
    if (qa && qb) { setA(qa); setB(qb); load(qa, qb); }
  }, []);

  // Once both players are loaded, predict as soon as everyone 数据不足 has 自选英雄.
  useEffect(() => {
    if (!players) return;
    const [pa, pb] = players;
    if ((pa.insufficient_data && !reports.a) || (pb.insufficient_data && !reports.b)) return;
    let stale = false;   // a newer submit replaces players; ignore this answer then
    setBusy(true);
    predictPair(pa.riot_id, pb.riot_id, reports.a, reports.b)
      .then((r) => { if (!stale) setResult(r); })
      .catch((e) => { if (!stale) setError(e instanceof ApiError ? e.message : String(e)); })
      .finally(() => { if (!stale) setBusy(false); });
    return () => { stale = true; };
  }, [players, reports]);

  async function load(idA: string, idB: string) {
    setError(""); setResult(null); setPlayers(null); setReports({}); setDrafts({}); setBusy(true);
    const url = new URL(window.location.href);
    url.searchParams.set("a", idA.trim()); url.searchParams.set("b", idB.trim());
    window.history.replaceState(null, "", url);
    try {
      const loaded: Player[] = [];
      for (const id of [idA, idB]) {
        setLoadingId(id.trim());
        loaded.push(await ensurePlayer(id.trim()));
      }
      setPlayers([loaded[0], loaded[1]]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setLoadingId(null);
      setBusy(false);
    }
  }

  const needs = players ? (["a", "b"] as const).filter((k, i) => players[i].insufficient_data) : [];
  const pending = needs.filter((k) => !reports[k]);

  return (
    <>
      <Nav current="pair" />
      <h1 className="mb-1 text-2xl font-bold tracking-tight">查组合</h1>
      <p className="mb-5 text-sm text-muted-foreground">输入两个美服 Riot ID，看你们一起打单双排的搭配评分和最佳英雄组合。</p>

      <Card className="mb-4">
        <form className="flex flex-wrap items-start gap-3" onSubmit={(e) => { e.preventDefault(); if (ready) load(a, b); }}>
          <RiotIdField label="玩家 A" placeholder="Name#NA1" value={a} onChange={setA} />
          <RiotIdField label="玩家 B" placeholder="Name#NA1" value={b} onChange={setB}
            error={same ? "两个 Riot ID 是同一个人，请填另一位玩家" : null} />
          <Button className="mt-5" disabled={busy || !ready}>预测</Button>
        </form>
      </Card>

      <div className="space-y-4">
        {loadingId && <LookupProgress label={`正在读取 ${loadingId} 本赛季的单双排对局…`} hint={FIRST_LOOKUP_HINT} />}
        {!loadingId && busy && <LookupProgress label="正在计算搭配评分…" />}
        {error && <Alert variant="error">{error}</Alert>}

        {players && pending.slice(0, 1).map((k) => (
          <SelfReportForm key={k} player={players[k === "a" ? 0 : 1]} champions={champions} initial={drafts[k]}
            step={needs.length > 1 ? `第 ${needs.indexOf(k) + 1} / ${needs.length} 位玩家` : undefined}
            onSubmit={(r) => setReports((x) => ({ ...x, [k]: r }))} />
        ))}

        {result && pending.length === 0 && (
          <>
            <PairResultView r={result} />
            {needs.length > 0 && (
              <Button variant="outline" onClick={() => { setResult(null); setDrafts(reports); setReports({}); }}>修改自选英雄</Button>
            )}
          </>
        )}
      </div>
    </>
  );
}
