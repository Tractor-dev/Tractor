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
  SET_BOT_TYPE: 'set_bot_type',
  ADD_BOT: 'add_bot',
  REMOVE_BOT: 'remove_bot',

  // 游戏控制
  START_GAME: 'start_game',
  SET_BURYING_PLAYER: 'set_burying_player',
  SET_FIRST_PLAYER: 'set_first_player',
  RESTART_GAME: 'restart_game',

  // 玩家操作
  SHOW_CARDS: 'show_cards',
  DECLARE_TRUMP: 'declare_trump',
  BURY_CARDS: 'bury_cards',
  PLAY_CARDS: 'play_cards',
  PASS_TURN: 'pass_turn',
  UNDO_PLAY: 'undo_play',
  UPDATE_SCORE: 'update_score',
  UPDATE_LEVEL: 'update_level',
  UPDATE_PLAYER_NAME: 'update_player_name',
  CONFIRM_REVEAL: 'confirm_reveal',
  VIEW_MY_BOTTOM_CARDS: 'view_my_bottom_cards',
  REORDER_CARDS: 'reorder_cards',
  SEND_CHAT_MESSAGE: 'send_chat_message',
  SELECT_RULE: 'select_rule',
  REFRESH_DOUBLE_HAPPINESS_OPTION: 'refresh_double_happiness_option',
  SUBMIT_CARD_EXCHANGE: 'submit_card_exchange',
  SUBMIT_ICEBERG_REVEALS: 'submit_iceberg_reveals',
  SELECT_TEN_SIDED_AMBUSH_RANK: 'select_ten_sided_ambush_rank',
  SELECT_WAITING_RABBIT_TARGET: 'select_waiting_rabbit_target',
  ACTIVATE_LATE_MOVER_ADVANTAGE: 'activate_late_mover_advantage',
  ACTIVATE_RECOMMEND_TALENT: 'activate_recommend_talent',
  ACTIVATE_MAGIC_TRICK: 'activate_magic_trick',
  ACTIVATE_EQUIVALENT_RECIPROCITY: 'activate_equivalent_reciprocity',
  ACTIVATE_MUTUAL_SUPPORT: 'activate_mutual_support',
  ACTIVATE_CULTURAL_REVOLUTION: 'activate_cultural_revolution',
  ACTIVATE_INVITE_INTO_URN: 'activate_invite_into_urn',
  ACTIVATE_BUSH_GATE: 'activate_bush_gate',
  RESPOND_TEAMMATE_CHEER: 'respond_teammate_cheer',
  RESPOND_AFTERGLOW: 'respond_afterglow',
  RESPOND_AMBIGUOUS_CHOICE: 'respond_ambiguous_choice',
  ACTIVATE_DREAM_KILLING: 'activate_dream_killing',
  ACTIVATE_FORBIDDEN_MAGIC: 'activate_forbidden_magic',
  RESPOND_FORBIDDEN_MAGIC: 'respond_forbidden_magic',
  RESPOND_REMOVE_FIREWOOD: 'respond_remove_firewood',
  RESPOND_MAINSTAY: 'respond_mainstay',
  SUBMIT_MAINSTAY_CARDS: 'submit_mainstay_cards',
  SUBMIT_EQUIVALENT_RECIPROCITY_CARD: 'submit_equivalent_reciprocity_card',
  SUBMIT_MUTUAL_SUPPORT_CARDS: 'submit_mutual_support_cards',
  SELECT_THREE_POWERS_RANK: 'select_three_powers_rank',
  SELECT_GENTLEMAN_PROMISE_SUIT: 'select_gentleman_promise_suit',
  SELECT_HIDDEN_DRAGON_RANK: 'select_hidden_dragon_rank',
  SELECT_ANTINOMY_CARD: 'select_antinomy_card',
  SELECT_RICE_TO_MULBERRY_CARDS: 'select_rice_to_mulberry_cards',
  RESPOND_DESTROY_DYKE: 'respond_destroy_dyke',
  SELECT_ADMINISTRATIVE_REVIEW: 'select_administrative_review',
  RESPOND_POLITICAL_REVIEW: 'respond_political_review',
  VOTE_FOCUS_FIGURE: 'vote_focus_figure',
  ACTIVATE_TIME_REVERSAL: 'activate_time_reversal',
  RESPOND_TIME_REVERSAL: 'respond_time_reversal',
  ACTIVATE_LURE_TIGER: 'activate_lure_tiger',
  RESPOND_LURE_TIGER: 'respond_lure_tiger',
  SELECT_LURE_TIGER_TARGET: 'select_lure_tiger_target',
  RESPOND_STRAW_BOAT_BORROWING_ARROWS: 'respond_straw_boat_borrowing_arrows',
  RESPOND_WAITING_RABBIT: 'respond_waiting_rabbit'
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

// 花色排序 (黑桃、红桃、梅花、方片)
export const SUIT_ORDER = {
  [Suits.SPADES]: 0,
  [Suits.HEARTS]: 1,
  [Suits.CLUBS]: 2,
  [Suits.DIAMONDS]: 3,
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

// 服务器URL配置
// 生产环境：使用当前域名（前后端在同一服务器）
// 开发环境：使用 localhost:5001
const viteEnv = import.meta.env || {};
const injectedServerUrl = typeof __TRACTOR_SERVER_URL__ !== 'undefined'
  ? __TRACTOR_SERVER_URL__
  : undefined;
const configuredServerUrl = typeof import.meta.env !== 'undefined'
  ? import.meta.env.VITE_SERVER_URL
  : undefined;
export const SERVER_URL = injectedServerUrl || configuredServerUrl ||
  (viteEnv.PROD && typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5001');
