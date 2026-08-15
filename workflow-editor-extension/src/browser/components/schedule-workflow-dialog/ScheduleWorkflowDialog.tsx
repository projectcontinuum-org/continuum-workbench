import * as React from 'react';
import DialogTitle from '@mui/material/DialogTitle';
import Dialog from '@mui/material/Dialog';
import {
  Box, Button, DialogActions, DialogContent, IconButton, TextField, Typography, styled,
  Tabs, Tab, ToggleButtonGroup, ToggleButton, Autocomplete, Tooltip, CircularProgress,
  Chip, Snackbar, Alert
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import CloseIcon from '@mui/icons-material/Close';
import MaximizeIcon from '@mui/icons-material/Fullscreen';
import RestoreIcon from '@mui/icons-material/FullscreenExit';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import BoltIcon from '@mui/icons-material/Bolt';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import { Node, Edge } from 'reactflow';
import { IWorkflowSchedule } from '@continuum/core';
import WorkflowScheduleService from '../../service/WorkflowScheduleService';
import CronBuilder from './CronBuilder';
import WorkflowPathBreadcrumbs from './WorkflowPathBreadcrumbs';

interface StyledDialogProps {
    customWidth?: number;
    customHeight?: number;
}

const StyledDialog = styled(Dialog, {
    shouldForwardProp: (prop) => prop !== 'customWidth' && prop !== 'customHeight',
})<StyledDialogProps>(({ theme, customWidth, customHeight }) => ({
    '& .MuiPaper-root': {
      backgroundColor: theme.palette.background.paper || theme.palette.background.default || '#1e1e1e',
      backgroundImage: 'none',
      opacity: 1,
      width: customWidth ? `${customWidth}px` : 'auto',
      height: customHeight ? `${customHeight}px` : 'auto',
      maxWidth: 'none',
      maxHeight: 'none',
      position: 'relative',
      overflow: 'visible',
    },
    '& .MuiDialogContent-root': {
      padding: theme.spacing(2),
      backgroundColor: theme.palette.background.paper || theme.palette.background.default || '#1e1e1e',
    },
    '& .MuiDialogActions-root': {
      padding: theme.spacing(1),
      backgroundColor: theme.palette.background.paper || theme.palette.background.default || '#1e1e1e',
    },
    '& .MuiDialogTitle-root': {
      backgroundColor: theme.palette.background.paper || theme.palette.background.default || '#1e1e1e',
    },
}));

const ResizeHandle = styled('div')(({ theme }) => ({
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: '20px',
    height: '20px',
    cursor: 'nwse-resize',
    zIndex: 9999,
    '&::after': {
        content: '""',
        position: 'absolute',
        bottom: '2px',
        right: '2px',
        width: '0',
        height: '0',
        borderStyle: 'solid',
        borderWidth: '0 0 12px 12px',
        borderColor: `transparent transparent ${theme.palette.grey[500]} transparent`,
    },
}));

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
    const isActive = value === index;
    return (
        <div
            role="tabpanel"
            hidden={!isActive}
            id={`schedule-tabpanel-${index}`}
            aria-labelledby={`schedule-tab-${index}`}
            style={isActive ? { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 } : undefined}>
            {isActive && <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>{children}</Box>}
        </div>
    );
}

const DIALOG_WIDTH = 640;
const DIALOG_HEIGHT = 640;
const MIN_DIALOG_WIDTH = 480;
const MIN_DIALOG_HEIGHT = 400;
const DEFAULT_CRON = '0 9 * * *';

function getTimeZoneOptions(): string[] {
    try {
        return typeof (Intl as any).supportedValuesOf === 'function'
            ? (Intl as any).supportedValuesOf('timeZone')
            : [];
    } catch {
        return [];
    }
}

export interface ScheduleWorkflowDialogProps {
    open: boolean;
    workflowId: string;
    workflowName: string;
    nodes: Node[];
    edges: Edge[];
    initialTab?: 0 | 1;
    onClose: () => void;
}

export default function ScheduleWorkflowDialog({ open, workflowId, workflowName, nodes, edges, initialTab = 0, onClose }: ScheduleWorkflowDialogProps) {
    const scheduleService = React.useMemo(() => new WorkflowScheduleService(), []);
    const timeZoneOptions = React.useMemo(getTimeZoneOptions, []);

    const [activeTab, setActiveTab] = React.useState<0 | 1>(initialTab);
    const [snackbar, setSnackbar] = React.useState<{ severity: 'success' | 'error'; message: string } | null>(null);
    const [dialogSize, setDialogSize] = React.useState({ width: DIALOG_WIDTH, height: DIALOG_HEIGHT });
    const [isResizing, setIsResizing] = React.useState(false);
    const [isMaximized, setIsMaximized] = React.useState(false);
    const resizeStartPos = React.useRef({ x: 0, y: 0, width: 0, height: 0 });
    const previousSize = React.useRef({ width: DIALOG_WIDTH, height: DIALOG_HEIGHT });

    // New Schedule tab state
    const [mode, setMode] = React.useState<'builder' | 'advanced'>('builder');
    const [cronExpression, setCronExpression] = React.useState(DEFAULT_CRON);
    const [timeZone, setTimeZone] = React.useState<string | null>(null);
    const [submitting, setSubmitting] = React.useState(false);

    // Manage Schedules tab state
    const [schedules, setSchedules] = React.useState<IWorkflowSchedule[]>([]);
    const [loadingSchedules, setLoadingSchedules] = React.useState(false);
    const [hasLoadedSchedules, setHasLoadedSchedules] = React.useState(false);
    const [rowActionInProgress, setRowActionInProgress] = React.useState<string | null>(null);
    const [scheduleToDelete, setScheduleToDelete] = React.useState<IWorkflowSchedule | null>(null);

    const isCronValid = mode === 'builder' ? true : cronExpression.trim().length > 0;
    const canSubmit = isCronValid && !submitting;

    const refreshSchedules = React.useCallback(async () => {
        setLoadingSchedules(true);
        try {
            const result = await scheduleService.listSchedules(workflowName);
            setSchedules(result);
        } catch (error) {
            console.error(error);
            setSnackbar({ severity: 'error', message: 'Failed to load schedules. Please try again.' });
        } finally {
            setLoadingSchedules(false);
            setHasLoadedSchedules(true);
        }
    }, [scheduleService, workflowName]);

    React.useEffect(() => {
        if (activeTab === 1 && !hasLoadedSchedules) {
            refreshSchedules();
        }
    }, [activeTab, hasLoadedSchedules, refreshSchedules]);

    const handleClose = React.useCallback(() => {
        if (submitting) return;
        onClose();
    }, [onClose, submitting]);

    const handleMaximize = React.useCallback(() => {
        if (isMaximized) {
            setDialogSize(previousSize.current);
            setIsMaximized(false);
        } else {
            previousSize.current = dialogSize;
            setDialogSize({
                width: window.innerWidth,
                height: window.innerHeight
            });
            setIsMaximized(true);
        }
    }, [isMaximized, dialogSize]);

    const handleResizeStart = React.useCallback((e: React.MouseEvent) => {
        if (isMaximized) return;
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);
        resizeStartPos.current = {
            x: e.clientX,
            y: e.clientY,
            width: dialogSize.width,
            height: dialogSize.height,
        };
    }, [dialogSize, isMaximized]);

    React.useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = e.clientX - resizeStartPos.current.x;
            const deltaY = e.clientY - resizeStartPos.current.y;

            const newWidth = Math.max(MIN_DIALOG_WIDTH, Math.min(window.innerWidth, resizeStartPos.current.width + deltaX));
            const newHeight = Math.max(MIN_DIALOG_HEIGHT, Math.min(window.innerHeight, resizeStartPos.current.height + deltaY));

            setDialogSize({ width: newWidth, height: newHeight });
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    const handleCreateSubmit = React.useCallback(async () => {
        setSubmitting(true);
        try {
            await scheduleService.createSchedule({
                name: workflowName,
                cronExpression: cronExpression.trim(),
                timeZone: timeZone ?? undefined,
                continuumWorkflowModel: {
                    id: workflowId,
                    name: workflowName,
                    active: false,
                    edges,
                    nodes
                }
            });
            setSnackbar({ severity: 'success', message: 'Workflow scheduled successfully.' });
            setMode('builder');
            setCronExpression(DEFAULT_CRON);
            setTimeZone(null);
            if (hasLoadedSchedules) {
                refreshSchedules();
            }
        } catch (error) {
            console.error(error);
            setSnackbar({ severity: 'error', message: 'Failed to schedule workflow. Please try again.' });
        } finally {
            setSubmitting(false);
        }
    }, [scheduleService, cronExpression, timeZone, workflowId, workflowName, nodes, edges, hasLoadedSchedules, refreshSchedules]);

    const onTogglePause = React.useCallback(async (schedule: IWorkflowSchedule) => {
        setRowActionInProgress(schedule.scheduleId);
        try {
            if (schedule.paused) {
                await scheduleService.unpauseSchedule(schedule.scheduleId);
            } else {
                await scheduleService.pauseSchedule(schedule.scheduleId);
            }
            await refreshSchedules();
        } catch (error) {
            console.error(error);
            setSnackbar({ severity: 'error', message: `Failed to ${schedule.paused ? 'resume' : 'pause'} schedule. Please try again.` });
        } finally {
            setRowActionInProgress(null);
        }
    }, [scheduleService, refreshSchedules]);

    const onTriggerNow = React.useCallback(async (schedule: IWorkflowSchedule) => {
        setRowActionInProgress(schedule.scheduleId);
        try {
            await scheduleService.triggerSchedule(schedule.scheduleId);
            setSnackbar({ severity: 'success', message: 'Triggered — check the execution viewer.' });
        } catch (error) {
            console.error(error);
            setSnackbar({ severity: 'error', message: 'Failed to trigger schedule. Please try again.' });
        } finally {
            setRowActionInProgress(null);
        }
    }, [scheduleService]);

    const onConfirmDelete = React.useCallback(async () => {
        if (!scheduleToDelete) return;
        const scheduleId = scheduleToDelete.scheduleId;
        setRowActionInProgress(scheduleId);
        setScheduleToDelete(null);
        try {
            await scheduleService.deleteSchedule(scheduleId);
            await refreshSchedules();
        } catch (error) {
            console.error(error);
            setSnackbar({ severity: 'error', message: 'Failed to delete schedule. Please try again.' });
        } finally {
            setRowActionInProgress(null);
        }
    }, [scheduleService, scheduleToDelete, refreshSchedules]);

    const columns: GridColDef<IWorkflowSchedule>[] = [
        { field: 'name', headerName: 'Name', flex: 1, minWidth: 140 },
        {
            field: 'cronExpression', headerName: 'Cron', width: 130,
            renderCell: (params) => <span style={{ fontFamily: 'monospace' }}>{params.value}</span>
        },
        { field: 'timeZone', headerName: 'Time zone', width: 150, valueGetter: (value) => value || '—' },
        {
            field: 'paused', headerName: 'Status', width: 100,
            renderCell: (params) => (
                <Chip
                    size="small"
                    label={params.value ? 'Paused' : 'Active'}
                    color={params.value ? 'default' : 'success'}
                />
            )
        },
        {
            field: 'nextRunTimes', headerName: 'Next run', width: 180,
            valueGetter: (value: string[], row) => (!row.paused && value?.length) ? new Date(value[0]).toLocaleString() : '—'
        },
        {
            field: 'actions', headerName: '', width: 130, sortable: false, filterable: false,
            renderCell: (params) => {
                const schedule = params.row;
                const busy = rowActionInProgress === schedule.scheduleId;
                return (
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title={schedule.paused ? 'Resume' : 'Pause'}>
                            <IconButton size="small" disabled={busy} onClick={() => onTogglePause(schedule)}>
                                {schedule.paused ? <PlayCircleOutlineIcon fontSize="small" /> : <PauseCircleOutlineIcon fontSize="small" />}
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Trigger now">
                            <IconButton size="small" disabled={busy} onClick={() => onTriggerNow(schedule)}>
                                <BoltIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                            <IconButton size="small" disabled={busy} onClick={() => setScheduleToDelete(schedule)}>
                                <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                );
            }
        }
    ];

    return (
        <>
            <StyledDialog
                open={open}
                onClose={handleClose}
                customWidth={dialogSize.width}
                customHeight={dialogSize.height}>
                <DialogTitle>Schedule Workflow</DialogTitle>
                <IconButton
                    aria-label="maximize"
                    onClick={handleMaximize}
                    disabled={submitting}
                    sx={{ position: 'absolute', right: 48, top: 8, color: (theme) => theme.palette.grey[500] }}>
                    {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
                </IconButton>
                <IconButton
                    aria-label="close"
                    onClick={handleClose}
                    disabled={submitting}
                    sx={{ position: 'absolute', right: 8, top: 8, color: (theme) => theme.palette.grey[500] }}>
                    <CloseIcon />
                </IconButton>
                <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <Tabs
                        value={activeTab}
                        onChange={(_, v) => setActiveTab(v)}
                        sx={{ minHeight: 'auto', borderBottom: 1, borderColor: 'divider', mb: 1 }}>
                        <Tab label="New Schedule" />
                        <Tab label="Manage Schedules" />
                    </Tabs>

                    <TabPanel value={activeTab} index={0}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: '560px', overflow: 'auto', pt: 1 }}>
                            <Box>
                                <Box sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    borderRadius: 1,
                                    px: 1.75,
                                    py: 1.25,
                                    backgroundColor: 'action.hover',
                                }}>
                                    <AccountTreeOutlinedIcon fontSize="small" color="action" />
                                    <Box sx={{ minWidth: 0, overflow: 'hidden' }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                            Workflow
                                        </Typography>
                                        <WorkflowPathBreadcrumbs workflowName={workflowName} />
                                    </Box>
                                </Box>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, ml: 1.75 }}>
                                    A snapshot of this workflow will be captured and run on this schedule.
                                </Typography>
                            </Box>

                            <Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Cadence</Typography>
                                        <Tooltip title="How often the workflow should run.">
                                            <InfoOutlinedIcon fontSize="small" color="action" />
                                        </Tooltip>
                                    </Box>
                                    <ToggleButtonGroup
                                        size="small"
                                        exclusive
                                        value={mode}
                                        disabled={submitting}
                                        onChange={(_, v) => v && setMode(v)}
                                    >
                                        <ToggleButton value="builder" sx={{ fontSize: '11px', padding: '2px 6px', textTransform: 'none' }}>Builder</ToggleButton>
                                        <ToggleButton value="advanced" sx={{ fontSize: '11px', padding: '2px 6px', textTransform: 'none' }}>Advanced (cron)</ToggleButton>
                                    </ToggleButtonGroup>
                                </Box>

                                {mode === 'builder' ? (
                                    <CronBuilder
                                        value={cronExpression}
                                        onChange={setCronExpression}
                                        disabled={submitting}
                                    />
                                ) : (
                                    <TextField
                                        label="Cron expression"
                                        fullWidth
                                        placeholder="0 9 * * *"
                                        value={cronExpression}
                                        disabled={submitting}
                                        error={!isCronValid}
                                        helperText={!isCronValid ? 'Enter a valid 5-field cron expression' : 'e.g. "0 9 * * *" = every day at 9:00'}
                                        onChange={(e) => setCronExpression(e.target.value)}
                                    />
                                )}
                            </Box>

                            <Autocomplete
                                options={timeZoneOptions}
                                value={timeZone}
                                disabled={submitting}
                                onChange={(_, v) => setTimeZone(v)}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Time zone (optional)"
                                        helperText={timeZoneOptions.length === 0
                                            ? 'Time zone list unavailable in this environment; leave blank to use the server default.'
                                            : 'Leave blank to use the server default.'}
                                    />
                                )}
                            />
                        </Box>
                    </TabPanel>

                    <TabPanel value={activeTab} index={1}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: '560px', height: '100%' }}>
                            <Box sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                borderRadius: 1,
                                px: 1.75,
                                py: 1.25,
                                backgroundColor: 'action.hover',
                            }}>
                                <AccountTreeOutlinedIcon fontSize="small" color="action" />
                                <Box sx={{ minWidth: 0, overflow: 'hidden' }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                        Workflow
                                    </Typography>
                                    <WorkflowPathBreadcrumbs workflowName={workflowName} />
                                </Box>
                                <Box sx={{ ml: 'auto', flexShrink: 0 }}>
                                    <Tooltip title="Refresh">
                                        <IconButton size="small" onClick={refreshSchedules} sx={{ padding: '4px' }}>
                                            {loadingSchedules ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            </Box>

                            {hasLoadedSchedules && schedules.length === 0 ? (
                                <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                                    No schedules found with this workflow&apos;s name. If a schedule was renamed, it
                                    won&apos;t appear here — check Manage from the workflow it still matches.
                                </Typography>
                            ) : (
                                <Box sx={{ flex: 1, minHeight: 240 }}>
                                    <DataGrid
                                        rows={schedules}
                                        columns={columns}
                                        getRowId={(row) => row.scheduleId}
                                        loading={loadingSchedules}
                                        hideFooter
                                        disableRowSelectionOnClick
                                        sx={{ width: '100%', height: '100%' }}
                                    />
                                </Box>
                            )}
                        </Box>
                    </TabPanel>
                </DialogContent>
                {activeTab === 0 && (
                    <DialogActions>
                        <Button onClick={handleClose} disabled={submitting}>Cancel</Button>
                        <Button onClick={handleCreateSubmit} disabled={!canSubmit}>
                            {submitting ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                            <Typography>Schedule Workflow</Typography>
                        </Button>
                    </DialogActions>
                )}
                {!isMaximized && <ResizeHandle onMouseDown={handleResizeStart} />}
            </StyledDialog>

            <Dialog open={Boolean(scheduleToDelete)} onClose={() => setScheduleToDelete(null)}>
                <DialogTitle>Delete schedule?</DialogTitle>
                <DialogContent>
                    <Typography variant="body2">
                        This will permanently delete &ldquo;{scheduleToDelete?.name}&rdquo;. This can&apos;t be undone.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setScheduleToDelete(null)}>Cancel</Button>
                    <Button onClick={onConfirmDelete} color="error">Delete</Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={Boolean(snackbar)}
                autoHideDuration={4000}
                onClose={() => setSnackbar(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                {snackbar ? (
                    <Alert severity={snackbar.severity} onClose={() => setSnackbar(null)}>
                        {snackbar.message}
                    </Alert>
                ) : undefined}
            </Snackbar>
        </>
    );
}
