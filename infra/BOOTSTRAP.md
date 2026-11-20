# Azure Bootstrap — jednorazowa konfiguracja

Po jednorazowym przygotowaniu ról i bazy zatwierdzony push na `master`
uruchamia następujące kroki.

1. uruchamia testy jednostkowe (gate),
2. wdraża infrastrukturę bazową (`infra/base.bicep`),
3. buduje i wypycha obrazy aplikacji i migratora do ACR,
4. uruchamia migracje w `ca-db-migrate`,
5. po sukcesie migracji wdraża aplikacje przez `infra/apps.bicep`.

> Architektura w Azure (wszystko w kontenerach):
> `gateway` (Nginx, publiczny HTTPS) → `auth` / `categories` / `transactions` / `frontend`
> (wewnętrzne). Azure Database for PostgreSQL Flexible Server ma publiczny
> endpoint z regułami firewalla. Job migracji działa w tym samym Azure
> Container Apps Environment co aplikacje. Weryfikację certyfikatów i
> kolejność zawężania reguł opisuje [instrukcja sieciowa](NETWORKING.md).

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

Ustaw wartości w **Settings → Secrets and variables → Actions → Repository secrets**.

| Secret                    | Wartość                                  |
| ------------------------- | ---------------------------------------- |
| `AZURE_CLIENT_ID`         | z kroku 2                                |
| `AZURE_TENANT_ID`         | z kroku 2                                |
| `AZURE_SUBSCRIPTION_ID`   | z kroku 2                                |
| `RESOURCE_GROUP`          | `rg-finance-tracker-prod`                |
| `POSTGRES_ADMIN_PASSWORD` | hasło administratora PostgreSQL          |
| `POSTGRES_MIGRATOR_PASSWORD` | hasło `finance_migrator` używane przez job migracji |
| `POSTGRES_AUTH_PASSWORD` | hasło `finance_auth` |
| `POSTGRES_CATEGORIES_PASSWORD` | hasło `finance_categories` |
| `POSTGRES_TRANSACTIONS_PASSWORD` | hasło `finance_transactions` |
| `JWT_SECRET`              | losowy klucz współdzielony przez Auth, Categories i Transactions |
| `INTERNAL_API_KEY`        | niezależny losowy klucz współdzielony przez Auth i Categories |

Dla każdego klucza aplikacyjnego wygeneruj oddzielnie co najmniej 32 losowe bajty.
Poniższe polecenia uruchom po uzyskaniu zgody na ustawienie lub wymianę sekretów.
OpenSSL koduje 32 bajty w 64 znaki hex, a potok przekazuje wynik do GitHuba bez
wyświetlania wartości. Wykonaj polecenia z katalogu tego repozytorium.

```bash
openssl rand -hex 32 | gh secret set JWT_SECRET
openssl rand -hex 32 | gh secret set INTERNAL_API_KEY
```

Zachowaj te same wartości w GitHub Actions między wydaniami aż do zaplanowanej
rotacji. Kopię zapasową sekretów, jeśli jest potrzebna, przechowuj w zatwierdzonym
menedżerze haseł. Workflow sprawdza komplet wartości przed logowaniem do Azure
przez OIDC. Przekazuje wrażliwe parametry przez tymczasowe pliki na runnerze,
usuwane na końcu odpowiednich kroków.

## 4. Pierwszy deploy

Ustaw wymaganą zmienną repozytorium `POSTGRES_FIREWALL_CONFIG` zgodnie z
[instrukcją sieciową](NETWORKING.md#1-potwierdź-tls-przed-zmianą-firewalla).
Przy istniejącej regule Azure-wide zacznij od trybu `overlap`.

Przed pierwszym uruchomieniem workflow przygotuj role w istniejącej lub nowej
bazie zgodnie z [instrukcją migracji](../db/README.md#pierwsze-przejście-w-azure).
Po zatwierdzeniu wdrożenia uruchom **Actions → Deploy to Azure → Run workflow**
dla `master`. Aktualizacja `master`, w tym scalenie PR, również uruchamia
ten workflow. Przy przejściu ze starego szablonu zastosuj poniższą procedurę
rotacji przed dopuszczeniem zmian na `master`.

Workflow `deploy.yml` sam, w odpowiedniej kolejności:
- wdraża `base.bicep` (tworzy m.in. ACR i PostgreSQL),
- loguje się do ACR poświadczeniami admina,
- buduje i wypycha obrazy `auth`, `categories`, `transactions`, `gateway`, `frontend` i `db-migrate`,
- uruchamia `ca-db-migrate` z obrazem danego SHA i czeka na `Succeeded`,
- wdraża `apps.bicep` (5 Container Apps) na obrazach z bieżącego SHA.

Pierwsze wdrożenie trwa dłużej (provisioning PostgreSQL ~5–10 min).

### Rotacja po przejściu ze starego szablonu

1. Uzgodnij okno serwisowe i uzyskaj osobną zgodę na wdrożenie i rotację.
   W **Resource Group → Deployments** zidentyfikuj poprzednie wdrożenia
   `apps-*` oraz zagnieżdżone `ca-auth`, `ca-categories` i `ca-transactions`.
   Sprawdź, które tożsamości mogły czytać ich parametry, uwzględniając role
   dziedziczone oraz ewentualne eksporty. Stary parametr `secretRefs` był
   zwykłą tablicą. Jeśli użyto tego szablonu, potraktuj hasło administratora
   PostgreSQL jako potencjalnie ujawnione i obróć je. Ogranicz zbędny dostęp
   do historii i zastosuj zasady obsługi incydentów organizacji.
2. Ustaw oba nowe klucze w GitHub Actions zgodnie z krokiem 3. Przy rotacji
   bazy zapisz też nowe `POSTGRES_ADMIN_PASSWORD`. Wstrzymaj inne wdrożenia
   na czas zmiany. `base.bicep` ustawia hasło administratora. Podczas przejścia
   rewizje korzystające ze starego hasła wymagają skoordynowanego odświeżenia.
   Nowe rewizje używają dedykowanych ról i haseł.
3. Wdróż zatwierdzoną wersję z zabezpieczonym Bicep i poprawką bramy. Sprawdź
   gotowość nowych rewizji i to, czy ruch trafia do nich. Sama aktualizacja
   sekretu nie tworzy rewizji. Przy ponowieniu z tym samym obrazem zrestartuj
   każdą aktywną rewizję korzystającą ze zmienionych sekretów. Wymiana klucza
   JWT unieważnia dotychczasowe tokeny po przełączeniu wszystkich usług.
   Użytkownicy muszą zalogować się ponownie. Jeśli pulpit nadal używa starej
   sesji, powinni się wylogować i ponownie zalogować.
4. Sprawdź po wdrożeniu logowanie, dostęp do własnych transakcji i kategorii
   oraz odrzucenie starego tokenu przez chronione API. Na koncie testowym
   sprawdź, czy rejestracja tworzy 10 domyślnych kategorii i czy działa
   publiczne dodanie kategorii po zalogowaniu. Żądanie
   `POST /api/categories/seed` przez publiczną bramę powinno zwrócić 404.
5. Sprawdź w Azure **Deployments → Inputs** dla nowych wdrożeń `base-*`,
   `db-job-*`, `apps-*` i ich modułów. Sprawdź, czy hasła bazy, klucze
   aplikacyjne, `appSecrets` i `acrPassword` są ukryte
   tam, gdzie dany parametr występuje. Sprawdź również, czy w Outputs wdrożeń
   i podsumowaniu GitHub Actions są wyłącznie metadane. Przy przeglądzie
   starszych wdrożeń nie eksportuj ani nie kopiuj wartości.

Przy kolejnych rotacjach stosuj tę samą kolejność dla zmienianych sekretów.
Po rotacji klucza wewnętrznego sprawdź zwłaszcza rejestrację, ponieważ Auth
i Categories muszą korzystać z tej samej nowej wartości.

### Odzyskanie działania po nieudanej rotacji

Jeśli baza została zaktualizowana, a kontenery nie są gotowe, zachowaj nowe
`POSTGRES_ADMIN_PASSWORD` i sprawdź stan kroku `base`. Ponów zatwierdzone
wdrożenie z tym samym zestawem nowych sekretów, poczekaj na gotowość rewizji
i w razie potrzeby zrestartuj aktywne rewizje powiązane z rotacją. Jeśli
usterka dotyczy obrazu aplikacji, przywróć sprawdzoną wersję kodu aplikacji
w kolejnym wydaniu, zachowując nowy szablon Bicep, nowe sekrety i blokadę
inicjalizacji w bramie. Przywrócenie poprzedniego szablonu aktywowałoby
deterministyczne klucze. Przed przywróceniem ruchu powtórz kontrole z punktów
4 i 5.

## 5. Migracje bazy

Migracje SQL wykonuje `finance_migrator` w jednorazowym Azure Container Apps
Job. Usługi przy starcie sprawdzają połączenie na rolach wykonawczych.
Przejęcie schematu, kolejność przełączenia i wycofanie aplikacji opisuje
[dokumentacja migracji](../db/README.md).

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

> Szczegóły endpointów API: [docs/openapi.yaml](../docs/openapi.yaml).
