import { GameState } from './GameState.js';
import { DEFAULT_CONFIG } from '../utils/constants.js';
import { getRuleById } from '../rules/ruleRegistry.js';

export class Room {
  constructor(name, hostSocketId, config = {}) {
    // 生成4位数字房间ID (1000-9999)
    this.id = String(Math.floor(1000 + Math.random() * 9000));
    this.name = name;
    this.hostId = hostSocketId;
    this.players = [];
    this.gameState = new GameState();
    this.config = this.validateConfig({
      ...DEFAULT_CONFIG,
      ...config,
      bottomCardsCount: DEFAULT_CONFIG.bottomCardsCount,
      minDealInterval: DEFAULT_CONFIG.minDealInterval,
      minPlayers: 4,
      maxPlayers: 4
    });
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
    this.config = this.validateConfig({
      ...this.config,
      ...newConfig,
      bottomCardsCount: DEFAULT_CONFIG.bottomCardsCount,
      minDealInterval: DEFAULT_CONFIG.minDealInterval,
      minPlayers: 4,
      maxPlayers: 4
    });
    this.updatedAt = new Date();
  }

  validateConfig(config) {
    const testMode = config.testMode === true;
    const testRule = testMode ? getRuleById(config.testRuleId) : null;
    if (testMode && !testRule) {
      throw new Error('测试模式必须选择一条已实现规则');
    }
    // 「无特殊规则」模式：每局直接使用 normal_game，跳过随机二选一。
    // 与 testMode 互斥；同时开启时以 testMode 为准，避免歧义。
    const normalModeOnly = !testMode && config.normalModeOnly === true;
    if (!Number.isInteger(config.bottomCardsCount) ||
        config.bottomCardsCount < 1 ||
        config.bottomCardsCount > 20) {
      throw new Error('底牌数量必须是1-20之间的整数');
    }

    // 四人局必须保证发牌后四家手牌数相同。
    if ((108 - config.bottomCardsCount) % 4 !== 0) {
      throw new Error('底牌数量必须保证剩余牌能由4名玩家平均分配');
    }

    if (!Number.isFinite(config.dealInterval) ||
        config.dealInterval < DEFAULT_CONFIG.minDealInterval ||
        config.dealInterval > 5000) {
      throw new Error(`发牌间隔必须在${DEFAULT_CONFIG.minDealInterval}-5000毫秒之间`);
    }

    if (config.turnOrder === 'custom') {
      const order = config.customTurnOrder;
      const validOrder = Array.isArray(order) &&
        order.length === 4 &&
        new Set(order).size === 4 &&
        order.every(index => Number.isInteger(index) && index >= 0 && index < 4);
      if (!validOrder) {
        throw new Error('自定义出牌顺序必须包含且仅包含玩家索引0、1、2、3');
      }
    }

    return {
      ...config,
      testMode,
      testRuleId: testRule?.id || null,
      normalModeOnly
    };
  }

  canStart() {
    return this.players.length === 4;
  }

  resetForNewGame() {
    this.gameState.reset();
    this.players.forEach(player => player.resetForNewGame());
    this.updatedAt = new Date();
  }

  toJSON() {
    const gameState = this.gameState.toJSON();
    const openHandPlayer = this.findPlayerById(this.gameState.openHandPlayerId);
    const openHandController = this.findPlayerById(this.gameState.openHandControllerPlayerId);
    gameState.openHand = openHandPlayer ? {
      playerId: openHandPlayer.id,
      playerName: openHandPlayer.name,
      controllerPlayerId: openHandController?.id || null,
      controllerPlayerName: openHandController?.name || null,
      cards: openHandPlayer.cards.map(card => card.toJSON())
    } : null;
    if (gameState.twoGhosts) {
      gameState.twoGhosts.revealedHands = this.players
        .filter(player => this.gameState.twoGhostsRevealedPlayerIds.has(player.id))
        .map(player => ({
          playerId: player.id,
          playerName: player.name,
          kind: 'jokers',
          label: '二鬼拍门',
          cards: player.cards
            .filter(card => card.suit === 'joker')
            .map(card => card.toJSON())
        }))
        .filter(hand => hand.cards.length > 0);
    }

    return {
      id: this.id,
      name: this.name,
      hostId: this.hostId,
      players: this.players.map(p => p.toJSON()),
      playerCount: this.players.length,
      maxPlayers: this.config.maxPlayers,
      gameState,
      config: this.config,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}
