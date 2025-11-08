import { v4 as uuidv4 } from 'uuid';
import { GameState } from './GameState.js';
import { DEFAULT_CONFIG } from '../utils/constants.js';

export class Room {
  constructor(name, hostSocketId, config = {}) {
    this.id = uuidv4();
    this.name = name;
    this.hostId = hostSocketId;
    this.players = [];
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
      playerCount: this.players.length,
      maxPlayers: this.config.maxPlayers,
      gameState: this.gameState.toJSON(),
      config: this.config,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}
