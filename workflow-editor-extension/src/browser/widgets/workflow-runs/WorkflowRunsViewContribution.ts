import { AbstractViewContribution } from "@theia/core/lib/browser";
import { FrontendApplicationStateService } from "@theia/core/lib/browser/frontend-application-state";
import WorkflowRunsWidget from "./WorkflowRunsWidget";
import { CommandRegistry } from "@theia/core";
import { inject, injectable, postConstruct } from "@theia/core/shared/inversify";

@injectable()
export class WorkflowRunsViewContribution extends AbstractViewContribution<WorkflowRunsWidget> {

    @inject(FrontendApplicationStateService)
    protected readonly stateService: FrontendApplicationStateService;

    constructor() {
        super({
            widgetId: WorkflowRunsWidget.ID,
            widgetName: WorkflowRunsWidget.LABEL,
            defaultWidgetOptions: { area: "right" },
            toggleCommandId: WorkflowRunsWidget.COMMAND.id,
            toggleKeybinding: `shift+cmd+w`
        });
    }

    @postConstruct()
    protected init(): void {
        this.stateService.reachedState('ready').then(() => {
            this.openView({ activate: false, reveal: true });
        });
    }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(WorkflowRunsWidget.COMMAND, {
            execute: () => super.toggleView()
        });
    }
}
