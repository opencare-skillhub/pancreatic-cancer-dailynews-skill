# 小胰宝2.0 胰腺治疗新技术日报 - 部署指南

## ✅ 当前状态（2026-04-09）

**技能名称**: `pancreatic-cancer-news-digest`  
**版本**: v3.1 (Search Enhanced)  
**状态**: ✅ 生产就绪，已部署

### 已完成功能

| 特性 | 状态 | 说明 |
|------|------|------|
| ClinicalTrials.gov API 抓取 | ✅ | 50个试验/日，智能去重 |
| PubMed 文献获取 | ✅ | 19篇/日（最近7天） |
| RSS 订阅 | ✅ | 10条/日（CT.gov更新） |
| 去重系统 | ✅ | history.json 追踪历史 |
| 优先级排序 | ✅ | Phase 3 > Phase 2 > Phase 1 |
| Markdown 生成 | ✅ | 完整日报 + 群聊摘要 |
| 本地输出 | ✅ | `data/reports/digest-YYYY-MM-DD.md` |
| 飞书 Wiki 发布 | ✅ | 自动创建文档，知识库归档 |
| 群聊推送 | ✅ | 微光闪烁-病情互助飞书1群 |
| 定时任务 | ✅ | OpenClaw Cron 每日 08:00 |

### 待集成（Phase 3.2）

---

## 🚀 Quick Start (Production)

### 1. Verify Installation

```bash
cd /home/gem/workspace/agent/workspace/skills/pancreatic-cancer-news-digest
./quick-start.sh status
```

Expected output:
```
📊 Digest Status
  Cache files: X files
  History entries: 70
  Last report: digest-2026-04-09.md
```

### 2. Test Full Pipeline (with Feishu)

```bash
# Dry-run first
./quick-start.sh test

# Actual run (will try to publish to Feishu)
./quick-start.sh run
```

### 3. Configure Feishu Outputs

Edit `config/output.json`:

```json
{
  "feishu_wiki": {
    "enabled": true,
    "space_id": "QtIXwuGf4iAfVskGfj8cjxfYnmf",
    "parent_node": "",  // Leave empty for root, or specify node token
    "title_template": "胰腺癌医学日报 {date}"
  },
  "feishu_chat": {
    "enabled": true,
    "chat_id": "oc_8c0644c53e832ebb2c578294686fed96",
    "max_highlights": 5
  }
}
```

**Get chat_id**: Ask OpenClaw or check group chat info.

### 4. Schedule Daily Run

#### Option A: OpenClaw Cron (Recommended)

```bash
# Add to OpenClaw crontab
cron add --action add --job '{
  "name": "pancreatic-cancer-news-digest-daily",
  "schedule": {"kind": "cron", "expr": "0 8 * * *", "tz": "Asia/Shanghai"},
  "payload": {
    "kind": "systemEvent",
    "text": "/run pancreatic-cancer-news-digest"
  },
  "sessionTarget": "main",
  "delivery": {"mode": "announce"}
}'
```

#### Option B: System Crontab

```bash
crontab -e
# Add:
0 8 * * * cd /home/gem/workspace/agent/workspace/skills/pancreatic-cancer-news-digest && /usr/bin/python3 scripts/fetch.py --output all --chat-notify >> /var/log/news-digest.log 2>&1
```

---

## 📖 Usage Examples

### On-Demand Run (Now)

```bash
# Full digest + chat notification
./quick-start.sh run

# Wiki only
./quick-start.sh wiki

# Chat highlights only
./quick-start.sh chat

# Preview without publishing
./quick-start.sh test
```

### Clear Cache / Reset

```bash
# Clear API response cache (force fresh fetch)
./quick-start.sh clean-cache

# Clear deduplication history (re-publish all items - DANGEROUS)
./quick-start.sh clean-history
```

### Check Status

```bash
./quick-start.sh status
```

---

## 🔧 Configuration Reference

### sources.json

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `clinicaltrials.enabled` | bool | `true` | Enable/disable CT.gov fetch |
| `clinicaltrials.condition` | str | `"pancreatic cancer"` | Search condition |
| `clinicaltrials.status` | array | `["RECRUITING",...]` | Trial statuses to include |
| `clinicaltrials.page_size` | int | `50` | Max results per fetch |
| `pubmed.enabled` | bool | `true` | Enable PubMed fetch |
| `pubmed.date_range_days` | int | `7` | Look back N days |
| `pubmed.max_results` | int | `50` | Max articles |
| `rss_feeds[].enabled` | bool | `true` | Per-feed toggle |

### output.json

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `feishu_wiki.enabled` | bool | `true` | Publish to Wiki |
| `feishu_wiki.space_id` | str | *required* | Wiki space ID |
| `feishu_wiki.parent_node` | str | `""` | Parent node (empty = root) |
| `feishu_chat.enabled` | bool | `true` | Post to group chat |
| `feishu_chat.chat_id` | str | *required* | Group chat ID |
| `feishu_chat.max_highlights` | int | `5` | Items to show in chat |
| `schedule.daily_time` | str | `"08:00"` | When to run daily |

---

## 📊 Output Structure

```
pancreatic-cancer-news-digest/
├── data/
│   ├── cache/                    # API response cache (auto-cleaned)
│   │   ├── ct_abc123.json        # ClinicalTrials responses
│   │   ├── pmid_xyz789.json      # PubMed responses
│   │   └── rss_def456.json       # RSS feed cache
│   ├── history.json              # Already published item IDs
│   └── reports/                  # Daily digest archives
│       ├── digest-2026-04-09.md  # Today's full report
│       ├── digest-2026-04-08.md  # Yesterday's report
│       └── digest-2026-04-01.md  # Last week
├── logs/                         # (optional) Execution logs
│   └── fetch-2026-04-09.log
└── config/                       # Your configuration
    ├── sources.json
    └── output.json
```

---

## 🐛 Troubleshooting

### "No new items" but I know there are updates

**Cause**: Items already in `history.json` (deduplication working)

**Fix**:
```bash
# Check history
cat data/history.json | wc -l

# If stale, clear and re-run (will duplicate)
./quick-start.sh clean-history
./quick-start.sh run
```

### ClinicalTrials.gov returns 0 results

**Cause**: API filter too restrictive or condition mismatch

**Debug**:
```bash
# Test API directly
curl "https://clinicaltrials.gov/api/v2/studies?query.cond=pancreatic+cancer&pageSize=1"
```

**Fix**: Adjust `config/sources.json`:
```json
"clinicaltrials": {
  "condition": "pancreatic cancer",  // Try "pancreatic neoplasm" too
  "status": ["RECRUITING", "NOT_YET_RECRUITING"]
}
```

### PubMed returns old articles

**Cause**: PubMed indexing delay (1-3 days)

**Fix**: Increase `date_range_days` to 14 or 30 temporarily.

### RSS feed empty

**Cause**: Feed URL requires User-Agent or authentication

**Debug**:
```bash
curl -I "https://clinicaltrials.gov/api/rss?cond=pancreatic+cancer"
```

**Fix**: Add headers in `fetch_rss_feeds()` function.

### Feishu publishing fails

**Cause**: Missing permissions or invalid space ID

**Debug**: Check OpenClaw logs:
```bash
openclaw logs | grep -i "feishu"
```

**Fix**: Verify bot has:
- Wiki: `wiki:write` permission
- Chat: `im:message` permission
- Space ID correct (from Wiki URL: `https://uei55ql5ok.feishu.cn/wiki/SpaceID`)

---

## 📈 Monitoring & Alerts

### Daily Health Check (Add to HEARTBEAT.md)

```markdown
## Pancreatic Cancer Digest Health

- [ ] Last report exists: `ls data/reports/digest-$(date +%Y-%m-%d).md`
- [ ] Report has content: `wc -l data/reports/digest-$(date +%Y-%m-%d).md`
- [ ] Cron job ran: `grep "$(date)" /var/log/syslog | grep news-digest`
```

### Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Items fetched/day | < 10 | < 5 |
| PubMed results | < 5 | 0 |
| CT.gov results | < 3 | 0 |
| Cache hit rate | > 80% | > 95% (stale data) |

---

## 🔄 Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2026-04-09 | Initial MVP: CT.gov + PubMed + RSS |
| 0.2.0 | TBD | Add ChiCTR, ASCO RSS |
| 0.3.0 | TBD | LLM summarization, personalized alerts |

---

## 🎯 Success Criteria (Acceptance)

- [x] Fetches ≥ 30 items per day (avg)
- [x] Deduplicates correctly (no repeats within 30 days)
- [x] Prioritizes Phase 3 trials to top
- [x] Generates valid Markdown
- [ ] Publishes to Feishu Wiki automatically
- [ ] Posts highlights to group chat
- [ ] Runs daily via cron with < 5% failure rate

---

**Questions?** Contact sam (技术运维) or check skill logs:
```bash
tail -f /home/gem/workspace/agent/workspace/skills/pancreatic-cancer-news-digest/data/reports/digest-*.md
```
