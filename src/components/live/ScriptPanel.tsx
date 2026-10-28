import type { Match } from '../../types';
import { useDialogs } from '../common/Dialogs';

interface Props {
  match: Match;
  onStartEdit: () => void;
  onChangeDraft: (field: 'script' | 'memo', value: string) => void;
  onSave: () => void;
  onDiscard: () => void;
  onExpand: () => void;
}

export function ScriptPanel({ match, onStartEdit, onChangeDraft, onSave, onDiscard, onExpand }: Props) {
  const { confirm } = useDialogs();
  const draft = match.draft;
  const editing = draft != null;
  const empty = !match.script.trim() && !match.memo.trim();

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
            <button type="button" className="btn btn-sm" onClick={onStartEdit}>
              ✎ 編集
            </button>
            <span className="panel-title">MC原稿</span>
            <button type="button" className="btn btn-sm btn-icon-text" onClick={onExpand} aria-label="原稿を拡大表示">
              ⤢ 拡大
            </button>
          </>
        )}
      </div>

      {editing ? (
        <div className="script-edit">
          <label className="field field-grow">
            <span className="field-label">MC原稿</span>
            <textarea
              className="input textarea textarea-grow"
              value={draft.script}
              placeholder="煽り文句・紹介文・進行など"
              onChange={(e) => onChangeDraft('script', e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">メモ</span>
            <textarea
              className="input textarea textarea-memo"
              value={draft.memo}
              placeholder="スポンサー告知・注意事項など"
              onChange={(e) => onChangeDraft('memo', e.target.value)}
            />
          </label>
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
