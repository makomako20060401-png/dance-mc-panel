export type BattleFormat = 'circle' | 'oneVsOne' | 'teams';

export type TeamId = 'A' | 'B';

/** 参加者の基本情報。パフォーマンス履歴とは分けて保持する */
export interface Battler {
  id: string;
  name: string;
  /** チーム形式のときのみ使用 */
  teamId?: TeamId;
}

export interface Team {
  id: TeamId;
  name: string;
  /** チームの色（#rrggbb） */
  color: string;
}

/**
 * パフォーマンス履歴。1回踊るごとに1件追加される。
 * 「踊った印」の解除は削除ではなく voidedAt を付けて無効化する
 * （将来のラウンド制・複数回パフォーマンスへの拡張に備える）。
 */
export interface Performance {
  id: string;
  battlerId: string;
  startedAt: number;
  voidedAt?: number;
}

/** 壁時計基準のストップウォッチ。リロードしても経過時間がずれない */
export interface Stopwatch {
  runningSince: number | null;
  accumulatedMs: number;
}

export interface ScriptDraft {
  script: string;
  memo: string;
}

export interface Match {
  id: string;
  /** 任意の見出し（例: 準決勝） */
  label: string;
  battlers: Battler[];
  /** チーム形式用。常に [A, B] の2要素 */
  teams: Team[];
  performances: Performance[];
  currentBattlerId: string | null;
  personalTimer: Stopwatch;
  matchTimer: Stopwatch;
  script: string;
  memo: string;
  /** 編集中の下書き。null なら編集していない */
  draft: ScriptDraft | null;
}

export interface TimerSettings {
  performanceLimited: boolean;
  performanceSec: number;
  performanceWarnSec: number;
  matchLimitEnabled: boolean;
  matchLimitSec: number;
  matchWarnEnabled: boolean;
  matchWarnSec: number;
}

export type SetupStep = 'format' | 'settings' | 'matches' | 'confirm';

export type Screen = { kind: 'setup'; step: SetupStep } | { kind: 'live' };

export interface BattleEvent {
  id: string;
  name: string;
  format: BattleFormat | null;
  timers: TimerSettings;
  matches: Match[];
  currentMatchId: string | null;
  screen: Screen;
  /** 一度でも本番画面を開いたか（設定画面に「本番へ戻る」を出す） */
  hasGoneLive: boolean;
  /** 原稿拡大表示の文字サイズ(px) */
  scriptFontPx: number;
  vibration: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AppState {
  version: 1;
  events: BattleEvent[];
  activeEventId: string | null;
}
