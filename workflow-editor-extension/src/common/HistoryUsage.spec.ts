import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { historyUsagePercent } from './HistoryUsage';

describe('historyUsagePercent', () => {
    it('is the share of the cap used', () => {
        assert.equal(historyUsagePercent(12800, 51200), 25);
    });
    it('clamps to 100', () => {
        assert.equal(historyUsagePercent(60000, 51200), 100);
    });
    it('is undefined when data is missing or the cap is invalid', () => {
        assert.equal(historyUsagePercent(undefined, 51200), undefined);
        assert.equal(historyUsagePercent(10, undefined), undefined);
        assert.equal(historyUsagePercent(10, 0), undefined);
    });
});
