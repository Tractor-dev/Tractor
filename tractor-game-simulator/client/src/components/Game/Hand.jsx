import Card from './Card';
import './Hand.css';

export default function Hand({ cards, selectedCards = [], onCardClick, disabled = false, small = false }) {
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
