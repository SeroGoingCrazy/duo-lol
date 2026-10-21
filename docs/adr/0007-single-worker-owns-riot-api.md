---
status: proposed
---

# 只有一个 worker 进程调用 Riot API，作业队列放在 Postgres

Riot 的限流按 Key 计算，网站、API 和定时任务各自调用就要跨进程共享限流状态，很容易超限被封。所以只让一个 worker 进程持有 `RIOT_API_KEY`：Python API 需要 Riot 数据时往 `jobs` 表投递作业并返回进度，worker 按优先级（新会员注册 > 查组合 > 每日刷新 > 全服统计）取作业，统一处理 429 和 Retry-After（写进作业的 `not_before`）。队列用 Postgres 的 `FOR UPDATE SKIP LOCKED`，不引入 Redis，少一个要运维的组件。代价是吞吐上限就是一个 Key 的限额；Production Key 下仍不够时再按区域或作业类型拆分。
