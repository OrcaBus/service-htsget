The htsget service
--------------------------------------------------------------------------------

This service deploys [htsget-rs] to access files. Any files accessible by [filemanager] are also accessible using htsget.

[htsget-rs]: https://github.com/umccr/htsget-rs
[filemanager]: https://github.com/OrcaBus/service-filemanager

### Responsibility

The htsget service is responsible for serving files using the [htsget] protocol, having the same access to files as the
filemanager.

### API Endpoints

The deployed instance of the htsget-rs can be reached using the stage at `https://htsget-file.<stage>.umccr.org`
and the orcabus API token. To retrieve the token, run:

```sh
export TOKEN=$(aws secretsmanager get-secret-value --secret-id orcabus/token-service-jwt --output json --query SecretString | jq -r 'fromjson | .id_token')
```

Then, the API can be queried:

```sh
curl -H "Authorization: Bearer $TOKEN" "https://htsget-file.dev.umccr.org/reads/service-info" | jq
```

For each current object returned by the filemanager, it can be reached via htsget by combining the key and the
bucket in the query path:

```sh
curl -H "Authorization: Bearer $TOKEN" "https://htsget-file.dev.umccr.org/reads/<filemanager_bucket>/<filemanager_key>" | jq
```

The see the full [specification][htsget] of the htsget protocol, including available API parameters and endpoints for more information.

[htsget]: https://samtools.github.io/hts-specs/htsget.html

### Permissions & Access Control

The htsget service requires access to the same files as the filemanager. The current deployment uses the filemanager's
ingest role.

### Change Management

This service employs a fully automated CI/CD pipeline that automatically builds and releases all changes to the `main`
code branch.

There are no automated changelogs or releases, however semantic versioning is followed for any manual release, and
[conventional commits][conventional-commits] are used for future automation.

[conventional-commits]: https://www.conventionalcommits.org/en/v1.0.0/

Infrastructure & Deployment
--------------------------------------------------------------------------------

This is a stateless-only service that consists of a simple Lambda function that responds to API Gateway requests.
The Lambda function uses the [`HtsgetLambda`][htsget-deploy] construct to deploy the service.

[htsget-deploy]: https://github.com/umccr/htsget-deploy

### CDK Commands

You can access CDK commands using the `pnpm` wrapper script.

- **`cdk-stateless`**: Used to deploy stacks containing stateless resources (e.g., AWS Lambda), which can be easily redeployed without side effects.

The type of stack to deploy is determined by the context set in the `./bin/deploy.ts` file. This ensures the correct stack is executed based on the provided context.

For example:

```sh
# Deploy a stateless stack
pnpm cdk-stateless <command>
```

### Stacks

This CDK project manages multiple stacks. The root stack (the only one that does not include `DeploymentPipeline` in its stack ID)
is deployed in the toolchain account and sets up a CodePipeline for cross-environment deployments to `beta`, `gamma`, and `prod`.

To list all available stacks, run:

```sh
pnpm cdk-stateless ls
```

Output:

```sh
OrcaBusStatelessHtsgetStack
OrcaBusStatelessHtsgetStack/DeploymentPipeline/OrcaBusBeta/HtsgetStack (OrcaBusBeta-HtsgetStack)
OrcaBusStatelessHtsgetStack/DeploymentPipeline/OrcaBusGamma/HtsgetStack (OrcaBusGamma-HtsgetStack)
OrcaBusStatelessHtsgetStack/DeploymentPipeline/OrcaBusProd/HtsgetStack (OrcaBusProd-HtsgetStack)
```

Development
--------------------------------------------------------------------------------

### Project Structure

The root of the project is an AWS CDK project which contains the `HtsgetLambda` stack.

The project is organized into the following directories:

- **`./bin/deploy.ts`**: Serves as the entry point of the application. It initializes the `stateless` stacks.

- **`./infrastructure`**: Contains the infrastructure code for the project:
    - **`./infrastructure/toolchain`**: Includes stacks for the stateless resources deployed in the toolchain account. These stacks set up the CodePipeline for cross-environment deployments.
    - **`./infrastructure/stage`**: Defines the stage stacks for different environments:
        - **`./infrastructure/stage/config.ts`**: Contains environment-specific configuration files (e.g., `beta`, `gamma`, `prod`).
        - **`./infrastructure/stage/htsget-stack.ts`**: The CDK stack entry point for provisioning resources required by the application in `./app`.

- **`.github/workflows/pr-tests.yml`**: Configures GitHub Actions to run tests for `make check` (linting and code style) and tests defined in `./test`.

- **`./test`**: Contains tests for CDK code compliance against `cdk-nag`.

### Setup

This project requires nodejs and uses [pnpm] as the package manager.

```sh
node --version
v22.9.0

# Update Corepack (if necessary, as per pnpm documentation)
npm install --global corepack@latest

# Enable Corepack to use pnpm
corepack enable pnpm

```

[pnpm]: https://pnpm.io/

#### Install Dependencies

To install all required dependencies, run:

```sh
make install
```

### Linting & Formatting

Automated checks are enforced via pre-commit hooks, ensuring only checked code is committed. For details see the `.pre-commit-config.yaml` file.

Manual, on-demand checking is also available via `make` targets (see below). For details see the `Makefile` in the root of the project.

To run linting and formatting checks on the root project, use:

```sh
make check
```

To automatically fix issues with ESLint and Prettier, run:

```sh
make fix
```

### Testing

Run the cdk-nag tests using:

```sh
make test
```
