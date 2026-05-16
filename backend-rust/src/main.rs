mod cache;
mod sentiment;
mod yahoo;
mod routes;

use std::sync::Arc;
use axum::{Router, routing::get};
use tower_http::cors::CorsLayer;

pub struct AppState {
    pub client: reqwest::Client,
    pub cache:  cache::Cache,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()))
        .init();

    let port = std::env::var("PORT").unwrap_or_else(|_| "8000".to_string());
    let addr = format!("0.0.0.0:{port}");

    let state = Arc::new(AppState {
        client: yahoo::make_client(),
        cache:  cache::Cache::new(),
    });

    let app = Router::new()
        // Health
        .route("/health", get(routes::health))
        // API
        .route("/api/quote/:ticker",      get(routes::quote::handler))
        .route("/api/chart/:ticker",      get(routes::chart::handler))
        .route("/api/news/:ticker",       get(routes::news::handler))
        .route("/api/financials/:ticker", get(routes::financials::handler))
        .route("/api/screen/active",      get(routes::screen::active))
        .route("/api/screen/gainers",     get(routes::screen::gainers))
        .route("/api/screen/losers",      get(routes::screen::losers))
        // Static
        .route("/",              get(routes::static_files::index))
        .route("/style.css",     get(routes::static_files::style))
        .route("/tickers.json",  get(routes::static_files::tickers))
        .route("/app/*path",     get(routes::static_files::app_module))
        // CORS + state
        .layer(CorsLayer::permissive())
        .with_state(state);

    tracing::info!("Listening on http://{addr}");
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
