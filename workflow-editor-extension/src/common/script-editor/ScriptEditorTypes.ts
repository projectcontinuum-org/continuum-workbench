/**
 * The few position and plan shapes the script editor's pure logic needs. They are structurally identical to the
 * Language Server Protocol ones (zero-based line, UTF-16 character offset) so values pass between the two unchanged,
 * but this code depends on no protocol library.
 */

export interface LspPosition {
    /** Zero-based line. */
    readonly line: number;
    /** Zero-based UTF-16 code-unit offset within the line. */
    readonly character: number;
}

export interface LspRange {
    readonly start: LspPosition;
    /** Exclusive end. */
    readonly end: LspPosition;
}

/** LSP `DiagnosticSeverity`: 1 error, 2 warning, 3 information, 4 hint. */
export type LspSeverity = 1 | 2 | 3 | 4;

export interface LspDiagnostic {
    readonly range: LspRange;
    readonly severity?: LspSeverity;
    readonly code?: string | number;
    readonly source?: string;
    readonly message: string;
}

/** Whole lines that the editor hides from the user but the server reads. */
export interface HiddenBlock {
    /** The block sits in front of this zero-based line of the user's text; the line count places it after the last line. */
    readonly beforeUserLine: number;
    readonly lines: readonly string[];
}

/** Where the hidden text goes. The user's own lines keep their order and their content, character for character. */
export interface VirtualDocumentPlan {
    readonly hiddenBlocks: readonly HiddenBlock[];
    /** Hidden lines after the last user line. */
    readonly trailingLines: readonly string[];
    /**
     * Errors reported on the trailing hidden lines belong to the end of the user's text, so with this set they are
     * shown on the last user line instead of being dropped. Only error severity, and only for the trailing lines.
     */
    readonly showTrailingErrorsOnLastUserLine?: boolean;
}

/** A closed range of whole file lines, one-based like the editor's line numbers. */
export interface LineRange {
    readonly startLine: number;
    readonly endLine: number;
}
