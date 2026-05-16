use axum::{extract::{Path, State}, http::StatusCode, response::IntoResponse, Json};
use serde_json::{json, Value};
use std::sync::Arc;
use crate::{AppState, yahoo, sentiment};

const TTL: u64 = 120;

pub async fn handler(
    State(state): State<Arc<AppState>>,
    Path(ticker): Path<String>,
) -> impl IntoResponse {
    let ticker = ticker.to_uppercase();
    let key = format!("news:{ticker}");

    if let Some(cached) = state.cache.get(&key, TTL) {
        return (StatusCode::OK, Json(cached)).into_response();
    }

    let mut articles = yahoo::get_news(&state.client, &ticker).await;

    // Attach sentiment to each article title
    for article in &mut articles {
        if let Some(obj) = article.as_object_mut() {
            let title = obj.get("title")
                .and_then(|t| t.as_str())
                .unwrap_or("")
                .to_string();
            obj.insert("sentiment".to_string(), json!(sentiment::analyze(&title)));
        }
    }

    let val = Value::Array(articles);
    state.cache.set(key, val.clone());
    (StatusCode::OK, Json(val)).into_response()
}
