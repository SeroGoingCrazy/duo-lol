// Server side: which language this request is in (cookie set by the switcher, else Accept-Language).
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { LANG_COOKIE, pickLang, translator } from "@/lib/i18n";

export const getLang = cache(async () =>
  pickLang((await cookies()).get(LANG_COOKIE)?.value, (await headers()).get("accept-language")));

export const getT = cache(async () => translator(await getLang()));
