# Workflow Builder (Theia AI agent)

Chat agent **@WorkflowBuilder** for the Continuum workbench. Describe a workflow in plain language; the agent looks up the available nodes, reads their documentation, then saves a validated `.cwf` into the open workspace folder and opens it in the workflow editor.

It uses whichever model is selected in the chat box (the agent asks for `default/universal`; override it under *AI Configuration*).

## How it works

1. **Discovery** — the agent calls the api-server MCP tools `listContinuumNodeCategories`, `searchContinuumNodes`, `getContinuumNodeMetadata` (server key `continuum`, tool ids `mcp_continuum_*`) and the extension tool `getContinuumNodeDocumentation` (REST `node-explorer/nodes/{id}/documentation`).
2. **Build** — it calls `createContinuumWorkflow` with a compact spec (`name`, `nodes[{key,nodeId,properties}]`, `edges[{from,fromPort,to,toPort}]`).
3. **Validate and save** — `src/common/WorkflowAssembler.ts` checks node ids, ports, property keys/types/enums, required properties, duplicate or doubly fed ports and cycles against the live node registry, adds the fields the API requires (`selected`, `positionAbsolute`, ...), lays the nodes out, and writes `<name>.cwf`. On errors nothing is written; the errors go back to the model so it can fix and retry.

## MCP server setup

The extension registers the api-server MCP server as an application default under the key `continuum`. Its URL comes from an environment variable of the **Theia backend** process, so it can be set per deployment:

| Variable | Default | Meaning |
|----------|---------|---------|
| `CONTINUUM_API_SERVER_MCP_URL` | `http://localhost:8080/mcp` | Full URL of the api-server MCP endpoint (streamable HTTP) |

```bash
# Docker / Kubernetes: set it on the workbench container, e.g.
CONTINUUM_API_SERVER_MCP_URL=http://continuum-api-server:8080/mcp
```

- The MCP client runs in the Theia backend, so the URL must be reachable from there, not from the browser.
- A blank or non-http(s) value is ignored with a warning in the backend log, and the default is used.
- The variable is read when the workbench frontend starts. Restart the workbench after changing it.
- Settings win: an `ai-features.mcp.mcpServers` entry in user or workspace settings overrides this default.
- Keep the server key `continuum`: the agent prompt references the tools as `mcp_continuum_*`. Check *AI Configuration > MCP* that the server shows as started with three tools.

If the MCP server is not reachable the agent cannot discover nodes and will say so; `createContinuumWorkflow` still rejects anything not in the registry.

The node catalog and documentation tool use the workbench's existing REST base (`API_SERVER_BASE`, see `workflow-editor-extension/src/browser/service/ApiConfig.ts`), which is not changed by this variable.

## Develop

```bash
yarn install
yarn workspace @continuum/workflow-builder-extension build
yarn workspace @continuum/workflow-builder-extension test   # assembler unit tests (node:test)
```
