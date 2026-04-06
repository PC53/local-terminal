"""
Yahoo Finance provider — uses the v8 chart API directly (no yfinance).
No API key required. Rate limit: ~5–10 req/s per IP in practice.
Safe polling floor: ~15s per ticker.
"""
import requests
from datetime import datetime
from .base import DataProvider


class YahooProvider(DataProvider):

    TTL = {
        "quote":      15,
        "history":    60,
        "news":      120,
        "financials": 3600,
        "options":    300,
        "screen":      30,
    }

    def __init__(self):
        self._session = requests.Session()
        self._session.headers.update({
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept": "application/json",
            "Accept-Language": "en-US,en;q=0.9",
        })

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _chart(self, symbol: str, interval: str = "1d", range_: str = "1mo"):
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
        params = {"interval": interval, "range": range_, "includePrePost": "false"}
        try:
            r = self._session.get(url, params=params, timeout=12)
            if not r.ok:
                return None
            results = r.json().get("chart", {}).get("result")
            return results[0] if results else None
        except Exception:
            return None

    def _quote_summary(self, symbol: str, modules: str):
        url = f"https://query1.finance.yahoo.com/v11/finance/quoteSummary/{symbol}"
        try:
            r = self._session.get(url, params={"modules": modules, "formatted": "false"}, timeout=12)
            if not r.ok:
                return None
            result = r.json().get("quoteSummary", {}).get("result")
            return result[0] if result else None
        except Exception:
            return None

    # ── DataProvider interface ────────────────────────────────────────────────

    def get_quote(self, ticker: str) -> dict:
        result = self._chart(ticker, interval="1d", range_="5d")
        if not result:
            return {"error": f"No data for {ticker}. Check the ticker symbol."}

        meta = result.get("meta", {})
        price = meta.get("regularMarketPrice")
        prev_close = meta.get("chartPreviousClose") or meta.get("previousClose")

        if price is None:
            return {"error": f"No price data for {ticker}."}

        change = round(price - prev_close, 4) if prev_close else 0
        change_pct = round((change / prev_close) * 100, 4) if prev_close else 0

        info = {}
        qs = self._quote_summary(
            ticker,
            "assetProfile,defaultKeyStatistics,summaryDetail,financialData,price",
        )
        if qs:
            info = {
                **(qs.get("assetProfile") or {}),
                **(qs.get("defaultKeyStatistics") or {}),
                **(qs.get("summaryDetail") or {}),
                **(qs.get("financialData") or {}),
                **(qs.get("price") or {}),
            }

        return {
            "symbol":        ticker.upper(),
            "name":          info.get("longName") or info.get("shortName") or meta.get("longName") or meta.get("shortName") or ticker.upper(),
            "price":         round(float(price), 2),
            "change":        round(float(change), 2),
            "change_pct":    round(float(change_pct), 2),
            "volume":        int(meta.get("regularMarketVolume") or info.get("volume") or 0),
            "avg_volume":    int(info.get("averageVolume") or info.get("averageDailyVolume10Day") or 0),
            "market_cap":    info.get("marketCap") or meta.get("marketCap"),
            "pe_ratio":      info.get("trailingPE") or info.get("forwardPE"),
            "eps":           info.get("trailingEps"),
            "week_52_high":  meta.get("fiftyTwoWeekHigh") or info.get("fiftyTwoWeekHigh"),
            "week_52_low":   meta.get("fiftyTwoWeekLow") or info.get("fiftyTwoWeekLow"),
            "dividend_yield":info.get("dividendYield") or info.get("trailingAnnualDividendYield"),
            "beta":          info.get("beta"),
            "sector":        info.get("sector"),
            "industry":      info.get("industry"),
            "description":   info.get("longBusinessSummary", ""),
            "market_status": meta.get("marketState", "").lower(),
            "exchange":      meta.get("exchangeName") or meta.get("fullExchangeName") or "",
            "currency":      meta.get("currency", "USD"),
        }

    def get_history(self, ticker: str, period: str, interval: str) -> list:
        period_map = {
            "1d": "1d", "5d": "5d", "1mo": "1mo", "3mo": "3mo",
            "6mo": "6mo", "1y": "1y", "2y": "2y", "5y": "5y", "max": "max",
        }
        result = self._chart(ticker, interval=interval, range_=period_map.get(period, "1mo"))
        if not result:
            return []

        timestamps = result.get("timestamp", [])
        q = result.get("indicators", {}).get("quote", [{}])[0]
        opens, highs, lows, closes, volumes = (
            q.get("open", []), q.get("high", []), q.get("low", []),
            q.get("close", []), q.get("volume", []),
        )

        out = []
        for i, ts in enumerate(timestamps):
            o, h, l, c = (
                opens[i]  if i < len(opens)  else None,
                highs[i]  if i < len(highs)  else None,
                lows[i]   if i < len(lows)   else None,
                closes[i] if i < len(closes) else None,
            )
            if None in (o, h, l, c):
                continue
            v  = volumes[i] if i < len(volumes) else 0
            dt = datetime.utcfromtimestamp(ts)
            out.append({
                "time":   dt.strftime("%Y-%m-%d") if interval in ("1d", "1wk", "1mo") else int(ts),
                "open":   round(float(o), 4),
                "high":   round(float(h), 4),
                "low":    round(float(l), 4),
                "close":  round(float(c), 4),
                "volume": int(v or 0),
            })
        return out

    def get_news(self, ticker: str) -> list:
        url = "https://query1.finance.yahoo.com/v1/finance/search"
        try:
            r = self._session.get(
                url,
                params={"q": ticker, "newsCount": 20, "enableFuzzyQuery": False, "quotesCount": 0},
                timeout=12,
            )
            if not r.ok:
                return []
            out = []
            for item in r.json().get("news", []):
                ts = item.get("providerPublishTime")
                pub = ""
                if ts:
                    try:
                        pub = datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d %H:%M")
                    except Exception:
                        pub = str(ts)
                out.append({
                    "title":        item.get("title", ""),
                    "publisher":    item.get("publisher", ""),
                    "link":         item.get("link", ""),
                    "published_at": pub,
                    "sentiment":    None,
                })
            return out
        except Exception:
            return []

    def get_financials(self, ticker: str, period: str = "annual") -> dict:
        if period == "quarterly":
            modules = "incomeStatementHistoryQuarterly,balanceSheetHistoryQuarterly,cashflowStatementHistoryQuarterly"
        else:
            modules = "incomeStatementHistory,balanceSheetHistory,cashflowStatementHistory"

        qs = self._quote_summary(ticker, modules)
        if not qs:
            return {"error": "Could not fetch financials"}

        def _extract(section_key):
            section = qs.get(section_key, {})
            # Each section has one list key containing the statements
            items = next((v for v in section.values() if isinstance(v, list)), [])
            out = {}
            for stmt in items:
                date = stmt.get("endDate", {})
                date_str = date.get("fmt", str(date)) if isinstance(date, dict) else str(date)
                row = {}
                for k, v in stmt.items():
                    if k in ("endDate", "maxAge"):
                        continue
                    row[k] = v.get("raw") if isinstance(v, dict) else v
                out[date_str] = row
            return out

        if period == "quarterly":
            return {
                "income":   _extract("incomeStatementHistoryQuarterly"),
                "balance":  _extract("balanceSheetHistoryQuarterly"),
                "cashflow": _extract("cashflowStatementHistoryQuarterly"),
            }
        return {
            "income":   _extract("incomeStatementHistory"),
            "balance":  _extract("balanceSheetHistory"),
            "cashflow": _extract("cashflowStatementHistory"),
        }

    def get_options(self, ticker: str) -> dict:
        url = f"https://query1.finance.yahoo.com/v7/finance/options/{ticker}"
        try:
            r = self._session.get(url, timeout=12)
            if not r.ok:
                return {"error": "Options data unavailable"}
            opt_result = r.json().get("optionChain", {}).get("result", [])
            if not opt_result:
                return {"error": "No options data"}

            out = {}
            for exp_ts in opt_result[0].get("expirationDates", [])[:3]:
                exp_str = datetime.utcfromtimestamp(exp_ts).strftime("%Y-%m-%d")
                r2 = self._session.get(url, params={"date": exp_ts}, timeout=12)
                if not r2.ok:
                    continue
                r2_res = r2.json().get("optionChain", {}).get("result", [])
                if not r2_res:
                    continue
                options = r2_res[0].get("options", [{}])[0]

                def _clean(contracts):
                    def _raw(v):
                        return v.get("raw") if isinstance(v, dict) else v
                    return [{
                        "strike": _raw(c.get("strike")),
                        "last":   _raw(c.get("lastPrice")),
                        "bid":    _raw(c.get("bid")),
                        "ask":    _raw(c.get("ask")),
                        "volume": _raw(c.get("volume")),
                        "oi":     _raw(c.get("openInterest")),
                        "iv":     round(float(_raw(c.get("impliedVolatility")) or 0) * 100, 1),
                    } for c in contracts[:20]]

                out[exp_str] = {
                    "calls": _clean(options.get("calls", [])),
                    "puts":  _clean(options.get("puts", [])),
                }
            return out
        except Exception as e:
            return {"error": str(e)}

    def get_screen(self, mode: str = "active") -> list:
        scr_id = {"active": "most_actives", "gainers": "day_gainers", "losers": "day_losers"}.get(mode, "most_actives")
        url = (
            "https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved"
            f"?formatted=false&scrIds={scr_id}&count=25"
        )
        try:
            r = self._session.get(url, timeout=12)
            if not r.ok:
                return []
            quotes = r.json().get("finance", {}).get("result", [{}])[0].get("quotes", [])
            return [{
                "symbol":     q.get("symbol", ""),
                "name":       q.get("longName") or q.get("shortName") or "",
                "price":      q.get("regularMarketPrice"),
                "change":     round(q.get("regularMarketChange") or 0, 2),
                "change_pct": round(q.get("regularMarketChangePercent") or 0, 2),
                "volume":     q.get("regularMarketVolume"),
            } for q in quotes]
        except Exception:
            return []
