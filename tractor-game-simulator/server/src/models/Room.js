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
    this.updatedAt = new Date();
  }

  toJSON() {
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
      updatedAt: this.updatedAt
    };
  }
}
