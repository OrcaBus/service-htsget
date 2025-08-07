use htsget_auth::config::Config;
use htsget_auth::error::Result;

#[tokio::main]
async fn main() -> Result<()> {
    Config::init_tracing();
    let _ = dotenvy::dotenv();

    let config = Config::load()?;

    Ok(())
}
