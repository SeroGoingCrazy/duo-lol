"use client";
import { useEffect, useRef, useState } from "react";
import Nav from "@/components/Nav";
import LookupProgress from "@/components/LookupProgress";
import PartnerCard from "@/components/PartnerCard";
import RiotIdField from "@/components/RiotIdField";
import { ScoreHelp } from "@/components/ScoreBadge";
import SelfReportForm from "@/components/SelfReportForm";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ApiError, ensurePlayer, findPartners, listChampions, riotIdProblem, type Partner, type Player, type SelfReport } from "@/lib/api";
import { useChampionInfo } from "@/lib/useChampionInfo";

export default function FindPage() {
  const info = useChampionInfo();
  const [me, setMe] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [player, setPlayer] = useState<Player | null>(null);   // set while 数据不足 waits for 自选英雄
  const [partners, setPartners] = useState<Partner[] | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [champions, setChampions] = useState<string[]>([]);
  const started = useRef(false);
  const ready = me.trim() !== "" && !riotIdProblem(me);

  useEffect(() => { listChampions().then(setChampions).catch(() => setChampions([])); }, []);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const q = new URLSearchParams(window.location.search).get("me");
    if (q) { setMe(q); search(q); }
  }, []);

  async function recommend(p: Player, report?: SelfReport) {
    setPlayer(null); setBusy(true); setLoading("正在从推荐池里找搭子…");
    try {
      const out = await findPartners(p.riot_id, report);
      setPartners(out.partners); setNotes(out.notes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false); setLoading("");
    }
  }

  async function search(id: string) {
    setError(""); setPartners(null); setPlayer(null); setNotes([]); setBusy(true);
    const url = new URL(window.location.href);
    url.searchParams.set("me", id.trim());
    window.history.replaceState(null, "", url);
    try {
      setLoading(`正在读取 ${id.trim()} 本赛季的单双排对局…`);
      const p = await ensurePlayer(id.trim());
      setLoading(""); setBusy(false);
      if (p.insufficient_data) setPlayer(p);   // ask for 自选英雄 first
      else await recommend(p);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
      setBusy(false); setLoading("");
    }
  }

  return (
    <>
      <Nav current="find" />
      <h1 className="mb-1 text-2xl font-bold tracking-tight lg:text-3xl">找搭子</h1>
      <p className="mb-5 text-sm text-muted-foreground">从推荐池里找出和你双排评分最高的 5 位玩家（只列能和你一起排的段位）。</p>

      <Card className="mb-4 max-w-3xl">
        <form className="flex flex-wrap items-start gap-3" onSubmit={(e) => { e.preventDefault(); if (ready) search(me); }}>
          <RiotIdField label="你的 Riot ID" placeholder="Name#NA1" value={me} onChange={setMe} />
          <Button className="mt-5" disabled={busy || !ready}>找搭子</Button>
        </form>
      </Card>

      <div className="space-y-3">
        {loading && <LookupProgress label={loading} hint={loading.startsWith("正在读取") ? "第一次查询的玩家大约需要 2 分钟，之后会缓存。" : undefined} />}
        {error && <Alert variant="error">{error}</Alert>}
        {player && <SelfReportForm className="max-w-3xl" player={player} champions={champions} onSubmit={(r) => recommend(player, r)} />}
        {partners && partners.length === 0 && <Alert>推荐池里暂时没有能和你一起排的玩家。</Alert>}
        {partners && partners.length > 0 && (
          <>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">按搭配评分从高到低 <ScoreHelp /></div>
            <ol className="grid gap-3 xl:grid-cols-2" data-testid="partners">
              {partners.map((p, i) => <li key={p.riot_id} className="min-w-0"><PartnerCard p={p} rank={i + 1} info={info} /></li>)}
            </ol>
            <p className="text-xs text-muted-foreground">
              网站不提供联系方式：复制对方的 Riot ID，在游戏客户端里加好友邀请双排。
            </p>
          </>
        )}
        {notes.map((n) => <p key={n} className="text-xs text-muted-foreground">* {n}</p>)}
      </div>
    </>
  );
}
