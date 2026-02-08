/**
 * In-memory plot meta cache with dirty tracking and debounced flush.
 */

import type { PlotId, PlotMeta } from '../types.js';
import { PLOT_SAVE_DEBOUNCE_MS } from '../config.js';
import { setPlotMeta } from './plotStore.js';

const cache = new Map<PlotId, PlotMeta>();
const dirty = new Set<PlotId>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export function getCachedPlotMeta(plotId: PlotId): PlotMeta | undefined {
  return cache.get(plotId);
}

export function setCachedPlotMeta(plotId: PlotId, meta: PlotMeta): void {
  cache.set(plotId, { ...meta, updatedAt: Date.now() });
  dirty.add(plotId);
  scheduleFlush();
}

function scheduleFlush(): void {
  if (flushTimer !== null) return;
  flushTimer = setTimeout(flushDirty, PLOT_SAVE_DEBOUNCE_MS);
}

async function flushDirty(): Promise<void> {
  flushTimer = null;
  const toFlush = [...dirty];
  dirty.clear();
  for (const plotId of toFlush) {
    const meta = cache.get(plotId);
    if (meta) {
      try {
        await setPlotMeta(plotId, meta);
      } catch (_e) {
        dirty.add(plotId);
      }
    }
  }
}

export async function flushAllDirty(): Promise<void> {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await flushDirty();
}

export function registerPlotMetaInCache(plotId: PlotId, meta: PlotMeta): void {
  cache.set(plotId, meta);
}
