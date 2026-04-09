"""
Enhanced fetchers for Pancreatic Cancer News Digest v2
Implements: ClinicalTrials.gov (API), ChiCTR (Playwright browser automation)
Web Search sources (Revolution Medicine, Immunotherapy) are placeholders pending integration
"""

import json, os, sys, requests, time
from datetime import datetime, timezone, timedelta
from typing import Dict, List

TZ = timezone(timedelta(hours=8))


# ============ ClinicalTrials.gov ============

def fetch_clinicaltrials_single(cfg: Dict) -> List[Dict]:
    """Fetch from ClinicalTrials.gov API v2"""
    url = "https://clinicaltrials.gov/api/v2/studies"
    params = {
        "query.cond": cfg["condition"],
        "pageSize": cfg.get("page_size", 50),
        "sort": cfg.get("sort", "LastUpdatePostDate:desc"),
        "filter.overallStatus": ",".join(cfg.get("status", ["RECRUITING"]))
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
            
            nct = ident.get("nctId", "")
            title = ident.get("briefTitle", "")
            phase_list = design.get("phases", [])
            phase = phase_list[0] if phase_list else "NA"
            enrollment = design.get("enrollmentInfo", {}).get("count", "")
            status = status_mod.get("overallStatus", "")

            items.append({
                "id": f"clinicaltrials:{nct}",
                "external_id": nct,
                "title": title,
                "url": f"https://clinicaltrials.gov/ct2/show/{nct}",
                "source": "ClinicalTrials.gov",
                "type": "clinical_trial",
                "phase": phase,
                "status": status,
                "enrollment": str(enrollment),
                "date": status_mod.get("lastUpdatePostDate", ""),
                "priority": 1 if phase in ["PHASE3", "PHASE2/3"] else 2,
                "region": "Global"
            })
        return items
    except Exception as e:
        print(f"  ❌ Error fetching ClinicalTrials.gov: {e}")
        return []


# ============ ChiCTR (Playwright browser automation) ============

def fetch_chictr(cfg: Dict) -> List[Dict]:
    """
    Fetch from ChiCTR (Chinese Clinical Trial Registry)
    Uses Playwright to bypass anti-crawling protections
    Reference: https://github.com/PancrePal-xiaoyibao/chictr-mcp-server
    """
    if not cfg.get("enabled", False):
        print("  ⏭️  Skipping ChiCTR (disabled in config)")
        return []

    from playwright.sync_api import sync_playwright

    base_url = "https://www.chictr.org.cn/searchproj.html"
    max_results = cfg.get("max_results", 20)

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
            fetched_this_run = 0
            
            while len(items) < max_results and page_num <= 3:
                url = f"{base_url}?page={page_num}&btngo=btn"
                print(f"  🌐 Page {page_num}: {url}")
                
                resp = page.goto(url, wait_until="networkidle", timeout=45000)
                if not resp or resp.status != 200:
                    print(f"  ❌ HTTP {resp.status if resp else 'no response'}")
                    break
                
                page.wait_for_timeout(2000)
                
                # Extract trials using correct ChiCTR table structure
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
                
                print(f"  📄 Page {page_num}: {len(trials)} trials found")
                if not trials:
                    print(f"  ⚠️  No more results on page {page_num}")
                    break
                
                for trial in trials:
                    if len(items) >= max_results:
                        break
                    
                    regno = trial.get('regno', '')
                    title = trial.get('title', '')
                    href = trial.get('href', '')
                    
                    # Normalize URL
                    if href and not href.startswith('http'):
                        href = f"https://www.chictr.org.cn/{href}"
                    
                    items.append({
                        "id": f"chictr:{regno}",
                        "external_id": regno,
                        "title": title,
                        "url": href,
                        "source": "ChiCTR",
                        "type": "clinical_trial",
                        "phase": "N/A",
                        "status": "RECRUITING",
                        "enrollment": "",
                        "date": "",
                        "priority": 1,  # China trials = highest priority
                        "region": "China"
                    })
                    fetched_this_run += 1
                
                page_num += 1
            
            browser.close()
            print(f"  ✅ Fetched {fetched_this_run} trials from ChiCTR")
            
    except Exception as e:
        print(f"  ❌ Error fetching ChiCTR: {e}")
        import traceback; traceback.print_exc()
        return []
    
    return items


# ============ Revolution Medicine (Web Search placeholder) ============

def fetch_revolution_medicine(cfg: Dict) -> List[Dict]:
    """Fetch Revolution Medicine news via Web Search (placeholder)"""
    if not cfg.get("enabled", False):
        return []

    search_terms = cfg.get("search_terms", [])
    max_results = cfg.get("max_results", 10)
    
    print(f"  🔍 Searching Revolution Medicine with {len(search_terms)} terms")
    print("  ⚠️  Web search integration pending (use miaoda-web-search or tavily)")
    
    # Placeholder - will be replaced with actual tool call
    items = []
    for term in search_terms[:3]:
        items.append({
            "id": f"revmed:{hash(term) % 10000}",
            "external_id": "WEB",
            "title": f"[待集成] Revolution Medicine: {term}",
            "url": "https://www.revolutionmedicine.com/news",
            "source": "Revolution Medicine",
            "type": "news",
            "date": datetime.now(TZ).strftime("%Y-%m-%d"),
            "priority": 1,
            "summary": "此条目需要集成 Web Search API 后实际抓取"
        })
    
    return items[:max_results]


# ============ Immunotherapy (Web Search placeholder) ============

def fetch_immunotherapy(cfg: Dict) -> List[Dict]:
    """Fetch immunotherapy advances via Web Search (placeholder)"""
    if not cfg.get("enabled", False):
        return []

    search_terms = cfg.get("search_terms", [])
    max_results = cfg.get("max_results", 15)
    
    print(f"  🔍 Searching immunotherapy with {len(search_terms)} terms")
    print("  ⚠️  Web search integration pending")
    
    items = []
    for term in search_terms[:3]:
        items.append({
            "id": f"immuno:{hash(term) % 10000}",
            "external_id": "WEB",
            "title": f"[待集成] 免疫治疗: {term}",
            "url": "#",
            "source": "Immunotherapy News",
            "type": "news",
            "date": datetime.now(TZ).strftime("%Y-%m-%d"),
            "priority": 2,
            "summary": "此条目需要集成 Web Search API 后实际抓取"
        })
    
    return items[:max_results]


# ============ PubMed New Drugs (disabled) ============

def fetch_pubmed_newdrugs(cfg: Dict) -> List[Dict]:
    """Fetch PubMed new drugs (currently disabled, needs custom query)"""
    if not cfg.get("enabled", False):
        return []
    
    print("  ⚠️  PubMed new drugs fetcher not yet implemented (needs custom query)")
    return []
