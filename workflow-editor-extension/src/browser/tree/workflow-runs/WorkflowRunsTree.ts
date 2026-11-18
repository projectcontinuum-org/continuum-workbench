import { TreeImpl, CompositeTreeNode, TreeNode } from '@theia/core/lib/browser/tree';
import { ExpandableTreeNode } from '@theia/core/lib/browser/tree/tree-expansion';
import { SelectableTreeNode } from '@theia/core/lib/browser/tree/tree-selection';
import { injectable, inject } from '@theia/core/shared/inversify';
import { IWorkflowRunItem } from '@continuum/core';
import WorkflowRunsService from '../../service/WorkflowRunsService';

/** Suffix marking a run whose `workflowUri` carries a schedule path (`<base>/<scheduleName>.schedule`). */
export const SCHEDULE_SUFFIX = '.schedule';
/** Display name of the synthetic schedule node that holds manual (unscheduled) runs. */
export const MANUAL_SCHEDULE_NAME = '(manual)';

/**
 * Split a run's `workflowUri` into its base workflow path and the schedule name, if any.
 *
 * Scheduled runs store `workflowUri = {workflowName}/{scheduleName}.schedule` (the schedule's
 * snapshot name carries the tree path). Manual runs store the plain workflow name with no
 * `.schedule` suffix, so they resolve to `scheduleName === null`.
 *
 * The base is everything before the last `/` once the suffix is stripped — the same parse the
 * Manage Schedules tab uses to filter, so the two views agree on what belongs to a workflow.
 */
export function splitScheduleUri(uri: string): { base: string; scheduleName: string | null } {
    if (uri.endsWith(SCHEDULE_SUFFIX)) {
        const withoutSuffix = uri.slice(0, -SCHEDULE_SUFFIX.length);
        const lastSlash = withoutSuffix.lastIndexOf('/');
        if (lastSlash !== -1) {
            return { base: withoutSuffix.slice(0, lastSlash), scheduleName: withoutSuffix.slice(lastSlash + 1) };
        }
        // A `.schedule` URI with no `/` is malformed; treat it as a manual run of itself.
        return { base: uri, scheduleName: null };
    }
    return { base: uri, scheduleName: null };
}

/**
 * Folder node representing a directory in the workflow URI path.
 * Children are pre-populated (no API call needed to expand).
 */
export interface FolderNode extends ExpandableTreeNode, SelectableTreeNode {
    nodeType: 'folder';
}

export namespace FolderNode {
    export function is(node: TreeNode | undefined): node is FolderNode {
        return !!node && 'nodeType' in node && (node as FolderNode).nodeType === 'folder';
    }
}

/**
 * Workflow node representing a distinct base workflow (by URI). Its `sourceUris` are every
 * distinct run URI that normalizes to `workflowUri` — the base itself (manual runs) plus one
 * `<base>/<scheduleName>.schedule` URI per schedule. Expandable — children are `ScheduleNode`s
 * loaded lazily from the API.
 */
export interface WorkflowNode extends ExpandableTreeNode, SelectableTreeNode {
    nodeType: 'workflow';
    /** The base workflow URI (manual runs' URI, with any `/<scheduleName>.schedule` stripped). */
    workflowUri: string;
    /** Every distinct run URI that belongs to this workflow: the base plus one per schedule. */
    sourceUris: string[];
}

export namespace WorkflowNode {
    export function is(node: TreeNode | undefined): node is WorkflowNode {
        return !!node && 'nodeType' in node && (node as WorkflowNode).nodeType === 'workflow';
    }
}

/**
 * Schedule node sitting between a `WorkflowNode` and its `WorkflowRunNode`s. Named for the
 * schedule (e.g. `GreenOtter37`) or `(manual)` for unscheduled runs. Children are run instances
 * pre-populated from a page-0 fetch of `sourceUri`; a trailing `LoadMoreNode` paginates further.
 */
export interface ScheduleNode extends ExpandableTreeNode, SelectableTreeNode {
    nodeType: 'schedule';
    /** The schedule's display name, or `(manual)`. */
    scheduleName: string;
    /** The full run URI this schedule's runs come from. */
    sourceUri: string;
    /** True for the synthetic `(manual)` node. */
    isManual: boolean;
}

export namespace ScheduleNode {
    export function is(node: TreeNode | undefined): node is ScheduleNode {
        return !!node && 'nodeType' in node && (node as ScheduleNode).nodeType === 'schedule';
    }
}

/**
 * Child node representing a single workflow run instance
 */
export interface WorkflowRunNode extends SelectableTreeNode {
    nodeType: 'run';
    runData: IWorkflowRunItem;
}

export namespace WorkflowRunNode {
    export function is(node: TreeNode | undefined): node is WorkflowRunNode {
        return !!node && 'nodeType' in node && (node as WorkflowRunNode).nodeType === 'run';
    }
}

/**
 * "Load more..." placeholder node for pagination
 */
export interface LoadMoreNode extends SelectableTreeNode {
    nodeType: 'load-more';
    parentNodeId: string;
    nextPage: number;
    pageSize: number;
    loadType: 'workflows' | 'runs';
    workflowUri?: string;
}

export namespace LoadMoreNode {
    export function is(node: TreeNode | undefined): node is LoadMoreNode {
        return !!node && 'nodeType' in node && (node as LoadMoreNode).nodeType === 'load-more';
    }
}

/**
 * Invisible root node
 */
export interface WorkflowRunsRootNode extends CompositeTreeNode {
    nodeType: 'root';
}

export namespace WorkflowRunsRootNode {
    export function is(node: TreeNode | undefined): node is WorkflowRunsRootNode {
        return !!node && 'nodeType' in node && (node as WorkflowRunsRootNode).nodeType === 'root';
    }

    export function create(): WorkflowRunsRootNode {
        return {
            id: 'workflow-runs-root',
            name: 'Workflow Runs',
            nodeType: 'root',
            visible: false,
            children: [],
            parent: undefined
        };
    }
}

/**
 * Internal trie structure for building the folder hierarchy
 */
interface PathTrieNode {
    segment: string;
    children: Map<string, PathTrieNode>;
    /** If this trie node represents a workflow file, its full base URI */
    workflowUri?: string;
}

/**
 * Tree data provider for Workflow Runs.
 * Builds a folder hierarchy from flat workflow URIs and
 * lazily loads run instances per workflow, grouped by schedule.
 */
@injectable()
export class WorkflowRunsTree extends TreeImpl {

    @inject(WorkflowRunsService)
    protected readonly workflowRunsService!: WorkflowRunsService;

    /** RSQL time filter fragment, set by the widget toolbar */
    public timeFilter: string | undefined;

    /** Page size for API calls, controlled by toolbar dropdown */
    public pageSize: number = 50;

    protected override async resolveChildren(parent: CompositeTreeNode): Promise<TreeNode[]> {
        if (WorkflowRunsRootNode.is(parent)) {
            (parent as any).loading = true;
            this.fireChanged();
            try {
                return await this.loadWorkflowTree(parent, 0);
            } finally {
                (parent as any).loading = false;
            }
        }
        // Folder and schedule nodes already have children populated — just return them
        if (FolderNode.is(parent) || ScheduleNode.is(parent)) {
            return [...parent.children];
        }
        if (WorkflowNode.is(parent)) {
            (parent as any).loading = true;
            this.fireChanged();
            try {
                return await this.loadSchedules(parent);
            } finally {
                (parent as any).loading = false;
            }
        }
        return [];
    }

    /**
     * Load distinct workflow URIs and build a folder tree of base workflows.
     * Distinct run URIs are normalized by stripping `/<scheduleName>.schedule` so all of a
     * workflow's runs (manual + per-schedule) collapse to one workflow node, which carries the
     * full list of source URIs to fetch when expanded.
     */
    async loadWorkflowTree(root: CompositeTreeNode, page: number): Promise<TreeNode[]> {
        try {
            const result = await this.workflowRunsService.getDistinctWorkflows(
                this.timeFilter, page, this.pageSize
            );

            // Group every distinct run URI by its base workflow. base -> list of full source URIs.
            const baseToSourceUris = new Map<string, string[]>();
            for (const uri of result.content) {
                const { base } = splitScheduleUri(uri);
                let list = baseToSourceUris.get(base);
                if (!list) {
                    list = [];
                    baseToSourceUris.set(base, list);
                }
                list.push(uri);
            }

            // Build a trie from the base workflow paths only (one node per base).
            const trie = this.buildPathTrie([...baseToSourceUris.keys()]);
            const nodes: TreeNode[] = this.trieToTreeNodes(trie, root, baseToSourceUris);

            if (page + 1 < result.totalPages) {
                nodes.push(this.toLoadMoreNode(root, page + 1, 'workflows'));
            }
            return nodes;
        } catch (error) {
            console.error('[WorkflowRunsTree] Failed to load workflows:', error);
            return [];
        }
    }

    /**
     * Load the schedule tier for a workflow node. Fetches page 0 of every source URI belonging
     * to the workflow (the base for manual runs, plus one `<base>/<name>.schedule` per schedule),
     * then groups the runs under one `ScheduleNode` per schedule name plus a `(manual)` node.
     */
    async loadSchedules(parent: WorkflowNode): Promise<TreeNode[]> {
        try {
            // Fetch page 0 for each source URI; remember per-URI page count for "Load more".
            const perUri: { uri: string; runs: IWorkflowRunItem[]; totalPages: number }[] = [];
            for (const uri of parent.sourceUris) {
                const result = await this.workflowRunsService.getRunsByWorkflowUri(
                    uri, this.timeFilter, 0, this.pageSize
                );
                perUri.push({ uri, runs: result.content, totalPages: result.totalPages });
            }

            // Group runs by schedule name. Each schedule name maps 1:1 to one source URI.
            const groups = new Map<string, { uri: string; runs: IWorkflowRunItem[]; totalPages: number; isManual: boolean }>();
            for (const { uri, runs, totalPages } of perUri) {
                const { scheduleName } = splitScheduleUri(uri);
                const key = scheduleName ?? MANUAL_SCHEDULE_NAME;
                const existing = groups.get(key);
                if (existing) {
                    existing.runs.push(...runs);
                } else {
                    groups.set(key, { uri, runs, totalPages, isManual: scheduleName === null });
                }
            }

            const scheduleNodes: TreeNode[] = [];
            for (const [name, g] of groups) {
                const scheduleNode = this.toScheduleNode(name, g.uri, g.isManual, parent);
                const children: TreeNode[] = g.runs.map(run => this.toRunNode(run, scheduleNode));
                if (1 < g.totalPages) {
                    children.push(this.toLoadMoreNode(scheduleNode, 1, 'runs', g.uri));
                }
                (scheduleNode as any).children = children;
                for (const child of children) {
                    (child as any).parent = scheduleNode;
                }
                scheduleNodes.push(scheduleNode);
            }
            return scheduleNodes;
        } catch (error) {
            console.error('[WorkflowRunsTree] Failed to load schedules for:', parent.workflowUri, error);
            return [];
        }
    }

    /**
     * Fetch one page of runs for a single source URI. Returns run nodes plus a trailing
     * `LoadMoreNode` when more pages remain. Used by "Load more" inside a `ScheduleNode`.
     * Nodes are parented to the owning `ScheduleNode` so ids stay unique per schedule.
     */
    async loadScheduleRuns(parent: ScheduleNode, page: number): Promise<TreeNode[]> {
        const uri = parent.sourceUri;
        try {
            const result = await this.workflowRunsService.getRunsByWorkflowUri(
                uri, this.timeFilter, page, this.pageSize
            );
            const nodes: TreeNode[] = result.content.map(run => this.toRunNode(run, parent));
            if (page + 1 < result.totalPages) {
                nodes.push(this.toLoadMoreNode(parent, page + 1, 'runs', uri));
            }
            return nodes;
        } catch (error) {
            console.error('[WorkflowRunsTree] Failed to load runs for:', uri, error);
            return [];
        }
    }

    /**
     * Handle "Load more" click — append next page to parent's children.
     * For 'workflows', new base URIs are merged into the existing folder tree.
     * For 'runs', the next page of a single schedule's source URI is appended to its ScheduleNode.
     */
    async loadMore(loadMoreNode: LoadMoreNode): Promise<void> {
        const parent = loadMoreNode.parent;
        if (!parent || !CompositeTreeNode.is(parent)) return;

        if (loadMoreNode.loadType === 'workflows' && WorkflowRunsRootNode.is(parent)) {
            const newNodes = await this.loadWorkflowTree(parent, loadMoreNode.nextPage);
            // Merge: remove old LoadMoreNode, add new nodes (which may include a new LoadMoreNode)
            const existing = parent.children.filter(c => c.id !== loadMoreNode.id);
            const merged = this.mergeFolderChildren(existing, newNodes, parent);
            (parent as any).children = merged;
            this.fireChanged();
        } else if (loadMoreNode.loadType === 'runs' && ScheduleNode.is(parent)) {
            const newNodes = await this.loadScheduleRuns(parent, loadMoreNode.nextPage);
            const children = [...parent.children.filter(c => c.id !== loadMoreNode.id), ...newNodes];
            (parent as any).children = children;
            for (const child of newNodes) {
                (child as any).parent = parent;
            }
            this.fireChanged();
        }
    }

    /**
     * Merge new folder/workflow nodes into existing children.
     * If a folder already exists, merge its children recursively.
     */
    protected mergeFolderChildren(
        existing: readonly TreeNode[],
        incoming: TreeNode[],
        parent: CompositeTreeNode
    ): TreeNode[] {
        const result = [...existing];
        const existingMap = new Map<string, TreeNode>();
        for (const node of existing) {
            existingMap.set(node.id, node);
        }

        for (const node of incoming) {
            const existingNode = existingMap.get(node.id);
            if (existingNode && FolderNode.is(existingNode) && FolderNode.is(node)) {
                // Merge folder children recursively
                const merged = this.mergeFolderChildren(
                    existingNode.children, [...node.children], existingNode
                );
                (existingNode as any).children = merged;
            } else if (!existingMap.has(node.id)) {
                (node as any).parent = parent;
                result.push(node);
            }
        }
        return result;
    }

    /**
     * Build a path trie from a list of (base) workflow URIs.
     * Each URI is split into path segments; the leaf holds the full base URI.
     */
    protected buildPathTrie(uris: string[]): PathTrieNode {
        const root: PathTrieNode = { segment: '', children: new Map() };

        for (const uri of uris) {
            const segments = this.extractPathSegments(uri);
            let current = root;
            for (let i = 0; i < segments.length; i++) {
                const seg = segments[i];
                if (!current.children.has(seg)) {
                    current.children.set(seg, { segment: seg, children: new Map() });
                }
                current = current.children.get(seg)!;
                // Last segment = the workflow file itself
                if (i === segments.length - 1) {
                    current.workflowUri = uri;
                }
            }
        }
        return root;
    }

    /**
     * Convert a path trie into Theia TreeNodes.
     * Collapses single-child folder chains (e.g., "a/b/c" with no siblings
     * becomes a single folder node labeled "a/b/c").
     */
    protected trieToTreeNodes(
        trie: PathTrieNode,
        parent: CompositeTreeNode,
        baseToSourceUris: Map<string, string[]>
    ): TreeNode[] {
        const nodes: TreeNode[] = [];

        for (const [, child] of trie.children) {
            const node = this.trieNodeToTreeNode(child, parent, '', baseToSourceUris);
            nodes.push(node);
        }

        return nodes;
    }

    protected trieNodeToTreeNode(
        trieNode: PathTrieNode,
        parent: CompositeTreeNode,
        pathPrefix: string,
        baseToSourceUris: Map<string, string[]>
    ): TreeNode {
        const fullPath = pathPrefix ? `${pathPrefix}/${trieNode.segment}` : trieNode.segment;

        // If this is a workflow leaf (has a base URI), create a WorkflowNode carrying source URIs
        if (trieNode.workflowUri) {
            // It could also have folder children if there are files AND subfolders
            // at the same level, but typically a workflow URI is a leaf.
            if (trieNode.children.size === 0) {
                return this.toWorkflowNode(
                    trieNode.workflowUri, trieNode.segment, parent,
                    baseToSourceUris.get(trieNode.workflowUri) ?? [trieNode.workflowUri]
                );
            }
            // Rare case: a URI that is also a prefix of other URIs
            return this.toWorkflowNode(
                trieNode.workflowUri, trieNode.segment, parent,
                baseToSourceUris.get(trieNode.workflowUri) ?? [trieNode.workflowUri]
            );
        }

        // Collapse single-child folder chains:
        // If this folder has exactly one child that is also a folder (not a workflow),
        // merge them into a single label like "project/subfolder"
        if (trieNode.children.size === 1) {
            const [, onlyChild] = [...trieNode.children.entries()][0];
            if (!onlyChild.workflowUri || onlyChild.children.size > 0) {
                // Collapse: pass the accumulated path prefix forward
                return this.trieNodeToTreeNode(onlyChild, parent, fullPath, baseToSourceUris);
            }
        }

        // Create a folder node with pre-populated children
        const folderNode: FolderNode = {
            id: `folder:${fullPath}`,
            name: fullPath,
            parent,
            visible: true,
            nodeType: 'folder',
            expanded: false,
            selected: false,
            children: []
        };

        // Recursively build child nodes
        const children: TreeNode[] = [];
        for (const [, child] of trieNode.children) {
            children.push(this.trieNodeToTreeNode(child, folderNode, '', baseToSourceUris));
        }
        (folderNode as any).children = children;

        return folderNode;
    }

    protected toWorkflowNode(uri: string, displayName: string, parent: CompositeTreeNode, sourceUris: string[]): WorkflowNode {
        // Remove file extension from display name
        const name = displayName.replace(/\.[^.]+$/, '');
        return {
            id: `workflow:${uri}`,
            name,
            parent,
            visible: true,
            nodeType: 'workflow',
            workflowUri: uri,
            sourceUris,
            expanded: false,
            selected: false,
            children: []
        };
    }

    protected toScheduleNode(scheduleName: string, sourceUri: string, isManual: boolean, parent: WorkflowNode): ScheduleNode {
        return {
            id: `schedule:${parent.workflowUri}:${scheduleName}`,
            name: scheduleName,
            parent,
            visible: true,
            nodeType: 'schedule',
            scheduleName,
            sourceUri,
            isManual,
            expanded: false,
            selected: false,
            children: []
        };
    }

    protected toRunNode(run: IWorkflowRunItem, parent: ScheduleNode | undefined): WorkflowRunNode {
        const dateLabel = this.formatDateTime(run.updatedAt || run.createdAt);
        return {
            id: `run:${run.workflowId}`,
            name: dateLabel,
            parent,
            visible: true,
            nodeType: 'run',
            selected: false,
            runData: run
        };
    }

    protected toLoadMoreNode(
        parent: CompositeTreeNode,
        nextPage: number,
        loadType: 'workflows' | 'runs',
        workflowUri?: string
    ): LoadMoreNode {
        return {
            id: `load-more:${parent?.id ?? 'unknown'}:${nextPage}`,
            name: 'Load more...',
            parent,
            visible: true,
            nodeType: 'load-more',
            selected: false,
            parentNodeId: parent?.id ?? '',
            nextPage,
            pageSize: this.pageSize,
            loadType,
            workflowUri
        };
    }

    /**
     * Extract path segments from a workflow URI.
     * Handles both full URLs (s3://bucket/path/file.json) and plain paths.
     */
    protected extractPathSegments(uri: string): string[] {
        try {
            const url = new URL(uri);
            // For URLs like s3://bucket/project/workflow.json
            // Include the scheme+host as the first segment for clarity
            const pathSegments = url.pathname.split('/').filter(s => s.length > 0);
            const host = url.host || url.protocol.replace(':', '');
            return [host, ...pathSegments];
        } catch {
            // Plain path like "project/subfolder/workflow.json"
            return uri.split('/').filter(s => s.length > 0);
        }
    }

    protected formatDateTime(isoString: string): string {
        try {
            const date = new Date(isoString);
            return date.toLocaleString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        } catch {
            return isoString;
        }
    }
}
