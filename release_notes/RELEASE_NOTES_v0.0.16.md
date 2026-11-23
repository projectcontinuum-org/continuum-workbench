# continuum-workbench v0.0.16

Changes since `release/0.0.14` (the last documented release). This bundles the work shipped in `release/0.0.15` and the 0.0.16 version bump on `main` that had no notes file, plus this branch's CONTNM-167 changes. Image: `docker.io/projectcontinuum/continuum-workbench:0.0.16`.

> Note: `release/0.0.15` (CONTNM-159) and the 0.0.16 security bump (CONTNM-161) shipped without a notes file. The two are summarized below so nothing since `release/0.0.14` is lost; the CONTNM-167 highlights are the new work on this branch.

## Highlights

### Version control (git) in the workbench (CONTNM-167)

The full IDE now ships with Source Control. The workbench runs the VS Code `git` and `git-base` extensions on Theia's plugin host (`@theia/plugin-ext`, `@theia/plugin-ext-vscode`), and `@theia/scm` + `@theia/scm-extra` provide the Source Control view — the same setup the official Theia IDE (Blueprint) uses. There is no `@theia/git`.

- The `git` and `git-base` extensions are declared as `theiaPlugins` in `continuum-workbench/package.json`, fetched from the Eclipse-built `eclipse-theia/vscode-builtin-extensions` 1.108.2 release assets, and downloaded into `continuum-workbench/plugins/` by the new `yarn download:plugins` script (`--rate-limit=15 --parallel=false`).
- The Dockerfile runs `yarn download:plugins` in the builder stage, and the production `CMD` loads them with `--plugins=local-dir:/app/plugins`. The plugins directory is git-ignored.
- Use the Eclipse builds, not the older open-vsx ones: open-vsx `vscode.git` 1.88 implements an older SCM history API and fails to open repositories (`provider.onDidChangeCurrentHistoryItemRefs is not a function`).

### Welcome page links to docs and opens Keyboard Shortcuts (CONTNM-167)

The Welcome widget's **Help** section now has working links instead of inert text.

- **Documentation** opens `https://docs.projectcontinuum.org` and **Node Development** opens the create-new-nodes guide (`https://docs.projectcontinuum.org/docs/contributing/create-new-nodes`) — both open in a new tab.
- **Keyboard Shortcuts** opens Theia's built-in keybindings reference. This adds `@theia/keymaps` (`1.74.1`, pinned to match the VCS packages) as a workbench dependency; the `keymaps:open` command is wired to the link, so it opens the keymaps widget inside the IDE.

### Workflow Runs tree shows scheduled runs under their schedule (CONTNM-167)

Scheduled runs now nest under a per-schedule node in the Workflow Runs tree, instead of all runs piling under the workflow node.

- A schedule is now stored as `{workflowName}/{scheduleName}.schedule`, where `scheduleName` is an alphanumeric-only PascalCase name from the new `src/common/XkcdNameGenerator.ts` (e.g. `GreenOtter37`). The snapshot name carries this path and becomes the scheduled run's `workflowUri`, so the tree can parse it.
- The tree normalizes distinct run URIs by stripping the `/<scheduleName>.schedule` suffix, so manual runs and every schedule of one workflow still collapse to a single workflow node. Expanding a workflow node loads a `ScheduleNode` tier — one node per schedule name plus a synthetic `(manual)` node for unscheduled runs — and each schedule node paginates its own runs with a trailing "Load more". Manual and named schedules get distinct icons (`codicon-play` vs `fa-stopwatch`).
- A new right-click context menu on workflow nodes (`WorkflowRunsContextMenu` / commands in `WorkflowRunsCommandContribution`): **Open in Editor**, **Run Workflow**, **Schedule Workflow…**, **Manage Schedules…**, **Pause / Resume All Schedules**, **Cancel Active Runs**, **Refresh Runs**, and **Copy Workflow Path**. Schedule and Run actions open the editor and chain a one-shot `pendingAction` onto the open (the editor applies it after the file loads, and fires it only once).
- The **Schedule Workflow** dialog gained a "Schedule name" field (pre-filled with a generated xkcd name, with a refresh button). User edits are sanitized to letters and digits so the stored path stays a safe literal; the dialog shows the resulting `Stored as: {workflowName}/{name}.schedule`. The **Manage Schedules** tab now fetches all owner schedules and filters client-side by parsing the path (with a backward-compat fallback for pre-existing schedules whose name was just the workflow name), because the old exact-match server query no longer matches the new path format.

### Hidden widgets: Debug, Testing, Outline (CONTNM-167)

Adding `@theia/plugin-ext` for git support transitively re-introduces `@theia/debug` and `@theia/test` (and `@theia/monaco` brings `@theia/outline-view`). The packages are kept — monaco is the editor, plugin-ext runs the git extension — but `HideUnwantedWidgetsContribution` now unregisters their toggle commands on startup and closes the views after layout init, so the Debug, Testing and Outline widgets no longer appear in the palette or View menu. The same commit also drops `@theia/ai-ide` (the AI chat window and Ollama provider remain available via `@theia/ai-chat-ui` / `@theia/ai-ollama` and `@theia/ai-core`'s default `AIActivationService`).

### Security: shell, SQL, template and header injection (CONTNM-161, #37)

Hardening across the workbench services, landed on `main` with the 0.0.16 bump.

- New `src/common/SafeEncoding.ts` for building request URLs, RSQL values, MQTT topic levels and SVG data URIs; inline SVG is sanitized with `src/common/SvgSanitizer.ts` (the `react-inlinesvg` `preProcessor`). `TableOutputView` and the SVG cell renderer / dialog no longer render unsanitized SVG.
- `WorkflowService.activateWorkflow` now resolves only when the server returned a workflow id, and otherwise rejects with a `StartWorkflowError` (`src/common/StartWorkflowResult.ts`) — a message safe to show, built from the problem-detail `detail`, Spring's `message` or `error`, or a generic one per status. The Run button shows `Could not start the workflow. <reason>` instead of "started successfully". Never treat a response as a started workflow before checking `response.ok`.
- Node-output reads go through `DataService`, which never throws for an HTTP or network failure: it returns a `NodeDataResult` (`page`, `not-found` for a 404, or `error`). `TableOutputView` shows "Output not available" for a 404 (not your run, a run too old to have its run id stored, or a run that is gone — the api-server deliberately does not say which). Response bodies are never read before their status is checked.
- The schedule, runs, execution and tree services were tightened against the same injection classes.

### Workflow Builder agent is visible to the workbench user (CONTNM-159, #36)

Previously shipped in `release/0.0.15` but un-noted. The `@WorkflowBuilder` chat agent and its Claude Code twin were not reachable from the running container because the image ran as `root` and put agent files under `/root`, while the cluster manager runs the pod as uid 1000.

- The production image now runs as a `continuum` user (the base `node` user renamed and moved to `/home/continuum`), with `sudo` available. Claude Code and the agent definition are installed image-owned under `/opt` (auto-update disabled), because the cluster manager mounts a PVC at `/home/continuum` that hides anything the image ships there.
- A new `entrypoint.sh` seeds the PVC-backed home on every start: creates `~/workspace` and `~/.claude/agents`, copies the `workflow-builder.md` agent, and registers the api-server MCP server for Claude Code at user scope from `CONTINUUM_API_SERVER_MCP_URL` (default `http://continuum-platform-api-server:8080/mcp`), validating it is an `http(s)` URL before use.
- The `workflow-builder.md` agent prompt was updated to always delegate to the agent and to strip a leading `cwf` marker line before the Write hook saves `.cwf` content.

### Removed dead code: Node Repository widget and unused API clients (CONTNM-177)

Nothing visible changes: none of this was bound, imported or called.

- The Node Repository widget (replaced by the Node Explorer) is removed with its factory, view contribution, `NodeRepoExplorer` and `StyledTreeItem`, and the commented-out NodeRepo and Workflow Status bindings in the extension module.
- API clients with no caller are removed: `WorkflowTreeService`, `ExecutionTreeService`, `NodeRepoService`, `WorkflowService.getActiveWorkflows` and `ExecutionService.getActiveExecutionIds`. Their endpoints are removed from the api-server in platform 0.0.23 (or never existed there: `/execution-tree`, `/execution/active`, `/node-repo`).
- `@continuum/core` no longer exports the unused `ITreeItem` and `IExecutionStatus` types.
- `@mui/x-tree-view` and `@react-spring/web` are removed from `workflow-editor-extension` (only the deleted widget used them). `yarn.lock` drops them and the packages only they pulled in (`@mui/base@5.0.0-beta.20`, `@mui/utils@6.4.8` and `@react-spring/animated`, `core`, `rafz`, `shared`, `types`); no other package changes version.

## CI

- New `.github/workflows/ci.yml` runs on every pull request and push to `main`: `yarn install --frozen-lockfile --ignore-scripts` then `yarn test` (the specs of `workflow-editor-extension` and `workflow-builder-extension`). `--frozen-lockfile` fails when `package.json` and `yarn.lock` disagree, so a dependency added without committing the lockfile cannot pass. Image builds and publishing stay in `build-module.yml` and `on-release.yml`.
- Specs run with `node --test` against `tsconfig.test.json` (compiles `src/common` to `.test-out`). `jsdom` is a devDependency because `SvgSanitizer.spec.ts` needs a DOM and fails when jsdom is missing (set `ALLOW_NO_JSDOM=1` to run without it; do not set it in CI). New this release: `SafeEncoding`, `StartWorkflowResult`, `NodeDataResult`, `SvgSanitizer` and `XkcdNameGenerator` specs.

## Upgrade notes

- Pull `projectcontinuum/continuum-workbench:0.0.16`. The image now runs as the `continuum` user; the cluster manager should run the pod as uid 1000 and mount a PVC at `/home/continuum`.
- For the Workflow Builder, ensure an api-server with the MCP endpoint is reachable from the workbench backend and set `CONTINUUM_API_SERVER_MCP_URL` if it is not at `http://continuum-platform-api-server:8080/mcp`.
- Pre-existing schedules whose name was just the workflow name still appear in Manage Schedules (backward-compat fallback). New schedules are stored as `{workflowName}/{scheduleName}.schedule`.

## Changes

| PR | Ticket | Summary |
|----|--------|---------|
| #37 | CONTNM-161 | Security: fix shell, SQL, template and header injection; version bump to 0.0.16 |
| #36 | CONTNM-159 | Workflow Builder agent visible to the workbench user; run as `continuum` user |
| #35 | — | Add the v0.0.14 release notes file |
| (this branch) | CONTNM-167 | Add VCS (git) support via Theia plugin host |
| (this branch) | CONTNM-167 | Remove Testing, Debug and Outline widgets |
| (this branch) | CONTNM-167 | Show workflow scheduled runs under scheduled tree nodes |
| (this branch) | CONTNM-177 | Remove the unused Node Repository widget, dead API clients, core types and dependencies |

**Full diff:** `release/0.0.14...HEAD` (53 files changed, 2451 insertions, 381 deletions)
