@description('Location for Static Web App (global or specific region)')
param location string = 'westeurope'

@description('Tags to apply to all resources')
param tags object

@description('GitHub repository URL (e.g. https://github.com/owner/repo)')
param repositoryUrl string

@description('GitHub branch to deploy from')
param branch string = 'master'

@description('Path to the frontend app within the repository')
param appLocation string = '/frontend'

@description('Path to build output relative to appLocation')
param outputLocation string = 'build'

var swaName = 'swa-finance-tracker'

resource swa 'Microsoft.Web/staticSites@2023-01-01' = {
  name: swaName
  location: location
  tags: tags
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    repositoryUrl: repositoryUrl
    branch: branch
    buildProperties: {
      appLocation: appLocation
      outputLocation: outputLocation
      appBuildCommand: 'npm run build'
    }
  }
}

output swaName string = swa.name
output swaDefaultHostname string = swa.properties.defaultHostname
output swaId string = swa.id
