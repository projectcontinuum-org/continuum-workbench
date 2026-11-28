import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAX_CONTEXT_BYTES, parseKotlinScriptContext } from './KotlinScriptContext';

const valid = () => ({
    language: 'kotlin',
    bindings: [{ name: 'acc', type: 'Counter' }, { name: 'items', type: 'List<Map<String, Any>>' }],
    declarations: '/** A counter. */\ninterface Counter {\n    fun next(): Int\n}\n'
});

function parse(raw: unknown): { result: ReturnType<typeof parseKotlinScriptContext>; warnings: string[] } {
    const warnings: string[] = [];
    return { result: parseKotlinScriptContext(raw, message => warnings.push(message)), warnings };
}

function assertRejected(raw: unknown, reason: RegExp): void {
    const { result, warnings } = parse(raw);
    assert.equal(result, undefined);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], reason);
}

describe('parseKotlinScriptContext', () => {
    it('accepts a valid report and keeps bindings and declarations as given', () => {
        const { result, warnings } = parse(valid());
        assert.deepEqual(warnings, []);
        assert.deepEqual(result?.bindings, valid().bindings);
        assert.equal(result?.declarations, valid().declarations);
    });

    it('treats nothing reported as a plain editor without a warning', () => {
        assert.deepEqual(parse(undefined), { result: undefined, warnings: [] });
        assert.deepEqual(parse(null), { result: undefined, warnings: [] });
    });

    it('accepts empty declarations (bindings of stdlib types only) and function types', () => {
        const { result } = parse({ language: 'kotlin', bindings: [{ name: 'f', type: '(Int) -> String' }], declarations: '' });
        assert.equal(result?.bindings[0].type, '(Int) -> String');
    });

    it('rejects values that are not plain objects', () => {
        for (const raw of ['text', 3, true, [valid()]]) {
            assertRejected(raw, /not a plain object/);
        }
        class Report {}
        assertRejected(Object.assign(new Report(), valid()), /not a plain object/);
    });

    it('rejects an own __proto__ key and does not pollute prototypes', () => {
        const raw = JSON.parse('{"language":"kotlin","declarations":"","bindings":[{"name":"a","type":"Int"}],"__proto__":{"polluted":true}}');
        assertRejected(raw, /not a plain object/);
        assert.equal(({} as Record<string, unknown>).polluted, undefined);
        const binding = JSON.parse('{"language":"kotlin","declarations":"","bindings":[{"name":"a","type":"Int","__proto__":{"x":1}}]}');
        assertRejected(binding, /binding is not a plain object/);
    });

    it('rejects another language', () => {
        assertRejected({ ...valid(), language: 'python' }, /not for Kotlin/);
        assertRejected({ ...valid(), language: undefined }, /not for Kotlin/);
    });

    it('rejects missing, empty or malformed bindings', () => {
        assertRejected({ ...valid(), bindings: undefined }, /non-empty list/);
        assertRejected({ ...valid(), bindings: [] }, /non-empty list/);
        assertRejected({ ...valid(), bindings: 'acc' }, /non-empty list/);
        assertRejected({ ...valid(), bindings: [42] }, /binding is not a plain object/);
    });

    it('rejects names that are not identifiers or are Kotlin keywords', () => {
        for (const name of ['1a', 'a-b', 'a b', '', 'a.b', 'class', 'val', 7, undefined]) {
            assertRejected({ ...valid(), bindings: [{ name, type: 'Int' }] }, /not a usable identifier/);
        }
    });

    it('rejects duplicate names', () => {
        assertRejected({ ...valid(), bindings: [{ name: 'a', type: 'Int' }, { name: 'a', type: 'String' }] }, /appears twice/);
    });

    it('rejects types that are empty, not strings or could leave their parameter', () => {
        for (const type of ['', '   ', 'Int\nString', 'Int; fun x()', 'Int = 1', 'Int { }', 'Int // rest', 'Int /* x', 'a\u0000b', 5, undefined, 'x'.repeat(301)]) {
            assertRejected({ ...valid(), bindings: [{ name: 'a', type }] }, /not a single-line type/);
        }
    });

    it('rejects declarations that carry a package or import line, or are not a string', () => {
        assertRejected({ ...valid(), declarations: 'package x\nclass A' }, /package or import/);
        assertRejected({ ...valid(), declarations: 'class A\n  import a.b.C\n' }, /package or import/);
        assertRejected({ ...valid(), declarations: 3 }, /package or import/);
        assertRejected({ ...valid(), declarations: undefined }, /package or import/);
    });

    it('allows the words package and import inside a line that does not start with them', () => {
        assert.notEqual(parse({ ...valid(), declarations: '// the package is hidden\n/** import is not needed */\ninterface A\n' }).result, undefined);
    });

    it('rejects a report over the size limit, and never logs the declarations', () => {
        const secret = 'SECRET_DECLARATION_TEXT';
        const { result, warnings } = parse({ ...valid(), declarations: `// ${secret}\n${'x'.repeat(MAX_CONTEXT_BYTES)}` });
        assert.equal(result, undefined);
        assert.equal(warnings.length, 1);
        assert.match(warnings[0], /larger than/);
        assert.doesNotMatch(warnings[0], new RegExp(secret));
    });

    it('measures the size in bytes, not characters', () => {
        const justOver = '€'.repeat(Math.ceil(MAX_CONTEXT_BYTES / 3));
        assertRejected({ ...valid(), declarations: `// ${justOver}` }, /larger than/);
    });

    it('never throws on hostile input', () => {
        const circular: Record<string, unknown> = { language: 'kotlin' };
        circular.self = circular;
        assertRejected(circular, /cannot be serialised/);
        const throwing = { language: 'kotlin', get bindings(): never { throw new Error('boom'); } };
        assert.doesNotThrow(() => parseKotlinScriptContext(throwing, () => undefined));
    });
});

describe('a context shaped like the one the Kotlin Script node reports', () => {
    const source = require('node:path').resolve(
        __dirname, '..', '..', '..', '..', '..', 'continuum-feature-base', 'features', 'continuum-feature-analytics', 'src', 'main', 'kotlin',
        'org', 'projectcontinuum', 'feature', 'base', 'analytics', 'node', 'ScriptFlowVariables.kt'
    );
    const present = require('node:fs').existsSync(source);

    it('is accepted: bindings in report order, declarations without package line or imports', { skip: !present && 'feature repository is not next to this one' }, () => {
        const declarations = require('node:fs').readFileSync(source, 'utf8').replace(/^package .*\n/m, '').replace(/^\n+/, '');
        const { result } = parse({
            language: 'kotlin',
            bindings: [{ name: 'row', type: 'Map<String, Any>' }, { name: 'flow', type: 'ScriptFlowVariables' }],
            declarations
        });
        assert.deepEqual(result?.bindings.map(binding => binding.name), ['row', 'flow']);
    });
});
