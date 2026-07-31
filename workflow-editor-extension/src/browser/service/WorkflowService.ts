import { IWorkflow } from "@continuum/core";
import { IStartWorkflowResponse } from "@continuum/core";
import { API_SERVER_BASE } from "./ApiConfig";

export default class WorkflowService {

    private readonly apiBaseUrl: string = `${API_SERVER_BASE}/api/v1/workflow`;

    private get headers(): Record<string, string> {
        return {
            'Content-type': 'application/json; charset=UTF-8'
        };
    }

    async activateWorkflow(workflow: IWorkflow): Promise<IStartWorkflowResponse> {
        return new Promise(async (resolve, reject) => {
            try {
                const response = await fetch(this.apiBaseUrl, {
                    method: 'POST',
                    body: JSON.stringify(workflow),
                    headers: this.headers
                });
                const data: IStartWorkflowResponse = await response.json();
                resolve(data);
            } catch (error) {
                reject(error);
            }
        });
    }

    async getActiveWorkflows(): Promise<string[]> {
        const response = await fetch(`${this.apiBaseUrl}/active`, {
            headers: this.headers
        });
        return response.json();
    }

    async cancelWorkflow(workflowId: string, reason?: string): Promise<void> {
        const url = new URL(`${this.apiBaseUrl}/${workflowId}/cancel`, window.location.origin);
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
        const url = new URL(`${this.apiBaseUrl}/${workflowId}/terminate`, window.location.origin);
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