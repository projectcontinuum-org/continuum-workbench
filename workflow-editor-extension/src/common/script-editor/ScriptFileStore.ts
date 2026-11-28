import { LEASE_RENEW_MS, scriptPaths, GITIGNORE_CONTENT, ScriptPaths } from './ScriptFolderLayout';
import { ScriptFileSystem, WorkspaceRootProvider } from './ScriptFileSystem';

/** The clock and timer the store uses; replaced in specs. */
export interface Timers {
    now(): number;
    setInterval(callback: () => void, milliseconds: number): unknown;
    clearInterval(handle: unknown): void;
}

export const REAL_TIMERS: Timers = {
    now: () => Date.now(),
    setInterval: (callback, milliseconds) => setInterval(callback, milliseconds),
    clearInterval: handle => clearInterval(handle as ReturnType<typeof setInterval>)
};

export interface OpenScriptRequest {
    /** Package id from `createPackageId`; also the folder name. */
    readonly packageId: string;
    readonly scriptText: string;
    /** The sibling file with the node's declarations; none in the basic mode, which has no declarations. */
    readonly declarationsText?: string;
}

/** One editor's files while it is open. */
export interface OpenedScript {
    /** Location of `Script.kt`, in the same form as the workspace root. */
    readonly scriptUri: string;
    /** Stops renewing the lease and deletes the folder. Never throws; safe to call twice. */
    dispose(): Promise<void>;
}

/**
 * Writes the files a script editor needs (the script, the declarations it refers to, a lease) into the hidden folder of
 * the first workspace folder, and removes them when the editor closes. Only script text and the node's declarations are
 * ever written, only through the injected file system, and a failure to clean up is logged, never thrown: closing or
 * saving a dialog must not depend on it.
 */
export class ScriptFileStore {
    constructor(
        private readonly files: ScriptFileSystem,
        private readonly workspaceRoot: WorkspaceRootProvider,
        private readonly timers: Timers = REAL_TIMERS,
        private readonly warn: (message: string) => void = message => console.warn(message)
    ) {}

    /** Writes the editor's files; `undefined` when no workspace folder is open. Rejects when the files cannot be written. */
    async open(request: OpenScriptRequest): Promise<OpenedScript | undefined> {
        const root = this.workspaceRoot();
        if (root === undefined) {
            return undefined;
        }
        const paths = scriptPaths(root, request.packageId);
        try {
            if (await this.files.isSymbolicLink(paths.scriptsFolder)) {
                throw new Error('The script editor folder is a symbolic link');
            }
            await this.writeGitignoreOnce(paths.gitignore);
            await this.files.writeFile(paths.lease, String(this.timers.now()));
            await this.writeDeclarations(paths.declarations, request);
            await this.files.writeFile(paths.script, request.scriptText);
        } catch (error) {
            await this.removeQuietly(paths.folder);
            throw error;
        }
        return this.opened(paths, request);
    }

    private async writeDeclarations(path: string, request: OpenScriptRequest): Promise<void> {
        if (request.declarationsText !== undefined) {
            await this.files.writeFile(path, request.declarationsText);
        }
    }

    private async writeGitignoreOnce(gitignore: string): Promise<void> {
        if (!(await this.files.exists(gitignore))) {
            await this.files.writeFile(gitignore, GITIGNORE_CONTENT);
        }
    }

    private opened(paths: ScriptPaths, request: OpenScriptRequest): OpenedScript {
        const { script: scriptUri, folder } = paths;
        let disposed = false;
        let renewalFailureLogged = false;
        const handle = this.timers.setInterval(() => {
            this.renew(paths, request, () => disposed).catch(error => {
                if (!renewalFailureLogged) {
                    renewalFailureLogged = true;
                    this.warn(`Could not renew the script editor lease: ${describe(error)}`);
                }
            });
        }, LEASE_RENEW_MS);
        return {
            scriptUri,
            dispose: async () => {
                if (disposed) {
                    return;
                }
                disposed = true;
                this.timers.clearInterval(handle);
                await this.removeQuietly(folder);
            }
        };
    }

    /**
     * Renews the lease. If the folder was removed meanwhile (another tab's sweep after this computer slept past the
     * lease's expiry), writes the editor's files again so the language server still finds its file.
     */
    private async renew(paths: ScriptPaths, request: OpenScriptRequest, isDisposed: () => boolean): Promise<void> {
        if (!(await this.files.exists(paths.script))) {
            if (isDisposed()) {
                return;
            }
            await this.writeDeclarations(paths.declarations, request);
            await this.files.writeFile(paths.script, request.scriptText);
        }
        if (!isDisposed()) {
            await this.files.writeFile(paths.lease, String(this.timers.now()));
        }
    }

    private async removeQuietly(folder: string): Promise<void> {
        try {
            if (await this.files.isSymbolicLink(folder)) {
                return;
            }
            await this.files.deleteRecursive(folder);
        } catch (error) {
            this.warn(`Could not remove the script editor folder ${folder}: ${describe(error)}`);
        }
    }
}

function describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
