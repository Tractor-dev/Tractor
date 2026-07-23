export const IronEvidenceModes = Object.freeze({
  MULTIPLY: 'multiply',
  ZERO: 'zero'
});

export function isIronEvidenceSpecialCard(card) {
  return Boolean(card) && (
    (card.suit === 'joker' && card.rank === 'small_joker')
    || (card.suit === 'hearts' && card.rank === 'Q')
    || (card.suit === 'spades' && card.rank === 'J')
    || (card.suit === 'clubs' && card.rank === 'J')
  );
}

export function isIronEvidenceBigJoker(card) {
  return card?.suit === 'joker' && card?.rank === 'big_joker';
}

export function getIronEvidenceRoundMode(bigJokersPlayedCount = 0) {
  return Number(bigJokersPlayedCount) >= 2
    ? IronEvidenceModes.ZERO
    : IronEvidenceModes.MULTIPLY;
}

export function calculateIronEvidenceRoundScoring(
  cards,
  baseRoundPoints,
  roundMode = IronEvidenceModes.MULTIPLY
) {
  const specialCardCount = (cards || []).filter(isIronEvidenceSpecialCard).length;
  const multiplier = specialCardCount === 0
    ? 1
    : roundMode === IronEvidenceModes.ZERO
      ? 0
      : 1 + specialCardCount;
  return {
    mode: roundMode,
    specialCardCount,
    multiplier,
    baseRoundPoints,
    roundPoints: baseRoundPoints * multiplier
  };
}
