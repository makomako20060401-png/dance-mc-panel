import { useState } from 'react';
import { useActiveEvent } from '../../store';
import type { BattleEvent, Match, TeamId } from '../../types';
import {
  applyMatchups,
  matchCard,
  matchHasData,
  moveBattler,
  moveItem,
  newBattler,
  newMatch,
  parseMatchups,
  removeBattler,
  removeMatch,
  swapTeams,
  TEAM_COLORS,
  teamMembers,
  validateMatches,
} from '../../model';
import { useDialogs } from '../common/Dialogs';
import { NameListEditor } from '../common/NameListEditor';
import { ColorPicker } from '../common/ColorPicker';

type MatchRecipe = (m: Match) => void;

export function MatchesStep() {
  const [ev, updateEvent] = useActiveEvent();
  const { confirm } = useDialogs();
  const { errors, warnings } = validateMatches(ev);

  const updateMatch = (id: string, recipe: MatchRecipe) =>
    updateEvent((d) => {
      const m = d.matches.find((x) => x.id === id);
      if (m) recipe(m);
    });

  const addMatch = () =>
    updateEvent((d) => {
      d.matches.push(newMatch(d.format));
    });

  return (
    <div className="step">
      <h2 className="step-title">試合ごとの出演者</h2>
      <p className="muted small">
        {ev.format === 'teams'
          ? 'チーム名とメンバーを1人ずつ登録します。'
          : ev.format === 'oneVsOne'
            ? '各試合の対戦する2名を入力します。'
            : 'バトラー名を入力し、Enter または「追加」で一覧に加えます。'}
      </p>

      {ev.format === 'oneVsOne' && <BulkMatchups />}

      {ev.matches.map((m, i) => (
        <MatchCard
          key={m.id}
          ev={ev}
          match={m}
          index={i}
          errors={errors.filter((e) => e.matchId === m.id).map((e) => e.message)}
          warnings={warnings.filter((e) => e.matchId === m.id).map((e) => e.message)}
          onUpdate={(r) => updateMatch(m.id, r)}
          onMove={(dir) =>
            updateEvent((d) => {
              moveItem(d.matches, i, dir);
            })
          }
          onRemove={async () => {
            if (ev.matches.length <= 1) return;
            const ok = await confirm({
              title: `第${i + 1}試合を削除`,
              message: matchHasData(m)
                ? `「${matchCard(m, ev.format)}」を削除しますか？\n出演者・原稿・記録も削除され、元に戻せません。`
                : `第${i + 1}試合を削除しますか？`,
              okLabel: '削除する',
              danger: true,
            });
            if (ok) updateEvent((d) => removeMatch(d, m.id));
          }}
        />
      ))}

      <button className="btn btn-dashed btn-block btn-lg" onClick={addMatch}>
        ＋ 試合を追加
      </button>
    </div>
  );
}

function MatchCard({
  ev,
  match,
  index,
  errors,
  warnings,
  onUpdate,
  onMove,
  onRemove,
}: {
  ev: BattleEvent;
  match: Match;
  index: number;
  errors: string[];
  warnings: string[];
  onUpdate: (r: MatchRecipe) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const total = ev.matches.length;
  return (
    <section className={`card match-card${errors.length ? ' has-error' : ''}`} aria-label={`第${index + 1}試合`}>
      <div className="match-card-head">
        <h3 className="match-card-title">第{index + 1}試合</h3>
        <div className="item-actions">
          <button className="icon-btn" disabled={index === 0} onClick={() => onMove(-1)} aria-label="試合を上へ">
            ▲
          </button>
          <button className="icon-btn" disabled={index === total - 1} onClick={() => onMove(1)} aria-label="試合を下へ">
            ▼
          </button>
          <button className="icon-btn icon-btn-danger" disabled={total <= 1} onClick={onRemove} aria-label="試合を削除">
            ✕
          </button>
        </div>
      </div>
      <label className="field">
        <span className="field-label">見出し（任意）</span>
        <input
          className="input"
          placeholder="例: 予選A / 準決勝"
          value={match.label}
          onChange={(e) => onUpdate((m) => void (m.label = e.target.value))}
        />
      </label>

      {ev.format === 'oneVsOne' && <OneVsOneEditor match={match} onUpdate={onUpdate} />}
      {ev.format === 'circle' && (
        <NameListEditor
          battlers={match.battlers}
          onAdd={(name) => onUpdate((m) => void m.battlers.push(newBattler(name)))}
          onRename={(id, name) => onUpdate((m) => renameBattler(m, id, name))}
          onRemove={(id) => onUpdate((m) => removeBattler(m, id))}
          onMove={(id, dir) => onUpdate((m) => moveBattler(m, id, dir))}
        />
      )}
      {ev.format === 'teams' && <TeamsEditor match={match} onUpdate={onUpdate} />}

      {(errors.length > 0 || warnings.length > 0) && (
        <ul className="issue-list">
          {errors.map((e) => (
            <li key={e} className="issue issue-error">
              ⚠ {e.replace(/^第\d+試合: /, '')}
            </li>
          ))}
          {warnings.map((e) => (
            <li key={e} className="issue issue-warn">
              ℹ {e.replace(/^第\d+試合: /, '')}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function renameBattler(m: Match, id: string, name: string) {
  const b = m.battlers.find((x) => x.id === id);
  if (b) b.name = name;
}

function OneVsOneEditor({ match, onUpdate }: { match: Match; onUpdate: (r: MatchRecipe) => void }) {
  return (
    <div className="vs-editor">
      {match.battlers.slice(0, 2).map((b, i) => (
        <div key={b.id} className="vs-slot">
          <label className="field">
            <span className="field-label">{i === 0 ? 'バトラー1' : 'バトラー2'}</span>
            <input
              className={`input${b.name.trim() ? '' : ' input-empty'}`}
              placeholder="名前を入力"
              value={b.name}
              onChange={(e) => onUpdate((m) => renameBattler(m, b.id, e.target.value))}
            />
          </label>
          {i === 0 && (
            <div className="vs-mark" aria-hidden>
              VS
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TeamsEditor({ match, onUpdate }: { match: Match; onUpdate: (r: MatchRecipe) => void }) {
  const updateTeam = (tid: TeamId, patch: { name?: string; color?: string }) =>
    onUpdate((m) => {
      const t = m.teams.find((x) => x.id === tid);
      if (t) Object.assign(t, patch);
    });

  const block = (tid: TeamId) => {
    const team = match.teams.find((t) => t.id === tid)!;
    return (
      <div key={tid} className="team-block" style={{ '--team': team.color } as React.CSSProperties}>
        <div className="team-block-head">
          <span className="team-pos">{tid === 'A' ? '上段' : '下段'}</span>
          <span className="field-label">チーム{tid}</span>
        </div>
        <input
          className={`input${team.name.trim() ? '' : ' input-empty'}`}
          placeholder="チーム名を入力"
          aria-label={`チーム${tid}の名前`}
          value={team.name}
          onChange={(e) => updateTeam(tid, { name: e.target.value })}
        />
        <ColorPicker
          label={`チーム${tid}の色`}
          value={team.color}
          options={TEAM_COLORS}
          onChange={(color) => updateTeam(tid, { color })}
        />
        <NameListEditor
          battlers={teamMembers(match, tid)}
          placeholder={`チーム${tid}のメンバー名`}
          onAdd={(name) => onUpdate((m) => void m.battlers.push(newBattler(name, tid)))}
          onRename={(id, name) => onUpdate((m) => renameBattler(m, id, name))}
          onRemove={(id) => onUpdate((m) => removeBattler(m, id))}
          onMove={(id, dir) => onUpdate((m) => moveBattler(m, id, dir))}
        />
      </div>
    );
  };

  return (
    <div className="teams-editor">
      {block('A')}
      <button type="button" className="btn btn-sm swap-btn" onClick={() => onUpdate(swapTeams)}>
        ⇅ 上下を入れ替え
      </button>
      {block('B')}
    </div>
  );
}

/** パソコン向け: 対戦カードを1行1試合でまとめて入力 */
function BulkMatchups() {
  const [, updateEvent] = useActiveEvent();
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState<string | null>(null);

  const apply = () => {
    const { pairs, errors } = parseMatchups(text);
    setErrors(errors);
    if (!pairs.length) {
      setDone(null);
      if (!errors.length) setErrors(['対戦カードを入力してください']);
      return;
    }
    updateEvent((d) => applyMatchups(d, pairs));
    setDone(`${pairs.length}試合分を入力しました`);
    setText(errors.length ? text : '');
  };

  return (
    <details className="card bulk">
      <summary className="bulk-summary">📋 対戦カードをまとめて入力（パソコン向け）</summary>
      <p className="muted small">
        1行に1試合。「KAZANE vs Taisuke」のように vs で区切るか、Excel・スプレッドシートの2列をそのまま貼り付けます。名前が空の試合から順に埋まり、足りない分は試合が追加されます。
      </p>
      <textarea
        className="input textarea bulk-text"
        value={text}
        placeholder={'KAZANE vs Taisuke\nSHIGEKIX vs Ayumi\nRIKU\tHiro'}
        onChange={(e) => {
          setText(e.target.value);
          setDone(null);
        }}
      />
      <button className="btn btn-primary" onClick={apply}>
        試合に反映する
      </button>
      {done && <p className="ok-text">✓ {done}</p>}
      {errors.map((e) => (
        <p key={e} className="error-text">
          ⚠ {e}
        </p>
      ))}
    </details>
  );
}
