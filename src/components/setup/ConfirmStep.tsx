import { useState } from 'react';
import { useActiveEvent } from '../../store';
import { SendDialog } from '../Transfer';
import type { BattleEvent, SetupStep, TeamId } from '../../types';
import { FORMAT_LABEL, teamColor, teamMembers, teamName, validateEvent } from '../../model';
import { formatSecJa } from '../../time';

export function ConfirmStep({ onGoLive, onFix }: { onGoLive: () => void; onFix: (s: SetupStep) => void }) {
  const [ev] = useActiveEvent();
  const t = ev.timers;
  const { errors, warnings } = validateEvent(ev);
  const [sending, setSending] = useState<BattleEvent[] | null>(null);

  return (
    <div className="step">
      <h2 className="step-title">内容確認</h2>

      <div className="card">
        <dl className="summary">
          <dt>イベント名</dt>
          <dd>{ev.name}</dd>
          <dt>形式</dt>
          <dd>
            {ev.format ? FORMAT_LABEL[ev.format] : '未選択'}
            <button className="link-btn" onClick={() => onFix('format')}>
              変更
            </button>
          </dd>
          <dt>試合数</dt>
          <dd>全{ev.matches.length}試合</dd>
          <dt>個人タイマー</dt>
          <dd>
            {t.performanceLimited
              ? `${formatSecJa(t.performanceSec)}（残り${formatSecJa(t.performanceWarnSec)}で警告）`
              : '制限なし（カウントアップ）'}
            <button className="link-btn" onClick={() => onFix('settings')}>
              変更
            </button>
          </dd>
          <dt>試合全体</dt>
          <dd>
            {t.matchLimitEnabled
              ? `${formatSecJa(t.matchLimitSec)}${t.matchWarnEnabled ? `（残り${formatSecJa(t.matchWarnSec)}で警告）` : ''}`
              : '制限なし（経過時間を表示）'}
          </dd>
        </dl>
      </div>

      <div className="card">
        <div className="card-title-row">
          <h3 className="card-title">出演者</h3>
          <button className="link-btn" onClick={() => onFix('matches')}>
            変更
          </button>
        </div>
        <ol className="confirm-matches">
          {ev.matches.map((m, i) => (
            <li key={m.id}>
              <div className="confirm-match-title">
                第{i + 1}試合{m.label && <span className="muted">（{m.label}）</span>}
              </div>
              {ev.format === 'teams' ? (
                (['A', 'B'] as TeamId[]).map((tid) => (
                  <div key={tid} className="confirm-team">
                    <span className="team-dot" style={{ background: teamColor(m, tid) }} aria-hidden />
                    <strong>{teamName(m, tid) || <span className="error-text">チーム名未入力</span>}</strong>：
                    {teamMembers(m, tid).map((b) => b.name).join('、') || <span className="muted">メンバーなし</span>}
                  </div>
                ))
              ) : ev.format === 'oneVsOne' ? (
                <div>
                  {m.battlers[0]?.name || <span className="error-text">未入力</span>}
                  <span className="vs-inline"> VS </span>
                  {m.battlers[1]?.name || <span className="error-text">未入力</span>}
                </div>
              ) : (
                <div>
                  {m.battlers.length ? (
                    `${m.battlers.map((b) => b.name).join('、')}（${m.battlers.length}人）`
                  ) : (
                    <span className="muted">バトラー未登録</span>
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>

      {(errors.length > 0 || warnings.length > 0) && (
        <ul className="issue-list">
          {errors.map((e) => (
            <li key={e.message} className="issue issue-error">
              <span>⚠ {e.message}</span>
              <button className="link-btn" onClick={() => onFix(e.step)}>
                修正する
              </button>
            </li>
          ))}
          {warnings.map((e) => (
            <li key={e.message} className="issue issue-warn">
              ℹ {e.message}（本番中にも追加できます）
            </li>
          ))}
        </ul>
      )}

      <button className="btn btn-live btn-xl btn-block" onClick={onGoLive} disabled={errors.length > 0 && !ev.hasGoneLive}>
        ▶ 本番画面へ
      </button>
      {errors.length > 0 && !ev.hasGoneLive && <p className="error-text center">上の項目を修正すると本番画面へ進めます</p>}

      <div className="send-hint">
        <p className="muted small">パソコンで入力した場合は、ここから本番で使うスマホへ送れます。</p>
        <button className="btn btn-lg btn-block" onClick={() => setSending([ev])}>
          📲 この内容をスマホへ送る
        </button>
      </div>
      {sending && <SendDialog events={sending} onClose={() => setSending(null)} />}
    </div>
  );
}
