<div align="center">
  <h1>Continuum Workbench</h1>
  <strong>Browser-native IDE for building visual workflows in <a href="https://github.com/projectcontinuum/Continuum">Project Continuum</a></strong>
</div>

<div align="center">
  <img src="https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white" alt="React 18">
  <img src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Eclipse_Theia-IDE-1a237e?logo=eclipse&logoColor=white" alt="Eclipse Theia">
  <img src="https://img.shields.io/badge/React_Flow-11-ff0072?logo=react&logoColor=white" alt="React Flow">
  <img src="https://img.shields.io/badge/Turborepo-Build-000?logo=turborepo&logoColor=white" alt="Turborepo">
</div>

---

## 🌐 Part of Project Continuum

This is the **frontend** for [Project Continuum](https://github.com/projectcontinuum/Continuum) — a distributed, crash-proof workflow execution platform. The workbench gives you a full IDE experience in the browser for designing, configuring, and monitoring data processing workflows.

---

## 🔥 What Is This

A Turborepo monorepo containing the browser-based workflow editor and IDE for Project Continuum:

- **Drag-and-drop workflow canvas** powered by React Flow — connect nodes visually to build DAGs
- **Full IDE experience** built on Eclipse Theia — file explorer, editors, terminals, extensions
- **Real-time execution monitoring** — watch workflows execute step-by-step via MQTT over WebSockets
- **Dynamic node configuration** — configure any node's properties through auto-generated forms (JSONForms)
- **Two variants** — full-featured Theia workbench and a lightweight thin workbench

---

## 🧩 Workspaces

| Workspace | Package | Description |
|-----------|---------|-------------|
| `continuum-core` | `@continuum/core` | Shared React library — models, types, React Flow node components |
| `workflow-editor-extension` | `@continuum/workflow-editor-extension` | Eclipse Theia extension — workflow editor, node explorer, execution viewer |
| `continuum-workbench` | `@continuum/workbench` | Full Theia IDE application (browser target) |
| `continuum-workbench-thin` | `@continuum/workbench-thin` | Lightweight Theia application (browser-only) |

---

## ✨ Tech Stack

| Layer | Technology |
|-------|-----------|
| **IDE Framework** | Eclipse Theia (latest) |
| **Workflow Canvas** | React Flow 11 |
| **UI Framework** | React 18 + TypeScript 5 |
| **Form Rendering** | JSONForms 3 |
| **Real-time Events** | MQTT.js (WebSocket) |
| **Build System** | Yarn Workspaces + Turborepo |
| **Node.js** | >= 20 |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js >= 20**
- **Yarn 1.22+**
- **Backend services running** — see the [Continuum](https://github.com/projectcontinuum/Continuum) repo for Docker Compose setup

### Development

```bash
git clone https://github.com/projectcontinuum/continuum-workbench.git
cd continuum-workbench

# Install dependencies
yarn install

# Build all workspaces
yarn build

# Start the full workbench
yarn start:workbench
```

Open [http://localhost:3002](http://localhost:3002) and start building workflows.

### Scripts

| Script | Description |
|--------|-------------|
| `yarn build` | Build all workspaces (Turborepo) |
| `yarn rebuild` | Force rebuild all workspaces (no cache) |
| `yarn dev` | Development mode with watch |
| `yarn start:workbench` | Start full Theia workbench |
| `yarn start:workbench-thin` | Start lightweight workbench |
| `yarn build:workbench` | Build only the full workbench |
| `yarn build:workbench-thin` | Build only the thin workbench |
| `yarn lint` | Lint all workspaces |
| `yarn format` | Format all TypeScript/Markdown files |

---

## 📁 Project Structure

```
continuum-workbench/
├── continuum-core/                    # @continuum/core — shared React library
│   ├── package.json
│   └── src/
├── workflow-editor-extension/         # @continuum/workflow-editor-extension
│   ├── package.json
│   └── src/
├── continuum-workbench/               # @continuum/workbench — full Theia IDE
│   ├── package.json
│   └── src-gen/
├── continuum-workbench-thin/          # @continuum/workbench-thin — lightweight
│   ├── package.json
│   └── src-gen/
├── package.json                       # Root workspace config
├── turbo.json                         # Turborepo pipeline config
├── Dockerfile                         # Container image
└── README.md
```

---

## 🔗 Related Repositories

| Repository | Description |
|-----------|-------------|
| [Continuum](https://github.com/projectcontinuum/Continuum) | Core backend — API server, worker framework, shared libraries |
| **continuum-workbench** (this repo) | Browser IDE — Eclipse Theia + React Flow workflow editor |
| [continuum-feature-base](https://github.com/projectcontinuum/continuum-feature-base) | Base analytics nodes — data transforms, REST, scripting, anomaly detection |
| [continuum-feature-ai](https://github.com/projectcontinuum/continuum-feature-ai) | AI/ML nodes — LLM fine-tuning with Unsloth + LoRA |
| [continuum-feature-template](https://github.com/projectcontinuum/continuum-feature-template) | Template — scaffold your own custom worker with nodes |
