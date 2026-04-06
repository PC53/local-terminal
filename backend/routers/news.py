from fastapi import APIRouter, HTTPException
from services.fetcher import get_news
from services.sentiment import analyze

router = APIRouter()


@router.get("/news/{ticker}")
async def news(ticker: str):
    ticker = ticker.upper().strip()
    articles = get_news(ticker)
    if articles is None:
        raise HTTPException(status_code=404, detail=f"No news for {ticker}")

    # Apply sentiment to each title
    for article in articles:
        article["sentiment"] = analyze(article.get("title", ""))

    return articles
