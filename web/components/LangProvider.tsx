"use client";
import { createContext, useContext, useMemo } from "react";
import { translator, type Lang, type T } from "@/lib/i18n";

const LangContext = createContext<T>(translator("zh"));

/** The layout picks the language on the server; client components read it with useT(). */
export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const t = useMemo(() => translator(lang), [lang]);
  return <LangContext.Provider value={t}>{children}</LangContext.Provider>;
}

export const useT = () => useContext(LangContext);
