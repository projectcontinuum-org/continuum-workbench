import { Container, interfaces } from '@theia/core/shared/inversify';
import { createTreeContainer, TreeProps, defaultTreeProps, TreeModel } from '@theia/core/lib/browser/tree';
import { WorkflowRunsTree } from './WorkflowRunsTree';
import { WorkflowRunsTreeModel, WorkflowRunsTreeModelImpl } from './WorkflowRunsTreeModel';
import { WorkflowRunsTreeWidget, WORKFLOW_RUNS_CONTEXT_MENU } from './WorkflowRunsTreeWidget';
import WorkflowRunsService from '../../service/WorkflowRunsService';

export function createWorkflowRunsTreeContainer(parent: interfaces.Container): Container {
    const intermediate = new Container({ defaultScope: 'Singleton' });
    intermediate.parent = parent;

    if (!intermediate.isBound(WorkflowRunsService)) {
        intermediate.bind(WorkflowRunsService).toSelf().inSingletonScope();
    }

    const child = createTreeContainer(intermediate, {
        tree: WorkflowRunsTree,
        model: WorkflowRunsTreeModelImpl,
        widget: WorkflowRunsTreeWidget,
        props: {
            ...defaultTreeProps,
            contextMenuPath: WORKFLOW_RUNS_CONTEXT_MENU,
            virtualized: true,
            search: false,
            multiSelect: false,
            globalSelection: false
        } as TreeProps
    });

    child.bind(WorkflowRunsTreeModel).toService(TreeModel);

    return child;
}
