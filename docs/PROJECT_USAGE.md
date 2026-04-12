# 项目使用手册

适用对象：

- 新机器首次部署
- 日常维护 source / skill / MCP
- 用 `xiaoyibao` / `sync-sources` 管理依赖

---

## 1. 新机器部署

### 1.1 克隆项目

```bash
git clone https://github.com/xtra-care-skillhub/pancreatic-cancer-dailynews-skill.git
cd pancreatic-cancer-dailynews-skill
```

### 1.2 安装依赖

```bash
npm install
npm run build
```

### 1.3 检查当前环境

```bash
node dist/cli/index.js xiaoyibao
```

只看 skills：

```bash
node dist/cli/index.js xiaoyibao --skills
```

只看 MCP / source：

```bash
node dist/cli/index.js xiaoyibao --sources
```

### 1.4 自动安装缺失依赖

```bash
node dist/cli/index.js xiaoyibao --fix
```

标准流程：

1. 检查环境与依赖
2. 输出缺失项
3. 展示安装队列
4. 询问 `Continue? [y/N]`
5. 输入 `y` 后执行安装
6. 输出配置变量文件提示

无人值守模式：

```bash
node dist/cli/index.js xiaoyibao --fix --yes
```

### 1.5 配置本地变量

如果项目生成了 `.env.*.example`，复制为 `.local`：

```bash
cp .env.openclaw-grok-search.example .env.openclaw-grok-search.local
```

然后填写真实变量值。

> `.env*.local` 已加入 `.gitignore`，不会进入仓库。

---

## 2. 新增一个 source

现在新增 source 的唯一入口是：

```bash
config/sources.registry.yaml
```

支持的典型类型：

- `skill`
- `npm_mcp`
- `remote_mcp`
- `local_cli`

### 2.1 新增步骤

1. 编辑 `config/sources.registry.yaml`
2. 增加一条 source 配置
3. 执行同步命令
4. 执行 xiaoyibao 检查

### 2.2 例子：新增一个 skill

```yaml
- id: demo_search
  type: skill
  required: false
  enabled: true
  role: web_search_fallback
  check:
    kind: file_exists
    path: "/home/you/.agents/skills/demo-search/"
  install:
    kind: github_skill
    command: "npx skills add https://github.com/example/demo-search --skill demo-search"
  fallback: web_search_stub
  docs:
    homepage: "https://github.com/example/demo-search"
  config:
    file: ".env.demo-search.local"
    vars:
      - DEMO_SEARCH_API_KEY
    exampleValues:
      DEMO_SEARCH_API_KEY: replace-demo-key
```

### 2.3 同步派生文件

```bash
npm run build
npm run sync:sources
```

会自动更新：

- `config/deployment/dependency-catalog.json`
- `.env.*.example`
- `README.md` 自动生成区块

### 2.4 检查并安装

```bash
node dist/cli/index.js xiaoyibao --fix
```

---

## 3. 更新一个 source

更新 source 时，依然只改：

```bash
config/sources.registry.yaml
```

常见更新包括：

- 改安装命令
- 改 `type`
- 改 `check`
- 改变量文件
- 改 `mcp.command/args`

### 更新步骤

```bash
npm run build
npm run sync:sources
node dist/cli/index.js xiaoyibao
```

如果需要补装：

```bash
node dist/cli/index.js xiaoyibao --fix
```

---

## 4. 常见命令清单

### 构建

```bash
npm run build
```

### 测试

```bash
npm test
npm run test:typecheck
```

### 同步 sources registry

```bash
npm run sync:sources
```

### 检查依赖

```bash
node dist/cli/index.js xiaoyibao
node dist/cli/index.js xiaoyibao --skills
node dist/cli/index.js xiaoyibao --sources
```

### 自动修复/安装

```bash
node dist/cli/index.js xiaoyibao --fix
node dist/cli/index.js xiaoyibao --fix --yes
```

### 查看单个 source 的安装计划

```bash
node dist/cli/index.js install-source openclaw_grok_search
```

---

## 5. 推荐日常流程

### 场景 A：新机器初始化

```bash
npm install
npm run build
node dist/cli/index.js xiaoyibao
node dist/cli/index.js xiaoyibao --fix
```

### 场景 B：新增/更新 source

```bash
# 1. 修改 config/sources.registry.yaml
npm run build
npm run sync:sources
node dist/cli/index.js xiaoyibao
```

### 场景 C：准备提交前

```bash
npm test
npm run test:typecheck
npm run build
```

---

## 6. 当前项目定位

当前项目已经比较稳定的部分是：

- source registry 管理
- skills / MCP / 工具安装流程
- `xiaoyibao --fix` 检查与安装闭环
- `sync-sources` 派生生成

当前最适合把它作为：

- 日报系统的依赖管理层
- source 接入与维护层
- MCP / skills 编排底座
