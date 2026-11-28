import { create } from 'zustand';
import { ScriptFileStore } from '../../common/script-editor/ScriptFileStore';
import { NativeMonacoEditorFactory } from './NativeMonacoEditorFactory';
import { WorkspaceRootSource } from './TheiaWorkspaceRootSource';

/**
 * The script editor's services, handed to its React components. The components are not created by the container, so a
 * contribution fills this store when the application starts (the same way the theme service fills the theme store).
 */
export interface ScriptEditorServices {
    readonly editors: NativeMonacoEditorFactory;
    readonly files: ScriptFileStore;
    readonly workspace: WorkspaceRootSource;
}

interface ScriptEditorServicesState {
    services: ScriptEditorServices | undefined;
}

export const useScriptEditorServices = create<ScriptEditorServicesState>(() => ({ services: undefined }));
