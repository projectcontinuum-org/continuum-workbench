import * as React from 'react';
import {
    Alert,
    Box,
    Chip,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tooltip,
    Typography,
} from '@mui/material';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import { FlowVariableConflict, FlowVariableOrigin, FlowVariableRow } from '../../../../common/FlowVariables';
import { JsonViewerDialog } from '../table-output-view/JsonViewerDialog';

const PREVIEW_MAX_CHARS = 120;

const ORIGIN_CHIPS: Record<FlowVariableOrigin, { label: string; color: 'primary' | 'default' | 'warning' }> = {
    set: { label: 'Set here', color: 'primary' },
    inherited: { label: 'Inherited', color: 'default' },
    overridden: { label: 'Overrides inherited', color: 'warning' },
};

function isStructured(value: unknown): boolean {
    return typeof value === 'object' && value !== null;
}

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

    if (rows.length === 0) {
        return (
            <Typography variant="body2" color="text.secondary">
                This node received and set no flow variables.
            </Typography>
        );
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minHeight: 0 }}>
            {conflicts.map((conflict) => (
                <Alert key={`${conflict.name}-${conflict.ignoredFromNodeId}`} severity="info" variant="outlined">
                    <code>{conflict.name}</code> reached this node with different values; the value from{' '}
                    <code>{conflict.keptFromNodeId}</code> (lower input port) was used, not the one from{' '}
                    <code>{conflict.ignoredFromNodeId}</code>.
                </Alert>
            ))}
            <TableContainer sx={{ overflow: 'auto' }}>
                <Table size="small" stickyHeader aria-label="flow variables">
                    <TableHead>
                        <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Value</TableCell>
                            <TableCell>Source</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rows.map((row) => {
                            const chip = ORIGIN_CHIPS[row.origin];
                            const chipElement = <Chip size="small" label={chip.label} color={chip.color} variant="outlined" />;
                            return (
                                <TableRow key={row.name}>
                                    <TableCell sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{row.name}</TableCell>
                                    <TableCell sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <span>{formatValue(row.value)}</span>
                                            {isStructured(row.value) && (
                                                <Tooltip title="Open as JSON">
                                                    <IconButton
                                                        size="small"
                                                        aria-label={`open ${row.name} as JSON`}
                                                        onClick={() => setOpenValue({ value: row.value })}>
                                                        <OpenInFullIcon fontSize="inherit" />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                        </Box>
                                    </TableCell>
                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                        {row.origin === 'overridden' ? (
                                            <Tooltip title={`Inherited value: ${formatValue(row.inheritedValue)}`}>
                                                {chipElement}
                                            </Tooltip>
                                        ) : chipElement}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
            {openValue && (
                <JsonViewerDialog open={true} value={openValue.value} onClose={() => setOpenValue(null)} />
            )}
        </Box>
    );
}
