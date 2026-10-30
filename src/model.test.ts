import { describe, expect, it } from 'vitest';
import { produce } from 'immer';
import {
  changeFormat,
  currentMatch,
  applyMatchups,
  inkOn,
  swapTeams,
  togglePersonalTimer,
  duplicateEvent,
  nextTeam,
  parseMatchups,
  goToMatch,
  isDanced,
  moveBattler,
  newBattler,
  newEvent,
  newMatch,
  removeBattler,
  selectBattler,
  setMatchCount,
  unmarkBattler,
  validateEvent,
  validateSettings,
} from './model';
import { elapsedMs, isRunning, startWatch, stoppedWatch, timerView } from './time';
import type { BattleEvent, Match } from './types';

function circleMatch(...names: string[]): Match {
  const m = newMatch('circle');
  m.battlers = names.map((n) => newBattler(n));
  return m;
}

function liveEvent(): BattleEvent {
  const ev = newEvent(0);
  ev.format = 'circle';
  ev.matches = [circleMatch('A', 'B', 'C'), circleMatch('D', 'E')];
  ev.currentMatchId = ev.matches[0].id;
  return ev;
}

describe('バトラー選択', () => {
  it('タップで担当者・踊った印・個人タイマー開始を同時に行う', () => {
    const m = produce(circleMatch('A', 'B'), (d) => void selectBattler(d, d.battlers[0].id, 1000));
    const a = m.battlers[0];
    expect(m.currentBattlerId).toBe(a.id);
    expect(isDanced(m, a.id)).toBe(true);
    expect(m.personalTimer).toEqual({ runningSince: 1000, accumulatedMs: 0 });
    expect(isRunning(m.matchTimer)).toBe(true);
  });

  it('別のバトラーに切り替えると個人タイマーを初期値から再開し、前の印は残る', () => {
    let m = circleMatch('A', 'B');
    const [a, b] = m.battlers;
    m = produce(m, (d) => void selectBattler(d, a.id, 1000));
    m = produce(m, (d) => void selectBattler(d, b.id, 50_000));
    expect(m.currentBattlerId).toBe(b.id);
    expect(m.personalTimer).toEqual({ runningSince: 50_000, accumulatedMs: 0 });
    expect(isDanced(m, a.id)).toBe(true);
    // 試合経過は継続
    expect(m.matchTimer.runningSince).toBe(1000);
  });

  it('名前を押す前に手動で動かしていた個人タイマーは、名前を押してもそのまま続く', () => {
    let m = circleMatch('A', 'B');
    const [a, b] = m.battlers;
    m = produce(m, (d) => void (d.personalTimer = startWatch(d.personalTimer, 1000)));
    m = produce(m, (d) => void selectBattler(d, a.id, 15_000));
    expect(m.currentBattlerId).toBe(a.id);
    expect(m.personalTimer.runningSince).toBe(1000);
    expect(elapsedMs(m.personalTimer, 15_000)).toBe(14_000);
    // 踊り始めは手動で開始した時刻として記録
    expect(m.performances[0].startedAt).toBe(1000);
    // 次の人に切り替えたときは、これまで通り初期値から
    m = produce(m, (d) => void selectBattler(d, b.id, 60_000));
    expect(m.personalTimer).toEqual({ runningSince: 60_000, accumulatedMs: 0 });
  });

  it('前の人の後にリセット→▶ で手動開始すると NOW が外れ、次の人の名前で引き継げる', () => {
    let m = circleMatch('A', 'B');
    const [a, b] = m.battlers;
    m = produce(m, (d) => void selectBattler(d, a.id, 1000));
    // A の時間が終わり、リセット（長押し↺）してから、みんなで踊り始めたところで ▶
    m = produce(m, (d) => void (d.personalTimer = stoppedWatch()));
    m = produce(m, (d) => togglePersonalTimer(d, 70_000));
    expect(m.currentBattlerId).toBeNull();
    expect(isDanced(m, a.id)).toBe(true);
    // B が残ったので B の名前を押す → タイマーはそのまま
    m = produce(m, (d) => void selectBattler(d, b.id, 82_000));
    expect(m.currentBattlerId).toBe(b.id);
    expect(m.personalTimer.runningSince).toBe(70_000);
  });

  it('途中で止めた時間からの再開では担当者は変わらない', () => {
    let m = circleMatch('A');
    const a = m.battlers[0];
    m = produce(m, (d) => void selectBattler(d, a.id, 1000));
    m = produce(m, (d) => togglePersonalTimer(d, 5000));
    m = produce(m, (d) => togglePersonalTimer(d, 9000));
    expect(m.currentBattlerId).toBe(a.id);
    expect(elapsedMs(m.personalTimer, 10_000)).toBe(5000);
  });

  it('手動で開始して一時停止中なら、名前を押すと初期値から開始する', () => {
    let m = circleMatch('A');
    m = produce(m, (d) => void (d.personalTimer = { runningSince: null, accumulatedMs: 5000 }));
    m = produce(m, (d) => void selectBattler(d, d.battlers[0].id, 20_000));
    expect(m.personalTimer).toEqual({ runningSince: 20_000, accumulatedMs: 0 });
  });

  it('踊った印のあるバトラーは通常タップで再選択できない', () => {
    let m = circleMatch('A', 'B');
    const [a, b] = m.battlers;
    m = produce(m, (d) => void selectBattler(d, a.id, 1000));
    m = produce(m, (d) => void selectBattler(d, b.id, 2000));
    let result: string = '';
    m = produce(m, (d) => void (result = selectBattler(d, a.id, 3000)));
    expect(result).toBe('alreadyDanced');
    expect(m.currentBattlerId).toBe(b.id);
    expect(m.personalTimer.runningSince).toBe(2000);
  });
});

describe('長押しで印を解除', () => {
  it('現在の担当者を解除すると個人タイマーを停止して初期状態に戻す', () => {
    let m = circleMatch('A');
    const a = m.battlers[0];
    m = produce(m, (d) => void selectBattler(d, a.id, 1000));
    m = produce(m, (d) => unmarkBattler(d, a.id, 5000));
    expect(isDanced(m, a.id)).toBe(false);
    expect(m.currentBattlerId).toBeNull();
    expect(m.personalTimer).toEqual({ runningSince: null, accumulatedMs: 0 });
    // 履歴は無効化として残る
    expect(m.performances[0].voidedAt).toBe(5000);
  });

  it('他のバトラーを解除しても動作中のタイマーに影響しない', () => {
    let m = circleMatch('A', 'B');
    const [a, b] = m.battlers;
    m = produce(m, (d) => void selectBattler(d, a.id, 1000));
    m = produce(m, (d) => void selectBattler(d, b.id, 2000));
    m = produce(m, (d) => unmarkBattler(d, a.id, 3000));
    expect(isDanced(m, a.id)).toBe(false);
    expect(m.currentBattlerId).toBe(b.id);
    expect(m.personalTimer.runningSince).toBe(2000);
  });

  it('解除後は再び選択できる（2回目のパフォーマンスとして履歴に残る）', () => {
    let m = circleMatch('A');
    const a = m.battlers[0];
    m = produce(m, (d) => void selectBattler(d, a.id, 1000));
    m = produce(m, (d) => unmarkBattler(d, a.id, 2000));
    m = produce(m, (d) => void selectBattler(d, a.id, 3000));
    expect(m.currentBattlerId).toBe(a.id);
    expect(m.performances).toHaveLength(2);
  });
});

describe('試合切替', () => {
  it('切替前の試合のタイマーを一時停止し、戻っても自動で再開しない', () => {
    let ev = liveEvent();
    const first = ev.matches[0];
    ev = produce(ev, (d) => void selectBattler(d.matches[0], first.battlers[0].id, 1000));
    ev = produce(ev, (d) => void goToMatch(d, 1, 11_000));
    const paused = ev.matches[0];
    expect(isRunning(paused.personalTimer)).toBe(false);
    expect(paused.personalTimer.accumulatedMs).toBe(10_000);
    expect(isRunning(paused.matchTimer)).toBe(false);
    expect(currentMatch(ev)?.id).toBe(ev.matches[1].id);

    ev = produce(ev, (d) => void goToMatch(d, 0, 99_000));
    const back = currentMatch(ev)!;
    expect(isRunning(back.personalTimer)).toBe(false);
    expect(elapsedMs(back.personalTimer, 200_000)).toBe(10_000);
    // 印・担当者も保持
    expect(back.currentBattlerId).toBe(first.battlers[0].id);
  });

  it('範囲外への移動は無視する', () => {
    const ev = liveEvent();
    const after = produce(ev, (d) => void goToMatch(d, 5, 0));
    expect(after.currentMatchId).toBe(ev.currentMatchId);
  });
});

describe('タイマー表示', () => {
  const sw = (start: number) => ({ runningSince: start, accumulatedMs: 0 });

  it('制限ありはカウントダウン、警戒時間で warn、0を過ぎたら超過表示', () => {
    expect(timerView(sw(0), 0, 60, 10)).toMatchObject({ text: '1:00', phase: 'normal' });
    expect(timerView(sw(0), 49_500, 60, 10)).toMatchObject({ text: '0:11', phase: 'normal' });
    expect(timerView(sw(0), 50_000, 60, 10)).toMatchObject({ text: '0:10', phase: 'warn' });
    expect(timerView(sw(0), 60_000, 60, 10)).toMatchObject({ text: '+0:00', phase: 'over' });
    expect(timerView(sw(0), 65_400, 60, 10)).toMatchObject({ text: '+0:05', phase: 'over' });
  });

  it('制限なしはカウントアップ', () => {
    expect(timerView(sw(0), 125_000, null, null)).toMatchObject({ text: '2:05', phase: 'normal' });
    expect(timerView({ runningSince: null, accumulatedMs: 0 }, 0, null, null).phase).toBe('idle');
  });
});

describe('編集', () => {
  it('バトラー削除で担当者・履歴も掃除する', () => {
    let m = circleMatch('A', 'B');
    const a = m.battlers[0];
    m = produce(m, (d) => void selectBattler(d, a.id, 1000));
    m = produce(m, (d) => removeBattler(d, a.id));
    expect(m.battlers.map((b) => b.name)).toEqual(['B']);
    expect(m.performances).toHaveLength(0);
    expect(m.currentBattlerId).toBeNull();
  });

  it('チーム形式の並べ替えは同じチーム内で行う', () => {
    const m = newMatch('teams');
    m.battlers = [newBattler('a1', 'A'), newBattler('b1', 'B'), newBattler('a2', 'A')];
    const after = produce(m, (d) => moveBattler(d, d.battlers[2].id, -1));
    expect(after.battlers.map((b) => b.name)).toEqual(['a2', 'b1', 'a1']);
  });

  it('試合数の増減', () => {
    let ev = liveEvent();
    ev = produce(ev, (d) => setMatchCount(d, 4));
    expect(ev.matches).toHaveLength(4);
    ev = produce(ev, (d) => setMatchCount(d, 1));
    expect(ev.matches).toHaveLength(1);
  });

  it('形式変更: サークル → 1vs1 は先頭2名、→ チームは半分ずつ割り当て', () => {
    const ev = liveEvent();
    const one = produce(ev, (d) => changeFormat(d, 'oneVsOne'));
    expect(one.matches[0].battlers.map((b) => b.name)).toEqual(['A', 'B']);
    const teams = produce(ev, (d) => changeFormat(d, 'teams'));
    expect(teams.matches[0].battlers.map((b) => b.teamId)).toEqual(['A', 'A', 'B']);
  });
});

describe('入力チェック', () => {
  it('制限時間0秒や警戒時間が制限以上はエラー', () => {
    const ev = newEvent(0);
    ev.timers.performanceSec = 0;
    expect(validateSettings(ev).length).toBeGreaterThan(0);
    ev.timers.performanceSec = 30;
    ev.timers.performanceWarnSec = 30;
    expect(validateSettings(ev).some((i) => i.message.includes('警戒'))).toBe(true);
    ev.timers.performanceWarnSec = 10;
    expect(validateSettings(ev)).toHaveLength(0);
  });

  it('制限なしなら警戒時間はチェックしない', () => {
    const ev = newEvent(0);
    ev.timers.performanceLimited = false;
    ev.timers.performanceSec = 0;
    ev.timers.performanceWarnSec = 999;
    expect(validateSettings(ev)).toHaveLength(0);
  });

  it('1vs1 の空欄名・チーム名空欄はエラー', () => {
    const ev = newEvent(0);
    ev.format = 'oneVsOne';
    ev.matches = [newMatch('oneVsOne')];
    expect(validateEvent(ev).errors.length).toBeGreaterThan(0);
    ev.matches[0].battlers[0].name = 'X';
    ev.matches[0].battlers[1].name = 'Y';
    expect(validateEvent(ev).errors).toHaveLength(0);

    ev.format = 'teams';
    ev.matches = [newMatch('teams')];
    expect(validateEvent(ev).errors.some((e) => e.message.includes('チームA'))).toBe(true);
  });
});

describe('チーム形式の次のチーム', () => {
  it('直前に踊ったチームの相手を返す（解除された履歴は無視）', () => {
    let m = newMatch('teams');
    m.battlers = [newBattler('a1', 'A'), newBattler('b1', 'B')];
    expect(nextTeam(m)).toBeNull();
    m = produce(m, (d) => void selectBattler(d, d.battlers[0].id, 1));
    expect(nextTeam(m)).toBe('B');
    m = produce(m, (d) => void selectBattler(d, d.battlers[1].id, 2));
    expect(nextTeam(m)).toBe('A');
    m = produce(m, (d) => unmarkBattler(d, d.battlers[1].id, 3));
    expect(nextTeam(m)).toBe('B');
  });
});

describe('イベント複製', () => {
  it('出演者と原稿は引き継ぎ、進行状況はリセットする', () => {
    let ev = liveEvent();
    ev = produce(ev, (d) => {
      d.matches[0].script = '煽り';
      selectBattler(d.matches[0], d.matches[0].battlers[0].id, 1000);
      d.hasGoneLive = true;
    });
    const copy = duplicateEvent(ev, 5000);
    expect(copy.id).not.toBe(ev.id);
    expect(copy.matches[0].id).not.toBe(ev.matches[0].id);
    expect(copy.matches[0].battlers.map((b) => b.name)).toEqual(['A', 'B', 'C']);
    expect(copy.matches[0].script).toBe('煽り');
    expect(copy.matches[0].performances).toHaveLength(0);
    expect(isRunning(copy.matches[0].matchTimer)).toBe(false);
    expect(copy.hasGoneLive).toBe(false);
    expect(copy.currentMatchId).toBe(copy.matches[0].id);
    // 元のイベントは変わらない
    expect(ev.matches[0].performances).toHaveLength(1);
  });
});

describe('対戦カードの一括入力', () => {
  it('vs・タブ・カンマ区切りを読み取り、読めない行は行番号付きで返す', () => {
    const { pairs, errors } = parseMatchups('KAZANE vs Taisuke\nA VS B\nC\tD\nE、F\n\nひとりだけ');
    expect(pairs).toEqual([
      ['KAZANE', 'Taisuke'],
      ['A', 'B'],
      ['C', 'D'],
      ['E', 'F'],
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('6行目');
  });

  it('名前に vs を含む単語は区切らない', () => {
    expect(parseMatchups('Vsion vs Avs').pairs).toEqual([['Vsion', 'Avs']]);
  });

  it('空の試合から埋め、足りなければ試合を追加する', () => {
    let ev = newEvent(0);
    ev.format = 'oneVsOne';
    ev.matches = [newMatch('oneVsOne'), newMatch('oneVsOne')];
    ev.matches[0].battlers[0].name = '既存';
    ev = produce(ev, (d) => applyMatchups(d, [['A', 'B'], ['C', 'D']]));
    expect(ev.matches).toHaveLength(3);
    expect(ev.matches[0].battlers[0].name).toBe('既存');
    expect(ev.matches[1].battlers.map((b) => b.name)).toEqual(['A', 'B']);
    expect(ev.matches[2].battlers.map((b) => b.name)).toEqual(['C', 'D']);
  });
});

describe('チームの入れ替えと色', () => {
  it('名前・色・メンバーをまとめて上下入れ替え、踊った印と担当は残る', () => {
    let m = newMatch('teams');
    m.teams[0].name = 'FUNKY';
    m.teams[1].name = 'BREAK';
    m.teams[1].color = '#16a34a';
    m.battlers = [newBattler('a1', 'A'), newBattler('b1', 'B'), newBattler('b2', 'B')];
    m = produce(m, (d) => void selectBattler(d, d.battlers[1].id, 1000));
    m = produce(m, swapTeams);
    expect(m.teams.map((t) => [t.id, t.name, t.color])).toEqual([
      ['A', 'BREAK', '#16a34a'],
      ['B', 'FUNKY', '#2563eb'],
    ]);
    expect(m.battlers.map((b) => `${b.name}:${b.teamId}`)).toEqual(['a1:B', 'b1:A', 'b2:A']);
    expect(m.currentBattlerId).toBe(m.battlers[1].id);
    expect(isDanced(m, m.battlers[1].id)).toBe(true);
  });

  it('色の上の文字は読みやすい方（白か黒）', () => {
    expect(inkOn('#1f2937')).toBe('#fff');
    expect(inkOn('#2563eb')).toBe('#fff');
    expect(inkOn('#facc15')).toBe('#111');
  });
});
