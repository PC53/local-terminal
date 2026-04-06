from fastapi import APIRouter, Query, HTTPException
from services.fetcher import get_history

router = APIRouter()

VALID_PERIODS = {"1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "max"}
VALID_INTERVALS = {"1m", "5m", "15m", "30m", "1h", "1d", "1wk", "1mo"}

# Period -> best default interval
PERIOD_INTERVAL_MAP = {
    "1d": "5m",
    "5d": "15m",
    "1mo": "1d",
    "3mo": "1d",
    "6mo": "1d",
    "1y": "1d",
    "2y": "1wk",
    "5y": "1wk",
    "max": "1mo",
}


@router.get("/chart/{ticker}")
async def chart(
    ticker: str,
    period: str = Query("1mo"),
    interval: str = Query("1d"),
):
    ticker = ticker.upper().strip()

    if period not in VALID_PERIODS:
        period = "1mo"
    if interval not in VALID_INTERVALS:
        interval = PERIOD_INTERVAL_MAP.get(period, "1d")

    data = get_history(ticker, period=period, interval=interval)
    if not data:
        raise HTTPException(status_code=404, detail=f"No chart data for {ticker}")
    return data
