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
import {
  calculateRoundPoints,
  extractPointCards,
  isAttacker,
  calculateBottomMultiplier,
  calculateBottomPoints,
  generateScoringSummary,
  calculateLevelUpgrade,
  upgradeLevel,
  getNextDealerIndex
} from '../utils/scoringUtils.js';
import { levelToRank } from '../utils/constants.js';

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

    // Use room config's playMode instead of hardcoding ORDERED
    this.room.gameState.playMode = this.room.config.playMode || PlayModes.ORDERED;

    const isFreeMode = this.room.gameState.playMode === PlayModes.FREE;

    if (isFreeMode) {
      // 自由模式：不需要设置首发玩家和回合管理器
      this.room.gameState.currentPlayerIndex = null; // 自由模式没有"当前玩家"
      logger.info(`房间 ${this.room.id} 进入自由出牌阶段`);
    } else {
      // 基础模式：埋底玩家自动成为首发玩家，开始第一轮
      const playerIndex = this.room.getPlayerIndex(playerId);
      this.room.gameState.firstPlayerId = playerId;
      this.room.gameState.currentPlayerIndex = playerIndex;
      this.room.gameState.roundStartPlayerIndex = playerIndex;
      this.room.gameState.currentRound = 1;
      this.room.gameState.playersPlayedThisRound.clear();

      // 创建回合管理器
      this.roundManager = new RoundManager(this.room);

      logger.info(`房间 ${this.room.id} 进入出牌阶段，${player.name} 先出牌，模式: ${this.room.gameState.playMode}`);
    }

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
   * 出牌 - 根据游戏模式处理出牌逻辑
   * 自由模式：任意玩家可随时出任意牌
   * 基础模式：按照双升规则，有序出牌
   */
  playCards(playerId, cardIds) {
    if (this.room.gameState.phase !== GamePhases.PLAYING) {
      throw new Error('当前不是出牌阶段');
    }

    const player = this.room.findPlayerById(playerId);

    if (!player) {
      throw new Error('玩家不存在');
    }

    // 获取当前游戏模式
    const isFreeMode = this.room.gameState.playMode === PlayModes.FREE;

    // 自由模式：简化逻辑，任何玩家可以随时出任意牌
    if (isFreeMode) {
      return this.playCardsFreeMode(player, cardIds);
    }

    // 基础模式（有序出牌）：保持原有逻辑
    return this.playCardsOrderedMode(player, cardIds);
  }

  /**
   * 自由模式出牌 - 任意玩家可随时出任意牌，无规则验证
   */
  playCardsFreeMode(player, cardIds) {
    // 验证牌是否在手中
    const validCards = player.cards.filter(card => cardIds.includes(card.id));
    if (validCards.length !== cardIds.length) {
      throw new Error('选择的牌不在手中');
    }

    // 移除牌
    player.removeCards(cardIds);

    // 记录出牌历史
    this.room.gameState.playHistory.push({
      playerId: player.id,
      playerName: player.name,
      cards: validCards.map(c => c.toJSON()),
      timestamp: new Date()
    });

    logger.info(`房间 ${this.room.id} 玩家 ${player.name} 出牌 ${cardIds.length} 张（自由模式）`);

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
   * 基础模式出牌 - 按照双升规则，有序出牌
   */
  playCardsOrderedMode(player, cardIds) {
    const playerId = player.id;

    // 如果还没有回合管理器，说明还未设置首发玩家
    if (!this.roundManager) {
      throw new Error('还未设置首发玩家');
    }

    // 获取玩家索引
    const playerIndex = this.room.getPlayerIndex(playerId);

    // 验证是否轮到该玩家出牌
    if (!this.roundManager.canPlayerPlay(playerIndex)) {
      const currentPlayer = this.room.findPlayerByIndex(this.room.gameState.currentPlayerIndex);
      throw new Error(`现在不是你的回合，请等待 ${currentPlayer.name} 出牌`);
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
    let roundScoreInfo = null;
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

      // 计算本轮得分
      const currentLeadingPattern = this.room.gameState.leadingPattern;
      const allRoundCards = this.room.gameState.currentRoundPlays.flatMap(play => play.cards);
      const roundPoints = calculateRoundPoints(allRoundCards);
      const roundPointCards = extractPointCards(allRoundCards);

      // 获取庄家索引
      const dealerIndex = this.room.getPlayerIndex(this.room.gameState.buryingPlayerId);

      // 判断赢家是否是闲家
      const winnerIsAttacker = isAttacker(winnerIndex, dealerIndex, this.room.players.length);

      if (winnerIsAttacker && roundPoints > 0) {
        // 闲家赢了且有分数牌，收集分数牌
        this.room.gameState.collectedPointCards.push(...roundPointCards);
        this.room.gameState.attackerScore += roundPoints;
        logger.info(`闲家获得 ${roundPoints} 分，总分: ${this.room.gameState.attackerScore}`);
      }

      roundScoreInfo = {
        roundPoints,
        roundPointCards: roundPointCards.map(c => c.toJSON()),
        winnerIsAttacker,
        attackerScore: this.room.gameState.attackerScore,
        collectedPointCards: this.room.gameState.collectedPointCards.map(c => c.toJSON())
      };

      // 保存最后一轮信息（用于底牌计算）
      this.room.gameState.lastRoundLeadingPattern = currentLeadingPattern;
      this.room.gameState.lastRoundWinnerIndex = winnerIndex;

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
        roundUpdate.scoreInfo = roundScoreInfo;
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
   * 自由模式：任何时候都可以撤回自己的最后一次出牌
   * 基础模式：只有当下一位玩家还未出牌时才能撤回
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

    const isFreeMode = this.room.gameState.playMode === PlayModes.FREE;

    // 基础模式下检查是否有后续的其他玩家出牌记录
    if (!isFreeMode) {
      const hasSubsequentPlays = this.room.gameState.playHistory
        .slice(lastPlayIndex + 1)
        .some(play => play.playerId !== playerId);

      if (hasSubsequentPlays) {
        throw new Error('下一位玩家已经出牌，无法撤回');
      }
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

    // 基础模式下恢复回合状态
    if (!isFreeMode && lastPlay.playerIndex !== undefined) {
      const playerIndex = lastPlay.playerIndex;
      this.room.gameState.playersPlayedThisRound.delete(playerIndex);
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

    const isFreeMode = this.room.gameState.playMode === PlayModes.FREE;

    if (isFreeMode) {
      // 自由模式：简化的结束逻辑，不计算得分和升级
      this.room.gameState.bottomScoreResult = {
        attackerScore: 0,
        bottomPoints: 0,
        bottomMultiplier: 1,
        attackerWonBottom: false,
        resultText: '自由模式 - 无得分计算'
      };
      this.room.gameState.upgradeResult = {
        attackerWon: false,
        dealerLevelUp: 0,
        attackerLevelUp: 0
      };
      logger.info('自由模式游戏结束');
    } else {
      // 基础模式：完整的得分和升级计算

      // 保存当前局的主牌信息（在计算升级更新trumpRank之前）
      const currentGameTrumpSuit = this.room.gameState.trumpSuit;
      const currentGameTrumpRank = this.room.gameState.trumpRank;

      // 计算底牌得分
      const bottomScoreResult = this.calculateBottomScore();
      // 保存当前局的主牌信息到底牌结果中
      bottomScoreResult.currentGameTrumpSuit = currentGameTrumpSuit;
      bottomScoreResult.currentGameTrumpRank = currentGameTrumpRank;
      this.room.gameState.bottomScoreResult = bottomScoreResult;

      logger.info(`底牌结果: ${bottomScoreResult.resultText}, 底牌分数: ${bottomScoreResult.bottomPoints}, 倍数: ${bottomScoreResult.bottomMultiplier}, 闲家总分: ${this.room.gameState.attackerScore}`);

      // 计算升级（这会更新trumpRank为下一局的级牌）
      const upgradeResult = this.calculateUpgrade();
      this.room.gameState.upgradeResult = upgradeResult;

      logger.info(`升级结果: ${upgradeResult.attackerWon ? '闲家获胜' : '庄家获胜'}, 庄家升${upgradeResult.dealerLevelUp}级, 闲家升${upgradeResult.attackerLevelUp}级`);
    }

    // 重置下一局准备状态
    this.room.players.forEach(p => p.isReadyForNext = false);
  }

  /**
   * 计算底牌得分
   */
  calculateBottomScore() {
    const lastRoundWinnerIndex = this.room.gameState.lastRoundWinnerIndex;
    const dealerIndex = this.room.getPlayerIndex(this.room.gameState.buryingPlayerId);

    // 判断最后一轮赢家是否是闲家
    const attackerWonLastRound = isAttacker(lastRoundWinnerIndex, dealerIndex, this.room.players.length);

    // 计算底牌分数
    const bottomPoints = calculateBottomPoints(this.room.gameState.bottomCards);

    // 计算倍数
    const bottomMultiplier = calculateBottomMultiplier(this.room.gameState.lastRoundLeadingPattern);

    // 如果闲家赢了最后一轮，获得底牌分数
    if (attackerWonLastRound && bottomPoints > 0) {
      const bottomScoreGained = bottomPoints * bottomMultiplier;
      this.room.gameState.attackerScore += bottomScoreGained;

      // 底牌分数牌不加入 collectedPointCards，只在底牌结果中单独展示
      logger.info(`闲家拿底，获得 ${bottomPoints} x ${bottomMultiplier} = ${bottomScoreGained} 分`);
    }

    // 生成结果摘要
    return generateScoringSummary({
      collectedPointCards: this.room.gameState.collectedPointCards.map(c => c.toJSON ? c.toJSON() : c),
      attackerScore: this.room.gameState.attackerScore,
      bottomCards: this.room.gameState.bottomCards.map(c => c.toJSON()),
      attackerWonLastRound,
      bottomMultiplier,
      bottomPoints
    });
  }

  /**
   * 计算升级
   */
  calculateUpgrade() {
    const attackerScore = this.room.gameState.attackerScore;
    const dealerIndex = this.room.getPlayerIndex(this.room.gameState.buryingPlayerId);

    // 如果是第一局（dealerPlayerIndex为null），设置当前庄家
    if (this.room.gameState.dealerPlayerIndex === null) {
      this.room.gameState.dealerPlayerIndex = dealerIndex;
    }

    // 计算升级数
    const { attackerWon, dealerLevelUp, attackerLevelUp } = calculateLevelUpgrade(attackerScore);

    // 确定庄家队伍和闲家队伍
    // 队伍1: 索引0和2, 队伍2: 索引1和3
    const dealerTeam = dealerIndex % 2 === 0 ? 1 : 2;
    const attackerTeam = dealerTeam === 1 ? 2 : 1;

    // 升级前的等级
    const oldDealerLevel = dealerTeam === 1 ? this.room.gameState.team1Level : this.room.gameState.team2Level;
    const oldAttackerLevel = attackerTeam === 1 ? this.room.gameState.team1Level : this.room.gameState.team2Level;

    // 升级
    let newDealerLevel = upgradeLevel(oldDealerLevel, dealerLevelUp);
    let newAttackerLevel = upgradeLevel(oldAttackerLevel, attackerLevelUp);

    // 更新队伍等级
    if (dealerTeam === 1) {
      this.room.gameState.team1Level = newDealerLevel;
      this.room.gameState.team2Level = newAttackerLevel;
    } else {
      this.room.gameState.team1Level = newAttackerLevel;
      this.room.gameState.team2Level = newDealerLevel;
    }

    // 计算下一局庄家
    const nextDealerIndex = getNextDealerIndex(dealerIndex, attackerWon, this.room.players.length);
    this.room.gameState.dealerPlayerIndex = nextDealerIndex;

    // 更新下一局的级牌（根据下一局庄家的等级）
    const nextDealerTeam = nextDealerIndex % 2 === 0 ? 1 : 2;
    const nextDealerLevel = nextDealerTeam === 1 ? this.room.gameState.team1Level : this.room.gameState.team2Level;
    this.room.gameState.trumpRank = levelToRank(nextDealerLevel);

    logger.info(`下一局庄家: 玩家${nextDealerIndex}, 等级: ${nextDealerLevel}, 级牌: ${this.room.gameState.trumpRank}`);

    // 获取玩家名称
    const dealerPlayer = this.room.findPlayerByIndex(dealerIndex);
    const nextDealerPlayer = this.room.findPlayerByIndex(nextDealerIndex);

    return {
      attackerWon,
      dealerLevelUp,
      attackerLevelUp,
      dealerTeam,
      attackerTeam,
      oldDealerLevel,
      oldAttackerLevel,
      newDealerLevel,
      newAttackerLevel,
      currentDealerIndex: dealerIndex,
      currentDealerName: dealerPlayer ? dealerPlayer.name : '未知',
      nextDealerIndex,
      nextDealerName: nextDealerPlayer ? nextDealerPlayer.name : '未知',
      nextDealerLevel,
      nextTrumpRank: this.room.gameState.trumpRank,
      // 队伍等级信息
      team1Level: this.room.gameState.team1Level,
      team2Level: this.room.gameState.team2Level
    };
  }

  /**
   * 玩家准备开始下一局
   */
  readyForNextGame(playerId) {
    const player = this.room.findPlayerById(playerId);
    if (player) {
      player.isReadyForNext = true;
    }

    // 检查是否所有人都准备好了
    const allReady = this.room.players.every(p => p.isReadyForNext);
    if (allReady) {
      logger.info(`房间 ${this.room.id} 所有玩家已准备，开始下一局`);
      // 重置所有玩家的准备状态
      this.room.players.forEach(p => p.isReadyForNext = false);
      // 直接开始下一局
      this.startNextGame();
    }

    return allReady;
  }

  /**
   * 开始下一局（自动进入发牌阶段）
   */
  startNextGame() {
    this.room.resetForNewGame();

    // 重置游戏状态
    this.room.gameState.reset();

    // 所有玩家自动准备
    this.room.players.forEach(player => {
      player.isReady = true;
    });

    // 不进入等待准备阶段，直接开始发牌
    this.room.gameState.isWaitingForReady = false;

    logger.info(`房间 ${this.room.id} 开始下一局 - 直接进入发牌阶段`);

    // 广播下一局开始（清空客户端状态）
    this.io.to(this.room.id).emit('next_game_started', {
      message: '开始下一局',
      trumpRank: this.room.gameState.trumpRank
    });

    // 直接开始发牌
    this.startDrawing();
  }

  /**
   * 重新开始游戏（房主手动重启）
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
