import React from 'react';
import { useScriptEditorServices } from './ScriptEditorServicesStore';

/**
 * Whether the workspace is trusted; `undefined` until Theia has resolved it. The editor treats "not yet known" as
 * trusted, so a trusted workspace never flashes the plain editor, and falls back to the plain one if the answer is no.
 */
export function useWorkspaceTrust(): boolean | undefined {
    const workspace = useScriptEditorServices(state => state.services?.workspace);
    const [trusted, setTrusted] = React.useState<boolean | undefined>(undefined);

    React.useEffect(() => {
        if (!workspace) {
            return undefined;
        }
        let current = true;
        workspace.isTrusted().then(
            value => current && setTrusted(value),
            () => current && setTrusted(true)
        );
        const unsubscribe = workspace.onTrustChange(value => setTrusted(value));
        return () => {
            current = false;
            unsubscribe();
        };
    }, [workspace]);

    return trusted;
}
