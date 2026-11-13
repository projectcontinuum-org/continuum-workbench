import { ITreeItem, IExecution } from "@continuum/core";
import { API_SERVER_BASE } from "./ApiConfig";
import { buildApiUrl } from "../../common/SafeEncoding";

export default class WorkflowTreeService {

    private readonly apiBaseUrl: string = `${API_SERVER_BASE}/api/v1/workflow`;

    async getWorflows(baseDir: string, query: string): Promise<ITreeItem<IExecution>[]> {
        try {
            let response = await fetch(buildApiUrl(this.apiBaseUrl, ["tree"], { baseDir, query: query || undefined }));
            return response.json();
        } catch (error) {
            console.error(error);
            return [];
        }
    }

    async getWorkflowcount(baseDir: string): Promise<{count: number}> {
        try {
            let response = await fetch(buildApiUrl(this.apiBaseUrl, ["count"], { baseDir }));
            return response.json();
        } catch (error) {
            console.error(error);
            return {count: 0};
        }
    }
}