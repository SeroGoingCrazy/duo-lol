---
status: accepted
---

# 绑定 Riot ID 先不验证，拿到 RSO 后再验证

取代 ADR-0005 里的头像验证部分（Discord 登录不变）。Jacky 觉得换头像验证太麻烦（2026-10-22）：要进客户端换一个指定头像、等网站读到、再换回来，新会员第一步就卡住。

没有 Production Key 时能证明"这个 Riot 账号是我的"的办法我们看过：Riot Sign On 要 Production Key；Discord 里绑定的 Riot 连接在 2026 年 6 月迁到了 Discord 的新系统，第三方网站已经读不到（discord-api-docs discussion #8430）；Riot 客户端设置里的第三方验证码可以用，但同样要进客户端操作。Jacky 选了先不验证、同时申请 Production Key 和 RSO。

所以现在 **绑定** = 在我的账号里输入 Riot ID，网站查到这个美服账号就立刻绑定，标为 **未验证**（`members.bound_at` 有值、`verified_at` 为空）。之前过了头像验证的会员保留 **已验证**。冒用的收益有限：互选后对方拿到的是 Riot ID，加好友加到的是真号本人；冒用者会被举报（3 人举报自动暂停），真正的号主可以在 Discord 联系管理员，管理员在 /admin 解除那个 Riot ID 的绑定。一个 Riot 账号仍然只能绑定一个会员，会员也可以自己"换一个 Riot ID"解绑。互选列表里未验证的会员显示「未验证」标记。

绑定时网站顺便读到这个账号当前的召唤师头像，作为会员的 **头像**（`members.avatar_icon_id`），会员可以从 Riot 的召唤师头像里另选一个。

拿到 RSO 后：绑定改走 RSO，通过的会员写 `verified_at`；未验证的会员提示去验证，过渡期后不再进推荐池。届时再写一条 ADR 定过渡期。
