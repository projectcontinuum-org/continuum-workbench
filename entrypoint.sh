#!/bin/sh
set -eu

DEFAULT_MCP_URL="http://continuum-platform-api-server:8080/mcp"
MCP_URL="${CONTINUUM_API_SERVER_MCP_URL:-$DEFAULT_MCP_URL}"
case "$MCP_URL" in
  http://*|https://*) ;;
  *)
    echo "entrypoint: ignoring CONTINUUM_API_SERVER_MCP_URL='$MCP_URL' (not http/https), using $DEFAULT_MCP_URL" >&2
    MCP_URL="$DEFAULT_MCP_URL"
    ;;
esac

# $HOME is the PVC at runtime: create what the image cannot ship there and refresh the image-owned agent on every start
mkdir -p "$HOME/workspace" "$HOME/.claude/agents"
cp /opt/continuum/workflow-builder.md "$HOME/.claude/agents/workflow-builder.md"

# Register the api-server MCP server for Claude Code (user scope, so every project sees it); remove first because add fails if it exists
claude mcp remove --scope user continuum >/dev/null 2>&1 || true
if ! claude mcp add --scope user --transport http continuum "$MCP_URL" >/dev/null; then
  echo "entrypoint: could not register the continuum MCP server, Claude Code will not see it" >&2
fi

exec docker-entrypoint.sh "$@"
