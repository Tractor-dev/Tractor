import {
  Suits,
  Ranks,
  RANK_ORDER,
  normalizeRank,
  STANDARD_ORDINARY_RANKS,
  EXTENDED_ORDINARY_RANKS
} from './constants.js';
import {
  isReverseRankOrderRule,
  isBeltAndRoadRule,
  isDayNightRotationRule,
  getDayNightRotatingRank,
  isSixSixGreatSuccessRule,
  isTaiChiFourSymbolsRule,
  isSingleStepDebugRule,
  isStrengthCompensationRule,
  isAfterglowRule,
  isAntinomyRule,
  isTeammateCheerRule,
  isThreeTigersRule,
  isThreeSixNineGradesRule,
  isUnarmedRule
} from '../rules/ruleRegistry.js';

const ORDINARY_RANKS = STANDARD_ORDINARY_RANKS;

const STANDARD_SUITS = Object.freeze([
  Suits.HEARTS,
  Suits.DIAMONDS,
  Suits.CLUBS,
  Suits.SPADES
]);
const TAI_CHI_SUIT = 'tai_chi';

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
  const splitFaceKeys = activeRule?.antinomySplitFaceKeys || [];
  return !splitFaceKeys.includes(getAntinomyFaceKey(card1));
}

/**
 * 牌型类型
 */
export const PatternTypes = {
  SINGLE: 'single',       // 单牌
  PAIR: 'pair',           // 对子
  TRACTOR: 'tractor',     // 拖拉机（连对）
  STRAIGHT_FLUSH: 'straight_flush', // 六六大顺：六张起步的同花顺
  TAI_CHI_FOUR_SYMBOLS: 'tai_chi_four_symbols', // 四种花色的同点数牌
  BELT_AND_ROAD: 'belt_and_road', // 一带一路：同一有效花色的两张非对子单牌
  THROW: 'throw',         // 甩牌（多种牌型组合）
  INVALID: 'invalid'      // 无效牌型
};

/**
 * 判断一张牌是否是主牌
 * @param {Object} card - 牌
 * @param {String} trumpSuit - 主花色
 * @param {String} trumpRank - 级牌
 * @returns {Boolean}
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
  const normTrumpRank = normalizeRank(trumpRank);
  // 大小王永远是主牌
  if (card.suit === Suits.JOKER) {
    return true;
  }
  // 级牌是主牌 - 使用字符串比较确保类型一致
  if (!card.isUnarmed && String(card.rank) === String(normTrumpRank)) {
    return true;
  }
  // 主花色的牌是主牌
  if (card.suit === trumpSuit) {
    return true;
  }
  return false;
}

/**
 * 获取牌的有效花色（用于跟牌判断）
 * @param {Object} card - 牌
 * @param {String} trumpSuit - 主花色
 * @param {String} trumpRank - 级牌
 * @returns {String} 'trump' 或 实际花色
 */
export function getEffectiveSuit(card, trumpSuit, trumpRank) {
  if (isTrumpCard(card, trumpSuit, trumpRank)) {
    return 'trump';
  }
  return card.suit;
}

function getThreeSixNineSuitTier(patternSuit, activeRule) {
  if (!isThreeSixNineGradesRule(activeRule) || !activeRule?.inferiorSuit) return null;
  if (patternSuit === 'trump') return 2;
  if (patternSuit === activeRule.inferiorSuit) return 0;
  if (STANDARD_SUITS.includes(patternSuit)) return 1;
  return null;
}

/**
 * 获取牌的强度值（用于大小比较）
 * @param {Object} card - 牌
 * @param {String} trumpSuit - 主花色
 * @param {String} trumpRank - 级牌
 * @returns {Number} 强度值，越大越强
 */
export function getCardStrength(card, trumpSuit, trumpRank, activeRule = null) {
  if (card?.isForbiddenMagicDemoted) {
    return RANK_ORDER[card.rank] || 0;
  }
  const normTrumpRank = normalizeRank(trumpRank);
  const isUnarmed = isUnarmedRule(activeRule) || Boolean(card?.isUnarmed);
  if (card.rank === Ranks.WHITE_JOKER) {
    return 1001;
  }
  // 大王最大
  if (card.rank === Ranks.BIG_JOKER) {
    return 1000;
  }
  // 小王
  if (card.rank === Ranks.SMALL_JOKER) {
    return 999;
  }
  // 取长补短：无主级牌降一级后仍是主牌，只比无主级牌低一档。
  if (card.rank === Ranks.NO_TRUMP_MINUS) {
    return 996;
  }
  // 三人成虎的降级牌视同当前主花色；若降到级牌点数，按主级牌处理。
  if (card.isThreeTigersTrump && String(card.rank) === String(normTrumpRank)) {
    return 998;
  }
  // 主花色的级牌
  if (!isUnarmed && String(card.rank) === String(normTrumpRank) && card.suit === trumpSuit) {
    return 998;
  }
  // 三六九等：劣花色级牌仍属于主牌，但排在其他副花色级牌之后。
  if (
    !isUnarmed
    && String(card.rank) === String(normTrumpRank)
    && isThreeSixNineGradesRule(activeRule)
    && activeRule?.inferiorSuit
    && card.suit === activeRule.inferiorSuit
  ) {
    return 996;
  }
  // 副花色的级牌
  if (!isUnarmed && String(card.rank) === String(normTrumpRank)) {
    return 997;
  }

  const rotatingRank = isDayNightRotationRule(activeRule)
    ? getDayNightRotatingRank(activeRule?.currentRound)
    : null;
  const boostedRank = rotatingRank && String(rotatingRank) !== String(normTrumpRank)
    ? rotatingRank
    : null;
  const dayNightOrderedRanks = boostedRank
    ? ORDINARY_RANKS
        .filter(rank => String(rank) !== String(normTrumpRank) && rank !== boostedRank)
        .concat(boostedRank)
    : null;

  const reverseRankOrder = isReverseRankOrderRule(activeRule);
  const baseValue = RANK_ORDER[card.rank] || 0;
  const usesExtendedRanks = isStrengthCompensationRule(activeRule)
    || isAfterglowRule(activeRule)
    || isTeammateCheerRule(activeRule)
    || isThreeTigersRule(activeRule)
    || Boolean(card?.isStrengthCompensated)
    || Boolean(card?.isTeammateCheered)
    || Boolean(card?.isAfterglowBoosted);

  if (card.isThreeTigersTrump) {
    const ordinaryTrumpRanks = EXTENDED_ORDINARY_RANKS
      .filter(rank => rank !== Ranks.FIFTEEN && String(rank) !== String(normTrumpRank));
    const lowestTrumpStrength = 997 - ordinaryTrumpRanks.length;
    return lowestTrumpStrength + ordinaryTrumpRanks.indexOf(card.rank);
  }

  if (card.isLastStandTrump) {
    const orderedRanks = reverseRankOrder
      ? [...ORDINARY_RANKS].reverse()
      : ORDINARY_RANKS;
    const ordinaryTrumpRanks = isUnarmed
      ? orderedRanks
      : orderedRanks.filter(rank => String(rank) !== String(normTrumpRank));
    return 985 + ordinaryTrumpRanks.indexOf(card.rank);
  }

  // 主花色的牌 - 需要连续排列在副花色级牌之下
  // 主牌顺序: 大王(1000) > 小王(999) > 主级牌(998) > 副级牌(997) > 主A(996) > 主K(995) > ... > 主2(984)
  if (card.suit === trumpSuit) {
    if (dayNightOrderedRanks) {
      return 985 + dayNightOrderedRanks.indexOf(card.rank);
    }
    const baseOrderedRanks = usesExtendedRanks
      ? EXTENDED_ORDINARY_RANKS.filter(rank => rank !== Ranks.FIFTEEN)
      : ORDINARY_RANKS;
    const orderedRanks = reverseRankOrder
      ? [...ORDINARY_RANKS].reverse()
      : baseOrderedRanks;
    const ordinaryTrumpRanks = isUnarmed
      ? orderedRanks
      : orderedRanks.filter(rank => String(rank) !== String(normTrumpRank));
    const lowestTrumpStrength = 997 - ordinaryTrumpRanks.length
      - (isThreeSixNineGradesRule(activeRule) && activeRule?.inferiorSuit ? 1 : 0);
    return lowestTrumpStrength + ordinaryTrumpRanks.indexOf(card.rank);
  }

  // 副牌
  if (dayNightOrderedRanks) {
    return 2 + dayNightOrderedRanks.indexOf(card.rank);
  }
  return reverseRankOrder ? 16 - baseValue : baseValue;
}

/**
 * 获取副牌在同花色内的比较值
 * @param {Object} card - 牌
 * @param {String} trumpRank - 级牌
 * @returns {Number}
 */
function getNonTrumpRankValue(card, trumpRank) {
  const normTrumpRank = normalizeRank(trumpRank);
  // 副牌不包含级牌
  if (String(card.rank) === String(normTrumpRank)) {
    return -1; // 级牌不参与副牌比较
  }
  return RANK_ORDER[card.rank] || 0;
}

function areStrengthsConsecutive(currentStrength, nextStrength, trumpSuit, trumpRank, activeRule) {
  return arePairsConsecutive(
    { strength: currentStrength },
    { strength: nextStrength },
    trumpSuit,
    trumpRank,
    activeRule
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
      trumpRank,
      activeRule
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
          trumpRank,
          activeRule
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
 * @param {Array} cards - 要检测的牌
 * @param {String} trumpSuit - 主花色
 * @param {String} trumpRank - 级牌
 * @returns {Object} { type, suit, strength, length }
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

  // 获取所有牌的有效花色
  const effectiveSuits = cards.map(c => getEffectiveSuit(c, trumpSuit, trumpRank));
  const uniqueSuits = [...new Set(effectiveSuits)];

  // 所有牌必须是同一花色
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

  // 单牌
  if (count === 1) {
    return {
      type: PatternTypes.SINGLE,
      suit,
      strength: getCardStrength(cards[0], trumpSuit, trumpRank, activeRule),
      length: 1
    };
  }

  // 对子
  if (count === 2) {
    if (canCardsFormPair(cards[0], cards[1], activeRule)) {
      return {
        type: PatternTypes.PAIR,
        suit,
        strength: getCardStrength(cards[0], trumpSuit, trumpRank, activeRule),
        length: 2
      };
    }
    // 大小王对子
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

  // 拖拉机检测（4张及以上，必须是偶数）
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
 * 检测是否是拖拉机
 * @param {Array} cards - 牌
 * @param {String} trumpSuit - 主花色
 * @param {String} trumpRank - 级牌
 * @returns {Object} { valid, strength, pairs }
 */
function detectTractor(cards, trumpSuit, trumpRank, activeRule) {
  // 按强度分组成对子
  const pairs = [];
  const cardsCopy = [...cards];

  while (cardsCopy.length >= 2) {
    const card1 = cardsCopy.shift();
    const pairIndex = cardsCopy.findIndex(c => canCardsFormPair(card1, c, activeRule));

    if (pairIndex === -1) {
      // 找不到配对
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

  // 按强度排序
  pairs.sort((a, b) => a.strength - b.strength);

  // 检查是否连续
  const effectiveSuit = getEffectiveSuit(cards[0], trumpSuit, trumpRank);

  if (effectiveSuit === 'trump') {
    // 主牌拖拉机需要特殊处理
    return checkTrumpTractor(pairs, trumpSuit, trumpRank, activeRule);
  } else {
    // 副牌拖拉机
    return checkNonTrumpTractor(pairs, trumpRank, activeRule);
  }
}

/**
 * 检查主牌拖拉机
 */
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

/**
 * 检查副牌拖拉机
 */
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

/**
 * 判断两个对子在当前主牌规则下是否严格相邻。
 * - 副牌序列会跳过级牌；
 * - 有主局的主牌强度已经压缩为连续序列；
 * - 无主局所有级牌同级，并且任意一对级牌都与小王相邻。
 */
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
  const normalTrumpRankValue = RANK_ORDER[normalizeRank(trumpRank)] || 0;
  const trumpRankValue = isReverseRankOrderRule(activeRule)
    ? 16 - normalTrumpRankValue
    : normalTrumpRankValue;
  return diff === 2 && current.strength + 1 === trumpRankValue;
}

/**
 * 比较两组牌的大小
 * @param {Object} play1 - 第一组牌 { cards, pattern, playerIndex }
 * @param {Object} play2 - 第二组牌 { cards, pattern, playerIndex }
 * @param {String} leadingSuit - 首发花色
 * @param {String} trumpSuit - 主花色
 * @param {String} trumpRank - 级牌
 * @returns {Number} 1表示play1大，-1表示play2大，0表示相等
 */
export function compareCards(play1, play2, leadingSuit, trumpSuit, trumpRank, activeRule = null) {
  const pattern1 = play1.pattern;
  const pattern2 = play2.pattern;

  if (leadingSuit === TAI_CHI_SUIT) {
    const taiChi1 = pattern1.type === PatternTypes.TAI_CHI_FOUR_SYMBOLS;
    const taiChi2 = pattern2.type === PatternTypes.TAI_CHI_FOUR_SYMBOLS;
    const trumped1 = Boolean(pattern1.canTrumpTaiChi);
    const trumped2 = Boolean(pattern2.canTrumpTaiChi);

    if (trumped1 || trumped2) {
      if (trumped1 && !trumped2) return 1;
      if (!trumped1 && trumped2) return -1;
      if (pattern1.strength > pattern2.strength) return 1;
      if (pattern1.strength < pattern2.strength) return -1;
      return 0;
    }
    if (taiChi1 && taiChi2) {
      if (pattern1.strength > pattern2.strength) return 1;
      if (pattern1.strength < pattern2.strength) return -1;
      return 0;
    }
    if (taiChi1 && !taiChi2) return 1;
    if (!taiChi1 && taiChi2) return -1;
    return 0;
  }

  const straightFlush1 = pattern1.type === PatternTypes.STRAIGHT_FLUSH;
  const straightFlush2 = pattern2.type === PatternTypes.STRAIGHT_FLUSH;
  if (straightFlush1 !== straightFlush2) {
    return straightFlush1 ? 0 : -1;
  }

  const beltAndRoad1 = pattern1.type === PatternTypes.BELT_AND_ROAD;
  const beltAndRoad2 = pattern2.type === PatternTypes.BELT_AND_ROAD;
  if (beltAndRoad1 !== beltAndRoad2) {
    // 当前最大牌型与挑战牌型结构不一致时，后出者不能改变胜者。
    return beltAndRoad1 ? 0 : -1;
  }
  if (beltAndRoad1 && beltAndRoad2) {
    const isTrump1 = pattern1.suit === 'trump';
    const isTrump2 = pattern2.suit === 'trump';
    if (isTrump1 && !isTrump2) return 1;
    if (!isTrump1 && isTrump2) return -1;

    if (!isTrump1 && !isTrump2) {
      const isLeading1 = pattern1.suit === leadingSuit;
      const isLeading2 = pattern2.suit === leadingSuit;
      if (isLeading1 && !isLeading2) return 1;
      if (!isLeading1 && isLeading2) return -1;
      if (!isLeading1 && !isLeading2) return 0;
    }

    const strengths1 = pattern1.strengths || [];
    const strengths2 = pattern2.strengths || [];
    for (let index = 0; index < 2; index += 1) {
      if (strengths1[index] > strengths2[index]) return 1;
      if (strengths1[index] < strengths2[index]) return -1;
    }
    return 0;
  }

  // 无效牌型最小
  if (pattern1.type === PatternTypes.INVALID) return -1;
  if (pattern2.type === PatternTypes.INVALID) return 1;

  // 如果是甩牌，使用特殊的比较逻辑
  if (pattern1.type === PatternTypes.THROW || pattern2.type === PatternTypes.THROW) {
    return compareThrowCards(play1, play2, leadingSuit, trumpSuit, trumpRank, activeRule);
  }

  // 主牌大于副牌
  const isTrump1 = pattern1.suit === 'trump';
  const isTrump2 = pattern2.suit === 'trump';
  const threeSixNineTier1 = getThreeSixNineSuitTier(pattern1.suit, activeRule);
  const threeSixNineTier2 = getThreeSixNineSuitTier(pattern2.suit, activeRule);
  const isInferiorLead = isThreeSixNineGradesRule(activeRule)
    && leadingSuit === activeRule?.inferiorSuit;

  if (
    isInferiorLead
    && threeSixNineTier1 !== null
    && threeSixNineTier2 !== null
    && threeSixNineTier1 !== threeSixNineTier2
  ) {
    return threeSixNineTier1 > threeSixNineTier2 ? 1 : -1;
  }

  if (isTrump1 && !isTrump2) return 1;
  if (!isTrump1 && isTrump2) return -1;

  // 都是副牌时，只有同花色才能比较
  if (!isTrump1 && !isTrump2) {
    const bothOrdinaryRuffInferior = isInferiorLead
      && threeSixNineTier1 === 1
      && threeSixNineTier2 === 1;
    if (bothOrdinaryRuffInferior) {
      // 不同普通副花色彼此不可比较；同一花色继续按牌型与点数比较。
      if (pattern1.suit !== pattern2.suit) return 0;
    } else {
      // 首发花色优先
      const isLeading1 = pattern1.suit === leadingSuit;
      const isLeading2 = pattern2.suit === leadingSuit;

      if (isLeading1 && !isLeading2) return 1;
      if (!isLeading1 && isLeading2) return -1;

      // 都不是首发花色，无法比较大小
      if (!isLeading1 && !isLeading2) {
        return 0; // 先出的大
      }
    }
  }

  // 同花色比较
  // 拖拉机 > 对子 > 单牌
  const typeOrder = {
    [PatternTypes.TRACTOR]: 3,
    [PatternTypes.PAIR]: 2,
    [PatternTypes.SINGLE]: 1
  };

  // 同牌型比较强度
  if (pattern1.type === pattern2.type) {
    if (pattern1.strength > pattern2.strength) return 1;
    if (pattern1.strength < pattern2.strength) return -1;
    return 0; // 相同强度，先出的大
  }

  // 不同牌型，拖拉机可以压对子/单牌，但必须是同花色且牌型匹配首发
  // 实际规则中，跟牌必须保持牌型一致，所以这里返回0让先出的大
  return 0;
}

/**
 * 「尊老爱幼」和「力争上游」共用的整轮全序。
 * 同首家牌型时沿用正常牌力；牌型不一致时，先比首花色张数和结构贴合度，
 * 最后才从各自最小的牌开始按字典序比较。
 * 返回 1 表示 play1 更大，-1 表示 play1 更小，0 表示完全相同。
 */
export function compareCardsForRespectElders(
  play1,
  play2,
  leadingPlay,
  trumpSuit,
  trumpRank,
  activeRule = null
) {
  const leadingSuit = leadingPlay.pattern.suit;
  const category1 = getRespectPlayCategory(
    play1,
    leadingPlay,
    leadingSuit,
    trumpSuit,
    trumpRank,
    activeRule
  );
  const category2 = getRespectPlayCategory(
    play2,
    leadingPlay,
    leadingSuit,
    trumpSuit,
    trumpRank,
    activeRule
  );

  if (category1.matchesLeadingPattern !== category2.matchesLeadingPattern) {
    return category1.matchesLeadingPattern ? 1 : -1;
  }

  // 能与首家正常比大小的同牌型跟牌（包括完整毙牌）直接沿用常规牌力。
  if (category1.matchesLeadingPattern && category2.matchesLeadingPattern) {
    return compareCards(
      play1,
      play2,
      leadingSuit,
      trumpSuit,
      trumpRank,
      activeRule
    );
  }

  // 牌型不一致时，离开首家花色的牌越多越小；主牌同样计作异花色。
  if (category1.offSuitCount !== category2.offSuitCount) {
    return category1.offSuitCount < category2.offSuitCount ? 1 : -1;
  }

  // 四张都跟首花色时，两个散对 > 一个对子加两张单牌 > 四张单牌。
  // 若首家是更长的拖拉机，还会先比能跟出的最长连对。
  if (category1.offSuitCount === 0) {
    const structureComparison = compareRespectStructureProfiles(
      category1.structureProfile,
      category2.structureProfile
    );
    if (structureComparison !== 0) return structureComparison;
  }

  return compareRespectLexicographically(
    play1.cards,
    play2.cards,
    trumpSuit,
    trumpRank,
    activeRule
  );
}

/** 由大到小排列一轮的四手牌；完全相同时保持先出者在前。 */
export function rankRoundPlaysByRespectOrder(
  plays,
  trumpSuit,
  trumpRank,
  activeRule = null
) {
  if (!Array.isArray(plays) || plays.length === 0) return [];
  const leadingPlay = plays[0];
  const originalPosition = new Map(plays.map((play, index) => [play, index]));
  return [...plays].sort((play1, play2) => {
    const comparison = compareCardsForRespectElders(
      play1,
      play2,
      leadingPlay,
      trumpSuit,
      trumpRank,
      activeRule
    );
    if (comparison !== 0) return -comparison;
    return originalPosition.get(play1) - originalPosition.get(play2);
  });
}

/**
 * 在完整一轮的出牌记录中寻找最小者。完全同点数时后出者更小。
 */
export function findSmallestPlayForRespectElders(
  plays,
  trumpSuit,
  trumpRank,
  activeRule = null
) {
  if (!Array.isArray(plays) || plays.length === 0) return null;
  return rankRoundPlaysByRespectOrder(
    plays,
    trumpSuit,
    trumpRank,
    activeRule
  ).at(-1) || null;
}

function getRespectPlayCategory(
  play,
  leadingPlay,
  leadingSuit,
  trumpSuit,
  trumpRank,
  activeRule
) {
  const matchesLeadingPattern = haveSameRespectPattern(
    play,
    leadingPlay,
    trumpSuit,
    trumpRank,
    activeRule
  );
  const comparisonCards = Array.isArray(play.cards) ? play.cards : [];
  const leadingSuitCardCount = comparisonCards.filter(card =>
      getEffectiveSuit(card, trumpSuit, trumpRank) === leadingSuit
    ).length;
  const isComparableSuit = play.pattern?.suit === leadingSuit
    || (leadingSuit !== 'trump' && play.pattern?.suit === 'trump');

  return {
    matchesLeadingPattern: matchesLeadingPattern && isComparableSuit,
    offSuitCount: comparisonCards.length - leadingSuitCardCount,
    structureProfile: getRespectStructureProfile(
      comparisonCards,
      leadingPlay.cards || [],
      trumpSuit,
      trumpRank,
      activeRule
    )
  };
}

function haveSameRespectPattern(play, leadingPlay, trumpSuit, trumpRank, activeRule) {
  if (play.pattern?.type !== leadingPlay.pattern?.type) return false;
  if ((play.cards?.length || 0) !== (leadingPlay.cards?.length || 0)) return false;

  if (leadingPlay.pattern?.type === PatternTypes.THROW) {
    return haveSameThrowStructure(
      getThrowComponents(play, trumpSuit, trumpRank, activeRule),
      getThrowComponents(leadingPlay, trumpSuit, trumpRank, activeRule)
    );
  }
  return true;
}

function getRespectStructureProfile(cards, leadingCards, trumpSuit, trumpRank, activeRule) {
  const leadingPairs = findPairsInCards(leadingCards, trumpSuit, trumpRank, activeRule);
  const playedPairs = findPairsInCards(cards, trumpSuit, trumpRank, activeRule);
  const requiredLongestTractor = getLongestTractorPairCount(
    leadingPairs,
    leadingPairs.length,
    trumpSuit,
    trumpRank,
    activeRule
  );
  const playedLongestTractor = getLongestTractorPairCount(
    playedPairs,
    playedPairs.length,
    trumpSuit,
    trumpRank,
    activeRule
  );

  return [
    Math.min(playedLongestTractor, requiredLongestTractor),
    Math.min(playedPairs.length, leadingPairs.length)
  ];
}

function compareRespectStructureProfiles(profile1, profile2) {
  const length = Math.max(profile1?.length || 0, profile2?.length || 0);
  for (let index = 0; index < length; index += 1) {
    const value1 = profile1?.[index] || 0;
    const value2 = profile2?.[index] || 0;
    if (value1 > value2) return 1;
    if (value1 < value2) return -1;
  }
  return 0;
}

function compareRespectLexicographically(
  cards1,
  cards2,
  trumpSuit,
  trumpRank,
  activeRule
) {
  const strengths1 = (cards1 || [])
    .map(card => getCardStrength(card, trumpSuit, trumpRank, activeRule))
    .sort((a, b) => a - b);
  const strengths2 = (cards2 || [])
    .map(card => getCardStrength(card, trumpSuit, trumpRank, activeRule))
    .sort((a, b) => a - b);
  const length = Math.max(strengths1.length, strengths2.length);

  for (let index = 0; index < length; index += 1) {
    const strength1 = strengths1[index] ?? Number.NEGATIVE_INFINITY;
    const strength2 = strengths2[index] ?? Number.NEGATIVE_INFINITY;
    if (strength1 > strength2) return 1;
    if (strength1 < strength2) return -1;
  }
  return 0;
}

/**
 * 比较甩牌的大小
 * @param {Object} play1 - 第一组牌
 * @param {Object} play2 - 第二组牌
 * @param {String} leadingSuit - 首发花色
 * @param {String} trumpSuit - 主花色
 * @param {String} trumpRank - 级牌
 * @returns {Number} 1表示play1大，-1表示play2大，0表示相等
 */
function compareThrowCards(play1, play2, leadingSuit, trumpSuit, trumpRank, activeRule) {
  const pattern1 = play1.pattern;
  const pattern2 = play2.pattern;

  // 主牌大于副牌
  const isTrump1 = pattern1.suit === 'trump';
  const isTrump2 = pattern2.suit === 'trump';
  const threeSixNineTier1 = getThreeSixNineSuitTier(pattern1.suit, activeRule);
  const threeSixNineTier2 = getThreeSixNineSuitTier(pattern2.suit, activeRule);
  const isInferiorLead = isThreeSixNineGradesRule(activeRule)
    && leadingSuit === activeRule?.inferiorSuit;

  // 普通副牌毙劣牌时沿用主牌毙副牌的甩牌结构要求。
  if (
    isInferiorLead
    && threeSixNineTier1 !== null
    && threeSixNineTier2 !== null
    && threeSixNineTier1 !== threeSixNineTier2
    && Math.max(threeSixNineTier1, threeSixNineTier2) === 1
  ) {
    const firstIsHigher = threeSixNineTier1 > threeSixNineTier2;
    const higherPlay = firstIsHigher ? play1 : play2;
    const lowerPlay = firstIsHigher ? play2 : play1;
    const higherComponents = higherPlay.pattern.components
      || parseThrowCombination(
        higherPlay.cards,
        trumpSuit,
        trumpRank,
        activeRule
      ).components
      || [];
    const lowerComponents = lowerPlay.pattern.components
      || parseThrowCombination(
        lowerPlay.cards,
        trumpSuit,
        trumpRank,
        activeRule
      ).components
      || [];
    if (!canTrumpThrow(higherComponents, lowerComponents)) {
      return firstIsHigher ? -1 : 1;
    }
    return firstIsHigher ? 1 : -1;
  }

  if (isTrump1 && !isTrump2) {
    // play1是主牌，play2是副牌
    // 主牌必须匹配相同的牌型组合才能毙掉
    if (pattern2.type === PatternTypes.THROW && pattern2.components) {
      // 获取主牌的组件（如果不是THROW类型，先解析为组件）
      let trumpComponents = pattern1.components;
      if (!trumpComponents) {
        const parsed = parseThrowCombination(play1.cards, trumpSuit, trumpRank, activeRule);
        trumpComponents = parsed.components || [];
      }

      // 检查主牌是否匹配了副牌的牌型组合（支持向下兼容）
      if (canTrumpThrow(trumpComponents, pattern2.components)) {
        return 1; // 主牌毙掉副牌
      } else {
        return -1; // 主牌牌型不匹配，无法毙掉
      }
    }
    return 1; // 主牌大于副牌
  }

  if (!isTrump1 && isTrump2) {
    // play2是主牌，play1是副牌
    if (pattern1.type === PatternTypes.THROW && pattern1.components) {
      // 获取主牌的组件（如果不是THROW类型，先解析为组件）
      let trumpComponents = pattern2.components;
      if (!trumpComponents) {
        const parsed = parseThrowCombination(play2.cards, trumpSuit, trumpRank, activeRule);
        trumpComponents = parsed.components || [];
      }

      // 检查主牌是否匹配了副牌的牌型组合（支持向下兼容）
      if (canTrumpThrow(trumpComponents, pattern1.components)) {
        return -1; // 主牌毙掉副牌
      } else {
        return 1; // 主牌牌型不匹配，无法毙掉
      }
    }
    return -1; // 主牌大于副牌
  }

  // 都是副牌时，只有同花色才能比较
  if (!isTrump1 && !isTrump2) {
    const bothOrdinaryRuffInferior = isInferiorLead
      && threeSixNineTier1 === 1
      && threeSixNineTier2 === 1;
    if (bothOrdinaryRuffInferior) {
      if (pattern1.suit !== pattern2.suit) return 0;
    } else {
      const isLeading1 = pattern1.suit === leadingSuit;
      const isLeading2 = pattern2.suit === leadingSuit;

      if (isLeading1 && !isLeading2) return 1;
      if (!isLeading1 && isLeading2) return -1;

      // 都不是首发花色
      if (!isLeading1 && !isLeading2) {
        return 0; // 先出的大
      }
    }
  }

  // 同花色比较（都是主牌或都是同一副牌花色）。
  // 甩牌只能由相同的组件结构互相比较：一对不能被当作两个散牌，
  // 否则“对10”会因为拥有对子组件而错误压过“A、K”两个单牌。
  // 主牌毙副牌是否允许拆分，仍由上面的 canTrumpThrow 单独处理。
  const components1 = getThrowComponents(play1, trumpSuit, trumpRank, activeRule);
  const components2 = getThrowComponents(play2, trumpSuit, trumpRank, activeRule);
  if (!haveSameThrowStructure(components1, components2)) {
    return 0;
  }

  // 按类型分组组件
  const grouped1 = groupComponentsByType(components1);
  const grouped2 = groupComponentsByType(components2);

  // 依次比较拖拉机、对子、单牌
  for (const type of [PatternTypes.TRACTOR, PatternTypes.PAIR, PatternTypes.SINGLE]) {
    const comps1 = grouped1[type] || [];
    const comps2 = grouped2[type] || [];

    // 比较该类型的最大强度
    if (comps1.length > 0 && comps2.length > 0) {
      const max1 = Math.max(...comps1.map(c => c.strength));
      const max2 = Math.max(...comps2.map(c => c.strength));

      if (max1 > max2) return 1;
      if (max1 < max2) return -1;
    } else if (comps1.length > 0) {
      return 1;
    } else if (comps2.length > 0) {
      return -1;
    }
  }

  return 0; // 完全相同，先出的大
}

function getThrowComponents(play, trumpSuit, trumpRank, activeRule) {
  if (Array.isArray(play.pattern?.components) && play.pattern.components.length > 0) {
    return play.pattern.components;
  }

  const parsed = parseThrowCombination(play.cards, trumpSuit, trumpRank, activeRule);
  return parsed.valid ? parsed.components : [];
}

function haveSameThrowStructure(components1, components2) {
  if (components1.length !== components2.length) return false;

  const signature = components => components
    .map(component => `${component.type}:${component.length ?? component.cards?.length ?? 0}`)
    .sort();
  const signature1 = signature(components1);
  const signature2 = signature(components2);
  return signature1.every((value, index) => value === signature2[index]);
}

const ENDURING_PATTERN_TYPES = new Set([
  PatternTypes.SINGLE,
  PatternTypes.PAIR,
  PatternTypes.TRACTOR,
  PatternTypes.THROW
]);

function clonePatternForComparison(pattern) {
  if (!pattern) return null;
  return {
    ...pattern,
    ...(Array.isArray(pattern.strengths) ? { strengths: [...pattern.strengths] } : {}),
    ...(Array.isArray(pattern.pairs)
      ? { pairs: pattern.pairs.map(pair => ({ ...pair })) }
      : {}),
    ...(Array.isArray(pattern.components)
      ? {
          components: pattern.components.map(component => ({
            ...component,
            cards: Array.isArray(component.cards) ? [...component.cards] : component.cards
          }))
        }
      : {})
  };
}

function getEnduringComponentKey(component) {
  return `${component.type}:${component.length ?? component.cards?.length ?? 0}`;
}

function groupEnduringComponentsWithIndexes(components) {
  const grouped = new Map();
  components.forEach((component, index) => {
    const key = getEnduringComponentKey(component);
    const entries = grouped.get(key) || [];
    entries.push({ component, index });
    grouped.set(key, entries);
  });
  for (const entries of grouped.values()) {
    entries.sort((left, right) => left.component.strength - right.component.strength);
  }
  return grouped;
}

/**
 * “经久不衰”只生成一份用于比大小的牌力副本。
 * 实际牌面、跟牌义务、得分与扣底倍数均仍使用 currentPlay.pattern。
 */
export function resolveEnduringComparison(currentPlay, previousPlay, trumpSuit, trumpRank, activeRule = null) {
  const currentPattern = currentPlay?.pattern;
  const previousPattern = previousPlay?.pattern;
  const unchanged = {
    inherited: false,
    comparisonPattern: currentPattern
  };

  if (
    !currentPattern
    || !previousPattern
    || !ENDURING_PATTERN_TYPES.has(currentPattern.type)
    || currentPattern.type !== previousPattern.type
    || currentPattern.suit !== previousPattern.suit
    || (currentPattern.length ?? currentPlay?.cards?.length ?? 0)
      !== (previousPattern.length ?? previousPlay?.cards?.length ?? 0)
  ) {
    return unchanged;
  }

  const previousComparisonPattern = previousPlay.comparisonPattern || previousPattern;
  let comparisonPattern = clonePatternForComparison(currentPattern);
  let inheritedComponentCount = 0;

  if (currentPattern.type === PatternTypes.THROW) {
    const currentComponents = getThrowComponents(
      currentPlay,
      trumpSuit,
      trumpRank,
      activeRule
    );
    const previousStructureComponents = getThrowComponents(
      { ...previousPlay, pattern: previousPattern },
      trumpSuit,
      trumpRank,
      activeRule
    );
    const previousComparisonComponents = getThrowComponents(
      { ...previousPlay, pattern: previousComparisonPattern },
      trumpSuit,
      trumpRank,
      activeRule
    );
    if (
      !haveSameThrowStructure(currentComponents, previousStructureComponents)
      || !haveSameThrowStructure(currentComponents, previousComparisonComponents)
    ) {
      return unchanged;
    }

    comparisonPattern.components = currentComponents.map(component => ({
      ...component,
      cards: Array.isArray(component.cards) ? [...component.cards] : component.cards
    }));
    const currentGroups = groupEnduringComponentsWithIndexes(comparisonPattern.components);
    const previousGroups = groupEnduringComponentsWithIndexes(previousComparisonComponents);
    for (const [key, currentEntries] of currentGroups.entries()) {
      const previousEntries = previousGroups.get(key) || [];
      currentEntries.forEach((entry, index) => {
        const previousStrength = previousEntries[index]?.component?.strength;
        if (Number.isFinite(previousStrength) && previousStrength > entry.component.strength) {
          comparisonPattern.components[entry.index].strength = previousStrength;
          inheritedComponentCount += 1;
        }
      });
    }
    comparisonPattern.strength = Math.max(
      ...comparisonPattern.components.map(component => component.strength)
    );
  } else {
    const currentStrength = Number(currentPattern.strength);
    const previousStrength = Number(previousComparisonPattern.strength);
    if (Number.isFinite(previousStrength) && previousStrength > currentStrength) {
      comparisonPattern.strength = previousStrength;
      inheritedComponentCount = 1;
    }
  }

  if (inheritedComponentCount === 0) return unchanged;

  return {
    inherited: true,
    comparisonPattern,
    sourceCards: previousPlay.displaySourceCards || previousPlay.cards || [],
    sourcePattern: previousComparisonPattern,
    inheritedComponentCount
  };
}

/**
 * 检查主牌是否能毙掉副牌甩牌（支持向下兼容）
 * 规则：
 * - 对子可以向下兼容为2张单牌
 * - 拖拉机可以向下兼容为对子或单牌
 * - 长拖拉机可以向下兼容为短拖拉机+对子/单牌
 *
 * @param {Array} trumpComponents - 主牌的组件
 * @param {Array} sideComponents - 副牌的组件
 * @returns {Boolean}
 */
function canTrumpThrow(trumpComponents, sideComponents) {
  // 按类型分组
  const trumpGrouped = groupComponentsByType(trumpComponents);
  const sideGrouped = groupComponentsByType(sideComponents);

  // 统计副牌需要的各种牌型
  const sideRequirements = {
    tractors: {}, // { length: count }
    pairs: (sideGrouped[PatternTypes.PAIR] || []).length,
    singles: (sideGrouped[PatternTypes.SINGLE] || []).length
  };

  // 统计副牌的拖拉机（按长度）
  for (const comp of (sideGrouped[PatternTypes.TRACTOR] || [])) {
    const len = comp.length;
    sideRequirements.tractors[len] = (sideRequirements.tractors[len] || 0) + 1;
  }

  // 统计主牌资源（可以被拆分使用）
  const trumpResources = {
    tractors: [], // 数组，每个元素是 { length, count }
    pairs: (trumpGrouped[PatternTypes.PAIR] || []).length,
    singles: (trumpGrouped[PatternTypes.SINGLE] || []).length
  };

  // 统计主牌的拖拉机（按长度从大到小排序）
  const trumpTractorLengths = {};
  for (const comp of (trumpGrouped[PatternTypes.TRACTOR] || [])) {
    const len = comp.length;
    trumpTractorLengths[len] = (trumpTractorLengths[len] || 0) + 1;
  }
  trumpResources.tractors = Object.entries(trumpTractorLengths)
    .map(([len, count]) => ({ length: parseInt(len), count }))
    .sort((a, b) => b.length - a.length); // 从长到短排序

  // 贪心匹配算法
  // 1. 先匹配拖拉机（长拖拉机可以覆盖短拖拉机）
  const sideTractorsSorted = Object.entries(sideRequirements.tractors)
    .map(([len, count]) => ({ length: parseInt(len), count }))
    .sort((a, b) => b.length - a.length); // 从长到短排序

  for (const sideT of sideTractorsSorted) {
    let needed = sideT.count;
    const requiredLength = sideT.length;

    // 尝试用主牌的拖拉机来匹配（可以用更长的拖拉机）
    for (const trumpT of trumpResources.tractors) {
      if (trumpT.length >= requiredLength && trumpT.count > 0 && needed > 0) {
        const used = Math.min(trumpT.count, needed);
        trumpT.count -= used;
        needed -= used;

        // 如果主牌拖拉机更长，剩余部分转化为对子和单牌
        if (trumpT.length > requiredLength) {
          const extraPairs = (trumpT.length - requiredLength) / 2 * used;
          trumpResources.pairs += extraPairs;
        }
      }
    }

    // 不连续的对子不能拼成拖拉机；毙拖拉机必须有真实主拖拉机。
    if (needed > 0) return false;
  }

  // 2. 将剩余的拖拉机全部转化为对子
  for (const trumpT of trumpResources.tractors) {
    if (trumpT.count > 0) {
      const pairsFromTractor = (trumpT.length / 2) * trumpT.count;
      trumpResources.pairs += pairsFromTractor;
    }
  }

  // 3. 匹配对子
  if (trumpResources.pairs < sideRequirements.pairs) {
    return false;
  }
  const remainingPairs = trumpResources.pairs - sideRequirements.pairs;

  // 4. 将剩余对子转化为单牌
  trumpResources.singles += remainingPairs * 2;

  // 5. 匹配单牌
  if (trumpResources.singles < sideRequirements.singles) {
    return false;
  }

  return true; // 主牌匹配了所有副牌的牌型
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
 * 验证首发出牌是否合法
 * @param {Array} cards - 要出的牌
 * @param {String} trumpSuit - 主花色
 * @param {String} trumpRank - 级牌
 * @returns {Object} { valid, message, pattern }
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
  // 允许甩牌（多种牌型的组合），具体验证在后续流程中处理
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
  if (isSingleStepDebugRule(activeRule) && pattern.type === PatternTypes.INVALID) {
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
 * @param {Array} cards - 要出的牌
 * @param {Array} handCards - 手牌
 * @param {Object} leadingPattern - 首发牌型
 * @param {String} trumpSuit - 主花色
 * @param {String} trumpRank - 级牌
 * @returns {Object} { valid, message, pattern }
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

  // 必须出相同张数
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

  // 如果首发是甩牌，使用特殊的跟牌验证
  if (leadingPattern.type === PatternTypes.THROW) {
    return validateFollowingThrow(
      cards,
      handCards,
      leadingPattern,
      trumpSuit,
      trumpRank,
      activeRule
    );
  }

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

  // 检测出牌的牌型
  const pattern = detectPattern(cards, trumpSuit, trumpRank, patternRuleContext);

  // 检查是否需要匹配牌型
  if (playedSameSuit.length >= leadingPattern.length) {
    // 全部是同花色，需要匹配牌型
    if (!matchPatternRequirement(
      cards,
      handCards,
      leadingPattern,
      trumpSuit,
      trumpRank,
      activeRule
    )) {
      return {
        valid: false,
        message: getPatternMismatchMessage(
          leadingPattern,
          handCards,
          trumpSuit,
          trumpRank,
          activeRule
        ),
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

/**
 * 禁术秘法确认发动后，发动者原本的所有主牌在本局余下时间都按牌面花色、原点数降为副牌。
 * 王没有普通牌面花色，只有在本次出牌中明确转化后才可打出。
 */
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
    if (!sourceCard) {
      return { valid: false, message: '所有已转化的牌都必须包含在本次出牌中' };
    }
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

/**
 * 偷梁换柱：只采用玩家明确提交的王牌转换，不再自动猜测匹配方案。
 * 实体王牌不会被修改；返回的 effectiveCards 只用于牌型与大小判断。
 */
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
    ? validateFollowingPlay(
        effectiveCards,
        effectiveHand,
        leadingPattern,
        trumpSuit,
        trumpRank,
        activeRule
      )
    : validateLeadingPlay(effectiveCards, trumpSuit, trumpRank, activeRule);

  if (submitted.length === 0 && cards.length === 1 && jokers.length === 1) {
    const validation = validate(cards, hand);
    return { ...validation, effectiveCards: cards, effectiveHandCards: hand, usesSkill: false, substitutions: [] };
  }
  if (submitted.length === 0) {
    return { valid: false, message: '请先明确选择至少一张王牌要转换成的牌面' };
  }
  if (new Set(submitted.map(item => item?.cardId)).size !== submitted.length) {
    return { valid: false, message: '同一张王牌不能重复设置转换' };
  }

  const selectedById = new Map(cards.map(card => [card.id, card]));
  const replacementById = new Map();
  for (const substitution of submitted) {
    const sourceCard = selectedById.get(substitution?.cardId);
    if (!sourceCard) return { valid: false, message: '所有已转换的王牌都必须包含在本次出牌中' };
    if (sourceCard.suit !== Suits.JOKER) return { valid: false, message: '偷梁换柱只能转换王牌' };
    if (!SUBSTITUTION_SUITS.includes(substitution.suit)) {
      return { valid: false, message: '偷梁换柱的目标花色无效' };
    }
    if (!SUBSTITUTION_RANKS.includes(substitution.rank)) {
      return { valid: false, message: '偷梁换柱的目标点数无效' };
    }
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
  return validation.valid
    ? { ...validation, effectiveCards, effectiveHandCards, usesSkill: true, substitutions: submitted }
    : { ...validation, effectiveCards, effectiveHandCards, usesSkill: true, substitutions: submitted };
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

/**
 * 聚类分析：采用玩家明确提交的一张或多张牌及各自的相邻目标点数。
 * 转化只存在于本次比较视图，实体手牌及牌的原始分值均不改变。
 */
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
  return {
    ...validation,
    usesSkill: true,
    effectiveCards,
    effectiveHandCards,
    substitutions: normalizedSubstitutions
  };
}

/** 保留单张转换变体供调试使用；甩牌威胁判定使用下方的多张匹配搜索。 */
export function getClusterAnalysisHandVariants(cards, trumpRank) {
  const hand = Array.isArray(cards) ? cards : [];
  const variants = [hand];
  for (const sourceCard of hand) {
    for (const targetRank of getClusterAnalysisTargetRanks(sourceCard, trumpRank)) {
      const transformedCard = createClusterCard(sourceCard, targetRank);
      variants.push(hand.map(card => card.id === sourceCard.id ? transformedCard : card));
    }
  }
  return variants;
}

function getClusterAnalysisCardOptions(card, trumpRank) {
  const options = [
    card,
    ...getClusterAnalysisTargetRanks(card, trumpRank).map(rank => createClusterCard(card, rank))
  ];
  return [...new Map(options.map(option => [
    `${option.suit}:${option.rank}`,
    option
  ])).values()];
}

function getClusterAnalysisPairCandidates(
  cards,
  componentSuit,
  trumpSuit,
  trumpRank,
  activeRule
) {
  const optionSets = cards.map(card => getClusterAnalysisCardOptions(card, trumpRank));
  const candidates = [];
  for (let firstIndex = 0; firstIndex < cards.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < cards.length; secondIndex += 1) {
      for (const firstOption of optionSets[firstIndex]) {
        if (getEffectiveSuit(firstOption, trumpSuit, trumpRank) !== componentSuit) continue;
        for (const secondOption of optionSets[secondIndex]) {
          if (getEffectiveSuit(secondOption, trumpSuit, trumpRank) !== componentSuit) continue;
          const pair = findPairsInCards(
            [firstOption, secondOption],
            trumpSuit,
            trumpRank,
            activeRule
          )[0];
          if (!pair) continue;
          candidates.push({
            ...pair,
            sourceCardIds: [cards[firstIndex].id, cards[secondIndex].id]
          });
        }
      }
    }
  }
  return candidates.sort((left, right) => left.strength - right.strength);
}

function canClusterAnalysisBeatComponent(
  cards,
  component,
  trumpSuit,
  trumpRank,
  activeRule
) {
  const componentSuit = getEffectiveSuit(component.cards[0], trumpSuit, trumpRank);
  if (component.type === PatternTypes.SINGLE) {
    return cards.some(card => getClusterAnalysisCardOptions(card, trumpRank).some(option =>
      getEffectiveSuit(option, trumpSuit, trumpRank) === componentSuit
      && getCardStrength(option, trumpSuit, trumpRank, activeRule) > component.strength
    ));
  }

  const pairCandidates = getClusterAnalysisPairCandidates(
    cards,
    componentSuit,
    trumpSuit,
    trumpRank,
    activeRule
  );
  if (component.type === PatternTypes.PAIR) {
    return pairCandidates.some(pair => pair.strength > component.strength);
  }
  if (component.type !== PatternTypes.TRACTOR) return false;

  const requiredPairs = component.length / 2;
  const search = (chain, usedCardIds) => {
    if (chain.length === requiredPairs) {
      return chain[chain.length - 1].strength > component.strength;
    }
    for (const candidate of pairCandidates) {
      if (candidate.sourceCardIds.some(cardId => usedCardIds.has(cardId))) continue;
      if (chain.length > 0) {
        const previous = chain[chain.length - 1];
        if (candidate.strength <= previous.strength) continue;
        if (!arePairsConsecutive(
          previous,
          candidate,
          trumpSuit,
          trumpRank,
          activeRule
        )) continue;
      }
      const nextUsed = new Set(usedCardIds);
      candidate.sourceCardIds.forEach(cardId => nextUsed.add(cardId));
      if (search([...chain, candidate], nextUsed)) return true;
    }
    return false;
  };
  return search([], new Set());
}

function getForbiddenMagicCardOptions(card, trumpSuit) {
  if (!card?.isForbiddenMagicDemoted) return [card];
  const originalSuit = card.originalSuit || card.suit;
  const originalRank = card.originalRank || card.rank;
  if (originalSuit === Suits.JOKER) {
    return SUBSTITUTION_SUITS
      .filter(suit => !(
        trumpSuit
        && trumpSuit !== Suits.NO_TRUMP
        && suit === trumpSuit
      ))
      .flatMap(suit => SUBSTITUTION_RANKS.map(rank => (
        createForbiddenMagicDemotedCard(card, suit, rank)
      )));
  }
  return SUBSTITUTION_SUITS.map(suit => (
    createForbiddenMagicDemotedCard(card, suit, originalRank)
  ));
}

function getForbiddenMagicPairCandidates(
  cards,
  componentSuit,
  trumpSuit,
  trumpRank,
  activeRule
) {
  const optionSets = cards.map(card => getForbiddenMagicCardOptions(card, trumpSuit));
  const candidates = [];
  for (let firstIndex = 0; firstIndex < cards.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < cards.length; secondIndex += 1) {
      for (const firstOption of optionSets[firstIndex]) {
        if (getEffectiveSuit(firstOption, trumpSuit, trumpRank) !== componentSuit) continue;
        for (const secondOption of optionSets[secondIndex]) {
          if (getEffectiveSuit(secondOption, trumpSuit, trumpRank) !== componentSuit) continue;
          const pair = findPairsInCards(
            [firstOption, secondOption],
            trumpSuit,
            trumpRank,
            activeRule
          )[0];
          if (!pair) continue;
          candidates.push({
            ...pair,
            sourceCardIds: [cards[firstIndex].id, cards[secondIndex].id]
          });
        }
      }
    }
  }
  return candidates.sort((left, right) => left.strength - right.strength);
}

function canForbiddenMagicBeatComponent(
  cards,
  component,
  trumpSuit,
  trumpRank,
  activeRule
) {
  const componentSuit = getEffectiveSuit(component.cards[0], trumpSuit, trumpRank);
  if (component.type === PatternTypes.SINGLE) {
    return cards.some(card => getForbiddenMagicCardOptions(card, trumpSuit).some(option => (
      getEffectiveSuit(option, trumpSuit, trumpRank) === componentSuit
      && getCardStrength(option, trumpSuit, trumpRank, activeRule) > component.strength
    )));
  }

  const pairCandidates = getForbiddenMagicPairCandidates(
    cards,
    componentSuit,
    trumpSuit,
    trumpRank,
    activeRule
  );
  if (component.type === PatternTypes.PAIR) {
    return pairCandidates.some(pair => pair.strength > component.strength);
  }
  if (component.type !== PatternTypes.TRACTOR) return false;

  const requiredPairs = component.length / 2;
  const search = (chain, usedCardIds) => {
    if (chain.length === requiredPairs) {
      return chain[chain.length - 1].strength > component.strength;
    }
    for (const candidate of pairCandidates) {
      if (candidate.sourceCardIds.some(cardId => usedCardIds.has(cardId))) continue;
      if (chain.length > 0) {
        const previous = chain[chain.length - 1];
        if (candidate.strength <= previous.strength) continue;
        if (!arePairsConsecutive(
          previous,
          candidate,
          trumpSuit,
          trumpRank,
          activeRule
        )) continue;
      }
      const nextUsed = new Set(usedCardIds);
      candidate.sourceCardIds.forEach(cardId => nextUsed.add(cardId));
      if (search([...chain, candidate], nextUsed)) return true;
    }
    return false;
  };
  return search([], new Set());
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

/**
 * 检查是否满足牌型匹配要求
 */
function matchPatternRequirement(cards, handCards, leadingPattern, trumpSuit, trumpRank, activeRule) {
  const leadingSuit = leadingPattern.suit;

  // 获取手牌中同花色的牌
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
    // 首发是对子，检查手牌中是否有同花色对子
    const hasPair = findPairsInCards(sameSuitHand, trumpSuit, trumpRank, activeRule).length > 0;
    if (hasPair) {
      // 有对子就必须出对子
      const playedPattern = detectPattern(cards, trumpSuit, trumpRank, activeRule);
      return playedPattern.type === PatternTypes.PAIR;
    }
  }

  if (leadingPattern.type === PatternTypes.TRACTOR) {
    // 首发是拖拉机
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
      // 有拖拉机就必须出拖拉机
      const playedPattern = detectPattern(cards, trumpSuit, trumpRank, activeRule);
      return playedPattern.type === PatternTypes.TRACTOR &&
             playedPattern.length === leadingPattern.length;
    }

    // 没有完整拖拉机时，仍必须优先跟出手中能组成的最长拖拉机，
    // 然后再尽量跟足对子。
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

/**
 * 获取牌型不匹配的错误信息
 */
function getPatternMismatchMessage(leadingPattern, handCards, trumpSuit, trumpRank, activeRule) {
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

/**
 * 在牌组中找出所有对子
 */
function findPairsInCards(cards, trumpSuit, trumpRank, activeRule) {
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

/**
 * 在对子中找拖拉机
 */
function findTractorInPairs(pairs, requiredLength, trumpSuit, trumpRank, activeRule) {
  return getLongestTractorPairCount(
    pairs,
    requiredLength,
    trumpSuit,
    trumpRank,
    activeRule
  ) >= requiredLength;
}

function getLongestTractorPairCount(pairs, maxLength, trumpSuit, trumpRank, activeRule) {
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
 * 统计手牌中指定花色的牌
 */
export function countSuitCards(handCards, suit, trumpSuit, trumpRank) {
  return handCards.filter(c =>
    getEffectiveSuit(c, trumpSuit, trumpRank) === suit
  ).length;
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
    getCardStrength(b, trumpSuit, trumpRank, activeRule) -
      getCardStrength(a, trumpSuit, trumpRank, activeRule)
  );

  // 第一步：找出所有拖拉机
  // 尝试不同长度的拖拉机（从最长开始）
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
          strength: getCardStrength(card1, trumpSuit, trumpRank, activeRule),
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
      strength: getCardStrength(card, trumpSuit, trumpRank, activeRule),
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

const SUITLESS_PATTERN_NAMES = Object.freeze({
  [PatternTypes.SINGLE]: '单牌',
  [PatternTypes.PAIR]: '对子',
  [PatternTypes.TRACTOR]: '拖拉机',
  [PatternTypes.STRAIGHT_FLUSH]: '同花顺',
  [PatternTypes.TAI_CHI_FOUR_SYMBOLS]: '太极四象',
  [PatternTypes.BELT_AND_ROAD]: '一带一路'
});

function normalizeSuitlessComponent(component) {
  return {
    type: component?.type || PatternTypes.SINGLE,
    length: Number(component?.length ?? component?.cards?.length) || 1
  };
}

function decomposeSuitlessPatternCards(cards, trumpSuit, trumpRank, activeRule) {
  const cardsByEffectiveSuit = new Map();
  for (const card of cards || []) {
    const suit = getEffectiveSuit(card, trumpSuit, trumpRank);
    const groupedCards = cardsByEffectiveSuit.get(suit) || [];
    groupedCards.push(card);
    cardsByEffectiveSuit.set(suit, groupedCards);
  }

  const components = [];
  for (const groupedCards of cardsByEffectiveSuit.values()) {
    const parsed = parseThrowCombination(groupedCards, trumpSuit, trumpRank, activeRule);
    if (parsed.valid && parsed.components.length > 0) {
      components.push(...parsed.components.map(normalizeSuitlessComponent));
    } else {
      components.push(...groupedCards.map(() => ({ type: PatternTypes.SINGLE, length: 1 })));
    }
  }
  return components;
}

/**
 * 将一次出牌归一化为忽略花色、点数和牌力的牌型结构。
 * 甩牌与不成标准牌型的跟牌会拆成拖拉机、对子和单牌组件，确保
 * “两个对子”“一对加两单”“四张单牌”不会被误判为同一牌型。
 */
export function getSuitlessPatternProfile(
  play,
  trumpSuit,
  trumpRank,
  activeRule = null
) {
  const cards = play?.cards || [];
  const pattern = play?.pattern || detectPattern(cards, trumpSuit, trumpRank, activeRule);
  const directlyComparableTypes = new Set([
    PatternTypes.SINGLE,
    PatternTypes.PAIR,
    PatternTypes.TRACTOR,
    PatternTypes.STRAIGHT_FLUSH,
    PatternTypes.TAI_CHI_FOUR_SYMBOLS,
    PatternTypes.BELT_AND_ROAD
  ]);

  let components;
  if (directlyComparableTypes.has(pattern?.type)) {
    components = [normalizeSuitlessComponent(pattern)];
  } else if (
    pattern?.type === PatternTypes.THROW
    && Array.isArray(pattern.components)
    && pattern.components.length > 0
  ) {
    components = pattern.components.map(normalizeSuitlessComponent);
  } else {
    components = decomposeSuitlessPatternCards(cards, trumpSuit, trumpRank, activeRule);
  }

  components.sort((left, right) => {
    const leftKey = `${left.type}:${left.length}`;
    const rightKey = `${right.type}:${right.length}`;
    return leftKey.localeCompare(rightKey);
  });
  const key = components.map(component => `${component.type}:${component.length}`).join('|');
  const groupedLabels = new Map();
  for (const component of components) {
    const componentKey = `${component.type}:${component.length}`;
    const baseName = SUITLESS_PATTERN_NAMES[component.type] || '单牌';
    const label = component.type === PatternTypes.TRACTOR
      ? `${component.length}张${baseName}`
      : baseName;
    const group = groupedLabels.get(componentKey) || { label, count: 0 };
    group.count += 1;
    groupedLabels.set(componentKey, group);
  }

  return {
    key,
    label: Array.from(groupedLabels.values())
      .map(group => group.count > 1 ? `${group.label}×${group.count}` : group.label)
      .join('＋') || '无牌型',
    components
  };
}

/**
 * 检查某个组件是否是最大的（其他玩家手牌中没有能压过它的牌）
 * @param {Object} component - 组件 { type, cards, strength, length }
 * @param {Array} otherPlayersCards - 其他玩家的手牌数组（数组的数组）
 * @param {String} trumpSuit - 主花色
 * @param {String} trumpRank - 级牌
 * @returns {Boolean} true表示是最大的，false表示不是
 */
export function isComponentLargest(
  component,
  otherPlayersCards,
  trumpSuit,
  trumpRank,
  activeRule = null
) {
  const componentSuit = getEffectiveSuit(component.cards[0], trumpSuit, trumpRank);
  const handsToCheck = otherPlayersCards;

  // 遍历所有其他玩家
  for (const playerCards of handsToCheck) {
    if (
      activeRule?.id === 'cluster_analysis'
      && canClusterAnalysisBeatComponent(
        playerCards,
        component,
        trumpSuit,
        trumpRank,
        activeRule
      )
    ) {
      return false;
    }
    if (activeRule?.id === 'cluster_analysis') continue;
    if (
      activeRule?.id === 'forbidden_magic'
      && playerCards.some(card => card?.isForbiddenMagicDemoted)
    ) {
      if (canForbiddenMagicBeatComponent(
        playerCards,
        component,
        trumpSuit,
        trumpRank,
        activeRule
      )) {
        return false;
      }
      continue;
    }

    // 获取该玩家同花色的牌
    const sameSuitCards = playerCards.filter(c =>
      getEffectiveSuit(c, trumpSuit, trumpRank) === componentSuit
    );

    if (sameSuitCards.length === 0) continue;

    // 检查是否有更大的牌型
    if (component.type === PatternTypes.SINGLE) {
      // 单牌：检查是否有更大的单牌
      for (const card of sameSuitCards) {
        if (getCardStrength(card, trumpSuit, trumpRank, activeRule) > component.strength) {
          return false; // 有更大的单牌
        }
      }
    } else if (component.type === PatternTypes.PAIR) {
      // 对子：检查是否有更大的对子
      const pairs = findPairsInCards(sameSuitCards, trumpSuit, trumpRank, activeRule);
      for (const pair of pairs) {
        if (pair.strength > component.strength) {
          return false; // 有更大的对子
        }
      }
    } else if (component.type === PatternTypes.TRACTOR) {
      // 拖拉机：检查是否有更大的同长度拖拉机
      const requiredPairs = component.length / 2;

      // 找出所有可能的拖拉机组合
      if (hasLargerTractor(
        sameSuitCards,
        requiredPairs,
        component.strength,
        trumpSuit,
        trumpRank,
        activeRule
      )) {
        return false; // 有更大的拖拉机
      }
    }
  }

  return true; // 没有更大的牌
}

/**
 * 检查是否有更大的拖拉机
 */
function hasLargerTractor(
  cards,
  requiredPairs,
  targetStrength,
  trumpSuit,
  trumpRank,
  activeRule
) {
  // 找出所有对子
  const pairs = findPairsInCards(cards, trumpSuit, trumpRank, activeRule);

  if (pairs.length < requiredPairs) return false;

  // 按强度排序
  const sortedPairs = [...pairs].sort((a, b) => a.strength - b.strength);

  // 尝试找连续的对子组成拖拉机
  for (let i = 0; i <= sortedPairs.length - requiredPairs; i++) {
    const candidatePairs = sortedPairs.slice(i, i + requiredPairs);

    // 检查是否连续
    let isConsecutive = true;
    for (let j = 0; j < candidatePairs.length - 1; j++) {
      if (!arePairsConsecutive(
        candidatePairs[j],
        candidatePairs[j + 1],
        trumpSuit,
        trumpRank,
        activeRule
      )) {
        isConsecutive = false;
        break;
      }
    }

    if (isConsecutive) {
      // 找到一个拖拉机，检查强度
      const tractorStrength = candidatePairs[candidatePairs.length - 1].strength;
      if (tractorStrength > targetStrength) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 验证甩牌是否成功
 * @param {Array} cards - 要甩的牌
 * @param {Array} otherPlayersCards - 其他玩家的手牌数组（数组的数组）
 * @param {String} trumpSuit - 主花色
 * @param {String} trumpRank - 级牌
 * @returns {Object} { success, components, failedComponents, forcedCards }
 */
export function validateThrow(
  cards,
  otherPlayersCards,
  trumpSuit,
  trumpRank,
  activeRule = null
) {
  // 解析甩牌组合
  const parsed = parseThrowCombination(cards, trumpSuit, trumpRank, activeRule);

  if (!parsed.valid) {
    return {
      success: false,
      message: parsed.message || '甩牌解析失败',
      components: [],
      failedComponents: [],
      forcedCards: null
    };
  }

  const { components, suit } = parsed;

  // 检查每个组件是否最大
  const failedComponents = [];

  for (const component of components) {
    if (!isComponentLargest(
      component,
      otherPlayersCards,
      trumpSuit,
      trumpRank,
      activeRule
    )) {
      failedComponents.push(component);
    }
  }

  if (failedComponents.length === 0) {
    // 甩牌成功
    return {
      success: true,
      message: '甩牌成功',
      components,
      suit,
      failedComponents: [],
      forcedCards: null
    };
  } else {
    // 甩牌失败，找出最小的组件强制出小
    const forcedComponent = findSmallestComponent(failedComponents);

    return {
      success: false,
      message: '甩牌失败，强制出小',
      components,
      suit,
      failedComponents,
      forcedCards: forcedComponent.cards
    };
  }
}

/**
 * 找出最小的组件（优先出牌数少的组件）
 * @param {Array} components - 组件数组
 * @returns {Object} 最小的组件
 */
function findSmallestComponent(components) {
  if (components.length === 0) return null;

  // 首先按牌数排序（牌数少的优先）
  // 如果牌数相同，按强度排序（强度小的优先）
  const sorted = [...components].sort((a, b) => {
    if (a.length !== b.length) {
      return a.length - b.length;
    }
    return a.strength - b.strength;
  });

  return sorted[0];
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
    // 按组件类型统计首发的要求
    const leadingRequirements = {
      [PatternTypes.TRACTOR]: [],
      [PatternTypes.PAIR]: [],
      [PatternTypes.SINGLE]: []
    };

    for (const component of leadingComponents) {
      leadingRequirements[component.type].push(component);
    }

    // 验证跟牌是否匹配首发的牌型要求
    const errors = [];
    const availablePairs = findPairsInCards(sameSuitCards, trumpSuit, trumpRank, activeRule);
    const followPairs = findPairsInCards(cards, trumpSuit, trumpRank, activeRule);

    // 有完整拖跟完整拖；没有完整拖时，仍必须优先跟能组成的最长短拖。
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

    // 拖拉机中的对子和独立对子都计入对子义务。
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
