import { Ranks, levelToRank } from './constants.js';
import { PatternTypes } from './cardPatternUtils.js';

const METICULOUS_ACCOUNTING_POINT_VALUES = Object.freeze({
  A: 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7
});

function getScoringRank(card) {
  // 临时转化只改变牌面与牌力；分值始终来自被转化的实体牌。
  const usesOriginalRank = card?.isDivineWeaponTransformed
    || card?.isJokerSubstitution
    || card?.isClusterAnalysisTransformed
    || card?.isForbiddenMagicDemoted
    || card?.isStrengthCompensated
    || card?.isDefenseAsOffenseBoosted
    || card?.isTeammateCheered
    || card?.isAfterglowBoosted
    || card?.isThreeTigersTransformed;
  return usesOriginalRank && card?.originalRank
    ? card.originalRank
    : card?.rank;
}

/**
 * 获取单张牌的分数
 * @param {Object} card - 牌对象
 * @returns {Number} 分数 (0, 5, 或 10)
 */
export function getCardPoints(card) {
  if (card?.isRiceToMulberryTransformed) return 0;
  const scoringRank = getScoringRank(card);
  // 5 = 5分
  if (scoringRank === Ranks.FIVE || scoringRank === '5') {
    return 5;
  }
  // 10 = 10分
  if (scoringRank === Ranks.TEN || scoringRank === '10') {
    return 10;
  }
  // K = 10分
  if (scoringRank === Ranks.KING || scoringRank === 'K') {
    return 10;
  }
  return 0;
}

/** “锱铢必较”中 A、2、3、4、5、6、7 分别计 1 至 7 分。 */
export function getMeticulousAccountingCardPoints(card) {
  return METICULOUS_ACCOUNTING_POINT_VALUES[String(getScoringRank(card))] || 0;
}

/**
 * 计算一组牌的总分
 * @param {Array} cards - 牌数组
 * @returns {Number} 总分
 */
export function calculateRoundPoints(cards, pointResolver = getCardPoints) {
  if (!cards || cards.length === 0) {
    return 0;
  }
  return cards.reduce((total, card) => total + pointResolver(card), 0);
}

/**
 * 从一组牌中提取所有分数牌
 * @param {Array} cards - 牌数组
 * @returns {Array} 分数牌数组
 */
export function extractPointCards(cards, pointResolver = getCardPoints) {
  if (!cards || cards.length === 0) {
    return [];
  }
  return cards.filter(card => pointResolver(card) > 0);
}

/**
 * 判断玩家是否是闲家（攻方）
 * 在双升中，4人分两队：
 * - 庄家和对家是一队（守方）
 * - 庄家的上家和下家是一队（闲家/攻方）
 *
 * @param {Number} playerIndex - 玩家索引
 * @param {Number} dealerIndex - 庄家索引
 * @param {Number} totalPlayers - 总玩家数（通常为4）
 * @returns {Boolean} 是否是闲家
 */
export function isAttacker(playerIndex, dealerIndex, totalPlayers = 4) {
  // 对家的索引（间隔2个位置）
  const partnerIndex = (dealerIndex + 2) % totalPlayers;

  // 庄家和对家是守方，其他是攻方（闲家）
  return playerIndex !== dealerIndex && playerIndex !== partnerIndex;
}

/**
 * 获取庄家的对家索引
 * @param {Number} dealerIndex - 庄家索引
 * @param {Number} totalPlayers - 总玩家数
 * @returns {Number} 对家索引
 */
export function getPartnerIndex(dealerIndex, totalPlayers = 4) {
  return (dealerIndex + 2) % totalPlayers;
}

/**
 * 计算底牌倍数
 * 根据最后一轮首发牌型计算
 *
 * 重要：牌型判定基于首发牌型
 * - 如果首发是2张单牌，闲家用对子毙掉，应该视为2张单牌，倍数为2
 * - 如果首发是对子，闲家用对子压，应该视为1个对子，倍数为4
 *
 * @param {Object} leadingPattern - 首发牌型
 * @returns {Number} 倍数 (2, 4, 8, 16...)
 */
export function calculateBottomMultiplier(leadingPattern) {
  if (!leadingPattern) {
    return 2; // 默认倍数
  }

  const leadingType = leadingPattern.type;

  // 如果首发是甩牌，需要特殊处理
  if (leadingType === PatternTypes.THROW) {
    return calculateThrowMultiplier(leadingPattern);
  }

  // 对于普通牌型（单牌、对子、拖拉机）
  // 倍数由首发牌型决定
  switch (leadingType) {
    case PatternTypes.SINGLE:
      // 单牌，倍数 = 2
      return 2;

    case PatternTypes.PAIR:
      // 对子，倍数 = 4
      return 4;

    case PatternTypes.TRACTOR:
      // 拖拉机，倍数 = 2^(对数)
      // 2连对(4张) = 8, 3连对(6张) = 16, 4连对(8张) = 32
      const pairCount = leadingPattern.length / 2;
      return Math.pow(2, pairCount + 1);

    default:
      return 2;
  }
}

/**
 * 计算甩牌的倍数
 * 甩牌由多个组件组成，取最大组件的倍数
 * @param {Object} leadingPattern - 首发甩牌牌型
 * @returns {Number} 倍数
 */
function calculateThrowMultiplier(leadingPattern) {
  const components = leadingPattern.components || [];

  if (components.length === 0) {
    return 2;
  }

  // 找出最大组件的倍数
  let maxMultiplier = 2;

  for (const component of components) {
    let multiplier = 2;

    switch (component.type) {
      case PatternTypes.SINGLE:
        multiplier = 2;
        break;

      case PatternTypes.PAIR:
        multiplier = 4;
        break;

      case PatternTypes.TRACTOR:
        const pairCount = component.length / 2;
        multiplier = Math.pow(2, pairCount + 1);
        break;
    }

    if (multiplier > maxMultiplier) {
      maxMultiplier = multiplier;
    }
  }

  return maxMultiplier;
}

/**
 * 计算底牌中的总分数
 * @param {Array} bottomCards - 底牌数组
 * @returns {Number} 底牌总分
 */
export function calculateBottomPoints(bottomCards, pointResolver = getCardPoints) {
  return calculateRoundPoints(bottomCards, pointResolver);
}

/**
 * 生成得分结果摘要
 * @param {Object} params - 参数
 * @param {Array} params.collectedPointCards - 闲家收集的分数牌
 * @param {Number} params.attackerScore - 闲家总得分
 * @param {Array} params.bottomCards - 底牌
 * @param {Boolean} params.attackerWonLastRound - 闲家是否赢了最后一轮
 * @param {Number} params.bottomMultiplier - 底牌倍数
 * @param {Number} params.bottomPoints - 底牌分数
 * @returns {Object} 结果摘要
 */
export function generateScoringSummary(params) {
  const {
    collectedPointCards,
    attackerScore,
    bottomCards,
    attackerWonLastRound,
    bottomMultiplier,
    bottomPoints,
    bottomScoreGained: suppliedBottomScoreGained = null,
    ambushRank = null,
    ambushCardCount = 0,
    ambushPoints = 0,
    ambushScoreDelta = 0,
    ambushAttackerNetCardDelta = 0,
    ambushAttackerNetCardCount = 0,
    ambushRevealedFromBottom = false
  } = params;

  const bottomScoreGained = Number.isFinite(suppliedBottomScoreGained)
    ? suppliedBottomScoreGained
    : (attackerWonLastRound ? bottomPoints * bottomMultiplier : 0);

  return {
    // 闲家收集的分数牌
    collectedPointCards,
    // 闲家基础得分（不含底牌）
    baseScore: attackerScore - bottomScoreGained,
    // 底牌分数
    bottomPoints,
    // 底牌倍数
    bottomMultiplier,
    // 从底牌获得的分数
    bottomScoreGained,
    // “十面埋伏”底牌中的反向五分牌结算。
    ambushRank,
    ambushCardCount,
    ambushPoints,
    ambushScoreDelta,
    ambushAttackerNetCardDelta,
    ambushAttackerNetCardCount,
    ambushRevealedFromBottom,
    // 闲家总得分
    totalScore: attackerScore,
    // 是否闲家拿底
    attackerWonBottom: attackerWonLastRound,
    // 结果文字
    resultText: attackerWonLastRound ? '闲家拿底' : '庄家守底'
  };
}

/**
 * 根据闲家得分计算升级数
 * @param {Number} attackerScore - 闲家总得分
 * @returns {Object} { attackerWon: boolean, dealerLevelUp: number, attackerLevelUp: number }
 */
export function calculateLevelUpgrade(attackerScore) {
  // 闲家得分>=80，闲家获胜
  const attackerWon = attackerScore >= 80;

  let dealerLevelUp = 0;
  let attackerLevelUp = 0;

  if (attackerWon) {
    // 闲家获胜
    if (attackerScore >= 200) {
      attackerLevelUp = 3;
    } else if (attackerScore >= 160) {
      attackerLevelUp = 2;
    } else if (attackerScore >= 120) {
      attackerLevelUp = 1;
    } else {
      // 80 <= attackerScore < 120，双方都不升级
      attackerLevelUp = 0;
    }
  } else {
    // 庄家获胜
    if (attackerScore === 0) {
      dealerLevelUp = 3;
    } else if (attackerScore < 40) {
      dealerLevelUp = 2;
    } else {
      // 40 <= attackerScore < 80
      dealerLevelUp = 1;
    }
  }

  return {
    attackerWon,
    dealerLevelUp,
    attackerLevelUp
  };
}

/**
 * 升级等级（处理A->2的循环）
 * 等级顺序：2, 3, 4, 5, 6, 7, 8, 9, 10, J(11), Q(12), K(13), A(14)
 * @param {Number} currentLevel - 当前等级 (2-14)
 * @param {Number} levels - 要升的级数
 * @returns {Number} 新等级 (2-14)
 */
export function upgradeLevel(currentLevel, levels) {
  if (levels === 0) {
    return currentLevel;
  }

  let newLevel = currentLevel + levels;

  // 处理超过A(14)的情况，循环回到2
  while (newLevel > 14) {
    newLevel = newLevel - 13; // 14 -> 2, 15 -> 3, 等等
  }

  return newLevel;
}

/**
 * 计算下一局庄家索引
 * @param {Number} currentDealerIndex - 当前庄家索引
 * @param {Boolean} attackerWon - 闲家是否获胜
 * @param {Number} totalPlayers - 总玩家数
 * @returns {Number} 下一局庄家索引
 */
export function getNextDealerIndex(currentDealerIndex, attackerWon, totalPlayers = 4) {
  if (attackerWon) {
    // 闲家获胜，下一局由当前庄家的下家坐庄
    return (currentDealerIndex + 1) % totalPlayers;
  } else {
    // 庄家获胜，下一局由庄家的对家上庄
    return (currentDealerIndex + 2) % totalPlayers;
  }
}
