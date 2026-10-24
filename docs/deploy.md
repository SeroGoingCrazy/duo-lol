# 部署

PRD-v2 §6 的方案：网站在 Vercel，Python API 在 Fly.io（美东），数据库是一个 Neon Postgres（美东，US East 1）。都有免费或低价档位。
会员库在 `app` schema，对局数据在 `data` schema（ADR-0004）。采集在本地跑，所有对局留在本地的 `lol_duo.sqlite`；`data/sync_site.py` 每天把网站需要的那部分（全服统计和推荐池）同步到 Neon，线上 API 读它。整份数据库放不进 Neon 免费档。

## 1. Python API（Fly.io）

```sh
fly launch --no-deploy            # 用仓库里的 fly.toml 和 Dockerfile，app 名可以改
fly secrets set RIOT_API_KEY=RGAPI-... DUO_INTERNAL_SECRET=$(openssl rand -hex 32) DATABASE_URL='postgresql://...'
fly deploy
```

- `DATABASE_URL` 是 Neon 的连接串（和网站用的同一个）。Python 会自己建 `data` schema 和表；连接串里的 `-pooler` 会被换成直连地址，因为连接池会丢掉 schema 设置。
- 不需要磁盘卷。搭配评分的拟合结果存在数据库的 `score_scale` 表里，数据库里没有时 API 在后台拟合，之后每天重拟一次；本地跑 `uv run python data/score_scale.py` 也会写进同一张表，线上一小时内会换成新的。以前建过 `duo_data` 卷的话，先 `fly deploy` 这一版（机器不再挂卷），再用 `fly volumes list` 找到卷的 id、`fly volumes destroy <id>` 删掉。
- 健康检查：`fly.toml` 让 Fly 每 30 秒访问一次 `/health`，没回应就重启机器。部署完打开 `https://<app 名>.fly.dev/health`，看到 `{"ok":true}` 就说明部署成功。
- **只开一台机器。** 查询任务存在内存里，开第二台的话，网站轮询到另一台就找不到任务。不要 `fly scale count 2`。
- 每个浏览器 10 分钟内最多新查 6 个玩家（已缓存的不算），超过时返回 429 和 Retry-After，避免一个人占满 Riot 限额。`DUO_LOOKUPS_PER_IP` 可以改，拿到 Production Key 后可以调高。
- **`DUO_INTERNAL_SECRET` 必须设。** 设了以后，Python API 只接受带这个密钥的请求，浏览器只能通过网站允许的几个接口（`web/app/api/[...path]`）访问它，Riot 头像查询和会员牌堆接口不会被直接调用。
- 开发者 Key 每 24 小时过期，过期后 `fly secrets set RIOT_API_KEY=...` 换新的（会自动重启）。正式上线前要申请 Personal 或 Production Key。

## 2. 数据库（Neon）

在 Neon 建一个美东（AWS US East 1）的项目，复制连接串（`postgresql://...?sslmode=require`）。网站的表在第一次连上时自动迁移（`web/drizzle/`），Python 的表在第一次连上时自动创建。

采集继续写本地 SQLite，不用改。把 Neon 的 `DATABASE_URL` 填进 `web/.env.local`，同步脚本会从那里读。不要填在根目录 `.env` 里：填了以后，本地的 API 和脚本不加 `--db` 时就会连 Neon。然后同步一次：

```sh
uv run python data/sync_site.py lol_duo.sqlite --to "postgresql://..."
```

它只同步网站需要的部分：全服统计的汇总（`champion_stats`、`pair_stats`）和推荐池的种子玩家，以及他们最近的对局，大约 40MB。重复运行时会替换汇总，推荐池只补 Neon 里没有的。之后用 Windows 定时任务每天跑一次：

```powershell
powershell -NoProfile -File scripts\sync-site-scheduled.ps1 -Root C:\path\to\checkout-with-db
```

日志在 `-Root` 下的 `sync-site.log`。搭配评分的拟合结果由线上 API 自己在 Neon 里算，不用同步。

**不要**用 `data/to_postgres.py` 把整份 SQLite 搬进 Neon，会超出免费档。

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
