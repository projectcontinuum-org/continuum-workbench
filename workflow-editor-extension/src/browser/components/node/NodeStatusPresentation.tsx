import * as React from "react";
import { EdgeStatus, NodeStatus } from "@continuum/core";
import { Tooltip } from "@mui/material";
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import BlockIcon from '@mui/icons-material/Block';
import Bolt from "@mui/icons-material/Bolt";
import {
    EdgeStatusValue,
    NodeStatusBadge as BadgeKind,
    NodeStatusValue,
    nodeStatusPresentation
} from "../../../common/ExecutionStatusPresentation";

type SameValues<A extends string, B extends string> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
// Fails to compile when the presentation's status values drift from the @continuum/core enums.
export const nodeStatusValuesMatchCore: SameValues<NodeStatusValue, `${NodeStatus}`> = true;
export const edgeStatusValuesMatchCore: SameValues<EdgeStatusValue, `${EdgeStatus}`> = true;

const BADGE_ICONS: Record<BadgeKind, React.ReactElement> = {
    scheduled: <ScheduleIcon color="info" />,
    success: <CheckCircleIcon color="success" />,
    failed: <CancelIcon color="error" />,
    warning: <WarningAmberIcon color="warning" />,
    active: <Bolt color="warning" />,
    cancelled: <BlockIcon color="disabled" />,
    skipped: <SkipNextIcon color="disabled" />
};

export const nodeStatusLabel = (status: NodeStatus): string => nodeStatusPresentation(status).label;

export const nodeStatusColor = (status: NodeStatus): string => nodeStatusPresentation(status).color;

/** True while the node's activity is doing work, so a progress indicator replaces the badge. */
export const isNodeWorking = (status?: NodeStatus): boolean => !!status && nodeStatusPresentation(status).working;

export function NodeStatusBadge({ status }: { status?: NodeStatus }) {
    if (!status) return null;
    const presentation = nodeStatusPresentation(status);
    if (!presentation.badge) return null;
    return (
        <Tooltip title={presentation.description} placement="top">
            <span>{BADGE_ICONS[presentation.badge]}</span>
        </Tooltip>
    );
}
