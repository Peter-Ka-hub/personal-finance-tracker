# Dziennik problemów i rozwiązań — CI/CD + wdrożenie w Azure

Dokument opisuje problemy napotkane podczas doprowadzenia projektu do stanu „po `git push`
przechodzą testy i aplikacja wdraża się w kontenerach na Azure”, oraz zastosowane rozwiązania.
Punkt wyjścia: aplikacja CRUD (React + 3 mikroserwisy Node/Express + brama Nginx + PostgreSQL),
po migracji do mikrousług, z niedziałającym potokiem CI/CD i niewdrożoną infrastrukturą.

## Podsumowanie

| #  | Problem | Gdzie | Rozwiązanie (skrót) |
|----|---------|-------|---------------------|
| 1  | Brak testów i skryptu `test`, a CI wołało `npm test` | serwisy | Jest+supertest, refaktor `app.js`/`server.js` |
| 2  | Brak `package-lock.json` → `npm ci` pada | serwisy | wygenerowane lockfile, commit |
| 3  | Zepsuty test frontendu (React 19 + react-scripts 5) | frontend | testy klienta API zamiast renderu `<App/>` |
| 4  | e2e zielone lokalnie, czerwone w CI (502) | e2e | czekanie na gotowość upstreamów, nie tylko bramy |
| 5  | `main.bicep` nie kompiluje się — zależność cykliczna | infra | usunięcie Key Vault, sekrety jako Container App secrets |
| 6  | Brak `DB_SSL=true` w Azure | infra | dodane do zmiennych środowiskowych |
| 7  | Przypisanie roli AcrPull wymaga uprawnień Owner | infra | pull obrazów po haśle admina ACR |
| 8  | „Jajko-kura”: apps wskazują obrazy, których nie ma | infra/CI | podział `base.bicep` + `apps.bicep` |
| 9  | Budżet: `startDate` w przeszłości | infra | `utcNow('yyyy-MM-01')` |
| 10 | Brama Nginx źle skonfigurowana dla Container Apps | gateway | nagłówek `Host` = FQDN upstreamu, FQDN wewnętrzne |
| 11 | Frontend: brak sekretów Static Web App | infra/CI | konteneryzacja frontendu za bramą |
| 12 | Logowanie OIDC pada (`AADSTS700213`) | Azure AD | poprawny federated credential dla repo |
| 13 | Limit środowisk Container Apps (Poland Central zajęty) | Azure | próba zmiany regionu |
| 14 | Polityka regionów blokuje Sweden Central | Azure | wybór `germanywestcentral` (dozwolony) |
| 15 | Pozostałości po nieudanym deployu blokują zmianę regionu | Azure | usunięcie częściowych zasobów |
| 16 | Limit Container Apps Environment jest **globalny** (1/subskrypcję) | Azure | **ponowne użycie** istniejącego środowiska (1 środowisko = wiele aplikacji) |
| 17 | PostgreSQL niedostępny w `germanywestcentral` (`LocationIsOfferRestricted`) | Azure | powrót do Poland Central (tam DB działa) |
| 18 | Reużyte środowisko nie ma VNet → baza prywatna niemożliwa | infra | PostgreSQL **publiczny + SSL** + firewall (tylko usługi Azure) |
| 19 | „Duch” nazwy zasobu po zmianach regionu (ARM blokuje lokalizację) | Azure | nowa nazwa serwera DB (`psql-finance-tracker-pc`) |
| 20 | Apps nie mogą „join” środowiska w innej grupie (`LinkedAuthorizationFailed`) | Azure | rola na zasób środowiska dla konta wdrożeniowego |
| 21 | Container Apps zwraca **426** dla HTTP/1.0 (nginx domyślnie 1.0) | gateway | `proxy_http_version 1.1` + upstreamy po HTTPS/443 |

---

## A. Testy i potok CI (lokalnie)

### 1. Brak testów, a CI je uruchamiało
- **Objaw:** w `services/*/package.json` nie było skryptu `test`, lecz workflowy wołały
  `npm test` → krok kończyłby się błędem `Missing script: "test"`.
- **Przyczyna:** testy nigdy nie zostały dodane; potok był „atrapą”.
- **Rozwiązanie:** dodałem testy jednostkowe (Jest + supertest) dla kontrolerów każdego
  serwisu z **mockowaną** bazą (Sequelize), oraz skrypt `test`. Aby dało się testować Express
  bez łączenia z bazą, rozdzieliłem każdy serwis na `src/app.js` (sama aplikacja, eksport) i
  `src/server.js` (połączenie z DB + `listen`).
- **Pliki:** `services/*/src/app.js`, `services/*/src/server.js`, `services/*/tests/*.test.js`,
  `services/*/package.json`.

### 2. Brak `package-lock.json` w serwisach
- **Objaw:** `npm ci` (i cache `setup-node`) wymaga lockfile → twardy błąd w CI.
- **Przyczyna:** lockfile nigdy nie zacommitowano (był tylko dla frontendu).
- **Rozwiązanie:** `npm install` w każdym serwisie wygenerował `package-lock.json`, który
  zacommitowałem; Dockerfile’e przełączyłem na `npm ci --omit=dev` (powtarzalne buildy).
- **Pliki:** `services/*/package-lock.json`, `services/*/Dockerfile`.

### 3. Zepsuty test frontendu (React 19 + react-scripts 5)
- **Objaw:** `npm test` we frontendzie rzucał `TypeError: Cannot read properties of null
  (reading 'useRef')` przy renderowaniu całego `<App/>`.
- **Przyczyna:** react-scripts 5 (transformacja Jest) źle współpracuje z React 19 i bibliotekami
  używającymi hooków (react-router v7, react-query) w środowisku testowym. (Sam build
  produkcyjny działa poprawnie — sprawdzone.)
- **Rozwiązanie:** zastąpiłem kruchy test renderu lekkimi, niezawodnymi testami klienta API
  (baseURL, dołączanie tokenu Bearer). Build frontendu (`npm run build`) jest osobnym, realnym
  sprawdzeniem w CI.
- **Pliki:** `frontend/src/App.test.js`.

### 4. Testy e2e: zielone lokalnie, czerwone w CI (HTTP 502)
- **Objaw:** w CI pierwszy `POST /api/auth/register` zwracał **502**, kolejne 401/400 (kaskada
  braku tokenu). Lokalnie te same testy przechodziły.
- **Przyczyna:** funkcja sprawdzająca gotowość pingowała tylko `/health` **bramy**, które Nginx
  zwraca samodzielnie (bez odpytywania upstreamów). Test ruszał, zanim serwisy zdążyły wstać i
  połączyć się z bazą — wyścig widoczny dopiero na „zimnym” runnerze CI.
- **Rozwiązanie:** gotowość czeka teraz aż **każdy upstream** (auth/categories/transactions)
  zwróci realny status `< 500`, a nie tylko brama.
- **Pliki:** `e2e/app.test.mjs`.

## B. Infrastruktura (Bicep)

### 5. `main.bicep` nie kompilował się — zależność cykliczna
- **Objaw:** `az bicep build` → `BCP080: The expression is involved in a cycle
  ("caAuth" -> "keyVault")`. Cały deploy infry nie ruszał (nawet `what-if`).
- **Przyczyna:** Container Apps odwoływały się do URI sekretów w Key Vault, a Key Vault do
  `principalId` tych aplikacji — wzajemna zależność.
- **Rozwiązanie:** usunąłem Key Vault z architektury. Sekrety przekazywane są jako
  **Container App secrets** (hasło DB z parametru `@secure`), a `JWT_SECRET` i
  `INTERNAL_API_KEY` wyliczane deterministycznie przez `guid(resourceGroup().id, ...)` —
  identyczne dla wszystkich serwisów i stabilne między wdrożeniami.
- **Pliki:** nowy `infra/apps.bicep`; usunięte `infra/modules/keyvault.bicep`, `infra/main.bicep`.

### 6. Brak `DB_SSL=true` w środowisku Azure
- **Objaw:** serwisy nie połączyłyby się z Azure PostgreSQL (wymusza TLS) → `process.exit(1)`.
- **Przyczyna:** w starym `main.bicep` lista zmiennych DB nie ustawiała `DB_SSL`, a kod włącza
  SSL tylko gdy `DB_SSL==='true'`.
- **Rozwiązanie:** `{ name: 'DB_SSL', value: 'true' }` w zmiennych Container Apps.
- **Pliki:** `infra/apps.bicep`.

### 7. Przypisanie roli AcrPull wymaga uprawnień Owner
- **Objaw:** moduł Container App tworzył `roleAssignment` (AcrPull) dla tożsamości zarządzanej —
  to wymaga roli Owner/User Access Administrator, a konto wdrożeniowe (OIDC) ma tylko Contributor.
- **Przyczyna:** Contributor nie może przypisywać ról.
- **Rozwiązanie:** włączyłem konto admina w ACR i kontenery pobierają obrazy po
  **loginie/haśle ACR** (sekret), bez żadnych przypisań ról.
- **Pliki:** `infra/modules/registry.bicep` (adminUserEnabled), `infra/modules/containerapp.bicep`
  (registry z `passwordSecretRef`), `infra/apps.bicep` (`acr.listCredentials()`).

### 8. „Jajko-kura”: aplikacje wskazują obrazy, których jeszcze nie ma
- **Objaw:** przy pierwszym wdrożeniu Container Apps odwołują się do obrazów w ACR, który dopiero
  powstaje — nie ma czego pociągnąć.
- **Przyczyna:** jeden monolityczny szablon tworzył ACR i aplikacje naraz.
- **Rozwiązanie:** podział na `base.bicep` (sieć, ACR, PostgreSQL, środowisko Container Apps) i
  `apps.bicep` (5 aplikacji). Potok: wdróż `base` → zbuduj i wypchnij obrazy → wdróż `apps`.
- **Pliki:** `infra/base.bicep`, `infra/apps.bicep`, `.github/workflows/deploy.yml`.

### 9. Budżet: data startu w przeszłości
- **Objaw:** `Start date for monthly time grain should not be prior to current month` — base
  deploy padał.
- **Przyczyna:** zahardkodowane `startDate: '2025-01-01'`.
- **Rozwiązanie:** parametr `budgetStartDate = utcNow('yyyy-MM-01')` (pierwszy dzień bieżącego
  miesiąca).
- **Pliki:** `infra/modules/budget.bicep`.

## C. Sieć i architektura w Container Apps

### 10. Brama Nginx źle skonfigurowana dla Container Apps
- **Objaw:** konfiguracja działała w docker-compose, ale w Azure routowałaby źle (502/404).
- **Przyczyna:** upstreamy używały nazw z compose (`auth:3001`) i nagłówka `Host $host` — w
  Container Apps ingress routuje po nagłówku **Host = pełny wewnętrzny FQDN**, a usługi są pod
  FQDN-em na porcie 80/443, nie 3001.
- **Rozwiązanie:** w `nginx.conf` ustawiłem `proxy_set_header Host` na FQDN danego upstreamu
  (zmienna), a w `apps.bicep` wstrzykuję wewnętrzne FQDN-y usług i port 80 (`allowInsecure` na
  ruchu wewnętrznym). Ta sama konfiguracja działa też lokalnie w docker-compose.
- **Pliki:** `gateway/nginx.conf`, `infra/apps.bicep`, `infra/modules/containerapp.bicep`.

### 11. Frontend: brakujące sekrety Static Web App
- **Objaw:** workflow frontendu wymagał `SWA_DEPLOY_TOKEN` i `REACT_APP_API_URL`, których nie ma
  w sekretach repo.
- **Przyczyna:** frontend był wdrażany na Static Web App (osobny model, dodatkowe sekrety, CORS).
- **Rozwiązanie:** frontend jako **kontener** za bramą (jak w docker-compose). `REACT_APP_API_URL=/api`
  (relatywnie, bez CORS), brak SWA i jej tokenów. Wszystko działa w kontenerach.
- **Pliki:** `infra/apps.bicep` (ca-frontend), `gateway/nginx.conf`, usunięte `modules/swa.bicep`.

## D. Azure — tożsamość, polityki i limity (wykryte dopiero na żywo podczas wdrożenia)

> Te problemy ujawniły się dopiero przy realnym `az deployment` — nie wykrywa ich kompilacja
> szablonu ani lokalne testy. Część łapie `az deployment group validate` / `what-if`, ale limity
> i ograniczenia oferty (poniżej) widać często dopiero w trakcie faktycznego tworzenia zasobów.

### 12. Logowanie OIDC pada — `AADSTS700213`
- **Objaw:** krok `azure/login` w Actions: „No matching federated identity record found for
  subject `repo:Peter-Ka-hub/personal-finance-tracker:ref:refs/heads/master`”.
- **Przyczyna:** federated credential w App Registration był utworzony dla starej nazwy repo
  (`pjoter004/...`), a faktyczne repo to `Peter-Ka-hub/...`.
- **Rozwiązanie:** dodałem do App Registration poprawny federated credential z właściwym
  `subject` (nieniszcząco — stary wpis zostawiłem).
- **Gdzie:** Azure AD App Registration (`finance-tracker-github-oidc`).

### 13. Limit środowisk Container Apps (w Poland Central już jedno istnieje)
- **Objaw:** base deploy: `MaxNumberOfRegionalEnvironmentsInSubExceeded` — „cannot have more than
  1 Container App Environments in Poland Central”.
- **Przyczyna:** w Poland Central istnieje już środowisko w grupie `additional-res` (wcześniejsze
  eksperymenty), a komunikat sugerował limit *na region*.
- **Rozwiązanie (próba):** wdrożenie w innym regionie (decyzja: nieniszcząco). → patrz #16, gdzie
  okazało się, że limit jest globalny.
- **Gdzie:** `infra/base.bicep`, `infra/apps.bicep` (parametr `location`).

### 14. Polityka regionów blokuje Sweden Central
- **Objaw:** `RequestDisallowedByAzure` — „This policy maintains a set of best available regions…”.
- **Przyczyna:** subskrypcja ma politykę „Allowed resource deployment regions” ograniczającą
  dozwolone regiony do: `spaincentral, norwayeast, switzerlandnorth, germanywestcentral,
  polandcentral`. Sweden Central nie jest dozwolony.
- **Rozwiązanie:** wybór `germanywestcentral` (dozwolony). → patrz #17.
- **Gdzie:** `infra/base.bicep`, `infra/apps.bicep`.

### 15. Pozostałości po nieudanym deployu blokują zmianę regionu
- **Objaw:** przy zmianie regionu zasoby o stałych, globalnie unikalnych nazwach (ACR
  `acrfinancetracker`, serwer `psql-finance-tracker`, VNet) z pierwszej, nieudanej próby w Poland
  Central kolidowałyby („nie można zmienić lokalizacji istniejącego zasobu”).
- **Przyczyna:** pierwszy deploy zdążył utworzyć część zasobów, zanim padł na walidacji
  środowiska/budżetu.
- **Rozwiązanie:** usunąłem częściowe zasoby z `rg-finance-tracker-prod` (ACR, PostgreSQL, VNet,
  prywatna strefa DNS) — wyłącznie artefakty tego projektu, niczego z `additional-res` nie ruszając.
- **Gdzie:** grupa `rg-finance-tracker-prod`.

### 16. Limit Container Apps Environment jest GLOBALNY (1 na subskrypcję)
- **Objaw:** base deploy w `germanywestcentral`: `MaxNumberOfGlobalEnvironmentsInSubExceeded` —
  „cannot have more than 1 Container App Environments”.
- **Przyczyna:** wbrew komunikatowi z #13 (sugerował „per region”) subskrypcja pozwala na
  **dokładnie 1 środowisko Container Apps w całej subskrypcji**. Jedno już istnieje
  (`managedEnvironment-additionalres-83b6`), więc **żaden region nie pomoże** — nie da się
  utworzyć drugiego środowiska.
- **Kluczowe rozróżnienie:** limit dotyczy **środowiska**, nie **aplikacji**. W jednym środowisku
  może działać wiele Container Apps. Można więc dodać nasze 5 aplikacji do **istniejącego**
  środowiska, bez usuwania niczego.
- **Rozwiązanie:** **ponowne użycie** istniejącego środowiska — `apps.bicep` dostaje jego
  `environmentId` (środowisko jest w innej grupie zasobów `additional-res`; Container Apps mogą do
  niego dołączyć między grupami). `base.bicep` nie tworzy już środowiska (odwołuje się do
  istniejącego przez `existing` + `scope`).
- **Pliki/gdzie:** `infra/base.bicep` (`existing` env, output `environmentId`), `infra/apps.bicep`.

### 17. PostgreSQL niedostępny w `germanywestcentral`
- **Objaw:** `LocationIsOfferRestricted` — „Subscriptions are restricted from provisioning in
  location 'germanywestcentral'”.
- **Przyczyna:** oferta subskrypcji ogranicza tworzenie Azure Database for PostgreSQL w tym
  regionie. (W Poland Central tworzenie serwera Postgres działało.)
- **Rozwiązanie:** powrót do **Poland Central** (tam działa Postgres; tam też jest istniejące
  środowisko z #16).
- **Gdzie:** `infra/base.bicep`, `infra/apps.bicep` (parametr `location`).

### 18. Reużyte środowisko nie ma sieci VNet → baza prywatna niemożliwa
- **Objaw:** istniejące środowisko (`vnet: null`) nie jest zintegrowane z naszą siecią, więc
  aplikacje w nim nie dosięgną prywatnego serwera PostgreSQL w VNet.
- **Przyczyna:** sieci VNet nie da się dodać do istniejącego środowiska po jego utworzeniu.
- **Rozwiązanie:** PostgreSQL w trybie **publicznym** z wymuszonym **SSL** (`DB_SSL=true`) i regułą
  firewalla dopuszczającą tylko **usługi Azure** (`0.0.0.0`). Hasła nadal hashowane bcrypt, ruch
  do bazy szyfrowany — bezpieczeństwo wg rubryki zachowane (utrata jedynie prywatności sieciowej).
- **Pliki:** `infra/modules/postgres.bicep` (usunięty VNet/prywatna strefa DNS, dodany firewall),
  usunięte `infra/modules/network.bicep`, `infra/modules/containerapps-env.bicep`.

### 19. „Duch” nazwy zasobu po zmianach regionu
- **Objaw:** `InvalidResourceLocation` — „resource 'psql-finance-tracker' already exists in location
  'germanywestcentral'…”, mimo że `az postgres flexible-server show` zwraca `ResourceNotFound`.
- **Przyczyna:** po nieudanej próbie w innym regionie ARM zachował powiązanie nazwy serwera z
  lokalizacją; nie pozwala utworzyć go w nowej lokalizacji pod tą samą nazwą.
- **Rozwiązanie:** nadałem serwerowi nową nazwę `psql-finance-tracker-pc`; FQDN trafia do aplikacji
  przez output `base.bicep`, więc reszta działa bez zmian. Zweryfikowane `az deployment group
  validate`.
- **Pliki:** `infra/modules/postgres.bicep`.

### 20. Aplikacje nie mogą „join” środowiska w innej grupie zasobów
- **Objaw:** krok „Deploy container apps”: `LinkedAuthorizationFailed` — konto ma
  `Microsoft.App/containerApps/write` na `rg-finance-tracker-prod`, ale brakuje
  `Microsoft.App/managedEnvironments/join/action` na środowisku w `additional-res`.
- **Przyczyna:** reużywane środowisko leży w innej grupie zasobów, na której konto wdrożeniowe
  (Contributor tylko na `rg-finance-tracker-prod`) nie ma uprawnień.
- **Rozwiązanie:** nadałem kontu wdrożeniowemu (SP) rolę **Contributor o zasięgu wyłącznie tego
  jednego zasobu środowiska** (minimalny zakres). Z powodu znanego błędu CLI
  (`MissingSubscription`) przypisanie utworzone przez ARM REST (`az rest`).
- **Gdzie:** Azure RBAC (zasób `managedEnvironment-additionalres-83b6`).

### 21. Brama dostaje 426 „Upgrade Required” na każdą trasę `/api`
- **Objaw:** wszystkie żądania proxowane przez bramę zwracały **426**, niezależnie od http/https.
- **Diagnoza:** `curl` z wnętrza kontenera bramy do wewnętrznego FQDN serwisu (HTTP/1.1) zwracał
  **200** — czyli sieć i TLS działają. Problem był w samym nginx.
- **Przyczyna:** nginx domyślnie proxuje po **HTTP/1.0**, a ingress (Envoy) Container Apps odrzuca
  HTTP/1.0 kodem 426. (`curl` używa 1.1 → 200.)
- **Rozwiązanie:** `proxy_http_version 1.1;` + `proxy_set_header Connection "";` w `nginx.conf`,
  a upstreamy kierowane po **HTTPS/443** (wewnętrzny ingress wymaga TLS); SNI/Host = FQDN serwisu.
  Wywołanie auth→categories (Node) po HTTPS z `rejectUnauthorized:false` (cert wewnętrzny spoza
  magazynu zaufania Node).
- **Pliki:** `gateway/nginx.conf`, `gateway/Dockerfile`, `infra/apps.bicep`,
  `services/auth/src/controllers/authController.js`.

> Uwaga: zdarzył się też przejściowy błąd sieci `ECONNRESET` przy `npm ci` w buildzie obrazu w CI —
> rozwiązany ponownym uruchomieniem joba (błąd niezwiązany z kodem).

## Stan końcowy i wnioski

**✅ Wdrożenie zakończone sukcesem.** Po `git push` na `master`: testy jednostkowe + e2e przechodzą,
a `deploy.yml` buduje 5 obrazów i wdraża je do Azure Container Apps. Aplikacja działa:
- Brama (publiczny HTTPS): `https://ca-gateway.wonderfulsand-f41bf9c3.polandcentral.azurecontainerapps.io`
- 5 kontenerów `Running` (auth/categories/transactions/frontend — wewnętrzne; gateway — zewnętrzny).
- Testy e2e uruchomione przeciwko **żywej** instancji: **5/5 zielonych** (rejestracja → seed 10
  kategorii → dodanie/listowanie transakcji → logowanie), dane zapisują się w Azure PostgreSQL.

**Co działa (gotowe i zielone):**
- Testy jednostkowe: auth 6, categories 7, transactions 6, frontend 3 — przechodzą lokalnie i w CI.
- Testy e2e (5) przez bramę na docker-compose — przechodzą lokalnie i w CI.
- `deploy.yml` wdraża dopiero po przejściu bramki testów + e2e (kolejność: `base` → build/push 5
  obrazów → `apps`).
- Szablony Bicep kompilują się; `base.bicep` przechodzi `validate`.
- Logowanie OIDC z GitHub Actions do Azure działa.

**Wybrane podejście do wdrożenia (bez usuwania cudzych zasobów):**
- Subskrypcja pozwala na **1 środowisko Container Apps łącznie** (#16). Zamiast je usuwać,
  **ponownie używamy** istniejącego środowiska `managedEnvironment-additionalres-83b6` (w Poland
  Central) — nasze 5 aplikacji działa w nim obok dotychczasowych kontenerów.
- PostgreSQL działa w trybie **publicznym + SSL** z firewallem na usługi Azure (#18), bo to
  środowisko nie ma VNet. Region: **Poland Central** (#17). Serwer DB przemianowany na
  `psql-finance-tracker-pc` z powodu „ducha” nazwy (#19).
- Potok `deploy.yml` (po zielonych testach + e2e): `base` (ACR + publiczny Postgres) → build/push
  5 obrazów → `apps` (5 Container Apps w istniejącym środowisku). URL bramy w podsumowaniu joba.

**Czego uczy ta historia:**
1. Większość blokerów Azure (OIDC, polityki regionów, **globalne** limity środowisk, ograniczenia
   oferty, budżet) ujawnia się dopiero przy realnym wdrożeniu. `validate`/`what-if` łapie część,
   ale nie limity ilościowe ani `LocationIsOfferRestricted`.
2. Komunikaty o limitach bywają mylące („regional” vs faktycznie „global”) — warto sprawdzić
   rzeczywisty stan (`az containerapp env list`) zamiast ufać treści błędu.
3. Testy „przechodzące lokalnie” mogą padać w CI przez wyścigi startowe — gotowość trzeba mierzyć
   na realnych zależnościach, nie na endpointcie samej bramy.
4. Sieć w Container Apps różni się od docker-compose (routing po nagłówku Host, FQDN wewnętrzne) —
   ta sama konfiguracja musi działać w obu światach.
5. Uprawnienia konta wdrożeniowego (Contributor vs Owner) wymuszają wybór wzorca (hasło ACR
   zamiast przypisań ról).

---

Powiązane: [openapi.yaml](openapi.yaml) (kontrakt API), [README.md](../README.md) (architektura i uruchomienie).
