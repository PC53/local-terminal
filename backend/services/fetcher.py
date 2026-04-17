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
from functools import wraps
from typing import Any, Callable, Optional

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


def _cached_call(ttl_key: str, key_fn: Callable[..., str]):
    """
    Decorator: wrap a provider method with TTL caching.

    - ttl_key: key into _provider.TTL (e.g. "quote", "history")
    - key_fn:  given the same args as the wrapped fn, returns the cache key
    """
    def wrap(fn: Callable) -> Callable:
        @wraps(fn)
        def inner(*args, **kwargs):
            key = key_fn(*args, **kwargs)
            hit = _cached(key, _provider.TTL[ttl_key])
            if hit is not None:
                return hit
            result = fn(*args, **kwargs)
            _store(key, result)
            return result
        return inner
    return wrap


# ── Public API — called by routers ────────────────────────────────────────────

@_cached_call("quote", lambda t: f"quote:{t.upper()}")
def get_quote(ticker: str) -> dict:
    return _provider.get_quote(ticker.upper())


@_cached_call("history", lambda t, period="1mo", interval="1d": f"history:{t.upper()}:{period}:{interval}")
def get_history(ticker: str, period: str = "1mo", interval: str = "1d") -> list:
    return _provider.get_history(ticker.upper(), period, interval)


@_cached_call("news", lambda t: f"news:{t.upper()}")
def get_news(ticker: str) -> list:
    return _provider.get_news(ticker.upper())


@_cached_call("financials", lambda t, period="annual": f"financials:{t.upper()}:{period}")
def get_financials(ticker: str, period: str = "annual") -> dict:
    return _provider.get_financials(ticker.upper(), period)


@_cached_call("options", lambda t: f"options:{t.upper()}")
def get_options(ticker: str) -> dict:
    return _provider.get_options(ticker.upper())


@_cached_call("screen", lambda mode="active": f"screen:{mode}")
def get_screen_tickers(mode: str = "active") -> list:
    return _provider.get_screen(mode)
