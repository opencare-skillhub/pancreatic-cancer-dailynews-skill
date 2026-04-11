# 小胰宝2.0 胰腺治疗新技术日报

每日自动化聚合胰腺癌治疗新技术、临床试验、医学新闻的智能订阅服务。

## 🎯 核心特性

- ✅ **多源聚合** - ClinicalTrials.gov, PubMed, RSS, 微信公众号
- ✅ **智能去重** - 追踪已发布项目，避免重复推送
- ✅ **优先级排序** - 按试验阶段、研究类型、相关性智能排序（Phase 3 > Phase 2 > Phase 1）
- ✅ **患者友好摘要** - 自动生成通俗易懂的内容摘要
- ✅ **标签系统** - #Phase3 #KRAS #免疫治疗 #化疗 等自动标注
- ✅ **多格式输出** - 本地 Markdown + 飞书 Wiki + 群聊摘要
- ✅ **定时自动化** - 支持 Cron 定时执行，增量更新
- ✅ **智能缓存** - 6小时缓存机制，尊重 API 限流

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd /home/gem/workspace/agent/workspace/skills/pancreatic-cancer-news-digest
./quick-start.sh install
```

### 2. Test Fetch (Dry-run)

```bash
./quick-start.sh test
```

This will fetch today's news and print a preview **without publishing**.

**Expected output**:
```
📊 Total fetched: 79 items
  - ClinicalTrials.gov: 50 trials
  - PubMed: 19 articles
  - RSS: 10 items
✅ Deduplication: 79 → 79 new items
📈 Prioritized 79 items
```

### 3. Generate Report Locally

```bash
./quick-start.sh run
```

This creates:
- Full digest: `data/reports/digest-YYYY-MM-DD.md`
- Updates history: `data/history.json`

### 4. Publish to Feishu (Manual)

After verifying the local report, publish to Feishu:

**a) Wiki Document**:
```bash
# In OpenClaw session, use feishu_create_doc tool
# Read the generated digest file and pass its content:
feishu_create_doc title="胰腺癌医学日报 2026-04-09" markdown="$(cat data/reports/digest-2026-04-09.md)" wiki_space="QtIXwuGf4iAfVskGfj8cjxfYnmf"
```

**b) Group Chat Highlights**:
```bash
# Post to group chat (oc_8c0644c53e832ebb2c578294686fed96)
feishu_im_user_message send --receive_id_type chat_id --receive_id oc_8c0644c53e832ebb2c578294686fed96 --msg_type text --content '{"text":"📊 今日胰腺癌医学新闻摘要 (前5条):\n1. [NCT04858334] BRCA/Olaparib试验...\n🔗 完整报告: [链接]"}'
```

---

## ⏰ Scheduling (Daily Automation)

### Option A: OpenClaw Cron (Recommended)

```bash
# Add daily cron job (runs at 08:00 AM)
cron add --action add --job '{
  "name": "pancreatic-cancer-news-digest-daily",
  "schedule": {"kind": "cron", "expr": "0 8 * * *", "tz": "Asia/Shanghai"},
  "payload": {
    "kind": "agentTurn",
    "message": "Run pancreatic-cancer-news-digest with --output all",
    "model": "stepfun/step-3.5-flash"
  },
  "sessionTarget": "isolated"
}'
```

### Option B: System Crontab

```bash
crontab -e
# Add line:
0 8 * * * cd /home/gem/workspace/agent/workspace/skills/pancreatic-cancer-news-digest && /usr/bin/python3 scripts/fetch.py --output markdown >> data/logs/cron.log 2>&1
```

---

## 📊 Output Structure

### Full Digest (Markdown)

```markdown
# 胰腺癌医学日报 2026-04-09

**生成时间**: 2026-04-09 08:07 (Asia/Shanghai)
**数据源**: ClinicalTrials.gov, PubMed, RSS Feeds
**条目总数**: 79

## 🔬 临床试验更新

### 1. [NCT04858334] APOLLO: BRCA1/2 突变胰腺癌辅助治疗 Olaparib 试验
- **来源**: ClinicalTrials.gov
- **阶段**: PHASE2 | **状态**: RECRUITING
- **入组人数**: 152
- **链接**: https://clinicaltrials.gov/ct2/show/NCT04858334
- **标签**: #Phase2 #BRCA

## 📚 最新研究文献

### 1. Hereditary chronic pancreatitis induced plasticity...
- **作者**: Inamdar et al.
- **期刊**: Gut
- **发表日期**: 2026-Apr-07
- **PMID**: 41419303
- **链接**: https://pubmed.ncbi.nlm.nih.gov/41419303/
- **标签**: #KRAS
```

### Highlights (for Group Chat)

```
📊 胰腺癌医学日报 · 2026-04-09 · 79条更新

🔬 [NCT04858334] APOLLO: BRCA1/2突变胰腺癌辅助治疗Olaraparib试验
    Phase 2, RECRUITING, 152人
    #Phase2 #BRCA

📚 [PMID 41419303] Gut: 遗传性慢性胰腺炎与KRAS突变协同作用
    发表日期: 2026-04-07
    #KRAS #基础研究

... 还有 77 条，查看完整报告: [Wiki链接]
```

---

## 🔧 Configuration

### `config/sources.json`

控制数据源开关、查询参数：

```json
{
  "sources": {
    "clinicaltrials": {
      "enabled": true,
      "condition": "pancreatic cancer",
      "status": ["RECRUITING", "NOT_YET_RECRUITING"],
      "page_size": 50
    },
    "pubmed": {
      "enabled": true,
      "mesh_terms": ["Pancreatic Neoplasms"],
      "date_range_days": 7,
      "max_results": 50
    },
    "rss_feeds": [
      {
        "name": "ClinicalTrials RSS",
        "url": "https://clinicaltrials.gov/api/rss?...",
        "enabled": true
      }
    ]
  }
}
```

### `config/output.json`

控制输出目的地：

```json
{
  "feishu_wiki": {
    "enabled": true,
    "space_id": "QtIXwuGf4iAfVskGfj8cjxfYnmf",
    "title_template": "胰腺癌医学日报 {date}"
  },
  "feishu_chat": {
    "enabled": true,
    "chat_id": "oc_8c0644c53e832ebb2c578294686fed96",
    "max_highlights": 5
  },
  "schedule": {
    "daily_time": "08:00",
    "timezone": "Asia/Shanghai"
  }
}
```

---

## 🛠️ Troubleshooting

### "No new items" but I know there are updates

**Cause**: Already in `data/history.json` (deduplication working)

**Fix**:
```bash
./quick-start.sh clean-history  # DANGER: will re-publish all
./quick-start.sh run
```

### ClinicalTrials.gov returns 0 results

**Debug**:
```bash
curl "https://clinicaltrials.gov/api/v2/studies?query.cond=pancreatic+cancer&pageSize=1"
```

**Fix**: Adjust `config/sources.json` condition to `"pancreatic neoplasm"` or check network.

### Feishu Wiki authorization required

The skill saves locally first. To publish to Wiki:

1. Authorize bot: Use `feishu_oauth` tool (one-time)
2. Call `feishu_create_doc` with the digest content
3. Ensure bot has `wiki:write` permission in space settings

### RSS feed empty (ASCO)

ASCO RSS requires specific headers. Currently disabled in config. To enable:

```json
"rss_feeds": [
  {
    "name": "ASCO",
    "url": "...",
    "enabled": true,
    "headers": {"User-Agent": "Mozilla/5.0..."}
  }
]
```

---

## 🔎 自动部署清单新增：openclaw-grok-search

当前项目已将 `openclaw-grok-search` 纳入 `config/deployment/dependency-catalog.json`，用于后续 `digest doctor --fix` / `digest install-source openclaw_grok_search` 自动生成安装计划。

推荐标准流程：

```text
检查 -> 报告 -> 互动确认安装依赖技能/MCP/工具 -> 输入 Y 后执行安装 -> 提示配置变量文件
```

对应命令：

```bash
digest doctor --fix
```

当前行为为：

1. 检查环境与依赖
2. 输出缺失项与待执行动作
3. 询问 `Continue? [y/N]`
4. 先展示安装队列（默认按 `skill -> MCP -> 其他工具`）
5. 输入 `y` 后顺序执行安装命令
6. 安装结束后提示对应的配置变量文件与必填变量
7. 若存在 `.example` 模板，会自动复制生成对应 `.local` 文件
8. 如果安装失败，会给出失败类型提示（命令缺失 / 权限 / 网络或 registry）

### 安装命令

```bash
npx skills add https://github.com/stemmaker/openclaw-grok-search --skill openclaw-grok-search
```

### MCP 安装策略更新

当前推荐优先使用 `npx -y` 方式运行 MCP，而不是 `git clone + npm install`。

推荐配置：

```json
{
  "mcpServers": {
    "clinical_trials": {
      "command": "npx",
      "args": ["-y", "xiaoyibao-clinical-trials"]
    },
    "chictr": {
      "command": "npx",
      "args": ["-y", "chictr-mcp-server@latest"]
    }
  }
}
```

这样更适合：

- `digest doctor --fix`
- 自动化部署
- MCP 网关配置
- 后续版本升级

### 环境变量

已新增示例文件：

```bash
.env.openclaw-grok-search.example
```

建议本地复制为：

```bash
cp .env.openclaw-grok-search.example .env.openclaw-grok-search.local
```

并填写真实密钥。`.env*.local` 已加入 `.gitignore`，避免提交敏感信息。

### 变量说明

- `GROK_BASE_URL`
- `GROK_API_KEY`
- `GROK_MODEL`（可选）
- `GROK_BACKUP_BASE_URL`
- `GROK_BACKUP_API_KEY`

### 重要说明

用户给出的主地址是：

```text
https://grok2api.samfun.asia/v1/chat/completions
```

但上游 `openclaw-grok-search` 脚本会自行拼接 `/v1/chat/completions`，所以**运行时** `GROK_BASE_URL` 应配置为：

```text
https://grok2api.samfun.asia
```

备用地址建议保存为：

```text
https://ai.huan666.de
```

---

## 📁 File Structure

```
pancreatic-cancer-news-digest/
├── SKILL.md               (11 KB) - Skill definition
├── README.md              (This file)
├── DEPLOYMENT.md          - Detailed deployment guide
├── quick-start.sh         - Helper script (6 commands)
├── requirements.txt       - Dependencies
├── config/
│   ├── sources.json       - Data source configs
│   └── output.json        - Feishu/chat destinations
├── scripts/
│   └── fetch.py           - Main script (21 KB)
├── templates/
│   └── digest_template.md
├── tests/
│   └── test_fetch.py
└── data/
    ├── cache/             - API response cache (auto-clean)
    ├── history.json       - Published item IDs (dedup)
    ├── reports/           - Daily digests
    └── logs/              - Execution logs (optional)
```

---

## 📈 Metrics & Monitoring

### Daily Health Check

```bash
# Check last report exists and has content
ls -lh data/reports/digest-$(date +%Y-%m-%d).md
wc -l data/reports/digest-$(date +%Y-%m-%d).md

# Check history size
wc -l data/history.json

# View latest cache
ls -lht data/cache/
```

### Success Metrics

| Metric | Target | Current (2026-04-09) |
|--------|--------|---------------------|
| Items fetched/day | ≥ 30 | 79 ✅ |
| CT.gov trials | ≥ 20 | 50 ✅ |
| PubMed articles | ≥ 10 | 19 ✅ |
| Duplicate rate | ≤ 10% | 0% ✅ |
| Report size | ≥ 100 lines | 421 ✅ |

---

## 🔄 Future Enhancements

### Phase 2 (Next)

- [ ] **ASCO RSS fix** - Add custom headers, debug feed parser
- [ ] **ChiCTR integration** - Scrape Chinese clinical trials
- [ ] **LLM summarization** - Replace rule-based summaries with AI
- [ ] **Feishu auto-publish** - Integrated tool calls in fetch.py
- [ ] **Weekly/Monthly aggregates** - Additional cron jobs

### Phase 3 (Long-term)

- [ ] **Personalized alerts** - User-defined keyword filters
- [ ] **Trial matching** - Match trials to patient profile (PII-safe)
- [ ] **Multi-language** - Bilingual (中文/English) output
- [ ] **Analytics dashboard** - Trend analysis, charts
- [ ] **API endpoint** - REST API for external consumption
- [ ] **Webhook support** - Slack/Telegram/email delivery

---

## 🧪 Testing

```bash
# Dry-run (preview)
./quick-start.sh test

# Full run (local files only)
./quick-start.sh run

# Check status
./quick-start.sh status

# Clean cache (force refresh)
./quick-start.sh clean-cache

# Run unit tests
pytest tests/ -v
```

---

## 📝 Maintenance

| Frequency | Task |
|-----------|------|
| **Daily** | Check cron execution, verify report generated |
| **Weekly** | Review source quality, adjust filters, clear cache if needed |
| **Monthly** | Archive old reports, update dependencies, audit history size |

---

## 🎯 Success Criteria

- [x] Fetches ≥30 items/day from ≥2 sources
- [x] Deduplication works (no repeats within 30 days)
- [x] Phase 3 trials ranked in top 5
- [x] Generates valid Markdown with proper sections
- [ ] Auto-publishes to Feishu Wiki (pending test)
- [ ] Auto-posts highlights to group chat (pending test)
- [ ] Daily cron reliability ≥95%

---

**Skill ID**: `pancreatic-cancer-news-digest`  
**Version**: 0.1.0 (MVP)  
**Maintainer**: sam (技术运维)  
**Created**: 2026-04-09  
**Location**: `/home/gem/workspace/agent/workspace/skills/pancreatic-cancer-news-digest/`

## ❓ Need Help?

Check:
- `DEPLOYMENT.md` - Detailed setup & Feishu integration
- `SKILL.md` - Full skill architecture
- Logs: `tail -f data/reports/digest-*.md`

---

*Built for Pancreatic Cancer Patient Community 2.0 🩺*

---

<!-- generated:sources:start -->
## 🔌 Sources Registry（自动生成）

以下内容由 `digest sync-sources` 从 `config/sources.registry.yaml` 自动生成。

| ID | 类型 | 角色 | 安装 | 配置文件 |
| --- | --- | --- | --- | --- |
| clinical_trials_mcp | npm_mcp | clinical_trials_primary | npx -y xiaoyibao-clinical-trials | - |
| pubmed_mcp | npm_mcp | pubmed_primary | npm install -g @scope/pubmed-mcp | - |
| tavily_search | skill | web_search_fallback | npx skills add tavily-search || skillhub install tavily-search | ~/.config/tavily/config.json |
| wechat_search | skill | community_wechat_search | already built-in | - |
| chictr_mcp | npm_mcp | china_trials_primary | npx -y chictr-mcp-server@latest | - |
| metasota_api_mcp | npm_mcp | api_gateway_fallback | git clone https://github.com/PancrePal-xiaoyibao/metasota-API-MCP.git | - |
| vibe_writer_pro | skill | content_creation_assistant | npx skills add vibe-writer-pro | - |
| openclaw_grok_search | skill | web_search_primary_candidate | npx skills add https://github.com/stemmaker/openclaw-grok-search --skill openclaw-grok-search | .env.openclaw-grok-search.local |

### 使用方式

1. 修改 `config/sources.registry.yaml`
2. 运行 `digest sync-sources`
3. 自动更新 deployment catalog / `.env.*.example` / README
<!-- generated:sources:end -->

现在 `config/sources.registry.yaml` 已切换为**真正 YAML 语法**，并且已包含当前项目的现有 skills 与 MCP。
