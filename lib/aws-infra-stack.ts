import { Stack, StackProps, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as rds from "aws-cdk-lib/aws-rds";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Cluster } from "aws-cdk-lib/aws-ecs";
import { Monty } from "./nested/monty";

export class AwsInfraStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    // vpc
    const vpc = new ec2.Vpc(this, "vpc", {
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 28,
          name: "isolated",
          subnetType: ec2.SubnetType.ISOLATED,
        },
      ],
    });

    // Shared database pg instance
    const engine = rds.DatabaseInstanceEngine.postgres({
      version: rds.PostgresEngineVersion.VER_13_4,
    });

    const dbInstance = new rds.DatabaseInstance(this, "SharedPostgresDB", {
      engine,
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.BURSTABLE4_GRAVITON,
        ec2.InstanceSize.MICRO
      ),
      allocatedStorage: 5,
      // Creates an admin user of postgres with a generated password
      credentials: rds.Credentials.fromGeneratedSecret("postgres"),
    });

    // shared ecs cluster
    const ecsCluster = new Cluster(this, "SharedECSCluster", {
      vpc,
    });

    new CfnOutput(this, "dbSecret", {
      value: dbInstance.secret!.secretName,
      description: "Datatbase secret name",
      exportName: "dbSecret",
    });

    // init nested stacks
    new Monty(this, "monty-stack", {
      dbSecret: dbInstance.secret!,
      cluster: ecsCluster,
    });
  }
}
