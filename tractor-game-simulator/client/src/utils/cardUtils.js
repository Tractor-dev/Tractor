import { SUIT_ORDER, RANK_ORDER, Suits, Ranks } from './constants.js';

/**
 * 判断一张牌是否为主牌
 */
function isTrumpCard(card, trumpSuit, trumpRank) {
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
 */
function getTrumpPriority(card, trumpSuit, trumpRank) {
  // 大王
  if (card.suit === Suits.JOKER && card.rank === Ranks.BIG_JOKER) {
    return 1000;
  }

  // 小王
  if (card.suit === Suits.JOKER && card.rank === Ranks.SMALL_JOKER) {
    return 900;
  }

  // 主花色主点数
  if (trumpSuit && trumpSuit !== Suits.NO_TRUMP &&
      card.suit === trumpSuit && trumpRank && card.rank === trumpRank) {
    return 800;
  }

  // 其他花色主点数
  if (trumpRank && card.rank === trumpRank) {
    return 700 + (SUIT_ORDER[card.suit] ?? 0);
  }

  // 其他主花色牌
  if (trumpSuit && trumpSuit !== Suits.NO_TRUMP && card.suit === trumpSuit) {
    return 100 + (RANK_ORDER[card.rank] ?? 0);
  }

  return 0;
}

/**
 * 对手牌进行排序
 * 按花色分组，同花色内按点数排序
 * @param {Array} cards - 牌数组
 * @param {String} trumpSuit - 主牌花色 (可选)
 * @param {String} trumpRank - 主牌点数 (可选)
 * @returns {Array} 排序后的牌数组
 */
export function sortCards(cards, trumpSuit = null, trumpRank = null) {
  if (!Array.isArray(cards) || cards.length === 0) {
    return cards;
  }

  // 如果没有主牌信息，使用旧的排序逻辑
  if (!trumpSuit && !trumpRank) {
    return [...cards].sort((a, b) => {
      const suitA = SUIT_ORDER[a.suit] ?? 999;
      const suitB = SUIT_ORDER[b.suit] ?? 999;

      if (suitA !== suitB) {
        return suitA - suitB;
      }

      const rankA = RANK_ORDER[a.rank] ?? 999;
      const rankB = RANK_ORDER[b.rank] ?? 999;

      return rankA - rankB;
    });
  }

  // 使用主牌排序逻辑
  return [...cards].sort((a, b) => {
    const aIsTrump = isTrumpCard(a, trumpSuit, trumpRank);
    const bIsTrump = isTrumpCard(b, trumpSuit, trumpRank);

    // 主牌在后，副牌在前
    if (aIsTrump && !bIsTrump) {
      return 1;
    }
    if (!aIsTrump && bIsTrump) {
      return -1;
    }

    // 都是主牌，按主牌优先级排序
    if (aIsTrump && bIsTrump) {
      const priorityA = getTrumpPriority(a, trumpSuit, trumpRank);
      const priorityB = getTrumpPriority(b, trumpSuit, trumpRank);
      return priorityA - priorityB;
    }

    // 都是副牌，按花色和点数排序
    const suitA = SUIT_ORDER[a.suit] ?? 999;
    const suitB = SUIT_ORDER[b.suit] ?? 999;

    if (suitA !== suitB) {
      return suitA - suitB;
    }

    const rankA = RANK_ORDER[a.rank] ?? 999;
    const rankB = RANK_ORDER[b.rank] ?? 999;

    return rankA - rankB;
  });
}
