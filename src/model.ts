import type {
  BattleEvent,
  BattleFormat,
  Battler,
  Match,
  SetupStep,
  TeamId,
  TimerSettings,
} from './types';
import { pauseWatch, restartWatch, startWatch, stoppedWatch } from './time';

// ---------------------------------------------------------------------------
// ID・ファクトリ
// ---------------------------------------------------------------------------

/** LAN の http 配信でも動くよう crypto.randomUUID に依存しない */
export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export const FORMAT_LABEL: Record<BattleFormat, string> = {
  circle: 'サークル形式',
  oneVsOne: '1 vs 1',
  teams: '複数人 vs 複数人（2チーム）',
};

export const DEFAULT_TIMERS: TimerSettings = {
  performanceLimited: true,
  performanceSec: 60,
  performanceWarnSec: 10,
  matchLimitEnabled: false,
  matchLimitSec: 10 * 60,
  matchWarnEnabled: true,
  matchWarnSec: 60,
};

/** チーム色の候補。白背景でも名前の文字が読める濃さにしている */
export const TEAM_COLORS: { value: string; label: string }[] = [
  { value: '#2563eb', label: '青' },
  { value: '#e11d48', label: '赤' },
  { value: '#16a34a', label: '緑' },
  { value: '#ea580c', label: 'オレンジ' },
  { value: '#7c3aed', label: '紫' },
  { value: '#db2777', label: 'ピンク' },
  { value: '#0d9488', label: '青緑' },
  { value: '#ca8a04', label: '黄' },
  { value: '#1f2937', label: '黒' },
  { value: '#64748b', label: 'グレー' },
];

export const DEFAULT_TEAM_COLOR: Record<TeamId, string> = { A: '#2563eb', B: '#e11d48' };

/** 色の上に載せる文字色（白か黒の読みやすい方） */
export function inkOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#fff';
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.35 ? '#111' : '#fff';
}

export function newBattler(name = '', teamId?: TeamId): Battler {
  return teamId ? { id: newId(), name, teamId } : { id: newId(), name };
}

export function newMatch(format: BattleFormat | null): Match {
  return {
    id: newId(),
    label: '',
    battlers: format === 'oneVsOne' ? [newBattler(), newBattler()] : [],
    teams: [
      { id: 'A', name: '', color: DEFAULT_TEAM_COLOR.A },
      { id: 'B', name: '', color: DEFAULT_TEAM_COLOR.B },
    ],
    performances: [],
    currentBattlerId: null,
    personalTimer: stoppedWatch(),
    matchTimer: stoppedWatch(),
    script: '',
    memo: '',
    draft: null,
  };
}

export function newEvent(now = Date.now()): BattleEvent {
  const d = new Date(now);
  return {
    id: newId(),
    name: `イベント ${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`,
    format: null,
    timers: { ...DEFAULT_TIMERS },
    matches: [newMatch(null)],
    currentMatchId: null,
    screen: { kind: 'setup', step: 'format' },
    hasGoneLive: false,
    scriptFontPx: 28,
    vibration: true,
    createdAt: now,
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// 参照ヘルパー
// ---------------------------------------------------------------------------

export function currentMatchIndex(ev: BattleEvent): number {
  const i = ev.matches.findIndex((m) => m.id === ev.currentMatchId);
  return i >= 0 ? i : 0;
}

export function currentMatch(ev: BattleEvent): Match | undefined {
  return ev.matches[currentMatchIndex(ev)];
}

export function isDanced(match: Match, battlerId: string): boolean {
  return match.performances.some((p) => p.battlerId === battlerId && p.voidedAt == null);
}

export function teamMembers(match: Match, teamId: TeamId): Battler[] {
  return match.battlers.filter((b) => b.teamId === teamId);
}

export function teamName(match: Match, teamId: TeamId): string {
  return match.teams.find((t) => t.id === teamId)?.name ?? '';
}

export function teamColor(match: Match, teamId: TeamId): string {
  return match.teams.find((t) => t.id === teamId)?.color ?? DEFAULT_TEAM_COLOR[teamId];
}

/**
 * チームの上下（A/B）を入れ替える。名前・色・メンバーをまとめて入れ替えるので、
 * 踊った印やタイマーはそのまま残る。
 */
export function swapTeams(match: Match): void {
  const a = match.teams.find((t) => t.id === 'A');
  const b = match.teams.find((t) => t.id === 'B');
  if (!a || !b) return;
  [a.name, b.name] = [b.name, a.name];
  [a.color, b.color] = [b.color, a.color];
  for (const bt of match.battlers) {
    if (bt.teamId) bt.teamId = bt.teamId === 'A' ? 'B' : 'A';
  }
}

/** ナビゲーション用の対戦カード表記 */
export function matchCard(match: Match, format: BattleFormat | null): string {
  const n = (s: string) => s.trim() || '未入力';
  if (format === 'oneVsOne') {
    const [a, b] = match.battlers;
    return `${n(a?.name ?? '')} vs ${n(b?.name ?? '')}`;
  }
  if (format === 'teams') {
    return `${n(teamName(match, 'A'))} vs ${n(teamName(match, 'B'))}`;
  }
  return `${match.battlers.length}人のサークル`;
}

export function matchHasData(m: Match): boolean {
  return (
    m.battlers.some((b) => b.name.trim() !== '') ||
    m.teams.some((t) => t.name.trim() !== '') ||
    m.performances.length > 0 ||
    m.script.trim() !== '' ||
    m.memo.trim() !== '' ||
    m.label.trim() !== ''
  );
}

// ---------------------------------------------------------------------------
// 本番操作（immer の draft を直接変更する）
// ---------------------------------------------------------------------------

export type SelectResult = 'started' | 'alreadyDanced' | 'notFound';

/**
 * バトラーをタップしたときの処理。
 * 担当者にする・踊った印を付ける・個人タイマーを初期値から開始、を同時に行う。
 */
export function selectBattler(match: Match, battlerId: string, now: number): SelectResult {
  if (!match.battlers.some((b) => b.id === battlerId)) return 'notFound';
  if (isDanced(match, battlerId)) return 'alreadyDanced';
  match.performances.push({ id: newId(), battlerId, startedAt: now });
  match.currentBattlerId = battlerId;
  match.personalTimer = restartWatch(now);
  // 試合が始まっていなければ、最初のパフォーマンスと同時に試合経過も開始
  match.matchTimer = startWatch(match.matchTimer, now);
  return 'started';
}

/** チーム形式で、直前に踊ったチームの相手側（次に踊る側の目安）を返す */
export function nextTeam(match: Match): TeamId | null {
  for (let i = match.performances.length - 1; i >= 0; i--) {
    const p = match.performances[i];
    if (p.voidedAt != null) continue;
    const team = match.battlers.find((b) => b.id === p.battlerId)?.teamId;
    if (team) return team === 'A' ? 'B' : 'A';
  }
  return null;
}

/** 長押しで踊った印を解除。現在の担当者ならタイマーを初期状態へ戻す */
export function unmarkBattler(match: Match, battlerId: string, now: number): void {
  for (const p of match.performances) {
    if (p.battlerId === battlerId && p.voidedAt == null) p.voidedAt = now;
  }
  if (match.currentBattlerId === battlerId) {
    match.currentBattlerId = null;
    match.personalTimer = stoppedWatch();
  }
}

export function pauseMatchTimers(match: Match, now: number): void {
  match.personalTimer = pauseWatch(match.personalTimer, now);
  match.matchTimer = pauseWatch(match.matchTimer, now);
}

/** 試合切替。切替前の試合で動いているタイマーは一時停止し、移動先は再開しない */
export function goToMatch(ev: BattleEvent, index: number, now: number): boolean {
  if (index < 0 || index >= ev.matches.length) return false;
  const from = currentMatch(ev);
  const to = ev.matches[index];
  if (from && from.id === to.id) return false;
  if (from) pauseMatchTimers(from, now);
  ev.currentMatchId = to.id;
  return true;
}

/** 試合の進行状況（印・担当・タイマー）だけを初期化。出演者と原稿は残す */
export function resetMatchProgress(match: Match): void {
  match.performances = [];
  match.currentBattlerId = null;
  match.personalTimer = stoppedWatch();
  match.matchTimer = stoppedWatch();
}

// ---------------------------------------------------------------------------
// 編集操作
// ---------------------------------------------------------------------------

/** バトラー削除時に履歴・担当者の参照も掃除する */
export function removeBattler(match: Match, battlerId: string): void {
  match.battlers = match.battlers.filter((b) => b.id !== battlerId);
  match.performances = match.performances.filter((p) => p.battlerId !== battlerId);
  if (match.currentBattlerId === battlerId) {
    match.currentBattlerId = null;
    match.personalTimer = stoppedWatch();
  }
}

/** 並べ替え。チーム形式では同じチーム内の隣と入れ替える */
export function moveBattler(match: Match, battlerId: string, dir: -1 | 1): void {
  const list = match.battlers;
  const i = list.findIndex((b) => b.id === battlerId);
  if (i < 0) return;
  const team = list[i].teamId;
  let j = i + dir;
  while (j >= 0 && j < list.length && list[j].teamId !== team) j += dir;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
}

export function moveItem<T>(list: T[], index: number, dir: -1 | 1): void {
  const j = index + dir;
  if (j < 0 || j >= list.length) return;
  [list[index], list[j]] = [list[j], list[index]];
}

/** 試合数を合わせる（増やす場合は末尾に追加、減らす場合は末尾から削除） */
export function setMatchCount(ev: BattleEvent, count: number): void {
  while (ev.matches.length < count) ev.matches.push(newMatch(ev.format));
  if (ev.matches.length > count) ev.matches.splice(count);
  if (!ev.matches.some((m) => m.id === ev.currentMatchId)) ev.currentMatchId = ev.matches[0]?.id ?? null;
}

export function removeMatch(ev: BattleEvent, matchId: string): void {
  if (ev.matches.length <= 1) return;
  const idx = ev.matches.findIndex((m) => m.id === matchId);
  if (idx < 0) return;
  ev.matches.splice(idx, 1);
  if (ev.currentMatchId === matchId) {
    ev.currentMatchId = ev.matches[Math.min(idx, ev.matches.length - 1)].id;
  }
}

/**
 * 1 vs 1 の対戦カードをまとめて読み取る。1行1試合。
 * 区切りは「vs」（大文字・全角も可）、タブ（Excelの2列）、カンマ・読点。
 * 読み取れなかった行は errors に行番号付きで返す。
 */
export function parseMatchups(text: string): { pairs: [string, string][]; errors: string[] } {
  const pairs: [string, string][] = [];
  const errors: string[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    const parts = line
      .split(/\s+(?:vs\.?|v\.s\.|ｖｓ|VS|Vs)\s+|\t|,|、|，/i)
      .map((x) => x.trim())
      .filter(Boolean);
    if (parts.length === 2) pairs.push([parts[0], parts[1]]);
    else errors.push(`${i + 1}行目「${line.trim()}」は2人に分けられませんでした`);
  });
  return { pairs, errors };
}

/** 読み取った対戦カードを、名前が空の試合から順に埋め、足りなければ試合を追加する */
export function applyMatchups(ev: BattleEvent, pairs: [string, string][]): void {
  const queue = [...pairs];
  for (const m of ev.matches) {
    if (!queue.length) break;
    if (m.battlers.length === 2 && m.battlers.every((b) => !b.name.trim())) {
      const [a, b] = queue.shift()!;
      m.battlers[0].name = a;
      m.battlers[1].name = b;
    }
  }
  for (const [a, b] of queue) {
    const m = newMatch('oneVsOne');
    m.battlers[0].name = a;
    m.battlers[1].name = b;
    ev.matches.push(m);
  }
}

/** 出演者・設定・原稿を引き継いだ新しいイベントを作る（進行状況はリセット） */
export function duplicateEvent(src: BattleEvent, now = Date.now()): BattleEvent {
  const copy: BattleEvent = JSON.parse(JSON.stringify(src));
  copy.id = newId();
  copy.name = `${src.name}（コピー）`;
  copy.matches.forEach((m) => {
    m.id = newId();
    m.draft = null;
    resetMatchProgress(m);
  });
  copy.currentMatchId = copy.matches[0]?.id ?? null;
  copy.screen = { kind: 'setup', step: copy.format ? 'confirm' : 'format' };
  copy.hasGoneLive = false;
  copy.createdAt = now;
  copy.updatedAt = now;
  return copy;
}

/** 形式変更で失われるデータがあるか */
export function formatChangeLosesData(ev: BattleEvent, to: BattleFormat): boolean {
  if (ev.format == null || ev.format === to) return false;
  if (to === 'oneVsOne') return ev.matches.some((m) => m.battlers.filter((b) => b.name.trim()).length > 2);
  if (ev.format === 'teams') return ev.matches.some((m) => m.teams.some((t) => t.name.trim()));
  return false;
}

/** 形式を変更し、既存の出演者データを新形式に合わせて変換する */
export function changeFormat(ev: BattleEvent, to: BattleFormat): void {
  const from = ev.format;
  ev.format = to;
  if (from === to) return;
  for (const m of ev.matches) {
    const named = m.battlers.filter((b) => b.name.trim() !== '');
    if (to === 'circle') {
      m.battlers = named.map((b) => ({ id: b.id, name: b.name }));
    } else if (to === 'oneVsOne') {
      const two = named.slice(0, 2).map((b) => ({ id: b.id, name: b.name }));
      while (two.length < 2) two.push(newBattler());
      m.battlers = two;
    } else {
      const half = Math.ceil(named.length / 2);
      m.battlers = named.map((b, i) => ({ ...b, teamId: b.teamId ?? (i < half ? 'A' : 'B') }));
    }
    const ids = new Set(m.battlers.map((b) => b.id));
    m.performances = m.performances.filter((p) => ids.has(p.battlerId));
    if (m.currentBattlerId && !ids.has(m.currentBattlerId)) {
      m.currentBattlerId = null;
      m.personalTimer = stoppedWatch();
    }
  }
}

// ---------------------------------------------------------------------------
// 入力チェック
// ---------------------------------------------------------------------------

export interface Issue {
  step: SetupStep;
  matchId?: string;
  message: string;
}

export interface ValidationResult {
  errors: Issue[];
  warnings: Issue[];
}

export function validateSettings(ev: BattleEvent): Issue[] {
  const t = ev.timers;
  const errors: Issue[] = [];
  const add = (message: string) => errors.push({ step: 'settings', message });
  if (!ev.name.trim()) add('イベント名を入力してください');
  if (!Number.isInteger(ev.matches.length) || ev.matches.length < 1) add('試合数は1以上の整数にしてください');
  if (t.performanceLimited) {
    if (t.performanceSec <= 0) add('1人あたりの時間に0分0秒は設定できません');
    else if (t.performanceWarnSec >= t.performanceSec)
      add('個人タイマーの警戒時間は、1人あたりの時間より短くしてください');
  }
  if (t.matchLimitEnabled) {
    if (t.matchLimitSec <= 0) add('試合全体の制限時間に0分0秒は設定できません');
    else if (t.matchWarnEnabled && t.matchWarnSec >= t.matchLimitSec)
      add('試合全体の警戒時間は、試合全体の制限時間より短くしてください');
  }
  return errors;
}

export function validateMatches(ev: BattleEvent): ValidationResult {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  ev.matches.forEach((m, i) => {
    const label = `第${i + 1}試合`;
    const err = (message: string) => errors.push({ step: 'matches', matchId: m.id, message: `${label}: ${message}` });
    const warn = (message: string) => warnings.push({ step: 'matches', matchId: m.id, message: `${label}: ${message}` });
    if (m.battlers.some((b) => !b.name.trim())) err('名前が空欄のバトラーがいます');
    if (ev.format === 'oneVsOne' && m.battlers.length !== 2) err('バトラーは2名にしてください');
    if (ev.format === 'circle' && m.battlers.length === 0) warn('バトラーが登録されていません');
    if (ev.format === 'teams') {
      for (const t of m.teams) {
        if (!t.name.trim()) err(`チーム${t.id}の名前を入力してください`);
        if (teamMembers(m, t.id).length === 0) warn(`チーム${t.id}のメンバーが登録されていません`);
      }
    }
    const names = m.battlers.map((b) => b.name.trim()).filter(Boolean);
    if (new Set(names).size !== names.length) warn('同じ名前のバトラーがいます');
  });
  return { errors, warnings };
}

export function validateEvent(ev: BattleEvent): ValidationResult {
  const errors: Issue[] = [];
  if (!ev.format) errors.push({ step: 'format', message: 'バトル形式を選択してください' });
  errors.push(...validateSettings(ev));
  const m = validateMatches(ev);
  return { errors: [...errors, ...m.errors], warnings: m.warnings };
}
