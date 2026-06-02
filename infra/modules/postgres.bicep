@description('Location for all resources')
param location string

@description('Tags to apply to all resources')
param tags object

@secure()
@description('Administrator password')
param adminPassword string

@description('Administrator login name')
param adminLogin string = 'pgadmin'

var serverName = 'psql-finance-tracker-pc'

// Public-access flexible server (the reused Container Apps Environment is not
// VNet-integrated). Access is restricted by firewall to Azure services and all
// traffic is TLS-encrypted (services connect with DB_SSL=true).
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
      publicNetworkAccess: 'Enabled'
    }
  }
}

// Allow connections from Azure services (Container Apps outbound). The special
// 0.0.0.0 range means "Allow public access from any Azure service".
resource allowAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-06-01-preview' = {
  parent: postgresServer
  name: 'AllowAllAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
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
