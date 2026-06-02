@description('Location for all resources')
param location string

@description('Tags to apply to all resources')
param tags object

var registryName = 'acrfinancetracker'

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: registryName
  location: location
  tags: tags
  sku: {
    name: 'Basic'
  }
  properties: {
    // Admin user enabled so Container Apps can pull images with registry
    // credentials (no AcrPull role assignment needed — works with a
    // Contributor-only deployment identity).
    adminUserEnabled: true
    publicNetworkAccess: 'Enabled'
  }
}

output acrName string = acr.name
output acrLoginServer string = acr.properties.loginServer
output acrId string = acr.id
