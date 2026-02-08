/**
 * Phase 2.3: Optional tabs — switch content views inside same window.
 * Stub: tab config only; client renders tabs when present.
 */

export interface WindowTabItem {
  id: string;
  label: string;
}

export interface WindowTabsConfig {
  tabs: WindowTabItem[];
  activeTabId?: string;
}
