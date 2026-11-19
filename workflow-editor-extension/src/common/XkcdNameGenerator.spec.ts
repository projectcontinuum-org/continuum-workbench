import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateXkcdName } from './XkcdNameGenerator';

test('generateXkcdName: matches the expected PascalCase format', () => {
    for (let i = 0; i < 1000; i++) {
        const name = generateXkcdName();
        // One capital adjective, one capital noun, then a 1-2 digit number (0-99).
        assert.match(name, /^[A-Z][a-z]+[A-Z][a-z]+\d{1,2}$/, `bad name: ${name}`);
    }
});

test('generateXkcdName: never contains "/", spaces, hyphens or dots', () => {
    for (let i = 0; i < 1000; i++) {
        const name = generateXkcdName();
        assert.equal(name.includes('/'), false, `contains slash: ${name}`);
        assert.equal(name.includes(' '), false, `contains space: ${name}`);
        assert.equal(name.includes('-'), false, `contains hyphen: ${name}`);
        assert.equal(name.includes('.'), false, `contains dot: ${name}`);
    }
});

test('generateXkcdName: produces a variety of names over many runs', () => {
    const names = new Set<string>();
    for (let i = 0; i < 10000; i++) {
        names.add(generateXkcdName());
    }
    // With ~88 adjectives x ~104 nouns x 100 numbers, expect high variety.
    // A stuck generator (always returning the same name) would produce 1.
    assert.ok(names.size > 100, `only ${names.size} unique names in 10000 runs`);
});
