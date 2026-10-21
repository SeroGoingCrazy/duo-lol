"use client";
import { useActionState, useState } from "react";
import { BadgeCheck } from "lucide-react";
import { cancelVerification, checkVerification, deleteAccount, savePrefs, startVerification, type ActionState } from "@/app/account/actions";
import PositionIcon from "@/components/PositionIcon";
import RiotIdField from "@/components/RiotIdField";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { POSITIONS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { useT } from "@/components/LangProvider";

const NONE: ActionState = {};

function Feedback({ state }: { state: ActionState }) {
  const t = useT();
  if (state.error) return <Alert variant="error" className="mt-3">{t.api(state.error)}</Alert>;
  if (state.ok) return <p className="mt-3 text-sm text-good" role="status">{t.api(state.ok)}</p>;
  return null;
}

/** 绑定 Riot 账号 with 头像验证 (ADR-0005): enter the Riot ID, wear the icon we pick, then 验证. */
export function BindRiotCard({ riotId, pending }: {
  riotId: string | null;
  pending: { riotId: string; iconId: number; iconUrl: string } | null;
}) {
  const [id, setId] = useState("");
  const t = useT();
  const [started, start, starting] = useActionState(startVerification, NONE);
  const [checked, check, checking] = useActionState(checkVerification, NONE);

  if (riotId) {
    return (
      <Card data-testid="bind-riot">
        <CardTitle>{t("Riot 账号")}</CardTitle>
        <div className="flex items-center gap-2">
          <span className="font-semibold" data-testid="bound-riot-id">{riotId}</span>
          <Badge className="bg-good/15 text-good"><BadgeCheck className="size-3.5" />{t("已验证")}</Badge>
        </div>
        <Feedback state={checked} />
      </Card>
    );
  }

  if (pending) {
    return (
      <Card data-testid="bind-riot">
        <CardTitle>{t("验证 {id}", { id: pending.riotId })}</CardTitle>
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pending.iconUrl} alt={t("召唤师头像 #{n}", { n: pending.iconId })} width={64} height={64} className="rounded-lg border" />
          <div className="text-sm">
            <p>{t("在游戏客户端里把召唤师头像换成这个（")}<b data-testid="challenge-icon">#{pending.iconId}</b>{t("，所有账号都有），换好后点验证。")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("10 分钟内有效。验证成功后可以换回原来的头像。")}</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <form action={check}><Button disabled={checking}>{checking ? t("验证中…") : t("验证")}</Button></form>
          <form action={cancelVerification}><Button variant="ghost">{t("换一个 Riot ID")}</Button></form>
        </div>
        <Feedback state={checked} />
      </Card>
    );
  }

  return (
    <Card data-testid="bind-riot">
      <CardTitle>{t("绑定 Riot 账号")}</CardTitle>
      <form action={start} className="flex flex-wrap items-start gap-3">
        <input type="hidden" name="riot_id" value={id} />
        <RiotIdField label={t("你的 Riot ID")} placeholder="Name#NA1" value={id} onChange={setId} />
        <Button className="mt-5 w-full sm:w-auto" disabled={starting || !id.trim()}>{starting ? t("查询中…") : t("下一步")}</Button>
      </form>
      <p className="mt-3 text-xs text-muted-foreground">{t("只能绑定美服账号。为了确认账号是你的，下一步会请你换一个指定的召唤师头像。")}</p>
      <Feedback state={started} />
    </Card>
  );
}

/** 偏好: 想打的位置 (up to 2), 同意被推荐 (off by default) and whether 互选 shows the Discord name. */
export function PrefsCard({ verified, prefs, discordName }: {
  verified: boolean;
  prefs: { positions: string[]; recommendOptIn: boolean; showDiscord: boolean };
  discordName: string;
}) {
  const [positions, setPositions] = useState(prefs.positions);
  const t = useT();
  const [state, save, saving] = useActionState(savePrefs, NONE);
  const toggle = (p: string) =>
    setPositions((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : cur.length < 2 ? [...cur, p] : cur));

  return (
    <Card data-testid="prefs">
      <CardTitle>{t("偏好")}</CardTitle>
      {!verified ? (
        <p className="text-sm text-muted-foreground">{t("绑定 Riot 账号后才能设置偏好、进入推荐池。")}</p>
      ) : (
        <form action={save} className="space-y-4">
          <fieldset>
            <legend className="mb-2 text-xs font-medium text-muted-foreground">{t("想打的位置（最多 2 个）")}</legend>
            <div className="flex flex-wrap gap-2">
              {POSITIONS.map((p) => {
                const on = positions.includes(p);
                return (
                  <label key={p} className={cn("flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors",
                    on ? "bg-accent font-semibold" : "text-muted-foreground hover:text-foreground",
                    !on && positions.length >= 2 && "cursor-not-allowed opacity-50")}>
                    <input type="checkbox" name="positions" value={p} checked={on} onChange={() => toggle(p)}
                      disabled={!on && positions.length >= 2} className="sr-only" />
                    <PositionIcon position={p} size={18} showLabel />
                  </label>
                );
              })}
            </div>
          </fieldset>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="recommend_opt_in" defaultChecked={prefs.recommendOptIn} className="mt-1" />
            <span>{t("同意被推荐")}<span className="block text-xs text-muted-foreground">{t("勾选后你会出现在别人的牌堆里；随时可以关掉，关掉后立刻退出推荐池。")}</span></span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="show_discord" defaultChecked={prefs.showDiscord} className="mt-1" />
            <span>{t("互选后给对方看我的 Discord 名（{name}）", { name: discordName })}<span className="block text-xs text-muted-foreground">{t("不勾选的话，对方只看到你的 Riot ID。")}</span></span>
          </label>
          <Button disabled={saving}>{saving ? t("保存中…") : t("保存")}</Button>
        </form>
      )}
      <Feedback state={state} />
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
            <form action={deleteAccount}><Button className="bg-bad text-white hover:bg-bad/90">{t("确认注销")}</Button></form>
            <Button variant="ghost" onClick={() => setConfirming(false)}>{t("取消")}</Button>
          </>
        ) : (
          <Button variant="outline" onClick={() => setConfirming(true)}>{t("注销账号")}</Button>
        )}
      </div>
    </Card>
  );
}
