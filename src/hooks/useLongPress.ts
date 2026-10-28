import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';

export const LONG_PRESS_MS = 600;
const MOVE_TOLERANCE_PX = 12;

interface Options {
  onLongPress?: () => void;
  onClick?: () => void;
  ms?: number;
}

/**
 * タッチ・マウス両対応の長押し。
 * - 指が動いた（スクロール）・離れた・ブラウザがキャンセルした場合は長押しにしない
 * - 長押し成立後に続けて発生する click は無視する（解除直後の誤選択を防ぐ）
 * - pressing は押下中の進捗表示に使う
 * - キーボード操作では Delete / Backspace を長押しの代わりにする
 */
export function useLongPress({ onLongPress, onClick, ms = LONG_PRESS_MS }: Options) {
  const [pressing, setPressing] = useState(false);
  const timer = useRef<number | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const cbs = useRef({ onLongPress, onClick });
  cbs.current = { onLongPress, onClick };

  const cancel = useCallback(() => {
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
    setPressing(false);
  }, []);

  useEffect(() => cancel, [cancel]);

  const onPointerDown = useCallback(
    (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      fired.current = false;
      if (!cbs.current.onLongPress) return;
      origin.current = { x: e.clientX, y: e.clientY };
      setPressing(true);
      timer.current = window.setTimeout(() => {
        timer.current = null;
        fired.current = true;
        setPressing(false);
        navigator.vibrate?.(40);
        cbs.current.onLongPress?.();
      }, ms);
    },
    [ms],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const o = origin.current;
      if (!o) return;
      if (Math.hypot(e.clientX - o.x, e.clientY - o.y) > MOVE_TOLERANCE_PX) cancel();
    },
    [cancel],
  );

  const onClickHandler = useCallback((e: MouseEvent) => {
    if (fired.current) {
      fired.current = false;
      e.preventDefault();
      return;
    }
    cbs.current.onClick?.();
  }, []);

  return {
    pressing,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: cancel,
      onPointerLeave: cancel,
      onPointerCancel: cancel,
      onClick: onClickHandler,
      onContextMenu: (e: MouseEvent) => e.preventDefault(),
      onKeyDown: (e: KeyboardEvent) => {
        if ((e.key === 'Delete' || e.key === 'Backspace') && cbs.current.onLongPress) {
          e.preventDefault();
          cbs.current.onLongPress();
        }
      },
    },
  };
}
