import { SUIT_ORDER, RANK_ORDER, Suits, Ranks } from './constants.js';
import { getCardStrength, getEffectiveSuit } from './cardPatternUtils.js';

/**
 * 获取基于主花色的动态花色排序（副牌红黑交替）
 * 主花色在最左边，然后按红黑交替顺序排列
 * @param {String} trumpSuit - 主花色
 * @returns {Object} 花色到顺序的映射
 */
function getDynamicSuitOrder(trumpSuit) {
  // 默认顺序（无主或未设置）
  const defaultOrder = {
    [Suits.SPADES]: 0,
    [Suits.HEARTS]: 1,
    [Suits.CLUBS]: 2,
    [Suits.DIAMONDS]: 3,
    [Suits.JOKER]: 4
  };

  if (!trumpSuit || trumpSuit === Suits.NO_TRUMP || trumpSuit === Suits.JOKER) {
    return defaultOrder;
  }

  // 红色花色和黑色花色
  const redSuits = [Suits.HEARTS, Suits.DIAMONDS];
  const blackSuits = [Suits.SPADES, Suits.CLUBS];

  const isRedTrump = redSuits.includes(trumpSuit);
  const order = {};
  
  // 主花色排在最前面（但会被移到主牌区域）
  order[trumpSuit] = 0;
  
  // 根据主花色确定交替顺序
  // 主花色后面是相反颜色，然后交替
  let remainingSuits;
  if (isRedTrump) {
    // 红色主：红主 -> 黑 -> 红 -> 黑
    const otherRed = redSuits.filter(s => s !== trumpSuit)[0];
    if (trumpSuit === Suits.HEARTS) {
      // hearts -> spades -> diamonds -> clubs
      remainingSuits = [Suits.SPADES, Suits.DIAMONDS, Suits.CLUBS];
    } else {
      // diamonds -> clubs -> hearts -> spades
      remainingSuits = [Suits.CLUBS, Suits.HEARTS, Suits.SPADES];
    }
  } else {
    // 黑色主：黑主 -> 红 -> 黑 -> 红
    if (trumpSuit === Suits.SPADES) {
      // spades -> hearts -> clubs -> diamonds
      remainingSuits = [Suits.HEARTS, Suits.CLUBS, Suits.DIAMONDS];
    } else {
      // clubs -> diamonds -> spades -> hearts
      remainingSuits = [Suits.DIAMONDS, Suits.SPADES, Suits.HEARTS];
    }
  }

  remainingSuits.forEach((suit, index) => {
    order[suit] = index + 1;
  });

  order[Suits.JOKER] = 4;

  return order;
}

/**
 * 判断一张牌是否为主牌
 * @param {Object} card - 卡牌对象
 * @param {String} trumpSuit - 主花色
 * @param {String} trumpRank - 级牌
 * @returns {Boolean} 是否为主牌
 */
export function isTrumpCard(card, trumpSuit, trumpRank) {
  // 大小王总是主牌
  if (card.suit === Suits.JOKER) {
    return true;
  }

  // 主点数的牌是主牌
  if (trumpRank && card.rank === trumpRank) {
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
function getTrumpPriority(card, trumpSuit, trumpRank) {
  // 大王
  if (card.suit === Suits.JOKER && card.rank === Ranks.BIG_JOKER) {
    return 0;
  }

  // 小王
  if (card.suit === Suits.JOKER && card.rank === Ranks.SMALL_JOKER) {
    return 1;
  }

  // 级牌排序
  if (trumpRank && card.rank === trumpRank) {
    // 主花色级牌优先级最高（排在王后面）
    if (trumpSuit && trumpSuit !== Suits.NO_TRUMP && card.suit === trumpSuit) {
      return 2;
    }
    // 其他花色级牌按动态花色顺序排序（红黑交替）
    const dynamicOrder = getDynamicSuitOrder(trumpSuit);
    return 3 + (dynamicOrder[card.suit] ?? 0);
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
  return trumpRank && card.rank === trumpRank && card.suit !== Suits.JOKER;
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
  if (trumpRank && card.rank === trumpRank) {
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
export function sortCards(cards, trumpSuit = null, trumpRank = null) {
  if (!Array.isArray(cards) || cards.length === 0) {
    return cards;
  }

  // 获取基于主花色的动态花色排序（副牌红黑交替）
  const dynamicSuitOrder = getDynamicSuitOrder(trumpSuit);

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
      const priorityA = getTrumpPriority(a, trumpSuit, trumpRank);
      const priorityB = getTrumpPriority(b, trumpSuit, trumpRank);
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

    // 都是副牌，按动态花色顺序和点数排序（红黑交替）
    const suitA = dynamicSuitOrder[a.suit] ?? 999;
    const suitB = dynamicSuitOrder[b.suit] ?? 999;

    if (suitA !== suitB) {
      return suitA - suitB;
    }

    const rankA = RANK_ORDER[a.rank] ?? 999;
    const rankB = RANK_ORDER[b.rank] ?? 999;

    return rankB - rankA; // 降序：A到2
  });

  // 第二步：如果有主牌信息，调整拖拉机使其组件相连
  if (trumpSuit && trumpRank && sorted.length >= 4) {
    sorted = adjustTractorsForVisualContinuity(sorted, trumpSuit, trumpRank);
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
function adjustTractorsForVisualContinuity(cards, trumpSuit, trumpRank) {
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
          strength: getCardStrength(card1, trumpSuit, trumpRank),
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
      const strengthA = getCardStrength(a, trumpSuit, trumpRank);
      const strengthB = getCardStrength(b, trumpSuit, trumpRank);
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
