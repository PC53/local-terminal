pub mod quote;
pub mod chart;
pub mod news;
pub mod financials;
pub mod screen;
pub mod static_files;

use axum::{Json, response::IntoResponse};
use serde_json::json;
use crate::AppState;
use std::sync::Arc;
use axum::extract::State;

pub async fn health(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let _ = state;
    Json(json!({"status": "ok", "provider": "yahoo"}))
}
