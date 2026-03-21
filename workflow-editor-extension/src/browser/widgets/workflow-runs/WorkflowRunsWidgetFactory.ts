import { MaybePromise } from "@theia/core";
import { Widget, WidgetFactory } from "@theia/core/lib/browser";
import { inject, injectable } from "@theia/core/shared/inversify";
import WorkflowRunsWidget from "./WorkflowRunsWidget";

@injectable()
export default class WorkflowRunsWidgetFactory implements WidgetFactory {

    id: string = WorkflowRunsWidget.ID;

    constructor(
        @inject(WorkflowRunsWidget)
        protected readonly workflowRunsWidget: WorkflowRunsWidget
    ) {}

    createWidget(): MaybePromise<Widget> {
        return this.workflowRunsWidget;
    }
}
