import { GameState } from './GameState.js';
import { DEFAULT_CONFIG } from '../utils/constants.js';

export class Room {
  constructor(name, hostSocketId, config = {}) {
    // 生成4位数字房间ID (1000-9999)
    this.id = String(Math.floor(1000 + Math.random() * 9000));
    this.name = name;
    this.hostId = hostSocketId;
    this.players = [];
    this.spectators = []; // 观战者列表
    this.gameState = new GameState();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.createdAt = new Date();
    this.updatedAt = new Date();
    
    // 断线重连相关
    this.disconnectedPlayers = new Map(); // 保存断线玩家的状态 Map<position, {player, disconnectedAt}>
    this.originalHumanPlayerCount = 0; // 原始真人玩家数量
  }

  addPlayer(player) {
    if (this.players.length >= this.config.maxPlayers) {
      throw new Error('房间已满');
    }
    this.players.push(player);
    this.updatedAt = new Date();
  }

  removePlayer(playerId) {
    this.players = this.players.filter(p => p.id !== playerId);
    this.updatedAt = new Date();
  }

  findPlayerById(playerId) {
    return this.players.find(p => p.id === playerId);
  }

  findPlayerBySocketId(socketId) {
    return this.players.find(p => p.socketId === socketId);
  }

  findPlayerByIndex(index) {
    return this.players[index];
  }

  getPlayerIndex(playerId) {
    return this.players.findIndex(p => p.id === playerId);
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.updatedAt = new Date();
  }

  canStart() {
    return this.players.length >= this.config.minPlayers &&
           this.players.length <= this.config.maxPlayers;
  }

  hasOnlyBots() {
    return this.players.length > 0 && this.players.every(p => p.isBot);
  }

  // 观战者相关方法
  addSpectator(spectator) {
    this.spectators.push(spectator);
    this.updatedAt = new Date();
  }

  removeSpectator(spectatorId) {
    this.spectators = this.spectators.filter(s => s.id !== spectatorId);
    this.updatedAt = new Date();
  }

  findSpectatorById(spectatorId) {
    return this.spectators.find(s => s.id === spectatorId);
  }

  findSpectatorBySocketId(socketId) {
    return this.spectators.find(s => s.socketId === socketId);
  }

  resetForNewGame() {
    this.gameState.reset();
    this.players.forEach(player => player.resetForNewGame());
    // 重置断线玩家列表
    this.disconnectedPlayers.clear();
    this.updatedAt = new Date();
  }

  // 断线重连相关方法
  
  /**
   * 获取真人玩家数量（不包括机器人）
   */
  getHumanPlayerCount() {
    return this.players.filter(p => !p.isBot).length;
  }

  /**
   * 检查是否可以保留游戏状态等待重连
   * 条件：原始真人玩家数量 > 2 且游戏进行中
   */
  canWaitForReconnect() {
    const gameInProgress = this.gameState.phase !== 'waiting' && this.gameState.phase !== 'finished';
    return this.originalHumanPlayerCount > 2 && gameInProgress;
  }

  /**
   * 保存断线玩家状态
   */
  saveDisconnectedPlayer(player) {
    this.disconnectedPlayers.set(player.position, {
      player: player,
      disconnectedAt: new Date()
    });
    // 将玩家设置为离线状态但保留在玩家列表中
    player.isOnline = false;
    this.updatedAt = new Date();
  }

  /**
   * 检查是否有可用的断线玩家位置供重连
   */
  hasDisconnectedSlot() {
    return this.disconnectedPlayers.size > 0;
  }

  /**
   * 获取第一个断线玩家的位置信息
   */
  getFirstDisconnectedSlot() {
    if (this.disconnectedPlayers.size === 0) {
      return null;
    }
    const [position, data] = this.disconnectedPlayers.entries().next().value;
    return { position, ...data };
  }

  /**
   * 让新玩家继承断线玩家的状态
   */
  reconnectPlayer(newSocketId, newPlayerName, position) {
    const disconnectedData = this.disconnectedPlayers.get(position);
    if (!disconnectedData) {
      return null;
    }

    const player = disconnectedData.player;
    // 更新socket和玩家名称
    player.socketId = newSocketId;
    player.name = newPlayerName;
    player.isOnline = true;
    
    // 从断线列表中移除
    this.disconnectedPlayers.delete(position);
    this.updatedAt = new Date();
    
    return player;
  }

  /**
   * 检查房间是否没有在线的真人玩家
   */
  hasNoOnlineHumanPlayers() {
    return this.players.length > 0 && 
           this.players.every(p => p.isBot || !p.isOnline);
  }

  toJSON() {
    // 构建断线玩家位置列表
    const disconnectedPositions = [];
    for (const [position, data] of this.disconnectedPlayers.entries()) {
      disconnectedPositions.push({
        position,
        playerName: data.player.name,
        disconnectedAt: data.disconnectedAt
      });
    }

    return {
      id: this.id,
      name: this.name,
      hostId: this.hostId,
      players: this.players.map(p => p.toJSON()),
      spectators: this.spectators.map(s => s.toJSON()),
      playerCount: this.players.length,
      spectatorCount: this.spectators.length,
      maxPlayers: this.config.maxPlayers,
      gameState: this.gameState.toJSON(),
      config: this.config,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      // 断线重连相关
      hasDisconnectedSlot: this.hasDisconnectedSlot(),
      disconnectedPositions: disconnectedPositions
    };
  }
}
