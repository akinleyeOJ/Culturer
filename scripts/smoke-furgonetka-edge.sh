#!/usr/bin/env bash
# Manual smoke tests for Furgonetka-related Edge Functions (prep 7).
# Run from repo root. Do not commit secrets.
#
#   export SUPABASE_URL="https://<ref>.supabase.co"
#   export SUPABASE_ANON_KEY="eyJ..."
#   # For furgonetka-create-shipment (validates a real order; service role only):
#   export SUPABASE_SERVICE_ROLE_KEY="eyJ..."
#   export SMOKE_ORDER_ID="<uuid of a paid Furgonetka order>"
#
#   chmod +x scripts/smoke-furgonetka-edge.sh
#   ./scripts/smoke-furgonetka-edge.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${SUPABASE_URL:-}" || -z "${SUPABASE_ANON_KEY:-}" ]]; then
  echo "Set SUPABASE_URL and SUPABASE_ANON_KEY." >&2
  exit 1
fi

BASE="${SUPABASE_URL%/}"

echo "== furgonetka-rates (anonymous key, sample PL route) =="
curl -sS -X POST "${BASE}/functions/v1/furgonetka-rates" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "origin": { "postcode": "00-001", "city": "Warszawa", "country_code": "PL" },
    "destination": { "postcode": "30-001", "city": "Kraków", "country_code": "PL" },
    "parcel": { "weight_grams": 1500, "value_pln": 99 }
  }' | head -c 2000
echo ""
echo ""

echo "== furgonetka-service-points (anonymous key, sample search) =="
curl -sS -X POST "${BASE}/functions/v1/furgonetka-service-points" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "carriers": ["inpost"],
    "postcode": "00-001",
    "limit": 3
  }' | head -c 2000
echo ""
echo ""

if [[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" && -n "${SMOKE_ORDER_ID:-}" ]]; then
  echo "== furgonetka-create-shipment (service role + SMOKE_ORDER_ID) =="
  curl -sS -X POST "${BASE}/functions/v1/furgonetka-create-shipment" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"order_id\": \"${SMOKE_ORDER_ID}\"}"
  echo ""
else
  echo "(Skip create-shipment: set SUPABASE_SERVICE_ROLE_KEY and SMOKE_ORDER_ID to test.)"
fi

echo "Done."
