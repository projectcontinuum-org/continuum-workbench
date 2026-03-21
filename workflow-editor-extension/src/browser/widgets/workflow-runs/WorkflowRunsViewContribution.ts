import { AbstractViewContribution } from "@theia/core/lib/browser";
import WorkflowRunsWidget from "./WorkflowRunsWidget";
import { CommandRegistry } from "@theia/core";
import { injectable } from "@theia/core/shared/inversify";

@injectable()
export class WorkflowRunsViewContribution extends AbstractViewContribution<WorkflowRunsWidget> {

    constructor() {
        super({
            widgetId: WorkflowRunsWidget.ID,
            widgetName: WorkflowRunsWidget.LABEL,
            defaultWidgetOptions: { area: "right" },
            toggleCommandId: WorkflowRunsWidget.COMMAND.id,
            toggleKeybinding: `shift+cmd+w`
        });
    }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(WorkflowRunsWidget.COMMAND, {
            execute: () => super.toggleView()
        });
    }
}
