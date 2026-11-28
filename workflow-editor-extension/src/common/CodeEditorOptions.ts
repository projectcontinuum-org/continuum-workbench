import { dialogEditorLanguage } from './DialogEditorLanguage';

/** What a `format: "code"` control's UI schema options say about its editor, with the defaults applied. */
export interface CodeEditorOptions {
    readonly format: string;
    /** The language the schema declares, as written (`undefined` when it declares none). */
    readonly declaredLanguage: string | undefined;
    /** The Monaco language id the plain editor uses for it. */
    readonly monacoLanguage: string;
    /** The most lines the editor grows to. */
    readonly rows: number;
    /** The names the node reported for its script, unvalidated. */
    readonly scriptContext: unknown;
}

export const DEFAULT_CODE_EDITOR_ROWS = 15;

/** Reads the options of a code control's UI schema; a missing or malformed UI schema gives the defaults. */
export function resolveCodeEditorOptions(uischema: { options?: Record<string, unknown> } | undefined): CodeEditorOptions {
    const options = uischema?.options ?? {};
    const declaredLanguage = typeof options.language === 'string' && options.language !== '' ? options.language : undefined;
    const rows = typeof options.rows === 'number' && Number.isFinite(options.rows) && options.rows >= 1 ? Math.floor(options.rows) : DEFAULT_CODE_EDITOR_ROWS;
    return {
        format: typeof options.format === 'string' ? options.format : 'code',
        declaredLanguage,
        monacoLanguage: dialogEditorLanguage(declaredLanguage),
        rows,
        scriptContext: options.scriptContext
    };
}
