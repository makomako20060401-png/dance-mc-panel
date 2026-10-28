import { describe, expect, it } from 'vitest';
import { decodeTransfer, encodeTransfer, extractCode } from './transfer';
import { newBattler, newEvent, newMatch } from './model';

function sampleEvent() {
  const ev = newEvent(0);
  ev.name = '関東予選 2026';
  ev.format = 'circle';
  ev.matches = [newMatch('circle')];
  ev.matches[0].battlers = ['KAZANE', 'たいすけ', 'SHIGEKIX'].map((n) => newBattler(n));
  ev.matches[0].script = 'Yo! 会場の皆さん準備はいいか！\n'.repeat(20);
  ev.matches[0].draft = { script: '下書き', memo: '' };
  return ev;
}

describe('転送コード', () => {
  it('日本語を含むイベントを圧縮して往復できる（下書きは送らない）', async () => {
    const ev = sampleEvent();
    const code = await encodeTransfer([ev]);
    expect(code.startsWith('DMCP1z.')).toBe(true);
    // 繰り返しの多い原稿は圧縮で小さくなる
    expect(code.length).toBeLessThan(JSON.stringify(ev).length);
    const [back] = await decodeTransfer(code);
    expect(back.name).toBe('関東予選 2026');
    expect(back.matches[0].battlers.map((b) => b.name)).toEqual(['KAZANE', 'たいすけ', 'SHIGEKIX']);
    expect(back.matches[0].script).toBe(ev.matches[0].script);
    expect(back.matches[0].draft).toBeNull();
  });

  it('LINEなどで前後に文章や改行が入っても読み取れる', async () => {
    const code = await encodeTransfer([sampleEvent()]);
    const pasted = `これ送るね\n${code.slice(0, 20)}\n${code.slice(20)}\nよろしく`;
    expect(extractCode(pasted)).toBe(code);
    const link = `https://example.com/app/#import=${code}`;
    expect((await decodeTransfer(link))[0].name).toBe('関東予選 2026');
  });

  it('途中で切れたコードは分かりやすいエラーにする', async () => {
    const code = await encodeTransfer([sampleEvent()]);
    await expect(decodeTransfer(code.slice(0, code.length / 2))).rejects.toThrow(/途中で切れている|壊れて/);
    await expect(decodeTransfer('こんにちは')).rejects.toThrow(/見つかりません/);
  });
});
