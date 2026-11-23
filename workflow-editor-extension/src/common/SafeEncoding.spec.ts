import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodePathSegment, requirePathSegment, mqttTopicLevel, rsqlComparison, rsqlQuote, svgToDataUri, utf8ToBase64 } from './SafeEncoding';

test('encodePathSegment: dot segments are rejected, "../x" is encoded into one segment', () => {
    for (const bad of ['', '.', '..']) {
        assert.throws(() => encodePathSegment(bad), /Invalid URL path segment/);
    }
    assert.equal(encodePathSegment('../x'), '..%2Fx');
    assert.equal(new URL(`http://h/api/${encodePathSegment('../x')}/cancel`).pathname, '/api/..%2Fx/cancel');
    assert.equal(encodePathSegment('3f1c-uuid'), '3f1c-uuid');
});

test('requirePathSegment: returns a valid segment unchanged (the generated client encodes it) and rejects dot segments', () => {
    assert.equal(requirePathSegment('a/b c'), 'a/b c');
    for (const bad of ['', '.', '..']) {
        assert.throws(() => requirePathSegment(bad), /Invalid URL path segment/);
    }
});

test('rsqlQuote: wraps in double quotes and escapes backslash and double quote', () => {
    assert.equal(rsqlQuote('s3://bucket/a b.cwf'), '"s3://bucket/a b.cwf"');
    assert.equal(rsqlQuote('a"b'), '"a\\"b"');
    assert.equal(rsqlQuote('a\\b'), '"a\\\\b"');
    assert.equal(rsqlQuote('\\"'), '"\\\\\\""');
    assert.equal(rsqlQuote(''), '""');
    assert.equal(rsqlQuote('—✓'), '"—✓"');
});

/** Reads one double-quoted RSQL value the way rsql-parser does; returns the value and the rest. */
function readQuoted(input: string): { value: string; rest: string } {
    assert.equal(input[0], '"');
    let value = '';
    for (let i = 1; i < input.length; i++) {
        const ch = input[i];
        if (ch === '\\') {
            value += input[++i];
        } else if (ch === '"') {
            return { value, rest: input.slice(i + 1) };
        } else {
            value += ch;
        }
    }
    throw new Error('unterminated string');
}

test('rsqlComparison: hostile values stay inside the quoted argument', () => {
    const hostiles = [
        'x;ownedBy==other',
        'x,workflowUri==*',
        'x"),(ownedBy==*',
        'x\\";ownedBy==*;a==\\',
        'a==b&c=d#e?f',
        '../../etc',
        '—✓',
    ];
    for (const hostile of hostiles) {
        const filter = `${rsqlComparison('workflowUri', '==', hostile)};updatedAt>="2026-01-01T00:00:00.000Z"`;
        assert.equal(filter.startsWith('workflowUri=='), true);
        const { value, rest } = readQuoted(filter.slice('workflowUri=='.length));
        assert.equal(value, hostile);
        assert.equal(rest, ';updatedAt>="2026-01-01T00:00:00.000Z"');
    }
});

test('mqttTopicLevel: rejects level separators and wildcards', () => {
    assert.equal(mqttTopicLevel('3f1c2a9e-uuid'), '3f1c2a9e-uuid');
    for (const bad of ['', 'a/b', '+', '#', 'a/#', '../x', 'a\u0000b']) {
        assert.throws(() => mqttTopicLevel(bad), /Invalid MQTT topic level/);
    }
});

test('utf8ToBase64: same as btoa for ASCII, works for non-Latin-1, round-trips', () => {
    assert.equal(utf8ToBase64('<svg/>'), btoa('<svg/>'));
    assert.equal(utf8ToBase64(''), '');
    assert.throws(() => btoa('—✓'));
    for (const text of ['—', '✓', '<svg><text>Größe — ✓ 日本 🧪</text></svg>']) {
        assert.equal(Buffer.from(utf8ToBase64(text), 'base64').toString('utf8'), text);
    }
    const big = '✓'.repeat(100_000);
    assert.equal(Buffer.from(utf8ToBase64(big), 'base64').toString('utf8'), big);
});

test('svgToDataUri: base64 data URI, payload decodes back unchanged (scripts included; <img> does not run them)', () => {
    const svg = '<svg onload="alert(1)"><script>alert(1)</script><text>—✓</text></svg>';
    const uri = svgToDataUri(svg);
    assert.match(uri, /^data:image\/svg\+xml;base64,[A-Za-z0-9+/]+=*$/);
    assert.equal(Buffer.from(uri.slice(uri.indexOf(',') + 1), 'base64').toString('utf8'), svg);
});
