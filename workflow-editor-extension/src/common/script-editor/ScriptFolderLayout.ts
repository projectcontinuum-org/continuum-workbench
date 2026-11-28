/**
 * Where a script editor's files live. Everything sits in one hidden folder in the first workspace folder, because the
 * Kotlin language server only analyses files under the workspace folders it was started with. One sub-folder per open
 * editor holds that editor's script, its declarations and a lease file.
 */

/** The hidden folder; the Explorer, search and git are told to ignore it (see the settings seed). */
export const SCRIPTS_FOLDER = '.continuum-scripts';
export const SCRIPT_FILE = 'Script.kt';
export const DECLARATIONS_FILE = 'ScriptFlowVariables.kt';
/** Touched while the editor is open; a folder whose lease is missing or old belongs to an editor that is gone. */
export const LEASE_FILE = '.lease';
export const GITIGNORE_FILE = '.gitignore';
/** Ignores everything in the hidden folder, itself included, for repositories that do not read the editor's excludes. */
export const GITIGNORE_CONTENT = '*\n';

/** How often an open editor renews its lease, and how long a lease stays valid after its last renewal. */
export const LEASE_RENEW_MS = 30_000;
export const LEASE_EXPIRY_MS = 120_000;

const join = (...parts: string[]): string => parts.map((part, index) => (index === 0 ? part.replace(/\/+$/, '') : part)).join('/');

export interface ScriptPaths {
    readonly scriptsFolder: string;
    readonly gitignore: string;
    readonly folder: string;
    readonly script: string;
    readonly declarations: string;
    readonly lease: string;
}

/** Paths (as URIs or paths, whatever the root is) of one editor's files under [root]. */
export function scriptPaths(root: string, packageId: string): ScriptPaths {
    const scriptsFolder = join(root, SCRIPTS_FOLDER);
    const folder = join(scriptsFolder, packageId);
    return {
        scriptsFolder,
        gitignore: join(scriptsFolder, GITIGNORE_FILE),
        folder,
        script: join(folder, SCRIPT_FILE),
        declarations: join(folder, DECLARATIONS_FILE),
        lease: join(folder, LEASE_FILE)
    };
}

export function scriptsFolderOf(root: string): string {
    return join(root, SCRIPTS_FOLDER);
}

export function leasePathOf(root: string, name: string): string {
    return join(root, SCRIPTS_FOLDER, name, LEASE_FILE);
}
