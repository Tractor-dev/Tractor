import { GamePhases } from '../utils/constants.js';
import { DeckService } from './DeckService.js';
import logger from '../utils/logger.js';

export class DrawingPhaseManager {
  constructor(room, io) {
    this.room = room;
    this.io = io;
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
   */
  finish() {
    this.stop();

    logger.info(`房间 ${this.room.id} 发牌完成，10秒后自动指定庄家`);

    // 广播发牌完成
    this.io.to(this.room.id).emit('drawing_complete', {
      message: '发牌完成，10秒后自动指定庄家'
    });

    // 开始庄家倒计时
    this.startDealerCountdown();
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
