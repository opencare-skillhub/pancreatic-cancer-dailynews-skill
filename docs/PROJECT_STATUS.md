# 项目阶段状态说明

更新时间：2026-04-12

---

## 本阶段结论

本项目当前阶段可以视为**收尾完成**。

这一次迭代的核心目标已经完成：

- 完成项目评估与 v5 设计收敛
- 完成单一声明源方案：`config/sources.registry.yaml`
- 完成 source 配置同步：`digest sync-sources`
- 完成依赖检查与安装闭环：`doctor -> report -> confirm -> install -> config guidance`
- 完成 MCP / skills / tools 的统一纳入
- 完成文档整理：README、完整使用手册、极简使用手册
- 完成 GitHub 新仓库推送与收口

---

## 当前可用能力

### 1. Source Registry

当前统一入口：

```text
config/sources.registry.yaml
```

可用于维护：

- skills
- MCP
- 其他工具依赖

### 2. 自动同步

命令：

```bash
npm run sync:sources
```

会自动更新：

- `config/deployment/dependency-catalog.json`
- `.env.*.example`
- `README.md` 自动生成区块

### 3. 依赖检查与安装

命令：

```bash
node dist/cli/index.js doctor
node dist/cli/index.js doctor --fix
```

已支持：

- 环境检查
- source / skill / MCP 检查
- 安装队列展示
- 交互确认
- 自动安装
- 配置文件提醒
- 安装失败分类提示

### 4. 文档

当前文档入口：

- `README.md`
- `docs/PROJECT_USAGE.md`
- `docs/PROJECT_USAGE_SIMPLE.md`
- `docs/superpowers/specs/2026-04-09-pancreatic-digest-v5-design.md`

---

## 当前已纳入 registry 的依赖

### MCP

- `clinical_trials_mcp`
- `pubmed_mcp`
- `chictr_mcp`
- `metasota_api_mcp`

### Skills

- `tavily_search`
- `wechat_search`
- `vibe_writer_pro`
- `openclaw_grok_search`

---

## 验证状态

本阶段收尾前已验证：

```bash
npm test
npm run test:typecheck
npm run build
```

结果：

- `npm test` 通过
- `npm run test:typecheck` 通过
- `npm run build` 通过

---

## 建议的下一阶段工作

以下属于下一阶段增强项，不影响当前收尾：

1. 简化 `sources.registry.yaml v2` 字段
2. 增加 `sync-sources --dry-run`
3. 增强 doctor 的 smoke check
4. 清理 README 历史遗留段落
5. 增加 `digest list-deps`
6. 视情况用成熟 YAML 库替换轻量 parser

---

## 维护建议

后续日常维护优先遵循这个流程：

```text
改 config/sources.registry.yaml
-> npm run build
-> npm run sync:sources
-> doctor 检查
-> doctor --fix 安装
```

