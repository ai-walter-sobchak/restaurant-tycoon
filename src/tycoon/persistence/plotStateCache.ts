/**
 * In-memory plot state cache with dirty tracking and debounced flush.
 */

import type { PlotId, PlotState } from '../types.js';
import { PLOT_SAVE_DEBOUNCE_MS } from '../config.js';
import { setPlotState } from './plotStore.js';

const cache = new Map<PlotId, PlotState>();
const dirty = new Set<PlotId>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export function getCachedPlotState(plotId: PlotId): PlotState | undefined {
  return cache.get(plotId);
}

export function setCachedPlotState(plotId: PlotId, state: PlotState): void {
  cache.set(plotId, { ...state, updatedAt: Date.now() });
  dirty.add(plotId);
  scheduleFlush();
}

function scheduleFlush(): void {
  if (flushTimer != null) return;
  flushTimer = setTimeout(flushDirty, PLOT_SAVE_DEBOUNCE_MS);
}

async function flushDirty(): Promise<void> {
  flushTimer = null;
  const toFlush = [...dirty];
  dirty.clear();
  for (const plotId of toFlush) {
    const state = cache.get(plotId);
    if (state) {
      try {
        await setPlotState(plotId, state);
      } catch (_) {
        dirty.add(plotId);
      }
    }
  }
}

export async function flushAllDirtyState(): Promise<void> {
  if (flushTimer != null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await flushDirty();
}

export function registerPlotStateInCache(plotId: PlotId, state: PlotState): void {
  cache.set(plotId, state);
}
