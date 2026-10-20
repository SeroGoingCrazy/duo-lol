import { Card } from "@/components/ui/card";

// First lookup of a player fetches up to 100 games under Riot's rate limit (~2 minutes),
// so the bar only says something is happening, not how far along it is.
export default function LookupProgress({ label, hint }: { label: string; hint?: string }) {
  return (
    <Card data-testid="progress" role="status" className="space-y-3">
      <div className="text-sm">{label}</div>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-muted" aria-busy="true">
        <span className="animate-indeterminate absolute inset-y-0 left-0 w-2/5 rounded-full bg-primary" />
      </div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}
