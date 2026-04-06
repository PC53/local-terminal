"""
Finnhub provider — https://finnhub.io
Free tier: 60 req/min. Safe polling floor: ~2s per ticker.
Supports: equities, forex, crypto.

Setup:
  1. Sign up at finnhub.io (free)
  2. Copy your API key
  3. Set env var:  FINNHUB_API_KEY=your_key_here
  4. Set env var:  DATA_PROVIDER=finnhub

Docs: https://finnhub.io/docs/api
"""
import os
import time
import requests
from datetime import datetime
from .base import DataProvider

_BASE = "https://finnhub.io/api/v1"


class FinnhubProvider(DataProvider):

    TTL = {
        "quote":       2,    # 60 req/min free → 2s safe floor
        "history":    30,
        "news":       60,
        "financials": 3600,
        "options":    300,
        "screen":      10,
    }

    def __init__(self):
        self._key = os.getenv("FINNHUB_API_KEY", "")
        if not self._key:
            raise EnvironmentError(
                "FINNHUB_API_KEY is not set. "
                "Get a free key at https://finnhub.io and set the env var."
            )
        self._session = requests.Session()
        self._session.headers.update({"X-Finnhub-Token": self._key})

    def _get(self, path: str, **params) -> dict | list | None:
        try:
            r = self._session.get(f"{_BASE}{path}", params=params, timeout=10)
            return r.json() if r.ok else None
        except Exception:
            return None

    # ── DataProvider interface ────────────────────────────────────────────────

    def get_quote(self, ticker: str) -> dict:
        # GET /quote  →  { c: price, d: change, dp: change_pct, h, l, o, pc, t }
        q = self._get("/quote", symbol=ticker)
        if not q or q.get("c") is None:
            return {"error": f"No quote data for {ticker}"}

        # GET /stock/profile2  →  name, exchange, currency, sector, etc.
        profile = self._get("/stock/profile2", symbol=ticker) or {}

        price      = q["c"]
        prev_close = q.get("pc", price)
        change     = round(price - prev_close, 4)
        change_pct = round(q.get("dp", 0), 4)

        return {
            "symbol":         ticker.upper(),
            "name":           profile.get("name", ticker.upper()),
            "price":          round(float(price), 2),
            "change":         round(float(change), 2),
            "change_pct":     round(float(change_pct), 2),
            "volume":         int(q.get("v") or 0),        # NOTE: Finnhub basic quote has no intraday vol; use /stock/metric for avg
            "avg_volume":     0,
            "market_cap":     profile.get("marketCapitalization"),
            "pe_ratio":       None,                          # fetch separately via /stock/metric if needed
            "eps":            None,
            "week_52_high":   q.get("h"),                   # today's high; use /stock/metric for 52w
            "week_52_low":    q.get("l"),
            "dividend_yield": None,
            "beta":           None,
            "sector":         profile.get("finnhubIndustry"),
            "industry":       profile.get("finnhubIndustry"),
            "description":    "",
            "market_status":  "",
            "exchange":       profile.get("exchange", ""),
            "currency":       profile.get("currency", "USD"),
        }

    def get_history(self, ticker: str, period: str, interval: str) -> list:
        # GET /stock/candle  →  { o, h, l, c, v, t, s }
        # Map period → seconds offset from now
        period_seconds = {
            "1d": 86400, "5d": 432000, "1mo": 2592000, "3mo": 7776000,
            "6mo": 15552000, "1y": 31536000, "2y": 63072000, "5y": 157680000,
        }
        resolution_map = {
            "1m": "1", "5m": "5", "15m": "15", "30m": "30",
            "1h": "60", "1d": "D", "1wk": "W", "1mo": "M",
        }
        now   = int(time.time())
        delta = period_seconds.get(period, 2592000)
        res   = resolution_map.get(interval, "D")

        data = self._get("/stock/candle", symbol=ticker, resolution=res, from_=now - delta, to=now)
        if not data or data.get("s") != "ok":
            return []

        ts_list = data.get("t", [])
        out = []
        for i, ts in enumerate(ts_list):
            dt = datetime.utcfromtimestamp(ts)
            out.append({
                "time":   dt.strftime("%Y-%m-%d") if interval in ("1d", "1wk", "1mo") else int(ts),
                "open":   round(float(data["o"][i]), 4),
                "high":   round(float(data["h"][i]), 4),
                "low":    round(float(data["l"][i]), 4),
                "close":  round(float(data["c"][i]), 4),
                "volume": int(data["v"][i] or 0),
            })
        return out

    def get_news(self, ticker: str) -> list:
        # GET /company-news  →  [{ headline, source, url, datetime }, ...]
        today     = datetime.utcnow().strftime("%Y-%m-%d")
        month_ago = datetime.utcfromtimestamp(time.time() - 2592000).strftime("%Y-%m-%d")
        articles  = self._get("/company-news", symbol=ticker, from_=month_ago, to=today) or []
        out = []
        for a in articles[:20]:
            ts  = a.get("datetime")
            pub = datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d %H:%M") if ts else ""
            out.append({
                "title":        a.get("headline", ""),
                "publisher":    a.get("source", ""),
                "link":         a.get("url", ""),
                "published_at": pub,
                "sentiment":    None,
            })
        return out

    # financials and options: Finnhub has these endpoints but they require
    # additional implementation. See:
    #   /stock/financials-reported  (financials)
    #   Finnhub does not provide options chains on the free tier.
    # Leave as base-class default (returns "not supported") until needed.
