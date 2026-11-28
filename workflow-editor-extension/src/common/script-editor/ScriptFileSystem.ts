/**
 * What the script editor needs from a file system. Implemented over Theia's `FileService` in the browser and by a fake
 * in the specs. Paths are whatever strings the implementation understands (the browser one takes file URIs).
 */
export interface ScriptFileSystem {
    /** Creates the file with [text], and any missing parent folders. */
    writeFile(path: string, text: string): Promise<void>;
    /** Reads a text file; `undefined` when it does not exist. */
    readFile(path: string): Promise<string | undefined>;
    /** Deletes a file or a folder with everything in it; succeeds when it is already gone. */
    deleteRecursive(path: string): Promise<void>;
    exists(path: string): Promise<boolean>;
    /** Whether the path is a symbolic link (a cloned repository could plant one); `false` when it does not exist. */
    isSymbolicLink(path: string): Promise<boolean>;
    /** Names of the entries directly inside a folder; `undefined` when the folder does not exist. */
    list(path: string): Promise<string[] | undefined>;
}

/** The folder the script editor writes into; `undefined` when no workspace folder is open. */
export type WorkspaceRootProvider = () => string | undefined;
