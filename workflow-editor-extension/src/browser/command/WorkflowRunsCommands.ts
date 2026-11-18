import { Command } from "@theia/core";

export namespace WorkflowRunsCommands {
    const CATEGORY = "Workflow Runs";

    export const OPEN_IN_EDITOR: Command = {
        id: 'workflow-runs.openInEditor',
        label: 'Open in Editor',
        category: CATEGORY,
        iconClass: 'fa fa-solid fa-diagram-project'
    };

    export const RUN_WORKFLOW: Command = {
        id: 'workflow-runs.runWorkflow',
        label: 'Run Workflow',
        category: CATEGORY,
        iconClass: 'fa fa-play'
    };

    export const SCHEDULE_WORKFLOW: Command = {
        id: 'workflow-runs.scheduleWorkflow',
        label: 'Schedule Workflow...',
        category: CATEGORY,
        iconClass: 'fa fa-clock-o'
    };

    export const MANAGE_SCHEDULES: Command = {
        id: 'workflow-runs.manageSchedules',
        label: 'Manage Schedules...',
        category: CATEGORY,
        iconClass: 'fa fa-list-ul'
    };

    export const PAUSE_ALL_SCHEDULES: Command = {
        id: 'workflow-runs.pauseAllSchedules',
        label: 'Pause All Schedules',
        category: CATEGORY,
        iconClass: 'fa fa-pause'
    };

    export const RESUME_ALL_SCHEDULES: Command = {
        id: 'workflow-runs.resumeAllSchedules',
        label: 'Resume All Schedules',
        category: CATEGORY,
        iconClass: 'fa fa-play'
    };

    export const CANCEL_ACTIVE_RUNS: Command = {
        id: 'workflow-runs.cancelActiveRuns',
        label: 'Cancel Active Runs',
        category: CATEGORY,
        iconClass: 'fa fa-stop'
    };

    export const REFRESH_RUNS: Command = {
        id: 'workflow-runs.refreshRuns',
        label: 'Refresh Runs',
        category: CATEGORY,
        iconClass: 'fa fa-refresh'
    };

    export const COPY_WORKFLOW_PATH: Command = {
        id: 'workflow-runs.copyWorkflowPath',
        label: 'Copy Workflow Path',
        category: CATEGORY,
        iconClass: 'fa fa-copy'
    };
}
