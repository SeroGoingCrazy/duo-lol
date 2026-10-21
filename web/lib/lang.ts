// Server side: which language this request is in (the cookie the nav switch sets, else 中文).
import { cache } from "react";
import { cookies } from "next/headers";
import { LANG_COOKIE, pickLang, translator } from "@/lib/i18n";

export const getLang = cache(async () => pickLang((await cookies()).get(LANG_COOKIE)?.value));

export const getT = cache(async () => translator(await getLang()));
