use axum::{extract::{Path, Query, State}, http::StatusCode, response::IntoResponse, Json};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;
use crate::{AppState, yahoo};

const TTL: u64 = 60;

const VALID_PERIODS: &[&str] = &["1d","5d","1mo","3mo","6mo","1y","2y","5y","max"];

fn default_interval(period: &str) -> &'static str {
    match period {
        "1d"  => "5m",
        "5d"  => "15m",
        "2y"  => "1wk",
        "5y"  => "1wk",
        "max" => "1mo",
        _     => "1d",
    }
}

#[derive(Deserialize)]
pub struct Params {
    period:   Option<String>,
    interval: Option<String>,
}

pub async fn handler(
    State(state): State<Arc<AppState>>,
    Path(ticker): Path<String>,
    Query(params): Query<Params>,
) -> impl IntoResponse {
    let ticker = ticker.to_uppercase();

    let period = params.period
        .filter(|p| VALID_PERIODS.contains(&p.as_str()))
        .unwrap_or_else(|| "1mo".to_string());

    let interval = params.interval
        .unwrap_or_else(|| default_interval(&period).to_string());

    let key = format!("history:{ticker}:{period}:{interval}");

    if let Some(cached) = state.cache.get(&key, TTL) {
        return (StatusCode::OK, Json(cached)).into_response();
    }

    let data = yahoo::get_history(&state.client, &ticker, &period, &interval).await;
    if data.is_empty() {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({"detail": format!("No chart data for {ticker}")})),
        ).into_response();
    }

    let val = serde_json::Value::Array(data);
    state.cache.set(key, val.clone());
    (StatusCode::OK, Json(val)).into_response()
}
