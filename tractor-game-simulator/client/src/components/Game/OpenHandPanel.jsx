import Hand from './Hand';
import Card from './Card';
import { sortCards } from '../../utils/cardUtils';
import { getEffectiveSuit } from '../../utils/cardPatternUtils';

const GROUPS = [
  ['trump', '主'],
  ['spades', '♠'],
  ['hearts', '♥'],
  ['clubs', '♣'],
  ['diamonds', '♦']
];

export default function OpenHandPanel({
  openHand,
  position,
  selectedCards = [],
  onCardClick,
  interactive = false,
  label = '明牌',
  trumpSuit = null,
  trumpRank = null
}) {
  if (!openHand?.cards?.length || position === 'bottom') return null;

  const cards = sortCards(openHand.cards, trumpSuit, trumpRank);
  const sidePosition = position === 'left' || position === 'right';

  return (
    <section
      className={`open-hand-panel open-hand-${position} open-hand-kind-${openHand.kind || 'controlled'} ${sidePosition ? 'open-hand-side' : 'open-hand-opposite'} ${interactive ? 'is-interactive' : ''}`}
      data-open-hand-position={position}
      data-open-hand-player-id={openHand.playerId}
      aria-label={`${openHand.playerName}的明牌`}
    >
      <header className="open-hand-header">
        <span className="open-hand-seal">{openHand.kind === 'jokers' ? '鬼' : '明'}</span>
        <span className="open-hand-title">{openHand.playerName} · {label}</span>
        <span className="open-hand-count">{cards.length}</span>
        {interactive && <span className="open-hand-control-hint">由你代打</span>}
      </header>

      {sidePosition ? (
        <div className="open-hand-groups">
          {GROUPS.map(([suit, label]) => {
            const groupedCards = cards.filter(card => getEffectiveSuit(card, trumpSuit, trumpRank) === suit);
            if (groupedCards.length === 0) return null;
            return (
              <div className={`open-hand-group open-hand-group-${suit}`} key={suit}>
                <span className="open-hand-group-label">{label}</span>
                <div className="open-hand-mini-cards">
                  {groupedCards.map((card, index) => (
                    <span className="open-hand-mini-card" key={card.id} style={{ zIndex: index + 1 }}>
                      <Card card={card} disabled micro trumpSuit={trumpSuit} trumpRank={trumpRank} />
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="open-hand-opposite-cards">
          <Hand
            cards={cards}
            selectedCards={selectedCards}
            onCardClick={onCardClick}
            disabled={!interactive}
            small
            trumpSuit={trumpSuit}
            trumpRank={trumpRank}
            minimumVisibleWidth={18}
          />
        </div>
      )}
    </section>
  );
}
