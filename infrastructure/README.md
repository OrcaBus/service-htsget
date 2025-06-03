# CDK constructs for htsget

This folder contains CDK stack which deploys htsget-rs.

### Building

Note, this stack compiles code using [`cargo-lambda`][cargo-lambda] locally if it is installed, otherwise it compiles
code inside a docker function. The htsget construct uses `RustFunction` underneath. The compiled code is then used by
CDK to run the Lambda function natively (i.e. this only does a docker build, not docker-based runtime). For
compilation speeds, it's recommended to use local compilation if possible.

[cargo-lambda]: https://www.cargo-lambda.info/
