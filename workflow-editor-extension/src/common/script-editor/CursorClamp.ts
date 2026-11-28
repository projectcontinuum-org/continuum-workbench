import { WrapperLocation } from './ScriptModelText';

/** A cursor position in the editor's one-based line and column. */
export interface CursorPosition {
    readonly line: number;
    readonly column: number;
}

/**
 * Where a cursor that landed on a hidden wrapper line belongs instead: Ctrl+End, a click below the text or a
 * select-all would otherwise leave the cursor on the hidden closing line, and the next typed character would go
 * after the wrapper's closing brace. A position on a visible line is returned unchanged.
 *
 * A hidden line above all visible ones maps to the start of the first visible line; any other hidden line maps to the
 * end of the nearest visible line above it.
 */
export function clampToVisible(position: CursorPosition, lines: readonly string[], location: WrapperLocation): CursorPosition {
    const hidden = new Set([location.packageIndex, location.headerIndex, location.closingIndex]);
    if (!hidden.has(position.line - 1)) {
        return position;
    }
    let above = position.line - 2;
    while (above >= 0 && hidden.has(above)) {
        above--;
    }
    if (above >= 0) {
        return { line: above + 1, column: lines[above].length + 1 };
    }
    let below = position.line;
    while (below < lines.length && hidden.has(below)) {
        below++;
    }
    return below < lines.length ? { line: below + 1, column: 1 } : position;
}
