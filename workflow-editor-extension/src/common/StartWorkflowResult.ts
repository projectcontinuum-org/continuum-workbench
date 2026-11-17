// How the api-server answers "start this workflow", as the Run button needs to know it. Pure (no DOM, no Theia), so it
// is unit-tested with plain node (see StartWorkflowResult.spec.ts); WorkflowService.ts is the thin fetch wrapper around
// it. This replaces code that called response.json() and returned whatever came back as a started workflow, so a 400 or
// 500 produced a "started successfully" notification pointing at a workflow id that does not exist.

/** The part of a fetch `Response` this needs, so tests can pass a plain object. */
export interface StartResponseLike {
    status: number;
    ok: boolean;
    statusText: string;
    text(): Promise<string>;
}

/** The api-server rejected or could not start the workflow. `status` is 0 when no answer arrived at all. */
export class StartWorkflowError extends Error {
    constructor(public readonly status: number, message: string) {
        super(message);
        this.name = 'StartWorkflowError';
    }
}

/** A long server message is cut so it fits a notification; a stack trace in a body must not fill the screen. */
export const MAX_START_ERROR_LENGTH = 300;

function truncate(message: string): string {
    return message.length > MAX_START_ERROR_LENGTH ? `${message.slice(0, MAX_START_ERROR_LENGTH)}…` : message;
}

/**
 * The most useful sentence in an error body, or undefined when there is none. The api-server answers in three shapes:
 *   - RFC 7807 problem details (`application/problem+json`): { title, status, detail }  -> `detail`
 *   - Spring's default error:                                  { status, error, message?, path } -> `message`
 *   - the other services' { "error": "..." }                                                   -> `error`
 * Spring's default for a rejected body carries only the status phrase in `error` ("Bad Request"), which says nothing
 * about WHY, so it is used only as a last resort and the caller adds what it knows.
 */
export function messageFromBody(body: string): string | undefined {
    const trimmed = body.trim();
    if (trimmed === '') {
        return undefined;
    }
    // An HTML error page (a proxy, a dev-server fallback) is not a message for a user.
    if (trimmed.startsWith('<')) {
        return undefined;
    }
    try {
        const json = JSON.parse(trimmed);
        if (json && typeof json === 'object') {
            for (const key of ['detail', 'message', 'error']) {
                const v = (json as Record<string, unknown>)[key];
                if (typeof v === 'string' && v.trim() !== '') {
                    return v.trim();
                }
            }
        }
        return undefined;
    } catch {
        // Not JSON: plain text from a gateway is usable as it is.
        return trimmed;
    }
}

/** What to tell the user when the server refused the workflow, for a status and an optional server message. */
export function startFailureMessage(status: number, statusText: string, serverMessage?: string): string {
    const base = serverMessage && serverMessage.toLowerCase() !== statusText.toLowerCase() ? serverMessage : undefined;
    if (status === 0) {
        return serverMessage ?? 'The workflow server could not be reached';
    }
    if (status === 400) {
        return truncate(base ?? 'The server rejected this workflow as invalid. Check the node settings and connections.');
    }
    if (status === 401 || status === 403) {
        return truncate(base ?? 'You are not allowed to run workflows');
    }
    if (status >= 500) {
        return truncate(base ? `The server failed to start the workflow: ${base}` : `The server failed to start the workflow (${status})`);
    }
    return truncate(base ?? `The server answered ${status}${statusText ? ` ${statusText}` : ''}`);
}

/**
 * Reads a start response. Returns the workflow id for a 2xx with a usable body; throws a StartWorkflowError otherwise.
 * The status is checked BEFORE the body is read as a start response.
 */
export async function readStartedWorkflowId(response: StartResponseLike): Promise<string> {
    let body = '';
    try {
        body = await response.text();
    } catch {
        // A body that cannot be read is treated as empty; the status decides.
    }
    if (!response.ok) {
        throw new StartWorkflowError(response.status, startFailureMessage(response.status, response.statusText, messageFromBody(body)));
    }
    try {
        const json = JSON.parse(body);
        const id = json && typeof json === 'object' ? (json as Record<string, unknown>).workflowId : undefined;
        if (typeof id === 'string' && id !== '') {
            return id;
        }
    } catch {
        // fall through to the error below
    }
    // The server said OK but sent no workflow id. Treating that as a start is exactly the bug this guards against.
    throw new StartWorkflowError(response.status, 'The server accepted the request but did not return a workflow id');
}

/** A request that never got an answer (offline, refused, blocked by CORS...). */
export function startNetworkFailure(e: unknown): StartWorkflowError {
    const detail = e instanceof Error ? e.message : String(e);
    return new StartWorkflowError(0, `The workflow server could not be reached (${detail})`);
}
