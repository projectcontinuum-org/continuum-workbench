import { inject, injectable } from "@theia/core/shared/inversify";
import { CommandContribution, CommandRegistry, MessageService, URI } from "@theia/core";
import { OpenerService, ApplicationShell } from "@theia/core/lib/browser";
import { WorkspaceService } from "@theia/workspace/lib/browser";
import { CompositeTreeNode } from "@theia/core/lib/browser/tree";
import { WorkflowNode, WorkflowRunNode, ScheduleNode, splitScheduleUri } from "../tree/workflow-runs/WorkflowRunsTree";
import { WorkflowRunsTreeWidget } from "../tree/workflow-runs/WorkflowRunsTreeWidget";
import WorkflowRunsWidget from "../widgets/workflow-runs/WorkflowRunsWidget";
import { WorkflowRunsCommands } from "../command/WorkflowRunsCommands";
import WorkflowScheduleService from "../service/WorkflowScheduleService";
import WorkflowService from "../service/WorkflowService";
import WorkflowEditorWidget, { WorkflowEditorWidgetOptions } from "../widgets/workflow-editor/WorkflowEditorWidget";

/** Run statuses that count as "active" and can be cancelled. */
const ACTIVE_RUN_STATUSES = new Set(['RUNNING', 'PENDING', 'CANCELLING']);

@injectable()
export class WorkflowRunsCommandContribution implements CommandContribution {

    constructor(
        @inject(WorkflowRunsTreeWidget) protected readonly treeWidget: WorkflowRunsTreeWidget,
        @inject(WorkflowRunsWidget) protected readonly runsWidget: WorkflowRunsWidget,
        @inject(OpenerService) protected readonly openerService: OpenerService,
        @inject(WorkspaceService) protected readonly workspaceService: WorkspaceService,
        @inject(WorkflowScheduleService) protected readonly scheduleService: WorkflowScheduleService,
        @inject(WorkflowService) protected readonly workflowService: WorkflowService,
        @inject(MessageService) protected readonly messageService: MessageService,
        @inject(ApplicationShell) protected readonly shell: ApplicationShell
    ) {}

    registerCommands(registry: CommandRegistry): void {
        const nodeSelected = () => this.getSelectedWorkflowNode() !== undefined;

        registry.registerCommand(WorkflowRunsCommands.OPEN_IN_EDITOR, {
            execute: () => this.openInEditor(),
            isEnabled: nodeSelected,
            isVisible: nodeSelected
        });

        registry.registerCommand(WorkflowRunsCommands.RUN_WORKFLOW, {
            execute: () => this.openEditorWithAction({ type: 'run' }),
            isEnabled: nodeSelected,
            isVisible: nodeSelected
        });

        registry.registerCommand(WorkflowRunsCommands.SCHEDULE_WORKFLOW, {
            execute: () => this.openEditorWithAction({ type: 'schedule', tab: 0 }),
            isEnabled: nodeSelected,
            isVisible: nodeSelected
        });

        registry.registerCommand(WorkflowRunsCommands.MANAGE_SCHEDULES, {
            execute: () => this.openEditorWithAction({ type: 'schedule', tab: 1 }),
            isEnabled: nodeSelected,
            isVisible: nodeSelected
        });

        registry.registerCommand(WorkflowRunsCommands.PAUSE_ALL_SCHEDULES, {
            execute: () => this.toggleAllSchedules(true),
            isEnabled: () => this.hasSchedulesForSelected(),
            isVisible: () => this.hasSchedulesForSelected()
        });

        registry.registerCommand(WorkflowRunsCommands.RESUME_ALL_SCHEDULES, {
            execute: () => this.toggleAllSchedules(false),
            isEnabled: () => this.hasSchedulesForSelected(),
            isVisible: () => this.hasSchedulesForSelected()
        });

        registry.registerCommand(WorkflowRunsCommands.CANCEL_ACTIVE_RUNS, {
            execute: () => this.cancelActiveRuns(),
            isEnabled: () => this.hasActiveRuns(),
            isVisible: () => this.hasActiveRuns()
        });

        registry.registerCommand(WorkflowRunsCommands.REFRESH_RUNS, {
            execute: () => this.runsWidget.refresh(),
            isEnabled: nodeSelected,
            isVisible: nodeSelected
        });

        registry.registerCommand(WorkflowRunsCommands.COPY_WORKFLOW_PATH, {
            execute: () => this.copyWorkflowPath(),
            isEnabled: nodeSelected,
            isVisible: nodeSelected
        });
    }

    protected getSelectedWorkflowNode(): WorkflowNode | undefined {
        const nodes = this.treeWidget.model.selectedNodes;
        return nodes.find(WorkflowNode.is);
    }

    /**
     * Build a workspace-scheme URI for a run-tree `workflowUri`, which is stored as a scheme-less
     * path (the workflow's `name` = `this._uri.path.toString()`). `new URI(path)` would parse the
     * first segment as the scheme, so we prepend the workspace root's scheme (or `file`).
     */
    protected async toFileUri(workflowUri: string): Promise<URI> {
        const roots = await this.workspaceService.roots;
        const scheme = roots[0]?.resource.scheme ?? 'file';
        return new URI(workflowUri).withScheme(scheme);
    }

    protected async openInEditor(): Promise<void> {
        const node = this.getSelectedWorkflowNode();
        if (!node) return;
        const uri = await this.toFileUri(node.workflowUri);
        const opener = await this.openerService.getOpener(uri);
        await opener.open(uri);
    }

    /**
     * Open the editor for the selected workflow, chaining a one-shot action (schedule/run) onto
     * the open. For a fresh open the editor applies `pendingAction` after the file loads; for an
     * already-open editor the opener returns the existing widget, so we also call the method
     * directly (the editor ref is ready in that case).
     */
    protected async openEditorWithAction(
        action: WorkflowEditorWidgetOptions['pendingAction']
    ): Promise<void> {
        const node = this.getSelectedWorkflowNode();
        if (!node || !action) return;
        const uri = await this.toFileUri(node.workflowUri);
        const opener = await this.openerService.getOpener(uri);
        const widget = await opener.open(uri, { pendingAction: action }) as WorkflowEditorWidget;
        // For an already-open editor the pendingAction option is ignored by the factory; trigger
        // directly. The editor ref is ready because the workflow loaded earlier. (No-op if not.)
        if (widget) {
            if (action.type === 'schedule') {
                action.tab === 1 ? widget.openManageSchedulesDialog() : widget.openScheduleDialog();
            } else if (action.type === 'run') {
                widget.runWorkflow();
            }
        }
    }

    /** Pause (pause=true) or resume (pause=false) every schedule belonging to the selected workflow. */
    protected async toggleAllSchedules(pause: boolean): Promise<void> {
        const node = this.getSelectedWorkflowNode();
        if (!node) return;
        const base = node.workflowUri;
        try {
            const all = await this.scheduleService.listSchedules();
            // A schedule belongs to this workflow when its stored name's base matches the
            // workflow URI (scheduled schedules are stored as `{base}/{name}.schedule`; older
            // schedules may be stored as just the base).
            const mine = all.filter(s => {
                const { base: scheduleBase } = splitScheduleUri(s.name);
                return scheduleBase === base;
            });
            let count = 0;
            for (const s of mine) {
                if (pause && !s.paused) {
                    await this.scheduleService.pauseSchedule(s.scheduleId);
                    count++;
                } else if (!pause && s.paused) {
                    await this.scheduleService.unpauseSchedule(s.scheduleId);
                    count++;
                }
            }
            this.messageService.info(
                pause
                    ? `Paused ${count} schedule${count === 1 ? '' : 's'}.`
                    : `Resumed ${count} schedule${count === 1 ? '' : 's'}.`
            );
            this.runsWidget.refresh();
        } catch (error) {
            console.error('Failed to toggle schedules', error);
            this.messageService.error('Failed to update schedules. Please try again.');
        }
    }

    protected hasSchedulesForSelected(): boolean {
        // Enabled whenever a workflow node is selected; the execute path no-ops if there are none.
        return this.getSelectedWorkflowNode() !== undefined;
    }

    /** Cancel every active run under the selected workflow node. */
    protected async cancelActiveRuns(): Promise<void> {
        const node = this.getSelectedWorkflowNode();
        if (!node) return;
        const active = this.collectRunNodes(node).filter(r =>
            ACTIVE_RUN_STATUSES.has((r.runData.status || '').toUpperCase())
        );
        if (active.length === 0) return;
        let count = 0;
        for (const run of active) {
            try {
                await this.workflowService.cancelWorkflow(run.runData.workflowId);
                count++;
            } catch (error) {
                console.error('Failed to cancel run', run.runData.workflowId, error);
            }
        }
        this.messageService.info(`Cancelled ${count} run${count === 1 ? '' : 's'}.`);
        this.runsWidget.refresh();
    }

    protected hasActiveRuns(): boolean {
        const node = this.getSelectedWorkflowNode();
        if (!node) return false;
        // The workflow node's schedule/run children are populated only after it has been expanded.
        return this.collectRunNodes(node).some(r =>
            ACTIVE_RUN_STATUSES.has((r.runData.status || '').toUpperCase())
        );
    }

    /** Walk a workflow node's schedule children and collect every run node beneath them. */
    protected collectRunNodes(node: WorkflowNode): WorkflowRunNode[] {
        if (!CompositeTreeNode.is(node)) return [];
        const runs: WorkflowRunNode[] = [];
        for (const schedule of node.children) {
            if (ScheduleNode.is(schedule) && CompositeTreeNode.is(schedule)) {
                for (const run of schedule.children) {
                    if (WorkflowRunNode.is(run)) {
                        runs.push(run);
                    }
                }
            }
        }
        return runs;
    }

    protected async copyWorkflowPath(): Promise<void> {
        const node = this.getSelectedWorkflowNode();
        if (!node) return;
        try {
            await navigator.clipboard.writeText(node.workflowUri);
            this.messageService.info('Copied workflow path');
        } catch {
            this.messageService.error('Failed to copy workflow path');
        }
    }
}
