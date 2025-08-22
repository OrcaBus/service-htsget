import { App, Aspects } from 'aws-cdk-lib';
import { Annotations, Match } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag';
import { getHtsgetProps } from '../infrastructure/stage/config';
import { HtsgetStack } from '../infrastructure/stage/htsget-stack';
import { synthesisMessageToString } from '@orcabus/platform-cdk-constructs/utils';
import { StatelessStack } from '../infrastructure/toolchain/stateless-stack';

describe('cdk-nag-stateless-toolchain-stack', () => {
  const stackApp = new App();

  const htsgetStack = new HtsgetStack(stackApp, 'HtsgetStack', {
    ...getHtsgetProps('PROD'),
    env: {
      account: '123456789',
      region: 'ap-southeast-2',
    },
    buildEnvironment: {
      // Need to have a separate build directory to the toolchain test to avoid concurrent build errors.
      CARGO_TARGET_DIR: 'target-stage-test',
    },
  });

  Aspects.of(htsgetStack).add(new AwsSolutionsChecks());
  NagSuppressions.addStackSuppressions(
    htsgetStack,
    [{ id: 'AwsSolutions-IAM4', reason: 'allow AWS managed policy' }],
    true
  );
  NagSuppressions.addResourceSuppressionsByPath(
    htsgetStack,
    '/HtsgetStack/GetSchemaHttpRoute/Resource',
    [
      {
        id: 'AwsSolutions-APIG4',
        reason: 'we have the default Cognito UserPool authorizer',
      },
    ],
    true
  );

  test(`cdk-nag AwsSolutions Pack errors`, () => {
    const errors = Annotations.fromStack(htsgetStack)
      .findError('*', Match.stringLikeRegexp('AwsSolutions-.*'))
      .map(synthesisMessageToString);
    expect(errors).toHaveLength(0);
  });

  test(`cdk-nag AwsSolutions Pack warnings`, () => {
    const warnings = Annotations.fromStack(htsgetStack)
      .findWarning('*', Match.stringLikeRegexp('AwsSolutions-.*'))
      .map(synthesisMessageToString);
    expect(warnings).toHaveLength(0);
  });

  const toolchainApp = new App({});

  const statelessStack = new StatelessStack(toolchainApp, 'StatelessStack', {
    env: {
      account: '123456789',
      region: 'ap-southeast-2',
    },
    buildEnvironment: {
      // Need to have a separate build directory to the stage test to avoid concurrent build errors.
      CARGO_TARGET_DIR: 'target-toolchain-test',
    },
  });

  Aspects.of(statelessStack).add(new AwsSolutionsChecks());

  NagSuppressions.addStackSuppressions(statelessStack, [
    { id: 'AwsSolutions-IAM5', reason: 'Allow CDK Pipeline' },
    { id: 'AwsSolutions-S1', reason: 'Allow CDK Pipeline' },
    { id: 'AwsSolutions-KMS5', reason: 'Allow CDK Pipeline' },
  ]);

  test(`cdk-nag AwsSolutions Pack errors`, () => {
    const errors = Annotations.fromStack(statelessStack)
      .findError('*', Match.stringLikeRegexp('AwsSolutions-.*'))
      .map(synthesisMessageToString);
    expect(errors).toHaveLength(0);
  });

  test(`cdk-nag AwsSolutions Pack warnings`, () => {
    const warnings = Annotations.fromStack(statelessStack)
      .findWarning('*', Match.stringLikeRegexp('AwsSolutions-.*'))
      .map(synthesisMessageToString);
    expect(warnings).toHaveLength(0);
  });
});
