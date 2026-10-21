"use client";
import { useEffect, useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import ChampionIcon from "@/components/ChampionIcon";
import ChampionLabel from "@/components/ChampionLabel";
import PositionIcon from "@/components/PositionIcon";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/components/LangProvider";
import { POSITIONS, listChampionPositions } from "@/lib/api";
import { championName, type ChampionInfo } from "@/lib/champions";
import { cn } from "@/lib/utils";

const ALL = "ALL";

/** Searchable champion list: matches Chinese name (盲僧), title (李青), English name and id, any case.
 *  Position tabs above the list keep only champions commonly played there (/api/champion-positions);
 *  it opens on the row's position when one is chosen, and typing a name searches every champion. */
export default function ChampionPicker({ champions, info, value, onChange, label, invalid, position }: {
  champions: string[]; info: Record<string, ChampionInfo>; value: string; onChange: (c: string) => void;
  label: string; invalid?: boolean; position?: string;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(ALL);
  const [search, setSearch] = useState("");
  const [positions, setPositions] = useState<Record<string, string[]>>({});
  const t = useT();
  useEffect(() => { listChampionPositions().then(setPositions); }, []);
  const hasPositions = Object.keys(positions).length > 0;
  const keywords = (c: string) => [info[c]?.name, info[c]?.title, info[c]?.english, c].filter(Boolean) as string[];
  const shown = tab === ALL ? champions : champions.filter((c) => positions[c]?.includes(tab));

  function toggle(next: boolean) {
    if (next) {
      setTab(position && hasPositions ? position : ALL);
      setSearch("");
    }
    setOpen(next);
  }

  const tabButton = (key: string, content: React.ReactNode, name: string) => (
    <button key={key} type="button" role="tab" aria-selected={tab === key} aria-label={name} title={name}
      onClick={() => { setTab(key); setSearch(""); }}
      className={cn("flex cursor-pointer items-center justify-center rounded-md px-2 py-1 text-xs transition-colors",
        tab === key ? "bg-accent font-semibold text-foreground" : "text-muted-foreground hover:text-foreground")}>
      {content}
    </button>
  );

  return (
    <Popover open={open} onOpenChange={toggle}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} aria-label={label} aria-invalid={invalid}
          className={cn("h-10 w-full justify-between px-3 font-normal", invalid && "border-bad")}>
          {value ? <ChampionLabel champion={value} info={info} size={24} /> : <span className="text-muted-foreground">{t("搜索英雄（中文或英文）")}</span>}
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64">
        <Command filter={(item, q, kw) => (kw ?? [item]).some((k) => k.toLowerCase().includes(q.trim().toLowerCase())) ? 1 : 0}>
          <CommandInput value={search} onValueChange={(v) => { setSearch(v); if (v.trim()) setTab(ALL); }}
            placeholder={t.lang === "en" ? "Lee Sin" : "盲僧 / 李青 / Lee Sin"} aria-label={t("{label} 搜索", { label })} />
          {hasPositions && (
            <div role="tablist" aria-label={t("按位置筛选")} data-testid="champion-position-tabs" className="flex flex-wrap gap-1 border-b p-1">
              {tabButton(ALL, t("全部"), t("全部"))}
              {POSITIONS.map((pos) => tabButton(pos, <PositionIcon position={pos} size={16} showLabel />, t.position(pos)))}
            </div>
          )}
          <CommandList>
            <CommandEmpty>{t("没有这个英雄")}</CommandEmpty>
            {shown.map((c) => (
              <CommandItem key={c} value={c} keywords={keywords(c)} onSelect={() => { onChange(c); setOpen(false); }}>
                <ChampionIcon champion={c} size={24} />
                <span>{championName(info, c, t.lang)}</span>
                {info[c] && t.lang === "zh" && <span className="text-xs text-muted-foreground">{info[c].title} · {info[c].english}</span>}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
