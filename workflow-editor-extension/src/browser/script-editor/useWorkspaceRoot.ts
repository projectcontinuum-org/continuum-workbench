import React from 'react';
import { useScriptEditorServices } from './ScriptEditorServicesStore';

/** The first workspace folder (a file URI), or `undefined` while none is open; re-renders when the folders change. */
export function useWorkspaceRoot(): string | undefined {
    const workspace = useScriptEditorServices(state => state.services?.workspace);
    const [root, setRoot] = React.useState<string | undefined>(() => workspace?.firstRoot());

    React.useEffect(() => {
        if (!workspace) {
            setRoot(undefined);
            return undefined;
        }
        setRoot(workspace.firstRoot());
        return workspace.onChange(() => setRoot(workspace.firstRoot()));
    }, [workspace]);

    return root;
}
