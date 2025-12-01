import { GamePhases, PlayModes } from '../utils/constants.js';
import { DeckService } from './DeckService.js';
import BotService from './BotService.js';
import logger from '../utils/logger.js';

export class DrawingPhaseManager {
  constructor(room, io, gameEngine = null, onBotPlayNeeded = null, getBotService = null) {
    this.room = room;
    this.io = io;
    this.gameEngine = gameEngine;
    this.onBotPlayNeeded = onBotPlayNeeded; // Callback for triggering bot play
    this.getBotService = getBotService; // Callback for getting shared bot service
    this.timer = null;
    this.dealerTimer = null; // 指定庄家的定时器
  }

  /**
   * 开始摸牌阶段
   */
  start() {
    const { bottomCardsCount, dealInterval } = this.room.config;
    const playerCount = this.room.players.length;

    logger.info(`房间 ${this.room.id} 开始摸牌阶段`);

    // 创建并洗牌
    const deck = DeckService.shuffle(DeckService.createDeck());

    // 分离底牌和发牌堆
    const { bottomCards, remainingDeck } = DeckService.prepareDeal(deck, bottomCardsCount);

    this.room.gameState.bottomCards = bottomCards;
    this.room.gameState.deck = remainingDeck;
    this.room.gameState.phase = GamePhases.DRAWING;
    this.room.gameState.drawingIndex = 0;
    this.room.gameState.startTime = new Date();

    // 注意：trumpRank 在 GameState 初始化时已经默认设置为 '2'
    // 后续可以根据玩家等级动态调整
    logger.info(`房间 ${this.room.id} 当前级牌: ${this.room.gameState.trumpRank}`);

    // 广播摸牌开始
    this.io.to(this.room.id).emit('drawing_started', {
      totalCards: remainingDeck.length,
      bottomCardsCount,
      dealInterval
    });

    // 定时发牌
    this.timer = setInterval(() => {
      this.dealOneCard();
    }, dealInterval);
  }

  /**
   * 发一张牌
   */
  dealOneCard() {
    const { deck, drawingIndex } = this.room.gameState;
    const players = this.room.players;

    // 检查是否发完
    if (drawingIndex >= deck.length) {
      this.finish();
      return;
    }

    // 检查玩家是否还在（可能有人离开了）
    if (players.length === 0) {
      logger.warn(`房间 ${this.room.id} 没有玩家，停止发牌`);
      this.stop();
      return;
    }

    // 确定这张牌发给谁
    const playerIndex = drawingIndex % players.length;
    const player = players[playerIndex];

    // 防御性检查：确保玩家存在
    if (!player) {
      logger.error(`房间 ${this.room.id} 玩家索引 ${playerIndex} 不存在，停止发牌`);
      this.stop();
      return;
    }

    const card = deck[drawingIndex];

    // 将牌加入玩家手牌
    player.addCard(card);

    // 自动排序
    player.cards = DeckService.autoSortCards(player.cards);

    // 私密发送给该玩家
    this.io.to(player.socketId).emit('card_dealt', {
      card: card.toJSON(),
      totalCards: player.cards.length
    });

    // 广播发牌进度（不包含具体牌）
    this.io.to(this.room.id).emit('deal_progress', {
      playerIndex,
      playerId: player.id,
      playerName: player.name,
      current: drawingIndex + 1,
      total: deck.length
    });

    this.room.gameState.drawingIndex++;
  }

  /**
   * 结束摸牌阶段 - 发完牌后等待10秒自动指定庄家
   * 自由模式：不自动指定庄家，由房主手动指定埋底玩家
   */
  finish() {
    this.stop();

    // 检查是否为自由模式
    const isFreeMode = this.room.config.playMode === PlayModes.FREE;

    if (isFreeMode) {
      // 自由模式：不自动指定庄家，等待房主手动指定埋底玩家
      logger.info(`房间 ${this.room.id} 发牌完成（自由模式），等待房主指定埋底玩家`);

      // 广播发牌完成 - 自由模式特殊消息
      this.io.to(this.room.id).emit('drawing_complete', {
        message: '发牌完成，请房主指定埋底玩家',
        isFreeMode: true
      });

      // 不启动倒计时，等待房主手动设置
    } else {
      // 基础模式：自动指定庄家
      logger.info(`房间 ${this.room.id} 发牌完成，10秒后自动指定庄家`);

      // 广播发牌完成
      this.io.to(this.room.id).emit('drawing_complete', {
        message: '发牌完成，10秒后自动指定庄家',
        isFreeMode: false
      });

      // 开始庄家倒计时
      this.startDealerCountdown();
    }
  }

  /**
   * 开始/重置庄家倒计时（10秒）
   */
  startDealerCountdown() {
    // 清除之前的定时器
    if (this.dealerTimer) {
      clearTimeout(this.dealerTimer);
      this.dealerTimer = null;
    }

    // 广播倒计时开始/重置
    this.io.to(this.room.id).emit('dealer_countdown_start', {
      countdown: 10
    });

    logger.info(`房间 ${this.room.id} 开始/重置庄家倒计时`);

    // 10秒后自动指定庄家
    this.dealerTimer = setTimeout(() => {
      this.assignDealer();
    }, 10000);
  }

  /**
   * 指定庄家（埋底玩家）
   * 规则：
   * 1. 如果不是第一局（dealerPlayerIndex不为null），使用上一局计算的庄家索引
   * 2. 如果是第一局：
   *    a. 如果有人亮主/反主，最后一个亮主的玩家成为庄家
   *    b. 如果没人亮主，随机指定一个玩家作为庄家
   */
  assignDealer() {
    // 停止倒计时定时器
    this.stopDealerTimer();

    const { currentTrumpDeclaration, dealerPlayerIndex } = this.room.gameState;
    let dealer = null;

    // 规则1：如果不是第一局，直接使用上一局计算的庄家索引
    if (dealerPlayerIndex !== null) {
      dealer = this.room.players[dealerPlayerIndex];
      if (dealer) {
        logger.info(`房间 ${this.room.id} 根据上一局结果，${dealer.name} 成为庄家`);
      } else {
        logger.error(`房间 ${this.room.id} dealerPlayerIndex ${dealerPlayerIndex} 对应的玩家不存在`);
      }
    }

    // 规则2：第一局 - 如果有亮主记录，选择最后亮主的玩家
    if (!dealer && currentTrumpDeclaration && currentTrumpDeclaration.playerId) {
      dealer = this.room.players.find(p => p.id === currentTrumpDeclaration.playerId);
      if (dealer) {
        logger.info(`房间 ${this.room.id} 最后亮主的玩家 ${dealer.name} 成为庄家`);
      }
    }

    // 规则3：第一局且没有亮主记录，随机选择
    if (!dealer && this.room.players.length > 0) {
      const randomIndex = Math.floor(Math.random() * this.room.players.length);
      dealer = this.room.players[randomIndex];
      logger.info(`房间 ${this.room.id} 随机指定 ${dealer.name} 为庄家`);
    }

    if (!dealer) {
      logger.error(`房间 ${this.room.id} 无法指定庄家：没有玩家`);
      return;
    }

    // 广播倒计时结束
    this.io.to(this.room.id).emit('dealer_countdown_end');

    // 设置庄家
    this.room.gameState.buryingPlayerId = dealer.id;

    // 如果是第一局（dealerPlayerIndex为null），同时设置dealerPlayerIndex
    // 这样前端可以统一使用dealerPlayerIndex来判断庄家
    if (this.room.gameState.dealerPlayerIndex === null) {
      const dealerIndex = this.room.players.findIndex(p => p.id === dealer.id);
      this.room.gameState.dealerPlayerIndex = dealerIndex;
      logger.info(`房间 ${this.room.id} 第一局设置庄家索引: ${dealerIndex}`);
    }

    // 广播庄家信息
    this.io.to(this.room.id).emit('burying_player_set', {
      playerId: dealer.id,
      playerName: dealer.name
    });

    // 给庄家发底牌
    const bottomCards = this.room.gameState.bottomCards;
    bottomCards.forEach(card => dealer.addCard(card));

    // 自动排序
    dealer.cards = DeckService.autoSortCards(dealer.cards);

    // 私密发送底牌给庄家
    this.io.to(dealer.socketId).emit('bottom_cards_received', {
      bottomCards: bottomCards.map(c => c.toJSON()),
      totalCards: dealer.cards.length
    });

    logger.info(`房间 ${this.room.id} 庄家 ${dealer.name} 收到 ${bottomCards.length} 张底牌`);

    // 转换到埋底阶段
    this.room.gameState.phase = GamePhases.BURYING;

    // 广播房间状态更新
    this.io.to(this.room.id).emit('room_updated', {
      room: this.room.toJSON()
    });

    // 如果庄家是Bot，自动触发bot盖底牌
    if (dealer.isBot) {
      logger.info(`Bot ${dealer.name} 需要盖底牌`);
      this.triggerBotBurying(dealer);
    }
  }

  /**
   * 触发Bot盖底牌
   */
  async triggerBotBurying(dealer) {
    try {
      // 延迟1.5秒模拟思考
      await new Promise(resolve => setTimeout(resolve, 1500));

      // 使用共享的bot服务（通过回调获取）
      if (!this.getBotService) {
        throw new Error('getBotService回调未设置，无法获取共享BotService');
      }
      
      const botService = this.getBotService();
      if (!botService) {
        throw new Error('无法获取共享BotService实例');
      }

      const playerIndex = this.room.players.findIndex(p => p.id === dealer.id);
      const bottomCards = this.room.gameState.bottomCards;

      // 调用bot获取盖底牌决策
      const cardIds = await botService.getBotCoverAction(
        this.room.gameState,
        bottomCards,
        dealer.cards,
        playerIndex,
        this.room
      );

      logger.info(`Bot ${dealer.name} 选择盖底牌: ${cardIds.length} 张`);

      // 执行盖底牌 - 使用GameEngine的buryCards方法
      if (this.gameEngine) {
        this.gameEngine.buryCards(dealer.id, cardIds);
      } else {
        // 如果没有GameEngine引用，直接处理
        this.performBurying(dealer, cardIds);
      }

      // 广播埋底完成
      this.io.to(this.room.id).emit('cards_buried', {
        playerId: dealer.id,
        playerName: dealer.name
      });

      // 广播首发玩家已设置（埋底玩家自动成为首发）
      this.io.to(this.room.id).emit('first_player_set', {
        playerId: dealer.id,
        playerName: dealer.name,
        currentPlayerIndex: this.room.gameState.currentPlayerIndex
      });

      // 广播阶段切换
      this.io.to(this.room.id).emit('phase_changed', {
        phase: 'playing',
        message: `埋底完成，${dealer.name} 先出牌`
      });

      // 广播房间状态更新
      this.io.to(this.room.id).emit('room_updated', {
        room: this.room.toJSON()
      });

      // 触发bot自动出牌 - 使用回调
      if (this.onBotPlayNeeded) {
        this.onBotPlayNeeded();
      }

    } catch (error) {
      logger.error(`Bot ${dealer.name} 盖底牌失败:`, error);
      // Bot失败时使用默认策略：盖最小的牌
      const cardIds = dealer.cards.slice(0, this.room.config.bottomCardsCount).map(c => c.id);
      
      if (this.gameEngine) {
        this.gameEngine.buryCards(dealer.id, cardIds);
      } else {
        this.performBurying(dealer, cardIds);
      }

      this.io.to(this.room.id).emit('cards_buried', {
        playerId: dealer.id,
        playerName: dealer.name
      });

      this.io.to(this.room.id).emit('first_player_set', {
        playerId: dealer.id,
        playerName: dealer.name,
        currentPlayerIndex: this.room.gameState.currentPlayerIndex
      });

      this.io.to(this.room.id).emit('phase_changed', {
        phase: 'playing',
        message: `埋底完成，${dealer.name} 先出牌`
      });

      this.io.to(this.room.id).emit('room_updated', {
        room: this.room.toJSON()
      });

      // 触发bot自动出牌 - 使用回调
      if (this.onBotPlayNeeded) {
        this.onBotPlayNeeded();
      }
    }
  }

  /**
   * 执行埋底操作（当没有GameEngine引用时的备用方法）
   */
  performBurying(dealer, cardIds) {
    const requiredCount = this.room.config.bottomCardsCount;
    
    // 找出要埋的牌
    const cardsTobury = dealer.cards.filter(card => cardIds.includes(card.id));
    
    // 移除并更新底牌
    dealer.removeCards(cardIds);
    this.room.gameState.bottomCards = cardsTobury;

    logger.info(`房间 ${this.room.id} Bot埋底完成`);

    // 进入出牌阶段
    this.room.gameState.phase = GamePhases.PLAYING;

    // 使用游戏开始时锁定的playMode
    const isFreeMode = this.room.gameState.playMode === PlayModes.FREE;

    if (isFreeMode) {
      this.room.gameState.currentPlayerIndex = null;
      logger.info(`房间 ${this.room.id} 进入自由出牌阶段`);
    } else {
      const playerIndex = this.room.getPlayerIndex(dealer.id);
      this.room.gameState.firstPlayerId = dealer.id;
      this.room.gameState.currentPlayerIndex = playerIndex;
      this.room.gameState.roundStartPlayerIndex = playerIndex;
      this.room.gameState.currentRound = 1;
      this.room.gameState.playersPlayedThisRound.clear();

      logger.info(`房间 ${this.room.id} 进入出牌阶段，${dealer.name} 先出牌`);
    }
  }

  /**
   * 停止发牌定时器
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * 停止庄家定时器
   */
  stopDealerTimer() {
    if (this.dealerTimer) {
      clearTimeout(this.dealerTimer);
      this.dealerTimer = null;
    }
  }
}
