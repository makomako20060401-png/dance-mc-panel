import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { produce } from 'immer';
import type { AppState, BattleEvent } from './types';
import { loadState, saveState } from './storage';

interface Store {
  state: AppState;
  activeEvent: BattleEvent | null;
  update: (recipe: (draft: AppState) => void) => void;
  /** 表示中のイベントを変更する（updatedAt も自動更新） */
  updateEvent: (recipe: (draft: BattleEvent) => void) => void;
  saveError: boolean;
}

const StoreContext = createContext<Store | null>(null);

const SAVE_DELAY_MS = 250;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);
  const [saveError, setSaveError] = useState(false);
  const latest = useRef(state);
  const timer = useRef<number | null>(null);

  const flush = useCallback(() => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    setSaveError(!saveState(latest.current));
  }, []);

  // 変更のたびに少し遅らせて保存。画面を閉じる・裏に回る時は即保存
  useEffect(() => {
    latest.current = state;
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, SAVE_DELAY_MS);
  }, [state, flush]);

  useEffect(() => {
    const onHide = () => flush();
    const onVisibility = () => document.visibilityState === 'hidden' && flush();
    window.addEventListener('pagehide', onHide);
    window.addEventListener('beforeunload', onHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('beforeunload', onHide);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [flush]);

  const update = useCallback((recipe: (draft: AppState) => void) => {
    setState((s) => produce(s, recipe));
  }, []);

  const updateEvent = useCallback((recipe: (draft: BattleEvent) => void) => {
    setState((s) =>
      produce(s, (d) => {
        const ev = d.events.find((e) => e.id === d.activeEventId);
        if (!ev) return;
        recipe(ev);
        ev.updatedAt = Date.now();
      }),
    );
  }, []);

  const activeEvent = useMemo(
    () => state.events.find((e) => e.id === state.activeEventId) ?? null,
    [state],
  );

  const value = useMemo(
    () => ({ state, activeEvent, update, updateEvent, saveError }),
    [state, activeEvent, update, updateEvent, saveError],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}

/** 表示中イベントが必ずある画面用 */
export function useActiveEvent(): [BattleEvent, Store['updateEvent']] {
  const { activeEvent, updateEvent } = useStore();
  if (!activeEvent) throw new Error('no active event');
  return [activeEvent, updateEvent];
}
