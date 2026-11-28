import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveCodeEditorOptions } from './CodeEditorOptions';
import { decideScriptEditorRoute } from './script-editor/ScriptEditorRoute';

// The code controls of the platform's nodes, as their UI schemas declare them.
const NODES = {
    restUrl: { options: { format: 'code', language: 'freemarker2', rows: 1 } },
    restPayload: { options: { format: 'code', language: 'freemarker2', rows: 10 } },
    claudePrompt: { options: { format: 'code', language: 'freemarker2', rows: 8 } },
    claudeSystemPrompt: { options: { format: 'code', language: 'markdown', rows: 6 } },
    claudeJson: { options: { format: 'code', language: 'json', rows: 8 } },
    createTable: { options: { format: 'code', language: 'freemarker', rows: 15 } }
};

describe('the code editor options', () => {
    it('honour the language and rows each node declares', () => {
        assert.deepEqual(
            Object.values(NODES).map(node => {
                const { monacoLanguage, rows } = resolveCodeEditorOptions(node);
                return [monacoLanguage, rows];
            }),
            [['freemarker2', 1], ['freemarker2', 10], ['freemarker2', 8], ['markdown', 6], ['json', 8], ['freemarker2', 15]]
        );
    });

    it('fall back to the defaults when the UI schema has no options', () => {
        for (const uischema of [undefined, {}, { options: {} }]) {
            const options = resolveCodeEditorOptions(uischema);
            assert.equal(options.rows, 15);
            assert.equal(options.format, 'code');
            assert.equal(options.declaredLanguage, undefined);
            assert.equal(options.monacoLanguage, 'plaintext');
        }
    });

    it('ignore a rows value that is not a positive number', () => {
        for (const rows of [0, -3, 'ten', NaN, null]) {
            assert.equal(resolveCodeEditorOptions({ options: { rows } }).rows, 15);
        }
        assert.equal(resolveCodeEditorOptions({ options: { rows: 2.9 } }).rows, 2);
    });

    it('gives Kotlin its own plain-editor id, so the plain editor never starts the Kotlin extension', () => {
        const options = resolveCodeEditorOptions({ options: { language: 'kotlin' } });
        assert.equal(options.declaredLanguage, 'kotlin');
        assert.equal(options.monacoLanguage, 'continuum-kotlin-script');
    });

    it('lets only a Kotlin control get the editor with code intelligence, with or without a report', () => {
        const routeOf = (node: { options: Record<string, unknown> }) =>
            decideScriptEditorRoute({ language: resolveCodeEditorOptions(node).declaredLanguage, hasWorkspaceRoot: true, trusted: true }).kind;
        assert.deepEqual(Object.values(NODES).map(routeOf), Array(6).fill('plain'));
        assert.equal(routeOf({ options: { format: 'code', language: 'kotlin' } }), 'native');
        assert.equal(routeOf({ options: { format: 'code', language: 'kotlin', scriptContext: { bindings: 'nonsense' } } }), 'native');
    });
});
