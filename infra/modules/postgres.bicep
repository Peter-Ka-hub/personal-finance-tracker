@description('Location for all resources')
param location string

@description('Tags to apply to all resources')
param tags object

@secure()
@description('Administrator password')
param adminPassword string

@description('Administrator login name')
param adminLogin string = 'pgadmin'

@sealed()
type FirewallRule = {
  name: string
  startIpAddress: string
  endIpAddress: string
}

@export()
@discriminator('mode')
type PostgresFirewallConfig = {
  mode: 'overlap'
  rules: FirewallRule[]
} | {
  mode: 'restricted'
  @minLength(1)
  rules: FirewallRule[]
}

@description('Approved IPv4 rules. Overlap keeps the temporary Azure-wide rule alongside them.')
param firewall PostgresFirewallConfig

var serverName = 'psql-finance-tracker-pc'

// PostgreSQL stays on its public endpoint with a server firewall.
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
// Incremental deployments leave existing rules in place. Remove this rule
// explicitly after verifying the narrower allowlist (infra/NETWORKING.md).
resource allowAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-06-01-preview' = if (firewall.mode == 'overlap') {
  parent: postgresServer
  name: 'AllowAllAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource allowedSources 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-06-01-preview' = [for rule in firewall.rules: {
  parent: postgresServer
  name: 'finance-${rule.name}'
  properties: {
    startIpAddress: rule.startIpAddress
    endIpAddress: rule.endIpAddress
  }
}]

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
