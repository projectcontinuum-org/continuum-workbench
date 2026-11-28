import { ScriptFileSystem } from './ScriptFileSystem';

/** An in-memory file system for specs: paths are plain strings, a folder exists when some file lies under it. */
export class FakeFileSystem implements ScriptFileSystem {
    readonly files = new Map<string, string>();
    failWrites = false;
    failDeletes = false;
    /** Paths that are symbolic links. */
    readonly symlinks = new Set<string>();

    async writeFile(path: string, text: string): Promise<void> {
        if (this.failWrites) {
            throw new Error('disk full');
        }
        this.files.set(path, text);
    }

    async readFile(path: string): Promise<string | undefined> {
        return this.files.get(path);
    }

    async deleteRecursive(path: string): Promise<void> {
        if (this.failDeletes) {
            throw new Error('permission denied');
        }
        for (const key of [...this.files.keys()]) {
            if (key === path || key.startsWith(`${path}/`)) {
                this.files.delete(key);
            }
        }
    }

    async exists(path: string): Promise<boolean> {
        return [...this.files.keys()].some(key => key === path || key.startsWith(`${path}/`));
    }

    async isSymbolicLink(path: string): Promise<boolean> {
        return this.symlinks.has(path);
    }

    async list(path: string): Promise<string[] | undefined> {
        const prefix = `${path}/`;
        const names = new Set<string>();
        for (const key of this.files.keys()) {
            if (key.startsWith(prefix)) {
                names.add(key.slice(prefix.length).split('/')[0]);
            }
        }
        return names.size === 0 ? undefined : [...names];
    }
}
