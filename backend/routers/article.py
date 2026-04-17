from fastapi import APIRouter, Query, HTTPException
from urllib.parse import urlparse
import requests
from bs4 import BeautifulSoup

from services.http import make_session

router = APIRouter()

# ── Sessions ──────────────────────────────────────────────────────────────────
# We maintain a general session for article scraping and a Yahoo-specific one
# with a pre-accepted consent cookie so we don't land on the consent wall.

_BROWSER_EXTRA = {
    "Accept-Encoding":  "gzip, deflate, br",
    "Cache-Control":    "no-cache",
    "Sec-Fetch-Dest":   "document",
    "Sec-Fetch-Mode":   "navigate",
    "Sec-Fetch-Site":   "none",
}

_HTML_ACCEPT = "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"

_session       = make_session(_HTML_ACCEPT, extra=_BROWSER_EXTRA)
_yahoo_session = make_session(
    _HTML_ACCEPT,
    extra={**_BROWSER_EXTRA, "Cookie": "GUC=AQEEAfEAZgBnAf0; eucs_cp=10"},
)


def _get_session(url: str) -> requests.Session:
    host = urlparse(url).hostname or ""
    return _yahoo_session if "yahoo.com" in host else _session


# ── Helpers ───────────────────────────────────────────────────────────────────

def _og(soup: BeautifulSoup, prop: str) -> str:
    tag = (
        soup.find("meta", property=f"og:{prop}") or
        soup.find("meta", property=f"twitter:{prop}") or
        soup.find("meta", attrs={"name": f"og:{prop}"}) or
        soup.find("meta", attrs={"name": f"twitter:{prop}"})
    )
    return (tag.get("content") or "").strip() if tag else ""


# Known consent/block page indicators — if we land on these, body extraction is pointless
_BLOCK_SIGNALS = (
    "consent.yahoo.com",
    "your privacy choices",
    "we use cookies",
    "cookie settings",
    "gdpr",
    "enable javascript",
    "access denied",
)


def _is_blocked(final_url: str, title: str) -> bool:
    url_lower   = final_url.lower()
    title_lower = title.lower()
    return any(s in url_lower or s in title_lower for s in _BLOCK_SIGNALS)


def _extract_body(soup: BeautifulSoup) -> list[str]:
    """Best-effort article body extraction. Returns list of paragraph strings."""
    for tag in soup(["script", "style", "nav", "header", "footer",
                     "aside", "iframe", "noscript", "form", "figure",
                     "button", "label", "input"]):
        tag.decompose()

    # Priority-order content containers
    content = (
        soup.find("article") or
        soup.find(attrs={"id": lambda v: v and any(
            k in v.lower() for k in ("article-body", "article_body", "articlebody", "story"))}) or
        soup.find(attrs={"class": lambda v: v and any(
            k in " ".join(v).lower() for k in (
                "article-body", "story-body", "post-body", "entry-content",
                "article__body", "caas-body", "body__inner",
            ))}) or
        soup.find("main") or
        soup.find("body")
    )

    paragraphs = []
    if content:
        for p in content.find_all("p"):
            text = p.get_text(" ", strip=True)
            if len(text) > 80 and not any(k in text.lower() for k in (
                "cookie", "subscribe", "sign up", "sign in", "log in",
                "newsletter", "javascript", "enable cookies",
                "terms of service", "privacy policy", "all rights reserved",
            )):
                paragraphs.append(text)
    return paragraphs[:25]


# ── Route ─────────────────────────────────────────────────────────────────────

@router.get("/article/preview")
async def article_preview(url: str = Query(..., description="Article URL to fetch")):
    session = _get_session(url)
    try:
        r = session.get(url, timeout=12, allow_redirects=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not fetch URL: {e}")

    if not r.ok:
        raise HTTPException(status_code=400, detail=f"HTTP {r.status_code} from source")

    try:
        soup = BeautifulSoup(r.text, "lxml")
    except Exception:
        soup = BeautifulSoup(r.text, "html.parser")

    title       = _og(soup, "title") or (soup.title.get_text(strip=True) if soup.title else "")
    description = _og(soup, "description")
    image       = _og(soup, "image")
    site_name   = _og(soup, "site_name") or ""

    # Detect consent/block walls — still return metadata, just no body
    blocked    = _is_blocked(r.url, title)
    paragraphs = [] if blocked else _extract_body(soup)

    return {
        "title":       title,
        "description": description,
        "image":       image,
        "site_name":   site_name,
        "url":         url,
        "paragraphs":  paragraphs,
        "blocked":     blocked,   # hint to the frontend to show "open in browser" prominently
    }
