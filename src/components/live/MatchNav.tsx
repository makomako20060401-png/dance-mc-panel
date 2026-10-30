import type { BattleFormat, Match } from '../../types';
import { matchCard } from '../../model';
import { useSwipe } from '../../hooks/useSwipe';

interface Props {
  index: number;
  total: number;
  match: Match;
  format: BattleFormat | null;
  onPrev: () => void;
  onNext: () => void;
  onOpenList: () => void;
  onOpenMenu: () => void;
  /** 新しい版がある場合にメニューへ印を付ける */
  hasUpdate?: boolean;
}

export function MatchNav({ index, total, match, format, onPrev, onNext, onOpenList, onOpenMenu, hasUpdate }: Props) {
  const swipe = useSwipe(onNext, onPrev);
  return (
    <header className="match-nav" {...swipe}>
      <button type="button" className="nav-arrow" onClick={onPrev} disabled={index === 0} aria-label="前の試合">
        ◀
      </button>
      <button type="button" className="nav-center" onClick={onOpenList} aria-label="試合一覧を開く">
        <span className="nav-title">
          第<strong>{index + 1}</strong>試合 <span className="nav-total">/ 全{total}試合</span>
          {match.label && <span className="nav-label">{match.label}</span>}
        </span>
        <span className="nav-card">{matchCard(match, format)}</span>
      </button>
      <button type="button" className="nav-arrow" onClick={onNext} disabled={index >= total - 1} aria-label="次の試合">
        ▶
      </button>
      <button type="button" className="nav-menu" onClick={onOpenMenu} aria-label="メニュー（設定・編集）">
        ☰<span className="nav-menu-text">設定</span>
        {hasUpdate && <span className="update-dot" aria-label="新しい版があります" />}
      </button>
    </header>
  );
}
