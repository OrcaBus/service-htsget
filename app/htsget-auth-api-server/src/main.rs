use lambda_http::Error;
use htsget_auth::config::Config;

#[tokio::main]
async fn main() -> Result<(), Error> {
    Config::init_tracing();
    let _ = dotenvy::dotenv();

    let config = Config::load()?;

    Ok(())
}
