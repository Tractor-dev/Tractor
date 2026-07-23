import { SUIT_ORDER, RANK_ORDER, Suits, Ranks } from './constants.js';
import { getCardStrength, getEffectiveSuit } from './cardPatternUtils.js';

/**
 * 判断一张牌是否为主牌
 * @param {Object} card - 卡牌对象
 * @param {String} trumpSuit - 主花色
 * @param {String} trumpRank - 级牌
 * @returns {Boolean} 是否为主牌
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
  // 大小王总是主牌
  if (card.suit === Suits.JOKER) {
    return true;
  }

  // 主点数的牌是主牌
  if (!card.isUnarmed && trumpRank && card.rank === trumpRank) {
    return true;
  }

  // 主花色的牌是主牌（无主时不适用）
  if (trumpSuit && trumpSuit !== Suits.NO_TRUMP && card.suit === trumpSuit) {
    return true;
  }

  return false;
}

/**
 * 获取主牌的优先级（用于排序）
 * 顺序：大王、小王、主花色级牌、其他花色级牌（按花色顺序）、主花色其他牌
 */
function getTrumpPriority(card, trumpSuit, trumpRank, inferiorSuit = null) {
  // 扩展王依次排在大王之上：郡王、亲王、白王（皇）。
  if (card.suit === Suits.JOKER && card.rank === Ranks.WHITE_JOKER) {
    return -3;
  }
  if (card.suit === Suits.JOKER && card.rank === Ranks.PRINCE_JOKER) {
    return -2;
  }
  if (card.suit === Suits.JOKER && card.rank === Ranks.COUNTY_PRINCE_JOKER) {
    return -1;
  }
  // 大王
  if (card.suit === Suits.JOKER && card.rank === Ranks.BIG_JOKER) {
    return 0;
  }

  // 小王
  if (card.suit === Suits.JOKER && card.rank === Ranks.SMALL_JOKER) {
    return 1;
  }

  // 级牌排序
  if (!card.isUnarmed && trumpRank && card.rank === trumpRank) {
    // 主花色级牌优先级最高（排在王后面）
    if (trumpSuit && trumpSuit !== Suits.NO_TRUMP && card.suit === trumpSuit) {
      return 2;
    }
    if (inferiorSuit && card.suit === inferiorSuit) {
      return 7;
    }
    // 其他花色级牌按 SUIT_ORDER 排序
    return 3 + (SUIT_ORDER[card.suit] ?? 0);
  }

  if (card.rank === Ranks.NO_TRUMP_MINUS) {
    return 7 + (SUIT_ORDER[card.suit] ?? 0);
  }

  // 其他主花色牌（在级牌之后）
  if (trumpSuit && trumpSuit !== Suits.NO_TRUMP && card.suit === trumpSuit) {
    return 100 + (RANK_ORDER[card.rank] ?? 0);
  }

  return 0;
}

/**
 * 判断一张牌是否为王
 */
function isJoker(card) {
  return card.suit === Suits.JOKER;
}

/**
 * 判断一张牌是否为级牌（非王）
 */
function isTrumpRank(card, trumpRank) {
  return card.suit !== Suits.JOKER && (
    (!card.isUnarmed && trumpRank && card.rank === trumpRank)
    || card.rank === Ranks.NO_TRUMP_MINUS
  );
}

/**
 * 判断一张牌是否为王或级牌
 */
function isJokerOrTrumpRank(card, trumpRank) {
  return isJoker(card) || isTrumpRank(card, trumpRank);
}

/**
 * 判断一张牌是否为主花色牌（非王、非级牌）
 */
function isTrumpSuitCard(card, trumpSuit, trumpRank) {
  // 不是王
  if (card.suit === Suits.JOKER) {
    return false;
  }

  // 不是级牌
  if (!card.isUnarmed && trumpRank && card.rank === trumpRank) {
    return false;
  }

  // 是主花色，且不是无主
  if (trumpSuit && trumpSuit !== Suits.NO_TRUMP && card.suit === trumpSuit) {
    return true;
  }

  return false;
}

/**
 * 对手牌进行排序
 * 排序规则：
 * 1. 王（大王、小王）
 * 2. 级牌（黑桃、红桃、梅花、方片）
 * 3. 主花色牌（非级牌，按点数A到2排序）
 * 4. 其他花色牌（按花色顺序，同花色内按点数A到2排序）
 * 5. 拖拉机组件调整到视觉上相连
 * @param {Array} cards - 牌数组
 * @param {String} trumpSuit - 主牌花色 (可选)
 * @param {String} trumpRank - 主牌点数 (可选)
 * @returns {Array} 排序后的牌数组
 */
export function sortCards(cards, trumpSuit = null, trumpRank = null, inferiorSuit = null) {
  if (!Array.isArray(cards) || cards.length === 0) {
    return cards;
  }

  // 第一步：按照基本规则排序
  let sorted = [...cards].sort((a, b) => {
    const aIsJokerOrTrumpRank = isJokerOrTrumpRank(a, trumpRank);
    const bIsJokerOrTrumpRank = isJokerOrTrumpRank(b, trumpRank);
    const aIsTrumpSuitCard = isTrumpSuitCard(a, trumpSuit, trumpRank);
    const bIsTrumpSuitCard = isTrumpSuitCard(b, trumpSuit, trumpRank);

    // 第一优先级：王和级牌在最前
    if (aIsJokerOrTrumpRank && !bIsJokerOrTrumpRank) {
      return -1;
    }
    if (!aIsJokerOrTrumpRank && bIsJokerOrTrumpRank) {
      return 1;
    }

    // 都是王或级牌，按主牌优先级排序
    if (aIsJokerOrTrumpRank && bIsJokerOrTrumpRank) {
      const priorityA = getTrumpPriority(a, trumpSuit, trumpRank, inferiorSuit);
      const priorityB = getTrumpPriority(b, trumpSuit, trumpRank, inferiorSuit);
      return priorityA - priorityB;
    }

    // 第二优先级：主花色牌在其他牌之前
    if (aIsTrumpSuitCard && !bIsTrumpSuitCard) {
      return -1;
    }
    if (!aIsTrumpSuitCard && bIsTrumpSuitCard) {
      return 1;
    }

    // 都是主花色牌，按点数排序（A到2，降序）
    if (aIsTrumpSuitCard && bIsTrumpSuitCard) {
      const rankA = RANK_ORDER[a.rank] ?? 999;
      const rankB = RANK_ORDER[b.rank] ?? 999;
      return rankB - rankA;
    }

    // 三六九等：劣花色普通牌整体排在所有普通副花色之后。
    const aIsInferiorSuitCard = Boolean(inferiorSuit && a.suit === inferiorSuit);
    const bIsInferiorSuitCard = Boolean(inferiorSuit && b.suit === inferiorSuit);
    if (aIsInferiorSuitCard && !bIsInferiorSuitCard) return 1;
    if (!aIsInferiorSuitCard && bIsInferiorSuitCard) return -1;

    // 都是副牌，按花色和点数排序
    const suitA = SUIT_ORDER[a.suit] ?? 999;
    const suitB = SUIT_ORDER[b.suit] ?? 999;

    if (suitA !== suitB) {
      return suitA - suitB;
    }

    const rankA = RANK_ORDER[a.rank] ?? 999;
    const rankB = RANK_ORDER[b.rank] ?? 999;

    return rankB - rankA; // 降序：A到2
  });

  // 第二步：如果有主牌信息，调整拖拉机使其组件相连
  if (trumpSuit && trumpRank && sorted.length >= 4) {
    sorted = adjustTractorsForVisualContinuity(
      sorted,
      trumpSuit,
      trumpRank,
      inferiorSuit
    );
  }

  return sorted;
}

/**
 * 调整拖拉机使其组件在视觉上相连
 * @param {Array} cards - 已排序的牌数组
 * @param {String} trumpSuit - 主牌花色
 * @param {String} trumpRank - 级牌
 * @returns {Array} 调整后的牌数组
 */
function adjustTractorsForVisualContinuity(cards, trumpSuit, trumpRank, inferiorSuit = null) {
  // 只处理主牌区域的拖拉机
  const trumpCards = cards.filter(c => isTrumpCard(c, trumpSuit, trumpRank));
  if (trumpCards.length < 4) {
    return cards;
  }

  // 检测所有对子
  const pairs = [];
  const used = new Set();

  for (let i = 0; i < trumpCards.length; i++) {
    if (used.has(i)) continue;
    const card1 = trumpCards[i];

    for (let j = i + 1; j < trumpCards.length; j++) {
      if (used.has(j)) continue;
      const card2 = trumpCards[j];

      // 判断是否是对子
      if (card1.rank === card2.rank && card1.suit === card2.suit) {
        pairs.push({
          cards: [card1, card2],
          strength: getCardStrength(
            card1,
            trumpSuit,
            trumpRank,
            inferiorSuit ? { id: 'three_six_nine_grades', inferiorSuit } : null
          ),
          indices: [
            cards.findIndex(c => c.id === card1.id),
            cards.findIndex(c => c.id === card2.id)
          ]
        });
        used.add(i);
        used.add(j);
        break;
      }
    }
  }

  if (pairs.length < 2) {
    return cards;
  }

  // 按强度排序对子
  pairs.sort((a, b) => a.strength - b.strength);

  // 找出所有拖拉机
  const tractors = [];
  let tractorStart = 0;

  for (let i = 1; i <= pairs.length; i++) {
    let isConsecutive = false;

    if (i < pairs.length) {
      const prevStrength = pairs[i-1].strength;
      const currStrength = pairs[i].strength;
      const strengthDiff = currStrength - prevStrength;

      // 检查是否无主局
      const isNoTrump = !trumpSuit || trumpSuit === 'no_trump';

      // 判断是否连续（使用和Hand.jsx相同的逻辑）
      if ((prevStrength === 997 && currStrength === 998) ||
          (prevStrength === 998 && currStrength === 999) ||
          (prevStrength === 999 && currStrength === 1000) ||
          (prevStrength === 997 && currStrength === 999 && isNoTrump)) {  // 仅无主局
        isConsecutive = true;
      } else if (strengthDiff === 1) {
        isConsecutive = true;
      } else if (strengthDiff === 2) {
        const trumpRankValue = RANK_ORDER[trumpRank] || 0;
        if (trumpRankValue === prevStrength + 1) {
          isConsecutive = true;
        }
      }
    }

    if (!isConsecutive) {
      // 当前拖拉机结束
      const tractorLength = i - tractorStart;
      if (tractorLength >= 2) {
        const tractorPairs = pairs.slice(tractorStart, i);
        tractors.push({
          pairs: tractorPairs,
          length: tractorLength
        });
      }
      tractorStart = i;
    }
  }

  if (tractors.length === 0) {
    return cards;
  }

  // 对每个拖拉机，调整其成员牌的位置使其相连
  let result = [...cards];

  for (const tractor of tractors) {
    // 重新计算拖拉机牌的当前索引（因为之前的调整可能改变了位置）
    const tractorCardIds = tractor.pairs.flatMap(pair => pair.cards.map(c => c.id));
    const currentIndices = tractorCardIds.map(id => result.findIndex(c => c.id === id));
    currentIndices.sort((a, b) => a - b);

    // 检查这些牌是否已经相连
    let isAlreadyContinuous = true;
    for (let i = 1; i < currentIndices.length; i++) {
      if (currentIndices[i] !== currentIndices[i-1] + 1) {
        isAlreadyContinuous = false;
        break;
      }
    }

    if (isAlreadyContinuous) {
      continue; // 已经相连，不需要调整
    }

    // 提取拖拉机的所有牌（按强度排序，保证从小到大）
    const tractorCards = tractorCardIds.map(id => result.find(c => c.id === id));
    tractorCards.sort((a, b) => {
      const activeRule = inferiorSuit ? { id: 'three_six_nine_grades', inferiorSuit } : null;
      const strengthA = getCardStrength(a, trumpSuit, trumpRank, activeRule);
      const strengthB = getCardStrength(b, trumpSuit, trumpRank, activeRule);
      return strengthA - strengthB;
    });

    // 从result中移除这些牌
    result = result.filter(c => !tractorCardIds.includes(c.id));

    // 找到插入位置：原来拖拉机中最小索引的位置
    const minOriginalIndex = Math.min(...currentIndices);
    let insertPos = minOriginalIndex;

    // 调整插入位置（考虑已删除的牌）
    for (let i = 0; i < minOriginalIndex; i++) {
      if (tractorCardIds.includes(cards[i]?.id)) {
        insertPos--;
      }
    }

    // 在该位置重新插入拖拉机的牌
    result.splice(insertPos, 0, ...tractorCards);
  }

  return result;
}
