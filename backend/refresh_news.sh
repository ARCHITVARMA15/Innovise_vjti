#!/bin/bash
# Run this after updating FINNHUB_API_KEY in .env to pull real news into the cache.
# Usage: bash refresh_news.sh
set -e
echo "Triggering Finnhub news refresh..."
curl -s -X POST "http://localhost:8000/news/refresh" | python3 -m json.tool
echo ""
echo "Checking news count..."
curl -s "http://localhost:8000/news?limit=3" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'✅ {len(d)} articles available'); [print(' -', x.get('headline','')[:70]) for x in d[:3]]"
