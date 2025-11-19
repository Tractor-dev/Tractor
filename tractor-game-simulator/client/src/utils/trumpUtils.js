import { Suits, Ranks } from './constants.js';

/**
 * 亮主类型
 */
export const DeclarationTypes = {
  SINGLE_RANK: 'single_rank',      // 单张级牌
  PAIR_RANK: 'pair_rank',          // 一对级牌
  PAIR_SMALL_JOKER: 'pair_small_joker',  // 一对小王
  PAIR_BIG_JOKER: 'pair_big_joker'      // 一对大王
};

/**
 * 亮主强度（数字越大越强）
 */
export const DeclarationStrength = {
  [DeclarationTypes.SINGLE_RANK]: 1,
  [DeclarationTypes.PAIR_RANK]: 2,
  [DeclarationTypes.PAIR_SMALL_JOKER]: 3,
  [DeclarationTypes.PAIR_BIG_JOKER]: 4
};

/**
 * 检测手牌中可以亮主的情况
 * @param {Array} cards - 手牌
 * @param {String} trumpRank - 级牌（如 '2'）
 * @param {Object} currentTrump - 当前已亮的主牌 {suit, declarationType, strength, playerId}
 * @param {String} currentPlayerId - 当前玩家ID
 * @returns {Array} 可用的亮主选项 [{type, suit, count, canDeclare, description, strength, declarationType}]
 */
export function detectAvailableDeclarations(cards, trumpRank, currentTrump = null, currentPlayerId = null) {
  if (!cards || cards.length === 0 || !trumpRank) {
    return [];
  }

  const declarations = [];
  const currentStrength = currentTrump ? currentTrump.strength : 0;

  // 检查是否是自己亮的主
  const isSelfDeclared = currentTrump && currentPlayerId && currentTrump.playerId === currentPlayerId;

  // 统计各花色的级牌数量
  const rankCounts = {
    [Suits.SPADES]: 0,
    [Suits.HEARTS]: 0,
    [Suits.CLUBS]: 0,
    [Suits.DIAMONDS]: 0
  };

  // 统计王的数量
  const jokerCounts = {
    [Ranks.SMALL_JOKER]: 0,
    [Ranks.BIG_JOKER]: 0
  };

  // 遍历手牌统计
  cards.forEach(card => {
    if (card.rank === trumpRank && card.suit !== Suits.JOKER) {
      rankCounts[card.suit]++;
    } else if (card.suit === Suits.JOKER) {
      jokerCounts[card.rank]++;
    }
  });

  // 检查各花色的级牌
  Object.entries(rankCounts).forEach(([suit, count]) => {
    const suitType = getSuitType(suit);

    // 如果是自己亮的主
    if (isSelfDeclared) {
      // 只能加固同花色
      if (currentTrump.suit === suit) {
        // 只有当前是单张，且有一对时，才能加固
        if (currentTrump.declarationType === DeclarationTypes.SINGLE_RANK && count >= 2) {
          declarations.push({
            type: suitType,
            suit: suit,
            count: 2,
            canDeclare: true,
            isReinforce: true,
            description: `可加固为一对${getSuitSymbol(suit)}${trumpRank}`,
            strength: DeclarationStrength[DeclarationTypes.PAIR_RANK],
            declarationType: DeclarationTypes.PAIR_RANK
          });
        }
        // 不再显示单张选项（已经亮过了）
      }
      // 其他花色不显示（不能自己反自己）
      return;
    }

    // 正常亮主逻辑
    if (count >= 1) {
      const singleStrength = DeclarationStrength[DeclarationTypes.SINGLE_RANK];
      const canDeclareSingle = singleStrength > currentStrength;

      declarations.push({
        type: suitType,
        suit: suit,
        count: 1,
        canDeclare: canDeclareSingle,
        description: canDeclareSingle ? `可亮单张${getSuitSymbol(suit)}${trumpRank}` : `无法反主（需要一对）`,
        strength: singleStrength,
        declarationType: DeclarationTypes.SINGLE_RANK
      });
    }

    if (count >= 2) {
      const pairStrength = DeclarationStrength[DeclarationTypes.PAIR_RANK];
      const canDeclarePair = pairStrength > currentStrength;

      declarations.push({
        type: suitType,
        suit: suit,
        count: 2,
        canDeclare: canDeclarePair,
        description: canDeclarePair ? `可亮一对${getSuitSymbol(suit)}${trumpRank}` : `无法反主（需要一对王）`,
        strength: pairStrength,
        declarationType: DeclarationTypes.PAIR_RANK
      });
    }
  });

  // 检查一对小王
  // 如果当前玩家已经自己亮过主，则不能用不同花色（包括王）来自己反自己
  const forbidDifferentSuitForSelf = isSelfDeclared && currentTrump && currentTrump.suit !== Suits.JOKER && currentTrump.suit !== Suits.NO_TRUMP;

  if (jokerCounts[Ranks.SMALL_JOKER] >= 2) {
    const strength = DeclarationStrength[DeclarationTypes.PAIR_SMALL_JOKER];
    // 如果是自己已亮且规则禁止不同花色自反，则不可声明王
    const canDeclare = (!forbidDifferentSuitForSelf) && (strength > currentStrength);

    declarations.push({
      type: 'joker',
      suit: Suits.JOKER,
      count: 2,
      jokerType: 'small',
      canDeclare: canDeclare,
      description: canDeclare ? '可亮一对小王（无主）' : '无法反主（需要一对大王）',
      strength: strength,
      declarationType: DeclarationTypes.PAIR_SMALL_JOKER
    });
  }

  // 检查一对大王
  if (jokerCounts[Ranks.BIG_JOKER] >= 2) {
    const strength = DeclarationStrength[DeclarationTypes.PAIR_BIG_JOKER];
    const canDeclare = (!forbidDifferentSuitForSelf) && (strength > currentStrength);

    declarations.push({
      type: 'joker',
      suit: Suits.JOKER,
      count: 2,
      jokerType: 'big',
      canDeclare: canDeclare,
      description: canDeclare ? '可亮一对大王（无主）' : '已是最强',
      strength: strength,
      declarationType: DeclarationTypes.PAIR_BIG_JOKER
    });
  }

  return declarations;
}

/**
 * 获取花色对应的类型名称
 */
function getSuitType(suit) {
  const map = {
    [Suits.SPADES]: 'spades',
    [Suits.HEARTS]: 'hearts',
    [Suits.CLUBS]: 'clubs',
    [Suits.DIAMONDS]: 'diamonds'
  };
  return map[suit] || suit;
}

/**
 * 获取花色符号
 */
function getSuitSymbol(suit) {
  const map = {
    [Suits.SPADES]: '♠',
    [Suits.HEARTS]: '♥',
    [Suits.CLUBS]: '♣',
    [Suits.DIAMONDS]: '♦'
  };
  return map[suit] || suit;
}

/**
 * 验证亮主是否合法
 * @param {Array} cards - 手牌
 * @param {String} suit - 要亮的花色
 * @param {Number} count - 数量（1或2）
 * @param {String} trumpRank - 级牌
 * @param {Object} currentTrump - 当前主牌
 * @returns {Object} {valid: boolean, message: string, declarationType: string, strength: number}
 */
export function validateDeclaration(cards, suit, count, trumpRank, currentTrump = null) {
  const declarations = detectAvailableDeclarations(cards, trumpRank, currentTrump);

  const suitType = getSuitType(suit);
  const matchingDeclaration = declarations.find(d =>
    d.type === suitType && d.count === count && d.canDeclare
  );

  if (!matchingDeclaration) {
    return {
      valid: false,
      message: '不满足亮主条件或无法反主',
      declarationType: null,
      strength: 0
    };
  }

  return {
    valid: true,
    message: '亮主成功',
    declarationType: matchingDeclaration.declarationType,
    strength: matchingDeclaration.strength
  };
}
