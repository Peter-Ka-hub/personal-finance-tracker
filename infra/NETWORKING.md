# TLS i dostęp do PostgreSQL w Azure

## Model sieci i magazyny zaufania

`infra/base.bicep` wskazuje istniejące, współdzielone środowisko Container Apps.
Tylko brama aplikacji ma publiczny ingress. PostgreSQL nadal ma publiczny
endpoint z firewallem. Reguła `AllowAllAzureServices` jest utrzymywana podczas
przejścia w trybie `overlap`. Przed zawężeniem sprawdź konfigurację VNet, profil
oraz faktyczny ruch wyjściowy tego środowiska. [Sieć Container Apps](https://learn.microsoft.com/azure/container-apps/networking) · [Firewall PostgreSQL](https://learn.microsoft.com/azure/postgresql/security/security-firewall-rules)

| Połączenie | Weryfikowana nazwa i magazyn |
| --- | --- |
| Auth, Categories i Transactions → PostgreSQL | `DB_HOST` to pełna nazwa serwera PostgreSQL. `DB_SSL=true` włącza TLS z weryfikacją certyfikatu. Node korzysta z wbudowanych korzeni Mozilla. |
| Auth → Categories | Nazwa z `CATEGORIES_SERVICE_URL` to wewnętrzny FQDN ingressu. HTTPS weryfikuje nazwę i zaufanie w Node. |
| Nginx → Auth, Categories, Transactions i frontend | SNI i nazwa do weryfikacji pochodzą z odpowiedniego `*_HOST`. `UPSTREAM_CA_BUNDLE` domyślnie wskazuje `/etc/ssl/certs/ca-certificates.crt` z pakietu Alpine `ca-certificates`. |
| `ca-db-migrate` → PostgreSQL | `PGHOST` to FQDN serwera, `PGSSLMODE=verify-full`, `PGSSLROOTCERT=/etc/ssl/certs/ca-certificates.crt` z obrazu PostgreSQL. |
| Administrator → PostgreSQL | `psql` na zatwierdzonym hoście z kontrolowanym adresem wyjściowym, `verify-full` i aktualny magazyn CA. |

Brama, frontend oraz runner GitHub Actions nie potrzebują połączenia z bazą.
Runner uruchamia wdrożenie ARM i wykonanie joba przez API Azure. Lokalny Compose
używa HTTP między usługami oraz `DB_SSL=false`.

Microsoft wskazuje **DigiCert Global Root G2** i **Microsoft RSA Root CA 2017**
dla publicznego endpointu PostgreSQL. Utrzymuj aktualne obrazy Node i pakiety
`ca-certificates`. Przy zmianie korzeni potwierdź łańcuch na docelowym serwerze
i odbuduj obrazy. Jeśli potrzebny będzie dodatkowy korzeń, pobierz go z
oficjalnej listy Microsoft lub od zatwierdzonego operatora CA, zweryfikuj jego
odcisk z niezależnym źródłem i dostarcz go jako PEM. W Node
`NODE_EXTRA_CA_CERTS` dołącza taki plik przy starcie procesu. W obrazach
Alpine dla Nginx i `psql` można dodać zweryfikowany plik `.crt` do
`/usr/local/share/ca-certificates` i uruchomić `update-ca-certificates`
podczas budowania obrazu. Domyślna ścieżka CA w obu klientach wtedy się
nie zmienia. Po aktualizacji odbuduj obrazy, uruchom nowe procesy lub
rewizje i powtórz próbę TLS.
Zaufanie konfiguruj na poziomie korzeni CA, aby rotacja certyfikatów
serwera i certyfikatów pośrednich nadal działała. [Korzenie PostgreSQL](https://learn.microsoft.com/azure/postgresql/flexible-server/security-tls) · [Magazyny Node](https://nodejs.org/learn/http/enterprise-network-configuration) · [Weryfikacja w Nginx](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_ssl_verify)

## 1. Potwierdź TLS przed zmianą firewalla

1. Ustaw w GitHub Actions **Repository variable** `POSTGRES_FIREWALL_CONFIG`.
   Jeśli obecna instalacja korzysta z reguły Azure-wide, zacznij od
   `{"mode":"overlap","rules":[]}`. Jeżeli dostęp już zawężono, zachowaj
   zatwierdzone reguły i tryb `restricted`. Przy ręcznym użyciu Bicep
   przekaż ten sam obiekt jako parametr `postgresFirewall`.
   Brak konfiguracji zatrzymuje krok wdrożenia bazy.
2. W zatwierdzonym środowisku próbnym sprawdź pięć połączeń między aplikacjami.
   Użyj rzeczywistych wewnętrznych FQDN dla czterech upstreamów Nginx i dla
   połączenia Auth → Categories. Sprawdź SAN i łańcuch z wnętrza tego samego
   środowiska przy użyciu magazynu danego klienta. Próba na publicznej
   bramie nie potwierdza certyfikatów wewnętrznych FQDN. [Format wewnętrznych FQDN](https://learn.microsoft.com/azure/container-apps/connect-apps)

   ```bash
   openssl s_client -connect "$FQDN:443" -servername "$FQDN" \
     -verify_hostname "$FQDN" -verify_return_error -CAfile "$CA_BUNDLE" </dev/null
   ```

3. Sprawdź rzeczywiste połączenia z bazy z każdej usługi, zadania migracji i
   hosta administracyjnego. Potwierdź `verify-full` dla `psql`, rejestrację
   z 10 kategoriami, chronione odczyty i zapis transakcji po włączeniu zmian.
   Jeżeli certyfikat ingressu nie jest zaufany lub jego SAN nie obejmuje
   używanej nazwy, wstrzymaj wydanie. Ustal obsługiwany przez platformę
   certyfikat i nazwę dla internal ingress oraz zatwierdzony sposób dostarczenia
   brakującego korzenia przed ponowieniem próby.

## 2. Ustal adresy wyjściowe i dodaj wąskie reguły

Ustal kandydatów na publiczne IPv4 wyjściowe Auth, Categories i Transactions,
sprawdzając `properties.outboundIpAddresses` aplikacji oraz konfigurację
profilu i podsieci środowiska. Oddzielnie ustal egress joba w jego rzeczywistym
profilu wykonawczym oraz stały egress hosta administracyjnego. Publiczny IP
bramy i adresy ingressu nie określają egressu. Wykaz IP platformy i pojedyncza
obserwacja połączenia nie gwarantują trwałego adresu. Potwierdź z właścicielem
sieci kontrakt na stabilność egressu także po restarcie, nowej rewizji i
skalowaniu. [Adresy wyjściowe Container Apps](https://learn.microsoft.com/azure/container-apps/networking#ports-and-ip-addresses)

```bash
for app in ca-auth ca-categories ca-transactions; do
  az containerapp show --resource-group "$RESOURCE_GROUP" --name "$app" \
    --query properties.outboundIpAddresses -o json
done
az containerapp env show --resource-group "$ENV_RESOURCE_GROUP" --name "$ENV_NAME" \
  --query '{subnet:properties.vnetConfiguration.infrastructureSubnetId,profiles:properties.workloadProfiles}'
```

Wykonaj odczyt z każdego klienta, także z diagnostycznego wykonania joba z
takim samym profilem, docelowym serwerem i ustawieniami TLS. Porównaj peer
widziany przez bazę z logami dostępu i udokumentowanym adresem wyjściowym.
Adres widoczny za dodatkowym proxy wymaga potwierdzenia na firewallu.

```sql
SELECT inet_client_addr() AS peer, ssl, version
FROM pg_stat_ssl
WHERE pid = pg_backend_pid();
```

Dodaj wyłącznie potwierdzone adresy lub zakresy. Wpis ma pola `name`,
`startIpAddress` i `endIpAddress`. Dla jednego IPv4 podaj go w obu polach.
Bicep dodaje przedrostek `finance-` do nazwy. Pipeline odrzuca nieuporządkowane
zakresy, IPv6, powtarzające się nazwy oraz `0.0.0.0` jako wpis listy.
Przykład formatu na zarezerwowanym adresie dokumentacyjnym, do zastąpienia
przed wdrożeniem:

```json
{
  "mode": "overlap",
  "rules": [
    {"name": "app-egress", "startIpAddress": "192.0.2.10", "endIpAddress": "192.0.2.10"}
  ]
}
```

Zachowaj tryb `overlap` podczas dodawania reguł. Sprawdź wynik przez `az postgres
flexible-server firewall-rule list`. Przećwicz zapisy, odczyty, nową sesję
administracyjną i wykonanie migracji na serwerze próbnym z samą docelową
allowlistą, z tych samych ścieżek egress. Sukces połączenia produkcyjnego
przy nadal działającej regule Azure-wide nie potwierdza wąskiej listy.

Jeżeli stabilny egress nie jest dostępny dla wszystkich wymaganych klientów,
pozostań w trybie `overlap`. Zmianę współdzielonego środowiska, przejście na
profil z integracją VNet i NAT Gateway lub prywatny dostęp do PostgreSQL
zaplanuj jako oddzielną zmianę z uzgodnieniem DNS i dostępu administracyjnego.
[Profile i sieci Container Apps](https://learn.microsoft.com/azure/container-apps/networking)

## 3. Wyłącz regułę Azure-wide po potwierdzeniu

Po udanej próbie i osobnym zatwierdzeniu ustaw `mode` na `restricted`,
zachowując zweryfikowane reguły. Wykonaj wdrożenie przyrostowe z tym parametrem.
Szablon przestanie deklarować szeroką regułę. Przyrostowe wdrożenie ARM nie usuwa
istniejącej reguły, dlatego usuń ją jawnie w uzgodnionym oknie:

```bash
az postgres flexible-server firewall-rule delete \
  --resource-group "$RESOURCE_GROUP" --server-name "$POSTGRES_SERVER" \
  --name AllowAllAzureServices --yes
```

[Przyrostowe wdrożenia ARM](https://learn.microsoft.com/azure/azure-resource-manager/deployment-modes) · [Usuwanie reguł PostgreSQL](https://learn.microsoft.com/cli/azure/postgres/flexible-server/firewall-rule#az-postgres-flexible-server-firewall-rule-delete)

Potwierdź listę reguł na serwerze, w tym ewentualne reguły spoza Bicep.
Reguły zarządzane przez Bicep usunięte z JSON również wymagają osobnego
usunięcia w Azure. Uwzględnij propagację firewalla do pięciu minut.
Powtórz pozytywne próby na **nowych połączeniach** wszystkich trzech usług,
joba i hosta administracyjnego. Z osobnego kontrolowanego hosta spoza listy,
w tym z niedopuszczonego źródła w Azure, sprawdź odmowę dostępu. Odróżnij
odmowę sieciową lub komunikat firewalla od błędu hasła i błędu TLS. Zachowaj
ustawienie `restricted` w kolejnych wydaniach.

## Wycofanie zmiany sieciowej

Przywróć ostatnie działające reguły adresowe. Gdy to nie wystarcza, po zgodzie
na czasowe poszerzenie dostępu przywróć historyczną regułę i ustaw `overlap`
w konfiguracji wydania:

```bash
az postgres flexible-server firewall-rule create \
  --resource-group "$RESOURCE_GROUP" --server-name "$POSTGRES_SERVER" \
  --name AllowAllAzureServices --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0
```

Po propagacji potwierdź nowe połączenia i działanie migratora. Pozostaw
włączoną weryfikację nazwy i CA we wszystkich klientach. W razie błędu TLS
przywróć zatwierdzony magazyn lub popraw certyfikat i nazwę hosta.

## Lokalne testy

`bash e2e/tls/run.sh` tworzy tymczasowe CA, serwer HTTPS i PostgreSQL w
izolowanym Compose. Sprawdza zaufany certyfikat, niezaufany korzeń i błędną
nazwę hosta w Auth, trzech klientach PostgreSQL, `psql` i Nginx.
`python3 -m unittest discover -s infra -p test_firewall_config.py` sprawdza
parametr firewalla. Azure wymaga osobnej próby wewnętrznych certyfikatów,
egressu i zachowania rzeczywistych reguł.
