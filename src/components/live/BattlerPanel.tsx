import type { BattleFormat, Battler, Match, TeamId } from '../../types';
import { isDanced, teamMembers, teamName } from '../../model';
import { useLongPress } from '../../hooks/useLongPress';
import { useDialogs } from '../common/Dialogs';

type BattlerState = 'idle' | 'danced' | 'now';

interface Props {
  match: Match;
  format: BattleFormat | null;
  onSelect: (battlerId: string) => void;
  onUnmark: (battlerId: string) => void;
  onAdd: (name: string, teamId?: TeamId) => void;
}

export function BattlerPanel({ match, format, onSelect, onUnmark, onAdd }: Props) {
  const { prompt } = useDialogs();

  const stateOf = (b: Battler): BattlerState =>
    match.currentBattlerId === b.id ? 'now' : isDanced(match, b.id) ? 'danced' : 'idle';

  const renderList = (list: Battler[]) =>
    list.map((b) => (
      <BattlerButton key={b.id} battler={b} state={stateOf(b)} onSelect={onSelect} onUnmark={onUnmark} />
    ));

  const askAdd = async (teamId?: TeamId) => {
    const label = teamId ? `${teamName(match, teamId) || 'チーム' + teamId}にメンバー追加` : 'バトラーを追加';
    const name = await prompt({ title: label, label: '名前', okLabel: '追加', placeholder: 'バトラー名' });
    if (name) onAdd(name, teamId);
  };

  const addButton = (teamId?: TeamId) => (
    <button type="button" className="add-battler-btn" onClick={() => askAdd(teamId)}>
      ＋ {teamId ? 'メンバー追加' : 'バトラー追加'}
    </button>
  );

  const doneCount = match.battlers.filter((b) => isDanced(match, b.id)).length;

  if (format === 'teams') {
    return (
      <section className="panel battler-panel teams" aria-label="バトラー一覧">
        {(['A', 'B'] as TeamId[]).map((tid) => {
          const members = teamMembers(match, tid);
          const done = members.filter((b) => isDanced(match, b.id)).length;
          return (
            <div key={tid} className={`team-section team-${tid}`}>
              <h3 className="team-heading">
                <span className="team-tag">{tid}</span>
                <span className="team-heading-name">{teamName(match, tid) || `チーム${tid}`}</span>
                <span className="count-chip">
                  {done}/{members.length}
                </span>
              </h3>
              <div className="battler-scroll">
                {members.length === 0 && <p className="muted small empty-note">メンバー未登録</p>}
                {renderList(members)}
                {addButton(tid)}
              </div>
            </div>
          );
        })}
      </section>
    );
  }

  return (
    <section className={`panel battler-panel${format === 'oneVsOne' ? ' is-vs' : ''}`} aria-label="バトラー一覧">
      <h3 className="panel-heading">
        <span>バトラー</span>
        <span className="count-chip">
          済 {doneCount}/{match.battlers.length}
        </span>
      </h3>
      <div className="battler-scroll">
        {match.battlers.length === 0 && <p className="muted small empty-note">バトラー未登録です。下の「＋」から追加できます。</p>}
        {format === 'oneVsOne' && match.battlers.length === 2 ? (
          <>
            <BattlerButton battler={match.battlers[0]} state={stateOf(match.battlers[0])} onSelect={onSelect} onUnmark={onUnmark} />
            <div className="vs-divider" aria-hidden>
              VS
            </div>
            <BattlerButton battler={match.battlers[1]} state={stateOf(match.battlers[1])} onSelect={onSelect} onUnmark={onUnmark} />
          </>
        ) : (
          renderList(match.battlers)
        )}
        {format !== 'oneVsOne' && addButton()}
      </div>
    </section>
  );
}

function BattlerButton({
  battler,
  state,
  onSelect,
  onUnmark,
}: {
  battler: Battler;
  state: BattlerState;
  onSelect: (id: string) => void;
  onUnmark: (id: string) => void;
}) {
  const { toast } = useDialogs();
  const { pressing, handlers } = useLongPress({
    onLongPress: state === 'idle' ? undefined : () => onUnmark(battler.id),
    onClick: () => {
      if (state === 'idle') onSelect(battler.id);
      else toast(state === 'now' ? 'パフォーマンス中です（長押しで取り消し）' : '踊った印あり（長押しで解除）');
    },
  });

  const statusText = state === 'now' ? 'NOW' : state === 'danced' ? '済' : '';
  const icon = state === 'now' ? '▶' : state === 'danced' ? '✓' : '';

  return (
    <button
      type="button"
      className={`battler-btn is-${state}${pressing ? ' is-pressing' : ''}`}
      aria-label={`${battler.name || '名前未入力'}${state === 'now' ? '（パフォーマンス中）' : state === 'danced' ? '（踊った）' : ''}`}
      aria-pressed={state !== 'idle'}
      {...handlers}
    >
      <span className="battler-icon" aria-hidden>
        {icon}
      </span>
      <span className="battler-name">{battler.name || '（未入力）'}</span>
      {statusText && <span className={`battler-status status-${state}`}>{statusText}</span>}
      <span className="press-progress" aria-hidden />
    </button>
  );
}
