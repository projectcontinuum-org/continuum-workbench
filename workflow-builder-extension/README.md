# Workflow Builder (Theia AI agent)

Chat agent **@WorkflowBuilder** for the Continuum workbench. Describe a workflow in plain language; the agent looks up the available nodes, reads their documentation, has the api-server validate and build the workflow, then saves it as a `.cwf` in the open workspace folder.

It uses whichever model is selected in the chat box (the agent asks for `default/universal`; override it under *AI Configuration*).

The agent is only a prompt: all Continuum-specific tooling lives in the api-server MCP server, and files are written with Theia's built-in AI tools. The same prompt runs in Claude Code (see below).

## How it works

All Continuum tools are api-server MCP tools (server key `continuum`, tool ids `mcp_continuum_*`), so node lookup, validation and the `.cwf` format stay consistent with the backend data model (`ContinuumWorkflowModel`).

The workflow is built **live**, so a user can open the file and watch it grow (an open `.cwf` tab reloads when the file changes on disk):

1. **Discovery** — `listContinuumNodeCategories` and `searchContinuumNodes` find a node for every step before any file exists; if a step has no node the agent stops.
2. **Empty file** — `buildContinuumWorkflow` with `nodes: []` returns `fileName` (`<name-slug>.cwf`) and an empty workflow. Theia's `findFilesByPattern` checks the name is free (the agent adds `-2`, `-3`, ... if not) and `writeFileContent` saves it; the agent tells the user the path.
3. **Node by node** — for each node, `getContinuumNodeMetadata` and `getContinuumNodeDocumentation`, then `buildContinuumWorkflow` with the whole compact spec so far (`name`, `nodes[{key,nodeId,properties}]`, `edges[{from,fromPort,to,toPort}]`), and `writeFileContent` overwrites the same file with the returned workflow unchanged. The server checks the spec against the live registry, including each node's full JSON Schema; invalid specs return errors (naming the node, edge or property) and no workflow, and the agent fixes them before saving. The workflow is the complete `.cwf` content: registry metadata per node, properties merged over the defaults, the fields the API requires (`selected`, `positionAbsolute`, ...) and a layout. `validateContinuumWorkflow` checks a spec without building it.
4. **Finish** — the agent checks every step is covered and the last build's warnings (an unconnected input port means a missing edge), then saves the complete workflow.

`writeFileContent` and `findFilesByPattern` come from `@theia/ai-ide`, which the workbench app already includes.

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
- Keep the server key `continuum`: the agent prompt references the tools as `mcp_continuum_*`. Check *AI Configuration > MCP* that the server shows as started with six tools.

If the MCP server is not reachable the agent has no Continuum tools: it cannot discover nodes or build a workflow, and will say so.

## Claude Code agent

`claude-code/` holds the same agent for Claude Code: `workflow-builder.md` (a subagent definition with the same rules) and `mcp.json` (the `continuum` MCP server). It uses only the six MCP tools above plus Claude Code's built-in `Write` to save each build to the same file: no Bash, no scripts, no other tools. `Write` refuses to overwrite a file the agent has not read, so an existing name gets a `-2`, `-3`, ... suffix; the file it created itself it may overwrite.

```bash
cp claude-code/workflow-builder.md <project>/.claude/agents/workflow-builder.md
# register the MCP server, e.g. from claude-code/mcp.json, and restart Claude Code
```

## Develop

```bash
yarn install
yarn workspace @continuum/workflow-builder-extension build
yarn workspace @continuum/workflow-builder-extension test   # src/common unit tests (node:test)
```
