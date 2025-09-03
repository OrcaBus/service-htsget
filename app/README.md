# Htsget auth

The htsget auth service handles authorization based on the htsget-rs authorization [flow][htsget-auth].

This is a service that reads `Cognito` JWT tokens and chooses a htsget-rs restriction based on the group that
the user is in. Currently the following regions are allowed to be viewed for the `curators` group and everything
else is disallowed:

https://asia.ensembl.org/Homo_sapiens/Gene/Summary?db=core;g=ENSG00000198804;r=MT:5874-7475;t=ENST00000361624
https://asia.ensembl.org/Homo_sapiens/Gene/Summary?db=core;g=ENSG00000133703;r=12:25205246-25250936
https://asia.ensembl.org/Homo_sapiens/Gene/Summary?db=core;g=ENSG00000139618;r=13:32315086-32400268
https://asia.ensembl.org/Homo_sapiens/Gene/Summary?db=core;g=ENSG00000012048;r=17:43044292-43170245

All other users can view any part of a file. Currently, these are just hard-coded example values, and would
change based on real requirements.

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
