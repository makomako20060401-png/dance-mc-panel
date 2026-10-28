import type { Stopwatch } from './types';

export function elapsedMs(sw: Stopwatch, now: number): number {
  const running = sw.runningSince != null ? Math.max(0, now - sw.runningSince) : 0;
  return sw.accumulatedMs + running;
}

export function isRunning(sw: Stopwatch): boolean {
  return sw.runningSince != null;
}

export function stoppedWatch(): Stopwatch {
  return { runningSince: null, accumulatedMs: 0 };
}

export function startWatch(sw: Stopwatch, now: number): Stopwatch {
  return sw.runningSince != null ? sw : { ...sw, runningSince: now };
}

export function pauseWatch(sw: Stopwatch, now: number): Stopwatch {
  if (sw.runningSince == null) return sw;
  return { runningSince: null, accumulatedMs: elapsedMs(sw, now) };
}

export function restartWatch(now: number): Stopwatch {
  return { runningSince: now, accumulatedMs: 0 };
}

/** 秒数を m:ss 形式に。負数は扱わない（呼び出し側で符号を付ける） */
export function formatSec(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/** 表示用の「m分s秒」 */
export function formatSecJa(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}秒`;
  if (s === 0) return `${m}分`;
  return `${m}分${s}秒`;
}

export type TimerPhase = 'idle' | 'normal' | 'warn' | 'over';

export interface CountdownView {
  /** 画面に出す主表示（m:ss。超過時は +m:ss） */
  text: string;
  phase: TimerPhase;
  /** 残り秒（制限なしなら null） */
  remainingSec: number | null;
  elapsedSec: number;
}

/**
 * 制限時間ありならカウントダウン、なしならカウントアップの表示値を計算する。
 * 0 を過ぎても止めず、超過時間を +m:ss で表示し続ける。
 */
export function timerView(
  sw: Stopwatch,
  now: number,
  limitSec: number | null,
  warnSec: number | null,
): CountdownView {
  const ms = elapsedMs(sw, now);
  const elapsedSec = Math.floor(ms / 1000);
  const idle = sw.runningSince == null && sw.accumulatedMs === 0;
  if (limitSec == null) {
    return { text: formatSec(elapsedSec), phase: idle ? 'idle' : 'normal', remainingSec: null, elapsedSec };
  }
  // 残りは切り上げ（60秒設定で開始直後に 0:59 と出ないように）
  const remainingMs = limitSec * 1000 - ms;
  if (remainingMs <= 0) {
    const overSec = Math.floor(-remainingMs / 1000);
    return { text: `+${formatSec(overSec)}`, phase: 'over', remainingSec: 0, elapsedSec };
  }
  const remainingSec = Math.ceil(remainingMs / 1000);
  let phase: TimerPhase = idle ? 'idle' : 'normal';
  if (!idle && warnSec != null && warnSec > 0 && remainingSec <= warnSec) phase = 'warn';
  return { text: formatSec(remainingSec), phase, remainingSec, elapsedSec };
}
