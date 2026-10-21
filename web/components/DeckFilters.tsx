"use client";
import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import ChoiceChip from "@/components/ChoiceChip";
import PositionIcon from "@/components/PositionIcon";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/LangProvider";
import { POSITIONS } from "@/lib/labels";
import { isFiltered, LANGUAGE_LABELS, LANGUAGES, type DeckFilter } from "@/lib/profile";

/** 牌堆 filters (hard filters: they take cards out, never reorder them). Each change is saved and the deck reloads. */
export default function DeckFilters({ filter, onChange }: { filter: DeckFilter; onChange: (f: DeckFilter) => void }) {
  const t = useT();
  const [open, setOpen] = useState(isFiltered(filter));
  const flip = (key: "positions" | "languages", x: string) =>
    onChange({ ...filter, [key]: filter[key].includes(x) ? filter[key].filter((y) => y !== x) : [...filter[key], x] });
  const group = "flex flex-wrap items-center gap-2";
  const label = "w-full text-xs font-medium text-muted-foreground sm:w-20";

  return (
    <div className="rounded-2xl border bg-card p-3" data-testid="deck-filters">
      <Button variant="ghost" className="h-8 gap-2 px-2 text-sm" aria-expanded={open} onClick={() => setOpen(!open)}>
        <SlidersHorizontal className="size-4" />{t("筛选")}
        {isFiltered(filter) && <span className="rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">{t("已开启")}</span>}
      </Button>
      {open && (
        <div className="mt-2 space-y-2 px-2 pb-1">
          <div className={group}>
            <span className={label}>{t("TA 想打")}</span>
            {POSITIONS.map((p) => (
              <ChoiceChip key={p} checked={filter.positions.includes(p)} onChange={() => flip("positions", p)}>
                <PositionIcon position={p} size={16} showLabel />
              </ChoiceChip>
            ))}
          </div>
          <div className={group}>
            <span className={label}>{t("语言")}</span>
            {LANGUAGES.map((l) => (
              <ChoiceChip key={l} checked={filter.languages.includes(l)} onChange={() => flip("languages", l)}>
                <span lang={l}>{LANGUAGE_LABELS[l]}</span>
              </ChoiceChip>
            ))}
          </div>
          <div className={group}>
            <span className={label}>{t("其他")}</span>
            <ChoiceChip checked={filter.voice} onChange={() => onChange({ ...filter, voice: !filter.voice })}>{t("开麦")}</ChoiceChip>
            <ChoiceChip checked={filter.looking_now} onChange={() => onChange({ ...filter, looking_now: !filter.looking_now })}>{t("现在想打")}</ChoiceChip>
          </div>
          <p className="text-xs text-muted-foreground">{t("筛选只决定哪些人出现，顺序仍按预测胜率。喜欢了你的人总会出现。")}</p>
        </div>
      )}
    </div>
  );
}
