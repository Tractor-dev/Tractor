import { useMemo } from 'react';
import { isTrumpCard } from '../../utils/cardUtils';
import { useI18n } from '../../locales/index.jsx';
import './Card.css';

const SUIT_SYMBOLS = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
  joker: '🃏'
};

const SUIT_COLORS = {
  hearts: 'red',
  diamonds: 'red',
  clubs: 'black',
  spades: 'black',
  joker: 'purple'
};

export default function Card({
  card,
  selected = false,
  onClick,
  disabled = false,
  small = false,
  draggable = false,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  trumpSuit = null,
  trumpRank = null
}) {
  const { t } = useI18n();
  const isJoker = card.suit === 'joker';
  const isTrump = isTrumpCard(card, trumpSuit, trumpRank);

  const RANK_DISPLAY = useMemo(() => ({
    A: 'A',
    '2': '2',
    '3': '3',
    '4': '4',
    '5': '5',
    '6': '6',
    '7': '7',
    '8': '8',
    '9': '9',
    '10': '10',
    J: 'J',
    Q: 'Q',
    K: 'K',
    small_joker: t('card.smallJoker'),
    big_joker: t('card.bigJoker')
  }), [t]);

  const displayRank = useMemo(() => {
    return RANK_DISPLAY[card.rank] || card.rank;
  }, [card.rank, RANK_DISPLAY]);

  const suitSymbol = SUIT_SYMBOLS[card.suit] || '';
  const color = SUIT_COLORS[card.suit] || 'black';

  return (
    <div
      className={`card ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''} ${small ? 'small' : ''}`}
      onClick={disabled ? undefined : onClick}
      draggable={draggable && !disabled}
      onDragStart={(e) => onDragStart && onDragStart(e, card)}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop && onDrop(e, card)}
      style={{
        color: color,
        borderColor: selected ? '#1890ff' : '#d9d9d9',
        cursor: draggable && !disabled ? 'move' : 'pointer'
      }}
    >
      <div className="card-corner top-left">
        <div className="card-rank">{displayRank}</div>
        {!isJoker && <div className="card-suit">{suitSymbol}</div>}
      </div>

      <div className="card-center">
        {isJoker ? (
          <div className="joker-text">{displayRank}</div>
        ) : (
          <div className="suit-symbol">{suitSymbol}</div>
        )}
      </div>

      <div className="card-corner bottom-right">
        <div className="card-rank">{displayRank}</div>
        {!isJoker && <div className="card-suit">{suitSymbol}</div>}
      </div>

      {/* 主牌星标 */}
      {isTrump && (
        <div className="trump-badge">
          <span className="trump-star">★</span>
        </div>
      )}
    </div>
  );
}
