import { injectable, inject } from "@theia/core/shared/inversify";
import { FrontendApplication, FrontendApplicationContribution } from "@theia/core/lib/browser";
import { ApplicationShell } from "@theia/core/lib/browser/shell/application-shell";
import { CommandRegistry } from "@theia/core/lib/common/command";

/**
 * Hides the Outline widget, which arrives transitively via `@theia/monaco` → `@theia/outline-view`
 * (monaco is the editor and is kept). Debug and Testing were removed by dropping `@theia/ai-ide`
 * (which pulled them in) while keeping the AI chat window and Ollama provider (bound by
 * `@theia/ai-chat-ui` / `@theia/ai-ollama` with `@theia/ai-core`'s default `AIActivationService`).
 *
 * This contribution unregisters Outline's toggle command so it leaves the command palette /
 * View menu, and closes the widget if it was restored into the layout on startup.
 */
@injectable()
export class HideUnwantedWidgetsContribution implements FrontendApplicationContribution {

    /** Toggle command id to unregister so the Outline view leaves the palette / View menu. */
    private static readonly TOGGLE_COMMAND_IDS = ['outlineView:toggle'];

    /** Outline widget id to close if restored into the layout on startup. */
    private static readonly WIDGET_IDS = ['outline-view'];

    constructor(
        @inject(ApplicationShell) protected readonly shell: ApplicationShell,
        @inject(CommandRegistry) protected readonly commands: CommandRegistry
    ) {}

    onStart(_app: FrontendApplication): void {
        // Unregister the toggle command so it no longer appears in the palette or View menu.
        // This runs before `initializeLayout`, so the command is gone before the view menu renders.
        for (const id of HideUnwantedWidgetsContribution.TOGGLE_COMMAND_IDS) {
            try {
                if (this.commands.getCommand(id)) {
                    this.commands.unregisterCommand(id);
                }
            } catch (e) {
                console.warn(`[HideUnwantedWidgets] could not unregister command "${id}":`, e);
            }
        }
    }

    onDidInitializeLayout(_app: FrontendApplication): void {
        // `OutlineViewContribution.initializeLayout` opens the Outline view during layout init,
        // which runs AFTER `onStart` — so closing it in `onStart` is too early. `onDidInitializeLayout`
        // runs after `initializeLayout` (and after a stored layout is restored), so this is the point
        // at which the view actually exists and can be closed. `closeWidget` is a no-op if absent.
        for (const id of HideUnwantedWidgetsContribution.WIDGET_IDS) {
            if (this.shell.getWidgetById(id)) {
                this.shell.closeWidget(id).catch(e =>
                    console.warn(`[HideUnwantedWidgets] could not close widget "${id}":`, e)
                );
            }
        }
    }
}
