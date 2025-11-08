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
  COUNTER_CLOCKWISE: 'counter-clockwise',
  CUSTOM: 'custom'
};

// 花色
export const Suits = {
  HEARTS: 'hearts',
  DIAMONDS: 'diamonds',
  CLUBS: 'clubs',
  SPADES: 'spades',
  JOKER: 'joker'
};

// 牌面值
export const Ranks = {
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
  SMALL_JOKER: 'small_joker',
  BIG_JOKER: 'big_joker'
};

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
  [Ranks.SMALL_JOKER]: 100,
  [Ranks.BIG_JOKER]: 101
};

// 默认配置
export const DEFAULT_CONFIG = {
  bottomCardsCount: 8,
  dealInterval: 500,
  minDealInterval: 10,
  turnOrder: TurnOrders.COUNTER_CLOCKWISE,
  customTurnOrder: [0, 1, 2, 3],
  minPlayers: 2,
  maxPlayers: 4
};

// 默认玩家属性
export const DEFAULT_PLAYER = {
  score: 0,
  level: 2
};
