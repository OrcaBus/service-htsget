import { Construct } from 'constructs';
import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { ManagedPolicy, Role } from 'aws-cdk-lib/aws-iam';
import { IVpc, SubnetType, Vpc, VpcLookupOptions } from 'aws-cdk-lib/aws-ec2';
import { HtsgetLambda } from 'htsget-lambda';
import {
  DEFAULT_COGNITO_USER_POOL_ID_PARAMETER_NAME,
  OrcaBusApiGateway,
  OrcaBusApiGatewayProps,
} from '@orcabus/platform-cdk-constructs/api-gateway';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import path from 'path';
import { spawnSync } from 'node:child_process';
import { RustFunction } from 'cargo-lambda-cdk';
import { Architecture } from 'aws-cdk-lib/aws-lambda';
import { NamedLambdaRole } from '@orcabus/platform-cdk-constructs/named-lambda-role';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import {
  HttpMethod,
  HttpNoneAuthorizer,
  HttpRoute,
  HttpRouteKey,
} from 'aws-cdk-lib/aws-apigatewayv2';

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
  /**
   * API gateway props for configuring the htsget-auth function.
   */
  apiGatewayCognitoProps: OrcaBusApiGatewayProps;
}

/**
 * Props for the htsget stack.
 */
export type HtsgetStackProps = StackProps & HtsgetStackConfig;

/**
 * Deploys htsget-rs and the htsget-auth service with access to filemanager data.
 */
export class HtsgetStack extends Stack {
  private readonly vpc: IVpc;
  private readonly apiGateway: OrcaBusApiGateway;

  constructor(scope: Construct, id: string, props: HtsgetStackProps) {
    super(scope, id, props);

    this.vpc = Vpc.fromLookup(this, 'MainVpc', props.vpcProps);
    this.apiGateway = new OrcaBusApiGateway(this, 'ApiGateway', props.apiGatewayProps);
    const userPoolIdParam = StringParameter.fromStringParameterName(
      this,
      'CognitoUserPoolIdParameter',
      DEFAULT_COGNITO_USER_POOL_ID_PARAMETER_NAME
    );

    if (props.apiGatewayProps.cognitoClientIdParameterNameArray === undefined) {
      throw new Error('no cient id parameters');
    }
    const audience = props.apiGatewayProps.cognitoClientIdParameterNameArray.map(
      (name) =>
        StringParameter.fromStringParameterName(this, `CognitoClientId${name}Parameter`, name)
          .stringValue
    );
    const issuer = `https://cognito-idp.${this.region}.amazonaws.com/${userPoolIdParam.stringValue}`;

    const authUrl = this.htsGetAuthFunction(props, issuer, audience);
    this.htsGetServerFunction(props, issuer, audience, authUrl);
  }

  private htsGetAuthFunction(props: HtsgetStackProps, issuer: string, audience: string[]): string {
    const htsgetAuthRole = new NamedLambdaRole(this, 'Role');
    htsgetAuthRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')
    );

    const manifestPath = path.join(__dirname, '..', '..', 'app');
    const defaultTarget = spawnSync('rustc', ['--version', '--verbose'])
      .stdout.toString()
      .split(/\r?\n/)
      .find((line) => line.startsWith('host:'))
      ?.replace('host:', '')
      .trim();
    const htsgetAuthFunction = new RustFunction(this, 'HtsGetAuthFunction', {
      manifestPath: manifestPath,
      binaryName: 'htsget-auth-api-lambda',
      bundling: {
        environment: {
          ...props.buildEnvironment,
        },
        ...(defaultTarget === 'aarch64-unknown-linux-gnu' && {
          cargoLambdaFlags: ['--compiler', 'cargo'],
        }),
      },
      memorySize: 128,
      timeout: Duration.seconds(28),
      environment: {
        HTSGET_AUTH_JWKS_URL: `${issuer}/.well-known/jwks.json`,
        HTSGET_AUTH_VALIDATE_AUDIENCE: audience.join(','),
        HTSGET_AUTH_VALIDATE_ISSUER: issuer,
        RUST_LOG: `info,htsget_auth_api_lambda=trace,htsget_auth=trace`,
      },
      architecture: Architecture.ARM_64,
      role: htsgetAuthRole,
      vpc: this.vpc,
      vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
    });

    const apiGateway = new OrcaBusApiGateway(this, 'ApiGateway', props.apiGatewayCognitoProps);
    const httpApi = apiGateway.httpApi;
    const integration = new HttpLambdaIntegration('ApiIntegration', htsgetAuthFunction);
    new HttpRoute(this, 'GetSchemaHttpRoute', {
      httpApi,
      integration,
      authorizer: new HttpNoneAuthorizer(),
      routeKey: HttpRouteKey.with(`/schema/{proxy+}`, HttpMethod.GET),
    });
    new HttpRoute(this, 'GetHttpRoute', {
      httpApi,
      integration,
      routeKey: HttpRouteKey.with('/{proxy+}', HttpMethod.GET),
    });

    return `${apiGateway.domainName}/api/v1/auth`;
  }

  private htsGetServerFunction(
    props: HtsgetStackProps,
    issuer: string,
    audience: string[],
    auth_url: string
  ) {
    const role = Role.fromRoleName(this, 'Role', props.roleName);

    new HtsgetLambda(this, 'HtsGetServer', {
      htsgetConfig: {
        environment_override: {
          HTSGET_LOCATIONS: props.buckets.map((bucket) => {
            const regex = `^${bucket}/(?P<key>.*)$`;
            const substitution_string = '$key';
            const backend = `{ kind=S3, bucket=${bucket} }`;

            return `{ regex=${regex}, substitution_string=${substitution_string}, backend=${backend} }`;
          }),
          HTSGET_AUTH_JWKS_URL: `${issuer}/.well-known/jwks.json`,
          HTSGET_AUTH_VALIDATE_AUDIENCE: audience.join(','),
          HTSGET_AUTH_VALIDATE_ISSUER: issuer,
          HTSGET_AUTH_TRUSTED_AUTHORIZATION_URLS: auth_url,
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
