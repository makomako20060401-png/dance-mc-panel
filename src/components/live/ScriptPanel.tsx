import { useRef } from 'react';
import type { Match } from '../../types';
import { useDialogs } from '../common/Dialogs';

type Field = 'script' | 'memo';

interface Props {
  match: Match;
  onStartEdit: () => void;
  onChangeDraft: (field: Field, value: string) => void;
  onSave: () => void;
  onDiscard: () => void;
  onExpand: () => void;
}

export function ScriptPanel({ match, onStartEdit, onChangeDraft, onSave, onDiscard, onExpand }: Props) {
  const { confirm } = useDialogs();
  const draft = match.draft;
  const editing = draft != null;
  const empty = !match.script.trim() && !match.memo.trim();
  const refs = { script: useRef<HTMLTextAreaElement>(null), memo: useRef<HTMLTextAreaElement>(null) };
  const lastField = useRef<Field>('script');

  // 原稿に名前を差し込むための候補（チーム名 → バトラー名）
  const hasTeams = match.battlers.some((b) => b.teamId);
  const names = [
    ...(hasTeams ? match.teams.map((t) => t.name.trim()) : []),
    ...match.battlers.map((b) => b.name.trim()),
  ].filter((n, i, all) => n && all.indexOf(n) === i);

  /** カーソル位置に挿入。チップを押してもキーボードが閉じないよう focus は奪わない */
  const insert = (text: string) => {
    if (!draft) return;
    const field = lastField.current;
    const el = refs[field].current;
    const value = draft[field];
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    onChangeDraft(field, value.slice(0, start) + text + value.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + text.length, start + text.length);
    });
  };

  const cancel = async () => {
    const changed = draft && (draft.script !== match.script || draft.memo !== match.memo);
    if (changed) {
      const ok = await confirm({
        title: '編集を破棄しますか？',
        message: '保存していない変更は失われます。',
        okLabel: '破棄する',
        cancelLabel: '編集を続ける',
        danger: true,
      });
      if (!ok) return;
    }
    onDiscard();
  };

  return (
    <section className={`panel script-panel${editing ? ' is-editing' : ''}`} aria-label="MC原稿・メモ">
      <div className="panel-heading script-heading">
        {editing ? (
          <>
            <button type="button" className="btn btn-sm btn-primary" onClick={onSave}>
              保存
            </button>
            <button type="button" className="btn btn-sm" onClick={cancel}>
              キャンセル
            </button>
            <span className="editing-label">編集中</span>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-sm" onClick={onStartEdit} aria-label="原稿を編集">
              ✎<span className="btn-text"> 編集</span>
            </button>
            <button type="button" className="panel-title title-btn" onClick={onExpand} tabIndex={-1}>
              MC原稿
            </button>
            <button type="button" className="btn btn-sm btn-icon-text" onClick={onExpand} aria-label="原稿を拡大表示">
              ⤢<span className="btn-text"> 拡大</span>
            </button>
          </>
        )}
      </div>

      {editing ? (
        <div className="script-edit">
          <label className="field field-grow">
            <span className="field-label">MC原稿</span>
            <textarea
              ref={refs.script}
              className="input textarea textarea-grow"
              onFocus={() => (lastField.current = 'script')}
              value={draft.script}
              placeholder="煽り文句・紹介文・進行など"
              onChange={(e) => onChangeDraft('script', e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">メモ</span>
            <textarea
              ref={refs.memo}
              className="input textarea textarea-memo"
              onFocus={() => (lastField.current = 'memo')}
              value={draft.memo}
              placeholder="スポンサー告知・注意事項など"
              onChange={(e) => onChangeDraft('memo', e.target.value)}
            />
          </label>
          {names.length > 0 && (
            <div className="name-chips" aria-label="名前を挿入">
              <span className="field-label">タップで名前を挿入</span>
              <div className="name-chips-row">
                {names.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="name-chip"
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => insert(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="muted tiny">入力内容は自動で下書き保存されます</p>
        </div>
      ) : (
        <div className="script-scroll">
          {empty ? (
            <p className="muted empty-note">原稿はまだありません。「✎ 編集」から入力できます。</p>
          ) : (
            <>
              {match.script.trim() && <div className="script-text">{match.script}</div>}
              {match.memo.trim() && (
                <div className="memo-box">
                  <div className="memo-label">メモ</div>
                  <div className="memo-text">{match.memo}</div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
