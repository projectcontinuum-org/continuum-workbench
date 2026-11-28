import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decideScriptEditorRoute } from './ScriptEditorRoute';

describe('choosing the script editor', () => {
    it('is native for Kotlin in a trusted, open workspace, whatever the node reported', () => {
        assert.deepEqual(decideScriptEditorRoute({ language: 'kotlin', hasWorkspaceRoot: true, trusted: true }), { kind: 'native' });
    });

    it('is plain without a workspace folder, and says so', () => {
        assert.deepEqual(decideScriptEditorRoute({ language: 'kotlin', hasWorkspaceRoot: false, trusted: true }), { kind: 'plain', reason: 'no-workspace' });
    });

    it('is plain in an untrusted workspace, and says so', () => {
        assert.deepEqual(decideScriptEditorRoute({ language: 'kotlin', hasWorkspaceRoot: true, trusted: false }), { kind: 'plain', reason: 'untrusted' });
        assert.deepEqual(decideScriptEditorRoute({ language: 'kotlin', hasWorkspaceRoot: false, trusted: false }), { kind: 'plain', reason: 'no-workspace' });
    });

    for (const language of [undefined, '', 'json', 'freemarker', 'cel', 'plaintext', 'Kotlin']) {
        {
            for (const hasWorkspaceRoot of [true, false]) {
                it(`leaves ${JSON.stringify(language)} plain (workspace ${hasWorkspaceRoot})`, () => {
                    assert.deepEqual(decideScriptEditorRoute({ language, hasWorkspaceRoot, trusted: true }), { kind: 'plain', reason: 'other-language' });
                });
            }
        }
    }
});
