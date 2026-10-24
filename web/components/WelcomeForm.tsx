"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { savePrefs } from "@/app/account/actions";
import { Feedback, NONE } from "@/components/AccountForms";
import ChoiceChip from "@/components/ChoiceChip";
import PositionIcon from "@/components/PositionIcon";
import { useT } from "@/components/LangProvider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trackFunnel } from "@/lib/analytics";
import { POSITIONS } from "@/lib/labels";

export default function WelcomeForm({ positions: initialPositions, alreadyJoined }: { positions: string[]; alreadyJoined: boolean }) {
  const [positions, setPositions] = useState(initialPositions);
  // Keep this initial value: saving consent revalidates this page. A server redirect at that point
  // would discard the action result before the existing recommendation_enabled event can be sent.
  const [joinedOnEntry] = useState(alreadyJoined);
  const [step, setStep] = useState(1);
  const [consent, setConsent] = useState(false);
  const [state, save, saving] = useActionState(savePrefs, NONE);
  const heading = useRef<HTMLHeadingElement>(null);
  const router = useRouter();
  const t = useT();

  useEffect(() => {
    if (!state.ok) return;
    if (state.recommendationEnabled) trackFunnel("recommendation_enabled");
    if (state.next) router.push(state.next);
  }, [state, router]);

  useEffect(() => {
    if (joinedOnEntry) router.replace("/find");
  }, [joinedOnEntry, router]);

  useEffect(() => { heading.current?.focus(); }, [step]);

  function toggle(position: string) {
    setPositions((current) => current.includes(position)
      ? current.filter((p) => p !== position)
      : current.length < 2 ? [...current, position] : current);
  }

  if (joinedOnEntry) return null;

  return (
    <Card data-testid="welcome-onboarding">
      <ol className="mb-6 grid grid-cols-2 gap-3 text-sm" aria-label={t("找搭子步骤")}>
        {["选择想打的位置", "加入推荐池"].map((label, index) => (
          <li key={label} aria-current={step === index + 1 ? "step" : undefined} className="flex items-center gap-2">
            <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step >= index + 1 ? "bg-neon-a/15 text-neon-a" : "bg-muted text-muted-foreground"}`}>
              {step > index + 1 ? <Check className="size-4" aria-label={t("已完成")} /> : index + 1}
            </span>
            {t(label)}
          </li>
        ))}
      </ol>
      <h2 ref={heading} tabIndex={-1} className="mb-3 text-lg font-semibold outline-none">
        {step === 1 ? t("选择想打的位置") : t("加入推荐池")}
      </h2>
      {step === 1 ? (
        <div>
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{t("最多选 2 个位置；不选表示都可以，之后随时能在我的账号修改。")}</p>
          <fieldset>
            <legend className="sr-only">{t("想打的位置（最多 2 个）")}</legend>
            <div className="flex flex-wrap gap-2">
              {POSITIONS.map((position) => (
                <ChoiceChip key={position} checked={positions.includes(position)}
                  disabled={!positions.includes(position) && positions.length >= 2} onChange={() => toggle(position)}>
                  <PositionIcon position={position} size={18} showLabel />
                </ChoiceChip>
              ))}
            </div>
          </fieldset>
          <Button className="mt-6 w-full" onClick={() => setStep(2)}>{t("下一步：加入推荐池")}<ArrowRight /></Button>
        </div>
      ) : (
        <form action={save} className="space-y-4">
          {positions.map((position) => <input key={position} type="hidden" name="positions" value={position} />)}
          <p className="text-sm leading-relaxed text-muted-foreground">{t("你的卡片会出现在其他会员的牌堆里，只有双方都喜欢才会互选。你可以随时在我的账号退出推荐池。")}</p>
          <label className="flex items-start gap-3 rounded-xl border p-4 text-sm" data-testid="recommendation-consent">
            <input type="checkbox" name="recommend_opt_in" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 size-4 shrink-0" />
            <span><span className="font-semibold">{t("同意被推荐")}</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{t("Riot ID 和联系方式只在互选后展示。")}</span>
            </span>
          </label>
          <Feedback state={state} />
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" disabled={saving} onClick={() => setStep(1)}><ArrowLeft />{t("上一步")}</Button>
            <Button name="intent" value="welcome" className="flex-1" disabled={saving || !consent}>
              {saving ? t("保存中…") : t("保存并开始找搭子")}<ArrowRight />
            </Button>
          </div>
          <Button name="intent" value="welcome_demo" variant="ghost" className="w-full" disabled={saving}>{t("暂时不加入，体验演示")}</Button>
        </form>
      )}
    </Card>
  );
}
