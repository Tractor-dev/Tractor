import { useMemo } from 'react';
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

const RANK_DISPLAY = {
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
  small_joker: '小王',
  big_joker: '大王'
};

export default function Card({ card, selected = false, onClick, disabled = false, small = false }) {
  const isJoker = card.suit === 'joker';

  const displayRank = useMemo(() => {
    return RANK_DISPLAY[card.rank] || card.rank;
  }, [card.rank]);

  const suitSymbol = SUIT_SYMBOLS[card.suit] || '';
  const color = SUIT_COLORS[card.suit] || 'black';

  return (
    <div
      className={`card ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''} ${small ? 'small' : ''}`}
      onClick={disabled ? undefined : onClick}
      style={{
        color: color,
        borderColor: selected ? '#1890ff' : '#d9d9d9'
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
    </div>
  );
}
