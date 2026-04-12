# 小胰宝 2.0｜胰腺癌高质量日报引擎

每日自动生成胰腺癌相关的：

- 临床试验与药物研发
- 专业研究热点
- 病情管理知识
- 营养与心理
- 社区活动与公众号文章
- 每日心理鼓励

项目当前已经升级为 **v5 MCP-first / Ability-first** 架构：  
优先走注册能力，再按规则降级，而不是在业务代码里写死某一个搜索源。

---

## ⚡ 3 分钟上手

### 1. 安装

```bash
git clone https://github.com/xtra-care-skillhub/pancreatic-cancer-dailynews-skill.git
cd pancreatic-cancer-dailynews-skill
npm install
npm run build
```

### 2. 检查环境

```bash
node dist/cli/index.js xiaoyibao
```

常用变体：

```bash
node dist/cli/index.js xiaoyibao --skills
node dist/cli/index.js xiaoyibao --sources
```

### 3. 自动安装缺失依赖

```bash
node dist/cli/index.js xiaoyibao --fix
```

无人值守：

```bash
node dist/cli/index.js xiaoyibao --fix --yes
```

### 4. 生成日报

```bash
node dist/cli/index.js run --profile daily-v5
```

生成结果：

```bash
data/reports/digest-YYYY-MM-DD.md
```

---

## 当前项目能做什么

- 用 `config/sources.registry.yaml` 统一维护 **skills / MCP / tools**
- 统一生成部署清单、安装提示、变量示例
- 通过 `xiaoyibao` 执行：
  - 检查
  - 报告
  - 交互确认安装
  - 配置提醒
- 通过能力层路由不同 source
- 在 source 不可用时自动 fallback

---

## 当前日报结构

1. 病友最关心的临床试验和药物研发
2. 专业研究发表热点文章
3. 科普病情管理知识
4. 营养和心理
5. 社区活动和公众号优质文章
6. 每日心理鼓励

其中：

- 第 1 模块当前是 **MCP-first**
- 第 5 模块已接入 **wechat search**
- 第 6 模块已接入本地 **psyco_kb**

---

## 核心设计原则

### 1. Ability-first

业务层不直接写死 `tavily` / `duck` / 某个 fetch。

统一走能力层：

- `clinical_trials_mcp`
- `chictr_mcp`
- `pubmed_mcp`
- `openclaw_grok_search`
- `tavily_search`
- `firecrawl_search`
- `wechat_search`

### 2. MCP 和 skill 严格分离

- `skill` 就是 `skill`
- `mcp` 就是 `mcp`
- **不允许 type 与 adapter 混用**

### 3. registry 驱动

新增一个 source 的理想动作：

1. 改 `config/sources.registry.yaml`
2. 同步派生文件
3. 补配置示例
4. 补测试
5. 更新 README

---

## 推荐入口

- `config/sources.registry.yaml`：统一 source 注册表
- `config/search-source-whitelist.yaml`：监控网站白名单
- `config/search-seeds.yaml`：重点 seed URLs
- `config/psyco_kb/daily_encouragement_kb.json`：每日心理鼓励知识库
- `docs/PROJECT_USAGE_SIMPLE.md`：极简使用说明
- `docs/PROJECT_USAGE.md`：完整使用手册

---

## 当前纳入监控的网站白名单

### 结构化主来源

- `clinicaltrials.gov`
- `chictr.org.cn`
- `pubmed.ncbi.nlm.nih.gov`

### 临床试验 / 药物研发增强来源

- `pancan.org`
- `letswinpc.org`
- `asco.org`
- `ascopubs.org`

### 研究热点增强来源

- `asco.org`
- `ascopubs.org`
- `esmoopen.com`
- `annalsofoncology.org`

### 社区 / 患者支持来源

- `pancan.org`
- `letswinpc.org`
- `mp.weixin.qq.com`

### 浏览器优先来源

- `esmoopen.com`

### 当前重点 seed URLs

- `https://letswinpc.org/treatments/finding-a-clinical-trial/`
- `https://www.esmoopen.com/current`
- `https://www.esmoopen.com/inpress`
- `https://www.esmoopen.com/action/doSearch?target=saved&runSaved=120716`
- `https://www.annalsofoncology.org/`

---

## 当前预置 source 概览

### MCP

- `clinical_trials_mcp`
- `chictr_mcp`
- `pubmed_mcp`
- `metasota_api_mcp`（备用）

### Skills / 搜索能力

- `openclaw_grok_search`
- `tavily_search`
- `firecrawl_search`
- `wechat_search`
- `vibe_writer_pro`

---

## 运行链路

### 临床试验板块

优先顺序：

1. `clinical_trials_mcp`
2. `chictr_mcp`
3. `openclaw_grok_search`
4. `tavily_search`
5. `firecrawl_search`
6. 本地 fallback

### 研究热点板块

优先顺序：

1. `pubmed_mcp`
2. 学术站点搜索增强
3. browser-first / firecrawl fallback

### 社区与公众号板块

优先顺序：

1. `wechat_search`
2. 主题关键词补充搜索
3. 其它兜底来源

来源展示规则：

- 命中小胰宝助手：`小胰宝助手公众号`
- 其它公众号：`其它来源公众号`

---

## 常用命令

### 检查环境

```bash
node dist/cli/index.js xiaoyibao
```

### 自动安装缺失项

```bash
node dist/cli/index.js xiaoyibao --fix
```

### 构建

```bash
npm run build
```

### 跑测试

```bash
npm test
npm run test:typecheck
```

### 同步派生配置

```bash
npm run sync:sources
```

### 生成日报

```bash
node dist/cli/index.js run --profile daily-v5
```

---

## 配置文件说明

### 1. source 注册表

```bash
config/sources.registry.yaml
```

用于定义：

- source 类型
- check 方式
- install 命令
- 能力 adapter
- MCP command / args
- 配置变量说明

### 2. 白名单

```bash
config/search-source-whitelist.yaml
```

用于维护：

- clinical trial sites
- research sites
- community sites
- browser required sites

### 3. seeds

```bash
config/search-seeds.yaml
```

用于维护：

- 临床试验种子页面
- 学术热点种子页面
- 社区种子页面

### 4. 本地心理知识库

```bash
config/psyco_kb/daily_encouragement_kb.json
```

---

## 环境变量

如果项目生成了 `.env.*.example`，复制为 `.local` 再填写真实值：

```bash
cp .env.openclaw-grok-search.example .env.openclaw-grok-search.local
```

`.env*.local` 已加入 `.gitignore`。

后续重点会继续补齐：

- `GROK_*`
- `TAVILY_API_KEY`
- `FIRECRAWL_API_KEY`

---

## 当前完成度

项目已进入 **可用收尾阶段**。

### 已完成

- Ability-first 主架构
- MCP-first 临床主链路
- skill / MCP 类型一致性校验
- 6 个日报板块可生成
- 本地心理鼓励知识库
- `xiaoyibao` 检查与自动安装框架
- 测试、构建、类型检查通过

### 待继续优化

- `xiaoyibao` 检查规则继续与运行态完全对齐
- Firecrawl / Grok / Tavily 环境 smoke test
- 白名单 / seed URL 更深接入查询路由
- README 与使用手册持续打磨

---

## 当前验证状态

最近一轮本地验证结果：

- `npm test` ✅
- `npm run test:typecheck` ✅
- `npm run build` ✅
- `node dist/cli/index.js run --profile daily-v5` ✅

---

## License

MIT

---

<!-- generated:sources:start -->
## 🔌 Sources Registry（自动生成）

以下内容由 `digest sync-sources` 从 `config/sources.registry.yaml` 自动生成。

| ID | 类型 | 角色 | 安装 | 配置文件 |
| --- | --- | --- | --- | --- |
| clinical_trials_mcp | npm_mcp | clinical_trials_primary | npx -y xiaoyibao-clinical-trials | - |
| pubmed_mcp | npm_mcp | pubmed_primary | npm install -g @scope/pubmed-mcp | - |
| tavily_search | skill | web_search_fallback | npx skills add tavily-search || skillhub install tavily-search | ~/.config/tavily/config.json |
| wechat_search | skill | community_wechat_search | npx skills add https://github.com/wuchubuzai2018/expert-skills-hub --skill wechat-article-search | - |
| chictr_mcp | npm_mcp | china_trials_primary | npx -y chictr-mcp-server@latest | - |
| metasota_api_mcp | npm_mcp | api_gateway_fallback | git clone https://github.com/PancrePal-xiaoyibao/metasota-API-MCP.git | - |
| vibe_writer_pro | skill | content_creation_assistant | npx skills add vibe-writer-pro | - |
| openclaw_grok_search | skill | web_search_primary_candidate | npx skills add https://github.com/stemmaker/openclaw-grok-search --skill openclaw-grok-search | .env.openclaw-grok-search.local |
| firecrawl_search | skill | web_search_fallback | npx skills add https://github.com/firecrawl/cli --skill firecrawl-search | .env.firecrawl.local |

### 使用方式

1. 修改 `config/sources.registry.yaml`
2. 运行 `digest sync-sources`
3. 自动更新 deployment catalog / `.env.*.example` / README
<!-- generated:sources:end -->
