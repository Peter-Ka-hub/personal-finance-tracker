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

@description('PostgreSQL admin login (from base.bicep)')
param postgresAdminLogin string

@secure()
@description('PostgreSQL administrator password')
param postgresAdminPassword string

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

// Stable, resource-group-scoped derived secrets — identical across all services
// and stable across redeploys (so issued JWTs keep working).
var jwtSecret = guid(resourceGroup().id, 'jwt-secret')
var internalApiKey = guid(resourceGroup().id, 'internal-api-key')

var authImage = '${acrLoginServer}/auth:${imageTag}'
var categoriesImage = '${acrLoginServer}/categories:${imageTag}'
var transactionsImage = '${acrLoginServer}/transactions:${imageTag}'
var frontendImage = '${acrLoginServer}/frontend:${imageTag}'
var gatewayImage = '${acrLoginServer}/gateway:${imageTag}'

var dbEnvVars = [
  { name: 'DB_HOST', value: postgresHost }
  { name: 'DB_PORT', value: '5432' }
  { name: 'DB_NAME', value: postgresDbName }
  { name: 'DB_USER', value: postgresAdminLogin }
  { name: 'DB_SSL', value: 'true' }
  { name: 'DB_PASSWORD', secretRef: 'db-password' }
  { name: 'JWT_SECRET', secretRef: 'jwt-secret' }
]

var commonSecrets = [
  { name: 'db-password', value: postgresAdminPassword }
  { name: 'jwt-secret', value: jwtSecret }
]

var secretsWithInternalKey = concat(commonSecrets, [
  { name: 'internal-api-key', value: internalApiKey }
])

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
      { name: 'INTERNAL_API_KEY', secretRef: 'internal-api-key' }
    ])
    secretRefs: secretsWithInternalKey
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
      { name: 'CATEGORIES_SERVICE_URL', value: 'http://${caCategories.outputs.appFqdn}' }
      { name: 'INTERNAL_API_KEY', secretRef: 'internal-api-key' }
    ])
    secretRefs: secretsWithInternalKey
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
    ])
    secretRefs: commonSecrets
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
    secretRefs: []
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
    // Upstreams point at the internal FQDNs on port 80 (allowInsecure http).
    envVars: [
      { name: 'AUTH_HOST',         value: caAuth.outputs.appFqdn }
      { name: 'AUTH_PORT',         value: '80' }
      { name: 'CATEGORIES_HOST',   value: caCategories.outputs.appFqdn }
      { name: 'CATEGORIES_PORT',   value: '80' }
      { name: 'TRANSACTIONS_HOST', value: caTransactions.outputs.appFqdn }
      { name: 'TRANSACTIONS_PORT', value: '80' }
      { name: 'FRONTEND_HOST',     value: caFrontend.outputs.appFqdn }
      { name: 'FRONTEND_PORT',     value: '80' }
    ]
    secretRefs: []
  }
}

output gatewayUrl string = 'https://${caGateway.outputs.appFqdn}'
