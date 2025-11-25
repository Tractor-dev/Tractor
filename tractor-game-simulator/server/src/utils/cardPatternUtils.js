import { Suits, Ranks, RANK_ORDER, normalizeRank } from './constants.js';

/**
 * 牌型类型
 */
export const PatternTypes = {
  SINGLE: 'single',       // 单牌
  PAIR: 'pair',           // 对子
  TRACTOR: 'tractor',     // 拖拉机（连对）
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
  const normTrumpRank = normalizeRank(trumpRank);
  // 大小王永远是主牌
  if (card.suit === Suits.JOKER) {
    return true;
  }
  // 级牌是主牌 - 使用字符串比较确保类型一致
  if (String(card.rank) === String(normTrumpRank)) {
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

/**
 * 获取牌的强度值（用于大小比较）
 * @param {Object} card - 牌
 * @param {String} trumpSuit - 主花色
 * @param {String} trumpRank - 级牌
 * @returns {Number} 强度值，越大越强
 */
export function getCardStrength(card, trumpSuit, trumpRank) {
  const normTrumpRank = normalizeRank(trumpRank);
  // 大王最大
  if (card.rank === Ranks.BIG_JOKER) {
    return 1000;
  }
  // 小王
  if (card.rank === Ranks.SMALL_JOKER) {
    return 999;
  }
  // 主花色的级牌
  if (String(card.rank) === String(normTrumpRank) && card.suit === trumpSuit) {
    return 998;
  }
  // 副花色的级牌
  if (String(card.rank) === String(normTrumpRank)) {
    return 997;
  }

  // 基础点数值
  let baseValue = RANK_ORDER[card.rank] || 0;

  // 主花色的牌 - 需要连续排列在副花色级牌之下
  // 主牌顺序: 大王(1000) > 小王(999) > 主级牌(998) > 副级牌(997) > 主A(996) > 主K(995) > ... > 主2(984)
  if (card.suit === trumpSuit) {
    // 计算在主花色中的位置（跳过级牌）
    // A=14, K=13, Q=12, J=11, 10=10, 9=9, 8=8, 7=7, 6=6, 5=5, 4=4, 3=3, 2=2
    const trumpRankValue = RANK_ORDER[normTrumpRank] || 0;

    // 计算这张牌在主花色序列中的排名（从A往下数，跳过级牌）
    let position = 14 - baseValue; // A=0, K=1, Q=2, ...
    if (baseValue < trumpRankValue) {
      position--; // 如果在级牌下面，不需要跳过
    }

    return 996 - position;
  }

  // 副牌
  return baseValue;
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

/**
 * 检测牌型
 * @param {Array} cards - 要检测的牌
 * @param {String} trumpSuit - 主花色
 * @param {String} trumpRank - 级牌
 * @returns {Object} { type, suit, strength, length }
 */
export function detectPattern(cards, trumpSuit, trumpRank) {
  if (!cards || cards.length === 0) {
    return { type: PatternTypes.INVALID, suit: null, strength: 0, length: 0 };
  }

  const count = cards.length;

  // 获取所有牌的有效花色
  const effectiveSuits = cards.map(c => getEffectiveSuit(c, trumpSuit, trumpRank));
  const uniqueSuits = [...new Set(effectiveSuits)];

  // 所有牌必须是同一花色
  if (uniqueSuits.length !== 1) {
    return { type: PatternTypes.INVALID, suit: null, strength: 0, length: count };
  }

  const suit = uniqueSuits[0];

  // 单牌
  if (count === 1) {
    return {
      type: PatternTypes.SINGLE,
      suit,
      strength: getCardStrength(cards[0], trumpSuit, trumpRank),
      length: 1
    };
  }

  // 对子
  if (count === 2) {
    if (cards[0].rank === cards[1].rank && cards[0].suit === cards[1].suit) {
      return {
        type: PatternTypes.PAIR,
        suit,
        strength: getCardStrength(cards[0], trumpSuit, trumpRank),
        length: 2
      };
    }
    // 大小王对子
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

  // 拖拉机检测（4张及以上，必须是偶数）
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
 * 检测是否是拖拉机
 * @param {Array} cards - 牌
 * @param {String} trumpSuit - 主花色
 * @param {String} trumpRank - 级牌
 * @returns {Object} { valid, strength, pairs }
 */
function detectTractor(cards, trumpSuit, trumpRank) {
  // 按强度分组成对子
  const pairs = [];
  const cardsCopy = [...cards];

  while (cardsCopy.length >= 2) {
    const card1 = cardsCopy.shift();
    const pairIndex = cardsCopy.findIndex(c =>
      c.rank === card1.rank && c.suit === card1.suit
    );

    if (pairIndex === -1) {
      // 找不到配对
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

  // 按强度排序
  pairs.sort((a, b) => a.strength - b.strength);

  // 检查是否连续
  const effectiveSuit = getEffectiveSuit(cards[0], trumpSuit, trumpRank);

  if (effectiveSuit === 'trump') {
    // 主牌拖拉机需要特殊处理
    return checkTrumpTractor(pairs, trumpSuit, trumpRank);
  } else {
    // 副牌拖拉机
    return checkNonTrumpTractor(pairs, trumpRank);
  }
}

/**
 * 检查主牌拖拉机
 */
function checkTrumpTractor(pairs, trumpSuit, trumpRank) {
  const normTrumpRank = normalizeRank(trumpRank);
  // 主牌顺序：2,3,4,...,A,级牌(副),级牌(主),小王,大王
  // 跳过级牌在正常序列中的位置

  for (let i = 0; i < pairs.length - 1; i++) {
    const current = pairs[i];
    const next = pairs[i + 1];

    // 检查是否连续（强度值连续）
    // 这里简化处理：允许强度差在一定范围内
    // 实际应该根据主牌序列精确判断
    if (next.strength - current.strength !== 1 &&
        !(current.strength === 997 && next.strength === 998) &&
        !(current.strength === 998 && next.strength === 999) &&
        !(current.strength === 999 && next.strength === 1000)) {

      // 检查普通主牌连续性
      const currentRankValue = RANK_ORDER[current.rank] || 0;
      const nextRankValue = RANK_ORDER[next.rank] || 0;

      // 如果不是特殊的级牌/王连接，检查普通连续性
      if (current.strength < 500 || next.strength < 500) {
        return { valid: false, strength: 0, pairs: [] };
      }

      // 主花色牌的连续性检查，需要跳过级牌
      if (nextRankValue - currentRankValue !== 1) {
        // 检查是否因为跳过级牌
        if (RANK_ORDER[normTrumpRank] === currentRankValue + 1 &&
            nextRankValue === currentRankValue + 2) {
          // 跳过级牌，连续
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

/**
 * 检查副牌拖拉机
 */
function checkNonTrumpTractor(pairs, trumpRank) {
  const normTrumpRank = normalizeRank(trumpRank);
  for (let i = 0; i < pairs.length - 1; i++) {
    const currentRankValue = RANK_ORDER[pairs[i].rank] || 0;
    const nextRankValue = RANK_ORDER[pairs[i + 1].rank] || 0;

    // 检查连续性，需要跳过级牌
    let expectedNext = currentRankValue + 1;
    if (RANK_ORDER[normTrumpRank] === expectedNext) {
      expectedNext++; // 跳过级牌
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
 * 比较两组牌的大小
 * @param {Object} play1 - 第一组牌 { cards, pattern, playerIndex }
 * @param {Object} play2 - 第二组牌 { cards, pattern, playerIndex }
 * @param {String} leadingSuit - 首发花色
 * @param {String} trumpSuit - 主花色
 * @param {String} trumpRank - 级牌
 * @returns {Number} 1表示play1大，-1表示play2大，0表示相等
 */
export function compareCards(play1, play2, leadingSuit, trumpSuit, trumpRank) {
  const pattern1 = play1.pattern;
  const pattern2 = play2.pattern;

  // 无效牌型最小
  if (pattern1.type === PatternTypes.INVALID) return -1;
  if (pattern2.type === PatternTypes.INVALID) return 1;

  // 如果是甩牌，使用特殊的比较逻辑
  if (pattern1.type === PatternTypes.THROW || pattern2.type === PatternTypes.THROW) {
    return compareThrowCards(play1, play2, leadingSuit, trumpSuit, trumpRank);
  }

  // 主牌大于副牌
  const isTrump1 = pattern1.suit === 'trump';
  const isTrump2 = pattern2.suit === 'trump';

  if (isTrump1 && !isTrump2) return 1;
  if (!isTrump1 && isTrump2) return -1;

  // 都是副牌时，只有同花色才能比较
  if (!isTrump1 && !isTrump2) {
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
 * 比较甩牌的大小
 * @param {Object} play1 - 第一组牌
 * @param {Object} play2 - 第二组牌
 * @param {String} leadingSuit - 首发花色
 * @param {String} trumpSuit - 主花色
 * @param {String} trumpRank - 级牌
 * @returns {Number} 1表示play1大，-1表示play2大，0表示相等
 */
function compareThrowCards(play1, play2, leadingSuit, trumpSuit, trumpRank) {
  const pattern1 = play1.pattern;
  const pattern2 = play2.pattern;

  // 主牌大于副牌
  const isTrump1 = pattern1.suit === 'trump';
  const isTrump2 = pattern2.suit === 'trump';

  if (isTrump1 && !isTrump2) {
    // play1是主牌，play2是副牌
    // 主牌必须匹配相同的牌型组合才能毙掉
    if (pattern2.type === PatternTypes.THROW && pattern2.components) {
      // 获取主牌的组件（如果不是THROW类型，先解析为组件）
      let trumpComponents = pattern1.components;
      if (!trumpComponents) {
        const parsed = parseThrowCombination(play1.cards, trumpSuit, trumpRank);
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
        const parsed = parseThrowCombination(play2.cards, trumpSuit, trumpRank);
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
    const isLeading1 = pattern1.suit === leadingSuit;
    const isLeading2 = pattern2.suit === leadingSuit;

    if (isLeading1 && !isLeading2) return 1;
    if (!isLeading1 && isLeading2) return -1;

    // 都不是首发花色
    if (!isLeading1 && !isLeading2) {
      return 0; // 先出的大
    }
  }

  // 同花色比较（都是主牌或都是同一副牌花色）
  // 比较对应的组件
  const components1 = pattern1.components || [];
  const components2 = pattern2.components || [];

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

    if (needed > 0) {
      // 还需要更多拖拉机，尝试用对子拼凑
      const pairsNeeded = requiredLength / 2 * needed;
      if (trumpResources.pairs >= pairsNeeded) {
        trumpResources.pairs -= pairsNeeded;
        needed = 0;
      } else {
        return false; // 对子不够
      }
    }
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
export function validateLeadingPlay(cards, trumpSuit, trumpRank) {
  if (!cards || cards.length === 0) {
    return { valid: false, message: '请选择要出的牌', pattern: null };
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

  // 同花色的牌就允许出，后续流程会判断是否是有效的甩牌
  const pattern = detectPattern(cards, trumpSuit, trumpRank);
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
export function validateFollowingPlay(cards, handCards, leadingPattern, trumpSuit, trumpRank) {
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

  // 如果首发是甩牌，使用特殊的跟牌验证
  if (leadingPattern.type === PatternTypes.THROW) {
    return validateFollowingThrow(cards, handCards, leadingPattern, trumpSuit, trumpRank);
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
  const pattern = detectPattern(cards, trumpSuit, trumpRank);

  // 检查是否需要匹配牌型
  if (playedSameSuit.length >= leadingPattern.length) {
    // 全部是同花色，需要匹配牌型
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

/**
 * 检查是否满足牌型匹配要求
 */
function matchPatternRequirement(cards, handCards, leadingPattern, trumpSuit, trumpRank) {
  const leadingSuit = leadingPattern.suit;

  // 获取手牌中同花色的牌
  const sameSuitHand = handCards.filter(c =>
    getEffectiveSuit(c, trumpSuit, trumpRank) === leadingSuit
  );

  if (leadingPattern.type === PatternTypes.PAIR) {
    // 首发是对子，检查手牌中是否有同花色对子
    const hasPair = findPairsInCards(sameSuitHand, trumpSuit, trumpRank).length > 0;
    if (hasPair) {
      // 有对子就必须出对子
      const playedPattern = detectPattern(cards, trumpSuit, trumpRank);
      return playedPattern.type === PatternTypes.PAIR;
    }
  }

  if (leadingPattern.type === PatternTypes.TRACTOR) {
    // 首发是拖拉机
    const pairs = findPairsInCards(sameSuitHand, trumpSuit, trumpRank);

    // 检查是否有拖拉机
    const tractorPairs = leadingPattern.length / 2;
    const hasTractor = findTractorInPairs(pairs, tractorPairs, trumpSuit, trumpRank);

    if (hasTractor) {
      // 有拖拉机就必须出拖拉机
      const playedPattern = detectPattern(cards, trumpSuit, trumpRank);
      return playedPattern.type === PatternTypes.TRACTOR &&
             playedPattern.length === leadingPattern.length;
    }

    // 没有完整拖拉机，检查是否有对子
    if (pairs.length > 0) {
      // 必须把对子打下来
      const playedPairs = findPairsInCards(cards, trumpSuit, trumpRank);
      const requiredPairs = Math.min(pairs.length, tractorPairs);
      return playedPairs.length >= requiredPairs;
    }
  }

  return true;
}

/**
 * 获取牌型不匹配的错误信息
 */
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

/**
 * 在牌组中找出所有对子
 */
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

/**
 * 在对子中找拖拉机
 */
function findTractorInPairs(pairs, requiredLength, trumpSuit, trumpRank) {
  if (pairs.length < requiredLength) return false;

  // 按强度排序
  const sortedPairs = [...pairs].sort((a, b) => a.strength - b.strength);

  // 滑动窗口查找连续对子
  for (let i = 0; i <= sortedPairs.length - requiredLength; i++) {
    let isConsecutive = true;
    for (let j = 0; j < requiredLength - 1; j++) {
      // 简化检查：强度差应该在合理范围内
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
 * 检查某个组件是否是最大的（其他玩家手牌中没有能压过它的牌）
 * @param {Object} component - 组件 { type, cards, strength, length }
 * @param {Array} otherPlayersCards - 其他玩家的手牌数组（数组的数组）
 * @param {String} trumpSuit - 主花色
 * @param {String} trumpRank - 级牌
 * @returns {Boolean} true表示是最大的，false表示不是
 */
export function isComponentLargest(component, otherPlayersCards, trumpSuit, trumpRank) {
  const componentSuit = getEffectiveSuit(component.cards[0], trumpSuit, trumpRank);

  // 遍历所有其他玩家
  for (const playerCards of otherPlayersCards) {
    // 获取该玩家同花色的牌
    const sameSuitCards = playerCards.filter(c =>
      getEffectiveSuit(c, trumpSuit, trumpRank) === componentSuit
    );

    if (sameSuitCards.length === 0) continue;

    // 检查是否有更大的牌型
    if (component.type === PatternTypes.SINGLE) {
      // 单牌：检查是否有更大的单牌
      for (const card of sameSuitCards) {
        if (getCardStrength(card, trumpSuit, trumpRank) > component.strength) {
          return false; // 有更大的单牌
        }
      }
    } else if (component.type === PatternTypes.PAIR) {
      // 对子：检查是否有更大的对子
      const pairs = findPairsInCards(sameSuitCards, trumpSuit, trumpRank);
      for (const pair of pairs) {
        if (pair.strength > component.strength) {
          return false; // 有更大的对子
        }
      }
    } else if (component.type === PatternTypes.TRACTOR) {
      // 拖拉机：检查是否有更大的同长度拖拉机
      const requiredPairs = component.length / 2;

      // 找出所有可能的拖拉机组合
      if (hasLargerTractor(sameSuitCards, requiredPairs, component.strength, trumpSuit, trumpRank)) {
        return false; // 有更大的拖拉机
      }
    }
  }

  return true; // 没有更大的牌
}

/**
 * 检查是否有更大的拖拉机
 */
function hasLargerTractor(cards, requiredPairs, targetStrength, trumpSuit, trumpRank) {
  // 找出所有对子
  const pairs = findPairsInCards(cards, trumpSuit, trumpRank);

  if (pairs.length < requiredPairs) return false;

  // 按强度排序
  const sortedPairs = [...pairs].sort((a, b) => a.strength - b.strength);

  // 尝试找连续的对子组成拖拉机
  for (let i = 0; i <= sortedPairs.length - requiredPairs; i++) {
    const candidatePairs = sortedPairs.slice(i, i + requiredPairs);

    // 检查是否连续
    let isConsecutive = true;
    for (let j = 0; j < candidatePairs.length - 1; j++) {
      const diff = candidatePairs[j + 1].strength - candidatePairs[j].strength;
      if (diff > 2) { // 允许一定的容差
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
export function validateThrow(cards, otherPlayersCards, trumpSuit, trumpRank) {
  // 解析甩牌组合
  const parsed = parseThrowCombination(cards, trumpSuit, trumpRank);

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
    if (!isComponentLargest(component, otherPlayersCards, trumpSuit, trumpRank)) {
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
    // 按组件类型统计首发的要求
    const leadingRequirements = {
      [PatternTypes.TRACTOR]: [],
      [PatternTypes.PAIR]: [],
      [PatternTypes.SINGLE]: []
    };

    for (const component of leadingComponents) {
      leadingRequirements[component.type].push(component);
    }

    // 检查手牌中是否有对应的牌型
    const sameSuitParsed = parseThrowCombination(sameSuitCards, trumpSuit, trumpRank);
    const availableComponents = {
      [PatternTypes.TRACTOR]: [],
      [PatternTypes.PAIR]: [],
      [PatternTypes.SINGLE]: []
    };

    for (const component of sameSuitParsed.components) {
      availableComponents[component.type].push(component);
    }

    // 验证跟牌是否匹配首发的牌型要求
    const errors = [];

    // 检查拖拉机
    for (const leadTractor of leadingRequirements[PatternTypes.TRACTOR]) {
      const matchingTractors = availableComponents[PatternTypes.TRACTOR].filter(
        t => t.length === leadTractor.length
      );
      if (matchingTractors.length > 0) {
        // 手牌中有相同长度的拖拉机，必须出
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
