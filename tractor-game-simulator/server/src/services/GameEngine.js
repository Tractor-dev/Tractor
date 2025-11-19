import { GamePhases, PlayModes } from '../utils/constants.js';
import { DrawingPhaseManager } from './DrawingPhaseManager.js';
import { RoundManager } from './RoundManager.js';
import { DeckService } from './DeckService.js';
import { Card } from '../models/Card.js';
import logger from '../utils/logger.js';
import {
  detectPattern,
  validateLeadingPlay,
  validateFollowingPlay,
  compareCards,
  parseThrowCombination,
  validateThrow,
  PatternTypes
} from '../utils/cardPatternUtils.js';

export class GameEngine {
  constructor(room, io) {
    this.room = room;
    this.io = io;
    this.drawingManager = null;
    this.roundManager = null;
  }

  /**
   * 开始游戏 - 进入准备等待阶段
   */
  startGame() {
    logger.info(`房间 ${this.room.id} 开始游戏 - 等待玩家准备`);

    // 重置游戏状态
    this.room.gameState.reset();

    // 重置所有玩家的准备状态
    this.room.players.forEach(player => {
      player.isReady = false;
    });

    // 标记为等待准备状态（保持在WAITING阶段）
    this.room.gameState.isWaitingForReady = true;

    // Bot自动准备
    this.room.players.filter(p => p.isBot).forEach(bot => {
      bot.isReady = true;
    });

    // 广播进入准备等待状态
    this.io.to(this.room.id).emit('game_started', {
      phase: GamePhases.WAITING,
      isWaitingForReady: true,
      config: this.room.config
    });
  }

  /**
   * 玩家准备/取消准备
   */
  playerReady(playerId) {
    if (!this.room.gameState.isWaitingForReady) {
      throw new Error('当前不在准备等待阶段');
    }

    const player = this.room.findPlayerById(playerId);
    if (!player) {
      throw new Error('玩家不存在');
    }

    if (player.isBot) {
      throw new Error('Bot无需准备');
    }

    // 切换准备状态
    player.isReady = !player.isReady;
    logger.info(`房间 ${this.room.id} 玩家 ${player.name} ${player.isReady ? '已准备' : '取消准备'}`);

    // 检查是否所有真人玩家都准备好了
    const humanPlayers = this.room.players.filter(p => !p.isBot);
    const allReady = humanPlayers.every(p => p.isReady);

    if (allReady) {
      logger.info(`房间 ${this.room.id} 所有玩家准备完毕，开始发牌`);
      // 清除准备等待状态
      this.room.gameState.isWaitingForReady = false;
      this.startDrawing();
    }

    return allReady;
  }

  /**
   * 开始发牌
   */
  startDrawing() {
    // 创建并启动摸牌管理器
    this.drawingManager = new DrawingPhaseManager(this.room, this.io);
    this.drawingManager.start();

    // 广播开始发牌
    this.io.to(this.room.id).emit('start_drawing', {
      phase: GamePhases.DRAWING
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

    // 进入出牌阶段
    this.room.gameState.phase = GamePhases.PLAYING;

    // 埋底玩家自动成为首发玩家，开始第一轮
    const playerIndex = this.room.getPlayerIndex(playerId);
    this.room.gameState.firstPlayerId = playerId;
    this.room.gameState.currentPlayerIndex = playerIndex;
    this.room.gameState.roundStartPlayerIndex = playerIndex;
    this.room.gameState.currentRound = 1;
    this.room.gameState.playMode = PlayModes.ORDERED;
    this.room.gameState.playersPlayedThisRound.clear();

    // 创建回合管理器
    this.roundManager = new RoundManager(this.room);

    logger.info(`房间 ${this.room.id} 进入出牌阶段，${player.name} 先出牌`);

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
   * 出牌 - 按照双升规则，有序出牌
   */
  playCards(playerId, cardIds) {
    if (this.room.gameState.phase !== GamePhases.PLAYING) {
      throw new Error('当前不是出牌阶段');
    }

    const player = this.room.findPlayerById(playerId);

    if (!player) {
      throw new Error('玩家不存在');
    }

    // 如果还没有回合管理器，说明还未设置首发玩家
    if (!this.roundManager) {
      throw new Error('还未设置首发玩家');
    }

    // 获取玩家索引
    const playerIndex = this.room.getPlayerIndex(playerId);

    // 验证是否轮到该玩家出牌
    if (!this.roundManager.canPlayerPlay(playerIndex)) {
      const mode = this.room.gameState.playMode;
      if (mode === PlayModes.ORDERED) {
        const currentPlayer = this.room.findPlayerByIndex(this.room.gameState.currentPlayerIndex);
        throw new Error(`现在不是你的回合，请等待 ${currentPlayer.name} 出牌`);
      }
    }

    // 验证牌是否在手中
    let validCards = player.cards.filter(card => cardIds.includes(card.id));
    // 保存原始请求的牌（用于在甩牌失败时通知客户端哪些牌需要被退回）
    const originalRequestedCardIds = [...cardIds];
    const originalRequestedCards = [...validCards];
    if (validCards.length !== cardIds.length) {
      throw new Error('选择的牌不在手中');
    }

    const trumpSuit = this.room.gameState.trumpSuit;
    const trumpRank = this.room.gameState.trumpRank;

    // 判断是首发还是跟牌
    const isLeading = this.room.gameState.currentRoundPlays.length === 0;

    let pattern;
    let throwResult = null;
    let throwFailed = false;

    if (isLeading) {
      // 首发出牌验证
      const validation = validateLeadingPlay(validCards, trumpSuit, trumpRank);
      if (!validation.valid) {
        throw new Error(validation.message);
      }
      pattern = validation.pattern;

      // 检测是否是甩牌（多个组件的组合）
      const parsed = parseThrowCombination(validCards, trumpSuit, trumpRank);
      if (parsed.valid && parsed.components.length > 1) {
        // 这是一个甩牌尝试
        logger.info(`玩家 ${player.name} 尝试甩牌，包含 ${parsed.components.length} 个组件`);

        // 获取其他玩家的手牌
        const otherPlayersCards = this.room.players
          .filter(p => p.id !== playerId)
          .map(p => p.cards);

        // 验证甩牌
        throwResult = validateThrow(validCards, otherPlayersCards, trumpSuit, trumpRank);

        if (!throwResult.success) {
          // 甩牌失败，强制出小
          logger.info(`甩牌失败：${throwResult.message}，强制出最小组件`);
          throwFailed = true;

          // 替换为强制出的牌
          validCards = throwResult.forcedCards;
          cardIds = validCards.map(c => c.id);

          // 重新检测牌型
          pattern = detectPattern(validCards, trumpSuit, trumpRank);
        } else {
          // 甩牌成功
          logger.info(`甩牌成功！包含组件：${throwResult.components.map(c => c.type).join(', ')}`);

          // 将牌型标记为甩牌
          pattern = {
            type: PatternTypes.THROW,
            suit: throwResult.suit,
            components: throwResult.components,
            length: validCards.length,
            strength: Math.max(...throwResult.components.map(c => c.strength))
          };
        }
      }

      // 记录首发牌型
      this.room.gameState.leadingPattern = pattern;
      this.room.gameState.currentWinnerIndex = playerIndex;
    } else {
      // 跟牌验证
      const leadingPattern = this.room.gameState.leadingPattern;
      const validation = validateFollowingPlay(
        validCards,
        player.cards,
        leadingPattern,
        trumpSuit,
        trumpRank
      );
      if (!validation.valid) {
        throw new Error(validation.message);
      }
      pattern = validation.pattern || detectPattern(validCards, trumpSuit, trumpRank);

      // 比较大小，更新当前最大者
      const currentWinnerIndex = this.room.gameState.currentWinnerIndex;
      const currentWinnerPlay = this.room.gameState.currentRoundPlays.find(
        p => p.playerIndex === currentWinnerIndex
      );

      if (currentWinnerPlay) {
        const comparison = compareCards(
          { cards: validCards, pattern, playerIndex },
          { cards: currentWinnerPlay.cards, pattern: currentWinnerPlay.pattern, playerIndex: currentWinnerIndex },
          this.room.gameState.leadingPattern.suit,
          trumpSuit,
          trumpRank
        );

        if (comparison > 0) {
          // 新出的牌更大
          const previousWinnerIndex = this.room.gameState.currentWinnerIndex;
          this.room.gameState.currentWinnerIndex = playerIndex;
          logger.info(`房间 ${this.room.id} 玩家 ${player.name} 的牌更大`);

          // 检测毙了/盖毙
          const newIsTrump = pattern.suit === 'trump';
          const oldIsTrump = currentWinnerPlay.pattern.suit === 'trump';
          const leadIsTrump = this.room.gameState.leadingPattern.suit === 'trump';

          // 只有首牌是副牌时，才能有"毙了"和"盖毙"
          if (!leadIsTrump) {
            if (newIsTrump && oldIsTrump) {
              // 盖毙：首牌是副牌，之前有人用主牌"毙了"，现在用更大的主牌再压掉
              this.room.gameState.trumpAction = {
                type: 'overtrump',
                playerId: player.id,
                playerName: player.name
              };
              logger.info(`房间 ${this.room.id} 玩家 ${player.name} 盖毙！`);
            } else if (newIsTrump && !oldIsTrump) {
              // 毙了：首牌是副牌，用主牌压副牌
              this.room.gameState.trumpAction = {
                type: 'trump',
                playerId: player.id,
                playerName: player.name
              };
              logger.info(`房间 ${this.room.id} 玩家 ${player.name} 毙了！`);
            }
          }
        }
      }
    }

    // 移除牌
    player.removeCards(cardIds);

    // 记录当前轮出牌
    this.room.gameState.currentRoundPlays.push({
      playerIndex,
      playerId,
      cards: validCards,
      pattern
    });

    // 记录出牌历史
    this.room.gameState.playHistory.push({
      playerId,
      playerName: player.name,
      playerIndex,
      cards: validCards.map(c => c.toJSON()),
      timestamp: new Date()
    });

    logger.info(`房间 ${this.room.id} 玩家 ${player.name} 出牌 ${cardIds.length} 张`);

    // 更新回合状态
    logger.info(`[调试] 调用 onPlayerPlayed 前: playersPlayedThisRound.size=${this.room.gameState.playersPlayedThisRound.size}, players.length=${this.room.players.length}`);
    const roundUpdate = this.roundManager.onPlayerPlayed(playerIndex);
    logger.info(`[调试] 调用 onPlayerPlayed 后: playersPlayedThisRound.size=${this.room.gameState.playersPlayedThisRound.size}, roundUpdate.type=${roundUpdate?.type}`);

    // 检查本轮是否结束
    let roundWinner = null;
    if (this.room.gameState.playersPlayedThisRound.size === this.room.players.length) {
      logger.info(`[调试] 检测到轮次结束，当前轮: ${this.room.gameState.currentRound}`);
      // 本轮结束，确定获胜者
      const winnerIndex = this.room.gameState.currentWinnerIndex;
      const winner = this.room.findPlayerByIndex(winnerIndex);
      roundWinner = {
        playerIndex: winnerIndex,
        playerId: winner.id,
        playerName: winner.name
      };

      logger.info(`房间 ${this.room.id} 第${this.room.gameState.currentRound}轮结束，${winner.name} 获胜`);

      // 清空当前轮出牌记录，准备下一轮
      this.room.gameState.currentRoundPlays = [];
      this.room.gameState.leadingPattern = null;

      // 设置下一轮的首发玩家（获胜者）
      this.room.gameState.roundStartPlayerIndex = winnerIndex;
      this.room.gameState.currentPlayerIndex = winnerIndex;
      this.room.gameState.currentWinnerIndex = null;
      this.room.gameState.playersPlayedThisRound.clear();
      this.room.gameState.currentRound++;

      // 更新roundUpdate
      if (roundUpdate) {
        roundUpdate.roundWinner = roundWinner;
        roundUpdate.nextRound = this.room.gameState.currentRound;
      }
    }

    // 获取毙牌动作
    const trumpAction = this.room.gameState.trumpAction;
    // 清空以防重复发送
    this.room.gameState.trumpAction = null;

    // 检查游戏是否结束（所有玩家手牌为0）
    const allPlayersFinished = this.room.players.every(p => p.cards.length === 0);
    if (allPlayersFinished) {
      this.finishGame();
      return {
        playedCards: validCards.map(c => c.toJSON()),
        remainingCount: player.cards.length,
        gameFinished: true,
        roundUpdate,
        roundWinner,
        trumpAction,
        throwFailed: throwFailed ? {
          message: '甩牌失败，强制出小',
          attemptedCards: originalRequestedCardIds.length,
          attemptedCardObjects: originalRequestedCards.map(c => c.toJSON()),
          forcedCards: validCards.map(c => c.toJSON())
        } : null
      };
    }

    return {
      playedCards: validCards.map(c => c.toJSON()),
      remainingCount: player.cards.length,
      gameFinished: false,
      roundUpdate,
      roundWinner,
      trumpAction,
      throwFailed: throwFailed ? {
        message: '甩牌失败，强制出小',
        attemptedCards: originalRequestedCardIds.length,
        attemptedCardObjects: originalRequestedCards.map(c => c.toJSON()),
        forcedCards: validCards.map(c => c.toJSON())
      } : null
    };
  }

  /**
   * 撤回上次出牌 - 将上次自己打的牌收回手中
   * 只有当下一位玩家还未出牌时才能撤回
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

    // 检查是否有后续的其他玩家出牌记录
    const hasSubsequentPlays = this.room.gameState.playHistory
      .slice(lastPlayIndex + 1)
      .some(play => play.playerId !== playerId);

    if (hasSubsequentPlays) {
      throw new Error('下一位玩家已经出牌，无法撤回');
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

    // 恢复回合状态
    const playerIndex = lastPlay.playerIndex;
    this.room.gameState.playersPlayedThisRound.delete(playerIndex);

    // 如果在有序模式下，恢复当前玩家索引
    if (this.room.gameState.playMode === PlayModes.ORDERED) {
      this.room.gameState.currentPlayerIndex = playerIndex;
    }

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
      this.drawingManager.stopDealerTimer();
      this.drawingManager = null;
    }

    // 停止回合管理器（如果有需要清理的资源）
    if (this.roundManager) {
      this.roundManager = null;
    }
  }
}
