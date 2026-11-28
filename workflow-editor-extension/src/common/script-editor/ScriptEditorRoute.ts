/** The language of the dialog editors that get code intelligence. Everything else stays a plain editor. */
const LANGUAGES_WITH_INTELLIGENCE: ReadonlySet<string> = new Set(['kotlin']);

/** Why a script editor is plain; shown to the user only for `no-workspace` and `untrusted`. */
export type PlainReason = 'no-workspace' | 'untrusted' | 'other-language';

export type ScriptEditorRoute = { readonly kind: 'native' } | { readonly kind: 'plain'; readonly reason: PlainReason };

export interface ScriptEditorRouteInput {
    /** The language the dialog's schema declares for the field, if any. */
    readonly language: string | undefined;
    readonly hasWorkspaceRoot: boolean;
    /** Whether the workspace is trusted; plugins (the Kotlin extension included) do not run in an untrusted one. */
    readonly trusted: boolean;
}

/**
 * The one place that decides between the editor with code intelligence and the plain editor. Intelligence needs a
 * language that has it (what the node reports about its script only adds names to it, see `scriptWrapper`) and an open workspace folder (the
 * language server only analyses files under one) that the user trusts (an untrusted workspace does not run plugins). In every other case the editor is plain and keeps working as before.
 */
export function decideScriptEditorRoute({ language, hasWorkspaceRoot, trusted }: ScriptEditorRouteInput): ScriptEditorRoute {
    if (language === undefined || !LANGUAGES_WITH_INTELLIGENCE.has(language)) {
        return { kind: 'plain', reason: 'other-language' };
    }
    if (!hasWorkspaceRoot) {
        return { kind: 'plain', reason: 'no-workspace' };
    }
    if (!trusted) {
        return { kind: 'plain', reason: 'untrusted' };
    }
    return { kind: 'native' };
}
