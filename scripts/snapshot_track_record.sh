#!/usr/bin/env bash
# scripts/snapshot_track_record.sh
# ================================
#
# Per INTEGRATIONS-W1 Workflow Improvement #2 — single source of truth for
# public-facing track-record numbers. Fetches live values from
# /api/performance-public + /api/merkle-batches and emits a single JSON blob
# with the 4 fields any new tutorial / mirror / landing surface should
# reference (or template against, then footnote with snapshot date).
#
# Usage:
#   bash scripts/snapshot_track_record.sh
#
# Output (single line of JSON to stdout):
#   {"pfe_wr":"89.4%","signal_count":56375,"batch_count":16,"snapshot_date":"2026-04-26"}
#
# Exit codes:
#   0 — success (both endpoints responded; JSON emitted)
#   1 — fetch failure (one or both endpoints unreachable; partial-or-no JSON)
#   2 — jq missing
#
# Dependencies:
#   - bash 4+
#   - curl (any modern version)
#   - jq (https://stedolan.github.io/jq/)

set -euo pipefail

PERF_URL="${ALGOVAULT_PERF_URL:-https://algovault.com/api/performance-public}"
MERKLE_URL="${ALGOVAULT_MERKLE_URL:-https://algovault.com/api/merkle-batches}"

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required but not found in PATH" >&2
  exit 2
fi

PERF_JSON=$(curl -sfS "$PERF_URL" 2>/dev/null || true)
MERKLE_JSON=$(curl -sfS "$MERKLE_URL" 2>/dev/null || true)

if [[ -z "$PERF_JSON" || -z "$MERKLE_JSON" ]]; then
  echo "ERROR: failed to fetch one or both endpoints (perf=${#PERF_JSON} bytes, merkle=${#MERKLE_JSON} bytes)" >&2
  exit 1
fi

# Round PFE to 1 decimal place + suffix %; format counts as raw integers.
PFE_RAW=$(printf '%s' "$PERF_JSON" | jq -r '.overall.pfeWinRate // empty')
SIGNAL_COUNT=$(printf '%s' "$PERF_JSON" | jq -r '.totalSignals // empty')
BATCH_COUNT=$(printf '%s' "$MERKLE_JSON" | jq -r '.batches | length')
SNAPSHOT_DATE=$(date -u +%Y-%m-%d)

if [[ -z "$PFE_RAW" || -z "$SIGNAL_COUNT" || -z "$BATCH_COUNT" ]]; then
  echo "ERROR: required field missing in response (pfe=$PFE_RAW signal=$SIGNAL_COUNT batch=$BATCH_COUNT)" >&2
  exit 1
fi

# 0.8945 → "89.4%" (1 decimal place)
PFE_PCT=$(awk -v r="$PFE_RAW" 'BEGIN{printf "%.1f%%", r * 100}')

# Emit JSON with all 4 keys expected by the AC.
jq -n \
  --arg pfe_wr "$PFE_PCT" \
  --argjson signal_count "$SIGNAL_COUNT" \
  --argjson batch_count "$BATCH_COUNT" \
  --arg snapshot_date "$SNAPSHOT_DATE" \
  '{pfe_wr: $pfe_wr, signal_count: $signal_count, batch_count: $batch_count, snapshot_date: $snapshot_date}'
