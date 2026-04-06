from fastapi import APIRouter, HTTPException
from services.fetcher import get_quote

router = APIRouter()


@router.get("/quote/{ticker}")
async def quote(ticker: str):
    ticker = ticker.upper().strip()
    data = get_quote(ticker)
    if "error" in data:
        raise HTTPException(status_code=404, detail=data["error"])
    return data
