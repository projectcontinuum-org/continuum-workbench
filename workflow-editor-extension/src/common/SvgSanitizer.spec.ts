import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeSvg, SvgPurifier } from './SvgSanitizer';

// DOMPurify needs a DOM. Node has none, so the real sanitizer is tested against jsdom when it can
// be resolved (it is not a dependency of this repo, e.g. NODE_PATH=/path/with/jsdom/node_modules).
// Without it the jsdom tests are skipped and only the no-DOM fallback is checked.
let createPurifier: (() => SvgPurifier) | undefined;
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { JSDOM } = require('jsdom');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const createDOMPurify = require('dompurify');
    createPurifier = () => createDOMPurify(new JSDOM('').window);
} catch {
    createPurifier = undefined;
}
const noJsdom = createPurifier ? false : 'jsdom not resolvable';

const HOSTILE = [
    '<svg><script>alert(1)</script></svg>',
    '<svg onload="alert(1)"><circle r="5"/></svg>',
    '<svg><circle r="5" onclick="alert(1)" onmouseover="alert(1)"/></svg>',
    '<svg><a href="javascript:alert(1)"><text>x</text></a></svg>',
    '<svg><a xlink:href="javascript:alert(1)"><text>x</text></a></svg>',
    '<svg><foreignObject><iframe src="javascript:alert(1)"></iframe></foreignObject></svg>',
    '<svg><foreignObject><img src=x onerror="alert(1)"></foreignObject></svg>',
    '<svg><animate attributeName="href" to="javascript:alert(1)"/></svg>',
    '<svg><set attributeName="onload" to="alert(1)"/></svg>',
    '<svg><use href="data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+"/></svg>',
    '<svg><script xlink:href="data:text/javascript,alert(1)"/></svg>',
    '<svg><title><script>alert(1)</script></title></svg>',
    '<img src=x onerror=alert(1)><svg/>',
];

test('sanitizeSvg: hostile SVG loses scripts, handlers and javascript: URLs', { skip: noJsdom }, () => {
    const purifier = createPurifier!();
    for (const dirty of HOSTILE) {
        const clean = sanitizeSvg(dirty, purifier);
        assert.doesNotMatch(clean, /<script/i, dirty);
        assert.doesNotMatch(clean, /\son\w+\s*=/i, dirty);
        assert.doesNotMatch(clean, /javascript:/i, dirty);
        assert.doesNotMatch(clean, /<foreignObject|<iframe|<img/i, dirty);
        assert.doesNotMatch(clean, /alert\(1\)/, dirty);
    }
});

test('sanitizeSvg: CDATA script becomes escaped text; <style> is kept (svg profile allows it)', { skip: noJsdom }, () => {
    const purifier = createPurifier!();
    const clean = sanitizeSvg('<svg><style>.a{fill:red}</style><![CDATA[<script>alert(1)</script>]]></svg>', purifier);
    assert.doesNotMatch(clean, /<script/i);
    assert.match(clean, /&lt;script&gt;/);
    assert.match(clean, /<style>\.a\{fill:red\}<\/style>/);
});

test('sanitizeSvg: ordinary icon markup survives (currentColor, viewBox, paths, filters, unicode)', { skip: noJsdom }, () => {
    const purifier = createPurifier!();
    const icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">'
        + '<defs><filter id="f"><feGaussianBlur stdDeviation="1"/></filter></defs>'
        + '<g filter="url(#f)"><path d="M12 2L2 22h20z" stroke="currentColor" stroke-width="2"/></g>'
        + '<text x="1" y="20">—✓</text></svg>';
    const clean = sanitizeSvg(icon, purifier);
    for (const kept of ['viewBox="0 0 24 24"', 'fill="currentColor"', '<path', 'd="M12 2L2 22h20z"', '<feGaussianBlur', 'filter="url(#f)"', '—✓']) {
        assert.ok(clean.includes(kept), `${kept} missing from ${clean}`);
    }
});

test('sanitizeSvg: returns "" when DOMPurify cannot run instead of the unsanitized input', () => {
    const unsupported: SvgPurifier = { isSupported: false, sanitize: s => s };
    assert.equal(sanitizeSvg('<svg><script>alert(1)</script></svg>', unsupported), '');
    // the default instance in plain Node has no window, so it must fail closed too
    assert.equal(sanitizeSvg('<svg onload="alert(1)"/>'), '');
});

test('sanitizeSvg: non-string sanitize results become ""', () => {
    const odd: SvgPurifier = { isSupported: true, sanitize: () => ({}) };
    assert.equal(sanitizeSvg('<svg/>', odd), '');
});
