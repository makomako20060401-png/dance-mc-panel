import { useEffect, useRef, useState } from 'react';
import { useActiveEvent, useStore } from '../../store';
import type { Match, SetupStep, TeamId } from '../../types';
import {
  currentMatchIndex,
  goToMatch,
  isDanced,
  matchCard,
  newBattler,
  newId,
  resetMatchProgress,
  selectBattler,
  snapshotForUndo,
  undoSelect,
  unmarkBattler,
} from '../../model';
import { isRunning, pauseWatch, startWatch, stoppedWatch } from '../../time';
import { canDownload, downloadEvents } from '../../storage';
import { useNow } from '../../hooks/useNow';
import { useWakeLock } from '../../hooks/useWakeLock';
import { Modal, useDialogs } from '../common/Dialogs';
import { MatchNav } from './MatchNav';
import { BattlerPanel } from './BattlerPanel';
import { ScriptPanel } from './ScriptPanel';
import { matchView, personalView, TimerBar } from './TimerBar';
import { ScriptFullscreen } from './ScriptFullscreen';

export function LiveScreen() {
  const [ev, updateEvent] = useActiveEvent();
  const { update, saveError } = useStore();
  const { confirm, toast, dismissToast } = useDialogs();
  const [menuOpen, setMenuOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const index = currentMatchIndex(ev);
  const match = ev.matches[index];
  const running = !!match && (isRunning(match.personalTimer) || isRunning(match.matchTimer));
  const now = useNow(running);

  useWakeLock(true);
  useTimerAlerts(match, now, ev.timers, ev.vibration);

  // 本番画面ではページ全体をスクロールさせない
  useEffect(() => {
    document.documentElement.classList.add('lock-scroll');
    return () => document.documentElement.classList.remove('lock-scroll');
  }, []);

  if (!match) return null;

  const updateMatch = (recipe: (m: Match) => void) =>
    updateEvent((d) => {
      const m = d.matches.find((x) => x.id === match.id);
      if (m) recipe(m);
    });

  const go = (i: number) => {
    if (i < 0 || i >= ev.matches.length) return;
    const wasRunning = running;
    updateEvent((d) => void goToMatch(d, i, Date.now()));
    if (wasRunning) toast('前の試合のタイマーを一時停止しました');
    else dismissToast();
  };

  /** タップで即開始。誤タップに備えて数秒間だけ「元に戻す」を出す */
  const select = (battlerId: string) => {
    const pid = newId();
    const undo = snapshotForUndo(match, pid);
    const name = match.battlers.find((b) => b.id === battlerId)?.name ?? '';
    updateMatch((m) => void selectBattler(m, battlerId, Date.now(), pid));
    toast(`▶ ${name}`, {
      label: '元に戻す',
      onClick: () => updateEvent((d) => void undoSelect(d, undo)),
    });
  };

  const current = match.battlers.find((b) => b.id === match.currentBattlerId) ?? null;
  const title = `第${index + 1}試合 / 全${ev.matches.length}試合`;

  const openSetup = (step: SetupStep) => {
    setMenuOpen(false);
    updateEvent((d) => {
      d.screen = { kind: 'setup', step };
    });
  };

  return (
    <div className="live">
      <MatchNav
        index={index}
        total={ev.matches.length}
        match={match}
        format={ev.format}
        onPrev={() => go(index - 1)}
        onNext={() => go(index + 1)}
        onOpenList={() => setListOpen(true)}
        onOpenMenu={() => setMenuOpen(true)}
      />

      {saveError && <div className="save-error">⚠ 端末への保存に失敗しています（空き容量を確認してください）</div>}

      <main className="live-middle">
        <BattlerPanel
          match={match}
          format={ev.format}
          onSelect={select}
          onUnmark={(id) => {
            const name = match.battlers.find((b) => b.id === id)?.name ?? '';
            updateMatch((m) => unmarkBattler(m, id, Date.now()));
            toast(`「${name}」の踊った印を解除しました`);
          }}
          onAdd={(name, teamId?: TeamId) => updateMatch((m) => void m.battlers.push(newBattler(name, teamId)))}
        />
        <ScriptPanel
          match={match}
          onStartEdit={() => updateMatch((m) => void (m.draft = { script: m.script, memo: m.memo }))}
          onChangeDraft={(field, value) =>
            updateMatch((m) => {
              if (m.draft) m.draft[field] = value;
            })
          }
          onSave={() =>
            updateMatch((m) => {
              if (!m.draft) return;
              m.script = m.draft.script;
              m.memo = m.draft.memo;
              m.draft = null;
            })
          }
          onDiscard={() => updateMatch((m) => void (m.draft = null))}
          onExpand={() => setExpanded(true)}
        />
      </main>

      <TimerBar
        now={now}
        timers={ev.timers}
        personal={match.personalTimer}
        matchTimer={match.matchTimer}
        current={current}
        onTogglePersonal={() => updateMatch((m) => togglePersonal(m))}
        onResetPersonal={() => {
          updateMatch((m) => void (m.personalTimer = stoppedWatch()));
          toast('個人タイマーをリセットしました');
        }}
        onToggleMatch={() =>
          updateMatch((m) => {
            const t = Date.now();
            m.matchTimer = isRunning(m.matchTimer) ? pauseWatch(m.matchTimer, t) : startWatch(m.matchTimer, t);
          })
        }
        onResetMatch={() => {
          updateMatch((m) => void (m.matchTimer = stoppedWatch()));
          toast('試合経過時間をリセットしました');
        }}
      />

      {expanded && (
        <ScriptFullscreen
          match={match}
          title={title}
          now={now}
          timers={ev.timers}
          current={current}
          fontPx={ev.scriptFontPx}
          onFont={(px) => updateEvent((d) => void (d.scriptFontPx = px))}
          onTogglePersonal={() => updateMatch((m) => togglePersonal(m))}
          onClose={() => setExpanded(false)}
        />
      )}

      {listOpen && (
        <Modal title="試合一覧" onClose={() => setListOpen(false)} wide>
          <ol className="match-jump-list">
            {ev.matches.map((m, i) => {
              const done = m.battlers.filter((b) => isDanced(m, b.id)).length;
              return (
                <li key={m.id}>
                  <button
                    className={`match-jump${i === index ? ' is-current' : ''}`}
                    onClick={() => {
                      go(i);
                      setListOpen(false);
                    }}
                  >
                    <span className="match-jump-no">第{i + 1}試合</span>
                    <span className="match-jump-card">
                      {m.label && <span className="nav-label">{m.label}</span>}
                      {matchCard(m, ev.format)}
                    </span>
                    <span className="count-chip">
                      済 {done}/{m.battlers.length}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </Modal>
      )}

      {menuOpen && (
        <Modal title="メニュー" onClose={() => setMenuOpen(false)}>
          <div className="menu-list">
            <p className="menu-section">編集（タイマーは止まりません）</p>
            <button className="btn btn-block btn-lg" onClick={() => openSetup('matches')}>
              👥 出演者・試合を編集
            </button>
            <button className="btn btn-block btn-lg" onClick={() => openSetup('settings')}>
              ⏱ タイマー設定・試合数を編集
            </button>
            <button className="btn btn-block btn-lg" onClick={() => openSetup('format')}>
              ◎ バトル形式を変更
            </button>
            <p className="menu-section">この試合</p>
            <button
              className="btn btn-block btn-lg btn-danger-outline"
              onClick={async () => {
                setMenuOpen(false);
                const ok = await confirm({
                  title: `第${index + 1}試合の進行をリセット`,
                  message: '踊った印・担当者・タイマーを初期状態に戻します。\n出演者とMC原稿は残ります。',
                  okLabel: 'リセットする',
                  danger: true,
                });
                if (ok) updateMatch(resetMatchProgress);
              }}
            >
              ↺ この試合の進行をリセット
            </button>
            <p className="menu-section">データ</p>
            {canDownload && (
              <button className="btn btn-block btn-lg" onClick={() => downloadEvents([ev], `${ev.name}.json`)}>
                ⬇ このイベントを書き出し
              </button>
            )}
            <button
              className="btn btn-block btn-lg"
              onClick={() => {
                setMenuOpen(false);
                // 一覧へ戻る時は動いているタイマーを止めておく
                updateEvent((d) => {
                  d.matches.forEach((m) => {
                    m.personalTimer = pauseWatch(m.personalTimer, Date.now());
                    m.matchTimer = pauseWatch(m.matchTimer, Date.now());
                  });
                });
                update((d) => void (d.activeEventId = null));
              }}
            >
              ← イベント一覧へ（タイマー停止）
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function togglePersonal(m: Match) {
  const t = Date.now();
  m.personalTimer = isRunning(m.personalTimer) ? pauseWatch(m.personalTimer, t) : startWatch(m.personalTimer, t);
}

/** 警戒時間・時間切れに入った瞬間だけバイブレーションする */
function useTimerAlerts(match: Match | undefined, now: number, timers: Parameters<typeof personalView>[2], enabled: boolean) {
  const prev = useRef<{ matchId: string; p: string; m: string } | null>(null);
  useEffect(() => {
    if (!match) return;
    const p = isRunning(match.personalTimer) ? personalView(match.personalTimer, now, timers).phase : 'idle';
    const m = isRunning(match.matchTimer) ? matchView(match.matchTimer, now, timers).phase : 'idle';
    const before = prev.current;
    prev.current = { matchId: match.id, p, m };
    if (!enabled || !before || before.matchId !== match.id || !navigator.vibrate) return;
    const entered = (from: string, to: string, phase: string) => from !== phase && to === phase;
    if (entered(before.p, p, 'over') || entered(before.m, m, 'over')) navigator.vibrate([300, 120, 300]);
    else if (entered(before.p, p, 'warn') || entered(before.m, m, 'warn')) navigator.vibrate(200);
  }, [match, now, timers, enabled]);
}
