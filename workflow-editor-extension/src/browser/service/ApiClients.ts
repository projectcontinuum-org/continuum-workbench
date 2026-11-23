import axios from 'axios';
import {
    NodeExplorerApi,
    NodeOutputsApi,
    WorkflowRunsApi,
    WorkflowSchedulesApi,
    WorkflowsApi,
} from '../../generated/api-server';
import { CredentialsApi } from '../../generated/credentials-server';
import { HttpReply, toHttpReply } from '../../common/HttpReply';
import { API_SERVER_BASE, CREDENTIALS_MANAGER_BASE } from './ApiConfig';

/**
 * The only place that talks HTTP to the platform: typescript-axios clients generated from the OpenAPI specs of
 * continuum-platform-core (`yarn generate:api`, output in src/generated/). Services call these, never `fetch`.
 *
 * `validateStatus` accepts every status, so a 4xx/5xx does not throw: the caller gets the reply and decides, status
 * first (see {@link reply}). Only a request that got no answer (offline, refused, blocked by CORS) rejects.
 */
const http = axios.create({ validateStatus: () => true });

export const workflowsApi = new WorkflowsApi(undefined, API_SERVER_BASE, http);
export const workflowRunsApi = new WorkflowRunsApi(undefined, API_SERVER_BASE, http);
export const workflowSchedulesApi = new WorkflowSchedulesApi(undefined, API_SERVER_BASE, http);
export const nodeExplorerApi = new NodeExplorerApi(undefined, API_SERVER_BASE, http);
export const nodeOutputsApi = new NodeOutputsApi(undefined, API_SERVER_BASE, http);
export const credentialsApi = new CredentialsApi(undefined, CREDENTIALS_MANAGER_BASE, http);

/** Wraps what a generated client call resolved to as an {@link HttpReply}. `data` is a model only when `ok`. */
export async function reply<T>(call: Promise<{ status: number; statusText: string; data: T }>): Promise<HttpReply<T>> {
    return toHttpReply<T>(await call);
}

/** Throws `Failed to <action>: <status> <statusText>` unless the reply is a 2xx. */
export function requireOk(response: HttpReply, action: string): void {
    if (!response.ok) {
        throw new Error(`Failed to ${action}: ${response.status} ${response.statusText}`);
    }
}
