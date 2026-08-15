import { Command } from "@theia/core";

export namespace WorkflowEditorCommands {
    const WORKFLOW_EDITOR_CATEGORY = "Workflow Editor";

    export const RUN_WORKFLOW: Command = {
        id: 'workflow-editor.run',
        label: 'Run Workflow',
        category: WORKFLOW_EDITOR_CATEGORY,
        iconClass: 'fa fa-play'
    };

    export const SCHEDULE_WORKFLOW: Command = {
        id: 'workflow-editor.schedule',
        label: 'Schedule Workflow',
        category: WORKFLOW_EDITOR_CATEGORY,
        iconClass: 'fa fa-clock-o'
    };

    export const MANAGE_WORKFLOW_SCHEDULES: Command = {
        id: 'workflow-editor.manageSchedules',
        label: 'Manage Schedules',
        category: WORKFLOW_EDITOR_CATEGORY,
        iconClass: 'fa fa-list-ul'
    };

    export const COPY_NODES: Command = {
        id: 'workflow-editor.copy',
        label: 'Copy',
        category: WORKFLOW_EDITOR_CATEGORY,
        iconClass: 'fa fa-copy'
    };

    export const PASTE_NODES: Command = {
        id: 'workflow-editor.paste',
        label: 'Paste',
        category: WORKFLOW_EDITOR_CATEGORY,
        iconClass: 'fa fa-paste'
    };

    export const CUT_NODES: Command = {
        id: 'workflow-editor.cut',
        label: 'Cut',
        category: WORKFLOW_EDITOR_CATEGORY,
        iconClass: 'fa fa-cut'
    };

    export const DELETE_NODES: Command = {
        id: 'workflow-editor.delete',
        label: 'Delete',
        category: WORKFLOW_EDITOR_CATEGORY,
        iconClass: 'fa fa-trash'
    };

    export const SELECT_ALL_NODES: Command = {
        id: 'workflow-editor.selectAll',
        label: 'Select All',
        category: WORKFLOW_EDITOR_CATEGORY
    };

    export const UNDO: Command = {
        id: 'workflow-editor.undo',
        label: 'Undo',
        category: WORKFLOW_EDITOR_CATEGORY,
        iconClass: 'fa fa-undo'
    };

    export const REDO: Command = {
        id: 'workflow-editor.redo',
        label: 'Redo',
        category: WORKFLOW_EDITOR_CATEGORY,
        iconClass: 'fa fa-redo'
    };

    export const SETTINGS: Command = {
        id: 'workflow-editor.settings',
        label: 'Settings',
        category: WORKFLOW_EDITOR_CATEGORY,
        iconClass: 'fa fa-cog'
    };
}
