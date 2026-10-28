import { useActiveEvent } from '../../store';
import type { BattleFormat } from '../../types';
import { changeFormat, FORMAT_LABEL, formatChangeLosesData } from '../../model';
import { useDialogs } from '../common/Dialogs';

const OPTIONS: { id: BattleFormat; icon: string; desc: string }[] = [
  { id: 'circle', icon: '◎', desc: '人数自由。試合ごとに参加バトラーを登録します' },
  { id: 'oneVsOne', icon: '⚔', desc: '試合ごとに2名の対戦カードを登録します' },
  { id: 'teams', icon: '👥', desc: 'チームA・チームBの名前とメンバーを登録します' },
];

export function FormatStep() {
  const [ev, updateEvent] = useActiveEvent();
  const { confirm } = useDialogs();

  const choose = async (f: BattleFormat) => {
    if (ev.format === f) return;
    if (formatChangeLosesData(ev, f)) {
      const ok = await confirm({
        title: '形式を変更しますか？',
        message:
          f === 'oneVsOne'
            ? '1 vs 1 では各試合の先頭2名だけが残り、3人目以降は削除されます。'
            : 'チーム名が削除されます。メンバーの名前は残ります。',
        okLabel: '変更する',
        danger: true,
      });
      if (!ok) return;
    }
    updateEvent((d) => changeFormat(d, f));
  };

  return (
    <div className="step">
      <h2 className="step-title">バトル形式を選択</h2>
      {ev.hasGoneLive && ev.format && (
        <p className="notice">
          本番開始後の形式変更は、出演者データが新しい形式に合わせて変換されます。
        </p>
      )}
      <div className="format-grid" role="radiogroup" aria-label="バトル形式">
        {OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={ev.format === o.id}
            className={`format-card${ev.format === o.id ? ' is-selected' : ''}`}
            onClick={() => choose(o.id)}
          >
            <span className="format-icon" aria-hidden>
              {o.icon}
            </span>
            <span className="format-name">{FORMAT_LABEL[o.id]}</span>
            <span className="format-desc">{o.desc}</span>
            {ev.format === o.id && <span className="format-check">✓ 選択中</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
