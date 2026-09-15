---
title: "A 卡特征分析：从描述统计到入模选择"
description: 按实际执行顺序拆开 A 卡的特征分析：描述性统计、WOE 与 IV 单变量筛选、PSI 稳定性、相关性与多重共线性，每个环节都给出公式与 Python 实现，最后对照 LR 评分卡与 LightGBM、XGBoost、CatBoost 的完整用法差异。
pubDate: 2026-09-15
category: credit
tags: [评分卡, 特征工程, IV, PSI, 多重共线性]
series: 风控建模实战
wechat:
  title: 一张 A 卡的特征是怎么一个个筛出来的
  digest: 描述统计、IV、PSI、共线性，四个环节的公式、阈值与 Python 实现，附 LR 与树模型的用法差异
  author: yjchen
---

## A 卡的特征分析有自己的红线

A 卡在申请时点出分，这个时点决定了它最硬的一条约束：入模的每个字段都必须在申请提交那一刻就能取到，且不依赖申请之后的任何行为。我见过最典型的翻车是入模了「放款后首期是否逾期」，离线算出来 IV 高得离谱，上线时才发现根本取不到数，整张卡回炉。

在这条红线之内，特征分析要依次回答四个问题：这个字段干净吗，它有区分度吗，它未来还稳吗，它和别人说的是不是同一件事。对应四个环节，就是描述性统计、单变量效果、稳定性、相关性与共线性，最后才是怎么把这些结论喂给具体模型。

每一步都有明确的产出和淘汰线，我固定成下面这张表：

| 环节 | 回答的问题 | 主要指标 | 典型淘汰线 |
| --- | --- | --- | --- |
| 描述性统计 | 字段能不能用 | 缺失率、单值占比、分位数、分组坏账率 | 缺失率大于 90%，单值占比大于 95% |
| 单变量效果 | 有没有区分度 | IV、KS、AUC、Lift、卡方 | IV 小于 0.02 |
| 稳定性 | 未来还准不准 | PSI、缺失率漂移、WOE 漂移 | PSI 大于 0.25 |
| 相关与共线性 | 是不是重复信息 | Pearson、Spearman、VIF、条件数 | 相关系数绝对值大于 0.7，VIF 大于 10 |

本文的样本口径统一按这套约定：观察点是申请提交时刻，观察期取申请前 6 到 12 个月的行为，表现期为放款后 6 期，坏样本定义为前 6 期内出现 M1+ 逾期，好样本为表现期内从未逾期，表现期没走完或者只有 M0 的灰样本直接剔除。

## 一、描述性统计分析

### 1.1 先把样本口径钉死

字段体检之前，标签本身要先对齐。表现期没走完的样本必须整段丢弃，不能用 0 填充，因为「还没逾期」和「不会逾期」是两件事，填 0 等于把未来的好样本提前算成好样本，坏账率会被系统性低估。同理，观察期不足的新客不能简单当成缺失值处理，他们的行为记录本来就少，缺失本身就是一个有含义的状态。

这一步做错的代价最大，而且不会在训练指标上暴露，只会在上线几个月后的贷后表现里暴露。

### 1.2 字段体检看六个维度

| 维度 | 具体指标 | 我要看出的问题 |
| --- | --- | --- |
| 覆盖率 | 缺失率、缺失在好坏样本上的差异 | 缺失是随机的，还是本身就是风险信号 |
| 集中度 | 单值占比、Top 取值占比 | 字段是不是几乎只有一个值 |
| 分布形状 | 分位数、均值、标准差、偏度、峰度 | 长尾、双峰、被离群值拉偏 |
| 异常值 | IQR 越界比例、业务上限越界比例 | 特殊值编码，例如 -999、0.00、空字符串 |
| 区分度初查 | 分箱后的坏账率、缺失组与正常组的坏账率差 | 方向和业务常识是否一致 |
| 可落地性 | 取数成本、数据源依赖、更新频率 | 离线可用但线上取不到，或延迟太大 |

几个基础公式，其中 $\mathrm{Bad}_i$ 与 $\mathrm{Good}_i$ 表示第 $i$ 箱的坏样本数与好样本数：

$$
\text{缺失率} = \frac{\text{该字段缺失记录数}}{\text{总记录数}}, \qquad
\text{单值占比} = \frac{\text{出现最多的取值记录数}}{\text{总记录数}}
$$

$$
\text{变异系数} = \frac{\sigma}{\mu}, \qquad
\text{偏度} = \frac{\mathbb{E}\left[(X - \mu)^3\right]}{\sigma^3}, \qquad
\text{峰度} = \frac{\mathbb{E}\left[(X - \mu)^4\right]}{\sigma^4} - 3
$$

$$
\text{箱坏账率} = \frac{\mathrm{Bad}_i}{\mathrm{Bad}_i + \mathrm{Good}_i}, \qquad
\text{IQR 越界} = \left\{ x < Q_1 - 1.5 \times \mathrm{IQR} \right\} \cup \left\{ x > Q_3 + 1.5 \times \mathrm{IQR} \right\}
$$

其中 $\mathrm{IQR} = Q_3 - Q_1$。偏度大于 0 是右偏，金融行为数据里最常见，例如「近 3 个月交易金额」；峰度大于 0 是尖峰厚尾，说明极端值比正态分布多得多。变异系数只在均值明显不为 0 时有意义，额度类字段可以看，比率类字段看了会失真。

### 1.3 用坏账率看方向，而不是用均值

汇总统计只能告诉我字段长什么样，决策要靠分组坏账率。我习惯先按业务含义粗分箱，再看每箱坏账率是否单调、有没有业务上说不通的跳变。一个字段整体很健康，但拆到某一段坏账率突然翻倍，这往往就是后面精细分箱要单独切出来的位置。

同时要核对方向。「近 3 个月贷款审批查询次数」越多越坏，「授信额度使用率」越高越坏，「年龄」在某个区间之后反而变好，这些业务先验是后面判断模型系数符号的依据。如果数据方向和常识相反，先怀疑口径，再怀疑数据，最后才考虑接受。

### 1.4 Python：一次跑完字段体检

实际工程里我会把上面这些指标打包成一个函数，对全部候选字段跑一遍，输出一张可以直接排序的体检表。

```python
import numpy as np
import pandas as pd


def field_profile(df, col, target="bad_flag"):
    """单个字段的体检：覆盖率、集中度、分布形状与异常值。"""
    s = df[col]
    out = {
        "col": col,
        "dtype": str(s.dtype),
        "missing": round(s.isna().mean(), 4),
        "nunique": int(s.nunique(dropna=True)),
        "top_share": round(s.value_counts(normalize=True, dropna=True).iloc[0], 4),
        # 缺失组和正常组的坏账率差，差值大说明缺失不是随机的
        "bad_rate_missing": round(df.loc[s.isna(), target].mean(), 4),
        "bad_rate_ok": round(df.loc[s.notna(), target].mean(), 4),
    }
    if pd.api.types.is_numeric_dtype(s):
        q1, q3 = s.quantile([0.25, 0.75])
        iqr = q3 - q1
        out.update(
            mean=round(s.mean(), 4),
            std=round(s.std(), 4),
            p1=s.quantile(0.01),
            p50=s.quantile(0.50),
            p99=s.quantile(0.99),
            skew=round(s.skew(), 3),
            kurt=round(s.kurt(), 3),
            outlier_ratio=round(
                ((s < q1 - 1.5 * iqr) | (s > q3 + 1.5 * iqr)).mean(), 4
            ),
            cv=round(s.std() / s.mean(), 3) if abs(s.mean()) > 1e-6 else np.nan,
        )
    return out


profile = pd.DataFrame([field_profile(df, c) for c in candidate_cols])
profile["bad_rate_gap"] = (profile["bad_rate_missing"] - profile["bad_rate_ok"]).abs()
profile = profile.sort_values(["missing", "bad_rate_gap"], ascending=False)
```

坏账率的方向也用代码固化下来，避免人工看图看漏：

```python
def bad_rate_by_bin(df, col, target="bad_flag", q=10):
    """等频粗分箱后的坏账率表，用来判断单调性与方向。"""
    tmp = df[[col, target]].copy()
    try:
        tmp["bin"] = pd.qcut(tmp[col], q=q, duplicates="drop")
    except ValueError:
        tmp["bin"] = tmp[col]  # 取值太少，退化成按值分组
    g = tmp.groupby("bin", observed=True)[target].agg(cnt="count", bad="sum")
    g["bad_rate"] = g["bad"] / g["cnt"]
    g["share"] = g["cnt"] / g["cnt"].sum()
    # 与相邻箱比较，返回整段是否单调
    diff = g["bad_rate"].diff().dropna()
    g.attrs["monotonic"] = bool((diff > 0).all() or (diff < 0).all())
    return g
```

淘汰规则我定得比较粗，宁可先留着：缺失率超过 90% 直接剔，单值占比超过 95% 直接剔，IQR 越界比例超过 5% 且没有业务解释的降级为候选。真正需要人工介入的是「缺失组坏账率明显高于正常组」这类字段，它们往往有用，但必须把缺失单独成一箱，而不是简单填充。

## 二、单特征效果分析

### 2.1 WOE 与 IV 的定义

WOE 把一个分箱映射成一个连续数值：这一箱里坏人占比相对于好人占比的对数比。IV 是各箱 WOE 的加权和，衡量整个字段携带了多少区分好坏的信息。

$$
\mathrm{WOE}_i = \ln \frac{\mathrm{Bad}_i / \mathrm{Bad}_T}{\mathrm{Good}_i / \mathrm{Good}_T}
= \ln \frac{\mathrm{Bad}_i / \mathrm{Good}_i}{\mathrm{Bad}_T / \mathrm{Good}_T}
$$

$$
\mathrm{IV} = \sum_{i=1}^{k} \left( \frac{\mathrm{Bad}_i}{\mathrm{Bad}_T} - \frac{\mathrm{Good}_i}{\mathrm{Good}_T} \right) \times \mathrm{WOE}_i
$$

其中 $i$ 是分箱下标，$k$ 是箱数，$\mathrm{Bad}_T$ 与 $\mathrm{Good}_T$ 是全样本的坏样本数与好样本数。$\mathrm{WOE}_i$ 为正表示这一箱坏账率高于整体，为负表示低于整体，绝对值越大偏离越远。

WOE 有两个很实用的性质：它把任意分布的特征映射到对数几率尺度上，天然适合线性模型；它的取值不受原始量纲影响，所以「查询次数」和「授信额度」可以直接放进同一个模型比较系数大小。

### 2.2 IV 的读数表

IV 的经验区间我一直用这张表，但只当入口条件，不当结论：

| IV 区间 | 区分度 | 我的处理 |
| --- | --- | --- |
| 小于 0.02 | 几乎没有 | 剔除，除非业务上必须保留 |
| 0.02 到 0.1 | 弱 | 作为辅助变量，单独评估业务价值 |
| 0.1 到 0.3 | 中等 | 主力候选 |
| 0.3 到 0.5 | 强 | 重点复核业务逻辑与口径 |
| 大于 0.5 | 过强 | 优先怀疑标签泄漏、时点穿越、分箱过细 |

### 2.3 分箱：等频、卡方、决策树

IV 依赖分箱，分箱方式直接决定 IV 的大小，所以这两件事必须一起讨论。

| 方法 | 做法 | 优点 | 风险 |
| --- | --- | --- | --- |
| 等频分箱 | 按分位数切，每箱样本量接近 | 简单、稳定、每箱样本量可控 | 完全不管标签，单调性没保证 |
| 等距分箱 | 按取值区间等宽切 | 业务方最容易理解 | 长尾字段会出现空箱 |
| 卡方分箱 | 自底向上合并卡方值最小的一对相邻箱 | 有监督，箱内标签同质性高 | 样本量小时容易过拟合 |
| 决策树分箱 | 用单变量树的分裂点当边界 | 直接对齐模型目标 | 树深了会切得过细 |

卡方分箱的合并准则就是卡方检验统计量，相邻两箱的观测频数与期望频数差异越小越应该合并：

$$
\chi^2 = \sum_{i} \frac{\left(O_i - E_i\right)^2}{E_i}
$$

不管用哪种方法，产物必须满足三条硬约束：

1. **每箱样本占比不低于 5%**。占比太低的箱，WOE 的估计方差过大，跨期一抖动就会翻符号。
2. **WOE 与坏账率单调**。不单调说明分箱在拟合噪声，而不是在刻画风险，逻辑回归的系数也会因此变得难以解释。
3. **缺失、负数、特殊值各自单独成箱**。缺失单独成箱这一步经常被忽略，但它是把「信息缺失」变成「信息」的最便宜手段。

边界一旦确定就固化进配置，随模型版本入库，线上按同一套边界做 `CASE WHEN`，这样线上线下才是同一张卡。

### 2.4 单变量不只有 IV

不同场景下我会换着用这些指标：

$$
\mathrm{KS} = \max_{t} \left| F_{\mathrm{good}}(t) - F_{\mathrm{bad}}(t) \right|
$$

$$
\mathrm{AUC} = P\left(\hat{p}_{\mathrm{bad}} > \hat{p}_{\mathrm{good}}\right), \qquad
\mathrm{Gini} = 2 \times \mathrm{AUC} - 1
$$

$$
\mathrm{Lift}_{\text{top 10\%}} = \frac{\text{前 10\% 分数段的坏账率}}{\text{整体坏账率}}, \qquad
V = \sqrt{\frac{\chi^2}{n \times \min(r-1,\, c-1)}}
$$

其中 $F_{\mathrm{good}}$ 与 $F_{\mathrm{bad}}$ 是好坏样本的累计分布函数，$V$ 是 Cramér's V，$r$ 与 $c$ 是列联表的行列数。IV 偏向连续分箱后的字段，卡方和 Cramér's V 更适合没有分箱的类别型字段，KS 和 Lift 更接近最终业务口径。四个指标方向一致时我才放心，只有一个突出时我会去查它为什么突出。

值得一提的是互信息，它对任意形式的依赖关系都敏感，不像 Pearson 只抓线性关系：

$$
I(X; Y) = \sum_{x} \sum_{y} p(x, y) \ln \frac{p(x, y)}{p(x)\, p(y)}
$$

实践中我不会直接拿互信息做筛选，因为它的取值没有统一上界，跨字段不可比，我更常把它当成「有没有非线性关系被我漏掉」的探测器。

### 2.5 Python：WOE、IV 与 KS

```python
import numpy as np
import pandas as pd
from sklearn.metrics import roc_curve


def woe_iv(bin_series, target):
    """bin_series 是分箱结果，target 是 0/1 好坏标签，返回每箱明细与总 IV。"""
    df = pd.DataFrame({"bin": bin_series, "y": target})
    g = df.groupby("bin", observed=False)["y"].agg(n="count", bad="sum")
    g["good"] = g["n"] - g["bad"]
    bad_t, good_t = g["bad"].sum(), g["good"].sum()
    # 拉普拉斯平滑：某一箱好或坏为 0 时，WOE 会变成正负无穷
    g["bad_rate"] = (g["bad"] + 0.5) / (bad_t + 0.5 * len(g))
    g["good_rate"] = (g["good"] + 0.5) / (good_t + 0.5 * len(g))
    g["woe"] = np.log(g["bad_rate"] / g["good_rate"])
    g["iv"] = (g["bad_rate"] - g["good_rate"]) * g["woe"]
    g["share"] = g["n"] / g["n"].sum()
    return g, float(g["iv"].sum())


def ks(y_true, prob_bad):
    """prob_bad 越大越坏，KS 取好坏累计分布的最大间距。"""
    fpr, tpr, _ = roc_curve(y_true, prob_bad)
    return float(np.max(tpr - fpr))


def iv_report(df, cols, target="bad_flag", q=10):
    rows = []
    for col in cols:
        try:
            binned = pd.qcut(df[col], q=q, duplicates="drop")
        except ValueError:
            binned = df[col]
        detail, iv = woe_iv(binned, df[target])
        rows.append(
            {
                "col": col,
                "iv": round(iv, 4),
                "bins": len(detail),
                "min_share": round(detail["share"].min(), 4),
                "woe_monotonic": bool(
                    detail["woe"].is_monotonic_increasing
                    or detail["woe"].is_monotonic_decreasing
                ),
            }
        )
    return pd.DataFrame(rows).sort_values("iv", ascending=False)
```

这份报告里我会同时看四列：`iv` 决定要不要，`bins` 和 `min_share` 检查分箱是否过细，`woe_monotonic` 检查可解释性。四个都过关的字段才进入候选池。

### 2.6 IV 的三个陷阱

**第一，IV 对取值个数天然偏高。** 同一个字段分 5 箱和分 20 箱，后者 IV 一定更大，但多出来的部分是噪声。所以 IV 必须跟箱数、每箱占比一起看。

**第二，用全量数据算 IV 再挑变量，是标准的选择偏差。** 应该只用训练期算 IV，验证期和 OOT 只用来复核。用全量算 IV，等于让模型提前看到了验证期的标签分布。

**第三，IV 只衡量区分度，不衡量稳定性。** 一个字段在训练期 IV 是 0.35，但它依赖的数据源最近三个月改过口径，入模就是定时炸弹。所以 IV 之后必须紧跟 PSI。

## 三、稳定性分析

### 3.1 PSI 的定义与阈值

PSI 比较同一个字段在两个时期的分布差异，基准期通常是开发期，对比期是最近一个自然月。

$$
\mathrm{PSI} = \sum_{i=1}^{k} \left(A_i - E_i\right) \ln \frac{A_i}{E_i}
$$

其中 $A_i$ 是对比期第 $i$ 箱的样本占比，$E_i$ 是基准期第 $i$ 箱的样本占比，分箱边界必须用开发期固化的那一套。

| PSI | 判断 | 动作 |
| --- | --- | --- |
| 小于 0.1 | 稳定 | 不动，正常监控 |
| 0.1 到 0.25 | 轻微漂移 | 记录并连续观察两到三个周期 |
| 大于 0.25 | 显著漂移 | 单独复看，评估重新分箱或限制使用 |

### 3.2 PSI 与 KL 散度的关系

PSI 本质上是一个近似对称的散度，它可以写成两个方向的 KL 散度之和：

$$
D_{\mathrm{KL}}(A \| E) = \sum_i A_i \ln \frac{A_i}{E_i}, \qquad
\mathrm{PSI} \approx D_{\mathrm{KL}}(A \| E) + D_{\mathrm{KL}}(E \| A)
$$

所以 $A$ 与 $E$ 互换位置，结果接近但不完全相等。工程上我固定基准期在前、对比期在后，全站口径一致，避免同一个字段在不同报表里算出两个数。

### 3.3 四个容易做错的地方

**一是重新分箱。** PSI 必须用开发期固化的边界，如果每次监控都按当期数据重新分箱，分布差异会被分箱本身抹平，指标永远好看。这是我看过的 PSI 报表里最常见的错误。

**二是小样本放大。** 某一箱在基准期占比很低时，PSI 会被这一箱主导。我会给每箱设最小样本量，占比为 0 的情况加一个极小的平滑项，同时对样本量不足的周期直接标注不可用，而不是算出一个漂亮的数字。

**三是只看取值漂移，不看缺失率漂移。** 实际经验里，缺失率的跳变往往比取值分布漂移出现得更早，尤其是依赖三方数据的字段。我会把缺失率单列一个时间序列盯着，它是最灵敏的早期信号。

**四是用滚动基准。** 基准期应该固定在开发期，不要每月滚动更新，否则漂移会被基准自己吸收，等于没监控。

### 3.4 Python：固定边界的 PSI

```python
def psi(base: pd.Series, curr: pd.Series, bins, eps: float = 1e-6):
    """base 是开发期样本，curr 是监控期样本，bins 必须是开发期固化的边界。"""
    bt = pd.cut(base, bins=bins, include_lowest=True).value_counts(normalize=True)
    ct = pd.cut(curr, bins=bins, include_lowest=True).value_counts(normalize=True)
    idx = bt.index.union(ct.index)
    bt = bt.reindex(idx).fillna(0.0) + eps
    ct = ct.reindex(idx).fillna(0.0) + eps
    parts = (ct - bt) * np.log(ct / bt)
    detail = pd.DataFrame({"base": bt, "curr": ct, "psi_part": parts})
    return float(parts.sum()), detail


def psi_no_bins(base: pd.Series, curr: pd.Series, q: int = 10, eps: float = 1e-6):
    """没有固化边界时的兜底：用开发期分位数当边界，再喂给 psi()。"""
    edges = np.unique(base.quantile(np.linspace(0, 1, q + 1)).to_numpy())
    edges[0], edges[-1] = -np.inf, np.inf  # 监控期超出历史取值范围时也能落箱
    return psi(base, curr, edges, eps=eps)
```

两个细节值得说明：`edges` 首尾换成正负无穷，是为了让监控期出现的、开发期没见过的极端值也能落进某一箱，而不是变成 NaN 被静默丢弃；`eps` 是给空箱准备的，它会让一个空箱贡献大约 $-\ln(\epsilon)$ 量级的惩罚，所以阈值判断时要知道这一点。

### 3.5 把 IV 和 PSI 放在一起看

单看任何一个指标都会做错决定，两个一起看才形成处置逻辑：

| | IV 高 | IV 低 |
| --- | --- | --- |
| PSI 低 | 主力变量，保留 | 剔除，或只作为业务规则 |
| PSI 高 | 复看，优先重新分箱或缩短更新周期 | 直接剔除，不要再花时间 |

左下角那一格是最需要经验的：一个字段区分度很高但漂移严重，直接删掉可惜，直接留用危险。我的默认动作是查清漂移来源，如果是分箱边界吃到了时间趋势就重新分箱，如果是数据源口径变了就换数据源，只有都解决不了才考虑弃用。

## 四、特征相关性与多重共线性分析

### 4.1 三种相关系数

$$
r_{\mathrm{Pearson}} = \frac{\sum_{i=1}^{n} (x_i - \bar{x})(y_i - \bar{y})}
{\sqrt{\sum_{i=1}^{n} (x_i - \bar{x})^2} \sqrt{\sum_{i=1}^{n} (y_i - \bar{y})^2}}
$$

$$
r_{\mathrm{Spearman}} = r_{\mathrm{Pearson}}\left(\mathrm{rank}(x),\, \mathrm{rank}(y)\right)
$$

Pearson 只抓线性关系。一个字段是另一个的平方时，Pearson 可能接近 0，但信息高度重叠，所以我会同时看 Spearman。Kendall 秩相关系数基于一致对与不一致对的数量，样本量小的时候比 Spearman 更稳健。类别型字段之间用 Cramér's V，类别型与数值型之间我会先把数值型分箱再算。

### 4.2 多重共线性：VIF、容差与条件数

两两相关系数低不代表没有多重共线性。三个字段各占三分之一权重加起来等于第四个字段，任意两两相关性都不高，单变量回归也不显著，但联合起来会把系数方差推得很大。真正的判断要靠 VIF 与条件数：

$$
\mathrm{VIF}_j = \frac{1}{1 - R_j^2}, \qquad
\text{容差}_j = 1 - R_j^2 = \frac{1}{\mathrm{VIF}_j}
$$

其中 $R_j^2$ 是把第 $j$ 个特征对其余全部特征做线性回归得到的决定系数。条件数则从整体上衡量病态程度：

$$
\kappa = \sqrt{\frac{\lambda_{\max}}{\lambda_{\min}}}
$$

这里的 $\lambda$ 是自变量相关系数矩阵的特征值。VIF 的直观含义是系数方差被膨胀了多少倍，这一点可以直接从最小二乘的方差公式看出来：

$$
\operatorname{Var}(\hat{\beta}) = \sigma^2 \left(X^{\top} X\right)^{-1}
$$

$\left(X^{\top} X\right)^{-1}$ 的对角元里含 $\frac{1}{1 - R_j^2}$ 这一项，所以 VIF 从 1 涨到 10，系数标准误大致涨三倍多，显著性检验随之失效。

| 指标 | 关注线 | 严重线 | 说明 |
| --- | --- | --- | --- |
| VIF | 5 | 10 | 超过 10 说明该变量可被其余变量高度解释 |
| 容差 | 0.2 | 0.1 | VIF 的倒数，越小越糟 |
| 条件数 | 10 | 30 | 反映整体病态程度，比两两相关更全局 |
| 相关系数绝对值 | 0.6 | 0.7 到 0.8 | 粗筛用，弱相关不等于无共线性 |

### 4.3 相关性聚类去冗余

我不用「删到只剩一个」这种粗暴做法，而是做相关性聚类：把所有候选变量放进一个层次聚类，距离用 $1 - |r_{\mathrm{Spearman}}|$，切一个阈值，每个簇里保留一个代表。保留谁，按这个优先级判断：

1. 跨期稳定性最好（变量 PSI 最低）
2. 业务解释最直接，最好能一句话说清方向
3. 取数成本最低，不依赖昂贵的外部数据源
4. 缺失率最低

IV 最高只是其中一个考量，因为同一簇里的变量区分度本来就相近，多出来的那一点 IV 常常是噪声。

### 4.4 Python：相关性聚类与 VIF

```python
from scipy.cluster.hierarchy import fcluster, linkage
from scipy.spatial.distance import squareform
from sklearn.linear_model import LinearRegression


def vif_table(X: pd.DataFrame) -> pd.DataFrame:
    """X 是入模特征矩阵（逻辑回归要用 WOE 变换后的值）。"""
    rows = []
    for col in X.columns:
        y = X[col].to_numpy()
        rest = X.drop(columns=col).to_numpy()
        r2 = LinearRegression().fit(rest, y).score(rest, y)
        rows.append({"col": col, "r2": round(r2, 4), "vif": 1 / max(1e-9, 1 - r2)})
    return pd.DataFrame(rows).sort_values("vif", ascending=False)


def correlation_clusters(X: pd.DataFrame, threshold: float = 0.7) -> dict:
    """按 1 - |Spearman| 做层次聚类，|r| 超过 threshold 的字段会落进同一簇。"""
    corr = X.corr(method="spearman").abs()
    dist = squareform(1 - corr.to_numpy(), checks=False)
    labels = fcluster(linkage(dist, method="average"), t=1 - threshold, criterion="distance")
    groups: dict[int, list[str]] = {}
    for col, lab in zip(X.columns, labels):
        groups.setdefault(int(lab), []).append(col)
    return {k: v for k, v in groups.items() if len(v) > 1}


def pick_representatives(groups, iv_table, psi_table):
    """簇内代表：先看稳定性，再看区分度，最后看业务偏好。"""
    iv = iv_table.set_index("col")["iv"]
    psi = psi_table.set_index("col")["psi"]
    chosen = []
    for cols in groups.values():
        ranked = sorted(cols, key=lambda c: (psi.get(c, 0), -iv.get(c, 0)))
        chosen.append(ranked[0])
    return chosen
```

还有两个细节。第一，相关性要在 WOE 变换之后再看一遍，因为入模的是 WOE 值，变换会改变相关结构，有时原始值高度相关的两个字段，WOE 之后相关性会明显下降。第二，我不在主成分上建评分卡，虽然 PCA 能一次消掉共线性，但每个主成分是全部字段的线性组合，系数没法向业务和监管解释，这在信贷场景里是硬伤。

## 五、在 LR 评分卡里的应用

### 5.1 九步流程

逻辑回归的模型形式决定了它对前面每一步都敏感。它的线性部分写成：

$$
\ln \frac{p}{1 - p} = \beta_0 + \sum_{j=1}^{m} \beta_j x_j
$$

其中 $p$ 是坏样本概率，$x_j$ 是入模特征。因为是线性叠加，共线性、量纲、非线性关系都会直接体现在系数上，所以特征分析的四步在 LR 里一步都不能省。

我实际执行的顺序是：

1. 描述统计初筛，剔掉缺失率大于 90% 与单值占比大于 95% 的字段
2. 只在训练期计算 IV，取 0.02 作为入口线做粗筛
3. 有监督分箱：等频起步，再按业务边界微调，保证单调、缺失单独成箱、每箱占比不低于 5%
4. 做 WOE 变换，在变换后的值上重算相关性
5. 相关性聚类去冗余，每簇保留一个代表
6. 复查 VIF 与条件数，VIF 大于 10 的变量找出主因再决定去留
7. 逐步回归或 L1 收缩定最终变量表，逐个核对系数符号
8. 跨期验证：OOT 的 KS、各变量 PSI、系数跨期稳定性
9. 分数校准，固定基准分与 PDO

第 7 步最需要提醒。LR 的系数在共线性下极不稳定，换一个训练窗口就可能符号反转，一个符号反了的变量在业务评审上过不去，它比掉一点 KS 更致命。

### 5.2 Python：从 WOE 到标准分

```python
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression

# 1) 只用训练期数据确定边界与 WOE 映射，这套映射要随模型版本一起入库
woe_maps, X_train_woe = {}, pd.DataFrame(index=train.index)
for col in candidates:
    detail, iv = woe_iv(train[f"{col}_bin"], train["bad_flag"])
    if iv < 0.02 or not (detail["woe"].is_monotonic_increasing
                         or detail["woe"].is_monotonic_decreasing):
        continue
    woe_maps[col] = detail["woe"].to_dict()
    X_train_woe[col] = train[f"{col}_bin"].map(woe_maps[col])

# 2) OOT 用同一套映射变换，绝不重新分箱
X_oot_woe = pd.DataFrame({
    col: oot[f"{col}_bin"].map(mapping) for col, mapping in woe_maps.items()
})

# 3) 拟合：样本少或特征多时把 C 调小，等价于加大 L2 惩罚
clf = LogisticRegression(penalty="l2", C=1.0, solver="lbfgs", max_iter=2000)
clf.fit(X_train_woe, train["bad_flag"])

# 4) 系数符号核对：WOE 单调时系数应为正（WOE 越大越坏）
coef = pd.Series(clf.coef_[0], index=X_train_woe.columns).sort_values()
print(coef)

# 5) 刻度映射：PDO=50 表示坏好比翻倍时分数降 50 分
PDO, base_score, base_odds = 50, 600, 30
B = PDO / np.log(2)
A = base_score - B * np.log(base_odds)
logit = clf.intercept_[0] + X_train_woe.to_numpy() @ clf.coef_[0]
score = A - B * logit  # 分数越高越安全

print("train KS =", ks(train["bad_flag"], -logit))
print("oot   KS =", ks(oot["bad_flag"], -(clf.intercept_[0] + X_oot_woe.to_numpy() @ clf.coef_[0])))
```

刻度公式写成一般形式是：

$$
\mathrm{Score} = A - B \left( \beta_0 + \sum_j \beta_j \mathrm{WOE}_j \right), \qquad
B = \frac{\mathrm{PDO}}{\ln 2}, \qquad
A = S_0 - B \ln(\mathrm{odds}_0)
$$

其中 $S_0$ 是基准分，$\mathrm{odds}_0$ 是基准分对应的好坏比。用 PDO 等于 50、基准分 600、基准好坏比 30 代入，$B \approx 72.13$，$A \approx 354.7$。这样每个分数段的含义是固定的：分数每降 50 分，坏好比翻一倍，业务方和策略同事可以横向比较不同版本的卡片。

### 5.3 上线前必查的四件事

- **系数符号**：全部与业务方向一致，没有反转项
- **分箱边界**：线上 SQL 与离线分箱完全一致，包括缺失与特殊值的归属
- **WOE 映射**：以配置文件形式随模型版本发布，不写在代码里
- **份数漂移**：用最近一个月数据回算分数 PSI，大于 0.1 先查原因再上线

## 六、在树模型里的应用

### 6.1 与 LR 的差异

前面四步是共通的，但每个环节在两个模型族里的重要程度差别很大。这张表是我实际执行时的对照：

| 环节 | LR 评分卡 | LightGBM / XGBoost / CatBoost |
| --- | --- | --- |
| 缺失值 | 缺失单独成箱做 WOE，或填充后加缺失指示变量 | 原生处理：XGBoost 为缺失学一个默认方向，LightGBM 分到增益大的一侧，CatBoost 用 Min 策略 |
| 类别特征 | WOE 编码，必须有监督，且依赖分箱 | CatBoost 原生 ordered target statistics，LightGBM 与 XGBoost 用 target encoding 或 one-hot |
| 分箱 | 强制要求，且要单调、每箱占比够 | 非必须，可作为先验；业务合规场景改用单调约束 |
| 非线性 | 只能靠分箱加 WOE 近似表达 | 树分裂原生表达，交互项自动得到 |
| 异常值 | 分箱后自然钝化，重点是边界别被极端值吃掉 | 不敏感，但极端值仍会影响叶子均值 |
| 共线性 | 必须处理，VIF 与条件数都要过关 | 预测层面不敏感，但重要性会被相关特征分摊稀释 |
| 特征筛选 | IV 加相关性聚类加逐步回归或 L1，一般 12 到 20 个 | gain、permutation、SHAP 加前向或后向搜索，数量可到上百 |
| 过拟合控制 | 变量数少，配合系数显著性检验与 L2 正则 | 树深、叶子数、最小叶子样本、学习率、行列采样、L1/L2、早停 |
| 稳定性 | 变量 PSI 加系数跨期漂移 | 特征 PSI 加 SHAP 贡献漂移，树结构换种子就会变 |
| 可解释性 | 系数即权重，监管友好，可直接写进制度 | TreeSHAP 与部分依赖，需要额外核对方向 |

### 6.2 Python：同一份数据喂给三棵树

```python
import lightgbm as lgb
import xgboost as xgb
from catboost import CatBoostClassifier, Pool

# 业务方向：+1 越大越坏，-1 越大越好，0 不约束
directions = {"query_3m": 1, "utilization": 1, "age": -1}
mono = [directions.get(c, 0) for c in feature_cols]

# LightGBM：类别特征直接声明，缺失值无需填充
lgb_params = {
    "objective": "binary", "metric": "auc", "learning_rate": 0.03,
    "num_leaves": 31, "min_child_samples": 100, "feature_fraction": 0.8,
    "bagging_fraction": 0.8, "bagging_freq": 1,
    "lambda_l1": 0.1, "lambda_l2": 1.0,
    "monotone_constraints": mono, "verbose": -1, "seed": 42,
}
dtr = lgb.Dataset(X_tr, y_tr, categorical_feature=cat_cols)
dva = lgb.Dataset(X_va, y_va, reference=dtr)
gbm = lgb.train(lgb_params, dtr, num_boost_round=2000, valid_sets=[dva],
                callbacks=[lgb.early_stopping(100), lgb.log_evaluation(200)])

# XGBoost：缺失默认走学习出来的默认分支，单调约束用字符串表达
dtr = xgb.DMatrix(X_tr, y_tr, enable_categorical=True)
dva = xgb.DMatrix(X_va, y_va, enable_categorical=True)
xgb_params = {
    "objective": "binary:logistic", "eval_metric": "auc", "eta": 0.03,
    "max_depth": 6, "min_child_weight": 20, "subsample": 0.8,
    "colsample_bytree": 0.8, "reg_lambda": 1.0, "reg_alpha": 0.1,
    "tree_method": "hist",
    "monotone_constraints": "(" + ",".join(str(m) for m in mono) + ")",
}
bst = xgb.train(xgb_params, dtr, num_boost_round=2000,
                evals=[(dva, "valid")], early_stopping_rounds=100)

# CatBoost：类别特征交给 ordered target statistics，省掉手工编码
model = CatBoostClassifier(
    iterations=2000, learning_rate=0.03, depth=6, l2_leaf_reg=3.0,
    loss_function="Logloss", eval_metric="AUC",
    od_type="Iter", od_wait=100, random_seed=42, verbose=200,
)
model.fit(Pool(X_tr, y_tr, cat_features=cat_cols),
          eval_set=Pool(X_va, y_va, cat_features=cat_cols),
          use_best_model=True)
```

### 6.3 重要性怎么读

树模型给的是重要性排序，但它至少有三种口径，结论经常不一致：

- **gain**：某个特征带来的平均增益，偏袒高基数与连续特征
- **split**：被用来分裂的次数，偏袒取值多的特征，最容易误导
- **permutation**：打乱该特征后指标掉多少，口径最接近「模型有多依赖它」
- **SHAP**：每个样本上的边际贡献，可以看方向，也可以按时间看贡献漂移

```python
import shap
from sklearn.inspection import permutation_importance

gain = pd.Series(gbm.feature_importance("gain"), index=gbm.feature_name())
perm = permutation_importance(gbm, X_va, y_va, n_repeats=5, scoring="roc_auc")
perm_s = pd.Series(perm.importances_mean, index=feature_cols)

explainer = shap.TreeExplainer(gbm)
sv = explainer.shap_values(X_va)
shap_s = pd.Series(np.abs(sv).mean(axis=0), index=feature_cols)

importance = pd.DataFrame({"gain": gain, "perm": perm_s, "shap": shap_s})
importance["rank_gain"] = importance["gain"].rank(ascending=False)
importance["rank_shap"] = importance["shap"].rank(ascending=False)
print(importance.sort_values("shap", ascending=False).head(20))
```

我的判断标准是：重要的变量至少要在两种口径下都靠前。两个高度相关的强特征会互相抢分裂点，换一个随机种子，两者的重要性排序可能直接对调，只看一次 gain 排序就下结论是不靠谱的。

### 6.4 单调约束与概率校准

金融场景里，模型不仅要准，还要讲得通。LightGBM 与 XGBoost 都支持单调约束，把业务先验直接写进模型：`query_3m` 必须单调递增（查询越多越坏），`age` 必须单调递减。代价通常是损失一点点 AUC，换回来的是评审能过、线上不会出现反直觉的局部波动。CatBoost 也支持单调约束，写法是在 `Pool` 里传 `monotone_constraints`。

树模型输出的概率通常偏极端，因为叶子节点的取值是有限样本的均值，靠近 0 和 1 的尾部会被高估。要拿概率去算期望损失，就得校准：

$$
p_{\mathrm{cal}} = \frac{1}{1 + \exp\left(A f + B\right)} \quad \text{(Platt scaling)}
$$

```python
from sklearn.isotonic import IsotonicRegression

iso = IsotonicRegression(out_of_bounds="clip")
iso.fit(raw_va, y_va)          # raw_va 是未校准的原始概率
p_cal = iso.predict(raw_test)  # 单调映射，保持排序不变，所以 KS 与 AUC 不动
```

isotonic 回归是保序的，所以它只改概率的绝对值，不改排序，KS 与 AUC 不会变。这一点在风控里很实用：区分度指标已经定稿，校准只是为了把概率接到额度与定价公式上。

### 6.5 树模型的四个坑

**第一，重要性被稀释。** 相关特征互相抢分裂，导致每个看起来都不重要。做完相关性聚类再训练，重要性排序会清晰很多。

**第二，默认参数直接上生产。** 树深与叶子数不控制，训练集 AUC 轻松到 0.95，OOT 掉到 0.6。早停一定要用验证集，而且验证集要按时间切。

**第三，拿树的重要性当业务解释。** gain 高只说明模型用了它，不说明方向和业务一致。方向要靠 SHAP 依赖图或部分依赖图去核。

**第四，认为树模型不用做 PSI。** 树对共线性不敏感，但对分布漂移一样敏感，特征 PSI 与分数 PSI 的监控一个都不能少，还要额外看 SHAP 贡献有没有整体漂移。

## 七、一份可以照着走的检查清单

- 标签口径与表现期先对齐，没走完表现期的样本整段丢弃
- 特征在申请时点可获取，且不依赖申请后的行为
- 缺失率、单值占比、特殊值三段先过一遍，缺失单独成箱
- 按业务含义分组看坏账率，核对方向是否符合常识
- 只在训练期算 IV，OOT 只做复核
- 分箱单调、每箱占比不低于 5%、缺失与特殊值单独成箱，边界固化入库
- 入模相关性用 WOE 变换后的值算，相关性聚类每簇留一个代表
- VIF 与条件数一起看，不要只看两两相关
- 变量 PSI 与缺失率漂移同时监控，基准期固定在开发期
- 树模型的重要性至少用两种口径验证，并检查换种子是否稳定
- 合规场景给关键变量加单调约束，概率偏差用 isotonic 校准

特征分析没有一步能跳过，但顺序可以优化。我的习惯是先用最便宜的手段淘汰掉大部分字段，再对剩下的少数做最贵的那一步。真正进入最终变量表的通常只有十几个，而这十几个字段在每个环节都被反复看过至少一遍。

---

相关阅读：同系列的[信贷评分卡：从特征到上线的完整链路](/posts/credit-scorecard-pipeline/)里，有从宽表到线上部署更完整的链路视图；[模型上线之后：风控模型要盯的指标](/posts/credit-model-monitoring/)讲的是这套 PSI 口径上线后怎么持续跑。
