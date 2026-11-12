#!/usr/bin/env bash
# Regenerates the typed client SDKs in sdks/typescript and sdks/python with APIMatic, from contracts/openapi.yaml.
#
#   scripts/apimatic-sdks.sh            # validate, then generate both
#   scripts/apimatic-sdks.sh typescript # or just one language
#
# Needs an APIMatic API key: APIMATIC_API_KEY, or a one-line file at $APIMATIC_KEY_FILE (default ~/.apimatic-key).
# The key is passed to the CLI per call and is never written to the repo; the CLI stores no login with --auth-key.
# The contract is not edited: scripts/apimatic/prepare-spec.mjs builds the generator's input in a temp directory.
set -euo pipefail

CLI_VERSION="2.0.0" # @apimatic/cli, pinned
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LANGUAGES=("$@")
[ ${#LANGUAGES[@]} -eq 0 ] && LANGUAGES=(typescript python)

if [ -z "${APIMATIC_API_KEY:-}" ]; then
  KEY_FILE="${APIMATIC_KEY_FILE:-$HOME/.apimatic-key}"
  [ -r "$KEY_FILE" ] || { echo "No APIMatic key: set APIMATIC_API_KEY or create $KEY_FILE" >&2; exit 1; }
  APIMATIC_API_KEY="$(tr -d '[:space:]' < "$KEY_FILE")"
fi
export APIMATIC_CLI_TELEMETRY_OPTOUT=1

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

apimatic() { npx -y "@apimatic/cli@${CLI_VERSION}" "$@"; }

node "$ROOT/scripts/apimatic/prepare-spec.mjs" "$WORK/input"

echo "Validating with APIMatic..."
apimatic api validate --input "$WORK/input" --auth-key "$APIMATIC_API_KEY" > "$WORK/validate.log" 2>&1 || {
  sed -n '/Errors/,/Warnings/p' "$WORK/validate.log" >&2
  echo "APIMatic validation failed (full log above)." >&2
  exit 1
}
echo "Validation passed."

for lang in "${LANGUAGES[@]}"; do
  echo "Generating $lang SDK..."
  apimatic sdk generate --language "$lang" --input "$WORK/input" --destination "$WORK/out" --force \
    --auth-key "$APIMATIC_API_KEY" > "$WORK/generate-$lang.log" 2>&1 || {
    tail -5 "$WORK/generate-$lang.log" >&2
    exit 1
  }
  rm -rf "$ROOT/sdks/$lang"
  mkdir -p "$ROOT/sdks"
  cp -R "$WORK/out/$lang" "$ROOT/sdks/$lang"
  echo "Wrote sdks/$lang"
done
