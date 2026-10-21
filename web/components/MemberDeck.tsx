"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import DeckStage from "@/components/DeckStage";
import LookupProgress from "@/components/LookupProgress";
import SelfReportForm from "@/components/SelfReportForm";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import {
  ApiError, blockMember, cancelMutualLike, ensurePlayer, getDeck, listChampions, postSwipe, reportMember, saveSelfReport,
  undoSwipe, type DeckCard, type Player,
} from "@/lib/api";
import type { Swipe } from "@/lib/deck";
import { REPORT_REASONS } from "@/lib/reportReasons";
import { useChampionInfo } from "@/lib/useChampionInfo";

const RETRY_MAX_S = 600;   // an empty 牌堆 retries with 1.5x backoff up to this (PRD-v2 §2.1)

/** 找搭子 for a bound 会员 who 同意被推荐: real 喜欢 / 跳过 against other 会员 (PRD-v2 §3.2-3.4). */
export default function MemberDeck({ riotId }: { riotId: string }) {
  const info = useChampionInfo();
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [needPicks, setNeedPicks] = useState<Player | null>(null);
  const [champions, setChampions] = useState<string[]>([]);
  const [cards, setCards] = useState<DeckCard[] | null>(null);
  const [total, setTotal] = useState(0);
  const [likers, setLikers] = useState<Set<string>>(new Set());
  const [mutual, setMutual] = useState<DeckCard[]>([]);
  const [likesLeft, setLikesLeft] = useState<number | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [reporting, setReporting] = useState<DeckCard | null>(null);
  const swiped = useRef(new Map<string, DeckCard>());   // so 撤销 can put the card back without a reload
  const backoff = useRef<{ wait: number; timer: ReturnType<typeof setTimeout> | null }>({ wait: 0, timer: null });
  const me = useRef<Player | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading("正在从推荐池里准备你的牌堆…");
    try {
      const d = await getDeck();
      setCards(d.cards); setTotal(d.cards.length); setLikers(new Set(d.likes_you)); setMutual(d.mutual);
      setLikesLeft(d.likes_remaining); setCanUndo(d.can_undo); setNeedPicks(null); setError("");
      const b = backoff.current;
      if (b.timer) clearTimeout(b.timer);
      if (d.cards.length === 0 && d.retry_after) {
        b.wait = Math.min(RETRY_MAX_S, b.wait ? b.wait * 1.5 : d.retry_after);
        b.timer = setTimeout(() => load(true), b.wait * 1000);
      } else b.wait = 0;
    } catch (e) {
      if (e instanceof ApiError && e.status === 422 && me.current) setNeedPicks(me.current);
      else setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setLoading("");
    }
  }, []);

  useEffect(() => {
    listChampions().then(setChampions).catch(() => setChampions([]));
    (async () => {
      try {
        setLoading(`正在读取 ${riotId} 本赛季的单双排对局…`);
        me.current = await ensurePlayer(riotId);
        await load();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : String(e));
        setLoading("");
      }
    })();
    const b = backoff.current;
    return () => { if (b.timer) clearTimeout(b.timer); };
  }, [riotId, load]);

  const remove = (id: string) => {
    setCards((cs) => cs?.filter((c) => c.id !== id) ?? cs);
    setMutual((ms) => ms.filter((c) => c.id !== id));
  };

  // Optimistic like Tinder's web app: the card leaves at once and comes back if the server refuses.
  async function onSwipe(c: DeckCard, s: Swipe) {
    setCards((cs) => cs?.filter((x) => x.id !== c.id) ?? cs);
    swiped.current.set(c.id, c);
    try {
      const r = await postSwipe(c.id, s);
      setLikesLeft(r.likes_remaining);
      setCanUndo(s === "pass");
      setError("");
      if (!r.match) return null;
      const matched = { ...c, ...r.match };
      setMutual((ms) => [matched, ...ms]);
      setLikers((l) => { const n = new Set(l); n.delete(c.id); return n; });
      return matched;
    } catch (e) {
      setCards((cs) => (cs ? [c, ...cs] : [c]));
      setError(e instanceof ApiError ? e.message : String(e));
      return null;
    }
  }

  async function onUndo() {
    try {
      const { undone } = await undoSwipe();
      setCanUndo(false);
      const c = swiped.current.get(undone);
      if (c) { setCards((cs) => (cs ? [c, ...cs] : [c])); return undone; }
      await load(true);   // swiped in an earlier visit: reload to get the card back
      return undone;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
      return null;
    }
  }

  async function act(fn: () => Promise<unknown>, id: string) {
    try { await fn(); remove(id); } catch (e) { setError(e instanceof ApiError ? e.message : String(e)); }
  }

  const small = "h-7 px-2 text-xs text-muted-foreground";
  const safety = (c: DeckCard) => <>
    <Button variant="ghost" className={small} onClick={() => act(() => blockMember(c.id), c.id)}>拉黑</Button>
    <Button variant="ghost" className={small} onClick={() => setReporting(c)}>举报</Button>
  </>;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-4 sm:mb-6">
        <div>
          <div className="mb-2 hidden items-center gap-1.5 text-xs font-medium text-primary sm:flex"><Sparkles className="size-3.5" />找到合拍的下一局</div>
          <h1 className="text-3xl font-bold tracking-tight">找搭子</h1>
          <p className="mt-2 hidden text-sm text-muted-foreground sm:block">推荐池里都是同意被推荐的会员。右滑喜欢，左滑跳过，互相喜欢后才能看到对方的 Riot ID。</p>
        </div>
        <span className="rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground" data-testid="deck-owner">
          {riotId}{likesLeft != null && <><span className="mx-1 text-border">/</span>今天还能喜欢 {likesLeft} 次</>}
        </span>
      </div>

      <div className="space-y-3">
        {loading && <LookupProgress label={loading} hint={loading.startsWith("正在读取") ? "第一次查询大约需要 2 分钟，之后会缓存。" : undefined} />}
        {error && <Alert variant="error">{error}</Alert>}
        {needPicks && <SelfReportForm className="max-w-3xl" player={needPicks} champions={champions}
          onSubmit={async (r) => { try { await saveSelfReport(r); await load(); } catch (e) { setError(e instanceof ApiError ? e.message : String(e)); } }} />}
      </div>

      {cards && (
        <DeckStage remaining={cards} total={total} mutual={mutual} likes={cards.filter((c) => likers.has(c.id))} info={info}
          canUndo={canUndo} onSwipe={onSwipe} onUndo={onUndo} cardActions={safety} paused={!!reporting}
          mutualActions={(c) => <>
            <Button variant="ghost" className={small} onClick={() => act(() => cancelMutualLike(c.id), c.id)}>取消互选</Button>
            {safety(c)}
          </>}
          empty={<>
            <p className="font-semibold">暂时没有更多搭子了</p>
            <p className="text-sm text-muted-foreground">有新会员加入时会自动出现新的卡片。也可以去查组合，直接算你和某个人的分数。</p>
            <Button variant="outline" asChild><a href="/">去查组合</a></Button>
          </>} />
      )}

      {reporting && <ReportDialog card={reporting} onClose={() => setReporting(null)}
        onSubmit={async (reason, detail) => { await act(() => reportMember(reporting.id, reason, detail), reporting.id); setReporting(null); }} />}
    </div>
  );
}

function ReportDialog({ card, onClose, onSubmit }: {
  card: DeckCard; onClose: () => void; onSubmit: (reason: string, detail: string) => Promise<void>;
}) {
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="report-title" data-testid="report-dialog">
      <Card className="w-full max-w-sm space-y-4">
        <CardTitle id="report-title">举报{card.riot_id ? ` ${card.riot_id}` : "这名会员"}</CardTitle>
        <p className="text-xs text-muted-foreground">举报会同时拉黑对方，管理员会人工处理。对方不会知道是谁举报的。</p>
        <fieldset className="space-y-2">
          <legend className="sr-only">理由</legend>
          {REPORT_REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm">
              <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} />{r}
            </label>
          ))}
        </fieldset>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">补充说明（可选）</span>
          <textarea className="w-full rounded-md border bg-background p-2 text-sm" rows={3} maxLength={500} value={detail} onChange={(e) => setDetail(e.target.value)} />
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button disabled={busy} onClick={async () => { setBusy(true); await onSubmit(reason, detail); }}>提交举报</Button>
        </div>
      </Card>
    </div>
  );
}
