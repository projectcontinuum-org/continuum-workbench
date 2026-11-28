import { inject, injectable } from '@theia/core/shared/inversify';
import { WorkspaceTrustService } from '@theia/workspace/lib/browser/workspace-trust-service';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';

/** What the script editor's components need to know about the workspace: its first folder, and when that changes. */
export interface WorkspaceRootSource {
    /** The first workspace folder as a file URI; `undefined` when none is open. */
    firstRoot(): string | undefined;
    /** Subscribes to changes of the workspace folders; returns the unsubscribe function. */
    onChange(listener: () => void): () => void;
    /** Whether the workspace is trusted (plugins, the Kotlin extension included, only run in a trusted one). */
    isTrusted(): Promise<boolean>;
    /** Subscribes to trust decisions; returns the unsubscribe function. */
    onTrustChange(listener: (trusted: boolean) => void): () => void;
}

/**
 * The first workspace folder is where the editor's files go: it is the one the Kotlin language server was started
 * with, so it is the one it analyses.
 */
@injectable()
export class TheiaWorkspaceRootSource implements WorkspaceRootSource {
    @inject(WorkspaceService)
    protected readonly workspaceService!: WorkspaceService;

    @inject(WorkspaceTrustService)
    protected readonly trustService!: WorkspaceTrustService;

    isTrusted(): Promise<boolean> {
        return this.trustService.getWorkspaceTrust();
    }

    onTrustChange(listener: (trusted: boolean) => void): () => void {
        const subscription = this.trustService.onDidChangeWorkspaceTrust(listener);
        return () => subscription.dispose();
    }

    firstRoot(): string | undefined {
        return this.workspaceService.tryGetRoots()[0]?.resource.toString();
    }

    onChange(listener: () => void): () => void {
        const subscription = this.workspaceService.onWorkspaceChanged(listener);
        return () => subscription.dispose();
    }
}
