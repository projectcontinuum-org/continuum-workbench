# continuum-workbench v0.0.14

Changes since `release/v0.0.13-alpha`. Image: `docker.io/projectcontinuum/continuum-workbench:0.0.14` (now multi-arch: `amd64` and `arm64`).

## Highlights

### AI Workflow Builder agent (CONTNM-146, #34)

Describe a workflow in plain language and the **@WorkflowBuilder** chat agent builds it for you as a `.cwf` file.

- New package `@continuum/workflow-builder-extension`, a Theia AI chat agent. It looks up available nodes, reads their documentation, has the api-server validate and build the workflow, and saves it into the open workspace folder.
- The workflow is built live. An empty file is created first and then rewritten after each added node, so you can open the `.cwf` and watch it grow.
- The agent knows what you have open. `{{continuumActiveFile}}` (or `#continuumActiveFile` in a message) passes the active file, selection and content. A `.cwf` open in the workflow editor is passed as a compact spec, so the agent can extend an existing workflow.
- All Continuum tooling comes from the api-server MCP server (registered under the key `continuum`, six tools). Node lookup, validation and the `.cwf` format stay consistent with the backend.
- A Claude Code version of the same agent is included in `workflow-builder-extension/claude-code/` (`workflow-builder.md` and `mcp.json`).
- The agent uses whichever model is selected in the chat box. `@theia/ai-claude-code` is added, pinned to `1.74.1`.

**Configuration:** set `CONTINUUM_API_SERVER_MCP_URL` on the Theia backend (default `http://localhost:8080/mcp`). The URL must be reachable from the workbench backend, not the browser. Restart the workbench after changing it. An `ai-features.mcp.mcpServers` entry in settings overrides it. See `workflow-builder-extension/README.md`.

### Workflow editor reloads when the file changes on disk

- An open `.cwf` tab now reloads automatically when another tool, such as an AI agent, changes the file.
- If you have unsaved edits, it asks before reloading and discarding them. Repeated writes do not stack prompts.
- Opening a file no longer writes to it. The workflow `id` and `name` are still corrected to match the file path, but only in memory, and they reach the file on your next save. Previously this was written back immediately, which could collide with a tool still writing the file.
- The editor refits the view to the reloaded nodes.

### Workflows now open on plain-HTTP deployments

Workflow ids are SHA-256 hashes of the file path, and `crypto.subtle` only exists on https or localhost. On plain-http deployments this broke opening a workflow. A built-in SHA-256 fallback now produces the same result, so existing workflow ids stay valid.

## Container image and release pipeline

- **Multi-arch images.** The release workflow builds `linux/amd64` and `linux/arm64` natively on matching runners and publishes one manifest as `:<version>` and `:latest`. The release build now uses the Dockerfile with Buildx instead of Jib. The Jib task remains in Gradle with a hardcoded repo.
- **Docker repository is fixed** to `projectcontinuum/continuum-workbench` instead of being derived from the GitHub repository name.
- **Larger image.** The production image now includes Claude Code (`claude`) and `@anthropic-ai/claude-agent-sdk`, the Workflow Builder subagent definition, and developer tooling: `git`, `gh`, `ripgrep`, `jq`, `curl`, `python3`/`pip`, `make`/`g++`, `ssh`, `vim`, `nano` and others. The Workflow Builder agent and Claude Code integration need these. If image size matters, consider a slimmer variant.
- The workflows no longer request `packages: write` permission.

## Project housekeeping

- Apache 2.0 `LICENSE` added, with a license section in the README (#31, #32). Broken links are fixed.
- New `CONTRIBUTING.md`, and the README is rewritten.
- Agent instruction files are consolidated into a single `AGENTS.md`. `CLAUDE.md`, `.clinerules`, `.cursorrules`, `.windsurfrules` and `.github/copilot-instructions.md` are removed (#33).
- Version bumped to `0.0.14` across all workspaces.

## Upgrade notes

- To use the Workflow Builder, deploy an api-server with the MCP endpoint enabled and set `CONTINUUM_API_SERVER_MCP_URL` on the workbench container if it is not at `http://localhost:8080/mcp`.
- Pull `projectcontinuum/continuum-workbench:0.0.14`. Anyone who pinned an architecture-specific tag can now use the multi-arch tag.

## Changes

| PR | Ticket | Summary |
|----|--------|---------|
| #34 | CONTNM-146 | Add Continuum workflow builder AI Agent |
| #33 | CONTNM-135 | Only keep single AGENTS.md |
| #32 | CONTNM-132 | Add LICENSE to the README |
| #31 | CONTNM-131 | Add licenses to the repos and fix old broken links |

**Full diff:** `release/v0.0.13-alpha...main` (38 files changed, 1378 insertions, 320 deletions)
