# Migracje PostgreSQL

Compose uruchamia kolejno PostgreSQL, jednorazowy `db-bootstrap`,
jednorazowy `db-migrate` i serwisy. Serwisy sprawdzają połączenie z bazą
przy starcie. DDL wykonuje osobny proces.

## Wersje i role

- **001** tworzy schemat bazowy na pustej bazie. Na istniejącej bazie
  sprawdza tabele, typy i nullowalność kolumn, klucze główne, unikalność
  loginu i wartości enumów przed zapisaniem wersji.
- **002** dodaje tabele oczekujących i zakończonych inicjalizacji.
  Sprawdza także tabele, które powstały przy wcześniejszym wdrożeniu tej funkcji.
- **003** dodaje nullable `archivedAt`. Kategorie bez znacznika pozostają
  aktywne. Dotychczasowe powiązania, także osierocone, pozostają w bazie.
- **004** nadaje granty aplikacjom. Schemat i tabele należą do
  `finance_migrator`.

Advisory lock obejmuje całą transakcję migracji. Kolejne wykonanie widzi
już zastosowane wersje w `finance_migrations.schema_migrations`. Błąd
wycofuje zmiany danego wykonania. Przy komunikacie `Schema mismatch`
porównaj wskazany obiekt z odtworzoną kopią i wersjami SQL. Popraw źródło
rozbieżności w osobnej, sprawdzonej migracji lub przywróć poprawny stan.
Wpisy dziennika dodaje wyłącznie wykonawca migracji.

| Rola | Dostęp |
| --- | --- |
| `finance_migrator` | Tworzenie schematów w tej bazie, DDL własnych obiektów, granty i dziennik migracji |
| `finance_auth` | Odczyt i zapis użytkowników. Odczyt, zapis i usuwanie oczekujących inicjalizacji |
| `finance_categories` | Odczyt i zapis kategorii oraz znaczników inicjalizacji. Aktualizacja `archivedAt` i `updatedAt` |
| `finance_transactions` | Odczyt, zapis i usuwanie transakcji. Odczyt kolumn kategorii `id`, `userId`, `type`, `archivedAt` i `UPDATE` wyłącznie na `updatedAt`, które umożliwia `FOR SHARE` |

Role aplikacyjne nie dziedziczą uprawnień migratora. Bootstrap odbiera
`CREATE` i `TEMP` od `PUBLIC` w dedykowanej bazie oraz `CREATE` w schemacie
`public`. Jeśli baza jest współdzielona z dodatkowymi klientami, przed
przejściem sprawdź ich granty i nadaj im jawnie wymagane prawa. Inicjalizacja
Categories używa `INSERT … ON CONFLICT`, więc rola aplikacji nie potrzebuje
tworzyć tymczasowych funkcji Sequelize.

## Środowisko lokalne

Skopiuj główny `.env.example`. Dla istniejącego wolumenu zachowaj wartości
`DB_USER`, `DB_PASSWORD` i `DB_NAME` użyte przy tworzeniu PostgreSQL.
Ustaw osobne hasła `POSTGRES_MIGRATOR_PASSWORD`, `POSTGRES_AUTH_PASSWORD`,
`POSTGRES_CATEGORIES_PASSWORD` i `POSTGRES_TRANSACTIONS_PASSWORD`.
Bootstrap używa ich przy tworzeniu ról. Przy zmianie hasła istniejącej
roli zmień je w PostgreSQL i w `.env` w ramach tej samej operacji.

Pełne uruchomienie to `docker compose up --build`. Przy uruchamianiu serwisów
bez Compose wykonaj wcześniej oba kroki bazodanowe na docelowej bazie.
Na lokalnym serwerze PostgreSQL wykonaj `db/bootstrap.sql` jako właściciel
bazy i ustaw hasła ról przez `\password`. Następnie uruchom
`PGUSER=finance_migrator psql -X -W -f db/migrate.sql`. Ustaw `PGHOST`,
`PGDATABASE` i `PGSSLMODE` odpowiednio dla lokalnego środowiska. Jeśli baza
pozostaje w Compose, uruchom `docker compose up --build db-migrate` i
udostępnij PostgreSQL hostowi przez przekierowanie wyłącznie na localhost.
Potem skopiuj `.env.example` w każdym serwisie i ustaw zgodne hasło roli,
adres bazy i konfigurację komunikacji między usługami. Uruchom `npm start`
w katalogu każdego serwisu.

Regresję PostgreSQL uruchom poleceniem `bash db/test-migrations.sh` po
uruchomieniu testowego Compose. Skrypt zakłada osobne, tymczasowe bazy
w lokalnym kontenerze PostgreSQL i usuwa je po zakończeniu.

## Pierwsze przejście w Azure

1. **Przećwicz na odtworzonej kopii.** Zapisz bieżący SHA, rewizje, role i granty.
   Odtwórz kopię PostgreSQL w odizolowanym środowisku. Uruchom bootstrap i
   migracje na tej kopii, porównaj liczbę i przykładowe wartości rekordów
   oraz powiązań. Przećwicz uruchomienie usług na dedykowanych rolach,
   procedurę wycofania i próbę z rozbieżnym schematem.
2. **Przygotuj poprzednie rewizje.** Przed migracją wyłącz możliwość
   uruchomienia obrazów wykonujących `sync({ alter: true })`. Mogłyby
   usunąć nowe kolumny. W oknie serwisowym zatrzymaj takie rewizje albo
   wcześniej przygotuj i przetestuj obraz z poprzednią logiką i bez
   automatycznego DDL. Wstrzymaj zapisy podczas zmiany wersji usług.
3. **Przygotuj role po uzyskaniu zgody.** Na nowym środowisku najpierw
   utwórz bazę z `infra/base.bicep`. Na istniejącym użyj aktualnego
   hasła administratora. Z zatwierdzonego hosta Azure z dostępem do bazy
   połącz się jako dotychczasowy administrator posiadający obiekty lub
   odpowiednie uprawnienia do zmiany właściciela. Nie wymaga to dostępu
   do bazy z publicznego runnera GitHub. Jeżeli zweryfikowana struktura
   jest poprawna, bootstrap tworzy role i przekazuje własność obiektów
   migratorowi. Zachowuje czasowe członkostwo starego administratora
   w `finance_migrator`, dzięki czemu stare, zgodne rewizje nadal mogą
   czytać i zapisywać dane. Użyj klienta PostgreSQL 16. Ustaw hasła przez
   `psql \password` i zapisz
   je w odpowiadających GitHub Actions Secrets.

   ```bash
   export PGHOST='<FQDN serwera>' PGDATABASE=finance PGUSER='<administrator>'
   export PGSSLMODE=verify-full PGSSLROOTCERT='<plik zaufanych CA>'
   psql -X -W -v ON_ERROR_STOP=1 -f db/bootstrap.sql
   psql -X -W -v ON_ERROR_STOP=1
   ```

   ```text
   \password finance_migrator
   \password finance_auth
   \password finance_categories
   \password finance_transactions
   \q
   ```

4. **Wdróż po uzyskaniu zgody.** Przed pierwszym wdrożeniem na istniejącą
   instalację ustaw zmienną repozytorium `RETAIN_LEGACY_DB_SECRET=true`,
   jeśli pozostają rewizje odwołujące się do `db-password`. Zachowuje to
   poprzednią nazwę i wartość sekretu administratora tylko na okres
   przejściowy. Workflow zatrzyma wydanie, jeśli aktywna rewizja nadal
   używa starego sekretu, a zmienna jest wyłączona. Nowe rewizje czytają
   własne hasło z `runtime-db-password`.
   Workflow uruchamia jednorazowy job w tym samym Azure Container Apps
   Environment co usługi. Czeka na `Succeeded` konkretnego wykonania,
   zanim zastosuje `apps.bicep`. Przy błędzie sprawdź logi tego wykonania i
   wstrzymaj przełączenie.
5. **Sprawdź i zakończ przejście.** Potwierdź role sesji PostgreSQL,
   rejestrację z kategoriami, zapis i odczyt transakcji, archiwizację
   oraz odmowę DDL przy połączeniu jako każda rola wykonawcza. Potwierdź,
   że job korzysta z TLS z weryfikacją certyfikatu oraz że historia ARM
   ukrywa zabezpieczone parametry. Po dezaktywacji wszystkich rewizji
   korzystających z `db-password` usuń `RETAIN_LEGACY_DB_SECRET` i wykonaj
   zatwierdzone wydanie usuwające stary sekret. Usuń czasowe członkostwo
   starego loginu w roli migratora, gdy wycofanie do starej tożsamości
   przestanie być potrzebne.

## Wycofanie aplikacji

Przełącz ruch na sprawdzone obrazy zgodne z bieżącym schematem, bez DDL przy
starcie. Zachowaj dziennik migracji i nowe sekrety. W okresie przejściowym
przygotowany obraz może korzystać ze starej pary login/sekret, jeśli nadal
ma potrzebne prawa. Przetestuj to wcześniej na kopii. Po rozpoczęciu
archiwizacji wersja Categories, która fizycznie usuwa kategorie lub
pokazuje zarchiwizowane kategorie jako aktywne, wymaga wyłączenia tych
operacji albo zastąpienia kompatybilnym obrazem przy wycofaniu.

Migracje wykonywane przed przełączeniem ruchu muszą być zgodne z bieżącą,
poprzednią i przygotowaną do wycofania wersją aplikacji. W tym wydaniu
001 zachowuje bazowy układ, 002 i 003 rozszerzają go, a 004 nadaje
uprawnienia nowym rolom przy zachowaniu dostępu przejściowego. Przy kolejnych
wydaniach najpierw dodawaj nowe struktury, a usunięcia lub zawężenia wykonuj
w późniejszym wydaniu po wyłączeniu korzystających z nich rewizji. Zmianę
już zastosowanej migracji zastąp nową wersją SQL i wpisem w `migrate.sql`.
