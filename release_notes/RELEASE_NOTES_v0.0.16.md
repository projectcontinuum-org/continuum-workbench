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

### Platform calls go through generated typescript-axios clients (CONTNM-177)

`workflow-editor-extension` no longer calls the platform with hand-written `fetch` code. Its services use typescript-axios clients generated from the OpenAPI specs that continuum-platform-core commits in `docs/api/` (`continuum-api-server.openapi.yaml`, `continuum-credentials-server.openapi.yaml`), so request paths, parameters and models come from the spec and cannot drift from the API.

- The clients live in `workflow-editor-extension/src/generated/` and are regenerated with `yarn generate:api` (`scripts/generate-api-clients.sh`, which needs `openapi-generator`, written against 7.27.0). Do not edit them by hand. `ApiClients.ts` creates them once on the existing `API_SERVER_BASE` / `CREDENTIALS_MANAGER_BASE`.
- `axios` (`^1.7.4`, a range `yarn.lock` already resolves) is a new dependency of `workflow-editor-extension`.
- Behavior is unchanged: starting a workflow still rejects with a `StartWorkflowError` unless the server returned a workflow id, a node-output 404 is still "Output not available", and path values are still refused when empty, `.` or `..`. A new `HttpReply` helper lets those helpers read an axios response the way they read a `fetch` one.
- Credentials: the client receives the decrypted secret values from `GET /api/v1/credentials`; `CredentialsService` drops them so they never reach UI state. A credential error now shows the problem-detail `detail` first, then the deprecated `error`.
- `buildApiUrl` is removed from `SafeEncoding.ts` (the generated client builds URLs); `requirePathSegment` replaces its dot-segment check.

### Space and Backspace work in node dialog code editors (CONTNM-145)

You can now type a space in the node dialog's code editors (any `format: "code"` property, e.g. CreateTable's FreeMarker **JSON Array**). Before, React Flow's page-wide Space key (pan the canvas) blocked it. Backspace in an editor also no longer deletes the selected canvas nodes behind the dialog.

### Loop member nodes display icon and nesting-level background colors

Nodes that are members of a Loop construct now display a small loop icon in the top-left corner with the parent Loop's ID, and inherit a visually distinct background color based on their parent Loop's nesting level. This makes nested loop structures easier to understand at a glance, and helps color-blind users identify loop membership.

- **Loop icon with parent ID**: Each loop member displays a single pill-shaped badge containing the loop icon with the parent Loop ID (e.g., `#loop-1`, monospace) to its right.
- **Parent ID tooltip**: Hovering over the ID shows "Parent loop: #loop-id" for additional context.
- **Responsive Loop header**: When a Loop box is narrowed, its header drops items instead of overlapping: first the condition, then `max`, then the `LOOP` label (the node ID stays), and finally the Collapse button becomes an icon.
- **Accessibility**: The icon and ID combination helps users with color vision deficiency identify loop membership and parent relationships.
- Background colors use distinct MUI theme palette colors for each nesting depth:
  - Depth 0: Soft secondary blue (10% `secondary-main`)
  - Depth 1: Soft primary blue (10% `primary-main`)
  - Depth 2: Soft info cyan (10% `info-main`)
  - Depth 3: Soft success green (10% `success-main`)
- Each nesting level is now visually distinct and clear at a glance.
- The styling works in both the editor canvas and the run viewer.
- A new React hook `useLoopMembership` detects membership and nesting depth; it is available for use by custom node components.
- Theme-compatible: the icon, ID and background colors render correctly in both light and dark themes.
- **Loop condition box styling:** The condition display in Loop node headers now shrinks to fit content and centers the text. The box uses a subtle badge appearance (12% secondary-color tint background, no border) instead of a text-box style, creating a more cohesive visual theme and better space efficiency.

- `MonacoEditorWrapper` creates the editor with `editContext: false`. Theia's Monaco 1.108 defaults to the native EditContext input, a plain `div.native-edit-context`. React Flow, which only skips inputs, textareas and contenteditable elements, did not recognize it as a text field. With the option off, Monaco uses the classic hidden `textarea`. The wrapper also sets `acceptSuggestionOnCommitCharacter: false`, marks its container `nokey`, and stops `keydown`/`keyup` from bubbling past the editor (no `preventDefault`).
- `WorkflowEditor` turns off React Flow's `panActivationKeyCode` (Space) and `deleteKeyCode` (Backspace) while the node dialog is open.

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

### Flow variables in the Node Outputs dialog

Double-clicking a node in a run opens the Node Outputs dialog. It now has two tabs:

- **Outputs:** the node's data ports and its `$error`, as before. A failed node opens on its error. System keys such as `$variable` are no longer listed as ports. Before this change the dialog offered `$variable` as a port and tried to load it as a table; it also crashed when a node had no outputs at all. Both are fixed.
- **Flow Variables:** a table of every flow variable the node had, with a count on the tab.
  - Each row has its name and value. Objects and arrays open in the JSON viewer.
  - Each row has a source: **Set here**, **Inherited** or **Overrides inherited** (hover to see the inherited value).
  - When two branches brought different values for the same name, a note says which parent's value was used.

The platform stores only what each node set itself (`$variable` in its outputs, from continuum-platform-core 0.0.23). The inherited variables are recomputed in the workbench from the run snapshot by `src/common/FlowVariables.ts`, which follows the orchestrator's `FlowVariableMerger` rules:
- The nearest ancestor wins along a chain.
- Where branches join, the parent on the lower input port wins.

New `FlowVariables` spec. Runs recorded before platform 0.0.23, and workflows that set no flow variables, show an empty Flow Variables tab.

### Removed dead code: Node Repository widget and unused API clients (CONTNM-177)

Nothing visible changes: none of this was bound, imported or called.

- The Node Repository widget (replaced by the Node Explorer) is removed with its factory, view contribution, `NodeRepoExplorer` and `StyledTreeItem`, and the commented-out NodeRepo and Workflow Status bindings in the extension module.
- API clients with no caller are removed: `WorkflowTreeService`, `ExecutionTreeService`, `NodeRepoService`, `WorkflowService.getActiveWorkflows` and `ExecutionService.getActiveExecutionIds`. Their endpoints are removed from the api-server in platform 0.0.23 (or never existed there: `/execution-tree`, `/execution/active`, `/node-repo`).
- `@continuum/core` no longer exports the unused `ITreeItem` and `IExecutionStatus` types.
- `@continuum/core` drops the node-runtime contracts left over from the old in-browser executor, which nothing imported: `AbstractBaseNodeModel`, `AbstractTriggerNodeModel`, `IBaseNodeModel`, `ITriggerNodeModel`, `INodeExecutionContext`, `INodeModelsMap`, `INodePackageExport`, `INodeModelExport`, `IJobData`, `IWorkflowExecutionContext` and `INodeInputs`. It also stops exporting `MimeTypes`, `IPortProps`, `IPorts`, `INodeProgress` and `NodeExplorerItemType`; they stay in the package as parts of `IBaseNodeData`, `IData` and `INodeExplorerTreeItem`. The package now exports only the 20 symbols `workflow-editor-extension` uses. Its own imports no longer go through the package index, and all of them are extensionless. `"type": "module"` is removed from its `package.json` so webpack resolves those paths (in a `"type": "module"` package webpack 5 requires the extension); the compiled `dist` is still ES modules.
- `@continuum/core` is now types only, and its `package.json` lists just what its build needs: `typescript`, `@jsonforms/core` (now `3.7.0`, the version `workflow-editor-extension` uses, instead of a second copy at `3.2.0`) and `reactflow`, all as devDependencies. `reactflow` is imported only for its `Node` and `Edge` types, and `workflow-editor-extension` already depends on it at the same range. Removed: `react`, `react-dom`, `react-icons`, `react-icon`, `crypto`, `@types/node`, `@types/react`, `@types/react-dom`, `copyfile`, `@vitejs/plugin-react`, `typescript-plugin-css-modules`, `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `eslint-plugin-react-hooks` and `eslint-plugin-react-refresh` (core had no ESLint config and no `lint` script). Its `tsconfig.json` drops the DOM libs and `jsx`.
- `yarn.lock` drops the 87 entries that only those core dependencies pulled in (among them `@jsonforms/core@3.2.0`, `react-icons@4.12.0`, ESLint 8 with `@typescript-eslint` 6, Vite's React plugin with its Babel transforms, and `typescript-plugin-css-modules` with `less`, `sass` and `stylus`), plus the ranges only core requested from entries that stay. No remaining package changes version.
- `@mui/x-tree-view` and `@react-spring/web` are removed from `workflow-editor-extension` (only the deleted widget used them). `yarn.lock` drops them and the packages only they pulled in (`@mui/base@5.0.0-beta.20`, `@mui/utils@6.4.8` and `@react-spring/animated`, `core`, `rafz`, `shared`, `types`); no other package changes version.

## CI

- New `.github/workflows/ci.yml` runs on every pull request and push to `main`: `yarn install --frozen-lockfile --ignore-scripts` then `yarn test` (the specs of `workflow-editor-extension` and `workflow-builder-extension`). `--frozen-lockfile` fails when `package.json` needs an entry `yarn.lock` does not have, so a dependency added without committing the lockfile cannot pass; it does not fail on leftovers, so a removed dependency still passes with its old entries in `yarn.lock`. Image builds and publishing stay in `build-module.yml` and `on-release.yml`.
- Specs run with `node --test` against `tsconfig.test.json` (compiles `src/common` to `.test-out`). `jsdom` is a devDependency because `SvgSanitizer.spec.ts` needs a DOM and fails when jsdom is missing (set `ALLOW_NO_JSDOM=1` to run without it; do not set it in CI). New this release: `SafeEncoding`, `StartWorkflowResult`, `NodeDataResult`, `SvgSanitizer`, `XkcdNameGenerator` and `FlowVariables` specs.

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
| (this branch) | CONTNM-177 | Call the platform through typescript-axios clients generated from the OpenAPI specs |
| (this branch) | CONTNM-177 | Remove the unused Node Repository widget, dead API clients, core types and dependencies |
| (this branch) | CONTNM-171 | Node Outputs dialog: Flow Variables tab (own and inherited), system keys no longer listed as ports |

### Loop nodes in the workflow editor and viewer

The workbench now supports loop nodes — a container that wraps member nodes running repeatedly until their condition evaluates to false. This covers the end-to-end canvas rendering, properties dialog, run display, and builder support for writing conditions visually or as raw CEL.

- **Canvas rendering**: Loop boxes use a dark, translucent, theme-based purple fill and dashed rounded border. Their header shows the title, a bordered condition pill with the full expression on hover, the iteration limit, central status presentation, and an editor settings button. A collapsed loop shows its member count and a larger expand control; an expanded loop shows compact carried-value chips in a horizontally scrollable row when run data and source attribution are available, with member nodes kept below the run summary. Nested loops use a progressively stronger purple tint, while loop-scope wires use a brighter dashed accent unless central run-status colors apply. Collapsed crossing edges attach to the nearest left or right box edge without changing saved connections.
- **Loop movement and conditions**: Moving a member beyond any box edge unparents it without changing the saved loop size or shifting it away from the mouse drop point, including when it came from nested loops. Explicit resize updates the box live while dragging and continues to enforce member bounds. The selected Loop's subtle corner controls stay visible while larger transparent grab areas ease resizing. The LOOP label uses bold monospace styling, and deeper loop tints increase only gradually. CEL-only expressions have a visible canvas badge. A negated single comparison can open in the builder when the parser preserves its equivalent comparison operator. Validation requests include default editor-only selection, dragging, and absolute-position fields.
- **Loop editing**: Dropping the Loop palette item creates a Loop node. Dropping or moving nodes into and out of expanded boxes updates their parent membership and relative positions; loop boxes cannot be connected as graph endpoints, and cross-boundary cycles are refused. Loop boxes can be resized while keeping their members inside the container, and deleting a loop asks whether to delete or keep its members. Collapse and expand controls update saved loop state, hide members, and reattach crossing edges in the display without changing stored connections.
- **Loop properties dialog**: Double-clicking a loop opens a two-mode editor — CEL text mode (Monaco-based) or a visual query builder for supported comparisons, nested `and`/`or` groups, and group negation over flow variables. Editing in CEL mode stays in that mode; empty conditions remain editable with a required-condition message. CEL-only expressions show why the builder is unavailable, and replacing one requires confirmation.
- **Loop condition builder**: Builder-compatible CEL conditions open in visual mode; other conditions open in CEL. The builder loads on demand with loading and error feedback. Conditions are validated against the current edited workflow (debounced 500 ms), with issues and service availability shown in the dialog.
- **Loop editor interaction and theme**: Native double-clicks open properties for standard nodes and Loop nodes; node dragging starts only after a small pointer movement. The visual condition builder uses Theia theme colours in dark and light mode. Loop resize handles remain visually small while transparent corner and edge hit areas make them easier to grab without covering header actions.
- **Run display**: Loop nodes use the shared node status label, badge, and colour presentation and show `Iteration k of max` while running. Successful completion reads `Finished after N iteration(s)` with correct singular grammar; backend warning and failure details are retained. Expanded loops also show attributed carried values from the current run snapshot. Carried values apply at loop entry members; their available values then propagate to internal children with normal parent precedence. Unrelated loop scopes remain independent.
- **Loop dialog and canvas polish**: The condition editor renders from its JSONForms UI-schema options. Portless Loop boxes expose no user-connectable handles; collapsed edges use invisible display-only anchors, while edges crossing expanded boxes remain visible above the box background and below member nodes. Expanded run-view boxes retain stored dimensions and grow as needed to contain their members.
- **Build fix**: Fixed TypeScript compilation issues in the Loop canvas hook and Flow Variables snapshot typing.
- **Workflow Builder agents**: Both prompt twins (`claude-code/workflow-builder.md` and `WorkflowBuilderPrompt.ts`) now include a loop reference section — nodeId `org.projectcontinuum.core.builtin.Loop`, required properties (condition, maxIterations, onLimit, onNonBooleanResult), CEL semantics, available libraries, limits, examples, and validation rules.
- **Dependency**: Added `react-querybuilder` ^8.28.0 to `workflow-editor-extension/package.json` for the visual condition builder. The common condition adapter uses its CEL parser/formatter; LoopConditionBuilder is the only UI component that imports the builder.

**Full diff:** `release/0.0.14...HEAD` (53 files changed, 2451 insertions, 381 deletions)
