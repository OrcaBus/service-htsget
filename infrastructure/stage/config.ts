import { HtsgetStackConfig } from './htsget-stack';
import { getDefaultApiGatewayConfiguration } from '@orcabus/platform-cdk-constructs/api-gateway';
import { vpcProps } from './constants';
import {
  FILE_MANAGER_BUCKETS,
  FILE_MANAGER_CACHE_BUCKETS,
  FILE_MANAGER_CROSS_ACCOUNT_BUCKETS,
  FILE_MANAGER_INGEST_ROLE,
} from '@orcabus/platform-cdk-constructs/shared-config/file-manager';
import { StageName } from '@orcabus/platform-cdk-constructs/shared-config/accounts';

export const getHtsgetProps = (stage: StageName): HtsgetStackConfig => {
  return {
    vpcProps,
    apiGatewayHtsgetProps: {
      ...getDefaultApiGatewayConfiguration(stage),
      apiName: 'Htsget',
      customDomainNamePrefix: 'htsget-file',
    },
    buckets: [
      ...FILE_MANAGER_BUCKETS[stage],
      ...FILE_MANAGER_CACHE_BUCKETS[stage],
      ...FILE_MANAGER_CROSS_ACCOUNT_BUCKETS,
    ],
    roleName: FILE_MANAGER_INGEST_ROLE,
    apiGatewayAuthProps: {
      ...getDefaultApiGatewayConfiguration(stage),
      apiName: 'HtsGetAuth',
      customDomainNamePrefix: 'htsget-auth',
    },
  };
};
