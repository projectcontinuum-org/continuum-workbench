import { MenuPath } from "@theia/core";

/**
 * Context menu shown when right-clicking a node in the Workflow Runs tree.
 * The tree container wires this as the tree's `contextMenuPath`, so Theia renders it
 * on right-click; actions are registered here by `WorkflowRunsMenuContribution`.
 */
export const WORKFLOW_RUNS_CONTEXT_MENU: MenuPath = ['workflow-runs-context-menu'];

export namespace WorkflowRunsContextMenu {
    /** Open in Editor, Run Workflow */
    export const OPEN = [...WORKFLOW_RUNS_CONTEXT_MENU, '0_open'];
    /** Schedule Workflow..., Manage Schedules..., Pause/Resume All Schedules */
    export const SCHEDULE = [...WORKFLOW_RUNS_CONTEXT_MENU, '1_schedule'];
    /** Cancel Active Runs, Refresh Runs */
    export const RUNS = [...WORKFLOW_RUNS_CONTEXT_MENU, '2_runs'];
    /** Copy Workflow Path */
    export const CLIPBOARD = [...WORKFLOW_RUNS_CONTEXT_MENU, '3_clipboard'];
}
