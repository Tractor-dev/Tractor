import { SUIT_ORDER, RANK_ORDER } from './constants.js';

/**
 * 对手牌进行排序
 * 按花色分组，同花色内按点数排序
 * @param {Array} cards - 牌数组
 * @returns {Array} 排序后的牌数组
 */
export function sortCards(cards) {
  if (!Array.isArray(cards) || cards.length === 0) {
    return cards;
  }

  return [...cards].sort((a, b) => {
    // 先按花色排序
    const suitA = SUIT_ORDER[a.suit] ?? 999;
    const suitB = SUIT_ORDER[b.suit] ?? 999;

    if (suitA !== suitB) {
      return suitA - suitB;
    }

    // 同花色按点数排序
    const rankA = RANK_ORDER[a.rank] ?? 999;
    const rankB = RANK_ORDER[b.rank] ?? 999;

    return rankA - rankB;
  });
}
