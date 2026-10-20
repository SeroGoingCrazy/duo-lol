"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Heart, RotateCcw, Sparkles, X } from "lucide-react";
import CopyButton from "@/components/CopyButton";
import DeckSidebar from "@/components/DeckSidebar";
import LookupProgress from "@/components/LookupProgress";
import RiotIdField from "@/components/RiotIdField";
import SelfReportForm from "@/components/SelfReportForm";
import SwipeCard from "@/components/SwipeCard";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ApiError, ensurePlayer, findPartners, listChampions, riotIdProblem, type Partner, type Player, type SelfReport } from "@/lib/api";
import { cardKey, DECK_SIZE, likesYou, loadSwipes, saveSwipes, type Swipe, type SwipeLog } from "@/lib/deck";
import { tierLabel } from "@/lib/labels";
import { useChampionInfo } from "@/lib/useChampionInfo";

export default function FindPage() {
  const info = useChampionInfo();
  const [me, setMe] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [player, setPlayer] = useState<Player | null>(null);   // set while 数据不足 waits for 自选英雄
  const [deckOwner, setDeckOwner] = useState("");             // whose 牌堆 is showing
  const [partners, setPartners] = useState<Partner[] | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [champions, setChampions] = useState<string[]>([]);
  const [log, setLog] = useState<SwipeLog>({ swipes: {}, lastPass: null });
  const [focus, setFocus] = useState<string | null>(null);   // a card opened from 喜欢我的人 or brought back by 撤销
  const [fling, setFling] = useState<Swipe | null>(null);
  const [matched, setMatched] = useState<Partner | null>(null);
  const started = useRef(false);
  const ready = me.trim() !== "" && !riotIdProblem(me);

  useEffect(() => { listChampions().then(setChampions).catch(() => setChampions([])); }, []);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const q = new URLSearchParams(window.location.search).get("me");
    if (q) { setMe(q); search(q); }
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  const remaining = useMemo(() => (partners ?? []).filter((p) => !log.swipes[cardKey(p)]), [partners, log]);
  const top = (focus && remaining.find((p) => cardKey(p) === focus)) || remaining[0] || null;
  const behind = remaining.find((p) => p !== top) ?? null;
  const mutual = (partners ?? []).filter((p) => log.swipes[cardKey(p)] === "like" && likesYou(p));
  const likes = remaining.filter(likesYou);

  function update(next: SwipeLog) {
    setLog(next);
    saveSwipes(deckOwner, next);
  }

  function swiped(s: Swipe) {
    if (!top) return;
    const k = cardKey(top);
    update({ swipes: { ...log.swipes, [k]: s }, lastPass: s === "pass" ? k : null });
    setFling(null);
    setFocus(null);
    if (s === "like" && likesYou(top)) setMatched(top);
  }

  function undo() {
    if (fling) return;
    const k = log.lastPass;
    if (!k) return;
    const swipes = { ...log.swipes };
    delete swipes[k];
    update({ swipes, lastPass: null });
    setFocus(k);
  }

  function restart() {
    update({ swipes: {}, lastPass: null });
    setFocus(null);
  }

  // ← 跳过, → 喜欢, as on Tinder's web app; not while typing in a field
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!top || fling || matched || e.repeat || e.altKey || e.ctrlKey || e.metaKey || (e.target as HTMLElement).closest("input, textarea, button, a, [contenteditable], [role=combobox], [role=tab]")) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        setFling(e.key === "ArrowLeft" ? "pass" : "like");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [top, fling, matched]);

  async function recommend(p: Player, report?: SelfReport) {
    setPlayer(null); setBusy(true); setLoading("正在从推荐池里准备你的牌堆…");
    try {
      const out = await findPartners(p.riot_id, report, DECK_SIZE);
      setDeckOwner(p.riot_id);
      setLog(loadSwipes(p.riot_id));
      setFocus(null);
      setPartners(out.partners); setNotes(out.notes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false); setLoading("");
    }
  }

  async function search(id: string) {
    setFling(null);
    setError(""); setPartners(null); setPlayer(null); setNotes([]); setMatched(null); setBusy(true);
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
      <div className="mx-auto max-w-6xl">
      <div className={`${partners ? "mb-3 sm:mb-6" : "mb-6"} flex flex-wrap items-end justify-between gap-4`}>
        <div>
          <div className={`${partners ? "hidden sm:flex" : "flex"} mb-2 items-center gap-1.5 text-xs font-medium text-primary`}><Sparkles className="size-3.5" />找到合拍的下一局</div>
          <h1 className="text-3xl font-bold tracking-tight">找搭子</h1>
          <p className={`${partners ? "hidden sm:block" : ""} mt-2 text-sm text-muted-foreground`}>看看搭配，选个队友。右滑喜欢，左滑跳过。</p>
        </div>
        {partners && <span className="rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground">美服 · 单双排 <span className="mx-1 text-border">/</span> 演示版</span>}
      </div>

      <details open={partners ? undefined : true} className="mb-3 rounded-2xl border bg-card p-4 sm:mb-6" key={partners ? "loaded" : "search"}>
        <summary className="cursor-pointer text-sm font-medium">{partners ? <><span className="text-muted-foreground">当前玩家</span> <span className="mx-2">{deckOwner}</span><span className="text-xs text-primary">更换玩家</span></> : "从你的 Riot ID 开始"}</summary>
        <form className="mt-3 flex flex-wrap items-start gap-3" onSubmit={(e) => { e.preventDefault(); if (ready && !busy) search(me); }}>
          <RiotIdField label="你的 Riot ID" placeholder="Name#NA1" value={me} onChange={setMe} />
          <Button className="mt-5 w-full sm:w-auto" disabled={busy || !ready}>开始滑卡</Button>
        </form>
      </details>

      <div className="space-y-3">
        {loading && <LookupProgress label={loading} hint={loading.startsWith("正在读取") ? "第一次查询的玩家大约需要 2 分钟，之后会缓存。" : undefined} />}
        {error && <Alert variant="error">{error}</Alert>}
        {player && <SelfReportForm className="max-w-3xl" player={player} champions={champions} onSubmit={(r) => recommend(player, r)} />}
        {partners && partners.length === 0 && <Alert>推荐池里暂时没有能和你一起排的玩家。</Alert>}
      </div>

      {partners && partners.length > 0 && (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start" data-testid="deck">
          <div className="swipe-stage min-w-0 rounded-3xl px-2 pb-5 pt-4 sm:px-6">
            <div className="mx-auto mb-4 flex max-w-[30rem] items-center justify-between px-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">为你推荐 <span className="ml-2 font-normal text-muted-foreground">按预测胜率排序</span></span>
              <span aria-live="polite">剩余 {remaining.length} / {partners.length}</span>
            </div>
            <div className="relative mx-auto h-[33rem] max-w-[30rem] sm:h-[35rem]">
              {top ? (
                <>
                  {behind && <><div className="absolute inset-x-6 inset-y-0 translate-y-4 rounded-3xl border bg-card opacity-40" aria-hidden /><div className="absolute inset-x-3 inset-y-0 translate-y-2 rounded-3xl border bg-card opacity-80" aria-hidden /></>}
                  <div className="absolute inset-0">
                    <SwipeCard key={cardKey(top)} p={top} info={info} fling={fling} onSwipeStart={setFling} onSwiped={swiped} likesYou={likesYou(top)} />
                  </div>
                </>
              ) : (
                <Card className="flex h-full flex-col items-center justify-center gap-3 text-center" data-testid="deck-empty">
                  <p className="font-semibold">暂时没有更多搭子了</p>
                  <p className="text-sm text-muted-foreground">推荐池有新玩家时会出现新的卡片。也可以去查组合，直接算你和某个人的分数。</p>
                  <div className="flex gap-2">
                    <Button variant="outline" asChild><a href="/">去查组合</a></Button>
                    <Button variant="outline" onClick={restart}>重新开始</Button>
                  </div>
                </Card>
              )}
            </div>

            <div className="mt-7 flex items-end justify-center gap-7" data-testid="gamepad">
              <div className="flex flex-col items-center gap-2">
              <Button variant="outline" className="size-12 rounded-full bg-card p-0 text-muted-foreground" aria-label="撤销上一次跳过" disabled={!log.lastPass || !!fling} onClick={undo}>
                <RotateCcw className="size-5!" />
              </Button>
              <span className="text-xs text-muted-foreground">撤销</span>
              </div>
              <div className="flex flex-col items-center gap-2">
              <Button variant="outline" className="size-16 rounded-full bg-card p-0 shadow-sm hover:border-bad/40 hover:bg-bad/10 hover:text-bad" aria-label="跳过" disabled={!top || !!fling} onClick={() => setFling("pass")}>
                <X className="size-7!" />
              </Button>
              <span className="text-xs text-muted-foreground">跳过</span>
              </div>
              <div className="flex flex-col items-center gap-2">
              <Button className="size-16 rounded-full bg-good p-0 text-white shadow-lg shadow-good/20 hover:bg-good/90" aria-label="喜欢" disabled={!top || !!fling} onClick={() => setFling("like")}>
                <Heart className="size-7!" />
              </Button>
              <span className="text-xs text-muted-foreground">喜欢</span>
              </div>
            </div>
            <p className="mt-5 flex items-center justify-center gap-2 text-[11px] text-muted-foreground"><ArrowLeft className="size-3" /> 左滑跳过 <span className="mx-1">·</span> 右滑喜欢 <ArrowRight className="size-3" /><span className="hidden sm:inline">，也可使用方向键</span></p>
          </div>
          <DeckSidebar className="max-h-96 lg:mt-12 lg:max-h-[35rem]" mutual={mutual} likes={likes} disabled={!!fling} onOpen={(p) => { if (!fling) setFocus(cardKey(p)); }} />
        </div>
      )}

      {notes.map((n) => <p key={n} className="mt-3 text-xs text-muted-foreground">* {n}</p>)}
      {partners && (
        <p className="mt-3 text-xs text-muted-foreground">
          演示版：滑卡记录只存在这个浏览器里；搭配评分 50 以上的玩家视为也喜欢了你。登录功能上线后换成真实会员。
        </p>
      )}
      </div>

      {matched && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="match-title" data-testid="match-dialog">
          <Card className="w-full max-w-sm space-y-4 text-center">
            <h2 id="match-title" className="text-2xl font-bold text-good">互选成功</h2>
            <p className="text-sm text-muted-foreground">你们互相喜欢了。在游戏客户端里加对方好友，一起排位吧。</p>
            <div className="space-y-1">
              <div className="text-lg font-semibold" data-testid="match-riot-id">{matched.riot_id}</div>
              <div className="text-xs text-muted-foreground">{tierLabel(matched.tier, matched.division)} · 搭配评分 {matched.score ?? "–"}</div>
            </div>
            <div className="flex justify-center gap-2">
              <CopyButton text={matched.riot_id} />
              <Button autoFocus onClick={() => setMatched(null)}>继续滑</Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
