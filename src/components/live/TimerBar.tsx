import type { Battler, Stopwatch, TimerSettings } from '../../types';
import { formatSec, isRunning, timerView, type CountdownView } from '../../time';
import { useLongPress } from '../../hooks/useLongPress';
import { useDialogs } from '../common/Dialogs';

export function personalView(sw: Stopwatch, now: number, t: TimerSettings): CountdownView {
  return t.performanceLimited
    ? timerView(sw, now, t.performanceSec, t.performanceWarnSec)
    : timerView(sw, now, null, null);
}

export function matchView(sw: Stopwatch, now: number, t: TimerSettings): CountdownView {
  return t.matchLimitEnabled
    ? timerView(sw, now, t.matchLimitSec, t.matchWarnEnabled ? t.matchWarnSec : null)
    : timerView(sw, now, null, null);
}

interface Props {
  now: number;
  timers: TimerSettings;
  personal: Stopwatch;
  matchTimer: Stopwatch;
  current: Battler | null;
  onTogglePersonal: () => void;
  onResetPersonal: () => void;
  onToggleMatch: () => void;
  onResetMatch: () => void;
}

export function TimerBar(p: Props) {
  const pv = personalView(p.personal, p.now, p.timers);
  const mv = matchView(p.matchTimer, p.now, p.timers);
  const limited = p.timers.performanceLimited;

  const personalStatus = statusLabel(pv, p.personal, limited ? '残り' : '経過');
  const matchStatus = statusLabel(mv, p.matchTimer, p.timers.matchLimitEnabled ? '残り' : '経過');

  return (
    <footer className="timer-bar" aria-label="タイマー">
      <TimerBlock
        kind="personal"
        title="個人"
        subject={p.current ? p.current.name : '担当者なし'}
        view={pv}
        status={personalStatus}
        running={isRunning(p.personal)}
        onToggle={p.onTogglePersonal}
        onReset={p.onResetPersonal}
      />
      <TimerBlock
        kind="match"
        title="試合"
        subject={p.timers.matchLimitEnabled ? `経過 ${formatSec(mv.elapsedSec)}` : '試合経過'}
        view={mv}
        status={matchStatus}
        running={isRunning(p.matchTimer)}
        onToggle={p.onToggleMatch}
        onReset={p.onResetMatch}
      />
    </footer>
  );
}

function statusLabel(v: CountdownView, sw: Stopwatch, base: string): string {
  const paused = !isRunning(sw) && sw.accumulatedMs > 0;
  if (v.phase === 'over') return paused ? '⏰ TIME UP・停止中' : '⏰ TIME UP';
  if (v.phase === 'warn') return paused ? `⚠ ${base}わずか・停止中` : `⚠ ${base}わずか`;
  if (paused) return '❚❚ 一時停止中';
  if (!isRunning(sw)) return '待機中';
  return base;
}

function TimerBlock({
  kind,
  title,
  subject,
  view,
  status,
  running,
  onToggle,
  onReset,
}: {
  kind: 'personal' | 'match';
  title: string;
  subject: string;
  view: CountdownView;
  status: string;
  running: boolean;
  onToggle: () => void;
  onReset: () => void;
}) {
  const { toast } = useDialogs();
  const reset = useLongPress({ onLongPress: onReset, onClick: () => toast('リセットは長押ししてください') });
  return (
    <div className={`timer-block timer-${kind} phase-${view.phase}${running ? ' is-running' : ''}`}>
      <div className="timer-info">
        <div className="timer-head">
          <span className="timer-title">{title}</span>
          <span className="timer-subject">{subject}</span>
        </div>
        <div className="timer-digits" aria-live="off">
          {view.text}
        </div>
        <div className="timer-status">{status}</div>
      </div>
      <div className="timer-actions">
        <button
          type="button"
          className={`timer-btn ${running ? 'is-pause' : 'is-play'}`}
          onClick={onToggle}
          aria-label={`${title}タイマーを${running ? '一時停止' : '開始'}`}
        >
          {running ? '❚❚' : '▶'}
        </button>
        <button
          type="button"
          className={`timer-btn is-reset${reset.pressing ? ' is-pressing' : ''}`}
          aria-label={`${title}タイマーをリセット（長押し）`}
          {...reset.handlers}
        >
          ↺<span className="press-progress" aria-hidden />
        </button>
      </div>
    </div>
  );
}
