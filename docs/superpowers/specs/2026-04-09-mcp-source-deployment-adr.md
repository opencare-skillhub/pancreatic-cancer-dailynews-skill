# ADR: 数据源型 MCP 依赖检查与自动化部署

- 日期：2026-04-09
- 状态：Accepted
- 适用范围：`pancreatic-cancer-news-digest` v5.x / v5.1+

## 背景

当前项目的多信源能力依赖外部 skills、CLI、npm 包、远程 MCP 服务与本地占位 adapter。随着信息源持续扩展，手工安装、配置和验证会带来以下问题：

1. 新 source 接入成本高，容易遗漏依赖。
2. 同一 source 在不同环境下可用性不一致。
3. 占位 MCP 容易长期停留在 stub 状态，缺乏可观测性。
4. superpowers 工作流中，“讨论新 source → 手工查找安装方式 → 手工验证”重复劳动过多。

因此需要把“环境检查 → 缺失确认 → 自动部署 → 注册清单”纳入正式架构。

## 决策

采用 **主包稳定优先，数据源型 MCP 后续自动化部署** 的策略：

1. 先稳定 `digest` 主包与统一 source adapter 接口。
2. 再将数据源型 MCP/skills 逐个纳入自动化部署。
3. 在主包内部新增依赖检查与安装编排，而不是一开始拆成独立 skill。
4. 依赖清单使用版本化 catalog 文件维护，支持持续追加。

## 为什么这样做

### 先稳主包，再部署依赖
- 避免主流程与外部部署同时变化，调试面过大。
- 先冻结 adapter 契约，再替换后端实现，风险更低。
- 自动化部署会复用主包的 source registry、doctor 输出与错误模型。

### 先做项目内能力，再考虑抽 skill
- 当前最需要的是减少本项目接新 source 的操作成本。
- 项目内落地更快，也更容易跟随 v5 配置模型演进。
- 等 catalog、doctor、install 流程稳定后，再抽成 superpowers skill 更合适。

## 设计

### 1. 命令层

新增/扩展命令：

- `digest doctor`
- `digest doctor --sources`
- `digest doctor --skills`
- `digest doctor --fix`
- `digest install-source <source-id>`
- `digest install-deps`

行为约束：
- `doctor` 默认只检查，不做修改。
- `doctor --fix` 必须先输出待执行计划，再等待用户确认。
- `install-source` 只对单一 source 执行自动化安装。

### 2. 依赖目录与 catalog

建议新增：

```text
config/deployment/
  dependency-catalog.json
  install-profiles/
    clinical_trials.json
    pubmed.json
    tavily_search.json
```

`dependency-catalog.json` 负责描述：
- source 标识
- 依赖类型
- 检查方式
- 安装方式
- 启动方式
- 健康检查
- fallback
- 文档来源

### 3. catalog 数据模型

每个依赖项支持以下字段：

```json
{
  "clinical_trials_mcp": {
    "type": "npm_mcp",
    "required": true,
    "role": "clinical_trials_primary",
    "check": {
      "kind": "command",
      "command": "npx -y @scope/clinical-trials-mcp --help"
    },
    "install": {
      "kind": "npm",
      "command": "npm install -g @scope/clinical-trials-mcp"
    },
    "start": {
      "kind": "npx",
      "command": "npx @scope/clinical-trials-mcp"
    },
    "healthcheck": {
      "kind": "stdio_smoke_test"
    },
    "fallback": "stub",
    "docs": {
      "homepage": "https://github.com/example/clinical-trials-mcp"
    }
  }
}
```

支持的 `type`：
- `skill`
- `local_cli`
- `npm_mcp`
- `remote_mcp`
- `scripted_install`

支持的 `check.kind`：
- `command`
- `file_exists`
- `http_health`
- `npm_package`
- `skill_exists`

### 4. doctor 输出模型

`digest doctor` 输出分三层：

1. **基础环境**：Node/npm/npx、必要目录、配置文件
2. **source 依赖**：每个 source 的依赖状态
3. **部署建议**：可自动修复项与手工项

状态值：
- `ready`
- `missing`
- `degraded`
- `disabled`
- `remote_unreachable`

示例输出：

```text
[OK] node runtime
[OK] digest local mcp server
[MISSING] tavily_search skill
[DEGRADED] pubmed_mcp endpoint not configured
[READY] clinical_trials source adapter (stub)

Recommended actions:
1. Install tavily_search skill
2. Configure pubmed_mcp endpoint
```

### 5. 自动化部署交互

`digest doctor --fix` 流程：

1. 生成待执行计划
2. 输出清单
3. 等待用户确认
4. 逐项执行
5. 再次 health check
6. 输出最终状态

示例：

```text
Pending actions:
1. Install tavily_search skill
2. Deploy pubmed_mcp via npm
3. Register pubmed_mcp in source config

Continue? [y/N]
```

### 6. source adapter 配合方式

主包内的 source adapter 必须支持后端切换：
- `stub`
- `local`
- `remote_mcp`

示例：

```json
{
  "pubmed": {
    "enabled": true,
    "transport": "remote_mcp",
    "endpoint": "https://mcp.example.com/pubmed",
    "timeoutMs": 12000,
    "fallback": "stub"
  }
}
```

这让“先 stub、后远程化”成为平滑演进，而不是推倒重来。

## 分阶段落地

### v5
- 加 `doctor` 检查模型
- 加 `dependency-catalog.json`
- 加交互式 `--fix` 设计
- source adapter 增加 transport/fallback 概念

### v5.1
- 支持 `install-source <source-id>`
- 首批自动化部署：`clinical_trials_mcp`、`pubmed_mcp`
- 健康检查与部署日志

### v5.2
- 抽象为独立 superpowers skill（可选）
- 支持更多 source onboarding 模板

## 风险与对策

1. **自动安装过度执行**
   - 对策：默认只检查，修改动作必须显式确认。

2. **catalog 过期**
   - 对策：每个依赖项记录 docs/source，review 时同步更新。

3. **远程 MCP 不稳定**
   - 对策：保留 `stub/local` fallback，doctor 输出 health 状态。

4. **安装逻辑过于耦合项目实现**
   - 对策：把安装描述收敛到 catalog，而不是散落在代码里。

## 结果

该 ADR 的目标不是让所有 MCP 立刻远程化，而是让新 source 的接入过程从“手工找命令 + 手工配环境”收敛为“维护清单 + doctor/install 自动化”，以减少配置劳动并提升可复用性。
