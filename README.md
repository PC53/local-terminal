# Local Terminal

A local Godel Terminal Clone that runs entirely on your machine. No cloud, no subscriptions, no API keys required to get started.

![Terminal Dashboard](https://img.shields.io/badge/status-active-brightgreen) ![Python](https://img.shields.io/badge/python-3.10%2B-blue) ![License](https://img.shields.io/badge/license-MIT-blue)

---

## What it looks like

When you open the app you land on a **live dashboard canvas** — draggable, resizable sticky-note cards showing price charts, live quotes, a news feed, and a watchlist. Press `` ` `` to open the command bar and run any command.

```
┌─────────────────────────────────────────────────────────────────┐
│  TERMINAL  [DASH]  >_________________________  ● MARKET OPEN    │
├─────────────────────────────────────────────────────────────────┤
│  ┌──── CHART · SPY ──────────────┐  ┌── QUOTE · AAPL ─────┐   │
│  │  [candlestick chart]          │  │  259.06              │   │
│  │                               │  │  +2.31 (+0.90%)      │   │
│  └───────────────────────────────┘  └─────────────────────┘   │
│  ┌── WATCHLIST ──────────────────┐  ┌── NEWS · AAPL ──────┐   │
│  │  SPY    579.12  +0.44%        │  │  ● Analyst raises…  │   │
│  │  AAPL   259.06  +0.90%        │  │  ● Q2 earnings…     │   │
│  │  NVDA   176.40  -0.24%        │  │  ● Fed signals…     │   │
│  └───────────────────────────────┘  └─────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  14:32:07 EST                        Dashboard — Press ` to cmd │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

**Prerequisites:** Python 3.10+

```bash
git clone https://github.com/YOUR_USERNAME/local-terminal.git
cd local-terminal
pip install -r backend/requirements.txt
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Then open **http://localhost:8000** in your browser.

**Windows one-click:** double-click `start.bat`  
**Mac/Linux one-click:** `bash start.sh`

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Using the Terminal](#using-the-terminal)
   - [Dashboard](#dashboard)
   - [Command Reference](#command-reference)
   - [Keyboard Shortcuts](#keyboard-shortcuts)
3. [Data Providers](#data-providers)
   - [How the Provider System Works](#how-the-provider-system-works)
   - [Yahoo Finance (default)](#yahoo-finance-default)
   - [Finnhub](#finnhub)
   - [Polygon.io](#polygonio)
   - [Alpaca Markets](#alpaca-markets)
   - [Adding a New Provider](#adding-a-new-provider)
4. [Backend API Reference](#backend-api-reference)
5. [Project Structure](#project-structure)
6. [Configuration](#configuration)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   Browser (Frontend)                 │
│  Vanilla HTML + CSS + JS · TradingView Charts CDN   │
└────────────────────┬────────────────────────────────┘
                     │ HTTP (localhost:8000)
┌────────────────────▼────────────────────────────────┐
│                FastAPI Backend                       │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │  Routers  (quote / chart / news / fin / …)   │   │
│  └──────────────────────┬───────────────────────┘   │
│                         │                           │
│  ┌──────────────────────▼───────────────────────┐   │
│  │  fetcher.py  ←  cache layer (in-memory dict) │   │
│  └──────────────────────┬───────────────────────┘   │
│                         │ delegates to active provider
│  ┌──────────────────────▼───────────────────────┐   │
│  │  Provider  (Yahoo / Finnhub / Polygon / …)   │   │
│  └──────────────────────┬───────────────────────┘   │
│                         │ HTTP                      │
└─────────────────────────┼───────────────────────────┘
                          │
              External Data Sources
```

The key design principle: **routers never know which data source is active**. Swapping providers is a one-line environment variable change.

---

## Using the Terminal

### Dashboard

The dashboard is the home screen. It opens automatically and shows live data cards on a free-form canvas.

**Card types:**

| Card | Content | Auto-refreshes |
|------|---------|----------------|
| CHART | Candlestick chart with volume histogram | On demand |
| QUOTE | Price, change, 52-week range bar | Every 15s |
| NEWS | Headlines with sentiment dots | Every 2 min |
| WATCH | Watchlist (SPY, QQQ, AAPL, MSFT, NVDA, TSLA, BTC-USD, AMZN) | Every 20s |

**Working with cards:**

- **Drag** — grab the `⠿` handle in the card header to move it anywhere on the canvas
- **Resize** — drag the triangle in the bottom-right corner; charts redraw to fit
- **Refresh** — click `↻` in the header to force a data refresh
- **Remove** — click `×` in the header
- **Layout persistence** — card positions and sizes are saved to `localStorage` and restored on every page load

**Adding cards from the command bar:**

```
ADD CHART TSLA        add a price chart card for TSLA
ADD QUOTE MSFT        add a live quote card
ADD NEWS BTC-USD      add a news feed card
ADD WATCH             add another watchlist card
```

**Returning to the dashboard:**

- Click the **DASH** button in the top bar
- Or type `DASH` in the command bar

---

### Command Reference

Press `` ` `` or `/` to open the command bar. Type a command and press Enter.

#### `DES <TICKER>` — Company Description

Full overview of a stock: price, key statistics, company description, and quick-links to other views.

```
DES AAPL
DES TSLA
DES BTC-USD
```

Displays: price, daily change, market cap, P/E ratio, EPS, beta, volume, 52-week range, dividend yield, sector, industry, exchange, and a full company description paragraph.

---

#### `CHART <TICKER>` — Price Chart

Interactive candlestick chart with volume histogram. Supports 8 timeframes.

```
CHART NVDA
CHART SPY
CHART ETH-USD
```

**Timeframe buttons:** 1D · 5D · 1M · 3M · 6M · 1Y · 2Y · 5Y

Hover over the chart to see OHLCV values in the crosshair readout. Scroll to zoom, drag to pan.

---

#### `NEWS <TICKER>` — News Feed

Latest news articles with sentiment analysis applied to each headline.

```
NEWS AAPL
NEWS AMZN
```

Sentiment is calculated locally using VADER (no external API call). Each article shows:
- Headline (clickable link)
- Source and timestamp
- Sentiment label: **positive** (green) · neutral (grey) · **negative** (red)
- Summary counts at the top

---

#### `FIN <TICKER>` — Financial Statements

Income statement, balance sheet, and cash flow. Toggle between annual and quarterly.

```
FIN MSFT
FIN GOOGL
```

Tabs: **Income Statement** · **Balance Sheet** · **Cash Flow**  
Toggle: **Annual** · **Quarterly**

All numbers formatted in $M / $B / $T.

---

#### `MOST` — Market Movers

Live screener showing the most active stocks, top gainers, and top losers.

```
MOST
```

Tabs: **Most Active** · **Top Gainers** · **Top Losers**

Click any row to open `DES <TICKER>` for that stock.

---

#### `ADD <TYPE> <TICKER>` — Add Dashboard Card

Adds a new card to the dashboard canvas.

```
ADD CHART AAPL        chart card
ADD QUOTE TSLA        quote card
ADD NEWS NVDA         news feed card
ADD WATCH             watchlist card
```

---

#### `DASH` — Return to Dashboard

```
DASH
```

---

#### `HELP` — Help

Shows all commands, usage examples, and keyboard shortcuts.

```
HELP
```

---

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `` ` `` | Open command bar |
| `/` | Open command bar |
| `Esc` | Close command bar |
| `↑` / `↓` | Navigate autocomplete suggestions / command history |
| `Tab` | Accept highlighted autocomplete suggestion |
| `Enter` | Execute command |

**Tip:** You can type just a ticker symbol (e.g. `NVDA`) without a command prefix — it defaults to `DES NVDA`.

---

## Data Providers

### How the Provider System Works

The backend uses a pluggable provider architecture. Every data source implements the same interface (`DataProvider` abstract base class). The active provider is selected via the `DATA_PROVIDER` environment variable.

```
services/
├── fetcher.py              ← public API + cache (routers call this)
└── providers/
    ├── __init__.py         ← registry, lazy loader
    ├── base.py             ← abstract interface + TTL defaults
    ├── yahoo.py            ← Yahoo Finance (default, no key needed)
    ├── finnhub.py          ← Finnhub (needs API key)
    ├── polygon.py          ← Polygon.io (needs API key)
    └── alpaca.py           ← Alpaca Markets (needs API key + secret)
```

**Switching providers is one command:**

```bash
DATA_PROVIDER=finnhub FINNHUB_API_KEY=your_key python -m uvicorn main:app ...
```

When you switch, the cache TTLs automatically match the new provider's refresh capabilities. For example, Yahoo Finance enforces ~15s between requests, but Finnhub allows 2s and Alpaca allows ~1s.

| Provider | Quote TTL | Key needed | Free tier |
|----------|-----------|------------|-----------|
| `yahoo` (default) | 15s | No | Unofficial, ~15s floor |
| `finnhub` | 2s | Yes (free) | 60 req/min |
| `polygon` | 15s (free) / 1s (paid) | Yes (free tier) | 5 req/min free |
| `alpaca` | 1s | Yes (free paper account) | Unlimited REST |

---

### Yahoo Finance (default)

No setup required. Uses the Yahoo Finance v8 chart API directly (no `yfinance` library for the hot path).

**Limitations:**
- No official rate limit — ~15s between requests per ticker is the safe floor
- Occasionally rate-limited (429) under heavy use
- No options chains on free tier
- Data quality can vary for international tickers

---

### Finnhub

**Sign up:** https://finnhub.io (free account, no credit card)

**Setup:**
```bash
export FINNHUB_API_KEY=your_key_here
export DATA_PROVIDER=finnhub
```

Or create a `.env` file in `backend/`:
```
DATA_PROVIDER=finnhub
FINNHUB_API_KEY=your_key_here
```

**What improves:**
- Quote cards refresh every **2 seconds** instead of 15s
- More reliable uptime
- Real company news via `/company-news`

**Limitations:**
- Options chains not available on free tier
- 60 req/min across all tickers

---

### Polygon.io

**Sign up:** https://polygon.io (free tier available)

**Setup:**
```bash
export POLYGON_API_KEY=your_key_here
export DATA_PROVIDER=polygon
```

**What improves over free tier:**
- Full US equities, options chains, forex, crypto in one API
- Paid plan: 1s quote refresh, WebSocket real-time feed
- Institutional-quality data

**Limitations (free tier):**
- 5 requests/minute
- Delayed data (15 min) on free tier; real-time on paid

---

### Alpaca Markets

**Sign up:** https://alpaca.markets (free paper trading account, no credit card)

**Setup:**
```bash
export ALPACA_API_KEY=your_key_here
export ALPACA_API_SECRET=your_secret_here
export DATA_PROVIDER=alpaca
```

**What improves:**
- Quote TTL drops to **1 second**
- Unlimited REST requests on paper trading account
- Real-time WebSocket available (not wired in current version)

**Limitations:**
- US equities only (separate crypto endpoint available, not yet wired)
- No financials or options in Alpaca's data API
- Company name not returned by quote endpoint (shows ticker symbol instead)

---

### Adding a New Provider

Adding a provider (e.g. Kraken for crypto, Interactive Brokers, a custom in-house feed) takes three steps.

#### Step 1 — Create the provider file

Create `backend/services/providers/kraken.py`:

```python
import os
import requests
from .base import DataProvider

class KrakenProvider(DataProvider):

    # Set TTLs to match what Kraken's API can handle
    TTL = {
        "quote":       1,
        "history":    30,
        "news":       120,
        "financials": 3600,
        "options":    300,
        "screen":      10,
    }

    def __init__(self):
        # If an API key is needed:
        self._key = os.getenv("KRAKEN_API_KEY", "")
        self._session = requests.Session()

    def get_quote(self, ticker: str) -> dict:
        # Call Kraken's ticker endpoint
        r = self._session.get(
            "https://api.kraken.com/0/public/Ticker",
            params={"pair": ticker},
            timeout=10,
        )
        data = r.json()
        # ... parse the response ...
        result = data["result"].get(ticker, {})
        price = float(result["c"][0])   # last trade price
        # Return the normalised schema — ALL fields are required
        return {
            "symbol":         ticker,
            "name":           ticker,
            "price":          round(price, 2),
            "change":         0.0,
            "change_pct":     0.0,
            "volume":         int(float(result.get("v", [0, 0])[1])),
            "avg_volume":     0,
            "market_cap":     None,
            "pe_ratio":       None,
            "eps":            None,
            "week_52_high":   None,
            "week_52_low":    None,
            "dividend_yield": None,
            "beta":           None,
            "sector":         "Crypto",
            "industry":       "Cryptocurrency",
            "description":    "",
            "market_status":  "open",
            "exchange":       "Kraken",
            "currency":       "USD",
        }

    def get_history(self, ticker: str, period: str, interval: str) -> list:
        # Use Kraken's OHLC endpoint
        # Return list of { time, open, high, low, close, volume }
        # time must be "YYYY-MM-DD" for daily/weekly/monthly, Unix int for intraday
        ...

    def get_news(self, ticker: str) -> list:
        # Kraken doesn't have a news endpoint — return empty list
        return []

    # get_financials and get_options are optional.
    # If not implemented, the base class returns {"error": "not supported"}.
```

#### Step 2 — Register it

Add one line to `backend/services/providers/__init__.py`:

```python
_REGISTRY: dict[str, str] = {
    "yahoo":   "services.providers.yahoo.YahooProvider",
    "finnhub": "services.providers.finnhub.FinnhubProvider",
    "polygon": "services.providers.polygon.PolygonProvider",
    "alpaca":  "services.providers.alpaca.AlpacaProvider",
    "kraken":  "services.providers.kraken.KrakenProvider",   # ← add this
}
```

#### Step 3 — Activate it

```bash
DATA_PROVIDER=kraken python -m uvicorn main:app --port 8000
```

That's it. No other files need to change.

---

#### Required return schema

Every `get_quote` implementation must return this exact shape. Use `None` for fields the source doesn't provide — the frontend handles `null` gracefully.

```python
{
    "symbol":         str,          # "AAPL"
    "name":           str,          # "Apple Inc."
    "price":          float,        # 259.06
    "change":         float,        # 2.31
    "change_pct":     float,        # 0.90  (percent, not decimal)
    "volume":         int,          # 52843920
    "avg_volume":     int,          # 0 if unknown
    "market_cap":     float | None, # 3.28e12
    "pe_ratio":       float | None,
    "eps":            float | None,
    "week_52_high":   float | None,
    "week_52_low":    float | None,
    "dividend_yield": float | None, # 0.0044 (decimal, e.g. 0.44%)
    "beta":           float | None,
    "sector":         str | None,
    "industry":       str | None,
    "description":    str,          # "" if unknown
    "market_status":  str,          # "open" | "closed" | "pre" | "post" | ""
    "exchange":       str,          # "NASDAQ" | ""
    "currency":       str,          # "USD"
}
```

---

## Backend API Reference

All endpoints return JSON. The server runs at `http://localhost:8000`.

| Method | Path | Parameters | Description |
|--------|------|-----------|-------------|
| `GET` | `/api/quote/{ticker}` | — | Full quote + company info |
| `GET` | `/api/chart/{ticker}` | `period`, `interval` | OHLCV candle data |
| `GET` | `/api/news/{ticker}` | — | News with sentiment |
| `GET` | `/api/financials/{ticker}` | `type`, `period` | Financial statements |
| `GET` | `/api/screen/active` | — | Most active stocks |
| `GET` | `/api/screen/gainers` | — | Top gainers |
| `GET` | `/api/screen/losers` | — | Top losers |
| `GET` | `/health` | — | Health check + active provider name |

**`/api/chart/{ticker}` parameters:**

| Parameter | Values | Default |
|-----------|--------|---------|
| `period` | `1d` `5d` `1mo` `3mo` `6mo` `1y` `2y` `5y` `max` | `1mo` |
| `interval` | `1m` `5m` `15m` `30m` `1h` `1d` `1wk` `1mo` | `1d` |

**`/api/financials/{ticker}` parameters:**

| Parameter | Values | Default |
|-----------|--------|---------|
| `type` | `income` `balance` `cashflow` | `income` |
| `period` | `annual` `quarterly` | `annual` |

---

## Project Structure

```
local-terminal/
├── backend/
│   ├── main.py                   FastAPI app, CORS, static file serving
│   ├── requirements.txt
│   ├── routers/
│   │   ├── quote.py              GET /api/quote/{ticker}
│   │   ├── chart.py              GET /api/chart/{ticker}
│   │   ├── news.py               GET /api/news/{ticker}
│   │   ├── financials.py         GET /api/financials/{ticker}
│   │   └── screen.py             GET /api/screen/{mode}
│   └── services/
│       ├── fetcher.py            Cache wrapper + public API
│       ├── sentiment.py          VADER sentiment analysis
│       └── providers/
│           ├── __init__.py       Provider registry + lazy loader
│           ├── base.py           Abstract DataProvider interface
│           ├── yahoo.py          Yahoo Finance (default)
│           ├── finnhub.py        Finnhub (needs API key)
│           ├── polygon.py        Polygon.io (needs API key)
│           └── alpaca.py         Alpaca Markets (needs keys)
└── frontend/
    ├── index.html                Single-page app shell
    ├── style.css                 Terminal dark theme
    └── app.js                    All frontend logic (dashboard, commands, cards)
```

---

## Configuration

All configuration is via environment variables. Create a `backend/.env` file or export them in your shell.

| Variable | Default | Description |
|----------|---------|-------------|
| `DATA_PROVIDER` | `yahoo` | Active data provider |
| `FINNHUB_API_KEY` | — | Required when `DATA_PROVIDER=finnhub` |
| `POLYGON_API_KEY` | — | Required when `DATA_PROVIDER=polygon` |
| `ALPACA_API_KEY` | — | Required when `DATA_PROVIDER=alpaca` |
| `ALPACA_API_SECRET` | — | Required when `DATA_PROVIDER=alpaca` |

**Example `.env` for Finnhub:**
```
DATA_PROVIDER=finnhub
FINNHUB_API_KEY=your_key_here
```

To load a `.env` file automatically, install `python-dotenv` and add this to `main.py`:
```python
from dotenv import load_dotenv
load_dotenv()
```

---

## License

MIT
