---
title: "一次数据倾斜排查：Spark 任务从 6 小时到 40 分钟"
description: 一个每天跑 6 小时的 Spark 任务，定位到少数倾斜 key 后，用加盐两阶段聚合配合 AQE 参数优化到 40 分钟，完整记录排查与验证过程。
pubDate: 2026-02-21
category: bigdata
tags: [Spark, 数据倾斜, 性能优化, 特征工程]
---

## 现象：99% 的 task 早就跑完了

任务的输入是前一天的用户行为流水，大约 42 亿行，输出一张几亿行的用户画像宽表。它每天凌晨两点启动，早上八点还没结束，把下游的特征回填全部堵住。

在 Spark UI 里看到的现象非常典型：Stage 3 一共 2,000 个 task，1,960 个在 4 分钟内跑完，剩下的几个跑了 5 个多小时，其中最长的一个处理了 3.1 亿条记录，是平均值的 140 倍。这就是倾斜，不是资源不足。

第一步永远是确认，而不是急着调参。我先看 task 的输入记录数分布，再去看 shuffle read 的峰值，两者同时指向同一批 key，基本可以定性。

## 定位倾斜 key

定位不能靠猜。我一般按这个顺序查：

- 看 Spark UI 里 Stage 的 task duration 分位数，P99 与中位数差十倍以上就确认是倾斜
- 对 shuffle 前的数据按 join key 做 count，排出 Top 20
- 检查这些 key 是否合理，业务上是不是真的有超级活跃用户

```bash
# 从明细表里直接排出倾斜 key，比翻 UI 更直接
spark-submit --master yarn \
  --conf spark.sql.shuffle.partitions=2000 \
  --conf spark.sql.adaptive.enabled=true \
  /opt/jobs/find_skew.py
```

那次的结论是：所有倾斜都集中在 `user_id IS NULL` 和一撮测试账号上。空 key 占了两亿行，全部落进同一个 partition。

## 第一步：能过滤的别留着

最便宜的优化永远是减少数据量。空 key 在业务上没有任何意义，我在聚合前直接过滤，倾斜立刻缓解了一半。

```scala
val clean = raw
  .filter(col("user_id").isNotNull)
  .filter(!col("user_id").startsWith("test_"))

val base = clean
  .withColumn("dt", to_date(col("event_time")))
  .groupBy("user_id", "dt")
  .agg(
    count("*").as("act_cnt"),
    sum("amount").as("amt_sum"),
    max("event_time").as("last_act")
  )
```

## 第二步：两阶段加盐聚合

对真正的业务大客户，过滤是不行的，只能用加盐打散。我在 join key 后面拼一个 0 到 31 的随机后缀，先做局部聚合，再去掉后缀做全局聚合。

```scala
import org.apache.spark.sql.functions._

val salted = base
  .withColumn("salt", (rand() * 32).cast("int"))
  .withColumn("user_salt", concat(col("user_id"), lit("_"), col("salt")))

val partial = salted
  .groupBy("user_salt")
  .agg(sum("act_cnt").as("act_cnt"), sum("amt_sum").as("amt_sum"), max("last_act").as("last_act"))

val finalDf = partial
  .withColumn("user_id", split(col("user_salt"), "_")(0))
  .groupBy("user_id")
  .agg(sum("act_cnt").as("act_cnt"), sum("amt_sum").as("amt_sum"), max("last_act").as("last_act"))
```

加盐的代价是数据膨胀 32 倍，所以盐的粒度要看数据量定。我们的经验是让每个加盐后的 key 控制在几千行以内，超过就加大盐值范围，但别超过 128，否则小文件问题会盖过收益。关于参数细节可以参考 [Spark 官方性能调优指南](https://spark.apache.org/docs/latest/sql-performance-tuning.html)。

## 第三步：把 AQE 用起来

Spark 3 的自适应查询执行能解决一部分倾斜，前提是配置合理。我调整了三个关键参数：

| 参数 | 原值 | 调整后 | 作用 |
| --- | --- | --- | --- |
| `spark.sql.shuffle.partitions` | 200 | 2,000 | 提高并行度，避免单分区过大 |
| `spark.sql.adaptive.enabled` | false | true | 运行时按统计信息重划分区 |
| `spark.sql.adaptive.skewJoin.enabled` | false | true | 自动拆分倾斜分区 |
| `spark.sql.adaptive.advisoryPartitionSizeInBytes` | 默认 | 128MB | 控制合并后的分区大小 |

注意 `shuffle.partitions` 不是越大越好。调到 2,000 以后，每个输出文件只有几 MB，下游读的时候又出现了小文件问题。最终我固定在新分区数大约为「shuffle 数据量除以 128MB」的位置。

## 验证：别只看总耗时

优化后任务从 6 小时降到 40 分钟，但我不只用总耗时判断成败。我会同时确认三件事：

> 结果必须一致。任何性能优化如果改变了输出行数或关键指标，那叫改需求，不叫优化。

具体做法是把优化前后的输出按主键做全量比对，确认行数、`act_cnt` 总和、`amt_sum` 总和完全一致；再确认 task duration 的 P99 与中位数比值从 140 降到 3 以内。只有这两条都成立，这次优化才算结束。

回头看，真正省下时间的不是某个神奇参数，而是先花两小时把倾斜 key 找出来。直接调参的尝试我做过三次，每次都是把 6 小时变成 5 小时 50 分。
