# Workflow Builder (Theia AI agent)

Chat agent **@WorkflowBuilder** for the Continuum workbench. Describe a workflow in plain language; the agent looks up the available nodes, reads their documentation, then saves a validated `.cwf` into the open workspace folder and opens it in the workflow editor.

It uses whichever model is selected in the chat box (the agent asks for `default/universal`; override it under *AI Configuration*).

## How it works

1. **Discovery** — the agent calls the api-server MCP tools `listContinuumNodeCategories`, `searchContinuumNodes`, `getContinuumNodeMetadata` (server key `continuum`, tool ids `mcp_continuum_*`) and the extension tool `getContinuumNodeDocumentation` (REST `node-explorer/nodes/{id}/documentation`).
2. **Validate** — it calls the api-server MCP tool `validateContinuumWorkflow` with a compact spec (`name`, `nodes[{key,nodeId,properties}]`, `edges[{from,fromPort,to,toPort}]`). The server checks the spec against the live registry, including each node's full JSON Schema, and returns `valid` with every error (naming the node, edge or property) and warning. The agent fixes the errors and validates again until it returns `valid: true`.
3. **Save** — it calls `createContinuumWorkflow` with the same spec. `src/common/WorkflowAssembler.ts` checks it again (node ids, ports, property keys/types/enums, required properties, duplicate or doubly fed ports, cycles), so a workflow is never saved invalid even if the agent skips validation. It then adds the fields the API requires (`selected`, `positionAbsolute`, ...), lays the nodes out, and writes `<name>.cwf`. On errors nothing is written; the errors go back to the model.

## Editor context

The system prompt ends with the variable `{{continuumActiveFile}}` (`ActiveFileVariableContribution`). It fills in the file in the main editor area at the time of the request: its workspace path, the selected text, and the content. Users can also attach it to a single message with `#continuumActiveFile`.

- Text editors give the live content, including unsaved changes, and the selection.
- A `.cwf` open in the workflow editor is shown as a compact spec (`name`, `nodes[{key,nodeId,properties}]`, `edges`), without icons, schemas or layout, so the agent can extend an existing workflow.
- Selection and content are cut at 16,000 characters each; files over 1 MB are not read. With no file open the variable says so.
- Theia's built-in `currentFileContent` only works for text editors, which is why the agent uses its own variable.

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
- Keep the server key `continuum`: the agent prompt references the tools as `mcp_continuum_*`. Check *AI Configuration > MCP* that the server shows as started with four tools.

If the MCP server is not reachable the agent cannot discover nodes and will say so; `createContinuumWorkflow` still rejects anything not in the registry.

The node catalog and documentation tool use the workbench's existing REST base (`API_SERVER_BASE`, see `workflow-editor-extension/src/browser/service/ApiConfig.ts`), which is not changed by this variable.

## Develop

```bash
yarn install
yarn workspace @continuum/workflow-builder-extension build
yarn workspace @continuum/workflow-builder-extension test   # assembler unit tests (node:test)
```
