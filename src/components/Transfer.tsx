import { useEffect, useRef, useState } from 'react';
import type { BattleEvent } from '../types';
import { useStore } from '../store';
import { canDownload } from '../storage';
import { clearLocationCode, codeFromLocation, decodeTransfer, encodeTransfer, qrSvg, transferLink } from '../transfer';
import { Modal, useDialogs } from './common/Dialogs';

/** リンクやQRで開けるのは、通常のWebサイトとして公開されている場合だけ */
const linkUsable = canDownload && /^https?:$/.test(window.location.protocol);

/**
 * 受け取ったイベントを端末に追加する。
 * 同じイベント（PCで作ったものを送り直した場合など）が既にあれば、上書きするか別に追加するかを選ぶ。
 */
export function useImportEvents() {
  const { state, update } = useStore();
  const { confirm, toast } = useDialogs();

  return async (incoming: BattleEvent[]): Promise<void> => {
    let added = 0;
    for (const ev of incoming) {
      const existing = state.events.find((e) => e.id === ev.id);
      let overwrite = false;
      if (existing) {
        overwrite = await confirm({
          title: `「${existing.name}」は既にこの端末にあります`,
          message:
            '送られてきた内容で上書きしますか？\n' +
            (existing.screen.kind === 'live' || existing.hasGoneLive
              ? '※ この端末での踊った印・タイマーなどの進行状況も、送られてきた内容に置き換わります。\n'
              : '') +
            '「別に追加」を選ぶと、両方を残します。',
          okLabel: '上書きする',
          cancelLabel: '別に追加',
        });
      }
      update((d) => {
        if (overwrite) {
          const i = d.events.findIndex((e) => e.id === ev.id);
          // 本番中なら本番画面のまま、それ以外は受け取った画面状態を使う
          d.events[i] = { ...ev, updatedAt: Date.now() };
        } else if (existing) {
          d.events.push({ ...ev, id: ev.id + '-' + Date.now().toString(36), name: ev.name + '（受信）', updatedAt: Date.now() });
        } else {
          d.events.push({ ...ev, updatedAt: Date.now() });
        }
      });
      added++;
    }
    if (added === 1) toast(`「${incoming[0].name}」を取り込みました`);
    else if (added > 1) toast(`${added}件のイベントを取り込みました`);
  };
}

async function copyText(text: string, fallback: HTMLTextAreaElement | null): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    if (!fallback) return false;
    fallback.focus();
    fallback.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    }
  }
}

/** PC → スマホ（またはその逆）にイベントを送る */
export function SendDialog({ events, onClose }: { events: BattleEvent[]; onClose: () => void }) {
  const { toast } = useDialogs();
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    encodeTransfer(events).then(setCode, () => setError('転送コードを作れませんでした'));
  }, [events]);

  const link = code ? transferLink(code) : '';
  const svg = code && linkUsable ? qrSvg(link) : null;
  const title = events.length === 1 ? `「${events[0].name}」を送る` : `${events.length}件のイベントを送る`;

  const copy = async (text: string, label: string) => {
    const ok = await copyText(text, areaRef.current);
    toast(ok ? `${label}をコピーしました` : '下の枠の文字をすべて選んでコピーしてください');
  };

  return (
    <Modal title={title} onClose={onClose} wide footer={<button className="btn" onClick={onClose}>閉じる</button>}>
      {error && <p className="error-text">{error}</p>}
      {!code && !error && <p className="muted">転送コードを作成中…</p>}
      {code && (
        <div className="transfer">
          <ol className="transfer-steps">
            <li>「転送コードをコピー」を押す</li>
            <li>LINE・メール・AirDrop などで、自分のスマホに送る</li>
            <li>スマホでこのアプリを開き、最初の画面の「📥 受け取る」に貼り付ける</li>
          </ol>
          <button className="btn btn-primary btn-lg btn-block" onClick={() => copy(code, '転送コード')}>
            📋 転送コードをコピー
          </button>
          <textarea ref={areaRef} className="input transfer-code" readOnly value={code} aria-label="転送コード" onFocus={(e) => e.target.select()} />
          <p className="muted tiny">{code.length.toLocaleString()}文字。インターネットを通さずに、この文字列だけでデータを運びます。</p>

          {linkUsable && (
            <div className="transfer-qr-block">
              <h3 className="card-title">QRコード・リンクで送る</h3>
              {svg ? (
                <div className="transfer-qr" dangerouslySetInnerHTML={{ __html: svg }} />
              ) : (
                <p className="muted small">データが大きいため QR コードは表示できません。転送コードかリンクを使ってください。</p>
              )}
              <p className="muted small">
                スマホのカメラで読み取るか、リンクをスマホで開くと、ブラウザでアプリが開いて取り込めます。
                <br />
                iPhone で「ホーム画面に追加」したアプリを使っている場合は、ブラウザとデータが別になるため、転送コードの貼り付けを使ってください。
              </p>
              <button className="btn btn-block" onClick={() => copy(link, 'リンク')}>
                🔗 リンクをコピー
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

/** 転送コードを貼り付けて取り込む */
export function ReceiveDialog({ onClose }: { onClose: () => void }) {
  const importEvents = useImportEvents();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const events = await decodeTransfer(text);
      onClose();
      await importEvents(events);
    } catch (e) {
      setError(e instanceof Error ? e.message : '取り込めませんでした');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="📥 受け取る"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            キャンセル
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={!text.trim() || busy}>
            取り込む
          </button>
        </>
      }
    >
      <p className="small">別の端末で「送る」からコピーした転送コードを貼り付けてください。</p>
      <textarea
        className="input transfer-code"
        value={text}
        placeholder="DMCP1z.… で始まる文字列"
        autoFocus
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
      />
      {error && <p className="error-text">{error}</p>}
    </Modal>
  );
}

/** QRコード・リンクから開かれた場合に、URLに付いた転送コードを取り込む */
export function LinkImporter() {
  const importEvents = useImportEvents();
  const { toast } = useDialogs();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const code = codeFromLocation();
    if (!code) return;
    clearLocationCode();
    decodeTransfer(code).then(importEvents, (e) => toast(e instanceof Error ? e.message : 'リンクから取り込めませんでした'));
  }, [importEvents, toast]);

  return null;
}
