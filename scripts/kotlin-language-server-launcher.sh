#!/usr/bin/env bash
# Starts the bundled kotlin-language-server with the install's own Kotlin standard library repository on its search
# path. Installed as <install>/bin/kotlin-language-server by download-kotlin-ls.sh and used as the server command of the
# file-editor extension, so the server finds the standard library whatever environment the workbench was started with
# (the image sets MAVEN_REPOSITORY as well; a development start does not).
set -euo pipefail

INSTALL_DIRECTORY="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export MAVEN_REPOSITORY="${INSTALL_DIRECTORY}/m2"
exec "${INSTALL_DIRECTORY}/server/bin/kotlin-language-server" "$@"
