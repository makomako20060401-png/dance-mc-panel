import { useEffect, useState } from 'react';
import { useActiveEvent } from '../../store';
import { matchHasData, setMatchCount, validateSettings } from '../../model';
import type { TimerSettings } from '../../types';
import { useDialogs } from '../common/Dialogs';
import { normalizeDigits, TimeInput } from '../common/TimeInput';

const MAX_MATCHES = 200;

export function SettingsStep() {
  const [ev, updateEvent] = useActiveEvent();
  const { confirm } = useDialogs();
  const t = ev.timers;
  const [countText, setCountText] = useState(String(ev.matches.length));
  const [countError, setCountError] = useState<string | null>(null);

  useEffect(() => setCountText(String(ev.matches.length)), [ev.matches.length]);

  const setTimers = (patch: Partial<TimerSettings>) =>
    updateEvent((d) => {
      Object.assign(d.timers, patch);
    });

  const applyCount = async (n: number) => {
    if (!Number.isInteger(n) || n < 1) {
      setCountError('試合数は1以上の整数で入力してください');
      return;
    }
    if (n > MAX_MATCHES) {
      setCountError(`試合数は${MAX_MATCHES}以下にしてください`);
      return;
    }
    setCountError(null);
    if (n === ev.matches.length) return;
    const removed = ev.matches.slice(n);
    if (removed.some(matchHasData)) {
      const ok = await confirm({
        title: '試合を減らしますか？',
        message: `第${n + 1}試合以降（${removed.length}試合）に入力済みのデータがあります。削除すると元に戻せません。`,
        okLabel: '削除して減らす',
        danger: true,
      });
      if (!ok) {
        setCountText(String(ev.matches.length));
        return;
      }
    }
    updateEvent((d) => setMatchCount(d, n));
  };

  const errors = validateSettings(ev);

  return (
    <div className="step">
      <h2 className="step-title">共通設定</h2>

      <div className="card">
        <label className="field">
          <span className="field-label">イベント名</span>
          <input
            className="input"
            value={ev.name}
            onChange={(e) =>
              updateEvent((d) => {
                d.name = e.target.value;
              })
            }
          />
        </label>
        {!ev.name.trim() && <p className="error-text">イベント名を入力してください</p>}

        <div className="field">
          <span className="field-label" id="count-label">
            試合数
          </span>
          <div className="stepper-input">
            <button className="btn btn-square" aria-label="1試合減らす" onClick={() => applyCount(ev.matches.length - 1)} disabled={ev.matches.length <= 1}>
              −
            </button>
            <input
              className="input input-num input-count"
              inputMode="numeric"
              aria-labelledby="count-label"
              value={countText}
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                setCountText(normalizeDigits(e.target.value).slice(0, 3));
                setCountError(null);
              }}
              onBlur={() => applyCount(countText === '' ? NaN : Number(countText))}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
            <button className="btn btn-square" aria-label="1試合増やす" onClick={() => applyCount(ev.matches.length + 1)}>
              ＋
            </button>
            <span className="time-unit">試合</span>
          </div>
          {countError && <p className="error-text">{countError}</p>}
          <p className="muted small">試合は次の画面や本番中にも追加・削除・並べ替えできます。</p>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">個人タイマー（1人あたりのパフォーマンス時間）</h3>
        <label className="check">
          <input
            type="checkbox"
            checked={!t.performanceLimited}
            onChange={(e) => setTimers({ performanceLimited: !e.target.checked })}
          />
          <span>制限時間なし（経過時間をカウントアップ）</span>
        </label>
        {t.performanceLimited && (
          <>
            <div className="field">
              <span className="field-label">1人あたりの時間</span>
              <TimeInput valueSec={t.performanceSec} onChange={(v) => setTimers({ performanceSec: v })} />
            </div>
            <div className="field">
              <span className="field-label">警戒時間（残りこの時間で警告表示）</span>
              <TimeInput valueSec={t.performanceWarnSec} onChange={(v) => setTimers({ performanceWarnSec: v })} />
              <p className="muted small">0分0秒にすると警告表示なし</p>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h3 className="card-title">試合全体の制限時間（任意）</h3>
        <label className="check">
          <input
            type="checkbox"
            checked={t.matchLimitEnabled}
            onChange={(e) => setTimers({ matchLimitEnabled: e.target.checked })}
          />
          <span>試合全体の制限時間を設定する</span>
        </label>
        {!t.matchLimitEnabled && <p className="muted small">設定しない場合、試合経過時間をカウントアップで表示します。</p>}
        {t.matchLimitEnabled && (
          <>
            <div className="field">
              <span className="field-label">試合全体の制限時間</span>
              <TimeInput valueSec={t.matchLimitSec} onChange={(v) => setTimers({ matchLimitSec: v })} maxMinutes={999} />
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={t.matchWarnEnabled}
                onChange={(e) => setTimers({ matchWarnEnabled: e.target.checked })}
              />
              <span>警戒時間を設定する</span>
            </label>
            {t.matchWarnEnabled && (
              <div className="field">
                <span className="field-label">警戒時間（残りこの時間で警告表示）</span>
                <TimeInput valueSec={t.matchWarnSec} onChange={(v) => setTimers({ matchWarnSec: v })} />
              </div>
            )}
          </>
        )}
      </div>

      <div className="card">
        <h3 className="card-title">その他</h3>
        <label className="check">
          <input
            type="checkbox"
            checked={ev.vibration}
            onChange={(e) =>
              updateEvent((d) => {
                d.vibration = e.target.checked;
              })
            }
          />
          <span>警戒時間・時間切れでバイブレーション（対応端末のみ）</span>
        </label>
      </div>

      {errors.length > 0 && (
        <ul className="issue-list" aria-live="polite">
          {errors.map((e) => (
            <li key={e.message} className="issue issue-error">
              ⚠ {e.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
