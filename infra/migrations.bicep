param location string = 'polandcentral'
param environmentId string
param acrName string
param acrLoginServer string
param imageTag string
param postgresHost string
param postgresDbName string

@secure()
param postgresMigratorPassword string

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: acrName
}

resource migrationJob 'Microsoft.App/jobs@2024-03-01' = {
  name: 'ca-db-migrate'
  location: location
  properties: {
    environmentId: environmentId
    configuration: {
      triggerType: 'Manual'
      replicaTimeout: 480
      replicaRetryLimit: 0
      manualTriggerConfig: {
        parallelism: 1
        replicaCompletionCount: 1
      }
      registries: [
        {
          server: acrLoginServer
          username: acr.listCredentials().username
          passwordSecretRef: 'acr-password'
        }
      ]
      secrets: [
        { name: 'acr-password', value: acr.listCredentials().passwords[0].value }
        { name: 'migrator-password', value: postgresMigratorPassword }
      ]
    }
    template: {
      containers: [
        {
          name: 'migrate'
          image: '${acrLoginServer}/db-migrate:${imageTag}'
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            { name: 'PGHOST', value: postgresHost }
            { name: 'PGDATABASE', value: postgresDbName }
            { name: 'PGUSER', value: 'finance_migrator' }
            { name: 'PGPASSWORD', secretRef: 'migrator-password' }
            { name: 'PGSSLMODE', value: 'verify-full' }
            { name: 'PGSSLROOTCERT', value: '/etc/ssl/certs/ca-certificates.crt' }
            { name: 'PGCONNECT_TIMEOUT', value: '15' }
          ]
        }
      ]
    }
  }
}

output migrationJobName string = migrationJob.name
