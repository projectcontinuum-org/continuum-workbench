# Continuum Workbench — Frontend

> Full ecosystem blueprint: see the [Continuum repo AGENTS.md](https://github.com/projectcontinuum-org/continuum-platform-core/blob/main/AGENTS.md) for the complete architecture reference.

## This Repo

Browser-based IDE for Project Continuum. Turborepo monorepo with 4 Yarn workspaces.

## Workspaces

| Workspace | Package | Purpose |
|-----------|---------|---------|
| `continuum-core/` | `@continuum/core` | Shared React library — models, types, React Flow node components |
| `workflow-editor-extension/` | `@continuum/workflow-editor-extension` | Eclipse Theia extension — workflow canvas, node explorer, execution viewer. An open `.cwf` tab reloads when the file changes on disk (asks first if it has unsaved edits); opening a file never writes to it. Build request URLs, RSQL values, MQTT topic levels and SVG data URIs with `src/common/SafeEncoding.ts`; sanitize inline SVG with `src/common/SvgSanitizer.ts` (react-inlinesvg `preProcessor`). Specs: `yarn workspace @continuum/workflow-editor-extension test` |
| `workflow-builder-extension/` | `@continuum/workflow-builder-extension` | Theia AI chat agent "WorkflowBuilder" — a prompt only: discovers nodes, validates and builds the `.cwf` with api-server MCP tools, saves it with Theia's `writeFileContent` live (empty file first, rewritten after each added node); `claude-code/` has the Claude Code twin |
| `continuum-workbench/` | `@continuum/workbench` | Full Theia IDE app (port 3002) |
| `continuum-workbench-thin/` | `@continuum/workbench-thin` | Lightweight variant |

## Build

```bash
yarn install && yarn build && yarn start:workbench
# Open http://localhost:3002
```

## Stack

React 18, TypeScript 5, Eclipse Theia, React Flow 11, JSONForms, MQTT.js, Yarn + Turborepo, Node >= 20
