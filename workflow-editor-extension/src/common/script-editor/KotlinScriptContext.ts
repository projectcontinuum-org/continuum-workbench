/** One name a script finds in scope when it runs, with its Kotlin type as source text. */
export interface ScriptBinding {
    readonly name: string;
    readonly type: string;
}

/**
 * What a node reports about the world its Kotlin script runs in: the bindings it puts in scope and the Kotlin
 * source that declares the types those bindings use (without package or import lines).
 */
export interface KotlinScriptContext {
    readonly bindings: readonly ScriptBinding[];
    readonly declarations: string;
}

/** Largest accepted report (serialised, in bytes); a node that needs more is not describing bindings any more. */
export const MAX_CONTEXT_BYTES = 64 * 1024;
const MAX_BINDINGS = 32;
const MAX_TYPE_LENGTH = 300;

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
/** Characters and sequences that would let a type text escape the parameter it is placed in. */
const FORBIDDEN_IN_TYPE = /[;{}=\u0000-\u001f\u007f]|\/\/|\/\*/;
const PACKAGE_OR_IMPORT_LINE = /^[ \t]*(package|import)\b/m;
/** Words Kotlin does not allow as a parameter name. */
const HARD_KEYWORDS: ReadonlySet<string> = new Set([
    'as', 'break', 'class', 'continue', 'do', 'else', 'false', 'for', 'fun', 'if', 'in', 'interface', 'is', 'null',
    'object', 'package', 'return', 'super', 'this', 'throw', 'true', 'try', 'typealias', 'typeof', 'val', 'var',
    'when', 'while'
]);

type Warn = (message: string) => void;

function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return false;
    }
    const prototype = Object.getPrototypeOf(value);
    return (prototype === Object.prototype || prototype === null) && !Object.prototype.hasOwnProperty.call(value, '__proto__');
}

function parseBinding(raw: unknown): ScriptBinding | string {
    if (!isPlainObject(raw)) {
        return 'a binding is not a plain object';
    }
    const { name, type } = raw;
    if (typeof name !== 'string' || !IDENTIFIER.test(name) || HARD_KEYWORDS.has(name)) {
        return 'a binding name is not a usable identifier';
    }
    if (typeof type !== 'string' || type.trim().length === 0 || type.length > MAX_TYPE_LENGTH || FORBIDDEN_IN_TYPE.test(type)) {
        return `the type of binding "${name}" is not a single-line type`;
    }
    return { name, type: type.trim() };
}

function rejection(raw: unknown): string | undefined {
    if (!isPlainObject(raw)) {
        return 'the report is not a plain object';
    }
    let size: number;
    try {
        size = new TextEncoder().encode(JSON.stringify(raw)).length;
    } catch {
        return 'the report cannot be serialised';
    }
    if (size > MAX_CONTEXT_BYTES) {
        return `the report is larger than ${MAX_CONTEXT_BYTES} bytes`;
    }
    if (raw.language !== 'kotlin') {
        return 'the report is not for Kotlin';
    }
    if (typeof raw.declarations !== 'string' || PACKAGE_OR_IMPORT_LINE.test(raw.declarations)) {
        return 'the declarations are missing or contain a package or import line';
    }
    return undefined;
}

/**
 * Validates and normalises the `scriptContext` a node reported for its code field. Returns `undefined` for anything
 * unusable (the editor is then a plain code editor); the reason is logged once per call and never includes the
 * declarations. Never throws.
 */
export function parseKotlinScriptContext(raw: unknown, warn: Warn = message => console.warn(message)): KotlinScriptContext | undefined {
    if (raw === undefined || raw === null) {
        return undefined; // nothing reported is the normal case of a node without a context
    }
    const reason = rejection(raw);
    if (reason !== undefined) {
        warn(`Ignoring the script context: ${reason}`);
        return undefined;
    }
    const report = raw as Record<string, unknown>;
    const rawBindings = report.bindings;
    if (!Array.isArray(rawBindings) || rawBindings.length === 0 || rawBindings.length > MAX_BINDINGS) {
        warn('Ignoring the script context: bindings must be a non-empty list');
        return undefined;
    }
    const bindings: ScriptBinding[] = [];
    for (const rawBinding of rawBindings) {
        const binding = parseBinding(rawBinding);
        if (typeof binding === 'string') {
            warn(`Ignoring the script context: ${binding}`);
            return undefined;
        }
        if (bindings.some(existing => existing.name === binding.name)) {
            warn(`Ignoring the script context: binding "${binding.name}" appears twice`);
            return undefined;
        }
        bindings.push(binding);
    }
    return { bindings, declarations: report.declarations as string };
}
