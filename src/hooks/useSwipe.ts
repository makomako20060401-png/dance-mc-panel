import { useRef, type MouseEvent, type PointerEvent } from 'react';

const MIN_DISTANCE_PX = 60;
const MAX_DURATION_MS = 800;

/**
 * 横スワイプ検出。縦方向の動きが大きい場合は無視する。
 * スワイプ直後に子要素のボタンへ click が届かないよう、キャプチャ段階で止める。
 */
export function useSwipe(onSwipeLeft: () => void, onSwipeRight: () => void) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const swiped = useRef(false);
  return {
    onClickCapture: (e: MouseEvent) => {
      if (!swiped.current) return;
      swiped.current = false;
      e.stopPropagation();
      e.preventDefault();
    },
    onPointerDown: (e: PointerEvent) => {
      start.current = { x: e.clientX, y: e.clientY, t: Date.now() };
      swiped.current = false;
    },
    onPointerUp: (e: PointerEvent) => {
      const s = start.current;
      start.current = null;
      if (!s) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (Date.now() - s.t > MAX_DURATION_MS) return;
      if (Math.abs(dx) < MIN_DISTANCE_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      swiped.current = true;
      // click が発生しない端末向けに、少し後で解除する
      window.setTimeout(() => (swiped.current = false), 400);
      if (dx < 0) onSwipeLeft();
      else onSwipeRight();
    },
    onPointerCancel: () => {
      start.current = null;
    },
  };
}
