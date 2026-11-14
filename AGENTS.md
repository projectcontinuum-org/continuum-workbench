# Continuum Workbench — Frontend

> Full ecosystem blueprint: see the [Continuum repo AGENTS.md](https://github.com/projectcontinuum-org/continuum-platform-core/blob/main/AGENTS.md) for the complete architecture reference.

## This Repo

Browser-based IDE for Project Continuum. Turborepo monorepo with 4 Yarn workspaces.

## Workspaces

| Workspace | Package | Purpose |
|-----------|---------|---------|
| `continuum-core/` | `@continuum/core` | Shared React library — models, types, React Flow node components |
| `workflow-editor-extension/` | `@continuum/workflow-editor-extension` | Eclipse Theia extension — workflow canvas, node explorer, execution viewer. An open `.cwf` tab reloads when the file changes on disk (asks first if it has unsaved edits); opening a file never writes to it. Build request URLs, RSQL values, MQTT topic levels and SVG data URIs with `src/common/SafeEncoding.ts`; sanitize inline SVG with `src/common/SvgSanitizer.ts` (react-inlinesvg `preProcessor`). Node-output reads go through `DataService`, which never throws for an HTTP or network failure: it returns a `NodeDataResult` (`src/common/NodeDataResult.ts`: `page`, `not-found` for a 404, or `error`), and `TableOutputView` shows "Output not available" for a 404 (not your run, a run too old to have its run id stored, or a run that is gone: the api-server deliberately does not say which). Never read a response body before checking its status. Starting a workflow goes through `WorkflowService.activateWorkflow`, which resolves only when the server returned a workflow id and otherwise rejects with a `StartWorkflowError` (`src/common/StartWorkflowResult.ts`: a message safe to show, from the problem-detail `detail`, Spring's `message` or `error`, or a generic one per status); the Run button then shows `Could not start the workflow. <reason>` instead of "started successfully". Never treat a response as a started workflow before checking `response.ok`. Specs: `yarn workspace @continuum/workflow-editor-extension test`; `jsdom` is a devDependency because `SvgSanitizer.spec.ts` needs a DOM, and the file FAILS when jsdom is missing (set `ALLOW_NO_JSDOM=1` to run without it) |
| `workflow-builder-extension/` | `@continuum/workflow-builder-extension` | Theia AI chat agent "WorkflowBuilder" — a prompt only: discovers nodes, validates and builds the `.cwf` with api-server MCP tools, saves it with Theia's `writeFileContent` live (empty file first, rewritten after each added node); `claude-code/` has the Claude Code twin |
| `continuum-workbench/` | `@continuum/workbench` | Full Theia IDE app (port 3002) |
| `continuum-workbench-thin/` | `@continuum/workbench-thin` | Lightweight variant |

## Build

```bash
yarn install && yarn build && yarn start:workbench
# Open http://localhost:3002
```

## CI

`.github/workflows/ci.yml` runs on every pull request and push to `main`: `yarn install --frozen-lockfile --ignore-scripts` then `yarn test` (the specs of `workflow-editor-extension` and `workflow-builder-extension`; the other workspaces have none). `--frozen-lockfile` fails when `package.json` and `yarn.lock` disagree, so a dependency added without committing the lockfile cannot pass. Do not set `ALLOW_NO_JSDOM` in CI. Image builds and publishing stay in `build-module.yml` and `on-release.yml`.

## Stack

React 18, TypeScript 5, Eclipse Theia, React Flow 11, JSONForms, MQTT.js, Yarn + Turborepo, Node >= 20
