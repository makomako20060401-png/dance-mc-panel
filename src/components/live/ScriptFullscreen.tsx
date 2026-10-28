import { useEffect } from 'react';
import type { Battler, Match, TimerSettings } from '../../types';
import { isRunning } from '../../time';
import { matchView, personalView } from './TimerBar';

export const MIN_FONT = 16;
export const MAX_FONT = 72;

interface Props {
  match: Match;
  title: string;
  now: number;
  timers: TimerSettings;
  current: Battler | null;
  fontPx: number;
  onFont: (px: number) => void;
  onTogglePersonal: () => void;
  onClose: () => void;
}

/** 原稿の拡大表示。タイマーは下部に小さく出し続け、時間を見失わないようにする */
export function ScriptFullscreen(p: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && p.onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [p]);

  const pv = personalView(p.match.personalTimer, p.now, p.timers);
  const mv = matchView(p.match.matchTimer, p.now, p.timers);
  const text = p.match.draft ? p.match.draft.script : p.match.script;
  const memo = p.match.draft ? p.match.draft.memo : p.match.memo;

  return (
    <div className="fullscreen" role="dialog" aria-modal="true" aria-label="原稿の拡大表示">
      <div className="fs-header">
        <span className="fs-title">{p.title}</span>
        <div className="fs-font">
          <button className="btn btn-sm" onClick={() => p.onFont(Math.max(MIN_FONT, p.fontPx - 4))} disabled={p.fontPx <= MIN_FONT} aria-label="文字を小さく">
            A−
          </button>
          <button className="btn btn-sm" onClick={() => p.onFont(Math.min(MAX_FONT, p.fontPx + 4))} disabled={p.fontPx >= MAX_FONT} aria-label="文字を大きく">
            A＋
          </button>
        </div>
        <button className="btn btn-sm btn-primary" onClick={p.onClose}>
          ✕ 閉じる
        </button>
      </div>
      {p.match.draft && <div className="fs-notice">編集中の下書きを表示しています（未保存）</div>}
      <div className="fs-body" style={{ fontSize: p.fontPx }}>
        {text.trim() ? <div className="script-text">{text}</div> : <p className="muted">原稿はまだありません</p>}
        {memo.trim() && (
          <div className="memo-box">
            <div className="memo-label">メモ</div>
            <div className="memo-text">{memo}</div>
          </div>
        )}
      </div>
      <div className="fs-timers">
        <button
          type="button"
          className={`fs-timer phase-${pv.phase}`}
          onClick={p.onTogglePersonal}
          aria-label={`個人タイマーを${isRunning(p.match.personalTimer) ? '一時停止' : '開始'}`}
        >
          <span className="fs-timer-label">
            {isRunning(p.match.personalTimer) ? '▶' : '❚❚'} 個人 {p.current?.name ?? ''}
          </span>
          <span className="fs-timer-digits">{pv.text}</span>
        </button>
        <div className={`fs-timer phase-${mv.phase}`}>
          <span className="fs-timer-label">{isRunning(p.match.matchTimer) ? '▶' : '❚❚'} 試合</span>
          <span className="fs-timer-digits">{mv.text}</span>
        </div>
      </div>
    </div>
  );
}
