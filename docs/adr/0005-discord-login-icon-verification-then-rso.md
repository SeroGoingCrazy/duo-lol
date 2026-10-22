---
status: superseded in part by ADR-0011 (头像验证)
---

# 先用 Discord 登录加头像验证绑定 Riot 账号，拿到 RSO 后替换

Riot Sign On（RSO）是证明"这个 Riot 账号是我的"的正规方式，但只对拿到 Production Key 的应用开放，原型阶段用不了。在那之前：会员用 Discord 登录（玩家普遍有，且互选后可以直接当联系方式），再输入 Riot ID，网站随机指定一个召唤师头像让他在客户端换上，worker 读到头像一致即绑定。这是很多第三方 LoL 网站在用的做法，不需要存密码。只靠输入 Riot ID 不验证不可接受，因为任何人都能冒用别人的账号进推荐池。拿到 RSO 后，绑定改走 RSO，Discord 登录可以保留为可选。
