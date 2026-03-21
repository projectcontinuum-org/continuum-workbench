import { IWorkflow } from "@continuum/core";
import { IStartWorkflowResponse } from "@continuum/core";

export default class WorkflowService {

    private readonly apiBaseUrl: string = 'http://localhost:8080/api/v1/workflow';

    constructor(private readonly userId: string) {}

    private get headers(): Record<string, string> {
        return {
            'Content-type': 'application/json; charset=UTF-8',
            'x-continuum-user-id': this.userId
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
}