from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

_analyzer = SentimentIntensityAnalyzer()


def analyze(text: str) -> str:
    """Return 'positive', 'neutral', or 'negative' for the given text."""
    if not text:
        return "neutral"
    scores = _analyzer.polarity_scores(text)
    compound = scores["compound"]
    if compound >= 0.05:
        return "positive"
    elif compound <= -0.05:
        return "negative"
    else:
        return "neutral"
