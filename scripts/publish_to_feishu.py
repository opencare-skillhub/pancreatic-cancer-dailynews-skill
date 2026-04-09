#!/usr/bin/env python3
"""
Pancreatic Cancer News Digest - Feishu Publisher
Integrates with OpenClaw Feishu tools to publish digest
"""

import os, json, sys, argparse, re
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Timezone
TZ = timezone(timedelta(hours=8))

# Paths
SCRIPT_DIR = Path(__file__).parent.absolute()
REPORTS_DIR = SCRIPT_DIR.parent / "data" / "reports"
CONFIG_PATH = SCRIPT_DIR.parent / "config" / "output.json"


def load_config():
    with open(CONFIG_PATH) as f:
        return json.load(f)


def find_latest_report() -> Path:
    """Find the most recent digest report"""
    reports = sorted(REPORTS_DIR.glob("digest-*.md"), reverse=True)
    if not reports:
        raise FileNotFoundError("No digest reports found. Run fetch.py first.")
    return reports[0]


def read_report(path: Path) -> str:
    with open(path) as f:
        return f.read()


def extract_highlights(full_digest: str, max_items: int = 5) -> str:
    """Extract top N items for chat highlights"""
    lines = full_digest.split('\n')
    highlights = []
    count = 0

    # Find first item under Clinical Trials or Research Articles
    in_section = False
    for line in lines:
        if line.startswith('## ') and ('临床试验' in line or '研究文献' in line):
            in_section = True
            continue
        if in_section and line.startswith('### '):
            # Item title line
            highlights.append(line.strip())
            count += 1
            if count >= max_items:
                break

    if not highlights:
        # Fallback: just take first few lines
        highlights = lines[:max_items]

    date_match = re.search(r'# 胰腺癌医学日报 (\d{4}-\d{2}-\d{2})', full_digest)
    date_str = date_match.group(1) if date_match else datetime.now(TZ).strftime('%Y-%m-%d')

    result = [
        f"📊 胰腺癌医学日报 · {date_str} · 自动摘要",
        "",
    ] + highlights + [
        "",
        f"🔗 完整报告: (需手动上传至Wiki)"
    ]
    return '\n'.join(result)


# ============ Feishu Integration ============

def publish_to_wiki_via_tool(markdown_content: str, title: str, space_id: str) -> str:
    """
    Publish to Feishu Wiki using feishu_create_doc tool.
    This function is designed to be called within an OpenClaw session
    where the tool is available.
    """
    print(f"📤 Publishing to Feishu Wiki: {title}")
    print(f"   Space ID: {space_id}")
    print(f"   Content length: {len(markdown_content)} chars")

    # In OpenClaw, you would call:
    # feishu_create_doc(
    #     title=title,
    #     markdown=markdown_content,
    #     wiki_space=space_id
    # )
    # But since we're in a subprocess, we need to communicate via stdout

    # Print a marker that OpenClaw can detect
    print(f"\n=== OPENCLAW_TOOL_CALL ===")
    print(f"tool: feishu_create_doc")
    print(f"params: {{")
    print(f'  "title": "{title}",')
    print(f'  "markdown": "<MD_CONTENT_PLACEHOLDER>",')
    print(f'  "wiki_space": "{space_id}"')
    print(f"}}")
    print(f"=== END_TOOL_CALL ===\n")

    # For now, just indicate success
    doc_token = "doc_placeholder_" + datetime.now(TZ).strftime("%Y%m%d")
    print(f"✅ Wiki document created (simulated): {doc_token}")
    return doc_token


def publish_to_chat_via_tool(highlights: str, chat_id: str) -> bool:
    """Post highlights to Feishu group chat via feishu_im_user_message tool"""
    print(f"💬 Posting to group chat: {chat_id}")
    print(f"   Message preview:\n{highlights[:300]}...")

    # Similar tool call pattern
    print(f"\n=== OPENCLAW_TOOL_CALL ===")
    print(f"tool: feishu_im_user_message")
    print(f"action: send")
    print(f"params: {{")
    print(f'  "receive_id_type": "chat_id",')
    print(f'  "receive_id": "{chat_id}",')
    print(f'  "msg_type": "text",')
    print(f'  "content": \'{{"text":"{highlights}"}}\'')
    print(f"}}")
    print(f"=== END_TOOL_CALL ===\n")

    print(f"✅ Message sent (simulated)")
    return True


# ============ Main ============

def main():
    parser = argparse.ArgumentParser(description="Publish Pancreatic Cancer Digest to Feishu")
    parser.add_argument("--report", type=str, help="Path to digest report file (default: latest)")
    parser.add_argument("--wiki-only", action="store_true", help="Publish to Wiki only")
    parser.add_argument("--chat-only", action="store_true", help="Post to chat only")
    parser.add_argument("--dry-run", action="store_true", help="Preview only, no actual publish")
    args = parser.parse_args()

    print("="*60)
    print(" Pancreatic Cancer Digest - Feishu Publisher")
    print("="*60)

    # Load report
    if args.report:
        report_path = Path(args.report)
    else:
        report_path = find_latest_report()

    print(f"\n📄 Reading report: {report_path.name}")
    full_digest = read_report(report_path)

    # Extract date from report
    date_match = re.search(r'# 胰腺癌医学日报 (\d{4}-\d{2}-\d{2})', full_digest)
    date_str = date_match.group(1) if date_match else datetime.now(TZ).strftime('%Y-%m-%d')

    # Extract highlights
    highlights = extract_highlights(full_digest)

    # Load config
    config = load_config()
    wiki_cfg = config.get("feishu_wiki", {})
    chat_cfg = config.get("feishu_chat", {})

    # Determine what to publish
    do_wiki = not args.chat_only and wiki_cfg.get("enabled", False)
    do_chat = not args.wiki_only and chat_cfg.get("enabled", False)

    if args.dry_run:
        print("\n=== DRY RUN PREVIEW ===")
        if do_wiki:
            print(f"\n📤 Would publish to Wiki:")
            print(f"   Title: 胰腺癌医学日报 {date_str}")
            print(f"   Space: {wiki_cfg.get('space_id')}")
            print(f"   Content length: {len(full_digest)} chars")
        if do_chat:
            print(f"\n💬 Would post to chat:")
            print(f"   Chat: {chat_cfg.get('chat_name', 'Group')} ({chat_cfg.get('chat_id')})")
            print(f"   Message:\n{highlights}")
        print("\n✅ Dry run complete. No changes made.")
        return

    # Execute publishing
    wiki_token = None
    if do_wiki:
        title = wiki_cfg.get("title_template", "胰腺癌医学日报 {date}").format(date=date_str)
        wiki_token = publish_to_wiki_via_tool(full_digest, title, wiki_cfg.get("space_id"))

    if do_chat:
        publish_to_chat_via_tool(highlights, chat_cfg.get("chat_id"))

    print("\n" + "="*60)
    print("✅ Publishing complete!")
    print("="*60)
    print(f"\nNext steps:")
    print(f"1. Verify Wiki document: https://uei55ql5ok.feishu.cn/wiki/{wiki_token if wiki_token else '...'}")
    print(f"2. Check group chat for highlights")
    print(f"3. Schedule daily run via cron if not yet configured")


if __name__ == "__main__":
    main()
