import { inject, injectable } from '@theia/core/shared/inversify';
import URI from '@theia/core/lib/common/uri';
import { MonacoEditorProvider } from '@theia/monaco/lib/browser/monaco-editor-provider';

/** An editor created on a file of the workspace, and what the script editor needs from it. */
export interface NativeEditor {
    /** The Monaco code editor. */
    readonly control: NativeEditorControl;
    /** The text model of the file, the one the Kotlin extension analyses. */
    readonly model: NativeEditorModel;
    dispose(): void;
}

interface CursorSelection {
    selectionStartLineNumber: number;
    selectionStartColumn: number;
    positionLineNumber: number;
    positionColumn: number;
}

interface EditorRange {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
}

/** The members of the Monaco editor and model that the script editor uses, typed here so the rest stays Theia-free. */
export interface NativeEditorControl {
    setHiddenAreas?(ranges: EditorRange[]): void;
    getSelection?(): CursorSelection | null;
    setSelection?(selection: CursorSelection): void;
    onDidChangeCursorSelection?(listener: () => void): { dispose(): void };
    updateOptions(options: Record<string, unknown>): void;
}

export interface NativeEditorModel {
    getLinesContent(): string[];
    getValue(): string;
    setValue(value: string): void;
    applyEdits(edits: Array<{ range: EditorRange; text: string }>): unknown;
    onDidChangeContent(listener: () => void): { dispose(): void };
}

/**
 * The one place that creates the script editor's Monaco editor through Theia. It uses Theia's own editor provider on the
 * temp file's URI, so the model is registered with Theia like any file's and the Kotlin extension sees it and answers
 * with completion, hover and diagnostics. This is also the one place that touches Theia/Monaco internals, so an
 * upgrade of either only has to be checked here and in `HiddenAreaController`.
 */
@injectable()
export class NativeMonacoEditorFactory {
    @inject(MonacoEditorProvider)
    protected readonly provider!: MonacoEditorProvider;

    async create(uri: string, host: HTMLElement, options: Record<string, unknown>): Promise<NativeEditor> {
        const editor = await this.provider.createInline(new URI(uri), host, options);
        const control = editor.getControl();
        const model = control.getModel();
        if (!model) {
            editor.dispose();
            throw new Error('The editor has no model');
        }
        return {
            control: control as unknown as NativeEditorControl,
            model: model as unknown as NativeEditorModel,
            dispose: () => editor.dispose()
        };
    }
}
