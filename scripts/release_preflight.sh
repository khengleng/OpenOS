#!/usr/bin/env bash
set -euo pipefail

OPENOS_URL="${OPENOS_URL:-}"
CLAWWORK_URL="${CLAWWORK_URL:-}"

if [[ -z "${OPENOS_URL}" ]]; then
  echo "ERROR: OPENOS_URL is required (example: https://nexus-os-production.up.railway.app)"
  exit 1
fi

FAILURES=0

curl_capture() {
  local url="$1"
  local method="${2:-GET}"
  local body_file header_file
  body_file="$(mktemp)"
  header_file="$(mktemp)"
  local code
  code=$(curl -sS -D "${header_file}" -o "${body_file}" -w "%{http_code}" -X "${method}" "${url}" || true)
  echo "${code}|${body_file}|${header_file}"
}

assert_eq() {
  local actual="$1"
  local expected="$2"
  local label="$3"
  if [[ "${actual}" != "${expected}" ]]; then
    echo "FAIL: ${label} expected ${expected}, got ${actual}"
    FAILURES=$((FAILURES + 1))
    return
  fi
  echo "PASS: ${label} (${actual})"
}

assert_in() {
  local actual="$1"
  local options="$2"
  local label="$3"
  if [[ " ${options} " != *" ${actual} "* ]]; then
    echo "FAIL: ${label} expected one of [${options}], got ${actual}"
    FAILURES=$((FAILURES + 1))
    return
  fi
  echo "PASS: ${label} (${actual})"
}

assert_contains() {
  local file="$1"
  local needle="$2"
  local label="$3"
  if ! grep -q "${needle}" "${file}"; then
    echo "FAIL: ${label} missing '${needle}'"
    FAILURES=$((FAILURES + 1))
    return
  fi
  echo "PASS: ${label}"
}

assert_not_contains() {
  local file="$1"
  local needle="$2"
  local label="$3"
  if grep -qi "${needle}" "${file}"; then
    echo "FAIL: ${label} contains unexpected '${needle}'"
    FAILURES=$((FAILURES + 1))
    return
  fi
  echo "PASS: ${label}"
}

echo "== OpenOS health =="
res=$(curl_capture "${OPENOS_URL}/api/health")
code="${res%%|*}"; rest="${res#*|}"; body="${rest%%|*}"
assert_eq "${code}" "200" "openos /api/health"
cat "${body}"; echo

echo "== OpenOS readiness =="
res=$(curl_capture "${OPENOS_URL}/api/readiness")
code="${res%%|*}"; rest="${res#*|}"; body="${rest%%|*}"
assert_eq "${code}" "200" "openos /api/readiness"
assert_contains "${body}" "\"ready\":true" "openos readiness ready=true"
cat "${body}"; echo

echo "== OpenOS auth guards =="
res=$(curl_capture "${OPENOS_URL}/api/clawwork/agents")
code="${res%%|*}"; rest="${res#*|}"; body="${rest%%|*}"
assert_eq "${code}" "401" "openos unauth /api/clawwork/agents"
cat "${body}"; echo

res=$(curl_capture "${OPENOS_URL}/api/coworker/tasks")
code="${res%%|*}"; rest="${res#*|}"; body="${rest%%|*}"
assert_eq "${code}" "401" "openos unauth /api/coworker/tasks"
cat "${body}"; echo

res=$(curl_capture "${OPENOS_URL}/api/rbac/me")
code="${res%%|*}"; rest="${res#*|}"; body="${rest%%|*}"
assert_eq "${code}" "401" "openos unauth /api/rbac/me"
cat "${body}"; echo

res=$(curl_capture "${OPENOS_URL}/api/health/apple")
code="${res%%|*}"; rest="${res#*|}"; body="${rest%%|*}"
assert_eq "${code}" "401" "openos unauth /api/health/apple"
cat "${body}"; echo

res=$(curl_capture "${OPENOS_URL}/api/health/apple/sync" "POST")
code="${res%%|*}"; rest="${res#*|}"; body="${rest%%|*}"
assert_eq "${code}" "401" "openos unauth POST /api/health/apple/sync"
cat "${body}"; echo

echo "== OpenOS static assets =="
res=$(curl_capture "${OPENOS_URL}/manifest.json")
code="${res%%|*}"; rest="${res#*|}"; body="${rest%%|*}"; headers="${rest#*|}"
assert_eq "${code}" "200" "openos /manifest.json"
assert_contains "${headers}" "content-type: application/json" "openos manifest content-type"
head -c 250 "${body}" || true
echo

if [[ -n "${CLAWWORK_URL}" ]]; then
  echo "== ClawWork health =="
  res=$(curl_capture "${CLAWWORK_URL}/healthz")
  code="${res%%|*}"; rest="${res#*|}"; body="${rest%%|*}"
  assert_eq "${code}" "200" "clawwork /healthz"
  cat "${body}"; echo

  echo "== ClawWork readiness =="
  res=$(curl_capture "${CLAWWORK_URL}/readyz")
  code="${res%%|*}"; rest="${res#*|}"; body="${rest%%|*}"
  assert_eq "${code}" "200" "clawwork /readyz"
  cat "${body}"; echo

  echo "== ClawWork API sanity =="
  res=$(curl_capture "${CLAWWORK_URL}/api/agents")
  code="${res%%|*}"; rest="${res#*|}"; body="${rest%%|*}"; headers="${rest#*|}"
  assert_in "${code}" "200 400 401" "clawwork /api/agents unauth status"
  assert_not_contains "${headers}" "content-type: text/html" "clawwork /api/agents non-HTML response"
  head -c 300 "${body}" || true
  echo
fi

if [[ "${FAILURES}" -gt 0 ]]; then
  echo
  echo "Release preflight failed with ${FAILURES} issue(s)."
  exit 1
fi

echo
echo "Release preflight passed."
