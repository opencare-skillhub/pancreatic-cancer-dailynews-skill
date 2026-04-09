# 小胰宝2.0 胰腺治疗新技术日报

**技能名称**: `pancreatic-cancer-news-digest`  
**定位**: 每日自动化胰腺癌治疗新技术医学新闻聚合  
**目标用户**: 胰腺癌患者、家属、医疗专业人士  
**输出格式**: Markdown 日报（飞书 Wiki + 群聊摘要）

---

## 🎯 核心能力

### 1. Multi-Source Aggregation
- **ClinicalTrials.gov API** - New & updated recruiting trials (pancreatic cancer specific)
- **PubMed** - Latest published research (last 7 days)
- **ClinicalTrials RSS** - Recent trial updates via RSS feed
- **ASCO RSS** - ASCO publications & news (if accessible)
- **ChiCTR** - Chinese clinical trials (optional, requires web scraping)
- **X/Twitter** - Key opinion leader discussions (optional, requires API)

### 2. Intelligent Filtering
- **Topic Filter**: Only pancreatic cancer related ( MeSH Term: "Pancreatic Neoplasms" )
- **Date Range**: Last 7 days (configurable)
- **Study Type Filter**: Clinical trials, Phase 2/3, systematic reviews, meta-analyses
- **Quality Prioritization**: RCTs > observational > case reports

### 3. Smart Summarization
- Auto-generate plain-language summaries
- Extract key metrics: ORR, PFS, OS, safety signals
- Tag by relevance: "Breaking", "Phase 3", "Approved", "Pipeline"
- Evidence grading (when available)

### 4. Multiple Output Formats
- **Feishu Wiki Document** - Full digest with hyperlinks
- **Group Chat Post** - Condensed highlights (top 5 items)
- **Email/Webhook** - Optional external delivery
- **Local Markdown File** - Archive copy

### 5. Automation & Scheduling
- **Daily Cron** - Configurable time (default 08:00 AM)
- **Weekly/Monthly Reports** - Aggregated summaries
- **On-Demand Trigger** - Manual refresh via command
- **Incremental Updates** - Track already-reported items to avoid duplicates

---

## 📁 Skill Structure

```
pancreatic-cancer-news-digest/
├── SKILL.md                    # This file
├── config/
│   ├── sources.json           # Data source configurations (URLs, API keys)
│   ├── filters.json           # Filter rules (keywords, date ranges)
│   └── output.json            # Output destinations (Feishu, webhook)
├── scripts/
│   ├── fetch.py               # Main orchestration script
│   ├── fetch_clinicaltrials.py
│   ├── fetch_pubmed.py
│   ├── fetch_rss.py
│   ├── fetch_chictr.py        # Optional
│   ├── fetch_twitter.py       # Optional
│   ├── deduplicate.py         # Remove duplicate news items
│   ├── summarize.py           # Generate summaries
│   └── publish.py             # Send to Feishu/other outputs
├── templates/
│   ├── digest_template.md     # Full digest template
│   ├── highlight_template.md  # Short format template
│   └── feishu_card.json       # Rich card template
├── tests/
│   ├── test_fetch.py
│   └── test_summarize.py
├── data/
│   ├── cache/                # Cached responses (rate limit prevention)
│   ├── history.json          # Already published items (dedup)
│   └── reports/              # Daily report archives
├── requirements.txt          # Python dependencies
└── README.md                # User-facing documentation
```

---

## 🔧 Implementation Details

### Dependencies

```txt
requests>=2.31.0
feedparser>=6.0.10      # RSS parsing
beautifulsoup4>=4.12.0  # HTML parsing (ChiCTR)
python-dateutil>=2.8.0
markdown>=3.5
openclaw-flybook>=0.1.0  # Feishu API wrapper (if available)
```

### Configuration Schema

**config/sources.json**
```json
{
  "clinicaltrials": {
    "enabled": true,
    "condition": "pancreatic cancer",
    "status": ["RECRUITING", "NOT_YET_RECRUITING"],
    "sort": "LastUpdatePostDate:desc",
    "page_size": 50,
    "date_field": "LastUpdatePostDate"
  },
  "pubmed": {
    "enabled": true,
    "mesh_terms": ["Pancreatic Neoplasms"],
    "date_range_days": 7,
    "max_results": 30,
    "filter_types": ["Clinical Trial", "Meta-Analysis", "Randomized Controlled Trial"]
  },
  "rss_feeds": [
    {
      "name": "ClinicalTrials RSS",
      "url": "https://clinicaltrials.gov/api/rss?cond=pancreatic+cancer&firstPost=2026-01-01_&dateField=LastUpdatePostDate",
      "enabled": true
    }
  ],
  "chictr": {
    "enabled": false,
    "condition": "胰腺癌",
    "max_results": 20
  }
}
```

**config/output.json**
```json
{
  "feishu_wiki": {
    "enabled": true,
    "space_id": "QtIXwuGf4iAfVskGfj8cjxfYnmf",
    "parent_node": "N123456789",  # Parent wiki node (e.g., "每日医学新闻")
    "title_template": "胰腺癌医学日报 {date}",
    "publish_as_draft": false
  },
  "feishu_chat": {
    "enabled": true,
    "chat_id": "oc_xxxxxxxxxxxx",  # Group chat ID for highlights
    "max_highlights": 5,
    "template": "highlight"
  }
}
```

---

## 🚀 Execution Flow

```
┌─────────────────────────────────────────────────────────────┐
│  1. FETCH PHASE                                            │
│  ├── ClinicalTrials.gov API  ──> JSON studies              │
│  ├── PubMed E-utilities      ──> XML articles              │
│  ├── RSS Feeds               ──> XML entries               │
│  └── Optional scrapers (ChiCTR, ASCO, X)                   │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  2. NORMALIZE PHASE                                        │
│  ├── Convert all sources → unified Item schema             │
│  ├── Extract: title, source, date, url, summary, tags     │
│  ├── Standardize date formats (ISO 8601 → YYYY-MM-DD)     │
│  └── Attach raw metadata for traceability                  │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  3. DEDUPLICATE PHASE                                      │
│  ├── Load history.json (last N days published items)       │
│  ├── Fuzzy match: title similarity + source URL            │
│  ├── Check: already reported? → skip                       │
│  └── Mark: new items → add to digest                       │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  4. PRIORITIZE & SUMMARIZE                                 │
│  ├── Score: phase (3 > 2 > 1), type (RCT > meta > case)   │
│  ├── Generate: plain-language summary (50-100 words)      │
│  ├── Extract: key numbers (ORR, PFS, N=, etc.)            │
│  └── Tag: "Breaking", "Phase 3", "FDA", "China" etc.      │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  5. PUBLISH PHASE                                          │
│  ├── Render Markdown (full digest)                         │
│  ├── Create Feishu Wiki doc (append to archive)           │
│  ├── Post highlights to group chat (top 3-5 items)        │
│  └── Save to data/reports/YYYY-MM-DD.md                    │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  6. UPDATE HISTORY                                          │
│  └── Append new item IDs to history.json (persist)        │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Output Format Example

**Full Digest (Wiki)**
```markdown
# 胰腺癌医学日报 2026-04-09

## 📈 今日要点 (3项新发现)

### 🔬 临床试验

#### 1️⃣ [NCT12345678] KRAS G12D 抑制剂 + 免疫治疗 Phase 2 结果
- **来源**: ClinicalTrials.gov (更新于 2026-04-08)
- **链接**: https://clinicaltrials.gov/ct2/show/NCT12345678
- **关键数据**: ORR 38.5%, PFS 6.2个月, OS 14.1个月 (n=86)
- **摘要**: 联合疗法在 KRAS G12D 突变胰腺癌中显示出优于单药的生存获益...
- **标签**: #Phase2 #KRAS #突破性进展

#### 2️⃣ [ChiCTR202512345] 中国自主研发 PD-1 抑制剂胰腺癌适应症获批
...

### 📚 最新文献

#### 3️⃣ Nature Medicine: 谷胱甘肽代谢重编程与化疗耐药新机制
- **PMID**: 41950246
- **发表日期**: 2026-04-07
- **链接**: https://pubmed.ncbi.nlm.nih.gov/41950246/
- **核心发现**: 肿瘤微环境中 GSH 水平与 FOLFOX 化疗敏感性呈负相关...
- **证据等级**: 前瞻性队列研究 (IIa级)
- **标签**: #基础研究 #化疗耐药 #生物标志物

---

## 📊 数据统计

| 指标 | 数量 |
|------|------|
| 新增临床试验 | 12 |
| 新增文献 | 78 |
| Phase 3 试验 | 3 |
| 中国研究 | 5 |
| 总信息源 | 4 |

---

*报告生成时间: 2026-04-09 08:15 (Asia/Shanghai)*  
*数据覆盖: ClinicalTrials.gov, PubMed, RSS Feeds*  
*下一更新: 2026-04-10 08:00*
```

**Highlights (Group Chat)**
```
📊 胰腺癌医学日报 · 2026-04-09 · 3条新突破

🔬 [NCT12345678] KRAS G12D抑制剂+免疫治疗 Phase2 结果积极
   ORR 38.5%, PFS 6.2个月 → 显著优于单药（P<0.01）
   #Phase2 #KRAS #突破性进展

🇨🇳 [ChiCTR202512345] 国产PD-1抑制剂胰腺癌适应症获批
   基于3期临床试验（NCT2020xxxx），mPFS 5.8 vs 3.9个月
   #中国创新 #PD-1 #获批

🧬 [PMID 41950246] Nature Medicine: 谷胱甘肽代谢与化疗耐药新机制
   发现GSH水平可预测FOLFOX疗效，潜在生物标志物
   #基础研究 #化疗耐药

📋 今日共监测 4 个信息源，筛选出 3 条高价值资讯
🔗 完整报告: https://uei55ql5ok.feishu.cn/wiki/xxxxx
```

## 🚀 Execution in OpenClaw

### As a Standalone Script

```bash
cd skills/pancreatic-cancer-news-digest
./quick-start.sh run
```

### Via OpenClaw Gateway (Cron)

Add to OpenClaw crontab (cron tool):

```bash
# Daily at 08:00 AM (Asia/Shanghai)
cron add --action add --job '{
  "name": "pancreatic-cancer-news-digest-daily",
  "schedule": {"kind": "cron", "expr": "0 8 * * *", "tz": "Asia/Shanghai"},
  "payload": {
    "kind": "agentTurn",
    "message": "Run pancreatic-cancer-news-digest with --output all --chat-notify",
    "model": "stepfun/step-3.5-flash"
  },
  "sessionTarget": "isolated",
  "delivery": {"mode": "announce", "channel": "feishu", "to": "user:ou_daf5bddb708904976a28b1a83c12c5d7"}
}'
```

### Via OpenClaw Subagent (Manual Trigger)

```bash
# Spawn isolated session to run digest
sessions_spawn runtime="subagent" task="Run pancreatic cancer news digest" \
  label="news-digest-2026-04-09"
```

Inside the subagent session, run:
```bash
cd /home/gem/workspace/agent/workspace/skills/pancreatic-cancer-news-digest
python3 scripts/fetch.py --output all --chat-notify
```

### As a System Service (persistent)

Create systemd service (if systemd available):
```ini
[Unit]
Description=Pancreatic Cancer News Digest
After=network.target

[Service]
Type=oneshot
WorkingDirectory=/home/gem/workspace/agent/workspace/skills/pancreatic-cancer-news-digest
ExecStart=/usr/bin/python3 scripts/fetch.py --output all --chat-notify
User=gem
```

---

## 📦 Deployment Checklist

- [x] Skill directory structure created
- [x] SKILL.md documented
- [x] Core fetch script implemented (ClinicalTrials + PubMed + RSS)
- [x] Configuration files (sources.json, output.json)
- [x] Dependencies installed (requests, feedparser, beautifulsoup4)
- [ ] Feishu Wiki integration tested (pending)
- [ ] Feishu chat integration tested (pending)
- [ ] Cron job scheduled (optional)
- [ ] History deduplication validated (first run will populate)
- [ ] Monthly archive node created in Wiki (optional)

---

## 🎯 Phase 2 Enhancements (Future)

### LLM-Powered Summarization
Replace rule-based `generate_summary()` with LLM call for richer patient-friendly summaries.

### ChiCTR Integration
Add `fetch_chictr()` function using `web_crawl` or `playwright-browser` to scrape Chinese trials.

### ASCO/AACR RSS Fix
Diagnose why ASCO RSS returns no items; may need specific headers or cookie handling.

### X/Twitter Monitoring
Integrate with `miaoda-web-search` or Tavily to search pancreatic cancer keywords on X.com.

### Personalized Alerts
Store user preferences (e.g., "only notify about KRAS trials") in `config/user_prefs.json`.

### Webhook Support
POST digest to external endpoints (Slack, Telegram, email) via `webhook` delivery mode.

---

## 🧪 Testing Results (2026-04-09)

**Dry-run test output:**
```
Total fetched: 79 items
  - ClinicalTrials.gov: 50 trials
  - PubMed: 19 articles
  - RSS feeds: 10 items
Deduplication: 79 new items
Prioritization: Phase 2/3 trials ranked first
```

**Status**: ✅ MVP functional, ready for production scheduling

---

**Skill ID**: `pancreatic-cancer-news-digest`  
**Version**: 0.1.0 (MVP)  
**Maintainer**: sam (技术运维)  
**Last Updated**: 2026-04-09  
**Next Steps**: Test Feishu publishing, set up daily cron

---

## 🛠️ Usage

### On-Demand Execution
```bash
# Generate today's digest immediately
python scripts/fetch.py --output feishu --chat-notify

# Generate for specific date
python scripts/fetch.py --date 2026-04-08 --output markdown
```

### Scheduled Execution
```bash
# Add to cron (daily at 08:00)
crontab -e
0 8 * * * cd /path/to/skill && python scripts/fetch.py --output feishu --chat-notify
```

### OpenClaw Integration
```bash
# Trigger via OpenClaw command
/openclaw run pancreatic-cancer-news-digest
```

---

## 📈 Future Enhancements (Phase 2)

1. **AI-Powered Summary** - Use LLM to generate patient-friendly summaries
2. **Personalized Alerts** - User-defined keyword filters (e.g., "KRAS", " immunotherapy")
3. **Multi-Language** - Chinese/English bilingual output
4. **Analytics Dashboard** - Trend analysis (e.g., "Phase 3 trials increased 20% MoM")
5. **API Endpoint** - REST API for external consumption
6. **Mobile Notifications** - Push to WeChat/Telegram bots
7. **Trial Matching** - Auto-match trials to patient profile (requires PII handling, high security)

---

## 🧪 Testing

```bash
# Unit tests
pytest tests/test_fetch.py -v

# Dry-run (no publishing)
python scripts/fetch.py --dry-run --output markdown

# Validate output format
python scripts/fetch.py --validate-only
```

---

## 📝 Maintenance

- **Daily check**: Verify cron job executed, review output quality
- **Weekly review**: Adjust filter thresholds, add new sources
- **Monthly audit**: Clean history.json, archive old reports, update dependencies

---

**Status**: Ready for implementation  
**Priority**: P0 (Daily operational need)  
**Owner**: sam (技术运维)  
**Estimated Effort**: 4-6 hours (MVP) | 8-12 hours (full feature)
