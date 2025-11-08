import { GamePhases, PlayModes } from '../utils/constants.js';
import { DrawingPhaseManager } from './DrawingPhaseManager.js';
import { RoundManager } from './RoundManager.js';
import { DeckService } from './DeckService.js';
import logger from '../utils/logger.js';

export class GameEngine {
  constructor(room, io) {
    this.room = room;
    this.io = io;
    this.drawingManager = null;
    this.roundManager = null;
  }

  /**
   * 开始游戏
   */
  startGame() {
    logger.info(`房间 ${this.room.id} 开始游戏`);

    // 重置游戏状态
    this.room.gameState.reset();

    // 创建并启动摸牌管理器
    this.drawingManager = new DrawingPhaseManager(this.room, this.io);
    this.drawingManager.start();

    // 广播游戏开始
    this.io.to(this.room.id).emit('game_started', {
      phase: GamePhases.DRAWING,
      config: this.room.config
    });
  }

  /**
   * 设置埋底玩家
   */
  setBuryingPlayer(playerId) {
    if (this.room.gameState.phase !== GamePhases.BURYING) {
      throw new Error('当前不是埋底阶段');
    }

    const player = this.room.findPlayerById(playerId);
    if (!player) {
      throw new Error('玩家不存在');
    }

    // 将底牌发给埋底玩家
    this.room.gameState.buryingPlayerId = playerId;
    this.room.gameState.bottomCards.forEach(card => {
      player.addCard(card);
    });

    // 自动排序
    player.cards = DeckService.autoSortCards(player.cards);

    logger.info(`房间 ${this.room.id} 埋底玩家: ${player.name}`);

    return player;
  }

  /**
   * 埋底
   */
  buryCards(playerId, cardIds) {
    if (this.room.gameState.phase !== GamePhases.BURYING) {
      throw new Error('当前不是埋底阶段');
    }

    if (this.room.gameState.buryingPlayerId !== playerId) {
      throw new Error('你不是埋底玩家');
    }

    const requiredCount = this.room.config.bottomCardsCount;
    if (cardIds.length !== requiredCount) {
      throw new Error(`必须埋${requiredCount}张牌`);
    }

    const player = this.room.findPlayerById(playerId);

    // 找出要埋的牌
    const cardsTobury = player.cards.filter(card => cardIds.includes(card.id));
    if (cardsTobury.length !== requiredCount) {
      throw new Error('选择的牌不在手中');
    }

    // 移除并更新底牌
    player.removeCards(cardIds);
    this.room.gameState.bottomCards = cardsTobury;

    logger.info(`房间 ${this.room.id} 埋底完成`);

    // 进入出牌阶段，自动设置埋底玩家为首发玩家
    this.room.gameState.phase = GamePhases.PLAYING;
    this.room.gameState.playMode = PlayModes.ORDERED;

    // 自动设置首发玩家为埋底玩家
    const playerIndex = this.room.getPlayerIndex(playerId);
    this.room.gameState.firstPlayerId = playerId;
    this.room.gameState.currentPlayerIndex = playerIndex;
    this.room.gameState.roundStartPlayerIndex = playerIndex;
    this.room.gameState.currentRound = 1;
    this.room.gameState.playersPlayedThisRound.clear();

    // 创建回合管理器
    this.roundManager = new RoundManager(this.room);

    logger.info(`房间 ${this.room.id} 首发玩家（埋底玩家）: ${player.name}`);

    return true;
  }

  /**
   * 设置首发玩家并开始第一轮
   */
  setFirstPlayer(playerId) {
    if (this.room.gameState.phase !== GamePhases.PLAYING) {
      throw new Error('当前不是出牌阶段');
    }

    if (this.room.gameState.currentRound > 0) {
      throw new Error('游戏已经开始，无法设置首发玩家');
    }

    const playerIndex = this.room.getPlayerIndex(playerId);
    if (playerIndex === -1) {
      throw new Error('玩家不存在');
    }

    this.room.gameState.firstPlayerId = playerId;
    this.room.gameState.currentPlayerIndex = playerIndex;
    this.room.gameState.roundStartPlayerIndex = playerIndex;
    this.room.gameState.currentRound = 1;
    this.room.gameState.playersPlayedThisRound.clear();

    // 创建回合管理器
    this.roundManager = new RoundManager(this.room);

    logger.info(`房间 ${this.room.id} 首发玩家: ${this.room.findPlayerById(playerId).name}`);

    return this.room.findPlayerByIndex(playerIndex);
  }

  /**
   * 出牌
   */
  playCards(playerId, cardIds) {
    if (this.room.gameState.phase !== GamePhases.PLAYING) {
      throw new Error('当前不是出牌阶段');
    }

    const player = this.room.findPlayerById(playerId);
    const playerIndex = this.room.getPlayerIndex(playerId);

    if (!player) {
      throw new Error('玩家不存在');
    }

    // 验证是否轮到该玩家
    if (!this.roundManager.canPlayerPlay(playerIndex)) {
      throw new Error('还没轮到你出牌');
    }

    // 验证牌是否在手中
    const validCards = player.cards.filter(card => cardIds.includes(card.id));
    if (validCards.length !== cardIds.length) {
      throw new Error('选择的牌不在手中');
    }

    // 移除牌
    player.removeCards(cardIds);

    // 记录出牌
    this.room.gameState.playHistory.push({
      playerId,
      playerName: player.name,
      cards: validCards.map(c => c.toJSON()),
      timestamp: new Date(),
      round: this.room.gameState.currentRound
    });

    // 处理回合逻辑
    const roundResult = this.roundManager.onPlayerPlayed(playerIndex);

    // 检查游戏是否结束
    if (this.roundManager.isGameFinished()) {
      this.finishGame();
      return { ...roundResult, gameFinished: true };
    }

    return {
      ...roundResult,
      playedCards: validCards.map(c => c.toJSON()),
      remainingCount: player.cards.length
    };
  }

  /**
   * 结束游戏
   */
  finishGame() {
    this.room.gameState.phase = GamePhases.REVEALING;
    this.room.gameState.endTime = new Date();

    logger.info(`房间 ${this.room.id} 游戏结束`);

    // 重置确认状态
    this.room.players.forEach(p => p.hasConfirmedReveal = false);
  }

  /**
   * 玩家确认查看底牌
   */
  confirmReveal(playerId) {
    const player = this.room.findPlayerById(playerId);
    if (player) {
      player.hasConfirmedReveal = true;
    }

    // 检查是否所有人都确认了
    const allConfirmed = this.room.players.every(p => p.hasConfirmedReveal);
    if (allConfirmed) {
      this.room.gameState.phase = GamePhases.FINISHED;
      logger.info(`房间 ${this.room.id} 所有玩家已确认，游戏完全结束`);
    }

    return allConfirmed;
  }

  /**
   * 重新开始游戏
   */
  restartGame() {
    this.room.resetForNewGame();
    this.startGame();
  }

  /**
   * 清理游戏资源（停止所有定时器等）
   */
  cleanup() {
    logger.info(`清理房间 ${this.room.id} 的游戏引擎资源`);

    // 停止摸牌管理器
    if (this.drawingManager) {
      this.drawingManager.stop();
      this.drawingManager = null;
    }

    // 停止回合管理器（如果有需要清理的资源）
    if (this.roundManager) {
      this.roundManager = null;
    }
  }
}
