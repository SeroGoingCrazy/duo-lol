// First lookup of a player fetches up to 100 games under Riot's rate limit (~2 minutes),
// so the bar only says something is happening, not how far along it is.
export default function LookupProgress({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="panel" data-testid="progress" role="status">
      <div>{label}</div>
      <div className="indeterminate" aria-busy="true"><span /></div>
      {hint && <div className="muted">{hint}</div>}
    </div>
  );
}
