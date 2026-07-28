import {
  isBirdsGoneBowHiddenRule,
  isBushGateRule,
  isCooldownTimeRule,
  isTimeCoolingRule
} from '../rules/ruleRegistry.js';
import { getEffectiveSuit } from './cardPatternUtils.js';

export const CardCooldownTypes = Object.freeze({
  RANK: 'rank',
  SUIT: 'suit'
});

const STANDARD_SUITS = new Set(['hearts', 'diamonds', 'clubs', 'spades']);
const STANDARD_POINT_RANKS = new Set(['5', '10', 'K']);

function getBirdPointCardTotalsByEffectiveSuit(gameState) {
  const totals = new Map();
  for (const suit of STANDARD_SUITS) {
    for (const rank of STANDARD_POINT_RANKS) {
      const effectiveSuit = getEffectiveSuit(
        { suit, rank },
        gameState?.trumpSuit,
        gameState?.trumpRank
      );
      totals.set(effectiveSuit, (totals.get(effectiveSuit) || 0) + 2);
    }
  }
  return totals;
}

export function getCardCooldownType(rule) {
  if (isCooldownTimeRule(rule)) return CardCooldownTypes.RANK;
  if (isTimeCoolingRule(rule)) return CardCooldownTypes.SUIT;
  return null;
}

export function getCardCooldownValue(card, type, gameState = null) {
  if (type === CardCooldownTypes.RANK) return card?.rank || null;
  if (type === CardCooldownTypes.SUIT) {
    return getEffectiveSuit(card, gameState?.trumpSuit, gameState?.trumpRank) || null;
  }
  return null;
}

export function getCardCooldownDisabledCards({
  gameState,
  playerId,
  playerCards = [],
  requiredCount = 1,
  isLeading = false
} = {}) {
  const type = getCardCooldownType(gameState?.selectedRule);
  if (!type || !playerId || !Array.isArray(playerCards) || playerCards.length === 0) return [];
  const restrictedValues = gameState.cardCooldownValuesByPlayerId?.get(playerId) || [];
  const restrictedSet = new Set(restrictedValues);
  if (restrictedSet.size === 0) return [];

  let restrictedCards = playerCards.filter(card => (
    restrictedSet.has(getCardCooldownValue(card, type, gameState))
  ));
  const leadingSuit = !isLeading ? gameState?.leadingPattern?.suit : null;
  if (leadingSuit) {
    // 基本跟牌义务优先于冷却：首家要求的有效花色不能因冷却而被伪装成“缺门”。
    // 同花色内全部解禁，也能覆盖对子、拖拉机等结构性跟牌要求。
    restrictedCards = restrictedCards.filter(card => (
      getEffectiveSuit(card, gameState?.trumpSuit, gameState?.trumpRank) !== leadingSuit
    ));
  }
  const unrestrictedCount = playerCards.length - restrictedCards.length;
  const normalizedRequiredCount = Number.isInteger(requiredCount) && requiredCount > 0
    ? requiredCount
    : 1;

  // 冷却不能让玩家无牌可出；跟牌张数大于可用牌数时也应整体解除。
  return unrestrictedCount >= normalizedRequiredCount ? restrictedCards : [];
}

export function getCardCooldownPlayableCards(options = {}) {
  const disabledIds = new Set(
    getCardCooldownDisabledCards(options).map(card => card.id)
  );
  return (options.playerCards || []).filter(card => !disabledIds.has(card.id));
}

export function recordBirdsGoneBowHiddenPointCards({ gameState, cards = [] } = {}) {
  if (!isBirdsGoneBowHiddenRule(gameState?.selectedRule) || !Array.isArray(cards)) return [];

  for (const card of cards) {
    if (
      card?.id
      && STANDARD_SUITS.has(card.suit)
      && STANDARD_POINT_RANKS.has(card.rank)
    ) {
      gameState.birdPlayedPointCardIds.add(card.id);
      gameState.birdPlayedPointCardSuitsById.set(
        card.id,
        getEffectiveSuit(card, gameState.trumpSuit, gameState.trumpRank)
      );
    }
  }

  const newlyExhaustedSuits = [];
  const totals = getBirdPointCardTotalsByEffectiveSuit(gameState);
  for (const [effectiveSuit, totalCount] of totals) {
    if (gameState.birdExhaustedSuits.has(effectiveSuit)) continue;
    const playedCount = Array.from(gameState.birdPlayedPointCardSuitsById.values())
      .filter(value => value === effectiveSuit)
      .length;
    if (playedCount >= totalCount) {
      gameState.birdExhaustedSuits.add(effectiveSuit);
      newlyExhaustedSuits.push(effectiveSuit);
    }
  }
  return newlyExhaustedSuits;
}

export function getBirdsGoneBowHiddenDisabledCards({
  gameState,
  playerCards = [],
  isLeading = false,
  requiredCount = 1
} = {}) {
  if (
    !isLeading
    || !isBirdsGoneBowHiddenRule(gameState?.selectedRule)
    || !Array.isArray(playerCards)
    || playerCards.length === 0
  ) {
    return [];
  }

  const exhaustedSuits = gameState.birdExhaustedSuits || new Set();
  if (exhaustedSuits.size === 0) return [];
  const restrictedCards = playerCards.filter(card => exhaustedSuits.has(
    getEffectiveSuit(card, gameState.trumpSuit, gameState.trumpRank)
  ));
  const normalizedRequiredCount = Number.isInteger(requiredCount) && requiredCount > 0
    ? requiredCount
    : 1;
  const unrestrictedCount = playerCards.length - restrictedCards.length;
  return unrestrictedCount >= normalizedRequiredCount ? restrictedCards : [];
}

export function getBushGateDisabledCards({
  gameState,
  playerId,
  playerCards = [],
  isLeading = false
} = {}) {
  const restriction = gameState?.bushGateRestriction;
  if (
    !isLeading
    || !isBushGateRule(gameState?.selectedRule)
    || !restriction
    || restriction.round !== gameState.currentRound
    || restriction.leaderPlayerId !== playerId
  ) {
    return [];
  }
  const forbiddenIds = new Set(restriction.forbiddenCardIds || []);
  return playerCards.filter(card => forbiddenIds.has(card.id));
}

export function getRuleDisabledCards(options = {}) {
  return [
    ...getCardCooldownDisabledCards(options),
    ...getBirdsGoneBowHiddenDisabledCards(options),
    ...getBushGateDisabledCards(options)
  ];
}

export function getRulePlayableCards(options = {}) {
  const disabledIds = new Set(getRuleDisabledCards(options).map(card => card.id));
  return (options.playerCards || []).filter(card => !disabledIds.has(card.id));
}
