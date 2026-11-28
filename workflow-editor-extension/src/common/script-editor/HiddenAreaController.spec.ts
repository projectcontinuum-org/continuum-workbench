import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HiddenAreaController, EditorRange, ScriptEditorLike, ScriptModelLike } from './HiddenAreaController';
import { KotlinScriptContext } from './KotlinScriptContext';
import { scriptWrapper } from './KotlinScriptPrelude';
import { modelTextOf } from './ScriptModelText';

const CONTEXT: KotlinScriptContext = { bindings: [{ name: 'a', type: 'Int' }], declarations: 'interface Thing\n' };
const WRAPPER = scriptWrapper('ctxabc', CONTEXT);

/** A model that holds text, notifies on change and understands whole-line edits like the real one. */
class FakeModel implements ScriptModelLike {
    private listeners: Array<() => void> = [];
    constructor(public text: string) {}
    getLinesContent(): string[] {
        return this.text.split('\n');
    }
    getValue(): string {
        return this.text;
    }
    setValue(value: string): void {
        this.text = value;
        this.fire();
    }
    applyEdits(edits: { range: EditorRange; text: string }[]): void {
        const lines = this.getLinesContent();
        const offsetOf = (line: number, column: number): number => lines.slice(0, line - 1).reduce((sum, current) => sum + current.length + 1, 0) + column - 1;
        const original = this.text;
        this.text = [...edits]
            .sort((first, second) => offsetOf(second.range.startLineNumber, second.range.startColumn) - offsetOf(first.range.startLineNumber, first.range.startColumn))
            .reduce((result, edit) => result.slice(0, offsetOf(edit.range.startLineNumber, edit.range.startColumn)) + edit.text + result.slice(offsetOf(edit.range.endLineNumber, edit.range.endColumn)), original);
        this.fire();
    }
    onDidChangeContent(listener: () => void): { dispose(): void } {
        this.listeners.push(listener);
        return { dispose: () => (this.listeners = this.listeners.filter(other => other !== listener)) };
    }
    /** What the user does in the visible area. */
    type(text: string): void {
        this.setValue(text);
    }
    private fire(): void {
        [...this.listeners].forEach(listener => listener());
    }
}

function setup(userText: string, withApi = true) {
    const model = new FakeModel(modelTextOf(userText, WRAPPER).text);
    const applied: EditorRange[][] = [];
    const editor: ScriptEditorLike = withApi ? { setHiddenAreas: ranges => applied.push(ranges) } : {};
    const warnings: string[] = [];
    const controller = new HiddenAreaController(editor, model, WRAPPER, message => warnings.push(message));
    return { model, applied, warnings, controller };
}

const lineNumbers = (ranges: EditorRange[]): Array<[number, number]> => ranges.map(range => [range.startLineNumber, range.endLineNumber]);

describe('the hidden area controller', () => {
    it('hides the wrapper as soon as it is created', () => {
        const { applied } = setup('val x = 1');
        assert.deepEqual(lineNumbers(applied[applied.length - 1]), [[1, 2], [4, 4]]);
    });

    it('hides the wrapper again after a programmatic replace', () => {
        const { applied, controller, model } = setup('val x = 1');
        controller.setUserText('import a.B\nval y = 2');
        assert.deepEqual(lineNumbers(applied[applied.length - 1]), [[1, 1], [3, 3], [5, 5]]);
        assert.equal(controller.userText(), 'import a.B\nval y = 2');
        assert.equal(model.getLinesContent()[2], WRAPPER.headerLine);
    });

    it('re-hides after the model changes, following the wrapper when lines are added above it', () => {
        const { applied, model } = setup('import a.B\nval x = 1');
        const lines = model.getLinesContent();
        lines.splice(1, 0, 'import c.D');
        model.type(lines.join('\n'));
        assert.deepEqual(lineNumbers(applied[applied.length - 1]), [[1, 1], [4, 4], [6, 6]]);
    });

    it('moves the header below an import the user typed at the top', () => {
        const { model, controller } = setup('val x = 1');
        const lines = model.getLinesContent();
        lines.splice(2, 0, 'import a.B');
        model.type(lines.join('\n'));
        assert.deepEqual(model.getLinesContent(), [WRAPPER.packageLine, 'import a.B', WRAPPER.headerLine, 'val x = 1', '}']);
        assert.equal(controller.userText(), 'import a.B\nval x = 1');
    });

    it('restores the wrapper around what is left after a select-all replace', () => {
        const { model, controller, applied } = setup('val x = 1');
        model.type('replaced everything');
        assert.equal(controller.userText(), 'replaced everything');
        assert.deepEqual(model.getLinesContent(), [WRAPPER.packageLine, WRAPPER.headerLine, 'replaced everything', '}']);
        assert.deepEqual(lineNumbers(applied[applied.length - 1]), [[1, 2], [4, 4]]);
    });

    it('keeps the wrapper visible and warns once when the editor cannot hide lines', () => {
        const { model, warnings } = setup('x', false);
        model.type(model.getValue() + '\n');
        assert.equal(warnings.length, 1);
    });

    it('numbers lines as the user sees them, without the wrapper', () => {
        const { controller } = setup('import a.B\nval x = 1');
        // model: 1 package, 2 import, 3 header, 4 code, 5 closing
        assert.deepEqual([2, 4].map(line => controller.userLineNumber(line)), [1, 2]);
    });

    it('moves a cursor that reached the hidden closing line back to the end of the user text', () => {
        const model = new FakeModel(modelTextOf('val x = 1', WRAPPER).text);
        let selection = { selectionStartLineNumber: 4, selectionStartColumn: 2, positionLineNumber: 4, positionColumn: 2 };
        let notify = (): void => undefined;
        const editor: ScriptEditorLike = {
            setHiddenAreas: () => undefined,
            getSelection: () => selection,
            setSelection: next => (selection = next),
            onDidChangeCursorSelection: listener => {
                notify = listener;
                return { dispose: () => undefined };
            }
        };
        new HiddenAreaController(editor, model, WRAPPER);
        notify();
        assert.deepEqual(selection, { selectionStartLineNumber: 3, selectionStartColumn: 10, positionLineNumber: 3, positionColumn: 10 });
    });

    it('stops reacting after dispose', () => {
        const { model, applied, controller } = setup('x');
        controller.dispose();
        const before = applied.length;
        model.type('anything');
        assert.equal(applied.length, before);
    });
});
