"""
Provider registry.

To swap providers, set the DATA_PROVIDER environment variable:
  DATA_PROVIDER=yahoo     (default, no key needed)
  DATA_PROVIDER=finnhub   (needs FINNHUB_API_KEY)
  DATA_PROVIDER=polygon   (needs POLYGON_API_KEY)
  DATA_PROVIDER=alpaca    (needs ALPACA_API_KEY + ALPACA_API_SECRET)

Providers are imported lazily so a missing API key only raises when that
provider is actually selected, not at import time.
"""
from __future__ import annotations
from .base import DataProvider

_REGISTRY: dict[str, str] = {
    "yahoo":   "services.providers.yahoo.YahooProvider",
    "finnhub": "services.providers.finnhub.FinnhubProvider",
    "polygon": "services.providers.polygon.PolygonProvider",
    "alpaca":  "services.providers.alpaca.AlpacaProvider",
}


def get_provider(name: str) -> DataProvider:
    """Return an initialised provider instance by name."""
    dotted = _REGISTRY.get(name.lower())
    if not dotted:
        available = list(_REGISTRY)
        raise ValueError(f"Unknown provider '{name}'. Available: {available}")

    module_path, class_name = dotted.rsplit(".", 1)
    import importlib
    module = importlib.import_module(module_path)
    cls = getattr(module, class_name)
    return cls()


def available_providers() -> list[str]:
    return list(_REGISTRY)
