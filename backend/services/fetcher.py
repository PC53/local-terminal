"""
Public data API consumed by all routers.

This module owns the cache and nothing else. All actual HTTP calls live in
the provider selected by DATA_PROVIDER (default: yahoo).

To swap providers at runtime:  DATA_PROVIDER=finnhub uvicorn ...
To swap providers permanently: set DATA_PROVIDER in a .env file.

Routers never need to change — the interface here is fixed.
"""
import os
import time
from typing import Any, Optional

from services.providers import get_provider

# ── Active provider ────────────────────────────────────────────────────────────
# Instantiated once at startup. TTL values come from the provider itself so
# they automatically match what the source can sustainably deliver.
_provider = get_provider(os.getenv("DATA_PROVIDER", "yahoo"))

# ── In-memory cache ────────────────────────────────────────────────────────────
_cache: dict[str, tuple[Any, float]] = {}


def _cached(key: str, ttl: int) -> Optional[Any]:
    entry = _cache.get(key)
    if entry and time.time() - entry[1] < ttl:
        return entry[0]
    return None


def _store(key: str, val: Any) -> None:
    _cache[key] = (val, time.time())


def cache_clear() -> None:
    """Force-flush the entire cache (useful for testing or manual refresh)."""
    _cache.clear()


def active_provider() -> str:
    """Return the name of the currently active provider (for /health endpoint)."""
    return type(_provider).__name__


# ── Public API — called by routers, never changes ─────────────────────────────

def get_quote(ticker: str) -> dict:
    ticker = ticker.upper()
    key    = f"quote:{ticker}"
    hit    = _cached(key, _provider.TTL["quote"])
    if hit is not None:
        return hit
    result = _provider.get_quote(ticker)
    _store(key, result)
    return result


def get_history(ticker: str, period: str = "1mo", interval: str = "1d") -> list:
    ticker = ticker.upper()
    key    = f"history:{ticker}:{period}:{interval}"
    hit    = _cached(key, _provider.TTL["history"])
    if hit is not None:
        return hit
    result = _provider.get_history(ticker, period, interval)
    _store(key, result)
    return result


def get_news(ticker: str) -> list:
    ticker = ticker.upper()
    key    = f"news:{ticker}"
    hit    = _cached(key, _provider.TTL["news"])
    if hit is not None:
        return hit
    result = _provider.get_news(ticker)
    _store(key, result)
    return result


def get_financials(ticker: str, period: str = "annual") -> dict:
    ticker = ticker.upper()
    key    = f"financials:{ticker}:{period}"
    hit    = _cached(key, _provider.TTL["financials"])
    if hit is not None:
        return hit
    result = _provider.get_financials(ticker, period)
    _store(key, result)
    return result


def get_options(ticker: str) -> dict:
    ticker = ticker.upper()
    key    = f"options:{ticker}"
    hit    = _cached(key, _provider.TTL["options"])
    if hit is not None:
        return hit
    result = _provider.get_options(ticker)
    _store(key, result)
    return result


def get_screen_tickers(mode: str = "active") -> list:
    key = f"screen:{mode}"
    hit = _cached(key, _provider.TTL["screen"])
    if hit is not None:
        return hit
    result = _provider.get_screen(mode)
    _store(key, result)
    return result
