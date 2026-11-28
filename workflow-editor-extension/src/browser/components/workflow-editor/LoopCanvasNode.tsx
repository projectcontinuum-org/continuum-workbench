import React from 'react';
import { NodeProps } from 'reactflow';
import {
    descendants,
    enclosingLoops,
    GraphLike,
} from '../../../common/LoopTopology';
import { IBaseNodeData } from '@continuum/core';
import BaseNode from '../node/BaseNode';
import LoopNode from '../node/LoopNode';

export interface LoopCanvasNodeContextValue {
    graph: GraphLike;
    toggleCollapsed: (loopId: string) => void;
    resize: (loopId: string, width: number, height: number) => void;
    finishResize: () => void;
    openSettings?: (loopId: string) => void;
}

const LoopCanvasNodeContext = React.createContext<LoopCanvasNodeContextValue | undefined>(undefined);

interface LoopCanvasNodeProviderProps extends React.PropsWithChildren {
    value: LoopCanvasNodeContextValue;
}

export function LoopCanvasNodeProvider({ value, children }: LoopCanvasNodeProviderProps) {
    return (
        <LoopCanvasNodeContext.Provider value={value}>
            {children}
        </LoopCanvasNodeContext.Provider>
    );
}

export function LoopCanvasNodeRenderer(props: NodeProps) {
    const context = React.useContext(LoopCanvasNodeContext);
    if (!context) throw new Error('Loop canvas node renderer requires its canvas context.');

    const { id } = props;
    const toggleCollapsed = React.useCallback(
        () => context.toggleCollapsed(id),
        [context.toggleCollapsed, id],
    );
    const resize = React.useCallback(
        (loopId: string, width: number, height: number) => context.resize(loopId, width, height),
        [context.resize],
    );
    const finishResize = React.useCallback(
        () => context.finishResize(),
        [context.finishResize],
    );
    const openSettings = React.useCallback(
        () => context.openSettings?.(id),
        [context.openSettings, id],
    );

    return (
        <LoopNode
            {...props}
            onToggleCollapse={toggleCollapsed}
            onResizeLoop={resize}
            onResizeCommit={finishResize}
            onOpenSettings={openSettings}
            memberCount={descendants(id, context.graph).size}
            nestingDepth={enclosingLoops(id, context.graph).length}
        />
    );
}

/** Editor-canvas BaseNode: adds the settings button wired to the canvas context. */
export function BaseCanvasNodeRenderer(props: NodeProps<IBaseNodeData>) {
    const context = React.useContext(LoopCanvasNodeContext);
    const { id } = props;
    const openSettings = React.useCallback(
        () => context?.openSettings?.(id),
        [context?.openSettings, id],
    );
    return <BaseNode {...props} onOpenSettings={context?.openSettings ? openSettings : undefined} />;
}
