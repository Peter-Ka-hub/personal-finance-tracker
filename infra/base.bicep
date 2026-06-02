// ── Base infrastructure ───────────────────────────────────────────────────────
// Deployed FIRST (before any container images exist):
//   VNet + subnets, Container Registry, PostgreSQL Flexible Server,
//   Container Apps Environment, budget alert.
// The Container Apps themselves live in apps.bicep and are deployed AFTER the
// images have been built and pushed to the registry created here.

@description('Azure region for all resources')
param location string = 'polandcentral'

@description('Alert email for budget notifications')
param alertEmail string = 'pjoter004@outlook.com'

@secure()
@description('PostgreSQL administrator password')
param postgresAdminPassword string

var tags = {
  env: 'prod'
  app: 'finance-tracker'
  owner: 'pjoter'
  costcenter: 'personal'
}

module network 'modules/network.bicep' = {
  name: 'network'
  params: {
    location: location
    tags: tags
  }
}

module registry 'modules/registry.bicep' = {
  name: 'registry'
  params: {
    location: location
    tags: tags
  }
}

module postgres 'modules/postgres.bicep' = {
  name: 'postgres'
  params: {
    location: location
    tags: tags
    dbSubnetId: network.outputs.dbSubnetId
    vnetId: network.outputs.vnetId
    adminPassword: postgresAdminPassword
  }
}

module caEnv 'modules/containerapps-env.bicep' = {
  name: 'containerapps-env'
  params: {
    location: location
    tags: tags
    containerAppsSubnetId: network.outputs.containerAppsSubnetId
  }
}

module budget 'modules/budget.bicep' = {
  name: 'budget'
  params: {
    alertEmail: alertEmail
  }
}

output acrLoginServer string = registry.outputs.acrLoginServer
output acrName string = registry.outputs.acrName
output environmentId string = caEnv.outputs.environmentId
output postgresHost string = postgres.outputs.serverFqdn
output postgresDbName string = postgres.outputs.dbName
output postgresAdminLogin string = postgres.outputs.adminLogin
