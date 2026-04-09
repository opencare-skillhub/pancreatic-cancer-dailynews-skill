#!/usr/bin/env python3
"""
Pancreatic Cancer News Digest v4.0 - Enterprise Monitoring
Multi-enterprise monitoring + RAS-targeted drugs comprehensive tracking
"""

import json, sys, os, re
from datetime import datetime
from typing import List, Dict

# Config
CONFIG_DIR = os.path.join(os.path.dirname(__file__), '..', 'config')
with open(os.path.join(CONFIG_DIR, 'sources_v4.json'), 'r') as f:
    CONFIG = json.load(f)

# Import legacy fetcher
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
try:
    from scripts.fetchers_enhanced import fetch_clinicaltrials_single
except ImportError:
    fetch_clinicaltrials_single = None

# ============ Scoring ============

def score_item(item: Dict) -> float:
    score = 0.0
    text = (item.get('title', '') + ' ' + item.get('description', '')).lower()
    keywords = ['pancreatic cancer', 'pdac', '胰腺癌', 'KRAS', 'CLDN18.2', 'BRCA', 'PARP', 'RAS', 'mKRAS']
    matches = sum(1 for kw in keywords if kw.lower() in text)
    score += min(matches * 0.2, 0.6)
    phase = item.get('phase', '').upper()
    if 'PHASE3' in phase or 'III' in phase:
        score += 0.3
    elif 'PHASE2' in phase or 'II' in phase:
        score += 0.2
    elif 'PHASE1' in phase or 'I' in phase:
        score += 0.1
    pri = CONFIG['sources'].get(item.get('source',''), {}).get('priority', 5)
    score += (6 - pri) * 0.05  # priority 1-6 -> 0.25-0
    return min(score, 1.0)

# ============ Fetchers ============

def fetch_ctgov() -> List[Dict]:
    print("  📡 ClinicalTrials.gov...")
    items = []
    if fetch_clinicaltrials_single:
        try:
            src_cfg = CONFIG['sources']['clinicaltrials']['config']
            cfg = {
                'condition': src_cfg.get('condition', 'pancreatic cancer'),
                'status': src_cfg.get('status', ['RECRUITING']),
                'page_size': src_cfg.get('page_size', 60),
                'sort': src_cfg.get('sort', 'LastUpdatePostDate:desc')
            }
            raw = fetch_clinicaltrials_single(cfg)
            for r in raw:
                items.append({
                    'id': r.get('external_id', ''),
                    'title': r.get('title', ''),
                    'url': r.get('url', ''),
                    'source': 'clinicaltrials',
                    'company': 'Global',
                    'phase': r.get('phase', 'N/A'),
                    'status': r.get('status', ''),
                    'enrollment': r.get('enrollment', ''),
                    'date': r.get('date', ''),
                    'description': r.get('description', '')
                })
            print(f"  ✅ {len(items)} items")
            return items
        except Exception as e:
            print(f"  ⚠️  Error: {e}")
    print("  ℹ️  Fetcher not ready")
    return []

def fetch_company_news(company_key: str) -> List[Dict]:
    """Generic enterprise news fetcher (web_crawl or web_search)"""
    print(f"  🏢 {company_key}...")
    items = []
    try:
        import requests
        from bs4 import BeautifulSoup
        from requests.adapters import HTTPAdapter
        from urllib3.util.retry import Retry

        src_cfg = CONFIG['sources'][company_key]['config']
        url = src_cfg.get('url', '')
        keywords = [kw.lower() for kw in src_cfg.get('keywords', [])]
        max_results = src_cfg.get('max_results', 5)

        if not url:
            print(f"  ⚠️  No URL configured for {company_key}")
            return []

        # Session with retries
        session = requests.Session()
        retries = Retry(total=3, backoff_factor=1, status_forcelist=[500, 502, 503, 504])
        session.mount('https://', HTTPAdapter(max_retries=retries))

        resp = session.get(url, timeout=60, headers={
            'User-Agent': 'Mozilla/5.0 (compatible; PancreasBot/1.0; +https://pancreas.care)'
        })
        resp.raise_for_status()

        soup = BeautifulSoup(resp.text, 'html.parser')

        # Extract press releases
        releases = []
        text = soup.get_text()
        lines = [l.strip() for l in text.split('\n') if l.strip() and len(l.strip()) > 10]

        i = 0
        while i < len(lines) - 1:
            line = lines[i]
            # Date pattern
            if any(m in line for m in ['January', 'February', 'March', 'April', 'May', 'June',
                                       'July', 'August', 'September', 'October', 'November', 'December']):
                title = lines[i + 1]
                releases.append({'date': line, 'title': title, 'url': url})
                i += 2
            else:
                i += 1

        for rel in releases[:max_results]:
            title_lower = rel['title'].lower()
            if any(kw in title_lower for kw in keywords):
                items.append({
                    'id': f"{company_key.upper()}-{rel['date']}-{rel['title'][:20]}".replace(' ', '-').replace(',', '')[:50],
                    'title': rel['title'],
                    'url': rel['url'],
                    'source': company_key,
                    'company': CONFIG['sources'][company_key]['name'],
                    'phase': '',
                    'status': 'News',
                    'enrollment': '',
                    'date': rel['date'],
                    'description': ''
                })

        print(f"  ✅ {len(items)} items")
        return items

    except Exception as e:
        print(f"  ⚠️  Error: {e}")
        return []

def fetch_enterprise_search(company_key: str) -> List[Dict]:
    """Generic enterprise search via web search (for companies without direct IR pages)"""
    print(f"  🔍 {company_key} (web search)...")
    # Placeholder - will use Tavily/miaoda when available
    return []

def fetch_all() -> List[Dict]:
    items = []
    for name, cfg in CONFIG['sources'].items():
        if not cfg.get('enabled'):
            continue
        print(f"\n📡 {name}...")
        if name == 'clinicaltrials':
            items.extend(fetch_ctgov())
        elif name in ['remegen', 'jacobio', 'asemblon', 'taidig', 'hbw', 'yingli']:
            items.extend(fetch_company_news(name))
        elif name in ['akeso', 'hengrui', 'bridgebio', 'beigene', 'tieqishi', 'boehringer', 'amgen', 'erasca']:
            items.extend(fetch_enterprise_search(name))
        else:
            print(f"  🔄 {cfg['type']} not integrated yet")
    return items

# ============ Main ============

def main():
    print("=" * 50)
    print("胰腺癌日报 v4.0 - Enterprise Monitoring")
    print("=" * 50)

    raw = fetch_all()
    if not raw:
        print("❌ No data fetched")
        return 1

    # Dedup
    seen = set()
    unique = [i for i in raw if i.get('id') and not (i['id'] in seen or seen.add(i['id']))]
    print(f"\n🧹 Dedup: {len(raw)} → {len(unique)}")

    # Score & rank
    for i in unique:
        i['score'] = score_item(i)
    ranked = sorted(unique, key=lambda x: -x['score'])[:CONFIG['output'].get('max_items', 80)]
    print(f"📈 Ranked {len(ranked)} items (top: {ranked[0]['score']:.2f}, bottom: {ranked[-1]['score']:.2f})")

    # Group by source
    grouped = {}
    for it in ranked:
        src = it['source']
        grouped.setdefault(src, []).append(it)

    # Report
    lines = [
        "# 小胰宝2.0 胰腺治疗新技术日报 v4.0 (Enterprise Monitoring)",
        f"**时间**: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        f"**来源**: {len(CONFIG['sources'])} 个数据源 | **新增**: {len(ranked)} 条",
        "", "---", "",
        "## 🎯 今日核心要点\n"
    ]
    for idx, it in enumerate(ranked[:8], 1):
        company = it.get('company', '')
        company_str = f" [{company}]" if company else ''
        lines.append(f"{idx}. **[{it['id']}]** {it['title'][:90]}{company_str}")
        lines.append(f"   Phase: {it.get('phase','N/A')} | {it.get('url','')}\n")

    lines.append("## 📊 统计\n")
    lines.append(f"- 总条目: {len(ranked)}")
    lines.append(f"- 高相关 (>0.7): {sum(1 for i in ranked if i['score']>0.7)}")
    lines.append(f"- Phase 2/3: {sum(1 for i in ranked if '2' in i.get('phase','') or '3' in i.get('phase',''))}\n")

    lines.append("## 🏢 企业动态分组\n")
    for src, items in grouped.items():
        if src != 'clinicaltrials' and items:
            lines.append(f"### {CONFIG['sources'][src]['name']}")
            for it in items[:3]:
                lines.append(f"- **[{it['id']}]** {it['title'][:80]}")
                lines.append(f"  {it.get('url','')}\n")

    lines.append("## 📋 临床试验分组\n")
    for src, items in grouped.items():
        if src == 'clinicaltrials':
            lines.append(f"### ClinicalTrials.gov (全球 {len(items)} 条)")
            for it in items[:15]:
                lines.append(f"- **[{it['id']}]** {it['title'][:90]}")
                lines.append(f"  Phase: {it.get('phase','N/A')} | {it.get('url','')}\n")
            if len(items) > 15:
                lines.append(f"  ... 另外 {len(items)-15} 条\n")

    content = '\n'.join(lines)

    # Save
    out_dir = os.path.join(os.path.dirname(__file__), '..', 'data', 'reports')
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, f"digest-{datetime.now().strftime('%Y-%m-%d')}-v4.0.md")
    with open(path, 'w') as f:
        f.write(content)
    print(f"\n✅ Saved: {path}")
    print(f"\n📋 Preview (first 800 chars):")
    print("=" * 50)
    print(content[:800])
    print("...\n")
    return 0

if __name__ == '__main__':
    sys.exit(main())
