const ServicebusManagement = require("azure-arm-sb");
const msRestAzure = require("ms-rest-azure");
const k8s = require("@kubernetes/client-node");
const scalinglogic = require("./scalinglogic");

const tenant = process.env.tenantId;
const clientId = process.env.clientId;
const clientSecret = process.env.clientSecret;
const subscriptionId = process.env.subscriptionId;

const deployment = process.env.kubernetesDeploymentName;
const deploymentNamespace = process.env.kubernetesNamespace;
const maxPods = process.env.maxPods;
const minPods = process.env.minPods;

const resourceGroupName = process.env.resourceGroupName;
const namespaceName = process.env.namespaceName;
const topicName = process.env.topicName;
const subscriptionName = process.env.subscriptionName;

const pollInterval = process.env.pollInterval;

const scaleOutCoolDown = process.env.scaleOutCoolDown * 1000;
const scaleInCoolDown = process.env.scaleInCoolDown * 1000;
var lastScaleOutTime = new Date().getTime() - scaleOutCoolDown;
var lastScaleInTime = new Date().getTime() - scaleInCoolDown;

const credentials = new msRestAzure.ApplicationTokenCredentials(
  clientId,
  tenant,
  clientSecret
);

var client = new ServicebusManagement(
  credentials,
  subscriptionId
);

console.log(`${new Date().toISOString()}: \n\tPod scaler launched \n\tsubscription: ${subscriptionName} \n\ttopic: ${topicName} \n\tnamespace: ${namespaceName} \n\tpollInterval: ${pollInterval} `);

setInterval(() => {
  client.subscriptions.get(
    resourceGroupName,
    namespaceName,
    topicName,
    subscriptionName,
    (err, result) => {
      console.log(`${new Date().toISOString()}: Active message count for subscription ${subscriptionName}: ${result.countDetails.activeMessageCount}`);

      //coreClient is a v1 API client
      const coreClient = k8s.Config.defaultClient();

      //In order to patch the deployment we need to use the v1beta1 APIs
      //Adding the defaultHeader "Content-Type" to solve this issue: https://github.com/kubernetes-client/javascript/issues/19
      const appClient = new k8s.Apps_v1beta1Api(coreClient.basePath);
      appClient.setDefaultAuthentication(coreClient.authentications.default);
      appClient.defaultHeaders = {
        "Content-Type": "application/merge-patch+json"
      };

      if (deployment != undefined && deploymentNamespace != undefined) {
        appClient.readNamespacedDeployment(deployment, deploymentNamespace)
          .then(res => {
            var newReplicaNumber = res.body.spec.replicas + scalinglogic.getReplicasIncrease(result.messageCount);

            if (newReplicaNumber <= maxPods && newReplicaNumber >= minPods) {

              //check scale out cool down
              if (newReplicaNumber > res.body.spec.replicas) {
                if (lastScaleOutTime + scaleOutCoolDown >= new Date().getTime()) {
                  console.log(`${new Date().toISOString()}: Waiting for cool down, skipping scale out`);
                  return
                } else {
                  res.body.spec.replicas = newReplicaNumber;
                  appClient.patchNamespacedDeployment(deployment, deploymentNamespace, res.body, true)
                    .then(res => {
                      lastScaleOutTime = new Date().getTime();
                      console.info(`${new Date().toISOString()}: Scaled the deployment to: ${newReplicaNumber}`);
                    }, err => {
                      console.error(`${new Date().toISOString()}: Error while patching the namespaced deployment: \n\t${err.body.message}`);
                    });
                }
              }

              //check scale in cool down
              if (newReplicaNumber < res.body.spec.replicas) {
                if (lastScaleInTime + scaleInCoolDown >= new Date().getTime()) {
                  console.log(`${new Date().toISOString()}: Waiting for cool down, skipping scale in`);
                  return
                } else {
                  res.body.spec.replicas = newReplicaNumber;
                  appClient.patchNamespacedDeployment(deployment, deploymentNamespace, res.body, true)
                    .then(res => {
                      lastScaleInTime = new Date().getTime();
                      console.info(`${new Date().toISOString()}: Scaled the deployment to: ${newReplicaNumber} `);
                      // console.debug(JSON.stringify(res.body));
                      
                    }, err => {
                      console.error(`${new Date().toISOString()}: Error while patching the namespaced deployment: \n\t${err.body.message}`);
                    });
                }
              }
            } else {
              console.info(`${new Date().toISOString()}: Target replica number is above the max (${maxPods}) or below the min (${minPods}) number of allowed replicas. Scaling target would have been of ${newReplicaNumber} replicas`);
            }
          }, err => {
            console.error(`${new Date().toISOString()}: Error while retrieving the namespaced deployment: \n\t${err.body.message}`);
          });
      } else {
        console.error(`${new Date().toISOString()}: An error occured while retrieving the number of messages in Service bus: \n\t${err}`);
      }
    }
  );

}, pollInterval * 1000)
