#!/usr/bin/env python3
"""
Pancreatic Cancer Medical News Digest - Fetcher
Aggregates latest pancreatic cancer research from multiple sources
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

def load_config() -> Dict:
    """Load source and output configurations"""
    with open(os.path.join(CONFIG_DIR, "sources.json")) as f:
        sources = json.load(f)["sources"]
    with open(os.path.join(CONFIG_DIR, "output.json")) as f:
        output = json.load(f)
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


def save_cache(cache_file: str, data: Dict):
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


# ============ Source Fetchers ============

def fetch_clinicaltrials(config: Dict) -> List[Dict]:
    """Fetch from ClinicalTrials.gov API v2"""
    print("  🔍 Fetching ClinicalTrials.gov...")
    cfg = config["sources"]["clinicaltrials"]
    if not cfg.get("enabled", True):
        return []

    url = "https://clinicaltrials.gov/api/v2/studies"
    params = {
        "query.cond": cfg["condition"],
        "pageSize": cfg.get("page_size", 50),
        "sort": cfg.get("sort", "LastUpdatePostDate:desc")
    }
    if cfg.get("status"):
        params["filter.overallStatus"] = ",".join(cfg["status"])

    cache_file = cache_filename("ctgov", params)
    cached = load_cache(cache_file)
    if cached:
        print("  ✅ Using cached ClinicalTrials data")
        return cached.get("studies", [])

    resp = requests.get(url, params=params, timeout=30)
    if resp.status_code != 200:
        print(f"  ❌ CT.gov API error: {resp.status_code}")
        return []

    data = resp.json()
    studies = []

    for study in data.get("studies", []):
        proto = study.get("protocolSection", {})
        ident = proto.get("identificationModule", {})
        status_mod = proto.get("statusModule", {})
        design = proto.get("designModule", {})

        nct_id = ident.get("nctId", "")
        title = ident.get("briefTitle", "")
        phase = ", ".join(design.get("phases", ["N/A"]))
        status = status_mod.get("overallStatus", "")
        last_update = status_mod.get("lastUpdatePostDate", "")

        # Extract enrollment
        enrollment = design.get("enrollmentInfo", {}).get("count", "N/A")

        studies.append({
            "source": "ClinicalTrials.gov",
            "id": generate_item_id("ct", nct_id),
            "external_id": nct_id,
            "title": title,
            "phase": phase,
            "status": status,
            "enrollment": enrollment,
            "last_update": last_update,
            "url": f"https://clinicaltrials.gov/ct2/show/{nct_id}",
            "type": "clinical_trial"
        })

    save_cache(cache_file, {"studies": studies})
    print(f"  ✅ Found {len(studies)} trials")
    return studies


def fetch_pubmed(config: Dict) -> List[Dict]:
    """Fetch latest PubMed articles via E-utilities"""
    print("  🔍 Fetching PubMed...")
    cfg = config["sources"]["pubmed"]
    if not cfg.get("enabled", True):
        return []

    # Build query
    mesh_term = "Pancreatic Neoplasms[MeSH Terms]"
    days = cfg.get("date_range_days", 7)
    date_from = (datetime.now(TZ) - timedelta(days=days)).strftime("%Y/%m/%d")
    date_to = datetime.now(TZ).strftime("%Y/%m/%d")
    query = f"({mesh_term}) AND ({date_from}[Date - Publication] : {date_to}[Date - Publication])"

    # Check cache
    cache_file = cache_filename("pubmed", {"query": query, "max": cfg.get("max_results", 50)})
    cached = load_cache(cache_file)
    if cached:
        print("  ✅ Using cached PubMed data")
        return cached.get("articles", [])

    # Search
    search_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
    params = {
        "db": "pubmed",
        "term": query,
        "retmode": "json",
        "retmax": cfg.get("max_results", 50),
        "sort": "pub+date"
    }

    resp = requests.get(search_url, params=params, timeout=30)
    if resp.status_code != 200:
        print(f"  ❌ PubMed search error: {resp.status_code}")
        return []

    search_data = resp.json()
    id_list = search_data.get("esearchresult", {}).get("idlist", [])
    print(f"  📚 Found {len(id_list)} articles")

    if not id_list:
        return []

    # Fetch details
    fetch_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
    id_str = ",".join(id_list[:20])  # Batch fetch (max 20 per request)
    params2 = {
        "db": "pubmed",
        "id": id_str,
        "retmode": "xml"
    }

    resp2 = requests.get(fetch_url, params=params2, timeout=30)
    if resp2.status_code != 200:
        print(f"  ❌ PubMed fetch error: {resp2.status_code}")
        return []

    # Parse XML
    root = ET.fromstring(resp2.text)
    articles = []

    for article in root.findall(".//PubmedArticle"):
        pmid = article.findtext(".//PMID", "")
        title_elem = article.find(".//ArticleTitle")
        title = title_elem.text if title_elem is not None else ""

        # Authors
        authors = []
        for author in article.findall(".//Author"):
            last = author.findtext("LastName", "")
            fore = author.findtext("ForeName", "")
            if last or fore:
                authors.append(f"{fore} {last}".strip())

        # Journal & date
        journal = article.findtext(".//Journal/Title", "")
        pub_date_elem = article.find(".//PubDate")
        if pub_date_elem is not None:
            year = pub_date_elem.findtext("Year", "")
            month = pub_date_elem.findtext("Month", "")
            day = pub_date_elem.findtext("Day", "")
            pub_date = f"{year}-{month.zfill(2) if month else '01'}-{day.zfill(2) if day else '01'}"
        else:
            pub_date = ""

        # Abstract (truncated)
        abstract_elem = article.find(".//Abstract/AbstractText")
        abstract = abstract_elem.text[:300] + "..." if abstract_elem is not None and abstract_elem.text else ""

        articles.append({
            "source": "PubMed",
            "id": generate_item_id("pmid", pmid),
            "external_id": pmid,
            "title": title,
            "authors": authors[:3],  # First 3 authors
            "journal": journal,
            "pub_date": pub_date,
            "abstract": abstract,
            "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
            "type": "research_article"
        })

    save_cache(cache_file, {"articles": articles})
    print(f"  ✅ Processed {len(articles)} PubMed articles")
    return articles


def fetch_rss_feeds(config: Dict) -> List[Dict]:
    """Fetch from RSS feeds"""
    print("  🔍 Fetching RSS feeds...")
    cfg = config["sources"]
    feeds = cfg.get("rss_feeds", [])
    articles = []

    for feed in feeds:
        if not feed.get("enabled", True):
            continue

        url = feed["url"]
        name = feed["name"]
        print(f"  📡 {name}...")

        cache_file = cache_filename("rss", {"url": url})
        cached = load_cache(cache_file)
        if cached:
            print(f"  ✅ Using cached {name}")
            articles.extend(cached.get("items", []))
            continue

        try:
            resp = requests.get(url, timeout=30, headers={
                "User-Agent": "Mozilla/5.0 (compatible; PancreaticCancerDigest/1.0)"
            })
            if resp.status_code != 200:
                print(f"  ⚠️ RSS {name} returned {resp.status_code}")
                continue

            # Parse RSS (basic)
            content = resp.text
            root = ET.fromstring(content)

            # Handle both RSS 2.0 and Atom
            items = root.findall(".//item") or root.findall(".//{http://www.w3.org/2005/Atom}entry")

            feed_items = []
            for item in items[:10]:  # Limit per feed
                # Extract title
                title_elem = item.find("title") or item.find("{http://www.w3.org/2005/Atom}title")
                title = title_elem.text if title_elem is not None else ""

                # Extract link
                link_elem = item.find("link") or item.find("{http://www.w3.org/2005/Atom}link")
                link = link_elem.text if link_elem is not None and link_elem.text else ""
                if not link and link_elem is not None and 'href' in link_elem.attrib:
                    link = link_elem.attrib['href']

                # Extract date
                date_elem = item.find("pubDate") or item.find("{http://www.w3.org/2005/Atom}updated")
                date = date_elem.text if date_elem is not None else ""

                feed_items.append({
                    "source": name,
                    "id": generate_item_id("rss", hashlib.md5(link.encode()).hexdigest()[:12]),
                    "external_id": link,
                    "title": title,
                    "url": link,
                    "pub_date": date,
                    "type": "news_article"
                })

            save_cache(cache_file, {"items": feed_items})
            articles.extend(feed_items)
            print(f"  ✅ {name}: {len(feed_items)} items")

        except Exception as e:
            print(f"  ❌ RSS {name} error: {e}")

    print(f"  ✅ Total RSS items: {len(articles)}")
    return articles


# ============ Deduplication ============

def deduplicate_items(items: List[Dict]) -> List[Dict]:
    """Remove duplicates using history + fuzzy title matching"""
    history = load_history()
    seen = set(history)

    new_items = []
    for item in items:
        if item["id"] in seen:
            continue

        # Additional fuzzy check (title similarity)
        # For now, exact ID match is sufficient
        new_items.append(item)

    print(f"  ✅ Deduplication: {len(items)} → {len(new_items)} new items")
    return new_items


# ============ Prioritization & Summarization ============

def prioritize_items(items: List[Dict]) -> List[Dict]:
    """Score and sort items by relevance"""
    def score_item(item: Dict) -> int:
        score = 0
        title = item.get("title", "").lower()

        # Phase 3 trials
        if "phase 3" in title or "phase iii" in title:
            score += 30
        elif "phase 2" in title or "phase ii" in title:
            score += 20

        # Study types
        if "randomized" in title or "rct" in title:
            score += 25
        elif "meta-analysis" in title or "systematic review" in title:
            score += 20

        # Keywords
        if "kras" in title or "g12" in title:
            score += 15
        if "immunotherapy" in title or "pembrolizumab" in title or "nivolumab" in title:
            score += 10
        if "survival" in title or "overall survival" in title:
            score += 10

        # Source priority
        if item.get("source") == "ClinicalTrials.gov":
            score += 5

        return score

    scored = [(score_item(item), item) for item in items]
    scored.sort(key=lambda x: x[0], reverse=True)
    return [item for _, item in scored]


def generate_summary(item: Dict, max_words: int = 100) -> str:
    """Generate plain-language summary (placeholder - will use LLM later)"""
    title = item.get("title", "")
    item_type = item.get("type", "")

    if item_type == "clinical_trial":
        phase = item.get("phase", "")
        status = item.get("status", "")
        return f"临床试验 {phase} 阶段 - {status}. {title[:80]}..."
    elif item_type == "research_article":
        authors = item.get("authors", [])
        journal = item.get("journal", "")
        return f"研究论文发表于 {journal} - {title[:80]}..."
    else:
        return title[:100] + "..."


def extract_tags(item: Dict) -> List[str]:
    """Extract hashtags for item"""
    tags = []
    title = item.get("title", "").lower()

    # Phase tags
    if "phase 3" in title or "phase iii" in title:
        tags.append("#Phase3")
    elif "phase 2" in title or "phase ii" in title:
        tags.append("#Phase2")

    # Topic tags
    if "kras" in title:
        tags.append("#KRAS")
    if "brca" in title:
        tags.append("#BRCA")
    if "immunotherapy" in title or "pembrolizumab" in title:
        tags.append("#免疫治疗")
    if "chemo" in title or "chemotherapy" in title:
        tags.append("#化疗")

    return tags


# ============ Formatting ============

def format_full_digest(items: List[Dict], date_str: str) -> str:
    """Generate full Markdown digest"""
    lines = [
        f"# 胰腺癌医学日报 {date_str}",
        "",
        f"**生成时间**: {datetime.now(TZ).strftime('%Y-%m-%d %H:%M (Asia/Shanghai)')}",
        f"**数据源**: ClinicalTrials.gov, PubMed, RSS Feeds",
        f"**条目总数**: {len(items)}",
        "",
        "---",
        ""
    ]

    # Group by type
    trials = [i for i in items if i.get("type") == "clinical_trial"]
    articles = [i for i in items if i.get("type") == "research_article"]
    news = [i for i in items if i.get("type") == "news_article"]

    if trials:
        lines.append("## 🔬 临床试验更新")
        lines.append("")
        for i, item in enumerate(trials, 1):
            tags = " ".join(extract_tags(item))
            lines.append(f"### {i}. [{item['external_id']}] {item['title']}")
            lines.append(f"- **来源**: {item['source']}")
            lines.append(f"- **阶段**: {item.get('phase', 'N/A')} | **状态**: {item.get('status', 'N/A')}")
            lines.append(f"- **入组人数**: {item.get('enrollment', 'N/A')}")
            lines.append(f"- **链接**: {item['url']}")
            if tags:
                lines.append(f"- **标签**: {tags}")
            lines.append("")

    if articles:
        lines.append("## 📚 最新研究文献")
        lines.append("")
        for i, item in enumerate(articles, 1):
            tags = " ".join(extract_tags(item))
            authors = ", ".join(item.get("authors", []))[:80]
            lines.append(f"### {i}. {item['title']}")
            lines.append(f"- **作者**: {authors}")
            lines.append(f"- **期刊**: {item.get('journal', 'N/A')}")
            lines.append(f"- **发表日期**: {item.get('pub_date', 'N/A')}")
            lines.append(f"- **PMID**: {item['external_id']}")
            lines.append(f"- **链接**: {item['url']}")
            if tags:
                lines.append(f"- **标签**: {tags}")
            lines.append("")

    if news:
        lines.append("## 📰 行业动态")
        lines.append("")
        for i, item in enumerate(news, 1):
            lines.append(f"### {i}. {item['title']}")
            lines.append(f"- **来源**: {item['source']}")
            lines.append(f"- **链接**: {item['url']}")
            lines.append("")

    lines.extend([
        "---",
        "",
        f"*报告生成: Pancreatic Cancer News Digest Skill*",
        f"*下一更新: {(datetime.now(TZ) + timedelta(days=1)).strftime('%Y-%m-%d %H:%M')}*"
    ])

    return "\n".join(lines)


def format_highlights(items: List[Dict], max_items: int = 5) -> str:
    """Generate condensed highlights for group chat"""
    lines = [
        f"📊 胰腺癌医学日报 · {datetime.now(TZ).strftime('%Y-%m-%d')} · {len(items)}条更新",
        ""
    ]

    for i, item in enumerate(items[:max_items], 1):
        tags = "".join(extract_tags(item))
        summary = generate_summary(item, 80)
        lines.append(f"{i}. [{item['external_id']}] {item['title']}")
        lines.append(f"   {summary}")
        if tags:
            lines.append(f"   {tags}")
        lines.append("")

    if len(items) > max_items:
        lines.append(f"... 还有 {len(items) - max_items} 条，查看完整报告")

    return "\n".join(lines)


# ============ Publishing ============

def publish_to_feishu_wiki(content: str, config: Dict, date_str: str) -> str:
    """Publish digest to Feishu Wiki"""
    out_cfg = config["output"].get("feishu_wiki", {})
    if not out_cfg.get("enabled", True):
        return ""

    space_id = out_cfg.get("space_id", "")
    parent_node = out_cfg.get("parent_node", "")
    title = out_cfg.get("title_template", "胰腺癌医学日报 {date}").format(date=date_str)

    print(f"  📤 Publishing to Feishu Wiki: {title}")

    # Try to use OpenClaw feishu_create_doc tool via subprocess
    # This allows the script to work both standalone and within OpenClaw
    import subprocess

    # Save to temp file first
    temp_md = os.path.join(REPORTS_DIR, f"digest-{date_str}.md")
    with open(temp_md, "w") as f:
        f.write(content)

    # Try OpenClaw tool call (if available)
    # In OpenClaw environment, we can use the tool directly
    # For now, save locally and report path
    print(f"  ✅ Saved to {temp_md}")
    print(f"  💡 To publish to Wiki, run: feishu_create_doc with wiki_node={space_id}")
    return temp_md


def publish_to_group_chat(highlights: str, config: Dict):
    """Post highlights to Feishu group chat"""
    out_cfg = config["output"].get("feishu_chat", {})
    if not out_cfg.get("enabled", False):
        return

    chat_id = out_cfg.get("chat_id", "")
    chat_name = out_cfg.get("chat_name", "群聊")
    max_items = out_cfg.get("max_highlights", 5)

    print(f"  💬 Preparing highlights for {chat_name} ({chat_id})")
    print("\n=== GROUP CHAT MESSAGE PREVIEW ===")
    print(highlights)
    print("=== END ===")
    print(f"  💡 To send, use: feishu_im_user_message send with chat_id={chat_id}")


# ============ Main ============

def main():
    parser = argparse.ArgumentParser(description="Pancreatic Cancer Medical News Digest Fetcher")
    parser.add_argument("--date", type=str, default=datetime.now(TZ).strftime("%Y-%m-%d"),
                        help="Report date (default: today)")
    parser.add_argument("--dry-run", action="store_true", help="Don't publish, just print preview")
    parser.add_argument("--output", choices=["all", "wiki", "chat", "markdown"], default="all",
                        help="Output destination")
    parser.add_argument("--chat-notify", action="store_true", help="Send highlights to group chat")
    args = parser.parse_args()

    print("="*60)
    print(" Pancreatic Cancer Medical News Digest")
    print(f" Date: {args.date}")
    print("="*60)

    # Load config
    config = load_config()

    # 1. Fetch all sources
    all_items = []
    all_items.extend(fetch_clinicaltrials(config))
    all_items.extend(fetch_pubmed(config))
    all_items.extend(fetch_rss_feeds(config))

    print(f"\n📊 Total fetched: {len(all_items)} items")

    # 2. Deduplicate
    new_items = deduplicate_items(all_items)
    if not new_items:
        print("\n✅ No new items to report today. Exiting.")
        return

    # 3. Prioritize
    prioritized = prioritize_items(new_items)
    print(f"📈 Prioritized {len(prioritized)} items")

    # 4. Summarize & tag
    for item in prioritized:
        item["summary"] = generate_summary(item)
        item["tags"] = extract_tags(item)

    # 5. Format outputs
    full_digest = format_full_digest(prioritized, args.date)
    highlights = format_highlights(prioritized)

    # 6. Publish
    if args.dry_run:
        print("\n=== DRY RUN - FULL DIGEST PREVIEW ===")
        print(full_digest[:3000])
        print("... (truncated)")
    else:
        if args.output in ["all", "wiki", "markdown"]:
            publish_to_feishu_wiki(full_digest, config, args.date)

        if args.output in ["all", "chat"] or args.chat_notify:
            publish_to_group_chat(highlights, config)

        # Update history
        history = load_history()
        for item in prioritized:
            if item["id"] not in history:
                history.append(item["id"])
        # Keep only last 1000
        save_history(history[-1000:])
        print(f"\n✅ History updated: {len(history)} tracked items")

    print("\n" + "="*60)
    print(f" Digest generation complete. {len(prioritized)} new items processed.")
    print("="*60)


if __name__ == "__main__":
    main()
