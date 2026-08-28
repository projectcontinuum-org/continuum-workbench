import * as React from 'react';
import DialogTitle from '@mui/material/DialogTitle';
import Dialog from '@mui/material/Dialog';
import {
  Box, Button, DialogActions, DialogContent, IconButton, TextField, Typography, styled, Tabs, Tab,
  ToggleButtonGroup, ToggleButton, InputAdornment, Slider, Autocomplete, Tooltip, FormControl, Select, MenuItem
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import MaximizeIcon from '@mui/icons-material/Fullscreen';
import RestoreIcon from '@mui/icons-material/FullscreenExit';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import { JsonForms } from '@jsonforms/react';
import {
  materialCells,
  materialRenderers
} from '@jsonforms/material-renderers';
import {
  JsonFormsCore,
  JsonSchema,
  UISchemaElement
} from '@jsonforms/core';
import CodeEditorControl, { codeEditorTester } from './CodeEditorRenderer';
import CredentialControl, { credentialTester } from './CredentialRenderer';
import { IRetryOptions } from '@continuum/core';

/**
 * Custom Tab Panel component for the dialog's own top-level Properties/Retry Policy tabs
 */
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  const isActive = value === index;
  return (
    <div
      role="tabpanel"
      hidden={!isActive}
      id={`categorization-tabpanel-${index}`}
      aria-labelledby={`categorization-tab-${index}`}
      style={isActive ? { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, minHeight: 0, overflowY: 'auto', overflowX: 'auto' } : undefined}
      {...other}
    >
      {isActive && <Box sx={{ pt: 2, minWidth: 0 }}>{children}</Box>}
    </div>
  );
}

const WORKFLOW_DEFAULT_RETRY = {
  maximumAttempts: 500,
  backoffCoefficient: 2.0,
  initialIntervalSeconds: 1,
  maximumIntervalSeconds: 100,
} as const;

const DURATION_UNITS = [
  { key: 'seconds', label: 'sec', seconds: 1 },
  { key: 'minutes', label: 'min', seconds: 60 },
  { key: 'hours', label: 'hr', seconds: 3600 },
  { key: 'days', label: 'day', seconds: 86400 },
  { key: 'weeks', label: 'wk', seconds: 604800 },
  { key: 'years', label: 'yr', seconds: 31536000 },
] as const;

function pickBestUnit(totalSeconds: number) {
  for (let i = DURATION_UNITS.length - 1; i > 0; i--) {
    if (totalSeconds % DURATION_UNITS[i].seconds === 0) return DURATION_UNITS[i];
  }
  return DURATION_UNITS[0];
}

interface DurationInputProps {
  label: string;
  valueSeconds: number;
  disabled?: boolean;
  onChange: (totalSeconds: number) => void;
}

/**
 * Number input + unit dropdown (sec/min/hr/day/wk/yr) that always stores and emits plain
 * seconds, so callers never need to convert units themselves.
 */
function DurationInput({ label, valueSeconds, disabled, onChange }: DurationInputProps) {
  const [unit, setUnit] = React.useState(() => pickBestUnit(valueSeconds));

  React.useEffect(() => { setUnit(pickBestUnit(valueSeconds)); }, [valueSeconds]);

  const displayValue = valueSeconds / unit.seconds;

  return (
    <Box sx={{ display: 'flex', gap: 1 }}>
      <TextField
        type="number"
        label={label}
        value={displayValue}
        disabled={disabled}
        sx={{ flex: 1 }}
        onChange={(e) => onChange(Number(e.target.value) * unit.seconds)}
      />
      <FormControl size="small" sx={{ minWidth: 90 }} disabled={disabled}>
        <Select
          value={unit.key}
          onChange={(e) => {
            const next = DURATION_UNITS.find(u => u.key === e.target.value)!;
            setUnit(next);
            onChange(displayValue * next.seconds);
          }}
        >
          {DURATION_UNITS.map(u => <MenuItem key={u.key} value={u.key}>{u.label}</MenuItem>)}
        </Select>
      </FormControl>
    </Box>
  );
}

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
      overflow: 'hidden',
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

const MIN_DIALOG_WIDTH = 400;
const MIN_DIALOG_HEIGHT = 300;

console.log('[NodeDialog] Registering custom renderers including CredentialControl');

const customRenderers = [
  { tester: codeEditorTester, renderer: CodeEditorControl },
  { tester: credentialTester, renderer: CredentialControl },
  ...materialRenderers,
];

export interface NodeDialogProps {
    open: boolean;
    // selectedValue: string;
    onClose: (value: any) => void;
    onSave: (data: any, retryOptions?: IRetryOptions) => void;
    initialData?: any;
    dataSchema?: JsonSchema;
    uiSchema?: UISchemaElement;
    readOnly?: boolean;
    initialRetryOptions?: IRetryOptions;
}

type RetryField = 'maximumAttempts' | 'backoffCoefficient' | 'initialIntervalSeconds' | 'maximumIntervalSeconds';

export default function NodeDialog({ onClose, onSave, readOnly=false, open, initialData, dataSchema, uiSchema, initialRetryOptions }: NodeDialogProps) {

    const [data, setData] = React.useState(initialData);
    const [hasErrors, setHasErrors] = React.useState(false);
    const [dialogSize, setDialogSize] = React.useState({ width: 600, height: 600 });
    const [isResizing, setIsResizing] = React.useState(false);
    const [isMaximized, setIsMaximized] = React.useState(false);
    const resizeStartPos = React.useRef({ x: 0, y: 0, width: 0, height: 0 });
    const previousSize = React.useRef({ width: 600, height: 600 });
    const [retryOptions, setRetryOptions] = React.useState<IRetryOptions>(initialRetryOptions || {});
    const [activeTopTab, setActiveTopTab] = React.useState(0);
    const [overrides, setOverrides] = React.useState<Record<RetryField, boolean>>(() => ({
        maximumAttempts: initialRetryOptions?.maximumAttempts !== undefined,
        backoffCoefficient: initialRetryOptions?.backoffCoefficient !== undefined,
        initialIntervalSeconds: initialRetryOptions?.initialIntervalSeconds !== undefined,
        maximumIntervalSeconds: initialRetryOptions?.maximumIntervalSeconds !== undefined,
    }));

    const setFieldOverride = React.useCallback((field: RetryField, isCustom: boolean) => {
        setOverrides(o => ({ ...o, [field]: isCustom }));
        setRetryOptions(r => ({
            ...r,
            [field]: isCustom ? WORKFLOW_DEFAULT_RETRY[field] : undefined
        }));
    }, [setOverrides, setRetryOptions]);

    const resetRetryToDefaults = React.useCallback(() => {
        setOverrides({
            maximumAttempts: false,
            backoffCoefficient: false,
            initialIntervalSeconds: false,
            maximumIntervalSeconds: false,
        });
        setRetryOptions(r => ({ ...r, maximumAttempts: undefined, backoffCoefficient: undefined, initialIntervalSeconds: undefined, maximumIntervalSeconds: undefined }));
    }, [setOverrides, setRetryOptions]);

    const handleClose = React.useCallback((args: any) => {
        console.log("handleClose", args);
        onClose(data);
    }, [data]);

    const onSavePressed = React.useCallback((args: any) => {
        console.log("onSavePressed", args);
        onSave(data, retryOptions);
    }, [data, retryOptions, onSave]);

    const onDataChange = React.useCallback(({errors, data}: Pick<JsonFormsCore, "data" | "errors">) => {
        setData(data);
        errors && setHasErrors(errors.length > 0)
    }, [data]);

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

    return (
        <StyledDialog
            open={open}
            onClose={handleClose}
            customWidth={dialogSize.width}
            customHeight={dialogSize.height}>
            <DialogTitle>Node Settings</DialogTitle>
            <IconButton
                aria-label="maximize"
                onClick={handleMaximize}
                sx={{
                    position: 'absolute',
                    right: 48,
                    top: 8,
                    color: (theme) => theme.palette.grey[500],
                }}>
                {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
            </IconButton>
            <IconButton
                aria-label="close"
                onClick={handleClose}
                sx={{
                    position: 'absolute',
                    right: 8,
                    top: 8,
                    color: (theme) => theme.palette.grey[500],
                }}>
                <CloseIcon />
            </IconButton>
            <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
                <Tabs
                    value={activeTopTab}
                    onChange={(_, v) => setActiveTopTab(v)}
                    sx={{ minHeight: 'auto', borderBottom: 1, borderColor: 'divider', mb: 1 }}>
                    <Tab label="Properties" />
                    <Tab icon={<RefreshIcon fontSize="small" />} iconPosition="start" label="Retry Policy" />
                </Tabs>
                <TabPanel value={activeTopTab} index={0}>
                    <Box sx={{
                        width: '100%',
                        minWidth: 0,
                        boxSizing: 'border-box',
                        display: 'flex',
                        flexDirection: 'column',
                        p: 2,
                      }}>
                        <Box sx={{
                            width: '100%',
                            minWidth: 0,
                            boxSizing: 'border-box',
                            display: 'flex',
                            flexDirection: 'column',
                            // Some renderers (notably the stock MaterialTableControl used for
                            // plain array-of-objects Controls) render a bare <Table> with no
                            // wrapping <TableContainer>, so a wide row (long free-text cell
                            // value, many columns) sizes to its own content width instead of
                            // shrinking to the dialog. `hidden` here would silently clip that
                            // content (or, for descendants whose containing block escapes this
                            // box, let it render outside the dialog's bounds); `auto` instead
                            // gives the dialog its own contained horizontal scrollbar.
                            overflowX: 'auto',
                            // Setting only overflowX makes browsers implicitly promote
                            // overflowY to 'auto' too (CSS overflow computed-value rule), which
                            // stacks a 3rd nested auto-scroll container on top of this Box's own
                            // parent (overflowY: 'auto') and the outer `tabpanel` div (also
                            // overflow: auto). Competing "scroll into view" adjustments from
                            // multiple ancestors on focus is what clips/shifts a field's
                            // floating label when you click into it. `tabpanel` is the single,
                            // correctly height-bounded scroll owner -- keep this box (and its
                            // parent, above) as non-scrolling so there's only one.
                            overflowY: 'visible',
                            // JsonForms' stock MaterialLayoutRenderer renders every layout's
                            // Grid container without `wrap="nowrap"`, so column-direction
                            // (VerticalLayout/Group) containers default to flexWrap: 'wrap'.
                            // That's semantically wrong for a single stacked column and is what
                            // inflates item heights; row-direction (HorizontalLayout) containers
                            // are left alone since their wrap is the intended responsive reflow.
                            '& .MuiGrid-container[class*="MuiGrid-direction-xs-column"]': {
                              flexWrap: 'nowrap',
                            },
                            // MaterialGroupLayoutRenderer forwards a `direction` prop that
                            // JsonForms' own dispatch never actually supplies (only Vertical/
                            // HorizontalLayout hardcode their own), so it's always undefined and
                            // MUI Grid's own default (direction: 'row', wrap: 'wrap') silently
                            // applies to every Group's content instead of a stacked column.
                            '& .MuiCardContent-root > .MuiGrid-container': {
                              flexDirection: 'column',
                              flexWrap: 'nowrap',
                            },
                            // @jsonforms/material-renderers@3.7.0's ArrayLayoutToolbar (array
                            // control title bar) and TableToolbar (plain table control title
                            // row) both render their label as
                            // `<Grid container spacing={2}><Grid><Typography variant="h6">`.
                            // That markup targets material-renderers' actual peer dependency,
                            // @mui/material@^7 (its `Grid` has no `item` prop and spaces
                            // children with plain `gap`), but this app pins
                            // @mui/material@^5.15.6, whose *classic* Grid still implements
                            // `spacing` via a negative `margin-left`/oversized `width` on the
                            // container -- applied unconditionally whenever `container` is set,
                            // regardless of whether children carry the compensating
                            // `.MuiGrid-item` class. Since material-renderers' own children never
                            // pass `item` (that's the v7-only API it was written against), the
                            // compensating padding never lands, so the title bleeds
                            // `-theme.spacing(2)` (16px by default) to the left of the
                            // container with nothing to counteract it. Under `overflowX:
                            // 'hidden'` that overflowing paint was still visible; now that this
                            // box is a real scroll container (`overflowX: 'auto'`, needed to fix
                            // wide-table overflow above), content left of the padding box at
                            // scrollLeft 0 is genuinely clipped, cropping the first character(s)
                            // of the label (e.g. "Workflow Variables" -> "orkflow Variables").
                            // Neutralize just the uncompensated bleed on these two specific,
                            // known-mispaired Grids (Toolbar for array-with-detail/accordion
                            // controls, TableCell for plain array-of-objects tables) and restore
                            // the intended gap between the label and its optional validation
                            // icon with `columnGap` instead, rather than touching `.MuiGrid-
                            // container` globally (which would also affect legitimately-paired
                            // container+item Grids elsewhere that still rely on this negative-
                            // margin/padding compensation to align correctly).
                            '& .MuiToolbar-root .MuiGrid-container[class*="MuiGrid-spacing-xs-"], & .MuiTableCell-root .MuiGrid-container[class*="MuiGrid-spacing-xs-"]': {
                              marginLeft: 0,
                              width: '100%',
                              columnGap: 2,
                            },
                          }}>
                            <JsonForms
                                schema={dataSchema}
                                uischema={uiSchema}
                                data={data}
                                renderers={customRenderers}
                                cells={materialCells}
                                onChange={onDataChange}/>
                        </Box>
                    </Box>
                </TabPanel>
                <TabPanel value={activeTopTab} index={1}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2, width: '100%', boxSizing: 'border-box' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <Button size="small" onClick={resetRetryToDefaults} disabled={readOnly}>
                                Reset to workflow defaults
                            </Button>
                        </Box>

                        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2 }}>
                            <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 600 }}>
                                Attempts &amp; Backoff
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

                                <Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Maximum Attempts</Typography>
                                            <Tooltip title="How many times a failed node retries before the workflow gives up. 0 means unlimited attempts.">
                                                <InfoOutlinedIcon fontSize="small" color="action" />
                                            </Tooltip>
                                        </Box>
                                        <ToggleButtonGroup
                                            size="small"
                                            exclusive
                                            value={overrides.maximumAttempts ? 'custom' : 'default'}
                                            disabled={readOnly}
                                            onChange={(_, v) => v && setFieldOverride('maximumAttempts', v === 'custom')}
                                        >
                                            <ToggleButton value="default" sx={{ fontSize: '11px', padding: '2px 6px', textTransform: 'none' }}>Default</ToggleButton>
                                            <ToggleButton value="custom" sx={{ fontSize: '11px', padding: '2px 6px', textTransform: 'none' }}>Custom</ToggleButton>
                                        </ToggleButtonGroup>
                                    </Box>
                                    <TextField
                                        type="number"
                                        fullWidth
                                        disabled={readOnly || !overrides.maximumAttempts}
                                        value={overrides.maximumAttempts ? (retryOptions.maximumAttempts ?? '') : WORKFLOW_DEFAULT_RETRY.maximumAttempts}
                                        onChange={(e) => setRetryOptions(r => ({ ...r, maximumAttempts: e.target.value === '' ? undefined : Number(e.target.value) }))}
                                        InputProps={{ endAdornment: <InputAdornment position="end">attempts</InputAdornment> }}
                                    />
                                </Box>

                                <Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Backoff Coefficient</Typography>
                                            <Tooltip title="Multiplier applied to the retry interval after each attempt. Higher values back off faster.">
                                                <InfoOutlinedIcon fontSize="small" color="action" />
                                            </Tooltip>
                                        </Box>
                                        <ToggleButtonGroup
                                            size="small"
                                            exclusive
                                            value={overrides.backoffCoefficient ? 'custom' : 'default'}
                                            disabled={readOnly}
                                            onChange={(_, v) => v && setFieldOverride('backoffCoefficient', v === 'custom')}
                                        >
                                            <ToggleButton value="default" sx={{ fontSize: '11px', padding: '2px 6px', textTransform: 'none' }}>Default</ToggleButton>
                                            <ToggleButton value="custom" sx={{ fontSize: '11px', padding: '2px 6px', textTransform: 'none' }}>Custom</ToggleButton>
                                        </ToggleButtonGroup>
                                    </Box>
                                    <TextField
                                        type="number"
                                        fullWidth
                                        disabled={readOnly || !overrides.backoffCoefficient}
                                        value={overrides.backoffCoefficient ? (retryOptions.backoffCoefficient ?? '') : WORKFLOW_DEFAULT_RETRY.backoffCoefficient}
                                        onChange={(e) => setRetryOptions(r => ({ ...r, backoffCoefficient: e.target.value === '' ? undefined : Number(e.target.value) }))}
                                        InputProps={{ endAdornment: <InputAdornment position="end">×</InputAdornment> }}
                                    />
                                    <Slider
                                        size="small"
                                        min={1.0}
                                        max={5.0}
                                        step={0.1}
                                        disabled={readOnly || !overrides.backoffCoefficient}
                                        value={overrides.backoffCoefficient ? (retryOptions.backoffCoefficient ?? WORKFLOW_DEFAULT_RETRY.backoffCoefficient) : WORKFLOW_DEFAULT_RETRY.backoffCoefficient}
                                        onChange={(_, v) => setRetryOptions(r => ({ ...r, backoffCoefficient: v as number }))}
                                        sx={{ mt: 1 }}
                                    />
                                </Box>

                                <Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Initial Interval</Typography>
                                            <Tooltip title="How long to wait before the first retry attempt.">
                                                <InfoOutlinedIcon fontSize="small" color="action" />
                                            </Tooltip>
                                        </Box>
                                        <ToggleButtonGroup
                                            size="small"
                                            exclusive
                                            value={overrides.initialIntervalSeconds ? 'custom' : 'default'}
                                            disabled={readOnly}
                                            onChange={(_, v) => v && setFieldOverride('initialIntervalSeconds', v === 'custom')}
                                        >
                                            <ToggleButton value="default" sx={{ fontSize: '11px', padding: '2px 6px', textTransform: 'none' }}>Default</ToggleButton>
                                            <ToggleButton value="custom" sx={{ fontSize: '11px', padding: '2px 6px', textTransform: 'none' }}>Custom</ToggleButton>
                                        </ToggleButtonGroup>
                                    </Box>
                                    <DurationInput
                                        label="Initial Interval"
                                        disabled={readOnly || !overrides.initialIntervalSeconds}
                                        valueSeconds={overrides.initialIntervalSeconds ? (retryOptions.initialIntervalSeconds ?? WORKFLOW_DEFAULT_RETRY.initialIntervalSeconds) : WORKFLOW_DEFAULT_RETRY.initialIntervalSeconds}
                                        onChange={(seconds) => setRetryOptions(r => ({ ...r, initialIntervalSeconds: seconds }))}
                                    />
                                </Box>

                                <Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Maximum Interval</Typography>
                                            <Tooltip title="The retry interval is capped at this value, no matter how many attempts have passed.">
                                                <InfoOutlinedIcon fontSize="small" color="action" />
                                            </Tooltip>
                                        </Box>
                                        <ToggleButtonGroup
                                            size="small"
                                            exclusive
                                            value={overrides.maximumIntervalSeconds ? 'custom' : 'default'}
                                            disabled={readOnly}
                                            onChange={(_, v) => v && setFieldOverride('maximumIntervalSeconds', v === 'custom')}
                                        >
                                            <ToggleButton value="default" sx={{ fontSize: '11px', padding: '2px 6px', textTransform: 'none' }}>Default</ToggleButton>
                                            <ToggleButton value="custom" sx={{ fontSize: '11px', padding: '2px 6px', textTransform: 'none' }}>Custom</ToggleButton>
                                        </ToggleButtonGroup>
                                    </Box>
                                    <DurationInput
                                        label="Maximum Interval"
                                        disabled={readOnly || !overrides.maximumIntervalSeconds}
                                        valueSeconds={overrides.maximumIntervalSeconds ? (retryOptions.maximumIntervalSeconds ?? WORKFLOW_DEFAULT_RETRY.maximumIntervalSeconds) : WORKFLOW_DEFAULT_RETRY.maximumIntervalSeconds}
                                        onChange={(seconds) => setRetryOptions(r => ({ ...r, maximumIntervalSeconds: seconds }))}
                                    />
                                </Box>

                            </Box>
                        </Box>

                        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2 }}>
                            <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 600 }}>
                                Non-Retryable Errors
                            </Typography>
                            <Autocomplete
                                multiple
                                freeSolo
                                size="small"
                                options={[] as string[]}
                                value={retryOptions.doNotRetry || []}
                                disabled={readOnly}
                                onChange={(_, values) => setRetryOptions(r => ({ ...r, doNotRetry: values.length ? values : undefined }))}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Non-retryable error types"
                                        placeholder="Type an error type and press Enter"
                                        helperText="Nodes throwing one of these error types fail immediately instead of retrying."
                                    />
                                )}
                            />
                        </Box>
                    </Box>
                </TabPanel>
            </DialogContent>
            <DialogActions>
                <Button autoFocus onClick={handleClose}>
                    Cancel
                </Button>
                <Button
                    autoFocus
                    onClick={onSavePressed}
                    disabled={hasErrors || readOnly}>
                    <Typography>Save changes</Typography>
                </Button>
            </DialogActions>
            {!isMaximized && <ResizeHandle onMouseDown={handleResizeStart} />}
        </StyledDialog>
    );
}