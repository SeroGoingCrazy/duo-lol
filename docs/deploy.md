# 部署

PRD-v2 §6 的方案：网站在 Vercel，Python API 在 Fly.io（美东），会员库在 Neon Postgres。都有免费或低价档位。
Python 的对局数据暂时还是 SQLite 文件（M1 才迁到 Postgres），放在 Fly 的磁盘卷上。

## 1. Python API（Fly.io）

```sh
fly launch --no-deploy            # 用仓库里的 fly.toml 和 Dockerfile，app 名可以改
fly volumes create duo_data --region iad --size 3
fly secrets set RIOT_API_KEY=RGAPI-... DUO_INTERNAL_SECRET=$(openssl rand -hex 32)
fly deploy
```

- 把本地的 `lol_duo.sqlite` 传上去：`fly ssh sftp shell`，`put lol_duo.sqlite /data/incoming.sqlite`，再 `fly machine restart`。启动时会用它替换正在用的库（连同 WAL 文件），并删掉旧的 `score_scale.json`，搭配评分在后台按新数据重新拟合。**不要直接覆盖 `/data/lol_duo.sqlite`**，服务在写它。
- 每天采集完可以照样再传一次。注意：替换会丢掉线上这段时间查过的玩家缓存，他们下次查询要重新从 Riot 拉。M1 迁到 Postgres 后就不用传文件了。
- **`DUO_INTERNAL_SECRET` 必须设。** 设了以后，Python API 只接受带这个密钥的请求，浏览器只能通过网站允许的几个接口（`web/app/api/[...path]`）访问它，Riot 头像查询和会员牌堆接口不会被直接调用。
- 开发者 Key 每 24 小时过期，过期后 `fly secrets set RIOT_API_KEY=...` 换新的（会自动重启）。正式上线前要申请 Personal 或 Production Key。

## 2. 会员库（Neon）

在 Neon 建一个美东的数据库，复制连接串（`postgres://...?sslmode=require`）。表会在网站第一次连上时自动迁移（`web/drizzle/`）。

## 3. 网站（Vercel）

导入 GitHub 仓库，**Root Directory 选 `web`**，框架选 Next.js。环境变量：

| 变量 | 值 |
|---|---|
| `DATABASE_URL` | Neon 连接串 |
| `AUTH_SECRET` | `npx auth secret` 生成 |
| `AUTH_DISCORD_ID` / `AUTH_DISCORD_SECRET` | Discord 应用，重定向地址加上 `https://<你的域名>/api/auth/callback/discord` |
| `DUO_API_URL` | `https://duo-lol-api.fly.dev`（你的 Fly 地址） |
| `DUO_INTERNAL_SECRET` | 和 Fly 上同一个值 |
| `ADMIN_ACCOUNTS` | `discord:<你的 Discord 用户 ID>` |
| `DISCORD_BOT_TOKEN` | 可选，互选通知用。Discord 应用里建一个 Bot，复制它的 Token，再把 Bot 拉进网站的 Discord 服务器；会员要在这个服务器里才能收到私信 |
| `RIOT_VERIFICATION` | Riot 开发者后台给的验证码，网站会在 `/riot.txt` 返回它 |

**不要**在生产环境设 `AUTH_DEV_LOGIN`。

## 4. 申请 Riot Key 前检查

- [ ] 网站能公开打开，查组合和找搭子都能走通
- [ ] `/riot.txt` 返回 Riot 给的验证码
- [ ] 页脚有 Riot 法律声明、隐私政策、服务条款
- [ ] 申请说明里写清楚：这是 LFG（找队友）工具；搭配评分只衡量两人搭配合不合适，不是个人实力或 MMR 评分；互选前不显示 Riot ID；不在游戏内或选人阶段提供信息
