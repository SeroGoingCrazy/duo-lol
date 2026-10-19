// First lookup of a player fetches up to 100 games under Riot's rate limit (~2 minutes).
export default function LookupProgress({ label, done, total }: { label: string; done: number; total: number }) {
  return (
    <div className="panel" data-testid="progress">
      <div>正在读取 {label} 本赛季的单双排对局… {total ? `${done} / ${total}` : "查找账号中"}</div>
      <progress value={done} max={total || 1} />
      <div className="muted">第一次查询的玩家大约需要 2 分钟，之后会缓存。</div>
    </div>
  );
}
