@description('Azure region for all resources')
param location string = 'polandcentral'

@description('GitHub repository URL for Static Web App')
param repositoryUrl string

@description('Alert email for budget notifications')
param alertEmail string

@description('Container image tag (git SHA) — set by CI/CD')
param imageTag string = 'latest'

@description('ACR login server (set after first deploy)')
param acrLoginServer string = ''

@secure()
@description('Postgres admin password — stored in Key Vault after deploy')
param postgresAdminPassword string

var tags = {
  env: 'prod'
  app: 'finance-tracker'
  owner: 'pjoter'
  costcenter: 'personal'
}

// ── Network ──────────────────────────────────────────────────────────────────
module network 'modules/network.bicep' = {
  name: 'network'
  params: {
    location: location
    tags: tags
  }
}

// ── Container Registry ───────────────────────────────────────────────────────
module registry 'modules/registry.bicep' = {
  name: 'registry'
  params: {
    location: location
    tags: tags
  }
}

// ── PostgreSQL ────────────────────────────────────────────────────────────────
module postgres 'modules/postgres.bicep' = {
  name: 'postgres'
  params: {
    location: location
    tags: tags
    dbSubnetId: network.outputs.dbSubnetId
    adminPassword: postgresAdminPassword
  }
}

// ── Container Apps Environment ────────────────────────────────────────────────
module caEnv 'modules/containerapps-env.bicep' = {
  name: 'containerapps-env'
  params: {
    location: location
    tags: tags
    containerAppsSubnetId: network.outputs.containerAppsSubnetId
  }
}

// ── Placeholder image for first deploy (before CI pushes real images) ────────
var effectiveAcrServer = empty(acrLoginServer) ? registry.outputs.acrLoginServer : acrLoginServer
var authImage = '${effectiveAcrServer}/auth:${imageTag}'
var categoriesImage = '${effectiveAcrServer}/categories:${imageTag}'
var transactionsImage = '${effectiveAcrServer}/transactions:${imageTag}'
var gatewayImage = '${effectiveAcrServer}/gateway:${imageTag}'

// Common DB env vars — references to Key Vault secrets set post-deploy
var dbEnvVars = [
  { name: 'DB_HOST', value: postgres.outputs.serverFqdn }
  { name: 'DB_PORT', value: '5432' }
  { name: 'DB_NAME', value: postgres.outputs.dbName }
  { name: 'DB_USER', value: postgres.outputs.adminLogin }
  { name: 'DB_PASSWORD', secretRef: 'db-password' }
  { name: 'JWT_SECRET', secretRef: 'jwt-secret' }
]

// Secret refs — Key Vault URIs set post-deploy via 'az containerapp secret set'
var commonSecretRefs = [
  {
    name: 'db-password'
    keyVaultUrl: '${keyVault.outputs.keyVaultUri}secrets/DB-PASSWORD'
    identity: 'system'
  }
  {
    name: 'jwt-secret'
    keyVaultUrl: '${keyVault.outputs.keyVaultUri}secrets/JWT-SECRET'
    identity: 'system'
  }
]

// ── Auth Service ──────────────────────────────────────────────────────────────
module caAuth 'modules/containerapp.bicep' = {
  name: 'ca-auth'
  params: {
    location: location
    tags: tags
    appName: 'ca-auth'
    environmentId: caEnv.outputs.environmentId
    containerImage: authImage
    containerPort: 3001
    externalIngress: false
    acrLoginServer: effectiveAcrServer
    envVars: concat(dbEnvVars, [
      { name: 'PORT', value: '3001' }
      { name: 'CATEGORIES_SERVICE_URL', value: 'https://ca-categories.internal.${caEnv.outputs.environmentName}.${location}.azurecontainerapps.io' }
      { name: 'INTERNAL_API_KEY', secretRef: 'internal-api-key' }
    ])
    secretRefs: concat(commonSecretRefs, [
      {
        name: 'internal-api-key'
        keyVaultUrl: '${keyVault.outputs.keyVaultUri}secrets/INTERNAL-API-KEY'
        identity: 'system'
      }
    ])
  }
}

// ── Categories Service ────────────────────────────────────────────────────────
module caCategories 'modules/containerapp.bicep' = {
  name: 'ca-categories'
  params: {
    location: location
    tags: tags
    appName: 'ca-categories'
    environmentId: caEnv.outputs.environmentId
    containerImage: categoriesImage
    containerPort: 3002
    externalIngress: false
    acrLoginServer: effectiveAcrServer
    envVars: concat(dbEnvVars, [
      { name: 'PORT', value: '3002' }
      { name: 'INTERNAL_API_KEY', secretRef: 'internal-api-key' }
    ])
    secretRefs: concat(commonSecretRefs, [
      {
        name: 'internal-api-key'
        keyVaultUrl: '${keyVault.outputs.keyVaultUri}secrets/INTERNAL-API-KEY'
        identity: 'system'
      }
    ])
  }
}

// ── Transactions Service ──────────────────────────────────────────────────────
module caTransactions 'modules/containerapp.bicep' = {
  name: 'ca-transactions'
  params: {
    location: location
    tags: tags
    appName: 'ca-transactions'
    environmentId: caEnv.outputs.environmentId
    containerImage: transactionsImage
    containerPort: 3003
    externalIngress: false
    acrLoginServer: effectiveAcrServer
    envVars: concat(dbEnvVars, [
      { name: 'PORT', value: '3003' }
    ])
    secretRefs: commonSecretRefs
  }
}

// ── Gateway (Nginx) ───────────────────────────────────────────────────────────
module caGateway 'modules/containerapp.bicep' = {
  name: 'ca-gateway'
  params: {
    location: location
    tags: tags
    appName: 'ca-gateway'
    environmentId: caEnv.outputs.environmentId
    containerImage: gatewayImage
    containerPort: 80
    externalIngress: true
    acrLoginServer: effectiveAcrServer
    // Internal Container Apps DNS: <appName>.internal.<envName>.<location>.azurecontainerapps.io
    envVars: [
      { name: 'AUTH_HOST',          value: 'ca-auth' }
      { name: 'AUTH_PORT',          value: '3001' }
      { name: 'CATEGORIES_HOST',    value: 'ca-categories' }
      { name: 'CATEGORIES_PORT',    value: '3002' }
      { name: 'TRANSACTIONS_HOST',  value: 'ca-transactions' }
      { name: 'TRANSACTIONS_PORT',  value: '3003' }
    ]
    secretRefs: []
  }
}

// ── Key Vault (depends on Container App identities) ───────────────────────────
module keyVault 'modules/keyvault.bicep' = {
  name: 'keyvault'
  params: {
    location: location
    tags: tags
    identityPrincipalIds: [
      caAuth.outputs.principalId
      caCategories.outputs.principalId
      caTransactions.outputs.principalId
    ]
  }
}

// ── Static Web App ────────────────────────────────────────────────────────────
module swa 'modules/swa.bicep' = {
  name: 'swa'
  params: {
    tags: tags
    repositoryUrl: repositoryUrl
    branch: 'master'
  }
}

// ── Budget alert ──────────────────────────────────────────────────────────────
module budget 'modules/budget.bicep' = {
  name: 'budget'
  params: {
    alertEmail: alertEmail
  }
}

// ── Outputs ────────────────────────────────────────────────────────────────────
output gatewayUrl string = 'https://${caGateway.outputs.appFqdn}'
output swaUrl string = 'https://${swa.outputs.swaDefaultHostname}'
output acrLoginServer string = registry.outputs.acrLoginServer
output keyVaultName string = keyVault.outputs.keyVaultName
output postgresHost string = postgres.outputs.serverFqdn
