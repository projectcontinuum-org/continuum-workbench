#!/usr/bin/env bash
# Downloads the pinned fwcd kotlin-language-server release, verifies its SHA-256 and unpacks it, so the workbench can
# offer Kotlin completion, hover and diagnostics without any download at run time.
#
# Usage: scripts/download-kotlin-ls.sh [destination-directory]
#   destination defaults to <repository>/.kotlin-ls (ignored by git); the image build passes /opt/continuum/kotlin-ls.
#   The server is unpacked to <destination>/server (bin/kotlin-language-server, lib/*.jar).
#   The Kotlin standard library the server ships is also copied into a Maven-layout repository,
#   <destination>/m2/org/jetbrains/kotlin/kotlin-stdlib/<version>/. The server finds the standard library only through
#   kotlinc, a Maven repository (MAVEN_REPOSITORY) or a Gradle cache; without one every script shows false errors.
#   The backend sets MAVEN_REPOSITORY to <destination>/m2 for its server, and the file-editor extension starts the server
#   through <destination>/bin/kotlin-language-server (scripts/kotlin-language-server-launcher.sh), which does the same.
#
# Safe to run again: nothing is downloaded when the destination already holds this exact version.
# KOTLIN_LS_URL overrides only the download location (a mirror or a file:// URL); the checksum stays pinned, so a
# different file fails the build.
set -euo pipefail

VERSION="1.3.13"
SHA256="4fe7d71d087b307c7869036171bd9d8c6a4284cd7c25b89098b0a24eb2d9b6d2"
URL="${KOTLIN_LS_URL:-https://github.com/fwcd/kotlin-language-server/releases/download/${VERSION}/server.zip}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESTINATION="${1:-${SCRIPT_DIR}/../.kotlin-ls}"
MARKER="${DESTINATION}/server/.continuum-installed"

STDLIB_REPOSITORY="${DESTINATION}/m2"

if [[ -f "${MARKER}" && -n "$(find "${STDLIB_REPOSITORY}" -name 'kotlin-stdlib-*.jar' 2>/dev/null | head -n 1)" && -x "${DESTINATION}/bin/kotlin-language-server" && "$(cat "${MARKER}")" == "${VERSION} ${SHA256}" && -x "${DESTINATION}/server/bin/kotlin-language-server" ]]; then
  echo "kotlin-language-server ${VERSION} is already installed in ${DESTINATION}"
  exit 0
fi

for tool in curl unzip sha256sum; do
  command -v "${tool}" >/dev/null || { echo "download-kotlin-ls: ${tool} is required" >&2; exit 1; }
done

WORK="$(mktemp -d)"
trap 'rm -rf "${WORK}"' EXIT

echo "Downloading kotlin-language-server ${VERSION}"
curl --fail --silent --show-error --location --retry 3 --output "${WORK}/server.zip" "${URL}"

echo "${SHA256}  ${WORK}/server.zip" | sha256sum --check --status || {
  echo "download-kotlin-ls: checksum mismatch for ${URL}; expected ${SHA256}, got $(sha256sum "${WORK}/server.zip" | cut -d' ' -f1)" >&2
  exit 1
}

unzip -q "${WORK}/server.zip" -d "${WORK}/unpacked"
[[ -x "${WORK}/unpacked/server/bin/kotlin-language-server" ]] || {
  echo "download-kotlin-ls: the archive has no server/bin/kotlin-language-server" >&2
  exit 1
}

STDLIB_JAR="$(find "${WORK}/unpacked/server/lib" -maxdepth 1 -name 'kotlin-stdlib-[0-9]*.jar' | head -n 1)"
[[ -n "${STDLIB_JAR}" ]] || {
  echo "download-kotlin-ls: the archive ships no kotlin-stdlib jar in server/lib" >&2
  exit 1
}
STDLIB_VERSION="$(basename "${STDLIB_JAR}" .jar)"
STDLIB_VERSION="${STDLIB_VERSION#kotlin-stdlib-}"

mkdir -p "${DESTINATION}"
rm -rf "${DESTINATION}/server" "${STDLIB_REPOSITORY}"
mv "${WORK}/unpacked/server" "${DESTINATION}/server"
STDLIB_DIRECTORY="${STDLIB_REPOSITORY}/org/jetbrains/kotlin/kotlin-stdlib/${STDLIB_VERSION}"
mkdir -p "${STDLIB_DIRECTORY}"
cp "${DESTINATION}/server/lib/$(basename "${STDLIB_JAR}")" "${STDLIB_DIRECTORY}/"
mkdir -p "${DESTINATION}/bin"
install -m 0755 "${SCRIPT_DIR}/kotlin-language-server-launcher.sh" "${DESTINATION}/bin/kotlin-language-server"
echo "${VERSION} ${SHA256}" > "${MARKER}"
echo "Installed kotlin-language-server ${VERSION} in ${DESTINATION}/server"
