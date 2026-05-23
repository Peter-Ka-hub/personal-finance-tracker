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

@description('Environment variables for the container (plain-text only)')
param envVars array = []

@description('Secret references for the container (from Key Vault)')
param secretRefs array = []

@description('ACR login server')
param acrLoginServer string

resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: appName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    environmentId: environmentId
    configuration: {
      ingress: {
        external: externalIngress
        targetPort: containerPort
        transport: 'http'
        allowInsecure: false
      }
      registries: [
        {
          server: acrLoginServer
          identity: 'system'
        }
      ]
      secrets: secretRefs
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
        minReplicas: 0
        maxReplicas: 2
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

// Grant AcrPull role to this app's managed identity on the ACR
resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(containerApp.id, 'acrpull', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
  scope: resourceGroup()
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d') // AcrPull
    principalId: containerApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

output appFqdn string = containerApp.properties.configuration.ingress.fqdn
output appName string = containerApp.name
output principalId string = containerApp.identity.principalId
