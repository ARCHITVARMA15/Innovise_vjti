"""
app/services/news_service.py
=============================
Fetches financial news from Finnhub and stores results in JSON files.
Integrated into Equitas Ledger FastAPI backend.

Folder structure expected:
    app/
        services/
            news_service.py   ← this file
    news_data/                ← auto-created, stores JSON cache files
    .env                      ← FINNHUB_API_KEY=your_key_here
"""

import os
import json
import hashlib
import logging
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv

# Resolve .env relative to this file's location so it works regardless of CWD
_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(dotenv_path=_ENV_PATH, override=True)

log = logging.getLogger("news_service")

# ── Config ─────────────────────────────────────────────────────────────────
# Do NOT cache as a module-level constant — read fresh each call so restarts
# via uvicorn reloader always pick up the latest .env value.
FINNHUB_BASE = "https://finnhub.io/api/v1"


def _get_api_key() -> str:
    """Read key fresh every call — survives uvicorn hot-reload without restart."""
    load_dotenv(dotenv_path=_ENV_PATH, override=True)
    return os.getenv("FINNHUB_API_KEY", "")

NEWS_DATA_DIR   = Path("news_data")
NEWS_DATA_DIR.mkdir(parents=True, exist_ok=True)

MAX_ARTICLES    = 50   # max articles kept in unified feed
CACHE_TTL_SECS  = 900  # 15 minutes — don't hammer the API on every request

# Tickers to pull company-specific news for
WATCH_TICKERS = ["RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS", "AAPL", "NVDA", "MSFT"]

# ── File paths ──────────────────────────────────────────────────────────────
FILE_UNIFIED    = NEWS_DATA_DIR / "news_unified.json"
FILE_FLASHCARDS = NEWS_DATA_DIR / "news_flashcards.json"
FILE_BY_CAT     = NEWS_DATA_DIR / "news_by_category.json"
FILE_BY_TICKER  = NEWS_DATA_DIR / "news_by_ticker.json"
FILE_SENTIMENT  = NEWS_DATA_DIR / "sentiment_summary.json"
FILE_RAW        = NEWS_DATA_DIR / "raw_finnhub.json"
FILE_META       = NEWS_DATA_DIR / "_meta.json"


# ══════════════════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════════════════

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _article_id(headline: str, source: str) -> str:
    raw = f"{headline.lower().strip()}|{source.lower().strip()}"
    return hashlib.md5(raw.encode()).hexdigest()[:12]


def _load_json(path: Path) -> list | dict:
    if path.exists():
        try:
            with open(path, encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, ValueError):
            log.warning("Corrupted JSON in %s — resetting", path)
            return []
    return []


def _save_json(data: list | dict, path: Path) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def _is_cache_fresh() -> bool:
    """Returns True if the cache was written within CACHE_TTL_SECS."""
    if not FILE_META.exists():
        return False
    meta = _load_json(FILE_META)
    if not isinstance(meta, dict):
        log.warning("Invalid meta format in %s — expected object, got %s", FILE_META, type(meta).__name__)
        return False
    last = meta.get("last_fetched_ts", 0)
    return (time.time() - last) < CACHE_TTL_SECS


def _write_meta() -> None:
    _save_json({"last_fetched_ts": time.time(), "last_fetched_iso": _now_iso()}, FILE_META)


def _categorize(headline: str, summary: str = "") -> str:
    text = (headline + " " + summary).lower()
    if any(w in text for w in ["fed", "rbi", "sebi", "rate", "inflation", "cpi", "gdp", "policy", "regulatory"]):
        return "macro"
    if any(w in text for w in ["bitcoin", "crypto", "ethereum", "btc", "eth", "defi", "web3"]):
        return "crypto"
    if any(w in text for w in ["oil", "gold", "silver", "copper", "crude", "brent", "commodity", "wheat"]):
        return "commodity"
    return "equity"


def _sentiment_from_score(score: float | None) -> str:
    if score is None:
        return "neutral"
    if score >= 0.25:
        return "bullish"
    if score <= -0.25:
        return "bearish"
    return "neutral"


def _tag_and_class(category: str, sentiment: str) -> tuple[str, str]:
    """Returns (display_tag, css_tag_class) for the flashcard UI."""
    tag_map = {
        "macro":     ("Macro · Policy",   "tag-blue"),
        "crypto":    ("Crypto · Market",  "tag-amber"),
        "commodity": ("Commodity",         "tag-red"),
        "equity":    ("Equity · Markets", "tag-green"),
    }
    tag, cls = tag_map.get(category, ("Markets", "tag-gray"))
    if sentiment == "bearish":
        cls = "tag-red"
    elif sentiment == "bullish":
        cls = "tag-green"
    return tag, cls


# ══════════════════════════════════════════════════════════════════════════
# FINNHUB FETCHERS
# ══════════════════════════════════════════════════════════════════════════

def _finnhub_get(endpoint: str, params: dict) -> list | dict | None:
    """Generic Finnhub GET with error handling."""
    api_key = _get_api_key()
    if not api_key:
        log.warning("FINNHUB_API_KEY not set in .env — skipping fetch")
        return None
    params["token"] = api_key
    try:
        resp = requests.get(f"{FINNHUB_BASE}{endpoint}", params=params, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.HTTPError as e:
        log.error("Finnhub HTTP error %s — %s", e.response.status_code, endpoint)
    except requests.exceptions.ConnectionError:
        log.error("Finnhub connection error — check your network")
    except requests.exceptions.Timeout:
        log.error("Finnhub timed out — %s", endpoint)
    except Exception as e:
        log.error("Finnhub unexpected error: %s", e)
    return None


def _fetch_general_news() -> list[dict]:
    raw = _finnhub_get("/news", {"category": "general"})
    if not raw:
        return []

    articles = []
    for item in raw:
        headline = (item.get("headline") or "").strip()
        if not headline:
            continue
        summary = item.get("summary") or ""
        category = _categorize(headline, summary)
        sentiment = "neutral"
        tag, tag_class = _tag_and_class(category, sentiment)

        articles.append({
            "id":              _article_id(headline, "finnhub-general"),
            "source":          "Finnhub",
            "source_name":     item.get("source", "Unknown"),
            "headline":        headline,
            "summary":         summary,
            "url":             item.get("url", ""),
            "image":           item.get("image", ""),
            "category":        category,
            "sentiment":       sentiment,
            "sentiment_score": None,
            "related_tickers": [],
            "tag":             tag,
            "tag_class":       tag_class,
            "published_at":    datetime.fromtimestamp(
                                   item.get("datetime", 0), tz=timezone.utc
                               ).isoformat(),
            "fetched_at":      _now_iso(),
        })

    log.info("Finnhub general news → %d articles", len(articles))
    return articles


def _fetch_company_news(ticker: str) -> list[dict]:
    today     = datetime.now().strftime("%Y-%m-%d")
    from_date = datetime.fromtimestamp(time.time() - 7 * 86400).strftime("%Y-%m-%d")

    raw = _finnhub_get("/company-news", {"symbol": ticker, "from": from_date, "to": today})
    if not raw:
        return []

    articles = []
    for item in raw[:8]:
        headline = (item.get("headline") or "").strip()
        if not headline:
            continue
        summary = item.get("summary") or ""
        tag, tag_class = _tag_and_class("equity", "neutral")

        articles.append({
            "id":              _article_id(headline, f"finnhub-{ticker}"),
            "source":          "Finnhub",
            "source_name":     item.get("source", "Unknown"),
            "headline":        headline,
            "summary":         summary,
            "url":             item.get("url", ""),
            "image":           item.get("image", ""),
            "category":        "equity",
            "sentiment":       "neutral",
            "sentiment_score": None,
            "related_tickers": [ticker],
            "tag":             f"{ticker} · News",
            "tag_class":       tag_class,
            "published_at":    datetime.fromtimestamp(
                                   item.get("datetime", 0), tz=timezone.utc
                               ).isoformat(),
            "fetched_at":      _now_iso(),
        })

    return articles


# ══════════════════════════════════════════════════════════════════════════
# AGGREGATION & STORAGE
# ══════════════════════════════════════════════════════════════════════════

def _merge_deduplicate(existing: list, fresh: list) -> list:
    seen = {a["id"]: a for a in existing}
    for a in fresh:
        seen[a["id"]] = a                           # fresh overwrites stale
    merged = sorted(seen.values(), key=lambda x: x.get("published_at", ""), reverse=True)
    return merged[:MAX_ARTICLES]


def _build_category_index(unified: list) -> dict:
    index: dict = {"all": unified, "macro": [], "equity": [], "commodity": [], "crypto": []}
    for a in unified:
        cat = a.get("category", "equity")
        if cat in index:
            index[cat].append(a)
    return index


def _build_ticker_index(unified: list) -> dict:
    index: dict = {}
    for a in unified:
        for t in a.get("related_tickers", []):
            index.setdefault(t, []).append(a)
    return index


def _build_sentiment_summary(unified: list) -> dict:
    from collections import defaultdict
    cat_stats: dict    = defaultdict(lambda: {"bullish": 0, "bearish": 0, "neutral": 0, "total": 0})
    ticker_stats: dict = defaultdict(lambda: {"bullish": 0, "bearish": 0, "neutral": 0, "total": 0})

    for a in unified:
        s   = a.get("sentiment", "neutral")
        cat = a.get("category", "equity")
        cat_stats[cat][s]       += 1
        cat_stats[cat]["total"] += 1
        for t in a.get("related_tickers", []):
            ticker_stats[t][s]        += 1
            ticker_stats[t]["total"]  += 1

    return {
        "generated_at": _now_iso(),
        "by_category":  dict(cat_stats),
        "by_ticker":    dict(ticker_stats),
    }


def _build_flashcards(unified: list) -> list:
    cards = []
    for a in unified[:20]:
        cards.append({
            "id":           a["id"],
            "headline":     a["headline"],
            "summary":      (a["summary"] or "")[:180] + ("…" if len(a.get("summary") or "") > 180 else ""),
            "source":       a.get("source_name", a.get("source", "")),
            "category":     a.get("category", "equity"),
            "sentiment":    a.get("sentiment", "neutral"),
            "tag":          a.get("tag", "Markets"),
            "tag_class":    a.get("tag_class", "tag-gray"),
            "tickers":      a.get("related_tickers", [])[:3],
            "url":          a.get("url", ""),
            "published_at": a.get("published_at", ""),
        })
    return cards


# ══════════════════════════════════════════════════════════════════════════
# PUBLIC API  — called by FastAPI endpoints
# ══════════════════════════════════════════════════════════════════════════

def fetch_and_store() -> dict:
    """
    Full pipeline: fetch → merge → write all JSON files.
    Returns a status summary.
    Called by POST /news/refresh  OR  on server startup.
    """
    log.info("News fetch started")
    fresh: list[dict] = []

    # general market news
    fresh += _fetch_general_news()
    time.sleep(0.5)

    # company-specific news for watchlist
    for ticker in WATCH_TICKERS[:4]:           # limit to 4 to stay within free quota
        fresh += _fetch_company_news(ticker)
        time.sleep(0.3)

    if not fresh:
        return {
            "status":  "warning",
            "message": "No articles fetched — check FINNHUB_API_KEY in .env",
            "count":   0,
        }

    # merge with existing cache
    existing = _load_json(FILE_UNIFIED) if FILE_UNIFIED.exists() else []
    unified  = _merge_deduplicate(existing, fresh)

    # write all derived files
    _save_json(unified,                     FILE_UNIFIED)
    _save_json(_build_category_index(unified), FILE_BY_CAT)
    _save_json(_build_ticker_index(unified),   FILE_BY_TICKER)
    _save_json(_build_sentiment_summary(unified), FILE_SENTIMENT)
    _save_json(_build_flashcards(unified),     FILE_FLASHCARDS)
    _save_json(fresh,                          FILE_RAW)
    _write_meta()

    log.info("News fetch complete — %d articles stored", len(unified))
    return {
        "status":       "ok",
        "fetched":      len(fresh),
        "total_stored": len(unified),
        "updated_at":   _now_iso(),
    }


def get_news(
    category: str | None = None,
    ticker:   str | None = None,
    limit:    int        = 20,
    refresh:  bool       = False,
) -> list[dict]:
    """
    Main getter called by GET /news endpoints.
    Auto-refreshes if cache is stale (>15 min) or refresh=True.
    """
    if refresh or not _is_cache_fresh():
        fetch_and_store()

    # ticker filter takes priority
    if ticker:
        by_ticker = _load_json(FILE_BY_TICKER) if FILE_BY_TICKER.exists() else {}
        if not isinstance(by_ticker, dict):
            by_ticker = {}
        return by_ticker.get(ticker.upper(), [])[:limit]

    # category filter
    if category and category != "all":
        by_cat = _load_json(FILE_BY_CAT) if FILE_BY_CAT.exists() else {}
        if not isinstance(by_cat, dict):
            by_cat = {}
        return by_cat.get(category, [])[:limit]

    # default: unified feed
    unified = _load_json(FILE_UNIFIED) if FILE_UNIFIED.exists() else []
    if not isinstance(unified, list):
        unified = []
    return unified[:limit]


def get_flashcards(refresh: bool = False) -> list[dict]:
    """
    Lightweight feed for the UI news ticker.
    Called by GET /news/flashcards
    """
    if refresh or not _is_cache_fresh():
        fetch_and_store()
    return _load_json(FILE_FLASHCARDS) if FILE_FLASHCARDS.exists() else []


def get_sentiment_summary(refresh: bool = False) -> dict:
    """
    Aggregated sentiment stats.
    Called by GET /news/sentiment — feeds your Market Pulse widget.
    """
    if refresh or not _is_cache_fresh():
        fetch_and_store()
    return _load_json(FILE_SENTIMENT) if FILE_SENTIMENT.exists() else {}


def get_ticker_news(ticker: str, limit: int = 10) -> list[dict]:
    """
    News filtered for a specific stock ticker.
    Called by GET /news/ticker/{ticker} — feeds portfolio impact feature.
    """
    if not _is_cache_fresh():
        fetch_and_store()
    by_ticker = _load_json(FILE_BY_TICKER) if FILE_BY_TICKER.exists() else {}
    if not isinstance(by_ticker, dict):
        by_ticker = {}
    return by_ticker.get(ticker.upper(), [])[:limit]


def get_market_intelligence_feed(domain: str = "all", limit: int = 10) -> dict:
    """
    Get news for the Market Intelligence Feed on Overview page.
    Supports domain filtering: all, macro, equity, commodity, crypto.
    Returns formatted data for the UI component.
    """
    if not _is_cache_fresh():
        fetch_and_store()
    
    # Get articles based on domain
    if domain == "all" or not domain:
        articles = _load_json(FILE_UNIFIED) if FILE_UNIFIED.exists() else []
        if not isinstance(articles, list):
            articles = []
    else:
        by_cat = _load_json(FILE_BY_CAT) if FILE_BY_CAT.exists() else {}
        if not isinstance(by_cat, dict):
            by_cat = {}
        articles = by_cat.get(domain, [])
    
    articles = articles[:limit]
    
    # Format for Market Intelligence Feed UI
    feed_items = []
    for a in articles:
        # Calculate relative time
        published = a.get("published_at", "")
        time_label = _relative_time(published)
        
        # Map sentiment to impact level (1-5 dots)
        sentiment = a.get("sentiment", "neutral")
        if sentiment == "bullish":
            impact_level = 4
        elif sentiment == "bearish":
            impact_level = 2
        else:
            impact_level = 3
        
        feed_items.append({
            "id": a.get("id", ""),
            "headline": a.get("headline", ""),
            "summary": (a.get("summary") or "")[:200],
            "source": a.get("source_name", a.get("source", "Unknown")),
            "category": a.get("category", "equity"),
            "tag": a.get("tag", "Markets"),
            "tagClass": a.get("tag_class", "tag-gray"),
            "timeLabel": time_label,
            "impactLevel": impact_level,
            "url": a.get("url", ""),
        })
    
    # Get counts per domain for the filter buttons
    by_cat = _load_json(FILE_BY_CAT) if FILE_BY_CAT.exists() else {}
    if not isinstance(by_cat, dict):
        by_cat = {}
    unified = _load_json(FILE_UNIFIED) if FILE_UNIFIED.exists() else []
    if not isinstance(unified, list):
        unified = []
    
    return {
        "domain": domain,
        "items": feed_items,
        "counts": {
            "all": len(unified),
            "macro": len(by_cat.get("macro", [])),
            "equity": len(by_cat.get("equity", [])),
            "commodity": len(by_cat.get("commodity", [])),
            "crypto": len(by_cat.get("crypto", [])),
        },
    }


def _relative_time(iso_timestamp: str) -> str:
    """Convert ISO timestamp to relative time string (e.g., '5h ago')."""
    if not iso_timestamp:
        return "Recently"
    
    try:
        published = datetime.fromisoformat(iso_timestamp.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        diff = now - published
        
        seconds = diff.total_seconds()
        if seconds < 60:
            return "Just now"
        elif seconds < 3600:
            mins = int(seconds / 60)
            return f"{mins}m ago"
        elif seconds < 86400:
            hours = int(seconds / 3600)
            return f"{hours}h ago"
        elif seconds < 604800:
            days = int(seconds / 86400)
            return f"{days}d ago"
        else:
            weeks = int(seconds / 604800)
            return f"{weeks}w ago"
    except Exception:
        return "Recently"
