"""
Shared HTTP session factory.

All outbound HTTP calls in this app pretend to be a normal desktop Chrome
browser — several data sources (notably Yahoo) serve very different responses
to bare `python-requests` UAs (403s, consent walls, empty bodies).

Callers supply the Accept header for their media type (JSON for APIs, HTML
for article scraping) and any extra headers they need.
"""
import requests

_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)

_BASE_HEADERS = {
    "User-Agent":      _USER_AGENT,
    "Accept-Language": "en-US,en;q=0.9",
}


def make_session(accept: str, extra: dict | None = None) -> requests.Session:
    """
    Returns a fresh requests.Session with browser-ish defaults.

    - accept: value for the Accept header (e.g. "application/json", "text/html,...")
    - extra:  additional headers to merge in (e.g. a pre-accepted Cookie)
    """
    s = requests.Session()
    s.headers.update({**_BASE_HEADERS, "Accept": accept, **(extra or {})})
    return s
