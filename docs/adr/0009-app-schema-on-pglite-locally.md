---
status: accepted
---

# 会员库本地用 PGlite，生产用 Postgres；本地演示可以用测试登录代替 Discord

登录（M2）先于 Python 侧迁到 Postgres（M1）落地（2026-10-20）。ADR-0004 原本说本地用 SQLite，但 Auth.js 和 Drizzle 的 Postgres 表结构和 SQLite 不通用，两套迁移会分叉。所以网站的 `app` schema（`web/lib/db/schema.ts`，迁移在 `web/drizzle/`）只写 Postgres 一种：设了 `DATABASE_URL` 就连真正的 Postgres，没设就用 PGlite（进程内的 Postgres，数据放 `web/.data/app`），本地和端到端测试不用装数据库。Python 的 `data` 库暂时还是 SQLite，M1 再迁。

本地演示没有 Discord 应用也要能登录，所以 `AUTH_DEV_LOGIN=1` 时登录页多一个“测试登录”，输入任意名字即以该测试会员登录（`web/app/api/dev-login`）。它只认这个环境变量，生产环境不设，就不存在。

管理员后台（处理举报、封号、恢复）随 M3 的拉黑举报一起做，登录这一步不做（Jacky，2026-10-20）。
