/**
 * Server event log for Phase 1: join, claim, reattach, no-plot.
 */

export type LogEvent =
  | { type: 'join'; playerId: string; username: string }
  | { type: 'claim'; playerId: string; username: string; plotId: number }
  | { type: 'reattach'; playerId: string; username: string; plotId: number }
  | { type: 'no_plot'; playerId: string; username: string };

const MAX_ENTRIES = 100;
const entries: LogEvent[] = [];

export function logEvent(event: LogEvent): void {
  entries.push(event);
  if (entries.length > MAX_ENTRIES) entries.shift();
  console.log('[Tycoon]', event.type, event);
}

export function getRecentLog(): LogEvent[] {
  return [...entries];
}
