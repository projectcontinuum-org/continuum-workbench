/**
 * The Monaco language id a node dialog's code editor uses for the language its schema declares.
 *
 * A dialog editor must not be typed with a file language's own id when that would make other editor extensions react
 * to it (the Kotlin file extension starts its own language server, and a second JVM, as soon as a `kotlin` model
 * exists). Such languages get a dedicated dialog id, registered by the workbench with the same tokenizer and
 * configuration. Ids that Monaco knows under another spelling are mapped to it. An editor that declares no language
 * is plain text; it is never given a language by accident.
 */
const DIALOG_LANGUAGE_IDS: Readonly<Record<string, string>> = {
    kotlin: 'continuum-kotlin-script',
    freemarker: 'freemarker2'
};

export const PLAIN_TEXT_LANGUAGE_ID = 'plaintext';

export function dialogEditorLanguage(declaredLanguage: string | undefined): string {
    if (!declaredLanguage) {
        return PLAIN_TEXT_LANGUAGE_ID;
    }
    return DIALOG_LANGUAGE_IDS[declaredLanguage] ?? declaredLanguage;
}
