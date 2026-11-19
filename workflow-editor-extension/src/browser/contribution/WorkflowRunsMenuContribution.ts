import { injectable } from "@theia/core/shared/inversify";
import { MenuContribution, MenuModelRegistry } from "@theia/core";
import { WorkflowRunsCommands } from "../command/WorkflowRunsCommands";
import { WorkflowRunsContextMenu } from "../menu/WorkflowRunsContextMenu";

@injectable()
export class WorkflowRunsMenuContribution implements MenuContribution {

    registerMenus(registry: MenuModelRegistry): void {
        // Open group
        registry.registerMenuAction(WorkflowRunsContextMenu.OPEN, {
            commandId: WorkflowRunsCommands.OPEN_IN_EDITOR.id,
            order: '1'
        });
        registry.registerMenuAction(WorkflowRunsContextMenu.OPEN, {
            commandId: WorkflowRunsCommands.RUN_WORKFLOW.id,
            order: '2'
        });

        // Schedule group
        registry.registerMenuAction(WorkflowRunsContextMenu.SCHEDULE, {
            commandId: WorkflowRunsCommands.SCHEDULE_WORKFLOW.id,
            order: '1'
        });
        registry.registerMenuAction(WorkflowRunsContextMenu.SCHEDULE, {
            commandId: WorkflowRunsCommands.MANAGE_SCHEDULES.id,
            order: '2'
        });
        registry.registerMenuAction(WorkflowRunsContextMenu.SCHEDULE, {
            commandId: WorkflowRunsCommands.PAUSE_ALL_SCHEDULES.id,
            order: '3'
        });
        registry.registerMenuAction(WorkflowRunsContextMenu.SCHEDULE, {
            commandId: WorkflowRunsCommands.RESUME_ALL_SCHEDULES.id,
            order: '4'
        });

        // Runs group
        registry.registerMenuAction(WorkflowRunsContextMenu.RUNS, {
            commandId: WorkflowRunsCommands.CANCEL_ACTIVE_RUNS.id,
            order: '1'
        });
        registry.registerMenuAction(WorkflowRunsContextMenu.RUNS, {
            commandId: WorkflowRunsCommands.REFRESH_RUNS.id,
            order: '2'
        });

        // Clipboard group
        registry.registerMenuAction(WorkflowRunsContextMenu.CLIPBOARD, {
            commandId: WorkflowRunsCommands.COPY_WORKFLOW_PATH.id,
            order: '1'
        });
    }
}
