export interface IWorkflowSchedule {
    scheduleId: string;
    name: string;
    ownedBy: string;
    cronExpression: string;
    timeZone?: string;
    paused: boolean;
    nextRunTimes: string[];
    createdAt: string;
    updatedAt: string;
}
