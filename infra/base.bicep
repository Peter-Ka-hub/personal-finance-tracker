// ── Base infrastructure ───────────────────────────────────────────────────────
// Deployed FIRST (before any container images exist):
//   Container Registry, PostgreSQL Flexible Server (public + SSL), budget alert.
//
// The subscription is capped at ONE Container Apps Environment, which already
// exists, so we REUSE it (see existingEnvironment* params) instead of creating
// a new one. The Container Apps themselves live in apps.bicep and are deployed
// AFTER the images have been pushed to the registry created here.

@description('Azure region for all resources')
param location string = 'polandcentral'

@description('Alert email for budget notifications')
param alertEmail string = 'pjoter004@outlook.com'

@secure()
@description('PostgreSQL administrator password')
param postgresAdminPassword string

@description('Name of the existing Container Apps Environment to reuse')
param existingEnvironmentName string = 'managedEnvironment-additionalres-83b6'

@description('Resource group of the existing Container Apps Environment')
param existingEnvironmentResourceGroup string = 'additional-res'

var tags = {
  env: 'prod'
  app: 'finance-tracker'
  owner: 'pjoter'
  costcenter: 'personal'
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
    adminPassword: postgresAdminPassword
  }
}

module budget 'modules/budget.bicep' = {
  name: 'budget'
  params: {
    alertEmail: alertEmail
  }
}

// Reuse the existing Container Apps Environment (subscription allows only one).
resource existingEnv 'Microsoft.App/managedEnvironments@2023-05-01' existing = {
  name: existingEnvironmentName
  scope: resourceGroup(existingEnvironmentResourceGroup)
}

output acrLoginServer string = registry.outputs.acrLoginServer
output acrName string = registry.outputs.acrName
output environmentId string = existingEnv.id
output postgresHost string = postgres.outputs.serverFqdn
output postgresDbName string = postgres.outputs.dbName
output postgresAdminLogin string = postgres.outputs.adminLogin
