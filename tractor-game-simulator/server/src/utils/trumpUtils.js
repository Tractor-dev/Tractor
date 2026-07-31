import { Suits, Ranks, normalizeRank } from './constants.js';

/**
 * 亮主类型
 */
export const DeclarationTypes = {
  SINGLE_RANK: 'single_rank',      // 单张级牌
  PAIR_RANK: 'pair_rank',          // 一对级牌
  PAIR_SMALL_JOKER: 'pair_small_joker',  // 一对小王
  PAIR_BIG_JOKER: 'pair_big_joker',      // 一对大王
  PAIR_COUNTY_PRINCE_JOKER: 'pair_county_prince_joker', // 一对郡王
  PAIR_PRINCE_JOKER: 'pair_prince_joker' // 一对亲王
};

/**
 * 亮主强度（数字越大越强）
 */
export const DeclarationStrength = {
  [DeclarationTypes.SINGLE_RANK]: 1,
  [DeclarationTypes.PAIR_RANK]: 2,
  [DeclarationTypes.PAIR_SMALL_JOKER]: 3,
  [DeclarationTypes.PAIR_BIG_JOKER]: 4,
  [DeclarationTypes.PAIR_COUNTY_PRINCE_JOKER]: 5,
  [DeclarationTypes.PAIR_PRINCE_JOKER]: 6
};

/**
 * 验证亮主是否合法
 * @param {Array} cards - 玩家手牌
 * @param {String} suit - 要亮的花色
 * @param {Number} count - 数量（1或2）
 * @param {String} trumpRank - 级牌
 * @param {Object} currentTrump - 当前主牌 {suit, declarationType, strength, playerId}
 * @param {String} playerId - 当前操作的玩家ID
 * @returns {Object} {valid: boolean, message: string, declarationType: string, strength: number}
 */
export function validateDeclaration(cards, suit, count, trumpRank, currentTrump = null, playerId = null) {
  // 检查是否自己反自己
  if (currentTrump && playerId && currentTrump.playerId === playerId) {
    // 同一玩家，检查是否是"加固"（同花色，从单张升级到一对）
    if (currentTrump.suit === suit || (currentTrump.suit === 'no_trump' && suit === 'joker')) {
      // 加固：必须是从单张升级到一对
      if (currentTrump.declarationType === DeclarationTypes.SINGLE_RANK && count === 2) {
        // 允许加固，继续验证
      } else {
        return {
          valid: false,
          message: '已经亮过了，无法重复亮主',
          declarationType: null,
          strength: 0
        };
      }
    } else {
      // 不同花色，禁止自己反自己
      return {
        valid: false,
        message: '不能自己反自己的主',
        declarationType: null,
        strength: 0
      };
    }
  }
  // 统计符合条件的牌
  let matchingCards = [];

  if (suit === Suits.JOKER || suit === 'joker') {
    // 亮王
    if (count === 2) {
      // 统计大王和小王的数量
      const smallJokers = cards.filter(c => c.suit === Suits.JOKER && c.rank === Ranks.SMALL_JOKER);
      const bigJokers = cards.filter(c => c.suit === Suits.JOKER && c.rank === Ranks.BIG_JOKER);
      const countyPrinceJokers = cards.filter(
        c => c.suit === Suits.JOKER && c.rank === Ranks.COUNTY_PRINCE_JOKER
      );
      const princeJokers = cards.filter(
        c => c.suit === Suits.JOKER && c.rank === Ranks.PRINCE_JOKER
      );

      if (princeJokers.length >= 2) {
        matchingCards = princeJokers.slice(0, 2);
        const declarationType = DeclarationTypes.PAIR_PRINCE_JOKER;
        const strength = DeclarationStrength[declarationType];

        if (currentTrump && strength <= currentTrump.strength) {
          return {
            valid: false,
            message: '无法反主：需要更强的牌',
            declarationType: null,
            strength: 0
          };
        }

        return {
          valid: true,
          message: '亮一对亲王成功',
          declarationType,
          strength,
          jokerType: 'prince',
          cards: matchingCards
        };
      } else if (countyPrinceJokers.length >= 2) {
        matchingCards = countyPrinceJokers.slice(0, 2);
        const declarationType = DeclarationTypes.PAIR_COUNTY_PRINCE_JOKER;
        const strength = DeclarationStrength[declarationType];

        if (currentTrump && strength <= currentTrump.strength) {
          return {
            valid: false,
            message: '无法反主：需要更强的牌',
            declarationType: null,
            strength: 0
          };
        }

        return {
          valid: true,
          message: '亮一对郡王成功',
          declarationType,
          strength,
          jokerType: 'county_prince',
          cards: matchingCards
        };
      } else if (bigJokers.length >= 2) {
        // 有一对大王
        matchingCards = bigJokers.slice(0, 2);
        const declarationType = DeclarationTypes.PAIR_BIG_JOKER;
        const strength = DeclarationStrength[declarationType];

        if (currentTrump && strength <= currentTrump.strength) {
          return {
            valid: false,
            message: '无法反主：需要更强的牌',
            declarationType: null,
            strength: 0
          };
        }

        return {
          valid: true,
          message: '亮一对大王成功',
          declarationType: declarationType,
          strength: strength,
          jokerType: 'big',
          cards: matchingCards
        };
      } else if (smallJokers.length >= 2) {
        // 有一对小王
        matchingCards = smallJokers.slice(0, 2);
        const declarationType = DeclarationTypes.PAIR_SMALL_JOKER;
        const strength = DeclarationStrength[declarationType];

        if (currentTrump && strength <= currentTrump.strength) {
          return {
            valid: false,
            message: '无法反主：需要更强的牌（如一对大王）',
            declarationType: null,
            strength: 0
          };
        }

        return {
          valid: true,
          message: '亮一对小王成功',
          declarationType: declarationType,
          strength: strength,
          jokerType: 'small',
          cards: matchingCards
        };
      } else {
        return {
          valid: false,
          message: '没有一对王',
          declarationType: null,
          strength: 0
        };
      }
    }
  } else {
    const normTrumpRank = normalizeRank(trumpRank);
    // 亮级牌
    matchingCards = cards.filter(c =>
      String(c.rank) === String(normTrumpRank) &&
      c.suit === suit &&
      c.suit !== Suits.JOKER
    );

    if (matchingCards.length < count) {
      return {
        valid: false,
        message: `没有足够的${suit}${normTrumpRank}`,
        declarationType: null,
        strength: 0
      };
    }

    const declarationType = count === 2 ? DeclarationTypes.PAIR_RANK : DeclarationTypes.SINGLE_RANK;
    const strength = DeclarationStrength[declarationType];

    if (currentTrump && strength <= currentTrump.strength) {
      return {
        valid: false,
        message: '无法反主：需要更强的牌',
        declarationType: null,
        strength: 0
      };
    }

    return {
      valid: true,
      message: `亮${count === 2 ? '一对' : '单张'}${suit}${normTrumpRank}成功`,
      declarationType: declarationType,
      strength: strength,
      cards: matchingCards.slice(0, count)
    };
  }

  return {
    valid: false,
    message: '亮主失败',
    declarationType: null,
    strength: 0
  };
}
