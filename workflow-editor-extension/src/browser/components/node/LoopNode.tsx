/**
 * Loop node component — renders a Loop box on the React Flow canvas.
 *
 * Displays: dashed rounded box with a header (title, condition summary, status),
 * progress indicator and status badge; members render inside via React Flow's nested node model.
 */

import * as React from "react";
import { Handle, NodeProps, NodeResizer, Position, useUpdateNodeInternals } from "reactflow";
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import { alpha } from '@mui/material/styles';
import Button from '@mui/material/Button';
import { IBaseNodeData, NodeStatus } from "@continuum/core";
import CircularProgress from '@mui/material/CircularProgress';
import LoopIcon from '@mui/icons-material/Loop';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { isNodeWorking, NodeStatusBadge } from './NodeStatusPresentation';
import { nodeStatusClass, nodeStatusPresentation } from '../../../common/ExecutionStatusPresentation';
import {
    conditionShortFormat,
    loopConditionChipText,
    loopMemberCountLabel,
    loopNestingPresentation,
    loopNodeProgressMessage,
    loopVariableChipText,
} from '../../../common/LoopPresentation';
import { fitsBuilder, parseCondition, DEFAULT_LOOP_CONDITION } from '../../../common/LoopConditionQuery';
import type { LoopRuntimeSummary } from '../../../common/LoopRuntimePresentation';
import { collapsedLoopHandleId } from '../../../common/LoopTopology';
import '@reactflow/node-resizer/dist/style.css';
import './LoopNode.css';

const CONDITION_MAX_LENGTH = 36;

interface LoopNodeCanvasData extends IBaseNodeData {
    collapsed?: boolean;
    iterationCount?: number;
    resizeMinWidth?: number;
    resizeMinHeight?: number;
}

interface LoopNodeProps extends NodeProps {
    onToggleCollapse?: () => void;
    onResizeLoop?: (nodeId: string, width: number, height: number) => void;
    onResizeCommit?: () => void;
    onOpenSettings?: () => void;
    memberCount?: number;
    nestingDepth?: number;
    runtimeSummary?: LoopRuntimeSummary;
}

function LoopNode({
    id,
    data,
    selected,
    onToggleCollapse,
    onResizeLoop,
    onResizeCommit,
    onOpenSettings,
    memberCount = 0,
    nestingDepth = 0,
    runtimeSummary,
}: LoopNodeProps) {
    const nodeData = data as unknown as LoopNodeCanvasData;
    const collapsed = nodeData.collapsed ?? false;
    const conditionText = (nodeData.properties?.condition as string) ?? DEFAULT_LOOP_CONDITION;
    const status = nodeData.status ?? NodeStatus.CONFIGURED;
    const statusPresentation = nodeStatusPresentation(status);
    const fits = fitsBuilder(conditionText);
    const parsed = fits ? parseCondition(conditionText) : null;
    const shortCondition = parsed ? conditionShortFormat(parsed) : conditionText;
    const conditionLabel = loopConditionChipText(shortCondition ?? conditionText, CONDITION_MAX_LENGTH);
    const maxIterations = nodeData.properties?.maxIterations;
    const hasMaxIterations = typeof maxIterations === 'number' && Number.isFinite(maxIterations);
    const progressMessage = loopNodeProgressMessage(
        status,
        nodeData.nodeProgress?.message,
        nodeData.iterationCount,
        hasMaxIterations ? maxIterations : undefined,
    );
    const isWorking = isNodeWorking(status);
    const progressPct = nodeData.nodeProgress?.progressPercentage;
    const hasCelOnlyCondition = conditionText.trim().length > 0
        && !fits
        && conditionText !== DEFAULT_LOOP_CONDITION
        && !parsed;
    const borderColor = status === NodeStatus.CONFIGURED ? 'secondary.main' : statusPresentation.color;
    const nestingPresentation = loopNestingPresentation(nestingDepth);
    const showRuntimeSummary = !collapsed && runtimeSummary && runtimeSummary.variables.length > 0;
    const updateNodeInternals = useUpdateNodeInternals();
    const handleResize = React.useCallback((_event: unknown, size: { width: number; height: number }) => {
        onResizeLoop?.(id, size.width, size.height);
    }, [id, onResizeLoop]);
    const handleResizeEnd = React.useCallback((_event: unknown, size: { width: number; height: number }) => {
        onResizeLoop?.(id, size.width, size.height);
        onResizeCommit?.();
    }, [id, onResizeCommit, onResizeLoop]);

    React.useLayoutEffect(() => {
        if (collapsed) updateNodeInternals(id);
    }, [collapsed, id, updateNodeInternals]);

    return (
        <>
        <Box component="span" data-testid={`loop-resize-controls-${id}`} sx={{ display: 'contents' }}>
        <NodeResizer
            isVisible={!!selected && !!onResizeLoop && !collapsed}
            minWidth={nodeData.resizeMinWidth ?? 240}
            minHeight={nodeData.resizeMinHeight ?? 120}
            handleClassName="loop-resize-handle"
            lineClassName="loop-resize-line"
            onResize={handleResize}
            onResizeEnd={handleResizeEnd}
        />
        </Box>
        <Box
            data-testid={`loop-node-${id}`}
            className={`loop-node-body loop-nesting-depth-${nestingPresentation.level} ${nodeStatusClass(status)}${collapsed ? ' loop-node-collapsed' : ''}`}
            sx={{
                width: '100%',
                height: '100%',
                minHeight: collapsed ? 0 : 120,
                boxSizing: 'border-box',
                '--loop-border-width': `${nestingPresentation.borderWidth}px`,
                borderStyle: 'dashed',
                borderWidth: 'var(--loop-border-width)',
                borderColor: (theme) => status === NodeStatus.CONFIGURED
                    ? alpha(theme.palette.secondary.main, nestingPresentation.borderOpacity)
                    : borderColor,
                borderRadius: 2,
                backgroundColor: (theme) => alpha(
                    nestingDepth > 0 ? theme.palette.secondary.main : theme.palette.secondary.dark,
                    nestingPresentation.fillOpacity,
                ),
                position: 'relative',
            }}
        >
            {collapsed && <CollapsedEdgeAnchors />}
            <Box className="loop-node-header">
                <Box className="loop-node-identity">
                    <LoopIcon className="loop-node-icon" />
                    <Typography className="loop-node-kind">LOOP</Typography>
                    <Typography className="loop-node-id" title={`Loop node ID: ${id}`}>
                        #{id}
                    </Typography>
                    <Tooltip title={`while ${conditionText}`} placement="top">
                        <Box className="loop-condition-chip">
                            <Typography className="loop-condition-text">{conditionLabel}</Typography>
                        </Box>
                    </Tooltip>
                    {hasMaxIterations && (
                        <Typography className="loop-maximum">· max {maxIterations}</Typography>
                    )}
                    {hasCelOnlyCondition && (
                        <Tooltip title="This condition uses CEL features the builder cannot show">
                            <Box
                                className="loop-cel-warning"
                                aria-label="CEL-only expression"
                                data-testid="loop-cel-only-badge">
                                <WarningAmberRoundedIcon fontSize="small" />
                                <Typography component="span">CEL-only expression</Typography>
                            </Box>
                        </Tooltip>
                    )}
                </Box>
                <Box className="loop-node-actions">
                    {isWorking && (
                        <CircularProgress
                            size={18}
                            variant={progressPct == null ? 'indeterminate' : 'determinate'}
                            value={progressPct}
                            sx={{ color: statusPresentation.color }}
                        />
                    )}
                    {!isWorking && status !== NodeStatus.CONFIGURED && (
                        <Box className="loop-node-status" sx={{ color: statusPresentation.color }}>
                            <NodeStatusBadge status={status} />
                            <Typography variant="caption">
                                {statusPresentation.label}
                                {nodeData.iterationCount != null ? ` (${nodeData.iterationCount} iter.)` : ''}
                            </Typography>
                        </Box>
                    )}
                    {!collapsed && onToggleCollapse && (
                        <Button
                            size="small"
                            variant="outlined"
                            className="nodrag nopan loop-collapse-header-button"
                            aria-label="Collapse loop"
                            aria-expanded="true"
                            data-testid="loop-collapse-toggle"
                            onClick={(event) => {
                                event.stopPropagation();
                                onToggleCollapse();
                            }}>
                            ▾ collapse
                        </Button>
                    )}
                    {onOpenSettings && (
                        <Tooltip title="Loop settings">
                            <IconButton
                                size="small"
                                className="nodrag nopan loop-settings-button"
                                aria-label="Open loop settings"
                                data-testid="loop-settings-button"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onOpenSettings();
                                }}>
                                <SettingsOutlinedIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}
                </Box>
            </Box>
            {collapsed ? (
                <Box className="loop-collapsed-body">
                    <Typography className="loop-member-count">
                        {loopMemberCountLabel(memberCount)}
                    </Typography>
                    <Button
                        size="small"
                        variant="outlined"
                        className="nodrag nopan loop-expand-button"
                        aria-label="Expand loop"
                        aria-expanded="false"
                        data-testid="loop-collapse-toggle"
                        disabled={!onToggleCollapse}
                        onClick={(event) => {
                            event.stopPropagation();
                            onToggleCollapse?.();
                        }}>
                        ▸ expand
                    </Button>
                </Box>
            ) : (
                <>
                    {showRuntimeSummary && (
                        <Box className="loop-runtime-summary">
                            <Typography
                                className="loop-runtime-source"
                                title={`set by: ${runtimeSummary.sourceLabel} (inside)`}>
                                set by: {runtimeSummary.sourceLabel} (inside)
                            </Typography>
                            <Box
                                className="loop-variable-chips"
                                data-testid={`loop-runtime-variables-${id}`}
                                role="region"
                                aria-label="Loop carried variables"
                                tabIndex={0}>
                                {runtimeSummary.variables.map(({ name, value }) => (
                                    <Typography
                                        component="span"
                                        className="loop-variable-chip"
                                        title={loopVariableChipText(name, value)}
                                        key={name}>
                                        {loopVariableChipText(name, value)}
                                    </Typography>
                                ))}
                            </Box>
                        </Box>
                    )}
                    {progressMessage && (
                        <Typography className="loop-progress-message" title={progressMessage}>
                            {progressMessage}
                        </Typography>
                    )}
                </>
            )}
        </Box>
        </>
    );
}

function CollapsedEdgeAnchors() {
    const anchorStyle: React.CSSProperties = {
        width: 1,
        height: 1,
        minWidth: 1,
        minHeight: 1,
        padding: 0,
        border: 0,
        opacity: 0,
        pointerEvents: 'none',
        position: 'absolute',
        top: '50%',
        margin: 0,
        transform: 'translate(-50%, -50%)',
    };
    return (
        <>
            <Handle
                id={collapsedLoopHandleId('source', 'left')}
                type="source"
                position={Position.Left}
                isConnectable={false}
                className="loop-edge-anchor"
                style={{ ...anchorStyle, left: 0, right: 'auto' }}
            />
            <Handle
                id={collapsedLoopHandleId('source', 'right')}
                type="source"
                position={Position.Right}
                isConnectable={false}
                className="loop-edge-anchor"
                style={{ ...anchorStyle, left: 'auto', right: 0 }}
            />
            <Handle
                id={collapsedLoopHandleId('target', 'left')}
                type="target"
                position={Position.Left}
                isConnectable={false}
                className="loop-edge-anchor"
                style={{ ...anchorStyle, left: 0, right: 'auto' }}
            />
            <Handle
                id={collapsedLoopHandleId('target', 'right')}
                type="target"
                position={Position.Right}
                isConnectable={false}
                className="loop-edge-anchor"
                style={{ ...anchorStyle, left: 'auto', right: 0 }}
            />
        </>
    );
}

export default LoopNode;
