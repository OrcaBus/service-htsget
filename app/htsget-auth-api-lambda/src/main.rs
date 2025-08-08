use htsget_auth::config::Config;
use htsget_auth::router::router;
use lambda_http::{run, Error};

#[tokio::main]
async fn main() ->  Result<(), Error> {
    Config::init_tracing();
    let _ = dotenvy::dotenv();

    let config = Config::load()?;
    run(router(config)).await
}
