import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { KotlinScriptContext } from './KotlinScriptContext';
import { buildDeclarationsFile, buildScriptFile, scriptWrapper } from './KotlinScriptPrelude';

/** Made-up bindings: nothing here names a real node's API. */
const CONTEXT: KotlinScriptContext = {
    bindings: [{ name: 'a', type: 'Int' }, { name: 'b', type: 'List<String>' }],
    declarations: '/** A thing. */\ninterface Thing {\n    fun size(): Int\n}\n'
};
const ID = 'ctx0123abcd4567xy';
const WRAPPER = scriptWrapper(ID, CONTEXT);
const PACKAGE_LINE = `package ${ID}`;
const HEADER_LINE = 'fun script(a: Int, b: List<String>): Any? = run {';

const build = (userText: string) => buildScriptFile(userText, WRAPPER);

describe('the neutral script wrapper', () => {
    it('has no parameters, so the script may only use the standard library and Java', () => {
        const wrapper = scriptWrapper(ID, undefined);
        assert.equal(wrapper.headerLine, 'fun script(): Any? = run {');
        assert.equal(buildScriptFile('listOf(1)', wrapper).text, [PACKAGE_LINE, 'fun script(): Any? = run {', 'listOf(1)', '}'].join('\n'));
    });
});

describe('the script wrapper', () => {
    it('declares every reported binding as a parameter of the wrapping function', () => {
        assert.equal(WRAPPER.headerLine, HEADER_LINE);
        assert.equal(WRAPPER.packageLine, PACKAGE_LINE);
    });

    it('wraps a script without imports in a package line, a header and a closing brace', () => {
        const file = build('a.toString()');
        assert.equal(file.text, [PACKAGE_LINE, HEADER_LINE, 'a.toString()', '}'].join('\n'));
        assert.deepEqual(file.hiddenRanges, [{ startLine: 1, endLine: 2 }, { startLine: 4, endLine: 4 }]);
    });

    it('keeps the leading imports of the script between the package line and the header', () => {
        const file = build('import java.time.Instant\n\n// note\nimport java.util.UUID\nInstant.now()');
        assert.deepEqual(file.text.split('\n'), [
            PACKAGE_LINE,
            'import java.time.Instant',
            '',
            '// note',
            'import java.util.UUID',
            HEADER_LINE,
            'Instant.now()',
            '}'
        ]);
        assert.deepEqual(file.hiddenRanges, [{ startLine: 1, endLine: 1 }, { startLine: 6, endLine: 6 }, { startLine: 8, endLine: 8 }]);
    });

    it('puts the package line after the leading file annotations, which Kotlin requires', () => {
        const lines = build('@file:Suppress("x")\nimport java.util.UUID\nUUID.randomUUID()').text.split('\n');
        assert.deepEqual(lines, ['@file:Suppress("x")', PACKAGE_LINE, 'import java.util.UUID', HEADER_LINE, 'UUID.randomUUID()', '}']);
    });

    it('keeps a leading block comment, KDoc and file annotation above the header', () => {
        const text = '/* Copyright\n * line */\n@file:Suppress("x")\n/** doc */\nimport java.util.UUID\nUUID.randomUUID()';
        const lines = build(text).text.split('\n');
        assert.equal(lines.indexOf(HEADER_LINE), 6);
        assert.equal(lines[5], 'import java.util.UUID');
        assert.equal(lines[3], PACKAGE_LINE);
    });

    it('places the header after the last line when the script only has imports', () => {
        const lines = build('import java.util.UUID').text.split('\n');
        assert.deepEqual(lines, [PACKAGE_LINE, 'import java.util.UUID', HEADER_LINE, '}']);
    });

    it('does not move the header past a first line of code', () => {
        const lines = build('val x = 1\nimport java.util.UUID').text.split('\n');
        assert.deepEqual(lines, [PACKAGE_LINE, HEADER_LINE, 'val x = 1', 'import java.util.UUID', '}']);
    });

    it('wraps an empty script', () => {
        const file = build('');
        assert.equal(file.text, [PACKAGE_LINE, HEADER_LINE, '', '}'].join('\n'));
    });

    it('keeps user text with braces, unicode and CRLF line breaks', () => {
        const file = build('if (a > 0) {\r\n    "é✓"\r\n}');
        assert.equal(file.text, [PACKAGE_LINE, HEADER_LINE, 'if (a > 0) {', '    "é✓"', '}', '}'].join('\n'));
    });

    it('builds the sibling declarations file in the same package', () => {
        assert.equal(buildDeclarationsFile(ID, CONTEXT), `package ${ID}\n\n${CONTEXT.declarations}`);
    });
});
