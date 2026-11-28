import { HiddenAreaController } from '../../common/script-editor/HiddenAreaController';
import { KotlinScriptContext } from '../../common/script-editor/KotlinScriptContext';
import { buildDeclarationsFile, buildScriptFile, scriptWrapper } from '../../common/script-editor/KotlinScriptPrelude';
import { createPackageId } from '../../common/script-editor/ScriptFileNaming';
import { ScriptEditorServices } from './ScriptEditorServicesStore';

/** A running script editor: its user text can be read and replaced, and it cleans up after itself. */
export interface NativeScriptSession {
    userText(): string;
    /** Replaces the user's text if it differs from what the editor holds. */
    setUserText(text: string): void;
    /** Disposes the editor first (so the language server sees the file close), then deletes the files. */
    dispose(): Promise<void>;
}

export interface NativeScriptSessionRequest {
    readonly services: ScriptEditorServices;
    readonly host: HTMLElement;
    /** What the node reported about its script; `undefined` gives the basic mode (standard library and Java only). */
    readonly context: KotlinScriptContext | undefined;
    /** The script as stored. */
    readonly value: string;
    readonly theme: string;
    /** Called with the user's text after every change the user makes. */
    readonly onUserTextChange: (text: string) => void;
}

const stopKeyEvent = (event: KeyboardEvent): void => event.stopPropagation();

/**
 * Writes the script's files, opens the editor on them and hides the wrapper. Resolves to `undefined` when there is no
 * workspace folder; rejects when the files or the editor cannot be created (nothing is left behind then).
 */
export async function startNativeScriptSession(request: NativeScriptSessionRequest): Promise<NativeScriptSession | undefined> {
    const { services, host, context, value } = request;
    const packageId = createPackageId();
    const wrapper = scriptWrapper(packageId, context);
    const opened = await services.files.open({
        packageId,
        scriptText: buildScriptFile(value, wrapper).text,
        declarationsText: context ? buildDeclarationsFile(packageId, context) : undefined
    });
    if (!opened) {
        return undefined;
    }
    let editor;
    try {
        editor = await services.editors.create(opened.scriptUri, host, editorOptions(request.theme));
    } catch (error) {
        await opened.dispose();
        throw error;
    }
    const controller = new HiddenAreaController(editor.control, editor.model, wrapper);
    // Numbers as the user sees them, without the hidden wrapper lines.
    editor.control.updateOptions({ lineNumbers: (line: number) => String(controller.userLineNumber(line)) });
    host.addEventListener('keydown', stopKeyEvent);
    host.addEventListener('keyup', stopKeyEvent);
    let lastReported = controller.userText();
    const subscription = editor.model.onDidChangeContent(() => {
        const text = controller.userText();
        if (text !== lastReported) {
            lastReported = text;
            request.onUserTextChange(text);
        }
    });
    return {
        userText: () => controller.userText(),
        setUserText: text => {
            if (text !== controller.userText()) {
                lastReported = text;
                controller.setUserText(text);
            }
        },
        dispose: async () => {
            host.removeEventListener('keydown', stopKeyEvent);
            host.removeEventListener('keyup', stopKeyEvent);
            subscription.dispose();
            controller.dispose();
            editor.dispose();
            await opened.dispose();
        }
    };
}

/** The same editor options as the plain script editor, plus the inline editor's defaults being undone where they differ. */
function editorOptions(theme: string): Record<string, unknown> {
    return {
        theme,
        'semanticHighlighting.enabled': false,
        // The classic input element is treated as a text field by page-level key handlers (React Flow) and macOS text
        // services; the native EditContext element is a plain div.
        editContext: false,
        // Do not let a typed character such as Space accept a suggestion.
        acceptSuggestionOnCommitCharacter: false,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        formatOnPaste: true,
        formatOnType: true,
        automaticLayout: true,
        // Suggest, hover and parameter-hint widgets must render outside the clipped editor box.
        fixedOverflowWidgets: true,
        lineNumbers: 'on',
        folding: false,
        glyphMargin: false,
        lineDecorationsWidth: 8,
        renderLineHighlight: 'line',
        overviewRulerLanes: 0,
        scrollbar: { horizontal: 'hidden' }
    };
}
