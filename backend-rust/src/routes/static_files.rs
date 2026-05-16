use axum::{
    body::Body,
    extract::Path,
    http::{header, HeaderValue, Response, StatusCode},
    response::{IntoResponse, Response as AxumResponse},
};
use std::path::PathBuf;
use tokio::fs;

fn frontend_dir() -> PathBuf {
    let exe = std::env::current_exe().unwrap_or_default();
    let candidates = [
        exe.parent().and_then(|p| p.parent()).map(|p| p.join("frontend")),
        Some(PathBuf::from("../frontend")),
        Some(PathBuf::from("frontend")),
    ];
    candidates.into_iter().flatten()
        .find(|p| p.exists())
        .unwrap_or_else(|| PathBuf::from("../frontend"))
}

async fn serve(rel_path: &str, mime: &'static str) -> AxumResponse {
    let path = frontend_dir().join(rel_path);
    match fs::read(&path).await {
        Ok(bytes) => Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, HeaderValue::from_static(mime))
            .header(header::CACHE_CONTROL, HeaderValue::from_static("no-store"))
            .body(Body::from(bytes))
            .unwrap()
            .into_response(),
        Err(_) => (StatusCode::NOT_FOUND, format!("Not found: {rel_path}")).into_response(),
    }
}

pub async fn index() -> AxumResponse {
    serve("index.html", "text/html; charset=utf-8").await
}

pub async fn style() -> AxumResponse {
    serve("style.css", "text/css").await
}

pub async fn tickers() -> AxumResponse {
    serve("tickers.json", "application/json").await
}

pub async fn app_module(Path(path): Path<String>) -> AxumResponse {
    if path.contains("..") {
        return (StatusCode::BAD_REQUEST, "Invalid path").into_response();
    }
    let mime = if path.ends_with(".js") { "application/javascript" }
        else if path.ends_with(".css") { "text/css" }
        else if path.ends_with(".json") { "application/json" }
        else { "application/octet-stream" };
    serve(&format!("app/{path}"), mime).await
}
