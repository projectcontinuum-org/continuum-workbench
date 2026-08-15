import IWorkflow from "./IWorkflow.js";

export interface ICreateWorkflowScheduleRequest {
    name: string;
    cronExpression: string;
    timeZone?: string;
    continuumWorkflowModel: IWorkflow;
}
