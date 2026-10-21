// Server side: which language this request is in (cookie set by the switcher, else Accept-Language).
import { cookies, headers } from "next/headers";
import { LANG_COOKIE, pickLang, translator } from "@/lib/i18n";

export async function getLang() {
  return pickLang((await cookies()).get(LANG_COOKIE)?.value, (await headers()).get("accept-language"));
}

export async function getT() {
  return translator(await getLang());
}
