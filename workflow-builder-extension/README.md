# Workflow Builder (Theia AI agent)

Chat agent **@WorkflowBuilder** for the Continuum workbench. Describe a workflow in plain language; the agent looks up the available nodes, reads their documentation, then saves a validated `.cwf` into the open workspace folder and opens it in the workflow editor.

It uses whichever model is selected in the chat box (the agent asks for `default/universal`; override it under *AI Configuration*).

## How it works

1. **Discovery** — the agent calls the api-server MCP tools `listContinuumNodeCategories`, `searchContinuumNodes`, `getContinuumNodeMetadata` (server key `continuum`, tool ids `mcp_continuum_*`) and the extension tool `getContinuumNodeDocumentation` (REST `node-explorer/nodes/{id}/documentation`).
2. **Build** — it calls `createContinuumWorkflow` with a compact spec (`name`, `nodes[{key,nodeId,properties}]`, `edges[{from,fromPort,to,toPort}]`).
3. **Validate and save** — `src/common/WorkflowAssembler.ts` checks node ids, ports, property keys/types/enums, required properties, duplicate or doubly fed ports and cycles against the live node registry, adds the fields the API requires (`selected`, `positionAbsolute`, ...), lays the nodes out, and writes `<name>.cwf`. On errors nothing is written; the errors go back to the model so it can fix and retry.

## MCP server setup

`continuum-workbench/package.json` ships a default preference:

```json
"ai-features.mcp.mcpServers": { "continuum": { "serverUrl": "http://localhost:8080/api-server/mcp", "autostart": true } }
```

The MCP client runs in the **Theia backend**, so the URL must be reachable from there, not from the browser. For a gateway or cluster deployment override the preference in the user or workspace settings with the in-cluster URL. Keep the server key `continuum`: the agent prompt references `mcp_continuum_*`. Check *AI Configuration > MCP* that the server shows as started with three tools.

If the MCP server is not reachable the agent cannot discover nodes and will say so; `createContinuumWorkflow` still rejects anything not in the registry.

## Develop

```bash
yarn install
yarn workspace @continuum/workflow-builder-extension build
yarn workspace @continuum/workflow-builder-extension test   # assembler unit tests (node:test)
```
