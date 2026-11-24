import * as React from 'react';
import { Alert, Box, Chip, Tooltip, Typography } from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import DataObjectOutlinedIcon from '@mui/icons-material/DataObjectOutlined';
import { FlowVariableConflict, FlowVariableOrigin, FlowVariableRow } from '../../../../common/FlowVariables';
import { JsonCellRenderer } from '../table-output-view/JsonCellRenderer';
import { JsonViewerDialog } from '../table-output-view/JsonViewerDialog';

const PREVIEW_MAX_CHARS = 120;

const ORIGIN_CHIPS: Record<FlowVariableOrigin, { label: string; color: 'primary' | 'default' | 'warning' }> = {
    set: { label: 'Set here', color: 'primary' },
    inherited: { label: 'Inherited', color: 'default' },
    overridden: { label: 'Overrides inherited', color: 'warning' },
};

/** A one-line text form of a value: strings quoted, objects and arrays as (truncated) JSON. */
function formatValue(value: unknown): string {
    let text: string;
    try {
        text = JSON.stringify(value) ?? String(value);
    } catch {
        text = String(value);
    }
    return text.length > PREVIEW_MAX_CHARS ? `${text.slice(0, PREVIEW_MAX_CHARS)}…` : text;
}

export interface FlowVariablesViewProps {
    rows: FlowVariableRow[];
    conflicts: FlowVariableConflict[];
}

/** The Flow Variables tab of the Node Outputs dialog: what the node inherited and what it set itself. */
export function FlowVariablesView({ rows, conflicts }: FlowVariablesViewProps) {
    const [openValue, setOpenValue] = React.useState<{ value: unknown } | null>(null);

    // Same grid, cell renderers and JSON viewer as the Outputs tab (TableOutputView).
    const columns = React.useMemo<GridColDef<FlowVariableRow>[]>(() => [
        {
            field: 'name',
            headerName: 'Name',
            flex: 1,
            minWidth: 150,
        },
        {
            field: 'value',
            headerName: 'Value',
            flex: 2,
            minWidth: 200,
            renderCell: (params: GridRenderCellParams<FlowVariableRow>) => {
                if (typeof params.value === 'object' && params.value !== null) {
                    return <JsonCellRenderer value={params.value} onClick={(value) => setOpenValue({ value })} />;
                }
                // Booleans do not render as text by default.
                if (typeof params.value === 'boolean') {
                    return params.value ? 'true' : 'false';
                }
                return params.value;
            },
        },
        {
            field: 'origin',
            headerName: 'Source',
            flex: 1,
            minWidth: 170,
            renderCell: (params: GridRenderCellParams<FlowVariableRow>) => {
                const chip = ORIGIN_CHIPS[params.row.origin];
                const chipElement = <Chip size="small" label={chip.label} color={chip.color} variant="outlined" />;
                if (params.row.origin !== 'overridden') {
                    return chipElement;
                }
                return (
                    <Tooltip title={`Inherited value: ${formatValue(params.row.inheritedValue)}`}>
                        {chipElement}
                    </Tooltip>
                );
            },
        },
    ], []);

    if (rows.length === 0) {
        return (
            <Box
                sx={{
                    flex: 1,
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1.5,
                    p: 4,
                    textAlign: 'center',
                }}>
                <Box
                    sx={{
                        width: 72,
                        height: 72,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 'action.hover',
                        color: 'text.disabled',
                    }}>
                    <DataObjectOutlinedIcon sx={{ fontSize: 36 }} />
                </Box>
                <Typography variant="subtitle1" color="text.primary">
                    No flow variables
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
                    This node neither received nor set any flow variables. Variables set by this node or by
                    nodes upstream will appear here.
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1, minHeight: 0, minWidth: 0 }}>
            {conflicts.map((conflict) => (
                <Alert
                    key={`${conflict.name}-${conflict.ignoredFromNodeId}`}
                    severity="info"
                    variant="outlined"
                    sx={{ flexShrink: 0 }}>
                    <code>{conflict.name}</code> reached this node with different values; the value from{' '}
                    <code>{conflict.keptFromNodeId}</code> (lower input port) was used, not the one from{' '}
                    <code>{conflict.ignoredFromNodeId}</code>.
                </Alert>
            ))}
            <Box sx={{ flex: 1, minHeight: 0, minWidth: 0 }}>
                <DataGrid
                    rows={rows}
                    columns={columns}
                    getRowId={(row: FlowVariableRow) => row.name}
                    pageSizeOptions={[5, 25, 50, 100]}
                    initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
                    disableRowSelectionOnClick
                    sx={{
                        width: '100%',
                        height: '100%',
                        minWidth: 0,
                        minHeight: 0,
                        '& .MuiDataGrid-virtualScroller': {
                            overflowY: 'auto', // Make only the rows scrollable
                        },
                        '& .MuiDataGrid-columnHeaders': {
                            position: 'sticky',
                            top: 0,
                            zIndex: 1, // Ensure the header stays on top
                        },
                        '& .MuiDataGrid-footerContainer': {
                            position: 'sticky',
                            bottom: 0,
                            zIndex: 1, // Ensure the footer stays on top
                        },
                    }} />
            </Box>
            {openValue && (
                <JsonViewerDialog open={true} value={openValue.value} onClose={() => setOpenValue(null)} />
            )}
        </Box>
    );
}
