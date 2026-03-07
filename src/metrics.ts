import { log } from './logger.js';

interface MetricEntry {
  count: number;
  lastOccurrence: string;
  totalDurationMs: number;
}

interface MetricsSnapshot {
  uptime: number;
  startedAt: string;
  events: Record<string, MetricEntry>;
  errors: Record<string, number>;
  aiCalls: {
    total: number;
    failures: number;
    avgDurationMs: number;
  };
}

class MetricsCollector {
  private startTime: number;
  private startedAt: string;
  private events: Map<string, MetricEntry> = new Map();
  private errors: Map<string, number> = new Map();
  private aiCallCount = 0;
  private aiFailureCount = 0;
  private aiTotalDurationMs = 0;

  constructor() {
    this.startTime = Date.now();
    this.startedAt = new Date().toISOString();
  }

  recordEvent(eventType: string, durationMs: number): void {
    const existing = this.events.get(eventType);
    if (existing) {
      existing.count++;
      existing.lastOccurrence = new Date().toISOString();
      existing.totalDurationMs += durationMs;
    } else {
      this.events.set(eventType, {
        count: 1,
        lastOccurrence: new Date().toISOString(),
        totalDurationMs: durationMs,
      });
    }
  }

  recordError(errorType: string): void {
    const count = this.errors.get(errorType) ?? 0;
    this.errors.set(errorType, count + 1);
  }

  recordAICall(durationMs: number, failed: boolean): void {
    this.aiCallCount++;
    this.aiTotalDurationMs += durationMs;
    if (failed) {
      this.aiFailureCount++;
    }
  }

  getSnapshot(): MetricsSnapshot {
    const events: Record<string, MetricEntry> = {};
    for (const [key, value] of this.events) {
      events[key] = { ...value };
    }

    const errors: Record<string, number> = {};
    for (const [key, value] of this.errors) {
      errors[key] = value;
    }

    return {
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      startedAt: this.startedAt,
      events,
      errors,
      aiCalls: {
        total: this.aiCallCount,
        failures: this.aiFailureCount,
        avgDurationMs: this.aiCallCount > 0
          ? Math.round(this.aiTotalDurationMs / this.aiCallCount)
          : 0,
      },
    };
  }

  reset(): void {
    this.events.clear();
    this.errors.clear();
    this.aiCallCount = 0;
    this.aiFailureCount = 0;
    this.aiTotalDurationMs = 0;
    this.startTime = Date.now();
    this.startedAt = new Date().toISOString();
    log('info', 'Metrics reset');
  }
}

// Singleton instance — imported by index.ts for the /metrics endpoint
export const metrics = new MetricsCollector();
