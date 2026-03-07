const metrics = {
  startedAt: Date.now(),
  eventsProcessed: 0,
  eventsByType: {} as Record<string, number>,
  lastEventAt: null as string | null,
};

export function recordEvent(eventKey: string): void {
  metrics.eventsProcessed++;
  metrics.eventsByType[eventKey] = (metrics.eventsByType[eventKey] ?? 0) + 1;
  metrics.lastEventAt = new Date().toISOString();
}

export function getMetrics() {
  return {
    uptime: Math.floor((Date.now() - metrics.startedAt) / 1000),
    eventsProcessed: metrics.eventsProcessed,
    eventsByType: { ...metrics.eventsByType },
    lastEventAt: metrics.lastEventAt,
  };
}
