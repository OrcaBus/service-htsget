# Htsget auth

The htsget auth service handles authorization based on the htsget-rs authorization [flow][htsget-auth].

This project is written as a [Rust][rust] workspace, and contains a Makefile to simplify development.

To get started run:

```sh
make build
```

This will compile the code using `cargo build`.

For development, it's recommended to install [sccache][sccache] to improve compilation speeds:

```sh
cargo install sccache && export RUSTC_WRAPPER=`which sccache`
```

cargo-watch can be used to recompile files as they change:

```sh
cargo install cargo-watch
make watch
```

## Linting and testing

Unit tests can be run with:

```sh
make test
```

Which runs `cargo test`. This will also launch a local postgres database for testing.

To lint the code and format it, run:

```sh
make check-fix
```

This will run `cargo clippy` and `cargo fmt`.

Testing and linting should be run before committing changes to the repository.

## Project Layout

The project is divided into crates that serve different functionality.

* [htsget-auth]: The htsget auth processing logic.
* [htsget-auth-api-lambda]: The Lambda function which responds to API Gateway requests.
* [htsget-auth-api-server]: A local server instance of the htsget-auth API.

[htsget-auth]: https://github.com/umccr/htsget-rs/tree/main/htsget-config#jwt-authorization
[rust]: https://www.rust-lang.org/tools/install
[sccache]: https://github.com/mozilla/sccache
[filemanager]: htsget-auth
[filemanager-api-lambda]: htsget-auth-api-lambda
[filemanager-api-server]: htsget-auth-api-server
