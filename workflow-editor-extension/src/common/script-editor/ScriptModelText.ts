import { buildScriptFile, LINE_BREAK_PATTERN, placeWrapper, ScriptFile, ScriptWrapper } from './KotlinScriptPrelude';
import { LineRange } from './ScriptEditorTypes';

/**
 * Converts between the text the user typed and the text of the model the editor holds (the user's text with the wrapper
 * lines of `KotlinScriptPrelude` in it). The model is the editor's only source of truth: the wrapper lines are found
 * again by their exact content, never remembered by line number, because the user's edits move them.
 */

/** Zero-based indexes of the wrapper lines in the model's lines. */
export interface WrapperLocation {
    readonly packageIndex: number;
    readonly headerIndex: number;
    readonly closingIndex: number;
}

/** Finds the wrapper lines, or `undefined` when any of them is gone (a select-all-and-paste can remove them). */
export function locateWrapper(lines: readonly string[], wrapper: ScriptWrapper): WrapperLocation | undefined {
    const packageIndex = lines.indexOf(wrapper.packageLine);
    if (packageIndex < 0) {
        return undefined;
    }
    const headerIndex = lines.indexOf(wrapper.headerLine, packageIndex + 1);
    const closingIndex = lines.length - 1;
    if (headerIndex < 0 || closingIndex <= headerIndex || lines[closingIndex] !== wrapper.closingLine) {
        return undefined;
    }
    return { packageIndex, headerIndex, closingIndex };
}

/** The exact text the user typed: the model text without its wrapper lines. Line breaks come out as `\n`. */
export function userTextOf(modelText: string, wrapper: ScriptWrapper): string {
    const lines = modelText.split(LINE_BREAK_PATTERN);
    const location = locateWrapper(lines, wrapper);
    if (location) {
        return lines.filter((_, index) => index !== location.packageIndex && index !== location.headerIndex && index !== location.closingIndex).join('\n');
    }
    // A damaged wrapper: drop the lines that are still recognisably ours, keep everything else as the user's text. The
    // closing brace is only dropped together with the header, because a lone `}` may be the user's own.
    const packageIndex = lines.indexOf(wrapper.packageLine);
    const headerIndex = lines.indexOf(wrapper.headerLine);
    const closingIsOurs = headerIndex >= 0 && lines.length - 1 > headerIndex && lines[lines.length - 1] === wrapper.closingLine;
    const kept = lines.filter((_, index) => index !== packageIndex && index !== headerIndex && !(closingIsOurs && index === lines.length - 1));
    return kept.join('\n');
}

/** The model text for [userText]: the inverse of `userTextOf`. */
export function modelTextOf(userText: string, wrapper: ScriptWrapper): ScriptFile {
    return buildScriptFile(userText, wrapper);
}

/** The wrapper lines as one-based ranges, adjacent ones merged, ready for the editor's hidden areas. */
export function hiddenRangesOf(location: WrapperLocation): LineRange[] {
    const lines = [location.packageIndex, location.headerIndex, location.closingIndex].map(index => index + 1);
    const ranges: LineRange[] = [];
    for (const line of lines) {
        const last = ranges[ranges.length - 1];
        if (last && line === last.endLine + 1) {
            ranges[ranges.length - 1] = { startLine: last.startLine, endLine: line };
        } else {
            ranges.push({ startLine: line, endLine: line });
        }
    }
    return ranges;
}

/** One text change in editor coordinates (one-based line and column). */
export interface TextEdit {
    readonly startLine: number;
    readonly startColumn: number;
    readonly endLine: number;
    readonly endColumn: number;
    readonly text: string;
}

/**
 * The edits that put the package line and the header back where the user's current leading imports and file
 * annotations need them (typing an `import` at the top of the script moves the header below it). Only a line that has to
 * move is touched, so the cursor and the user's own text stay where they are. Empty when the layout is already right.
 */
export function relayoutEdits(lines: readonly string[], location: WrapperLocation, wrapper: ScriptWrapper): TextEdit[] {
    const userIndexes = lines.map((_, index) => index).filter(index => index !== location.packageIndex && index !== location.headerIndex && index !== location.closingIndex);
    const wanted = placeWrapper(userIndexes.map(index => lines[index]));
    const insertIndexBefore = (userLine: number): number => (userLine < userIndexes.length ? userIndexes[userLine] : location.closingIndex);

    const edits: TextEdit[] = [];
    const move = (currentIndex: number, userLinesAbove: number, wantedAbove: number, text: string): void => {
        if (userLinesAbove === wantedAbove) {
            return;
        }
        edits.push({ startLine: currentIndex + 1, startColumn: 1, endLine: currentIndex + 2, endColumn: 1, text: '' });
        const at = insertIndexBefore(wantedAbove) + 1;
        edits.push({ startLine: at, startColumn: 1, endLine: at, endColumn: 1, text: `${text}\n` });
    };
    move(location.packageIndex, location.packageIndex, wanted.packageBeforeLine, wrapper.packageLine);
    move(location.headerIndex, location.headerIndex - 1, wanted.headerBeforeLine, wrapper.headerLine);
    return mergeInsertsAtSamePoint(edits);
}

/** Two lines moving to the same place become one insertion, so their order never depends on the editor. */
function mergeInsertsAtSamePoint(edits: readonly TextEdit[]): TextEdit[] {
    const merged: TextEdit[] = [];
    for (const edit of edits) {
        const same = merged.find(other => edit.text !== '' && other.text !== '' && other.startLine === edit.startLine);
        if (same) {
            merged[merged.indexOf(same)] = { ...same, text: same.text + edit.text };
        } else {
            merged.push(edit);
        }
    }
    return merged;
}
