@description('Location for all resources')
param location string

@description('Tags to apply to all resources')
param tags object

@description('Subnet ID for Postgres flexible server VNet integration')
param dbSubnetId string

@secure()
@description('Administrator password')
param adminPassword string

@description('Administrator login name')
param adminLogin string = 'pgadmin'

var serverName = 'psql-finance-tracker'

resource privateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: '${serverName}.private.postgres.database.azure.com'
  location: 'global'
  tags: tags
}

resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: serverName
  location: location
  tags: tags
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    administratorLogin: adminLogin
    administratorLoginPassword: adminPassword
    storage: {
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
    version: '16'
    network: {
      delegatedSubnetResourceId: dbSubnetId
      privateDnsZoneArmResourceId: privateDnsZone.id
    }
  }
}

resource postgresDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-06-01-preview' = {
  parent: postgresServer
  name: 'finance'
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

output serverFqdn string = postgresServer.properties.fullyQualifiedDomainName
output serverName string = postgresServer.name
output dbName string = postgresDb.name
output adminLogin string = adminLogin
