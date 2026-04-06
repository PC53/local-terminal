from fastapi import APIRouter
from services.fetcher import get_screen_tickers

router = APIRouter()


@router.get("/screen/gainers")
async def gainers():
    return get_screen_tickers("gainers")


@router.get("/screen/losers")
async def losers():
    return get_screen_tickers("losers")


@router.get("/screen/active")
async def active():
    return get_screen_tickers("active")
