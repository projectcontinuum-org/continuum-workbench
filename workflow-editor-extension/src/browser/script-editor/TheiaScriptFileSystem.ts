import { inject, injectable } from '@theia/core/shared/inversify';
import URI from '@theia/core/lib/common/uri';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { ScriptFileSystem } from '../../common/script-editor/ScriptFileSystem';

/** The script editor's file system over Theia's file service; paths are file URIs. */
@injectable()
export class TheiaScriptFileSystem implements ScriptFileSystem {
    @inject(FileService)
    protected readonly fileService!: FileService;

    async writeFile(path: string, text: string): Promise<void> {
        await this.fileService.create(new URI(path), text, { overwrite: true });
    }

    async readFile(path: string): Promise<string | undefined> {
        const uri = new URI(path);
        if (!(await this.fileService.exists(uri))) {
            return undefined;
        }
        return (await this.fileService.read(uri)).value;
    }

    async deleteRecursive(path: string): Promise<void> {
        const uri = new URI(path);
        if (await this.fileService.exists(uri)) {
            await this.fileService.delete(uri, { recursive: true, useTrash: false });
        }
    }

    exists(path: string): Promise<boolean> {
        return this.fileService.exists(new URI(path));
    }

    async isSymbolicLink(path: string): Promise<boolean> {
        const uri = new URI(path);
        if (!(await this.fileService.exists(uri))) {
            return false;
        }
        return (await this.fileService.resolve(uri, { resolveMetadata: true })).isSymbolicLink === true;
    }

    async list(path: string): Promise<string[] | undefined> {
        const uri = new URI(path);
        if (!(await this.fileService.exists(uri))) {
            return undefined;
        }
        const stat = await this.fileService.resolve(uri);
        return (stat.children ?? []).map(child => child.name);
    }
}
