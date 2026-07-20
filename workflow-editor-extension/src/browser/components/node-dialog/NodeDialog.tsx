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
import { JsonForms, JsonFormsDispatch, withJsonFormsLayoutProps } from '@jsonforms/react';
import {
  materialCells,
  materialRenderers
} from '@jsonforms/material-renderers';
import {
  JsonFormsCore,
  JsonSchema,
  UISchemaElement,
  rankWith,
  uiTypeIs,
  and,
  categorizationHasCategory,
  Categorization,
  Category,
  LayoutProps,
  GroupLayout
} from '@jsonforms/core';
import CodeEditorControl, { codeEditorTester } from './CodeEditorRenderer';
import CredentialControl, { credentialTester } from './CredentialRenderer';
import { IRetryOptions } from '@continuum/core';

/**
 * Custom Group Layout Renderer
 * Renders a group that stretches horizontally to fill parent but shrinks vertically to fit children
 */
const MaterialGroupLayoutRenderer = (props: LayoutProps) => {
  const { uischema, schema, path, visible, renderers, cells } = props;

  const groupLayout = uischema as GroupLayout;
  const label = groupLayout.label;

  if (!visible) {
    return null;
  }

  return (
    <Box
      sx={{
        mb: 2,
        p: 2,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        width: '100%',
      }}
    >
      {label && (
        <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 600 }}>
          {label}
        </Typography>
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {groupLayout.elements?.map((element, index) => (
          <JsonFormsDispatch
            key={`${path}-group-${index}`}
            uischema={element}
            schema={schema}
            path={path}
            renderers={renderers}
            cells={cells}
          />
        ))}
      </Box>
    </Box>
  );
};

// Wrap with JSON Forms HOC to inject props
const MaterialGroupLayout = withJsonFormsLayoutProps(MaterialGroupLayoutRenderer);

/**
 * Custom tester for Group layout.
 */
const groupTester = rankWith(
  6, // Higher rank than default renderers
  uiTypeIs('Group')
);

/**
 * Custom Tab Panel component for categorization layout
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
      style={isActive ? { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'auto' } : undefined}
      {...other}
    >
      {isActive && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

/**
 * Custom Material Categorization Layout Renderer
 * Renders categories as MUI Tabs with proper tab panel content
 */
const MaterialCategorizationLayoutRenderer = (props: LayoutProps) => {
  const { uischema, schema, path, visible, renderers, cells } = props;
  const [activeTab, setActiveTab] = React.useState(0);

  const categorization = uischema as Categorization;
  // Get all Category elements from the categorization
  const categories = (categorization.elements || []).filter(
    (el): el is Category => el.type === 'Category'
  );

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  if (!visible) {
    return null;
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
        >
          {categories.map((category: Category, index: number) => (
            <Tab
              key={index}
              label={category.label || `Tab ${index + 1}`}
              id={`categorization-tab-${index}`}
              aria-controls={`categorization-tabpanel-${index}`}
            />
          ))}
        </Tabs>
      </Box>
      {categories.map((category: Category, index: number) => (
        <TabPanel key={index} value={activeTab} index={index}>
          {category.elements?.map((element, elementIndex) => (
            <JsonFormsDispatch
              key={`${path}-${index}-${elementIndex}`}
              uischema={element}
              schema={schema}
              path={path}
              renderers={renderers}
              cells={cells}
            />
          ))}
        </TabPanel>
      ))}
    </Box>
  );
};

// Wrap with JSON Forms HOC to inject props
const MaterialCategorizationLayout = withJsonFormsLayoutProps(MaterialCategorizationLayoutRenderer);

/**
 * Custom tester for Categorization layout.
 * Checks if the UI schema is a Categorization with at least one Category element.
 */
const categorizationTester = rankWith(
  6, // Higher rank than default renderers
  and(
    uiTypeIs('Categorization'),
    categorizationHasCategory
  )
);

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

const MIN_DIALOG_WIDTH = 400;
const MIN_DIALOG_HEIGHT = 300;

console.log('[NodeDialog] Registering custom renderers including CredentialControl');

const customRenderers = [
  { tester: codeEditorTester, renderer: CodeEditorControl },
  { tester: credentialTester, renderer: CredentialControl },
  { tester: categorizationTester, renderer: MaterialCategorizationLayout },
  { tester: groupTester, renderer: MaterialGroupLayout },
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
            <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <Tabs
                    value={activeTopTab}
                    onChange={(_, v) => setActiveTopTab(v)}
                    sx={{ minHeight: 'auto', borderBottom: 1, borderColor: 'divider', mb: 1 }}>
                    <Tab label="Properties" />
                    <Tab icon={<RefreshIcon fontSize="small" />} iconPosition="start" label="Retry Policy" />
                </Tabs>
                <TabPanel value={activeTopTab} index={0}>
                    <Box sx={{
                        minWidth: "500px",
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'auto',
                        p: 2,
                        // Ensure JsonForms categorization layout takes full space
                        '& > div': {
                          display: 'flex',
                          flexDirection: 'column',
                          flex: 1,
                        },
                        // Style MUI Tabs for the categorization
                        '& .MuiTabs-root': {
                          minHeight: 'auto',
                          borderBottom: 1,
                          borderColor: 'divider',
                        },
                        // Ensure tab panels display correctly
                        '& .MuiBox-root[role="tabpanel"]': {
                          flex: 1,
                          overflow: 'auto',
                          pt: 2,
                        },
                        // Fix for hidden tab panels
                        '& .MuiBox-root[role="tabpanel"][hidden]': {
                          display: 'none',
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
                </TabPanel>
                <TabPanel value={activeTopTab} index={1}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2, minWidth: "500px" }}>
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