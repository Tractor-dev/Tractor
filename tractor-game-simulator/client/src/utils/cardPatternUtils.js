import { Suits, Ranks, RANK_ORDER } from './constants.js';

/**
 * 牌型类型
 */
export const PatternTypes = {
  SINGLE: 'single',
  PAIR: 'pair',
  TRACTOR: 'tractor',
  THROW: 'throw',
  INVALID: 'invalid'
};

/**
 * 判断一张牌是否是主牌
 */
export function isTrumpCard(card, trumpSuit, trumpRank) {
  if (card.suit === Suits.JOKER) {
    return true;
  }
  if (card.rank === trumpRank) {
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
export function getCardStrength(card, trumpSuit, trumpRank) {
  if (card.rank === Ranks.BIG_JOKER) {
    return 1000;
  }
  if (card.rank === Ranks.SMALL_JOKER) {
    return 999;
  }
  if (card.rank === trumpRank && card.suit === trumpSuit) {
    return 998;
  }
  if (card.rank === trumpRank) {
    return 997;
  }

  let baseValue = RANK_ORDER[card.rank] || 0;

  // 主花色的牌 - 需要连续排列在副花色级牌之下
  if (card.suit === trumpSuit) {
    const trumpRankValue = RANK_ORDER[trumpRank] || 0;
    let position = 14 - baseValue;
    if (baseValue < trumpRankValue) {
      position--;
    }
    return 996 - position;
  }

  return baseValue;
}

/**
 * 检测牌型
 */
export function detectPattern(cards, trumpSuit, trumpRank) {
  if (!cards || cards.length === 0) {
    return { type: PatternTypes.INVALID, suit: null, strength: 0, length: 0 };
  }

  const count = cards.length;
  const effectiveSuits = cards.map(c => getEffectiveSuit(c, trumpSuit, trumpRank));
  const uniqueSuits = [...new Set(effectiveSuits)];

  if (uniqueSuits.length !== 1) {
    return { type: PatternTypes.INVALID, suit: null, strength: 0, length: count };
  }

  const suit = uniqueSuits[0];

  if (count === 1) {
    return {
      type: PatternTypes.SINGLE,
      suit,
      strength: getCardStrength(cards[0], trumpSuit, trumpRank),
      length: 1
    };
  }

  if (count === 2) {
    if (cards[0].rank === cards[1].rank && cards[0].suit === cards[1].suit) {
      return {
        type: PatternTypes.PAIR,
        suit,
        strength: getCardStrength(cards[0], trumpSuit, trumpRank),
        length: 2
      };
    }
    if (cards[0].suit === Suits.JOKER && cards[1].suit === Suits.JOKER &&
        cards[0].rank === cards[1].rank) {
      return {
        type: PatternTypes.PAIR,
        suit,
        strength: getCardStrength(cards[0], trumpSuit, trumpRank),
        length: 2
      };
    }
    return { type: PatternTypes.INVALID, suit: null, strength: 0, length: count };
  }

  if (count >= 4 && count % 2 === 0) {
    const tractorResult = detectTractor(cards, trumpSuit, trumpRank);
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
function detectTractor(cards, trumpSuit, trumpRank) {
  const pairs = [];
  const cardsCopy = [...cards];

  while (cardsCopy.length >= 2) {
    const card1 = cardsCopy.shift();
    const pairIndex = cardsCopy.findIndex(c =>
      c.rank === card1.rank && c.suit === card1.suit
    );

    if (pairIndex === -1) {
      return { valid: false, strength: 0, pairs: [] };
    }

    const card2 = cardsCopy.splice(pairIndex, 1)[0];
    pairs.push({
      rank: card1.rank,
      suit: card1.suit,
      strength: getCardStrength(card1, trumpSuit, trumpRank)
    });
  }

  if (cardsCopy.length > 0) {
    return { valid: false, strength: 0, pairs: [] };
  }

  pairs.sort((a, b) => a.strength - b.strength);

  const effectiveSuit = getEffectiveSuit(cards[0], trumpSuit, trumpRank);

  if (effectiveSuit === 'trump') {
    return checkTrumpTractor(pairs, trumpSuit, trumpRank);
  } else {
    return checkNonTrumpTractor(pairs, trumpRank);
  }
}

function checkTrumpTractor(pairs, trumpSuit, trumpRank) {
  for (let i = 0; i < pairs.length - 1; i++) {
    const current = pairs[i];
    const next = pairs[i + 1];

    // 检查是否无主局
    const isNoTrump = !trumpSuit || trumpSuit === 'no_trump';

    if (next.strength - current.strength !== 1 &&
        !(current.strength === 997 && next.strength === 998) &&
        !(current.strength === 998 && next.strength === 999) &&
        !(current.strength === 999 && next.strength === 1000) &&
        !(current.strength === 997 && next.strength === 999 && isNoTrump)) {  // 仅无主局：级牌(997) -> 小王(999)

      const currentRankValue = RANK_ORDER[current.rank] || 0;
      const nextRankValue = RANK_ORDER[next.rank] || 0;

      if (current.strength < 500 || next.strength < 500) {
        return { valid: false, strength: 0, pairs: [] };
      }

      if (nextRankValue - currentRankValue !== 1) {
        if (RANK_ORDER[trumpRank] === currentRankValue + 1 &&
            nextRankValue === currentRankValue + 2) {
          continue;
        }
        return { valid: false, strength: 0, pairs: [] };
      }
    }
  }

  return {
    valid: true,
    strength: pairs[pairs.length - 1].strength,
    pairs
  };
}

function checkNonTrumpTractor(pairs, trumpRank) {
  for (let i = 0; i < pairs.length - 1; i++) {
    const currentRankValue = RANK_ORDER[pairs[i].rank] || 0;
    const nextRankValue = RANK_ORDER[pairs[i + 1].rank] || 0;

    let expectedNext = currentRankValue + 1;
    if (RANK_ORDER[trumpRank] === expectedNext) {
      expectedNext++;
    }

    if (nextRankValue !== expectedNext) {
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
 * 验证首发出牌是否合法
 */
export function validateLeadingPlay(cards, trumpSuit, trumpRank) {
  if (!cards || cards.length === 0) {
    return { valid: false, message: '请选择要出的牌', pattern: null };
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

  // 同花色的牌就允许出，后端会判断是否是有效的甩牌
  const pattern = detectPattern(cards, trumpSuit, trumpRank);
  return { valid: true, message: '出牌合法', pattern };
}

/**
 * 验证跟牌是否合法
 */
export function validateFollowingPlay(cards, handCards, leadingPattern, trumpSuit, trumpRank) {
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

  // 如果首发是甩牌，使用特殊的跟牌验证（前端实现与后端一致）
  if (leadingPattern.type === PatternTypes.THROW) {
    return validateFollowingThrow(cards, handCards, leadingPattern, trumpSuit, trumpRank);
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

  const pattern = detectPattern(cards, trumpSuit, trumpRank);

  if (playedSameSuit.length >= leadingPattern.length) {
    if (!matchPatternRequirement(cards, handCards, leadingPattern, trumpSuit, trumpRank)) {
      return {
        valid: false,
        message: getPatternMismatchMessage(leadingPattern, handCards, trumpSuit, trumpRank),
        pattern
      };
    }
  }

  return { valid: true, message: '跟牌合法', pattern };
}

function matchPatternRequirement(cards, handCards, leadingPattern, trumpSuit, trumpRank) {
  const leadingSuit = leadingPattern.suit;

  const sameSuitHand = handCards.filter(c =>
    getEffectiveSuit(c, trumpSuit, trumpRank) === leadingSuit
  );

  if (leadingPattern.type === PatternTypes.PAIR) {
    const hasPair = findPairsInCards(sameSuitHand, trumpSuit, trumpRank).length > 0;
    if (hasPair) {
      const playedPattern = detectPattern(cards, trumpSuit, trumpRank);
      return playedPattern.type === PatternTypes.PAIR;
    }
  }

  if (leadingPattern.type === PatternTypes.TRACTOR) {
    const pairs = findPairsInCards(sameSuitHand, trumpSuit, trumpRank);

    const tractorPairs = leadingPattern.length / 2;
    const hasTractor = findTractorInPairs(pairs, tractorPairs, trumpSuit, trumpRank);

    if (hasTractor) {
      const playedPattern = detectPattern(cards, trumpSuit, trumpRank);
      return playedPattern.type === PatternTypes.TRACTOR &&
             playedPattern.length === leadingPattern.length;
    }

    if (pairs.length > 0) {
      const playedPairs = findPairsInCards(cards, trumpSuit, trumpRank);
      const requiredPairs = Math.min(pairs.length, tractorPairs);
      return playedPairs.length >= requiredPairs;
    }
  }

  return true;
}

function getPatternMismatchMessage(leadingPattern, handCards, trumpSuit, trumpRank) {
  const leadingSuit = leadingPattern.suit;
  const sameSuitHand = handCards.filter(c =>
    getEffectiveSuit(c, trumpSuit, trumpRank) === leadingSuit
  );

  if (leadingPattern.type === PatternTypes.PAIR) {
    const pairs = findPairsInCards(sameSuitHand, trumpSuit, trumpRank);
    if (pairs.length > 0) {
      return '手牌中有同花色对子，必须出对子';
    }
  }

  if (leadingPattern.type === PatternTypes.TRACTOR) {
    const pairs = findPairsInCards(sameSuitHand, trumpSuit, trumpRank);
    if (pairs.length > 0) {
      return '手牌中有同花色对子，必须优先把对子打下来';
    }
  }

  return '出牌不符合规则';
}

function findPairsInCards(cards, trumpSuit, trumpRank) {
  const pairs = [];
  const used = new Set();

  for (let i = 0; i < cards.length; i++) {
    if (used.has(i)) continue;

    for (let j = i + 1; j < cards.length; j++) {
      if (used.has(j)) continue;

      if (cards[i].rank === cards[j].rank && cards[i].suit === cards[j].suit) {
        pairs.push({
          cards: [cards[i], cards[j]],
          strength: getCardStrength(cards[i], trumpSuit, trumpRank)
        });
        used.add(i);
        used.add(j);
        break;
      }
    }
  }

  return pairs;
}

function findTractorInPairs(pairs, requiredLength, trumpSuit, trumpRank) {
  if (pairs.length < requiredLength) return false;

  const sortedPairs = [...pairs].sort((a, b) => a.strength - b.strength);

  for (let i = 0; i <= sortedPairs.length - requiredLength; i++) {
    let isConsecutive = true;
    for (let j = 0; j < requiredLength - 1; j++) {
      if (sortedPairs[i + j + 1].strength - sortedPairs[i + j].strength > 2) {
        isConsecutive = false;
        break;
      }
    }
    if (isConsecutive) return true;
  }

  return false;
}

/**
 * 解析甩牌组合 - 将牌分解成各种牌型组件
 * @param {Array} cards - 要解析的牌
 * @param {String} trumpSuit - 主花色
 * @param {String} trumpRank - 级牌
 * @returns {Object} { valid, suit, components } components是组件数组，每个组件包含 { type, cards, strength }
 */
export function parseThrowCombination(cards, trumpSuit, trumpRank) {
  if (!cards || cards.length === 0) {
    return { valid: false, suit: null, components: [] };
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
          const pattern = detectPattern(candidateCards, trumpSuit, trumpRank);
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

      if (card1.rank === card2.rank && card1.suit === card2.suit) {
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
function validateFollowingThrow(cards, handCards, leadingPattern, trumpSuit, trumpRank) {
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
  const followParsed = parseThrowCombination(cards, trumpSuit, trumpRank);

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

    const sameSuitParsed = parseThrowCombination(sameSuitCards, trumpSuit, trumpRank);
    const availableComponents = {
      [PatternTypes.TRACTOR]: [],
      [PatternTypes.PAIR]: [],
      [PatternTypes.SINGLE]: []
    };

    for (const component of sameSuitParsed.components) {
      availableComponents[component.type].push(component);
    }

    const errors = [];

    // 检查拖拉机
    for (const leadTractor of leadingRequirements[PatternTypes.TRACTOR]) {
      const matchingTractors = availableComponents[PatternTypes.TRACTOR].filter(
        t => t.length === leadTractor.length
      );
      if (matchingTractors.length > 0) {
        const followTractors = followParsed.components.filter(
          c => c.type === PatternTypes.TRACTOR && c.length === leadTractor.length
        );
        if (followTractors.length === 0) {
          errors.push(`手牌中有同花色${leadTractor.length}张的拖拉机，必须出`);
        }
      }
    }

    // 检查对子
    const leadPairsCount = leadingRequirements[PatternTypes.PAIR].length;
    const availablePairsCount = availableComponents[PatternTypes.PAIR].length;
    if (leadPairsCount > 0 && availablePairsCount > 0) {
      const followPairsCount = followParsed.components.filter(c => c.type === PatternTypes.PAIR).length;
      const requiredPairs = Math.min(leadPairsCount, availablePairsCount);
      if (followPairsCount < requiredPairs) {
        errors.push(`手牌中有${availablePairsCount}个同花色对子，必须至少出${requiredPairs}个`);
      }
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
