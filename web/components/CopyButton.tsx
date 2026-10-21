"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useT } from "@/components/LangProvider";
import { Button } from "@/components/ui/button";

/** Copies text; label defaults to 复制 ID, for Riot IDs. */
export default function CopyButton({ text, label }: { text: string | (() => string); label?: string }) {
  const [done, setDone] = useState(false);
  const t = useT();
  return (
    <Button type="button" variant="outline" size="sm" aria-label={label ? undefined : t("复制 {id}", { id: String(text) })}
      onClick={() => navigator.clipboard?.writeText(typeof text === "string" ? text : text())
        .then(() => { setDone(true); setTimeout(() => setDone(false), 1500); })}>
      {done ? <Check /> : <Copy />}{done ? t("已复制") : label ?? t("复制 ID")}
    </Button>
  );
}
