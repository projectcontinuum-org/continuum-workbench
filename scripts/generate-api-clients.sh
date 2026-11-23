#!/usr/bin/env bash
# Regenerates the typescript-axios clients in workflow-editor-extension/src/generated/ from the OpenAPI specs that
# continuum-platform-core commits in docs/api/. Run it whenever those specs change, and commit the result.
#
#   scripts/generate-api-clients.sh [spec-dir]
#
# spec-dir defaults to ../continuum-platform-core/docs/api (a sibling checkout) or $CONTINUUM_API_SPEC_DIR.
# The generator is `openapi-generator` (brew install openapi-generator; written against 7.27.0) or whatever
# $OPENAPI_GENERATOR names. It runs locally and needs no network access.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
spec_dir="${1:-${CONTINUUM_API_SPEC_DIR:-$root/../continuum-platform-core/docs/api}}"
generator="${OPENAPI_GENERATOR:-openapi-generator}"
target="$root/workflow-editor-extension/src/generated"

command -v "$generator" >/dev/null || { echo "openapi-generator not found (set OPENAPI_GENERATOR)" >&2; exit 1; }

generate() {
    local name="$1" spec="$spec_dir/$2"
    [ -f "$spec" ] || { echo "spec not found: $spec" >&2; exit 1; }
    local out
    out="$(mktemp -d)"
    "$generator" generate -g typescript-axios -i "$spec" -o "$out" \
        --additional-properties=supportsES6=true,withSeparateModelsAndApi=true,apiPackage=api,modelPackage=models,useSingleRequestParameter=true \
        --global-property "apis,models,supportingFiles=api.ts:base.ts:common.ts:configuration.ts:index.ts,apiDocs=false,modelDocs=false,apiTests=false,modelTests=false" \
        >/dev/null
    rm -rf "$out/.openapi-generator"
    mkdir -p "$target"
    # Replace the previous output wholesale so a removed operation or schema does not leave a stale file behind.
    find "$target/$name" -mindepth 1 -delete 2>/dev/null || true
    mkdir -p "$target/$name"
    cp -R "$out"/. "$target/$name"/
    find "$out" -mindepth 1 -delete
    rmdir "$out"
    echo "generated $name from $2"
}

generate api-server continuum-api-server.openapi.yaml
generate credentials-server continuum-credentials-server.openapi.yaml
