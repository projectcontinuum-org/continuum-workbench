/**
 * Loop condition validation codes and literal types — mirrors the backend contract.
 * These match the enum values in `LoopConditionIssueCode` (platform-core).
 */

/** The type of a literal value in a CEL comparison. */
export type LiteralType = 'boolean' | 'string' | 'integer' | 'double';

/** Whether this code is a validation-time issue (false) vs runtime issue (true). */
export const LOOP_CONDITION_IS_RUNTIME: Record<string, boolean> = {
    EMPTY: false,
    TOO_LONG: false,
    TOO_DEEP: false,
    SYNTAX: false,
    CHECK_ERROR: false,
    NOT_BOOLEAN: false,
    INVALID_LITERAL: false,
    REBOUND_NAME: false,
    MISSING_VARIABLE: true,
    EVALUATION_ERROR: true,
    LIMIT_EXCEEDED: true,
    NON_BOOLEAN_RESULT: true,
};
