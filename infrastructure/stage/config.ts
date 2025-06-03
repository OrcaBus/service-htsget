import { HtsgetStackConfig } from './htsget-stack';
import { StageName } from '@orcabus/platform-cdk-constructs/utils';
import { getDefaultApiGatewayConfiguration } from '@orcabus/platform-cdk-constructs/api-gateway';
import { vpcProps } from './constants';
import {
  fileManagerBuckets,
  fileManagerCacheBuckets,
  fileManagerIngestRoleName,
} from '@orcabus/platform-cdk-constructs/shared-config/file-manager';

export const getHtsgetProps = (stage: StageName): HtsgetStackConfig => {
  return {
    vpcProps,
    apiGatewayProps: {
      ...getDefaultApiGatewayConfiguration(stage),
      apiName: 'Htsget',
      customDomainNamePrefix: 'htsget-file',
    },
    buckets: [...fileManagerBuckets[stage], ...fileManagerCacheBuckets[stage]],
    roleName: fileManagerIngestRoleName,
  };
};
