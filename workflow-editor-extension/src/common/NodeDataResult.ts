// How a node-output request ended, as the table view needs to know it. Pure (no DOM, no Theia), so it is unit-tested
// with plain node (see NodeDataResult.spec.ts); DataService.ts is the thin fetch wrapper around it.

/** The ways reading one page of a node output can end. A failure is a value, never an exception. */
export type NodeDataResult<P> =
    | { kind: 'page'; page: P }
    /**
     * HTTP 404. The api-server answers 404 for a run the caller does not own, for a run too old to have its run id
     * stored, and for a run that does not exist. The three are deliberately indistinguishable (so a tenant cannot
     * probe for other tenants' ids), so the UI says one thing for all of them.
     */
    | { kind: 'not-found' }
    | { kind: 'error'; message: string };

/** The part of a fetch `Response` this needs, so tests can pass a plain object. */
export interface ResponseLike {
    status: number;
    ok: boolean;
    statusText: string;
    json(): Promise<unknown>;
}

/**
 * Classifies a response BEFORE reading its body. A 404 body is a problem-detail object, not a page: reading
 * `data.data.length` from it used to throw inside a promise callback, which left the table blank with the spinner on.
 */
export async function toNodeDataResult<P>(response: ResponseLike): Promise<NodeDataResult<P>> {
    if (response.status === 404) {
        return { kind: 'not-found' };
    }
    if (!response.ok) {
        return { kind: 'error', message: `The server answered ${response.status} ${response.statusText}`.trim() };
    }
    try {
        return { kind: 'page', page: (await response.json()) as P };
    } catch {
        return { kind: 'error', message: 'The server sent a response that is not valid JSON' };
    }
}

/** A request that never got an answer (offline, refused, blocked by CORS...). */
export function networkFailure(e: unknown): NodeDataResult<never> {
    return { kind: 'error', message: e instanceof Error ? e.message : String(e) };
}
