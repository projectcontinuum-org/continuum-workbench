import { isPackageId } from './ScriptFileNaming';
import { ScriptFileSystem } from './ScriptFileSystem';
import { leasePathOf, scriptsFolderOf } from './ScriptFolderLayout';
import { foldersToSweep } from './ScriptFolderSweepPlan';

/**
 * Removes the folders that closed or crashed editors left behind (a killed tab never runs its cleanup). Runs against any
 * file system, never throws and reports how many folders it removed.
 */
export class ScriptFolderSweeper {
    constructor(
        private readonly files: ScriptFileSystem,
        private readonly now: () => number = () => Date.now(),
        private readonly warn: (message: string) => void = message => console.warn(message)
    ) {}

    async sweep(root: string | undefined): Promise<number> {
        if (root === undefined) {
            return 0;
        }
        try {
            if (await this.files.isSymbolicLink(scriptsFolderOf(root))) {
                this.warn('The script editor folder is a symbolic link; it is not swept.');
                return 0;
            }
            const names = (await this.files.list(scriptsFolderOf(root))) ?? [];
            const entries = await Promise.all(names.filter(isPackageId).map(async name => ({ name, leasedAt: await this.leaseTime(root, name) })));
            const stale = foldersToSweep(entries, this.now());
            let removed = 0;
            for (const name of stale) {
                removed += (await this.removeFolder(root, name)) ? 1 : 0;
            }
            return removed;
        } catch (error) {
            this.warn(`Could not sweep leftover script editor folders: ${error instanceof Error ? error.message : String(error)}`);
            return 0;
        }
    }

    private async leaseTime(root: string, name: string): Promise<number | undefined> {
        try {
            const text = await this.files.readFile(leasePathOf(root, name));
            return text === undefined ? undefined : Number(text.trim());
        } catch {
            return undefined;
        }
    }

    private async removeFolder(root: string, name: string): Promise<boolean> {
        try {
            const folder = `${scriptsFolderOf(root)}/${name}`;
            if (await this.files.isSymbolicLink(folder)) {
                return false;
            }
            await this.files.deleteRecursive(folder);
            return true;
        } catch (error) {
            this.warn(`Could not remove the leftover script editor folder ${name}: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }
}
