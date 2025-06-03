# htsget stack

This stack deploys [htsget-rs] to access files. Any files accessible by [filemanager] are also accessible using htsget.

The deployed instance of the htsget-rs can be reached using the stage at `https://htsget-file.<stage>.umccr.org`
and the orcabus API token. To retrieve the token, run:

```sh
export TOKEN=$(aws secretsmanager get-secret-value --secret-id orcabus/token-service-jwt --output json --query SecretString | jq -r 'fromjson | .id_token')
```

Then, the API can be queried:

```sh
curl -H "Authorization: Bearer $TOKEN" "https://htsget-file.dev.umccr.org/reads/service-info" | jq
```

## Development

The [`infrastructure`][infrastructure] directory contains an AWS CDK deployment of htsget-rs, and automated CI/CD pipelines. The
[`bin`][bin] directory contains the entrypoint for the CDK app, and [`test`][test] contains infrastructure tests.

The top-level project contains a Makefile for local development that can be used to build, install and lint code.

This project uses [pnpm] for development, for example, after running `pnpm install`, the CodePipeline stack can be deployed
by running `pnpm cdk-stateless deploy -e OrcaBusStatelessHtsgetStack`.

[htsget-rs]: https://github.com/umccr/htsget-rs
[filemanager]: https://github.com/OrcaBus/service-filemanager
[bin]: bin
[infrastructure]: infrastructure
[test]: test
[pnpm]: https://pnpm.io/
