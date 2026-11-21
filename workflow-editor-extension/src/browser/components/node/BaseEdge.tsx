import * as React from "react";
import { EdgeProps, getBezierPath } from "reactflow";
import { IEdgeData } from "@continuum/core";
import { edgeStatusPresentation } from "../../../common/ExecutionStatusPresentation";
import "./BaseEdge.css"

const BREAK_MARK_HALF_SIZE = 5;

export default class BaseEdge extends React.Component<any, any> {
    private xEqual = this.props.sourceX === this.props.targetX;
    private yEqual = this.props.sourceY === this.props.targetY;
    private edgePath: any;

    constructor(public props: EdgeProps<IEdgeData>) {
        super(props);
    }

    render(): React.ReactNode {
        const [edgePath, midX, midY] = getBezierPath({
            // we need this little hack in order to display the gradient for a straight line
            sourceX: this.xEqual ? this.props.sourceX + 0.0001 : this.props.sourceX,
            sourceY: this.yEqual ? this.props.sourceY + 0.0001 : this.props.sourceY,
            sourcePosition: this.props.sourcePosition,
            targetX: this.props.targetX,
            targetY: this.props.targetY,
            targetPosition: this.props.targetPosition
        });
        this.edgePath = edgePath;
        const presentation = edgeStatusPresentation(this.props.data?.status);
        return (
            <>
                <path
                    id={this.props.id}
                    style={this.props.style}
                    className={presentation ? `react-flow__edge-path ${presentation.className}` : "react-flow__edge-path"}
                    d={this.edgePath}
                    markerStart={this.props.markerStart}
                    markerEnd={this.props.markerEnd}>
                    {presentation && <title>{presentation.title}</title>}
                </path>
                {presentation?.breakMark && (
                    <path
                        className="continuum-edge__break-mark"
                        d={`M ${midX - BREAK_MARK_HALF_SIZE} ${midY - BREAK_MARK_HALF_SIZE} L ${midX + BREAK_MARK_HALF_SIZE} ${midY + BREAK_MARK_HALF_SIZE} ` +
                            `M ${midX + BREAK_MARK_HALF_SIZE} ${midY - BREAK_MARK_HALF_SIZE} L ${midX - BREAK_MARK_HALF_SIZE} ${midY + BREAK_MARK_HALF_SIZE}`}>
                        <title>{presentation.title}</title>
                    </path>
                )}
            </>
        );
    }
}
