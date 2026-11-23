// What the generated axios clients answered, in the shape the response helpers (StartWorkflowResult, NodeDataResult,
// CredentialsService) already read: status first, body second. Pure (no axios, no DOM), so it is unit-tested with plain
// node (see HttpReply.spec.ts); `settle` in browser/service/ApiClients.ts is the thin axios wrapper around it.

/** The part of an axios response (or of `AxiosError.response`) this needs. */
export interface AxiosReplyLike {
    status: number;
    statusText: string;
    data: unknown;
}

/**
 * An answer from the server. `data` is the parsed body: the model the client declares when `ok`, and whatever the
 * server sent (a problem-detail object, an HTML page, a string) when not. Check `ok` before reading `data` as a model.
 */
export interface HttpReply<T = unknown> {
    status: number;
    statusText: string;
    ok: boolean;
    data: T;
    /** The body as text; an already-parsed body is serialized again. Never throws. */
    text(): Promise<string>;
    /** The body as JSON. Rejects when the body is a string that is not JSON. */
    json(): Promise<unknown>;
}

export function toHttpReply<T = unknown>(reply: AxiosReplyLike): HttpReply<T> {
    const { status, statusText, data } = reply;
    return {
        status,
        statusText,
        ok: status >= 200 && status < 300,
        data: data as T,
        async text() {
            if (typeof data === 'string') {
                return data;
            }
            if (data === undefined || data === null) {
                return '';
            }
            try {
                return JSON.stringify(data);
            } catch {
                return '';
            }
        },
        async json() {
            return typeof data === 'string' ? JSON.parse(data) : data;
        },
    };
}
