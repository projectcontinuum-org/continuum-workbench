import { KotlinScriptContext } from './KotlinScriptContext';
import { LineRange, VirtualDocumentPlan } from './ScriptEditorTypes';
import { PositionMapper } from './PositionMapper';

/**
 * What a Kotlin Script node's script is wrapped in so the Kotlin language server understands it. The node runs the
 * script once per row with the bindings it reports (`KotlinScriptContext`); the server has to be told about them, which
 * is the whole job of this prelude: the script file declares each binding as a parameter of a wrapper function, and a
 * sibling file of the same package holds the reported declarations the binding types refer to.
 *
 * The wrapper lines are hidden from the user: they are never shown, never saved and never part of the stored script.
 * The package is unique to one open editor (see `ScriptFileNaming`), so two scripts on the server's source path never
 * declare the same names twice.
 */

/** The three wrapper lines of one script file. */
export interface ScriptWrapper {
    /** `package ctx<id>`, after the user's leading file annotations (a file annotation may not follow it). */
    readonly packageLine: string;
    /** The function that declares every reported binding as a parameter and opens the body, after the user's imports. */
    readonly headerLine: string;
    /** The brace that closes the body; the last line of the file. */
    readonly closingLine: string;
}

/** Name of the wrapper function; the package already makes it unique. */
export const WRAPPER_FUNCTION_NAME = 'script';

/**
 * The wrapper around a script. Without a context (the node reported none, or nothing usable) it is the neutral one: a
 * function with no parameters, so the language server still knows the Kotlin standard library and Java's classes but
 * claims nothing about names the script may use.
 */
export function scriptWrapper(packageId: string, context: KotlinScriptContext | undefined): ScriptWrapper {
    const parameters = (context?.bindings ?? []).map(binding => `${binding.name}: ${binding.type}`).join(', ');
    return {
        packageLine: `package ${packageId}`,
        headerLine: `fun ${WRAPPER_FUNCTION_NAME}(${parameters}): Any? = run {`,
        closingLine: '}'
    };
}

/** Text of the sibling file that declares what the node reported. */
export function buildDeclarationsFile(packageId: string, context: KotlinScriptContext): string {
    return `package ${packageId}\n\n${context.declarations}`;
}

const IMPORT_LINE = /^\s*import\s+\S/;
const FILE_ANNOTATION_LINE = /^\s*@file:/;
const SKIPPABLE_LINE = /^\s*(\/\/.*)?$/;
const BLOCK_COMMENT_START = /^\s*\/\*/;
const BLOCK_COMMENT_END = /\*\/\s*$/;

/** Indexes of the user lines in front of which the wrapper's package line and its header go. */
export interface WrapperPlacement {
    readonly packageBeforeLine: number;
    readonly headerBeforeLine: number;
}

/**
 * Where the hidden lines go: the package line right after the user's leading `@file:` annotations and the header right
 * after the user's leading imports (with their blank, `//` and block-comment lines, KDoc included), because a Kotlin
 * file needs its file annotations, then its package, then its imports, before its first declaration.
 */
export function placeWrapper(userLines: readonly string[]): WrapperPlacement {
    let afterLastAnnotationBeforeImports = 0;
    let afterLastImportOrAnnotation = 0;
    let seenImport = false;
    let insideBlockComment = false;
    for (let index = 0; index < userLines.length; index++) {
        const line = userLines[index];
        if (insideBlockComment) {
            insideBlockComment = !BLOCK_COMMENT_END.test(line);
        } else if (BLOCK_COMMENT_START.test(line)) {
            insideBlockComment = !(BLOCK_COMMENT_END.test(line) && line.trim().length >= 4);
        } else if (IMPORT_LINE.test(line)) {
            seenImport = true;
            afterLastImportOrAnnotation = index + 1;
        } else if (FILE_ANNOTATION_LINE.test(line)) {
            afterLastImportOrAnnotation = index + 1;
            if (!seenImport) {
                afterLastAnnotationBeforeImports = index + 1;
            }
        } else if (!SKIPPABLE_LINE.test(line)) {
            break;
        }
    }
    return { packageBeforeLine: afterLastAnnotationBeforeImports, headerBeforeLine: afterLastImportOrAnnotation };
}

export interface ScriptFile {
    /** The whole file: user text with the wrapper woven in. */
    readonly text: string;
    /** The wrapper lines, as closed one-based line ranges of `text`, in order and merged where adjacent. */
    readonly hiddenRanges: readonly LineRange[];
}

export const LINE_BREAK_PATTERN = /\r\n|\r|\n/;

/**
 * Plans the wrapper around [userText]. The user's own lines are not changed, so a script's last expression is the
 * function's result, as it is when the node runs it.
 */
export function buildScriptFile(userText: string, wrapper: ScriptWrapper): ScriptFile {
    const userLines = userText.split(LINE_BREAK_PATTERN);
    const { packageBeforeLine, headerBeforeLine } = placeWrapper(userLines);
    const plan: VirtualDocumentPlan = {
        hiddenBlocks: [
            { beforeUserLine: packageBeforeLine, lines: [wrapper.packageLine] },
            { beforeUserLine: headerBeforeLine, lines: [wrapper.headerLine] }
        ],
        trailingLines: [wrapper.closingLine]
    };
    const { virtualText } = new PositionMapper(userText, plan);
    // One-based file lines: the package line has `packageBeforeLine` user lines above it, the header has
    // `headerBeforeLine` user lines and the package line above it, the closing line follows every other line.
    const hidden: LineRange[] = [
        { startLine: packageBeforeLine + 1, endLine: packageBeforeLine + 1 },
        { startLine: headerBeforeLine + 2, endLine: headerBeforeLine + 2 },
        { startLine: userLines.length + 3, endLine: userLines.length + 3 }
    ];
    return { text: virtualText, hiddenRanges: mergeAdjacent(hidden) };
}

function mergeAdjacent(ranges: readonly LineRange[]): LineRange[] {
    const merged: LineRange[] = [];
    for (const range of ranges) {
        const last = merged[merged.length - 1];
        if (last && range.startLine <= last.endLine + 1) {
            merged[merged.length - 1] = { startLine: last.startLine, endLine: Math.max(last.endLine, range.endLine) };
        } else {
            merged.push(range);
        }
    }
    return merged;
}
