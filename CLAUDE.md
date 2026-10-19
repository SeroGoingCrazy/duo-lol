# 英雄联盟匹配搭子

输入两个美服 Riot ID，预测两人一起打单双排的胜率并给出理由，还能推荐搭子。当前是可演示的原型，后期上线。

- 需求：`docs/PRD.md`；术语：`CONTEXT.md`（写代码和注释时用里面的词）；决策：`docs/adr/`
- 技术栈：Python（`data/`，抓取与统计）+ Next.js（`web/`，网站）
- Python 用 uv 管理：`uv sync` 装依赖，`uv run ...` 运行，加依赖用 `uv add`，不要用 pip。Key 放在根目录 `.env`（照 `.env.example` 复制）。
- Commit message 用 Conventional Commits 前缀：`feat:` 新功能、`fix:` 修 bug、`docs:` 文档、`chore:` 配置和杂项，例如 `feat: add champion-pair synergy`。

- 运行演示：`uv run uvicorn api:app --app-dir data --port 8000`（`DUO_DB` 指向数据库），再在 `web/` 里 `npm install && npm run dev`，网站把 `/api/*` 转给 Python。
- 测试：`uv run pytest`；端到端 `cd web && npx playwright test`（用 `data/fake_riot.py` 的合成数据，不需要 Key）。
- Commit 信息用 `feat:` / `fix:` / `docs:` / `chore:` 开头。

## 红线

- 只统计单双排（queue 420），只用美服数据。
- `RIOT_API_KEY` 只从 `.env` 或环境变量读，不能出现在代码、日志或前端里。
- 遵守 Riot 限流（开发者 Key：20 次/秒、100 次/2 分钟），处理 429 和 Retry-After，查过的对局要缓存。
- 预测算法沿用 DraftGap 的 Elo 分数相加（ADR-0001）。每一项都要能变成结果页上的一条理由，不加无法解释的魔法数字。
- OP.GG 数据源必须和自有数据源可互换（ADR-0003），不要把它写死进模型代码。
- 原型范围：不做登录、实时匹配和联系方式。
