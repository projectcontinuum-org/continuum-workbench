/**
 * Pure logic for the loop condition dialog state machine.
 *
 * The dialog has two modes:
 * - `cel`: raw CEL text (always available)
 * - `builder`: React Query Builder visual editor (only when the expression fits)
 *
 * Mode transition rules:
 * - Dialog opens → show builder if fits, else CEL.
 * - Builder → CEL: always allowed (user clicks toggle).
 * - CEL → builder: allowed when the text fits or is empty; other expressions stay in CEL with a reason.
 * - "Replace" from builder → clears condition, sets mode to CEL for a fresh start.
 */

import { fitsBuilder } from './LoopConditionQuery';
import { DEFAULT_LOOP_CONDITION } from './LoopConditionQuery';

/** The two possible display modes. */
export type ConditionMode = 'cel' | 'builder';

/** Result of the initial mode decision. */
export interface InitialModeResult {
    initialMode: ConditionMode;
}

/** Toggle result — whether CEL→builder is allowed, and why not if not. */
export interface ToggleResult {
    targetMode: ConditionMode;
    disabled: boolean;
    disabledReason: string | null;
}

/** Validation issue extracted from the workflow validation response. */
export interface ConditionIssue {
    node: string;
    property: string;
    message: string;
    column: number;
}

/** Possible status of a validation check for this loop's condition. */
export type ValidationStatus = 'not-checked' | 'checking' | 'checked' | 'issues';

/** Validation response wrapper from the hook. */
export interface ConditionValidationResponse {
    status: ValidationStatus;
    issues: ConditionIssue[];
}

/** Initial mode decision based on current condition text. */
export function initialMode(text: string, fits: (text: string) => boolean): InitialModeResult {
    if (!text || text === '') {
        return { initialMode: 'cel' };
    }
    if (fits(text)) {
        return { initialMode: 'builder' };
    }
    return { initialMode: 'cel' };
}

/** Allow an empty condition to start a new builder rule; unsupported nonempty CEL stays in text mode. */
export function canToggleToBuilder(text: string): ToggleResult {
    if (!text.trim()) {
        return {
            targetMode: 'builder',
            disabled: false,
            disabledReason: null,
        };
    }
    if (fitsBuilder(text)) {
        return { targetMode: 'builder', disabled: false, disabledReason: null };
    }
    return {
        targetMode: 'builder',
        disabled: true,
        disabledReason: 'This condition uses CEL features the builder cannot show',
    };
}

/** The replacement is applied only after the dialog's confirmation action. */
export function replaceAction(): { mode: ConditionMode; newText: string } {
    return { mode: 'builder', newText: DEFAULT_LOOP_CONDITION };
}

/** Keep an empty condition editable and explain why it cannot be saved as valid CEL. */
export function conditionRequiredMessage(text: string): string | null {
    return text.trim() ? null : 'Condition is required.';
}

/** Hide the builder warning while the user is still recovering from an empty condition. */
export function builderToggleDisabledReason(text: string): string | null {
    if (conditionRequiredMessage(text)) return null;
    return canToggleToBuilder(text).disabledReason;
}

/** Extract condition issues from a workflow validation response. */
export function conditionIssuesFor(
    issues: Array<{ node?: string | null; property?: string | null; message?: string | null; column?: number }>,
    loopId: string,
): ConditionIssue[] {
    return issues
        .filter((issue) => issue.node === loopId && issue.property === 'condition')
        .map((issue) => ({
            node: issue.node ?? loopId,
            property: issue.property ?? 'condition',
            message: issue.message ?? 'Condition validation failed',
            column: issue.column ?? 0,
        }));
}

/** Build a "Not checked" response for when the API is unavailable. */
export function notCheckedResponse(): ConditionValidationResponse {
    return { status: 'not-checked', issues: [] };
}
