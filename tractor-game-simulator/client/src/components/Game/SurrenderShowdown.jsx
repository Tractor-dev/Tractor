import Card from './Card';
import { sortCards } from '../../utils/cardUtils';
import { getEffectiveSuit } from '../../utils/cardPatternUtils';
import './SurrenderShowdown.css';

const HAND_GROUPS = [
  ['trump', '主'],
  ['spades', '♠'],
  ['hearts', '♥'],
  ['clubs', '♣'],
  ['diamonds', '♦']
];

export default function SurrenderShowdown({
  hands = [],
  currentPlayerId = null,
  trumpSuit = null,
  trumpRank = null
}) {
  if (!hands.length) return null;

  const totalCards = hands.reduce((sum, hand) => sum + (hand.cards?.length || 0), 0);

  return (
    <section
      className="surrender-showdown"
      data-testid="surrender-showdown"
      aria-label="投降后全员剩余手牌"
    >
      <header className="surrender-showdown-heading">
        <div>
          <strong>投降摊牌</strong>
          <span>四家剩余手牌完整公开</span>
        </div>
        <span className="surrender-showdown-total">共 {totalCards} 张</span>
      </header>

      <div className="surrender-showdown-grid">
        {hands.map(hand => {
          const cards = sortCards(hand.cards || [], trumpSuit, trumpRank);
          const isSelf = hand.playerId === currentPlayerId;
          return (
            <article
              className={`surrender-showdown-hand is-${hand.side || 'unknown'} ${isSelf ? 'is-self' : ''}`}
              data-showdown-player-id={hand.playerId}
              data-showdown-side={hand.side}
              key={hand.playerId}
            >
              <header className="surrender-showdown-player">
                <span className="surrender-showdown-side">
                  {hand.isDealer ? '庄' : hand.side === 'dealer' ? '守' : '闲'}
                </span>
                <strong title={hand.playerName}>
                  {hand.playerName}{isSelf ? '（我）' : ''}
                </strong>
                <span>{cards.length} 张</span>
              </header>

              {cards.length > 0 ? (
                <div className="surrender-showdown-groups">
                  {HAND_GROUPS.map(([suit, label]) => {
                    const groupedCards = cards.filter(
                      card => getEffectiveSuit(card, trumpSuit, trumpRank) === suit
                    );
                    if (groupedCards.length === 0) return null;
                    return (
                      <div
                        className={`surrender-showdown-group group-${suit}`}
                        data-showdown-suit={suit}
                        key={suit}
                      >
                        <span className="surrender-showdown-suit">{label}</span>
                        <div className="surrender-showdown-cards">
                          {groupedCards.map((card, cardIndex) => (
                            <span
                              className="surrender-showdown-card"
                              key={card.id || `${card.suit}-${card.rank}-${cardIndex}`}
                            >
                              <Card
                                card={card}
                                disabled
                                micro
                                trumpSuit={trumpSuit}
                                trumpRank={trumpRank}
                              />
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="surrender-showdown-empty">已出完手牌</div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
