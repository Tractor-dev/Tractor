export function isIronEvidenceSpecialCard(card) {
  return Boolean(card) && (
    (card.suit === 'joker' && card.rank === 'small_joker')
    || (card.suit === 'hearts' && card.rank === 'Q')
    || (card.suit === 'spades' && card.rank === 'J')
    || (card.suit === 'clubs' && card.rank === 'J')
  );
}
