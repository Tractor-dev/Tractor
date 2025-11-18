import { SUIT_ORDER, RANK_ORDER, Suits, Ranks } from './constants.js';

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
 * 顺序：大王、小王、黑桃级牌、红桃级牌、梅花级牌、方片级牌
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

  // 级牌（按花色排序：黑桃、红桃、梅花、方片）
  if (trumpRank && card.rank === trumpRank) {
    return 2 + (SUIT_ORDER[card.suit] ?? 0);
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
 * @param {Array} cards - 牌数组
 * @param {String} trumpSuit - 主牌花色 (可选)
 * @param {String} trumpRank - 主牌点数 (可选)
 * @returns {Array} 排序后的牌数组
 */
export function sortCards(cards, trumpSuit = null, trumpRank = null) {
  if (!Array.isArray(cards) || cards.length === 0) {
    return cards;
  }

  return [...cards].sort((a, b) => {
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
}
