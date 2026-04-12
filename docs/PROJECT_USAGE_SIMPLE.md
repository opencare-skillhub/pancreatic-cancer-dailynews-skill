# 项目使用手册（极简版）

如果你只想快速上手，按下面做就够了。

---

## 1. 新机器部署

```bash
git clone https://github.com/xtra-care-skillhub/pancreatic-cancer-dailynews-skill.git
cd pancreatic-cancer-dailynews-skill
npm install
npm run build
node dist/cli/index.js xiaoyibao
node dist/cli/index.js xiaoyibao --fix
```

如果提示继续安装，输入：

```bash
y
```

安装后，如果出现 `.env.*.example` 文件，就复制成 `.local` 后填写真实值。

例如：

```bash
cp .env.openclaw-grok-search.example .env.openclaw-grok-search.local
```

---

## 2. 新增或修改 source

只改一个文件：

```bash
config/sources.registry.yaml
```

改完执行：

```bash
npm run build
npm run sync:sources
node dist/cli/index.js xiaoyibao
```

如果需要安装缺失依赖：

```bash
node dist/cli/index.js xiaoyibao --fix
```

---

## 3. 最常用命令

### 检查依赖

```bash
node dist/cli/index.js xiaoyibao
```

### 自动安装依赖

```bash
node dist/cli/index.js xiaoyibao --fix
```

### 同步 source 配置

```bash
npm run sync:sources
```

### 运行测试

```bash
npm test
npm run test:typecheck
npm run build
```

---

## 4. 记住一句话

以后日常维护基本就是：

```text
改 config/sources.registry.yaml
-> npm run sync:sources
-> xiaoyibao 检查
-> xiaoyibao --fix 安装
```
