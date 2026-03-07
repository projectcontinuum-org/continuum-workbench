# Continuum Workbench — Frontend

> Full ecosystem blueprint: see the [Continuum repo CLAUDE.md](https://github.com/projectcontinuum/Continuum/blob/main/CLAUDE.md) for the complete architecture reference.

## This Repo

Browser-based IDE for Project Continuum. Turborepo monorepo with 4 Yarn workspaces.

## Workspaces

| Workspace | Package | Purpose |
|-----------|---------|---------|
| `continuum-core/` | `@continuum/core` | Shared React library — models, types, React Flow node components |
| `workflow-editor-extension/` | `@continuum/workflow-editor-extension` | Eclipse Theia extension — workflow canvas, node explorer, execution viewer |
| `continuum-workbench/` | `@continuum/workbench` | Full Theia IDE app (port 3002) |
| `continuum-workbench-thin/` | `@continuum/workbench-thin` | Lightweight variant |

## Build

```bash
yarn install && yarn build && yarn start:workbench
# Open http://localhost:3002
```

## Stack

React 18, TypeScript 5, Eclipse Theia, React Flow 11, JSONForms, MQTT.js, Yarn + Turborepo, Node >= 20
