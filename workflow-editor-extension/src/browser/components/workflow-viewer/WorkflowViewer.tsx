import "reactflow/dist/base.css";
import './WorkflowViewer.css';

import React, { useRef } from 'react';
import { Box, Button, CircularProgress } from "@mui/material";
import ReactFlow, { Controls, Node, NodeProps, Panel } from "reactflow";
import BaseNode from '../node/BaseNode';
import LoopNode from '../node/LoopNode';
import BaseEdge from '../node/BaseEdge';
import { IBaseNodeData, IJobUpdate, INodeToOutputsMap, IWorkflow } from '@continuum/core';
import LockClockIcon from '@mui/icons-material/LockClock';
import HourglassTopSharpIcon from '@mui/icons-material/HourglassTopSharp';
import ChecklistRtlSharpIcon from '@mui/icons-material/ChecklistRtlSharp';
import ClearSharpIcon from '@mui/icons-material/ClearSharp';
import QuestionMarkSharpIcon from '@mui/icons-material/QuestionMarkSharp';
import CancelIcon from '@mui/icons-material/Cancel';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import { hourglass } from 'ldrs'
import { useMUIThemeStore } from "../../store/MUIThemeStore";
import NodeOutputViewer from "../node-output-viewer/NodeOutputViewer";
import {
    collapsedView,
    descendants,
    enclosingLoops,
    GraphLike,
    withLoopScopedEdgeClass,
} from '../../../common/LoopTopology';
import { LOOP_COLLAPSED_HEIGHT } from '../../../common/LoopPresentation';
import { loopDisplaySize } from '../../../common/LoopCanvasOperations';
import { loopRuntimeSummary } from '../../../common/LoopRuntimePresentation';
import type { LoopRuntimeSummary } from '../../../common/LoopRuntimePresentation';
import { reserveLoopRuntimeSummarySpace } from '../../../common/LoopViewerLayout';

hourglass.register();

const edgeTypes = {
    BaseEdge
};
const defaultEdgeOptions = {
    type: "BaseEdge"
};

const TERMINAL_STATUSES: ReadonlySet<string> = new Set(['FINISHED', 'FAILED', 'CANCELLED', 'TERMINATED']);

export interface WorkflowViewerProps {
    workflowSnapshot: IWorkflow;
    executionStatus?: IJobUpdate["status"];
    nodeToOutputsMap: INodeToOutputsMap
    onCancelRequest: () => void;
    onTerminateRequest: () => void;
}

export default function WorkflowViewer({ workflowSnapshot, executionStatus, nodeToOutputsMap, onCancelRequest, onTerminateRequest }: WorkflowViewerProps) {
    const ref = useRef<HTMLDivElement | null>(null);
    const [theme] = useMUIThemeStore((state)=>([state.theme]));
    const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
    const graph = React.useMemo((): GraphLike => ({
        nodes: workflowSnapshot.nodes,
        edges: workflowSnapshot.edges,
    }), [workflowSnapshot.nodes, workflowSnapshot.edges]);
    const scopedEdges = React.useMemo(
        () => withLoopScopedEdgeClass(workflowSnapshot.nodes, workflowSnapshot.edges),
        [workflowSnapshot.nodes, workflowSnapshot.edges],
    );
    const collapsed = React.useMemo(
        () => collapsedView(workflowSnapshot.nodes, scopedEdges),
        [workflowSnapshot.nodes, scopedEdges],
    );
    const runtimeSummaries = React.useMemo(() => {
        const summaries = new Map<string, LoopRuntimeSummary | undefined>();
        workflowSnapshot.nodes
            .filter((node) => node.type === 'Loop')
            .forEach((node) => summaries.set(
                node.id,
                loopRuntimeSummary(node.id, graph, nodeToOutputsMap),
            ));
        return summaries;
    }, [workflowSnapshot.nodes, graph, nodeToOutputsMap]);
    const loopsWithSummary = React.useMemo(() => new Set(
        workflowSnapshot.nodes
            .filter((node) => node.type === 'Loop' && !node.data?.collapsed && runtimeSummaries.get(node.id))
            .map((node) => node.id),
    ), [workflowSnapshot.nodes, runtimeSummaries]);
    const runtimeLayoutNodes = React.useMemo(
        () => reserveLoopRuntimeSummarySpace(workflowSnapshot.nodes, loopsWithSummary),
        [workflowSnapshot.nodes, loopsWithSummary],
    );
    const runtimeLayoutGraph = React.useMemo((): GraphLike => ({
        nodes: runtimeLayoutNodes,
        edges: workflowSnapshot.edges,
    }), [runtimeLayoutNodes, workflowSnapshot.edges]);
    const nodeTypes = React.useMemo(() => ({
        BaseNode,
        Loop: (props: NodeProps) => (
            <LoopNode
                {...props}
                memberCount={descendants(props.id, graph).size}
                nestingDepth={enclosingLoops(props.id, graph).length}
                runtimeSummary={runtimeSummaries.get(props.id)}
            />
        ),
    }), [graph, runtimeSummaries]);
    const displayNodes = React.useMemo(
        () => runtimeLayoutNodes.map((node) => {
            if (node.type !== 'Loop') {
                return { ...node, hidden: collapsed.hiddenNodeIds.has(node.id) || node.hidden };
            }
            const expandedSize = loopDisplaySize(node.id, runtimeLayoutGraph);
            const isCollapsed = !!node.data?.collapsed;
            const height = isCollapsed ? LOOP_COLLAPSED_HEIGHT : expandedSize.height;
            return {
                ...node,
                className: `${node.className ?? ''} loop-node-wrapper`.trim(),
                width: expandedSize.width,
                height,
                zIndex: -1,
                style: { ...node.style, width: expandedSize.width, height },
                hidden: collapsed.hiddenNodeIds.has(node.id) || node.hidden,
            };
        }),
        [runtimeLayoutNodes, collapsed.hiddenNodeIds, runtimeLayoutGraph],
    );
    // Read from the live map, so the dialog follows updates of a running workflow.
    const nodeOutputs = selectedNodeId ? nodeToOutputsMap[selectedNodeId] : undefined;

    const onNodeOutputClose = React.useCallback(()=>{
        setSelectedNodeId(null);
    }, [setSelectedNodeId]);

    const onNodeDoubleClick = React.useCallback((event: React.MouseEvent, clickedNode: Node<IBaseNodeData>) => {
        console.debug("WorkflowViewer: onNodeDoubleClick", event, clickedNode, nodeToOutputsMap);
        setSelectedNodeId(nodeToOutputsMap[clickedNode.id] ? clickedNode.id : null);
    }, [setSelectedNodeId, nodeToOutputsMap]);

    const isTerminal = !!executionStatus && TERMINAL_STATUSES.has(executionStatus);

    return (
        <Box
            sx={{
                display: "flex",
                flexGrow: 1,
                bgcolor: "transparent",
                p: 0,
                position: "absolute",
                m: 1,
                bottom: 0,
                left: 0,
                right: 0,
                top: 0
            }}>
            <ReactFlow
                ref={ref}
                nodes={displayNodes}
                edges={collapsed.displayEdges}
                onNodeDoubleClick={onNodeDoubleClick}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                defaultEdgeOptions={defaultEdgeOptions}
                className="workflow-editor"
                fitView>
                <Controls />
                <Panel position="top-right">
                    {executionStatus ? (executionStatus == "PENDING" ? <HourglassTopSharpIcon fontSize='small' color="warning"/> :
                    executionStatus == "RUNNING" ? <CircularProgress size={20} color="info"/> :
                    executionStatus == "FINISHED" ? <ChecklistRtlSharpIcon fontSize='small' color="success"/> :
                    executionStatus == "FAILED" ? <ClearSharpIcon fontSize='small' color="error"/> :
                    executionStatus == "UPLOADING_RESULTS" ? <l-hourglass color={theme.palette.primary.main}/> :
                    executionStatus == "CANCELLING" || executionStatus == "TERMINATING" ? <CircularProgress size={20} color="warning"/> :
                    executionStatus == "CANCELLED" ? <CancelIcon fontSize='small' color="disabled"/> :
                    executionStatus == "TERMINATED" ? <PowerSettingsNewIcon fontSize='small' color="disabled"/> :
                    <QuestionMarkSharpIcon fontSize='small' color="warning"/>): <LockClockIcon/>}
                </Panel>
                {!isTerminal && (
                    <Panel position="bottom-center">
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button variant="outlined" color="warning" onClick={onCancelRequest} startIcon={<StopCircleIcon />}>Cancel</Button>
                            <Button variant="outlined" color="error" onClick={onTerminateRequest} startIcon={<PowerSettingsNewIcon />}>Terminate</Button>
                        </Box>
                    </Panel>
                )}
            </ReactFlow>
            {selectedNodeId && nodeOutputs && <NodeOutputViewer
                open={true}
                onClose={onNodeOutputClose}
                nodeOutputs={nodeOutputs}
                nodeId={selectedNodeId}
                workflowSnapshot={workflowSnapshot}
                nodeToOutputsMap={nodeToOutputsMap}/>}
        </Box>
    );

}