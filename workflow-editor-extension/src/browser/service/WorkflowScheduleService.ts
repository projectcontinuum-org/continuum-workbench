import { ICreateWorkflowScheduleRequest, IWorkflowSchedule } from "@continuum/core";
import { API_SERVER_BASE } from "./ApiConfig";

export default class WorkflowScheduleService {

    private readonly apiBaseUrl: string = `${API_SERVER_BASE}/api/v1/workflow/schedule`;

    private get headers(): Record<string, string> {
        return {
            'Content-type': 'application/json; charset=UTF-8'
        };
    }

    async createSchedule(request: ICreateWorkflowScheduleRequest): Promise<IWorkflowSchedule> {
        const response = await fetch(this.apiBaseUrl, {
            method: 'POST',
            body: JSON.stringify(request),
            headers: this.headers
        });
        if (!response.ok) {
            throw new Error(`Failed to create schedule: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }

    async listSchedules(name?: string): Promise<IWorkflowSchedule[]> {
        const url = new URL(this.apiBaseUrl, window.location.origin);
        if (name) {
            url.searchParams.append('name', name);
        }
        const response = await fetch(url.toString(), {
            headers: this.headers
        });
        if (!response.ok) {
            throw new Error(`Failed to list schedules: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }

    async pauseSchedule(scheduleId: string, note?: string): Promise<void> {
        const url = new URL(`${this.apiBaseUrl}/${scheduleId}/pause`, window.location.origin);
        if (note) {
            url.searchParams.append('note', note);
        }
        const response = await fetch(url.toString(), {
            method: 'POST',
            headers: this.headers
        });
        if (!response.ok) {
            throw new Error(`Failed to pause schedule: ${response.status} ${response.statusText}`);
        }
    }

    async unpauseSchedule(scheduleId: string, note?: string): Promise<void> {
        const url = new URL(`${this.apiBaseUrl}/${scheduleId}/unpause`, window.location.origin);
        if (note) {
            url.searchParams.append('note', note);
        }
        const response = await fetch(url.toString(), {
            method: 'POST',
            headers: this.headers
        });
        if (!response.ok) {
            throw new Error(`Failed to unpause schedule: ${response.status} ${response.statusText}`);
        }
    }

    async triggerSchedule(scheduleId: string): Promise<void> {
        const response = await fetch(`${this.apiBaseUrl}/${scheduleId}/trigger`, {
            method: 'POST',
            headers: this.headers
        });
        if (!response.ok) {
            throw new Error(`Failed to trigger schedule: ${response.status} ${response.statusText}`);
        }
    }

    async deleteSchedule(scheduleId: string): Promise<void> {
        const response = await fetch(`${this.apiBaseUrl}/${scheduleId}`, {
            method: 'DELETE',
            headers: this.headers
        });
        if (!response.ok) {
            throw new Error(`Failed to delete schedule: ${response.status} ${response.statusText}`);
        }
    }
}
