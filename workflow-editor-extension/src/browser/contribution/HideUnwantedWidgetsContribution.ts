import { injectable, inject } from "@theia/core/shared/inversify";
import { FrontendApplication, FrontendApplicationContribution } from "@theia/core/lib/browser";
import { ApplicationShell } from "@theia/core/lib/browser/shell/application-shell";
import { CommandRegistry } from "@theia/core/lib/common/command";

/**
 * Hides widgets the workbench pulls in transitively but never uses:
 *  - Outline: arrives via `@theia/monaco` → `@theia/outline-view` (monaco is the editor, kept).
 *  - Debug, Testing: arrive via `@theia/plugin-ext` (the VS Code extension host, kept so the
 *    VS Code git extension can provide SCM) → `@theia/debug` → `@theia/test`.
 *
 * The packages are kept (monaco is the editor; plugin-ext runs the git extension that powers
 * `@theia/scm`). This contribution unregisters the toggle commands so they leave the command
 * palette / View menu, and closes the widgets after the layout initializes.
 */
@injectable()
export class HideUnwantedWidgetsContribution implements FrontendApplicationContribution {

    /** Toggle command ids to unregister so the views leave the palette / View menu. */
    private static readonly TOGGLE_COMMAND_IDS = ['outlineView:toggle', 'debug:toggle'];

    /** Widget / view-container ids to close if restored into the layout on startup.
     *  Outline (right panel); Debug and the Test Explorer (left panel). */
    private static readonly WIDGET_IDS = ['outline-view', 'debug', 'test-view-container'];

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
