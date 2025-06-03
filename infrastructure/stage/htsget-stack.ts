import { Construct } from 'constructs';
import { Stack, StackProps } from 'aws-cdk-lib';
import { Role } from 'aws-cdk-lib/aws-iam';
import { IVpc, Vpc, VpcLookupOptions } from 'aws-cdk-lib/aws-ec2';
import { HtsgetLambda } from 'htsget-lambda';
import {
  OrcaBusApiGateway,
  OrcaBusApiGatewayProps,
} from '@orcabus/platform-cdk-constructs/api-gateway';

/**
 * Configurable props for the htsget stack.
 */
export interface HtsgetStackConfig {
  /**
   * Props to lookup vpc.
   */
  vpcProps: VpcLookupOptions;
  /**
   * API gateway construct props.
   */
  apiGatewayProps: OrcaBusApiGatewayProps;
  /**
   * The buckets to configure for htsget access.
   */
  buckets: string[];
  /**
   * The role name to use.
   */
  roleName: string;
  /**
   * Additional environment variables to pass when building htsget-rs.
   */
  buildEnvironment?: Record<string, string>;
}

/**
 * Props for the htsget stack.
 */
export type HtsgetStackProps = StackProps & HtsgetStackConfig;

/**
 * Deploys htsget-rs with access to filemanager data.
 */
export class HtsgetStack extends Stack {
  private readonly vpc: IVpc;
  private readonly apiGateway: OrcaBusApiGateway;

  constructor(scope: Construct, id: string, props: HtsgetStackProps) {
    super(scope, id, props);

    this.vpc = Vpc.fromLookup(this, 'MainVpc', props.vpcProps);
    this.apiGateway = new OrcaBusApiGateway(this, 'ApiGateway', props.apiGatewayProps);
    const role = Role.fromRoleName(this, 'Role', props.roleName);

    new HtsgetLambda(this, 'Htsget', {
      htsgetConfig: {
        environment_override: {
          HTSGET_LOCATIONS: props.buckets.map((bucket) => {
            const regex = `^${bucket}/(?P<key>.*)$`;
            const substitution_string = '$key';
            const backend = `{ kind=S3, bucket=${bucket} }`;

            return `{ regex=${regex}, substitution_string=${substitution_string}, backend=${backend} }`;
          }),
        },
      },
      buildEnvironment: props.buildEnvironment,
      cargoLambdaFlags: ['--features', 'aws'],
      vpc: this.vpc,
      role,
      httpApi: this.apiGateway.httpApi,
      gitReference: 'htsget-lambda-v0.6.0',
      gitForceClone: false,
    });
  }
}
