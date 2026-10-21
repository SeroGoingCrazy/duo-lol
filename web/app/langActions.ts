"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LANG_COOKIE, type Lang } from "@/lib/i18n";

/** The 中文 / English switch in the nav: remembered for a year. */
export async function setLang(lang: Lang) {
  (await cookies()).set(LANG_COOKIE, lang === "en" ? "en" : "zh", { path: "/", maxAge: 365 * 86_400, sameSite: "lax" });
  revalidatePath("/", "layout");
}
