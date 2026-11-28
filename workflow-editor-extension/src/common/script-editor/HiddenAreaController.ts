import { ScriptWrapper } from './KotlinScriptPrelude';
import { clampToVisible } from './CursorClamp';
import { hiddenRangesOf, locateWrapper, modelTextOf, relayoutEdits, userTextOf, WrapperLocation } from './ScriptModelText';

/** A line range in the editor's own shape. */
export interface EditorRange {
    readonly startLineNumber: number;
    readonly startColumn: number;
    readonly endLineNumber: number;
    readonly endColumn: number;
}

/** The part of a Monaco model the controller uses. */
export interface ScriptModelLike {
    getLinesContent(): string[];
    getValue(): string;
    setValue(value: string): void;
    applyEdits(edits: { range: EditorRange; text: string }[]): unknown;
    onDidChangeContent(listener: () => void): { dispose(): void };
}

/**
 * The part of a Monaco code editor the controller uses. `setHiddenAreas` is not public Monaco API; it is optional here
 * so a Monaco version without it degrades to a visible wrapper instead of a crash.
 */
export interface ScriptEditorLike {
    setHiddenAreas?(ranges: EditorRange[]): void;
    getSelection?(): CursorSelection | null;
    setSelection?(selection: CursorSelection): void;
    onDidChangeCursorSelection?(listener: () => void): { dispose(): void };
}

/** A selection in the editor's own shape: where it started and where the cursor is. */
export interface CursorSelection {
    readonly selectionStartLineNumber: number;
    readonly selectionStartColumn: number;
    readonly positionLineNumber: number;
    readonly positionColumn: number;
}

/**
 * Keeps the script file's wrapper lines (package line, header, closing brace) hidden and intact in an editor that shows
 * the whole file. After every change to the model it finds the wrapper by content, repairs it when the user's edit
 * damaged it (a select-all and paste removes hidden lines too), moves the package line and the header when the user's
 * leading imports changed, and hides the wrapper lines again (a programmatic replace resets the editor's hidden areas).
 *
 * Only the user's text is ever reported out (`userText`) or put in (`setUserText`).
 */
export class HiddenAreaController {
    private readonly subscription: { dispose(): void };
    private readonly cursorSubscription: { dispose(): void } | undefined;
    private warnedAboutMissingApi = false;
    private location: WrapperLocation | undefined;

    constructor(
        private readonly editor: ScriptEditorLike,
        private readonly model: ScriptModelLike,
        private readonly wrapper: ScriptWrapper,
        private readonly warn: (message: string) => void = message => console.warn(message)
    ) {
        this.subscription = model.onDidChangeContent(() => this.settle());
        this.cursorSubscription = editor.onDidChangeCursorSelection?.(() => this.keepCursorVisible());
        this.settle();
    }

    /** Exactly what the user typed. */
    userText(): string {
        return userTextOf(this.model.getValue(), this.wrapper);
    }

    /** Replaces the user's text and keeps the wrapper around it. */
    setUserText(text: string): void {
        this.model.setValue(modelTextOf(text, this.wrapper).text);
        this.settle();
    }

    /** The number the user sees for a line of the model: the wrapper lines above it do not count. */
    userLineNumber(modelLineNumber: number): number {
        const location = this.location;
        if (!location) {
            return modelLineNumber;
        }
        const index = modelLineNumber - 1;
        const hiddenAbove = [location.packageIndex, location.headerIndex, location.closingIndex].filter(hidden => hidden < index).length;
        return modelLineNumber - hiddenAbove;
    }

    dispose(): void {
        this.subscription.dispose();
        this.cursorSubscription?.dispose();
    }

    /** A cursor that reached a hidden wrapper line (Ctrl+End, a click below the text) is moved to the user's text. */
    private keepCursorVisible(): void {
        const selection = this.editor.getSelection?.();
        if (!selection || !this.location || !this.editor.setSelection) {
            return;
        }
        const lines = this.model.getLinesContent();
        const anchor = clampToVisible({ line: selection.selectionStartLineNumber, column: selection.selectionStartColumn }, lines, this.location);
        const cursor = clampToVisible({ line: selection.positionLineNumber, column: selection.positionColumn }, lines, this.location);
        if (anchor.line !== selection.selectionStartLineNumber || cursor.line !== selection.positionLineNumber) {
            this.editor.setSelection({
                selectionStartLineNumber: anchor.line,
                selectionStartColumn: anchor.column,
                positionLineNumber: cursor.line,
                positionColumn: cursor.column
            });
        }
    }

    /** Repairs and re-hides; safe to call at any time, and repeatedly. */
    private settle(): void {
        let lines = this.model.getLinesContent();
        let location = locateWrapper(lines, this.wrapper);
        if (!location) {
            this.model.setValue(modelTextOf(userTextOf(this.model.getValue(), this.wrapper), this.wrapper).text);
            lines = this.model.getLinesContent();
            location = locateWrapper(lines, this.wrapper);
        } else {
            const edits = relayoutEdits(lines, location, this.wrapper);
            if (edits.length > 0) {
                this.model.applyEdits(
                    edits.map(edit => ({
                        range: { startLineNumber: edit.startLine, startColumn: edit.startColumn, endLineNumber: edit.endLine, endColumn: edit.endColumn },
                        text: edit.text
                    }))
                );
                lines = this.model.getLinesContent();
                location = locateWrapper(lines, this.wrapper);
            }
        }
        if (location) {
            this.location = location;
            this.hide(hiddenRangesOf(location));
        }
    }

    private hide(ranges: ReturnType<typeof hiddenRangesOf>): void {
        if (typeof this.editor.setHiddenAreas !== 'function') {
            if (!this.warnedAboutMissingApi) {
                this.warnedAboutMissingApi = true;
                this.warn('The editor cannot hide lines in this Monaco version; the script wrapper stays visible.');
            }
            return;
        }
        this.editor.setHiddenAreas(ranges.map(range => ({ startLineNumber: range.startLine, startColumn: 1, endLineNumber: range.endLine, endColumn: 1 })));
    }
}
