import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dialogEditorLanguage } from './DialogEditorLanguage';

test('the script language gets a dedicated id so file-language extensions do not wake', () => {
    assert.equal(dialogEditorLanguage('kotlin'), 'continuum-kotlin-script');
});

test('other declared languages keep their own id, with the known alias mapped', () => {
    assert.equal(dialogEditorLanguage('freemarker2'), 'freemarker2');
    assert.equal(dialogEditorLanguage('freemarker'), 'freemarker2');
    assert.equal(dialogEditorLanguage('json'), 'json');
    assert.equal(dialogEditorLanguage('markdown'), 'markdown');
});

test('an editor that declares no language is plain text, never kotlin', () => {
    assert.equal(dialogEditorLanguage(undefined), 'plaintext');
    assert.equal(dialogEditorLanguage(''), 'plaintext');
});
