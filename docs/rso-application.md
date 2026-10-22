# 申请 Production Key 和 RSO（草稿）

ADR-0011：拿到 RSO 前绑定不验证。这份是提交申请时要填的内容，Jacky 在 developer.riotgames.com 登录后自己提交。Riot 的表单字段会变，以页面上实际要求为准；下面英文部分可以直接粘贴。

## 提交前要准备好

- [ ] 网站已经部署在正式域名上（`docs/deploy.md`），首页、查组合、找搭子能打开。Riot 审核要看能用的产品，不接受只有想法的申请。
- [ ] `/riot.txt` 返回开发者后台给的验证码（设置 `RIOT_VERIFICATION`，见 `docs/deploy.md`）。
- [ ] 页脚有 Riot 法律声明（已有，在全站页脚）、`/privacy` 和 `/terms` 能打开。
- [ ] 3 到 5 张截图：查组合结果页、找搭子滑卡页、互选列表、我的账号页（绑定和头像）。
- [ ] 网站不收费、不卖 Riot 数据、不显示 MMR 或隐藏分（我们的搭配评分不是 MMR，页脚和隐私政策已写明）。

## 步骤

1. 开发者后台 → **Register Product** → 选 **Production API Key**（不是 Personal：Personal Key 不能给公众用，也不能接 RSO）。
2. 按下面的内容填产品信息。
3. 在申请里写明需要 **Riot Sign On (RSO)**，填回调地址。RSO 的 client ID 和 secret 批下来后放进 Vercel 的环境变量（之后会加到 `web/.env.example`）。
4. 等审核。审核期间开发者 Key 照常每天换。

## 产品信息（英文，可粘贴）

**Product name**: LoL Duo Finder

**Product URL**: `https://<正式域名>`

**Game**: League of Legends (NA only)

**Description**:

> LoL Duo Finder helps North American League of Legends players find a Ranked Solo/Duo partner. Given two Riot IDs, it predicts how the pair would do together in Ranked Solo/Duo from their public match history (roles, champion pool and champion-pair synergy, using an explainable additive rating model adapted from the open-source DraftGap project), and suggests the best role split and champion pairs. Logged-in members can opt in to a recommendation pool and swipe through potential partners ranked by predicted win rate; Riot IDs are revealed only after both players like each other. The site is free, has no ads or paid features, and does not show MMR or any hidden rating.

**APIs used**:

> ACCOUNT-V1 (Riot ID to PUUID), SUMMONER-V4 (profile icon for the member's avatar), LEAGUE-V4 (Solo/Duo rank), MATCH-V5 (Ranked Solo/Duo match history, queue 420 only, NA/americas). Match data is cached; we never re-fetch a match we already have, and all calls go through a single worker that honors rate limits and Retry-After.

**Why RSO**:

> Members link their Riot account so other players can add them after a mutual match. Today members type their Riot ID and the account is shown as "unverified". We want RSO so members can prove the account is theirs in one click, which stops people from posing as someone else's account. We only need the `openid` scope to read the PUUID of the signed-in account; we do not need any other scope.

**RSO redirect URI**: `https://<正式域名>/api/auth/callback/riot`

**Expected traffic**:

> Prototype stage, under 1,000 members at launch. Most traffic is cached; new players need about 20 to 40 MATCH-V5 calls on their first lookup.

**Privacy policy**: `https://<正式域名>/privacy`  **Terms**: `https://<正式域名>/terms`

## 批下来以后

- Python 服务的 `RIOT_API_KEY` 换成 Production Key，不用每天换了。
- 网站加 RSO 登录（Auth.js 自定义 OAuth provider），验证通过写 `members.verified_at`，同时停用 OP.GG 数据源（PRD-v2 M4）。
- 再写一条 ADR 定未验证会员的过渡期。
