mod server;
mod store;
mod world;

use std::sync::{Arc, Mutex};
use std::time::Duration;

use taixu::prelude::*;
use taixu::store::GameStore;
use tower_http::services::ServeDir;
use tower_http::trace::TraceLayer;
use tracing_subscriber::EnvFilter;

use crate::server::{AppState, now_ms, persist};
use crate::store::FileStore;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info,tower_http=warn")),
        )
        .init();

    let snapshot_path =
        std::env::var("TAIXU_SNAPSHOT").unwrap_or_else(|_| "data/tiny-planet.json".to_string());
    let store = Arc::new(FileStore::new(&snapshot_path));
    let config = GameConfig::default();

    let game = match store.load()? {
        Some(snapshot) => {
            tracing::info!(path = %snapshot_path, "restored tiny planet");
            Game::from_state(snapshot, config, Arc::new(SystemClock))
        }
        None => {
            tracing::info!(path = %snapshot_path, "growing a brand new tiny planet");
            let game = Game::with_config(config);
            world::seed_catalog(&game)?;
            game.save_to(store.as_ref())?;
            game
        }
    };

    let state = AppState {
        game: Arc::new(game),
        store,
        presence: Arc::new(Mutex::new(Default::default())),
        started_ms: now_ms(),
    };

    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(4321);

    let app = server::router(state.clone())
        .fallback_service(ServeDir::new("web").append_index_html_on_directories(true))
        .layer(TraceLayer::new_for_http());

    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port)).await?;
    tracing::info!("微光星球已上线 → http://localhost:{port}");

    let persist_state = state.clone();
    tokio::spawn(async move {
        let mut ticker = tokio::time::interval(Duration::from_secs(30));
        loop {
            ticker.tick().await;
            persist(&persist_state);
        }
    });

    let shutdown_state = state.clone();
    axum::serve(listener, app)
        .with_graceful_shutdown(async move {
            let _ = tokio::signal::ctrl_c().await;
            tracing::info!("saving tiny planet before shutdown");
            persist(&shutdown_state);
        })
        .await?;

    persist(&state);
    Ok(())
}
