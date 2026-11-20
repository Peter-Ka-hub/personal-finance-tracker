// ── Container Apps ────────────────────────────────────────────────────────────
// Deployed AFTER base.bicep and after images are pushed to the registry.
// Five apps: auth, categories, transactions (internal), frontend (internal),
// gateway (external, internet-facing).
//
// Service-to-service traffic stays inside the Container Apps Environment over
// plain HTTP (allowInsecure) to avoid internal TLS-trust issues; the public
// edge (gateway) is served over HTTPS by the platform.

@description('Azure region for all resources')
param location string = 'polandcentral'

@description('Container Apps Environment resource ID (from base.bicep)')
param environmentId string

@description('ACR login server, e.g. acrfinancetracker.azurecr.io (from base.bicep)')
param acrLoginServer string

@description('ACR registry name (from base.bicep)')
param acrName string

@description('Container image tag (git SHA) pushed by CI')
param imageTag string

@description('PostgreSQL server FQDN (from base.bicep)')
param postgresHost string

@description('PostgreSQL database name (from base.bicep)')
param postgresDbName string

@secure()
@description('PostgreSQL password for finance_auth')
param postgresAuthPassword string

@secure()
@description('PostgreSQL password for finance_categories')
param postgresCategoriesPassword string

@secure()
@description('PostgreSQL password for finance_transactions')
param postgresTransactionsPassword string

@secure()
@description('Optional original DB password retained under its old name during the revision transition')
param legacyPostgresAdminPassword string = ''

@secure()
@description('JWT signing key shared by auth, categories and transactions')
param jwtSecret string

@secure()
@description('Internal API key shared by auth and categories')
param internalApiKey string

var tags = {
  env: 'prod'
  app: 'finance-tracker'
  owner: 'pjoter'
  costcenter: 'personal'
}

// ACR admin credentials for image pull (admin user enabled in registry.bicep).
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: acrName
}
var acrUsername = acr.listCredentials().username
var acrPassword = acr.listCredentials().passwords[0].value

var authImage = '${acrLoginServer}/auth:${imageTag}'
var categoriesImage = '${acrLoginServer}/categories:${imageTag}'
var transactionsImage = '${acrLoginServer}/transactions:${imageTag}'
var frontendImage = '${acrLoginServer}/frontend:${imageTag}'
var gatewayImage = '${acrLoginServer}/gateway:${imageTag}'

var dbEnvVars = [
  { name: 'DB_HOST', value: postgresHost }
  { name: 'DB_PORT', value: '5432' }
  { name: 'DB_NAME', value: postgresDbName }
  { name: 'DB_SSL', value: 'true' }
  { name: 'DB_PASSWORD', secretRef: 'runtime-db-password' }
  { name: 'JWT_SECRET', secretRef: 'jwt-secret' }
]

var commonSecrets = union({
  'jwt-secret': jwtSecret
}, empty(legacyPostgresAdminPassword) ? {} : {
  'db-password': legacyPostgresAdminPassword
})

var secretsWithInternalKey = union(commonSecrets, {
  'internal-api-key': internalApiKey
})

// ── Categories Service (internal) ─────────────────────────────────────────────
module caCategories 'modules/containerapp.bicep' = {
  name: 'ca-categories'
  params: {
    location: location
    tags: tags
    appName: 'ca-categories'
    environmentId: environmentId
    containerImage: categoriesImage
    containerPort: 3002
    externalIngress: false
    allowInsecure: true
    acrLoginServer: acrLoginServer
    acrUsername: acrUsername
    acrPassword: acrPassword
    envVars: concat(dbEnvVars, [
      { name: 'PORT', value: '3002' }
      { name: 'DB_USER', value: 'finance_categories' }
      { name: 'INTERNAL_API_KEY', secretRef: 'internal-api-key' }
    ])
    appSecrets: union(secretsWithInternalKey, { 'runtime-db-password': postgresCategoriesPassword })
  }
}

// ── Auth Service (internal) ───────────────────────────────────────────────────
module caAuth 'modules/containerapp.bicep' = {
  name: 'ca-auth'
  params: {
    location: location
    tags: tags
    appName: 'ca-auth'
    environmentId: environmentId
    containerImage: authImage
    containerPort: 3001
    externalIngress: false
    allowInsecure: true
    acrLoginServer: acrLoginServer
    acrUsername: acrUsername
    acrPassword: acrPassword
    envVars: concat(dbEnvVars, [
      { name: 'PORT', value: '3001' }
      { name: 'DB_USER', value: 'finance_auth' }
      { name: 'CATEGORIES_SERVICE_URL', value: 'https://${caCategories.outputs.appFqdn}' }
      { name: 'INTERNAL_API_KEY', secretRef: 'internal-api-key' }
    ])
    appSecrets: union(secretsWithInternalKey, { 'runtime-db-password': postgresAuthPassword })
  }
}

// ── Transactions Service (internal) ───────────────────────────────────────────
module caTransactions 'modules/containerapp.bicep' = {
  name: 'ca-transactions'
  params: {
    location: location
    tags: tags
    appName: 'ca-transactions'
    environmentId: environmentId
    containerImage: transactionsImage
    containerPort: 3003
    externalIngress: false
    allowInsecure: true
    acrLoginServer: acrLoginServer
    acrUsername: acrUsername
    acrPassword: acrPassword
    envVars: concat(dbEnvVars, [
      { name: 'PORT', value: '3003' }
      { name: 'DB_USER', value: 'finance_transactions' }
    ])
    appSecrets: union(commonSecrets, { 'runtime-db-password': postgresTransactionsPassword })
  }
}

// ── Frontend (internal, served via the gateway) ───────────────────────────────
module caFrontend 'modules/containerapp.bicep' = {
  name: 'ca-frontend'
  params: {
    location: location
    tags: tags
    appName: 'ca-frontend'
    environmentId: environmentId
    containerImage: frontendImage
    containerPort: 3000
    externalIngress: false
    allowInsecure: true
    acrLoginServer: acrLoginServer
    acrUsername: acrUsername
    acrPassword: acrPassword
    envVars: []
  }
}

// ── Gateway (Nginx, external/internet-facing) ─────────────────────────────────
module caGateway 'modules/containerapp.bicep' = {
  name: 'ca-gateway'
  params: {
    location: location
    tags: tags
    appName: 'ca-gateway'
    environmentId: environmentId
    containerImage: gatewayImage
    containerPort: 80
    externalIngress: true
    allowInsecure: false
    acrLoginServer: acrLoginServer
    acrUsername: acrUsername
    acrPassword: acrPassword
    // Container Apps' internal ingress requires HTTPS, so the gateway talks to
    // the services over https on 443 (internal FQDNs).
    envVars: [
      { name: 'UPSTREAM_SCHEME',   value: 'https' }
      { name: 'AUTH_HOST',         value: caAuth.outputs.appFqdn }
      { name: 'AUTH_PORT',         value: '443' }
      { name: 'CATEGORIES_HOST',   value: caCategories.outputs.appFqdn }
      { name: 'CATEGORIES_PORT',   value: '443' }
      { name: 'TRANSACTIONS_HOST', value: caTransactions.outputs.appFqdn }
      { name: 'TRANSACTIONS_PORT', value: '443' }
      { name: 'FRONTEND_HOST',     value: caFrontend.outputs.appFqdn }
      { name: 'FRONTEND_PORT',     value: '443' }
    ]
  }
}

output gatewayUrl string = 'https://${caGateway.outputs.appFqdn}'
