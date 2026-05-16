use reqwest::Client;
use serde_json::{json, Value};
use std::time::Duration;

pub fn make_client() -> Client {
    use reqwest::header::{self, HeaderMap, HeaderValue};
    let mut headers = HeaderMap::new();
    headers.insert(
        header::USER_AGENT,
        HeaderValue::from_static(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) \
             AppleWebKit/537.36 (KHTML, like Gecko) \
             Chrome/120.0.0.0 Safari/537.36",
        ),
    );
    headers.insert(
        header::ACCEPT_LANGUAGE,
        HeaderValue::from_static("en-US,en;q=0.9"),
    );
    headers.insert(
        header::ACCEPT,
        HeaderValue::from_static("application/json"),
    );
    Client::builder()
        .default_headers(headers)
        .timeout(Duration::from_secs(12))
        .build()
        .unwrap()
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn f64_val(v: &Value) -> Option<f64> {
    match v {
        Value::Number(n) => n.as_f64(),
        Value::String(s) => s.parse().ok(),
        _ => None,
    }
}

fn get_f64(v: &Value, key: &str) -> Option<f64> {
    f64_val(v.get(key)?)
}

fn get_i64(v: &Value, key: &str) -> Option<i64> {
    v.get(key)?.as_i64()
}

fn get_str<'a>(v: &'a Value, key: &str) -> &'a str {
    v.get(key).and_then(|x| x.as_str()).unwrap_or("")
}

fn coalesce_f64(v: &Value, keys: &[&str]) -> Option<f64> {
    keys.iter().find_map(|k| get_f64(v, k))
}

fn coalesce_str<'a>(v: &'a Value, keys: &[&str]) -> &'a str {
    keys.iter()
        .find_map(|k| v.get(k).and_then(|x| x.as_str()).filter(|s| !s.is_empty()))
        .unwrap_or("")
}

// ── Yahoo Finance API calls ───────────────────────────────────────────────────

async fn chart(client: &Client, symbol: &str, interval: &str, range: &str) -> Option<Value> {
    let url = format!("https://query1.finance.yahoo.com/v8/finance/chart/{symbol}");
    let res = client
        .get(&url)
        .query(&[("interval", interval), ("range", range), ("includePrePost", "false")])
        .send()
        .await
        .ok()?;
    if !res.status().is_success() { return None; }
    let body: Value = res.json().await.ok()?;
    let results = body.get("chart")?.get("result")?.as_array()?;
    results.first().cloned()
}

async fn quote_summary(client: &Client, symbol: &str, modules: &str) -> Option<Value> {
    let url = format!("https://query1.finance.yahoo.com/v11/finance/quoteSummary/{symbol}");
    let res = client
        .get(&url)
        .query(&[("modules", modules), ("formatted", "false")])
        .send()
        .await
        .ok()?;
    if !res.status().is_success() { return None; }
    let body: Value = res.json().await.ok()?;
    let results = body.get("quoteSummary")?.get("result")?.as_array()?;
    results.first().cloned()
}

// ── Public provider methods ───────────────────────────────────────────────────

pub async fn get_quote(client: &Client, ticker: &str) -> Option<Value> {
    let result = chart(client, ticker, "1d", "5d").await?;
    let meta = result.get("meta")?;

    let price = get_f64(meta, "regularMarketPrice")?;
    let prev_close = coalesce_f64(meta, &["chartPreviousClose", "previousClose"]).unwrap_or(price);
    let change = ((price - prev_close) * 10000.0).round() / 10000.0;
    let change_pct = if prev_close != 0.0 {
        ((change / prev_close) * 1_000_000.0).round() / 10000.0
    } else { 0.0 };

    // Merge all quoteSummary modules into one flat map
    let qs = quote_summary(
        client, ticker,
        "assetProfile,defaultKeyStatistics,summaryDetail,financialData,price",
    ).await;

    let info = qs.as_ref().map(|q| {
        let mut merged = serde_json::Map::new();
        for module in &["assetProfile","defaultKeyStatistics","summaryDetail","financialData","price"] {
            if let Some(Value::Object(map)) = q.get(module) {
                merged.extend(map.clone());
            }
        }
        Value::Object(merged)
    }).unwrap_or(json!({}));

    let name = coalesce_str(&info, &["longName","shortName"]);
    let name = if name.is_empty() {
        coalesce_str(meta, &["longName","shortName"])
    } else { name };
    let name = if name.is_empty() { ticker } else { name };

    Some(json!({
        "symbol":         ticker.to_uppercase(),
        "name":           name,
        "price":          (price * 100.0).round() / 100.0,
        "change":         (change * 100.0).round() / 100.0,
        "change_pct":     (change_pct * 100.0).round() / 100.0,
        "volume":         get_i64(meta, "regularMarketVolume").or_else(|| get_i64(&info, "volume")).unwrap_or(0),
        "avg_volume":     coalesce_f64(&info, &["averageVolume","averageDailyVolume10Day"]).map(|v| v as i64).unwrap_or(0),
        "market_cap":     coalesce_f64(&info, &["marketCap"]).or_else(|| get_f64(meta, "marketCap")),
        "pe_ratio":       coalesce_f64(&info, &["trailingPE","forwardPE"]),
        "eps":            get_f64(&info, "trailingEps"),
        "week_52_high":   coalesce_f64(meta, &["fiftyTwoWeekHigh"]).or_else(|| get_f64(&info, "fiftyTwoWeekHigh")),
        "week_52_low":    coalesce_f64(meta, &["fiftyTwoWeekLow"]).or_else(|| get_f64(&info, "fiftyTwoWeekLow")),
        "dividend_yield": coalesce_f64(&info, &["dividendYield","trailingAnnualDividendYield"]),
        "beta":           get_f64(&info, "beta"),
        "sector":         get_str(&info, "sector"),
        "industry":       get_str(&info, "industry"),
        "description":    get_str(&info, "longBusinessSummary"),
        "market_status":  get_str(meta, "marketState").to_lowercase(),
        "exchange":       coalesce_str(meta, &["exchangeName","fullExchangeName"]),
        "currency":       coalesce_str(meta, &["currency"]),
    }))
}

pub async fn get_history(client: &Client, ticker: &str, period: &str, interval: &str) -> Vec<Value> {
    let result = match chart(client, ticker, interval, period).await {
        Some(r) => r,
        None => return vec![],
    };

    let timestamps = match result.get("timestamp").and_then(|t| t.as_array()) {
        Some(t) => t.clone(),
        None => return vec![],
    };

    let q = result
        .get("indicators")
        .and_then(|i| i.get("quote"))
        .and_then(|q| q.as_array())
        .and_then(|a| a.first())
        .cloned()
        .unwrap_or(json!({}));

    let empty = vec![];
    let opens   = q.get("open").and_then(|v| v.as_array()).unwrap_or(&empty);
    let highs   = q.get("high").and_then(|v| v.as_array()).unwrap_or(&empty);
    let lows    = q.get("low").and_then(|v| v.as_array()).unwrap_or(&empty);
    let closes  = q.get("close").and_then(|v| v.as_array()).unwrap_or(&empty);
    let volumes = q.get("volume").and_then(|v| v.as_array()).unwrap_or(&empty);

    let daily = matches!(interval, "1d" | "1wk" | "1mo");

    timestamps.iter().enumerate().filter_map(|(i, ts)| {
        let ts_i64 = ts.as_i64()?;
        let o = f64_val(opens.get(i)?)?;
        let h = f64_val(highs.get(i)?)?;
        let l = f64_val(lows.get(i)?)?;
        let c = f64_val(closes.get(i)?)?;
        let v = volumes.get(i).and_then(|x| x.as_i64()).unwrap_or(0);

        let time_val = if daily {
            let dt = chrono::DateTime::from_timestamp(ts_i64, 0)?;
            json!(dt.format("%Y-%m-%d").to_string())
        } else {
            json!(ts_i64)
        };

        Some(json!({
            "time":   time_val,
            "open":   (o * 10000.0).round() / 10000.0,
            "high":   (h * 10000.0).round() / 10000.0,
            "low":    (l * 10000.0).round() / 10000.0,
            "close":  (c * 10000.0).round() / 10000.0,
            "volume": v,
        }))
    }).collect()
}

pub async fn get_news(client: &Client, ticker: &str) -> Vec<Value> {
    let url = "https://query1.finance.yahoo.com/v1/finance/search";
    let res = match client
        .get(url)
        .query(&[("q", ticker), ("newsCount", "20"), ("enableFuzzyQuery", "false"), ("quotesCount", "0")])
        .send()
        .await
    {
        Ok(r) if r.status().is_success() => r,
        _ => return vec![],
    };

    let body: Value = match res.json().await {
        Ok(v) => v,
        Err(_) => return vec![],
    };

    body.get("news")
        .and_then(|n| n.as_array())
        .map(|items| {
            items.iter().map(|item| {
                let ts = item.get("providerPublishTime").and_then(|t| t.as_i64());
                let published_at = ts
                    .and_then(|t| chrono::DateTime::from_timestamp(t, 0))
                    .map(|dt| dt.format("%Y-%m-%d %H:%M").to_string())
                    .unwrap_or_default();
                json!({
                    "title":        get_str(item, "title"),
                    "publisher":    get_str(item, "publisher"),
                    "link":         get_str(item, "link"),
                    "published_at": published_at,
                    "sentiment":    null,
                })
            }).collect()
        })
        .unwrap_or_default()
}

pub async fn get_financials(client: &Client, ticker: &str, period: &str) -> Option<Value> {
    let modules = if period == "quarterly" {
        "incomeStatementHistoryQuarterly,balanceSheetHistoryQuarterly,cashflowStatementHistoryQuarterly"
    } else {
        "incomeStatementHistory,balanceSheetHistory,cashflowStatementHistory"
    };

    let qs = quote_summary(client, ticker, modules).await?;

    let extract = |section_key: &str| -> Value {
        let section = match qs.get(section_key).and_then(|s| s.as_object()) {
            Some(s) => s,
            None => return json!({}),
        };
        // Each section has one list key containing the statements
        let stmts = section.values()
            .find_map(|v| v.as_array())
            .cloned()
            .unwrap_or_default();

        let mut out = serde_json::Map::new();
        for stmt in stmts {
            let date = stmt.get("endDate")
                .and_then(|d| d.get("fmt"))
                .and_then(|f| f.as_str())
                .unwrap_or("")
                .to_string();
            if date.is_empty() { continue; }

            let mut row = serde_json::Map::new();
            if let Some(obj) = stmt.as_object() {
                for (k, v) in obj {
                    if k == "endDate" || k == "maxAge" { continue; }
                    let raw = v.get("raw").cloned().unwrap_or(v.clone());
                    row.insert(k.clone(), raw);
                }
            }
            out.insert(date, Value::Object(row));
        }
        Value::Object(out)
    };

    let (income_key, balance_key, cashflow_key) = if period == "quarterly" {
        (
            "incomeStatementHistoryQuarterly",
            "balanceSheetHistoryQuarterly",
            "cashflowStatementHistoryQuarterly",
        )
    } else {
        (
            "incomeStatementHistory",
            "balanceSheetHistory",
            "cashflowStatementHistory",
        )
    };

    Some(json!({
        "income":   extract(income_key),
        "balance":  extract(balance_key),
        "cashflow": extract(cashflow_key),
    }))
}

pub async fn get_screen(client: &Client, mode: &str) -> Vec<Value> {
    let scr_id = match mode {
        "gainers" => "day_gainers",
        "losers"  => "day_losers",
        _         => "most_actives",
    };

    let url = format!(
        "https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved\
         ?formatted=false&scrIds={scr_id}&count=25"
    );

    let res = match client.get(&url).send().await {
        Ok(r) if r.status().is_success() => r,
        _ => return vec![],
    };

    let body: Value = match res.json().await {
        Ok(v) => v,
        Err(_) => return vec![],
    };

    body.get("finance")
        .and_then(|f| f.get("result"))
        .and_then(|r| r.as_array())
        .and_then(|a| a.first())
        .and_then(|r| r.get("quotes"))
        .and_then(|q| q.as_array())
        .map(|quotes| {
            quotes.iter().map(|q| json!({
                "symbol":     get_str(q, "symbol"),
                "name":       coalesce_str(q, &["longName","shortName"]),
                "price":      get_f64(q, "regularMarketPrice"),
                "change":     get_f64(q, "regularMarketChange").map(|v| (v * 100.0).round() / 100.0),
                "change_pct": get_f64(q, "regularMarketChangePercent").map(|v| (v * 100.0).round() / 100.0),
                "volume":     get_i64(q, "regularMarketVolume"),
            })).collect()
        })
        .unwrap_or_default()
}
