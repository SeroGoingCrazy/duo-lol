"use client";
import { useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import ChampionIcon from "@/components/ChampionIcon";
import ChampionLabel from "@/components/ChampionLabel";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/components/LangProvider";
import { championName, type ChampionInfo } from "@/lib/champions";
import { cn } from "@/lib/utils";

/** Searchable champion list: matches Chinese name (盲僧), title (李青), English name and id, any case. */
export default function ChampionPicker({ champions, info, value, onChange, label, invalid }: {
  champions: string[]; info: Record<string, ChampionInfo>; value: string; onChange: (c: string) => void;
  label: string; invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const t = useT();
  const keywords = (c: string) => [info[c]?.name, info[c]?.title, info[c]?.english, c].filter(Boolean) as string[];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} aria-label={label} aria-invalid={invalid}
          className={cn("h-10 w-full justify-between px-3 font-normal", invalid && "border-bad")}>
          {value ? <ChampionLabel champion={value} info={info} size={24} /> : <span className="text-muted-foreground">{t("搜索英雄（中文或英文）")}</span>}
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64">
        <Command filter={(item, search, kw) => (kw ?? [item]).some((k) => k.toLowerCase().includes(search.trim().toLowerCase())) ? 1 : 0}>
          <CommandInput placeholder={t.lang === "en" ? "Lee Sin" : "盲僧 / 李青 / Lee Sin"} aria-label={t("{label} 搜索", { label })} />
          <CommandList>
            <CommandEmpty>{t("没有这个英雄")}</CommandEmpty>
            {champions.map((c) => (
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
