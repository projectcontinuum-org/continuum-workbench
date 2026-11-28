import { HiddenBlock, LspDiagnostic, LspPosition, LspRange, VirtualDocumentPlan } from './ScriptEditorTypes';

const LINE_BREAK = /\r\n|\r|\n/;

/**
 * The text a language server analyses (the user's lines with hidden lines woven in) and the line/column mapping
 * between it and the text the user sees.
 *
 * Hidden blocks are whole lines, so a user line keeps its column numbers: only line numbers shift. Positions the
 * server reports inside hidden lines have no user-side equivalent: a diagnostic wholly inside hidden text is dropped
 * and one that straddles hidden text is clamped to the user's text.
 *
 * Line breaks in the user's text may be `\n`, `\r\n` or `\r`; the virtual text always uses `\n` (a position is a
 * line and a column, so this changes nothing the editor can observe).
 */
export class PositionMapper {
    /** The text to send to the language server. */
    readonly virtualText: string;

    private readonly userLines: string[];
    /** For each virtual line, the user line it shows, or `undefined` for a hidden line. */
    private readonly virtualToUser: (number | undefined)[] = [];
    /** For each user line, its virtual line. */
    private readonly userToVirtual: number[] = [];

    private readonly showTrailingErrors: boolean;
    /** Virtual line range `[first, end)` of the plan's trailing lines. */
    private trailingFirstLine = 0;
    private trailingEndLine = 0;

    constructor(userText: string, plan: VirtualDocumentPlan) {
        this.showTrailingErrors = plan.showTrailingErrorsOnLastUserLine === true;
        this.userLines = userText.split(LINE_BREAK);
        const virtualLines = this.weave(plan);
        this.virtualText = virtualLines.join('\n');
    }

    /** Number of lines of the user's text (an empty text has one empty line). */
    get userLineCount(): number {
        return this.userLines.length;
    }

    /** Maps a position of the user's text to the virtual text. A line past either end is clamped to the nearest line. */
    toVirtualPosition(position: LspPosition): LspPosition {
        const userLine = Math.min(Math.max(position.line, 0), this.userLines.length - 1);
        return { line: this.userToVirtual[userLine], character: position.character };
    }

    toVirtualRange(range: LspRange): LspRange {
        return { start: this.toVirtualPosition(range.start), end: this.toVirtualPosition(range.end) };
    }

    /** Maps a position of the virtual text to the user's text; `undefined` when it lies in hidden text. */
    toUserPosition(position: LspPosition): LspPosition | undefined {
        const userLine = this.virtualToUser[position.line];
        if (userLine === undefined) {
            return undefined;
        }
        return { line: userLine, character: position.character };
    }

    /**
     * Maps a range of the virtual text to the user's text. An end point in hidden text moves back to the end of the
     * previous user line, a start point in hidden text moves forward to the start of the next user line. Returns
     * `undefined` when the range holds no user text after that.
     */
    toUserRange(range: LspRange): LspRange | undefined {
        const start = this.userStart(range.start);
        const end = this.userEnd(range.end);
        if (!start || !end) {
            return undefined;
        }
        const wasClamped = start.clamped || end.clamped;
        const ordered = comparePositions(start.position, end.position);
        if (ordered > 0 || (wasClamped && ordered === 0)) {
            return undefined;
        }
        return { start: start.position, end: end.position };
    }

    /** Maps diagnostics to the user's text and drops those that lie wholly in hidden text. */
    toUserDiagnostics<T extends LspDiagnostic>(diagnostics: readonly T[]): T[] {
        const mapped: T[] = [];
        for (const diagnostic of diagnostics) {
            const range = this.toUserRange(diagnostic.range) ?? this.trailingErrorRange(diagnostic);
            if (range) {
                mapped.push({ ...diagnostic, range });
            }
        }
        return mapped;
    }

    /**
     * Where an error that lies in the plan's trailing hidden lines is shown (when the plan asks for it): the end of the
     * last user line. Errors in any other hidden line (such as a header) are never moved onto user text.
     */
    private trailingErrorRange(diagnostic: LspDiagnostic): LspRange | undefined {
        const lastUserLine = this.userLines.length - 1;
        const isError = diagnostic.severity === undefined || diagnostic.severity === 1;
        const line = diagnostic.range.start.line;
        if (!this.showTrailingErrors || !isError || line < this.trailingFirstLine || line >= this.trailingEndLine) {
            return undefined;
        }
        const length = this.userLines[lastUserLine].length;
        const from = Math.max(length - 1, 0);
        return { start: { line: lastUserLine, character: from }, end: { line: lastUserLine, character: length } };
    }

    private weave(plan: VirtualDocumentPlan): string[] {
        const blocksByLine = this.groupBlocks(plan.hiddenBlocks);
        const virtualLines: string[] = [];
        const addHidden = (lines: readonly string[]): void => {
            for (const line of lines) {
                assertSingleLine(line);
                this.virtualToUser.push(undefined);
                virtualLines.push(line);
            }
        };
        this.userLines.forEach((userLine, index) => {
            addHidden(blocksByLine.get(index) ?? []);
            this.userToVirtual.push(virtualLines.length);
            this.virtualToUser.push(index);
            virtualLines.push(userLine);
        });
        addHidden(blocksByLine.get(this.userLines.length) ?? []);
        this.trailingFirstLine = virtualLines.length;
        addHidden(plan.trailingLines);
        this.trailingEndLine = virtualLines.length;
        return virtualLines;
    }

    private groupBlocks(blocks: readonly HiddenBlock[]): Map<number, string[]> {
        const byLine = new Map<number, string[]>();
        for (const block of blocks) {
            const validPlacement =
                Number.isInteger(block.beforeUserLine) &&
                block.beforeUserLine >= 0 &&
                block.beforeUserLine <= this.userLines.length;
            if (!validPlacement) {
                throw new RangeError(
                    `Hidden block placed before user line ${block.beforeUserLine}, but the text has ${this.userLines.length} lines`
                );
            }
            byLine.set(block.beforeUserLine, [...(byLine.get(block.beforeUserLine) ?? []), ...block.lines]);
        }
        return byLine;
    }

    private userStart(position: LspPosition): ClampedPosition | undefined {
        const userLine = this.virtualToUser[position.line];
        if (userLine !== undefined) {
            return { position: { line: userLine, character: position.character }, clamped: false };
        }
        const next = this.nearestUserLine(position.line, 1);
        return next === undefined ? undefined : { position: { line: next, character: 0 }, clamped: true };
    }

    private userEnd(position: LspPosition): ClampedPosition | undefined {
        const userLine = this.virtualToUser[position.line];
        if (userLine !== undefined) {
            return { position: { line: userLine, character: position.character }, clamped: false };
        }
        const previous = this.nearestUserLine(position.line, -1);
        if (previous === undefined) {
            return undefined;
        }
        return { position: { line: previous, character: this.userLines[previous].length }, clamped: true };
    }

    private nearestUserLine(virtualLine: number, direction: 1 | -1): number | undefined {
        // A line past either end of the text (a server may report one) searches from the nearest real line.
        const firstLine =
            direction === 1
                ? Math.max(virtualLine, -1) + 1
                : Math.min(virtualLine, this.virtualToUser.length) - 1;
        for (let line = firstLine; line >= 0 && line < this.virtualToUser.length; line += direction) {
            const userLine = this.virtualToUser[line];
            if (userLine !== undefined) {
                return userLine;
            }
        }
        return undefined;
    }
}

interface ClampedPosition {
    readonly position: LspPosition;
    readonly clamped: boolean;
}

function comparePositions(first: LspPosition, second: LspPosition): number {
    return first.line !== second.line ? first.line - second.line : first.character - second.character;
}

function assertSingleLine(line: string): void {
    if (LINE_BREAK.test(line)) {
        throw new RangeError('A hidden line must not contain a line break');
    }
}
