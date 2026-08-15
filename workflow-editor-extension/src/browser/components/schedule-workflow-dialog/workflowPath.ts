export interface WorkflowPathSegments {
    folders: string[];
    current: string;
}

export function parseWorkflowPath(workflowName: string): WorkflowPathSegments {
    const raw = (workflowName ?? '').trim();

    if (!raw || raw === 'untitled') {
        return { folders: [], current: 'Untitled' };
    }

    const segments = raw.split('/').filter(s => s.length > 0);
    if (segments.length === 0) {
        return { folders: [], current: 'Untitled' };
    }

    const current = segments[segments.length - 1];
    const folders = segments.slice(0, -1);

    return { folders, current };
}
