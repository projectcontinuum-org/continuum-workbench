import { AbstractViewContribution } from "@theia/core/lib/browser";
import { FrontendApplicationStateService } from "@theia/core/lib/browser/frontend-application-state";
import NodeExplorerWidget from "./NodeExplorerWidget";
import { CommandRegistry } from "@theia/core";
import { inject, injectable, postConstruct } from "@theia/core/shared/inversify";
import { MonacoThemingService } from "@theia/monaco/lib/browser/monaco-theming-service";
import ContinuumThemeService from "../../theme/ContinuumThemeService";

@injectable()
export class NodeExplorerViewContribution extends AbstractViewContribution<NodeExplorerWidget> {

    @inject(FrontendApplicationStateService)
    protected readonly stateService: FrontendApplicationStateService;

    constructor(
        @inject(MonacoThemingService)
        protected readonly monacoThemeService: MonacoThemingService,
        @inject(ContinuumThemeService)
        protected readonly continuumThemeService: ContinuumThemeService
    ) {
        super({
            widgetId: NodeExplorerWidget.ID,
            widgetName: NodeExplorerWidget.LABEL,
            defaultWidgetOptions: { area: "right" },
            toggleCommandId: NodeExplorerWidget.COMMAND.id,
            toggleKeybinding: `shift+cmd+n`
        });
    }

    @postConstruct()
    protected init(): void {
        this.stateService.reachedState('ready').then(() => {
            this.openView({ activate: false, reveal: true });
        });
    }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(NodeExplorerWidget.COMMAND, {
            execute: () => super.toggleView()
        });
    }

}
