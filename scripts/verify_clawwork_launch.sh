#!/usr/bin/env bash
set -euo pipefail

CLAWWORK_URL="${CLAWWORK_URL:-}"
CLAWWORK_API_TOKEN="${CLAWWORK_API_TOKEN:-}"
TENANT_ID="${TENANT_ID:-test-tenant}"
MODEL="${MODEL:-gpt-4o}"
SIGNATURE="${SIGNATURE:-verify-agent-$(date +%s)}"

if [[ -z "${CLAWWORK_URL}" ]]; then
  echo "ERROR: CLAWWORK_URL is required."
  exit 1
fi
if [[ -z "${CLAWWORK_API_TOKEN}" ]]; then
  echo "ERROR: CLAWWORK_API_TOKEN is required."
  exit 1
fi

today="$(date -u +%Y-%m-%d)"
tomorrow="$(date -u -v+1d +%Y-%m-%d 2>/dev/null || python3 - <<'PY'
from datetime import datetime, timedelta
print((datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%d"))
PY
)"

read -r -d '' payload <<JSON || true
{
  "config": {
    "livebench": {
      "date_range": { "init_date": "${today}", "end_date": "${tomorrow}" },
      "economic": {
        "initial_balance": 5,
        "spend_cap_daily_usd": 2,
        "spend_cap_monthly_usd": 5,
        "token_pricing": { "input_per_1m": 2.5, "output_per_1m": 10.0 }
      },
      "task_source": {
        "type": "inline",
        "tasks": [
          {
            "task_id": "verify-001",
            "sector": "General",
            "occupation": "Verifier",
            "prompt": "Output one short sentence confirming this launch test completed.",
            "reference_files": []
          }
        ]
      },
      "agents": [
        {
          "signature": "${SIGNATURE}",
          "basemodel": "${MODEL}",
          "enabled": true
        }
      ],
      "agent_params": { "max_steps": 8, "max_retries": 1, "base_delay": 0.5 },
      "data_path": "./livebench/data/agent_data"
    }
  }
}
JSON

tmp_body="$(mktemp)"
status=$(curl -sS -o "${tmp_body}" -w "%{http_code}" \
  -X POST "${CLAWWORK_URL%/}/api/simulations" \
  -H "content-type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "authorization: Bearer ${CLAWWORK_API_TOKEN}" \
  --data "${payload}" || true)

echo "Launch status: ${status}"
echo "Launch body:"
cat "${tmp_body}"
echo

if [[ "${status}" != "200" ]]; then
  echo "FAIL: launch request failed"
  exit 1
fi

simulation_id="$(grep -o '"simulation_id":"[^"]*"' "${tmp_body}" | head -n1 | cut -d'"' -f4 || true)"
if [[ -z "${simulation_id}" ]]; then
  simulation_id="$(grep -o '"id":"[^"]*"' "${tmp_body}" | head -n1 | cut -d'"' -f4 || true)"
fi

if [[ -z "${simulation_id}" ]]; then
  echo "FAIL: simulation_id not found in response"
  exit 1
fi

echo "Simulation ID: ${simulation_id}"

list_body="$(mktemp)"
list_status=$(curl -sS -o "${list_body}" -w "%{http_code}" \
  "${CLAWWORK_URL%/}/api/simulations" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "authorization: Bearer ${CLAWWORK_API_TOKEN}" || true)
echo "List status: ${list_status}"
if [[ "${list_status}" != "200" ]]; then
  echo "FAIL: could not list simulations"
  cat "${list_body}"
  exit 1
fi
if ! grep -q "${simulation_id}" "${list_body}"; then
  echo "FAIL: simulation not present in list response"
  cat "${list_body}"
  exit 1
fi

echo "PASS: launch + list verified"

