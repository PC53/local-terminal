use axum::{extract::{Path, Query, State}, http::StatusCode, response::IntoResponse, Json};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;
use crate::{AppState, yahoo};

const TTL: u64 = 3600;

#[derive(Deserialize)]
pub struct Params {
    #[serde(rename = "type")]
    stmt_type: Option<String>,
    period: Option<String>,
}

pub async fn handler(
    State(state): State<Arc<AppState>>,
    Path(ticker): Path<String>,
    Query(params): Query<Params>,
) -> impl IntoResponse {
    let ticker = ticker.to_uppercase();
    let period = match params.period.as_deref() {
        Some("quarterly") => "quarterly",
        _ => "annual",
    };
    let stmt_type = params.stmt_type.unwrap_or_else(|| "income".to_string());

    let key = format!("financials:{ticker}:{period}");

    let full = if let Some(cached) = state.cache.get(&key, TTL) {
        cached
    } else {
        match yahoo::get_financials(&state.client, &ticker, period).await {
            Some(data) => {
                state.cache.set(key, data.clone());
                data
            }
            None => return (
                StatusCode::NOT_FOUND,
                Json(json!({"detail": format!("Could not fetch financials for {ticker}")})),
            ).into_response(),
        }
    };

    let stmt = full.get(stmt_type.as_str())
        .cloned()
        .unwrap_or_else(|| full.get("income").cloned().unwrap_or(json!({})));

    (StatusCode::OK, Json(json!({
        "type":   stmt_type,
        "period": period,
        "data":   stmt,
    }))).into_response()
}
