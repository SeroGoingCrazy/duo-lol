"use client";
import { useEffect, useRef, useState } from "react";
import HomeHero from "@/components/HomeHero";
import FunnelEvent from "@/components/FunnelEvent";
import PlayerCard from "@/components/PlayerCard";
import { useChampionInfo } from "@/lib/useChampionInfo";
import { trackFunnel } from "@/lib/analytics";
import LookupProgress from "@/components/LookupProgress";
import PairResultView from "@/components/PairResultView";
import RiotIdField from "@/components/RiotIdField";
import SelfReportForm from "@/components/SelfReportForm";
import { useT } from "@/components/LangProvider";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ApiError, ensurePlayer, listChampions, predictPair, riotIdKey, riotIdProblem,
  type PairResult, type Player, type SelfReport, type LookupUpdate,
} from "@/lib/api";

type PairFailure =
  | { stage: "lookup"; ids: [string, string]; loaded: Player[] }
  | { stage: "prediction" };

export default function PairPage() {
  const t = useT();
  const info = useChampionInfo();
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);   // player being read
  const [progress, setProgress] = useState<LookupUpdate | null>(null);
  const [loadedPlayers, setLoadedPlayers] = useState<Player[]>([]);
  const [showHero, setShowHero] = useState(true);
  const [error, setError] = useState("");
  const [failure, setFailure] = useState<PairFailure | null>(null);
  const [predictionAttempt, setPredictionAttempt] = useState(0);
  const [result, setResult] = useState<PairResult | null>(null);
  const [players, setPlayers] = useState<[Player, Player] | null>(null);
  const [reports, setReports] = useState<{ a?: SelfReport; b?: SelfReport }>({});
  const [drafts, setDrafts] = useState<{ a?: SelfReport; b?: SelfReport }>({});   // last 自选英雄, prefilled on 修改
  const [champions, setChampions] = useState<string[]>([]);
  const started = useRef(false);
  const lookupGeneration = useRef(0);
  const mounted = useRef(true);
  const checkSection = useRef<HTMLElement>(null);

  const same = a.includes("#") && b.includes("#") && riotIdKey(a) === riotIdKey(b);
  const ready = !riotIdProblem(a) && !riotIdProblem(b) && a.trim() !== "" && b.trim() !== "" && !same;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => { listChampions().then(setChampions).catch(() => setChampions([])); }, []);

  // Shared pairs run at once; a member's single-ID link leaves the friend field ready to fill.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const q = new URLSearchParams(window.location.search);
    const qa = q.get("a"), qb = q.get("b");
    if (qa) {
      setShowHero(false); setA(qa);
      if (qb) { setB(qb); load(qa, qb); }
      else checkSection.current?.querySelectorAll<HTMLInputElement>("input")[1]?.focus();
    }
  }, []);

  // Once both players are loaded, predict as soon as everyone 数据不足 has 自选英雄.
  useEffect(() => {
    if (!players) return;
    const [pa, pb] = players;
    if ((pa.insufficient_data && !reports.a) || (pb.insufficient_data && !reports.b)) return;
    let stale = false;   // a newer submit replaces players; ignore this answer then
    const generation = lookupGeneration.current;
    const active = () => !stale && mounted.current && generation === lookupGeneration.current;
    setBusy(true); setError(""); setFailure(null);
    predictPair(pa.riot_id, pb.riot_id, reports.a, reports.b)
      .then((r) => { if (active()) { setResult(r); trackFunnel("pair_completed", "public"); } })
      .catch((e) => {
        if (active()) {
          setError(e instanceof ApiError ? e.message : String(e));
          setFailure({ stage: "prediction" });
        }
      })
      .finally(() => { if (active()) setBusy(false); });
    return () => { stale = true; };
  }, [players, reports, predictionAttempt]);

  async function load(idA: string, idB: string, resume: Player[] = []) {
    const generation = ++lookupGeneration.current;
    const active = () => mounted.current && generation === lookupGeneration.current;
    const ids: [string, string] = [idA.trim(), idB.trim()];
    const loaded = [...resume];
    setShowHero(false); setProgress(null); setLoadedPlayers([...loaded]);
    trackFunnel("pair_started", "public");
    setError(""); setFailure(null); setResult(null); setPlayers(null); setBusy(true);
    if (resume.length === 0) { setReports({}); setDrafts({}); }
    const url = new URL(window.location.href);
    url.searchParams.set("a", ids[0]); url.searchParams.set("b", ids[1]);
    window.history.replaceState(null, "", url);
    try {
      // A retry resumes the failed player lookup and keeps completed player previews.
      for (const id of ids.slice(loaded.length)) {
        setProgress(null);
        setLoadingId(id);
        const player = await ensurePlayer(id, (update) => { if (active()) setProgress(update); });
        if (!active()) return;
        loaded.push(player);
        setLoadedPlayers([...loaded]);
      }
      setPlayers([loaded[0], loaded[1]]);
    } catch (err) {
      if (!active()) return;
      setError(err instanceof ApiError ? err.message : String(err));
      setFailure({ stage: "lookup", ids, loaded });
    } finally {
      if (active()) { setLoadingId(null); setBusy(false); }
    }
  }

  function changeId(side: "a" | "b", value: string) {
    const previous = side === "a" ? a : b;
    if (side === "a") setA(value); else setB(value);
    if (riotIdKey(previous) === riotIdKey(value)) return;
    // Changing the requested players starts a new check; late answers belong to the old one.
    lookupGeneration.current += 1;
    setBusy(false); setLoadingId(null); setProgress(null); setLoadedPlayers([]);
    setError(""); setFailure(null); setResult(null); setPlayers(null); setReports({}); setDrafts({});
  }

  function retry() {
    if (!failure || busy) return;
    if (failure.stage === "lookup") load(...failure.ids, failure.loaded);
    else setPredictionAttempt((attempt) => attempt + 1);
  }

  function editReports() {
    setError(""); setFailure(null); setResult(null); setDrafts(reports); setReports({});
  }

  const needs = players ? (["a", "b"] as const).filter((k, i) => players[i].insufficient_data) : [];
  const pending = needs.filter((k) => !reports[k]);
  const CheckHeading = showHero ? "h2" : "h1";

  return (
    <>
      <FunnelEvent event="home_viewed" mode="public" />
      {showHero && <HomeHero />}
      <section ref={checkSection} id="duo-check" className="scroll-mt-6" aria-labelledby="duo-check-title">
      <CheckHeading id="duo-check-title" className="mb-1 text-2xl font-bold tracking-tight lg:text-3xl">{t("查组合")}</CheckHeading>
      <p className="mb-5 text-sm text-muted-foreground">{t("输入两个美服 Riot ID，看你们一起打单双排的搭配评分和最佳英雄组合。")}</p>

      <Card className="mb-4">
        <form className="flex flex-wrap items-start gap-3" onSubmit={(e) => { e.preventDefault(); if (ready && !busy) load(a, b); }}>
          <RiotIdField label={t("玩家 A")} placeholder="Name#NA1" value={a} onChange={(value) => changeId("a", value)} />
          <RiotIdField label={t("玩家 B")} placeholder="Name#NA1" value={b} onChange={(value) => changeId("b", value)}
            error={same ? t("两个 Riot ID 是同一个人，请填另一位玩家") : null} />
          <Button className="mt-5 w-full sm:w-auto" disabled={busy || !ready}>{t("预测")}</Button>
        </form>
      </Card>
      </section>

      <div className="flex flex-col gap-4">
        {loadingId && <LookupProgress label={t("正在查询 {id}…", { id: loadingId })} hint={t("第一次查询的玩家大约需要 2 分钟，之后会缓存。")} progress={progress} />}
        {!result && loadedPlayers.length > 0 && <div className="grid gap-3 sm:grid-cols-2" data-testid="loaded-player-previews">{loadedPlayers.map((player) => <PlayerCard key={player.riot_id} player={player} info={info} />)}</div>}
        {!loadingId && busy && <LookupProgress label={t("正在计算搭配评分…")} />}
        {error && <Alert variant="error">
          <p>{t.api(error)}</p>
          <p className="mt-1">{t("输入和已加载的资料已保留，可以直接重试。")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy} onClick={retry}>{t(failure?.stage === "prediction" ? "重试评分" : "重试查询")}</Button>
            {failure?.stage === "prediction" && needs.length > 0 && <Button variant="outline" onClick={editReports}>{t("修改自选英雄")}</Button>}
          </div>
        </Alert>}

        {players && pending.slice(0, 1).map((k) => (
          <SelfReportForm key={k} className="max-w-3xl" player={players[k === "a" ? 0 : 1]} champions={champions} initial={drafts[k]}
            step={needs.length > 1 ? t("第 {n} / {total} 位玩家", { n: needs.indexOf(k) + 1, total: needs.length }) : undefined}
            onSubmit={(r) => setReports((x) => ({ ...x, [k]: r }))} />
        ))}

        {result && pending.length === 0 && (
          <>
            <PairResultView r={result} enteredIds={[a.trim(), b.trim()]} shareable={needs.length === 0} />
            {needs.length > 0 && (
              <Button variant="outline" className="self-start" onClick={editReports}>{t("修改自选英雄")}</Button>
            )}
          </>
        )}
      </div>
    </>
  );
}
