import "reactflow/dist/base.css";
import './WorkflowEditor.css';

import React, { forwardRef, useImperativeHandle } from 'react';
import { useRef, useCallback } from 'react';
import ReactFlow, { Connection, Controls, EdgeChange, Node, Panel, addEdge, applyEdgeChanges } from 'reactflow';
import BaseEdge from '../node/BaseEdge';
import { Box, Button, ButtonGroup, IconButton, Menu, MenuItem } from '@mui/material';
import { IBaseNodeData, IRetryOptions, IWorkflow } from "@continuum/core";
import NodeDialog, { NodeDialogProps } from "../node-dialog/NodeDialog";
import ScheduleWorkflowDialog from "../schedule-workflow-dialog/ScheduleWorkflowDialog";
import WorkflowService from "../../service/WorkflowService";
import LockClockIcon from '@mui/icons-material/LockClock';
import SendIcon from '@mui/icons-material/Send';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { LOOP_NODE_MODEL } from '../../../common/LoopTopology';
import { LoopDeleteChoice } from '../../../common/LoopCanvasOperations';
import { useLoopCanvas } from './useLoopCanvas';
import { LoopCanvasNodeProvider } from './LoopCanvasNode';

const edgeTypes = {
    BaseEdge
};
const defaultEdgeOptions = {
    type: "BaseEdge"
};

export interface WorkflowEditorProps {
    workflow: IWorkflow,
    onChange: (workflow: IWorkflow)=>void,
    onContextMenu?: (event: React.MouseEvent, selectedNodeId?: string)=>void,
    onHistoryChange?: ()=>void,
    onRunSuccess?: (workflowId: string)=>void,
    /** Called with a message safe to show the user when the workflow could not be started. */
    onRunFailure?: (message: string)=>void,
    onTopologyError?: (message: string) => void,
    onConfirmLoopDelete?: (loopCount: number) => Promise<LoopDeleteChoice | undefined>,
}

export interface WorkflowEditorRef {
    runWorkflow: () => void;
    openNodeSettings: () => void;
    openScheduleDialog: (initialTab?: 0 | 1) => void;
    deleteSelectedNodes: () => void;
}

const WorkflowEditor = forwardRef<WorkflowEditorRef, WorkflowEditorProps>(({ workflow, onChange, onContextMenu, onHistoryChange, onRunSuccess, onRunFailure, onTopologyError, onConfirmLoopDelete }, ref) => {
    const reactFlowRef = useRef<HTMLDivElement | null>(null);
    const workflowService = React.useMemo(() => new WorkflowService(), []);
    const [flowEdges, setFlowEdges] = React.useState(workflow.edges);
    const [flowNodes, setFlowNodes] = React.useState(workflow.nodes);
    const [isActive, _setIsActive] = React.useState(workflow.active);
    const [nodeDialogProps, setNodeDialogProps] = React.useState<NodeDialogProps | null>(null);
    const [selectedNode, setSelectedNode] = React.useState<Node<IBaseNodeData> | null>(null);
    const [scheduleMenuAnchor, setScheduleMenuAnchor] = React.useState<HTMLElement | null>(null);
    const [scheduleDialogState, setScheduleDialogState] = React.useState<{ open: boolean; initialTab: 0 | 1 }>({ open: false, initialTab: 0 });
    React.useEffect(()=>{
        if(workflow) {
            onChange({
                ...workflow,
                nodes: flowNodes,
                edges: flowEdges,
                active: isActive
            });
        }
    },[flowNodes, flowEdges, isActive])

    const onEdgesChange = useCallback((changes: EdgeChange[]) => {
        // console.log("onEdgesChange");
        setFlowEdges((edges) => applyEdgeChanges(changes, edges));
    },[setFlowEdges]);

    const onNodeConnect = useCallback((connection: Connection) => {
        // console.log("onNodeConnect");
        setFlowEdges((edges) => addEdge(connection, edges));
        // Record history when edge is added
        onHistoryChange?.();
    },[setFlowEdges, onHistoryChange]);

    const onNodesDelete = useCallback(() => {
        // Record history when nodes are deleted
        onHistoryChange?.();
    }, [onHistoryChange]);

    const onEdgesDelete = useCallback(() => {
        // Record history when edges are deleted
        onHistoryChange?.();
    }, [onHistoryChange]);

    const onRun = React.useCallback(async () => {
        console.log({ flowNodes, flowEdges });
        let workflowId: string;
        try {
            const response = await workflowService.activateWorkflow({
                id: workflow.id,
                name: workflow.name,
                active: true,
                edges: flowEdges,
                nodes: flowNodes,
            });
            workflowId = response.workflowId;
        } catch (error) {
            // The start failed. Say so, with the reason: showing "started successfully" would point at a run that
            // does not exist. The callback is separate from onRunSuccess so the widget can use its notification channel.
            console.error(error);
            onRunFailure?.(error instanceof Error ? error.message : String(error));
            return;
        }
        onRunSuccess?.(workflowId);
    }, [flowEdges, flowNodes, onRunSuccess, onRunFailure]);

    const onOpenScheduleMenu = React.useCallback((event: React.MouseEvent<HTMLElement>) => {
        setScheduleMenuAnchor(event.currentTarget);
    }, []);

    const onCloseScheduleMenu = React.useCallback(() => {
        setScheduleMenuAnchor(null);
    }, []);

    const openScheduleDialog = React.useCallback((initialTab: 0 | 1 = 0) => {
        setScheduleMenuAnchor(null);
        setScheduleDialogState({ open: true, initialTab });
    }, []);

    const onScheduleDialogClose = React.useCallback(() => {
        setScheduleDialogState(s => ({ ...s, open: false }));
    }, []);

    const onNodeDialogClose = React.useCallback(()=>{
        setNodeDialogProps(null);
    }, [setNodeDialogProps]);

    const onNodeDialogSaved = React.useCallback((properties: any, retryOptions?: IRetryOptions)=>{
        setNodeDialogProps(null);
        if(selectedNode) {
            const isLoop = selectedNode.data?.nodeModel === LOOP_NODE_MODEL;
            setFlowNodes((nodes) => nodes.map((node) => {
                if (node.id !== selectedNode.id) {
                    return node;
                }
                return {
                    ...node,
                    data: {
                        ...node.data,
                        properties,
                        ...(!isLoop ? { retryOptions } : {}),
                    },
                };
            }));
        }
    }, [selectedNode]);

    const openNodeSettings = React.useCallback((nodeId?: string) => {
        const selected = nodeId
            ? flowNodes.find((node) => node.id === nodeId)
            : flowNodes.find(n => n.selected);
        if (selected) {
            // Detect loop node for dialog behaviour.
            const isLoop = selected.data?.nodeModel === LOOP_NODE_MODEL;
            setNodeDialogProps({
                open: true,
                onClose: onNodeDialogClose,
                onSave: onNodeDialogSaved,
                initialData: selected.data.properties || {},
                dataSchema: selected.data.propertiesSchema || {},
                uiSchema: selected.data.propertiesUISchema || {},
                initialRetryOptions: selected.data.retryOptions || {},
                isLoop,
                validationWorkflow: { ...workflow, nodes: flowNodes, edges: flowEdges },
                validationNodeId: selected.id,
            });
            setSelectedNode(selected);
        }
    }, [flowNodes, flowEdges, workflow, onNodeDialogClose, onNodeDialogSaved]);

    const loopCanvas = useLoopCanvas({
        nodes: flowNodes,
        edges: flowEdges,
        setNodes: setFlowNodes,
        setEdges: setFlowEdges,
        isActive,
        onHistoryChange,
        onTopologyError,
        onConfirmLoopDelete,
        onOpenSettings: openNodeSettings,
    });

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
        runWorkflow: onRun,
        openNodeSettings,
        openScheduleDialog,
        deleteSelectedNodes: () => { void loopCanvas.deleteSelectedNodes(); },
    }), [loopCanvas.deleteSelectedNodes, onRun, openNodeSettings, openScheduleDialog]);

    const onNodeClick = React.useCallback((event: React.MouseEvent, clickedNode: Node<IBaseNodeData>) => {
        if (event.detail === 2) {
            openNodeSettings(clickedNode.id);
        }
    }, [openNodeSettings]);

    const onNodeContextMenu = React.useCallback((event: React.MouseEvent, node: Node<IBaseNodeData>) => {
        // Select the node that was right-clicked
        setFlowNodes((nodes) => nodes.map((n) => ({
            ...n,
            selected: n.id === node.id
        })));
        // Then trigger the context menu with the selected node id
        onContextMenu?.(event, node.id);
    }, [setFlowNodes, onContextMenu]);

    const onPaneContextMenu = React.useCallback((event: React.MouseEvent | MouseEvent) => {
        // Right-click on empty canvas - no node selected
        onContextMenu?.(event as React.MouseEvent, undefined);
    }, [onContextMenu]);

    const onCanvasKeyDown = React.useCallback((event: React.KeyboardEvent) => {
        const target = event.target as HTMLElement;
        if (isActive || nodeDialogProps || (event.key !== 'Backspace' && event.key !== 'Delete')
            || target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]')) {
            return;
        }
        if (!flowNodes.some((node) => node.selected)) return;
        event.preventDefault();
        event.stopPropagation();
        void loopCanvas.deleteSelectedNodes();
    }, [flowNodes, isActive, loopCanvas.deleteSelectedNodes, nodeDialogProps]);

    return (
        <Box
            onKeyDown={onCanvasKeyDown}
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
            <LoopCanvasNodeProvider value={loopCanvas.nodeContext}>
            <ReactFlow
                ref={reactFlowRef}
                    nodes={loopCanvas.displayNodes}
                    edges={loopCanvas.displayEdges}
                    onNodesChange={!isActive ? loopCanvas.onNodesChange : undefined}
                    onNodeClick={onNodeClick}
                onNodeContextMenu={onNodeContextMenu}
                    onNodeDragStart={loopCanvas.onNodeDragStart}
                onPaneContextMenu={onPaneContextMenu}
                    onNodeDragStop={loopCanvas.onNodeDragStop}
                onNodesDelete={onNodesDelete}
                onEdgesDelete={onEdgesDelete}
                onEdgesChange={!isActive ? onEdgesChange : undefined}
                onConnect={!isActive ? onNodeConnect: undefined}
                isValidConnection={loopCanvas.isValidConnection}
                nodeTypes={loopCanvas.nodeTypes}
                edgeTypes={edgeTypes}
                defaultEdgeOptions={defaultEdgeOptions}
                className="workflow-editor"
                // Deletion is handled here so a Loop's members can be kept or removed first.
                panActivationKeyCode={nodeDialogProps ? null : 'Space'}
                deleteKeyCode={null}
                fitView>
                <Controls />
                <Panel position="bottom-center">
                    <ButtonGroup variant="contained">
                        <Button onClick={onRun} endIcon={<SendIcon />}>Run</Button>
                        <Button
                            size="small"
                            aria-label="schedule workflow options"
                            aria-haspopup="menu"
                            onClick={onOpenScheduleMenu}
                            sx={{ px: 0.5 }}>
                            <ArrowDropDownIcon />
                        </Button>
                    </ButtonGroup>
                    <Menu
                        anchorEl={scheduleMenuAnchor}
                        open={Boolean(scheduleMenuAnchor)}
                        onClose={onCloseScheduleMenu}
                        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                        transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
                        <MenuItem onClick={() => openScheduleDialog(0)}>Schedule Workflow...</MenuItem>
                        <MenuItem onClick={() => openScheduleDialog(1)}>Manage Schedules...</MenuItem>
                    </Menu>
                </Panel>
                {isActive && <Panel position="top-right">
                    <IconButton aria-label="delete">
                        <LockClockIcon />
                    </IconButton>
                </Panel>}
            </ReactFlow>
            </LoopCanvasNodeProvider>
            {nodeDialogProps && <NodeDialog
                {...nodeDialogProps!!}
                onSave={onNodeDialogSaved}
                onClose={onNodeDialogClose}
                readOnly={isActive}/>}
            {scheduleDialogState.open && <ScheduleWorkflowDialog
                open={scheduleDialogState.open}
                workflowId={workflow.id}
                workflowName={workflow.name}
                nodes={flowNodes}
                edges={flowEdges}
                initialTab={scheduleDialogState.initialTab}
                onClose={onScheduleDialogClose}/>}
        </Box>
    );
});

export default WorkflowEditor;
