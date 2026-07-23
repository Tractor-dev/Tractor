import {
  Suits,
  Ranks,
  RANK_ORDER,
  STANDARD_ORDINARY_RANKS,
  EXTENDED_ORDINARY_RANKS,
  PROMOTED_ORDINARY_RANKS
} from './constants.js';
import { ruleIncludesId } from './ruleCatalog.js';

const STANDARD_SUITS = Object.freeze([
  Suits.HEARTS,
  Suits.DIAMONDS,
  Suits.CLUBS,
  Suits.SPADES
]);
const TAI_CHI_SUIT = 'tai_chi';
const isSixSixGreatSuccessRule = rule => ruleIncludesId(rule, 'six_six_great_success');
const isTaiChiFourSymbolsRule = rule => ruleIncludesId(rule, 'tai_chi_four_symbols');
const isBeltAndRoadRule = rule => ruleIncludesId(rule, 'belt_and_road');
const isDayNightRotationRule = rule => ruleIncludesId(rule, 'day_night_rotation');
const isStrengthCompensationRule = rule => ruleIncludesId(rule, 'strength_compensation');
const isTeammateCheerRule = rule => ruleIncludesId(rule, 'teammate_cheer');
const isAfterglowRule = rule => ruleIncludesId(rule, 'afterglow');
const isThreeTigersRule = rule => ruleIncludesId(rule, 'three_tigers');
const isThreeSixNineGradesRule = rule => ruleIncludesId(rule, 'three_six_nine_grades');
const isUnarmedRule = rule => ruleIncludesId(rule, 'unarmed');
const isAntinomyRule = rule => ruleIncludesId(rule, 'antinomy');
const ORDINARY_RANKS = STANDARD_ORDINARY_RANKS;
const DAY_NIGHT_RANKS = Object.freeze([
  Ranks.ACE, Ranks.TWO, Ranks.THREE, Ranks.FOUR, Ranks.FIVE,
  Ranks.SIX, Ranks.SEVEN, Ranks.EIGHT, Ranks.NINE, Ranks.TEN,
  Ranks.JACK, Ranks.QUEEN, Ranks.KING
]);

export function getAntinomyFaceKey(cardOrSuit, rank = null) {
  const suit = typeof cardOrSuit === 'object' ? cardOrSuit?.suit : cardOrSuit;
  const faceRank = typeof cardOrSuit === 'object' ? cardOrSuit?.rank : rank;
  return suit && faceRank ? `${suit}:${faceRank}` : null;
}

function canCardsFormPair(card1, card2, activeRule = null) {
  if (!card1 || !card2 || card1.rank !== card2.rank || card1.suit !== card2.suit) {
    return false;
  }
  if (!isAntinomyRule(activeRule)) return true;
  return !(activeRule?.antinomySplitFaceKeys || []).includes(getAntinomyFaceKey(card1));
}

function getDayNightRotatingRank(roundNumber) {
  if (!Number.isInteger(roundNumber) || roundNumber < 1) return null;
  return DAY_NIGHT_RANKS[roundNumber % DAY_NIGHT_RANKS.length];
}

/**
 * 牌型类型
 */
export const PatternTypes = {
  SINGLE: 'single',
  PAIR: 'pair',
  TRACTOR: 'tractor',
  STRAIGHT_FLUSH: 'straight_flush',
  TAI_CHI_FOUR_SYMBOLS: 'tai_chi_four_symbols',
  BELT_AND_ROAD: 'belt_and_road',
  THROW: 'throw',
  INVALID: 'invalid'
};

/**
 * 判断一张牌是否是主牌
 */
export function isTrumpCard(card, trumpSuit, trumpRank) {
  if (card?.isForbiddenMagicDemoted) {
    return false;
  }
  if (card.isLastStandTrump) {
    return true;
  }
  if (card.isThreeTigersTrump) {
    return true;
  }
  if (card.rank === Ranks.NO_TRUMP_MINUS) {
    return true;
  }
  if (card.suit === Suits.JOKER) {
    return true;
  }
  if (!card.isUnarmed && card.rank === trumpRank) {
    return true;
  }
  if (card.suit === trumpSuit) {
    return true;
  }
  return false;
}

/**
 * 获取牌的有效花色
 */
export function getEffectiveSuit(card, trumpSuit, trumpRank) {
  if (isTrumpCard(card, trumpSuit, trumpRank)) {
    return 'trump';
  }
  return card.suit;
}

/**
 * 获取牌的强度值
 */
export function getCardStrength(card, trumpSuit, trumpRank, activeRule = null) {
  if (card?.isForbiddenMagicDemoted) {
    return RANK_ORDER[card.rank] || 0;
  }
  const isUnarmed = isUnarmedRule(activeRule) || Boolean(card?.isUnarmed);
  if (card.rank === Ranks.WHITE_JOKER) {
    return 1003;
  }
  if (card.rank === Ranks.PRINCE_JOKER) {
    return 1002;
  }
  if (card.rank === Ranks.COUNTY_PRINCE_JOKER) {
    return 1001;
  }
  if (card.rank === Ranks.BIG_JOKER) {
    return 1000;
  }
  if (card.rank === Ranks.SMALL_JOKER) {
    return 999;
  }
  if (card.rank === Ranks.NO_TRUMP_MINUS) {
    return 996;
  }
  if (card.isThreeTigersTrump && card.rank === trumpRank) {
    return 998;
  }
  if (!isUnarmed && card.rank === trumpRank && card.suit === trumpSuit) {
    return 998;
  }
  if (
    !isUnarmed
    && card.rank === trumpRank
    && isThreeSixNineGradesRule(activeRule)
    && activeRule?.inferiorSuit
    && card.suit === activeRule.inferiorSuit
  ) {
    return 996;
  }
  if (!isUnarmed && card.rank === trumpRank) {
    return 997;
  }

  const rotatingRank = isDayNightRotationRule(activeRule)
    ? getDayNightRotatingRank(activeRule?.currentRound)
    : null;
  const boostedRank = rotatingRank && rotatingRank !== trumpRank ? rotatingRank : null;
  const dayNightOrderedRanks = boostedRank
    ? ORDINARY_RANKS
        .filter(rank => rank !== trumpRank && rank !== boostedRank)
        .concat(boostedRank)
    : null;

  let baseValue = RANK_ORDER[card.rank] || 0;
  const usesExtendedRanks = isStrengthCompensationRule(activeRule)
    || isAfterglowRule(activeRule)
    || isTeammateCheerRule(activeRule)
    || isThreeTigersRule(activeRule)
    || Boolean(card?.isStrengthCompensated)
    || Boolean(card?.isTeammateCheered)
    || Boolean(card?.isAfterglowBoosted);

  if (card.isThreeTigersTrump) {
    const ordinaryTrumpRanks = EXTENDED_ORDINARY_RANKS
      .filter(rank => !PROMOTED_ORDINARY_RANKS.includes(rank) && rank !== trumpRank);
    const lowestTrumpStrength = 997 - ordinaryTrumpRanks.length;
    return lowestTrumpStrength + ordinaryTrumpRanks.indexOf(card.rank);
  }

  if (card.isLastStandTrump) {
    const orderedRanks = [
      Ranks.TWO, Ranks.THREE, Ranks.FOUR, Ranks.FIVE, Ranks.SIX,
      Ranks.SEVEN, Ranks.EIGHT, Ranks.NINE, Ranks.TEN,
      Ranks.JACK, Ranks.QUEEN, Ranks.KING, Ranks.ACE
    ].filter(rank => rank !== trumpRank);
    return 985 + orderedRanks.indexOf(card.rank);
  }

  // 主花色的牌 - 需要连续排列在副花色级牌之下
  if (card.suit === trumpSuit) {
    if (dayNightOrderedRanks) {
      return 985 + dayNightOrderedRanks.indexOf(card.rank);
    }
    const orderedTrumpRanks = (usesExtendedRanks
      ? EXTENDED_ORDINARY_RANKS.filter(rank => !PROMOTED_ORDINARY_RANKS.includes(rank))
      : ORDINARY_RANKS
    );
    const ordinaryTrumpRanks = isUnarmed
      ? orderedTrumpRanks
      : orderedTrumpRanks.filter(rank => rank !== trumpRank);
    const lowestTrumpStrength = 997 - ordinaryTrumpRanks.length
      - (isThreeSixNineGradesRule(activeRule) && activeRule?.inferiorSuit ? 1 : 0);
    return lowestTrumpStrength + ordinaryTrumpRanks.indexOf(card.rank);
  }

  if (dayNightOrderedRanks) {
    return 2 + dayNightOrderedRanks.indexOf(card.rank);
  }
  return baseValue;
}

function areStrengthsConsecutive(currentStrength, nextStrength, trumpSuit, trumpRank) {
  return arePairsConsecutive(
    { strength: currentStrength },
    { strength: nextStrength },
    trumpSuit,
    trumpRank
  );
}

function detectStraightFlush(cards, trumpSuit, trumpRank, activeRule) {
  if (!isSixSixGreatSuccessRule(activeRule) || cards.length < 6) {
    return { valid: false };
  }
  const effectiveSuits = new Set(
    cards.map(card => getEffectiveSuit(card, trumpSuit, trumpRank))
  );
  if (effectiveSuits.size !== 1) return { valid: false };

  const strengths = cards
    .map(card => getCardStrength(card, trumpSuit, trumpRank, activeRule))
    .sort((a, b) => a - b);
  if (new Set(strengths).size !== cards.length) return { valid: false };
  for (let index = 1; index < strengths.length; index++) {
    if (!areStrengthsConsecutive(
      strengths[index - 1],
      strengths[index],
      trumpSuit,
      trumpRank
    )) {
      return { valid: false };
    }
  }
  return {
    valid: true,
    suit: [...effectiveSuits][0],
    strength: strengths[strengths.length - 1],
    strengths
  };
}

export function findStraightFlushes(
  cards,
  requiredLength,
  trumpSuit,
  trumpRank,
  activeRule = null
) {
  if (!isSixSixGreatSuccessRule(activeRule) || requiredLength < 6) return [];
  const cardsByEffectiveSuit = new Map();
  for (const card of cards) {
    const suit = getEffectiveSuit(card, trumpSuit, trumpRank);
    const suitCards = cardsByEffectiveSuit.get(suit) || [];
    suitCards.push(card);
    cardsByEffectiveSuit.set(suit, suitCards);
  }

  const results = [];
  for (const [suit, suitCards] of cardsByEffectiveSuit) {
    const cardsByStrength = new Map();
    for (const card of suitCards) {
      const strength = getCardStrength(card, trumpSuit, trumpRank, activeRule);
      if (!cardsByStrength.has(strength)) cardsByStrength.set(strength, card);
    }
    const strengths = [...cardsByStrength.keys()].sort((a, b) => a - b);
    for (let start = 0; start <= strengths.length - requiredLength; start++) {
      const window = strengths.slice(start, start + requiredLength);
      const isStraight = window.every((strength, index) =>
        index === 0 || areStrengthsConsecutive(
          window[index - 1],
          strength,
          trumpSuit,
          trumpRank
        )
      );
      if (isStraight) {
        results.push({
          suit,
          cards: window.map(strength => cardsByStrength.get(strength)),
          strength: window[window.length - 1],
          length: requiredLength
        });
      }
    }
  }
  return results;
}

export function findTaiChiFourSymbols(cards, activeRule = null) {
  if (!isTaiChiFourSymbolsRule(activeRule)) return [];
  const cardsByRank = new Map();
  for (const card of cards) {
    if (!STANDARD_SUITS.includes(card.suit)) continue;
    const cardsBySuit = cardsByRank.get(card.rank) || new Map();
    if (!cardsBySuit.has(card.suit)) cardsBySuit.set(card.suit, card);
    cardsByRank.set(card.rank, cardsBySuit);
  }

  const results = [];
  for (const [rank, cardsBySuit] of cardsByRank) {
    if (STANDARD_SUITS.every(suit => cardsBySuit.has(suit))) {
      results.push({
        rank,
        cards: STANDARD_SUITS.map(suit => cardsBySuit.get(suit)),
        strength: RANK_ORDER[rank] || 0,
        length: 4
      });
    }
  }
  return results;
}

/**
 * 检测牌型
 */
export function detectPattern(cards, trumpSuit, trumpRank, activeRule = null) {
  if (!cards || cards.length === 0) {
    return { type: PatternTypes.INVALID, suit: null, strength: 0, length: 0 };
  }

  const count = cards.length;
  if (count === 4 && findTaiChiFourSymbols(cards, activeRule).length > 0) {
    const rank = cards[0].rank;
    return {
      type: PatternTypes.TAI_CHI_FOUR_SYMBOLS,
      suit: TAI_CHI_SUIT,
      rank,
      strength: RANK_ORDER[rank] || 0,
      length: 4
    };
  }
  const effectiveSuits = cards.map(c => getEffectiveSuit(c, trumpSuit, trumpRank));
  const uniqueSuits = [...new Set(effectiveSuits)];

  if (uniqueSuits.length !== 1) {
    return { type: PatternTypes.INVALID, suit: null, strength: 0, length: count };
  }

  const suit = uniqueSuits[0];

  const straightFlush = detectStraightFlush(cards, trumpSuit, trumpRank, activeRule);
  if (straightFlush.valid) {
    return {
      type: PatternTypes.STRAIGHT_FLUSH,
      suit: straightFlush.suit,
      strength: straightFlush.strength,
      length: count,
      strengths: straightFlush.strengths
    };
  }

  if (count === 1) {
    return {
      type: PatternTypes.SINGLE,
      suit,
      strength: getCardStrength(cards[0], trumpSuit, trumpRank, activeRule),
      length: 1
    };
  }

  if (count === 2) {
    if (canCardsFormPair(cards[0], cards[1], activeRule)) {
      return {
        type: PatternTypes.PAIR,
        suit,
        strength: getCardStrength(cards[0], trumpSuit, trumpRank, activeRule),
        length: 2
      };
    }
    if (cards[0].suit === Suits.JOKER && cards[1].suit === Suits.JOKER &&
        cards[0].rank === cards[1].rank) {
      return {
        type: PatternTypes.PAIR,
        suit,
        strength: getCardStrength(cards[0], trumpSuit, trumpRank, activeRule),
        length: 2
      };
    }
    if (isBeltAndRoadRule(activeRule) && activeRule?.beltAndRoadSkillActive === true) {
      const strengths = cards
        .map(card => getCardStrength(card, trumpSuit, trumpRank, activeRule))
        .sort((a, b) => b - a);
      return {
        type: PatternTypes.BELT_AND_ROAD,
        suit,
        strength: strengths[0],
        strengths,
        length: 2
      };
    }
    return { type: PatternTypes.INVALID, suit: null, strength: 0, length: count };
  }

  if (count >= 4 && count % 2 === 0) {
    const tractorResult = detectTractor(cards, trumpSuit, trumpRank, activeRule);
    if (tractorResult.valid) {
      return {
        type: PatternTypes.TRACTOR,
        suit,
        strength: tractorResult.strength,
        length: count,
        pairs: tractorResult.pairs
      };
    }
  }

  return { type: PatternTypes.INVALID, suit: null, strength: 0, length: count };
}

/**
 * 检测拖拉机
 */
function detectTractor(cards, trumpSuit, trumpRank, activeRule) {
  const pairs = [];
  const cardsCopy = [...cards];

  while (cardsCopy.length >= 2) {
    const card1 = cardsCopy.shift();
    const pairIndex = cardsCopy.findIndex(c => canCardsFormPair(card1, c, activeRule));

    if (pairIndex === -1) {
      return { valid: false, strength: 0, pairs: [] };
    }

    const card2 = cardsCopy.splice(pairIndex, 1)[0];
    pairs.push({
      rank: card1.rank,
      suit: card1.suit,
      strength: getCardStrength(card1, trumpSuit, trumpRank, activeRule)
    });
  }

  if (cardsCopy.length > 0) {
    return { valid: false, strength: 0, pairs: [] };
  }

  pairs.sort((a, b) => a.strength - b.strength);

  const effectiveSuit = getEffectiveSuit(cards[0], trumpSuit, trumpRank);

  if (effectiveSuit === 'trump') {
    return checkTrumpTractor(pairs, trumpSuit, trumpRank, activeRule);
  } else {
    return checkNonTrumpTractor(pairs, trumpRank, activeRule);
  }
}

function checkTrumpTractor(pairs, trumpSuit, trumpRank, activeRule) {
  for (let i = 0; i < pairs.length - 1; i++) {
    const current = pairs[i];
    const next = pairs[i + 1];
    if (!arePairsConsecutive(current, next, trumpSuit, trumpRank, activeRule)) {
      return { valid: false, strength: 0, pairs: [] };
    }
  }

  return {
    valid: true,
    strength: pairs[pairs.length - 1].strength,
    pairs
  };
}

function checkNonTrumpTractor(pairs, trumpRank, activeRule) {
  for (let i = 0; i < pairs.length - 1; i++) {
    if (!arePairsConsecutive(pairs[i], pairs[i + 1], null, trumpRank, activeRule)) {
      return { valid: false, strength: 0, pairs: [] };
    }
  }

  return {
    valid: true,
    strength: pairs[pairs.length - 1].strength,
    pairs
  };
}

function arePairsConsecutive(current, next, trumpSuit, trumpRank, activeRule) {
  const diff = next.strength - current.strength;
  const isTrumpSequence = current.strength >= 900 || next.strength >= 900;

  if (isTrumpSequence) {
    if (diff === 1) return true;
    const isNoTrump = !trumpSuit || trumpSuit === Suits.NO_TRUMP;
    return isNoTrump && current.strength === 997 && next.strength === 999;
  }

  if (diff === 1) return true;
  if (isUnarmedRule(activeRule)) return false;
  const trumpRankValue = RANK_ORDER[trumpRank] || 0;
  return diff === 2 && current.strength + 1 === trumpRankValue;
}

/**
 * 验证首发出牌是否合法
 */
export function validateLeadingPlay(cards, trumpSuit, trumpRank, activeRule = null) {
  if (!cards || cards.length === 0) {
    return { valid: false, message: '请选择要出的牌', pattern: null };
  }

  const pattern = detectPattern(cards, trumpSuit, trumpRank, activeRule);
  if (pattern.type === PatternTypes.TAI_CHI_FOUR_SYMBOLS) {
    return { valid: true, message: '出牌合法', pattern };
  }

  // 首发出牌时，只需要检查是否同花色
  // 允许甩牌（多种牌型的组合），具体验证交给后端
  const effectiveSuits = cards.map(c => getEffectiveSuit(c, trumpSuit, trumpRank));
  const uniqueSuits = [...new Set(effectiveSuits)];

  if (uniqueSuits.length !== 1) {
    return {
      valid: false,
      message: '必须出同一花色的牌',
      pattern: null
    };
  }

  // 同花色的牌通常允许作为甩牌；单步调试只保留完整的单张、对子和拖拉机。
  if (activeRule?.id === 'single_step_debug' && pattern.type === PatternTypes.INVALID) {
    return {
      valid: false,
      message: '单步调试规则下不能甩牌',
      pattern: null
    };
  }
  return { valid: true, message: '出牌合法', pattern };
}

/**
 * 验证跟牌是否合法
 */
export function validateFollowingPlay(
  cards,
  handCards,
  leadingPattern,
  trumpSuit,
  trumpRank,
  activeRule = null
) {
  if (!cards || cards.length === 0) {
    return { valid: false, message: '请选择要出的牌', pattern: null };
  }

  if (cards.length !== leadingPattern.length) {
    return {
      valid: false,
      message: `必须出 ${leadingPattern.length} 张牌`,
      pattern: null
    };
  }

  const leadingSuit = leadingPattern.suit;
  const patternRuleContext = leadingPattern.type === PatternTypes.BELT_AND_ROAD
    ? { ...activeRule, beltAndRoadSkillActive: true }
    : activeRule;

  if (leadingPattern.type === PatternTypes.TAI_CHI_FOUR_SYMBOLS) {
    return validateFollowingTaiChi(
      cards,
      handCards,
      trumpSuit,
      trumpRank,
      activeRule
    );
  }

  // 如果首发是甩牌，使用特殊的跟牌验证（前端实现与后端一致）
  if (leadingPattern.type === PatternTypes.THROW) {
    return validateFollowingThrow(cards, handCards, leadingPattern, trumpSuit, trumpRank, activeRule);
  }

  const sameSuitCards = handCards.filter(c =>
    getEffectiveSuit(c, trumpSuit, trumpRank) === leadingSuit
  );

  const playedSameSuit = cards.filter(c =>
    getEffectiveSuit(c, trumpSuit, trumpRank) === leadingSuit
  );

  if (sameSuitCards.length > 0) {
    const requiredCount = Math.min(sameSuitCards.length, leadingPattern.length);
    if (playedSameSuit.length < requiredCount) {
      return {
        valid: false,
        message: `手牌中有${sameSuitCards.length}张同花色的牌，必须优先出`,
        pattern: null
      };
    }
  }

  const pattern = detectPattern(cards, trumpSuit, trumpRank, patternRuleContext);

  if (playedSameSuit.length >= leadingPattern.length) {
    if (!matchPatternRequirement(cards, handCards, leadingPattern, trumpSuit, trumpRank, activeRule)) {
      return {
        valid: false,
        message: getPatternMismatchMessage(leadingPattern, handCards, trumpSuit, trumpRank, activeRule),
        pattern
      };
    }
  }

  return { valid: true, message: '跟牌合法', pattern };
}

const SUBSTITUTION_SUITS = Object.freeze([
  Suits.HEARTS,
  Suits.DIAMONDS,
  Suits.CLUBS,
  Suits.SPADES
]);
const SUBSTITUTION_RANKS = Object.freeze([
  Ranks.TWO,
  Ranks.THREE,
  Ranks.FOUR,
  Ranks.FIVE,
  Ranks.SIX,
  Ranks.SEVEN,
  Ranks.EIGHT,
  Ranks.NINE,
  Ranks.TEN,
  Ranks.JACK,
  Ranks.QUEEN,
  Ranks.KING,
  Ranks.ACE
]);

function createForbiddenMagicDemotedCard(card, targetSuit = card.suit, targetRank = card.rank) {
  return {
    ...card,
    suit: targetSuit,
    rank: targetRank,
    originalSuit: card.originalSuit || card.suit,
    originalRank: card.originalRank || card.rank,
    isForbiddenMagicDemoted: true,
    isForbiddenMagicTransformed: targetSuit !== card.suit || targetRank !== card.rank
  };
}

export function demoteForbiddenMagicHand(cards, trumpSuit, trumpRank) {
  const list = Array.isArray(cards) ? cards : [];
  return list.map(card => isTrumpCard(card, trumpSuit, trumpRank)
    ? createForbiddenMagicDemotedCard(card)
    : card);
}

export function resolveForbiddenMagicPlay({
  selectedCards,
  handCards,
  substitutions = [],
  leadingPattern = null,
  trumpSuit = null,
  trumpRank = null,
  activeRule = null
}) {
  const cards = Array.isArray(selectedCards) ? selectedCards : [];
  const hand = Array.isArray(handCards) ? handCards : [];
  const submitted = Array.isArray(substitutions) ? substitutions : [];
  if (new Set(submitted.map(item => item?.cardId)).size !== submitted.length) {
    return { valid: false, message: '同一张牌不能重复设置禁术转化' };
  }

  const selectedById = new Map(cards.map(card => [card.id, card]));
  const originalTrumpIds = new Set(
    hand.filter(card => isTrumpCard(card, trumpSuit, trumpRank)).map(card => card.id)
  );
  const replacementById = new Map();
  const normalizedSubstitutions = [];
  for (const substitution of submitted) {
    const sourceCard = selectedById.get(substitution?.cardId);
    if (!sourceCard) return { valid: false, message: '所有已转化的牌都必须包含在本次出牌中' };
    if (!originalTrumpIds.has(sourceCard.id)) {
      return { valid: false, message: '禁术秘法只能转化发动前属于主牌的牌' };
    }
    if (!SUBSTITUTION_SUITS.includes(substitution.suit)) {
      return { valid: false, message: '禁术秘法的目标花色无效' };
    }
    const isJoker = sourceCard.suit === Suits.JOKER;
    const targetRank = isJoker ? substitution.rank : sourceCard.rank;
    if (!SUBSTITUTION_RANKS.includes(targetRank)) {
      return { valid: false, message: '禁术秘法的目标点数无效' };
    }
    if (!isJoker && String(substitution.rank || sourceCard.rank) !== String(sourceCard.rank)) {
      return { valid: false, message: '非王牌只能改变花色，不能改变原点数' };
    }
    if (
      isJoker
      && trumpSuit
      && trumpSuit !== Suits.NO_TRUMP
      && substitution.suit === trumpSuit
    ) {
      return { valid: false, message: '禁术秘法：王不能转化为当前主牌花色' };
    }
    replacementById.set(
      sourceCard.id,
      createForbiddenMagicDemotedCard(sourceCard, substitution.suit, targetRank)
    );
    normalizedSubstitutions.push({
      cardId: sourceCard.id,
      fromSuit: sourceCard.suit,
      fromRank: sourceCard.rank,
      suit: substitution.suit,
      rank: targetRank
    });
  }

  const selectedJokersWithoutTarget = cards.filter(card => (
    originalTrumpIds.has(card.id)
    && card.suit === Suits.JOKER
    && !replacementById.has(card.id)
  ));
  if (selectedJokersWithoutTarget.length > 0) {
    return { valid: false, message: '禁术秘法中的王必须先明确选择目标花色和点数' };
  }

  const effectiveCards = demoteForbiddenMagicHand(cards, trumpSuit, trumpRank)
    .map(card => replacementById.get(card.id) || card);
  const effectiveHandCards = demoteForbiddenMagicHand(hand, trumpSuit, trumpRank)
    .map(card => replacementById.get(card.id) || card);
  const validation = leadingPattern
    ? validateFollowingPlay(
        effectiveCards,
        effectiveHandCards,
        leadingPattern,
        trumpSuit,
        trumpRank,
        activeRule
      )
    : validateLeadingPlay(effectiveCards, trumpSuit, trumpRank, activeRule);
  return {
    ...validation,
    usesSkill: true,
    effectiveCards,
    effectiveHandCards,
    substitutions: normalizedSubstitutions
  };
}

export function resolveJokerSubstitutionPlay({
  selectedCards,
  handCards,
  substitutions = [],
  leadingPattern = null,
  trumpSuit = null,
  trumpRank = null,
  activeRule = null
}) {
  const cards = Array.isArray(selectedCards) ? selectedCards : [];
  const hand = Array.isArray(handCards) ? handCards : [];
  const jokers = cards.filter(card => card.suit === Suits.JOKER);
  const submitted = Array.isArray(substitutions) ? substitutions : [];
  const validate = (effectiveCards, effectiveHand) => leadingPattern
    ? validateFollowingPlay(effectiveCards, effectiveHand, leadingPattern, trumpSuit, trumpRank, activeRule)
    : validateLeadingPlay(effectiveCards, trumpSuit, trumpRank, activeRule);

  if (submitted.length === 0 && cards.length === 1 && jokers.length === 1) {
    const validation = validate(cards, hand);
    return { ...validation, effectiveCards: cards, effectiveHandCards: hand, usesSkill: false, substitutions: [] };
  }
  if (submitted.length === 0) return { valid: false, message: '请先明确选择至少一张王牌要转换成的牌面' };
  if (new Set(submitted.map(item => item?.cardId)).size !== submitted.length) {
    return { valid: false, message: '同一张王牌不能重复设置转换' };
  }
  const selectedById = new Map(cards.map(card => [card.id, card]));
  const replacementById = new Map();
  for (const substitution of submitted) {
    const sourceCard = selectedById.get(substitution?.cardId);
    if (!sourceCard) return { valid: false, message: '所有已转换的王牌都必须包含在本次出牌中' };
    if (sourceCard.suit !== Suits.JOKER) return { valid: false, message: '偷梁换柱只能转换王牌' };
    if (!SUBSTITUTION_SUITS.includes(substitution.suit)) return { valid: false, message: '偷梁换柱的目标花色无效' };
    if (!SUBSTITUTION_RANKS.includes(substitution.rank)) return { valid: false, message: '偷梁换柱的目标点数无效' };
    replacementById.set(sourceCard.id, {
      ...sourceCard,
      suit: substitution.suit,
      rank: substitution.rank,
      originalSuit: Suits.JOKER,
      originalRank: sourceCard.rank,
      isJokerSubstitution: true
    });
  }
  const effectiveCards = cards.map(card => replacementById.get(card.id) || card);
  const effectiveHandCards = hand.map(card => replacementById.get(card.id) || card);
  const validation = validate(effectiveCards, effectiveHandCards);
  return { ...validation, effectiveCards, effectiveHandCards, usesSkill: true, substitutions: submitted };
}

const CLUSTER_ANALYSIS_RANKS = Object.freeze([
  Ranks.TWO,
  Ranks.THREE,
  Ranks.FOUR,
  Ranks.FIVE,
  Ranks.SIX,
  Ranks.SEVEN,
  Ranks.EIGHT,
  Ranks.NINE,
  Ranks.TEN,
  Ranks.JACK,
  Ranks.QUEEN,
  Ranks.KING,
  Ranks.ACE
]);

export function getClusterAnalysisTargetRanks(card, trumpRank) {
  if (!card || card.suit === Suits.JOKER) return [];
  const sourceIndex = CLUSTER_ANALYSIS_RANKS.findIndex(rank => String(rank) === String(card.rank));
  if (sourceIndex < 0 || [Ranks.FIVE, Ranks.TEN, Ranks.KING].includes(card.rank)) return [];
  if (String(card.rank) === String(trumpRank)) return [];
  return [sourceIndex - 1, sourceIndex + 1]
    .filter(index => index >= 0 && index < CLUSTER_ANALYSIS_RANKS.length)
    .map(index => CLUSTER_ANALYSIS_RANKS[index])
    .filter(rank => ![Ranks.FIVE, Ranks.TEN, Ranks.KING].includes(rank))
    .filter(rank => String(rank) !== String(trumpRank));
}

function createClusterCard(card, targetRank) {
  return {
    ...card,
    rank: targetRank,
    originalRank: card.rank,
    isClusterAnalysisTransformed: true,
    clusterAnalysisSourceRank: card.rank
  };
}

export function resolveClusterAnalysisPlay({
  selectedCards,
  handCards,
  substitutions = [],
  leadingPattern = null,
  trumpSuit = null,
  trumpRank = null,
  activeRule = null
}) {
  const cards = Array.isArray(selectedCards) ? selectedCards : [];
  const hand = Array.isArray(handCards) ? handCards : [];
  const submitted = Array.isArray(substitutions) ? substitutions : [];
  const validate = (effectiveCards, effectiveHandCards) => leadingPattern
    ? validateFollowingPlay(
        effectiveCards,
        effectiveHandCards,
        leadingPattern,
        trumpSuit,
        trumpRank,
        activeRule
      )
    : validateLeadingPlay(effectiveCards, trumpSuit, trumpRank, activeRule);

  if (submitted.length === 0) {
    return {
      valid: false,
      usesSkill: false,
      effectiveCards: cards,
      effectiveHandCards: hand,
      substitutions: [],
      message: '聚类分析必须先明确转换至少一张牌'
    };
  }
  if (new Set(submitted.map(item => item?.cardId)).size !== submitted.length) {
    return { valid: false, message: '同一张牌不能重复设置聚类转换' };
  }

  const selectedById = new Map(cards.map(card => [card.id, card]));
  const replacementById = new Map();
  const normalizedSubstitutions = [];
  for (const substitution of submitted) {
    const sourceCard = selectedById.get(substitution?.cardId);
    if (!sourceCard) {
      return { valid: false, message: '所有已转换的牌都必须包含在本次出牌中' };
    }
    const targetRanks = getClusterAnalysisTargetRanks(sourceCard, trumpRank);
    if (!targetRanks.includes(substitution.toRank)) {
      return { valid: false, message: `牌 ${sourceCard.rank} 不能转换成所选点数` };
    }
    normalizedSubstitutions.push({
      cardId: sourceCard.id,
      suit: sourceCard.suit,
      fromRank: sourceCard.rank,
      toRank: substitution.toRank
    });
    replacementById.set(sourceCard.id, createClusterCard(sourceCard, substitution.toRank));
  }
  const effectiveCards = cards.map(card => replacementById.get(card.id) || card);
  const effectiveHandCards = hand.map(card => replacementById.get(card.id) || card);
  const validation = validate(effectiveCards, effectiveHandCards);
  return { ...validation, usesSkill: true, effectiveCards, effectiveHandCards, substitutions: normalizedSubstitutions };
}

function validateFollowingTaiChi(cards, handCards, trumpSuit, trumpRank, activeRule) {
  const pattern = detectPattern(cards, trumpSuit, trumpRank, activeRule);
  const availableTaiChi = findTaiChiFourSymbols(handCards, activeRule);
  if (
    availableTaiChi.length > 0 &&
    pattern.type !== PatternTypes.TAI_CHI_FOUR_SYMBOLS
  ) {
    return {
      valid: false,
      message: '手牌中有太极四象，必须优先跟出太极四象',
      pattern
    };
  }
  if (pattern.type === PatternTypes.TAI_CHI_FOUR_SYMBOLS) {
    return { valid: true, message: '跟牌合法', pattern };
  }

  const hasNoSideCards = handCards.length > 0 && handCards.every(card =>
    isTrumpCard(card, trumpSuit, trumpRank)
  );
  const playedOnlyTrump = cards.every(card => isTrumpCard(card, trumpSuit, trumpRank));
  if (hasNoSideCards && playedOnlyTrump) {
    return {
      valid: true,
      message: '四张主牌毙太极四象',
      pattern: {
        ...pattern,
        type: pattern.type === PatternTypes.INVALID ? PatternTypes.THROW : pattern.type,
        suit: 'trump',
        length: 4,
        strength: Math.max(...cards.map(card =>
          getCardStrength(card, trumpSuit, trumpRank, activeRule)
        )),
        canTrumpTaiChi: true
      }
    };
  }
  return { valid: true, message: '跟牌合法', pattern };
}

function matchPatternRequirement(
  cards,
  handCards,
  leadingPattern,
  trumpSuit,
  trumpRank,
  activeRule
) {
  const leadingSuit = leadingPattern.suit;

  const sameSuitHand = handCards.filter(c =>
    getEffectiveSuit(c, trumpSuit, trumpRank) === leadingSuit
  );

  if (leadingPattern.type === PatternTypes.STRAIGHT_FLUSH) {
    const availableStraightFlushes = findStraightFlushes(
      sameSuitHand,
      leadingPattern.length,
      trumpSuit,
      trumpRank,
      activeRule
    );
    if (availableStraightFlushes.length > 0) {
      const playedPattern = detectPattern(cards, trumpSuit, trumpRank, activeRule);
      return playedPattern.type === PatternTypes.STRAIGHT_FLUSH &&
        playedPattern.suit === leadingSuit &&
        playedPattern.length === leadingPattern.length;
    }
  }

  if (leadingPattern.type === PatternTypes.PAIR) {
    const hasPair = findPairsInCards(sameSuitHand, trumpSuit, trumpRank, activeRule).length > 0;
    if (hasPair) {
      const playedPattern = detectPattern(cards, trumpSuit, trumpRank, activeRule);
      return playedPattern.type === PatternTypes.PAIR;
    }
  }

  if (leadingPattern.type === PatternTypes.TRACTOR) {
    const pairs = findPairsInCards(sameSuitHand, trumpSuit, trumpRank, activeRule);

    const tractorPairs = leadingPattern.length / 2;
    const longestTractor = getLongestTractorPairCount(
      pairs,
      tractorPairs,
      trumpSuit,
      trumpRank,
      activeRule
    );

    if (longestTractor === tractorPairs) {
      const playedPattern = detectPattern(cards, trumpSuit, trumpRank, activeRule);
      return playedPattern.type === PatternTypes.TRACTOR &&
             playedPattern.length === leadingPattern.length;
    }

    if (pairs.length > 0) {
      const playedPairs = findPairsInCards(cards, trumpSuit, trumpRank, activeRule);
      const requiredPairs = Math.min(pairs.length, tractorPairs);
      if (playedPairs.length < requiredPairs) return false;

      if (longestTractor >= 2) {
        const playedLongest = getLongestTractorPairCount(
          playedPairs,
          longestTractor,
          trumpSuit,
          trumpRank,
          activeRule
        );
        return playedLongest >= longestTractor;
      }

      return true;
    }
  }

  return true;
}

function getPatternMismatchMessage(
  leadingPattern,
  handCards,
  trumpSuit,
  trumpRank,
  activeRule
) {
  const leadingSuit = leadingPattern.suit;
  const sameSuitHand = handCards.filter(c =>
    getEffectiveSuit(c, trumpSuit, trumpRank) === leadingSuit
  );

  if (leadingPattern.type === PatternTypes.STRAIGHT_FLUSH) {
    const straightFlushes = findStraightFlushes(
      sameSuitHand,
      leadingPattern.length,
      trumpSuit,
      trumpRank,
      activeRule
    );
    if (straightFlushes.length > 0) {
      return `手牌中有同花色${leadingPattern.length}张同花顺，必须出同花顺`;
    }
  }

  if (leadingPattern.type === PatternTypes.PAIR) {
    const pairs = findPairsInCards(sameSuitHand, trumpSuit, trumpRank, activeRule);
    if (pairs.length > 0) {
      return '手牌中有同花色对子，必须出对子';
    }
  }

  if (leadingPattern.type === PatternTypes.TRACTOR) {
    const pairs = findPairsInCards(sameSuitHand, trumpSuit, trumpRank, activeRule);
    if (pairs.length > 0) {
      return '手牌中有同花色对子，必须优先把对子打下来';
    }
  }

  return '出牌不符合规则';
}

export function findPairsInCards(cards, trumpSuit, trumpRank, activeRule = null) {
  const pairs = [];
  const used = new Set();

  for (let i = 0; i < cards.length; i++) {
    if (used.has(i)) continue;

    for (let j = i + 1; j < cards.length; j++) {
      if (used.has(j)) continue;

      if (canCardsFormPair(cards[i], cards[j], activeRule)) {
        pairs.push({
          cards: [cards[i], cards[j]],
          strength: getCardStrength(cards[i], trumpSuit, trumpRank, activeRule)
        });
        used.add(i);
        used.add(j);
        break;
      }
    }
  }

  return pairs;
}

export function findTractorInPairs(
  pairs,
  requiredLength,
  trumpSuit,
  trumpRank,
  activeRule = null
) {
  return getLongestTractorPairCount(
    pairs,
    requiredLength,
    trumpSuit,
    trumpRank,
    activeRule
  ) >= requiredLength;
}

function getLongestTractorPairCount(pairs, maxLength, trumpSuit, trumpRank, activeRule = null) {
  if (!pairs || pairs.length === 0) return 0;

  const sortedPairs = [...pairs].sort((a, b) => a.strength - b.strength);
  let longest = 1;
  let currentLength = 1;

  for (let i = 1; i < sortedPairs.length; i++) {
    if (arePairsConsecutive(
      sortedPairs[i - 1],
      sortedPairs[i],
      trumpSuit,
      trumpRank,
      activeRule
    )) {
      currentLength++;
      longest = Math.max(longest, currentLength);
    } else {
      currentLength = 1;
    }
  }

  return Math.min(longest, maxLength);
}

/**
 * 找出手牌中所有可能的拖拉机
 * @returns {Array} 拖拉机数组，每个包含 { cards: [], length: number }
 */
export function findAllTractors(
  cards,
  trumpSuit,
  trumpRank,
  requiredLength,
  activeRule = null
) {
  const pairs = findPairsInCards(cards, trumpSuit, trumpRank, activeRule);
  if (pairs.length < requiredLength / 2) return [];

  const sortedPairs = [...pairs].sort((a, b) => a.strength - b.strength);
  const tractors = [];
  const numPairsNeeded = requiredLength / 2;

  // 尝试找出所有可能的拖拉机组合
  for (let i = 0; i <= sortedPairs.length - numPairsNeeded; i++) {
    let isConsecutive = true;
    for (let j = 0; j < numPairsNeeded - 1; j++) {
      if (!arePairsConsecutive(
        sortedPairs[i + j],
        sortedPairs[i + j + 1],
        trumpSuit,
        trumpRank,
        activeRule
      )) {
        isConsecutive = false;
        break;
      }
    }

    if (isConsecutive) {
      // 找到一个拖拉机，收集所有卡片
      const tractorCards = [];
      for (let j = 0; j < numPairsNeeded; j++) {
        tractorCards.push(...sortedPairs[i + j].cards);
      }
      tractors.push({
        cards: tractorCards,
        length: requiredLength
      });
    }
  }

  return tractors;
}

/**
 * 计算必须出的牌（用于自动选中）
 * @param {Array} handCards - 手牌
 * @param {Object} leadingPattern - 首发牌型
 * @param {String} trumpSuit - 主花色
 * @param {String} trumpRank - 级牌
 * @returns {Array|null} 必须出的牌数组，如果没有唯一解则返回null
 */
export function calculateMustPlayCards(
  handCards,
  leadingPattern,
  trumpSuit,
  trumpRank,
  activeRule = null
) {
  if (!leadingPattern || !handCards || handCards.length === 0) return null;

  const leadingSuit = leadingPattern.suit;
  const requiredLength = leadingPattern.length;

  if (leadingPattern.type === PatternTypes.TAI_CHI_FOUR_SYMBOLS) {
    const taiChiPatterns = findTaiChiFourSymbols(handCards, activeRule);
    if (taiChiPatterns.length === 1) return taiChiPatterns[0].cards;
    if (taiChiPatterns.length > 1) return null;
    if (handCards.length === requiredLength) return handCards;
    return null;
  }

  // 找出手牌中同花色的牌
  const sameSuitCards = handCards.filter(c =>
    getEffectiveSuit(c, trumpSuit, trumpRank) === leadingSuit
  );

  // 情况1：同花色的牌数量刚好等于需要出的数量
  if (sameSuitCards.length > 0 && sameSuitCards.length === requiredLength) {
    return sameSuitCards;
  }

  // 情况2：没有同花色的牌，且手牌总数等于需要出的数量
  if (sameSuitCards.length === 0 && handCards.length === requiredLength) {
    return handCards;
  }

  // 情况3：同花色的牌数量小于需要出的数量，且手牌总数等于需要出的数量
  if (sameSuitCards.length > 0 && sameSuitCards.length < requiredLength && handCards.length === requiredLength) {
    return handCards;
  }

  // 情况4：同花色的牌数量小于需要出的数量（不够），但同花色牌大于0，则所有同花色牌都必须出
  if (sameSuitCards.length > 0 && sameSuitCards.length < requiredLength) {
    return sameSuitCards;
  }

  // 情况5：有足够的同花色牌，需要根据牌型判断
  if (sameSuitCards.length <= requiredLength) return null;

  const leadingType = leadingPattern.type;

  if (leadingType === PatternTypes.STRAIGHT_FLUSH) {
    const straightFlushes = findStraightFlushes(
      sameSuitCards,
      requiredLength,
      trumpSuit,
      trumpRank,
      activeRule
    );
    return straightFlushes.length === 1 ? straightFlushes[0].cards : null;
  }

  // 处理单张
  if (leadingType === PatternTypes.SINGLE && requiredLength === 1) {
    return null; // 单张有多种选择，不自动选中
  }

  // 处理对子
  if (leadingType === PatternTypes.PAIR && requiredLength === 2) {
    const pairs = findPairsInCards(sameSuitCards, trumpSuit, trumpRank, activeRule);
    if (pairs.length === 1) {
      return pairs[0].cards; // 只有一个对子，必须出
    }
    return null; // 有多个对子，不自动选中
  }

  // 处理拖拉机
  if (leadingType === PatternTypes.TRACTOR && requiredLength >= 4 && requiredLength % 2 === 0) {
    const tractors = findAllTractors(
      sameSuitCards,
      trumpSuit,
      trumpRank,
      requiredLength,
      activeRule
    );
    if (tractors.length === 1) {
      return tractors[0].cards; // 只有一个拖拉机，必须出
    }
    if (tractors.length === 0) {
      // 没有拖拉机，检查对子
      const pairs = findPairsInCards(sameSuitCards, trumpSuit, trumpRank, activeRule);
      const numPairsNeeded = requiredLength / 2;

      if (pairs.length === numPairsNeeded) {
        // 对子数量刚好，必须出所有对子
        return pairs.flatMap(p => p.cards);
      } else if (pairs.length === 1) {
        // 只有一个对子（需要配单牌），自动选中这个对子
        return pairs[0].cards;
      }
    }
    return null;
  }

  // 处理甩牌
  if (leadingType === PatternTypes.THROW && leadingPattern.components) {
    return calculateMustPlayCardsForThrow(
      sameSuitCards,
      leadingPattern,
      trumpSuit,
      trumpRank,
      activeRule
    );
  }

  return null;
}

/**
 * 计算甩牌时必须出的牌
 */
function calculateMustPlayCardsForThrow(
  sameSuitCards,
  leadingPattern,
  trumpSuit,
  trumpRank,
  activeRule
) {
  const leadingComponents = leadingPattern.components;
  const requiredLength = leadingPattern.length;

  // 如果同花色牌数量等于需要出的数量，全部必须出
  if (sameSuitCards.length === requiredLength) {
    return sameSuitCards;
  }

  // 如果同花色牌数量小于需要的数量，不处理（这种情况应该由前面的逻辑处理）
  if (sameSuitCards.length < requiredLength) {
    return null;
  }

  // 解析同花色牌的组合
  const sameSuitParsed = parseThrowCombination(
    sameSuitCards,
    trumpSuit,
    trumpRank,
    activeRule
  );
  if (!sameSuitParsed.valid) return null;

  // 统计首发要求的各种牌型
  const leadingRequirements = {
    [PatternTypes.TRACTOR]: [],
    [PatternTypes.PAIR]: [],
    [PatternTypes.SINGLE]: []
  };

  for (const component of leadingComponents) {
    leadingRequirements[component.type].push(component);
  }

  // 统计手牌中可用的各种牌型
  const availableComponents = {
    [PatternTypes.TRACTOR]: [],
    [PatternTypes.PAIR]: [],
    [PatternTypes.SINGLE]: []
  };

  for (const component of sameSuitParsed.components) {
    availableComponents[component.type].push(component);
  }

  const mustPlayCards = [];
  let hasChoice = false;

  // 统计首发要求的总对子数（包括拖拉机中的对子）
  let totalPairsRequired = leadingRequirements[PatternTypes.PAIR].length;
  for (const tractor of leadingRequirements[PatternTypes.TRACTOR]) {
    totalPairsRequired += tractor.length / 2; // 拖拉机长度除以2就是对子数
  }

  // 检查拖拉机
  for (const leadTractor of leadingRequirements[PatternTypes.TRACTOR]) {
    const matchingTractors = availableComponents[PatternTypes.TRACTOR].filter(
      t => t.length === leadTractor.length
    );

    if (matchingTractors.length === 1) {
      // 只有一个匹配的拖拉机，必须出
      mustPlayCards.push(...matchingTractors[0].cards);
    } else if (matchingTractors.length > 1) {
      // 有多个拖拉机可选，有选择余地
      hasChoice = true;
    }
  }

  // 检查对子
  const availablePairsCount = availableComponents[PatternTypes.PAIR].length;

  // 如果有对子要求（包括拖拉机要求）且没有选择余地
  if (totalPairsRequired > 0 && !hasChoice) {
    // 如果可用对子数量小于等于需要的对子数量，全部必须出
    if (availablePairsCount > 0 && availablePairsCount <= totalPairsRequired) {
      for (const pair of availableComponents[PatternTypes.PAIR]) {
        mustPlayCards.push(...pair.cards);
      }
    } else if (availablePairsCount > totalPairsRequired) {
      // 有多余的对子，有选择余地
      hasChoice = true;
    }
  }

  // 如果有选择余地，返回null
  if (hasChoice) {
    return null;
  }

  // 如果必须出的牌刚好等于需要的数量，返回这些牌
  if (mustPlayCards.length === requiredLength) {
    return mustPlayCards;
  }

  // 特殊情况：如果有对子必须出且没有选择余地，自动选中这些对子
  // 例如：对方甩牌包含对子，我方只有一个对子，这个对子必须跟
  if (mustPlayCards.length > 0 && mustPlayCards.length < requiredLength && !hasChoice) {
    // 确认 mustPlayCards 中包含的是对子（偶数张且至少2张）
    if (mustPlayCards.length >= 2 && mustPlayCards.length % 2 === 0) {
      return mustPlayCards;
    }
  }

  return null;
}

/**
 * 解析甩牌组合 - 将牌分解成各种牌型组件
 * @param {Array} cards - 要解析的牌
 * @param {String} trumpSuit - 主花色
 * @param {String} trumpRank - 级牌
 * @returns {Object} { valid, suit, components } components是组件数组，每个组件包含 { type, cards, strength }
 */
export function parseThrowCombination(cards, trumpSuit, trumpRank, activeRule = null) {
  if (!cards || cards.length === 0) {
    return { valid: false, suit: null, components: [] };
  }

  const specialPattern = detectPattern(cards, trumpSuit, trumpRank, activeRule);
  if (
    specialPattern.type === PatternTypes.STRAIGHT_FLUSH ||
    specialPattern.type === PatternTypes.TAI_CHI_FOUR_SYMBOLS
  ) {
    return {
      valid: true,
      suit: specialPattern.suit,
      components: [{
        type: specialPattern.type,
        cards: [...cards],
        strength: specialPattern.strength,
        length: cards.length
      }],
      totalCards: cards.length
    };
  }

  // 检查是否同花色
  const effectiveSuits = cards.map(c => getEffectiveSuit(c, trumpSuit, trumpRank));
  const uniqueSuits = [...new Set(effectiveSuits)];

  if (uniqueSuits.length !== 1) {
    return { valid: false, suit: null, components: [], message: '甩牌必须是同一花色' };
  }

  const suit = uniqueSuits[0];
  const components = [];
  const remainingCards = [...cards];
  const used = new Set();

  // 按强度排序（从大到小），方便后续处理
  remainingCards.sort((a, b) =>
    getCardStrength(b, trumpSuit, trumpRank) - getCardStrength(a, trumpSuit, trumpRank)
  );

  // 第一步：找出所有拖拉机
  let maxTractorLength = Math.floor(remainingCards.length / 2) * 2; // 必须是偶数
  for (let len = maxTractorLength; len >= 4; len -= 2) {
    let found = true;
    while (found) {
      found = false;
      // 尝试找一个长度为len的拖拉机
      for (let i = 0; i <= remainingCards.length - len; i++) {
        if (used.has(i)) continue;

        const candidateCards = [];
        const candidateIndices = [];
        for (let j = i; j < remainingCards.length && candidateCards.length < len; j++) {
          if (!used.has(j)) {
            candidateCards.push(remainingCards[j]);
            candidateIndices.push(j);
          }
        }

        if (candidateCards.length === len) {
          const pattern = detectPattern(candidateCards, trumpSuit, trumpRank, activeRule);
          if (pattern.type === PatternTypes.TRACTOR && pattern.length === len) {
            // 找到一个拖拉机
            components.push({
              type: PatternTypes.TRACTOR,
              cards: candidateCards,
              strength: pattern.strength,
              length: len
            });
            candidateIndices.forEach(idx => used.add(idx));
            found = true;
            break;
          }
        }
      }
    }
  }

  // 第二步：找出所有对子
  for (let i = 0; i < remainingCards.length; i++) {
    if (used.has(i)) continue;

    for (let j = i + 1; j < remainingCards.length; j++) {
      if (used.has(j)) continue;

      const card1 = remainingCards[i];
      const card2 = remainingCards[j];

      if (canCardsFormPair(card1, card2, activeRule)) {
        components.push({
          type: PatternTypes.PAIR,
          cards: [card1, card2],
          strength: getCardStrength(card1, trumpSuit, trumpRank),
          length: 2
        });
        used.add(i);
        used.add(j);
        break;
      }
    }
  }

  // 第三步：剩余的都是单牌
  for (let i = 0; i < remainingCards.length; i++) {
    if (used.has(i)) continue;

    const card = remainingCards[i];
    components.push({
      type: PatternTypes.SINGLE,
      cards: [card],
      strength: getCardStrength(card, trumpSuit, trumpRank),
      length: 1
    });
    used.add(i);
  }

  return {
    valid: true,
    suit,
    components,
    totalCards: cards.length
  };
}

/**
 * 按类型分组组件
 */
function groupComponentsByType(components) {
  const grouped = {
    [PatternTypes.TRACTOR]: [],
    [PatternTypes.PAIR]: [],
    [PatternTypes.SINGLE]: []
  };

  for (const component of components) {
    if (grouped[component.type]) {
      grouped[component.type].push(component);
    }
  }

  return grouped;
}

/**
 * 验证跟甩牌是否合法
 * @param {Array} cards - 要出的牌
 * @param {Array} handCards - 手牌
 * @param {Object} leadingPattern - 首发甩牌牌型（包含components）
 * @param {String} trumpSuit - 主花色
 * @param {String} trumpRank - 级牌
 * @returns {Object} { valid, message, pattern }
 */
function validateFollowingThrow(
  cards,
  handCards,
  leadingPattern,
  trumpSuit,
  trumpRank,
  activeRule
) {
  const leadingSuit = leadingPattern.suit;
  const leadingComponents = leadingPattern.components;

  // 统计手牌中同花色的牌
  const sameSuitCards = handCards.filter(c =>
    getEffectiveSuit(c, trumpSuit, trumpRank) === leadingSuit
  );

  // 统计出牌中同花色的牌
  const playedSameSuit = cards.filter(c =>
    getEffectiveSuit(c, trumpSuit, trumpRank) === leadingSuit
  );

  // 如果手牌中有同花色的牌，必须优先出
  if (sameSuitCards.length > 0) {
    const requiredCount = Math.min(sameSuitCards.length, leadingPattern.length);
    if (playedSameSuit.length < requiredCount) {
      return {
        valid: false,
        message: `手牌中有${sameSuitCards.length}张同花色的牌，必须优先出`,
        pattern: null
      };
    }
  }

  // 解析跟牌的组合
  const followParsed = parseThrowCombination(cards, trumpSuit, trumpRank, activeRule);

  // 如果全部是同花色，需要检查牌型匹配
  if (playedSameSuit.length >= leadingPattern.length && sameSuitCards.length >= leadingPattern.length) {
    // 需要匹配首发的每个组件类型
    const leadingRequirements = {
      [PatternTypes.TRACTOR]: [],
      [PatternTypes.PAIR]: [],
      [PatternTypes.SINGLE]: []
    };

    for (const component of leadingComponents) {
      leadingRequirements[component.type].push(component);
    }

    const errors = [];
    const availablePairs = findPairsInCards(sameSuitCards, trumpSuit, trumpRank, activeRule);
    const followPairs = findPairsInCards(cards, trumpSuit, trumpRank, activeRule);

    // 有完整拖跟完整拖；否则仍须优先跟出可组成的最长短拖。
    for (const leadTractor of leadingRequirements[PatternTypes.TRACTOR]) {
      const requiredPairCount = leadTractor.length / 2;
      const availableLongest = getLongestTractorPairCount(
        availablePairs,
        requiredPairCount,
        trumpSuit,
        trumpRank,
        activeRule
      );
      const followedLongest = getLongestTractorPairCount(
        followPairs,
        requiredPairCount,
        trumpSuit,
        trumpRank,
        activeRule
      );

      if (availableLongest >= 2 && followedLongest < availableLongest) {
        errors.push(`手牌中有同花色${availableLongest * 2}张的拖拉机，必须优先出`);
      }
    }

    const totalRequiredPairs =
      leadingRequirements[PatternTypes.PAIR].length +
      leadingRequirements[PatternTypes.TRACTOR].reduce(
        (total, tractor) => total + tractor.length / 2,
        0
      );
    const requiredPairs = Math.min(availablePairs.length, totalRequiredPairs);
    if (followPairs.length < requiredPairs) {
      errors.push(`手牌中有${availablePairs.length}个同花色对子，必须至少出${requiredPairs}个`);
    }

    if (errors.length > 0) {
      return {
        valid: false,
        message: errors[0],
        pattern: null
      };
    }
  }

  // 创建跟牌的牌型（也标记为甩牌，即使只是跟牌）
  const pattern = {
    type: PatternTypes.THROW,
    suit: followParsed.suit || 'mixed',
    components: followParsed.components || [],
    length: cards.length,
    strength: followParsed.components && followParsed.components.length > 0
      ? Math.max(...followParsed.components.map(c => c.strength))
      : 0
  };

  return { valid: true, message: '跟牌合法', pattern };
}
