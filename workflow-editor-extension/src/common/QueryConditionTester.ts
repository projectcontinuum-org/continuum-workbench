import { isControl, rankWith } from '@jsonforms/core';

export const queryConditionTester = rankWith(
    10,
    (uischema) => isControl(uischema) && uischema.options?.format === 'query',
);
