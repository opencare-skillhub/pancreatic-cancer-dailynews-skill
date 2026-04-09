# pancreatic-cancer-news-digest v5 设计规格（Superpowers 升级）

- 日期：2026-04-09
- 当前基线：v4.0（多脚本并存，信源接入不完整）
- 目标版本：v5.x
- 决策结论：A+B 路线（先单入口重构，再补齐多信源），且 MCP 双向能力同包实现并以 npm 发布

## 1. 目标与范围

### 1.1 目标
1. 统一入口与运行主线：从多脚本分叉收敛为单包单入口。
2. 落地神奇搜索组合：多种搜索 skills + MCP（临床/PubMed/指南）+ 兜底搜索能力。
3. 日报结构固定为 6 大板块并稳定产出高质量内容。
4. 同一 npm 包内同时提供：CLI、MCP Client 聚合能力、MCP Server 对外工具。
5. 保持版本治理与可迁移能力（v4→v5），为后续“转图发送”预留接口（本期不实现）。

### 1.2 非目标（本期）
- 不实现“转图发送”生产功能。
- 不追求一次性覆盖全部历史配置源，先确保核心源可用与质量闭环。

## 2. 架构决策（已确认）

### 2.1 路线选择
- 采用 **方案1：Client-First + Server-Export**
  - Phase-1：先做统一内核 + MCP Client 聚合。
  - Phase-2：将稳定能力输出为 MCP Server tools。

### 2.2 技术形态
- 单仓单包，TypeScript/Node。
- 运行入口：`digest` CLI（`npx` 可执行）。
- npm 发布：`@xiaoyibao/pancreatic-digest`（暂定）。

## 3. 包内目录规范（单包）

```text
src/
  cli/            # digest run / doctor / mcp:serve / migrate-config
  core/           # pipeline: fetch -> normalize -> dedup -> score -> section -> render
  schema/         # 统一数据模型与配置 schema
  sources/        # source adapters（临床、pubmed、搜索、微信等）
  mcp-client/     # 外部 MCP 调用封装（重试/超时/fallback）
  mcp-server/     # 对外 MCP tools
  output/         # markdown + downstream publishers
  config/         # profile loader + migration adapter
config/
  base.json
  profiles/
    daily-v5.json
    research-v5.json
  sources/
    *.json
data/
  history.jsonl
```

## 4. 日报 6 板块模型与排序

### 板块定义
1. 病友最关心：临床试验和药物研发（最高优先级）
2. 专业研究发表热点
3. 科普病情管理（感染/消化道出血/腹水/腹膜转移/腹膜炎）
4. 营养与心理（安宁疗护/血小板/失眠等）
5. 社区活动与公众号优质文章（引导关注小胰宝公众号）
6. 每日心理鼓励

### 排序规则
- 跨板块：按板块优先级 1→6。
- 板块内：证据强度 + 时效 + 胰腺癌相关性 + 可行动性。
- 关键临床项：`Phase3 > Phase2 > Phase1`，并保留 `score_breakdown`。
- 每条数据必须可追溯：`source_url`, `evidence`, `fetched_at`, `source_type`。

## 5. MCP 设计（同包双向）

### 5.1 MCP Client（内部）
统一接口：
- `searchClinicalTrials(query, filters)`
- `searchPubmed(query, dateRange)`
- `searchWeb(query, provider)`
- `fetchGuideline(topic)`
- `searchWechatArticles(query)`

统一机制：超时、重试、熔断、fallback、标准化输出。

### 5.2 MCP Server（对外）
提供 tools：
- `digest.run_daily(date, profile, maxItems)`
- `digest.search_topic(topic, days)`
- `digest.get_section(sectionId, date)`
- `digest.list_sources()`
- `digest.validate_report(reportId|markdown)`

## 6. 配置与版本治理

### 6.1 配置分层
- `base.json`：全局默认
- `profiles/daily-v5.json`：6板块日报主配置
- `sources/*.json`：数据源注册与优先级

### 6.2 迁移策略
- 提供 `digest migrate-config --from v4 --to v5`
- 输出迁移报告：字段映射、禁用项、兼容提示

### 6.3 发布策略
- 语义化版本：`5.0.0`（架构切换）
- 通道：`next` 灰度 -> `latest` 稳定
- 必带：`CHANGELOG` + `schema version` + `migration notes`

## 7. 质量与验证

### 7.1 门禁
- `digest doctor`：连通性、schema、MCP tool 可用性
- 结构完整性：6板块必须存在（核心板块空则触发 fallback）
- 可追溯率：证据字段覆盖率 >= 95%

### 7.2 历史与去重
- `data/history.jsonl`
- 字段：`item_id/hash/source/first_seen/last_seen/report_date`
- 默认去重窗口 30 天；科普/心理板块允许规则化复现

## 8. 实施里程碑（MVP）

### Week 1（架构收敛）
1. 初始化 TypeScript 单包与 CLI 骨架。
2. 实现统一 schema 与 pipeline（最小闭环）。
3. 接入 2 个核心源（Clinical + PubMed）到新内核。
4. 输出 v5 日报骨架（6板块模板可渲染）。

### Week 2（多信源与 MCP）
1. 接入搜索组合（tavily/skills/MCP）并完成 fallback。
2. 上线 MCP Server 5 个 tools。
3. 完成 `doctor`、`migrate-config`、回归测试。
4. 发布 `5.0.0-next`，灰度后转 `latest`。

## 9. 最小可交付清单（Definition of Done）

- [ ] `npx @xiaoyibao/pancreatic-digest run --profile daily-v5` 可稳定产出日报
- [ ] 6板块齐全，且 1/2/3 板块非空（有 fallback）
- [ ] MCP Client 调用链可重试+降级
- [ ] MCP Server 5 tools 可用
- [ ] 配置迁移命令可运行并输出报告
- [ ] npm `next` 渠道可安装并执行

## 10. 风险与对策

1. 外部源不稳定：通过 source health + fallback 兜底。
2. 数据质量波动：引入 evidence 完整性与来源白名单。
3. 迁移中断：保留 v4 只读兼容与回滚 profile。

