import * as React from 'react';
import { Breadcrumbs, Typography } from '@mui/material';
import { parseWorkflowPath } from './workflowPath';

export interface WorkflowPathBreadcrumbsProps {
    workflowName: string;
}

export default function WorkflowPathBreadcrumbs({ workflowName }: WorkflowPathBreadcrumbsProps) {
    const { folders, current } = React.useMemo(() => parseWorkflowPath(workflowName), [workflowName]);

    return (
        <Breadcrumbs
            separator="/"
            aria-label="workflow folder path"
            sx={{
                '& .MuiBreadcrumbs-separator': { color: 'text.disabled' },
                '& .MuiBreadcrumbs-ol': { flexWrap: 'wrap' },
                minWidth: 0,
                overflow: 'hidden',
            }}>
            {folders.map((segment, idx) => (
                <Typography
                    key={`${segment}-${idx}`}
                    variant="body2"
                    color="text.secondary"
                    title={segment}>
                    {segment}
                </Typography>
            ))}
            <Typography variant="body2" sx={{ fontWeight: 600 }} title={current}>
                {current}
            </Typography>
        </Breadcrumbs>
    );
}
