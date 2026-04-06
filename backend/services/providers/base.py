"""
Abstract base class for all data providers.

To add a new provider:
  1. Create services/providers/<name>.py
  2. Subclass DataProvider, override TTL if needed, implement all abstract methods
  3. Register it in services/providers/__init__.py
  4. Set DATA_PROVIDER=<name> in your environment (or .env)

Every method must return data in the normalised schema defined below —
the rest of the app (routers, frontend) never sees provider-specific shapes.
"""
from abc import ABC, abstractmethod


class DataProvider(ABC):

    # Override in subclass to match what the source can sustainably deliver.
    # These are the cache TTLs in seconds — lower = fresher data.
    # Yahoo (unofficial): 15s quote is about the floor before 429s appear.
    # Finnhub free:       2s is safe (60 req/min per ticker).
    # Polygon paid:       1s or even sub-second with websockets.
    TTL: dict[str, int] = {
        "quote":      15,
        "history":    60,
        "news":      120,
        "financials": 3600,
        "options":    300,
        "screen":      30,
    }

    # ── Required ──────────────────────────────────────────────────────────────

    @abstractmethod
    def get_quote(self, ticker: str) -> dict:
        """
        Returns:
        {
          symbol, name, price, change, change_pct,
          volume, avg_volume, market_cap, pe_ratio, eps,
          week_52_high, week_52_low, dividend_yield, beta,
          sector, industry, description, market_status,
          exchange, currency
        }
        On error: {"error": "message"}
        """

    @abstractmethod
    def get_history(self, ticker: str, period: str, interval: str) -> list:
        """
        period:   1d | 5d | 1mo | 3mo | 6mo | 1y | 2y | 5y | max
        interval: 1m | 5m | 15m | 30m | 1h | 1d | 1wk | 1mo

        Returns list of OHLCV dicts:
        [{ time: "YYYY-MM-DD" | unix_int, open, high, low, close, volume }, ...]
        Daily/weekly/monthly: time is "YYYY-MM-DD" string (LightweightCharts requirement).
        Intraday: time is a Unix timestamp int.
        """

    @abstractmethod
    def get_news(self, ticker: str) -> list:
        """
        Returns:
        [{ title, publisher, link, published_at, sentiment }, ...]
        sentiment is None here; filled by the news router via VADER.
        """

    # ── Optional (return error dict / empty list if provider doesn't support) ──

    def get_financials(self, ticker: str, period: str = "annual") -> dict:
        """
        period: "annual" | "quarterly"
        Returns: { income: {...}, balance: {...}, cashflow: {...} }
        Each sub-dict: { "YYYY-MM-DD": { metric: value, ... }, ... }
        """
        return {"error": f"{self.__class__.__name__} does not support financials"}

    def get_options(self, ticker: str) -> dict:
        """
        Returns: {
          "YYYY-MM-DD": {
            calls: [{ strike, last, bid, ask, volume, oi, iv }, ...],
            puts:  [...]
          }, ...
        }
        """
        return {"error": f"{self.__class__.__name__} does not support options"}

    def get_screen(self, mode: str = "active") -> list:
        """
        mode: "active" | "gainers" | "losers"
        Returns: [{ symbol, name, price, change, change_pct, volume }, ...]
        """
        return []
