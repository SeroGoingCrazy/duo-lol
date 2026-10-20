"use client";
import { Input } from "@/components/ui/input";
import { riotIdProblem } from "@/lib/api";

/** Riot ID input that explains the 名字#标签 format instead of silently disabling the button. */
export default function RiotIdField({ label, value, onChange, placeholder, error }:
  { label: string; value: string; onChange: (v: string) => void; placeholder: string; error?: string | null }) {
  const problem = error ?? riotIdProblem(value);
  const id = `rid-${label}`;
  return (
    <div className="min-w-0 flex-1 space-y-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">{label}</label>
      <Input id={id} aria-label={label} placeholder={placeholder} value={value} autoComplete="off"
        aria-invalid={!!problem} aria-describedby={problem ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)} />
      {problem && <div id={`${id}-hint`} className="text-xs text-bad">{problem}</div>}
    </div>
  );
}
