#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://journalfit.localhost:8088}"
KEYCLOAK_URL="${KEYCLOAK_URL:-http://keycloak.localhost:8088}"
REALM="${REALM:-journalfit}"
CLIENT_ID="${CLIENT_ID:-journalfit-app}"
MANUSCRIPT_ID="${MANUSCRIPT_ID:-ms-001}"

for command in curl node; do
    if ! command -v "$command" >/dev/null 2>&1; then
        echo "Missing dependency: $command" >&2
        exit 1
    fi
done

token() {
    local username="$1"
    local password="$2"
    local response

    response=$(curl -sS -X POST \
        "$KEYCLOAK_URL/realms/$REALM/protocol/openid-connect/token" \
        -H 'Content-Type: application/x-www-form-urlencoded' \
        --data-urlencode 'grant_type=password' \
        --data-urlencode "client_id=$CLIENT_ID" \
        --data-urlencode "username=$username" \
        --data-urlencode "password=$password")

    echo "$response" | node -e '
        let input = "";
        process.stdin.on("data", (chunk) => { input += chunk; });
        process.stdin.on("end", () => {
            const payload = JSON.parse(input);
            if (!payload.access_token) {
                console.error(JSON.stringify(payload));
                process.exit(1);
            }
            process.stdout.write(payload.access_token);
        });
    '
}

check_status() {
    local label="$1"
    local expected="$2"
    local method="$3"
    local url="$4"
    local bearer="${5:-}"
    local tenant_header="${6:-}"
    local args=(-sS -o /dev/null -w '%{http_code}' -X "$method")

    if [ -n "$bearer" ]; then
        args+=(-H "Authorization: Bearer $bearer")
    fi
    if [ -n "$tenant_header" ]; then
        args+=(-H "X-Tenant-ID: $tenant_header")
    fi

    local status
    status=$(curl "${args[@]}" "$url")

    if [ "$status" != "$expected" ]; then
        echo "FAIL  $label (expected $expected, got $status)" >&2
        exit 1
    fi

    echo "PASS  $label ($status)"
}

echo "JournalFit tenant restriction demo"
echo "API:      $BASE_URL"
echo "Keycloak: $KEYCLOAK_URL"
echo

TOKEN_A=$(token author.a author.a)
TOKEN_B=$(token author.b author.b)
TOKEN_EDITOR=$(token editor.a editor.a)
echo "Tokens acquired for author.a, author.b, editor.a"
echo

check_status "author.a can read ms-001" 200 GET \
    "$BASE_URL/api/manuscripts/$MANUSCRIPT_ID/report" "$TOKEN_A"
check_status "author.b gets 404 for ms-001" 404 GET \
    "$BASE_URL/api/manuscripts/$MANUSCRIPT_ID/report" "$TOKEN_B"
check_status "editor.a can read ms-001" 200 GET \
    "$BASE_URL/api/manuscripts/$MANUSCRIPT_ID/report" "$TOKEN_EDITOR"
check_status "no token gets 401" 401 GET \
    "$BASE_URL/api/manuscripts/$MANUSCRIPT_ID/report"
check_status "editor.a cannot upload" 403 POST \
    "$BASE_URL/api/manuscripts" "$TOKEN_EDITOR"
check_status "forged X-Tenant-ID is ignored" 200 GET \
    "$BASE_URL/api/manuscripts/$MANUSCRIPT_ID/report" "$TOKEN_A" "tenant-b"
check_status "author.a can call /api/auth/me" 200 GET \
    "$BASE_URL/api/auth/me" "$TOKEN_A"

echo
echo "All tenant restriction checks passed."
