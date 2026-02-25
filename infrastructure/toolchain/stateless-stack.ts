import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DeploymentStackPipeline } from '@orcabus/platform-cdk-constructs/deployment-stack-pipeline';
import { Pipeline } from 'aws-cdk-lib/aws-codepipeline';
import { getHtsgetProps } from '../stage/config';
import { HtsgetStack } from '../stage/htsget-stack';

/**
 * Options for configuring the stateless stack.
 */
interface StatelessStackConfig {
  /**
   * Additional build environment variables when building the Lambda function.
   */
  readonly buildEnvironment?: Record<string, string>;
}

export class StatelessStack extends cdk.Stack {
  readonly pipeline: Pipeline;

  constructor(scope: Construct, id: string, props?: cdk.StackProps & StatelessStackConfig) {
    super(scope, id, props);

    const buildSpec = {
      phases: {
        install: {
          'runtime-versions': {
            nodejs: '24.x',
          },
          commands: [
            "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y",
            'source $HOME/.cargo/env',
            'rustup component add rustfmt',
            'curl -fsSL https://cargo-lambda.info/install.sh | sh',
            "curl -L --proto '=https' --tlsv1.2 -sSf https://raw.githubusercontent.com/cargo-bins/cargo-binstall/main/install-from-binstall-release.sh | bash",
            'cargo binstall sccache',
          ],
        },
      },
      env: {
        RUSTC_WRAPPER: 'sccache',
      },
      cache: {
        paths: ['node_modules/**/*', '~/.cache/sccache', 'app/target/**/*'],
      },
    };

    const deployment = new DeploymentStackPipeline(this, 'DeploymentPipeline', {
      githubBranch: 'main',
      githubRepo: 'service-htsget',
      stack: HtsgetStack,
      stackName: 'HtsgetStack',
      stackConfig: {
        beta: {
          ...getHtsgetProps('BETA'),
          buildEnvironment: props?.buildEnvironment,
        },
        gamma: {
          ...getHtsgetProps('GAMMA'),
          buildEnvironment: props?.buildEnvironment,
        },
        prod: {
          ...getHtsgetProps('PROD'),
          buildEnvironment: props?.buildEnvironment,
        },
      },
      pipelineName: 'OrcaBus-StatelessHtsget',
      cdkSynthCmd: ['pnpm cdk-stateless synth'],
      synthBuildSpec: buildSpec,
      unitAppTestConfig: {
        command: ['cd app', 'make test'],
        partialBuildSpec: buildSpec,
      },
      unitIacTestConfig: {
        command: ['pnpm test --testPathPatterns=test/stateless'],
        partialBuildSpec: buildSpec,
      },
      cacheOptions: {
        namespace: 'htsget-stateless',
      },
    });

    this.pipeline = deployment.pipeline;
  }
}
