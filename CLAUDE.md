# 英雄联盟匹配搭子

输入两个美服 Riot ID，预测两人一起打单双排的胜率并给出理由，还能推荐搭子。当前是可演示的原型，后期上线。

- 需求：`docs/PRD.md`（原型）、`docs/PRD-v2.md`（正式版）、`docs/PRD-v3.md`（聊天、更像 Tinder、推荐升级）；术语：`CONTEXT.md`（写代码和注释时用里面的词）；决策：`docs/adr/`
- 技术栈：Python（`data/`，抓取与统计）+ Next.js（`web/`，网站）
- Python 用 uv 管理：`uv sync` 装依赖，`uv run ...` 运行，加依赖用 `uv add`，不要用 pip。Key 放在根目录 `.env`（照 `.env.example` 复制）。
- Commit message 用 Conventional Commits 前缀：`feat:` 新功能、`fix:` 修 bug、`docs:` 文档、`chore:` 配置和杂项，例如 `feat: add champion-pair synergy`。

- 运行演示：`uv run uvicorn api:app --app-dir data --port 8000`（`DUO_DB` 指向数据库，SQLite 路径或 Postgres 连接串都行，不设就用 `.env` 的 `DATABASE_URL`；搭配评分用 `uv run python data/score_scale.py --db <数据库>` 预先拟合，没跑过的话 API 启动后在后台自己拟合），再在 `web/` 里 `npm install && npm run dev`，网站把 `/api/*` 转给 Python。登录要先把 `web/.env.example` 复制成 `web/.env.local` 填好（会员库本地用 PGlite，见 ADR-0009）。
- 部署：`docs/deploy.md`（Vercel + Fly.io + Neon），CI 在 `.github/workflows/ci.yml`。
- 测试：`uv run pytest`（设 `DUO_TEST_DATABASE_URL` 就在 Postgres 上跑，CI 两种都跑）；端到端 `cd web && npx playwright test`（用 `data/fake_riot.py` 的合成数据，不需要 Key）。
- Commit 信息用 `feat:` / `fix:` / `docs:` / `chore:` 开头。

## 红线

- 只统计单双排（queue 420），只用美服数据。
- `RIOT_API_KEY` 只从 `.env` 或环境变量读，不能出现在代码、日志或前端里。
- 遵守 Riot 限流（开发者 Key：20 次/秒、100 次/2 分钟），处理 429 和 Retry-After，查过的对局要缓存。
- 预测算法沿用 DraftGap 的 Elo 分数相加（ADR-0001）。每一项都要能变成一条理由（API 的 `reasons` 字段，结果页暂不显示），不加无法解释的魔法数字。
- OP.GG 数据源必须和自有数据源可互换（ADR-0003），不要把它写死进模型代码。
- 原型（`docs/PRD.md`）不做登录、实时匹配和联系方式；正式版范围见 `docs/PRD-v2.md` 和 `docs/PRD-v3.md`，联系方式和聊天只在**互选**后开放。
