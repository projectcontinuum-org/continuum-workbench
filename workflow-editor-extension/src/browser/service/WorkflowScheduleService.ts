import { ICreateWorkflowScheduleRequest, IWorkflowSchedule } from "@continuum/core";
import { injectable } from "@theia/core/shared/inversify";
import type { WorkflowSchedule } from "../../generated/api-server";
import { requirePathSegment } from "../../common/SafeEncoding";
import { reply, requireOk, workflowSchedulesApi } from "./ApiClients";

/** The workbench shows only the schedule's own fields; the spec's `timeZone` is null for UTC, the workbench's is unset. */
function toSchedule(schedule: WorkflowSchedule): IWorkflowSchedule {
    return {
        scheduleId: schedule.scheduleId,
        name: schedule.name,
        ownedBy: schedule.ownedBy,
        cronExpression: schedule.cronExpression,
        timeZone: schedule.timeZone ?? undefined,
        paused: schedule.paused,
        nextRunTimes: schedule.nextRunTimes,
        createdAt: schedule.createdAt,
        updatedAt: schedule.updatedAt,
    };
}

@injectable()
export default class WorkflowScheduleService {

    async createSchedule(request: ICreateWorkflowScheduleRequest): Promise<IWorkflowSchedule> {
        const response = await reply(workflowSchedulesApi.createWorkflowSchedule({
            createWorkflowScheduleRequest: {
                name: request.name,
                cronExpression: request.cronExpression,
                timeZone: request.timeZone,
                // The editor's reactflow nodes are the wire shape of the spec's WorkflowNode; the server validates it.
                continuumWorkflowModel: request.continuumWorkflowModel as unknown as WorkflowSchedule['continuumWorkflowModel'],
            },
        }));
        requireOk(response, 'create schedule');
        return toSchedule(response.data);
    }

    async listSchedules(name?: string): Promise<IWorkflowSchedule[]> {
        const response = await reply(workflowSchedulesApi.listWorkflowSchedules({ name: name || undefined }));
        requireOk(response, 'list schedules');
        return response.data.map(toSchedule);
    }

    async pauseSchedule(scheduleId: string, note?: string): Promise<void> {
        const response = await reply(workflowSchedulesApi.pauseWorkflowSchedule({
            scheduleId: requirePathSegment(scheduleId),
            note: note || undefined,
        }));
        requireOk(response, 'pause schedule');
    }

    async unpauseSchedule(scheduleId: string, note?: string): Promise<void> {
        const response = await reply(workflowSchedulesApi.unpauseWorkflowSchedule({
            scheduleId: requirePathSegment(scheduleId),
            note: note || undefined,
        }));
        requireOk(response, 'unpause schedule');
    }

    async triggerSchedule(scheduleId: string): Promise<void> {
        const response = await reply(workflowSchedulesApi.triggerWorkflowSchedule({ scheduleId: requirePathSegment(scheduleId) }));
        requireOk(response, 'trigger schedule');
    }

    async deleteSchedule(scheduleId: string): Promise<void> {
        const response = await reply(workflowSchedulesApi.deleteWorkflowSchedule({ scheduleId: requirePathSegment(scheduleId) }));
        requireOk(response, 'delete schedule');
    }
}
