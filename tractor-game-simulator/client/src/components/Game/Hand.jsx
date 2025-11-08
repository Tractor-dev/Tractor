import Card from './Card';
import './Hand.css';

export default function Hand({ cards, selectedCards = [], onCardClick, disabled = false, small = false }) {
  // 防御性检查：确保cards是数组
  if (!Array.isArray(cards)) {
    console.warn('Hand component received non-array cards:', cards);
    return <div className={`hand ${small ? 'small' : ''}`}></div>;
  }

  return (
    <div className={`hand ${small ? 'small' : ''}`}>
      {cards.map((card) => (
        <Card
          key={card.id}
          card={card}
          selected={selectedCards.includes(card.id)}
          onClick={() => onCardClick && onCardClick(card.id)}
          disabled={disabled}
          small={small}
        />
      ))}
    </div>
  );
}
