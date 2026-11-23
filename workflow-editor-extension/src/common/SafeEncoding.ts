/**
 * Pure helpers for putting untrusted values into URL paths, RSQL filters, MQTT topics and data URIs.
 * No DOM or Theia imports, so they run under `node --test` (see SafeEncoding.spec.ts).
 */

/**
 * Reject "", "." and "..": a generated client puts a path parameter through encodeURIComponent, which leaves dots
 * alone, and URL parsers treat "%2e%2e" as ".." too, so these can't be made safe by encoding. Returns the segment.
 */
export function requirePathSegment(segment: string): string {
    if (segment === '' || segment === '.' || segment === '..') {
        throw new Error(`Invalid URL path segment: "${segment}"`);
    }
    return segment;
}

/** Encode one URL path segment (after {@link requirePathSegment}). */
export function encodePathSegment(segment: string): string {
    return encodeURIComponent(requirePathSegment(segment));
}

/**
 * Quote a value for an RSQL comparison: wrap it in double quotes and backslash-escape `\` and `"`,
 * so `;`, `,`, `==`, `(` etc. stay part of the value (the parser removes the backslashes).
 * The server's `==` still reads `*` as a wildcard; quoting does not change that.
 */
export function rsqlQuote(value: string): string {
    return `"${value.replace(/[\\"]/g, '\\$&')}"`;
}

/** `selector<op>"value"`, e.g. rsqlComparison('workflowUri', '==', uri). */
export function rsqlComparison(selector: string, operator: string, value: string): string {
    return `${selector}${operator}${rsqlQuote(value)}`;
}

/**
 * Check a value used as a single MQTT topic level. `/` would add levels, and `+`/`#` are
 * wildcards when subscribing.
 */
export function mqttTopicLevel(value: string): string {
    if (value === '' || /[/+#\u0000]/.test(value)) {
        throw new Error(`Invalid MQTT topic level: "${value}"`);
    }
    return value;
}

/** Base64 of the UTF-8 bytes of `text`. Unlike plain btoa(text), it works for any Unicode. */
export function utf8ToBase64(text: string): string {
    const bytes = new TextEncoder().encode(text);
    const chunkSize = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
}

/** `data:image/svg+xml;base64,...` for use as an <img> src. Scripts in an SVG loaded this way never run. */
export function svgToDataUri(svg: string): string {
    return `data:image/svg+xml;base64,${utf8ToBase64(svg)}`;
}
