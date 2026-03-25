import { injectable, inject } from '@theia/core/shared/inversify';
import { FrontendApplication, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { ApplicationShell, WidgetManager } from '@theia/core/lib/browser';
import { ContinuumWelcomeWidget } from './ContinuumWelcomeWidget';

@injectable()
export class ContinuumWelcomeContribution implements FrontendApplicationContribution {

    @inject(ApplicationShell)
    protected readonly shell: ApplicationShell;

    @inject(WidgetManager)
    protected readonly widgetManager: WidgetManager;

    async initializeLayout(app: FrontendApplication): Promise<void> {
        // Called only when there is no previously saved layout (first launch).
        // Always show the Welcome tab.
        await this.openWelcome();
    }

    async onDidInitializeLayout(app: FrontendApplication): Promise<void> {
        // Called after layout is fully restored. Show Welcome if main area is empty.
        const mainWidgets = this.shell.getWidgets('main');
        if (mainWidgets.length === 0) {
            await this.openWelcome();
        }
    }

    private async openWelcome(): Promise<void> {
        const widget = await this.widgetManager.getOrCreateWidget(ContinuumWelcomeWidget.ID);
        this.shell.addWidget(widget, { area: 'main' });
        this.shell.activateWidget(widget.id);
    }
}
