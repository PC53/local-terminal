const POSITIVE: &[&str] = &[
    "beat", "beats", "surge", "surges", "gain", "gains", "rise", "rises", "rises",
    "profit", "profits", "record", "growth", "strong", "upgrade", "buy", "bullish",
    "rally", "soar", "soars", "jump", "jumps", "boost", "boosted", "exceed", "exceeds",
    "outperform", "revenue", "optimistic", "positive", "opportunity", "recover",
];

const NEGATIVE: &[&str] = &[
    "miss", "misses", "fall", "falls", "drop", "drops", "loss", "losses", "weak",
    "downgrade", "sell", "bearish", "crash", "warning", "cut", "fear", "concern",
    "decline", "declines", "plunge", "plunges", "slump", "slumps", "disappoint",
    "disappoints", "risk", "recession", "layoff", "layoffs", "debt", "investigation",
];

pub fn analyze(text: &str) -> &'static str {
    let lower = text.to_lowercase();
    let pos = POSITIVE.iter().filter(|w| lower.contains(*w)).count();
    let neg = NEGATIVE.iter().filter(|w| lower.contains(*w)).count();
    if pos > neg { "positive" } else if neg > pos { "negative" } else { "neutral" }
}
