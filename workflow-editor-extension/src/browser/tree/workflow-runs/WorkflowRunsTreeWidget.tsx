import * as React from 'react';
import { TreeWidget, TreeProps, TreeNode, NodeProps, TreeModel } from '@theia/core/lib/browser/tree';
import { ContextMenuRenderer } from '@theia/core/lib/browser';
import { injectable, inject, postConstruct } from '@theia/core/shared/inversify';
import { ExpandableTreeNode } from '@theia/core/lib/browser/tree/tree-expansion';
import { WorkflowNode, WorkflowRunNode, LoadMoreNode, FolderNode } from './WorkflowRunsTree';
import { Emitter, Event } from '@theia/core/lib/common';

export const WORKFLOW_RUNS_CONTEXT_MENU: string[] = ['workflow-runs-context-menu'];

/** Status to codicon mapping */
const STATUS_ICON_MAP: Record<string, { icon: string; color: string }> = {
    'PENDING': { icon: 'codicon codicon-clock', color: 'var(--theia-editorWarning-foreground)' },
    'RUNNING': { icon: 'codicon codicon-sync codicon-modifier-spin', color: 'var(--theia-progressBar-background)' },
    'FINISHED': { icon: 'codicon codicon-pass-filled', color: 'var(--theia-testing-iconPassed, #2ea043)' },
    'FAILED': { icon: 'codicon codicon-error', color: 'var(--theia-testing-iconFailed)' },
    'TIMED_OUT': { icon: 'codicon codicon-watch', color: 'var(--theia-editorWarning-foreground)' },
    'CANCELED': { icon: 'codicon codicon-circle-slash', color: 'var(--theia-descriptionForeground)' },
    'TERMINATED': { icon: 'codicon codicon-stop', color: 'var(--theia-testing-iconFailed)' }
};

@injectable()
export class WorkflowRunsTreeWidget extends TreeWidget {

    static readonly ID = 'workflow-runs-tree-widget';
    static readonly LABEL = 'Workflow Runs';

    protected readonly onLoadMoreClickEmitter = new Emitter<LoadMoreNode>();
    readonly onLoadMoreClick: Event<LoadMoreNode> = this.onLoadMoreClickEmitter.event;

    protected readonly onRunDoubleClickEmitter = new Emitter<WorkflowRunNode>();
    readonly onRunDoubleClick: Event<WorkflowRunNode> = this.onRunDoubleClickEmitter.event;

    constructor(
        @inject(TreeProps) props: TreeProps,
        @inject(TreeModel) override readonly model: TreeModel,
        @inject(ContextMenuRenderer) contextMenuRenderer: ContextMenuRenderer
    ) {
        super(props, model, contextMenuRenderer);
    }

    @postConstruct()
    protected override init(): void {
        super.init();
        this.id = WorkflowRunsTreeWidget.ID;
        this.title.label = WorkflowRunsTreeWidget.LABEL;
        this.title.caption = WorkflowRunsTreeWidget.LABEL;
        this.title.iconClass = 'codicon codicon-run-all';
        this.title.closable = false;
        this.addClass('workflow-runs-tree');
    }

    protected override createContainerAttributes(): React.HTMLAttributes<HTMLElement> {
        const attrs = super.createContainerAttributes();
        return {
            ...attrs,
            style: {
                ...attrs.style as React.CSSProperties,
                fontSize: '14px',
                lineHeight: '32px'
            }
        };
    }

    protected override createNodeAttributes(node: TreeNode, props: NodeProps): React.Attributes & React.HTMLAttributes<HTMLElement> {
        const attributes = super.createNodeAttributes(node, props);
        const baseStyle: React.CSSProperties = {
            minHeight: '32px',
            lineHeight: '32px'
        };

        if (LoadMoreNode.is(node)) {
            return {
                ...attributes,
                style: {
                    ...attributes.style as React.CSSProperties,
                    ...baseStyle,
                    cursor: 'pointer',
                    fontStyle: 'italic',
                    opacity: 0.8
                },
                onClick: (e: React.MouseEvent) => {
                    e.stopPropagation();
                    this.onLoadMoreClickEmitter.fire(node);
                }
            };
        }

        return {
            ...attributes,
            style: { ...attributes.style as React.CSSProperties, ...baseStyle }
        };
    }

    protected override renderIcon(node: TreeNode, props: NodeProps): React.ReactNode {
        if (WorkflowRunNode.is(node)) {
            const status = node.runData.status?.toUpperCase() || 'PENDING';
            const mapping = STATUS_ICON_MAP[status] || STATUS_ICON_MAP['PENDING'];
            return (
                <span
                    className={`theia-tree-icon ${mapping.icon}`}
                    style={{ marginRight: '8px', fontSize: '16px', color: mapping.color }}
                ></span>
            );
        }

        if (FolderNode.is(node)) {
            const iconClass = node.expanded ? 'codicon codicon-folder-opened' : 'codicon codicon-folder';
            return (
                <span
                    className={`theia-tree-icon ${iconClass}`}
                    style={{ marginRight: '8px', fontSize: '16px' }}
                ></span>
            );
        }

        if (WorkflowNode.is(node)) {
            return (
                <span
                    className="theia-tree-icon fa fa-solid fa-diagram-project"
                    style={{ marginRight: '8px', fontSize: '14px' }}
                ></span>
            );
        }

        if (LoadMoreNode.is(node)) {
            return (
                <span
                    className="theia-tree-icon codicon codicon-ellipsis"
                    style={{ marginRight: '8px', fontSize: '16px' }}
                ></span>
            );
        }

        return super.renderIcon(node, props);
    }

    protected override getCaptionChildren(node: TreeNode, props: NodeProps): React.ReactNode {
        if (FolderNode.is(node)) {
            return node.name;
        }
        if (WorkflowNode.is(node)) {
            return node.name;
        }
        if (WorkflowRunNode.is(node)) {
            return node.name;
        }
        if (LoadMoreNode.is(node)) {
            return <span style={{ fontStyle: 'italic' }}>Load more...</span>;
        }
        return super.getCaptionChildren(node, props);
    }

    protected override renderExpansionToggle(node: TreeNode, props: NodeProps): React.ReactNode {
        if (ExpandableTreeNode.is(node) && (node as any).loading) {
            return (
                <div className="theia-tree-node-toggle codicon codicon-loading codicon-modifier-spin" />
            );
        }
        return super.renderExpansionToggle(node, props);
    }

    protected override handleDblClickEvent(node: TreeNode | undefined, event: React.MouseEvent<HTMLElement>): void {
        super.handleDblClickEvent(node, event);
        if (WorkflowRunNode.is(node)) {
            this.onRunDoubleClickEmitter.fire(node);
        }
    }

    dispose(): void {
        this.onLoadMoreClickEmitter.dispose();
        this.onRunDoubleClickEmitter.dispose();
        super.dispose();
    }
}
