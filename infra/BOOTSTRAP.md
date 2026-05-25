# Azure Bootstrap — jednorazowa konfiguracja

Uruchom te kroki **raz** przed pierwszym deplojem przez GitHub Actions.

## 1. Zaloguj się i utwórz Resource Group

```bash
az login
az group create \
  --name rg-finance-tracker-prod \
  --location polandcentral \
  --tags env=prod app=finance-tracker
```

## 2. Utwórz App Registration + OIDC (bez sekretów w GH)

```bash
# Utwórz App Registration
APP_ID=$(az ad app create --display-name "finance-tracker-github-oidc" --query appId -o tsv)
SP_ID=$(az ad sp create --id $APP_ID --query id -o tsv)

# Przypisz rolę Contributor na Resource Group
az role assignment create \
  --assignee $SP_ID \
  --role Contributor \
  --scope /subscriptions/$(az account show --query id -o tsv)/resourceGroups/rg-finance-tracker-prod

# Dodaj federated credential dla GitHub Actions
az ad app federated-credential create \
  --id $APP_ID \
  --parameters '{
    "name": "github-master",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:pjoter004/personal-finance-tracker:ref:refs/heads/master",
    "audiences": ["api://AzureADTokenExchange"]
  }'

echo "AZURE_CLIENT_ID=$APP_ID"
echo "AZURE_TENANT_ID=$(az account show --query tenantId -o tsv)"
echo "AZURE_SUBSCRIPTION_ID=$(az account show --query id -o tsv)"
```

## 3. Dodaj GitHub Secrets

W repo → Settings → Secrets → Actions, dodaj:

| Secret                    | Wartość                                         |
| ------------------------- | ----------------------------------------------- |
| `AZURE_CLIENT_ID`         | z kroku 2                                       |
| `AZURE_TENANT_ID`         | z kroku 2                                       |
| `AZURE_SUBSCRIPTION_ID`   | z kroku 2                                       |
| `RESOURCE_GROUP`          | `rg-finance-tracker-prod`                       |
| `ACR_NAME`                | `acrfinancetracker`                             |
| `POSTGRES_ADMIN_PASSWORD` | silne hasło (min. 16 znaków)                    |
| `REACT_APP_API_URL`       | `https://<gateway-fqdn>/api` (po deployu infra) |
| `SWA_DEPLOY_TOKEN`        | z Azure Portal → Static Web App → Manage token  |

## 4. Uruchom infra workflow (pierwszy deploy)

```bash
# Lub przez GitHub UI: Actions → Deploy Infrastructure → Run workflow → deploy
az deployment group create \
  --resource-group rg-finance-tracker-prod \
  --template-file infra/main.bicep \
  --parameters infra/main.bicepparam \
  --parameters postgresAdminPassword="$POSTGRES_ADMIN_PASSWORD"
```

## 5. Wstrzyknij sekrety do Key Vault (po deployu infra)

```bash
KV_NAME="kv-finance-tracker"

az keyvault secret set --vault-name $KV_NAME --name "DB-PASSWORD"       --value "$POSTGRES_ADMIN_PASSWORD"
az keyvault secret set --vault-name $KV_NAME --name "JWT-SECRET"        --value "$(openssl rand -base64 48)"
az keyvault secret set --vault-name $KV_NAME --name "INTERNAL-API-KEY"  --value "$(openssl rand -base64 32)"
```

## 6. Uruchom migracje DB (jednorazowo)

```bash
# Wykonaj syncModels w serwisie auth (stworzy schematy auth/categories/transactions + tabele)
az containerapp exec \
  --name ca-auth \
  --resource-group rg-finance-tracker-prod \
  --command "node -e \"require('./src/config/db').connectDB()\""
```

## 7. Skonfiguruj REACT_APP_API_URL

Po deployu infra pobierz URL gatewaya i zaktualizuj GH Secret:

```bash
az containerapp show \
  --name ca-gateway \
  --resource-group rg-finance-tracker-prod \
  --query "properties.configuration.ingress.fqdn" -o tsv
```

Ustaw `REACT_APP_API_URL=https://<powyższy-fqdn>/api` w GitHub Secrets,
następnie uruchom ręcznie workflow `deploy-frontend.yml`.
