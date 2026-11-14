import { IWorkflow } from "@continuum/core";
import { IStartWorkflowResponse } from "@continuum/core";
import { API_SERVER_BASE } from "./ApiConfig";
import { encodePathSegment } from "../../common/SafeEncoding";
import { readStartedWorkflowId, startNetworkFailure } from "../../common/StartWorkflowResult";

export default class WorkflowService {

    private readonly apiBaseUrl: string = `${API_SERVER_BASE}/api/v1/workflow`;

    private get headers(): Record<string, string> {
        return {
            'Content-type': 'application/json; charset=UTF-8'
        };
    }

    /**
     * Starts a workflow. Resolves only when the server really started one. Rejects with a `StartWorkflowError` (see
     * common/StartWorkflowResult.ts) carrying a message that is safe to show the user when the server refused it
     * (a 4xx or 5xx), answered without a workflow id, or could not be reached. It used to resolve with whatever the
     * body parsed to, so a failed start looked like a started workflow.
     */
    async activateWorkflow(workflow: IWorkflow): Promise<IStartWorkflowResponse> {
        let response: Response;
        try {
            response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                body: JSON.stringify(workflow),
                headers: this.headers
            });
        } catch (error) {
            throw startNetworkFailure(error);
        }
        return { workflowId: await readStartedWorkflowId(response) };
    }

    async getActiveWorkflows(): Promise<string[]> {
        const response = await fetch(`${this.apiBaseUrl}/active`, {
            headers: this.headers
        });
        return response.json();
    }

    async cancelWorkflow(workflowId: string, reason?: string): Promise<void> {
        const url = new URL(`${this.apiBaseUrl}/${encodePathSegment(workflowId)}/cancel`, window.location.origin);
        if (reason) {
            url.searchParams.append('reason', reason);
        }
        const response = await fetch(url.toString(), {
            method: 'POST',
            headers: this.headers
        });
        if (!response.ok) {
            throw new Error(`Failed to cancel workflow: ${response.status} ${response.statusText}`);
        }
    }

    async terminateWorkflow(workflowId: string, reason?: string): Promise<void> {
        const url = new URL(`${this.apiBaseUrl}/${encodePathSegment(workflowId)}/terminate`, window.location.origin);
        if (reason) {
            url.searchParams.append('reason', reason);
        }
        const response = await fetch(url.toString(), {
            method: 'POST',
            headers: this.headers
        });
        if (!response.ok) {
            throw new Error(`Failed to terminate workflow: ${response.status} ${response.statusText}`);
        }
    }
}