import { useEffect, useRef } from 'react';
import { useActiveEvent, useStore } from '../../store';
import type { SetupStep } from '../../types';
import { validateEvent, validateMatches, validateSettings } from '../../model';
import { useDialogs } from '../common/Dialogs';
import { FormatStep } from './FormatStep';
import { SettingsStep } from './SettingsStep';
import { MatchesStep } from './MatchesStep';
import { ConfirmStep } from './ConfirmStep';

const STEPS: { id: SetupStep; label: string }[] = [
  { id: 'format', label: '形式' },
  { id: 'settings', label: '共通設定' },
  { id: 'matches', label: '出演者' },
  { id: 'confirm', label: '確認' },
];

export function SetupWizard({ step }: { step: SetupStep }) {
  const [ev, updateEvent] = useActiveEvent();
  const { update } = useStore();
  const { confirm, toast } = useDialogs();
  const bodyRef = useRef<HTMLDivElement>(null);
  const index = STEPS.findIndex((s) => s.id === step);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [step]);

  const goto = (s: SetupStep) =>
    updateEvent((d) => {
      d.screen = { kind: 'setup', step: s };
    });

  /** 次へ進む前に現在のステップをチェック */
  const stepErrors = (): string[] => {
    if (step === 'format') return ev.format ? [] : ['バトル形式を選択してください'];
    if (step === 'settings') return validateSettings(ev).map((i) => i.message);
    if (step === 'matches') return validateMatches(ev).errors.map((i) => i.message);
    return [];
  };

  const next = () => {
    const errs = stepErrors();
    if (errs.length) {
      toast(errs[0]);
      return;
    }
    if (index < STEPS.length - 1) goto(STEPS[index + 1].id);
  };

  const back = () => {
    if (index > 0) goto(STEPS[index - 1].id);
    else exitToList();
  };

  const exitToList = () =>
    update((d) => {
      d.activeEventId = null;
    });

  const goLive = async () => {
    const { errors } = validateEvent(ev);
    if (errors.length) {
      const ok = await confirm({
        title: '未入力の項目があります',
        message: errors.map((e) => '・' + e.message).join('\n') + '\n\nこのまま本番画面へ戻りますか？',
        okLabel: '本番画面へ戻る',
      });
      if (!ok) return;
    }
    updateEvent((d) => {
      d.screen = { kind: 'live' };
      d.hasGoneLive = true;
      if (!d.matches.some((m) => m.id === d.currentMatchId)) d.currentMatchId = d.matches[0]?.id ?? null;
    });
  };

  return (
    <div className="page setup">
      <header className="setup-header">
        <div className="setup-header-row">
          <button className="btn btn-ghost" onClick={exitToList}>
            ← イベント一覧
          </button>
          {ev.hasGoneLive && (
            <button className="btn btn-live" onClick={goLive}>
              ▶ 本番画面へ戻る
            </button>
          )}
        </div>
        <ol className="stepper" aria-label="設定の手順">
          {STEPS.map((s, i) => (
            <li key={s.id} className={`stepper-item${i === index ? ' is-current' : ''}${i < index ? ' is-done' : ''}`}>
              <button
                type="button"
                className="stepper-btn"
                // 先のステップへは「次へ」のチェックを通す。戻るのは自由
                disabled={i > index && !ev.hasGoneLive}
                onClick={() => goto(s.id)}
                aria-current={i === index ? 'step' : undefined}
              >
                <span className="stepper-num">{i < index ? '✓' : i + 1}</span>
                <span className="stepper-label">{s.label}</span>
              </button>
            </li>
          ))}
        </ol>
      </header>

      <div className="setup-body" ref={bodyRef}>
        {step === 'format' && <FormatStep />}
        {step === 'settings' && <SettingsStep />}
        {step === 'matches' && <MatchesStep />}
        {step === 'confirm' && <ConfirmStep onGoLive={goLive} onFix={goto} />}
      </div>

      <footer className="setup-footer">
        <button className="btn btn-lg" onClick={back}>
          {index === 0 ? 'やめる' : '← 戻る'}
        </button>
        {step !== 'confirm' && (
          <button className="btn btn-primary btn-lg" onClick={next}>
            次へ →
          </button>
        )}
      </footer>
    </div>
  );
}
