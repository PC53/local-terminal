"""
Polygon.io provider — https://polygon.io
Free tier: 5 req/min (unlimited on paid). Websocket available on paid tier.
Safe polling floor: ~15s (free) or sub-second (paid + websocket).
Supports: US equities, options, forex, crypto.

Setup:
  1. Sign up at polygon.io (free tier available)
  2. Copy your API key
  3. Set env var:  POLYGON_API_KEY=your_key_here
  4. Set env var:  DATA_PROVIDER=polygon

Docs: https://polygon.io/docs/stocks
"""
import os
import time
import requests
from datetime import datetime, timedelta
from .base import DataProvider

_BASE = "https://api.polygon.io"


class PolygonProvider(DataProvider):

    # Free tier is 5 req/min — keep TTLs generous.
    # On a paid plan you can drop quote/history to 1s.
    TTL = {
        "quote":       15,   # drop to 1 on paid tier
        "history":     60,
        "news":       120,
        "financials": 3600,
        "options":    300,
        "screen":      30,
    }

    def __init__(self):
        self._key = os.getenv("POLYGON_API_KEY", "")
        if not self._key:
            raise EnvironmentError(
                "POLYGON_API_KEY is not set. "
                "Get a free key at https://polygon.io and set the env var."
            )
        self._session = requests.Session()
        self._session.params = {"apiKey": self._key}  # type: ignore

    def _get(self, path: str, **params) -> dict | None:
        try:
            r = self._session.get(f"{_BASE}{path}", params=params, timeout=10)
            return r.json() if r.ok else None
        except Exception:
            return None

    # ── DataProvider interface ────────────────────────────────────────────────

    def get_quote(self, ticker: str) -> dict:
        # GET /v2/snapshot/locale/us/markets/stocks/tickers/{ticker}
        # Returns last trade, day OHLCV, prevDay, etc.
        data = self._get(f"/v2/snapshot/locale/us/markets/stocks/tickers/{ticker}")
        if not data or "ticker" not in data:
            return {"error": f"No snapshot data for {ticker}"}

        snap      = data["ticker"]
        day       = snap.get("day", {})
        prev_day  = snap.get("prevDay", {})
        last      = snap.get("lastTrade", {})

        price      = last.get("p") or day.get("c")
        prev_close = prev_day.get("c", price)
        if price is None:
            return {"error": f"No price for {ticker}"}

        change     = round(price - prev_close, 4)
        change_pct = round((change / prev_close) * 100, 4) if prev_close else 0

        # GET /v3/reference/tickers/{ticker}  →  name, description, etc.
        ref = self._get(f"/v3/reference/tickers/{ticker}")
        info = ref.get("results", {}) if ref else {}

        return {
            "symbol":         ticker.upper(),
            "name":           info.get("name", ticker.upper()),
            "price":          round(float(price), 2),
            "change":         round(float(change), 2),
            "change_pct":     round(float(change_pct), 2),
            "volume":         int(day.get("v") or 0),
            "avg_volume":     int(snap.get("todaysChangePerc") or 0),  # use /v2/aggs for avg
            "market_cap":     info.get("market_cap"),
            "pe_ratio":       None,
            "eps":            None,
            "week_52_high":   None,   # fetch via /v2/aggs/ticker/.../range/1/day/...
            "week_52_low":    None,
            "dividend_yield": None,
            "beta":           None,
            "sector":         info.get("sic_description"),
            "industry":       info.get("sic_description"),
            "description":    info.get("description", ""),
            "market_status":  "",
            "exchange":       info.get("primary_exchange", ""),
            "currency":       info.get("currency_name", "USD").upper(),
        }

    def get_history(self, ticker: str, period: str, interval: str) -> list:
        # GET /v2/aggs/ticker/{ticker}/range/{multiplier}/{timespan}/{from}/{to}
        timespan_map = {
            "1m": (1, "minute"), "5m": (5, "minute"), "15m": (15, "minute"),
            "30m": (30, "minute"), "1h": (1, "hour"),
            "1d": (1, "day"), "1wk": (1, "week"), "1mo": (1, "month"),
        }
        period_days = {
            "1d": 1, "5d": 5, "1mo": 30, "3mo": 90, "6mo": 180,
            "1y": 365, "2y": 730, "5y": 1825, "max": 3650,
        }
        mult, span = timespan_map.get(interval, (1, "day"))
        days = period_days.get(period, 30)

        to_date   = datetime.utcnow().strftime("%Y-%m-%d")
        from_date = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")

        data = self._get(
            f"/v2/aggs/ticker/{ticker}/range/{mult}/{span}/{from_date}/{to_date}",
            adjusted=True, sort="asc", limit=5000,
        )
        if not data or data.get("resultsCount", 0) == 0:
            return []

        out = []
        for bar in data.get("results", []):
            ts = bar["t"] / 1000  # Polygon uses millisecond timestamps
            dt = datetime.utcfromtimestamp(ts)
            out.append({
                "time":   dt.strftime("%Y-%m-%d") if interval in ("1d", "1wk", "1mo") else int(ts),
                "open":   round(float(bar["o"]), 4),
                "high":   round(float(bar["h"]), 4),
                "low":    round(float(bar["l"]), 4),
                "close":  round(float(bar["c"]), 4),
                "volume": int(bar.get("v") or 0),
            })
        return out

    def get_news(self, ticker: str) -> list:
        # GET /v2/reference/news
        data = self._get("/v2/reference/news", ticker=ticker, limit=20, order="desc", sort="published_utc")
        if not data:
            return []
        out = []
        for a in data.get("results", []):
            pub = a.get("published_utc", "")[:16].replace("T", " ")
            out.append({
                "title":        a.get("title", ""),
                "publisher":    a.get("publisher", {}).get("name", "") if isinstance(a.get("publisher"), dict) else "",
                "link":         a.get("article_url", ""),
                "published_at": pub,
                "sentiment":    None,
            })
        return out

    def get_financials(self, ticker: str, period: str = "annual") -> dict:
        # GET /vX/reference/financials
        timeframe = "annual" if period == "annual" else "quarterly"
        data = self._get("/vX/reference/financials", ticker=ticker, timeframe=timeframe, limit=4)
        if not data or not data.get("results"):
            return {"error": "Could not fetch financials from Polygon"}

        income, balance, cashflow = {}, {}, {}
        for r in data["results"]:
            date = r.get("end_date", "unknown")
            fin  = r.get("financials", {})
            income[date]   = {k: v.get("value") for k, v in fin.get("income_statement", {}).items()}
            balance[date]  = {k: v.get("value") for k, v in fin.get("balance_sheet", {}).items()}
            cashflow[date] = {k: v.get("value") for k, v in fin.get("cash_flow_statement", {}).items()}

        return {"income": income, "balance": balance, "cashflow": cashflow}

    # options: available on paid Polygon plans via /v3/reference/options/contracts
    # Leaving as base-class default until needed.
