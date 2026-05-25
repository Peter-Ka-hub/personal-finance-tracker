@description('Location for all resources')
param location string

@description('Tags to apply to all resources')
param tags object

@description('Principal IDs of managed identities that need secret access')
param identityPrincipalIds array

var keyVaultName = 'kv-finance-tracker'

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    publicNetworkAccess: 'Enabled'
  }
}

// Assign Key Vault Secrets User role to each Container App managed identity
resource kvRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for (principalId, i) in identityPrincipalIds: {
  name: guid(keyVault.id, principalId, '4633458b-17de-408a-b874-0445c86b69e6')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6') // Key Vault Secrets User
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}]

output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
