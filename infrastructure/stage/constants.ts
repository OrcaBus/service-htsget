import { VpcLookupOptions } from 'aws-cdk-lib/aws-ec2';

// upstream infra: vpc
const vpcName = 'main-vpc';
const vpcStackName = 'networking';
export const vpcProps: VpcLookupOptions = {
  vpcName: vpcName,
  tags: {
    Stack: vpcStackName,
  },
};
