// 游戏阶段
export const GamePhases = {
  WAITING: 'waiting',
  DRAWING: 'drawing',
  BURYING: 'burying',
  PLAYING: 'playing',
  REVEALING: 'revealing',
  FINISHED: 'finished'
};

// 出牌模式
export const PlayModes = {
  ORDERED: 'ordered',  // 有序出牌
  FREE: 'free'         // 自由抢先
};

// 出牌顺序
export const TurnOrders = {
  CLOCKWISE: 'clockwise',
  COUNTER_CLOCKWISE: 'counter-clockwise',
  CUSTOM: 'custom'
};

// 花色
export const Suits = {
  HEARTS: 'hearts',
  DIAMONDS: 'diamonds',
  CLUBS: 'clubs',
  SPADES: 'spades',
  JOKER: 'joker',
  NO_TRUMP: 'no_trump' // 无主
};

// 牌面值
export const Ranks = {
  MINUS_TWO: '-2',
  MINUS_ONE: '-1',
  ZERO: '0',
  ONE: '1',
  TWO: '2',
  THREE: '3',
  FOUR: '4',
  FIVE: '5',
  SIX: '6',
  SEVEN: '7',
  EIGHT: '8',
  NINE: '9',
  TEN: '10',
  JACK: 'J',
  QUEEN: 'Q',
  KING: 'K',
  ACE: 'A',
  BONUS_ONE: 'B',
  BONUS_TWO: 'C',
  BONUS_THREE: 'D',
  NO_TRUMP_MINUS: 'M',
  SMALL_JOKER: 'small_joker',
  BIG_JOKER: 'big_joker',
  COUNTY_PRINCE_JOKER: 'county_prince_joker',
  PRINCE_JOKER: 'prince_joker',
  WHITE_JOKER: 'white_joker'
};

export const STANDARD_ORDINARY_RANKS = Object.freeze([
  Ranks.TWO, Ranks.THREE, Ranks.FOUR, Ranks.FIVE, Ranks.SIX,
  Ranks.SEVEN, Ranks.EIGHT, Ranks.NINE, Ranks.TEN,
  Ranks.JACK, Ranks.QUEEN, Ranks.KING, Ranks.ACE
]);

export const PROMOTED_ORDINARY_RANKS = Object.freeze([
  Ranks.BONUS_ONE,
  Ranks.BONUS_TWO,
  Ranks.BONUS_THREE
]);

export const EXTENDED_ORDINARY_RANKS = Object.freeze([
  Ranks.MINUS_TWO, Ranks.MINUS_ONE, Ranks.ZERO, Ranks.ONE,
  ...STANDARD_ORDINARY_RANKS,
  ...PROMOTED_ORDINARY_RANKS
]);

// 花色排序
export const SUIT_ORDER = {
  [Suits.HEARTS]: 0,
  [Suits.DIAMONDS]: 1,
  [Suits.CLUBS]: 2,
  [Suits.SPADES]: 3,
  [Suits.JOKER]: 4
};

// 牌面值排序
export const RANK_ORDER = {
  [Ranks.MINUS_TWO]: -2,
  [Ranks.MINUS_ONE]: -1,
  [Ranks.ZERO]: 0,
  [Ranks.ONE]: 1,
  [Ranks.TWO]: 2,
  [Ranks.THREE]: 3,
  [Ranks.FOUR]: 4,
  [Ranks.FIVE]: 5,
  [Ranks.SIX]: 6,
  [Ranks.SEVEN]: 7,
  [Ranks.EIGHT]: 8,
  [Ranks.NINE]: 9,
  [Ranks.TEN]: 10,
  [Ranks.JACK]: 11,
  [Ranks.QUEEN]: 12,
  [Ranks.KING]: 13,
  [Ranks.ACE]: 14,
  [Ranks.BONUS_ONE]: 15,
  [Ranks.BONUS_TWO]: 16,
  [Ranks.BONUS_THREE]: 17,
  [Ranks.NO_TRUMP_MINUS]: 18,
  [Ranks.SMALL_JOKER]: 100,
  [Ranks.BIG_JOKER]: 101,
  [Ranks.COUNTY_PRINCE_JOKER]: 102,
  [Ranks.PRINCE_JOKER]: 103,
  [Ranks.WHITE_JOKER]: 104
};

// Bot类型
export const BotTypes = {
  SIMPLE: 'simple',
  WHO_DESIGNED: 'who_designed'
};

// 默认配置
export const DEFAULT_CONFIG = {
  bottomCardsCount: 8,
  dealInterval: 500,
  minDealInterval: 10,
  turnOrder: TurnOrders.COUNTER_CLOCKWISE,
  customTurnOrder: [0, 1, 2, 3],
  minPlayers: 4,
  maxPlayers: 4,
  botType: BotTypes.WHO_DESIGNED,
  testMode: false,
  testRuleId: null
};

// 默认玩家属性
export const DEFAULT_PLAYER = {
  score: 0,
  level: 2
};

/**
 * 将等级转换为牌面值
 * @param {number} level - 玩家等级 (2-14)
 * @returns {string} 对应的牌面值
 */
export function levelToRank(level) {
  const levelMap = {
    2: Ranks.TWO,
    3: Ranks.THREE,
    4: Ranks.FOUR,
    5: Ranks.FIVE,
    6: Ranks.SIX,
    7: Ranks.SEVEN,
    8: Ranks.EIGHT,
    9: Ranks.NINE,
    10: Ranks.TEN,
    11: Ranks.JACK,
    12: Ranks.QUEEN,
    13: Ranks.KING,
    14: Ranks.ACE
  };
  return levelMap[level] || Ranks.TWO;
}

/**
 * 规范化牌面值，确保返回正确的 Ranks 常量
 * @param {number|string} rank - 牌面值（可能是数字或字符串）
 * @returns {string} 规范化后的牌面值
 */
export function normalizeRank(rank) {
  // 如果已经是有效的 Ranks 常量值，直接返回
  const validRanks = Object.values(Ranks);
  if (validRanks.includes(rank)) {
    return rank;
  }

  // 如果是数字，使用 levelToRank 转换
  const numRank = Number(rank);
  if (!isNaN(numRank) && numRank >= 2 && numRank <= 14) {
    return levelToRank(numRank);
  }

  // 字符串形式的数字 "2"-"10"
  if (typeof rank === 'string' && /^\d+$/.test(rank)) {
    const num = parseInt(rank, 10);
    if (num >= 2 && num <= 10) {
      return levelToRank(num);
    }
  }

  // 默认返回 2
  return Ranks.TWO;
}
