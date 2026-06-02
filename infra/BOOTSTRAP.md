# Azure Bootstrap — jednorazowa konfiguracja

Wykonaj te kroki **raz**. Potem każdy `git push` na `master` automatycznie:
1. uruchamia testy jednostkowe (gate),
2. wdraża infrastrukturę bazową (`infra/base.bicep`),
3. buduje i wypycha 5 obrazów do ACR,
4. wdraża kontenery (`infra/apps.bicep`) do Azure Container Apps.

> Architektura w Azure (wszystko w kontenerach):
> `gateway` (Nginx, publiczny HTTPS) → `auth` / `categories` / `transactions` / `frontend`
> (wewnętrzne), dane w **Azure Database for PostgreSQL Flexible Server** (prywatny, VNet).

## 1. Zaloguj się i utwórz Resource Group

```bash
az login
az group create \
  --name rg-finance-tracker-prod \
  --location polandcentral \
  --tags env=prod app=finance-tracker
```

## 2. App Registration + OIDC (logowanie z GitHub Actions bez sekretów)

```bash
APP_ID=$(az ad app create --display-name "finance-tracker-github-oidc" --query appId -o tsv)
SP_ID=$(az ad sp create --id "$APP_ID" --query id -o tsv)
SUB_ID=$(az account show --query id -o tsv)

# Contributor na Resource Group (wystarcza — obrazy ciągniemy po haśle ACR,
# więc NIE są potrzebne uprawnienia do przypisywania ról).
az role assignment create \
  --assignee "$SP_ID" \
  --role Contributor \
  --scope "/subscriptions/$SUB_ID/resourceGroups/rg-finance-tracker-prod"

# WAŻNE: subject MUSI pasować do realnego repozytorium i gałęzi.
az ad app federated-credential create \
  --id "$APP_ID" \
  --parameters '{
    "name": "github-master",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:Peter-Ka-hub/personal-finance-tracker:ref:refs/heads/master",
    "audiences": ["api://AzureADTokenExchange"]
  }'

echo "AZURE_CLIENT_ID=$APP_ID"
echo "AZURE_TENANT_ID=$(az account show --query tenantId -o tsv)"
echo "AZURE_SUBSCRIPTION_ID=$SUB_ID"
```

> Jeśli federated credential został wcześniej utworzony dla innego repo
> (np. `pjoter004/...`), usuń go i utwórz ponownie z poprawnym `subject`,
> inaczej `azure/login` w Actions zwróci błąd `AADSTS70021`.

## 3. GitHub Secrets

Repo → Settings → Secrets and variables → Actions. Wymagane (i wystarczające):

| Secret                    | Wartość                                  |
| ------------------------- | ---------------------------------------- |
| `AZURE_CLIENT_ID`         | z kroku 2                                |
| `AZURE_TENANT_ID`         | z kroku 2                                |
| `AZURE_SUBSCRIPTION_ID`   | z kroku 2                                |
| `RESOURCE_GROUP`          | `rg-finance-tracker-prod`                |
| `POSTGRES_ADMIN_PASSWORD` | silne hasło (min. 16 znaków, bez `@/`)   |

> Sekrety `JWT_SECRET` i `INTERNAL_API_KEY` **nie są potrzebne** — są wyliczane
> deterministycznie w `apps.bicep` (`guid(resourceGroup().id, ...)`), identyczne
> dla wszystkich serwisów i stabilne między wdrożeniami. Pozostałości po starym
> układzie (`ACR_NAME`, `REGISTRY_*`, `SWA_DEPLOY_TOKEN`, `REACT_APP_API_URL`,
> `AZURE_APP_NAME`, `AZURE_WEBAPP_PUBLISH_PROFILE`) można usunąć.

## 4. Pierwszy deploy

Wypchnij na `master` albo uruchom ręcznie:
`Actions → Deploy to Azure → Run workflow`.

Workflow `deploy.yml` sam, w odpowiedniej kolejności:
- wdraża `base.bicep` (tworzy m.in. ACR i PostgreSQL),
- loguje się do ACR poświadczeniami admina,
- buduje i wypycha obrazy `auth`, `categories`, `transactions`, `gateway`, `frontend`,
- wdraża `apps.bicep` (5 Container Apps) na obrazach z bieżącego SHA.

Pierwsze wdrożenie trwa dłużej (provisioning PostgreSQL ~5–10 min).

## 5. Migracje bazy — automatyczne

Każdy serwis przy starcie wykonuje `connectDB()` → `createSchema(...)` +
`sequelize.sync({ alter: true })`, więc schematy (`auth`, `categories`,
`transactions`) i tabele tworzą się same. Brak ręcznego kroku migracji.

## 6. Adres aplikacji

Po wdrożeniu URL bramy pojawia się w podsumowaniu joba *Deploy* (oraz):

```bash
az containerapp show \
  --name ca-gateway \
  --resource-group rg-finance-tracker-prod \
  --query "properties.configuration.ingress.fqdn" -o tsv
```

Otwórz `https://<fqdn>` — frontend i API (`/api/...`) są pod tym samym hostem
(bez CORS), bo wszystko idzie przez bramę.
