---
status: proposed
---

# 网站分为 Next.js 和 Python API 两个服务，共用一个 Postgres，每个 schema 只由一方写

预测模型和 Riot 抓取已经用 Python 写好，用 TypeScript 重写会让两套算法分叉、结果页理由对不上；而登录、页面和滑卡交互在 Next.js 生态里最省事。所以 Next.js 负责会员、登录、滑卡和互选，写 `app` schema；Python API 负责玩家数据、全服统计和预测，写 `data` schema。两边只通过 API 互相读写，`puuid` 是唯一连接点。这样迁移工具可以各用各的（Drizzle / SQL 文件），不会出现两个服务同时改一张表；代价是多一次服务间调用，以及要维护两套部署。本地开发继续用 SQLite，生产用 Postgres，Python 侧的 SQL 需要同时兼容两者，或在 M1 统一切到 Postgres。
