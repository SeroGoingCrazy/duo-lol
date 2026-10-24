"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useT } from "@/components/LangProvider";
import { Button } from "@/components/ui/button";

/** Copies text; label defaults to 复制 ID, for Riot IDs. */
export default function CopyButton({ text, label, onClick }: { text: string | (() => string); label?: string; onClick?: () => void }) {
  const [done, setDone] = useState(false);
  const t = useT();
  return (
    <Button type="button" variant="outline" size="sm" aria-label={typeof text === "string" && !label ? t("复制 {id}", { id: text }) : undefined}
      onClick={() => {
        onClick?.();
        void navigator.clipboard?.writeText(typeof text === "string" ? text : text())
          .then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }).catch(() => {});
      }}>
      {done ? <Check /> : <Copy />}{done ? t("已复制") : label ?? t("复制 ID")}
    </Button>
  );
}
