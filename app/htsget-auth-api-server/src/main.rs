use std::io;
use axum::serve;
use clap::Parser;
use http::Uri;
use tokio::net::TcpListener;
use tracing::info;
use htsget_auth::config::Config;
use htsget_auth::router::{router, SWAGGER_UI_PATH};
use htsget_auth::error::Result;

/// Run the htsget auth API server locally to explore the API.
#[derive(Parser, Debug)]
#[command(version, about, long_about = None)]
struct Args {
    /// The address to run the server at.
    #[arg(short, long, default_value = "0.0.0.0:8000", env)]
    api_server_addr: String,
}

#[tokio::main]
async fn main() -> Result<()> {
    Config::init_tracing();
    let _ = dotenvy::dotenv();

    let args = Args::parse();
    let config = Config::load()?;

    let app = router(config);
    let listener = TcpListener::bind(args.api_server_addr).await?;

    let local_addr = listener.local_addr()?;
    info!("listening on {}", listener.local_addr()?);

    let docs = Uri::builder()
        .scheme("http")
        .authority(local_addr.to_string())
        .path_and_query(SWAGGER_UI_PATH)
        .build()
        .map_err(io::Error::other)?;

    info!("OpenAPI docs at {}", docs);

    Ok(serve(listener, app).await?)}
