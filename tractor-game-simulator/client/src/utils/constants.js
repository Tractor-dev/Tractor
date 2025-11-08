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

// 服务器URL
export const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';
