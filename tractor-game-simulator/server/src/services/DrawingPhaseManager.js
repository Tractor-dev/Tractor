import { GamePhases } from '../utils/constants.js';
import { DeckService } from './DeckService.js';
import {
  isAdministrativeReviewRule,
  isFatalBeautyRule,
  isHeavyFogRule,
  isKingOverWhiteRule,
  isLastStandRule,
  isOneCountryTwoSystemsRule,
  isOpenlyRevealedRule,
  isPeopleCommuneRule,
  isPlannedEconomyRule,
  isThreeSixNineGradesRule,
  isUnarmedRule
} from '../rules/ruleRegistry.js';
import {
  getOneCountryPublicState,
  resolveOneCountryTwoSystems
} from '../utils/oneCountryTwoSystemsUtils.js';
import logger from '../utils/logger.js';

const MISTY_FOG_CARD_COUNT = 8;
const PLANNED_ECONOMY_RESERVE_COUNT = 20;

export class DrawingPhaseManager {
  constructor(
    room,
    io,
    onDealerAssigned = null,
    onDrawingComplete = null,
    onDealerSelected = null,
    random = Math.random,
    onCardDealt = null
  ) {
    this.room = room;
    this.io = io;
    this.onDealerAssigned = onDealerAssigned;
    this.onDrawingComplete = onDrawingComplete;
    this.onDealerSelected = onDealerSelected;
    this.random = random;
    this.onCardDealt = onCardDealt;
    this.timer = null;
    this.dealerTimer = null; // 指定庄家的定时器
  }

  /**
   * 开始摸牌阶段
   */
  start() {
    const { dealInterval } = this.room.config;
    const { bottomCardsCount } = this.room.gameState;
    const playerCount = this.room.players.length;

    logger.info(`房间 ${this.room.id} 开始摸牌阶段`);

    // 创建并洗牌
    let deck = DeckService.shuffle(DeckService.createDeck());
    if (isKingOverWhiteRule(this.room.gameState.selectedRule)) {
      deck = DeckService.transformRandomJokerToWhite(deck, this.random);
    }
    const isUnarmed = isUnarmedRule(this.room.gameState.selectedRule);
    if (isUnarmed) {
      deck = DeckService.prepareUnarmedDeck(deck);
    }
    if (isFatalBeautyRule(this.room.gameState.selectedRule)) {
      deck = DeckService.transformSpadesToHearts(deck);
    }

    // 迷雾牌在洗牌后立即从牌堆顶暗中移除，不属于底牌，也不交给任何玩家。
    const mistyFogCardCount = isHeavyFogRule(this.room.gameState.selectedRule)
      ? MISTY_FOG_CARD_COUNT
      : 0;
    this.room.gameState.mistyFogCards = deck.slice(0, mistyFogCardCount);
    const playableDeck = deck.slice(mistyFogCardCount);

    // 分离底牌和发牌堆
    const { bottomCards, remainingDeck: postBottomDeck } = DeckService.prepareDeal(
      playableDeck,
      bottomCardsCount
    );
    const plannedEconomyReserveCount = isPlannedEconomyRule(this.room.gameState.selectedRule)
      ? PLANNED_ECONOMY_RESERVE_COUNT
      : 0;
    const reserveStartIndex = Math.max(0, postBottomDeck.length - plannedEconomyReserveCount);
    const remainingDeck = postBottomDeck.slice(0, reserveStartIndex);
    this.room.gameState.plannedEconomyReserveCards = postBottomDeck.slice(reserveStartIndex);
    this.room.gameState.plannedEconomyDrawRounds = 0;

    this.room.gameState.bottomCards = bottomCards;
    this.room.gameState.deck = remainingDeck;
    this.room.gameState.phase = GamePhases.DRAWING;
    this.room.gameState.postDrawStage = 'dealing';
    this.room.gameState.isTrumpDeclarationLocked = false;
    this.room.gameState.pendingDealerPlayerId = null;
    this.room.gameState.drawingIndex = 0;
    this.room.gameState.startTime = new Date();

    // 注意：trumpRank 在 GameState 初始化时已经默认设置为 '2'
    // 后续可以根据玩家等级动态调整
    logger.info(`房间 ${this.room.id} 当前级牌: ${this.room.gameState.trumpRank}`);

    // 广播摸牌开始
    this.io.to(this.room.id).emit('drawing_started', {
      totalCards: remainingDeck.length,
      bottomCardsCount,
      removedCardsCount: mistyFogCardCount + (isUnarmed ? 4 : 0),
      reservedCardsCount: this.room.gameState.plannedEconomyReserveCards.length,
      dealInterval,
      ...(isOpenlyRevealedRule(this.room.gameState.selectedRule) ? {
        publicBottomCards: bottomCards.map(card => card.toJSON())
      } : {})
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

    if (this.onCardDealt) {
      this.onCardDealt(player, card);
    }

    // 广播发牌进度（不包含具体牌）
    this.io.to(this.room.id).emit('deal_progress', {
      playerIndex,
      playerId: player.id,
      playerName: player.name,
      cardsCount: player.cards.length,
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

    logger.info(`房间 ${this.room.id} 发牌完成，进入亮主/反主确认阶段`);

    // 广播发牌完成
    this.io.to(this.room.id).emit('drawing_complete', {
      message: '发牌完成，亮主/反主结束后锁定庄家'
    });

    if (this.onDrawingComplete) {
      this.onDrawingComplete();
    } else {
      // 兼容独立使用摸牌管理器的场景。
      this.startDealerCountdown();
    }
  }

  /**
   * 开始/重置庄家倒计时（10秒）
   */
  startDealerCountdown() {
    if (this.room.gameState.isTrumpDeclarationLocked || this.room.gameState.cardExchange) {
      logger.warn(`房间 ${this.room.id} 亮主阶段已锁定，忽略庄家倒计时请求`);
      return false;
    }

    this.room.gameState.postDrawStage = 'trump_window';
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
    return true;
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
    if (
      !currentTrumpDeclaration
      && isLastStandRule(this.room.gameState.selectedRule)
    ) {
      const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
      const sample = Number(this.random());
      const bounded = Number.isFinite(sample)
        ? Math.min(0.999999999, Math.max(0, sample))
        : Math.random();
      this.room.gameState.trumpSuit = suits[Math.floor(bounded * suits.length)];
      this.io.to(this.room.id).emit('trump_updated', {
        trumpSuit: this.room.gameState.trumpSuit,
        trumpRank: this.room.gameState.trumpRank,
        systemSelected: true
      });
      logger.info(`房间 ${this.room.id} 绝处逢生：无人亮主，系统随机选择 ${this.room.gameState.trumpSuit} 为主花色`);
    }
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
    this.room.gameState.isTrumpDeclarationLocked = true;
    this.room.gameState.pendingDealerPlayerId = dealer.id;

    // 如果是第一局（dealerPlayerIndex为null），同时设置dealerPlayerIndex
    // 这样前端可以统一使用dealerPlayerIndex来判断庄家
    if (this.room.gameState.dealerPlayerIndex === null) {
      const dealerIndex = this.room.players.findIndex(p => p.id === dealer.id);
      this.room.gameState.dealerPlayerIndex = dealerIndex;
      logger.info(`房间 ${this.room.id} 第一局设置庄家索引: ${dealerIndex}`);
    }

    if (isOneCountryTwoSystemsRule(this.room.gameState.selectedRule)) {
      const resolution = resolveOneCountryTwoSystems(
        this.room.gameState.oneCountryDeclarationsByTeam,
        this.room.gameState.dealerPlayerIndex
      );
      this.room.gameState.oneCountryResolved = resolution;
      this.room.gameState.trumpSuit = resolution?.canonicalTrumpSuit || 'no_trump';
      this.io.to(this.room.id).emit('trump_updated', {
        trumpSuit: this.room.gameState.trumpSuit,
        trumpRank: this.room.gameState.trumpRank,
        oneCountryTwoSystems: getOneCountryPublicState(this.room.gameState)
      });
      logger.info(
        `房间 ${this.room.id} 一国两制锁定：` +
        `${resolution?.isNoTrump
          ? '双方无主'
          : resolution?.hasDistinctTeamSuits
            ? `庄家方 ${resolution.dealerSuit}，闲家方 ${resolution.attackerSuit}`
            : `双方 ${resolution?.canonicalTrumpSuit}`}`
      );
    }

    if (isThreeSixNineGradesRule(this.room.gameState.selectedRule)) {
      const isJokerNoTrump = this.room.gameState.currentTrumpDeclaration?.suit === 'joker';
      if (isJokerNoTrump) {
        this.room.gameState.currentInferiorDeclaration = null;
        this.room.gameState.inferiorSuit = null;
      } else {
        this.room.gameState.inferiorSuit =
          this.room.gameState.currentInferiorDeclaration?.suit || null;
      }
      this.io.to(this.room.id).emit('three_six_nine_updated', {
        locked: true,
        trumpSuit: this.room.gameState.trumpSuit,
        trumpRank: this.room.gameState.trumpRank,
        inferiorSuit: this.room.gameState.inferiorSuit,
        currentTrumpDeclaration: this.room.gameState.currentTrumpDeclaration
          ? {
              ...this.room.gameState.currentTrumpDeclaration,
              cards: this.room.gameState.currentTrumpDeclaration.cards.map(card => card.toJSON())
            }
          : null,
        currentInferiorDeclaration: this.room.gameState.currentInferiorDeclaration
          ? {
              ...this.room.gameState.currentInferiorDeclaration,
              cards: this.room.gameState.currentInferiorDeclaration.cards.map(card => card.toJSON())
            }
          : null,
        claimedSuits: Object.fromEntries(this.room.gameState.threeSixNineClaimedSuits)
      });
      logger.info(
        `房间 ${this.room.id} 三六九等锁定：` +
        `${this.room.gameState.trumpSuit && this.room.gameState.trumpSuit !== 'no_trump'
          ? `${this.room.gameState.trumpSuit} 主`
          : '无普通花色主'}，` +
        `${this.room.gameState.inferiorSuit ? `${this.room.gameState.inferiorSuit} 劣` : '无劣花色'}`
      );
    }

    this.io.to(this.room.id).emit('dealer_selected', {
      playerId: dealer.id,
      playerName: dealer.name
    });

    // 特殊规则可在庄家锁定后、收底牌前插入异步流程（例如四家换牌）。
    if (this.onDealerSelected && this.onDealerSelected(dealer) === true) {
      this.io.to(this.room.id).emit('room_updated', {
        room: this.room.toJSON()
      });
      return dealer;
    }

    return this.completeDealerAssignment(dealer);
  }

  /** 庄家身份已锁定后，真正发放底牌并进入埋底阶段。 */
  completeDealerAssignment(dealerOrId = null) {
    const dealer = typeof dealerOrId === 'string'
      ? this.room.findPlayerById(dealerOrId)
      : dealerOrId || this.room.findPlayerById(this.room.gameState.pendingDealerPlayerId);
    if (!dealer) {
      throw new Error('尚未锁定庄家');
    }
    if (this.room.gameState.buryingPlayerId === dealer.id && this.room.gameState.phase !== GamePhases.DRAWING) {
      return dealer;
    }

    this.room.gameState.pendingDealerPlayerId = null;
    this.room.gameState.buryingPlayerId = dealer.id;
    this.room.gameState.postDrawStage = null;

    // 广播庄家信息
    this.io.to(this.room.id).emit('burying_player_set', {
      playerId: dealer.id,
      playerName: dealer.name
    });

    // 给庄家发底牌
    const bottomCards = this.room.gameState.bottomCards;
    if (isPeopleCommuneRule(this.room.gameState.selectedRule)) {
      if (
        this.room.players.length !== 4
        || bottomCards.length !== 0
        || this.room.players.some(player => player.cards.length !== 27)
      ) {
        throw new Error('人民公社需要四名玩家各摸满27张牌');
      }

      const dealerIndex = this.room.getPlayerIndex(dealer.id);
      this.room.gameState.peopleCommuneBuryingOrder = Array.from(
        { length: this.room.players.length },
        (_, offset) => this.room.players[(dealerIndex + offset) % this.room.players.length].id
      );
      this.room.gameState.peopleCommuneCurrentBuryingPlayerId = dealer.id;
      this.room.gameState.peopleCommuneBuriedCardsByPlayerId.clear();

      logger.info(`房间 ${this.room.id} 人民公社：四家均已摸满27张，开始各埋两张`);
      this.room.gameState.phase = GamePhases.BURYING;
      this.io.to(this.room.id).emit('room_updated', { room: this.room.toJSON() });
      if (this.onDealerAssigned) this.onDealerAssigned(dealer);
      return dealer;
    }

    if (isAdministrativeReviewRule(this.room.gameState.selectedRule)) {
      // 行政审查在满足公开条件前，底牌始终只留在服务端，不能提前加入庄家手牌或私发牌面。
      this.room.gameState.phase = GamePhases.BURYING;
      logger.info(
        `房间 ${this.room.id} 行政审查：${bottomCards.length}张底牌继续封存，四家先以初始手牌出牌`
      );
      this.io.to(this.room.id).emit('room_updated', { room: this.room.toJSON() });
      if (this.onDealerAssigned) this.onDealerAssigned(dealer);
      return dealer;
    }

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

    if (this.onDealerAssigned) {
      this.onDealerAssigned(dealer);
    }
    return dealer;
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
