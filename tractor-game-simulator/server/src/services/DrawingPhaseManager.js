import { GamePhases } from '../utils/constants.js';
import { DeckService } from './DeckService.js';
import logger from '../utils/logger.js';

export class DrawingPhaseManager {
  constructor(room, io) {
    this.room = room;
    this.io = io;
    this.timer = null;
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
   * 结束摸牌阶段 - 发完牌，但仍保持DRAWING阶段直到房主指定埋底玩家
   */
  finish() {
    this.stop();

    // 保持在DRAWING阶段，允许玩家展示手牌
    // 不设置为BURYING，等房主指定埋底玩家时再切换

    logger.info(`房间 ${this.room.id} 发牌完成，玩家可以展示手牌`);

    // 广播发牌完成
    this.io.to(this.room.id).emit('drawing_complete', {
      message: '发牌完成，玩家可以展示手牌，等待房主指定埋底玩家'
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
}
