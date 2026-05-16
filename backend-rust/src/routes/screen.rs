use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use serde_json::Value;
use std::sync::Arc;
use crate::{AppState, yahoo};

const TTL: u64 = 30;

async fn screen(state: Arc<AppState>, mode: &str) -> impl IntoResponse {
    let key = format!("screen:{mode}");

    if let Some(cached) = state.cache.get(&key, TTL) {
        return (StatusCode::OK, Json(cached)).into_response();
    }

    let data = yahoo::get_screen(&state.client, mode).await;
    let val = Value::Array(data);
    state.cache.set(key, val.clone());
    (StatusCode::OK, Json(val)).into_response()
}

pub async fn active(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    screen(state, "active").await
}

pub async fn gainers(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    screen(state, "gainers").await
}

pub async fn losers(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    screen(state, "losers").await
}
