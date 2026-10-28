import { useEffect } from 'react';

/** 本番中に画面が消灯しないようにする（対応ブラウザのみ） */
export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let disposed = false;
    const acquire = async () => {
      try {
        if (document.visibilityState !== 'visible') return;
        const s = await navigator.wakeLock.request('screen');
        if (disposed) s.release();
        else sentinel = s;
      } catch {
        // 省電力モードなどで拒否されても動作は続ける
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') acquire();
    };
    acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      sentinel?.release().catch(() => {});
    };
  }, [enabled]);
}
