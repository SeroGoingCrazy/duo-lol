"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useT } from "@/components/LangProvider";
import { Button } from "@/components/ui/button";

export default function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  const t = useT();
  return (
    <Button type="button" variant="outline" size="sm" aria-label={t("复制 {id}", { id: text })}
      onClick={() => navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); })}>
      {done ? <Check /> : <Copy />}{done ? t("已复制") : t("复制 ID")}
    </Button>
  );
}
