import type { AppState, BattleEvent } from './types';
import { DEFAULT_TIMERS, newMatch } from './model';

const KEY = 'dance-mc-panel/v1';

export function emptyState(): AppState {
  return { version: 1, events: [], activeEventId: null };
}

/** 古い・壊れたデータでも落ちないよう、欠けている項目を既定値で補う */
function normalizeEvent(raw: BattleEvent): BattleEvent {
  const ev: BattleEvent = {
    ...raw,
    timers: { ...DEFAULT_TIMERS, ...(raw.timers ?? {}) },
    scriptFontPx: raw.scriptFontPx ?? 28,
    vibration: raw.vibration ?? true,
    hasGoneLive: raw.hasGoneLive ?? false,
    screen: raw.screen ?? { kind: 'setup', step: 'format' },
  };
  const base = newMatch(ev.format);
  ev.matches = (raw.matches?.length ? raw.matches : [base]).map((m) => ({ ...newMatch(ev.format), ...m }));
  return ev;
}

export function loadState(): AppState {
  try {
    const text = localStorage.getItem(KEY);
    if (!text) return emptyState();
    const parsed = JSON.parse(text) as AppState;
    if (!parsed || !Array.isArray(parsed.events)) return emptyState();
    return {
      version: 1,
      events: parsed.events.map(normalizeEvent),
      activeEventId: parsed.activeEventId ?? null,
    };
  } catch {
    return emptyState();
  }
}

export function saveState(state: AppState): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// バックアップ（JSON 書き出し・読み込み）
// ---------------------------------------------------------------------------

interface ExportFile {
  app: 'dance-mc-panel';
  version: 1;
  exportedAt: string;
  events: BattleEvent[];
}

export function downloadEvents(events: BattleEvent[], filename: string): void {
  const data: ExportFile = { app: 'dance-mc-panel', version: 1, exportedAt: new Date().toISOString(), events };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function parseImport(text: string): BattleEvent[] {
  const data = JSON.parse(text) as Partial<ExportFile>;
  if (data.app !== 'dance-mc-panel' || !Array.isArray(data.events)) {
    throw new Error('このアプリで書き出したファイルではありません');
  }
  return data.events.map(normalizeEvent);
}
