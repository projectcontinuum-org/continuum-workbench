/**
 * Presentation helpers for loop nodes on the canvas and in run views.
 * Pure functions — no React, no dependencies on the platform stack.
 */

import { fitsBuilder, formatCondition, parseCondition } from './LoopConditionQuery';

export const LOOP_COLLAPSED_HEIGHT = 112;
export const LOOP_COLLAPSED_WIDTH = 300;

/** A collapsed Loop shrinks in width too, but never grows beyond its expanded width. */
export function loopCollapsedWidth(expandedWidth: number): number {
    return Math.min(expandedWidth, LOOP_COLLAPSED_WIDTH);
}

export interface LoopNestingPresentation {
    level: number;
    fillOpacity: number;
    borderOpacity: number;
    borderWidth: number;
}

const LOOP_NESTING_STYLES: LoopNestingPresentation[] = [
    { level: 0, fillOpacity: 0.1, borderOpacity: 0.62, borderWidth: 2 },
    { level: 1, fillOpacity: 0.115, borderOpacity: 0.72, borderWidth: 2.1 },
    { level: 2, fillOpacity: 0.13, borderOpacity: 0.82, borderWidth: 2.25 },
    { level: 3, fillOpacity: 0.14, borderOpacity: 0.9, borderWidth: 2.5 },
];

/** Increase nested Loop contrast gradually while keeping the node contents visually prominent. */
export function loopNestingPresentation(depth: number): LoopNestingPresentation {
    const level = Number.isFinite(depth) ? Math.min(3, Math.max(0, Math.floor(depth))) : 0;
    return LOOP_NESTING_STYLES[level];
}

/** Condition text truncated to fit inside a small badge/header area. */
export function conditionSummary(text: string, maxLength: number): string {
    if (!text) return '';
    return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

/** Text shown in the compact condition chip; the tooltip keeps the full expression. */
export function loopConditionChipText(conditionText: string, maxLength: number): string {
    return `while ${conditionSummary(conditionText, maxLength)}`;
}

/** Description of the nodes hidden by a collapsed Loop. */
export function loopMemberCountLabel(memberCount: number): string {
    const count = Number.isFinite(memberCount) ? Math.max(0, Math.floor(memberCount)) : 0;
    return `${count} ${count === 1 ? 'node' : 'nodes'} inside`;
}

/** Render values as readable JSON without losing string quotation marks. */
export function loopVariableChipText(name: string, value: unknown): string {
    const formattedValue = typeof value === 'string'
        ? JSON.stringify(value)
        : JSON.stringify(value) ?? String(value);
    return `${name} = ${formattedValue}`;
}

/** Whether a loop's condition fits the builder shape — shown in tooltip / label. */
export function conditionFitsBuilder(conditionText: string): boolean {
    return fitsBuilder(conditionText);
}

/** Short format of a parsed condition for display when the builder is available. */
export function conditionShortFormat(parsed: ReturnType<typeof parseCondition>): string | null {
    if (!parsed) return null;
    return formatCondition(parsed);
}

/** Normalize the loop's run message without hiding backend warning or failure details. */
export function loopRunStatusMessage(status: string, iterationCount: number): string {
    if (status === 'SUCCESS') {
        return finishedIterationsMessage(iterationCount);
    }
    if (status === 'FAILED') {
        return `Failed on iteration ${iterationCount}`;
    }
    return `${status} at iteration ${iterationCount}`;
}

/** Use the live backend progress text and correct the singular grammar on successful completion. */
export function loopNodeProgressMessage(
    status: string,
    message?: string | null,
    iterationCount?: number,
    maxIterations?: number,
): string | null {
    if (status === 'BUSY' || status === 'RUNNING') {
        const progress = message?.match(/^Iteration (\d+) of (\d+)$/);
        if (progress) return `Iteration ${progress[1]} of ${progress[2]}`;
        if (isCount(iterationCount) && isCount(maxIterations)) {
            return `Iteration ${iterationCount} of ${maxIterations}`;
        }
        return message ?? null;
    }
    if (status === 'SUCCESS') {
        const finishedCount = message?.match(/^Finished after (\d+) iterations?$/)?.[1];
        const count = isCount(iterationCount) ? iterationCount : finishedCount ? Number(finishedCount) : undefined;
        if (count !== undefined) return finishedIterationsMessage(count);
    }
    return message ?? null;
}

function finishedIterationsMessage(count: number): string {
    return `Finished after ${count} iteration${count === 1 ? '' : 's'}`;
}

function isCount(value: number | undefined): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
