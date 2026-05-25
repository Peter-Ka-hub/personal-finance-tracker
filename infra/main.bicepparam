using './main.bicep'

param location = 'polandcentral'
param repositoryUrl = 'https://github.com/pjoter004/personal-finance-tracker'
param alertEmail = 'pjoter004@outlook.com'
param imageTag = 'latest'

// postgresAdminPassword — DO NOT store here. Set via:
// az deployment group create ... --parameters postgresAdminPassword=$DB_PASS
