#!/bin/bash
# Pancreatic Cancer News Digest - Quick Start Script (v2.0 Enhanced)
# Usage: ./quick-start.sh [command] [options]

set -e

cd "$(dirname "$0")"

VERSION="${2:-v2}"  # Default to v2 enhanced config
SCRIPT="fetch_enhanced.py"

case "${1:-help}" in
  install)
    echo "📦 Installing dependencies..."
    pip install --break-system-packages -r requirements.txt
    echo "✅ Installation complete"
    ;;

  test)
    echo "🧪 Running dry-run test (enhanced mode)..."
    python3 scripts/$SCRIPT --dry-run --version $VERSION
    echo "✅ Test complete"
    ;;

  run)
    echo "🚀 Running daily digest (enhanced - ChiCTR first)..."
    python3 scripts/$SCRIPT --output all --chat-notify --version $VERSION
    echo "✅ Digest published"
    ;;

  wiki)
    echo "📝 Publishing to Feishu Wiki only..."
    python3 scripts/$SCRIPT --output wiki --version $VERSION
    echo "✅ Wiki page updated"
    ;;

  chat)
    echo "💬 Posting highlights to group chat..."
    python3 scripts/$SCRIPT --output chat --version $VERSION
    echo "✅ Highlights posted"
    ;;

  chictr)
    echo "🇨🇳 Fetching China trials (ChiCTR) only..."
    python3 scripts/$SCRIPT --output wiki --version $VERSION --dry-run | grep -A 20 "中国可申请临床试验"
    echo "✅ ChiCTR preview done"
    ;;

  revolution)
    echo "💊 Fetching Revolution Medicine news only..."
    python3 scripts/$SCRIPT --version $VERSION --dry-run | grep -A 10 "Revolution Medicine"
    echo "✅ Revolution Medicine preview done"
    ;;

  clean-cache)
    echo "🧹 Cleaning cache..."
    rm -rf data/cache/*
    echo "✅ Cache cleared"
    ;;

  clean-history)
    echo "⚠️  Clearing history (will re-publish all items)..."
    rm -f data/history.json
    echo "✅ History cleared"
    ;;

  status)
    echo "📊 Digest Status (Enhanced Edition)"
    echo "  Version: $VERSION"
    echo "  Cache files: $(ls data/cache/ 2>/dev/null | wc -l) files"
    echo "  History entries: $(jq '. | length' data/history.json 2>/dev/null || echo '0')"
    echo "  Last report: $(ls -t data/reports/ 2>/dev/null | head -1 || echo 'none')"
    echo "  Config: sources_${VERSION}.json + output_${VERSION}.json"
    ;;

  help)
    echo " Pancreatic Cancer News Digest - Quick Start (v2.0 Enhanced)"
    echo ""
    echo "Commands:"
    echo "  install        - Install Python dependencies"
    echo "  test           - Dry-run test with enhanced config"
    echo "  run            - Full pipeline (Wiki + Chat) with patient-focused content"
    echo "  wiki           - Publish full enhanced digest to Wiki"
    echo "  chat           - Post highlights to group chat"
    echo "  chictr         - Preview China trials section only"
    echo "  revolution     - Preview Revolution Medicine news only"
    echo "  clean-cache    - Clear cached API responses"
    echo "  clean-history  - Clear deduplication history"
    echo "  status         - Show skill status"
    echo ""
    echo "Options:"
    echo "  --version v1  - Use original config (backward compatible)"
    echo "  --version v2  - Use enhanced config (default)"
    echo ""
    echo "Examples:"
    echo "  ./quick-start.sh install"
    echo "  ./quick-start.sh test"
    echo "  ./quick-start.sh run"
    echo "  ./quick-start.sh wiki"
    echo "  ./quick-start.sh chictr  # See China trials preview"
    exit 1
    ;;

esac