import { describe, it, expect, beforeEach } from 'vitest';
import { metrics } from '../src/metrics.js';

describe('MetricsCollector', () => {
  beforeEach(() => {
    metrics.reset();
  });

  it('starts with zero counts', () => {
    const snap = metrics.getSnapshot();
    expect(snap.aiCalls.total).toBe(0);
    expect(snap.aiCalls.failures).toBe(0);
    expect(Object.keys(snap.events)).toHaveLength(0);
    expect(Object.keys(snap.errors)).toHaveLength(0);
  });

  it('records events and increments count', () => {
    metrics.recordEvent('issues.opened', 150);
    metrics.recordEvent('issues.opened', 200);
    const snap = metrics.getSnapshot();
    expect(snap.events['issues.opened'].count).toBe(2);
    expect(snap.events['issues.opened'].totalDurationMs).toBe(350);
  });

  it('records errors by type', () => {
    metrics.recordError('webhook_validation');
    metrics.recordError('webhook_validation');
    metrics.recordError('ai_timeout');
    const snap = metrics.getSnapshot();
    expect(snap.errors['webhook_validation']).toBe(2);
    expect(snap.errors['ai_timeout']).toBe(1);
  });

  it('records AI call metrics', () => {
    metrics.recordAICall(100, false);
    metrics.recordAICall(300, false);
    metrics.recordAICall(50, true);
    const snap = metrics.getSnapshot();
    expect(snap.aiCalls.total).toBe(3);
    expect(snap.aiCalls.failures).toBe(1);
    expect(snap.aiCalls.avgDurationMs).toBe(150);
  });

  it('tracks uptime', () => {
    const snap = metrics.getSnapshot();
    expect(snap.uptime).toBeGreaterThanOrEqual(0);
    expect(snap.startedAt).toBeTruthy();
  });

  it('resets all counters', () => {
    metrics.recordEvent('test', 100);
    metrics.recordError('test');
    metrics.recordAICall(50, false);
    metrics.reset();
    const snap = metrics.getSnapshot();
    expect(snap.aiCalls.total).toBe(0);
    expect(Object.keys(snap.events)).toHaveLength(0);
    expect(Object.keys(snap.errors)).toHaveLength(0);
  });
});
