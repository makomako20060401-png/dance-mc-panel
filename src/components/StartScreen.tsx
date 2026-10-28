import { useRef } from 'react';
import { useStore } from '../store';
import { duplicateEvent, FORMAT_LABEL, newEvent } from '../model';
import { downloadEvents, parseImport } from '../storage';
import { useDialogs } from './common/Dialogs';

function formatDate(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function StartScreen() {
  const { state, update } = useStore();
  const { confirm, toast } = useDialogs();
  const fileRef = useRef<HTMLInputElement>(null);
  const events = [...state.events].sort((a, b) => b.updatedAt - a.updatedAt);

  const create = () => {
    const ev = newEvent();
    update((d) => {
      d.events.push(ev);
      d.activeEventId = ev.id;
    });
  };

  const importFile = async (file: File) => {
    try {
      const imported = parseImport(await file.text());
      update((d) => {
        for (const ev of imported) {
          // 同じIDがあれば別イベントとして取り込む（上書きしない）
          const exists = d.events.some((e) => e.id === ev.id);
          d.events.push(exists ? { ...ev, id: ev.id + '-' + Date.now().toString(36), name: ev.name + '（読込）' } : ev);
        }
      });
      toast(`${imported.length}件のイベントを読み込みました`);
    } catch (e) {
      toast(e instanceof Error ? e.message : '読み込みに失敗しました');
    }
  };

  return (
    <div className="page start">
      <header className="start-header">
        <div className="logo" aria-hidden>
          🎤
        </div>
        <h1>ダンスバトル MCパネル</h1>
        <p className="muted">実況・煽り・出演者・時間管理をこの1台で</p>
      </header>

      <button className="btn btn-primary btn-xl btn-block" onClick={create}>
        ＋ 新しいイベントを作成
      </button>

      <section className="section">
        <h2 className="section-title">保存済みイベントを再開</h2>
        {events.length === 0 ? (
          <p className="muted">保存済みのイベントはありません</p>
        ) : (
          <ul className="event-list">
            {events.map((ev) => (
              <li key={ev.id} className="event-item">
                <button
                  className="event-open"
                  onClick={() =>
                    update((d) => {
                      d.activeEventId = ev.id;
                    })
                  }
                >
                  <span className="event-name">{ev.name}</span>
                  <span className="event-meta">
                    {ev.format ? FORMAT_LABEL[ev.format] : '形式未選択'} ・ 全{ev.matches.length}試合
                    {ev.screen.kind === 'live' && <span className="badge badge-live">本番中</span>}
                  </span>
                  <span className="event-meta">最終更新 {formatDate(ev.updatedAt)}</span>
                </button>
                <button
                  className="icon-btn"
                  aria-label={`${ev.name}を複製`}
                  title="複製（出演者・設定・原稿を引き継ぎ、進行状況はリセット）"
                  onClick={() => {
                    const copy = duplicateEvent(ev);
                    update((d) => void d.events.push(copy));
                    toast(`「${copy.name}」を作成しました`);
                  }}
                >
                  ⧉
                </button>
                <button
                  className="icon-btn icon-btn-danger"
                  aria-label={`${ev.name}を削除`}
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'イベントを削除',
                      message: `「${ev.name}」を削除しますか？\n出演者・原稿・記録がすべて消え、元に戻せません。`,
                      okLabel: '削除する',
                      danger: true,
                    });
                    if (ok)
                      update((d) => {
                        d.events = d.events.filter((e) => e.id !== ev.id);
                      });
                  }}
                >
                  🗑
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section">
        <h2 className="section-title">バックアップ</h2>
        <p className="muted small">データはこの端末のブラウザ内に自動保存されます。機種変更や念のための控えにはファイルへ書き出してください。</p>
        <div className="row-wrap">
          <button
            className="btn"
            disabled={events.length === 0}
            onClick={() => downloadEvents(state.events, `dance-mc-backup-${Date.now()}.json`)}
          >
            ⬇ すべて書き出し
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            ⬆ ファイルから読み込み
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importFile(f);
              e.target.value = '';
            }}
          />
        </div>
      </section>
    </div>
  );
}
