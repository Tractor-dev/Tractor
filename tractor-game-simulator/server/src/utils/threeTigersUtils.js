import {
  EXTENDED_ORDINARY_RANKS,
  PROMOTED_ORDINARY_RANKS,
  Ranks,
  STANDARD_ORDINARY_RANKS
} from './constants.js';

const SHIFT = 4;
const SHIFTABLE_RANKS = Object.freeze(
  EXTENDED_ORDINARY_RANKS.filter(rank => !PROMOTED_ORDINARY_RANKS.includes(rank))
);

/**
 * “降四级”按本局普通牌序列计算，而不是把牌面数字机械减四。
 * 级牌已从普通牌序列抽走；若原牌恰为级牌，则从级牌下方的普通牌开始向下数。
 * 例如4为级牌时，4下方是3，再降四级得到−1。
 */
export function shiftThreeTigersRank(rank, trumpRank = null) {
  if (!STANDARD_ORDINARY_RANKS.includes(rank)) return rank;
  const ordinaryRanks = trumpRank && STANDARD_ORDINARY_RANKS.includes(String(trumpRank))
    ? SHIFTABLE_RANKS.filter(candidate => String(candidate) !== String(trumpRank))
    : SHIFTABLE_RANKS;
  const sourceIndex = String(rank) === String(trumpRank)
    ? Math.max(0, SHIFTABLE_RANKS.indexOf(rank) - 1)
    : ordinaryRanks.indexOf(rank);
  return ordinaryRanks[Math.max(0, sourceIndex - SHIFT)] || Ranks.MINUS_TWO;
}

/**
 * 生成仅用于本轮展示与比较的牌面；实体牌和实体分值保持不变。
 */
export function transformThreeTigersCard(
  card,
  tigerSuit,
  trumpRank = null,
  trumpSuit = null
) {
  const source = card?.toJSON ? card.toJSON() : { ...card };
  const isOriginalTrump = source?.suit === 'joker'
    || source?.suit === trumpSuit
    || (trumpRank != null && String(source?.rank) === String(trumpRank));
  if (!source || source.suit !== tigerSuit || isOriginalTrump) return source;
  return {
    ...source,
    originalSuit: source.originalSuit || source.suit,
    originalRank: source.originalRank || source.rank,
    rank: shiftThreeTigersRank(source.rank, trumpRank),
    isThreeTigersTransformed: true,
    isThreeTigersTrump: true,
    threeTigersSourceSuit: tigerSuit,
    threeTigersShift: -SHIFT
  };
}

export function transformThreeTigersCards(
  cards,
  tigerSuit,
  trumpRank = null,
  trumpSuit = null
) {
  return (cards || []).map(card => (
    transformThreeTigersCard(card, tigerSuit, trumpRank, trumpSuit)
  ));
}
