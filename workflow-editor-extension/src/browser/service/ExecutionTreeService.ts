import { ITreeItem, IExecution } from "@continuum/core";
import { API_SERVER_BASE } from "./ApiConfig";

export default class ExecutionTreeService {

    private readonly apiBaseUrl: string = `${API_SERVER_BASE}/api/v1/execution-tree`;

    async getPendingExecutions(baseDir: string, workflowId?: string): Promise<ITreeItem<IExecution>[]> {
        try {
            let response = await fetch(`${this.apiBaseUrl}/pending?baseDir=${baseDir}${workflowId ? `&workflowId=${workflowId}` : ""}`);
            return response.json();
        } catch (error) {
            console.error(error);
            return [];
        }
    }

    async getRunningExecutions(baseDir: string, workflowId?: string): Promise<ITreeItem<IExecution>[]> {
        try {
            let response = await fetch(`${this.apiBaseUrl}/running?baseDir=${baseDir}${workflowId ? `&workflowId=${workflowId}` : ""}`);
            return response.json();
        } catch (error) {
            console.error(error);
            return [];
        }
    }

    async getFinishedExecutions(baseDir: string, workflowId?: string): Promise<ITreeItem<IExecution>[]> {
        try {
            let response = await fetch(`${this.apiBaseUrl}/finished?baseDir=${baseDir}${workflowId ? `&workflowId=${workflowId}` : ""}`);
            return response.json();
        } catch (error) {
            console.error(error);
            return [];
        }
    }
}