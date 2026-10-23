"use client";
import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BadgeCheck, CircleHelp } from "lucide-react";
import { bindRiot, deleteAccount, savePrefs, unbindRiot, type ActionState } from "@/app/account/actions";
import PositionIcon from "@/components/PositionIcon";
import RiotIdField from "@/components/RiotIdField";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import ChoiceChip from "@/components/ChoiceChip";
import { POSITIONS } from "@/lib/labels";
import { BIO_MAX, LANGUAGE_LABELS, LANGUAGES, PLAY_TIME_LABELS, PLAY_TIMES, toggled, type Voice } from "@/lib/profile";
import { cn } from "@/lib/utils";
import { useT } from "@/components/LangProvider";
import { trackFunnel } from "@/lib/analytics";

export const NONE: ActionState = {};

export function Feedback({ state }: { state: ActionState }) {
  const t = useT();
  if (state.error) return <Alert variant="error" className="mt-3">{t.api(state.error)}</Alert>;
  if (state.ok) return <p className="mt-3 text-sm text-good" role="status">{t.api(state.ok)}</p>;
  return null;
}

/** 绑定 Riot 账号 (ADR-0011): type the Riot ID and it is bound, 未验证 until Riot Sign On can prove it. */
export function BindRiotCard({ riotId, verified }: { riotId: string | null; verified: boolean }) {
  const [id, setId] = useState("");
  const t = useT();
  const [bound, bind, binding] = useActionState(bindRiot, NONE);
  const [unbound, unbind, unbinding] = useActionState(unbindRiot, NONE);
  useEffect(() => {
    if (bound.ok) trackFunnel("riot_bound");
  }, [bound]);

  if (riotId) {
    return (
      <Card data-testid="bind-riot">
        <CardTitle>{t("Riot 账号")}</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold" data-testid="bound-riot-id">{riotId}</span>
          <RiotVerifiedBadge verified={verified} />
        </div>
        {!verified && (
          <p className="mt-2 text-xs text-muted-foreground">{t("Riot 官方登录（RSO）开通后，可以一键验证这个账号是你的。冒用别人的账号会被举报下架。")}</p>
        )}
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link href="#recommendation">{t("下一步：偏好与推荐")}<ArrowRight /></Link>
        </Button>
        <form action={unbind} className="mt-4"><Button variant="outline" size="sm" disabled={unbinding}>{t("换一个 Riot ID")}</Button></form>
        <p className="mt-2 text-xs text-muted-foreground">{t("换号会结束你现在的互选。")}</p>
        <Feedback state={unbound.error ? unbound : bound} />
      </Card>
    );
  }

  return (
    <Card data-testid="bind-riot">
      <CardTitle>{t("绑定 Riot 账号")}</CardTitle>
      <form action={bind} className="flex flex-wrap items-start gap-3">
        <input type="hidden" name="riot_id" value={id} />
        <RiotIdField label={t("你的 Riot ID")} placeholder="Name#NA1" value={id} onChange={setId} />
        <Button className="mt-5 w-full sm:w-auto" disabled={binding || !id.trim()}>{binding ? t("查询中…") : t("绑定")}</Button>
      </form>
      <p className="mt-3 text-xs text-muted-foreground">{t("只能绑定美服账号，输入后马上生效，头像会自动换成你游戏里的召唤师头像。")}</p>
      <Feedback state={bound} />
    </Card>
  );
}

/** 已验证 when Riot proved the account (RSO, or the old 头像验证); 未验证 when the 会员 only typed it. */
export function RiotVerifiedBadge({ verified }: { verified: boolean }) {
  const t = useT();
  return verified
    ? <Badge className="bg-good/15 text-good" data-testid="riot-verified"><BadgeCheck className="size-3.5" />{t("已验证")}</Badge>
    : <Badge className="bg-gold/15 text-gold" data-testid="riot-unverified"><CircleHelp className="size-3.5" />{t("未验证")}</Badge>;
}

/** 偏好: 想打的位置 (up to 2), 同意被推荐 (off by default) and whether 互选 shows the Discord name. */
export type PrefsValues = {
  positions: string[]; recommendOptIn: boolean; showDiscord: boolean; notifyDiscord: boolean;
  bio: string; languages: string[]; voice: Voice | null; playTimes: string[];
};

export function PrefsCard({ bound, suspended = false, prefs, discordName }: {
  bound: boolean;
  suspended?: boolean;
  prefs: PrefsValues;
  discordName: string;
}) {
  const [positions, setPositions] = useState(prefs.positions);
  const [languages, setLanguages] = useState(prefs.languages);
  const [voice, setVoice] = useState(prefs.voice ?? "");
  const [playTimes, setPlayTimes] = useState(prefs.playTimes);
  const [bio, setBio] = useState(prefs.bio);
  const [recommendOptIn, setRecommendOptIn] = useState(prefs.recommendOptIn);
  const t = useT();
  const [state, save, saving] = useActionState(savePrefs, NONE);
  const router = useRouter();
  useEffect(() => {
    if (!state.ok) return;
    if (state.recommendationEnabled) trackFunnel("recommendation_enabled");
    if (state.next) router.push(state.next);
  }, [state, router]);
  const toggle = (p: string) =>
    setPositions((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : cur.length < 2 ? [...cur, p] : cur));
  const flip = (set: React.Dispatch<React.SetStateAction<string[]>>, x: string) => set((cur) => toggled(cur, x));
  const legend = "mb-2 text-xs font-medium text-muted-foreground";

  return (
    <Card data-testid="prefs">
      <CardTitle>{t("偏好与推荐")}</CardTitle>
      {!bound ? (
        <p className="text-sm text-muted-foreground">{t("绑定 Riot 账号后才能设置偏好、进入推荐池。")}</p>
      ) : (
        <form action={save} className="space-y-4">
          <label className="flex items-start gap-3 rounded-xl border border-neon-a/30 bg-neon-a/5 p-4 text-sm" data-testid="recommendation-consent">
            <input type="checkbox" name="recommend_opt_in" checked={recommendOptIn} onChange={(e) => setRecommendOptIn(e.target.checked)} className="mt-1 size-4 shrink-0" />
            <span><span className="font-semibold">{t("同意被推荐")}</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{t("勾选并保存后，你会出现在别人的牌堆里；取消勾选并保存后，立刻退出推荐池。")}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{t("Riot ID 和联系方式只在互选后展示。")}</span>
            </span>
          </label>
          <fieldset>
            <legend className={legend}>{t("想打的位置（最多 2 个）")}</legend>
            <div className="flex flex-wrap gap-2">
              {POSITIONS.map((p) => {
                const on = positions.includes(p);
                return (
                  <ChoiceChip key={p} name="positions" value={p} checked={on} onChange={() => toggle(p)} disabled={!on && positions.length >= 2}>
                    <PositionIcon position={p} size={18} showLabel />
                  </ChoiceChip>
                );
              })}
            </div>
          </fieldset>
          <div className="flex flex-wrap items-center gap-3 border-b pb-4">
            <Button name="intent" value="find" disabled={saving || !recommendOptIn || suspended}>
              {saving ? t("保存中…") : t("保存并开始找搭子")}<ArrowRight />
            </Button>
            <p className="text-xs text-muted-foreground">{t("下面的资料都可选，可以稍后完善。")}</p>
          </div>
          <Feedback state={state} />
          <label className="block">
            <span className={cn(legend, "flex justify-between")}><span>{t("简介（会显示在卡片上）")}</span><span className="tabular-nums">{bio.length} / {BIO_MAX}</span></span>
            <textarea name="bio" rows={2} maxLength={BIO_MAX} value={bio} onChange={(e) => setBio(e.target.value)}
              placeholder={t("例如：晚上打，主玩辅助，想找稳一点的 ADC")} className="w-full rounded-md border bg-background p-2 text-sm" />
            <span className="block text-xs text-muted-foreground">{t("不要写联系方式，互选后对方才看得到你的 Riot ID。")}</span>
          </label>
          <fieldset>
            <legend className={legend}>{t("语言")}</legend>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map((l) => (
                <ChoiceChip key={l} name="languages" value={l} checked={languages.includes(l)} onChange={() => flip(setLanguages, l)}>
                  <span lang={l}>{LANGUAGE_LABELS[l]}</span>
                </ChoiceChip>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className={legend}>{t("语音")}</legend>
            <div className="flex flex-wrap gap-2">
              {([["voice", "开麦"], ["text", "只打字"], ["", "不说"]] as const).map(([v, label]) => (
                <ChoiceChip key={v || "none"} type="radio" name="voice" value={v} checked={voice === v} onChange={() => setVoice(v)}>{t(label)}</ChoiceChip>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className={legend}>{t("常玩时间（你的当地时间）")}</legend>
            <div className="flex flex-wrap gap-2">
              {PLAY_TIMES.map((p) => (
                <ChoiceChip key={p} name="play_times" value={p} checked={playTimes.includes(p)} onChange={() => flip(setPlayTimes, p)}>{t(PLAY_TIME_LABELS[p])}</ChoiceChip>
              ))}
            </div>
          </fieldset>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="show_discord" defaultChecked={prefs.showDiscord} className="mt-1" />
            <span>{t("互选后给对方看我的 Discord 名（{name}）", { name: discordName })}<span className="block text-xs text-muted-foreground">{t("不勾选的话，对方只看到你的 Riot ID。")}</span></span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="notify_discord" defaultChecked={prefs.notifyDiscord} className="mt-1" />
            <span>{t("有新的互选时用 Discord 私信通知我")}<span className="block text-xs text-muted-foreground">{t("需要先加入网站的 Discord 服务器，机器人才能私信你。网站导航上也会显示新的互选和喜欢。")}</span></span>
          </label>
          <Button disabled={saving}>{saving ? t("保存中…") : t("保存")}</Button>
        </form>
      )}
    </Card>
  );
}

/** 注销: removes the 会员 and everything stored about them on this site. */
export function DeleteAccountCard() {
  const [confirming, setConfirming] = useState(false);
  const t = useT();
  return (
    <Card data-testid="delete-account">
      <CardTitle>{t("注销账号")}</CardTitle>
      <p className="text-sm text-muted-foreground">{t("删除你的会员资料、绑定和偏好，不能恢复。查组合缓存的公开对局数据不受影响。")}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {confirming ? (
          <>
            <form action={deleteAccount}><Button className="bg-bad bg-none text-white shadow-none hover:bg-bad/90">{t("确认注销")}</Button></form>
            <Button variant="ghost" onClick={() => setConfirming(false)}>{t("取消")}</Button>
          </>
        ) : (
          <Button variant="outline" onClick={() => setConfirming(true)}>{t("注销账号")}</Button>
        )}
      </div>
    </Card>
  );
}
