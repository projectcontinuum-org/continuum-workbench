import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { IWorkflow } from '@continuum/core';
import { ContinuumWorkflowModel } from '../../../../generated/api-server';
import { conditionIssuesFor, ConditionIssue } from '../../../../common/LoopConditionDialogState';
import { withEditedLoopCondition } from '../../../../common/LoopConditionValidation';
import { reply, workflowsApi } from '../../../service/ApiClients';

const DEBOUNCE_MS = 500;

export interface ConditionValidationContextValue {
    workflow?: IWorkflow;
    loopId?: string;
}

export interface UseConditionValidationResult {
    status: 'not-checked' | 'checking' | 'checked' | 'issues';
    issues: ConditionIssue[];
}

export const ConditionValidationContext = createContext<ConditionValidationContextValue>({});

export function useConditionValidation(condition: string): UseConditionValidationResult {
    const { workflow, loopId } = useContext(ConditionValidationContext);
    const [result, setResult] = useState<UseConditionValidationResult>({ status: 'not-checked', issues: [] });
    const requestId = useRef(0);

    useEffect(() => {
        const currentRequestId = ++requestId.current;
        if (!condition.trim() || !workflow || !loopId) {
            setResult({ status: 'not-checked', issues: [] });
            return;
        }

        setResult({ status: 'checking', issues: [] });
        const timeout = window.setTimeout(async () => {
            try {
                const editedWorkflow = withEditedLoopCondition(workflow, loopId, condition);
                const response = await reply(workflowsApi.validateWorkflow({
                    continuumWorkflowModel: editedWorkflow as unknown as ContinuumWorkflowModel,
                }));
                if (currentRequestId !== requestId.current) {
                    return;
                }
                if (!response.ok) {
                    setResult({ status: 'not-checked', issues: [] });
                    return;
                }
                const issues = conditionIssuesFor(
                    [...response.data.errors, ...response.data.warnings],
                    loopId,
                );
                setResult(issues.length > 0
                    ? { status: 'issues', issues }
                    : { status: 'checked', issues: [] });
            } catch {
                if (currentRequestId === requestId.current) {
                    setResult({ status: 'not-checked', issues: [] });
                }
            }
        }, DEBOUNCE_MS);

        return () => {
            window.clearTimeout(timeout);
            requestId.current++;
        };
    }, [condition, workflow, loopId]);

    return result;
}
