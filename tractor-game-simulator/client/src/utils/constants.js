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
  ORDERED: 'ordered',
  FREE: 'free'
};

// Socket事件
export const SOCKET_EVENTS = {
  // 房间相关
  CREATE_ROOM: 'create_room',
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  GET_ROOM_LIST: 'get_room_list',
  UPDATE_CONFIG: 'update_config',

  // 游戏控制
  START_GAME: 'start_game',
  SET_BURYING_PLAYER: 'set_burying_player',
  SET_FIRST_PLAYER: 'set_first_player',
  RESTART_GAME: 'restart_game',

  // 玩家操作
  SHOW_CARDS: 'show_cards',
  BURY_CARDS: 'bury_cards',
  PLAY_CARDS: 'play_cards',
  PASS_TURN: 'pass_turn',
  UPDATE_SCORE: 'update_score',
  UPDATE_LEVEL: 'update_level',
  CONFIRM_REVEAL: 'confirm_reveal',
  REORDER_CARDS: 'reorder_cards'
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

// 服务器URL（改为5001以避免与macOS AirPlay冲突）
export const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5001';
