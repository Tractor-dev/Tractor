import { GamePhases, PlayModes } from '../utils/constants.js';
import { DrawingPhaseManager } from './DrawingPhaseManager.js';
import { RoundManager } from './RoundManager.js';
import { DeckService } from './DeckService.js';
import { Card } from '../models/Card.js';
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

    // 进入出牌阶段 - 自由出牌模式，任何玩家都可以随时出牌
    this.room.gameState.phase = GamePhases.PLAYING;

    logger.info(`房间 ${this.room.id} 进入自由出牌阶段`);

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
   * 出牌 - 自由出牌模式，任意玩家可随时出牌
   */
  playCards(playerId, cardIds) {
    if (this.room.gameState.phase !== GamePhases.PLAYING) {
      throw new Error('当前不是出牌阶段');
    }

    const player = this.room.findPlayerById(playerId);

    if (!player) {
      throw new Error('玩家不存在');
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
      timestamp: new Date()
    });

    logger.info(`房间 ${this.room.id} 玩家 ${player.name} 出牌 ${cardIds.length} 张`);

    // 检查游戏是否结束（所有玩家手牌为0）
    const allPlayersFinished = this.room.players.every(p => p.cards.length === 0);
    if (allPlayersFinished) {
      this.finishGame();
      return {
        playedCards: validCards.map(c => c.toJSON()),
        remainingCount: player.cards.length,
        gameFinished: true
      };
    }

    return {
      playedCards: validCards.map(c => c.toJSON()),
      remainingCount: player.cards.length,
      gameFinished: false
    };
  }

  /**
   * 撤回上次出牌 - 将上次自己打的牌收回手中
   */
  undoLastPlay(playerId) {
    if (this.room.gameState.phase !== GamePhases.PLAYING) {
      throw new Error('当前不是出牌阶段');
    }

    const player = this.room.findPlayerById(playerId);
    if (!player) {
      throw new Error('玩家不存在');
    }

    // 检查是否有出牌记录
    if (this.room.gameState.playHistory.length === 0) {
      throw new Error('没有可撤回的出牌记录');
    }

    // 找到该玩家最后一次出牌记录
    let lastPlayIndex = -1;
    for (let i = this.room.gameState.playHistory.length - 1; i >= 0; i--) {
      if (this.room.gameState.playHistory[i].playerId === playerId) {
        lastPlayIndex = i;
        break;
      }
    }

    if (lastPlayIndex === -1) {
      throw new Error('没有找到你的出牌记录');
    }

    const lastPlay = this.room.gameState.playHistory[lastPlayIndex];

    // 将牌返回给玩家 - 需要从JSON重新创建Card实例
    lastPlay.cards.forEach(cardData => {
      // 从id解析出copyIndex: "suit-rank-copyIndex"
      const parts = cardData.id.split('-');
      const copyIndex = parseInt(parts[2]) || 0;
      const card = new Card(cardData.suit, cardData.rank, copyIndex);
      player.addCard(card);
    });

    // 自动排序
    player.cards = DeckService.autoSortCards(player.cards);

    // 移除出牌记录
    this.room.gameState.playHistory.splice(lastPlayIndex, 1);

    logger.info(`房间 ${this.room.id} 玩家 ${player.name} 撤回了出牌`);

    return {
      playerId,
      playerName: player.name,
      cards: lastPlay.cards,
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
