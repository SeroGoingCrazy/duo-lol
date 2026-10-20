"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Heart, RotateCcw, X } from "lucide-react";
import CopyButton from "@/components/CopyButton";
import DeckSidebar from "@/components/DeckSidebar";
import LookupProgress from "@/components/LookupProgress";
import Nav from "@/components/Nav";
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
      if (!top || fling || matched || (e.target as HTMLElement).closest("input, textarea, [role=combobox]")) return;
      if (e.key === "ArrowLeft") setFling("pass");
      if (e.key === "ArrowRight") setFling("like");
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
      <Nav current="find" />
      <h1 className="mb-1 text-2xl font-bold tracking-tight lg:text-3xl">找搭子</h1>
      <p className="mb-5 text-sm text-muted-foreground">
        推荐池里能和你一起排的玩家，按搭配评分从高到低一张张发给你。右滑喜欢、左滑跳过，双方都喜欢就互选，互选后才能看到对方的 Riot ID。
      </p>

      <Card className="mb-4 max-w-3xl">
        <form className="flex flex-wrap items-start gap-3" onSubmit={(e) => { e.preventDefault(); if (ready) search(me); }}>
          <RiotIdField label="你的 Riot ID" placeholder="Name#NA1" value={me} onChange={setMe} />
          <Button className="mt-5" disabled={busy || !ready}>开始滑卡</Button>
        </form>
      </Card>

      <div className="space-y-3">
        {loading && <LookupProgress label={loading} hint={loading.startsWith("正在读取") ? "第一次查询的玩家大约需要 2 分钟，之后会缓存。" : undefined} />}
        {error && <Alert variant="error">{error}</Alert>}
        {player && <SelfReportForm className="max-w-3xl" player={player} champions={champions} onSubmit={(r) => recommend(player, r)} />}
        {partners && partners.length === 0 && <Alert>推荐池里暂时没有能和你一起排的玩家。</Alert>}
      </div>

      {partners && partners.length > 0 && (
        <div className="mt-2 grid gap-6 lg:grid-cols-[minmax(16rem,22rem)_minmax(0,30rem)] lg:justify-center" data-testid="deck">
          <DeckSidebar className="max-h-72 lg:h-[32rem] lg:max-h-none" mutual={mutual} likes={likes} onOpen={(p) => setFocus(cardKey(p))} />

          <div className="flex flex-col items-center gap-4">
            <div className="relative h-[32rem] w-full max-w-[30rem]">
              {top ? (
                <>
                  {behind && <div className="absolute inset-0 translate-y-2 scale-[0.97] rounded-2xl border bg-card opacity-60" aria-hidden />}
                  <div className="absolute inset-0">
                    <SwipeCard key={cardKey(top)} p={top} info={info} fling={fling} onSwiped={swiped} likesYou={likesYou(top)} />
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

            <div className="flex items-center gap-5" data-testid="gamepad">
              <Button variant="outline" className="size-12 rounded-full p-0" aria-label="撤销上一次跳过" disabled={!log.lastPass || !!fling} onClick={undo}>
                <RotateCcw />
              </Button>
              <Button variant="outline" className="size-16 rounded-full p-0 text-bad [&_svg]:size-7" aria-label="跳过" disabled={!top || !!fling} onClick={() => setFling("pass")}>
                <X />
              </Button>
              <Button variant="outline" className="size-16 rounded-full p-0 text-good [&_svg]:size-7" aria-label="喜欢" disabled={!top || !!fling} onClick={() => setFling("like")}>
                <Heart />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              拖动卡片或用 ← → 键滑卡，点卡片左右两半翻页。还剩 {remaining.length} 张。
            </p>
          </div>
        </div>
      )}

      {notes.map((n) => <p key={n} className="mt-3 text-xs text-muted-foreground">* {n}</p>)}
      {partners && (
        <p className="mt-3 text-xs text-muted-foreground">
          演示版：滑卡记录只存在这个浏览器里；搭配评分 50 以上的玩家视为也喜欢了你。登录功能上线后换成真实会员。
        </p>
      )}

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
