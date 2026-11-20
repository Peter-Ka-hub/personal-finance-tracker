#!/usr/bin/env bash
set -euo pipefail

fixture_dir=$(cd "$(dirname "$0")" && pwd)
TLS_FIXTURES=$(mktemp -d)
export TLS_FIXTURES
compose() { docker compose --project-name "finance-tls-test-$$" -f "$fixture_dir/compose.yml" "$@"; }
cleanup() {
  compose down --volumes >/dev/null 2>&1 || true
  rm -rf "$TLS_FIXTURES"
}
trap cleanup EXIT

# An ephemeral root and two server certificates. No production credentials.
cat >"$TLS_FIXTURES/openssl.cnf" <<'CONFIG'
[req]
distinguished_name = name
[name]
[ca]
basicConstraints = critical,CA:TRUE
keyUsage = critical,keyCertSign,cRLSign
CONFIG
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -sha256 -subj '/CN=Finance TLS test root' \
  -config "$TLS_FIXTURES/openssl.cnf" -extensions ca \
  -keyout "$TLS_FIXTURES/ca.key" -out "$TLS_FIXTURES/ca.crt" 2>/dev/null
for host in postgres https-fixture; do
  printf 'subjectAltName=DNS:%s\nextendedKeyUsage=serverAuth\n' "$host" >"$TLS_FIXTURES/ext"
  openssl req -newkey rsa:2048 -nodes -subj "/CN=$host" \
    -keyout "$TLS_FIXTURES/$host.key" -out "$TLS_FIXTURES/$host.csr" 2>/dev/null
  openssl x509 -req -sha256 -days 1 -in "$TLS_FIXTURES/$host.csr" \
    -CA "$TLS_FIXTURES/ca.crt" -CAkey "$TLS_FIXTURES/ca.key" -CAcreateserial \
    -extfile "$TLS_FIXTURES/ext" -out "$TLS_FIXTURES/$host.crt" 2>/dev/null
done

compose build auth categories transactions db-migrate gateway
compose up -d --wait postgres https-fixture

for service in auth categories transactions; do
  compose run --rm --no-deps "$service" node /probe.cjs postgres
  compose run --rm --no-deps -e NODE_EXTRA_CA_CERTS= -e EXPECTED_TLS_ERROR=untrusted "$service" node /probe.cjs postgres
  compose run --rm --no-deps -e DB_HOST=postgres-wrong-name -e EXPECTED_TLS_ERROR=hostname "$service" node /probe.cjs postgres
done

compose run --rm --no-deps -e CATEGORIES_SERVICE_URL=https://https-fixture:8443 auth node /probe.cjs auth-https
compose run --rm --no-deps -e CATEGORIES_SERVICE_URL=https://https-fixture:8443 \
  -e NODE_EXTRA_CA_CERTS= -e EXPECTED_TLS_ERROR=untrusted auth node /probe.cjs auth-https
compose run --rm --no-deps -e CATEGORIES_SERVICE_URL=https://https-wrong-name:8443 \
  -e EXPECTED_TLS_ERROR=hostname auth node /probe.cjs auth-https

psql_tls() { compose run --rm --no-deps --env PGSSLMODE=verify-full "$@" db-migrate -Atc 'SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()'; }
[[ "$(psql_tls)" == t ]]
if output=$(psql_tls -e PGSSLROOTCERT=/etc/ssl/certs/ca-certificates.crt 2>&1); then
  echo 'psql accepted an untrusted CA' >&2
  exit 1
fi
grep -F 'certificate verify failed' <<<"$output"
if output=$(psql_tls -e PGHOST=postgres-wrong-name 2>&1); then
  echo 'psql accepted the wrong hostname' >&2
  exit 1
fi
grep -F 'does not match host name' <<<"$output"

check_gateway() {
  local host=$1 ca=$2 expected_status=$3 expected_log=${4:-} attempt actual address route
  TLS_GATEWAY_HOST="$host" TLS_GATEWAY_CA_BUNDLE="$ca" compose up -d --force-recreate --no-deps gateway
  compose exec -T gateway nginx -t
  address=$(compose port gateway 80)
  for route in /api/auth/check /api/categories /api/transactions /; do
    for attempt in {1..20}; do
      actual=$(curl -s --max-time 3 -o /dev/null -w '%{http_code}' "http://$address$route") && break
      sleep 0.25
    done
    if [[ "$actual" != "$expected_status" ]]; then
      echo "Expected HTTP $expected_status from $route for $host, got $actual" >&2
      return 1
    fi
  done
  if [[ "$expected_log" ]]; then
    compose logs --no-color gateway | grep -F "$expected_log"
  fi
}
check_gateway https-fixture /tls/ca.crt 200
check_gateway https-fixture /etc/ssl/certs/ca-certificates.crt 502 'certificate verify error'
check_gateway https-wrong-name /tls/ca.crt 502 'certificate does not match'

echo 'TLS regression checks passed for Auth HTTPS, PostgreSQL clients, psql and Nginx.'
