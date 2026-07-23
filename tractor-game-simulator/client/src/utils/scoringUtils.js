import { ruleIncludesId } from './ruleCatalog.js';

const CARD_POINT_VALUES = Object.freeze({
  '5': 5,
  '10': 10,
  K: 10
});

const METICULOUS_ACCOUNTING_POINT_VALUES = Object.freeze({
  A: 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7
});

function getScoringRank(card) {
  const usesOriginalRank = card?.isDivineWeaponTransformed
    || card?.isJokerSubstitution
    || card?.isClusterAnalysisTransformed
    || card?.isForbiddenMagicDemoted
    || card?.isStrengthCompensated
    || card?.isDefenseAsOffenseBoosted
    || card?.isTeammateCheered
    || card?.isAfterglowBoosted
    || card?.isThreeTigersTransformed;
  return usesOriginalRank && card?.originalRank
    ? card.originalRank
    : card?.rank;
}

export function getScoringDisplayCard(card) {
  if (
    !card?.isStrengthCompensated
    && !card?.isDefenseAsOffenseBoosted
    && !card?.isTeammateCheered
    && !card?.isAfterglowBoosted
  ) return card;

  return {
    ...card,
    suit: card.originalSuit || card.suit,
    rank: card.originalRank || card.rank,
    originalSuit: null,
    originalRank: null,
    isStrengthCompensated: false,
    strengthCompensationDelta: 0,
    isDefenseAsOffenseBoosted: false,
    defenseAsOffenseDelta: 0,
    isTeammateCheered: false,
    isAfterglowBoosted: false
  };
}

export function getCardPoints(card) {
  if (card?.isRiceToMulberryTransformed) return 0;
  return CARD_POINT_VALUES[String(getScoringRank(card))] || 0;
}

export function getMeticulousAccountingCardPoints(card) {
  return METICULOUS_ACCOUNTING_POINT_VALUES[String(getScoringRank(card))] || 0;
}

export function getThreePowersCardPoints(card, threePowers = null) {
  return (threePowers?.slots || []).reduce(
    (total, slot) => total + (slot.rank === card?.rank ? Number(slot.pointValue) || 0 : 0),
    0
  );
}

export function getCandleCardColor(card) {
  if (card?.suit === 'hearts' || card?.suit === 'diamonds') return 'red';
  if (card?.suit === 'clubs' || card?.suit === 'spades') return 'black';
  if (card?.rank === 'small_joker') return 'black';
  if (card?.rank === 'big_joker') return 'red';
  return null;
}

export function getCandleToDawnCardPoints(card, isLit) {
  const basePoints = getCardPoints(card);
  if (basePoints <= 0 || typeof isLit !== 'boolean') return basePoints;
  const color = getCandleCardColor(card);
  if (!color) return basePoints;
  const favoredColor = isLit ? 'red' : 'black';
  return Math.max(0, basePoints + (color === favoredColor ? 5 : -5));
}

export function getDisplayedCandleState({
  candleToDawn,
  currentRound = 1,
  displayRoundNumber = null,
  visiblePlayCount = 0,
  playerCount = 4
} = {}) {
  const normalizedCurrentRound = Math.max(1, Number(currentRound) || 1);
  const requestedRound = Math.max(
    1,
    displayRoundNumber ?? normalizedCurrentRound
  );
  const transition = candleToDawn?.lastTransition || null;
  const completedRoundStillOnTable = Boolean(
    transition
    && playerCount > 0
    && visiblePlayCount >= playerCount
    && transition.round === normalizedCurrentRound - 1
  );
  const holdsCompletedRound = Boolean(
    (transition?.round === requestedRound && requestedRound !== normalizedCurrentRound)
    || completedRoundStillOnTable
  );
  return {
    round: holdsCompletedRound ? transition.round : requestedRound,
    isLit: holdsCompletedRound ? transition.previousLit : candleToDawn?.isLit,
    holdsCompletedRound
  };
}

export function calculateCardPoints(cards = [], pointResolver = getCardPoints) {
  if (!Array.isArray(cards)) return 0;
  return cards.reduce((total, card) => total + pointResolver(card), 0);
}

export function getOddEvenRoundMultiplier(rule, roundNumber) {
  if (!ruleIncludesId(rule, 'odd_even_scoring')) return 1;
  return Number(roundNumber) % 2 === 0 ? 2 : 0;
}
