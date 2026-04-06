from fastapi import APIRouter, Query, HTTPException
from services.fetcher import get_financials

router = APIRouter()


@router.get("/financials/{ticker}")
async def financials(
    ticker: str,
    type: str = Query("income"),
    period: str = Query("annual"),
):
    ticker = ticker.upper().strip()
    period = period if period in ("annual", "quarterly") else "annual"

    data = get_financials(ticker, period=period)
    if "error" in data:
        raise HTTPException(status_code=404, detail=data["error"])

    # Return only the requested statement type
    stmt_map = {
        "income": data.get("income", {}),
        "balance": data.get("balance", {}),
        "cashflow": data.get("cashflow", {}),
    }
    stmt = stmt_map.get(type, data.get("income", {}))
    return {"type": type, "period": period, "data": stmt}
