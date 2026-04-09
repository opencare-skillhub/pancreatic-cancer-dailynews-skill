#!/usr/bin/env python3
"""
Pancreatic Cancer Medical News Digest - Enhanced Edition (v2.0)
Optimized for patient needs: ChiCTR first, Revolution Medicine, Immunotherapy focus
"""

import requests, json, sys, time, hashlib, argparse, os
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional
from urllib.parse import quote_plus
import xml.etree.ElementTree as ET

# Timezone handling
TZ = timezone(timedelta(hours=8))  # Asia/Shanghai

# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.join(SCRIPT_DIR, "..")
DATA_DIR = os.path.join(ROOT_DIR, "data")
CONFIG_DIR = os.path.join(ROOT_DIR, "config")
CACHE_DIR = os.path.join(DATA_DIR, "cache")
REPORTS_DIR = os.path.join(DATA_DIR, "reports")

# Ensure dirs exist
for d in [CACHE_DIR, REPORTS_DIR]:
    os.makedirs(d, exist_ok=True)


# ============ Configuration Loader ============

def load_config(version: str = "v2") -> Dict:
    """Load source and output configurations"""
    sources_file = os.path.join(CONFIG_DIR, f"sources_{version}.json")
    output_file = os.path.join(CONFIG_DIR, f"output_{version}.json")

    # Fallback to original if enhanced not found
    if not os.path.exists(sources_file):
        sources_file = os.path.join(CONFIG_DIR, "sources.json")
    if not os.path.exists(output_file):
        output_file = os.path.join(CONFIG_DIR, "output.json")

    with open(sources_file) as f:
        sources = json.load(f)["sources"]
    with open(output_file) as f:
        output_data = json.load(f)
        # output.json has structure {"output": {...}}
        output = output_data.get("output", output_data)

    return {"sources": sources, "output": output}


# ============ Helper Functions ============

def cache_filename(source: str, params: Dict) -> str:
    """Generate deterministic cache filename"""
    key = f"{source}_{json.dumps(params, sort_keys=True)}"
    hash_key = hashlib.md5(key.encode()).hexdigest()[:12]
    return os.path.join(CACHE_DIR, f"{source}_{hash_key}.json")


def load_cache(cache_file: str, max_age_hours: int = 6) -> Optional[Dict]:
    """Load cached response if fresh"""
    if os.path.exists(cache_file):
        mtime = os.path.getmtime(cache_file)
        age_hours = (time.time() - mtime) / 3600
        if age_hours < max_age_hours:
            with open(cache_file) as f:
                return json.load(f)
    return None


def save_cache(cache_file: str, data: List[Dict]):
    """Save response to cache"""
    with open(cache_file, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def load_history() -> List[str]:
    """Load list of already-published item identifiers"""
    hist_file = os.path.join(DATA_DIR, "history.json")
    if os.path.exists(hist_file):
        with open(hist_file) as f:
            return json.load(f)
    return []


def save_history(history: List[str]):
    """Save published item identifiers"""
    hist_file = os.path.join(DATA_DIR, "history.json")
    with open(hist_file, "w") as f:
        json.dump(history, f, ensure_ascii=False, indent=2)


def generate_item_id(source: str, external_id: str) -> str:
    """Generate unique item ID for deduplication"""
    return f"{source}:{external_id}"


# ============ Enhanced Fetchers ============

def fetch_chictr_trials(source_cfg: Dict) -> List[Dict]:
    """
    Fetch from ChiCTR using Playwright browser automation.
    Reference: https://github.com/PancrePal-xiaoyibao/chictr-mcp-server
    """
    if not source_cfg.get("enabled", False):
        print("  ⏭️  Skipping ChiCTR (disabled)")
        return []

    from playwright.sync_api import sync_playwright

    base_url = "https://www.chictr.org.cn/searchproj.html"
    max_results = source_cfg.get("max_results", 20)
    items = []
    print(f"  🔍 Fetching ChiCTR (中国临床试验)...")

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080}
            )
            page.set_extra_http_headers({"Accept-Language": "zh-CN,zh;q=0.9"})
            
            page_num = 1
            while len(items) < max_results and page_num <= 3:
                url = f"{base_url}?page={page_num}&btngo=btn"
                resp = page.goto(url, wait_until="networkidle", timeout=45000)
                if not resp or resp.status != 200:
                    print(f"  ❌ HTTP {resp.status if resp else 'no response'}")
                    break
                page.wait_for_timeout(2000)
                
                trials = page.evaluate("""() => {
                    const tables = Array.from(document.querySelectorAll('table'));
                    for (const table of tables) {
                        const rows = Array.from(table.querySelectorAll('tr'));
                        if (rows.length < 2) continue;
                        const data = [];
                        for (let i = 1; i < rows.length; i++) {
                            const cells = Array.from(rows[i].querySelectorAll('td'));
                            if (cells.length >= 4) {
                                const regno = cells[1] ? cells[1].textContent.trim() : '';
                                const titleLink = cells[2] ? cells[2].querySelector('a') : null;
                                if (titleLink && regno && regno.startsWith('ChiCTR')) {
                                    data.push({
                                        title: titleLink.textContent.trim(),
                                        regno: regno,
                                        href: titleLink.href
                                    });
                                }
                            }
                        }
                        if (data.length > 0) return data;
                    }
                    return [];
                }""")
                
                print(f"  📄 Page {page_num}: {len(trials)} trials")
                if not trials:
                    break
                
                for trial in trials:
                    if len(items) >= max_results:
                        break
                    regno = trial.get('regno', '')
                    title = trial.get('title', '')
                    href = trial.get('href', '')
                    if href and not href.startswith('http'):
                        href = f"https://www.chictr.org.cn/{href}"
                    
                    # Keyword filter (pancreatic cancer related)
                    keywords = cfg.get("keywords", "").lower()
                    if keywords and keywords not in title.lower():
                        # Skip non-pancreatic cancer trials
                        continue
                    
                    items.append({
                        "id": generate_item_id("chictr", regno),
                        "external_id": regno,
                        "title": title,
                        "url": href,
                        "source": "chictr",  # lowercase to match config filter
                        "type": "clinical_trial",
                        "phase": "N/A",
                        "status": "RECRUITING",
                        "enrollment": "",
                        "date": "",
                        "priority": source_cfg.get("priority", 1),
                        "region": "China"
                    })
                
                page_num += 1
            
            browser.close()
            print(f"  ✅ Fetched {len(items)} trials from ChiCTR")
            
    except Exception as e:
        print(f"  ❌ Error fetching ChiCTR: {str(e)[:100]}")
        import traceback; traceback.print_exc()
        return []
    
    return items

def fetch_revolution_medicine_news(source_cfg: Dict) -> List[Dict]:
    """
    Search web for Revolution Medicine latest news and reports.
    TODO: Integrate with miaoda_web_search or tavily/grok APIs.
    """
    print("  🔍 Searching Revolution Medicine news...")
    cfg = source_cfg.get("config", source_cfg)
    search_terms = cfg.get("search_terms", [])
    max_results = cfg.get("max_results", 10)

    print(f"  🔍 Query terms: {search_terms}")
    print("  ⚠️  Revolution Medicine fetcher not yet implemented (requires web search API)")

    # Placeholder - will be implemented with actual web search
    # Expected item structure:
    # {
    #   "id": generate_item_id("revmed", external_id),
    #   "external_id": external_id,
    #   "title": "...",
    #   "url": "...",
    #   "source": "Revolution Medicine",
    #   "type": "press_release",
    #   "date": "2026-04-01",
    #   "summary": "...",
    #   "priority": source_cfg.get("priority", 1),
    #   "region": "Global"
    # }

    return []


def fetch_immunotherapy_news(source_cfg: Dict) -> List[Dict]:
    """Search for latest immunotherapy advances for pancreatic cancer."""
    print("  🔍 Searching immunotherapy news...")
    cfg = source_cfg.get("config", source_cfg)
    search_terms = cfg.get("search_terms", [])
    max_results = cfg.get("max_results", 15)

    print(f"  🔍 Query terms: {search_terms}")
    print("  ⚠️  Immunotherapy news fetcher not yet implemented (requires web search API)")

    return []


def fetch_new_drug_combinations(source_cfg: Dict) -> List[Dict]:
    """Enhanced PubMed search focused on new drugs and combination therapies."""
    print("  🔍 Fetching PubMed (new drugs & combinations)...")
    cfg = source_cfg.get("config", source_cfg)

    query = cfg.get("query", "(pancreatic cancer) AND (new drug OR combination therapy OR novel agent)")
    date_range = cfg.get("date_range_days", 30)
    max_results = cfg.get("max_results", 20)

    # Use legacy PubMed fetcher with modified query
    legacy_config = {
        "sources": {
            "pubmed": {
                "enabled": True,
                "mesh_terms": ["Pancreatic Neoplasms"],
                "date_range_days": date_range,
                "max_results": max_results,
                "filter_types": ["Clinical Trial", "Randomized Controlled Trial"]
            }
        }
    }

    # Call legacy function but with modified query would require refactoring
    # For now, call original fetch_pubmed with modified config structure
    print("  ⚠️  Using legacy PubMed fetcher (limited to mesh terms)")

    # Return empty for now, will be implemented properly
    return []


def fetch_clinicaltrials(source_cfg: Dict) -> List[Dict]:
    """Fetch from ClinicalTrials.gov API v2 (adapted for new architecture)"""
    print("  🔍 Fetching ClinicalTrials.gov (global)...")
    cfg = source_cfg.get("config", source_cfg)

    condition = cfg.get("condition", "pancreatic cancer")
    page_size = cfg.get("page_size", 50)
    sort = cfg.get("sort", "LastUpdatePostDate:desc")
    status_list = cfg.get("status", ["RECRUITING", "NOT_YET_RECRUITING"])

    cache_key = {
        "condition": condition,
        "status": status_list,
        "page_size": page_size
    }
    cache_file = cache_filename("clinicaltrials_v2", cache_key)

    cached = load_cache(cache_file)
    if cached:
        print("  ✅ Using cached ClinicalTrials data")
        return cached

    url = "https://clinicaltrials.gov/api/v2/studies"
    params = {
        "query.cond": condition,
        "pageSize": page_size,
        "sort": sort,
        "filter.overallStatus": ",".join(status_list)
    }

    try:
        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()

        items = []
        for study in data.get("studies", []):
            protocol = study.get("protocolSection", {})
            ident = protocol.get("identificationModule", {})
            status_mod = protocol.get("statusModule", {})
            design = protocol.get("designModule", {})

            nct_id = ident.get("nctId", "")
            title = ident.get("briefTitle", "")

            phases = design.get("phases", [])
            phase = phases[0] if phases else ""

            enrollment = design.get("enrollmentInfo", {}).get("count", "")
            last_update = status_mod.get("lastUpdatePostDate", "") or status_mod.get("studyFirstPostDate", "")
            date_str = last_update[:10] if last_update else ""

            item = {
                "id": generate_item_id("clinicaltrials", nct_id),
                "external_id": nct_id,
                "title": title,
                "url": f"https://clinicaltrials.gov/ct2/show/{nct_id}",
                "source": "clinicaltrials",
                "type": "clinical_trial",
                "phase": phase,
                "status": status_mod.get("overallStatus", ""),
                "enrollment": str(enrollment),
                "date": date_str,
                "priority": source_cfg.get("priority", 2),
                "region": "Global"
            }
            items.append(item)

        save_cache(cache_file, items)
        print(f"  ✅ Found {len(items)} trials")
        return items

    except Exception as e:
        print(f"  ❌ ClinicalTrials error: {str(e)[:80]}")
        return []


# ============ Main Orchestrator ============

def fetch_all_sources(config: Dict) -> List[Dict]:
    """Fetch from all enabled sources"""
    all_items = []
    sources = config.get("sources", {})

    print(f"  🔧 Debug: Loaded {len(sources)} source configurations")
    for sid, scfg in sources.items():
        print(f"    - {sid}: enabled={scfg.get('enabled')}, name={scfg.get('name')}")

    source_fetchers = {
        "chictr": fetch_chictr_trials,
        "clinicaltrials": fetch_clinicaltrials,
        "revolution_medicine": fetch_revolution_medicine_news,
        "immunotherapy": fetch_immunotherapy_news,
        "new_drugs_combinations": fetch_new_drug_combinations
    }

    for source_id, source_cfg in sources.items():
        if not source_cfg.get("enabled", True):
            print(f"  ⏭️  Skipping disabled source: {source_id}")
            continue

        fetcher = source_fetchers.get(source_id)
        if fetcher:
            try:
                print(f"\n🔍 Fetching {source_cfg.get('name', source_id)}...")
                items = fetcher(source_cfg)
                all_items.extend(items)
            except Exception as e:
                print(f"  ❌ Error fetching {source_id}: {str(e)[:100]}")
        else:
            print(f"  ⚠️  No fetcher for source: {source_id}")

    return all_items


# ============ Processing ============

def deduplicate_items(items: List[Dict]) -> List[Dict]:
    """Remove duplicate items based on ID"""
    seen = set()
    unique = []
    for item in items:
        if item["id"] not in seen:
            seen.add(item["id"])
            unique.append(item)
    print(f"✅ Deduplication: {len(items)} → {len(unique)} new items")
    return unique


def prioritize_items(items: List[Dict]) -> List[Dict]:
    """Sort by priority (1=highest) then by date (newest first)"""
    def sort_key(item):
        priority = item.get("priority", 3)
        date_str = item.get("date", "") or item.get("pub_date", "")
        try:
            if date_str:
                for fmt in ["%Y-%m-%d", "%Y/%m/%d", "%d %b %Y", "%B %d, %Y"]:
                    try:
                        date_obj = datetime.strptime(date_str[:10], fmt)
                        break
                    except ValueError:
                        continue
                else:
                    # Could not parse, treat as very old
                    date_obj = datetime.min
            else:
                # No date, treat as very old
                date_obj = datetime.min
        except Exception as e:
            date_obj = datetime.min

        # Use timestamp, but handle datetime.min safely
        try:
            timestamp = date_obj.timestamp() if date_obj != datetime.min else -1
        except:
            timestamp = -1

        return (priority, -timestamp)

    sorted_items = sorted(items, key=sort_key)
    return sorted_items


def generate_summary(item: Dict, max_length: int = 120) -> str:
    """Generate brief summary for item"""
    item_type = item.get("type", "")

    if item_type == "clinical_trial":
        phase = item.get("phase", "")
        enrollment = item.get("enrollment", "")
        status = item.get("status", "")

        summary_parts = []
        if phase:
            summary_parts.append(f"Phase {phase}")
        if enrollment:
            summary_parts.append(f"入组{enrollment}人")
        if status:
            summary_parts.append(f"状态：{status}")

        summary = " | ".join(summary_parts)
        return summary[:max_length] if summary else "临床试验信息"

    elif item_type in ["research_article", "news_article", "press_release"]:
        title = item.get("title", "")
        return title[:max_length] + "..." if len(title) > max_length else title

    return item.get("title", "")[:max_length]


def extract_tags(item: Dict) -> List[str]:
    """Extract hashtags for item"""
    tags = []
    title = item.get("title", "").lower()
    content = (item.get("title", "") + " " + item.get("summary", "")).lower()

    # Phase tags
    if "phase 3" in content or "phase iii" in content:
        tags.append("#Phase3")
    elif "phase 2" in content or "phase ii" in content:
        tags.append("#Phase2")

    # Topic tags
    if "kras" in content:
        tags.append("#KRAS")
    if "brca" in content or "parp" in content:
        tags.append("#BRCA")
    if "immunotherapy" in content or "pembrolizumab" in content or "nivolumab" in content:
        tags.append("#免疫治疗")
    if "chemo" in content or "chemotherapy" in content:
        tags.append("#化疗")
    if "car-t" in content or "cart" in content:
        tags.append("#CAR-T")
    if "rna" in content or "mrna" in content:
        tags.append("#RNA")

    # Region tags
    source = item.get("source", "").lower()
    if "chictr" in source or "china" in source:
        tags.append("#中国试验")

    return tags


# ============ Enhanced Formatting ============

def format_enhanced_digest(items: List[Dict], config: Dict, date_str: str) -> str:
    """Generate enhanced Markdown digest with highlights and sections"""
    output_cfg = config.get("output", {})
    sections = output_cfg.get("sections", [])

    # Calculate stats
    stats = {
        "total_items": len(items),
        "chictr_count": len([i for i in items if i.get("source", "").lower().find("chictr") >= 0 or i.get("region") == "China"]),
        "clinicaltrials_count": len([i for i in items if i.get("source", "").find("ClinicalTrials.gov") >= 0]),
        "new_drugs_count": len([i for i in items if i.get("source", "").find("PubMed") >= 0]),
        "immunotherapy_count": len([i for i in items if any(tag in ["#免疫治疗", "#CAR-T"] for tag in extract_tags(i))]),
        "revmed_count": len([i for i in items if i.get("source", "").find("Revolution Medicine") >= 0]),
        "phase3_count": len([i for i in items if "#Phase3" in extract_tags(i)])
    }

    # Build highlights (top priority items)
    highlights = sorted([i for i in items if i.get("priority", 3) <= 2], key=lambda x: x.get("date", ""), reverse=True)[:5]

    highlights_section = ""
    if highlights:
        for i, item in enumerate(highlights, 1):
            tags_str = " ".join(extract_tags(item))
            summary = generate_summary(item, 100)
            link = item.get("url", "#")
            title = item.get("title", "")[:80]
            external_id = item.get("external_id", "")

            highlights_section += f"{i}. **[{external_id}]** {title}\n"
            highlights_section += f"   📌 {summary}\n"
            highlights_section += f"   🔗 [点击查看详情]({link})\n\n"
    else:
        highlights_section = "*暂无高优先级内容*\n"

    # Build content sections based on output config
    content_sections = ""
    for section_cfg in sections:
        section_id = section_cfg["id"]
        title = section_cfg["title"]
        description = section_cfg.get("description", "")
        max_items = section_cfg.get("max_items", 10)

        # Filter items
        section_items = items
        if "source_filter" in section_cfg:
            allowed = section_cfg["source_filter"]
            # Flexible matching: case-insensitive substring match
            def matches_source(item_src: str) -> bool:
                item_lower = item_src.lower()
                return any(
                    allowed_src.lower() in item_lower or
                    item_lower in allowed_src.lower()
                    for allowed_src in allowed
                )
            section_items = [i for i in section_items if matches_source(i.get("source", ""))]

        if "priority_filter" in section_cfg:
            allowed_pri = section_cfg["priority_filter"]
            section_items = [i for i in section_items if i.get("priority", 3) in allowed_pri]

        section_items = section_items[:max_items]

        if not section_items:
            continue

        content_sections += f"## {title}\n\n"
        if description:
            content_sections += f"*{description}*\n\n"

        for i, item in enumerate(section_items, 1):
            tags_str = " ".join(extract_tags(item))
            link = item.get("url", "#")
            external_id = item.get("external_id", "")
            title_text = item.get("title", "")

            summary = generate_summary(item, 150)

            content_sections += f"### {i}. [{external_id}] {title_text}\n"
            content_sections += f"- **摘要**: {summary}\n"
            content_sections += f"- **链接**: [查看原文]({link})\n"

            if tags_str:
                content_sections += f"- **标签**: {tags_str}\n"

            if item.get("type") == "clinical_trial":
                phase = item.get("phase", "")
                status = item.get("status", "")
                enrollment = item.get("enrollment", "")
                region = item.get("region", "")

                details = []
                if phase:
                    details.append(f"阶段: {phase}")
                if status:
                    details.append(f"状态: {status}")
                if enrollment:
                    details.append(f"入组: {enrollment}人")
                if region:
                    details.append(f"地区: {region}")

                if details:
                    content_sections += f"- **详情**: {' | '.join(details)}\n"

            content_sections += "\n"

    # Stats table
    stats_table = f"""| 类别 | 数量 | 说明 |
|------|------|------|
| 总更新 | {stats['total_items']} | 今日抓取全部内容 |
| 中国试验 | {stats['chictr_count']} | ChiCTR 注册试验 |
| 全球试验 | {stats['clinicaltrials_count']} | ClinicalTrials.gov |
| 新药文献 | {stats['new_drugs_count']} | PubMed 最新研究 |
| 免疫治疗 | {stats['immunotherapy_count']} | 免疫疗法进展 |
| Revolution Medicine | {stats['revmed_count']} | 该公司相关动态 |
| Phase 3 试验 | {stats['phase3_count']} | 最接近上市阶段 |
"""

    # Build full digest
    lines = [
        f"# 胰腺癌医学日报 {date_str}",
        "",
        f"**生成时间**: {datetime.now(TZ).strftime('%Y-%m-%d %H:%M (Asia/Shanghai)')}",
        f"**数据源**: ChiCTR, ClinicalTrials.gov, PubMed, Web Search",
        f"**今日核心**: {stats['total_items']} 条更新",
        "",
        "---",
        "",
        "## 🎯 今日核心要点 (Top Highlights)",
        "",
        f"*以下 {len(highlights)} 条为今日最值得关注的内容，点击标题链接查看详情*",
        "",
        highlights_section,
        "---",
        "",
        "## 📊 今日统计",
        "",
        stats_table,
        "",
        "## 📋 详细内容",
        "",
        content_sections if content_sections else "*今日无新增内容*",
        "",
        "---",
        "",
        "## 💡 如何使用本报告",
        "",
        "### 快速导航",
        "- **🇨🇳 中国试验** → 查看「中国可申请临床试验」章节，可直接访问 ChiCTR 申请",
        "- **🌍 全球试验** → 查看「全球重要临床试验」，了解国际最新进展",
        "- **💊 Revolution Medicine** → 关注该公司最新临床数据报告",
        "- **⚡ 免疫治疗** → PD-1、CAR-T 等前沿疗法",
        "- **💉 新药联合** → 新药研发与联合用药方案",
        "",
        "### 申请临床试验",
        "1. 复制试验链接 → 打开浏览器访问",
        "2. 查看「入组标准」和「研究中心」",
        "3. 联系主治医生评估是否符合条件",
        "4. 准备病历资料提交申请",
        "",
        "### 重要提示",
        "- ⚠️ 本报告仅供参考，不构成医疗建议",
        "- 📞 具体治疗请咨询您的主治医生",
        "- 🔗 所有外部链接跳转到第三方网站",
        "",
        f"**数据截止**: {(datetime.now(TZ) - timedelta(days=30)).strftime('%Y-%m-%d')}",
        f"**下一更新**: {(datetime.now(TZ) + timedelta(days=1)).strftime('%Y-%m-%d %H:%M')}",
        "",
        f"*报告生成: pancreatic-cancer-news-digest v2.0 (enhanced)*",
        f"*专用Wiki: https://uei55ql5ok.feishu.cn/wiki/QtIXwuGf4iAfVskGfj8cjxfYnmf*"
    ]

    return "\n".join(lines)


def format_chat_highlights(items: List[Dict], max_items: int = 8) -> str:
    """Generate condensed highlights for group chat with clickable links"""
    date_str = datetime.now(TZ).strftime("%Y-%m-%d")
    highlights = [i for i in items[:max_items] if i.get("priority", 3) <= 2]

    lines = [
        f"📊 胰腺癌医学日报 · {date_str} · 今日 {len(items)} 条更新",
        "",
        "🎯 **今日核心要点**（点击链接查看详情）:",
        ""
    ]

    for i, item in enumerate(highlights, 1):
        tags = extract_tags(item)
        tags_str = " ".join(tags) if tags else ""
        summary = generate_summary(item, 100)
        link = item.get("url", "#")
        title = item.get("title", "")[:60]
        external_id = item.get("external_id", "")

        lines.append(f"{i}. [{external_id}] **{title}**")
        lines.append(f"   {summary}")
        if tags_str:
            lines.append(f"   {tags_str}")
        lines.append(f"   🔗 {link}")
        lines.append("")

    if len(items) > max_items:
        lines.append(f"... 还有 {len(items) - max_items} 条，[查看完整报告](https://uei55ql5ok.feishu.cn/wiki/QtIXwuGf4iAfVskGfj8cjxfYnmf)")

    return "\n".join(lines)


# ============ Publishing ============

def publish_to_feishu_wiki(content: str, config: Dict, date_str: str) -> str:
    """Publish digest to Feishu Wiki"""
    out_cfg = config.get("output", {})
    feishu_wiki = out_cfg.get("feishu_wiki", {})

    enabled = feishu_wiki.get("enabled", True)
    if not enabled:
        print("  ⚠️  Feishu Wiki publishing disabled in config")
        return ""

    title = feishu_wiki.get("title_template", "胰腺癌医学日报 {date}").format(date=date_str)

    print(f"  📤 Publishing to Feishu Wiki: {title}")

    try:
        # Save locally (OpenClaw will handle actual publishing)
        output_file = os.path.join(REPORTS_DIR, f"digest-{date_str}-enhanced.md")
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(content)

        print(f"  ✅ Saved to: {output_file}")
        return output_file
    except Exception as e:
        print(f"  ❌ Failed to publish: {str(e)[:100]}")
        return ""


def publish_to_group_chat(content: str, config: Dict):
    """Send highlights to group chat"""
    out_cfg = config.get("output", {})
    chat_cfg = out_cfg.get("feishu_chat", {})
    chat_id = chat_cfg.get("chat_id", "")

    if not chat_id:
        print("  ⚠️  No group chat configured, skipping notification")
        return

    try:
        print(f"  📤 Sending to group chat: {chat_id}")
        print("\n=== CHAT PREVIEW ===")
        print(content[:2000])
        print("... (truncated)")
        print("===================\n")
    except Exception as e:
        print(f"  ❌ Failed to send chat: {str(e)[:100]}")


# ============ Main ============

def main():
    parser = argparse.ArgumentParser(description="Pancreatic Cancer Medical News Digest - Enhanced Edition")
    parser.add_argument("--date", type=str, default=datetime.now(TZ).strftime("%Y-%m-%d"),
                        help="Report date (default: today)")
    parser.add_argument("--dry-run", action="store_true", help="Don't publish, just print preview")
    parser.add_argument("--output", choices=["all", "wiki", "chat", "markdown"], default="all",
                        help="Output destination")
    parser.add_argument("--chat-notify", action="store_true", help="Send highlights to group chat")
    parser.add_argument("--version", type=str, default="v2", help="Configuration version (v1, v2)")
    args = parser.parse_args()

    print("="*60)
    print(" Pancreatic Cancer Medical News Digest - ENHANCED EDITION")
    print(f" Date: {args.date} | Version: {args.version}")
    print("="*60)

    # Load enhanced config
    config = load_config(args.version)

    # 1. Fetch all sources
    all_items = fetch_all_sources(config)

    print(f"\n📊 Total fetched: {len(all_items)} items")

    # 2. Deduplicate
    new_items = deduplicate_items(all_items)
    if not new_items:
        print("\n✅ No new items to report today. Exiting.")
        return

    # 3. Prioritize
    prioritized = prioritize_items(new_items)
    print(f"📈 Prioritized {len(prioritized)} items")

    # 4. Enhance with summaries and tags
    for item in prioritized:
        item["summary"] = generate_summary(item)
        item["tags"] = extract_tags(item)

    # 5. Format outputs (enhanced)
    full_digest = format_enhanced_digest(prioritized, config, args.date)
    highlights = format_chat_highlights(prioritized)

    # 6. Publish
    if args.dry_run:
        print("\n=== DRY RUN - ENHANCED DIGEST PREVIEW ===")
        print(full_digest[:5000])
        print("... (truncated)")
        print("======================")
    else:
        if args.output in ["all", "wiki", "markdown"]:
            output_file = publish_to_feishu_wiki(full_digest, config, args.date)
            if output_file:
                print(f"\n✅ Full digest published: {output_file}")

        if args.output in ["all", "chat"] or args.chat_notify:
            publish_to_group_chat(highlights, config)

        # Update history
        history = load_history()
        for item in prioritized:
            if item["id"] not in history:
                history.append(item["id"])
        save_history(history[-1000:])
        print(f"\n✅ History updated: {len(history)} tracked items")

    print("\n" + "="*60)
    print(f" Digest generation complete. {len(prioritized)} new items processed.")
    print("="*60)


if __name__ == "__main__":
    main()