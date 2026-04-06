"""
Alpaca Markets provider — https://alpaca.markets
Free tier: unlimited market data with paper trading account.
Real-time US equities via REST and WebSocket (websocket not wired here yet).
Safe polling floor: ~1s (REST), real-time with websocket upgrade.
Supports: US equities, crypto (separate base URL).

Setup:
  1. Sign up at alpaca.markets (free paper trading account)
  2. Generate API key + secret in the dashboard
  3. Set env vars:
       ALPACA_API_KEY=your_key_here
       ALPACA_API_SECRET=your_secret_here
       ALPACA_BASE_URL=https://data.alpaca.markets   (data endpoint)
  4. Set env var:  DATA_PROVIDER=alpaca

Docs: https://docs.alpaca.markets/reference/stocklatestquote
"""
import os
import requests
from datetime import datetime, timedelta, timezone
from .base import DataProvider

_DATA_BASE   = "https://data.alpaca.markets"
_BROKER_BASE = "https://api.alpaca.markets"


class AlpacaProvider(DataProvider):

    TTL = {
        "quote":       1,    # REST supports ~1s; use websocket for real-time
        "history":    30,
        "news":       60,
        "financials": 3600,
        "options":    300,
        "screen":      10,
    }

    def __init__(self):
        key    = os.getenv("ALPACA_API_KEY", "")
        secret = os.getenv("ALPACA_API_SECRET", "")
        if not key or not secret:
            raise EnvironmentError(
                "ALPACA_API_KEY and ALPACA_API_SECRET are not set. "
                "Sign up at https://alpaca.markets (free paper account) to get credentials."
            )
        headers = {
            "APCA-API-KEY-ID":     key,
            "APCA-API-SECRET-KEY": secret,
            "Accept": "application/json",
        }
        self._data_session   = requests.Session()
        self._broker_session = requests.Session()
        self._data_session.headers.update(headers)
        self._broker_session.headers.update(headers)

    def _data(self, path: str, **params) -> dict | None:
        try:
            r = self._data_session.get(f"{_DATA_BASE}{path}", params=params, timeout=10)
            return r.json() if r.ok else None
        except Exception:
            return None

    def _broker(self, path: str, **params) -> dict | None:
        try:
            r = self._broker_session.get(f"{_BROKER_BASE}{path}", params=params, timeout=10)
            return r.json() if r.ok else None
        except Exception:
            return None

    # ── DataProvider interface ────────────────────────────────────────────────

    def get_quote(self, ticker: str) -> dict:
        # GET /v2/stocks/{ticker}/quotes/latest
        data = self._data(f"/v2/stocks/{ticker}/quotes/latest")
        if not data or "quote" not in data:
            return {"error": f"No quote data for {ticker}"}

        q      = data["quote"]
        price  = (q.get("ap") or 0 + q.get("bp") or 0) / 2  # mid of ask/bid
        # For last trade price use /v2/stocks/{ticker}/trades/latest
        trade  = self._data(f"/v2/stocks/{ticker}/trades/latest")
        if trade and "trade" in trade:
            price = trade["trade"].get("p", price)

        # Snapshot for prev close and daily change
        snap = self._data(f"/v2/stocks/{ticker}/snapshot")
        prev_close  = None
        volume      = 0
        week_52_h   = None
        week_52_l   = None
        if snap and "snapshot" in snap:
            s          = snap["snapshot"]
            prev_close = s.get("prevDailyBar", {}).get("c")
            volume     = int(s.get("dailyBar", {}).get("v") or 0)

        change     = round(price - prev_close, 4) if prev_close else 0
        change_pct = round((change / prev_close) * 100, 4) if prev_close else 0

        return {
            "symbol":         ticker.upper(),
            "name":           ticker.upper(),   # Alpaca data API doesn't return company name; use a reference lookup if needed
            "price":          round(float(price), 2),
            "change":         round(float(change), 2),
            "change_pct":     round(float(change_pct), 2),
            "volume":         volume,
            "avg_volume":     0,
            "market_cap":     None,
            "pe_ratio":       None,
            "eps":            None,
            "week_52_high":   week_52_h,
            "week_52_low":    week_52_l,
            "dividend_yield": None,
            "beta":           None,
            "sector":         None,
            "industry":       None,
            "description":    "",
            "market_status":  "",
            "exchange":       q.get("ax", ""),
            "currency":       "USD",
        }

    def get_history(self, ticker: str, period: str, interval: str) -> list:
        # GET /v2/stocks/{ticker}/bars
        timeframe_map = {
            "1m": "1Min", "5m": "5Min", "15m": "15Min", "30m": "30Min",
            "1h": "1Hour", "1d": "1Day", "1wk": "1Week", "1mo": "1Month",
        }
        period_days = {
            "1d": 1, "5d": 5, "1mo": 30, "3mo": 90, "6mo": 180,
            "1y": 365, "2y": 730, "5y": 1825, "max": 3650,
        }
        tf   = timeframe_map.get(interval, "1Day")
        days = period_days.get(period, 30)

        end   = datetime.now(timezone.utc)
        start = end - timedelta(days=days)

        data = self._data(
            f"/v2/stocks/{ticker}/bars",
            timeframe=tf,
            start=start.strftime("%Y-%m-%dT%H:%M:%SZ"),
            end=end.strftime("%Y-%m-%dT%H:%M:%SZ"),
            limit=1000,
            adjustment="split",
        )
        if not data or "bars" not in data:
            return []

        out = []
        for bar in data["bars"]:
            dt = datetime.fromisoformat(bar["t"].replace("Z", "+00:00"))
            out.append({
                "time":   dt.strftime("%Y-%m-%d") if interval in ("1d", "1wk", "1mo") else int(dt.timestamp()),
                "open":   round(float(bar["o"]), 4),
                "high":   round(float(bar["h"]), 4),
                "low":    round(float(bar["l"]), 4),
                "close":  round(float(bar["c"]), 4),
                "volume": int(bar.get("v") or 0),
            })
        return out

    def get_news(self, ticker: str) -> list:
        # GET /v1beta1/news
        data = self._data("/v1beta1/news", symbols=ticker, limit=20, sort="desc")
        if not data:
            return []
        out = []
        for a in data.get("news", []):
            pub = a.get("created_at", "")[:16].replace("T", " ")
            out.append({
                "title":        a.get("headline", ""),
                "publisher":    a.get("source", ""),
                "link":         a.get("url", ""),
                "published_at": pub,
                "sentiment":    None,
            })
        return out

    # financials / options: not in Alpaca's data API.
    # Leaving as base-class default.
