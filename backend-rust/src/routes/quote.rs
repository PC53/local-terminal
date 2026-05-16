use axum::{extract::{Path, State}, http::StatusCode, response::IntoResponse, Json};
use serde_json::json;
use std::sync::Arc;
use crate::{AppState, yahoo};

const TTL: u64 = 15;

pub async fn handler(
    State(state): State<Arc<AppState>>,
    Path(ticker): Path<String>,
) -> impl IntoResponse {
    let ticker = ticker.to_uppercase();
    let key = format!("quote:{ticker}");

    if let Some(cached) = state.cache.get(&key, TTL) {
        return (StatusCode::OK, Json(cached)).into_response();
    }

    match yahoo::get_quote(&state.client, &ticker).await {
        Some(data) => {
            state.cache.set(key, data.clone());
            (StatusCode::OK, Json(data)).into_response()
        }
        None => (
            StatusCode::NOT_FOUND,
            Json(json!({"detail": format!("No data for {ticker}. Check the ticker symbol.")})),
        ).into_response(),
    }
}
