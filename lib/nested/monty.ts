import { NestedStack, NestedStackProps } from "aws-cdk-lib";
import { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecr from "aws-cdk-lib/aws-ecr";
import { Schedule } from "aws-cdk-lib/aws-autoscaling";
import { ScheduledFargateTask } from "aws-cdk-lib/aws-ecs-patterns";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";

interface MontyNestedStackProps extends NestedStackProps {
  readonly dbSecret: ISecret;

  readonly cluster: ecs.Cluster;
}

export class Monty extends NestedStack {
  constructor(scope: Construct, id: string, props?: MontyNestedStackProps) {
    super(scope, id, props);

    // ecr repository
    const repository = new ecr.Repository(this, "imageRepository", {
      imageScanOnPush: true,
      repositoryName: "monty",
    });

    // reddit auth
    const redditAuth = secretsmanager.Secret.fromSecretCompleteArn(
      this,
      "RedditAuth",
      "arn:aws:secretsmanager:us-east-2:261392311630:secret:monty/RedditLogin-IMV77V"
    );

    // main fargate task
    new ScheduledFargateTask(this, "MontyScheduledFargateTask", {
      cluster: props!.cluster,
      scheduledFargateTaskImageOptions: {
        image: ecs.ContainerImage.fromEcrRepository(repository),
        cpu: 2048,
        memoryLimitMiB: 4096,
        secrets: {
          DB_PASSWORD: ecs.Secret.fromSecretsManager(
            props!.dbSecret,
            "password"
          ),
          DB_HOST: ecs.Secret.fromSecretsManager(props!.dbSecret, "host"),
          DB_PORT: ecs.Secret.fromSecretsManager(props!.dbSecret, "port"),
          DB_USER: ecs.Secret.fromSecretsManager(props!.dbSecret, "username"),
          APP_ID: ecs.Secret.fromSecretsManager(redditAuth, "id"),
          APP_SECRET: ecs.Secret.fromSecretsManager(redditAuth, "secret"),
          APP_AGENT: ecs.Secret.fromSecretsManager(redditAuth, "agent"),
        },
      },
      schedule: Schedule.expression("cron(0 */2 * * ? *)"),
      platformVersion: ecs.FargatePlatformVersion.LATEST,
      subnetSelection: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      enabled: true,
    });
  }
}
