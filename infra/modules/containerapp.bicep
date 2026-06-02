@description('Location for all resources')
param location string

@description('Tags to apply to all resources')
param tags object

@description('Name of the Container App')
param appName string

@description('Container Apps Environment ID')
param environmentId string

@description('Container image (e.g. acrfinancetracker.azurecr.io/auth:abc123)')
param containerImage string

@description('Container port to expose internally')
param containerPort int

@description('Whether this app should have an external (internet-facing) ingress')
param externalIngress bool = false

@description('Allow plain HTTP on the ingress (used for internal service-to-service traffic)')
param allowInsecure bool = false

@description('Minimum number of replicas')
param minReplicas int = 1

@description('Maximum number of replicas')
param maxReplicas int = 3

@description('Environment variables for the container')
param envVars array = []

@description('Container secrets ({ name, value } entries)')
param secretRefs array = []

@description('ACR login server')
param acrLoginServer string

@description('ACR admin username (used to pull the image)')
param acrUsername string

@secure()
@description('ACR admin password (used to pull the image)')
param acrPassword string

resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: appName
  location: location
  tags: tags
  properties: {
    environmentId: environmentId
    configuration: {
      ingress: {
        external: externalIngress
        targetPort: containerPort
        transport: 'auto'
        allowInsecure: allowInsecure
      }
      registries: [
        {
          server: acrLoginServer
          username: acrUsername
          passwordSecretRef: 'acr-registry-password'
        }
      ]
      secrets: concat(secretRefs, [
        {
          name: 'acr-registry-password'
          value: acrPassword
        }
      ])
    }
    template: {
      containers: [
        {
          name: appName
          image: containerImage
          env: envVars
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '10'
              }
            }
          }
        ]
      }
    }
  }
}

output appFqdn string = containerApp.properties.configuration.ingress.fqdn
output appName string = containerApp.name
