# servicebus-scaling-kubernetes-pod

Kubernetes pod autoscaler based on active message count of a subscriptione in Azure Service Bus Queues. It periodically retrieves the number of active messages in your subscription and scales pods using the logic defined in the scalinglogic.js

## Where implement the scaling logic

In the scalinglogic.js file you will have to define your scaling logic. Right now the getReplicasIncrease is a simple if/else like this:

```js
if (messageNumber > 5) {
    return 1;
} else {
    return -1;
}
```

## Deploying servicebus-scaling-kubernetes-pod
After you change the scaling logic, you can simply apply the included deployment:

```yaml
apiVersion: extensions/v1beta1
kind: Deployment
metadata:
  name:  servicebus-scaling-kubernetes-pod
  labels:
    name:  servicebus-scaling-kubernetes-pod
spec:
  template:
    metadata:
      labels:
        app:  servicebus-scaling-kubernetes-pod
    spec:
      containers:
      - image:  danigian/servicebus-scaling-kubernetes-pod:latest
        name:  servicebus-scaling-kubernetes-pod
        env:
        - name:  tenantId
          value:  ENVVARVALUE
        - name:  clientId
          value:  ENVVARVALUE
        - name:  clientSecret
          value:  ENVVARVALUE
        - name:  subscriptionId
          value:  ENVVARVALUE
        - name:  resourceGroupName
          value:  sbrg
        - name:  namespaceName
          value:  damaggio
        - name:  topicName
          value:  mytopic
        - name:  subscriptionName
          value:  mysubscription
        - name:  kubernetesDeploymentName
          value:  nginx
        - name:  kubernetesNamespace
          value:  default
        - name:  pollInterval
          value:  3
        - name:  scaleOutCoolDown
          value:  10
        - name:  scaleInCoolDown
          value:  10
        - name:  maxPods
          value:  10
        - name:  minPods
          value:  1
```