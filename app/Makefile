.EXPORT_ALL_VARIABLES:

## Default target
default: help

install: build
all: build

## Build related commands
build:
	@cargo build --all-features --all-targets
watch:
	@cargo watch -w *.toml -w *.rs
test:
	@cargo test --all-features --all-targets
lint:
	@cargo fmt --check
lint-fix:
	@cargo fmt
clippy:
	@cargo clippy --all-targets --all-features
check: lint clippy
check-fix: lint-fix clippy
fix: check-fix

## Clean
clean:
	@cargo clean && rm -rf target*

## Local API server.
start:
	@cargo run -p htsget-auth-api-server $(ARGS)

## Help text
help:
	@printf "The htsget-auth Makefile.\n\n"
	@printf "Usage: make <target> [DATABASE_URL=<database_url>]\n"

# No targets are files, so they are all PHONY.
.PHONY: *
