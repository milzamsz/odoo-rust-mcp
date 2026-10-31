#!/usr/bin/env bash
# Start a disposable Odoo in Docker for the live tests and print its connection env.
#
#   scripts/odoo-test-db.sh 20.0 28069 >> "$GITHUB_ENV"   # or: eval "$(scripts/odoo-test-db.sh 17.0 27069)"
#   scripts/odoo-test-db.sh down 20.0
#
# Odoo 19+ gets an `rpc`-scope API key; older versions use admin/admin over JSON-RPC.
set -euo pipefail

if [[ "${1:-}" == "down" ]]; then
    name="mcp-odoo-${2:?usage: $0 down <version>}"
    docker rm -f "${name%%.*}" "${name%%.*}-pg" >/dev/null 2>&1 || true
    docker network rm "${name%%.*}" >/dev/null 2>&1 || true
    exit 0
fi

VERSION="${1:?usage: $0 <16.0|17.0|18.0|19.0|20.0> [port]}"
PORT="${2:-8069}"
MAJOR="${VERSION%%.*}"
NAME="mcp-odoo-$MAJOR"
MODULES="${ODOO_TEST_MODULES:-base,sale_management,account,stock,crm,purchase,hr,project}"
DB_ENV=(-e HOST="$NAME-pg" -e USER=odoo -e PASSWORD=odoo)

docker rm -f "$NAME" "$NAME-pg" >/dev/null 2>&1 || true
docker network create "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME-pg" --network "$NAME" \
    -e POSTGRES_USER=odoo -e POSTGRES_PASSWORD=odoo -e POSTGRES_DB=postgres postgres:16-alpine >/dev/null
until docker exec "$NAME-pg" pg_isready -U odoo >/dev/null 2>&1; do sleep 1; done

# Demo data is off by default from 19; turn it off on older versions too so every run starts the same.
demo=()
if (( MAJOR < 19 )); then demo=(--without-demo=all); fi
docker run --rm --network "$NAME" "${DB_ENV[@]}" "odoo:$VERSION" \
    odoo -d mcp -i "$MODULES" "${demo[@]}" --stop-after-init >&2

docker run -d --name "$NAME" --network "$NAME" -p "127.0.0.1:$PORT:8069" "${DB_ENV[@]}" "odoo:$VERSION" \
    odoo -d mcp --db-filter='^mcp$' >/dev/null
for _ in $(seq 1 90); do
    curl -sf -X POST -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","params":{}}' \
        "http://127.0.0.1:$PORT/web/webclient/version_info" >/dev/null && break
    sleep 2
done

echo "ODOO_LIVE_URL=http://127.0.0.1:$PORT"
echo "ODOO_LIVE_DB=mcp"
echo "ODOO_LIVE_VERSION=$MAJOR"
if (( MAJOR >= 19 )); then
    key=$(docker exec -i "$NAME" odoo shell -d mcp --no-http \
        --db_host="$NAME-pg" --db_user=odoo --db_password=odoo 2>/dev/null <<'EOF' | sed -n 's/^KEY=//p'
admin = env.ref('base.user_admin')
print('KEY=' + env['res.users.apikeys'].with_user(admin).sudo()._generate('rpc', 'odoo-rust-mcp live test', None))
env.cr.commit()
EOF
)
    [[ -n "$key" ]] || { echo "could not mint an API key" >&2; exit 1; }
    echo "ODOO_LIVE_API_KEY=$key"
else
    echo "ODOO_LIVE_USERNAME=admin"
    echo "ODOO_LIVE_PASSWORD=admin"
fi
