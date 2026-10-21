"use client";
import { useT } from "@/components/LangProvider";
import { cn } from "@/lib/utils";

// Drawn after the in-game position icons: a lane corner for top/bottom, the diagonal for mid.
const PATHS: Record<string, React.ReactNode> = {
  TOP: (<><path d="M3 3h14l-4 4H7v6l-4 4z" /><path d="M10 10h4v4h-4z" opacity=".55" /><path d="M21 7v14H7l3-3h8V10z" opacity=".35" /></>),
  BOTTOM: (<><path d="M21 21H7l4-4h6v-6l4-4z" /><path d="M10 10h4v4h-4z" opacity=".55" /><path d="M3 17V3h14l-3 3H6v8z" opacity=".35" /></>),
  MIDDLE: (<><path d="M17 3h4v4L7 21H3v-4z" /><path d="M3 3h8L7 7v4H3z M21 21h-8l4-4v-4h4z" opacity=".35" /></>),
  JUNGLE: (<path d="M12 2c-1 4-4 6-4 10 0 2 1 3.5 2 4.5-2-.5-4-2-5-4.5 0 5 3 9 7 10 4-1 7-5 7-10-1 2.5-3 4-5 4.5 1-1 2-2.5 2-4.5 0-4-3-6-4-10z" />),
  UTILITY: (<><path d="M9 3h6l-1 6h-4z" /><path d="M2 7h7l1 3-3 3zM22 7h-7l-1 3 3 3z" /><path d="M10 11h4l1 5-3 5-3-5z" /></>),
};

/** Position icon with its name for screen readers (and as visible text when showLabel). */
export default function PositionIcon({ position, size = 20, showLabel = false, className }:
  { position: string; size?: number; showLabel?: boolean; className?: string }) {
  const label = useT().position(position);
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} title={label} data-position={position}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden className="shrink-0 text-gold">
        {PATHS[position] ?? <circle cx="12" cy="12" r="6" />}
      </svg>
      {showLabel ? <span>{label}</span> : <span className="sr-only">{label}</span>}
    </span>
  );
}
