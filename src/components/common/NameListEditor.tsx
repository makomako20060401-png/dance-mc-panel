import { useRef, useState } from 'react';
import type { Battler } from '../../types';
import { useDialogs } from './Dialogs';

interface Props {
  battlers: Battler[];
  onAdd: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  placeholder?: string;
  addLabel?: string;
}

/** 名前を1人ずつ追加し、編集・削除・並べ替えができる一覧 */
export function NameListEditor({ battlers, onAdd, onRename, onRemove, onMove, placeholder, addLabel = '追加' }: Props) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const add = () => {
    const name = value.trim();
    if (!name) {
      setError('名前を入力してください');
      inputRef.current?.focus();
      return;
    }
    onAdd(name);
    setValue('');
    setError(null);
    // 続けて入力できるようにフォーカスを戻す
    inputRef.current?.focus();
  };

  return (
    <div className="name-list">
      <div className="add-row">
        <input
          ref={inputRef}
          className="input"
          value={value}
          placeholder={placeholder ?? 'バトラー名'}
          enterKeyHint="enter"
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            // 日本語変換確定の Enter では追加しない
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault();
              add();
            }
          }}
        />
        <button className="btn btn-primary" onClick={add} type="button">
          ＋{addLabel}
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
      {battlers.length === 0 ? (
        <p className="muted small">まだ登録されていません</p>
      ) : (
        <ol className="name-items">
          {battlers.map((b, i) => (
            <NameItem
              key={b.id}
              index={i}
              battler={b}
              isFirst={i === 0}
              isLast={i === battlers.length - 1}
              onRename={onRename}
              onRemove={onRemove}
              onMove={onMove}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function NameItem({
  battler,
  index,
  isFirst,
  isLast,
  onRename,
  onRemove,
  onMove,
}: {
  battler: Battler;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onRename: Props['onRename'];
  onRemove: Props['onRemove'];
  onMove: Props['onMove'];
}) {
  const { confirm, toast } = useDialogs();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(battler.name);

  const commit = () => {
    const name = draft.trim();
    if (!name) {
      toast('名前は空欄にできません');
      setDraft(battler.name);
    } else if (name !== battler.name) {
      onRename(battler.id, name);
    }
    setEditing(false);
  };

  return (
    <li className="name-item">
      <span className="name-index">{index + 1}</span>
      {editing ? (
        <input
          className="input name-edit"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) commit();
            if (e.key === 'Escape') {
              setDraft(battler.name);
              setEditing(false);
            }
          }}
        />
      ) : (
        <button
          type="button"
          className="name-text"
          onClick={() => {
            setDraft(battler.name);
            setEditing(true);
          }}
          aria-label={`${battler.name || '名前未入力'}を編集`}
        >
          {battler.name || <span className="muted">（未入力）</span>}
          <span className="edit-hint" aria-hidden>
            ✎
          </span>
        </button>
      )}
      <div className="item-actions">
        <button type="button" className="icon-btn" disabled={isFirst} onClick={() => onMove(battler.id, -1)} aria-label="上へ">
          ▲
        </button>
        <button type="button" className="icon-btn" disabled={isLast} onClick={() => onMove(battler.id, 1)} aria-label="下へ">
          ▼
        </button>
        <button
          type="button"
          className="icon-btn icon-btn-danger"
          aria-label="削除"
          onClick={async () => {
            const ok = await confirm({
              title: 'バトラーを削除',
              message: `「${battler.name || '名前未入力'}」を削除しますか？\nこのバトラーの踊った記録も削除されます。`,
              okLabel: '削除する',
              danger: true,
            });
            if (ok) onRemove(battler.id);
          }}
        >
          ✕
        </button>
      </div>
    </li>
  );
}
