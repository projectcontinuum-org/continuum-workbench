import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { inject, injectable } from '@theia/core/shared/inversify';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { ScriptFileStore } from '../../common/script-editor/ScriptFileStore';
import { LEASE_EXPIRY_MS } from '../../common/script-editor/ScriptFolderLayout';
import { ScriptFolderSweeper } from '../../common/script-editor/ScriptFolderSweeper';
import { NativeMonacoEditorFactory } from './NativeMonacoEditorFactory';
import { useScriptEditorServices } from './ScriptEditorServicesStore';
import { TheiaScriptFileSystem } from './TheiaScriptFileSystem';
import { TheiaWorkspaceRootSource } from './TheiaWorkspaceRootSource';

const SWEEP_INTERVAL_MS = LEASE_EXPIRY_MS;

/**
 * Makes the script editor's services available to the dialog components, and removes the editor folders that a closed
 * or crashed browser tab left in the workspace when the workbench starts and whenever the workspace folder changes.
 */
@injectable()
export class ScriptEditorContribution implements FrontendApplicationContribution {
    @inject(NativeMonacoEditorFactory)
    protected readonly editors!: NativeMonacoEditorFactory;
    @inject(TheiaScriptFileSystem)
    protected readonly files!: TheiaScriptFileSystem;
    @inject(TheiaWorkspaceRootSource)
    protected readonly workspace!: TheiaWorkspaceRootSource;
    @inject(WorkspaceService)
    protected readonly workspaceService!: WorkspaceService;

    initialize(): void {
        const store = new ScriptFileStore(this.files, () => this.workspace.firstRoot());
        useScriptEditorServices.setState({ services: { editors: this.editors, files: store, workspace: this.workspace } });
    }

    onStart(): void {
        const sweeper = new ScriptFolderSweeper(this.files);
        const sweep = (): void => {
            sweeper.sweep(this.workspace.firstRoot()).then(
                removed => removed > 0 && console.info(`Removed ${removed} leftover script editor folder(s).`),
                () => undefined
            );
        };
        this.workspaceService.ready.then(sweep, () => undefined);
        this.workspace.onChange(sweep);
        // A tab that crashed after this one started leaves its folder behind; a second sweep once its lease has
        // expired removes it. Live editors renew their leases, so they are never swept.
        window.setInterval(sweep, SWEEP_INTERVAL_MS);
    }
}
