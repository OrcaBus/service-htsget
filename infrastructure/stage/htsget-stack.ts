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
import { IStringParameter, StringParameter } from 'aws-cdk-lib/aws-ssm';
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
  apiGatewayHtsgetProps: OrcaBusApiGatewayProps;
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
  apiGatewayAuthProps: OrcaBusApiGatewayProps;
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

  constructor(scope: Construct, id: string, props: HtsgetStackProps) {
    super(scope, id, props);

    this.vpc = Vpc.fromLookup(this, 'MainVpc', props.vpcProps);
    const userPoolIdParam = StringParameter.fromStringParameterName(
      this,
      'CognitoUserPoolIdParameter',
      DEFAULT_COGNITO_USER_POOL_ID_PARAMETER_NAME
    );

    const authUrl = this.htsGetAuthFunction(props, userPoolIdParam);
    this.htsGetServerFunction(props, authUrl, userPoolIdParam);
  }

  private formatAudienceAndIssuer(
    id: string,
    props: OrcaBusApiGatewayProps,
    userPoolIdParam: IStringParameter
  ): [string[], string] {
    const audience = props.cognitoClientIdParameterNameArray.map(
      (name) =>
        StringParameter.fromStringParameterName(this, `${id}CognitoClientId${name}Parameter`, name)
          .stringValue
    );
    const issuer = `https://cognito-idp.${this.region}.amazonaws.com/${userPoolIdParam.stringValue}`;

    return [audience, issuer];
  }

  private cargoLambdaFlags(): string[] {
    const defaultTarget = spawnSync('rustc', ['--version', '--verbose'])
      .stdout.toString()
      .split(/\r?\n/)
      .find((line) => line.startsWith('host:'))
      ?.replace('host:', '')
      .trim();

    const flags = ['--features', 'aws', '--features', 'experimental'];
    if (defaultTarget === 'aarch64-unknown-linux-gnu') {
      return [...flags, '--compiler', 'cargo'];
    } else {
      return flags;
    }
  }

  private htsGetAuthFunction(props: HtsgetStackProps, userPoolIdParam: IStringParameter): string {
    const htsgetAuthRole = new NamedLambdaRole(this, 'HtsGetAuthRole');
    htsgetAuthRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')
    );

    const [audience, issuer] = this.formatAudienceAndIssuer(
      'HtsGetAuth',
      props.apiGatewayHtsgetProps,
      userPoolIdParam
    );

    const manifestPath = path.join(__dirname, '..', '..', 'app');
    const htsgetAuthFunction = new RustFunction(this, 'HtsGetAuthFunction', {
      manifestPath: manifestPath,
      binaryName: 'htsget-auth-api-lambda',
      bundling: {
        environment: {
          ...props.buildEnvironment,
        },
        cargoLambdaFlags: this.cargoLambdaFlags(),
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

    const apiGateway = new OrcaBusApiGateway(this, 'ApiGateway', props.apiGatewayAuthProps);
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
    auth_url: string,
    userPoolIdParam: IStringParameter
  ) {
    const role = Role.fromRoleName(this, 'Role', props.roleName);

    const apiGateway = new OrcaBusApiGateway(
      this,
      'HtsGetAuthApiGateway',
      props.apiGatewayHtsgetProps
    );
    const [audience, issuer] = this.formatAudienceAndIssuer(
      'HtsGet',
      props.apiGatewayHtsgetProps,
      userPoolIdParam
    );
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
          HTSGET_AUTH_VALIDATE_AUDIENCE: `[${audience.join(',')}]`,
          HTSGET_AUTH_VALIDATE_ISSUER: `[${issuer}]`,
          HTSGET_AUTH_TRUSTED_AUTHORIZATION_URLS: `[https://${auth_url}]`,
          AWS_LAMBDA_HTTP_IGNORE_STAGE_IN_PATH: true,
        },
      },
      buildEnvironment: props.buildEnvironment,
      cargoLambdaFlags: this.cargoLambdaFlags(),
      vpc: this.vpc,
      role,
      httpApi: apiGateway.httpApi,
      gitReference: 'htsget-lambda-v0.7.3',
      gitForceClone: false,
    });
  }
}
