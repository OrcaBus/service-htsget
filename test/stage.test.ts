import { App, Aspects } from 'aws-cdk-lib';
import { Annotations, Match } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks } from 'cdk-nag';
import { getHtsgetProps } from '../infrastructure/stage/config';
import { HtsgetStack } from '../infrastructure/stage/htsget-stack';
import { synthesisMessageToString } from '@orcabus/platform-cdk-constructs/utils';

describe('cdk-nag-stateless-toolchain-stack', () => {
  const app = new App();

  const htsgetStack = new HtsgetStack(app, 'HtsgetStack', {
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
});
