import qrcode from 'qrcode-generator';
import type { BattleEvent } from './types';
import { parseImport } from './storage';

/**
 * PC ⇔ スマホのデータ受け渡し用「転送コード」。
 * サーバーを使わず、イベントを圧縮した文字列としてコピー＆ペースト・リンク・QRで運ぶ。
 *   DMCP1z.<base64url(deflate-raw(JSON))>  … 圧縮あり
 *   DMCP1.<base64url(JSON)>                … 圧縮APIがないブラウザ用
 */
const PREFIX_RAW = 'DMCP1.';
const PREFIX_Z = 'DMCP1z.';
export const LINK_PARAM = 'import';

/** QRコードにするのはこの文字数まで（それ以上は画面から読み取りにくい） */
export const QR_MAX_CHARS = 1800;

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const res = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

const canCompress = () => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

/** 転送に不要な編集途中の下書きは除く */
function slim(ev: BattleEvent): BattleEvent {
  return { ...ev, matches: ev.matches.map((m) => ({ ...m, draft: null })) };
}

export async function encodeTransfer(events: BattleEvent[]): Promise<string> {
  const json = JSON.stringify({ app: 'dance-mc-panel', version: 1, events: events.map(slim) });
  const bytes = new TextEncoder().encode(json);
  if (canCompress()) {
    try {
      return PREFIX_Z + toBase64Url(await pipe(bytes, new CompressionStream('deflate-raw')));
    } catch {
      // 圧縮に失敗したら非圧縮で送る
    }
  }
  return PREFIX_RAW + toBase64Url(bytes);
}

/** 貼り付けられた文字列（コード単体・リンク・前後の文章入り）からコード部分を取り出す */
export function extractCode(input: string): string | null {
  const m = input.replace(/\s+/g, '').match(/DMCP1z?\.[A-Za-z0-9_-]+/);
  return m ? m[0] : null;
}

export async function decodeTransfer(input: string): Promise<BattleEvent[]> {
  const code = extractCode(input);
  if (!code) throw new Error('転送コードが見つかりません。コピーした内容をそのまま貼り付けてください');
  let bytes: Uint8Array;
  try {
    if (code.startsWith(PREFIX_Z)) {
      if (!canCompress()) throw new Error('このブラウザは圧縮コードに対応していません。ブラウザを更新してください');
      bytes = await pipe(fromBase64Url(code.slice(PREFIX_Z.length)), new DecompressionStream('deflate-raw'));
    } else {
      bytes = fromBase64Url(code.slice(PREFIX_RAW.length));
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('ブラウザ')) throw e;
    throw new Error('転送コードが途中で切れているか、壊れています。もう一度コピーしてください');
  }
  return parseImport(new TextDecoder().decode(bytes));
}

/** 現在開いているアプリのURLに転送コードを付けたリンク */
export function transferLink(code: string): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#${LINK_PARAM}=${code}`;
}

/** 起動時のURLに付いている転送コード（なければ null） */
export function codeFromLocation(): string | null {
  const hash = window.location.hash;
  if (!hash.startsWith(`#${LINK_PARAM}=`)) return null;
  return extractCode(hash);
}

export function clearLocationCode(): void {
  const { pathname, search } = window.location;
  history.replaceState(null, '', pathname + search);
}

/** QRコードのSVG。大きすぎる場合は null */
export function qrSvg(text: string): string | null {
  if (text.length > QR_MAX_CHARS) return null;
  try {
    const qr = qrcode(0, 'L');
    qr.addData(text, 'Byte');
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true });
  } catch {
    return null;
  }
}
