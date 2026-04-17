from fastapi import APIRouter, Query, HTTPException
import requests

router = APIRouter()

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
}

_session = requests.Session()
_session.headers.update(_HEADERS)


@router.get("/search")
async def symbol_search(q: str = Query(..., min_length=1)):
    """Proxy Yahoo Finance symbol search to avoid CORS."""
    try:
        r = _session.get(
            "https://query1.finance.yahoo.com/v1/finance/search",
            params={"q": q, "quotesCount": 8, "newsCount": 0, "listsCount": 0},
            timeout=5,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not r.ok:
        raise HTTPException(status_code=r.status_code, detail="Yahoo search failed")

    data = r.json()
    quotes = data.get("quotes", [])
    results = []
    for item in quotes:
        symbol = item.get("symbol", "")
        name   = item.get("shortname") or item.get("longname") or ""
        qtype  = item.get("quoteType", "")
        exch   = item.get("exchDisp") or item.get("exchange") or ""
        if symbol:
            results.append({"symbol": symbol, "name": name, "type": qtype, "exchange": exch})

    return {"results": results}
