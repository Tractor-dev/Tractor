import { GamePhases, PlayModes, Ranks, Suits, TurnOrders, levelToRank } from '../utils/constants.js';
import { DrawingPhaseManager } from './DrawingPhaseManager.js';
import { RoundManager } from './RoundManager.js';
import { DeckService } from './DeckService.js';
import { Card } from '../models/Card.js';
import logger from '../utils/logger.js';
import {
  detectPattern,
  findSmallestPlayForRespectElders,
  rankRoundPlaysByRespectOrder,
  validateLeadingPlay,
  validateFollowingPlay,
  compareCards,
  demoteForbiddenMagicHand,
  parseThrowCombination,
  resolveClusterAnalysisPlay,
  resolveEnduringComparison,
  resolveForbiddenMagicPlay,
  resolveJokerSubstitutionPlay,
  getSuitlessPatternProfile,
  validateThrow,
  PatternTypes,
  getEffectiveSuit,
  getAntinomyFaceKey
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
import { getCardPoints, getMeticulousAccountingCardPoints } from '../utils/scoringUtils.js';
import { getCardStrength, isTrumpCard } from '../utils/cardPatternUtils.js';
import { comparePokerScores, evaluateBestPokerHand } from '../utils/pokerUtils.js';
import {
  getCardCooldownType,
  getCardCooldownValue,
  getRuleDisabledCards,
  getRulePlayableCards,
  recordBirdsGoneBowHiddenPointCards
} from '../utils/cardCooldownUtils.js';
import { mapOneCountryCards } from '../utils/oneCountryTwoSystemsUtils.js';
import { shiftStrengthCompensationCardFace } from '../utils/strengthCompensationUtils.js';
import { transformThreeTigersCards } from '../utils/threeTigersUtils.js';
import { validateDeclaration } from '../utils/trumpUtils.js';
import {
  chooseWhoDesignedCardsToBury,
  chooseWhoDesignedTrumpDeclaration,
  shouldUseWhoDesignedStrategy
} from './whoDesignedStrategy.js';
import {
  calculateIronEvidenceRoundScoring,
  getIronEvidenceRoundMode,
  isIronEvidenceBigJoker
} from '../utils/ironEvidenceUtils.js';
import {
  ActiveSkillIds,
  createDoubleHappinessRule,
  createRuleOptions,
  getActiveSkillForRule,
  getOpeningCardExchangeOffset,
  getOddEvenRoundMultiplier,
  getRuleById,
  getRuleSetup,
  isAdministrativeReviewRule,
  isAntinomyRule,
  isChangeRiceToMulberryRule,
  isIcebergTipRule,
  isCosmicShiftRule,
  isFatalBeautyRule,
  isFrequentFluctuationRule,
  isGoWithTheFlowRule,
  isInviteIntoUrnRule,
  isIrresistibleForceRule,
  isHeavyFogRule,
  isLingeringDiscardRule,
  isLureTigerFromMountainRule,
  isMutualVisibilityRule,
  isMinorDisturbanceRule,
  isNoOneSurvivesRule,
  isOneHorseLeadsRule,
  isLastStandRule,
  isOpenAndHonestRule,
  isOpeningCardExchangeRule,
  isPerfectStrategyRule,
  isReformAndOpeningUpRule,
  isRitesCollapseRule,
  isAccidentInsuranceRule,
  isRespectEldersAndChildrenRule,
  isRouteSwingRule,
  isDayNightRotationRule,
  isDefenseAsOffenseRule,
  isDestroyDykeFloodFieldsRule,
  isDoubleHappinessRule,
  isTenSidedAmbushRule,
  isThreePowersRule,
  isGentlemanPromiseRule,
  isFocusFigureRule,
  isRepeatedExhaustionRule,
  isEnduringRule,
  isEncircleThreeMissingOneRule,
  isAveragePoolingRule,
  isDreamKillingRule,
  isJointHarmonyRule,
  isDivineWeaponRule,
  isMagicTrickRule,
  isMeticulousAccountingRule,
  isLostInFogRule,
  isMainstayRule,
  isHappyTwinsRule,
  isHiddenDragonInAbyssRule,
  isIronEvidenceRule,
  isWaitingRabbitRule,
  isCandleToDawnRule,
  isCulturalRevolutionRule,
  isMutualSupportRule,
  isOldHorseStillHasStrengthRule,
  isAbruptStopRule,
  isForbiddenMagicRule,
  isPlannedEconomyRule,
  isOneCountryTwoSystemsRule,
  isPeopleCommuneRule,
  isPoliticalReviewRule,
  isRecordOnFileRule,
  isRemoveFirewoodRule,
  isSecondBattlefieldRule,
  isStrengthCompensationRule,
  isStrawBoatBorrowingArrowsRule,
  isStriveUpstreamRule,
  isBushGateRule,
  isAmbiguousRule,
  isAfterglowRule,
  isOutwardHarmonyInnerDivisionRule,
  isTeammateCheerRule,
  isThreeTigersRule,
  isThreeSixNineGradesRule,
  isTwoGhostsKnockDoorRule,
  isTrumpWinsRule,
  isWoodenOxFlowingHorseRule,
  isWeighingThousandJinRule,
  isTimeReversalRule,
  resolveOfferedRule,
  RuleIds
} from '../rules/ruleRegistry.js';

const OPENING_EXCHANGE_CARD_COUNT = 2;
// 换牌不只是路径提示：接收者还需要时间辨认收到的牌，再看它们落入手牌。
const OPENING_EXCHANGE_ANIMATION_MS = 2200;
const MAINSTAY_CARD_COUNT = 5;
const MAINSTAY_ANIMATION_MS = 1100;
const SECONDARY_BURY_ANIMATION_MS = 1400;
const ICEBERG_REVEALED_CARD_COUNT = 2;
const TEN_SIDED_AMBUSH_CARD_POINTS = 5;
const WHOLE_HAND_EXCHANGE_ANIMATION_MS = 1300;
const TIME_REVERSAL_DECISION_DELAY_MS = 2000;
const PLANNED_ECONOMY_DRAW_ANIMATION_MS = 1500;
const EQUIVALENT_RECIPROCITY_ANIMATION_MS = 1600;
const MUTUAL_SUPPORT_ANIMATION_MS = 1100;
const SECOND_BATTLEFIELD_AWARD = 5;
const SECOND_BATTLEFIELD_COMMUNITY_CARD_COUNT = 5;
const SECOND_BATTLEFIELD_MIN_ACCUMULATED_CARDS = 5;
const SECOND_BATTLEFIELD_FINAL_HAND_THRESHOLD = 5;
const OUTWARD_HARMONY_AWARD = 5;
const WOODEN_OX_MAX_TRANSFERS = 4;
const INVITE_INTO_URN_SUITS = Object.freeze(['hearts', 'diamonds', 'clubs', 'spades']);
const INVITE_INTO_URN_RANKS = Object.freeze([
  '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'
]);
const ANTINOMY_SUITS = INVITE_INTO_URN_SUITS;
const ANTINOMY_RANKS = INVITE_INTO_URN_RANKS;
const CULTURAL_REVOLUTION_SUITS = Object.freeze([
  Suits.HEARTS,
  Suits.DIAMONDS,
  Suits.CLUBS,
  Suits.SPADES
]);
const ENCIRCLE_THREE_MISSING_ONE_SUITS = Object.freeze([
  Suits.HEARTS,
  Suits.DIAMONDS,
  Suits.CLUBS,
  Suits.SPADES
]);
const CULTURAL_REVOLUTION_RANKS = Object.freeze([
  Ranks.TWO,
  Ranks.THREE,
  Ranks.FOUR,
  Ranks.FIVE,
  Ranks.SIX,
  Ranks.SEVEN,
  Ranks.EIGHT,
  Ranks.NINE,
  Ranks.TEN,
  Ranks.JACK,
  Ranks.QUEEN,
  Ranks.KING,
  Ranks.ACE
]);
const THREE_TIGERS_SUITS = Object.freeze([
  Suits.HEARTS,
  Suits.DIAMONDS,
  Suits.CLUBS,
  Suits.SPADES
]);
const DIVINE_WEAPON_SUITS = Object.freeze([
  Suits.HEARTS,
  Suits.DIAMONDS,
  Suits.CLUBS,
  Suits.SPADES
]);
const DIVINE_WEAPON_RANKS = Object.freeze([
  Ranks.TWO,
  Ranks.THREE,
  Ranks.FOUR,
  Ranks.FIVE,
  Ranks.SIX,
  Ranks.SEVEN,
  Ranks.EIGHT,
  Ranks.NINE,
  Ranks.TEN,
  Ranks.JACK,
  Ranks.QUEEN,
  Ranks.KING,
  Ranks.ACE
]);
const TEN_SIDED_AMBUSH_RANKS = Object.freeze([
  Ranks.TWO,
  Ranks.THREE,
  Ranks.FOUR,
  Ranks.FIVE,
  Ranks.SIX,
  Ranks.SEVEN,
  Ranks.EIGHT,
  Ranks.NINE,
  Ranks.TEN,
  Ranks.JACK,
  Ranks.QUEEN,
  Ranks.KING,
  Ranks.ACE
]);
const POINT_RANKS = new Set([Ranks.FIVE, Ranks.TEN, Ranks.KING]);
const GENTLEMAN_PROMISE_SUITS = Object.freeze([
  Suits.HEARTS,
  Suits.DIAMONDS,
  Suits.CLUBS,
  Suits.SPADES,
  'trump'
]);
const HIDDEN_DRAGON_RANKS = TEN_SIDED_AMBUSH_RANKS;
const THREE_POWERS_SLOT_CONFIG = Object.freeze([
  // 原描述按2、3、4号位依次重载10、5、K；此处按右上角表格的5、10、K顺序保存。
  Object.freeze({ sourceRank: Ranks.FIVE, pointValue: 5, selectorOffset: 2, selectorPosition: 3 }),
  Object.freeze({ sourceRank: Ranks.TEN, pointValue: 10, selectorOffset: 1, selectorPosition: 2 }),
  Object.freeze({ sourceRank: Ranks.KING, pointValue: 10, selectorOffset: 3, selectorPosition: 4 })
]);

export class GameEngine {
  constructor(room, io, random = Math.random) {
    this.room = room;
    this.io = io;
    this.random = random;
    this.drawingManager = null;
    this.roundManager = null;
    this.botActionTimer = null;
    this.secondaryBuryTimer = null;
    this.peopleCommuneBuryTimer = null;
    this.timeReversalDecisionTimer = null;
    this.timeReversalRoundSnapshot = null;
    this.onBotTurn = null;
    this.onTimeReversalWindowClosed = null;
    this.cardExchangeSelections = new Map();
    this.icebergSelectionRequests = new Map();
    this.icebergInitialSelectionActive = false;
    this.gentlemanPromiseOptionsByPlayerId = new Map();
    this.hiddenDragonOptionsByPlayerId = new Map();
    this.antinomyPendingSelections = new Map();
    this.isFinalizingDestroyDykeRound = false;
  }

  getRuleRuntimeContext() {
    const { selectedRule, currentRound, inferiorSuit } = this.room.gameState;
    if (!selectedRule) return null;
    if (isDayNightRotationRule(selectedRule)) {
      return { ...selectedRule, currentRound };
    }
    if (isThreeSixNineGradesRule(selectedRule)) {
      return { ...selectedRule, inferiorSuit };
    }
    if (isAntinomyRule(selectedRule)) {
      return {
        ...selectedRule,
        antinomySplitFaceKeys: this.getAntinomySplitFaceKeys()
      };
    }
    return selectedRule;
  }

  beginIronEvidenceRound() {
    const { gameState } = this.room;
    if (!isIronEvidenceRule(gameState.selectedRule)) {
      gameState.ironEvidenceRoundMode = null;
      return null;
    }
    gameState.ironEvidenceRoundMode = getIronEvidenceRoundMode(
      gameState.ironEvidencePlayedBigJokerIds.size
    );
    return gameState.ironEvidenceRoundMode;
  }

  ensureIronEvidenceRoundMode() {
    if (!isIronEvidenceRule(this.room.gameState.selectedRule)) return null;
    return this.room.gameState.ironEvidenceRoundMode || this.beginIronEvidenceRound();
  }

  recordIronEvidenceBigJokers(cards = []) {
    if (!isIronEvidenceRule(this.room.gameState.selectedRule)) return [];
    const ids = cards
      .filter(isIronEvidenceBigJoker)
      .map(card => card.id);
    ids.forEach(cardId => this.room.gameState.ironEvidencePlayedBigJokerIds.add(cardId));
    return ids;
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

    // 第一局随机指定一名玩家二选一；若已有已完成的上一局，则沿用其末轮赢家。
    this.startRuleSelection();
  }

  /**
   * 为即将开始的一局创建服务端可信的二选一候选并确定选择者。
   */
  startRuleSelection() {
    const { gameState, players } = this.room;
    if (players.length === 0) {
      throw new Error('没有玩家可以选择规则');
    }

    const configuredTestRule = this.room.config.testMode
      ? getRuleById(this.room.config.testRuleId)
      : null;
    if (configuredTestRule && !isDoubleHappinessRule(configuredTestRule)) {
      const ruleSetup = getRuleSetup(configuredTestRule);
      gameState.selectedRule = configuredTestRule;
      gameState.ruleOptions = [];
      gameState.ruleChooserPlayerId = null;
      gameState.isRuleSelectionPending = false;
      gameState.ruleSelectionMode = null;
      gameState.bottomCardsCount = ruleSetup.bottomCardsCount;
      gameState.attackerScore = ruleSetup.attackerStartingScore;
      this.initializeFocusFigureCandidates();
      this.io.to(this.room.id).emit('rule_selected', {
        playerId: null,
        playerName: '规则测试模式',
        rule: configuredTestRule,
        testMode: true
      });
      logger.info(`房间 ${this.room.id} 测试模式直接启用规则: ${configuredTestRule.name}`);
      return null;
    }
    if (configuredTestRule && isDoubleHappinessRule(configuredTestRule)) {
      const chooser = this.room.findPlayerBySocketId(this.room.hostId)
        || players.find(player => !player.isBot)
        || players[0];
      gameState.selectedRule = null;
      gameState.ruleOptions = [];
      gameState.ruleChooserPlayerId = chooser.id;
      gameState.isRuleSelectionPending = true;
      gameState.ruleSelectionMode = 'single';
      this.beginDoubleHappinessSelection(chooser.id);
      logger.info(
        `房间 ${this.room.id} 测试模式启用双喜临门，由房主 ${chooser.name} 直接进行三选二`
      );
      return chooser;
    }

    const rememberedIndex = gameState.nextRuleChooserIndex;
    const chooserIndex = Number.isInteger(rememberedIndex) && players[rememberedIndex]
      ? rememberedIndex
      : Math.floor(this.random() * players.length);
    const chooser = players[chooserIndex];

    gameState.selectedRule = null;
    const forcedTestRuleId = process.env.NODE_ENV === 'test' &&
      this.room.name.startsWith('__e2e_rule__:')
      ? this.room.name.slice('__e2e_rule__:'.length)
      : null;
    const forcedTestRule = forcedTestRuleId
      ? getRuleById(forcedTestRuleId)
      : null;
    gameState.ruleOptions = forcedTestRule
      ? [forcedTestRule, getRuleById(RuleIds.NORMAL_GAME)]
      : createRuleOptions(this.random);
    gameState.ruleChooserPlayerId = chooser.id;
    gameState.isRuleSelectionPending = true;
    gameState.ruleSelectionMode = 'single';

    this.io.to(this.room.id).emit('rule_selection_started', {
      chooserPlayerId: chooser.id,
      chooserPlayerName: chooser.name,
      selectionMode: gameState.ruleSelectionMode,
      options: gameState.ruleOptions
    });

    logger.info(`房间 ${this.room.id} 由 ${chooser.name} 从两条规则中选择本局规则`);

    // Bot选择者不能阻塞流程，随机选择一个服务端候选。
    if (chooser.isBot) {
      const optionIndex = Math.floor(this.random() * gameState.ruleOptions.length);
      this.selectRule(chooser.id, gameState.ruleOptions[optionIndex]);
    }

    return chooser;
  }

  /**
   * 由本局指定玩家确认规则。返回 true 表示选择后已直接进入发牌。
   */
  selectRule(playerId, selection) {
    const { gameState } = this.room;
    if (!gameState.isRuleSelectionPending) {
      throw new Error('当前不在规则选择阶段');
    }
    if (gameState.ruleChooserPlayerId !== playerId) {
      throw new Error('你不是本局的规则选择者');
    }

    if (gameState.ruleSelectionMode === 'double_happiness') {
      const selectionIds = Array.isArray(selection?.ids)
        ? selection.ids
        : Array.isArray(selection?.rules)
          ? selection.rules
          : [];
      const combinedRule = createDoubleHappinessRule(selectionIds, gameState.ruleOptions);
      return this.finalizeRuleSelection(playerId, combinedRule);
    }

    const rule = resolveOfferedRule(selection, gameState.ruleOptions);
    if (!rule) {
      throw new Error('只能从本局提供的两条规则中选择');
    }
    if (isDoubleHappinessRule(rule)) {
      return this.beginDoubleHappinessSelection(playerId);
    }

    return this.finalizeRuleSelection(playerId, rule);
  }

  beginDoubleHappinessSelection(playerId) {
    const { gameState } = this.room;
    gameState.selectedRule = null;
    gameState.ruleOptions = createRuleOptions(this.random, {
      count: 3,
      excludeIds: [RuleIds.DOUBLE_HAPPINESS]
    });
    gameState.ruleSelectionMode = 'double_happiness';
    const chooser = this.room.findPlayerById(playerId);
    this.io.to(this.room.id).emit('double_happiness_selection_started', {
      chooserPlayerId: playerId,
      chooserPlayerName: chooser?.name || '未知玩家',
      options: gameState.ruleOptions
    });
    logger.info(
      `房间 ${this.room.id} 玩家 ${chooser?.name || playerId} 触发双喜临门，改为三选二`
    );

    if (chooser?.isBot) {
      let selectedPair = null;
      for (let first = 0; first < gameState.ruleOptions.length; first += 1) {
        for (let second = first + 1; second < gameState.ruleOptions.length; second += 1) {
          const ids = [gameState.ruleOptions[first].id, gameState.ruleOptions[second].id];
          try {
            createDoubleHappinessRule(ids, gameState.ruleOptions);
            selectedPair = ids;
            break;
          } catch {
            // Bot继续尝试当前三条候选中的下一种组合。
          }
        }
        if (selectedPair) break;
      }
      if (!selectedPair) {
        const normalRule = getRuleById(RuleIds.NORMAL_GAME);
        const partner = gameState.ruleOptions.find(option => option.id !== normalRule.id);
        gameState.ruleOptions = [
          partner,
          normalRule,
          ...gameState.ruleOptions.filter(option => ![partner?.id, normalRule.id].includes(option.id))
        ].filter(Boolean).slice(0, 3);
        selectedPair = [partner.id, normalRule.id];
      }
      return this.selectRule(playerId, { ids: selectedPair });
    }
    return false;
  }

  refreshDoubleHappinessOption(requesterSocketId, optionIndex) {
    const { gameState } = this.room;
    if (
      !gameState.isRuleSelectionPending
      || gameState.ruleSelectionMode !== 'double_happiness'
    ) {
      throw new Error('当前不在双喜临门的三选二阶段');
    }
    if (this.room.hostId !== requesterSocketId) {
      throw new Error('只有房主可以刷新双喜临门候选');
    }
    if (
      !Number.isInteger(optionIndex)
      || optionIndex < 0
      || optionIndex >= gameState.ruleOptions.length
    ) {
      throw new Error('要刷新的候选位置无效');
    }

    const oldRule = gameState.ruleOptions[optionIndex];
    const replacement = createRuleOptions(this.random, {
      count: 1,
      excludeIds: [
        RuleIds.DOUBLE_HAPPINESS,
        ...gameState.ruleOptions.map(rule => rule.id)
      ]
    })[0];
    if (!replacement) throw new Error('没有可用于刷新的其他规则');
    gameState.ruleOptions = gameState.ruleOptions.map((rule, index) => (
      index === optionIndex ? replacement : rule
    ));
    const host = this.room.findPlayerBySocketId(requesterSocketId);
    const result = {
      optionIndex,
      oldRule,
      rule: replacement,
      refreshedByPlayerId: host?.id || null,
      refreshedByPlayerName: host?.name || '房主'
    };
    this.io.to(this.room.id).emit('double_happiness_option_refreshed', result);
    logger.info(
      `房间 ${this.room.id} 房主将双喜临门候选 ${oldRule.name} 刷新为 ${replacement.name}`
    );
    return result;
  }

  finalizeRuleSelection(playerId, rule) {
    const { gameState } = this.room;
    gameState.selectedRule = rule;
    gameState.isRuleSelectionPending = false;
    gameState.ruleSelectionMode = null;
    const ruleSetup = getRuleSetup(rule);
    gameState.bottomCardsCount = ruleSetup.bottomCardsCount;
    gameState.attackerScore = ruleSetup.attackerStartingScore;
    this.initializeFocusFigureCandidates();

    const player = this.room.findPlayerById(playerId);
    this.io.to(this.room.id).emit('rule_selected', {
      playerId,
      playerName: player?.name || '未知玩家',
      rule
    });

    logger.info(`房间 ${this.room.id} 玩家 ${player?.name || playerId} 选择规则: ${rule.name}`);

    if (!gameState.isWaitingForReady) {
      this.startDrawing();
      return true;
    }
    return false;
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
      logger.info(`房间 ${this.room.id} 所有玩家准备完毕`);
      // 清除准备等待状态
      this.room.gameState.isWaitingForReady = false;
      if (!this.room.gameState.isRuleSelectionPending) {
        this.startDrawing();
      }
    }

    return allReady;
  }

  /**
   * 开始发牌
   */
  startDrawing() {
    // 创建并启动摸牌管理器
    this.drawingManager = new DrawingPhaseManager(
      this.room,
      this.io,
      dealer => this.handleDealerAssigned(dealer),
      () => this.handleDrawingComplete(),
      dealer => this.handleDealerSelected(dealer),
      this.random,
      (player, card) => this.handleRuleCardDealt(player, card)
    );
    this.drawingManager.start();

    // 广播开始发牌
    this.io.to(this.room.id).emit('start_drawing', {
      phase: GamePhases.DRAWING
    });
  }

  /** 发牌结束后开放最后的亮主/反主窗口；换牌必须等庄家锁定后才开始。 */
  handleDrawingComplete() {
    this.room.gameState.postDrawStage = 'trump_window';
    this.drawingManager?.startDealerCountdown();
    this.broadcastRoomUpdate();
  }

  /** “二鬼拍门”：摸牌时一旦达到两王，余下整局持续公开该玩家仍持有的全部王。 */
  handleRuleCardDealt(player) {
    const { gameState } = this.room;
    let ruleResult = null;

    if (
      isTwoGhostsKnockDoorRule(gameState.selectedRule)
      && gameState.phase === GamePhases.DRAWING
      && player
    ) {
      const jokers = player.cards.filter(card => card.suit === Suits.JOKER);
      const wasRevealed = gameState.twoGhostsRevealedPlayerIds.has(player.id);
      if (wasRevealed || jokers.length >= 2) {
        gameState.twoGhostsRevealedPlayerIds.add(player.id);
        this.emitRuleVisibleHands(
          wasRevealed
            ? null
            : `${player.name} 二鬼拍门：明置手中的全部王`
        );
        ruleResult = {
          triggered: !wasRevealed,
          playerId: player.id,
          cards: jokers.map(card => card.toJSON())
        };
      }
    }

    this.tryWhoDesignedBotTrumpDeclaration(player);
    return ruleResult;
  }

  /**
   * WhoDesigned 原程序会在每次摸牌后调用 call_Snatch。旧适配器只接了
   * 出牌阶段，导致 Bot 永远不会主动亮主或反主。
   */
  tryWhoDesignedBotTrumpDeclaration(player) {
    const { gameState } = this.room;
    if (
      !player?.isBot
      || !shouldUseWhoDesignedStrategy(this.room)
      || gameState.phase !== GamePhases.DRAWING
      || gameState.isTrumpDeclarationLocked
      || gameState.cardExchange
      || !gameState.trumpRank
    ) return null;

    // 这两条 DLC 使用多份独立声明状态；WhoDesigned 原版只支持普通单主牌局。
    if (
      isOneCountryTwoSystemsRule(gameState.selectedRule)
      || isThreeSixNineGradesRule(gameState.selectedRule)
    ) return null;

    const decision = chooseWhoDesignedTrumpDeclaration({
      cards: player.cards,
      trumpRank: gameState.trumpRank,
      currentTrumpDeclaration: gameState.currentTrumpDeclaration,
      playerId: player.id
    });
    if (!decision) return null;

    const previousDeclaration = gameState.currentTrumpDeclaration;
    const validation = validateDeclaration(
      player.cards,
      decision.suit,
      decision.count,
      gameState.trumpRank,
      previousDeclaration,
      player.id
    );
    if (!validation.valid) return null;

    const declaration = {
      playerId: player.id,
      playerName: player.name,
      suit: decision.suit,
      count: decision.count,
      declarationType: validation.declarationType,
      strength: validation.strength,
      jokerType: validation.jokerType,
      declarationRole: 'trump',
      isCounter: previousDeclaration !== null,
      cards: validation.cards
    };

    if (
      previousDeclaration
      && previousDeclaration.playerId !== player.id
      && isRemoveFirewoodRule(gameState.selectedRule)
    ) {
      gameState.removeFirewoodCounterPairs.push({
        sequence: gameState.removeFirewoodCounterPairs.length + 1,
        counteredPlayerId: previousDeclaration.playerId,
        counteredPlayerName: previousDeclaration.playerName,
        counteringPlayerId: player.id,
        counteringPlayerName: player.name
      });
    }

    gameState.currentTrumpDeclaration = declaration;
    gameState.trumpSuit = decision.suit;
    this.io.to(this.room.id).emit('trump_declared', {
      playerId: player.id,
      playerName: player.name,
      suit: decision.suit,
      count: decision.count,
      declarationType: validation.declarationType,
      strength: validation.strength,
      isCounter: declaration.isCounter,
      declarationRole: 'trump',
      teamIndex: null,
      oneCountryTwoSystems: false,
      cards: validation.cards.map(card => card.toJSON())
    });
    this.io.to(this.room.id).emit('trump_updated', {
      trumpSuit: gameState.trumpSuit,
      trumpRank: gameState.trumpRank,
      oneCountryTwoSystems: null,
      inferiorSuit: null
    });
    logger.info(
      `WhoDesigned Bot ${player.name} ${declaration.isCounter ? '反主' : '亮主'}: `
      + `${decision.count === 2 ? '一对' : '单张'} ${decision.suit}`
    );
    return declaration;
  }

  /** 庄家锁定后、收底牌前，为开局换牌规则插入四家同时换牌。 */
  handleDealerSelected(dealer = null) {
    if (this.startRemoveFirewoodExchange(dealer)) return true;
    this.applyFatalBeautyTrumpBonus();
    if (isHappyTwinsRule(this.room.gameState.selectedRule)) {
      this.applyHappyTwinsPositionSwap(dealer);
    }
    if (isMainstayRule(this.room.gameState.selectedRule)) {
      return this.startMainstay();
    }
    if (!isOpeningCardExchangeRule(this.room.gameState.selectedRule)) return false;
    this.startOpeningCardExchange();
    return true;
  }

  /**
   * “釜底抽薪”：庄家已按最终反主结果锁定，但尚未收底牌。
   * 每次反主形成一对“被反主者—反主者”，亮主结束后从最后一对向前询问。
   */
  startRemoveFirewoodExchange(dealer = null) {
    const { gameState } = this.room;
    if (!isRemoveFirewoodRule(gameState.selectedRule)) return false;
    if (gameState.removeFirewoodCounterPairs.length === 0) return false;
    if (gameState.removeFirewoodCurrentDecision || gameState.removeFirewoodExchangeQueue.length > 0) {
      return true;
    }

    gameState.removeFirewoodExchangeQueue = [...gameState.removeFirewoodCounterPairs]
      .reverse()
      .map(pair => ({ ...pair }));
    gameState.removeFirewoodExchangeResults = [];
    gameState.postDrawStage = 'remove_firewood_exchange';
    if (dealer?.id) gameState.pendingDealerPlayerId = dealer.id;

    this.io.to(this.room.id).emit('remove_firewood_exchange_started', {
      totalCount: gameState.removeFirewoodExchangeQueue.length,
      message: '反主结算完成，开始由后向前询问釜底抽薪'
    });
    this.advanceRemoveFirewoodExchange();
    return true;
  }

  advanceRemoveFirewoodExchange() {
    const { gameState } = this.room;
    if (!isRemoveFirewoodRule(gameState.selectedRule)) return null;
    if (gameState.removeFirewoodCurrentDecision) {
      return gameState.removeFirewoodCurrentDecision;
    }

    const nextPair = gameState.removeFirewoodExchangeQueue.shift() || null;
    if (!nextPair) {
      gameState.postDrawStage = null;
      this.io.to(this.room.id).emit('remove_firewood_exchange_completed', {
        totalCount: gameState.removeFirewoodExchangeResults.length,
        exchangedCount: gameState.removeFirewoodExchangeResults.filter(result => result.accepted).length
      });
      this.broadcastRoomUpdate();
      if (gameState.pendingDealerPlayerId) {
        this.drawingManager?.completeDealerAssignment(gameState.pendingDealerPlayerId);
      }
      return null;
    }

    const decision = {
      ...nextPair,
      remainingCount: gameState.removeFirewoodExchangeQueue.length
    };
    gameState.removeFirewoodCurrentDecision = decision;
    this.io.to(this.room.id).emit('remove_firewood_decision_pending', decision);
    this.broadcastRoomUpdate();

    const counteredPlayer = this.room.findPlayerById(decision.counteredPlayerId);
    if (!counteredPlayer) {
      throw new Error('被反主的玩家不存在');
    }
    if (counteredPlayer.isBot) {
      // Bot同样拥有选择权；在不知道对方手牌的前提下随机决定，绝不强制交换。
      return this.respondRemoveFirewood(counteredPlayer.id, this.random() < 0.5);
    }
    if (counteredPlayer.socketId) {
      this.io.to(counteredPlayer.socketId).emit('remove_firewood_decision_required', decision);
    }
    return decision;
  }

  respondRemoveFirewood(playerId, accept = false) {
    const { gameState } = this.room;
    if (!isRemoveFirewoodRule(gameState.selectedRule)) {
      throw new Error('当前规则不是釜底抽薪');
    }
    const decision = gameState.removeFirewoodCurrentDecision;
    if (!decision) throw new Error('当前没有待处理的釜底抽薪');
    if (decision.counteredPlayerId !== playerId) {
      throw new Error('只有本次被反主的玩家可以决定是否交换');
    }

    const counteredPlayer = this.room.findPlayerById(decision.counteredPlayerId);
    const counteringPlayer = this.room.findPlayerById(decision.counteringPlayerId);
    if (!counteredPlayer || !counteringPlayer) throw new Error('交换玩家不存在');

    const accepted = accept === true;
    let exchange = null;
    if (accepted) {
      const counteredHand = [...counteredPlayer.cards];
      const counteringHand = [...counteringPlayer.cards];
      counteredPlayer.cards = DeckService.autoSortCards(counteringHand);
      counteringPlayer.cards = DeckService.autoSortCards(counteredHand);
      counteredPlayer.shownCards.clear();
      counteringPlayer.shownCards.clear();

      exchange = {
        triggerKey: `remove_firewood_${decision.sequence}`,
        ruleName: '釜底抽薪',
        exchangeKind: 'pair',
        actorPlayerId: counteredPlayer.id,
        actorPlayerName: counteredPlayer.name,
        targetPlayerId: counteringPlayer.id,
        targetPlayerName: counteringPlayer.name,
        transfers: [
          {
            fromPlayerId: counteredPlayer.id,
            fromPlayerName: counteredPlayer.name,
            toPlayerId: counteringPlayer.id,
            toPlayerName: counteringPlayer.name,
            cardsCount: counteredHand.length
          },
          {
            fromPlayerId: counteringPlayer.id,
            fromPlayerName: counteringPlayer.name,
            toPlayerId: counteredPlayer.id,
            toPlayerName: counteredPlayer.name,
            cardsCount: counteringHand.length
          }
        ],
        animationDuration: WHOLE_HAND_EXCHANGE_ANIMATION_MS
      };
      this.io.to(this.room.id).emit('whole_hand_exchange_resolved', exchange);
      [counteredPlayer, counteringPlayer].forEach(player => {
        const other = player.id === counteredPlayer.id ? counteringPlayer : counteredPlayer;
        if (!player.socketId) return;
        this.io.to(player.socketId).emit('whole_hand_exchange_hand_updated', {
          ...exchange,
          fromPlayerId: other.id,
          fromPlayerName: other.name,
          cards: player.cards.map(card => card.toJSON())
        });
      });
    }

    const result = {
      ...decision,
      accepted,
      exchange
    };
    gameState.removeFirewoodExchangeResults.push({
      sequence: decision.sequence,
      counteredPlayerId: decision.counteredPlayerId,
      counteredPlayerName: decision.counteredPlayerName,
      counteringPlayerId: decision.counteringPlayerId,
      counteringPlayerName: decision.counteringPlayerName,
      accepted
    });
    gameState.removeFirewoodCurrentDecision = null;
    this.io.to(this.room.id).emit('remove_firewood_decision_resolved', {
      sequence: decision.sequence,
      counteredPlayerId: decision.counteredPlayerId,
      counteredPlayerName: decision.counteredPlayerName,
      counteringPlayerId: decision.counteringPlayerId,
      counteringPlayerName: decision.counteringPlayerName,
      accepted,
      remainingCount: gameState.removeFirewoodExchangeQueue.length
    });
    logger.info(
      `房间 ${this.room.id} 釜底抽薪：${counteredPlayer.name}` +
      `${accepted ? `与 ${counteringPlayer.name} 交换全部手牌` : '选择不交换'}`
    );

    this.advanceRemoveFirewoodExchange();
    return result;
  }

  applyFatalBeautyTrumpBonus() {
    const { gameState } = this.room;
    if (
      !isFatalBeautyRule(gameState.selectedRule)
      || gameState.fatalBeautyTrumpBonusApplied
      || gameState.trumpSuit !== 'hearts'
    ) {
      return false;
    }
    gameState.attackerScore += 20;
    gameState.fatalBeautyTrumpBonusApplied = true;
    this.io.to(this.room.id).emit('fatal_beauty_trump_bonus', {
      bonus: 20,
      attackerScore: gameState.attackerScore
    });
    logger.info(`房间 ${this.room.id} 红颜祸水：红桃为主，闲家开局分调整为 ${gameState.attackerScore}`);
    return true;
  }

  /**
   * 欢乐成双只改变座次，不改变开局时的组队关系。
   * 规则生效期间必须按换位前的玩家顺序取队伍，不能直接用当前数组下标奇偶。
   */
  getPlayerTeamIndex(playerId) {
    if (!playerId) return null;
    const happyTwins = this.room.gameState.happyTwins;
    if (
      isHappyTwinsRule(this.room.gameState.selectedRule)
      && Array.isArray(happyTwins?.originalOrderPlayerIds)
    ) {
      const originalIndex = happyTwins.originalOrderPlayerIds.indexOf(playerId);
      if (originalIndex >= 0) return originalIndex % 2;
    }
    const currentIndex = this.room.getPlayerIndex(playerId);
    return currentIndex >= 0 ? currentIndex % 2 : null;
  }

  isAttackerPlayerIndex(playerIndex, dealerIndex) {
    const player = this.room.findPlayerByIndex(playerIndex);
    const dealer = this.room.findPlayerByIndex(dealerIndex);
    const playerTeamIndex = this.getPlayerTeamIndex(player?.id);
    const dealerTeamIndex = this.getPlayerTeamIndex(dealer?.id);
    if (playerTeamIndex !== null && dealerTeamIndex !== null) {
      return playerTeamIndex !== dealerTeamIndex;
    }
    return isAttacker(playerIndex, dealerIndex, this.room.players.length);
  }

  getFixedTeammate(playerId) {
    const happyTwins = this.room.gameState.happyTwins;
    if (
      isHappyTwinsRule(this.room.gameState.selectedRule)
      && Array.isArray(happyTwins?.originalOrderPlayerIds)
      && happyTwins.originalOrderPlayerIds.length === 4
    ) {
      const originalIndex = happyTwins.originalOrderPlayerIds.indexOf(playerId);
      if (originalIndex >= 0) {
        const teammateId = happyTwins.originalOrderPlayerIds[(originalIndex + 2) % 4];
        return this.room.findPlayerById(teammateId);
      }
    }
    const playerIndex = this.room.getPlayerIndex(playerId);
    if (playerIndex < 0 || this.room.players.length !== 4) return null;
    return this.room.findPlayerByIndex((playerIndex + 2) % 4);
  }

  /** “欢乐成双”：庄家锁定后、收底牌前，与其固定上家（索引-1）交换座位。 */
  applyHappyTwinsPositionSwap(dealer = null) {
    const { gameState, players } = this.room;
    if (!isHappyTwinsRule(gameState.selectedRule)) return null;
    if (players.length !== 4) throw new Error('欢乐成双仅支持四人局');
    if (gameState.happyTwins?.active && !gameState.happyTwins.restored) {
      return gameState.happyTwins;
    }

    const dealerPlayer = dealer || this.room.findPlayerById(gameState.pendingDealerPlayerId);
    if (!dealerPlayer) throw new Error('欢乐成双需要先锁定庄家');
    const dealerIndex = this.room.getPlayerIndex(dealerPlayer.id);
    if (dealerIndex < 0) throw new Error('欢乐成双找不到庄家座位');
    const upstreamIndex = (dealerIndex - 1 + players.length) % players.length;
    const upstreamPlayer = players[upstreamIndex];
    const originalOrderPlayerIds = players.map(player => player.id);

    [players[dealerIndex], players[upstreamIndex]] = [
      players[upstreamIndex],
      players[dealerIndex]
    ];
    players.forEach((player, index) => {
      player.position = index;
    });

    const swappedDealerIndex = this.room.getPlayerIndex(dealerPlayer.id);
    gameState.dealerPlayerIndex = swappedDealerIndex;
    gameState.happyTwins = {
      active: true,
      restored: false,
      dealerPlayerId: dealerPlayer.id,
      dealerPlayerName: dealerPlayer.name,
      upstreamPlayerId: upstreamPlayer.id,
      upstreamPlayerName: upstreamPlayer.name,
      originalDealerIndex: dealerIndex,
      originalUpstreamIndex: upstreamIndex,
      swappedDealerIndex,
      swappedUpstreamIndex: this.room.getPlayerIndex(upstreamPlayer.id),
      originalOrderPlayerIds,
      swappedOrderPlayerIds: players.map(player => player.id),
      nextDealerPlayerId: null,
      nextDealerIndex: null
    };

    this.io.to(this.room.id).emit('happy_twins_positions_swapped', {
      dealerPlayerId: dealerPlayer.id,
      dealerPlayerName: dealerPlayer.name,
      upstreamPlayerId: upstreamPlayer.id,
      upstreamPlayerName: upstreamPlayer.name,
      dealerIndex: swappedDealerIndex,
      upstreamIndex: gameState.happyTwins.swappedUpstreamIndex
    });
    this.broadcastRoomUpdate();
    logger.info(
      `房间 ${this.room.id} 欢乐成双：庄家 ${dealerPlayer.name} 与上家 ${upstreamPlayer.name} 交换位置`
    );
    return gameState.happyTwins;
  }

  /**
   * 终局先在临时座次中确定下一庄具体玩家，再恢复原顺序并按玩家ID重算索引。
   * 同时把仍需跨局使用的赢家索引一并重映射，避免下局规则选择者错位。
   */
  restoreHappyTwinsPositions(nextDealerPlayerId = null) {
    const { gameState } = this.room;
    const state = gameState.happyTwins;
    if (!isHappyTwinsRule(gameState.selectedRule) || !state || state.restored) return null;

    const previousOrder = [...this.room.players];
    const playerById = new Map(previousOrder.map(player => [player.id, player]));
    const restoredPlayers = state.originalOrderPlayerIds.map(playerId => playerById.get(playerId));
    if (restoredPlayers.some(player => !player)) {
      throw new Error('欢乐成双无法恢复原座次：玩家顺序不完整');
    }

    const playerIdAtIndex = index => (
      Number.isInteger(index) && previousOrder[index] ? previousOrder[index].id : null
    );
    const lastRoundWinnerPlayerId = playerIdAtIndex(gameState.lastRoundWinnerIndex);
    const currentPlayerId = playerIdAtIndex(gameState.currentPlayerIndex);
    const roundStartPlayerId = playerIdAtIndex(gameState.roundStartPlayerIndex);
    const currentWinnerPlayerId = playerIdAtIndex(gameState.currentWinnerIndex);
    const nextRuleChooserPlayerId = playerIdAtIndex(gameState.nextRuleChooserIndex);

    this.room.players = restoredPlayers;
    this.room.players.forEach((player, index) => {
      player.position = index;
    });
    const restoredIndexOf = playerId => (
      playerId ? this.room.getPlayerIndex(playerId) : null
    );

    if (lastRoundWinnerPlayerId) {
      gameState.lastRoundWinnerIndex = restoredIndexOf(lastRoundWinnerPlayerId);
    }
    if (currentPlayerId) gameState.currentPlayerIndex = restoredIndexOf(currentPlayerId);
    if (roundStartPlayerId) gameState.roundStartPlayerIndex = restoredIndexOf(roundStartPlayerId);
    if (currentWinnerPlayerId) gameState.currentWinnerIndex = restoredIndexOf(currentWinnerPlayerId);
    if (nextRuleChooserPlayerId) {
      gameState.nextRuleChooserIndex = restoredIndexOf(nextRuleChooserPlayerId);
    }
    gameState.playHistory = gameState.playHistory.map(entry => ({
      ...entry,
      playerIndex: restoredIndexOf(entry.playerId)
    }));

    const resolvedNextDealerPlayerId = nextDealerPlayerId || state.dealerPlayerId;
    const restoredNextDealerIndex = restoredIndexOf(resolvedNextDealerPlayerId);
    if (!Number.isInteger(restoredNextDealerIndex) || restoredNextDealerIndex < 0) {
      throw new Error('欢乐成双无法在原座次中找到下一局庄家');
    }
    gameState.dealerPlayerIndex = restoredNextDealerIndex;
    state.active = false;
    state.restored = true;
    state.nextDealerPlayerId = resolvedNextDealerPlayerId;
    state.nextDealerIndex = restoredNextDealerIndex;
    state.restoredOrderPlayerIds = this.room.players.map(player => player.id);

    const nextDealer = this.room.findPlayerById(resolvedNextDealerPlayerId);
    this.io.to(this.room.id).emit('happy_twins_positions_restored', {
      dealerPlayerId: state.dealerPlayerId,
      dealerPlayerName: state.dealerPlayerName,
      upstreamPlayerId: state.upstreamPlayerId,
      upstreamPlayerName: state.upstreamPlayerName,
      nextDealerPlayerId: resolvedNextDealerPlayerId,
      nextDealerPlayerName: nextDealer?.name || '未知玩家',
      nextDealerIndex: restoredNextDealerIndex
    });
    logger.info(
      `房间 ${this.room.id} 欢乐成双：恢复原座次，下一局由 ${nextDealer?.name || '未知玩家'} 上庄`
    );
    return {
      nextDealerPlayerId: resolvedNextDealerPlayerId,
      nextDealerIndex: restoredNextDealerIndex,
      lastRoundWinnerPlayerId,
      restoredOrderPlayerIds: [...state.restoredOrderPlayerIds]
    };
  }

  /**
   * “中流砥柱”必须按一至四号位串行处理。队友收到牌后，等轮到自己时会用
   * 已变化的实时手牌重新计算主牌数，因此同队两人可以先后发动并把主牌交回去。
   */
  startMainstay() {
    const { gameState, players } = this.room;
    if (gameState.phase !== GamePhases.DRAWING) {
      throw new Error('只有摸牌结束后才能开始中流砥柱');
    }
    if (!isMainstayRule(gameState.selectedRule)) return false;
    if (players.length !== 4) throw new Error('中流砥柱仅支持四人局');

    gameState.isTrumpDeclarationLocked = true;
    gameState.mainstayPlayerQueue = [];
    gameState.mainstayCurrentAction = null;
    gameState.mainstayResults = [];

    if (!gameState.trumpSuit || gameState.trumpSuit === Suits.NO_TRUMP) {
      this.io.to(this.room.id).emit('mainstay_completed', {
        skipped: true,
        reason: 'no_trump',
        message: '无主局不执行中流砥柱'
      });
      return false;
    }

    gameState.postDrawStage = 'mainstay';
    // 开局号位以庄家为一号位，沿玩家数组（牌桌逆时针）依次为二、三、四号位。
    const pendingDealerIndex = this.room.getPlayerIndex(gameState.pendingDealerPlayerId);
    const firstPositionIndex = pendingDealerIndex >= 0
      ? pendingDealerIndex
      : Number.isInteger(gameState.dealerPlayerIndex)
        ? gameState.dealerPlayerIndex
        : 0;
    gameState.mainstayPlayerQueue = Array.from(
      { length: players.length },
      (_, offset) => players[(firstPositionIndex + offset) % players.length].id
    );
    this.io.to(this.room.id).emit('mainstay_started', {
      ruleId: gameState.selectedRule.id,
      ruleName: gameState.selectedRule.name,
      requiredCards: MAINSTAY_CARD_COUNT,
      playerOrder: [...gameState.mainstayPlayerQueue]
    });
    this.broadcastRoomUpdate();
    this.advanceMainstay();
    return true;
  }

  getMainstayTrumpCards(player) {
    const { trumpSuit, trumpRank } = this.room.gameState;
    return (player?.cards || []).filter(card => isTrumpCard(card, trumpSuit, trumpRank));
  }

  getMainstayTeammate(playerId) {
    const playerIndex = this.room.getPlayerIndex(playerId);
    if (playerIndex < 0 || this.room.players.length !== 4) return null;
    return this.room.findPlayerByIndex((playerIndex + 2) % this.room.players.length);
  }

  emitMainstayActionRequired(action) {
    if (!action) return;
    const chooser = this.room.findPlayerById(action.chooserPlayerId);
    const actor = this.room.findPlayerById(action.actorPlayerId);
    const teammate = this.room.findPlayerById(action.teammatePlayerId);
    const privatePayload = {
      ...action,
      actorPlayerName: actor?.name || '未知玩家',
      teammatePlayerName: teammate?.name || '未知玩家'
    };
    const { trumpCount: _privateTrumpCount, ...publicPayload } = privatePayload;
    this.io.to(this.room.id).emit('mainstay_action_pending', publicPayload);
    if (!chooser?.socketId || chooser.isBot) return;
    this.io.to(chooser.socketId).emit(
      action.stage === 'decision' ? 'mainstay_decision_required' : 'mainstay_cards_required',
      privatePayload
    );
  }

  advanceMainstay() {
    const { gameState } = this.room;
    if (!isMainstayRule(gameState.selectedRule)) return null;
    if (gameState.mainstayCurrentAction) return gameState.mainstayCurrentAction;

    while (gameState.mainstayPlayerQueue.length > 0) {
      const actorPlayerId = gameState.mainstayPlayerQueue.shift();
      const actor = this.room.findPlayerById(actorPlayerId);
      const teammate = this.getMainstayTeammate(actorPlayerId);
      if (!actor || !teammate) throw new Error('中流砥柱的玩家或队友不存在');

      const trumpCount = this.getMainstayTrumpCards(actor).length;
      const pendingDealerIndex = this.room.getPlayerIndex(gameState.pendingDealerPlayerId);
      const firstPositionIndex = pendingDealerIndex >= 0
        ? pendingDealerIndex
        : Number.isInteger(gameState.dealerPlayerIndex)
          ? gameState.dealerPlayerIndex
          : 0;
      const actorIndex = this.room.getPlayerIndex(actor.id);
      const position = ((actorIndex - firstPositionIndex + this.room.players.length)
        % this.room.players.length) + 1;
      if (trumpCount > MAINSTAY_CARD_COUNT || actor.cards.length < MAINSTAY_CARD_COUNT) {
        const skipped = {
          playerId: actor.id,
          playerName: actor.name,
          position,
          trumpCount,
          eligible: false,
          accepted: false,
          reason: trumpCount > MAINSTAY_CARD_COUNT ? 'too_many_trumps' : 'not_enough_cards'
        };
        gameState.mainstayResults.push(skipped);
        const { trumpCount: _privateTrumpCount, ...publicSkipped } = skipped;
        this.io.to(this.room.id).emit('mainstay_player_skipped', publicSkipped);
        continue;
      }

      const action = {
        id: `mainstay-${position}-${actor.id}-${Date.now()}`,
        stage: 'decision',
        position,
        actorPlayerId: actor.id,
        teammatePlayerId: teammate.id,
        chooserPlayerId: actor.id,
        trumpCount,
        requiredCards: MAINSTAY_CARD_COUNT,
        remainingCount: gameState.mainstayPlayerQueue.length
      };
      gameState.mainstayCurrentAction = action;
      this.emitMainstayActionRequired(action);
      this.broadcastRoomUpdate();

      if (actor.isBot) return this.respondMainstay(actor.id, true);
      return action;
    }

    gameState.mainstayCurrentAction = null;
    gameState.postDrawStage = null;
    const results = gameState.mainstayResults.map(result => Object.fromEntries(
      Object.entries(result).filter(([key]) => key !== 'trumpCount')
    ));
    this.io.to(this.room.id).emit('mainstay_completed', {
      skipped: false,
      results,
      activatedCount: results.filter(result => result.accepted).length
    });
    this.broadcastRoomUpdate();
    if (gameState.pendingDealerPlayerId) {
      this.drawingManager?.completeDealerAssignment(gameState.pendingDealerPlayerId);
    }
    return null;
  }

  respondMainstay(playerId, accept = false) {
    const { gameState } = this.room;
    if (!isMainstayRule(gameState.selectedRule)) throw new Error('当前规则不是中流砥柱');
    const action = gameState.mainstayCurrentAction;
    if (!action || action.stage !== 'decision') throw new Error('当前没有待决定的中流砥柱');
    if (action.chooserPlayerId !== playerId) throw new Error('当前不需要你决定中流砥柱');

    const actor = this.room.findPlayerById(action.actorPlayerId);
    if (!actor) throw new Error('中流砥柱玩家不存在');
    const accepted = accept === true;
    this.io.to(this.room.id).emit('mainstay_decision_resolved', {
      actionId: action.id,
      playerId: actor.id,
      playerName: actor.name,
      accepted
    });

    if (!accepted) {
      gameState.mainstayResults.push({
        playerId: actor.id,
        playerName: actor.name,
        position: action.position,
        trumpCount: action.trumpCount,
        eligible: true,
        accepted: false
      });
      gameState.mainstayCurrentAction = null;
      this.broadcastRoomUpdate();
      this.advanceMainstay();
      return { resolved: true, accepted: false, actionId: action.id };
    }

    gameState.mainstayCurrentAction = {
      ...action,
      stage: 'give',
      chooserPlayerId: action.actorPlayerId
    };
    this.emitMainstayActionRequired(gameState.mainstayCurrentAction);
    this.broadcastRoomUpdate();
    if (actor.isBot) {
      return this.submitMainstayCards(
        actor.id,
        action.id,
        this.selectMainstayCardsForBot(actor.id)
      );
    }
    return {
      resolved: false,
      accepted: true,
      actionId: action.id,
      action: { ...gameState.mainstayCurrentAction }
    };
  }

  selectMainstayCardsForBot(playerId) {
    const { gameState } = this.room;
    const action = gameState.mainstayCurrentAction;
    const player = this.room.findPlayerById(playerId);
    if (!action || !player?.isBot || action.chooserPlayerId !== playerId) return [];

    const sorted = [...player.cards].sort((left, right) => (
      getCardStrength(left, gameState.trumpSuit, gameState.trumpRank, gameState.selectedRule)
      - getCardStrength(right, gameState.trumpSuit, gameState.trumpRank, gameState.selectedRule)
    ));
    if (action.stage === 'return') {
      return sorted.slice(0, MAINSTAY_CARD_COUNT).map(card => card.id);
    }
    if (action.stage !== 'give') return [];

    const trumpCards = this.getMainstayTrumpCards(player);
    const trumpIds = new Set(trumpCards.map(card => card.id));
    return [
      ...trumpCards,
      ...sorted.filter(card => !trumpIds.has(card.id))
    ].slice(0, MAINSTAY_CARD_COUNT).map(card => card.id);
  }

  submitMainstayCards(playerId, actionId, cardIds = []) {
    const { gameState } = this.room;
    if (!isMainstayRule(gameState.selectedRule)) throw new Error('当前规则不是中流砥柱');
    const action = gameState.mainstayCurrentAction;
    if (!action || action.id !== actionId || !['give', 'return'].includes(action.stage)) {
      throw new Error('这次中流砥柱交牌已经结束或不存在');
    }
    if (action.chooserPlayerId !== playerId) throw new Error('当前不需要你选择中流砥柱的牌');
    if (!Array.isArray(cardIds) || cardIds.length !== MAINSTAY_CARD_COUNT) {
      throw new Error(`必须选择${MAINSTAY_CARD_COUNT}张牌`);
    }

    const uniqueCardIds = [...new Set(cardIds)];
    if (uniqueCardIds.length !== MAINSTAY_CARD_COUNT) throw new Error('不能重复选择同一张牌');
    const fromPlayer = this.room.findPlayerById(playerId);
    const toPlayerId = action.stage === 'give'
      ? action.teammatePlayerId
      : action.actorPlayerId;
    const toPlayer = this.room.findPlayerById(toPlayerId);
    if (!fromPlayer || !toPlayer) throw new Error('中流砥柱交牌玩家不存在');
    const cards = uniqueCardIds.map(cardId => fromPlayer.cards.find(card => card.id === cardId));
    if (cards.some(card => !card)) throw new Error('选择的牌已不在手中');

    if (action.stage === 'give') {
      const selectedIds = new Set(uniqueCardIds);
      const missingTrump = this.getMainstayTrumpCards(fromPlayer)
        .some(card => !selectedIds.has(card.id));
      if (missingTrump) throw new Error('交出的5张牌必须包括当前全部主牌');
    }

    fromPlayer.removeCards(uniqueCardIds);
    cards.forEach(card => toPlayer.addCard(card));
    fromPlayer.cards = DeckService.autoSortCards(fromPlayer.cards);
    toPlayer.cards = DeckService.autoSortCards(toPlayer.cards);

    const completedStage = action.stage;
    const transfer = {
      actionId: action.id,
      stage: completedStage,
      fromPlayerId: fromPlayer.id,
      fromPlayerName: fromPlayer.name,
      toPlayerId: toPlayer.id,
      toPlayerName: toPlayer.name,
      cardsCount: MAINSTAY_CARD_COUNT,
      animationDuration: MAINSTAY_ANIMATION_MS
    };
    this.io.to(this.room.id).emit('mainstay_transfer_resolved', transfer);
    [fromPlayer, toPlayer].forEach(player => {
      if (!player.socketId || player.isBot) return;
      this.io.to(player.socketId).emit('mainstay_hand_updated', {
        actionId: action.id,
        stage: completedStage,
        cards: player.cards.map(card => card.toJSON()),
        animationDuration: MAINSTAY_ANIMATION_MS
      });
    });

    if (completedStage === 'give') {
      gameState.mainstayCurrentAction = {
        ...action,
        stage: 'return',
        chooserPlayerId: action.teammatePlayerId
      };
      this.emitMainstayActionRequired(gameState.mainstayCurrentAction);
      this.broadcastRoomUpdate();
      const teammate = this.room.findPlayerById(action.teammatePlayerId);
      if (teammate?.isBot) {
        return this.submitMainstayCards(
          teammate.id,
          action.id,
          this.selectMainstayCardsForBot(teammate.id)
        );
      }
      return {
        resolved: false,
        actionId: action.id,
        stage: completedStage,
        transfer,
        action: { ...gameState.mainstayCurrentAction }
      };
    }

    const actor = this.room.findPlayerById(action.actorPlayerId);
    gameState.mainstayResults.push({
      playerId: action.actorPlayerId,
      playerName: actor?.name || '未知玩家',
      position: action.position,
      trumpCount: action.trumpCount,
      eligible: true,
      accepted: true
    });
    gameState.mainstayCurrentAction = null;
    this.io.to(this.room.id).emit('mainstay_pair_completed', {
      actionId: action.id,
      actorPlayerId: action.actorPlayerId,
      actorPlayerName: actor?.name || '未知玩家',
      teammatePlayerId: action.teammatePlayerId,
      teammatePlayerName: toPlayer.id === action.actorPlayerId
        ? fromPlayer.name
        : toPlayer.name
    });
    this.broadcastRoomUpdate();
    this.advanceMainstay();
    return { resolved: true, actionId: action.id, stage: completedStage, transfer };
  }

  startOpeningCardExchange() {
    const { gameState, players } = this.room;
    if (gameState.phase !== GamePhases.DRAWING) {
      throw new Error('只有摸牌结束后才能开始换牌');
    }
    if (players.length !== 4) {
      throw new Error('开局换牌规则仅支持四人局');
    }

    const offset = getOpeningCardExchangeOffset(gameState.selectedRule);
    if (!Number.isInteger(offset)) {
      return false;
    }

    const targetByPlayerId = {};
    players.forEach((player, index) => {
      const targetIndex = (index + offset + players.length) % players.length;
      targetByPlayerId[player.id] = players[targetIndex].id;
    });

    this.cardExchangeSelections.clear();
    gameState.isTrumpDeclarationLocked = true;
    gameState.postDrawStage = 'card_exchange';
    gameState.cardExchange = {
      stage: 'opening',
      operation: 'exchange',
      triggerRound: null,
      ruleId: gameState.selectedRule.id,
      ruleName: gameState.selectedRule.name,
      requiredCards: OPENING_EXCHANGE_CARD_COUNT,
      targetByPlayerId,
      submittedPlayerIds: new Set()
    };

    const transfers = this.createPublicCardExchangeTransfers();
    this.io.to(this.room.id).emit('card_exchange_started', {
      ruleId: gameState.selectedRule.id,
      ruleName: gameState.selectedRule.name,
      requiredCards: OPENING_EXCHANGE_CARD_COUNT,
      transfers
    });
    this.broadcastRoomUpdate();

    logger.info(`房间 ${this.room.id} 开始执行规则 ${gameState.selectedRule.name} 的开局换牌`);

    // Bot不能阻塞收齐选择；沿用当前手牌排序，自动交出最前面的两张。
    for (const bot of players.filter(player => player.isBot)) {
      if (!gameState.cardExchange) break;
      this.submitOpeningCardExchange(
        bot.id,
        bot.cards.slice(0, OPENING_EXCHANGE_CARD_COUNT).map(card => card.id)
      );
    }

    return true;
  }

  createPublicCardExchangeTransfers() {
    const exchange = this.room.gameState.cardExchange;
    if (!exchange) return [];
    return this.room.players.map(player => {
      const target = this.room.findPlayerById(exchange.targetByPlayerId[player.id]);
      const isDiscard = exchange.operation === 'discard';
      return {
        fromPlayerId: player.id,
        fromPlayerName: player.name,
        toPlayerId: target?.id || null,
        toPlayerName: isDiscard ? '弃牌区' : (target?.name || '未知玩家'),
        cardsCount: exchange.requiredCards
      };
    });
  }

  submitOpeningCardExchange(playerId, cardIds) {
    const exchange = this.room.gameState.cardExchange;
    const isOpeningExchange = exchange?.stage === 'opening'
      && this.room.gameState.phase === GamePhases.DRAWING;
    const isRoundExchange = exchange?.stage === 'round'
      && this.room.gameState.phase === GamePhases.PLAYING;
    if (!exchange || (!isOpeningExchange && !isRoundExchange)) {
      throw new Error('当前不在换牌阶段');
    }

    const player = this.room.findPlayerById(playerId);
    if (!player) throw new Error('玩家不存在');
    if (exchange.submittedPlayerIds.has(playerId)) {
      throw new Error('你已经确认过换牌');
    }
    if (!Array.isArray(cardIds) || cardIds.length !== exchange.requiredCards) {
      throw new Error(`必须选择${exchange.requiredCards}张牌`);
    }

    const uniqueIds = new Set(cardIds);
    if (uniqueIds.size !== exchange.requiredCards) {
      throw new Error('不能重复选择同一张牌');
    }
    const cards = cardIds.map(id => player.cards.find(card => card.id === id));
    if (cards.some(card => !card)) {
      throw new Error('选择的牌不在手中');
    }

    this.cardExchangeSelections.set(playerId, cards);
    exchange.submittedPlayerIds.add(playerId);

    this.io.to(this.room.id).emit('card_exchange_submitted', {
      playerId,
      playerName: player.name,
      operation: exchange.operation || 'exchange',
      ruleName: exchange.ruleName,
      submittedCount: exchange.submittedPlayerIds.size,
      totalCount: this.room.players.length
    });

    if (exchange.submittedPlayerIds.size === this.room.players.length) {
      return this.resolveOpeningCardExchange();
    }

    this.broadcastRoomUpdate();
    return { resolved: false };
  }

  resolveOpeningCardExchange() {
    const exchange = this.room.gameState.cardExchange;
    if (!exchange || this.cardExchangeSelections.size !== this.room.players.length) {
      throw new Error('尚未收齐所有玩家的换牌选择');
    }

    const transfers = this.createPublicCardExchangeTransfers();
    const operation = exchange.operation || 'exchange';
    const privateResults = new Map(this.room.players.map(player => [player.id, {
      sentCardIds: [],
      receivedCards: [],
      fromPlayerId: null,
      fromPlayerName: null,
      toPlayerId: exchange.targetByPlayerId[player.id]
    }]));

    // 先同时移除四家的选择，再统一加入目标手牌，避免顺序影响后续校验。
    for (const player of this.room.players) {
      const selected = this.cardExchangeSelections.get(player.id);
      const selectedIds = selected.map(card => card.id);
      player.removeCards(selectedIds);
      selectedIds.forEach(id => player.shownCards.delete(id));
      privateResults.get(player.id).sentCardIds = selectedIds;
    }

    if (operation === 'discard') {
      for (const player of this.room.players) {
        const playerIndex = this.room.getPlayerIndex(player.id);
        const selected = this.cardExchangeSelections.get(player.id);
        selected.forEach(card => {
          this.room.gameState.lingeringDiscardedCards.push({
            playerId: player.id,
            playerIndex,
            card
          });
        });
      }
    } else {
      for (const sender of this.room.players) {
        const recipient = this.room.findPlayerById(exchange.targetByPlayerId[sender.id]);
        const selected = this.cardExchangeSelections.get(sender.id);
        selected.forEach(card => recipient.addCard(card));
        const result = privateResults.get(recipient.id);
        result.receivedCards = selected.map(card => card.toJSON());
        result.fromPlayerId = sender.id;
        result.fromPlayerName = sender.name;
      }
    }

    this.room.players.forEach(player => {
      player.cards = DeckService.autoSortCards(player.cards);
    });

    const ruleName = exchange.ruleName;
    const stage = exchange.stage;
    const triggerRound = exchange.triggerRound;
    this.room.gameState.cardExchange = null;
    this.cardExchangeSelections.clear();

    // 先广播不含牌面的路径动画，再分别发送各自实际收发的牌。
    this.io.to(this.room.id).emit('card_exchange_resolved', {
      ruleName,
      operation,
      transfers,
      animationDuration: OPENING_EXCHANGE_ANIMATION_MS
    });
    for (const player of this.room.players) {
      if (player.isBot) continue;
      this.io.to(player.socketId).emit('card_exchange_hand_updated', {
        ...privateResults.get(player.id),
        ruleName,
        operation,
        animationDuration: OPENING_EXCHANGE_ANIMATION_MS
      });
    }

    let gameFinished = false;
    if (
      stage === 'round'
      && operation === 'discard'
      && this.room.players.every(player => player.cards.length === 0)
    ) {
      this.finishGame();
      gameFinished = true;
    }

    this.broadcastRoomUpdate();
    if (stage === 'opening' && this.room.gameState.pendingDealerPlayerId) {
      this.drawingManager?.completeDealerAssignment(this.room.gameState.pendingDealerPlayerId);
    }
    logger.info(
      `房间 ${this.room.id} 已完成 ${ruleName} 的${stage === 'round' ? `第${triggerRound}轮轮末` : '开局'}` +
      `${operation === 'discard' ? '暗弃' : '换牌'}`
    );
    return { resolved: true, stage, triggerRound, operation, transfers, gameFinished };
  }

  broadcastRoomUpdate() {
    this.io.to(this.room.id).emit('room_updated', {
      room: this.room.toJSON()
    });
  }

  initializeWoodenOx() {
    const { gameState, players } = this.room;
    if (!isWoodenOxFlowingHorseRule(gameState.selectedRule)) return null;
    if (players.length !== 4) {
      throw new Error('木牛流马仅支持四人局');
    }
    if (gameState.woodenOxMulesByTeam.size > 0) {
      return gameState.woodenOxMulesByTeam;
    }

    // 一号位是庄家，沿牌桌逆时针依次计为2、3、4号位。
    // 玩家数组按牌桌逆时针排列；不能把房间数组下标1、2误当成固定的2、3号位。
    const dealerIndex = this.room.getPlayerIndex(gameState.buryingPlayerId);
    const firstPositionIndex = dealerIndex >= 0
      ? dealerIndex
      : gameState.roundStartPlayerIndex;
    if (!Number.isInteger(firstPositionIndex)) {
      throw new Error('木牛流马需要先确定庄家座位');
    }

    [1, 2].map(offset => (
      (firstPositionIndex + offset) % players.length
    )).forEach(playerIndex => {
      const holder = players[playerIndex];
      const teamIndex = playerIndex % 2;
      gameState.woodenOxMulesByTeam.set(teamIndex, {
        teamIndex,
        initialHolderPlayerId: holder.id,
        holderPlayerId: holder.id,
        storedCard: null,
        transfersUsed: 0,
        maxTransfers: WOODEN_OX_MAX_TRANSFERS
      });
    });
    return gameState.woodenOxMulesByTeam;
  }

  getWoodenOxMuleHeldBy(playerId) {
    if (!isWoodenOxFlowingHorseRule(this.room.gameState.selectedRule)) return null;
    return Array.from(this.room.gameState.woodenOxMulesByTeam.values())
      .find(mule => mule.holderPlayerId === playerId) || null;
  }

  getWoodenOxStoredCardForPlayer(playerId) {
    return this.getWoodenOxMuleHeldBy(playerId)?.storedCard || null;
  }

  getPlayableCardsForPlayer(playerOrId) {
    const player = typeof playerOrId === 'string'
      ? this.room.findPlayerById(playerOrId)
      : playerOrId;
    if (!player) return [];
    const storedCard = this.getWoodenOxStoredCardForPlayer(player.id);
    return storedCard ? [...player.cards, storedCard] : [...player.cards];
  }

  getPlayableCardCount(playerOrId) {
    return this.getPlayableCardsForPlayer(playerOrId).length;
  }

  isWoodenOxTransferRequired(mule) {
    if (!mule) return false;
    const holderIndex = this.room.getPlayerIndex(mule.holderPlayerId);
    if (holderIndex < 0) return false;
    const teammate = this.room.players.find((candidate, index) => (
      candidate.id !== mule.holderPlayerId && index % 2 === holderIndex % 2
    ));
    return Boolean(
      teammate
      && this.getPlayableCardCount(teammate) === 0
      && this.getPlayableCardCount(mule.holderPlayerId) > 0
    );
  }

  emitWoodenOxPrivateState(playerId) {
    const player = this.room.findPlayerById(playerId);
    if (!player?.socketId) return;
    const mule = this.getWoodenOxMuleHeldBy(playerId);
    this.io.to(player.socketId).emit('wooden_ox_private_state', mule ? {
      teamIndex: mule.teamIndex,
      holderPlayerId: mule.holderPlayerId,
      storedCard: mule.storedCard?.toJSON ? mule.storedCard.toJSON() : mule.storedCard,
      transfersUsed: mule.transfersUsed,
      maxTransfers: mule.maxTransfers
    } : null);
  }

  hasPendingWoodenOxDecision() {
    return Boolean(this.room.gameState.woodenOxRoundWindow?.pendingPlayerIds?.size);
  }

  assertWoodenOxRoundWindowComplete() {
    if (this.hasPendingWoodenOxDecision()) {
      throw new Error('请先完成本轮的木牛流马操作');
    }
  }

  openWoodenOxRoundWindow() {
    const { gameState } = this.room;
    if (!isWoodenOxFlowingHorseRule(gameState.selectedRule)) return null;
    if (gameState.phase !== GamePhases.PLAYING || gameState.currentRoundPlays.length > 0) {
      return null;
    }
    this.initializeWoodenOx();

    const pendingPlayerIds = new Set();
    const requiredTransferPlayerIds = new Set();
    const botPlayerIds = [];
    for (const mule of gameState.woodenOxMulesByTeam.values()) {
      const holder = this.room.findPlayerById(mule.holderPlayerId);
      if (!holder || mule.transfersUsed >= mule.maxTransfers) {
        if (holder) this.emitWoodenOxPrivateState(holder.id);
        continue;
      }
      pendingPlayerIds.add(holder.id);
      if (this.isWoodenOxTransferRequired(mule)) {
        requiredTransferPlayerIds.add(holder.id);
      }
      this.emitWoodenOxPrivateState(holder.id);
      if (holder.isBot) {
        botPlayerIds.push(holder.id);
        continue;
      }
      if (holder.socketId) {
        this.io.to(holder.socketId).emit('wooden_ox_decision_required', {
          round: gameState.currentRound,
          teamIndex: mule.teamIndex,
          holderPlayerId: holder.id,
          hasStoredCard: Boolean(mule.storedCard),
          storedCard: mule.storedCard?.toJSON ? mule.storedCard.toJSON() : mule.storedCard,
          transfersUsed: mule.transfersUsed,
          maxTransfers: mule.maxTransfers,
          mustTransfer: requiredTransferPlayerIds.has(holder.id)
        });
      }
    }
    gameState.woodenOxRoundWindow = {
      round: gameState.currentRound,
      pendingPlayerIds,
      requiredTransferPlayerIds
    };
    this.io.to(this.room.id).emit('wooden_ox_round_started', {
      round: gameState.currentRound,
      pendingPlayerIds: Array.from(pendingPlayerIds)
    });
    for (const botPlayerId of botPlayerIds) {
      if (!pendingPlayerIds.has(botPlayerId)) continue;
      const mule = this.getWoodenOxMuleHeldBy(botPlayerId);
      const bot = this.room.findPlayerById(botPlayerId);
      if (requiredTransferPlayerIds.has(botPlayerId)) {
        if (mule?.storedCard) {
          this.manageWoodenOx(botPlayerId, 'pass');
        } else if (bot?.cards?.length > 0) {
          this.manageWoodenOx(botPlayerId, 'load_and_pass', bot.cards[0].id);
        } else {
          throw new Error('Bot无法完成必须的木牛流马传递');
        }
      } else {
        this.manageWoodenOx(botPlayerId, 'skip');
      }
    }
    return gameState.woodenOxRoundWindow;
  }

  manageWoodenOx(playerId, action, cardId = null) {
    const { gameState } = this.room;
    if (!isWoodenOxFlowingHorseRule(gameState.selectedRule)) {
      throw new Error('本局没有启用木牛流马');
    }
    if (gameState.phase !== GamePhases.PLAYING || gameState.currentRoundPlays.length > 0) {
      throw new Error('木牛流马只能在每轮首张牌打出前操作');
    }
    const window = gameState.woodenOxRoundWindow;
    if (!window || window.round !== gameState.currentRound || !window.pendingPlayerIds.has(playerId)) {
      throw new Error('你本轮没有待处理的木牛流马');
    }
    const player = this.room.findPlayerById(playerId);
    const mule = this.getWoodenOxMuleHeldBy(playerId);
    if (!player || !mule) throw new Error('你当前没有持有木牛流马');

    if (action === 'skip') {
      if (window.requiredTransferPlayerIds?.has(playerId)) {
        throw new Error('队友已无牌可出，本轮必须把木牛流马交给队友以恢复牌数');
      }
      window.pendingPlayerIds.delete(playerId);
    } else {
      if (!['pass', 'load_and_pass'].includes(action)) {
        throw new Error('未知的木牛流马操作');
      }
      if (mule.transfersUsed >= mule.maxTransfers) {
        throw new Error('本队木牛流马已完成两次往返');
      }
      if (action === 'pass' && !mule.storedCard) {
        throw new Error('木牛流马中没有可交给队友的牌');
      }
      let returnedCard = null;
      if (action === 'load_and_pass') {
        const selectedCard = player.cards.find(card => card.id === cardId);
        if (!selectedCard) throw new Error('请选择一张自己的手牌放入木牛流马');
        returnedCard = mule.storedCard;
        player.removeCards([selectedCard.id]);
        if (returnedCard) player.addCard(returnedCard);
        player.cards = DeckService.autoSortCards(player.cards);
        mule.storedCard = selectedCard;
      }

      const playerIndex = this.room.getPlayerIndex(playerId);
      const teammate = this.room.players.find((candidate, index) => (
        candidate.id !== playerId && index % 2 === playerIndex % 2
      ));
      if (!teammate) throw new Error('找不到可接收木牛流马的队友');
      mule.holderPlayerId = teammate.id;
      mule.transfersUsed += 1;
      window.pendingPlayerIds.delete(playerId);
      window.requiredTransferPlayerIds?.delete(playerId);

      if (player.socketId) {
        this.io.to(player.socketId).emit('wooden_ox_hand_updated', {
          cards: player.cards.map(card => card.toJSON ? card.toJSON() : card),
          returnedCard: returnedCard?.toJSON ? returnedCard.toJSON() : returnedCard
        });
        this.io.to(player.socketId).emit('wooden_ox_private_state', null);
      }
      this.emitWoodenOxPrivateState(teammate.id);
      this.io.to(this.room.id).emit('wooden_ox_transferred', {
        round: gameState.currentRound,
        teamIndex: mule.teamIndex,
        fromPlayerId: player.id,
        fromPlayerName: player.name,
        toPlayerId: teammate.id,
        toPlayerName: teammate.name,
        replacedCard: Boolean(returnedCard),
        hasStoredCard: Boolean(mule.storedCard),
        transfersUsed: mule.transfersUsed,
        maxTransfers: mule.maxTransfers,
        completedRoundTrips: Math.floor(mule.transfersUsed / 2)
      });
    }

    const completed = window.pendingPlayerIds.size === 0;
    if (completed) {
      this.io.to(this.room.id).emit('wooden_ox_round_ready', { round: gameState.currentRound });
    }
    this.broadcastRoomUpdate();
    return {
      completed,
      round: gameState.currentRound,
      action,
      pendingPlayerIds: Array.from(window.pendingPlayerIds)
    };
  }

  restoreStrengthCompensationCards() {
    for (const player of this.room.players) {
      for (const card of player.cards) {
        if (!card.isStrengthCompensated) continue;
        if (card.originalRank) card.rank = card.originalRank;
        if (card.originalSuit) card.suit = card.originalSuit;
        card.originalRank = null;
        card.originalSuit = null;
        card.isStrengthCompensated = false;
        card.strengthCompensationDelta = 0;
        card.value = card.calculateValue();
      }
    }
  }

  emitStrengthCompensationHands(status) {
    for (const player of this.room.players) {
      if (!player.socketId || player.isBot) continue;
      const modifier = player.id === status.plusPlayerId
        ? 1
        : player.id === status.minusPlayerId
          ? -1
          : 0;
      this.io.to(player.socketId).emit('strength_compensation_hand_updated', {
        round: status.round,
        modifier,
        cards: player.cards.map(card => card.toJSON ? card.toJSON() : card)
      });
    }
    this.io.to(this.room.id).emit('strength_compensation_rotated', status);
  }

  applyStrengthCompensationForRound({ emit = true } = {}) {
    const { gameState } = this.room;
    if (!isStrengthCompensationRule(gameState.selectedRule)) return null;
    if (!Number.isInteger(gameState.currentRound) || gameState.currentRound < 1) return null;

    this.restoreStrengthCompensationCards();
    const playerCount = this.room.players.length;
    const dealerIndex = this.room.getPlayerIndex(gameState.buryingPlayerId);
    if (playerCount !== 4 || dealerIndex < 0) {
      throw new Error('取长补短需要四名玩家及已确定的庄家');
    }

    const plusSeatNumber = gameState.currentRound % playerCount;
    const minusSeatNumber = (gameState.currentRound + 2) % playerCount;
    const plusPlayer = this.room.players[(dealerIndex + plusSeatNumber) % playerCount];
    const minusPlayer = this.room.players[(dealerIndex + minusSeatNumber) % playerCount];

    const transformHand = (player, delta) => {
      for (const card of player.cards) {
        card.originalRank = card.rank;
        card.originalSuit = card.suit;
        const shiftedFace = shiftStrengthCompensationCardFace(
          card,
          gameState.trumpSuit,
          gameState.trumpRank,
          delta
        );
        card.rank = shiftedFace.rank;
        card.suit = shiftedFace.suit;
        card.isStrengthCompensated = true;
        card.strengthCompensationDelta = delta;
        card.value = card.calculateValue();
      }
    };
    transformHand(plusPlayer, 1);
    transformHand(minusPlayer, -1);

    const status = {
      round: gameState.currentRound,
      dealerPlayerId: gameState.buryingPlayerId,
      plusSeatNumber,
      plusPlayerId: plusPlayer.id,
      plusPlayerName: plusPlayer.name,
      minusSeatNumber,
      minusPlayerId: minusPlayer.id,
      minusPlayerName: minusPlayer.name
    };
    gameState.strengthCompensation = status;
    if (emit) this.emitStrengthCompensationHands(status);
    return status;
  }

  restoreDefenseAsOffenseCards() {
    for (const player of this.room.players) {
      for (const card of player.cards) {
        if (!card.isDefenseAsOffenseBoosted) continue;
        if (card.originalRank) card.rank = card.originalRank;
        if (card.originalSuit) card.suit = card.originalSuit;
        card.originalRank = null;
        card.originalSuit = null;
        card.isDefenseAsOffenseBoosted = false;
        card.defenseAsOffenseDelta = 0;
        card.value = card.calculateValue();
      }
    }
  }

  getDefenseAsOffenseStatusForNextRound(completedRound) {
    const { gameState } = this.room;
    if (!isDefenseAsOffenseRule(gameState.selectedRule)) return null;
    if (gameState.currentRoundPlays.length !== this.room.players.length) return null;

    const comparisonPlays = gameState.currentRoundPlays.map(play => ({
      ...play,
      cards: play.comparisonCards || play.cards,
      pattern: play.comparisonPattern || play.pattern
    }));
    const leadingPlay = comparisonPlays[0];
    const rankedPlays = rankRoundPlaysByRespectOrder(
      comparisonPlays,
      gameState.trumpSuit,
      gameState.trumpRank,
      gameState.selectedRule
    );
    // 完全相同的牌力按实际出牌顺序稳定排列；首家天然排在同牌力玩家之前，
    // 因而它在全序中的下标正好等于严格大于它的玩家人数。
    const delta = rankedPlays.findIndex(play => play.playerId === leadingPlay.playerId);
    const player = this.room.findPlayerById(leadingPlay.playerId);
    if (!player || delta < 0) return null;
    return {
      triggerRound: completedRound,
      round: completedRound + 1,
      playerIndex: leadingPlay.playerIndex,
      playerId: leadingPlay.playerId,
      playerName: player.name,
      delta
    };
  }

  getWeighingThousandJinRoundScoring() {
    const { gameState, players } = this.room;
    if (
      !isWeighingThousandJinRule(gameState.selectedRule)
      || gameState.currentRoundPlays.length !== players.length
    ) {
      return null;
    }

    const dealerIndex = this.room.getPlayerIndex(gameState.buryingPlayerId);
    if (dealerIndex < 0) return null;

    const comparisonPlays = gameState.currentRoundPlays.map(play => ({
      ...play,
      cards: play.comparisonCards || play.cards,
      pattern: play.comparisonPattern || play.pattern
    }));
    const rankedPlays = rankRoundPlaysByRespectOrder(
      comparisonPlays,
      gameState.trumpSuit,
      gameState.trumpRank,
      gameState.selectedRule
    );
    const dealerPlay = comparisonPlays.find(play => play.playerIndex === dealerIndex);
    const dealerRankIndex = rankedPlays.findIndex(play => play.playerIndex === dealerIndex);
    if (!dealerPlay || dealerRankIndex < 0) return null;

    const attackerComparisons = rankedPlays
      .map((play, rankIndex) => ({ play, rankIndex }))
      .filter(({ play }) => this.isAttackerPlayerIndex(play.playerIndex, dealerIndex))
      .map(({ play, rankIndex }) => {
        const attacker = this.room.findPlayerByIndex(play.playerIndex);
        return {
          playerIndex: play.playerIndex,
          playerId: play.playerId,
          playerName: attacker?.name || '未知玩家',
          rank: rankIndex + 1,
          dealerOutranks: dealerRankIndex < rankIndex
        };
      });
    const outrankedAttackerCount = attackerComparisons.filter(
      comparison => comparison.dealerOutranks
    ).length;
    const dealer = this.room.findPlayerByIndex(dealerIndex);

    return {
      mode: outrankedAttackerCount > 0 ? 'subtract_five' : 'double',
      dealerPlayerIndex: dealerIndex,
      dealerPlayerId: dealer?.id || dealerPlay.playerId,
      dealerPlayerName: dealer?.name || '庄家',
      dealerRank: dealerRankIndex + 1,
      outrankedAttackerCount,
      attackerComparisons
    };
  }

  adjustWeighingThousandJinCardPoints(points, scoring) {
    const normalizedPoints = Number(points) || 0;
    if (!scoring || normalizedPoints <= 0) return normalizedPoints;
    return scoring.mode === 'subtract_five'
      ? Math.max(0, normalizedPoints - 5)
      : normalizedPoints * 2;
  }

  emitDefenseAsOffenseHands(transition) {
    for (const player of this.room.players) {
      if (!player.socketId || player.isBot) continue;
      this.io.to(player.socketId).emit('defense_as_offense_hand_updated', {
        round: transition?.round ?? this.room.gameState.currentRound,
        delta: transition?.playerId === player.id ? transition.delta : 0,
        cards: player.cards.map(card => card.toJSON ? card.toJSON() : card)
      });
    }
  }

  applyDefenseAsOffenseForRound(nextStatus, { emit = true } = {}) {
    const { gameState } = this.room;
    if (!isDefenseAsOffenseRule(gameState.selectedRule)) return null;

    gameState.defenseAsOffenseLastRound = gameState.defenseAsOffense
      ? { ...gameState.defenseAsOffense }
      : null;
    this.restoreDefenseAsOffenseCards();
    const delta = Math.max(0, Math.min(3, Math.trunc(Number(nextStatus?.delta) || 0)));
    const player = nextStatus?.playerId
      ? this.room.findPlayerById(nextStatus.playerId)
      : null;
    const activeStatus = player && player.cards.length > 0 && delta > 0
      ? { ...nextStatus, delta }
      : null;

    if (activeStatus) {
      for (const card of player.cards) {
        card.originalRank = card.rank;
        card.originalSuit = card.suit;
        const shiftedFace = shiftStrengthCompensationCardFace(
          card,
          gameState.trumpSuit,
          gameState.trumpRank,
          delta
        );
        card.rank = shiftedFace.rank;
        card.suit = shiftedFace.suit;
        card.isDefenseAsOffenseBoosted = true;
        card.defenseAsOffenseDelta = delta;
        card.value = card.calculateValue();
      }
    }

    gameState.defenseAsOffense = activeStatus;
    const transition = nextStatus
      ? { ...nextStatus, delta, active: Boolean(activeStatus) }
      : null;
    if (emit) this.emitDefenseAsOffenseHands(transition);
    return transition;
  }

  hasUsedActiveSkill(playerId, activeSkillId) {
    return this.room.gameState.activeSkillUsesByPlayerId
      .get(playerId)
      ?.has(activeSkillId) || false;
  }

  recordActiveSkillUse(playerId, activeSkillId) {
    const usedSkills = this.room.gameState.activeSkillUsesByPlayerId.get(playerId) || new Set();
    usedSkills.add(activeSkillId);
    this.room.gameState.activeSkillUsesByPlayerId.set(playerId, usedSkills);
  }

  restoreActiveSkillUse(playerId, activeSkillId) {
    const usedSkills = this.room.gameState.activeSkillUsesByPlayerId.get(playerId);
    if (!usedSkills) return;
    usedSkills.delete(activeSkillId);
    if (usedSkills.size === 0) {
      this.room.gameState.activeSkillUsesByPlayerId.delete(playerId);
    }
  }

  hasPendingPoliticalReviewDecision() {
    return Boolean(this.room.gameState.politicalReviewPending);
  }

  getPoliticalReviewTeammate(playerId) {
    const playerIndex = this.room.getPlayerIndex(playerId);
    if (playerIndex < 0 || this.room.players.length !== 4) return null;
    return this.room.findPlayerByIndex((playerIndex + 2) % this.room.players.length);
  }

  validatePoliticalReviewCandidate(player, cardIds) {
    const { gameState } = this.room;
    if (gameState.phase !== GamePhases.PLAYING || !this.roundManager) {
      throw new Error('当前不是出牌阶段');
    }
    const playerIndex = this.room.getPlayerIndex(player.id);
    if (!this.roundManager.canPlayerPlay(playerIndex)) {
      throw new Error('现在还没有轮到该玩家出牌');
    }
    if (!Array.isArray(cardIds) || cardIds.length === 0) {
      throw new Error('请选择要打出的牌');
    }
    const uniqueIds = new Set(cardIds);
    const cards = player.cards.filter(card => uniqueIds.has(card.id));
    if (cards.length !== cardIds.length || uniqueIds.size !== cardIds.length) {
      throw new Error('选择的牌不在手中');
    }

    const { trumpSuit, trumpRank } = gameState;
    const isLeading = gameState.currentRoundPlays.length === 0;
    const validation = isLeading
      ? validateLeadingPlay(cards, trumpSuit, trumpRank, this.getRuleRuntimeContext())
      : validateFollowingPlay(
          cards,
          player.cards,
          gameState.leadingPattern,
          trumpSuit,
          trumpRank,
          this.getRuleRuntimeContext()
        );
    if (!validation.valid) throw new Error(validation.message);
    return cards;
  }

  preparePoliticalReviewForPlay(
    requestingPlayerId,
    cardIds,
    controlledPlayerId,
    activeSkillId,
    playOptions
  ) {
    const { gameState } = this.room;
    if (!isPoliticalReviewRule(gameState.selectedRule)) return null;
    if (this.room.players.length !== 4) throw new Error('政治审查仅支持四人局');
    if (gameState.politicalReviewPending) throw new Error('请先完成当前政治审查');

    const turnPlayerId = controlledPlayerId || requestingPlayerId;
    const approval = gameState.politicalReviewApproval;
    const approvalId = playOptions?.politicalReviewApprovalId || null;
    if (approvalId) {
      if (
        !approval
        || approval.id !== approvalId
        || approval.requestingPlayerId !== requestingPlayerId
        || approval.teammatePlayerId !== turnPlayerId
        || approval.controlledPlayerId !== controlledPlayerId
        || [...approval.cardIds].sort().join('|') !== [...cardIds].sort().join('|')
      ) {
        throw new Error('政治审查放行凭证无效，请重新出牌');
      }
      return { approved: true, approvalId, cardIds: [...approval.cardIds] };
    }
    if (approval) {
      const approvedRequester = this.room.findPlayerById(approval.requestingPlayerId);
      if (
        approvedRequester?.isBot
        && approval.requestingPlayerId === requestingPlayerId
        && approval.teammatePlayerId === turnPlayerId
      ) {
        return {
          approved: true,
          approvalId: approval.id,
          cardIds: [...approval.cardIds]
        };
      }
      throw new Error('请先提交队友已经放行的那手牌');
    }
    if (activeSkillId) throw new Error('政治审查规则下没有随出牌发动的主动技能');

    const requester = this.room.findPlayerById(requestingPlayerId);
    const teammate = this.room.findPlayerById(turnPlayerId);
    if (!requester || !teammate) throw new Error('玩家不存在');
    if (controlledPlayerId && controlledPlayerId !== requestingPlayerId) {
      throw new Error('政治审查规则下不能代替其他玩家出牌');
    }
    const reviewer = this.getPoliticalReviewTeammate(teammate.id);
    if (!reviewer) throw new Error('找不到队友');
    if (this.hasUsedActiveSkill(reviewer.id, RuleIds.POLITICAL_REVIEW)) return null;

    const cards = this.validatePoliticalReviewCandidate(teammate, cardIds);
    const decisionId = `political-review-${gameState.currentRound}-${Date.now()}-${Math.floor(this.random() * 1e6)}`;
    const storedPlayOptions = {
      ...playOptions,
      politicalReviewApprovalId: null,
      jokerSubstitutions: [...(playOptions?.jokerSubstitutions || [])],
      clusterAnalysisSubstitutions: [...(playOptions?.clusterAnalysisSubstitutions || [])],
      forbiddenMagicSubstitutions: [...(playOptions?.forbiddenMagicSubstitutions || [])],
      ambiguousAlternativeCardIds: [...(playOptions?.ambiguousAlternativeCardIds || [])]
    };
    const publicCards = cards.map(card => card.toJSON ? card.toJSON() : card);
    const pending = {
      id: decisionId,
      round: gameState.currentRound,
      reviewerPlayerId: reviewer.id,
      reviewerPlayerName: reviewer.name,
      teammatePlayerId: teammate.id,
      teammatePlayerName: teammate.name,
      requestingPlayerId,
      controlledPlayerId,
      activeSkillId,
      cardIds: [...cardIds],
      playOptions: storedPlayOptions,
      cards: publicCards
    };
    gameState.politicalReviewPending = pending;

    const publicPending = {
      id: decisionId,
      round: pending.round,
      reviewerPlayerId: reviewer.id,
      reviewerPlayerName: reviewer.name,
      teammatePlayerId: teammate.id,
      teammatePlayerName: teammate.name,
      cards: publicCards
    };
    this.io.to(this.room.id).emit('political_review_play_pending', publicPending);
    if (requester.socketId) {
      this.io.to(requester.socketId).emit('political_review_play_held', {
        ...publicPending,
        handCards: teammate.cards.map(card => card.toJSON ? card.toJSON() : card)
      });
    }
    if (!reviewer.isBot && reviewer.socketId) {
      this.io.to(reviewer.socketId).emit('political_review_decision_required', publicPending);
    }
    this.broadcastRoomUpdate();

    if (reviewer.isBot) {
      setTimeout(() => {
        try {
          if (gameState.politicalReviewPending?.id !== decisionId) return;
          this.respondPoliticalReview(reviewer.id, this.random() < 0.25);
          if (this.onBotTurn) this.onBotTurn();
        } catch (error) {
          logger.error(`政治审查Bot ${reviewer.name} 决策失败:`, error);
        }
      }, 500);
    }
    return publicPending;
  }

  respondPoliticalReview(playerId, returnPlay) {
    const { gameState } = this.room;
    const pending = gameState.politicalReviewPending;
    if (!isPoliticalReviewRule(gameState.selectedRule) || !pending) {
      throw new Error('当前没有等待处理的政治审查');
    }
    if (pending.reviewerPlayerId !== playerId) {
      throw new Error('只有出牌者的队友可以作出政治审查决定');
    }
    if (this.hasUsedActiveSkill(playerId, RuleIds.POLITICAL_REVIEW)) {
      throw new Error('你本局已经发动过政治审查');
    }

    const reviewer = this.room.findPlayerById(playerId);
    const shouldReturn = returnPlay === true;
    gameState.politicalReviewPending = null;
    if (shouldReturn) {
      this.recordActiveSkillUse(playerId, RuleIds.POLITICAL_REVIEW);
      gameState.politicalReviewApproval = null;
    } else {
      gameState.politicalReviewApproval = {
        id: pending.id,
        requestingPlayerId: pending.requestingPlayerId,
        controlledPlayerId: pending.controlledPlayerId,
        teammatePlayerId: pending.teammatePlayerId,
        cardIds: [...pending.cardIds]
      };
    }

    const result = {
      id: pending.id,
      round: pending.round,
      reviewerPlayerId: reviewer.id,
      reviewerPlayerName: reviewer.name,
      teammatePlayerId: pending.teammatePlayerId,
      teammatePlayerName: pending.teammatePlayerName,
      cards: pending.cards.map(card => ({ ...card })),
      returned: shouldReturn,
      message: shouldReturn
        ? `${reviewer.name} 发动政治审查，令 ${pending.teammatePlayerName} 收回本次出牌；原样重出仍然合法`
        : `${reviewer.name} 放行 ${pending.teammatePlayerName} 的本次出牌`
    };
    gameState.politicalReviewLastResult = result;
    if (shouldReturn) {
      this.io.to(this.room.id).emit('active_skill_activated', {
        id: RuleIds.POLITICAL_REVIEW,
        name: '政治审查',
        playerId: reviewer.id,
        playerName: reviewer.name
      });
    }
    this.io.to(this.room.id).emit('political_review_resolved', result);

    if (!shouldReturn) {
      const requester = this.room.findPlayerById(pending.requestingPlayerId);
      if (requester?.socketId && !requester.isBot) {
        this.io.to(requester.socketId).emit('political_review_play_approved', {
          id: pending.id,
          cardIds: [...pending.cardIds],
          controlledPlayerId: pending.controlledPlayerId,
          activeSkillId: pending.activeSkillId,
          ...pending.playOptions
        });
      }
    }
    this.broadcastRoomUpdate();
    logger.info(`房间 ${this.room.id} ${result.message}`);
    return result;
  }

  activateCulturalRevolution(playerId, declarationType, value) {
    const { gameState } = this.room;
    if (gameState.phase !== GamePhases.PLAYING || gameState.playMode !== PlayModes.ORDERED) {
      throw new Error('当前不是有序出牌阶段');
    }
    if (!isCulturalRevolutionRule(gameState.selectedRule)) {
      throw new Error('本局没有文化革命技能');
    }
    const activeSkill = getActiveSkillForRule(gameState.selectedRule);
    if (activeSkill?.id !== ActiveSkillIds.CULTURAL_REVOLUTION) {
      throw new Error('本局没有文化革命技能');
    }
    if (this.hasUsedActiveSkill(playerId, activeSkill.id)) {
      throw new Error('文化革命每名玩家每局只能发动一次');
    }

    const player = this.room.findPlayerById(playerId);
    if (!player) throw new Error('玩家不存在');
    const playerIndex = this.room.getPlayerIndex(playerId);
    if (playerIndex !== gameState.currentPlayerIndex) {
      throw new Error('现在还没有轮到你出牌');
    }
    if (
      gameState.currentRoundPlays.length !== 0
      || gameState.playersPlayedThisRound.size !== 0
      || playerIndex !== gameState.roundStartPlayerIndex
    ) {
      throw new Error('文化革命只能在作为本轮一号位出牌前发动');
    }
    if (!Number.isInteger(gameState.currentRound) || gameState.currentRound < 1) {
      throw new Error('首轮尚未开始');
    }
    if (!['suit', 'rank'].includes(declarationType)) {
      throw new Error('请先选择革花色或革点数');
    }
    const allowedValues = declarationType === 'suit'
      ? CULTURAL_REVOLUTION_SUITS
      : CULTURAL_REVOLUTION_RANKS;
    if (!allowedValues.includes(value)) {
      throw new Error(declarationType === 'suit' ? '请选择一种标准花色' : '请选择2至A的一种点数');
    }

    // 首次发动时保存本局原主；覆盖旧声明时始终从原主重新计算，绝不把两个声明叠加。
    if (gameState.culturalRevolutionBaseTrumpRank === null) {
      gameState.culturalRevolutionBaseTrumpSuit = gameState.trumpSuit;
      gameState.culturalRevolutionBaseTrumpRank = gameState.trumpRank;
    }
    gameState.trumpSuit = declarationType === 'suit'
      ? value
      : gameState.culturalRevolutionBaseTrumpSuit;
    gameState.trumpRank = declarationType === 'rank'
      ? value
      : gameState.culturalRevolutionBaseTrumpRank;

    const activation = {
      playerId: player.id,
      playerName: player.name,
      declarationType,
      value,
      activatedRound: gameState.currentRound,
      expiresAfterRound: gameState.currentRound + 1,
      effectiveTrumpSuit: gameState.trumpSuit,
      effectiveTrumpRank: gameState.trumpRank
    };
    gameState.culturalRevolution = activation;
    this.recordActiveSkillUse(player.id, activeSkill.id);
    logger.info(
      `房间 ${this.room.id} ${player.name} 发动文化革命：` +
      `${declarationType === 'suit' ? '革花色' : '革点数'} ${value}，` +
      `持续至第${activation.expiresAfterRound}轮结束`
    );
    return {
      ...activation,
      activeSkillId: activeSkill.id,
      activeSkillName: activeSkill.name,
      baseTrumpSuit: gameState.culturalRevolutionBaseTrumpSuit,
      baseTrumpRank: gameState.culturalRevolutionBaseTrumpRank
    };
  }

  activateInviteIntoUrn(playerId, targetPlayerId, suit, rank) {
    const { gameState } = this.room;
    if (gameState.phase !== GamePhases.PLAYING || gameState.playMode !== PlayModes.ORDERED) {
      throw new Error('当前不是有序出牌阶段');
    }
    if (!isInviteIntoUrnRule(gameState.selectedRule)) {
      throw new Error('本局没有请君入瓮技能');
    }
    const activeSkill = getActiveSkillForRule(gameState.selectedRule);
    if (activeSkill?.id !== ActiveSkillIds.INVITE_INTO_URN) {
      throw new Error('本局没有请君入瓮技能');
    }
    if (this.hasUsedActiveSkill(playerId, activeSkill.id)) {
      throw new Error('请君入瓮每名玩家每局只能发动一次');
    }

    const player = this.room.findPlayerById(playerId);
    const target = this.room.findPlayerById(targetPlayerId);
    if (!player || !target) throw new Error('指定玩家不存在');
    if (player.id === target.id) throw new Error('请君入瓮不能指定自己');
    const playerIndex = this.room.getPlayerIndex(playerId);
    if (playerIndex !== gameState.currentPlayerIndex) {
      throw new Error('现在还没有轮到你出牌');
    }
    if (
      gameState.currentRoundPlays.length !== 0
      || gameState.playersPlayedThisRound.size !== 0
      || playerIndex !== gameState.roundStartPlayerIndex
    ) {
      throw new Error('请君入瓮只能在作为本轮一号位出牌前发动');
    }

    const isJoker = suit === Suits.JOKER;
    const validFace = isJoker
      ? [Ranks.SMALL_JOKER, Ranks.BIG_JOKER].includes(rank)
      : INVITE_INTO_URN_SUITS.includes(suit) && INVITE_INTO_URN_RANKS.includes(rank);
    if (!validFace) throw new Error('请选择一种有效的实体牌面');

    const declaration = {
      round: gameState.currentRound,
      sourcePlayerId: player.id,
      sourcePlayerName: player.name,
      targetPlayerId: target.id,
      targetPlayerName: target.name,
      suit,
      rank
    };
    gameState.inviteIntoUrnDeclarations.push(declaration);
    this.recordActiveSkillUse(player.id, activeSkill.id);
    logger.info(
      `房间 ${this.room.id} ${player.name} 发动请君入瓮：` +
      `指定 ${target.name} 的 ${suit} ${rank}`
    );
    return {
      ...declaration,
      activeSkillId: activeSkill.id,
      activeSkillName: activeSkill.name
    };
  }

  selectCulturalRevolutionForBot(playerId) {
    const { gameState } = this.room;
    const player = this.room.findPlayerById(playerId);
    const playerIndex = this.room.getPlayerIndex(playerId);
    if (
      !player
      || !isCulturalRevolutionRule(gameState.selectedRule)
      || this.hasUsedActiveSkill(playerId, ActiveSkillIds.CULTURAL_REVOLUTION)
      || playerIndex !== gameState.currentPlayerIndex
      || playerIndex !== gameState.roundStartPlayerIndex
      || gameState.currentRoundPlays.length !== 0
      || gameState.playersPlayedThisRound.size !== 0
    ) {
      return null;
    }

    // 优先把手中的同花色对子（尤其10/K）提升为级牌；否则选择持有最多的非原主花色。
    let bestRank = null;
    let bestPairCount = 1;
    const preferredRanks = [Ranks.KING, Ranks.TEN, ...CULTURAL_REVOLUTION_RANKS];
    for (const rank of preferredRanks) {
      let sameSuitMax = 0;
      for (const suit of CULTURAL_REVOLUTION_SUITS) {
        sameSuitMax = Math.max(
          sameSuitMax,
          player.cards.filter(card => card.suit === suit && card.rank === rank).length
        );
      }
      if (sameSuitMax > bestPairCount) {
        bestPairCount = sameSuitMax;
        bestRank = rank;
      }
    }
    if (bestRank) return { declarationType: 'rank', value: bestRank };

    const baseTrumpSuit = gameState.culturalRevolutionBaseTrumpRank === null
      ? gameState.trumpSuit
      : gameState.culturalRevolutionBaseTrumpSuit;
    const rankedSuits = CULTURAL_REVOLUTION_SUITS
      .map(suit => ({
        suit,
        count: player.cards.filter(card => card.suit === suit).length
      }))
      .sort((left, right) => right.count - left.count);
    const selectedSuit = rankedSuits.find(entry => entry.suit !== baseTrumpSuit)
      || rankedSuits[0];
    return selectedSuit ? { declarationType: 'suit', value: selectedSuit.suit } : null;
  }

  expireCulturalRevolutionAtRoundEnd(completedRound) {
    const { gameState } = this.room;
    const active = gameState.culturalRevolution;
    if (!active || completedRound < active.expiresAfterRound) return null;

    const transition = {
      ...active,
      completedRound,
      restoredTrumpSuit: gameState.culturalRevolutionBaseTrumpSuit,
      restoredTrumpRank: gameState.culturalRevolutionBaseTrumpRank
    };
    gameState.trumpSuit = gameState.culturalRevolutionBaseTrumpSuit;
    gameState.trumpRank = gameState.culturalRevolutionBaseTrumpRank;
    gameState.culturalRevolution = null;
    logger.info(`房间 ${this.room.id} 文化革命于第${completedRound}轮结束，恢复本局原主`);
    return transition;
  }

  createDivineWeaponDeck() {
    const deck = [];
    for (const suit of DIVINE_WEAPON_SUITS) {
      for (const rank of DIVINE_WEAPON_RANKS) {
        const card = new Card(suit, rank, 0);
        card.id = `divine-${suit}-${rank}`;
        deck.push(card);
      }
    }
    for (let index = deck.length - 1; index > 0; index--) {
      const sample = Number(this.random());
      const boundedSample = Number.isFinite(sample)
        ? Math.min(0.999999999, Math.max(0, sample))
        : 0;
      const swapIndex = Math.floor(boundedSample * (index + 1));
      [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
    }
    return deck;
  }

  refreshDivineWeaponCards() {
    const { gameState } = this.room;
    if (!isDivineWeaponRule(gameState.selectedRule)) return null;
    if (gameState.divineWeaponReserveCards.length < 2) {
      gameState.divineWeaponReserveCards = this.createDivineWeaponDeck();
    }
    const previousCards = [...gameState.divineWeaponCards];
    gameState.divineWeaponCards = gameState.divineWeaponReserveCards.splice(0, 2);
    gameState.divineWeaponGeneration += 1;
    gameState.divineWeaponUsedThisRound = false;
    gameState.divineWeaponUsedByPlayerId = null;
    gameState.divineWeaponUsedCardId = null;
    return {
      generation: gameState.divineWeaponGeneration,
      previousCards: previousCards.map(card => card.toJSON()),
      cards: gameState.divineWeaponCards.map(card => card.toJSON())
    };
  }

  initializeDivineWeaponCards() {
    const { gameState } = this.room;
    if (!isDivineWeaponRule(gameState.selectedRule)) return null;
    if (gameState.divineWeaponCards.length === 2) return null;
    gameState.divineWeaponReserveCards = this.createDivineWeaponDeck();
    return this.refreshDivineWeaponCards();
  }

  createSecondBattlefieldDeck() {
    const deck = [];
    for (const suit of DIVINE_WEAPON_SUITS) {
      for (const rank of DIVINE_WEAPON_RANKS) {
        const card = new Card(suit, rank, 0);
        card.id = `second-battlefield-${suit}-${rank}`;
        deck.push(card);
      }
    }
    for (let index = deck.length - 1; index > 0; index--) {
      const sample = Number(this.random());
      const boundedSample = Number.isFinite(sample)
        ? Math.min(0.999999999, Math.max(0, sample))
        : 0;
      const swapIndex = Math.floor(boundedSample * (index + 1));
      [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
    }
    return deck;
  }

  refreshSecondBattlefieldCommunityCards() {
    const { gameState } = this.room;
    if (!isSecondBattlefieldRule(gameState.selectedRule)) return null;
    if (gameState.secondBattlefieldReserveCards.length < SECOND_BATTLEFIELD_COMMUNITY_CARD_COUNT) {
      gameState.secondBattlefieldReserveCards = this.createSecondBattlefieldDeck();
    }
    const previousCards = [...gameState.secondBattlefieldCommunityCards];
    gameState.secondBattlefieldCommunityCards = gameState.secondBattlefieldReserveCards.splice(
      0,
      SECOND_BATTLEFIELD_COMMUNITY_CARD_COUNT
    );
    gameState.secondBattlefieldGeneration += 1;
    return {
      generation: gameState.secondBattlefieldGeneration,
      previousCards: previousCards.map(card => card.toJSON ? card.toJSON() : card),
      cards: gameState.secondBattlefieldCommunityCards.map(card => card.toJSON ? card.toJSON() : card)
    };
  }

  initializeSecondBattlefield() {
    const { gameState } = this.room;
    if (!isSecondBattlefieldRule(gameState.selectedRule)) return null;
    if (gameState.secondBattlefieldCommunityCards.length === SECOND_BATTLEFIELD_COMMUNITY_CARD_COUNT) {
      return null;
    }
    gameState.secondBattlefieldReserveCards = this.createSecondBattlefieldDeck();
    gameState.secondBattlefieldAccumulatedCardsByPlayerId = new Map(
      this.room.players.map(player => [player.id, []])
    );
    return this.refreshSecondBattlefieldCommunityCards();
  }

  applySecondBattlefieldAtRoundEnd() {
    const { gameState } = this.room;
    if (!isSecondBattlefieldRule(gameState.selectedRule)) return null;
    if (gameState.secondBattlefieldCommunityCards.length !== SECOND_BATTLEFIELD_COMMUNITY_CARD_COUNT) {
      this.initializeSecondBattlefield();
    }

    gameState.currentRoundPlays.forEach(play => {
      const accumulatedCards = gameState.secondBattlefieldAccumulatedCardsByPlayerId.get(play.playerId) || [];
      accumulatedCards.push(...(play.originalCards || play.cards || []));
      gameState.secondBattlefieldAccumulatedCardsByPlayerId.set(play.playerId, accumulatedCards);
    });

    const accumulatedCountsByPlayerId = Object.fromEntries(
      this.room.players.map(player => [
        player.id,
        (gameState.secondBattlefieldAccumulatedCardsByPlayerId.get(player.id) || []).length
      ])
    );
    const allPlayersFinished = this.room.players.every(player => player.cards.length === 0);
    const everyoneHasEnoughCards = this.room.players.every(
      player => accumulatedCountsByPlayerId[player.id] >= SECOND_BATTLEFIELD_MIN_ACCUMULATED_CARDS
    );
    const allPlayersBelowFinalThreshold = this.room.players.every(
      player => player.cards.length < SECOND_BATTLEFIELD_FINAL_HAND_THRESHOLD
    );
    // 只有本场已经攒够开牌门槛时才判断是否锁入最终场；正好剩5张仍照常开牌。
    if (!allPlayersFinished && everyoneHasEnoughCards && allPlayersBelowFinalThreshold) {
      gameState.secondBattlefieldFinalStage = true;
    }
    if (
      !allPlayersFinished
      && (gameState.secondBattlefieldFinalStage || !everyoneHasEnoughCards)
    ) {
      return {
        triggered: false,
        isFinalStage: gameState.secondBattlefieldFinalStage,
        accumulatedCountsByPlayerId
      };
    }

    const playerResults = this.room.players.map((player, playerIndex) => {
      const accumulatedCards = gameState.secondBattlefieldAccumulatedCardsByPlayerId.get(player.id) || [];
      const bestHand = evaluateBestPokerHand([
        ...gameState.secondBattlefieldCommunityCards,
        ...accumulatedCards
      ]);
      return {
        playerId: player.id,
        playerName: player.name,
        playerIndex,
        accumulatedCardCount: accumulatedCards.length,
        accumulatedCards: accumulatedCards.map(card => card.toJSON ? card.toJSON() : card),
        category: bestHand.category,
        categoryName: bestHand.categoryName,
        score: [...bestHand.score],
        bestFive: bestHand.cards.map(card => card.toJSON ? card.toJSON() : card)
      };
    });
    const bestScore = playerResults.reduce(
      (currentBest, playerResult) => (
        !currentBest || comparePokerScores(playerResult.score, currentBest) > 0
          ? playerResult.score
          : currentBest
      ),
      null
    );
    const winners = playerResults.filter(
      playerResult => comparePokerScores(playerResult.score, bestScore) === 0
    );
    const dealerIndex = this.room.getPlayerIndex(gameState.buryingPlayerId);
    const winningSides = new Set(
      winners.map(winner => (
        this.isAttackerPlayerIndex(winner.playerIndex, dealerIndex)
          ? 'attacker'
          : 'dealer'
      ))
    );
    const scoreDelta = winningSides.size !== 1
      ? 0
      : winningSides.has('attacker')
        ? SECOND_BATTLEFIELD_AWARD
        : -SECOND_BATTLEFIELD_AWARD;
    gameState.attackerScore += scoreDelta;
    gameState.secondBattlefieldShowdownCount += 1;

    const communityCards = gameState.secondBattlefieldCommunityCards.map(
      card => card.toJSON ? card.toJSON() : card
    );
    gameState.secondBattlefieldAccumulatedCardsByPlayerId = new Map(
      this.room.players.map(player => [player.id, []])
    );
    const nextCommunity = allPlayersFinished ? null : this.refreshSecondBattlefieldCommunityCards();
    const result = {
      triggered: true,
      triggerRound: gameState.currentRound,
      showdownNumber: gameState.secondBattlefieldShowdownCount,
      isFinal: allPlayersFinished,
      communityCards,
      players: playerResults,
      winnerPlayerIds: winners.map(winner => winner.playerId),
      winnerPlayerNames: winners.map(winner => winner.playerName),
      winningCategoryName: winners[0]?.categoryName || '高牌',
      winningSides: [...winningSides],
      award: SECOND_BATTLEFIELD_AWARD,
      scoreDelta,
      attackerScore: gameState.attackerScore,
      nextCommunityCards: nextCommunity?.cards || []
    };
    gameState.secondBattlefieldLastResult = result;
    logger.info(
      `房间 ${this.room.id} 第二战场第${result.showdownNumber}场：` +
      `${result.winnerPlayerNames.join('、')}以${result.winningCategoryName}获胜，` +
      `闲家分数变化${scoreDelta > 0 ? '+' : ''}${scoreDelta}`
    );
    return result;
  }

  refreshUsedDivineWeaponCards() {
    const { gameState } = this.room;
    if (
      !isDivineWeaponRule(gameState.selectedRule)
      || !gameState.divineWeaponUsedThisRound
    ) {
      return null;
    }
    // 本轮只要有人发动过，两张神兵牌便在轮末一起作废并重新抽取。
    return this.refreshDivineWeaponCards();
  }

  resolveDivineWeaponPlay(player, selectedCards, availableHandCards, playOptions = {}) {
    const { gameState } = this.room;
    if (gameState.divineWeaponUsedThisRound) {
      throw new Error('本轮已有玩家发动神兵天降');
    }
    const targetCard = gameState.divineWeaponCards.find(
      card => card.id === playOptions.divineWeaponCardId
    );
    if (!targetCard) throw new Error('请先选择本轮仍然有效的神兵牌');
    const sourceCard = selectedCards.find(
      card => card.id === playOptions.divineWeaponSourceCardId
    );
    if (!sourceCard) throw new Error('请选中一张手牌作为神兵转化牌');
    if (sourceCard.suit !== targetCard.suit && sourceCard.rank !== targetCard.rank) {
      throw new Error('转化牌必须与所选神兵牌花色或点数相同');
    }

    const transformCard = card => {
      if (card.id !== sourceCard.id) return card;
      const transformed = new Card(targetCard.suit, targetCard.rank, 0);
      transformed.id = sourceCard.id;
      transformed.originalSuit = sourceCard.suit;
      transformed.originalRank = sourceCard.rank;
      transformed.isLastStandTrump = false;
      transformed.isDivineWeaponTransformed = true;
      transformed.divineWeaponCardId = targetCard.id;
      return transformed;
    };
    return {
      effectiveCards: selectedCards.map(transformCard),
      // 是否缺门、是否必须跟对子/拖拉机，必须按发动前的真实手牌判断。
      // 否则把最后一张首花色副牌变成级牌后会被误判为缺门并允许毙牌。
      effectiveHandCards: availableHandCards,
      sourceCard,
      targetCard,
      publicInfo: {
        sourceCardId: sourceCard.id,
        sourceSuit: sourceCard.suit,
        sourceRank: sourceCard.rank,
        targetCard: targetCard.toJSON()
      }
    };
  }

  hasPendingTimeReversalDecision() {
    // 轮中“预备”只占用技能名额，不暂停出牌；第四家出完进入 holding 后才加锁。
    return Boolean(this.room.gameState.timeReversalDecisionState);
  }

  assertTimeReversalDecisionComplete() {
    if (!this.hasPendingTimeReversalDecision()) return;
    throw new Error('本轮正在等待时间倒流决定');
  }

  captureTimeReversalRoundSnapshot() {
    const { gameState, players } = this.room;
    if (!isTimeReversalRule(gameState.selectedRule) || gameState.currentRound < 1) {
      return null;
    }
    if (this.timeReversalRoundSnapshot?.currentRound === gameState.currentRound) {
      return this.timeReversalRoundSnapshot;
    }

    this.timeReversalRoundSnapshot = {
      phase: gameState.phase,
      currentRound: gameState.currentRound,
      currentPlayerIndex: gameState.currentPlayerIndex,
      roundStartPlayerIndex: gameState.roundStartPlayerIndex,
      currentWinnerIndex: gameState.currentWinnerIndex,
      playersPlayedThisRound: new Set(gameState.playersPlayedThisRound),
      currentRoundPlays: [...gameState.currentRoundPlays],
      leadingPattern: gameState.leadingPattern,
      playHistory: [...gameState.playHistory],
      attackerScore: gameState.attackerScore,
      collectedPointCards: [...gameState.collectedPointCards],
      lastRoundLeadingPattern: gameState.lastRoundLeadingPattern,
      lastRoundWinnerIndex: gameState.lastRoundWinnerIndex,
      tenSidedAmbushAttackerNetCardCount: gameState.tenSidedAmbushAttackerNetCardCount,
      activeSkillUsesByPlayerId: new Map(
        [...gameState.activeSkillUsesByPlayerId.entries()].map(([playerId, skillIds]) => [
          playerId,
          new Set(skillIds)
        ])
      ),
      divineWeaponReserveCards: [...gameState.divineWeaponReserveCards],
      divineWeaponCards: [...gameState.divineWeaponCards],
      divineWeaponGeneration: gameState.divineWeaponGeneration,
      divineWeaponUsedThisRound: gameState.divineWeaponUsedThisRound,
      divineWeaponUsedByPlayerId: gameState.divineWeaponUsedByPlayerId,
      divineWeaponUsedCardId: gameState.divineWeaponUsedCardId,
      timeReversalLockedRounds: new Set(gameState.timeReversalLockedRounds),
      trumpAction: gameState.trumpAction || null,
      players: players.map(player => ({
        playerId: player.id,
        cards: [...player.cards],
        shownCards: new Set(player.shownCards)
      }))
    };
    return this.timeReversalRoundSnapshot;
  }

  restoreTimeReversalRoundSnapshot() {
    const snapshot = this.timeReversalRoundSnapshot;
    if (!snapshot) throw new Error('找不到可回溯的本轮状态');
    const { gameState } = this.room;

    for (const playerSnapshot of snapshot.players) {
      const player = this.room.findPlayerById(playerSnapshot.playerId);
      if (!player) continue;
      player.cards = DeckService.autoSortCards([...playerSnapshot.cards]);
      player.shownCards = new Set(playerSnapshot.shownCards);
    }

    gameState.phase = snapshot.phase;
    gameState.currentRound = snapshot.currentRound;
    gameState.currentPlayerIndex = snapshot.currentPlayerIndex;
    gameState.roundStartPlayerIndex = snapshot.roundStartPlayerIndex;
    gameState.currentWinnerIndex = snapshot.currentWinnerIndex;
    gameState.playersPlayedThisRound = new Set(snapshot.playersPlayedThisRound);
    gameState.currentRoundPlays = [...snapshot.currentRoundPlays];
    gameState.leadingPattern = snapshot.leadingPattern;
    gameState.playHistory = [...snapshot.playHistory];
    gameState.attackerScore = snapshot.attackerScore;
    gameState.collectedPointCards = [...snapshot.collectedPointCards];
    gameState.lastRoundLeadingPattern = snapshot.lastRoundLeadingPattern;
    gameState.lastRoundWinnerIndex = snapshot.lastRoundWinnerIndex;
    gameState.tenSidedAmbushAttackerNetCardCount = snapshot.tenSidedAmbushAttackerNetCardCount;
    gameState.activeSkillUsesByPlayerId = new Map(
      [...snapshot.activeSkillUsesByPlayerId.entries()].map(([playerId, skillIds]) => [
        playerId,
        new Set(skillIds)
      ])
    );
    gameState.divineWeaponReserveCards = [...snapshot.divineWeaponReserveCards];
    gameState.divineWeaponCards = [...snapshot.divineWeaponCards];
    gameState.divineWeaponGeneration = snapshot.divineWeaponGeneration;
    gameState.divineWeaponUsedThisRound = snapshot.divineWeaponUsedThisRound;
    gameState.divineWeaponUsedByPlayerId = snapshot.divineWeaponUsedByPlayerId;
    gameState.divineWeaponUsedCardId = snapshot.divineWeaponUsedCardId;
    gameState.timeReversalLockedRounds = new Set(snapshot.timeReversalLockedRounds);
    gameState.trumpAction = snapshot.trumpAction;
    gameState.timeReversalReservations.clear();
    gameState.timeReversalDecisionState = null;
    gameState.timeReversalWindowRound = null;
    return snapshot;
  }

  activateTimeReversal(playerId) {
    const { gameState } = this.room;
    if (gameState.phase !== GamePhases.PLAYING || !this.roundManager || gameState.currentRound < 1) {
      throw new Error('进入出牌阶段后才能预备时间倒流');
    }
    const activeSkill = getActiveSkillForRule(gameState.selectedRule);
    if (activeSkill?.id !== ActiveSkillIds.TIME_REVERSAL) {
      throw new Error('本局没有时间倒流技能');
    }
    const player = this.room.findPlayerById(playerId);
    if (!player) throw new Error('玩家不存在');
    if (this.hasUsedActiveSkill(player.id, activeSkill.id)) {
      throw new Error('时间倒流每名玩家每局只能发动一次');
    }
    if (gameState.timeReversalDecisionState === 'awaiting_response') {
      throw new Error('本轮时间倒流预备窗口已经结束');
    }
    const targetRound = gameState.timeReversalDecisionState === 'holding'
      ? gameState.timeReversalWindowRound
      : gameState.currentRound;
    if (!Number.isInteger(targetRound) || targetRound < 1) {
      throw new Error('当前没有可以预备时间倒流的轮次');
    }
    if (gameState.timeReversalLockedRounds.has(targetRound)) {
      throw new Error('本轮已经发动过时间倒流');
    }
    if (gameState.timeReversalReservations.has(player.id)) {
      throw new Error('你已经预备了本轮时间倒流');
    }

    // 轮中首次预备前保存本轮初态；轮末两秒窗口沿用第四家出牌前已建立的快照。
    if (gameState.timeReversalDecisionState !== 'holding') {
      this.captureTimeReversalRoundSnapshot();
    }
    const reservation = {
      playerId: player.id,
      playerName: player.name,
      round: targetRound
    };
    gameState.timeReversalReservations.set(player.id, reservation);
    const result = {
      ...reservation,
      activeSkillId: activeSkill.id,
      activeSkillName: activeSkill.name
    };
    logger.info(`房间 ${this.room.id} 玩家 ${player.name} 预备第${targetRound}轮时间倒流`);
    return result;
  }

  scheduleTimeReversalDecision() {
    const { gameState } = this.room;
    if (gameState.timeReversalDecisionState !== 'holding') {
      return false;
    }
    if (this.timeReversalDecisionTimer) clearTimeout(this.timeReversalDecisionTimer);
    this.timeReversalDecisionTimer = setTimeout(() => {
      this.timeReversalDecisionTimer = null;
      this.promptTimeReversalDecision();
    }, TIME_REVERSAL_DECISION_DELAY_MS);
    return true;
  }

  promptTimeReversalDecision() {
    const { gameState } = this.room;
    if (gameState.timeReversalDecisionState !== 'holding') return null;
    const reservations = Array.from(gameState.timeReversalReservations.values());
    if (reservations.length === 0) {
      const result = this.closeTimeReversalWindow('no_reservations');
      this.onTimeReversalWindowClosed?.(result);
      return result;
    }
    gameState.timeReversalDecisionState = 'awaiting_response';
    const payload = {
      round: gameState.timeReversalWindowRound,
      players: reservations.map(({ playerId, playerName }) => ({ playerId, playerName }))
    };
    for (const reservation of reservations) {
      const player = this.room.findPlayerById(reservation.playerId);
      if (!player?.socketId) continue;
      this.io.to(player.socketId).emit('time_reversal_decision_required', {
        ...payload,
        playerId: player.id,
        playerName: player.name
      });
    }
    this.io.to(this.room.id).emit('time_reversal_decision_pending', payload);
    this.broadcastRoomUpdate();
    return payload;
  }

  respondTimeReversal(playerId, accept) {
    const { gameState } = this.room;
    const reservation = gameState.timeReversalReservations.get(playerId);
    if (
      !reservation
      || gameState.timeReversalDecisionState !== 'awaiting_response'
    ) {
      throw new Error('当前没有等待你的时间倒流决定');
    }
    const player = this.room.findPlayerById(playerId);
    if (!player) throw new Error('玩家不存在');
    if (this.timeReversalDecisionTimer) {
      clearTimeout(this.timeReversalDecisionTimer);
      this.timeReversalDecisionTimer = null;
    }

    if (!accept) {
      gameState.timeReversalReservations.delete(player.id);
      logger.info(`房间 ${this.room.id} 玩家 ${player.name} 放弃第${reservation.round}轮时间倒流`);
      if (gameState.timeReversalReservations.size === 0) {
        return {
          ...this.closeTimeReversalWindow('all_declined'),
          playerId: player.id,
          playerName: player.name
        };
      }
      return {
        accepted: false,
        resolved: false,
        playerId: player.id,
        playerName: player.name,
        round: reservation.round,
        pendingPlayerIds: Array.from(gameState.timeReversalReservations.keys()),
        gameFinished: false
      };
    }

    const snapshot = this.restoreTimeReversalRoundSnapshot();
    this.recordActiveSkillUse(player.id, ActiveSkillIds.TIME_REVERSAL);
    // 回放的仍是同一轮，锁住该轮，避免四名玩家在同一轮连锁倒流。
    gameState.timeReversalLockedRounds.add(snapshot.currentRound);
    this.timeReversalRoundSnapshot = null;
    logger.info(`房间 ${this.room.id} 玩家 ${player.name} 发动时间倒流，回到第${snapshot.currentRound}轮开始前`);
    return {
      accepted: true,
      resolved: true,
      playerId: player.id,
      playerName: player.name,
      round: snapshot.currentRound,
      firstPlayerIndex: snapshot.roundStartPlayerIndex,
      firstPlayerId: this.room.findPlayerByIndex(snapshot.roundStartPlayerIndex)?.id || null,
      gameFinished: false,
      hands: this.room.players.map(candidate => ({
        playerId: candidate.id,
        cards: candidate.cards.map(card => card.toJSON())
      }))
    };
  }

  closeTimeReversalWindow(reason) {
    const { gameState } = this.room;
    const round = gameState.timeReversalWindowRound;
    gameState.timeReversalReservations.clear();
    gameState.timeReversalDecisionState = null;
    gameState.timeReversalWindowRound = null;
    this.timeReversalRoundSnapshot = null;
    const gameFinished = this.room.players.every(candidate => candidate.cards.length === 0);
    if (gameFinished) this.finishGame();
    return {
      accepted: false,
      resolved: true,
      reason,
      round,
      gameFinished
    };
  }

  hasPendingLastStandDecision() {
    return this.room.gameState.lastStandPendingPlayerIds.size > 0;
  }

  assertLastStandDecisionComplete() {
    if (!this.hasPendingLastStandDecision()) return;
    const pendingNames = [...this.room.gameState.lastStandPendingPlayerIds]
      .map(playerId => this.room.findPlayerById(playerId)?.name)
      .filter(Boolean);
    throw new Error(`请等待 ${pendingNames.join('、') || '玩家'} 决定是否发动绝处逢生`);
  }

  isEligibleForLastStand(player) {
    const { gameState } = this.room;
    if (
      !isLastStandRule(gameState.selectedRule)
      || gameState.lastStandActivatedPlayerIds.has(player.id)
      || gameState.lastStandPendingPlayerIds.has(player.id)
      || player.cards.length < 5
    ) {
      return false;
    }
    if (player.cards.some(card => isTrumpCard(card, gameState.trumpSuit, gameState.trumpRank))) {
      return false;
    }
    return new Set(player.cards.map(card => card.suit)).size === 1;
  }

  requestLastStandIfEligible(player) {
    if (!this.isEligibleForLastStand(player)) return null;
    const { gameState } = this.room;
    gameState.lastStandPendingPlayerIds.add(player.id);
    const payload = {
      playerId: player.id,
      playerName: player.name,
      cardsCount: player.cards.length,
      suit: player.cards[0]?.suit || null
    };
    this.io.to(player.socketId).emit('last_stand_decision_required', payload);
    this.io.to(this.room.id).emit('last_stand_decision_pending', {
      playerId: player.id,
      playerName: player.name
    });
    this.broadcastRoomUpdate();
    if (player.isBot) {
      return this.respondLastStand(player.id, true);
    }
    return payload;
  }

  respondLastStand(playerId, accept) {
    const { gameState } = this.room;
    if (!gameState.lastStandPendingPlayerIds.has(playerId)) {
      throw new Error('当前没有等待你的绝处逢生决定');
    }
    const player = this.room.findPlayerById(playerId);
    if (!player) throw new Error('玩家不存在');

    gameState.lastStandPendingPlayerIds.delete(playerId);
    if (accept) {
      if (!this.isEligibleForLastStand(player)) {
        // isEligibleForLastStand intentionally excludes pending players.
        const hasEnoughCards = player.cards.length >= 5;
        const hasNoTrump = player.cards.every(card =>
          !isTrumpCard(card, gameState.trumpSuit, gameState.trumpRank)
        );
        const isSingleSuit = new Set(player.cards.map(card => card.suit)).size === 1;
        if (!hasEnoughCards || !hasNoTrump || !isSingleSuit) {
          throw new Error('你的手牌已不再满足绝处逢生条件');
        }
      }
      player.cards.forEach(card => {
        card.isLastStandTrump = true;
      });
      player.cards = DeckService.autoSortCards(player.cards);
      gameState.lastStandActivatedPlayerIds.add(player.id);
      this.io.to(player.socketId).emit('last_stand_hand_updated', {
        cards: player.cards.map(card => card.toJSON())
      });
      this.io.to(this.room.id).emit('last_stand_activated', {
        playerId: player.id,
        playerName: player.name,
        cardsCount: player.cards.length
      });
      logger.info(`房间 ${this.room.id} 玩家 ${player.name} 发动绝处逢生，${player.cards.length} 张牌全部视为主牌`);
    } else {
      this.io.to(this.room.id).emit('last_stand_declined', {
        playerId: player.id,
        playerName: player.name
      });
    }
    this.broadcastRoomUpdate();
    return { accepted: Boolean(accept), playerId: player.id };
  }

  hasPendingTeammateCheerDecision() {
    return Boolean(this.room.gameState.teammateCheerPending);
  }

  assertTeammateCheerDecisionComplete() {
    const pending = this.room.gameState.teammateCheerPending;
    if (!pending) return;
    throw new Error(`请等待 ${pending.playerName || '玩家'} 决定是否发动队友加油`);
  }

  isEligibleForTeammateCheer(player) {
    const { gameState } = this.room;
    if (
      !player
      || !isTeammateCheerRule(gameState.selectedRule)
      || gameState.phase !== GamePhases.PLAYING
      || player.cards.length === 0
      || gameState.teammateCheerPending
      || gameState.teammateCheerUsedPlayerIds.has(player.id)
    ) {
      return false;
    }
    return player.cards.every(card => (
      !isTrumpCard(card, gameState.trumpSuit, gameState.trumpRank)
    ));
  }

  requestTeammateCheerIfEligible(player, { triggerRound = null } = {}) {
    if (!this.isEligibleForTeammateCheer(player)) return null;
    const playerIndex = this.room.getPlayerIndex(player.id);
    if (playerIndex < 0 || this.room.players.length !== 4) return null;
    const teammate = this.room.players[(playerIndex + 2) % this.room.players.length];
    if (!teammate) return null;

    const pending = {
      playerId: player.id,
      playerName: player.name,
      teammatePlayerId: teammate.id,
      teammatePlayerName: teammate.name,
      triggerRound: Number.isInteger(triggerRound)
        ? triggerRound
        : this.room.gameState.currentRound
    };
    this.room.gameState.teammateCheerPending = pending;
    return { ...pending };
  }

  respondTeammateCheer(playerId, accept) {
    const { gameState } = this.room;
    const pending = gameState.teammateCheerPending;
    if (!pending || pending.playerId !== playerId) {
      throw new Error('当前没有等待你的队友加油决定');
    }
    const player = this.room.findPlayerById(playerId);
    const teammate = this.room.findPlayerById(pending.teammatePlayerId);
    if (!player || !teammate) throw new Error('玩家或队友不存在');

    const triggeringPlay = [...gameState.playHistory]
      .reverse()
      .find(play => play.playerId === player.id) || null;
    let transformedCards = [];
    let buffedCardsBefore = [];
    if (accept) {
      if (player.cards.length === 0) {
        throw new Error('手牌已经出完，不能发动队友加油');
      }
      const stillHasNoTrump = player.cards.every(card => (
        !isTrumpCard(card, gameState.trumpSuit, gameState.trumpRank)
      ));
      if (!stillHasNoTrump) throw new Error('你的手牌中已经重新出现主牌，不能发动队友加油');
      if (gameState.teammateCheerUsedPlayerIds.has(player.id)) {
        throw new Error('你本局已经发动过队友加油');
      }

      buffedCardsBefore = teammate.cards.map(card => ({
        id: card.id,
        suit: card.suit,
        rank: card.rank,
        originalSuit: card.originalSuit || null,
        originalRank: card.originalRank || null,
        isTeammateCheered: Boolean(card.isTeammateCheered)
      }));
      teammate.cards.forEach(card => {
        if (card.isTeammateCheered) return;
        card.originalRank = card.originalRank || card.rank;
        card.originalSuit = card.originalSuit || card.suit;
        const shiftedFace = shiftStrengthCompensationCardFace(
          card,
          gameState.trumpSuit,
          gameState.trumpRank,
          1
        );
        card.rank = shiftedFace.rank;
        card.suit = shiftedFace.suit;
        card.isTeammateCheered = true;
        card.value = card.calculateValue();
      });
      teammate.cards = DeckService.autoSortCards(teammate.cards);
      transformedCards = teammate.cards.map(card => card.toJSON ? card.toJSON() : card);
      gameState.teammateCheerUsedPlayerIds.add(player.id);
      gameState.teammateCheerBuffedPlayerIds.add(teammate.id);
    }
    if (triggeringPlay) {
      triggeringPlay.teammateCheerResolution = {
        accepted: Boolean(accept),
        playerId: player.id,
        teammatePlayerId: teammate.id,
        buffedCardsBefore
      };
    }
    gameState.teammateCheerPending = null;

    const result = {
      ...pending,
      accepted: Boolean(accept),
      buffedPlayerId: accept ? teammate.id : null,
      buffedPlayerName: accept ? teammate.name : null,
      transformedCards,
      message: accept
        ? `${player.name} 发动队友加油，${teammate.name} 获得永久牌面+1 Buff`
        : `${player.name} 暂不发动队友加油`
    };
    const publicResult = { ...result };
    delete publicResult.transformedCards;
    gameState.teammateCheerLastResult = publicResult;

    const gameFinished = this.room.players.every(candidate => (
      this.getPlayableCardCount(candidate) === 0
    ));
    if (gameFinished) this.finishGame();
    logger.info(`房间 ${this.room.id} ${result.message}`);
    return { ...result, gameFinished };
  }

  hasPendingAfterglowDecision() {
    return Boolean(this.room.gameState.afterglowPending);
  }

  assertAfterglowDecisionComplete() {
    const pending = this.room.gameState.afterglowPending;
    if (!pending) return;
    throw new Error(`请等待 ${pending.playerName || '玩家'} 决定是否发动回光返照`);
  }

  getAfterglowTrumpCards(player) {
    const { gameState } = this.room;
    return (player?.cards || []).filter(card => (
      isTrumpCard(card, gameState.trumpSuit, gameState.trumpRank)
    ));
  }

  isEligibleForAfterglow(player) {
    const { gameState } = this.room;
    if (
      !player
      || !isAfterglowRule(gameState.selectedRule)
      || gameState.phase !== GamePhases.PLAYING
      || gameState.trumpSuit === Suits.NO_TRUMP
      || player.cards.length === 0
      || gameState.afterglowPending
      || gameState.afterglowUsedPlayerIds.has(player.id)
      || gameState.afterglowActivePlayerIds.has(player.id)
    ) {
      return false;
    }
    const trumpCount = this.getAfterglowTrumpCards(player).length;
    return trumpCount >= 1 && trumpCount <= 3;
  }

  requestAfterglowIfEligible(player, {
    triggerRound = null,
    triggerTiming = 'after_play'
  } = {}) {
    if (!this.isEligibleForAfterglow(player)) return null;
    const pending = {
      playerId: player.id,
      playerName: player.name,
      trumpCount: this.getAfterglowTrumpCards(player).length,
      remainingCount: player.cards.length,
      triggerTiming,
      triggerRound: Number.isInteger(triggerRound)
        ? triggerRound
        : this.room.gameState.currentRound
    };
    this.room.gameState.afterglowPending = pending;
    return { ...pending };
  }

  beginOpeningAfterglowDecision(player) {
    const decision = this.requestAfterglowIfEligible(player, {
      triggerRound: 1,
      triggerTiming: 'before_first_play'
    });
    if (!decision) return null;

    this.io.to(this.room.id).emit('afterglow_decision_pending', decision);
    if (!player.isBot) {
      if (player.socketId) {
        this.io.to(player.socketId).emit('afterglow_decision_required', decision);
      }
      return decision;
    }

    const result = this.respondAfterglow(player.id, true);
    const { transformedCards: _transformedCards, ...publicResult } = result;
    this.io.to(this.room.id).emit('afterglow_activated', publicResult);
    return result;
  }

  respondAfterglow(playerId, accept) {
    const { gameState } = this.room;
    const pending = gameState.afterglowPending;
    if (!pending || pending.playerId !== playerId) {
      throw new Error('当前没有等待你的回光返照决定');
    }
    const player = this.room.findPlayerById(playerId);
    if (!player) throw new Error('玩家不存在');

    const triggeringPlay = [...gameState.playHistory]
      .reverse()
      .find(play => play.playerId === player.id) || null;
    let transformedCards = [];
    let boostedCardsBefore = [];
    if (accept) {
      if (gameState.trumpSuit === Suits.NO_TRUMP) {
        gameState.afterglowPending = null;
        throw new Error('无主局不能发动回光返照');
      }
      const trumpCount = this.getAfterglowTrumpCards(player).length;
      if (player.cards.length === 0) {
        throw new Error('手牌已经出完，不能发动回光返照');
      }
      if (trumpCount < 1 || trumpCount > 3) {
        throw new Error('只有仍持有1至3张主牌时才能发动回光返照');
      }
      if (gameState.afterglowUsedPlayerIds.has(player.id)) {
        throw new Error('你本局已经发动过回光返照');
      }
      boostedCardsBefore = this.getAfterglowTrumpCards(player).map(card => ({
        id: card.id,
        suit: card.suit,
        rank: card.rank,
        originalSuit: card.originalSuit || null,
        originalRank: card.originalRank || null,
        isAfterglowBoosted: Boolean(card.isAfterglowBoosted)
      }));
      player.cards = DeckService.autoSortCards(this.transformAfterglowCards(player.cards));
      transformedCards = player.cards.map(card => card.toJSON ? card.toJSON() : card);
      gameState.afterglowUsedPlayerIds.add(player.id);
      gameState.afterglowActivePlayerIds.add(player.id);
    }
    if (triggeringPlay) {
      triggeringPlay.afterglowResolution = {
        accepted: Boolean(accept),
        playerId: player.id,
        boostedCardsBefore
      };
    }
    gameState.afterglowPending = null;

    const result = {
      ...pending,
      accepted: Boolean(accept),
      active: Boolean(accept),
      transformedCards,
      message: accept
        ? `${player.name} 发动回光返照：剩余主牌立即+1，只要仍有主牌，每次只能出主牌`
        : `${player.name} 暂不发动回光返照`
    };
    const publicResult = { ...result };
    delete publicResult.transformedCards;
    gameState.afterglowLastResult = publicResult;
    logger.info(`房间 ${this.room.id} ${result.message}`);
    return result;
  }

  transformAfterglowCards(cards) {
    const { trumpSuit, trumpRank } = this.room.gameState;
    return cards.map(card => {
      if (!isTrumpCard(card, trumpSuit, trumpRank)) return card;
      if (card.isAfterglowBoosted) return card;
      const shiftedFace = shiftStrengthCompensationCardFace(
        card,
        trumpSuit,
        trumpRank,
        1
      );
      const transformed = new Card(shiftedFace.suit, shiftedFace.rank, 0);
      Object.assign(transformed, card, shiftedFace, {
        id: card.id,
        originalSuit: card.originalSuit || card.suit,
        originalRank: card.originalRank || card.rank,
        isAfterglowBoosted: true
      });
      transformed.value = transformed.calculateValue();
      return transformed;
    });
  }

  resolveWholeHandExchange({ triggerKey, ruleName, offset, threshold }) {
    const { gameState, players } = this.room;
    if (gameState.wholeHandExchangeTriggers.has(triggerKey)) return null;
    gameState.wholeHandExchangeTriggers.add(triggerKey);

    const snapshots = players.map(player => [...player.cards]);
    const transfers = players.map((player, index) => {
      const targetIndex = (index + offset + players.length) % players.length;
      return {
        fromPlayerId: player.id,
        fromPlayerName: player.name,
        toPlayerId: players[targetIndex].id,
        toPlayerName: players[targetIndex].name,
        cardsCount: snapshots[index].length
      };
    });

    players.forEach((recipient, recipientIndex) => {
      const sourceIndex = (recipientIndex - offset + players.length) % players.length;
      recipient.cards = DeckService.autoSortCards(snapshots[sourceIndex]);
      recipient.shownCards.clear();
    });

    const payload = {
      triggerKey,
      ruleName,
      threshold,
      transfers,
      animationDuration: WHOLE_HAND_EXCHANGE_ANIMATION_MS
    };
    logger.info(
      `房间 ${this.room.id} ${ruleName}：本轮结束后四家手牌均不多于 ${threshold} 张，完成整手交换`
    );
    return payload;
  }

  applyWholeHandExchangeAtRoundEnd() {
    const { gameState, players } = this.room;
    const allHandsAtOrBelow = threshold => players.every(
      player => player.cards.length <= threshold
    );
    if (isCosmicShiftRule(gameState.selectedRule) && allHandsAtOrBelow(12)) {
      return this.resolveWholeHandExchange({
        triggerKey: 'cosmic_shift_12',
        ruleName: '斗转星移',
        offset: 2,
        threshold: 12
      });
    }
    if (isGoWithTheFlowRule(gameState.selectedRule)) {
      if (
        allHandsAtOrBelow(16)
        && !gameState.wholeHandExchangeTriggers.has('go_with_the_flow_16')
      ) {
        return this.resolveWholeHandExchange({
          triggerKey: 'go_with_the_flow_16',
          ruleName: '随波逐流',
          offset: 1,
          threshold: 16
        });
      }
      if (allHandsAtOrBelow(9)) {
        return this.resolveWholeHandExchange({
          triggerKey: 'go_with_the_flow_9',
          ruleName: '随波逐流',
          offset: 1,
          threshold: 9
        });
      }
    }
    return null;
  }

  prepareRoundCardExchangeAtRoundEnd(allRoundCards) {
    const { gameState, players } = this.room;
    if (gameState.cardExchange || players.some(player => player.cards.length === 0)) {
      return null;
    }

    const hasPointCard = allRoundCards.some(card => getCardPoints(card) > 0);
    let offset = null;
    if (isFrequentFluctuationRule(gameState.selectedRule) && hasPointCard) {
      offset = 1;
    } else if (isMinorDisturbanceRule(gameState.selectedRule) && !hasPointCard) {
      offset = 2;
    }
    if (!Number.isInteger(offset)) return null;

    const targetByPlayerId = {};
    players.forEach((player, index) => {
      targetByPlayerId[player.id] = players[(index + offset) % players.length].id;
    });
    this.cardExchangeSelections.clear();
    gameState.cardExchange = {
      stage: 'round',
      operation: 'exchange',
      triggerRound: gameState.currentRound,
      ruleId: gameState.selectedRule.id,
      ruleName: gameState.selectedRule.name,
      requiredCards: 1,
      targetByPlayerId,
      submittedPlayerIds: new Set()
    };

    logger.info(
      `房间 ${this.room.id} ${gameState.selectedRule.name}：第${gameState.currentRound}轮` +
      `${hasPointCard ? '含' : '不含'}分数牌，等待四家各交一张牌`
    );
    return {
      stage: 'round',
      operation: 'exchange',
      triggerRound: gameState.currentRound,
      ruleId: gameState.selectedRule.id,
      ruleName: gameState.selectedRule.name,
      requiredCards: 1,
      transfers: this.createPublicCardExchangeTransfers()
    };
  }

  prepareRoundDiscardAtRoundEnd(allRoundCards) {
    const { gameState, players } = this.room;
    if (
      gameState.cardExchange
      || !isLingeringDiscardRule(gameState.selectedRule)
      || players.some(player => player.cards.length === 0)
      || !allRoundCards.some(card => getCardPoints(card) > 0)
    ) {
      return null;
    }

    const targetByPlayerId = Object.fromEntries(players.map(player => [player.id, null]));
    this.cardExchangeSelections.clear();
    gameState.cardExchange = {
      stage: 'round',
      operation: 'discard',
      triggerRound: gameState.currentRound,
      ruleId: gameState.selectedRule.id,
      ruleName: gameState.selectedRule.name,
      requiredCards: 1,
      targetByPlayerId,
      submittedPlayerIds: new Set()
    };

    logger.info(
      `房间 ${this.room.id} 弃掷逦迤：第${gameState.currentRound}轮含分数牌，等待四家各自暗弃一张牌`
    );
    return {
      stage: 'round',
      operation: 'discard',
      triggerRound: gameState.currentRound,
      ruleId: gameState.selectedRule.id,
      ruleName: gameState.selectedRule.name,
      requiredCards: 1,
      transfers: this.createPublicCardExchangeTransfers()
    };
  }

  submitAutomaticRoundCardExchanges() {
    let result = { resolved: false, stage: 'round' };
    for (const bot of this.room.players.filter(player => player.isBot)) {
      const exchange = this.room.gameState.cardExchange;
      if (!exchange || exchange.stage !== 'round') break;
      if (exchange.submittedPlayerIds.has(bot.id)) continue;
      const selectedCard = bot.cards[0];
      if (!selectedCard) continue;
      result = this.submitOpeningCardExchange(bot.id, [selectedCard.id]);
    }
    return result;
  }

  activateLateMoverAdvantage(playerId) {
    const { gameState } = this.room;
    if (gameState.phase !== GamePhases.PLAYING || gameState.playMode !== PlayModes.ORDERED) {
      throw new Error('当前不是有序出牌阶段');
    }

    const activeSkill = getActiveSkillForRule(gameState.selectedRule);
    if (activeSkill?.id !== ActiveSkillIds.LATE_MOVER_ADVANTAGE) {
      throw new Error('本局没有后发制人技能');
    }
    if (this.hasUsedActiveSkill(playerId, activeSkill.id)) {
      throw new Error('后发制人每名玩家每局只能发动一次');
    }

    const player = this.room.findPlayerById(playerId);
    if (!player) throw new Error('玩家不存在');
    const playerIndex = this.room.players.findIndex(candidate => candidate.id === player.id);
    if (playerIndex !== gameState.currentPlayerIndex) {
      throw new Error('现在还没有轮到你出牌');
    }

    const playedPlayerIndexes = [...gameState.playersPlayedThisRound];
    const secondPlayerIndex = playedPlayerIndexes.at(-1);
    const expectedThirdPlayerIndex = Number.isInteger(secondPlayerIndex)
      ? this.roundManager.getPlayerIndexAtOffset(secondPlayerIndex, 1)
      : null;
    if (
      playedPlayerIndexes.length !== 2
      || expectedThirdPlayerIndex !== playerIndex
      || gameState.playersPlayedThisRound.has(playerIndex)
    ) {
      throw new Error('后发制人只能由本轮三号位在出牌前发动');
    }

    const nextPlayerIndex = this.roundManager.getPlayerIndexAtOffset(playerIndex, 1);
    if (gameState.playersPlayedThisRound.has(nextPlayerIndex)) {
      throw new Error('下家已经出过牌，无法发动后发制人');
    }
    const nextPlayer = this.room.findPlayerByIndex(nextPlayerIndex);
    if (!nextPlayer) throw new Error('找不到下家');

    this.recordActiveSkillUse(player.id, activeSkill.id);
    gameState.currentPlayerIndex = nextPlayerIndex;
    const result = {
      playerId: player.id,
      playerName: player.name,
      nextPlayerId: nextPlayer.id,
      nextPlayerName: nextPlayer.name,
      currentPlayerIndex: nextPlayerIndex,
      activeSkillId: activeSkill.id,
      activeSkillName: activeSkill.name,
      message: `${player.name} 发动后发制人，改由 ${nextPlayer.name} 先出牌`
    };
    logger.info(`房间 ${this.room.id} ${result.message}`);
    return result;
  }

  activateRecommendTalent(playerId) {
    const { gameState } = this.room;
    if (gameState.phase !== GamePhases.PLAYING || gameState.playMode !== PlayModes.ORDERED) {
      throw new Error('当前不是有序出牌阶段');
    }

    const activeSkill = getActiveSkillForRule(gameState.selectedRule);
    if (activeSkill?.id !== ActiveSkillIds.RECOMMEND_TALENT) {
      throw new Error('本局没有举贤任能技能');
    }
    if (this.hasUsedActiveSkill(playerId, activeSkill.id)) {
      throw new Error('举贤任能每名玩家每局只能发动一次');
    }

    const player = this.room.findPlayerById(playerId);
    if (!player) throw new Error('玩家不存在');
    const playerIndex = this.room.players.findIndex(candidate => candidate.id === player.id);
    if (playerIndex !== gameState.currentPlayerIndex) {
      throw new Error('现在还没有轮到你出牌');
    }
    if (
      gameState.currentRoundPlays.length !== 0
      || gameState.playersPlayedThisRound.size !== 0
      || playerIndex !== gameState.roundStartPlayerIndex
    ) {
      throw new Error('举贤任能只能由本轮一号位在出牌前发动');
    }

    const nextPlayerIndex = this.roundManager.getPlayerIndexAtOffset(playerIndex, 1);
    const nextPlayer = this.room.findPlayerByIndex(nextPlayerIndex);
    if (!nextPlayer) throw new Error('找不到下家');

    this.recordActiveSkillUse(player.id, activeSkill.id);
    gameState.currentPlayerIndex = nextPlayerIndex;
    const result = {
      playerId: player.id,
      playerName: player.name,
      nextPlayerId: nextPlayer.id,
      nextPlayerName: nextPlayer.name,
      currentPlayerIndex: nextPlayerIndex,
      activeSkillId: activeSkill.id,
      activeSkillName: activeSkill.name,
      message: `${player.name} 发动举贤任能，改由 ${nextPlayer.name} 先出牌，自己改为本轮最后出牌`
    };
    logger.info(`房间 ${this.room.id} ${result.message}`);
    return result;
  }

  activateBushGate(playerId) {
    const { gameState } = this.room;
    if (gameState.phase !== GamePhases.PLAYING || gameState.playMode !== PlayModes.ORDERED) {
      throw new Error('当前不是有序出牌阶段');
    }
    if (!this.roundManager) throw new Error('本轮尚未开始');

    const activeSkill = getActiveSkillForRule(gameState.selectedRule);
    if (
      !isBushGateRule(gameState.selectedRule)
      || activeSkill?.id !== ActiveSkillIds.BUSH_GATE
    ) {
      throw new Error('本局没有布什戈门技能');
    }
    if (this.hasUsedActiveSkill(playerId, activeSkill.id)) {
      throw new Error('布什戈门每名玩家每局只能发动一次');
    }
    if (gameState.bushGateRestriction) {
      throw new Error('一号位尚未完成布什戈门要求的重新首发');
    }

    const player = this.room.findPlayerById(playerId);
    if (!player) throw new Error('玩家不存在');
    const playerIndex = this.room.getPlayerIndex(player.id);
    const leadingPlay = gameState.currentRoundPlays[0] || null;
    const leaderIndex = leadingPlay?.playerIndex;
    const expectedSecondIndex = Number.isInteger(leaderIndex)
      ? this.roundManager.getPlayerIndexAtOffset(leaderIndex, 1)
      : null;
    if (
      gameState.currentRoundPlays.length !== 1
      || gameState.playersPlayedThisRound.size !== 1
      || leaderIndex !== gameState.roundStartPlayerIndex
      || playerIndex !== gameState.currentPlayerIndex
      || playerIndex !== expectedSecondIndex
      || gameState.playersPlayedThisRound.has(playerIndex)
    ) {
      throw new Error('布什戈门只能由本轮二号位在一号位出牌后、自己出牌前发动');
    }

    const leader = this.room.findPlayerById(leadingPlay.playerId);
    if (!leader) throw new Error('找不到本轮一号位');
    // 收回之前仍留在一号位手中的牌，就是这次重发唯一允许使用的牌源。
    if (leader.cards.length === 0) {
      throw new Error('一号位已经没有其他手牌，无法重新首发');
    }

    const historyIndex = gameState.playHistory.findLastIndex(play => (
      play.playerId === leader.id
      && play.playerIndex === leaderIndex
    ));
    if (historyIndex < 0) throw new Error('找不到一号位本轮的首发记录');
    const hasLaterHistory = gameState.playHistory
      .slice(historyIndex + 1)
      .some(play => play.playerId !== leader.id);
    if (hasLaterHistory) throw new Error('二号位已经出牌，无法发动布什戈门');

    const returnedPhysicalCards = [...(leadingPlay.originalCards || leadingPlay.cards || [])];
    if (returnedPhysicalCards.length === 0) throw new Error('一号位没有可收回的牌');
    returnedPhysicalCards.forEach(card => leader.addCard(card));
    leader.cards = DeckService.autoSortCards(leader.cards);

    gameState.currentRoundPlays = [];
    gameState.leadingPattern = null;
    gameState.currentWinnerIndex = null;
    gameState.playersPlayedThisRound.delete(leaderIndex);
    gameState.currentPlayerIndex = leaderIndex;
    gameState.playHistory.splice(historyIndex, 1);

    const returnedCards = returnedPhysicalCards.map(card => (
      card.toJSON ? card.toJSON() : { ...card }
    ));
    const restriction = {
      round: gameState.currentRound,
      activatorPlayerId: player.id,
      activatorPlayerName: player.name,
      leaderPlayerId: leader.id,
      leaderPlayerName: leader.name,
      forbiddenCardIds: returnedPhysicalCards.map(card => card.id),
      returnedCards
    };
    gameState.bushGateRestriction = restriction;
    const result = {
      ...restriction,
      currentPlayerIndex: leaderIndex,
      remainingCount: leader.cards.length,
      replayCompleted: false,
      activeSkillId: activeSkill.id,
      activeSkillName: activeSkill.name,
      message: `${player.name} 发动布什戈门，${leader.name} 收回首发并须改用其他牌重新合法首发`
    };
    gameState.bushGateLastResult = result;
    this.recordActiveSkillUse(player.id, activeSkill.id);
    this.updateRuleHandVisibilityAfterCardChange(leader);
    logger.info(`房间 ${this.room.id} ${result.message}`);
    return result;
  }

  hasPendingForbiddenMagicDecision() {
    const { gameState } = this.room;
    return Boolean(
      gameState.forbiddenMagicCurrentDecisionPlayerId
      || gameState.forbiddenMagicDecisionQueue.length > 0
    );
  }

  assertForbiddenMagicDecisionComplete() {
    if (!this.hasPendingForbiddenMagicDecision()) return;
    const player = this.room.findPlayerById(
      this.room.gameState.forbiddenMagicCurrentDecisionPlayerId
    );
    throw new Error(`请等待 ${player?.name || '玩家'} 确认是否发动禁术秘法`);
  }

  enqueueForbiddenMagicRoundDecisions() {
    const { gameState } = this.room;
    if (
      !isForbiddenMagicRule(gameState.selectedRule)
      || gameState.phase !== GamePhases.PLAYING
      || gameState.currentRound < 1
    ) return null;

    const alreadyQueued = new Set([
      gameState.forbiddenMagicCurrentDecisionPlayerId,
      ...gameState.forbiddenMagicDecisionQueue
    ].filter(Boolean));
    const candidates = Array.from(gameState.forbiddenMagicReservations.values())
      .filter(reservation => (
        reservation.targetRound <= gameState.currentRound
        && !alreadyQueued.has(reservation.playerId)
        && !gameState.forbiddenMagicActivePlayerIds.has(reservation.playerId)
        && !this.hasUsedActiveSkill(reservation.playerId, ActiveSkillIds.FORBIDDEN_MAGIC)
      ))
      .sort((left, right) => (
        this.room.getPlayerIndex(left.playerId) - this.room.getPlayerIndex(right.playerId)
      ));

    if (candidates.length > 0) {
      gameState.forbiddenMagicDecisionRound = gameState.currentRound;
      gameState.forbiddenMagicDecisionQueue.push(
        ...candidates.map(reservation => reservation.playerId)
      );
    }
    if (!gameState.forbiddenMagicCurrentDecisionPlayerId) {
      return this.promptNextForbiddenMagicDecision();
    }
    this.broadcastRoomUpdate();
    return {
      pending: true,
      round: gameState.forbiddenMagicDecisionRound,
      playerId: gameState.forbiddenMagicCurrentDecisionPlayerId,
      queuedPlayerIds: [...gameState.forbiddenMagicDecisionQueue]
    };
  }

  promptNextForbiddenMagicDecision() {
    const { gameState } = this.room;
    let player = null;
    while (gameState.forbiddenMagicDecisionQueue.length > 0 && !player) {
      const playerId = gameState.forbiddenMagicDecisionQueue.shift();
      const reservation = gameState.forbiddenMagicReservations.get(playerId);
      if (
        reservation
        && reservation.targetRound <= gameState.currentRound
        && !gameState.forbiddenMagicActivePlayerIds.has(playerId)
        && !this.hasUsedActiveSkill(playerId, ActiveSkillIds.FORBIDDEN_MAGIC)
      ) {
        player = this.room.findPlayerById(playerId);
      }
    }

    if (!player) {
      const round = gameState.forbiddenMagicDecisionRound;
      gameState.forbiddenMagicCurrentDecisionPlayerId = null;
      gameState.forbiddenMagicDecisionRound = null;
      if (round !== null) {
        this.io.to(this.room.id).emit('forbidden_magic_decisions_completed', { round });
      }
      this.broadcastRoomUpdate();
      return { pending: false, resolved: true, round };
    }

    gameState.forbiddenMagicCurrentDecisionPlayerId = player.id;
    const payload = {
      round: gameState.forbiddenMagicDecisionRound,
      playerId: player.id,
      playerName: player.name,
      queuedPlayerIds: [...gameState.forbiddenMagicDecisionQueue]
    };
    if (player.socketId) {
      this.io.to(player.socketId).emit('forbidden_magic_decision_required', payload);
    }
    this.io.to(this.room.id).emit('forbidden_magic_decision_pending', {
      round: payload.round,
      playerId: player.id,
      playerName: player.name
    });
    this.broadcastRoomUpdate();
    return { ...payload, pending: true, resolved: false };
  }

  activateForbiddenMagic(playerId) {
    const { gameState } = this.room;
    if (gameState.phase !== GamePhases.PLAYING || !this.roundManager || gameState.currentRound < 1) {
      throw new Error('进入出牌阶段后才能预备禁术秘法');
    }
    const activeSkill = getActiveSkillForRule(gameState.selectedRule);
    if (activeSkill?.id !== ActiveSkillIds.FORBIDDEN_MAGIC) {
      throw new Error('本局没有禁术秘法技能');
    }
    const player = this.room.findPlayerById(playerId);
    if (!player) throw new Error('玩家不存在');
    if (
      this.hasUsedActiveSkill(player.id, activeSkill.id)
      || gameState.forbiddenMagicActivePlayerIds.has(player.id)
    ) {
      throw new Error('禁术秘法每名玩家每局只能发动一次');
    }
    if (gameState.forbiddenMagicReservations.has(player.id)) {
      throw new Error('你已经预备了禁术秘法，请等待轮首确认');
    }

    const isFreshRound = gameState.currentRoundPlays.length === 0
      && gameState.playersPlayedThisRound.size === 0;
    const targetRound = isFreshRound ? gameState.currentRound : gameState.currentRound + 1;
    const reservation = {
      playerId: player.id,
      playerName: player.name,
      targetRound
    };
    gameState.forbiddenMagicReservations.set(player.id, reservation);
    const decision = targetRound === gameState.currentRound
      ? this.enqueueForbiddenMagicRoundDecisions()
      : null;
    logger.info(`房间 ${this.room.id} 玩家 ${player.name} 预备在第${targetRound}轮确认禁术秘法`);
    return {
      id: activeSkill.id,
      name: activeSkill.name,
      ...reservation,
      decisionPending: Boolean(decision?.pending),
      message: `${player.name} 已预备禁术秘法，将在第${targetRound}轮开始时确认`
    };
  }

  respondForbiddenMagic(playerId, accept) {
    const { gameState } = this.room;
    if (gameState.forbiddenMagicCurrentDecisionPlayerId !== playerId) {
      throw new Error('当前没有轮到你确认禁术秘法');
    }
    const reservation = gameState.forbiddenMagicReservations.get(playerId);
    const player = this.room.findPlayerById(playerId);
    if (!reservation || !player) throw new Error('禁术秘法预备状态已失效');

    gameState.forbiddenMagicCurrentDecisionPlayerId = null;
    gameState.forbiddenMagicReservations.delete(playerId);
    if (accept) {
      this.recordActiveSkillUse(player.id, ActiveSkillIds.FORBIDDEN_MAGIC);
      gameState.forbiddenMagicActivePlayerIds.add(player.id);
      logger.info(`房间 ${this.room.id} 玩家 ${player.name} 确认发动禁术秘法，本局永久生效`);
    } else {
      logger.info(`房间 ${this.room.id} 玩家 ${player.name} 暂不发动禁术秘法，保留以后预备机会`);
    }

    const nextDecision = this.promptNextForbiddenMagicDecision();
    return {
      accepted: Boolean(accept),
      resolved: !nextDecision.pending,
      playerId: player.id,
      playerName: player.name,
      round: reservation.targetRound,
      activeSkillId: ActiveSkillIds.FORBIDDEN_MAGIC,
      activeSkillName: '禁术秘法',
      nextPlayerId: nextDecision.playerId || null,
      pendingPlayerIds: [
        gameState.forbiddenMagicCurrentDecisionPlayerId,
        ...gameState.forbiddenMagicDecisionQueue
      ].filter(Boolean)
    };
  }

  hasPendingLureTigerDecision() {
    const { gameState } = this.room;
    return Boolean(
      gameState.lureTigerCurrentDecision
      || gameState.lureTigerDecisionQueue.length > 0
    );
  }

  assertLureTigerDecisionComplete() {
    const decision = this.room.gameState.lureTigerCurrentDecision;
    if (!decision && this.room.gameState.lureTigerDecisionQueue.length === 0) return;
    const player = this.room.findPlayerById(decision?.playerId);
    throw new Error(`请等待 ${player?.name || '玩家'} 完成调虎离山决定`);
  }

  isLureTigerSilenced(playerId) {
    const { gameState } = this.room;
    return Boolean(
      isLureTigerFromMountainRule(gameState.selectedRule)
      && gameState.lureTigerSilencedRound === gameState.currentRound
      && gameState.lureTigerSilencedPlayerIds.has(playerId)
    );
  }

  getLureTigerEligibleTargetIds() {
    const leader = this.room.findPlayerByIndex(this.room.gameState.roundStartPlayerIndex);
    return this.room.players
      .filter(player => player.id !== leader?.id)
      .map(player => player.id);
  }

  getLureTigerRoundOrder() {
    const { gameState } = this.room;
    if (!Number.isInteger(gameState.roundStartPlayerIndex)) {
      return this.room.players.map(player => player.id);
    }
    const indexes = [gameState.roundStartPlayerIndex];
    for (let offset = 1; offset < this.room.players.length; offset += 1) {
      indexes.push(this.roundManager
        ? this.roundManager.getPlayerIndexAtOffset(gameState.roundStartPlayerIndex, offset)
        : (gameState.roundStartPlayerIndex + offset) % this.room.players.length);
    }
    return indexes.map(index => this.room.findPlayerByIndex(index)?.id).filter(Boolean);
  }

  clearLureTigerSilenceForRound(round = this.room.gameState.currentRound) {
    const { gameState } = this.room;
    gameState.lureTigerSilencedPlayerIds.clear();
    gameState.lureTigerSilencedRound = round;
    gameState.lureTigerRoundActivations = [];
  }

  enqueueLureTigerRoundDecisions() {
    const { gameState } = this.room;
    if (
      !isLureTigerFromMountainRule(gameState.selectedRule)
      || gameState.phase !== GamePhases.PLAYING
      || gameState.currentRound < 1
    ) return null;

    if (gameState.lureTigerSilencedRound !== gameState.currentRound) {
      this.clearLureTigerSilenceForRound(gameState.currentRound);
    }
    const alreadyQueued = new Set([
      gameState.lureTigerCurrentDecision?.playerId,
      ...gameState.lureTigerDecisionQueue
    ].filter(Boolean));
    const roundOrder = this.getLureTigerRoundOrder();
    const orderByPlayerId = new Map(roundOrder.map((playerId, index) => [playerId, index]));
    const candidates = Array.from(gameState.lureTigerReservations.values())
      .filter(reservation => {
        const teamIndex = this.getPlayerTeamIndex(reservation.playerId);
        return reservation.targetRound <= gameState.currentRound
          && !alreadyQueued.has(reservation.playerId)
          && teamIndex !== null
          && !gameState.lureTigerUsedTeamIndexes.has(teamIndex);
      })
      .sort((left, right) => (
        (orderByPlayerId.get(left.playerId) ?? Number.MAX_SAFE_INTEGER)
        - (orderByPlayerId.get(right.playerId) ?? Number.MAX_SAFE_INTEGER)
      ));

    gameState.lureTigerDecisionQueue.push(
      ...candidates.map(reservation => reservation.playerId)
    );
    gameState.lureTigerDecisionQueue.sort((leftPlayerId, rightPlayerId) => (
      (orderByPlayerId.get(leftPlayerId) ?? Number.MAX_SAFE_INTEGER)
      - (orderByPlayerId.get(rightPlayerId) ?? Number.MAX_SAFE_INTEGER)
    ));
    if (!gameState.lureTigerCurrentDecision && gameState.lureTigerDecisionQueue.length > 0) {
      return this.promptNextLureTigerDecision(false);
    }
    if (gameState.lureTigerCurrentDecision) {
      this.broadcastRoomUpdate();
      return {
        pending: true,
        ...gameState.lureTigerCurrentDecision,
        queuedPlayerIds: [...gameState.lureTigerDecisionQueue]
      };
    }
    this.broadcastRoomUpdate();
    return null;
  }

  promptNextLureTigerDecision(emitCompletion = true) {
    const { gameState } = this.room;
    let player = null;
    let reservation = null;
    while (gameState.lureTigerDecisionQueue.length > 0 && !player) {
      const playerId = gameState.lureTigerDecisionQueue.shift();
      const candidateReservation = gameState.lureTigerReservations.get(playerId);
      const teamIndex = this.getPlayerTeamIndex(playerId);
      if (
        candidateReservation
        && candidateReservation.targetRound <= gameState.currentRound
        && teamIndex !== null
        && !gameState.lureTigerUsedTeamIndexes.has(teamIndex)
      ) {
        player = this.room.findPlayerById(playerId);
        reservation = candidateReservation;
      } else {
        gameState.lureTigerReservations.delete(playerId);
      }
    }

    if (!player || !reservation) {
      gameState.lureTigerCurrentDecision = null;
      if (emitCompletion) {
        this.io.to(this.room.id).emit('lure_tiger_decisions_completed', {
          round: gameState.currentRound,
          silencedPlayerIds: Array.from(gameState.lureTigerSilencedPlayerIds)
        });
      }
      this.broadcastRoomUpdate();
      return { pending: false, resolved: true, round: gameState.currentRound };
    }

    const teamIndex = this.getPlayerTeamIndex(player.id);
    const decision = {
      round: gameState.currentRound,
      playerId: player.id,
      playerName: player.name,
      teamIndex,
      stage: 'confirm',
      eligibleTargetIds: this.getLureTigerEligibleTargetIds()
    };
    gameState.lureTigerCurrentDecision = decision;
    if (player.socketId) {
      this.io.to(player.socketId).emit('lure_tiger_decision_required', decision);
    }
    this.io.to(this.room.id).emit('lure_tiger_decision_pending', {
      round: decision.round,
      playerId: player.id,
      playerName: player.name,
      stage: decision.stage
    });
    this.broadcastRoomUpdate();
    return {
      ...decision,
      queuedPlayerIds: [...gameState.lureTigerDecisionQueue],
      pending: true,
      resolved: false
    };
  }

  activateLureTiger(playerId) {
    const { gameState } = this.room;
    if (gameState.phase !== GamePhases.PLAYING || !this.roundManager || gameState.currentRound < 1) {
      throw new Error('进入出牌阶段后才能预备调虎离山');
    }
    const activeSkill = getActiveSkillForRule(gameState.selectedRule);
    if (activeSkill?.id !== ActiveSkillIds.LURE_TIGER_FROM_MOUNTAIN) {
      throw new Error('本局没有调虎离山技能');
    }
    const player = this.room.findPlayerById(playerId);
    if (!player) throw new Error('玩家不存在');
    const teamIndex = this.getPlayerTeamIndex(player.id);
    if (teamIndex === null) throw new Error('无法确定玩家阵营');
    if (gameState.lureTigerUsedTeamIndexes.has(teamIndex)) {
      throw new Error('你方阵营本局已经发动过调虎离山');
    }
    if (gameState.lureTigerReservations.has(player.id)) {
      throw new Error('你已经预备了调虎离山，请等待轮首确认');
    }

    const isFreshRound = gameState.currentRoundPlays.length === 0
      && gameState.playersPlayedThisRound.size === 0;
    const targetRound = isFreshRound ? gameState.currentRound : gameState.currentRound + 1;
    const reservation = {
      playerId: player.id,
      playerName: player.name,
      teamIndex,
      targetRound
    };
    gameState.lureTigerReservations.set(player.id, reservation);
    const decision = targetRound === gameState.currentRound
      ? this.enqueueLureTigerRoundDecisions()
      : null;
    logger.info(`房间 ${this.room.id} 玩家 ${player.name} 预备在第${targetRound}轮确认调虎离山`);
    return {
      id: activeSkill.id,
      name: activeSkill.name,
      ...reservation,
      decisionPending: Boolean(decision?.pending),
      message: `${player.name} 已预备调虎离山，将在第${targetRound}轮开始时确认`
    };
  }

  respondLureTiger(playerId, accept) {
    const { gameState } = this.room;
    const decision = gameState.lureTigerCurrentDecision;
    if (decision?.playerId !== playerId || decision.stage !== 'confirm') {
      throw new Error('当前没有轮到你确认调虎离山');
    }
    const reservation = gameState.lureTigerReservations.get(playerId);
    const player = this.room.findPlayerById(playerId);
    if (!reservation || !player) throw new Error('调虎离山预备状态已失效');

    if (!accept) {
      gameState.lureTigerCurrentDecision = null;
      gameState.lureTigerReservations.delete(playerId);
      const nextDecision = this.promptNextLureTigerDecision(true);
      logger.info(`房间 ${this.room.id} 玩家 ${player.name} 暂不发动调虎离山`);
      return {
        accepted: false,
        needsTarget: false,
        resolved: !nextDecision.pending,
        playerId: player.id,
        playerName: player.name,
        round: decision.round,
        activeSkillId: ActiveSkillIds.LURE_TIGER_FROM_MOUNTAIN,
        activeSkillName: '调虎离山',
        nextPlayerId: nextDecision.playerId || null
      };
    }

    gameState.lureTigerCurrentDecision = {
      ...decision,
      stage: 'target',
      eligibleTargetIds: this.getLureTigerEligibleTargetIds()
    };
    const targetPayload = { ...gameState.lureTigerCurrentDecision };
    if (player.socketId) {
      this.io.to(player.socketId).emit('lure_tiger_target_required', targetPayload);
    }
    this.io.to(this.room.id).emit('lure_tiger_decision_pending', {
      round: decision.round,
      playerId: player.id,
      playerName: player.name,
      stage: 'target'
    });
    this.broadcastRoomUpdate();
    return {
      accepted: true,
      needsTarget: true,
      resolved: false,
      ...targetPayload,
      activeSkillId: ActiveSkillIds.LURE_TIGER_FROM_MOUNTAIN,
      activeSkillName: '调虎离山'
    };
  }

  selectLureTigerTarget(playerId, targetPlayerId) {
    const { gameState } = this.room;
    const decision = gameState.lureTigerCurrentDecision;
    if (decision?.playerId !== playerId || decision.stage !== 'target') {
      throw new Error('当前没有轮到你选择调虎离山目标');
    }
    if (!decision.eligibleTargetIds.includes(targetPlayerId)) {
      throw new Error('调虎离山只能指定本轮非一号位玩家');
    }
    const player = this.room.findPlayerById(playerId);
    const target = this.room.findPlayerById(targetPlayerId);
    if (!player || !target) throw new Error('玩家不存在');
    const teamIndex = this.getPlayerTeamIndex(player.id);
    if (teamIndex === null || gameState.lureTigerUsedTeamIndexes.has(teamIndex)) {
      throw new Error('你方阵营本局已经发动过调虎离山');
    }

    gameState.lureTigerUsedTeamIndexes.add(teamIndex);
    gameState.lureTigerSilencedRound = gameState.currentRound;
    gameState.lureTigerSilencedPlayerIds.add(target.id);
    const activation = {
      round: gameState.currentRound,
      teamIndex,
      playerId: player.id,
      playerName: player.name,
      targetPlayerId: target.id,
      targetPlayerName: target.name
    };
    gameState.lureTigerRoundActivations.push(activation);
    this.recordActiveSkillUse(player.id, ActiveSkillIds.LURE_TIGER_FROM_MOUNTAIN);
    gameState.lureTigerCurrentDecision = null;

    for (const [reservedPlayerId] of gameState.lureTigerReservations) {
      if (this.getPlayerTeamIndex(reservedPlayerId) === teamIndex) {
        gameState.lureTigerReservations.delete(reservedPlayerId);
      }
    }
    gameState.lureTigerDecisionQueue = gameState.lureTigerDecisionQueue.filter(
      queuedPlayerId => this.getPlayerTeamIndex(queuedPlayerId) !== teamIndex
    );
    const nextDecision = this.promptNextLureTigerDecision(true);
    logger.info(`房间 ${this.room.id} ${player.name} 发动调虎离山，沉默 ${target.name}`);
    return {
      ...activation,
      accepted: true,
      resolved: !nextDecision.pending,
      nextPlayerId: nextDecision.playerId || null,
      activeSkillId: ActiveSkillIds.LURE_TIGER_FROM_MOUNTAIN,
      activeSkillName: '调虎离山',
      silencedPlayerIds: Array.from(gameState.lureTigerSilencedPlayerIds)
    };
  }

  prepareMagicTrick(playerId, targetPlayerIds) {
    const { gameState } = this.room;
    if (gameState.phase !== GamePhases.PLAYING || gameState.playMode !== PlayModes.ORDERED) {
      throw new Error('当前不是有序出牌阶段');
    }
    const activeSkill = getActiveSkillForRule(gameState.selectedRule);
    if (activeSkill?.id !== ActiveSkillIds.MAGIC_TRICK) {
      throw new Error('本局没有魔术戏法技能');
    }
    if (this.hasUsedActiveSkill(playerId, activeSkill.id)) {
      throw new Error('魔术戏法每名玩家每局只能发动一次');
    }
    if (gameState.magicTrickSelection) {
      throw new Error('本轮已经暗中准备了魔术戏法');
    }

    const player = this.room.findPlayerById(playerId);
    const playerIndex = this.room.getPlayerIndex(playerId);
    if (!player) throw new Error('玩家不存在');
    if (playerIndex !== gameState.currentPlayerIndex) throw new Error('现在还没有轮到你出牌');
    if (
      gameState.currentRoundPlays.length !== 0
      || gameState.playersPlayedThisRound.size !== 0
      || playerIndex !== gameState.roundStartPlayerIndex
    ) {
      throw new Error('魔术戏法只能由本轮一号位在出牌前发动');
    }

    const targets = Array.isArray(targetPlayerIds) ? [...new Set(targetPlayerIds)] : [];
    if (targets.length !== 2) throw new Error('必须选择两名不同的玩家');
    if (targets.includes(player.id)) throw new Error('魔术戏法不能选择自己');
    const targetPlayers = targets.map(targetId => this.room.findPlayerById(targetId));
    if (targetPlayers.some(target => !target)) throw new Error('所选玩家不存在');

    gameState.magicTrickSelection = {
      round: gameState.currentRound,
      playerId: player.id,
      targetPlayerIds: targets
    };
    logger.info(`房间 ${this.room.id} ${player.name} 暗中准备魔术戏法`);
    return {
      round: gameState.currentRound,
      playerId: player.id,
      playerName: player.name,
      targetPlayerIds: targets,
      targetPlayerNames: targetPlayers.map(target => target.name),
      activeSkillId: activeSkill.id,
      activeSkillName: activeSkill.name
    };
  }

  hasPendingEquivalentReciprocityChallenge() {
    return Boolean(this.room.gameState.equivalentReciprocityChallenge);
  }

  startEquivalentReciprocity(initiatorPlayerId, targetPlayerId) {
    const { gameState } = this.room;
    if (gameState.phase !== GamePhases.PLAYING || gameState.playMode !== PlayModes.ORDERED) {
      throw new Error('当前不是有序出牌阶段');
    }

    const activeSkill = getActiveSkillForRule(gameState.selectedRule);
    if (activeSkill?.id !== ActiveSkillIds.EQUIVALENT_RECIPROCITY) {
      throw new Error('本局没有等价互惠技能');
    }
    if (this.hasUsedActiveSkill(initiatorPlayerId, activeSkill.id)) {
      throw new Error('等价互惠每名玩家每局只能发动一次');
    }
    if (gameState.equivalentReciprocityChallenge) {
      throw new Error('当前已有一组玩家正在拼点');
    }

    const initiator = this.room.findPlayerById(initiatorPlayerId);
    const target = this.room.findPlayerById(targetPlayerId);
    if (!initiator || !target) throw new Error('玩家不存在');
    if (initiator.id === target.id) throw new Error('不能与自己拼点');
    if (initiator.cards.length === 0 || target.cards.length === 0) {
      throw new Error('双方都必须至少有一张手牌才能拼点');
    }

    const initiatorIndex = this.room.getPlayerIndex(initiator.id);
    if (initiatorIndex !== gameState.currentPlayerIndex) {
      throw new Error('现在还没有轮到你出牌');
    }
    if (
      gameState.currentRoundPlays.length !== 0
      || gameState.playersPlayedThisRound.size !== 0
      || initiatorIndex !== gameState.roundStartPlayerIndex
    ) {
      throw new Error('等价互惠只能由本轮一号位在出牌前发动');
    }

    const challenge = {
      id: `equivalent-${gameState.currentRound}-${initiator.id}-${Date.now()}`,
      initiatorPlayerId: initiator.id,
      targetPlayerId: target.id,
      selectedCardsByPlayerId: new Map()
    };
    gameState.equivalentReciprocityChallenge = challenge;
    this.recordActiveSkillUse(initiator.id, activeSkill.id);

    logger.info(`房间 ${this.room.id} ${initiator.name} 发动等价互惠，邀请 ${target.name} 拼点`);
    return {
      challengeId: challenge.id,
      initiatorPlayerId: initiator.id,
      initiatorPlayerName: initiator.name,
      targetPlayerId: target.id,
      targetPlayerName: target.name,
      participantPlayerIds: [initiator.id, target.id],
      activeSkillId: activeSkill.id,
      activeSkillName: activeSkill.name
    };
  }

  selectEquivalentReciprocityCardForBot(playerId) {
    const player = this.room.findPlayerById(playerId);
    if (!player?.isBot || player.cards.length === 0) return null;
    const { trumpSuit, trumpRank, selectedRule } = this.room.gameState;
    return [...player.cards].sort((left, right) => (
      getCardStrength(right, trumpSuit, trumpRank, selectedRule)
      - getCardStrength(left, trumpSuit, trumpRank, selectedRule)
    ))[0];
  }

  submitEquivalentReciprocityCard(playerId, challengeId, cardId) {
    const { gameState } = this.room;
    const challenge = gameState.equivalentReciprocityChallenge;
    if (!challenge || challenge.id !== challengeId) {
      throw new Error('这次拼点已经结束或不存在');
    }
    if (![challenge.initiatorPlayerId, challenge.targetPlayerId].includes(playerId)) {
      throw new Error('你不是本次拼点参与者');
    }
    if (challenge.selectedCardsByPlayerId.has(playerId)) {
      throw new Error('你已经提交过拼点牌');
    }

    const player = this.room.findPlayerById(playerId);
    const selectedCard = player?.cards.find(card => card.id === cardId);
    if (!selectedCard) throw new Error('选择的拼点牌已不在手中');
    challenge.selectedCardsByPlayerId.set(playerId, selectedCard);

    const selectionResult = {
      resolved: false,
      challengeId: challenge.id,
      playerId: player.id,
      playerName: player.name,
      selectedPlayerIds: Array.from(challenge.selectedCardsByPlayerId.keys())
    };
    if (challenge.selectedCardsByPlayerId.size < 2) {
      return selectionResult;
    }

    const initiator = this.room.findPlayerById(challenge.initiatorPlayerId);
    const target = this.room.findPlayerById(challenge.targetPlayerId);
    const initiatorCard = challenge.selectedCardsByPlayerId.get(initiator.id);
    const targetCard = challenge.selectedCardsByPlayerId.get(target.id);
    const { trumpSuit, trumpRank, selectedRule } = gameState;
    const initiatorStrength = getCardStrength(initiatorCard, trumpSuit, trumpRank, selectedRule);
    const targetStrength = getCardStrength(targetCard, trumpSuit, trumpRank, selectedRule);
    const isTie = initiatorStrength === targetStrength;
    const winner = isTie ? null : (initiatorStrength > targetStrength ? initiator : target);
    const loser = isTie ? null : (winner.id === initiator.id ? target : initiator);

    let attackerScoreDelta = 0;
    if (loser) {
      const loserIndex = this.room.getPlayerIndex(loser.id);
      attackerScoreDelta = this.isAttackerPlayerIndex(
        loserIndex,
        gameState.dealerPlayerIndex
      ) ? -5 : 5;
      gameState.attackerScore += attackerScoreDelta;
    }

    // 先同时移除双方拼点牌，再交叉加入对方手牌，保证交换不受处理顺序影响。
    initiator.removeCards([initiatorCard.id]);
    target.removeCards([targetCard.id]);
    initiator.addCard(targetCard);
    target.addCard(initiatorCard);
    initiator.cards = DeckService.autoSortCards(initiator.cards);
    target.cards = DeckService.autoSortCards(target.cards);
    gameState.equivalentReciprocityChallenge = null;

    const result = {
      ...selectionResult,
      resolved: true,
      initiatorPlayerId: initiator.id,
      initiatorPlayerName: initiator.name,
      targetPlayerId: target.id,
      targetPlayerName: target.name,
      cards: [
        { playerId: initiator.id, playerName: initiator.name, card: initiatorCard.toJSON() },
        { playerId: target.id, playerName: target.name, card: targetCard.toJSON() }
      ],
      isTie,
      winnerPlayerId: winner?.id || null,
      winnerPlayerName: winner?.name || null,
      loserPlayerId: loser?.id || null,
      loserPlayerName: loser?.name || null,
      attackerScoreDelta,
      attackerScore: gameState.attackerScore,
      animationDuration: EQUIVALENT_RECIPROCITY_ANIMATION_MS,
      hands: [initiator, target].map(handOwner => ({
        playerId: handOwner.id,
        cards: handOwner.cards.map(card => card.toJSON())
      }))
    };
    logger.info(
      `房间 ${this.room.id} 等价互惠拼点完成：${initiator.name} ${initiatorCard.rank} vs `
      + `${target.name} ${targetCard.rank}，${isTie ? '平局' : `${loser.name}一方失去5分`}`
    );
    return result;
  }

  hasPendingMutualSupportAction() {
    return Boolean(this.room.gameState.mutualSupportPendingAction);
  }

  getMutualSupportTeammate(playerId) {
    const playerIndex = this.room.getPlayerIndex(playerId);
    if (playerIndex < 0 || this.room.players.length !== 4) return null;
    return this.room.findPlayerByIndex((playerIndex + 2) % this.room.players.length);
  }

  getMutualSupportOwedCount(playerId, round = this.room.gameState.currentRound) {
    return this.room.gameState.mutualSupportRoundTransfers
      .filter(transfer => transfer.round === round && transfer.receiverPlayerId === playerId)
      .reduce((total, transfer) => total + transfer.count, 0);
  }

  getMutualSupportTransferCapacity(playerId) {
    const { gameState } = this.room;
    const player = this.room.findPlayerById(playerId);
    if (!player) return 0;
    const playerIndex = this.room.getPlayerIndex(playerId);
    const stillNeedsToPlay = !gameState.playersPlayedThisRound.has(playerIndex);
    const requiredForPlay = stillNeedsToPlay
      ? (gameState.leadingPattern?.length || 1)
      : 0;
    const owedAtRoundEnd = this.getMutualSupportOwedCount(playerId);
    return Math.max(0, player.cards.length - requiredForPlay - owedAtRoundEnd);
  }

  createMutualSupportTransfer(fromPlayer, toPlayer, cardIds, { round, stage }) {
    const uniqueCardIds = Array.isArray(cardIds) ? [...new Set(cardIds)] : [];
    if (uniqueCardIds.length !== (cardIds?.length || 0)) {
      throw new Error('不能重复选择同一张牌');
    }
    const cards = uniqueCardIds.map(cardId => (
      fromPlayer.cards.find(card => card.id === cardId)
    ));
    if (cards.some(card => !card)) throw new Error('选择的牌已不在手中');

    fromPlayer.removeCards(uniqueCardIds);
    cards.forEach(card => toPlayer.addCard(card));
    fromPlayer.cards = DeckService.autoSortCards(fromPlayer.cards);
    toPlayer.cards = DeckService.autoSortCards(toPlayer.cards);

    return {
      round,
      stage,
      fromPlayerId: fromPlayer.id,
      fromPlayerName: fromPlayer.name,
      toPlayerId: toPlayer.id,
      toPlayerName: toPlayer.name,
      cardsCount: cards.length,
      animationDuration: MUTUAL_SUPPORT_ANIMATION_MS,
      hands: [fromPlayer, toPlayer].map(player => ({
        playerId: player.id,
        cards: player.cards.map(card => card.toJSON())
      }))
    };
  }

  recordMutualSupportRoundTransfer({ round, giverPlayerId, receiverPlayerId, count }) {
    if (count <= 0) return null;
    const transfer = {
      id: `mutual-transfer-${round}-${giverPlayerId}-${receiverPlayerId}-${Date.now()}-`
        + `${this.room.gameState.mutualSupportRoundTransfers.length}`,
      round,
      giverPlayerId,
      receiverPlayerId,
      count
    };
    this.room.gameState.mutualSupportRoundTransfers.push(transfer);
    return transfer;
  }

  activateMutualSupport(playerId, direction, cardIds = []) {
    const { gameState } = this.room;
    if (gameState.phase !== GamePhases.PLAYING || gameState.playMode !== PlayModes.ORDERED) {
      throw new Error('当前不是有序出牌阶段');
    }
    if (!isMutualSupportRule(gameState.selectedRule)) {
      throw new Error('本局没有同舟共济技能');
    }
    const activeSkill = getActiveSkillForRule(gameState.selectedRule);
    if (activeSkill?.id !== ActiveSkillIds.MUTUAL_SUPPORT) {
      throw new Error('本局没有同舟共济技能');
    }
    if (this.hasUsedActiveSkill(playerId, activeSkill.id)) {
      throw new Error('同舟共济每名玩家每局只能发动一次');
    }
    if (this.hasPendingStrawBoatBorrowingArrowsDecision()) {
      throw new Error('请先完成草船借箭');
    }
    if (this.hasPendingMutualSupportAction()) {
      throw new Error('请先完成当前的同舟共济交牌');
    }

    const player = this.room.findPlayerById(playerId);
    const teammate = this.getMutualSupportTeammate(playerId);
    if (!player || !teammate) throw new Error('玩家或队友不存在');
    const playerIndex = this.room.getPlayerIndex(playerId);
    if (playerIndex !== gameState.currentPlayerIndex) {
      throw new Error('现在还没有轮到你出牌');
    }
    if (gameState.playersPlayedThisRound.has(playerIndex)) {
      throw new Error('本轮已经出过牌，不能再发动同舟共济');
    }
    if (!['request', 'give'].includes(direction)) {
      throw new Error('请选择向队友要牌或给队友牌');
    }

    const actionId = `mutual-${gameState.currentRound}-${player.id}-${Date.now()}`;

    if (direction === 'request') {
      const maxCards = Math.min(2, this.getMutualSupportTransferCapacity(teammate.id));
      this.recordActiveSkillUse(player.id, activeSkill.id);
      gameState.mutualSupportPendingAction = {
        id: actionId,
        stage: 'request',
        round: gameState.currentRound,
        initiatorPlayerId: player.id,
        chooserPlayerId: teammate.id,
        otherPlayerId: player.id,
        fromPlayerId: teammate.id,
        toPlayerId: player.id,
        minCards: 0,
        maxCards
      };
      logger.info(`房间 ${this.room.id} ${player.name} 发动同舟共济，向队友 ${teammate.name} 请求0至${maxCards}张牌`);
      return {
        resolved: false,
        pending: true,
        actionId,
        round: gameState.currentRound,
        direction,
        initiatorPlayerId: player.id,
        initiatorPlayerName: player.name,
        teammatePlayerId: teammate.id,
        teammatePlayerName: teammate.name,
        chooserPlayerId: teammate.id,
        minCards: 0,
        maxCards,
        activeSkillId: activeSkill.id,
        activeSkillName: activeSkill.name
      };
    }

    const uniqueCardIds = Array.isArray(cardIds) ? [...new Set(cardIds)] : [];
    if (uniqueCardIds.length < 1 || uniqueCardIds.length > 2) {
      throw new Error('请选择1至2张牌交给队友');
    }
    const capacity = Math.min(2, this.getMutualSupportTransferCapacity(player.id));
    if (uniqueCardIds.length > capacity) {
      throw new Error('必须保留本轮出牌和轮末返还所需的手牌');
    }
    let transfer;
    try {
      transfer = this.createMutualSupportTransfer(player, teammate, uniqueCardIds, {
        round: gameState.currentRound,
        stage: 'initial'
      });
    } catch (error) {
      throw error;
    }
    this.recordActiveSkillUse(player.id, activeSkill.id);
    this.recordMutualSupportRoundTransfer({
      round: gameState.currentRound,
      giverPlayerId: player.id,
      receiverPlayerId: teammate.id,
      count: transfer.cardsCount
    });
    logger.info(`房间 ${this.room.id} ${player.name} 发动同舟共济，交给 ${teammate.name} ${transfer.cardsCount}张牌`);
    return {
      resolved: true,
      pending: false,
      actionId,
      round: gameState.currentRound,
      direction,
      initiatorPlayerId: player.id,
      initiatorPlayerName: player.name,
      teammatePlayerId: teammate.id,
      teammatePlayerName: teammate.name,
      activeSkillId: activeSkill.id,
      activeSkillName: activeSkill.name,
      transfer
    };
  }

  beginNextMutualSupportReturn() {
    const { gameState } = this.room;
    const due = gameState.mutualSupportReturnQueue.shift();
    if (!due) {
      gameState.mutualSupportPendingAction = null;
      return null;
    }
    gameState.mutualSupportPendingAction = {
      id: `mutual-return-${due.id}`,
      stage: 'return',
      round: due.round,
      chooserPlayerId: due.receiverPlayerId,
      otherPlayerId: due.giverPlayerId,
      fromPlayerId: due.receiverPlayerId,
      toPlayerId: due.giverPlayerId,
      minCards: due.count,
      maxCards: due.count,
      requiredCards: due.count,
      transferId: due.id
    };
    return gameState.mutualSupportPendingAction;
  }

  prepareMutualSupportReturnsAtRoundEnd(completedRound) {
    const { gameState } = this.room;
    if (!isMutualSupportRule(gameState.selectedRule)) return null;
    const dueTransfers = gameState.mutualSupportRoundTransfers.filter(
      transfer => transfer.round === completedRound
    );
    gameState.mutualSupportRoundTransfers = gameState.mutualSupportRoundTransfers.filter(
      transfer => transfer.round !== completedRound
    );
    if (dueTransfers.length === 0) return null;
    gameState.mutualSupportReturnQueue.push(...dueTransfers);
    return this.beginNextMutualSupportReturn();
  }

  selectMutualSupportCardsForBot(playerId) {
    const { gameState } = this.room;
    const action = gameState.mutualSupportPendingAction;
    const player = this.room.findPlayerById(playerId);
    if (!action || !player?.isBot || action.chooserPlayerId !== playerId) return [];
    const count = action.stage === 'return'
      ? action.requiredCards
      : Math.min(action.maxCards, 2);
    const { trumpSuit, trumpRank, selectedRule } = gameState;
    return [...player.cards]
      .sort((left, right) => (
        getCardStrength(left, trumpSuit, trumpRank, selectedRule)
        - getCardStrength(right, trumpSuit, trumpRank, selectedRule)
      ))
      .slice(0, count)
      .map(card => card.id);
  }

  submitMutualSupportCards(playerId, actionId, cardIds = []) {
    const { gameState } = this.room;
    const action = gameState.mutualSupportPendingAction;
    if (!action || action.id !== actionId) {
      throw new Error('这次同舟共济交牌已经结束或不存在');
    }
    if (action.chooserPlayerId !== playerId) {
      throw new Error('当前不需要你选择同舟共济的牌');
    }
    const uniqueCardIds = Array.isArray(cardIds) ? [...new Set(cardIds)] : [];
    if (uniqueCardIds.length !== (cardIds?.length || 0)) {
      throw new Error('不能重复选择同一张牌');
    }
    if (uniqueCardIds.length < action.minCards || uniqueCardIds.length > action.maxCards) {
      throw new Error(
        action.minCards === action.maxCards
          ? `必须选择${action.minCards}张牌`
          : `请选择${action.minCards}至${action.maxCards}张牌`
      );
    }
    if (
      action.stage === 'request'
      && uniqueCardIds.length > this.getMutualSupportTransferCapacity(playerId)
    ) {
      throw new Error('必须保留本轮出牌和轮末返还所需的手牌');
    }

    const fromPlayer = this.room.findPlayerById(action.fromPlayerId);
    const toPlayer = this.room.findPlayerById(action.toPlayerId);
    if (!fromPlayer || !toPlayer) throw new Error('交牌玩家不存在');
    const transfer = this.createMutualSupportTransfer(fromPlayer, toPlayer, uniqueCardIds, {
      round: action.round,
      stage: action.stage
    });

    if (action.stage === 'request' && transfer.cardsCount > 0) {
      this.recordMutualSupportRoundTransfer({
        round: action.round,
        giverPlayerId: fromPlayer.id,
        receiverPlayerId: toPlayer.id,
        count: transfer.cardsCount
      });
    }

    const completedStage = action.stage;
    gameState.mutualSupportPendingAction = null;
    const nextAction = completedStage === 'return'
      ? this.beginNextMutualSupportReturn()
      : null;
    const gameFinished = completedStage === 'return'
      && !nextAction
      && this.room.players.every(player => this.getPlayableCardCount(player) === 0);
    if (gameFinished) this.finishGame();

    logger.info(
      `房间 ${this.room.id} 同舟共济${completedStage === 'return' ? '轮末返还' : '请求交牌'}完成：`
      + `${fromPlayer.name} 交给 ${toPlayer.name} ${transfer.cardsCount}张牌`
    );
    return {
      resolved: true,
      actionId,
      round: action.round,
      stage: completedStage,
      chooserPlayerId: playerId,
      transfer,
      nextAction,
      allReturnsCompleted: completedStage === 'return' && !nextAction,
      gameFinished
    };
  }

  validateActiveSkillPlay(player, activeSkillId, cards, isLeading) {
    const activeSkill = getActiveSkillForRule(this.room.gameState.selectedRule);
    if (!activeSkill || activeSkill.id !== activeSkillId) {
      throw new Error('本局没有这个主动技能');
    }
    if (![
      ActiveSkillIds.SUBSTITUTE_SACRIFICE,
      ActiveSkillIds.CONCEALED_PASSAGE,
      ActiveSkillIds.STEALING_BEAMS,
      ActiveSkillIds.BELT_AND_ROAD,
      ActiveSkillIds.DIVINE_WEAPON,
      ActiveSkillIds.CLUSTER_ANALYSIS,
      ActiveSkillIds.ILLUSION_AND_REALITY,
      ActiveSkillIds.AMBIGUOUS
    ].includes(activeSkill.id)) {
      throw new Error('暂不支持这个主动技能');
    }
    const priorAmbiguousPlay = activeSkill.id === ActiveSkillIds.AMBIGUOUS
      && this.room.gameState.currentRoundPlays.some(
        play => play.activeSkillId === ActiveSkillIds.AMBIGUOUS
      );
    if (
      activeSkill.usageLimit !== null
      && this.hasUsedActiveSkill(player.id, activeSkill.id)
      && !priorAmbiguousPlay
    ) {
      throw new Error(`${activeSkill.name}每名玩家每局只能发动一次`);
    }
    if (activeSkill.timing === 'following_play' && isLeading) {
      throw new Error(`${activeSkill.name}只能在跟牌时发动`);
    }
    if (activeSkill.timing === 'leading_play' && !isLeading) {
      throw new Error(`${activeSkill.name}只能在首发时发动`);
    }
    if (
      activeSkill.timing === 'middle_positions_play'
      && ![1, 2].includes(this.room.gameState.currentRoundPlays.length)
    ) {
      throw new Error(`${activeSkill.name}只能由本轮二号位或三号位发动`);
    }
    if (!isLeading) {
      const requiredCount = this.room.gameState.leadingPattern?.length || 0;
      if (cards.length !== requiredCount) {
        throw new Error(`发动${activeSkill.name}仍须出${requiredCount}张牌`);
      }
    }
    return activeSkill;
  }

  selectBotCardsToBury(player, requiredCount = this.room.gameState.bottomCardsCount) {
    const { trumpSuit, trumpRank, selectedRule, bottomCardsCount } = this.room.gameState;
    if (shouldUseWhoDesignedStrategy(this.room)) {
      return chooseWhoDesignedCardsToBury(
        player.cards,
        requiredCount,
        trumpSuit,
        trumpRank
      );
    }

    return [...player.cards]
      .sort((a, b) => {
        const aTrump = isTrumpCard(a, trumpSuit, trumpRank) ? 1 : 0;
        const bTrump = isTrumpCard(b, trumpSuit, trumpRank) ? 1 : 0;
        if (aTrump !== bTrump) return aTrump - bTrump;

        const pointDiff = getCardPoints(a) - getCardPoints(b);
        if (pointDiff !== 0) return pointDiff;

        return getCardStrength(a, trumpSuit, trumpRank, selectedRule) -
          getCardStrength(b, trumpSuit, trumpRank, selectedRule);
      })
      .slice(0, requiredCount);
  }

  announceBuryResult(actor, result) {
    this.io.to(this.room.id).emit('cards_buried', {
      playerId: actor.id,
      playerName: actor.name,
      skipped: result.skipped,
      isSecondary: result.isSecondary,
      completed: result.completed,
      peopleCommune: Boolean(result.peopleCommune),
      submittedCount: result.submittedCount ?? null,
      totalCount: result.totalCount ?? null
    });

    if (!result.completed) {
      const secondaryPlayer = result.secondaryBuryingPlayer;
      this.io.to(this.room.id).emit('secondary_burying_started', {
        ruleName: '改革开放',
        dealerPlayerId: result.dealer.id,
        dealerPlayerName: result.dealer.name,
        secondaryPlayerId: secondaryPlayer.id,
        secondaryPlayerName: secondaryPlayer.name,
        cardsCount: result.transferredCards.length,
        animationDuration: SECONDARY_BURY_ANIMATION_MS
      });
      if (!secondaryPlayer.isBot) {
        this.io.to(secondaryPlayer.socketId).emit('secondary_bottom_cards_received', {
          bottomCards: result.transferredCards.map(card => card.toJSON()),
          totalCards: secondaryPlayer.cards.length
        });
      }
      this.broadcastRoomUpdate();

      if (secondaryPlayer.isBot) {
        if (this.secondaryBuryTimer) clearTimeout(this.secondaryBuryTimer);
        this.secondaryBuryTimer = setTimeout(() => {
          try {
            const cardsToBury = this.selectBotCardsToBury(secondaryPlayer);
            this.buryCards(secondaryPlayer.id, cardsToBury.map(card => card.id));
          } catch (error) {
            logger.error(`Bot庄家队友 ${secondaryPlayer.name} 自动再埋底失败:`, error);
          } finally {
            this.secondaryBuryTimer = null;
          }
        }, 500);
      }
      return;
    }

    const firstPlayer = result.firstPlayer;
    this.io.to(this.room.id).emit('first_player_set', {
      playerId: firstPlayer.id,
      playerName: firstPlayer.name,
      currentPlayerIndex: this.room.gameState.currentPlayerIndex
    });
    this.io.to(this.room.id).emit('phase_changed', {
      phase: GamePhases.PLAYING,
      message: result.isSecondary
        ? `${actor.name} 完成再埋底，${firstPlayer.name} 先出牌`
        : result.peopleCommune
          ? `人民公社四家埋底完成，${firstPlayer.name} 先出牌`
        : result.skipped
          ? `本局没有底牌，${firstPlayer.name} 先出牌`
          : `埋底完成，${firstPlayer.name} 先出牌`
    });
    this.broadcastRoomUpdate();
    // 埋底本身也是一次手牌变化。绝处逢生的首轮检查必须放在埋底完成后，
    // 此时主牌已锁定且不会让庄家在埋底前提前获得额外信息。
    this.room.players.forEach(player => this.requestLastStandIfEligible(player));
    this.beginOpeningAfterglowDecision(firstPlayer);
    if (
      !this.hasPendingLastStandDecision() &&
      !this.hasPendingAfterglowDecision() &&
      !this.hasPendingFocusFigureVote() &&
      !this.hasPendingCandleSelection() &&
      !this.hasPendingWoodenOxDecision() &&
      !this.hasPendingRiceToMulberrySelection() &&
      this.onBotTurn
    ) this.onBotTurn();
  }

  /**
   * Bot成为庄家时自动完成埋底，并进入正常出牌流程。
   */
  handleDealerAssigned(dealer) {
    if (!dealer) return;

    // 已触发二鬼拍门的庄家收到底牌后，新加入手中的王也属于明置手牌。
    if (isTwoGhostsKnockDoorRule(this.room.gameState.selectedRule)) {
      this.updateRuleHandVisibilityAfterCardChange(dealer);
    }

    if (isAdministrativeReviewRule(this.room.gameState.selectedRule)) {
      this.startAdministrativeReview(dealer);
      return;
    }

    if (isPeopleCommuneRule(this.room.gameState.selectedRule)) {
      const currentPlayer = this.room.findPlayerById(
        this.room.gameState.peopleCommuneCurrentBuryingPlayerId
      );
      this.schedulePeopleCommuneBotBury(currentPlayer);
      return;
    }

    const requiredCount = this.room.gameState.bottomCardsCount;
    if (requiredCount === 0) {
      this.buryCards(dealer.id, []);
      return;
    }

    if (!dealer.isBot) return;

    if (this.botActionTimer) clearTimeout(this.botActionTimer);
    this.botActionTimer = setTimeout(() => {
      try {
        const cardsToBury = this.selectBotCardsToBury(dealer);
        this.buryCards(dealer.id, cardsToBury.map(card => card.id));
      } catch (error) {
        logger.error(`Bot庄家 ${dealer.name} 自动埋底失败:`, error);
      } finally {
        this.botActionTimer = null;
      }
    }, 500);
  }

  /** “算无遗策”：埋底结束、正式开始出牌时公开庄家对家的手牌。 */
  activatePerfectStrategy(dealer) {
    if (!isPerfectStrategyRule(this.room.gameState.selectedRule)) return null;

    const dealerIndex = this.room.getPlayerIndex(dealer.id);
    if (dealerIndex < 0 || this.room.players.length !== 4) {
      throw new Error('算无遗策仅支持四人局');
    }

    const openHandPlayer = this.room.findPlayerByIndex((dealerIndex + 2) % 4);
    this.room.gameState.openHandPlayerId = openHandPlayer.id;
    this.room.gameState.openHandControllerPlayerId = dealer.id;

    this.io.to(this.room.id).emit('open_hand_revealed', {
      playerId: openHandPlayer.id,
      playerName: openHandPlayer.name,
      controllerPlayerId: dealer.id,
      controllerPlayerName: dealer.name,
      cards: openHandPlayer.cards.map(card => card.toJSON())
    });
    this.broadcastRoomUpdate();
    logger.info(`房间 ${this.room.id} 算无遗策：${openHandPlayer.name} 明手，由 ${dealer.name} 代打`);
    return openHandPlayer;
  }

  /** 正式进入出牌阶段后启动本局的其他手牌可见性规则。 */
  activateRuleHandVisibility() {
    const { gameState, players } = this.room;
    gameState.icebergRevealedCardIdsByPlayer.clear();
    gameState.icebergPendingPlayerIds.clear();
    this.icebergSelectionRequests.clear();
    this.icebergInitialSelectionActive = false;
    gameState.areAllHandsRevealed = false;

    if (isTwoGhostsKnockDoorRule(gameState.selectedRule)) {
      this.emitRuleVisibleHands();
      return true;
    }

    if (isIcebergTipRule(gameState.selectedRule)) {
      this.icebergInitialSelectionActive = true;
      players.forEach(player => this.prepareIcebergRevealSelection(player, 'initial'));
      if (!this.hasPendingIcebergSelection()) {
        this.icebergInitialSelectionActive = false;
        this.emitRuleVisibleHands('冰山一角：每名玩家已自行选择两张明牌');
      }
      return true;
    }
    if (isMutualVisibilityRule(gameState.selectedRule)) {
      this.emitRuleVisibleHands('互通有无：你现在可以查看队友手牌');
      return true;
    }
    return false;
  }

  hasPendingIcebergSelection() {
    return this.icebergSelectionRequests.size > 0;
  }

  assertIcebergSelectionComplete() {
    if (!this.hasPendingIcebergSelection()) return;
    const pendingNames = [...this.icebergSelectionRequests.keys()]
      .map(playerId => this.room.findPlayerById(playerId)?.name)
      .filter(Boolean);
    throw new Error(`请等待 ${pendingNames.join('、') || '玩家'} 选择明牌`);
  }

  prepareIcebergRevealSelection(player, reason = 'replenish') {
    const { gameState } = this.room;
    const revealMap = gameState.icebergRevealedCardIdsByPlayer;
    const handIds = new Set(player.cards.map(card => card.id));
    const revealedIds = new Set(
      [...(revealMap.get(player.id) || [])].filter(cardId => handIds.has(cardId))
    );
    const targetCount = Math.min(ICEBERG_REVEALED_CARD_COUNT, player.cards.length);
    const requiredCount = Math.max(0, targetCount - revealedIds.size);
    const candidates = player.cards.filter(card => !revealedIds.has(card.id));

    revealMap.set(player.id, revealedIds);
    this.icebergSelectionRequests.delete(player.id);
    gameState.icebergPendingPlayerIds.delete(player.id);

    if (requiredCount === 0) {
      return { pending: false, requiredCount: 0 };
    }

    // Bot代表自己自动选择；若所有候选都必须明置，也无需让真人做无意义确认。
    if (player.isBot || candidates.length <= requiredCount) {
      candidates.slice(0, requiredCount).forEach(card => revealedIds.add(card.id));
      revealMap.set(player.id, revealedIds);
      return { pending: false, requiredCount, automatic: true };
    }

    const request = {
      playerId: player.id,
      reason,
      requiredCount,
      targetCount,
      currentlyRevealedCardIds: [...revealedIds]
    };
    this.icebergSelectionRequests.set(player.id, request);
    gameState.icebergPendingPlayerIds.add(player.id);
    this.io.to(player.socketId).emit('iceberg_reveal_selection_required', {
      reason,
      requiredCount,
      targetCount,
      currentlyRevealedCardIds: request.currentlyRevealedCardIds
    });
    return { pending: true, requiredCount };
  }

  submitIcebergRevealSelection(playerId, cardIds) {
    const { gameState } = this.room;
    if (
      gameState.phase !== GamePhases.PLAYING
      || !isIcebergTipRule(gameState.selectedRule)
    ) {
      throw new Error('当前不需要选择冰山明牌');
    }

    const request = this.icebergSelectionRequests.get(playerId);
    if (!request) throw new Error('当前不需要你选择明牌');

    const player = this.room.findPlayerById(playerId);
    if (!player) throw new Error('玩家不存在');
    if (!Array.isArray(cardIds) || cardIds.length !== request.requiredCount) {
      throw new Error(`必须选择${request.requiredCount}张牌明置`);
    }

    const uniqueIds = new Set(cardIds);
    if (uniqueIds.size !== request.requiredCount) {
      throw new Error('不能重复选择同一张牌');
    }
    const revealedIds = new Set(
      [...(gameState.icebergRevealedCardIdsByPlayer.get(playerId) || [])]
        .filter(id => player.cards.some(card => card.id === id))
    );
    if (cardIds.some(id => revealedIds.has(id))) {
      throw new Error('请选择尚未明置的手牌');
    }
    const selectedCards = cardIds.map(id => player.cards.find(card => card.id === id));
    if (selectedCards.some(card => !card)) {
      throw new Error('选择的牌不在手中');
    }

    cardIds.forEach(id => revealedIds.add(id));
    if (revealedIds.size !== request.targetCount) {
      throw new Error(`明牌总数必须保持为${request.targetCount}张`);
    }

    gameState.icebergRevealedCardIdsByPlayer.set(playerId, revealedIds);
    this.icebergSelectionRequests.delete(playerId);
    gameState.icebergPendingPlayerIds.delete(playerId);
    this.io.to(player.socketId).emit('iceberg_reveal_selection_confirmed', {
      reason: request.reason,
      revealedCardIds: [...revealedIds]
    });

    const resolved = !this.hasPendingIcebergSelection();
    if (resolved) {
      const announcement = this.icebergInitialSelectionActive
        ? '冰山一角：所有玩家已自行选择两张明牌'
        : `${player.name} 已补足明牌`;
      this.icebergInitialSelectionActive = false;
      this.emitRuleVisibleHands(announcement);
    }
    this.broadcastRoomUpdate();
    return { resolved, revealedCardIds: [...revealedIds] };
  }

  createRuleVisibleHandsFor(viewer) {
    const { gameState, players } = this.room;
    if (isTwoGhostsKnockDoorRule(gameState.selectedRule)) {
      return players
        .filter(player => gameState.twoGhostsRevealedPlayerIds.has(player.id))
        .map(player => ({
          playerId: player.id,
          playerName: player.name,
          kind: 'jokers',
          label: '二鬼拍门',
          cards: player.cards
            .filter(card => card.suit === Suits.JOKER)
            .map(card => card.toJSON())
        }))
        .filter(hand => hand.cards.length > 0);
    }

    if (isIcebergTipRule(gameState.selectedRule)) {
      return players.map(player => {
        const revealedIds = gameState.icebergRevealedCardIdsByPlayer.get(player.id) || new Set();
        return {
          playerId: player.id,
          playerName: player.name,
          kind: 'partial',
          label: '冰山',
          cards: player.cards.filter(card => revealedIds.has(card.id)).map(card => card.toJSON())
        };
      });
    }

    if (isMutualVisibilityRule(gameState.selectedRule)) {
      const viewerIndex = this.room.getPlayerIndex(viewer.id);
      const teammate = players[(viewerIndex + 2) % players.length];
      return teammate ? [{
        playerId: teammate.id,
        playerName: teammate.name,
        kind: 'teammate',
        label: '队友手牌',
        cards: teammate.cards.map(card => card.toJSON())
      }] : [];
    }

    if (isOpenAndHonestRule(gameState.selectedRule) && gameState.areAllHandsRevealed) {
      return players.map(player => ({
        playerId: player.id,
        playerName: player.name,
        kind: 'public',
        label: '全员明牌',
        cards: player.cards.map(card => card.toJSON())
      }));
    }
    return [];
  }

  emitRuleVisibleHands(announcement = null) {
    const { gameState } = this.room;
    const isTwoGhostsVisiblePhase = isTwoGhostsKnockDoorRule(gameState.selectedRule)
      && [GamePhases.DRAWING, GamePhases.BURYING, GamePhases.PLAYING].includes(gameState.phase);
    if (gameState.phase !== GamePhases.PLAYING && !isTwoGhostsVisiblePhase) return;
    for (const viewer of this.room.players) {
      if (!viewer.socketId) continue;
      this.io.to(viewer.socketId).emit('rule_visible_hands_updated', {
        ruleId: this.room.gameState.selectedRule?.id || null,
        hands: this.createRuleVisibleHandsFor(viewer),
        announcement
      });
    }
  }

  updateRuleHandVisibilityAfterCardChange(player, { roundEnded = false } = {}) {
    const { gameState } = this.room;
    let announcement = null;
    if (isIcebergTipRule(gameState.selectedRule)) {
      const selection = this.prepareIcebergRevealSelection(player, 'replenish');
      if (selection.pending) {
        announcement = `${player.name} 需要补选 ${selection.requiredCount} 张明牌`;
      }
    } else if (
      isOpenAndHonestRule(gameState.selectedRule)
      && !gameState.areAllHandsRevealed
      && roundEnded
      && this.room.players.every(currentPlayer => currentPlayer.cards.length <= 5)
    ) {
      gameState.areAllHandsRevealed = true;
      announcement = '为人坦荡：本轮结束，所有玩家同时明置剩余手牌';
    }

    if (
      isIcebergTipRule(gameState.selectedRule)
      || isMutualVisibilityRule(gameState.selectedRule)
      || isTwoGhostsKnockDoorRule(gameState.selectedRule)
      || gameState.areAllHandsRevealed
    ) {
      this.emitRuleVisibleHands(announcement);
    }
  }

  getEligibleTenSidedAmbushRanks() {
    const trumpRank = this.room.gameState.trumpRank;
    return TEN_SIDED_AMBUSH_RANKS.filter(rank =>
      rank !== trumpRank && !POINT_RANKS.has(rank)
    );
  }

  hasPendingTenSidedAmbushSelection() {
    return Boolean(this.room.gameState.isTenSidedAmbushSelectionPending);
  }

  assertTenSidedAmbushSelectionComplete() {
    if (!this.hasPendingTenSidedAmbushSelection()) return;
    const selector = this.room.findPlayerById(
      this.room.gameState.tenSidedAmbushSelectorPlayerId
    );
    throw new Error(`请等待 ${selector?.name || '庄家队友'} 指定十面埋伏点数`);
  }

  /** 庄家埋底后，由其队友暗中指定本局的反向五分点数。 */
  activateTenSidedAmbush(dealer) {
    const { gameState, players } = this.room;
    if (!isTenSidedAmbushRule(gameState.selectedRule)) return null;

    const dealerIndex = this.room.getPlayerIndex(dealer.id);
    if (dealerIndex < 0 || players.length !== 4) {
      throw new Error('十面埋伏仅支持四人局');
    }

    const selector = this.room.findPlayerByIndex((dealerIndex + 2) % players.length);
    const eligibleRanks = this.getEligibleTenSidedAmbushRanks();
    if (!selector || eligibleRanks.length === 0) {
      throw new Error('没有可指定的十面埋伏点数');
    }

    gameState.tenSidedAmbushSelectorPlayerId = selector.id;
    gameState.tenSidedAmbushRank = null;
    gameState.isTenSidedAmbushSelectionPending = true;
    gameState.isTenSidedAmbushRevealed = false;
    gameState.tenSidedAmbushAttackerNetCardCount = 0;

    this.io.to(this.room.id).emit('ten_sided_ambush_selection_started', {
      selectorPlayerId: selector.id,
      selectorPlayerName: selector.name
    });

    if (selector.isBot) {
      const sample = Number(this.random());
      const boundedSample = Number.isFinite(sample)
        ? Math.min(0.999999999, Math.max(0, sample))
        : 0;
      const selectedRank = eligibleRanks[Math.floor(boundedSample * eligibleRanks.length)];
      return this.selectTenSidedAmbushRank(selector.id, selectedRank);
    }

    this.io.to(selector.socketId).emit('ten_sided_ambush_selection_required', {
      eligibleRanks,
      trumpRank: gameState.trumpRank
    });
    this.broadcastRoomUpdate();
    logger.info(`房间 ${this.room.id} 十面埋伏：等待 ${selector.name} 暗选点数`);
    return { pending: true, selectorPlayerId: selector.id };
  }

  selectTenSidedAmbushRank(playerId, rank) {
    const { gameState } = this.room;
    if (!isTenSidedAmbushRule(gameState.selectedRule)) {
      throw new Error('本局没有启用十面埋伏');
    }
    if (!gameState.isTenSidedAmbushSelectionPending) {
      throw new Error('十面埋伏点数已经确定');
    }
    if (gameState.tenSidedAmbushSelectorPlayerId !== playerId) {
      throw new Error('只有庄家队友可以指定十面埋伏点数');
    }

    const eligibleRanks = this.getEligibleTenSidedAmbushRanks();
    if (!eligibleRanks.includes(rank)) {
      throw new Error('不能选择级牌、分牌或王作为十面埋伏点数');
    }

    const selector = this.room.findPlayerById(playerId);
    gameState.tenSidedAmbushRank = rank;
    gameState.isTenSidedAmbushSelectionPending = false;

    if (selector?.socketId) {
      this.io.to(selector.socketId).emit('ten_sided_ambush_rank_selected', {
        rank,
        isPrivate: true
      });
    }
    this.io.to(this.room.id).emit('ten_sided_ambush_rank_locked', {
      selectorPlayerId: selector?.id || playerId,
      selectorPlayerName: selector?.name || '庄家队友'
    });
    this.broadcastRoomUpdate();
    logger.info(`房间 ${this.room.id} 十面埋伏：${selector?.name || playerId} 已暗选点数`);
    return { pending: false, rank };
  }

  revealTenSidedAmbushIfNeeded(cards, player, source = 'play') {
    const { gameState } = this.room;
    const rank = gameState.tenSidedAmbushRank;
    if (
      !isTenSidedAmbushRule(gameState.selectedRule)
      || gameState.isTenSidedAmbushRevealed
      || !rank
      || !(cards || []).some(card => card.rank === rank)
    ) {
      return null;
    }

    gameState.isTenSidedAmbushRevealed = true;
    logger.info(`房间 ${this.room.id} 十面埋伏点数 ${rank} 首次出现并公开`);
    return {
      rank,
      source,
      playerId: player?.id || null,
      playerName: player?.name || null
    };
  }

  countTenSidedAmbushCards(cards) {
    if (!isTenSidedAmbushRule(this.room.gameState.selectedRule)) return 0;
    const rank = this.room.gameState.tenSidedAmbushRank;
    if (!rank) return 0;
    return (cards || []).filter(card => card.rank === rank).length;
  }

  getWaitingRabbitSelectionOptions() {
    return {
      eligibleSuits: [...CULTURAL_REVOLUTION_SUITS],
      eligibleRanks: TEN_SIDED_AMBUSH_RANKS.filter(
        rank => rank !== this.room.gameState.trumpRank
      ),
      trumpRank: this.room.gameState.trumpRank
    };
  }

  hasPendingWaitingRabbitSelection() {
    return this.room.gameState.waitingRabbitPendingSelectionPlayerIds.size > 0;
  }

  hasPendingWaitingRabbitDecision() {
    return Boolean(this.room.gameState.waitingRabbitDecision);
  }

  assertWaitingRabbitReady() {
    if (this.hasPendingWaitingRabbitSelection()) {
      throw new Error('请等待所有玩家完成守株待兔目标牌暗选');
    }
    if (this.hasPendingWaitingRabbitDecision()) {
      throw new Error('请先完成守株待兔换牌决定');
    }
  }

  recordWaitingRabbitBehavior(type, details = {}) {
    const { gameState } = this.room;
    if (!isWaitingRabbitRule(gameState.selectedRule)) return null;
    const sequence = gameState.waitingRabbitBehaviorRecords.length + 1;
    const record = {
      id: `waiting-rabbit-record-${sequence}`,
      sequence,
      type,
      round: gameState.currentRound,
      ...details
    };
    gameState.waitingRabbitBehaviorRecords.push(record);
    return record;
  }

  /** 埋底后四家分别暗选一个“花色 + 点数”牌面；5、10、K可以成为目标。 */
  activateWaitingRabbit() {
    const { gameState, players } = this.room;
    if (!isWaitingRabbitRule(gameState.selectedRule)) return null;

    gameState.waitingRabbitDeclarationsByPlayerId.clear();
    gameState.waitingRabbitUsedPlayerIds.clear();
    gameState.waitingRabbitSeenPointCardIds.clear();
    gameState.waitingRabbitDecision = null;
    gameState.waitingRabbitLastResult = null;
    gameState.waitingRabbitBehaviorRecords = [];
    gameState.waitingRabbitPendingSelectionPlayerIds = new Set(
      players.map(player => player.id)
    );

    const options = this.getWaitingRabbitSelectionOptions();
    if (options.eligibleRanks.length === 0) {
      throw new Error('守株待兔没有可指定的目标牌点数');
    }

    this.io.to(this.room.id).emit('waiting_rabbit_selection_started', {
      playerIds: players.map(player => player.id)
    });

    for (const player of players) {
      if (player.isBot) {
        const firstSample = Math.min(0.999999999, Math.max(0, Number(this.random()) || 0));
        const secondSample = Math.min(0.999999999, Math.max(0, Number(this.random()) || 0));
        const suit = options.eligibleSuits[
          Math.floor(firstSample * options.eligibleSuits.length)
        ];
        const rank = options.eligibleRanks[
          Math.floor(secondSample * options.eligibleRanks.length)
        ];
        this.selectWaitingRabbitTarget(player.id, suit, rank);
      } else if (player.socketId) {
        this.io.to(player.socketId).emit('waiting_rabbit_selection_required', options);
      }
    }

    this.broadcastRoomUpdate();
    return {
      pending: this.hasPendingWaitingRabbitSelection(),
      pendingPlayerIds: Array.from(gameState.waitingRabbitPendingSelectionPlayerIds)
    };
  }

  selectWaitingRabbitTarget(playerId, suit, rank) {
    const { gameState } = this.room;
    if (!isWaitingRabbitRule(gameState.selectedRule)) {
      throw new Error('本局没有启用守株待兔');
    }
    if (!gameState.waitingRabbitPendingSelectionPlayerIds.has(playerId)) {
      throw new Error('你已经指定过守株待兔目标牌');
    }

    const options = this.getWaitingRabbitSelectionOptions();
    if (!options.eligibleSuits.includes(suit) || !options.eligibleRanks.includes(rank)) {
      throw new Error('守株待兔不能指定王或当前级牌');
    }

    const player = this.room.findPlayerById(playerId);
    if (!player) throw new Error('玩家不存在');
    const declaration = { suit, rank };
    gameState.waitingRabbitDeclarationsByPlayerId.set(playerId, declaration);
    gameState.waitingRabbitPendingSelectionPlayerIds.delete(playerId);
    this.recordWaitingRabbitBehavior('target_locked', {
      playerId: player.id,
      playerName: player.name
    });

    if (player.socketId) {
      this.io.to(player.socketId).emit('waiting_rabbit_target_selected', {
        ...declaration,
        isPrivate: true
      });
    }
    this.io.to(this.room.id).emit('waiting_rabbit_target_locked', {
      playerId: player.id,
      playerName: player.name,
      remainingCount: gameState.waitingRabbitPendingSelectionPlayerIds.size
    });
    if (!this.hasPendingWaitingRabbitSelection()) {
      this.io.to(this.room.id).emit('waiting_rabbit_selection_completed');
    }
    this.broadcastRoomUpdate();
    return {
      pending: this.hasPendingWaitingRabbitSelection(),
      target: declaration
    };
  }

  getWaitingRabbitPublicDecision(decision = this.room.gameState.waitingRabbitDecision) {
    if (!decision) return null;
    return {
      id: decision.id,
      round: decision.round,
      chooserPlayerId: decision.chooserPlayerId,
      chooserPlayerName: decision.chooserPlayerName,
      sourcePlayerId: decision.sourcePlayerId,
      sourcePlayerName: decision.sourcePlayerName,
      targetCard: decision.targetCard.toJSON
        ? decision.targetCard.toJSON()
        : decision.targetCard
    };
  }

  findWaitingRabbitRoundEndTrigger() {
    const { gameState, players } = this.room;
    if (
      !isWaitingRabbitRule(gameState.selectedRule)
      || gameState.waitingRabbitDecision
      || this.hasPendingWaitingRabbitSelection()
      || !this.roundManager
      || gameState.currentRoundPlays.length !== players.length
    ) {
      return null;
    }

    const startIndex = gameState.roundStartPlayerIndex;
    for (let offset = 0; offset < players.length; offset += 1) {
      const playerIndex = this.roundManager.getPlayerIndexAtOffset(startIndex, offset);
      const chooser = this.room.findPlayerByIndex(playerIndex);
      if (
        !chooser
        || gameState.waitingRabbitUsedPlayerIds.has(chooser.id)
      ) {
        continue;
      }
      const declaration = gameState.waitingRabbitDeclarationsByPlayerId.get(chooser.id);
      if (!declaration) continue;
      const sourcePlay = gameState.currentRoundPlays.find(play => (
        play.playerId !== chooser.id
        && (play.originalCards || play.cards).some(card => (
          card.suit === declaration.suit && card.rank === declaration.rank
        ))
      ));
      if (!sourcePlay) continue;
      const targetCard = (sourcePlay.originalCards || sourcePlay.cards).find(card => (
        card.suit === declaration.suit && card.rank === declaration.rank
      ));

      // 轮末按本轮行动座次锁定第一位命中者；该玩家无非分牌时不顺延给后位。
      const discardCards = chooser.cards.filter(card => getCardPoints(card) === 0);
      if (discardCards.length === 0) return null;
      return { chooser, sourcePlay, targetCard, discardCards };
    }
    return null;
  }

  prepareWaitingRabbitDecisionAtRoundEnd() {
    const trigger = this.findWaitingRabbitRoundEndTrigger();
    if (!trigger) return null;
    const sourcePlayer = this.room.findPlayerById(trigger.sourcePlay.playerId);
    if (!sourcePlayer) return null;
    const sourcePlayHistoryIndex = this.room.gameState.playHistory.findLastIndex(play => (
      play.playerId === sourcePlayer.id
      && (play.cards || []).some(card => card.id === trigger.targetCard.id)
    ));

    const decision = {
      id: `waiting-rabbit-${this.room.gameState.currentRound}-${sourcePlayer.id}-${Date.now()}`,
      round: this.room.gameState.currentRound,
      chooserPlayerId: trigger.chooser.id,
      chooserPlayerName: trigger.chooser.name,
      sourcePlayerId: sourcePlayer.id,
      sourcePlayerName: sourcePlayer.name,
      targetCard: trigger.targetCard,
      sourcePlayHistoryIndex,
      sourceTableCards: [...(trigger.sourcePlay.originalCards || trigger.sourcePlay.cards)]
    };
    this.room.gameState.waitingRabbitDecision = decision;
    this.recordWaitingRabbitBehavior('target_triggered', {
      round: decision.round,
      playerId: decision.chooserPlayerId,
      playerName: decision.chooserPlayerName,
      sourcePlayerId: decision.sourcePlayerId,
      sourcePlayerName: decision.sourcePlayerName,
      targetCard: decision.targetCard
    });
    return decision;
  }

  recordWaitingRabbitPointAppearances(cards) {
    if (!isWaitingRabbitRule(this.room.gameState.selectedRule)) return null;
    const seenIds = this.room.gameState.waitingRabbitSeenPointCardIds;
    return (cards || [])
      .filter(card => getCardPoints(card) > 0)
      .map(card => {
        const firstAppearance = !seenIds.has(card.id);
        if (firstAppearance) seenIds.add(card.id);
        return {
          card,
          cardId: card.id,
          firstAppearance,
          points: firstAppearance ? getCardPoints(card) : 0
        };
      });
  }

  resolveWaitingRabbitDecision(playerId, { accept, discardCardId = null } = {}) {
    const { gameState } = this.room;
    const decision = gameState.waitingRabbitDecision;
    if (!decision) throw new Error('当前没有待处理的守株待兔换牌');
    if (decision.chooserPlayerId !== playerId) {
      throw new Error('只有本次守株待兔的优先玩家可以决定是否换牌');
    }

    const chooser = this.room.findPlayerById(playerId);
    if (!chooser) throw new Error('玩家不存在');
    const accepted = Boolean(accept);
    let discardCard = null;
    let publicExchange = null;
    if (accepted) {
      discardCard = chooser.cards.find(card => card.id === discardCardId);
      if (!discardCard || getCardPoints(discardCard) !== 0) {
        throw new Error('守株待兔只能选择一张手里的非分牌交换');
      }
      if (!(decision.sourceTableCards || []).some(card => card.id === decision.targetCard.id)) {
        throw new Error('守株待兔目标牌已经不在刚结束的牌桌上');
      }

      chooser.removeCards([discardCard.id]);
      chooser.addCard(decision.targetCard);
      chooser.cards = DeckService.autoSortCards(chooser.cards);
      const tableCards = (decision.sourceTableCards || []).map(card => (
        card.id === decision.targetCard.id ? discardCard : card
      ));
      publicExchange = {
        accepted: true,
        chooserPlayerId: chooser.id,
        chooserPlayerName: chooser.name,
        sourcePlayerId: decision.sourcePlayerId,
        sourcePlayerName: decision.sourcePlayerName,
        targetCard: decision.targetCard.toJSON
          ? decision.targetCard.toJSON()
          : decision.targetCard,
        discardedCard: discardCard.toJSON ? discardCard.toJSON() : discardCard,
        tableCards: tableCards.map(card => card.toJSON ? card.toJSON() : card)
      };
      const sourceHistory = gameState.playHistory[decision.sourcePlayHistoryIndex];
      if (sourceHistory) {
        sourceHistory.waitingRabbitExchange = publicExchange;
        sourceHistory.tableCards = publicExchange.tableCards;
      }
      gameState.waitingRabbitUsedPlayerIds.add(chooser.id);
      this.updateRuleHandVisibilityAfterCardChange(chooser);
    }

    const resolution = {
      ...this.getWaitingRabbitPublicDecision(decision),
      accepted,
      discardedCard: publicExchange?.discardedCard || null,
      tableCards: publicExchange?.tableCards || null
    };
    gameState.waitingRabbitDecision = null;
    gameState.waitingRabbitLastResult = resolution;
    this.recordWaitingRabbitBehavior(accepted ? 'target_exchanged' : 'exchange_declined', {
      round: decision.round,
      playerId: decision.chooserPlayerId,
      playerName: decision.chooserPlayerName,
      sourcePlayerId: decision.sourcePlayerId,
      sourcePlayerName: decision.sourcePlayerName,
      targetCard: decision.targetCard,
      discardedCard: discardCard
    });
    const roundResult = {
      waitingRabbitResolution: resolution,
      waitingRabbitExchange: publicExchange,
      waitingRabbitChooserHand: accepted
        ? chooser.cards.map(card => card.toJSON ? card.toJSON() : card)
        : null,
      gameFinished: false
    };
    return { resolution, roundResult };
  }

  getEligibleThreePowersRanks() {
    const trumpRank = this.room.gameState.trumpRank;
    return TEN_SIDED_AMBUSH_RANKS.filter(rank => rank !== trumpRank);
  }

  hasPendingThreePowersSelection() {
    return this.room.gameState.threePowersPendingPlayerIds.size > 0;
  }

  assertThreePowersSelectionComplete() {
    if (!this.hasPendingThreePowersSelection()) return;
    throw new Error('请等待2、3、4号位完成三权分立点数选择');
  }

  /** 埋底后由本局初始2、3、4号位分别重载10、5、K分牌。 */
  activateThreePowers() {
    const { gameState, players } = this.room;
    if (!isThreePowersRule(gameState.selectedRule)) return null;
    if (players.length !== 4 || !this.roundManager || !Number.isInteger(gameState.roundStartPlayerIndex)) {
      throw new Error('三权分立仅支持已确定首发顺序的四人局');
    }

    const eligibleRanks = this.getEligibleThreePowersRanks();
    if (eligibleRanks.length === 0) throw new Error('没有可用于重载分牌的点数');

    gameState.threePowersSlots = THREE_POWERS_SLOT_CONFIG.map(config => {
      const selectorIndex = this.roundManager.getPlayerIndexAtOffset(
        gameState.roundStartPlayerIndex,
        config.selectorOffset
      );
      const selector = this.room.findPlayerByIndex(selectorIndex);
      if (!selector) throw new Error(`找不到本局${config.selectorPosition}号位玩家`);
      return {
        ...config,
        selectorPlayerId: selector.id,
        selectedRank: null,
        isRevealed: false
      };
    });
    gameState.threePowersPendingPlayerIds = new Set(
      gameState.threePowersSlots.map(slot => slot.selectorPlayerId)
    );

    this.io.to(this.room.id).emit('three_powers_selection_started', {
      slots: gameState.threePowersSlots.map(slot => ({
        sourceRank: slot.sourceRank,
        pointValue: slot.pointValue,
        selectorPosition: slot.selectorPosition,
        selectorPlayerId: slot.selectorPlayerId,
        selectorPlayerName: this.room.findPlayerById(slot.selectorPlayerId)?.name || '未知玩家'
      }))
    });

    for (const slot of gameState.threePowersSlots) {
      const selector = this.room.findPlayerById(slot.selectorPlayerId);
      if (selector?.isBot) {
        const sample = Number(this.random());
        const boundedSample = Number.isFinite(sample)
          ? Math.min(0.999999999, Math.max(0, sample))
          : 0;
        const rank = eligibleRanks[Math.floor(boundedSample * eligibleRanks.length)];
        this.selectThreePowersRank(selector.id, slot.sourceRank, rank);
      } else if (selector?.socketId) {
        this.io.to(selector.socketId).emit('three_powers_selection_required', {
          sourceRank: slot.sourceRank,
          pointValue: slot.pointValue,
          selectorPosition: slot.selectorPosition,
          eligibleRanks,
          trumpRank: gameState.trumpRank
        });
      }
    }

    this.broadcastRoomUpdate();
    logger.info(`房间 ${this.room.id} 三权分立：等待2、3、4号位暗选重载点数`);
    return {
      pending: this.hasPendingThreePowersSelection(),
      pendingPlayerIds: Array.from(gameState.threePowersPendingPlayerIds)
    };
  }

  selectThreePowersRank(playerId, sourceRank, rank) {
    const { gameState } = this.room;
    if (!isThreePowersRule(gameState.selectedRule)) {
      throw new Error('本局没有启用三权分立');
    }
    const slot = gameState.threePowersSlots.find(candidate => candidate.sourceRank === sourceRank);
    if (!slot) throw new Error('不存在这个分牌重载槽');
    if (slot.selectorPlayerId !== playerId) throw new Error('你不能设置这个分牌重载槽');
    if (slot.selectedRank) throw new Error(`${sourceRank}分牌重载点数已经确定`);
    if (!this.getEligibleThreePowersRanks().includes(rank)) {
      throw new Error('三权分立不能选择级牌或王牌');
    }

    slot.selectedRank = rank;
    gameState.threePowersPendingPlayerIds.delete(playerId);
    const selector = this.room.findPlayerById(playerId);
    if (selector?.socketId) {
      this.io.to(selector.socketId).emit('three_powers_rank_selected', {
        sourceRank,
        pointValue: slot.pointValue,
        rank,
        isPrivate: true
      });
    }
    this.io.to(this.room.id).emit('three_powers_rank_locked', {
      sourceRank,
      selectorPlayerId: playerId,
      selectorPlayerName: selector?.name || '未知玩家',
      remainingCount: gameState.threePowersPendingPlayerIds.size
    });
    this.broadcastRoomUpdate();
    logger.info(
      `房间 ${this.room.id} 三权分立：${selector?.name || playerId} 已完成${sourceRank}分牌重载暗选`
    );
    return {
      pending: this.hasPendingThreePowersSelection(),
      sourceRank,
      pointValue: slot.pointValue,
      rank
    };
  }

  revealThreePowersIfNeeded(cards, player, source = 'play') {
    const { gameState } = this.room;
    if (!isThreePowersRule(gameState.selectedRule)) return null;
    const playedRanks = new Set((cards || []).map(card => card.rank));
    const revealedSlots = gameState.threePowersSlots.filter(slot => (
      !slot.isRevealed && slot.selectedRank && playedRanks.has(slot.selectedRank)
    ));
    if (revealedSlots.length === 0) return null;

    revealedSlots.forEach(slot => { slot.isRevealed = true; });
    const result = {
      slots: revealedSlots.map(slot => ({
        sourceRank: slot.sourceRank,
        pointValue: slot.pointValue,
        rank: slot.selectedRank
      })),
      source,
      playerId: player?.id || null,
      playerName: player?.name || null
    };
    logger.info(
      `房间 ${this.room.id} 三权分立揭晓：` +
      result.slots.map(slot => `${slot.sourceRank}→${slot.rank}`).join('，')
    );
    return result;
  }

  getRuleCardPoints(card) {
    if (isMeticulousAccountingRule(this.room.gameState.selectedRule)) {
      return getMeticulousAccountingCardPoints(card);
    }
    if (!isThreePowersRule(this.room.gameState.selectedRule)) return getCardPoints(card);
    return this.room.gameState.threePowersSlots.reduce(
      (total, slot) => total + (slot.selectedRank === card?.rank ? slot.pointValue : 0),
      0
    );
  }

  getCandleCardColor(card) {
    if ([Suits.HEARTS, Suits.DIAMONDS].includes(card?.suit)) return 'red';
    if ([Suits.CLUBS, Suits.SPADES].includes(card?.suit)) return 'black';
    if (card?.rank === Ranks.SMALL_JOKER) return 'black';
    if (card?.rank === Ranks.BIG_JOKER) return 'red';
    return null;
  }

  getCandleRoundCardPoints(card, isLit = this.room.gameState.candleLit) {
    const basePoints = getCardPoints(card);
    if (basePoints <= 0 || typeof isLit !== 'boolean') return basePoints;
    const color = this.getCandleCardColor(card);
    if (!color) return basePoints;
    const favoredColor = isLit ? 'red' : 'black';
    return Math.max(0, basePoints + (color === favoredColor ? 5 : -5));
  }

  hasPendingCandleSelection() {
    const { gameState } = this.room;
    return isCandleToDawnRule(gameState.selectedRule) && gameState.candleSelectionPending;
  }

  assertCandleSelectionComplete() {
    if (this.hasPendingCandleSelection()) {
      throw new Error('请等待庄家队友选择烛的初始状态');
    }
  }

  initializeCandleToDawn(dealer) {
    const { gameState, players } = this.room;
    if (!isCandleToDawnRule(gameState.selectedRule)) return null;
    if (!dealer || players.length !== 4) throw new Error('烛尽天明仅支持四人局');

    const dealerIndex = this.room.getPlayerIndex(dealer.id);
    const selector = this.room.findPlayerByIndex((dealerIndex + 2) % players.length);
    gameState.candleSelectorPlayerId = selector.id;
    gameState.candleSelectionPending = true;
    gameState.candleLit = null;
    gameState.candleLastTransition = null;

    if (selector.isBot) {
      return this.selectInitialCandleState(selector.id, Number(this.random()) >= 0.5, {
        source: 'bot'
      });
    }

    this.io.to(selector.socketId).emit('candle_initial_choice_required', {
      selectorPlayerId: selector.id,
      selectorPlayerName: selector.name
    });
    return {
      pending: true,
      selectorPlayerId: selector.id,
      selectorPlayerName: selector.name
    };
  }

  selectInitialCandleState(playerId, isLit, { source = 'player' } = {}) {
    const { gameState } = this.room;
    if (!isCandleToDawnRule(gameState.selectedRule)) {
      throw new Error('本局没有启用烛尽天明');
    }
    if (!gameState.candleSelectionPending) throw new Error('烛的初始状态已经确定');
    if (gameState.candleSelectorPlayerId !== playerId) {
      throw new Error('只有庄家队友可以选择烛的初始状态');
    }
    if (typeof isLit !== 'boolean') throw new Error('请选择点燃或熄灭烛');

    const selector = this.room.findPlayerById(playerId);
    gameState.candleLit = isLit;
    gameState.candleSelectionPending = false;
    const result = {
      selectorPlayerId: playerId,
      selectorPlayerName: selector?.name || '未知玩家',
      isLit,
      source
    };
    this.io.to(this.room.id).emit('candle_initial_state_selected', result);
    logger.info(
      `房间 ${this.room.id} 烛尽天明：${result.selectorPlayerName}选择初始${isLit ? '点燃' : '熄灭'}`
    );
    return result;
  }

  applyCandleTransitionAtRoundEnd() {
    const { gameState } = this.room;
    if (!isCandleToDawnRule(gameState.selectedRule)) return null;

    const fourthPlay = gameState.currentRoundPlays[3] || null;
    const fourthCards = fourthPlay?.originalCards || fourthPlay?.cards || [];
    const colors = fourthCards.map(card => this.getCandleCardColor(card));
    const triggerColor = colors.length > 0 && colors.every(color => color === 'red')
      ? 'red'
      : colors.length > 0 && colors.every(color => color === 'black')
        ? 'black'
        : 'mixed';
    const previousLit = Boolean(gameState.candleLit);
    const nextLit = triggerColor === 'red'
      ? true
      : triggerColor === 'black'
        ? false
        : previousLit;
    const fourthPlayer = fourthPlay ? this.room.findPlayerById(fourthPlay.playerId) : null;
    const transition = {
      round: gameState.currentRound,
      previousLit,
      nextLit,
      changed: previousLit !== nextLit,
      triggerColor,
      fourthPlayerId: fourthPlay?.playerId || null,
      fourthPlayerName: fourthPlayer?.name || null
    };
    gameState.candleLastTransition = transition;
    // 本轮计分已经完成，现在才把烛态切换给下一轮。
    gameState.candleLit = nextLit;
    logger.info(
      `房间 ${this.room.id} 烛尽天明：第${transition.round}轮结算后` +
      `第四手${triggerColor === 'mixed' ? '非纯色，烛态不变' : `为纯${triggerColor === 'red' ? '红' : '黑'}，下轮${nextLit ? '点燃' : '熄灭'}`}`
    );
    return transition;
  }

  /**
   * 围三阙一按每次合法出牌原子化记录实体普通牌花色。
   * 同一次出牌合并后若四种花色齐全，则整批记录作废，从下一位玩家重新开始。
   */
  recordEncircleThreeMissingOnePlay(cards = []) {
    const { gameState } = this.room;
    if (!isEncircleThreeMissingOneRule(gameState.selectedRule)) return null;

    const previousSuits = [...gameState.encircleThreeMissingOneSeenSuits];
    const playedSuits = [];
    for (const card of cards) {
      if (
        !ENCIRCLE_THREE_MISSING_ONE_SUITS.includes(card?.suit)
        || card?.rank === gameState.trumpRank
        || playedSuits.includes(card.suit)
      ) {
        continue;
      }
      playedSuits.push(card.suit);
    }

    const combinedSuits = [...previousSuits];
    for (const suit of playedSuits) {
      if (!combinedSuits.includes(suit)) combinedSuits.push(suit);
    }
    const addedSuits = combinedSuits.filter(suit => !previousSuits.includes(suit));
    const flushed = combinedSuits.length === ENCIRCLE_THREE_MISSING_ONE_SUITS.length;
    gameState.encircleThreeMissingOneSeenSuits = flushed ? [] : combinedSuits;

    if (flushed) {
      logger.info(
        `房间 ${this.room.id} 围三阙一：本次出牌使四种花色齐全，清空记录并从下一位玩家重新开始`
      );
    }

    return {
      previousSuits,
      playedSuits,
      addedSuits,
      seenSuits: [...gameState.encircleThreeMissingOneSeenSuits],
      flushed
    };
  }

  /**
   * 每次出牌已经即时完成花色记录；整墩仍按旧主比较与计分，
   * 到墩末才把当前三种记录的缺门花色应用为下一轮主花色。
   */
  applyEncircleThreeMissingOneAtRoundEnd(completedRound = this.room.gameState.currentRound) {
    const { gameState } = this.room;
    if (!isEncircleThreeMissingOneRule(gameState.selectedRule)) return null;

    // 最后一轮之后不存在“下一轮”，不能污染终局展示的本局主花色。
    const hasNextRound = this.room.players.some(player => this.getPlayableCardCount(player) > 0);
    if (!hasNextRound) return null;

    const seenSuits = gameState.encircleThreeMissingOneSeenSuits;
    if (seenSuits.length !== 3) return null;

    const missingSuit = ENCIRCLE_THREE_MISSING_ONE_SUITS.find(
      suit => !seenSuits.includes(suit)
    );
    const previousTrumpSuit = gameState.trumpSuit;
    const replaced = Boolean(missingSuit && missingSuit !== previousTrumpSuit);
    const nextTrumpSuit = replaced ? missingSuit : previousTrumpSuit;
    const transition = {
      triggerRound: completedRound,
      effectiveRound: completedRound + 1,
      recordedSuits: [...seenSuits],
      missingSuit,
      previousTrumpSuit,
      nextTrumpSuit,
      replaced
    };

    gameState.trumpSuit = nextTrumpSuit;
    gameState.encircleThreeMissingOneSeenSuits = [];
    gameState.encircleThreeMissingOneLastTransition = transition;
    this.io.to(this.room.id).emit('encircle_three_missing_one_transition', transition);
    if (replaced) {
      this.io.to(this.room.id).emit('trump_updated', {
        trumpSuit: nextTrumpSuit,
        trumpRank: gameState.trumpRank,
        encircleThreeMissingOne: transition
      });
    }
    logger.info(
      `房间 ${this.room.id} 围三阙一：第${completedRound}轮记录 ${seenSuits.join('、')}，` +
      `缺 ${missingSuit}，${replaced ? `下轮改为 ${nextTrumpSuit} 主` : '缺门即当前主花色，主花色不变'}`
    );
    return transition;
  }

  getGentlemanPromiseSuitCounts(player) {
    const { trumpSuit, trumpRank } = this.room.gameState;
    const eligibleCategories = GENTLEMAN_PROMISE_SUITS.filter(suit => (
      suit === 'trump' || suit !== trumpSuit
    ));
    const counts = Object.fromEntries(eligibleCategories.map(suit => [suit, 0]));
    (player?.cards || []).forEach(card => {
      const effectiveSuit = getEffectiveSuit(card, trumpSuit, trumpRank);
      if (Object.hasOwn(counts, effectiveSuit)) counts[effectiveSuit] += 1;
    });
    return counts;
  }

  getGentlemanPromiseEligibleSuits(player) {
    const counts = this.getGentlemanPromiseSuitCounts(player);
    const minimumCount = Math.min(...Object.values(counts));
    return {
      counts,
      minimumCount,
      eligibleSuits: Object.keys(counts).filter(suit => counts[suit] === minimumCount)
    };
  }

  hasPendingGentlemanPromiseSelection() {
    return this.room.gameState.gentlemanPromisePendingPlayerIds.size > 0;
  }

  assertGentlemanPromiseSelectionComplete() {
    if (!this.hasPendingGentlemanPromiseSelection()) return;
    const pendingNames = Array.from(this.room.gameState.gentlemanPromisePendingPlayerIds)
      .map(playerId => this.room.findPlayerById(playerId)?.name)
      .filter(Boolean);
    throw new Error(`请等待 ${pendingNames.join('、') || '玩家'} 完成最短花色声明`);
  }

  /** 埋底完成后，四家按最终手牌公开声明自己的最短有效花色。 */
  activateGentlemanPromise() {
    const { gameState, players } = this.room;
    if (!isGentlemanPromiseRule(gameState.selectedRule)) return null;

    gameState.gentlemanPromiseDeclarationsByPlayerId.clear();
    gameState.gentlemanPromisePendingPlayerIds = new Set(players.map(player => player.id));
    this.gentlemanPromiseOptionsByPlayerId.clear();
    const plans = players.map(player => ({
      player,
      ...this.getGentlemanPromiseEligibleSuits(player)
    }));
    plans.forEach(plan => {
      this.gentlemanPromiseOptionsByPlayerId.set(plan.player.id, plan.eligibleSuits);
    });

    this.io.to(this.room.id).emit('gentleman_promise_selection_started', {
      pendingPlayerIds: players.map(player => player.id)
    });

    plans.forEach(plan => {
      const { player, eligibleSuits, counts, minimumCount } = plan;
      if (eligibleSuits.length === 1) {
        this.selectGentlemanPromiseSuit(player.id, eligibleSuits[0], { source: 'system' });
        return;
      }
      if (player.isBot) {
        const sample = Number(this.random());
        const boundedSample = Number.isFinite(sample)
          ? Math.min(0.999999999, Math.max(0, sample))
          : 0;
        const selectedSuit = eligibleSuits[Math.floor(boundedSample * eligibleSuits.length)];
        this.selectGentlemanPromiseSuit(player.id, selectedSuit, { source: 'bot' });
        return;
      }
      this.io.to(player.socketId).emit('gentleman_promise_selection_required', {
        eligibleSuits,
        suitCounts: counts,
        minimumCount
      });
    });

    this.broadcastRoomUpdate();
    return {
      pending: this.hasPendingGentlemanPromiseSelection(),
      declarationsByPlayerId: Object.fromEntries(gameState.gentlemanPromiseDeclarationsByPlayerId)
    };
  }

  selectGentlemanPromiseSuit(playerId, suit, { source = 'player' } = {}) {
    const { gameState } = this.room;
    if (!isGentlemanPromiseRule(gameState.selectedRule)) {
      throw new Error('本局没有启用君子一言');
    }
    if (!gameState.gentlemanPromisePendingPlayerIds.has(playerId)) {
      throw new Error('你已经完成最短花色声明');
    }
    const eligibleSuits = this.gentlemanPromiseOptionsByPlayerId.get(playerId) || [];
    if (!eligibleSuits.includes(suit)) {
      throw new Error('只能声明自己并列最少的有效花色');
    }

    const player = this.room.findPlayerById(playerId);
    gameState.gentlemanPromiseDeclarationsByPlayerId.set(playerId, suit);
    gameState.gentlemanPromisePendingPlayerIds.delete(playerId);
    this.gentlemanPromiseOptionsByPlayerId.delete(playerId);
    const result = {
      playerId,
      playerName: player?.name || '未知玩家',
      suit,
      source,
      pendingPlayerIds: Array.from(gameState.gentlemanPromisePendingPlayerIds)
    };
    this.io.to(this.room.id).emit('gentleman_promise_declared', result);
    if (result.pendingPlayerIds.length === 0) {
      this.io.to(this.room.id).emit('gentleman_promise_completed', {
        declarationsByPlayerId: Object.fromEntries(gameState.gentlemanPromiseDeclarationsByPlayerId)
      });
    }
    this.broadcastRoomUpdate();
    logger.info(
      `房间 ${this.room.id} 君子一言：${result.playerName} ` +
      `${source === 'system' ? '由系统直接' : ''}声明 ${suit}`
    );
    return { ...result, pending: result.pendingPlayerIds.length > 0 };
  }

  getHiddenDragonRankCounts(player) {
    const trumpRank = this.room.gameState.trumpRank;
    const eligibleRanks = HIDDEN_DRAGON_RANKS.filter(rank => rank !== trumpRank);
    const counts = Object.fromEntries(eligibleRanks.map(rank => [rank, 0]));
    (player?.cards || []).forEach(card => {
      const rank = card.originalRank || card.rank;
      if (Object.hasOwn(counts, rank)) counts[rank] += 1;
    });
    return counts;
  }

  getHiddenDragonEligibleRanks(player) {
    const counts = this.getHiddenDragonRankCounts(player);
    const maximumCount = Math.max(...Object.values(counts));
    return {
      counts,
      maximumCount,
      eligibleRanks: Object.keys(counts).filter(rank => counts[rank] === maximumCount)
    };
  }

  hasPendingHiddenDragonSelection() {
    return this.room.gameState.hiddenDragonPendingPlayerIds.size > 0;
  }

  assertHiddenDragonSelectionComplete() {
    if (!this.hasPendingHiddenDragonSelection()) return;
    const pendingNames = Array.from(this.room.gameState.hiddenDragonPendingPlayerIds)
      .map(playerId => this.room.findPlayerById(playerId)?.name)
      .filter(Boolean);
    throw new Error(`请等待 ${pendingNames.join('、') || '玩家'} 完成潜龙点数声明`);
  }

  /** 埋底完成后，四家按最终手牌公开声明数量最多的非级牌点数。 */
  activateHiddenDragonInAbyss() {
    const { gameState, players } = this.room;
    if (!isHiddenDragonInAbyssRule(gameState.selectedRule)) return null;

    gameState.hiddenDragonDeclarationsByPlayerId.clear();
    gameState.hiddenDragonPendingPlayerIds = new Set(players.map(player => player.id));
    gameState.hiddenDragonPlayedRanksByPlayerId.clear();
    gameState.hiddenDragonEvaluatedPlayerIds.clear();
    gameState.hiddenDragonResults = [];
    this.hiddenDragonOptionsByPlayerId.clear();
    const plans = players.map(player => ({
      player,
      ...this.getHiddenDragonEligibleRanks(player)
    }));
    plans.forEach(plan => {
      this.hiddenDragonOptionsByPlayerId.set(plan.player.id, plan.eligibleRanks);
    });

    this.io.to(this.room.id).emit('hidden_dragon_selection_started', {
      pendingPlayerIds: players.map(player => player.id)
    });

    plans.forEach(plan => {
      const { player, eligibleRanks, counts, maximumCount } = plan;
      if (eligibleRanks.length === 1) {
        this.selectHiddenDragonRank(player.id, eligibleRanks[0], { source: 'system' });
        return;
      }
      if (player.isBot) {
        const sample = Number(this.random());
        const boundedSample = Number.isFinite(sample)
          ? Math.min(0.999999999, Math.max(0, sample))
          : 0;
        const selectedRank = eligibleRanks[Math.floor(boundedSample * eligibleRanks.length)];
        this.selectHiddenDragonRank(player.id, selectedRank, { source: 'bot' });
        return;
      }
      this.io.to(player.socketId).emit('hidden_dragon_selection_required', {
        eligibleRanks,
        rankCounts: counts,
        maximumCount,
        trumpRank: gameState.trumpRank
      });
    });

    this.broadcastRoomUpdate();
    return {
      pending: this.hasPendingHiddenDragonSelection(),
      declarationsByPlayerId: Object.fromEntries(gameState.hiddenDragonDeclarationsByPlayerId)
    };
  }

  selectHiddenDragonRank(playerId, rank, { source = 'player' } = {}) {
    const { gameState } = this.room;
    if (!isHiddenDragonInAbyssRule(gameState.selectedRule)) {
      throw new Error('本局没有启用潜龙在渊');
    }
    if (!gameState.hiddenDragonPendingPlayerIds.has(playerId)) {
      throw new Error('你已经完成潜龙点数声明');
    }
    const eligibleRanks = this.hiddenDragonOptionsByPlayerId.get(playerId) || [];
    if (!eligibleRanks.includes(rank)) {
      throw new Error('只能声明自己并列最多的非级牌点数');
    }

    const player = this.room.findPlayerById(playerId);
    gameState.hiddenDragonDeclarationsByPlayerId.set(playerId, rank);
    gameState.hiddenDragonPendingPlayerIds.delete(playerId);
    this.hiddenDragonOptionsByPlayerId.delete(playerId);
    const result = {
      playerId,
      playerName: player?.name || '未知玩家',
      rank,
      source,
      pendingPlayerIds: Array.from(gameState.hiddenDragonPendingPlayerIds)
    };
    this.io.to(this.room.id).emit('hidden_dragon_declared', result);
    if (result.pendingPlayerIds.length === 0) {
      this.io.to(this.room.id).emit('hidden_dragon_completed', {
        declarationsByPlayerId: Object.fromEntries(gameState.hiddenDragonDeclarationsByPlayerId)
      });
    }
    this.broadcastRoomUpdate();
    logger.info(
      `房间 ${this.room.id} 潜龙在渊：${result.playerName} ` +
      `${source === 'system' ? '由系统直接' : ''}声明 ${rank}`
    );
    return { ...result, pending: result.pendingPlayerIds.length > 0 };
  }

  /** 记录本次实体牌点数，并在手牌首次降至12张或更少时立即完成一次性判定。 */
  recordHiddenDragonPlay(player, cards) {
    const { gameState } = this.room;
    if (!isHiddenDragonInAbyssRule(gameState.selectedRule)) return null;

    const previousPlayedRanks = Array.from(
      gameState.hiddenDragonPlayedRanksByPlayerId.get(player.id) || []
    );
    const snapshot = {
      playerId: player.id,
      previousPlayedRanks,
      previousEvaluated: gameState.hiddenDragonEvaluatedPlayerIds.has(player.id),
      previousAttackerScore: gameState.attackerScore,
      previousResultsLength: gameState.hiddenDragonResults.length,
      resolution: null
    };
    const playedRanks = new Set(previousPlayedRanks);
    (cards || []).forEach(card => {
      const rank = card.originalRank || card.rank;
      if (HIDDEN_DRAGON_RANKS.includes(rank)) playedRanks.add(rank);
    });
    gameState.hiddenDragonPlayedRanksByPlayerId.set(player.id, playedRanks);

    const remainingCount = this.getPlayableCardCount(player);
    if (snapshot.previousEvaluated || remainingCount > 12) return snapshot;

    gameState.hiddenDragonEvaluatedPlayerIds.add(player.id);
    const declaredRank = gameState.hiddenDragonDeclarationsByPlayerId.get(player.id) || null;
    const success = Boolean(declaredRank) && !playedRanks.has(declaredRank);
    const playerIndex = this.room.getPlayerIndex(player.id);
    const dealerIndex = this.room.getPlayerIndex(gameState.buryingPlayerId);
    const isAttackerTeam = this.isAttackerPlayerIndex(playerIndex, dealerIndex);
    const attackerScoreDelta = success ? (isAttackerTeam ? 10 : -10) : 0;
    gameState.attackerScore += attackerScoreDelta;
    const resolution = {
      playerId: player.id,
      playerName: player.name,
      declaredRank,
      remainingCount,
      round: gameState.currentRound,
      success,
      team: isAttackerTeam ? 'attacker' : 'dealer',
      awardedPoints: success ? 10 : 0,
      attackerScoreDelta,
      attackerScore: gameState.attackerScore
    };
    gameState.hiddenDragonResults.push(resolution);
    snapshot.resolution = resolution;
    this.io.to(this.room.id).emit('hidden_dragon_resolved', resolution);
    logger.info(
      `房间 ${this.room.id} 潜龙在渊：${player.name} 手牌首次降至${remainingCount}张，` +
      `${success ? `未打出 ${declaredRank}，所属阵营获得10分` : `已经打出 ${declaredRank}，未得分`}`
    );
    return snapshot;
  }

  getAntinomySplitFaceKeys() {
    const { gameState } = this.room;
    if (!isAntinomyRule(gameState.selectedRule)) return [];
    return Array.from(gameState.antinomyDeclarationsByPlayerId.values())
      .filter(declaration => declaration?.effective)
      .map(declaration => declaration.faceKey);
  }

  hasPendingAntinomySelection() {
    return this.room.gameState.antinomyPendingPlayerIds.size > 0;
  }

  assertAntinomySelectionComplete() {
    if (!this.hasPendingAntinomySelection()) return;
    const pendingNames = Array.from(this.room.gameState.antinomyPendingPlayerIds)
      .map(playerId => this.room.findPlayerById(playerId)?.name)
      .filter(Boolean);
    throw new Error(`二律背反：请等待 ${pendingNames.join('、') || '玩家'} 完成选择`);
  }

  getAntinomyPublicDeclarations() {
    return Object.fromEntries(
      Array.from(
        this.room.gameState.antinomyDeclarationsByPlayerId,
        ([playerId, declaration]) => [playerId, { ...declaration }]
      )
    );
  }

  recomputeAntinomyDeclarations() {
    const declarations = this.room.gameState.antinomyDeclarationsByPlayerId;
    const counts = new Map();
    declarations.forEach(declaration => {
      counts.set(declaration.faceKey, (counts.get(declaration.faceKey) || 0) + 1);
    });
    declarations.forEach((declaration, playerId) => {
      const duplicateCount = counts.get(declaration.faceKey) || 0;
      declarations.set(playerId, {
        ...declaration,
        duplicateCount,
        effective: duplicateCount === 1
      });
    });
    return this.getAntinomyPublicDeclarations();
  }

  beginAntinomySelection(playerIds, {
    stage = 'opening',
    triggerRound = null
  } = {}) {
    const { gameState } = this.room;
    if (!isAntinomyRule(gameState.selectedRule)) return null;

    const pendingPlayerIds = [...new Set(playerIds || [])].filter(
      playerId => Boolean(this.room.findPlayerById(playerId))
    );
    this.antinomyPendingSelections.clear();
    gameState.antinomyPendingPlayerIds = new Set(pendingPlayerIds);
    gameState.antinomySelectionStage = pendingPlayerIds.length > 0 ? stage : null;
    gameState.antinomyTriggerRound = pendingPlayerIds.length > 0 ? triggerRound : null;
    if (stage === 'opening') gameState.antinomyDeclarationsByPlayerId.clear();
    if (pendingPlayerIds.length === 0) return null;

    this.io.to(this.room.id).emit('antinomy_selection_started', {
      stage,
      triggerRound,
      pendingPlayerIds
    });

    pendingPlayerIds.forEach(playerId => {
      const player = this.room.findPlayerById(playerId);
      if (player?.isBot) {
        const suitSample = Math.min(0.999999999, Math.max(0, Number(this.random()) || 0));
        const rankSample = Math.min(0.999999999, Math.max(0, Number(this.random()) || 0));
        this.selectAntinomyCard(
          player.id,
          ANTINOMY_SUITS[Math.floor(suitSample * ANTINOMY_SUITS.length)],
          ANTINOMY_RANKS[Math.floor(rankSample * ANTINOMY_RANKS.length)],
          { source: 'bot' }
        );
        return;
      }
      this.io.to(player.socketId).emit('antinomy_selection_required', {
        stage,
        triggerRound,
        eligibleSuits: [...ANTINOMY_SUITS],
        eligibleRanks: [...ANTINOMY_RANKS],
        currentDeclaration: gameState.antinomyDeclarationsByPlayerId.get(player.id) || null
      });
    });
    this.broadcastRoomUpdate();
    return {
      stage,
      triggerRound,
      pendingPlayerIds: Array.from(gameState.antinomyPendingPlayerIds)
    };
  }

  /** 庄家埋底完成后才启动四家选择；摸牌阶段不会提前触发。 */
  activateAntinomy() {
    if (!isAntinomyRule(this.room.gameState.selectedRule)) return null;
    return this.beginAntinomySelection(
      this.room.players.map(player => player.id),
      { stage: 'opening', triggerRound: 0 }
    );
  }

  selectAntinomyCard(playerId, suit, rank, { source = 'player' } = {}) {
    const { gameState } = this.room;
    if (!isAntinomyRule(gameState.selectedRule)) {
      throw new Error('本局没有启用二律背反');
    }
    if (!gameState.antinomyPendingPlayerIds.has(playerId)) {
      throw new Error('你当前不需要重新指定牌面');
    }
    if (!ANTINOMY_SUITS.includes(suit) || !ANTINOMY_RANKS.includes(rank)) {
      throw new Error('二律背反只能指定普通花色的2至A');
    }

    const player = this.room.findPlayerById(playerId);
    const faceKey = getAntinomyFaceKey(suit, rank);
    this.antinomyPendingSelections.set(playerId, { suit, rank, faceKey });
    gameState.antinomyPendingPlayerIds.delete(playerId);
    const pendingPlayerIds = Array.from(gameState.antinomyPendingPlayerIds);
    this.io.to(this.room.id).emit('antinomy_selection_submitted', {
      playerId,
      playerName: player?.name || '未知玩家',
      source,
      pendingPlayerIds
    });

    if (pendingPlayerIds.length > 0) {
      this.broadcastRoomUpdate();
      return { pending: true, pendingPlayerIds };
    }

    const stage = gameState.antinomySelectionStage;
    const triggerRound = gameState.antinomyTriggerRound;
    this.antinomyPendingSelections.forEach((declaration, declarationPlayerId) => {
      gameState.antinomyDeclarationsByPlayerId.set(declarationPlayerId, {
        ...declaration,
        playerName: this.room.findPlayerById(declarationPlayerId)?.name || '未知玩家'
      });
    });
    this.antinomyPendingSelections.clear();
    const declarationsByPlayerId = this.recomputeAntinomyDeclarations();
    gameState.antinomySelectionStage = null;
    gameState.antinomyTriggerRound = null;
    const result = {
      stage,
      triggerRound,
      declarationsByPlayerId,
      splitFaceKeys: this.getAntinomySplitFaceKeys()
    };
    this.io.to(this.room.id).emit('antinomy_declarations_revealed', result);
    this.broadcastRoomUpdate();
    logger.info(
      `房间 ${this.room.id} 二律背反：${stage === 'opening' ? '开局' : `第${triggerRound}轮后`}声明同时亮出`
    );
    return { pending: false, ...result };
  }

  getAntinomyReselectionPlayerIds() {
    const { gameState } = this.room;
    if (!isAntinomyRule(gameState.selectedRule)) return [];
    const playedFaceKeys = new Set(
      gameState.currentRoundPlays.flatMap(play => play.originalCards || play.cards || [])
        .map(card => getAntinomyFaceKey(
          card.originalSuit || card.suit,
          card.originalRank || card.rank
        ))
        .filter(Boolean)
    );
    return Array.from(gameState.antinomyDeclarationsByPlayerId.entries())
      .filter(([, declaration]) => playedFaceKeys.has(declaration.faceKey))
      .map(([playerId]) => playerId);
  }

  getRiceToMulberryPointCards(player) {
    return (player?.cards || []).filter(card => (
      !card.isRiceToMulberryTransformed && getCardPoints(card) > 0
    ));
  }

  getRiceToMulberryRequiredCount(player) {
    return Math.floor(this.getRiceToMulberryPointCards(player).length / 2);
  }

  hasPendingRiceToMulberrySelection() {
    return this.room.gameState.riceToMulberryPendingPlayerIds.size > 0;
  }

  assertRiceToMulberrySelectionComplete() {
    if (!this.hasPendingRiceToMulberrySelection()) return;
    const pendingNames = Array.from(this.room.gameState.riceToMulberryPendingPlayerIds)
      .map(playerId => this.room.findPlayerById(playerId)?.name)
      .filter(Boolean);
    throw new Error(`改稻为桑：请等待 ${pendingNames.join('、') || '闲家'} 完成分牌选择`);
  }

  selectBotRiceToMulberryCards(player) {
    const { trumpSuit, trumpRank } = this.room.gameState;
    const requiredCount = this.getRiceToMulberryRequiredCount(player);
    return this.getRiceToMulberryPointCards(player)
      .sort((left, right) => {
        const trumpDiff = Number(isTrumpCard(right, trumpSuit, trumpRank))
          - Number(isTrumpCard(left, trumpSuit, trumpRank));
        if (trumpDiff !== 0) return trumpDiff;
        const pointDiff = getCardPoints(left) - getCardPoints(right);
        if (pointDiff !== 0) return pointDiff;
        return getCardStrength(left, trumpSuit, trumpRank)
          - getCardStrength(right, trumpSuit, trumpRank);
      })
      .slice(0, requiredCount);
  }

  /** 埋底后由两名闲家各自改造向下取整的一半分牌。 */
  activateChangeRiceToMulberry() {
    const { gameState, players } = this.room;
    if (!isChangeRiceToMulberryRule(gameState.selectedRule)) return null;
    if (players.length !== 4) throw new Error('改稻为桑仅支持四人局');

    const dealer = this.room.findPlayerById(gameState.buryingPlayerId)
      || this.room.findPlayerByIndex(gameState.dealerPlayerIndex);
    const dealerIndex = dealer ? this.room.getPlayerIndex(dealer.id) : -1;
    if (dealerIndex < 0) throw new Error('改稻为桑：无法确定庄家');

    const attackers = players.filter((player, playerIndex) => (
      this.isAttackerPlayerIndex(playerIndex, dealerIndex)
    ));
    gameState.riceToMulberryPendingPlayerIds = new Set(
      attackers.map(player => player.id)
    );
    gameState.riceToMulberryCompletedPlayerIds.clear();

    this.io.to(this.room.id).emit('rice_to_mulberry_selection_started', {
      playerIds: attackers.map(player => player.id)
    });

    attackers.forEach(player => {
      const pointCards = this.getRiceToMulberryPointCards(player);
      const requiredCount = Math.floor(pointCards.length / 2);
      if (player.isBot || requiredCount === 0) {
        const cards = player.isBot
          ? this.selectBotRiceToMulberryCards(player)
          : [];
        this.selectRiceToMulberryCards(player.id, cards.map(card => card.id), {
          source: player.isBot ? 'bot' : 'automatic'
        });
        return;
      }
      if (player.socketId) {
        this.io.to(player.socketId).emit('rice_to_mulberry_selection_required', {
          requiredCount,
          eligibleCardIds: pointCards.map(card => card.id)
        });
      }
    });

    this.broadcastRoomUpdate();
    return {
      pending: this.hasPendingRiceToMulberrySelection(),
      pendingPlayerIds: Array.from(gameState.riceToMulberryPendingPlayerIds)
    };
  }

  selectRiceToMulberryCards(playerId, cardIds, { source = 'player' } = {}) {
    const { gameState } = this.room;
    if (!isChangeRiceToMulberryRule(gameState.selectedRule)) {
      throw new Error('本局没有启用改稻为桑');
    }
    if (!gameState.riceToMulberryPendingPlayerIds.has(playerId)) {
      throw new Error('你不需要进行改稻为桑选择，或已经完成');
    }
    const player = this.room.findPlayerById(playerId);
    if (!player) throw new Error('玩家不存在');

    const eligibleCards = this.getRiceToMulberryPointCards(player);
    const eligibleById = new Map(eligibleCards.map(card => [card.id, card]));
    const uniqueCardIds = [...new Set(cardIds || [])];
    const requiredCount = Math.floor(eligibleCards.length / 2);
    if (uniqueCardIds.length !== requiredCount || uniqueCardIds.length !== (cardIds || []).length) {
      throw new Error(`改稻为桑必须选择 ${requiredCount} 张不同的分牌`);
    }
    const selectedCards = uniqueCardIds.map(cardId => eligibleById.get(cardId));
    if (selectedCards.some(card => !card)) {
      throw new Error('改稻为桑只能选择当前手牌中未改造的分牌');
    }

    const { trumpSuit, trumpRank } = gameState;
    selectedCards.forEach(card => {
      const wasTrump = isTrumpCard(card, trumpSuit, trumpRank);
      card.originalSuit = card.originalSuit || card.suit;
      card.originalRank = card.originalRank || card.rank;
      if (wasTrump) {
        card.suit = Suits.JOKER;
        card.rank = Ranks.BIG_JOKER;
      } else {
        card.rank = Ranks.ACE;
      }
      card.isRiceToMulberryTransformed = true;
      card.value = card.calculateValue();
    });
    player.cards = DeckService.autoSortCards(player.cards);
    gameState.riceToMulberryPendingPlayerIds.delete(player.id);
    gameState.riceToMulberryCompletedPlayerIds.add(player.id);

    const publicResult = {
      playerId: player.id,
      playerName: player.name,
      transformedCount: selectedCards.length,
      source,
      pendingPlayerIds: Array.from(gameState.riceToMulberryPendingPlayerIds)
    };
    this.io.to(this.room.id).emit('rice_to_mulberry_transformed', publicResult);
    if (player.socketId) {
      this.io.to(player.socketId).emit('rice_to_mulberry_hand_updated', {
        cards: player.cards.map(card => card.toJSON ? card.toJSON() : card)
      });
    }
    if (!this.hasPendingRiceToMulberrySelection()) {
      this.io.to(this.room.id).emit('rice_to_mulberry_completed', {
        playerIds: Array.from(gameState.riceToMulberryCompletedPlayerIds)
      });
    }
    this.broadcastRoomUpdate();
    logger.info(
      `房间 ${this.room.id} 改稻为桑：${player.name} 将 ${selectedCards.length} 张分牌改造并清零分值`
    );
    return {
      ...publicResult,
      pending: this.hasPendingRiceToMulberrySelection(),
      transformedCards: selectedCards.map(card => card.toJSON ? card.toJSON() : card)
    };
  }

  getAdministrativeReviewSuitOptions() {
    const trumpSuit = this.room.gameState.trumpSuit;
    return THREE_TIGERS_SUITS.filter(suit => suit !== trumpSuit);
  }

  hasPendingAdministrativeReviewSelection() {
    const review = this.room.gameState.administrativeReview;
    return isAdministrativeReviewRule(this.room.gameState.selectedRule)
      && Boolean(review)
      && (!review.suit || !review.rank);
  }

  assertAdministrativeReviewSelectionComplete() {
    if (this.hasPendingAdministrativeReviewSelection()) {
      throw new Error('请等待闲家完成行政审查声明');
    }
  }

  /** 庄家锁定后底牌继续封存，由上下家在首张牌前公开声明审查条件。 */
  startAdministrativeReview(dealer) {
    const { gameState, players } = this.room;
    if (!isAdministrativeReviewRule(gameState.selectedRule)) return null;
    if (players.length !== 4) throw new Error('行政审查仅支持四人局');

    const dealerIndex = this.room.getPlayerIndex(dealer.id);
    const suitSelector = this.room.findPlayerByIndex((dealerIndex + 1) % players.length);
    const dealerTeammate = this.room.findPlayerByIndex((dealerIndex + 2) % players.length);
    const rankSelector = this.room.findPlayerByIndex((dealerIndex + 3) % players.length);
    const eligibleSuits = this.getAdministrativeReviewSuitOptions();
    const eligibleRanks = [...HIDDEN_DRAGON_RANKS];
    gameState.administrativeReview = {
      dealerPlayerId: dealer.id,
      dealerTeammatePlayerId: dealerTeammate.id,
      suitSelectorPlayerId: suitSelector.id,
      rankSelectorPlayerId: rankSelector.id,
      suit: null,
      rank: null,
      suitMatched: false,
      rankMatched: false,
      isPlayStarted: false,
      isBottomReleased: false,
      isBuryingPending: false,
      isBuried: false
    };
    gameState.phase = GamePhases.PLAYING;
    gameState.firstPlayerId = dealer.id;
    gameState.currentPlayerIndex = null;
    gameState.roundStartPlayerIndex = dealerIndex;
    gameState.currentRound = 0;
    gameState.playMode = PlayModes.ORDERED;
    gameState.playersPlayedThisRound.clear();

    this.io.to(this.room.id).emit('administrative_review_selection_started', {
      dealerPlayerId: dealer.id,
      dealerPlayerName: dealer.name,
      suitSelectorPlayerId: suitSelector.id,
      suitSelectorPlayerName: suitSelector.name,
      rankSelectorPlayerId: rankSelector.id,
      rankSelectorPlayerName: rankSelector.name
    });

    const requests = [
      { player: suitSelector, type: 'suit', options: eligibleSuits },
      { player: rankSelector, type: 'rank', options: eligibleRanks }
    ];
    requests.forEach(({ player, type, options }) => {
      if (player.isBot) {
        const sample = Number(this.random());
        const boundedSample = Number.isFinite(sample)
          ? Math.min(0.999999999, Math.max(0, sample))
          : 0;
        const value = options[Math.floor(boundedSample * options.length)];
        this.selectAdministrativeReviewDeclaration(player.id, type, value, { source: 'bot' });
        return;
      }
      this.io.to(player.socketId).emit('administrative_review_selection_required', {
        type,
        eligibleOptions: options,
        trumpSuit: gameState.trumpSuit,
        trumpRank: gameState.trumpRank
      });
    });

    this.broadcastRoomUpdate();
    if (!this.hasPendingAdministrativeReviewSelection() && this.onBotTurn) {
      this.onBotTurn();
    }
    return {
      pending: this.hasPendingAdministrativeReviewSelection(),
      ...gameState.administrativeReview
    };
  }

  selectAdministrativeReviewDeclaration(playerId, type, value, { source = 'player' } = {}) {
    const { gameState } = this.room;
    const review = gameState.administrativeReview;
    if (!isAdministrativeReviewRule(gameState.selectedRule) || !review) {
      throw new Error('本局没有启用行政审查');
    }
    if (!['suit', 'rank'].includes(type)) throw new Error('无效的行政审查声明类型');
    const expectedPlayerId = type === 'suit'
      ? review.suitSelectorPlayerId
      : review.rankSelectorPlayerId;
    if (playerId !== expectedPlayerId) throw new Error('你不是本项行政审查的声明者');
    if (review[type]) throw new Error('你已经完成行政审查声明');
    const eligibleOptions = type === 'suit'
      ? this.getAdministrativeReviewSuitOptions()
      : HIDDEN_DRAGON_RANKS;
    if (!eligibleOptions.includes(value)) {
      throw new Error(type === 'suit' ? '只能指定一种当前副花色' : '只能指定2至A中的一个点数');
    }

    review[type] = value;
    const player = this.room.findPlayerById(playerId);
    const result = {
      playerId,
      playerName: player?.name || '未知玩家',
      type,
      value,
      source
    };
    this.io.to(this.room.id).emit('administrative_review_declared', result);
    const pending = this.hasPendingAdministrativeReviewSelection();
    if (!pending) {
      this.beginAdministrativeReviewPlay();
    } else {
      this.broadcastRoomUpdate();
    }
    logger.info(
      `房间 ${this.room.id} 行政审查：${result.playerName}公开指定` +
      `${type === 'suit' ? `副花色 ${value}` : `点数 ${value}`}`
    );
    return { ...result, pending };
  }

  beginAdministrativeReviewPlay() {
    const { gameState } = this.room;
    const review = gameState.administrativeReview;
    if (!review || review.isPlayStarted) return null;
    const dealer = this.room.findPlayerById(review.dealerPlayerId);
    const dealerIndex = this.room.getPlayerIndex(dealer.id);
    review.isPlayStarted = true;
    gameState.phase = GamePhases.PLAYING;
    gameState.firstPlayerId = dealer.id;
    gameState.currentPlayerIndex = dealerIndex;
    gameState.roundStartPlayerIndex = dealerIndex;
    gameState.currentRound = 1;
    gameState.playMode = PlayModes.ORDERED;
    gameState.playersPlayedThisRound.clear();
    gameState.currentRoundPlays = [];
    gameState.leadingPattern = null;
    gameState.currentWinnerIndex = null;
    this.roundManager = new RoundManager(this.room);

    this.io.to(this.room.id).emit('administrative_review_completed', {
      suit: review.suit,
      rank: review.rank,
      dealerPlayerId: dealer.id,
      dealerPlayerName: dealer.name
    });
    this.io.to(this.room.id).emit('first_player_set', {
      playerId: dealer.id,
      playerName: dealer.name,
      currentPlayerIndex: dealerIndex
    });
    this.io.to(this.room.id).emit('phase_changed', {
      phase: GamePhases.PLAYING,
      message: `行政审查声明完成，${dealer.name}先出牌；底牌仍封存`
    });
    this.broadcastRoomUpdate();
    return { ...review };
  }

  /** 只有庄家和固定队友的实体出牌会推进两项公开审查条件。 */
  recordAdministrativeReviewPlay(player, cards) {
    const { gameState } = this.room;
    const review = gameState.administrativeReview;
    if (
      !isAdministrativeReviewRule(gameState.selectedRule)
      || !review?.isPlayStarted
      || review.isBottomReleased
      || ![review.dealerPlayerId, review.dealerTeammatePlayerId].includes(player.id)
    ) return null;

    const snapshot = {
      previousSuitMatched: review.suitMatched,
      previousRankMatched: review.rankMatched
    };
    review.suitMatched = review.suitMatched || cards.some(card => (
      getEffectiveSuit(card, gameState.trumpSuit, gameState.trumpRank) === review.suit
    ));
    review.rankMatched = review.rankMatched || cards.some(card => (
      (card.originalRank || card.rank) === review.rank
    ));
    if (
      snapshot.previousSuitMatched !== review.suitMatched
      || snapshot.previousRankMatched !== review.rankMatched
    ) {
      this.io.to(this.room.id).emit('administrative_review_progressed', {
        playerId: player.id,
        playerName: player.name,
        suit: review.suit,
        rank: review.rank,
        suitMatched: review.suitMatched,
        rankMatched: review.rankMatched
      });
    }
    return snapshot;
  }

  releaseAdministrativeReviewBottomIfReady() {
    const { gameState } = this.room;
    const review = gameState.administrativeReview;
    if (
      !isAdministrativeReviewRule(gameState.selectedRule)
      || !review?.suitMatched
      || !review?.rankMatched
      || review.isBottomReleased
    ) return null;

    const dealer = this.room.findPlayerById(review.dealerPlayerId);
    const sealedBottomCards = [...gameState.bottomCards];
    sealedBottomCards.forEach(card => dealer.addCard(card));
    dealer.cards = DeckService.autoSortCards(dealer.cards);
    review.isBottomReleased = true;
    review.isBuryingPending = true;
    gameState.phase = GamePhases.BURYING;
    this.io.to(dealer.socketId).emit('bottom_cards_received', {
      bottomCards: sealedBottomCards.map(card => card.toJSON()),
      totalCards: dealer.cards.length,
      administrativeReview: true
    });
    this.io.to(this.room.id).emit('administrative_review_burying_unlocked', {
      dealerPlayerId: dealer.id,
      dealerPlayerName: dealer.name,
      bottomCardsCount: sealedBottomCards.length,
      suit: review.suit,
      rank: review.rank
    });
    this.io.to(this.room.id).emit('phase_changed', {
      phase: GamePhases.BURYING,
      message: `行政审查条件满足，${dealer.name}查看底牌并埋12张`
    });

    if (dealer.isBot) {
      if (this.botActionTimer) clearTimeout(this.botActionTimer);
      this.botActionTimer = setTimeout(() => {
        try {
          const cardsToBury = this.selectBotCardsToBury(dealer, gameState.bottomCardsCount);
          this.buryCards(dealer.id, cardsToBury.map(card => card.id));
        } catch (error) {
          logger.error(`行政审查Bot庄家 ${dealer.name} 自动埋底失败:`, error);
        } finally {
          this.botActionTimer = null;
        }
      }, 500);
    }
    logger.info(`房间 ${this.room.id} 行政审查条件全部满足，向 ${dealer.name} 发放封存底牌`);
    return {
      dealerPlayerId: dealer.id,
      dealerPlayerName: dealer.name,
      bottomCardsCount: sealedBottomCards.length
    };
  }

  buryAdministrativeReviewCards(playerId, cardIds) {
    const { gameState } = this.room;
    const review = gameState.administrativeReview;
    if (!review?.isBuryingPending || !review.isBottomReleased || review.isBuried) {
      throw new Error('行政审查尚未开放埋底');
    }
    if (playerId !== review.dealerPlayerId) throw new Error('只有庄家可以埋底');
    const requiredCount = gameState.bottomCardsCount;
    if (!Array.isArray(cardIds) || cardIds.length !== requiredCount || new Set(cardIds).size !== requiredCount) {
      throw new Error(`必须埋${requiredCount}张不同的牌`);
    }
    const dealer = this.room.findPlayerById(playerId);
    const cardsToBury = cardIds.map(cardId => dealer.cards.find(card => card.id === cardId));
    if (cardsToBury.some(card => !card)) throw new Error('选择的牌不在手中');

    dealer.removeCards(cardIds);
    gameState.bottomCards = cardsToBury;
    review.isBuryingPending = false;
    review.isBuried = true;
    gameState.phase = GamePhases.PLAYING;
    this.io.to(this.room.id).emit('cards_buried', {
      playerId: dealer.id,
      playerName: dealer.name,
      skipped: false,
      isSecondary: false,
      completed: true,
      administrativeReview: true
    });
    this.io.to(this.room.id).emit('administrative_review_buried', {
      dealerPlayerId: dealer.id,
      dealerPlayerName: dealer.name,
      bottomCardsCount: requiredCount,
      currentPlayerIndex: gameState.currentPlayerIndex,
      currentRound: gameState.currentRound
    });
    this.io.to(this.room.id).emit('phase_changed', {
      phase: GamePhases.PLAYING,
      message: `行政审查埋底完成，继续第${gameState.currentRound}轮`
    });
    this.broadcastRoomUpdate();
    if (this.onBotTurn) this.onBotTurn();
    logger.info(`房间 ${this.room.id} 行政审查：${dealer.name}埋底完成，续接原牌局`);
    return {
      completed: true,
      administrativeReview: true,
      dealer,
      cards: cardsToBury,
      currentPlayerIndex: gameState.currentPlayerIndex,
      currentRound: gameState.currentRound
    };
  }

  emitFocusFigureTeamEvent(teamState, event, payload) {
    teamState.playerIds.forEach(playerId => {
      const player = this.room.findPlayerById(playerId);
      if (player?.socketId) this.io.to(player.socketId).emit(event, payload);
    });
  }

  getFocusFigureTeamForPlayer(playerId) {
    return this.room.gameState.focusFigureTeams.find(team => team.playerIds.includes(playerId)) || null;
  }

  hasPendingFocusFigureVote() {
    return isFocusFigureRule(this.room.gameState.selectedRule) &&
      this.room.gameState.isFocusFigureVotingStarted &&
      this.room.gameState.focusFigureTeams.some(team => !team.isFinalized);
  }

  assertFocusFigureVoteComplete() {
    if (this.hasPendingFocusFigureVote()) {
      throw new Error('请等待两队完成焦点人物表决');
    }
  }

  promptFocusFigureTeam(teamState) {
    if (!teamState || teamState.isFinalized) return;
    const nominee = this.room.findPlayerById(teamState.nomineePlayerId);
    const payload = {
      team: teamState.team,
      attempt: teamState.attempt,
      nomineePlayerId: nominee?.id || null,
      nomineePlayerName: nominee?.name || '未知玩家'
    };

    teamState.playerIds.forEach(playerId => {
      const player = this.room.findPlayerById(playerId);
      if (!player?.isBot && player?.socketId) {
        this.io.to(player.socketId).emit('focus_figure_vote_required', payload);
      }
    });

    // Bot始终同意当前队内候选，避免自动牌局陷入无意义的反复轮换。
    teamState.playerIds.forEach(playerId => {
      const player = this.room.findPlayerById(playerId);
      if (player?.isBot && !teamState.votes.has(playerId)) {
        this.submitFocusFigureVote(player.id, true, {
          team: teamState.team,
          attempt: teamState.attempt,
          source: 'bot'
        });
      }
    });
  }

  /** 规则确定时先随机生成两队的初始候选，但暂不向任何客户端公开。 */
  initializeFocusFigureCandidates() {
    const { gameState, players } = this.room;
    if (!isFocusFigureRule(gameState.selectedRule)) return null;
    if (players.length !== 4) throw new Error('焦点人物仅支持四人局');

    gameState.focusFigureTeams = [0, 1].map(parity => {
      const teammates = players.filter((_, index) => index % 2 === parity);
      const sample = Number(this.random());
      const nomineeOffset = Number.isFinite(sample) && sample >= 0.5 ? 1 : 0;
      return {
        team: parity + 1,
        playerIds: teammates.map(player => player.id),
        nomineePlayerId: teammates[nomineeOffset].id,
        finalPlayerId: null,
        attempt: 1,
        votes: new Map(),
        isFinalized: false
      };
    });
    gameState.isFocusFigureVotingStarted = false;
    gameState.isFocusFigureRevealed = false;
    gameState.focusFigureCapturedPointsByPlayerId = new Map(
      players.map(player => [player.id, 0])
    );
    return gameState.focusFigureTeams;
  }

  /** 埋底后公开各自队内候选并开始秘密表决；任一反对就轮换候选。 */
  activateFocusFigure() {
    const { gameState, players } = this.room;
    if (!isFocusFigureRule(gameState.selectedRule)) return null;
    if (players.length !== 4) throw new Error('焦点人物仅支持四人局');
    if (gameState.focusFigureTeams.length !== 2) this.initializeFocusFigureCandidates();

    gameState.isFocusFigureVotingStarted = true;
    gameState.isFocusFigureRevealed = false;
    gameState.focusFigureCapturedPointsByPlayerId = new Map(
      players.map(player => [player.id, 0])
    );
    gameState.focusFigureTeams.forEach(team => {
      team.finalPlayerId = null;
      team.attempt = 1;
      team.votes = new Map();
      team.isFinalized = false;
    });

    this.io.to(this.room.id).emit('focus_figure_voting_started', {
      teamCount: gameState.focusFigureTeams.length
    });
    gameState.focusFigureTeams.forEach(team => this.promptFocusFigureTeam(team));
    this.broadcastRoomUpdate();
    return { pending: this.hasPendingFocusFigureVote() };
  }

  submitFocusFigureVote(playerId, agree, { team = null, attempt = null, source = 'player' } = {}) {
    const { gameState } = this.room;
    if (!isFocusFigureRule(gameState.selectedRule)) {
      throw new Error('本局没有启用焦点人物');
    }
    if (typeof agree !== 'boolean') throw new Error('表决结果必须为同意或反对');

    const teamState = this.getFocusFigureTeamForPlayer(playerId);
    if (!teamState) throw new Error('你不属于任何焦点人物表决队伍');
    if (team !== null && Number(team) !== teamState.team) throw new Error('不能参与另一队的表决');
    if (teamState.isFinalized) throw new Error('你所在队伍已经确定焦点人物');
    if (attempt !== null && Number(attempt) !== teamState.attempt) {
      throw new Error('这轮焦点候选已经变更，请对当前候选重新表决');
    }
    if (teamState.votes.has(playerId)) throw new Error('你已经提交本轮表决');

    const player = this.room.findPlayerById(playerId);
    teamState.votes.set(playerId, agree);
    this.emitFocusFigureTeamEvent(teamState, 'focus_figure_vote_recorded', {
      team: teamState.team,
      attempt: teamState.attempt,
      voterPlayerId: playerId,
      voterPlayerName: player?.name || '未知玩家',
      agree,
      source,
      voteCount: teamState.votes.size
    });

    let nomineeChanged = false;
    if (teamState.votes.size === teamState.playerIds.length) {
      const unanimouslyApproved = teamState.playerIds.every(id => teamState.votes.get(id) === true);
      if (unanimouslyApproved) {
        teamState.isFinalized = true;
        teamState.finalPlayerId = teamState.nomineePlayerId;
        const focusPlayer = this.room.findPlayerById(teamState.finalPlayerId);
        this.emitFocusFigureTeamEvent(teamState, 'focus_figure_team_finalized', {
          team: teamState.team,
          attempt: teamState.attempt,
          focusPlayerId: focusPlayer?.id || null,
          focusPlayerName: focusPlayer?.name || '未知玩家'
        });
      } else {
        const previousNomineePlayerId = teamState.nomineePlayerId;
        teamState.nomineePlayerId = teamState.playerIds.find(id => id !== previousNomineePlayerId);
        teamState.attempt += 1;
        teamState.votes.clear();
        nomineeChanged = true;
        const nominee = this.room.findPlayerById(teamState.nomineePlayerId);
        this.emitFocusFigureTeamEvent(teamState, 'focus_figure_nominee_changed', {
          team: teamState.team,
          attempt: teamState.attempt,
          nomineePlayerId: nominee?.id || null,
          nomineePlayerName: nominee?.name || '未知玩家'
        });
        this.promptFocusFigureTeam(teamState);
      }
    }

    const pending = this.hasPendingFocusFigureVote();
    if (!pending) {
      this.io.to(this.room.id).emit('focus_figure_voting_completed', {
        message: '两队均已完成焦点人物表决；己方焦点队内可见，双方焦点将在终局公开'
      });
    }
    this.broadcastRoomUpdate();
    return {
      pending,
      team: teamState.team,
      teamFinalized: teamState.isFinalized,
      nomineeChanged,
      attempt: teamState.attempt
    };
  }

  recordFocusFigureCapturedRoundPoints() {
    const { gameState } = this.room;
    if (!isFocusFigureRule(gameState.selectedRule)) return null;
    const capturedByPlayerId = {};
    gameState.currentRoundPlays.forEach(play => {
      const points = calculateRoundPoints(play.cards, card => this.getRuleCardPoints(card));
      if (points <= 0) return;
      const total = (gameState.focusFigureCapturedPointsByPlayerId.get(play.playerId) || 0) + points;
      gameState.focusFigureCapturedPointsByPlayerId.set(play.playerId, total);
      capturedByPlayerId[play.playerId] = points;
    });
    return capturedByPlayerId;
  }

  drawPlannedEconomyRoundCards(completedRound) {
    const { gameState, players } = this.room;
    if (!isPlannedEconomyRule(gameState.selectedRule)) return null;
    if (gameState.phase !== GamePhases.PLAYING || gameState.plannedEconomyReserveCards.length === 0) {
      return null;
    }

    const drawCount = Math.min(players.length, gameState.plannedEconomyReserveCards.length);
    const draws = [];
    for (let index = 0; index < drawCount; index++) {
      const player = players[index];
      const card = gameState.plannedEconomyReserveCards.shift();
      if (!player || !card) break;
      player.addCard(card);
      player.cards = DeckService.autoSortCards(player.cards);
      draws.push({
        playerId: player.id,
        playerName: player.name,
        card: card.toJSON(),
        cardsCount: player.cards.length
      });
    }
    if (draws.length === 0) return null;

    gameState.plannedEconomyDrawRounds += 1;
    logger.info(
      `房间 ${this.room.id} 计划经济：第${completedRound}轮结束后四家各摸1张，` +
      `封存牌剩余 ${gameState.plannedEconomyReserveCards.length} 张`
    );
    return {
      round: completedRound,
      draws,
      drawCount: draws.length,
      remainingCards: gameState.plannedEconomyReserveCards.length,
      animationDuration: PLANNED_ECONOMY_DRAW_ANIMATION_MS
    };
  }

  finalizeFocusFigureScoring(bottomScoreResult) {
    const { gameState } = this.room;
    if (!isFocusFigureRule(gameState.selectedRule)) return null;

    const dealerIndex = this.room.getPlayerIndex(gameState.buryingPlayerId);
    const focusPlayerIds = new Set(
      gameState.focusFigureTeams.map(team => team.finalPlayerId).filter(Boolean)
    );
    const players = this.room.players.map((player, index) => {
      const capturedPoints = gameState.focusFigureCapturedPointsByPlayerId.get(player.id) || 0;
      const isFocus = focusPlayerIds.has(player.id);
      return {
        playerId: player.id,
        playerName: player.name,
        team: (index % 2) + 1,
        side: index % 2 === dealerIndex % 2 ? 'dealer' : 'attacker',
        isFocus,
        capturedPoints,
        countedPoints: isFocus ? capturedPoints * 2 : 0
      };
    });
    const focusTrickScore = players.reduce((total, player) => total + player.countedPoints, 0);
    const normalBottomScore = bottomScoreResult?.bottomScoreGained || 0;
    const totalScore = focusTrickScore + normalBottomScore;
    gameState.attackerScore = totalScore;
    gameState.isFocusFigureRevealed = true;

    const teams = gameState.focusFigureTeams.map(team => {
      const focusPlayer = this.room.findPlayerById(team.finalPlayerId);
      const teamParity = this.room.getPlayerIndex(team.finalPlayerId) % 2;
      return {
        team: team.team,
        side: teamParity === dealerIndex % 2 ? 'dealer' : 'attacker',
        focusPlayerId: focusPlayer?.id || null,
        focusPlayerName: focusPlayer?.name || '未知玩家'
      };
    });
    logger.info(
      `房间 ${this.room.id} 焦点人物终局揭晓：逐墩焦点分 ${focusTrickScore}，` +
      `正常底牌分 ${normalBottomScore}，闲家总分 ${totalScore}`
    );
    return { teams, players, focusTrickScore, normalBottomScore, totalScore };
  }

  applyRepeatedExhaustionAtRoundEnd(winnerIndex) {
    const { gameState } = this.room;
    if (!isRepeatedExhaustionRule(gameState.selectedRule)) return null;
    const winner = this.room.findPlayerByIndex(winnerIndex);
    if (!winner) return null;

    if (gameState.repeatedExhaustionPlayerId === winner.id) {
      gameState.repeatedExhaustionStreak += 1;
    } else {
      gameState.repeatedExhaustionPlayerId = winner.id;
      gameState.repeatedExhaustionStreak = 1;
    }
    const streak = gameState.repeatedExhaustionStreak;
    const penalty = streak >= 3 ? (streak - 2) * 5 : 0;
    const dealerIndex = this.room.getPlayerIndex(gameState.buryingPlayerId);
    const winnerIsAttacker = this.isAttackerPlayerIndex(winnerIndex, dealerIndex);
    const scoreDelta = penalty === 0 ? 0 : (winnerIsAttacker ? -penalty : penalty);
    gameState.attackerScore += scoreDelta;
    gameState.repeatedExhaustionLastPenalty = penalty;
    gameState.repeatedExhaustionLastScoreDelta = scoreDelta;

    if (penalty > 0) {
      logger.info(
        `房间 ${this.room.id} 再衰三竭：${winner.name} 连续第${streak}轮最大，` +
        `失去${penalty}分，闲家总分变化${scoreDelta > 0 ? '+' : ''}${scoreDelta}至${gameState.attackerScore}`
      );
    }
    return {
      playerId: winner.id,
      playerName: winner.name,
      streak,
      penalty,
      scoreDelta,
      winnerIsAttacker
    };
  }

  resolveOutwardHarmonyInnerDivisionAtRoundEnd(completedRound) {
    const { gameState } = this.room;
    if (!isOutwardHarmonyInnerDivisionRule(gameState.selectedRule)) return null;
    const dealerIndex = this.room.getPlayerIndex(gameState.buryingPlayerId);
    if (dealerIndex < 0 || this.room.players.length !== 4) return null;

    const createTeamResult = (side, playerIndexes) => {
      const players = playerIndexes.map(playerIndex => {
        const player = this.room.findPlayerByIndex(playerIndex);
        const play = gameState.currentRoundPlays.find(
          candidate => candidate.playerIndex === playerIndex
        );
        const profile = getSuitlessPatternProfile(
          play,
          gameState.trumpSuit,
          gameState.trumpRank,
          gameState.selectedRule
        );
        return {
          playerIndex,
          playerId: player?.id || null,
          playerName: player?.name || '未知玩家',
          patternKey: profile.key,
          patternLabel: profile.label,
          components: profile.components
        };
      });
      return {
        side,
        players,
        mismatched: players.length === 2
          && players[0].patternKey !== players[1].patternKey
      };
    };

    const dealerTeam = createTeamResult('dealer', [
      dealerIndex,
      (dealerIndex + 2) % this.room.players.length
    ]);
    const attackerTeam = createTeamResult('attacker', [
      (dealerIndex + 1) % this.room.players.length,
      (dealerIndex + 3) % this.room.players.length
    ]);
    const attackerAward = dealerTeam.mismatched ? OUTWARD_HARMONY_AWARD : 0;
    const dealerAward = attackerTeam.mismatched ? OUTWARD_HARMONY_AWARD : 0;
    const attackerScoreDelta = attackerAward - dealerAward;
    gameState.attackerScore += attackerScoreDelta;

    const result = {
      round: completedRound,
      triggered: dealerTeam.mismatched || attackerTeam.mismatched,
      dealerTeam,
      attackerTeam,
      dealerAward,
      attackerAward,
      attackerScoreDelta,
      attackerScore: gameState.attackerScore
    };
    if (result.triggered) {
      logger.info(
        `房间 ${this.room.id} 貌合神离：庄家方${dealerTeam.mismatched ? '牌型不一致' : '牌型一致'}，` +
        `闲家方${attackerTeam.mismatched ? '牌型不一致' : '牌型一致'}；` +
        `闲家分数变化 ${attackerScoreDelta > 0 ? '+' : ''}${attackerScoreDelta}`
      );
    }
    return result;
  }

  updateCardCooldownRestrictionsForNextRound() {
    const { gameState } = this.room;
    const type = getCardCooldownType(gameState.selectedRule);
    if (!type) return null;

    const valuesByPlayerId = new Map();
    gameState.currentRoundPlays.forEach(play => {
      valuesByPlayerId.set(
        play.playerId,
        Array.from(new Set(
          play.cards.map(card => getCardCooldownValue(card, type, gameState)).filter(Boolean)
        ))
      );
    });
    gameState.cardCooldownType = type;
    gameState.cardCooldownValuesByPlayerId = valuesByPlayerId;
    return {
      type,
      valuesByPlayerId: Object.fromEntries(valuesByPlayerId)
    };
  }

  resolveEnduringPlay(playerId, cards, pattern) {
    const { gameState } = this.room;
    if (!isEnduringRule(gameState.selectedRule)) {
      return { comparisonPattern: pattern, inheritance: null };
    }

    const previousPlay = gameState.enduringLastPlaysByPlayerId.get(playerId);
    const resolution = resolveEnduringComparison(
      { cards, pattern },
      previousPlay,
      gameState.trumpSuit,
      gameState.trumpRank,
      this.getRuleRuntimeContext()
    );
    if (!resolution.inherited) {
      return { comparisonPattern: pattern, inheritance: null };
    }

    return {
      comparisonPattern: resolution.comparisonPattern,
      inheritance: {
        sourceCards: [...resolution.sourceCards],
        sourcePattern: resolution.sourcePattern,
        inheritedComponentCount: resolution.inheritedComponentCount
      }
    };
  }

  updateEnduringHistoryAtRoundEnd() {
    const { gameState } = this.room;
    if (!isEnduringRule(gameState.selectedRule)) return null;

    const nextHistory = new Map();
    for (const play of gameState.currentRoundPlays) {
      nextHistory.set(play.playerId, {
        cards: [...play.cards],
        pattern: play.pattern,
        comparisonPattern: play.comparisonPattern || play.pattern,
        // 连续继承时保留最初提供高牌力的牌面，让视觉提示不会越传越偏。
        displaySourceCards: play.enduringInheritance?.sourceCards?.length
          ? [...play.enduringInheritance.sourceCards]
          : [...play.cards]
      });
    }
    gameState.enduringLastPlaysByPlayerId = nextHistory;
    return nextHistory;
  }

  isDreamKillingSleeping(playerId) {
    return this.room.gameState.dreamKillingSleepingPlayerIds.has(playerId);
  }

  canActivateDreamKilling(playerId) {
    const { gameState } = this.room;
    const player = this.room.findPlayerById(playerId);
    if (!isDreamKillingRule(gameState.selectedRule) || !player) return false;
    if (gameState.phase !== GamePhases.PLAYING || player.cards.length === 0) return false;
    if (this.isDreamKillingSleeping(playerId)) return false;
    return player.cards.every(card => !isTrumpCard(card, gameState.trumpSuit, gameState.trumpRank));
  }

  activateDreamKilling(playerId) {
    const { gameState } = this.room;
    const player = this.room.findPlayerById(playerId);
    if (!player) throw new Error('玩家不存在');
    if (!isDreamKillingRule(gameState.selectedRule)) throw new Error('本局规则不是梦中杀人');
    if (gameState.phase !== GamePhases.PLAYING) throw new Error('进入出牌阶段后才能发动梦中杀人');
    if (player.cards.length === 0) throw new Error('已经没有手牌，不能发动梦中杀人');
    if (this.isDreamKillingSleeping(playerId)) throw new Error('你已经处于梦中');
    if (player.cards.some(card => isTrumpCard(card, gameState.trumpSuit, gameState.trumpRank))) {
      throw new Error('手牌中仍有主牌，不能发动梦中杀人');
    }

    gameState.dreamKillingSleepingPlayerIds.add(player.id);
    logger.info(`房间 ${this.room.id} 玩家 ${player.name} 发动梦中杀人，手牌暗置并交由系统随机出牌`);
    return {
      id: ActiveSkillIds.DREAM_KILLING,
      name: '梦中杀人',
      playerId: player.id,
      playerName: player.name,
      sleeping: true
    };
  }

  resolveDreamKillingPlay(player, cards, pattern, wasDreaming) {
    if (!wasDreaming || !isDreamKillingRule(this.room.gameState.selectedRule)) return null;
    const firstPlay = this.room.gameState.currentRoundPlays[0] || null;
    const firstCards = firstPlay?.cards?.length ? firstPlay.cards : cards;
    const firstPattern = firstPlay?.pattern || pattern;
    const sameEffectiveSuit = Boolean(pattern?.suit && pattern.suit === firstPattern?.suit);
    const rankSignature = values => values.map(card => card.rank).sort().join('|');
    const sameRank = rankSignature(cards) === rankSignature(firstCards);
    const success = sameEffectiveSuit || sameRank;

    if (success) {
      this.room.gameState.dreamKillingSleepingPlayerIds.delete(player.id);
      logger.info(
        `房间 ${this.room.id} 梦中杀人：${player.name} 随机出牌命中` +
        `${sameEffectiveSuit ? '首家花色' : '首家点数'}，本轮视为最大并醒来`
      );
    }
    return {
      wasSleeping: true,
      success,
      awakened: success,
      matchedSuit: sameEffectiveSuit,
      matchedRank: sameRank
    };
  }

  resolveInviteIntoUrnAtRoundEnd(completedRound) {
    const { gameState } = this.room;
    if (!isInviteIntoUrnRule(gameState.selectedRule)) return null;
    const declarations = gameState.inviteIntoUrnDeclarations.filter(
      declaration => declaration.round === completedRound
    );
    const dealerIndex = this.room.getPlayerIndex(gameState.buryingPlayerId);
    let scoreDelta = 0;
    const resolvedDeclarations = declarations.map(declaration => {
      const targetPlay = gameState.currentRoundPlays.find(
        play => play.playerId === declaration.targetPlayerId
      );
      const matchingCardCount = (targetPlay?.originalCards || targetPlay?.cards || []).filter(
        card => card.suit === declaration.suit && card.rank === declaration.rank
      ).length;
      const triggered = matchingCardCount > 0;
      const targetIndex = this.room.getPlayerIndex(declaration.targetPlayerId);
      const targetIsAttacker = this.isAttackerPlayerIndex(targetIndex, dealerIndex);
      const declarationScoreDelta = triggered ? (targetIsAttacker ? -5 : 5) : 0;
      scoreDelta += declarationScoreDelta;
      return {
        ...declaration,
        triggered,
        matchingCardCount,
        penalty: triggered ? 5 : 0,
        targetIsAttacker,
        scoreDelta: declarationScoreDelta
      };
    });

    gameState.attackerScore += scoreDelta;
    gameState.inviteIntoUrnDeclarations = gameState.inviteIntoUrnDeclarations.filter(
      declaration => declaration.round !== completedRound
    );
    const result = {
      round: completedRound,
      declarations: resolvedDeclarations,
      triggeredCount: resolvedDeclarations.filter(declaration => declaration.triggered).length,
      scoreDelta,
      attackerScore: gameState.attackerScore
    };
    gameState.inviteIntoUrnLastResult = result;
    if (result.triggeredCount > 0) {
      logger.info(
        `房间 ${this.room.id} 请君入瓮：触发 ${result.triggeredCount} 项，` +
        `闲家分数变化 ${scoreDelta > 0 ? '+' : ''}${scoreDelta}`
      );
    }
    return result;
  }

  initializeOldHorse(firstPlayerId) {
    const { gameState } = this.room;
    if (!isOldHorseStillHasStrengthRule(gameState.selectedRule)) return null;
    gameState.oldHorseRightHolderPlayerIds = new Set(
      firstPlayerId ? [firstPlayerId] : []
    );
    gameState.oldHorseProtectedPlayerId = null;
    gameState.oldHorseLastAbsolutePlay = null;
    return {
      rightHolderPlayerIds: Array.from(gameState.oldHorseRightHolderPlayerIds),
      protectedPlayerId: null
    };
  }

  updateOldHorseAtRoundEnd(winnerIndex) {
    const { gameState } = this.room;
    if (!isOldHorseStillHasStrengthRule(gameState.selectedRule)) return null;
    const winner = this.room.findPlayerByIndex(winnerIndex);
    if (!winner) return null;
    const wasNewHolder = !gameState.oldHorseRightHolderPlayerIds.has(winner.id);
    if (wasNewHolder) gameState.oldHorseRightHolderPlayerIds.add(winner.id);
    const completedAllHolders = wasNewHolder
      && gameState.oldHorseRightHolderPlayerIds.size === this.room.players.length;
    if (completedAllHolders) {
      gameState.oldHorseProtectedPlayerId = winner.id;
      logger.info(
        `房间 ${this.room.id} 老骥伏枥：${winner.name} 最后首次获得牌权，` +
        '下一次合法首发绝对最大'
      );
    }
    return {
      rightHolderPlayerIds: Array.from(gameState.oldHorseRightHolderPlayerIds),
      newlyAcquiredPlayerId: wasNewHolder ? winner.id : null,
      protectedPlayerId: gameState.oldHorseProtectedPlayerId,
      armedNow: completedAllHolders
    };
  }

  isOldHorseAbsoluteLead(playerId, isLeading) {
    const { gameState } = this.room;
    return Boolean(
      isLeading
      && isOldHorseStillHasStrengthRule(gameState.selectedRule)
      && gameState.oldHorseProtectedPlayerId === playerId
    );
  }

  consumeOldHorseAbsoluteLead(player, cards) {
    const { gameState } = this.room;
    gameState.oldHorseProtectedPlayerId = null;
    gameState.oldHorseLastAbsolutePlay = {
      round: gameState.currentRound,
      playerId: player.id,
      playerName: player.name,
      cardsCount: cards.length
    };
    logger.info(
      `房间 ${this.room.id} 老骥伏枥：${player.name} 的合法首发视为绝对最大`
    );
    return { ...gameState.oldHorseLastAbsolutePlay };
  }

  resolveTrumpWinsAtRoundEnd(completedRound) {
    const { gameState } = this.room;
    if (!isTrumpWinsRule(gameState.selectedRule)) return null;
    const players = gameState.currentRoundPlays.map((play, playOrder) => ({
      playerIndex: play.playerIndex,
      playerId: play.playerId,
      playerName: this.room.findPlayerById(play.playerId)?.name || '未知玩家',
      playOrder,
      points: calculateRoundPoints(play.originalCards || play.cards, getCardPoints)
    }));
    const highestPoints = Math.max(...players.map(player => player.points), 0);
    // currentRoundPlays 本身就是实际出牌顺序；find 天然让并列时先出者获权。
    const leader = players.find(player => player.points === highestPoints) || null;
    const result = {
      round: completedRound,
      highestPoints,
      leaderPlayerIndex: leader?.playerIndex ?? null,
      leaderPlayerId: leader?.playerId || null,
      leaderPlayerName: leader?.playerName || null,
      players
    };
    gameState.trumpWinsLastResult = result;
    return result;
  }

  getStrawBoatBorrowingArrowsPublicDecision(
    decision = this.room.gameState.strawBoatBorrowingArrowsDecision
  ) {
    if (!decision) return null;
    return {
      id: decision.id,
      round: decision.round,
      playerId: decision.playerId,
      playerName: decision.playerName,
      leadingPoints: decision.leadingPoints,
      borrowedCard: decision.borrowedCard?.toJSON
        ? decision.borrowedCard.toJSON()
        : decision.borrowedCard
    };
  }

  prepareStrawBoatBorrowingArrowsAtRoundEnd(completedRound, winnerIndex) {
    const { gameState } = this.room;
    if (!isStrawBoatBorrowingArrowsRule(gameState.selectedRule)) return null;
    if (gameState.strawBoatBorrowingArrowsDecision) {
      return this.getStrawBoatBorrowingArrowsPublicDecision();
    }

    const leadingPlay = gameState.currentRoundPlays[0];
    if (!leadingPlay || leadingPlay.playerIndex % 2 === winnerIndex % 2) return null;

    const leadingCards = leadingPlay.originalCards || leadingPlay.cards || [];
    const leadingPoints = calculateRoundPoints(leadingCards, getCardPoints);
    if (leadingPoints < 10) return null;

    const player = this.room.findPlayerById(leadingPlay.playerId);
    if (!player || !player.cards.some(card => getCardPoints(card) === 0)) return null;

    let borrowedCard = null;
    let borrowedStrength = -Infinity;
    for (const play of gameState.currentRoundPlays) {
      for (const card of play.originalCards || play.cards || []) {
        if (getCardPoints(card) !== 0) continue;
        const strength = getCardStrength(
          card,
          gameState.trumpSuit,
          gameState.trumpRank,
          gameState.selectedRule
        );
        // 同强度时保留实际出牌顺序中更早出现的牌，确保判定稳定且全场一致。
        if (strength > borrowedStrength) {
          borrowedCard = card;
          borrowedStrength = strength;
        }
      }
    }
    if (!borrowedCard) return null;

    const decision = {
      id: `straw-boat-${completedRound}-${player.id}`,
      round: completedRound,
      playerId: player.id,
      playerName: player.name,
      leadingPoints,
      borrowedCard
    };
    gameState.strawBoatBorrowingArrowsDecision = decision;
    logger.info(
      `房间 ${this.room.id} 草船借箭：${player.name} 首置 ${leadingPoints} 分失守，等待决定是否换牌`
    );
    return this.getStrawBoatBorrowingArrowsPublicDecision(decision);
  }

  hasPendingStrawBoatBorrowingArrowsDecision() {
    return Boolean(this.room.gameState.strawBoatBorrowingArrowsDecision);
  }

  selectStrawBoatBorrowingArrowsForBot(playerId) {
    const decision = this.room.gameState.strawBoatBorrowingArrowsDecision;
    if (!decision || decision.playerId !== playerId) return null;
    const player = this.room.findPlayerById(playerId);
    if (!player) return null;

    const { trumpSuit, trumpRank, selectedRule } = this.room.gameState;
    const discardableCards = player.cards
      .filter(card => getCardPoints(card) === 0)
      .sort((left, right) => (
        getCardStrength(left, trumpSuit, trumpRank, selectedRule)
        - getCardStrength(right, trumpSuit, trumpRank, selectedRule)
      ));
    const weakestCard = discardableCards[0] || null;
    if (!weakestCard) return { accept: false, cardId: null };

    const borrowedStrength = getCardStrength(
      decision.borrowedCard,
      trumpSuit,
      trumpRank,
      selectedRule
    );
    const weakestStrength = getCardStrength(
      weakestCard,
      trumpSuit,
      trumpRank,
      selectedRule
    );
    const accept = borrowedStrength > weakestStrength;
    return { accept, cardId: accept ? weakestCard.id : null };
  }

  resolveStrawBoatBorrowingArrows(playerId, { accept = false, cardId = null } = {}) {
    const { gameState } = this.room;
    const decision = gameState.strawBoatBorrowingArrowsDecision;
    if (!decision) throw new Error('当前没有待处理的草船借箭');
    if (decision.playerId !== playerId) throw new Error('只有本轮首置位玩家可以决定草船借箭');

    const player = this.room.findPlayerById(playerId);
    if (!player) throw new Error('玩家不存在');

    let discardedCard = null;
    if (accept) {
      discardedCard = player.cards.find(card => card.id === cardId) || null;
      if (!discardedCard) throw new Error('请选择一张仍在手中的牌弃置');
      if (getCardPoints(discardedCard) !== 0) throw new Error('草船借箭只能弃置非分数牌');

      player.cards = player.cards.filter(card => card.id !== discardedCard.id);
      player.shownCards?.delete?.(discardedCard.id);
      player.cards.push(decision.borrowedCard);
      player.cards = DeckService.autoSortCards(player.cards);
    }

    const borrowedCard = decision.borrowedCard?.toJSON
      ? decision.borrowedCard.toJSON()
      : decision.borrowedCard;
    const publicDiscardedCard = discardedCard?.toJSON ? discardedCard.toJSON() : discardedCard;
    const result = {
      decisionId: decision.id,
      round: decision.round,
      playerId: player.id,
      playerName: player.name,
      accepted: Boolean(accept),
      leadingPoints: decision.leadingPoints,
      discardedCard: publicDiscardedCard,
      borrowedCard,
      message: accept
        ? `${player.name} 发动草船借箭：公开弃置一张非分数牌，并获得本轮最大非分数牌`
        : `${player.name} 放弃发动草船借箭`
    };
    gameState.strawBoatBorrowingArrowsDecision = null;
    gameState.strawBoatBorrowingArrowsLastResult = result;
    logger.info(`房间 ${this.room.id} ${result.message}`);
    return {
      ...result,
      handCards: player.cards.map(card => card.toJSON ? card.toJSON() : card)
    };
  }

  recomputeRoundWinner(plays = this.room.gameState.currentRoundPlays) {
    if (!Array.isArray(plays) || plays.length === 0) return null;
    const { gameState } = this.room;
    const comparablePlays = plays.filter(play => !play.lureTigerSilenced);
    if (comparablePlays.length === 0) return null;
    let winner = comparablePlays[0];
    for (const play of comparablePlays.slice(1)) {
      if (winner.oldHorseAbsolute) continue;
      if (play.oldHorseAbsolute) {
        winner = play;
        continue;
      }
      const comparison = compareCards(
        {
          cards: play.comparisonCards || play.cards,
          pattern: play.comparisonPattern || play.pattern,
          playerIndex: play.playerIndex
        },
        {
          cards: winner.comparisonCards || winner.cards,
          pattern: winner.comparisonPattern || winner.pattern,
          playerIndex: winner.playerIndex
        },
        gameState.leadingPattern?.suit,
        gameState.trumpSuit,
        gameState.trumpRank,
        this.getRuleRuntimeContext()
      );
      if (comparison > 0) winner = play;
    }
    gameState.currentWinnerIndex = winner.playerIndex;
    return winner;
  }

  hasPendingDestroyDykeDecision() {
    return Boolean(this.room.gameState.destroyDykeDecision);
  }

  assertDestroyDykeDecisionComplete() {
    const pending = this.room.gameState.destroyDykeDecision;
    if (!pending) return;
    throw new Error(`毁堤淹田：请等待${pending.dealerPlayerName || '庄家'}决定是否发动`);
  }

  getDestroyDykePublicDecision() {
    const pending = this.room.gameState.destroyDykeDecision;
    if (!pending) return null;
    return {
      round: pending.round,
      dealerPlayerId: pending.dealerPlayerId,
      dealerPlayerName: pending.dealerPlayerName,
      winnerPlayerId: pending.winnerPlayerId,
      winnerPlayerName: pending.winnerPlayerName,
      roundPoints: pending.roundPoints
    };
  }

  /** 闲家赢得有分的一轮后，暂存第四手，等庄家在实际计分前决定是否发动。 */
  holdDestroyDykeRoundForDecision({
    requestingPlayerId,
    turnPlayerId,
    playerIndex,
    cardIds
  }) {
    const { gameState } = this.room;
    if (
      !isDestroyDykeFloodFieldsRule(gameState.selectedRule)
      || this.isFinalizingDestroyDykeRound
      || gameState.destroyDykeUsed
      || gameState.destroyDykeDisaster
      || gameState.destroyDykeDecision
    ) {
      return null;
    }

    const winnerIndex = gameState.currentWinnerIndex;
    const dealerIndex = this.room.getPlayerIndex(gameState.buryingPlayerId);
    if (!this.isAttackerPlayerIndex(winnerIndex, dealerIndex)) return null;

    const roundCards = gameState.currentRoundPlays.flatMap(play => play.cards || []);
    const roundPoints = calculateRoundPoints(
      roundCards,
      card => this.getRuleCardPoints(card)
    );

    const deferredRoundPlay = gameState.currentRoundPlays.at(-1);
    const deferredHistoryPlay = gameState.playHistory.at(-1);
    if (
      deferredRoundPlay?.playerId !== turnPlayerId
      || deferredHistoryPlay?.playerId !== turnPlayerId
    ) {
      throw new Error('毁堤淹田轮末状态异常');
    }

    const dealer = this.room.findPlayerByIndex(dealerIndex);
    const winner = this.room.findPlayerByIndex(winnerIndex);
    gameState.currentRoundPlays.pop();
    gameState.playHistory.pop();
    gameState.playersPlayedThisRound.delete(playerIndex);
    gameState.currentPlayerIndex = null;
    gameState.trumpAction = null;
    this.recomputeRoundWinner();

    gameState.destroyDykeDecision = {
      round: gameState.currentRound,
      dealerPlayerId: dealer.id,
      dealerPlayerName: dealer.name,
      winnerPlayerId: winner.id,
      winnerPlayerName: winner.name,
      roundPoints,
      deferredFinalPlay: {
        requestingPlayerId,
        turnPlayerId,
        playerIndex,
        cardIds: [...cardIds],
        cards: deferredRoundPlay.originalCards || deferredRoundPlay.cards
      }
    };
    return this.getDestroyDykePublicDecision();
  }

  selectDestroyDykeForBot() {
    const pending = this.room.gameState.destroyDykeDecision;
    if (!pending) return false;
    const gameWouldEnd = this.room.players.every(player => this.getPlayableCardCount(player) === 0);
    return !gameWouldEnd && pending.roundPoints >= 10;
  }

  respondDestroyDyke(playerId, accept) {
    const { gameState } = this.room;
    const pending = gameState.destroyDykeDecision;
    if (!pending) throw new Error('当前没有待处理的毁堤淹田决定');
    if (pending.dealerPlayerId !== playerId) throw new Error('只有庄家可以发动毁堤淹田');

    const deferred = pending.deferredFinalPlay;
    const accepted = accept === true;
    gameState.destroyDykeDecision = null;
    if (accepted) {
      gameState.destroyDykeUsed = true;
      gameState.destroyDykeDisaster = {
        triggerRound: pending.round,
        voidedPoints: pending.roundPoints,
        roundsElapsed: 0,
        disasterAttackerPoints: 0
      };
      gameState.destroyDykeLastResult = {
        status: 'activated',
        round: pending.round,
        voidedPoints: pending.roundPoints
      };
    } else {
      gameState.destroyDykeLastResult = {
        status: 'declined',
        round: pending.round,
        roundPoints: pending.roundPoints
      };
    }
    this.io.to(this.room.id).emit(
      accepted ? 'destroy_dyke_activated' : 'destroy_dyke_declined',
      {
        accepted,
        round: pending.round,
        dealerPlayerId: pending.dealerPlayerId,
        dealerPlayerName: pending.dealerPlayerName,
        voidedPoints: accepted ? pending.roundPoints : 0,
        roundPoints: pending.roundPoints
      }
    );

    const finalPlayer = this.room.findPlayerById(deferred.turnPlayerId);
    gameState.currentPlayerIndex = deferred.playerIndex;
    deferred.cards.forEach(card => {
      if (!finalPlayer.cards.some(held => held.id === card.id)) finalPlayer.addCard(card);
    });
    finalPlayer.cards = DeckService.autoSortCards(finalPlayer.cards);

    let roundResult;
    this.isFinalizingDestroyDykeRound = true;
    try {
      roundResult = this.playCards(
        deferred.requestingPlayerId,
        deferred.cardIds,
        deferred.requestingPlayerId === deferred.turnPlayerId ? null : deferred.turnPlayerId
      );
    } finally {
      this.isFinalizingDestroyDykeRound = false;
    }

    return {
      accepted,
      round: pending.round,
      dealerPlayerId: pending.dealerPlayerId,
      dealerPlayerName: pending.dealerPlayerName,
      voidedPoints: accepted ? pending.roundPoints : 0,
      roundPoints: pending.roundPoints,
      roundResult
    };
  }

  resolveDestroyDykeIncident(reason, round = this.room.gameState.currentRound) {
    const { gameState } = this.room;
    const disaster = gameState.destroyDykeDisaster;
    if (!disaster) return null;
    const returnedPoints = disaster.voidedPoints;
    const incidentBonus = 20;
    const scoreDelta = returnedPoints + incidentBonus;
    gameState.attackerScore += scoreDelta;
    const result = {
      status: 'incident',
      reason,
      round,
      ...disaster,
      returnedPoints,
      incidentBonus,
      scoreDelta,
      attackerScore: gameState.attackerScore
    };
    gameState.destroyDykeDisaster = null;
    gameState.destroyDykeLastResult = result;
    this.io.to(this.room.id).emit('destroy_dyke_disaster_resolved', result);
    logger.info(
      `房间 ${this.room.id} 毁堤淹田事发：返还 ${returnedPoints} 分并额外增加20分，` +
      `闲家总分 ${gameState.attackerScore}`
    );
    return result;
  }

  advanceDestroyDykeDisasterAtRoundEnd({
    round,
    winnerIsAttacker,
    roundPoints,
    gameEnding = false
  }) {
    const { gameState } = this.room;
    const disaster = gameState.destroyDykeDisaster;
    if (!disaster) return null;
    if (round === disaster.triggerRound) {
      return { status: 'activated', ...disaster };
    }
    if (round < disaster.triggerRound) return null;

    disaster.roundsElapsed += 1;
    if (winnerIsAttacker) disaster.disasterAttackerPoints += roundPoints;
    if (disaster.disasterAttackerPoints >= 20) {
      return this.resolveDestroyDykeIncident('attacker_reached_20', round);
    }
    if (disaster.roundsElapsed >= 3) {
      // 末轮恰好也是第三个灾期轮时，闲家拿底仍然算“事发”，不能先让灾期自然失效。
      if (gameEnding && winnerIsAttacker) {
        return this.resolveDestroyDykeIncident('attacker_won_bottom', round);
      }
      const result = {
        status: 'expired',
        reason: 'three_rounds_completed',
        round,
        ...disaster,
        attackerScore: gameState.attackerScore
      };
      gameState.destroyDykeDisaster = null;
      gameState.destroyDykeLastResult = result;
      this.io.to(this.room.id).emit('destroy_dyke_disaster_resolved', result);
      logger.info(
        `房间 ${this.room.id} 毁堤淹田灾期结束：闲家三轮仅得 ` +
        `${result.disasterAttackerPoints} 分，作废的 ${result.voidedPoints} 分永久作废`
      );
      return result;
    }
    const result = { status: 'active', round, ...disaster };
    this.io.to(this.room.id).emit('destroy_dyke_disaster_updated', result);
    return result;
  }

  updateRecordOnFileAtRoundEnd({
    completedRound,
    hasPointCards,
    hasLevelOrJoker,
    hasNextRound
  }) {
    const gameState = this.room.gameState;
    if (!isRecordOnFileRule(gameState.selectedRule)) return null;

    const wasActive = gameState.recordOnFileActiveRound === completedRound;
    const nextActiveRound = (hasPointCards || hasLevelOrJoker) && hasNextRound
      ? completedRound + 1
      : null;
    gameState.recordOnFileLastActiveRound = wasActive ? completedRound : null;
    gameState.recordOnFileActiveRound = nextActiveRound;

    return {
      completedRound,
      wasActive,
      hadPointCards: Boolean(hasPointCards),
      hadLevelOrJoker: Boolean(hasLevelOrJoker),
      nextActiveRound
    };
  }

  resolveDestroyDykeAtGameEnd() {
    const disaster = this.room.gameState.destroyDykeDisaster;
    if (!disaster || disaster.roundsElapsed >= 3) return null;
    return this.resolveDestroyDykeIncident('game_ended_early');
  }

  hasPendingAmbiguousChoice() {
    return Boolean(this.room.gameState.ambiguousRoundDecision);
  }

  assertAmbiguousChoiceComplete() {
    const pending = this.room.gameState.ambiguousRoundDecision;
    if (!pending) return;
    const player = this.room.findPlayerById(pending.currentPlayerId);
    throw new Error(`请等待 ${player?.name || '玩家'} 选择模棱两可的最终出牌`);
  }

  getAmbiguousChoiceRequest(playerId = null) {
    const pending = this.room.gameState.ambiguousRoundDecision;
    if (!pending) return null;
    const targetPlayerId = playerId || pending.currentPlayerId;
    const selection = pending.selections.find(item => item.playerId === targetPlayerId);
    if (!selection) return null;
    return {
      round: pending.round,
      playerId: selection.playerId,
      playerName: selection.playerName,
      position: selection.position,
      usageConsumed: selection.usageConsumed,
      options: selection.options.map(option => ({
        index: option.index,
        cards: option.cards.map(card => card.toJSON ? card.toJSON() : card)
      }))
    };
  }

  holdAmbiguousRoundForChoice({
    requestingPlayerId,
    turnPlayerId,
    playerIndex,
    cardIds
  }) {
    const { gameState } = this.room;
    if (!isAmbiguousRule(gameState.selectedRule) || this.isFinalizingAmbiguousRound) {
      return null;
    }
    const ambiguousPlays = gameState.currentRoundPlays.filter(
      play => Array.isArray(play.ambiguousOptions) && play.ambiguousOptions.length === 2
    );
    if (ambiguousPlays.length === 0) return null;

    const deferredRoundPlay = gameState.currentRoundPlays.at(-1);
    const deferredHistoryPlay = gameState.playHistory.at(-1);
    if (
      deferredRoundPlay?.playerId !== turnPlayerId
      || deferredHistoryPlay?.playerId !== turnPlayerId
    ) {
      throw new Error('模棱两可轮末状态异常');
    }

    gameState.currentRoundPlays.pop();
    gameState.playHistory.pop();
    gameState.playersPlayedThisRound.delete(playerIndex);
    gameState.currentPlayerIndex = null;
    gameState.trumpAction = null;
    this.recomputeRoundWinner();

    const selections = ambiguousPlays
      .map(play => ({
        playerId: play.playerId,
        playerName: this.room.findPlayerById(play.playerId)?.name || '未知玩家',
        position: play.roundPosition,
        usageConsumed: Boolean(play.ambiguousUsageConsumed),
        selectedOptionIndex: null,
        options: play.ambiguousOptions
      }))
      .sort((a, b) => b.position - a.position);
    const queuePlayerIds = selections.map(selection => selection.playerId);
    gameState.ambiguousRoundDecision = {
      round: gameState.currentRound,
      currentPlayerId: queuePlayerIds[0],
      queuePlayerIds,
      selections,
      deferredFinalPlay: {
        requestingPlayerId,
        turnPlayerId,
        playerIndex,
        cardIds: [...cardIds],
        cards: deferredRoundPlay.originalCards || deferredRoundPlay.cards
      }
    };

    return {
      round: gameState.currentRound,
      currentPlayerId: queuePlayerIds[0],
      queuePlayerIds: [...queuePlayerIds],
      selections: selections.map(selection => ({
        playerId: selection.playerId,
        playerName: selection.playerName,
        position: selection.position,
        usageConsumed: selection.usageConsumed,
        options: selection.options.map(option => ({
          index: option.index,
          cards: option.cards.map(card => card.toJSON ? card.toJSON() : card)
        }))
      })),
      currentRequest: this.getAmbiguousChoiceRequest(queuePlayerIds[0])
    };
  }

  resolveAmbiguousChoice(playerId, optionIndex) {
    const { gameState } = this.room;
    const pending = gameState.ambiguousRoundDecision;
    if (!pending || pending.currentPlayerId !== playerId) {
      throw new Error('当前没有轮到你选择模棱两可的最终出牌');
    }
    const normalizedOptionIndex = Number(optionIndex);
    if (![0, 1].includes(normalizedOptionIndex)) {
      throw new Error('请选择方案A或方案B');
    }
    const selection = pending.selections.find(item => item.playerId === playerId);
    const play = gameState.currentRoundPlays.find(item => item.playerId === playerId);
    const selectedOption = selection?.options.find(
      option => option.index === normalizedOptionIndex
    );
    if (!selection || !play || !selectedOption) {
      throw new Error('模棱两可的出牌方案不存在');
    }

    const player = this.room.findPlayerById(playerId);
    const primaryCards = play.originalCards || play.cards;
    if (normalizedOptionIndex === 1) {
      const primaryIds = new Set(primaryCards.map(card => card.id));
      const selectedIds = new Set(selectedOption.cards.map(card => card.id));
      primaryCards.forEach(card => {
        if (!selectedIds.has(card.id) && !player.cards.some(held => held.id === card.id)) {
          player.addCard(card);
        }
      });
      player.cards = player.cards.filter(card => (
        !selectedIds.has(card.id) || primaryIds.has(card.id)
      ));
      player.cards = DeckService.autoSortCards(player.cards);
    }

    play.cards = selectedOption.cards;
    play.originalCards = selectedOption.cards;
    play.comparisonCards = selectedOption.cards;
    play.pattern = selectedOption.pattern;
    play.comparisonPattern = selectedOption.pattern;
    play.ambiguousSelectedOptionIndex = normalizedOptionIndex;
    const historyPlay = [...gameState.playHistory]
      .reverse()
      .find(item => item.playerId === playerId && item.activeSkillId === ActiveSkillIds.AMBIGUOUS);
    if (historyPlay) {
      historyPlay.cards = selectedOption.cards.map(card => card.toJSON ? card.toJSON() : card);
      historyPlay.ambiguousSelectedOptionIndex = normalizedOptionIndex;
    }
    selection.selectedOptionIndex = normalizedOptionIndex;
    this.recomputeRoundWinner();

    pending.queuePlayerIds.shift();
    pending.currentPlayerId = pending.queuePlayerIds[0] || null;
    const choice = {
      round: pending.round,
      playerId,
      playerName: selection.playerName,
      position: selection.position,
      optionIndex: normalizedOptionIndex,
      cards: selectedOption.cards.map(card => card.toJSON ? card.toJSON() : card),
      usageConsumed: selection.usageConsumed
    };
    const handCards = player.cards.map(card => card.toJSON ? card.toJSON() : card);
    if (pending.currentPlayerId) {
      return {
        completed: false,
        choice,
        handCards,
        nextDecision: this.getAmbiguousChoiceRequest(pending.currentPlayerId)
      };
    }

    const resolution = {
      round: pending.round,
      selections: pending.selections.map(item => {
        const option = item.options.find(candidate => candidate.index === item.selectedOptionIndex);
        return {
          playerId: item.playerId,
          playerName: item.playerName,
          position: item.position,
          optionIndex: item.selectedOptionIndex,
          usageConsumed: item.usageConsumed,
          cards: option.cards.map(card => card.toJSON ? card.toJSON() : card)
        };
      })
    };
    const deferred = pending.deferredFinalPlay;
    gameState.ambiguousRoundDecision = null;
    gameState.currentPlayerIndex = deferred.playerIndex;
    deferred.cards.forEach(card => {
      if (!this.room.findPlayerById(deferred.turnPlayerId).cards.some(held => held.id === card.id)) {
        this.room.findPlayerById(deferred.turnPlayerId).addCard(card);
      }
    });
    this.room.findPlayerById(deferred.turnPlayerId).cards = DeckService.autoSortCards(
      this.room.findPlayerById(deferred.turnPlayerId).cards
    );

    let roundResult;
    this.isFinalizingAmbiguousRound = true;
    try {
      roundResult = this.playCards(
        deferred.requestingPlayerId,
        deferred.cardIds,
        deferred.requestingPlayerId === deferred.turnPlayerId ? null : deferred.turnPlayerId
      );
    } finally {
      this.isFinalizingAmbiguousRound = false;
    }
    roundResult.ambiguousResolution = resolution;
    return {
      completed: true,
      choice,
      handCards,
      resolution,
      roundResult
    };
  }

  getThreeTigersPlaySuit(cards = []) {
    if (!Array.isArray(cards) || cards.length === 0) return null;
    const suit = cards[0]?.suit;
    if (!THREE_TIGERS_SUITS.includes(suit)) return null;
    const { trumpSuit, trumpRank } = this.room.gameState;
    return cards.every(card => (
      card?.suit === suit && !isTrumpCard(card, trumpSuit, trumpRank)
    )) ? suit : null;
  }

  /**
   * 每次落牌后重新统计本轮各副花色的“人头”。第三名玩家落下同一副花色的整手副牌时，
   * 当场把该花色已经打出的牌和之后的牌统一降四级，并按主牌重新计算赢家。
   * 主花色牌、级牌和王不计人数，也不参与转换。
   * comparisonCards 只用于显示和胜负；play.cards 始终保留实体牌面供计分使用。
   */
  applyThreeTigersAfterPlay(triggeredByPlayerId = null) {
    const { gameState } = this.room;
    if (!isThreeTigersRule(gameState.selectedRule)) return null;

    const plays = gameState.currentRoundPlays;
    const previousState = gameState.threeTigersRoundState;
    const suitContributors = Object.fromEntries(
      THREE_TIGERS_SUITS.map(suit => [suit, []])
    );
    for (const play of plays) {
      const suit = this.getThreeTigersPlaySuit(play.cards);
      if (suit) suitContributors[suit].push(play.playerId);
    }
    const suitCounts = Object.fromEntries(
      THREE_TIGERS_SUITS.map(suit => [suit, suitContributors[suit].length])
    );

    let triggeredSuit = previousState?.triggeredSuit || null;
    if (triggeredSuit && suitCounts[triggeredSuit] < 3) triggeredSuit = null;
    if (!triggeredSuit) {
      triggeredSuit = THREE_TIGERS_SUITS.find(suit => suitCounts[suit] >= 3) || null;
    }

    const wasActive = Boolean(previousState?.triggeredSuit);
    const isActive = Boolean(triggeredSuit);
    const triggeredNow = isActive && !wasActive;
    const reverted = wasActive && !isActive;

    for (const play of plays) {
      play.comparisonCards = isActive
        ? transformThreeTigersCards(
          play.cards,
          triggeredSuit,
          gameState.trumpRank,
          gameState.trumpSuit
        )
        : play.cards;
      play.comparisonPattern = detectPattern(
        play.comparisonCards,
        gameState.trumpSuit,
        gameState.trumpRank,
        this.getRuleRuntimeContext()
      );
    }
    const winner = this.recomputeRoundWinner();

    const state = {
      round: gameState.currentRound,
      triggeredSuit,
      triggeredAtPlayCount: isActive
        ? (previousState?.triggeredAtPlayCount || plays.length)
        : null,
      triggeredByPlayerId: isActive
        ? (previousState?.triggeredByPlayerId || triggeredByPlayerId)
        : null,
      contributingPlayerIds: isActive ? [...suitContributors[triggeredSuit]] : [],
      suitCounts
    };
    gameState.threeTigersRoundState = state;

    return {
      ...state,
      active: isActive,
      triggeredNow,
      reverted,
      plays: plays.map(play => ({
        playerId: play.playerId,
        playerName: this.room.findPlayerById(play.playerId)?.name || '未知玩家',
        cards: (play.comparisonCards || play.cards).map(
          card => card?.toJSON ? card.toJSON() : card
        )
      })),
      currentWinningPlayerId: winner?.playerId || null
    };
  }

  applyMagicTrickAtRoundEnd() {
    const { gameState } = this.room;
    const selection = gameState.magicTrickSelection;
    if (!isMagicTrickRule(gameState.selectedRule) || !selection) return null;
    if (selection.round !== gameState.currentRound) {
      gameState.magicTrickSelection = null;
      return null;
    }

    const [firstTargetId, secondTargetId] = selection.targetPlayerIds;
    const firstIndex = gameState.currentRoundPlays.findIndex(play => play.playerId === firstTargetId);
    const secondIndex = gameState.currentRoundPlays.findIndex(play => play.playerId === secondTargetId);
    if (firstIndex < 0 || secondIndex < 0) {
      gameState.magicTrickSelection = null;
      return null;
    }

    const firstPlay = gameState.currentRoundPlays[firstIndex];
    const secondPlay = gameState.currentRoundPlays[secondIndex];
    const keepSeat = (play, payload) => ({
      ...payload,
      playerIndex: play.playerIndex,
      playerId: play.playerId
    });
    gameState.currentRoundPlays[firstIndex] = keepSeat(firstPlay, secondPlay);
    gameState.currentRoundPlays[secondIndex] = keepSeat(secondPlay, firstPlay);
    const winner = this.recomputeRoundWinner();
    this.recordActiveSkillUse(selection.playerId, ActiveSkillIds.MAGIC_TRICK);
    gameState.magicTrickSelection = null;

    const activator = this.room.findPlayerById(selection.playerId);
    const result = {
      triggered: true,
      round: selection.round,
      activatorPlayerId: selection.playerId,
      activatorPlayerName: activator?.name || '未知玩家',
      targetPlayerIds: [firstTargetId, secondTargetId],
      targetPlayerNames: [firstPlay, secondPlay].map(play => (
        this.room.findPlayerById(play.playerId)?.name || '未知玩家'
      )),
      winnerPlayerId: winner?.playerId || null,
      plays: gameState.currentRoundPlays.map(play => ({
        playerId: play.playerId,
        playerName: this.room.findPlayerById(play.playerId)?.name || '未知玩家',
        cards: play.cards.map(card => card.toJSON ? card.toJSON() : card)
      }))
    };
    logger.info(
      `房间 ${this.room.id} 魔术戏法揭晓：交换 ${result.targetPlayerNames.join(' 与 ')} 的结算出牌`
    );
    return result;
  }

  applyAveragePoolingAtRoundEnd() {
    const { gameState } = this.room;
    if (!isAveragePoolingRule(gameState.selectedRule)) return null;
    const supportedTypes = new Set([PatternTypes.SINGLE, PatternTypes.PAIR]);
    const leadingPattern = gameState.leadingPattern;
    const pooledTeams = [];
    const leadingPlay = gameState.currentRoundPlays[0];
    const validRuffPlays = leadingPattern?.suit === 'trump'
      ? []
      : gameState.currentRoundPlays.slice(1).filter(play => {
          if (play.pattern?.suit !== 'trump') return false;
          if (leadingPattern?.type !== PatternTypes.THROW) {
            return play.pattern?.type === leadingPattern?.type
              && play.pattern?.length === leadingPattern?.length;
          }
          return compareCards(
            { cards: play.cards, pattern: play.pattern, playerIndex: play.playerIndex },
            {
              cards: leadingPlay.cards,
              pattern: leadingPlay.pattern,
              playerIndex: leadingPlay.playerIndex
            },
            leadingPattern.suit,
            gameState.trumpSuit,
            gameState.trumpRank,
            this.getRuleRuntimeContext()
          ) > 0;
        });

    if (validRuffPlays.length > 0) {
      // Complete legal ruffs form a higher tier than pooling. Resolve them at
      // raw trump strength and do not emit pooling metadata/badges for a result
      // that never participated in deciding the trick.
      const winner = this.recomputeRoundWinner(validRuffPlays);
      return {
        triggered: false,
        teams: [],
        exclusiveTeam: null,
        ruffPriority: true,
        ruffPlayerIds: validRuffPlays.map(play => play.playerId),
        winnerPlayerId: winner?.playerId || null
      };
    }
    const isCompetitiveSuit = play => play.pattern?.suit === leadingPattern?.suit || (
      leadingPattern?.suit !== 'trump' && play.pattern?.suit === 'trump'
    );
    const leadingSingleChannels = leadingPattern?.type === PatternTypes.THROW
      && Array.isArray(leadingPattern.components)
      && leadingPattern.components.length > 0
      && leadingPattern.components.every(component => component.type === PatternTypes.SINGLE)
      && leadingPattern.components.reduce(
        (total, component) => total + (component.length ?? component.cards?.length ?? 1),
        0
      ) === leadingPattern.length;

    if (leadingSingleChannels) {
      // A throw made only of singles creates one pooling channel per card. For
      // this rule only, a pair (or another stronger grouping) may be split
      // downward into single channels. This does not change ordinary throw
      // comparison: outside average pooling, a pair still cannot beat AK.
      for (const parity of [0, 1]) {
        const teamPlays = gameState.currentRoundPlays.filter(
          play => play.playerIndex % 2 === parity
        );
        if (teamPlays.length !== 2 || teamPlays.some(play => !isCompetitiveSuit(play))) continue;

        const channelStrengths = teamPlays.map(play => play.cards
          .map(card => getCardStrength(
            card,
            gameState.trumpSuit,
            gameState.trumpRank,
            this.getRuleRuntimeContext()
          ))
          .sort((left, right) => right - left));
        if (channelStrengths.some(strengths => strengths.length !== leadingPattern.length)) continue;

        const averageStrengths = channelStrengths[0].map((strength, index) =>
          (strength + channelStrengths[1][index]) / 2
        );
        const averageStrength = Math.max(...averageStrengths);
        teamPlays.forEach((play, playIndex) => {
          play.comparisonPattern = {
            ...(play.comparisonPattern || play.pattern),
            type: PatternTypes.THROW,
            components: averageStrengths.map(strength => ({
              type: PatternTypes.SINGLE,
              cards: [],
              length: 1,
              strength
            })),
            strength: averageStrength
          };
          play.averagePooling = {
            originalStrengths: channelStrengths[playIndex],
            averageStrengths,
            averageStrength
          };
        });
        pooledTeams.push({
          team: parity + 1,
          playerIds: teamPlays.map(play => play.playerId),
          originalStrengths: channelStrengths,
          averageStrengths,
          averageStrength,
          channelType: PatternTypes.SINGLE
        });
      }
    } else {
      for (const parity of [0, 1]) {
        const eligible = gameState.currentRoundPlays.filter(play => {
          const type = play.pattern?.type;
          if (play.playerIndex % 2 !== parity || !supportedTypes.has(type)) return false;
          if (type !== leadingPattern?.type) return false;
          return isCompetitiveSuit(play);
        });
        if (eligible.length !== 2 || eligible[0].pattern.type !== eligible[1].pattern.type) continue;

        const strengths = eligible.map(play => play.pattern.strength);
        const averageStrength = strengths.reduce((total, strength) => total + strength, 0) / strengths.length;
        eligible.forEach(play => {
          play.comparisonPattern = {
            ...(play.comparisonPattern || play.pattern),
            strength: averageStrength
          };
          play.averagePooling = {
            originalStrength: play.pattern.strength,
            averageStrength
          };
        });
        pooledTeams.push({
          team: parity + 1,
          playerIds: eligible.map(play => play.playerId),
          originalStrengths: strengths,
          averageStrength
        });
      }
    }

    let winner = null;
    if (pooledTeams.length === 1) {
      // Average pooling is resolved at team level first. A team whose two plays
      // both enter the pool beats a team that cannot form a pool (for example,
      // a pair plus two loose cards). Only then do we resolve which member of
      // the pooled team owns the trick; equal averaged strengths keep the
      // earlier play ahead, while a valid trump still outranks a side suit.
      const pooledTeam = pooledTeams[0];
      const pooledPlayerIds = new Set(pooledTeam.playerIds);
      const pooledTeamPlays = gameState.currentRoundPlays.filter(play =>
        pooledPlayerIds.has(play.playerId)
      );
      winner = this.recomputeRoundWinner(pooledTeamPlays);
      pooledTeam.winsByPoolingAdvantage = true;
    } else {
      // If both teams pool, compare their averaged plays normally. If neither
      // team pools, this simply preserves the ordinary trick result.
      winner = this.recomputeRoundWinner();
    }
    return {
      triggered: pooledTeams.length > 0,
      teams: pooledTeams,
      exclusiveTeam: pooledTeams.length === 1 ? pooledTeams[0].team : null,
      ruffPriority: false,
      ruffPlayerIds: [],
      winnerPlayerId: winner?.playerId || null
    };
  }

  applyJointHarmonyAtRoundEnd() {
    const { gameState } = this.room;
    if (!isJointHarmonyRule(gameState.selectedRule)) return null;
    const cardSignature = play => play.cards
      .map(card => `${card.suit}:${card.rank}`)
      .sort()
      .join('|');
    const matchingTeams = [];

    for (const parity of [0, 1]) {
      const teamPlays = gameState.currentRoundPlays.filter(play => play.playerIndex % 2 === parity);
      if (teamPlays.length !== 2 || cardSignature(teamPlays[0]) !== cardSignature(teamPlays[1])) continue;
      teamPlays.forEach(play => {
        play.jointHarmony = true;
      });
      matchingTeams.push({
        team: parity + 1,
        playerIds: teamPlays.map(play => play.playerId),
        laterPlayerId: teamPlays[1].playerId,
        laterPlayerIndex: teamPlays[1].playerIndex
      });
    }

    if (matchingTeams.length === 1) {
      gameState.currentWinnerIndex = matchingTeams[0].laterPlayerIndex;
    }
    return {
      triggered: matchingTeams.length > 0,
      bothTeams: matchingTeams.length === 2,
      teams: matchingTeams,
      winnerPlayerId: matchingTeams.length === 1 ? matchingTeams[0].laterPlayerId : null
    };
  }

  /** 返回当前座位的实际操作者；普通座位仍由自己操作。 */
  getTurnControllerPlayer(turnPlayerId) {
    const { openHandPlayerId, openHandControllerPlayerId } = this.room.gameState;
    const controllerId = turnPlayerId === openHandPlayerId
      ? openHandControllerPlayerId
      : turnPlayerId;
    return this.room.findPlayerById(controllerId);
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

    if (isTwoGhostsKnockDoorRule(this.room.gameState.selectedRule)) {
      this.updateRuleHandVisibilityAfterCardChange(player);
    }

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

    if (isPeopleCommuneRule(this.room.gameState.selectedRule)) {
      return this.buryPeopleCommuneCards(playerId, cardIds);
    }
    if (isAdministrativeReviewRule(this.room.gameState.selectedRule)) {
      return this.buryAdministrativeReviewCards(playerId, cardIds);
    }

    const activeBuryingPlayerId = this.room.gameState.secondaryBuryingPlayerId ||
      this.room.gameState.buryingPlayerId;
    if (activeBuryingPlayerId !== playerId) {
      throw new Error('你不是埋底玩家');
    }

    const requiredCount = this.room.gameState.bottomCardsCount;
    if (cardIds.length !== requiredCount) {
      throw new Error(`必须埋${requiredCount}张牌`);
    }

    const player = this.room.findPlayerById(playerId);
    const dealer = this.room.findPlayerById(this.room.gameState.buryingPlayerId);
    const isSecondary = Boolean(this.room.gameState.secondaryBuryingPlayerId);
    if (!player || !dealer) {
      throw new Error('埋底玩家不存在');
    }
    if (
      isReformAndOpeningUpRule(this.room.gameState.selectedRule) &&
      !isSecondary &&
      this.room.players.length !== 4
    ) {
      throw new Error('改革开放仅支持四人局');
    }

    // 找出要埋的牌
    const cardsTobury = player.cards.filter(card => cardIds.includes(card.id));
    if (cardsTobury.length !== requiredCount) {
      throw new Error('选择的牌不在手中');
    }

    // 移除并更新底牌
    player.removeCards(cardIds);
    this.room.gameState.bottomCards = cardsTobury;

    if (isReformAndOpeningUpRule(this.room.gameState.selectedRule) && !isSecondary) {
      const dealerIndex = this.room.getPlayerIndex(dealer.id);
      const secondaryBuryingPlayer = this.room.findPlayerByIndex((dealerIndex + 2) % 4);
      cardsTobury.forEach(card => secondaryBuryingPlayer.addCard(card));
      secondaryBuryingPlayer.cards = DeckService.autoSortCards(secondaryBuryingPlayer.cards);
      this.room.gameState.bottomCards = [];
      this.room.gameState.secondaryBuryingPlayerId = secondaryBuryingPlayer.id;

      const result = {
        completed: false,
        skipped: false,
        isSecondary: false,
        dealer,
        secondaryBuryingPlayer,
        transferredCards: cardsTobury
      };
      logger.info(`房间 ${this.room.id} 改革开放：底牌交给 ${secondaryBuryingPlayer.name} 重新埋底`);
      this.announceBuryResult(player, result);
      return result;
    }

    this.room.gameState.secondaryBuryingPlayerId = null;
    logger.info(`房间 ${this.room.id} ${isSecondary ? '再埋底' : '埋底'}完成`);

    // 进入出牌阶段
    this.room.gameState.phase = GamePhases.PLAYING;

    // 一马当先只替换第一轮首发座位；庄家及底牌归属始终保持不变。
    const dealerIndex = this.room.getPlayerIndex(dealer.id);
    const firstPlayerIndex = isOneHorseLeadsRule(this.room.gameState.selectedRule)
      ? (dealerIndex + 2) % this.room.players.length
      : dealerIndex;
    const firstPlayer = this.room.findPlayerByIndex(firstPlayerIndex);
    this.room.gameState.firstPlayerId = firstPlayer.id;
    this.room.gameState.currentPlayerIndex = firstPlayerIndex;
    this.room.gameState.roundStartPlayerIndex = firstPlayerIndex;
    this.room.gameState.currentRound = 1;
    this.room.gameState.playMode = PlayModes.ORDERED;
    this.room.gameState.playersPlayedThisRound.clear();
    this.beginIronEvidenceRound();

    // 创建回合管理器
    this.roundManager = new RoundManager(this.room);

    // 神兵牌只在埋底完成、正式出牌后出现，不向埋底阶段泄露额外信息。
    this.initializeDivineWeaponCards();
    // 第二战场的五张公共牌在第一张牌打出前一次性全部公开。
    this.initializeSecondBattlefield();
    this.initializeWoodenOx();
    this.applyStrengthCompensationForRound();
    this.openWoodenOxRoundWindow();
    this.initializeCandleToDawn(dealer);
    this.initializeOldHorse(firstPlayer.id);

    // 明牌必须晚于埋底，避免庄家根据队友手牌决定底牌。
    this.activatePerfectStrategy(dealer);
    this.activateRuleHandVisibility();
    // 十面埋伏也必须在埋底完成后、第一张牌打出前暗选。
    this.activateTenSidedAmbush(dealer);
    // 三权分立由初始2、3、4号位并行暗选，全部完成前禁止出第一张牌。
    this.activateThreePowers();
    // 君子一言按埋底后的最终手牌统计；并列最短花色全部声明前禁止出第一张牌。
    this.activateGentlemanPromise();
    // 潜龙在渊同样按埋底后的最终手牌统计；并列最多点数由对应玩家声明。
    this.activateHiddenDragonInAbyss();
    this.activateWaitingRabbit();
    this.activateAntinomy();
    this.activateChangeRiceToMulberry();
    // 焦点人物的两队表决同样发生在埋底之后；候选与票型只发给本队。
    this.activateFocusFigure();

    logger.info(
      `房间 ${this.room.id} 进入出牌阶段，${firstPlayer.name} 先出牌` +
      (firstPlayer.id !== dealer.id ? `（庄家仍为 ${dealer.name}）` : '')
    );

    const result = {
      completed: true,
      skipped: requiredCount === 0,
      isSecondary,
      firstPlayer
    };
    this.announceBuryResult(player, result);
    return result;
  }

  /** “人民公社”：庄家起按行动方向依次各埋两张，四家完成后才开始出牌。 */
  buryPeopleCommuneCards(playerId, cardIds) {
    const { gameState, players } = this.room;
    if (gameState.peopleCommuneCurrentBuryingPlayerId !== playerId) {
      throw new Error('当前还没有轮到你埋底');
    }
    if (!Array.isArray(cardIds) || cardIds.length !== 2 || new Set(cardIds).size !== 2) {
      throw new Error('人民公社必须埋两张不同的牌');
    }

    const player = this.room.findPlayerById(playerId);
    const dealer = this.room.findPlayerById(gameState.buryingPlayerId);
    if (!player || !dealer) throw new Error('埋底玩家不存在');
    if (gameState.peopleCommuneBuriedCardsByPlayerId.has(playerId)) {
      throw new Error('你已经完成埋底');
    }

    const cardsToBury = cardIds.map(cardId => player.cards.find(card => card.id === cardId));
    if (cardsToBury.some(card => !card)) throw new Error('选择的牌不在手中');

    player.removeCards(cardIds);
    gameState.peopleCommuneBuriedCardsByPlayerId.set(playerId, cardsToBury);
    const submittedCount = gameState.peopleCommuneBuriedCardsByPlayerId.size;
    const nextPlayerId = gameState.peopleCommuneBuryingOrder.find(
      currentPlayerId => !gameState.peopleCommuneBuriedCardsByPlayerId.has(currentPlayerId)
    ) || null;
    gameState.peopleCommuneCurrentBuryingPlayerId = nextPlayerId;

    if (nextPlayerId) {
      const nextPlayer = this.room.findPlayerById(nextPlayerId);
      this.io.to(this.room.id).emit('cards_buried', {
        playerId: player.id,
        playerName: player.name,
        skipped: false,
        isSecondary: false,
        completed: false,
        peopleCommune: true,
        submittedCount,
        totalCount: players.length
      });
      this.io.to(this.room.id).emit('burying_player_set', {
        playerId: nextPlayer.id,
        playerName: nextPlayer.name,
        peopleCommune: true
      });
      this.broadcastRoomUpdate();
      this.schedulePeopleCommuneBotBury(nextPlayer);
      return {
        completed: false,
        peopleCommune: true,
        submittedCount,
        nextPlayer
      };
    }

    gameState.bottomCards = gameState.peopleCommuneBuryingOrder.flatMap(
      currentPlayerId => gameState.peopleCommuneBuriedCardsByPlayerId.get(currentPlayerId) || []
    );
    logger.info(`房间 ${this.room.id} 人民公社：四家各埋两张，进入出牌阶段`);
    return this.completePeopleCommuneBurying(player, dealer);
  }

  schedulePeopleCommuneBotBury(player) {
    if (!player?.isBot || !isPeopleCommuneRule(this.room.gameState.selectedRule)) return false;
    if (this.peopleCommuneBuryTimer) clearTimeout(this.peopleCommuneBuryTimer);
    const timer = setTimeout(() => {
      try {
        const cardsToBury = this.selectBotCardsToBury(player, 2);
        this.buryCards(player.id, cardsToBury.map(card => card.id));
      } catch (error) {
        logger.error(`人民公社 Bot ${player.name} 自动埋底失败:`, error);
      } finally {
        if (this.peopleCommuneBuryTimer === timer) {
          this.peopleCommuneBuryTimer = null;
        }
      }
    }, 350);
    this.peopleCommuneBuryTimer = timer;
    return true;
  }

  completePeopleCommuneBurying(actor, dealer) {
    const gameState = this.room.gameState;
    gameState.secondaryBuryingPlayerId = null;
    gameState.phase = GamePhases.PLAYING;

    const dealerIndex = this.room.getPlayerIndex(dealer.id);
    const firstPlayer = this.room.findPlayerByIndex(dealerIndex);
    gameState.firstPlayerId = firstPlayer.id;
    gameState.currentPlayerIndex = dealerIndex;
    gameState.roundStartPlayerIndex = dealerIndex;
    gameState.currentRound = 1;
    gameState.playMode = PlayModes.ORDERED;
    gameState.playersPlayedThisRound.clear();
    this.beginIronEvidenceRound();

    this.roundManager = new RoundManager(this.room);
    this.initializeDivineWeaponCards();
    this.initializeSecondBattlefield();
    this.initializeWoodenOx();
    this.applyStrengthCompensationForRound();
    this.openWoodenOxRoundWindow();
    this.initializeCandleToDawn(dealer);
    this.initializeOldHorse(firstPlayer.id);
    this.activatePerfectStrategy(dealer);
    this.activateRuleHandVisibility();
    this.activateTenSidedAmbush(dealer);
    this.activateThreePowers();
    this.activateGentlemanPromise();
    this.activateHiddenDragonInAbyss();
    this.activateWaitingRabbit();
    this.activateAntinomy();
    this.activateChangeRiceToMulberry();
    this.activateFocusFigure();

    const result = {
      completed: true,
      skipped: false,
      isSecondary: false,
      peopleCommune: true,
      submittedCount: this.room.players.length,
      totalCount: this.room.players.length,
      firstPlayer
    };
    this.announceBuryResult(actor, result);
    return result;
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
    this.beginIronEvidenceRound();
    if (isLureTigerFromMountainRule(this.room.gameState.selectedRule)) {
      this.clearLureTigerSilenceForRound(1);
    }

    // 创建回合管理器
    this.roundManager = new RoundManager(this.room);
    this.initializeDivineWeaponCards();
    this.initializeSecondBattlefield();
    this.initializeWoodenOx();
    this.applyStrengthCompensationForRound();
    this.openWoodenOxRoundWindow();
    this.initializeOldHorse(playerId);
    this.activateAntinomy();
    this.activateChangeRiceToMulberry();
    this.beginOpeningAfterglowDecision(this.room.findPlayerById(playerId));

    logger.info(`房间 ${this.room.id} 首发玩家: ${this.room.findPlayerById(playerId).name}`);

    return this.room.findPlayerByIndex(playerIndex);
  }

  /**
   * 出牌 - 按照双升规则，有序出牌
   */
  playCards(
    requestingPlayerId,
    cardIds,
    controlledPlayerId = null,
    activeSkillId = null,
    playOptions = {}
  ) {
    const politicalReviewPending = this.preparePoliticalReviewForPlay(
      requestingPlayerId,
      cardIds,
      controlledPlayerId,
      activeSkillId,
      playOptions
    );
    if (politicalReviewPending && !politicalReviewPending.approved) {
      return {
        politicalReviewDeferred: true,
        politicalReviewPending,
        gameFinished: false
      };
    }

    const result = this.commitPlayCards(
      requestingPlayerId,
      politicalReviewPending?.cardIds || cardIds,
      controlledPlayerId,
      activeSkillId,
      playOptions
    );
    if (
      politicalReviewPending?.approved
      && this.room.gameState.politicalReviewApproval?.id === politicalReviewPending.approvalId
    ) {
      this.room.gameState.politicalReviewApproval = null;
    }
    return result;
  }

  commitPlayCards(
    requestingPlayerId,
    cardIds,
    controlledPlayerId = null,
    activeSkillId = null,
    playOptions = {}
  ) {
    if (this.room.gameState.phase !== GamePhases.PLAYING) {
      throw new Error('当前不是出牌阶段');
    }
    const ironEvidenceModeForPlay = this.ensureIronEvidenceRoundMode();
    if (this.hasPendingStrawBoatBorrowingArrowsDecision()) {
      throw new Error('请先完成草船借箭');
    }
    if (this.room.gameState.cardExchange?.stage === 'round') {
      throw new Error('请先完成本轮换牌');
    }
    if (this.room.gameState.equivalentReciprocityChallenge) {
      throw new Error('请先完成等价互惠拼点');
    }
    if (this.hasPendingMutualSupportAction()) {
      throw new Error('请先完成同舟共济交牌');
    }
    this.assertTimeReversalDecisionComplete();
    this.assertForbiddenMagicDecisionComplete();
    this.assertLureTigerDecisionComplete();
    this.assertIcebergSelectionComplete();
    this.assertTenSidedAmbushSelectionComplete();
    this.assertWaitingRabbitReady();
    this.assertThreePowersSelectionComplete();
    this.assertGentlemanPromiseSelectionComplete();
    this.assertHiddenDragonSelectionComplete();
    this.assertAntinomySelectionComplete();
    this.assertRiceToMulberrySelectionComplete();
    this.assertDestroyDykeDecisionComplete();
    this.assertAdministrativeReviewSelectionComplete();
    this.assertCandleSelectionComplete();
    this.assertFocusFigureVoteComplete();
    this.assertLastStandDecisionComplete();
    this.assertTeammateCheerDecisionComplete();
    this.assertAfterglowDecisionComplete();
    this.assertAmbiguousChoiceComplete();
    this.assertWoodenOxRoundWindowComplete();

    const requester = this.room.findPlayerById(requestingPlayerId);
    const turnPlayerId = controlledPlayerId || requestingPlayerId;
    const player = this.room.findPlayerById(turnPlayerId);

    if (!requester || !player) {
      throw new Error('玩家不存在');
    }

    const { openHandPlayerId, openHandControllerPlayerId } = this.room.gameState;
    const isProxyPlay = turnPlayerId === openHandPlayerId;
    if (isProxyPlay) {
      if (requestingPlayerId !== openHandControllerPlayerId) {
        if (requestingPlayerId === openHandPlayerId) {
          throw new Error('本局你的手牌由庄家代为操作');
        }
        throw new Error('只有庄家可以代替明手玩家出牌');
      }
    } else if (turnPlayerId !== requestingPlayerId) {
      throw new Error('不能代替该玩家出牌');
    }

    const wasDreamKillingSleeping = this.isDreamKillingSleeping(turnPlayerId);
    const isDreamKillingRandomPlay = playOptions?.dreamKillingRandom === true;
    if (wasDreamKillingSleeping && !isDreamKillingRandomPlay) {
      throw new Error('你仍在梦中，本次出牌由系统随机完成');
    }
    if (isDreamKillingRandomPlay && !wasDreamKillingSleeping) {
      throw new Error('该玩家当前不在梦中');
    }

    // 如果还没有回合管理器，说明还未设置首发玩家
    if (!this.roundManager) {
      throw new Error('还未设置首发玩家');
    }

    // 获取玩家索引
    const playerIndex = this.room.getPlayerIndex(turnPlayerId);

    // 验证是否轮到该玩家出牌
    if (!this.roundManager.canPlayerPlay(playerIndex)) {
      const mode = this.room.gameState.playMode;
      if (mode === PlayModes.ORDERED) {
        const currentPlayer = this.room.findPlayerByIndex(this.room.gameState.currentPlayerIndex);
        throw new Error(`现在不是你的回合，请等待 ${currentPlayer.name} 出牌`);
      }
    }

    // 验证牌是否在手中
    const woodenOxMule = this.getWoodenOxMuleHeldBy(player.id);
    const woodenOxStoredCard = woodenOxMule?.storedCard || null;
    let validCards = player.cards.filter(card => cardIds.includes(card.id));
    if (woodenOxStoredCard && cardIds.includes(woodenOxStoredCard.id)) {
      validCards.push(woodenOxStoredCard);
    }
    // 保存原始请求的牌（用于在甩牌失败时通知客户端哪些牌需要被退回）
    const originalRequestedCardIds = [...cardIds];
    const originalRequestedCards = [...validCards];
    if (validCards.length !== cardIds.length) {
      throw new Error('选择的牌不在手中');
    }
    if (isMutualSupportRule(this.room.gameState.selectedRule)) {
      const owedCards = this.getMutualSupportOwedCount(player.id);
      const selectedHandCardCount = validCards.filter(card => (
        player.cards.some(handCard => handCard.id === card.id)
      )).length;
      if (player.cards.length - selectedHandCardCount < owedCards) {
        throw new Error(`同舟共济：本轮结束时还需为队友保留${owedCards}张返还牌`);
      }
    }

    // 时间倒流必须保存“任何一张牌尚未打出”的状态。首份合法出牌请求在修改牌局前建快照。
    if (isTimeReversalRule(this.room.gameState.selectedRule)) {
      this.captureTimeReversalRoundSnapshot();
    }

    const trumpSuit = this.room.gameState.trumpSuit;
    const trumpRank = this.room.gameState.trumpRank;
    const activeRuleContext = this.getRuleRuntimeContext();

    // 判断是首发还是跟牌
    const isLeading = this.room.gameState.currentRoundPlays.length === 0;
    const lureTigerSilencedForPlay = this.isLureTigerSilenced(player.id);
    const activeBushGateRestriction = this.room.gameState.bushGateRestriction;
    const bushGateReplayRestriction = isLeading
      && activeBushGateRestriction?.round === this.room.gameState.currentRound
      && activeBushGateRestriction?.leaderPlayerId === player.id
      ? {
          ...activeBushGateRestriction,
          forbiddenCardIds: [...(activeBushGateRestriction.forbiddenCardIds || [])],
          returnedCards: (activeBushGateRestriction.returnedCards || []).map(card => ({ ...card }))
        }
      : null;
    const oldHorseAbsolute = this.isOldHorseAbsoluteLead(player.id, isLeading);
    if (
      isLeading
      && isRitesCollapseRule(this.room.gameState.selectedRule)
      && validCards.some(card => card.rank === Ranks.ACE)
      && player.cards.some(card => card.rank !== Ranks.ACE)
    ) {
      throw new Error('礼崩乐坏：一号位不能主动打出A');
    }
    const cooldownRequiredCount = isLeading
      ? 1
      : (this.room.gameState.leadingPattern?.length || 1);
    const ruleDisabledCards = getRuleDisabledCards({
      gameState: this.room.gameState,
      playerId: player.id,
      playerCards: player.cards,
      requiredCount: cooldownRequiredCount,
      isLeading
    });
    const ruleDisabledIds = new Set(ruleDisabledCards.map(card => card.id));
    if (validCards.some(card => ruleDisabledIds.has(card.id))) {
      const type = getCardCooldownType(this.room.gameState.selectedRule);
      throw new Error(
        isBushGateRule(this.room.gameState.selectedRule)
          ? '布什戈门：重新首发不能包含刚刚被收回的任意一张牌'
          : type === 'rank'
          ? '冷却时间：上轮打出的点数本轮不能再次打出'
          : type === 'suit'
            ? '时间冷却：上轮打出的花色本轮不能再次打出'
            : '鸟尽弓藏：该花色的分数牌已经全部打出，不能再主动打出该花色'
      );
    }
    const rulePlayableHandCards = getRulePlayableCards({
      gameState: this.room.gameState,
      playerId: player.id,
      playerCards: player.cards,
      requiredCount: cooldownRequiredCount,
      isLeading
    });
    let activeSkill = activeSkillId
      ? this.validateActiveSkillPlay(player, activeSkillId, validCards, isLeading)
      : null;
    const isOneCountryTwoSystems = isOneCountryTwoSystemsRule(
      this.room.gameState.selectedRule
    );
    let effectiveCards = isOneCountryTwoSystems
      ? mapOneCountryCards(
          validCards,
          playerIndex,
          this.room.gameState.oneCountryResolved
        )
      : validCards;
    let effectiveHandCards = isOneCountryTwoSystems
      ? mapOneCountryCards(
          rulePlayableHandCards,
          playerIndex,
          this.room.gameState.oneCountryResolved
        )
      : rulePlayableHandCards;
    let jokerSubstitutions = [];
    let clusterAnalysisSubstitutions = [];
    let forbiddenMagicSubstitutions = [];
    let divineWeaponTransformation = null;
    let illusionAndRealitySuit = null;
    let ambiguousAlternativeCards = null;
    let ambiguousAlternativePattern = null;
    const isForbiddenMagicActive = Boolean(
      isForbiddenMagicRule(this.room.gameState.selectedRule)
      && this.room.gameState.forbiddenMagicActivePlayerIds.has(player.id)
    );
    if (!isForbiddenMagicActive && (playOptions.forbiddenMagicSubstitutions || []).length > 0) {
      throw new Error('请先确认发动禁术秘法');
    }
    if (isForbiddenMagicActive) {
      const resolution = resolveForbiddenMagicPlay({
        selectedCards: validCards,
        handCards: rulePlayableHandCards,
        substitutions: playOptions.forbiddenMagicSubstitutions,
        leadingPattern: isLeading ? null : this.room.gameState.leadingPattern,
        trumpSuit,
        trumpRank,
        activeRule: activeRuleContext
      });
      if (!resolution.valid) throw new Error(resolution.message);
      effectiveCards = resolution.effectiveCards;
      effectiveHandCards = resolution.effectiveHandCards;
      forbiddenMagicSubstitutions = resolution.substitutions;
    }
    if (activeSkill?.id === ActiveSkillIds.STEALING_BEAMS) {
      const resolution = resolveJokerSubstitutionPlay({
        selectedCards: validCards,
        handCards: player.cards,
        substitutions: playOptions.jokerSubstitutions,
        leadingPattern: isLeading ? null : this.room.gameState.leadingPattern,
        trumpSuit,
        trumpRank,
        activeRule: activeRuleContext
      });
      if (!resolution.valid) throw new Error(resolution.message);
      if (!resolution.usesSkill) {
        activeSkill = null;
      } else {
        effectiveCards = resolution.effectiveCards;
        effectiveHandCards = resolution.effectiveHandCards;
        jokerSubstitutions = resolution.substitutions;
      }
    }
    if (activeSkill?.id === ActiveSkillIds.DIVINE_WEAPON) {
      const resolution = this.resolveDivineWeaponPlay(
        player,
        validCards,
        rulePlayableHandCards,
        playOptions
      );
      effectiveCards = resolution.effectiveCards;
      effectiveHandCards = resolution.effectiveHandCards;
      divineWeaponTransformation = resolution;
    }
    if (activeSkill?.id === ActiveSkillIds.CLUSTER_ANALYSIS) {
      const resolution = resolveClusterAnalysisPlay({
        selectedCards: validCards,
        handCards: rulePlayableHandCards,
        substitutions: playOptions.clusterAnalysisSubstitutions,
        leadingPattern: isLeading ? null : this.room.gameState.leadingPattern,
        trumpSuit,
        trumpRank,
        activeRule: activeRuleContext
      });
      if (!resolution.valid) throw new Error(resolution.message);
      effectiveCards = resolution.effectiveCards;
      effectiveHandCards = resolution.effectiveHandCards;
      clusterAnalysisSubstitutions = resolution.substitutions;
    }
    if (activeSkill?.id === ActiveSkillIds.ILLUSION_AND_REALITY) {
      const leadingSuit = this.room.gameState.leadingPattern?.suit;
      if (isLeading || !leadingSuit) {
        throw new Error('虚虚实实只能在跟牌时发动');
      }
      if (leadingSuit === 'trump') {
        throw new Error('虚虚实实只能虚置当前要求跟出的副花色');
      }
      const virtualizedCards = rulePlayableHandCards.filter(card => (
        getEffectiveSuit(card, trumpSuit, trumpRank) === leadingSuit
      ));
      if (virtualizedCards.length === 0 || virtualizedCards.length % 2 === 0) {
        throw new Error('虚虚实实要求对应副花色恰好剩余奇数张');
      }
      if (validCards.some(card => (
        getEffectiveSuit(card, trumpSuit, trumpRank) === leadingSuit
      ))) {
        throw new Error('发动虚虚实实时不能打出被虚置的副花色牌');
      }
      const requiredCount = this.room.gameState.leadingPattern.length || 1;
      if (rulePlayableHandCards.length - virtualizedCards.length < requiredCount) {
        throw new Error(`虚置后其余手牌不足${requiredCount}张，不能发动虚虚实实`);
      }
      effectiveHandCards = effectiveHandCards.filter(card => (
        getEffectiveSuit(card, trumpSuit, trumpRank) !== leadingSuit
      ));
      illusionAndRealitySuit = leadingSuit;
    }
    const afterglowWasActive = Boolean(
      isAfterglowRule(this.room.gameState.selectedRule)
      && trumpSuit !== Suits.NO_TRUMP
      && this.room.gameState.afterglowActivePlayerIds.has(player.id)
    );
    const afterglowHeldTrumps = afterglowWasActive
      ? rulePlayableHandCards.filter(card => isTrumpCard(card, trumpSuit, trumpRank))
      : [];
    const afterglowActiveForPlay = afterglowWasActive && afterglowHeldTrumps.length > 0;
    if (afterglowWasActive && afterglowHeldTrumps.length === 0) {
      this.room.gameState.afterglowActivePlayerIds.delete(player.id);
    }
    if (afterglowActiveForPlay) {
      if (!validCards.every(card => isTrumpCard(card, trumpSuit, trumpRank))) {
        throw new Error('回光返照：只要手中仍有主牌，本次出牌就只能由主牌组成，不能混入副牌');
      }
      effectiveCards = this.transformAfterglowCards(effectiveCards);
    }
    const playRuleContext = activeSkill?.id === ActiveSkillIds.BELT_AND_ROAD
      ? { ...activeRuleContext, beltAndRoadSkillActive: true }
      : activeRuleContext;
    const treatedAsSmall = activeSkill?.id === ActiveSkillIds.SUBSTITUTE_SACRIFICE;
    // “暗度陈仓”由跟牌玩家主动发动；“无人生还”则让每墩二至四号位自动暗置。
    // 两者共用同一套私发牌面、隐藏当前赢家及轮末统一翻牌流程。
    const concealed = activeSkill?.id === ActiveSkillIds.CONCEALED_PASSAGE
      || (isNoOneSurvivesRule(this.room.gameState.selectedRule) && !isLeading);

    if (activeSkill?.id === ActiveSkillIds.AMBIGUOUS) {
      const alternativeCardIds = Array.isArray(playOptions.ambiguousAlternativeCardIds)
        ? [...new Set(playOptions.ambiguousAlternativeCardIds)]
        : [];
      ambiguousAlternativeCards = player.cards.filter(card => (
        alternativeCardIds.includes(card.id)
      ));
      if (ambiguousAlternativeCards.length !== alternativeCardIds.length) {
        throw new Error('模棱两可的备选牌不在手中');
      }
      const primarySignature = [...validCards.map(card => card.id)].sort().join('|');
      const alternativeSignature = [...alternativeCardIds].sort().join('|');
      if (primarySignature === alternativeSignature) {
        throw new Error('模棱两可必须展示两种不同的出牌方式');
      }
      const alternativeValidation = validateFollowingPlay(
        ambiguousAlternativeCards,
        rulePlayableHandCards,
        this.room.gameState.leadingPattern,
        trumpSuit,
        trumpRank,
        activeRuleContext
      );
      if (!alternativeValidation.valid) {
        throw new Error(`模棱两可方案B不合法：${alternativeValidation.message}`);
      }
      ambiguousAlternativePattern = alternativeValidation.pattern || detectPattern(
        ambiguousAlternativeCards,
        trumpSuit,
        trumpRank,
        activeRuleContext
      );
    }

    let pattern;
    let comparisonPattern = null;
    let enduringInheritance = null;
    let dreamKilling = null;
    let throwResult = null;
    let throwFailed = false;
    const detectDreamRandomPattern = cards => {
      const detected = detectPattern(cards, trumpSuit, trumpRank, playRuleContext);
      if (detected.type !== PatternTypes.INVALID) return detected;
      const effectiveSuits = [...new Set(
        cards.map(card => getEffectiveSuit(card, trumpSuit, trumpRank))
      )];
      return {
        type: PatternTypes.INVALID,
        suit: effectiveSuits.length === 1 ? effectiveSuits[0] : 'mixed',
        length: cards.length,
        strength: cards.length > 0
          ? Math.max(...cards.map(card => getCardStrength(
              card,
              trumpSuit,
              trumpRank,
              playRuleContext
            )))
          : 0
      };
    };

    if (isLeading) {
      if (isDreamKillingRandomPlay) {
        pattern = detectDreamRandomPattern(effectiveCards);
      } else {
        // 首发出牌验证
        const validation = validateLeadingPlay(
          effectiveCards,
          trumpSuit,
          trumpRank,
          playRuleContext
        );
        if (!validation.valid) {
          throw new Error(validation.message);
        }
        pattern = validation.pattern;
      }

      const isBeltAndRoadLead = pattern.type === PatternTypes.BELT_AND_ROAD;
      if (activeSkill?.id === ActiveSkillIds.BELT_AND_ROAD && !isBeltAndRoadLead) {
        throw new Error('一带一路必须首发同一有效花色的两张非对子单牌');
      }

      // 检测是否是甩牌（多个组件的组合）
      const parsed = parseThrowCombination(
        effectiveCards,
        trumpSuit,
        trumpRank,
        playRuleContext
      );
      if (
        !isDreamKillingRandomPlay
        && pattern.type !== PatternTypes.BELT_AND_ROAD
        && parsed.valid
        && parsed.components.length > 1
      ) {
        // 这是一个甩牌尝试
        logger.info(`玩家 ${player.name} 尝试甩牌，包含 ${parsed.components.length} 个组件`);

        // 获取其他玩家的手牌
        const otherPlayersCards = this.room.players
          .filter(p => p.id !== turnPlayerId && !this.isLureTigerSilenced(p.id))
          .map(p => {
            const playableCards = getRulePlayableCards({
              gameState: this.room.gameState,
              playerId: p.id,
              playerCards: p.cards,
              requiredCount: validCards.length,
              isLeading: false
            });
            const heldStoredCard = this.getWoodenOxStoredCardForPlayer(p.id);
            const availableCards = heldStoredCard
              ? [...playableCards, heldStoredCard]
              : playableCards;
            const ruleEffectiveCards = this.room.gameState.forbiddenMagicActivePlayerIds.has(p.id)
              ? demoteForbiddenMagicHand(availableCards, trumpSuit, trumpRank)
              : availableCards;
            return isOneCountryTwoSystems
              ? mapOneCountryCards(
                  ruleEffectiveCards,
                  this.room.getPlayerIndex(p.id),
                  this.room.gameState.oneCountryResolved
                )
              : ruleEffectiveCards;
          });

        // 验证甩牌
        throwResult = validateThrow(
          effectiveCards,
          otherPlayersCards,
          trumpSuit,
          trumpRank,
          playRuleContext
        );

        if (!throwResult.success) {
          // 甩牌失败，强制出小
          logger.info(`甩牌失败：${throwResult.message}，强制出最小组件`);
          throwFailed = true;

          // 替换为强制出的牌
          effectiveCards = throwResult.forcedCards;
          const forcedIds = new Set(effectiveCards.map(card => card.id));
          validCards = validCards.filter(card => forcedIds.has(card.id));
          cardIds = validCards.map(card => card.id);
          jokerSubstitutions = jokerSubstitutions.filter(substitution =>
            forcedIds.has(substitution.cardId)
          );
          clusterAnalysisSubstitutions = clusterAnalysisSubstitutions.filter(substitution =>
            forcedIds.has(substitution.cardId)
          );
          forbiddenMagicSubstitutions = forbiddenMagicSubstitutions.filter(substitution =>
            forcedIds.has(substitution.cardId)
          );
          if (
            divineWeaponTransformation
            && !forcedIds.has(divineWeaponTransformation.sourceCard.id)
          ) {
            // 甩牌失败后若真正打出的最小组件不含转化牌，本次不消耗技能。
            activeSkill = null;
            divineWeaponTransformation = null;
            effectiveCards = validCards;
          }
          if (
            activeSkill?.id === ActiveSkillIds.STEALING_BEAMS
            && jokerSubstitutions.length === 0
          ) {
            // 甩牌失败后若强制打出的最小组件不含已转换的王，本次不消耗偷梁换柱。
            activeSkill = null;
            effectiveCards = validCards;
            effectiveHandCards = rulePlayableHandCards;
          }
          if (
            activeSkill?.id === ActiveSkillIds.CLUSTER_ANALYSIS
            && clusterAnalysisSubstitutions.length === 0
          ) {
            activeSkill = null;
            effectiveCards = validCards;
            effectiveHandCards = rulePlayableHandCards;
          }

          // 重新检测牌型
          pattern = detectPattern(
            effectiveCards,
            trumpSuit,
            trumpRank,
            playRuleContext
          );
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

      const enduringResolution = this.resolveEnduringPlay(turnPlayerId, effectiveCards, pattern);
      comparisonPattern = enduringResolution.comparisonPattern;
      enduringInheritance = enduringResolution.inheritance;
      dreamKilling = this.resolveDreamKillingPlay(
        player,
        validCards,
        pattern,
        wasDreamKillingSleeping
      );

      // 记录首发牌型
      this.room.gameState.leadingPattern = pattern;
      this.room.gameState.currentWinnerIndex = playerIndex;
    } else {
      // 跟牌验证
      const leadingPattern = this.room.gameState.leadingPattern;
      if (isDreamKillingRandomPlay) {
        if (validCards.length !== leadingPattern.length) {
          throw new Error(`梦中随机出牌必须抽取 ${leadingPattern.length} 张牌`);
        }
        pattern = detectDreamRandomPattern(effectiveCards);
      } else if (afterglowActiveForPlay) {
        if (validCards.length !== leadingPattern.length) {
          throw new Error(`回光返照：本轮必须打出 ${leadingPattern.length} 张牌`);
        }
        const detectedPattern = detectPattern(
          effectiveCards,
          trumpSuit,
          trumpRank,
          playRuleContext
        );
        const effectiveSuits = [...new Set(
          effectiveCards.map(card => getEffectiveSuit(card, trumpSuit, trumpRank))
        )];
        pattern = detectedPattern.type === PatternTypes.INVALID
          ? {
              type: 'afterglow_free_play',
              suit: effectiveSuits.length === 1 ? effectiveSuits[0] : 'mixed',
              length: validCards.length,
              strength: Math.max(...effectiveCards.map(card => getCardStrength(
                card,
                trumpSuit,
                trumpRank,
                playRuleContext
              )))
            }
          : detectedPattern;
      } else if (treatedAsSmall) {
        const detectedPattern = detectPattern(
          effectiveCards,
          trumpSuit,
          trumpRank,
          playRuleContext
        );
        pattern = detectedPattern.type === PatternTypes.INVALID
          ? {
              type: 'active_skill_discard',
              suit: null,
              length: validCards.length,
              strength: Number.NEGATIVE_INFINITY
            }
          : detectedPattern;
      } else {
        const validation = validateFollowingPlay(
          effectiveCards,
          effectiveHandCards,
          leadingPattern,
          trumpSuit,
          trumpRank,
          playRuleContext
        );
        if (!validation.valid) {
          throw new Error(validation.message);
        }
        pattern = validation.pattern || detectPattern(
          effectiveCards,
          trumpSuit,
          trumpRank,
          playRuleContext
        );
      }

      const enduringResolution = this.resolveEnduringPlay(turnPlayerId, effectiveCards, pattern);
      comparisonPattern = enduringResolution.comparisonPattern;
      enduringInheritance = enduringResolution.inheritance;
      dreamKilling = this.resolveDreamKillingPlay(
        player,
        validCards,
        pattern,
        wasDreamKillingSleeping
      );

      // 比较大小，更新当前最大者
      const currentWinnerIndex = this.room.gameState.currentWinnerIndex;
      const currentWinnerPlay = this.room.gameState.currentRoundPlays.find(
        p => p.playerIndex === currentWinnerIndex
      );
      const firstSuccessfulDreamPlay = this.room.gameState.currentRoundPlays.find(
        play => play.dreamKilling?.success
      );

      if (dreamKilling?.success) {
        // 同一轮多人命中时严格保留先出者；后出的成功牌仍会醒来，但不能夺走本轮牌权。
        if (!firstSuccessfulDreamPlay) {
          this.room.gameState.currentWinnerIndex = playerIndex;
        }
      } else if (
        currentWinnerPlay
        && !currentWinnerPlay.oldHorseAbsolute
        && !treatedAsSmall
        && !lureTigerSilencedForPlay
        && !firstSuccessfulDreamPlay
      ) {
        const comparison = compareCards(
          { cards: effectiveCards, pattern: comparisonPattern, playerIndex },
          {
            cards: currentWinnerPlay.comparisonCards || currentWinnerPlay.cards,
            pattern: currentWinnerPlay.comparisonPattern || currentWinnerPlay.pattern,
            playerIndex: currentWinnerIndex
          },
          this.room.gameState.leadingPattern.suit,
          trumpSuit,
          trumpRank,
          playRuleContext
        );

        if (comparison > 0) {
          // 新出的牌更大
          const previousWinnerIndex = this.room.gameState.currentWinnerIndex;
          const previousWinner = this.room.findPlayerByIndex(previousWinnerIndex);
          const recordTrumpAction = type => {
            this.room.gameState.trumpAction = {
              type,
              playerId: player.id,
              playerName: player.name,
              targetPlayerId: previousWinner?.id || currentWinnerPlay.playerId || null,
              targetPlayerName: previousWinner?.name || currentWinnerPlay.playerName || null
            };
          };
          this.room.gameState.currentWinnerIndex = playerIndex;
          logger.info(`房间 ${this.room.id} 玩家 ${player.name} 的牌更大`);

          // 检测毙了/盖毙
          const newIsTrump = pattern.suit === 'trump';
          const oldIsTrump = currentWinnerPlay.pattern.suit === 'trump';
          const leadIsTrump = this.room.gameState.leadingPattern.suit === 'trump';
          const leadIsInferior = isThreeSixNineGradesRule(this.room.gameState.selectedRule)
            && Boolean(this.room.gameState.inferiorSuit)
            && this.room.gameState.leadingPattern.suit === this.room.gameState.inferiorSuit;
          const newIsOrdinarySide = leadIsInferior
            && pattern.suit !== 'trump'
            && pattern.suit !== this.room.gameState.inferiorSuit;
          const oldIsOrdinarySide = leadIsInferior
            && currentWinnerPlay.pattern.suit !== 'trump'
            && currentWinnerPlay.pattern.suit !== this.room.gameState.inferiorSuit;

          // 只有首牌是副牌时，才能有"毙了"和"盖毙"
          if (!leadIsTrump) {
            if (leadIsInferior && (
              (newIsTrump && (oldIsTrump || oldIsOrdinarySide))
              || (newIsOrdinarySide && oldIsOrdinarySide)
            )) {
              recordTrumpAction('overtrump');
              logger.info(`房间 ${this.room.id} 玩家 ${player.name} 盖毙！`);
            } else if (
              leadIsInferior
              && ((newIsTrump && !oldIsTrump) || (newIsOrdinarySide && !oldIsOrdinarySide))
            ) {
              recordTrumpAction('trump');
              logger.info(`房间 ${this.room.id} 玩家 ${player.name} 毙了！`);
            } else if (newIsTrump && oldIsTrump) {
              // 盖毙：首牌是副牌，之前有人用主牌"毙了"，现在用更大的主牌再压掉
              recordTrumpAction('overtrump');
              logger.info(`房间 ${this.room.id} 玩家 ${player.name} 盖毙！`);
            } else if (newIsTrump && !oldIsTrump) {
              // 毙了：首牌是副牌，用主牌压副牌
              recordTrumpAction('trump');
              logger.info(`房间 ${this.room.id} 玩家 ${player.name} 毙了！`);
            }
          }
        }
      }
    }

    const priorAmbiguousActivation = activeSkill?.id === ActiveSkillIds.AMBIGUOUS
      && this.room.gameState.currentRoundPlays.some(
        play => play.activeSkillId === ActiveSkillIds.AMBIGUOUS
      );
    const activeSkillUseConsumed = Boolean(
      activeSkill
      && activeSkill.usageLimit !== null
      && !(activeSkill.id === ActiveSkillIds.AMBIGUOUS && priorAmbiguousActivation)
    );
    const ambiguousOptions = activeSkill?.id === ActiveSkillIds.AMBIGUOUS
      ? [
          { index: 0, cards: validCards, pattern },
          { index: 1, cards: ambiguousAlternativeCards, pattern: ambiguousAlternativePattern }
        ]
      : null;
    const activeSkillActivation = activeSkill ? {
      id: activeSkill.id,
      name: activeSkill.name,
      playerId: player.id,
      playerName: player.name,
      usageConsumed: activeSkillUseConsumed,
      treatedAsSmall,
      concealed,
      ignoredSuit: illusionAndRealitySuit,
      divineWeaponTransformation: divineWeaponTransformation?.publicInfo || null,
      clusterAnalysisSubstitutions
    } : null;
    if (activeSkill) {
      if (activeSkillUseConsumed) {
        this.recordActiveSkillUse(player.id, activeSkill.id);
      }
      if (activeSkill.id === ActiveSkillIds.DIVINE_WEAPON) {
        this.room.gameState.divineWeaponUsedThisRound = true;
        this.room.gameState.divineWeaponUsedByPlayerId = player.id;
        this.room.gameState.divineWeaponUsedCardId = divineWeaponTransformation.targetCard.id;
      }
      logger.info(`房间 ${this.room.id} 玩家 ${player.name} 发动 ${activeSkill.name}`);
    }

    const playedDisplayCards = [
      ActiveSkillIds.DIVINE_WEAPON,
      ActiveSkillIds.STEALING_BEAMS,
      ActiveSkillIds.CLUSTER_ANALYSIS
    ].includes(activeSkill?.id) || isForbiddenMagicActive || afterglowActiveForPlay
      ? effectiveCards
      : validCards;

    // 甩牌失败时只以最终被强制打出的牌判断首次出现。
    let tenSidedAmbushReveal = this.revealTenSidedAmbushIfNeeded(validCards, player);
    let threePowersReveal = this.revealThreePowersIfNeeded(validCards, player);

    // 盒中牌可以和手牌一起打出，但它不在玩家的实体手牌数组中。
    const playedWoodenOxCardIds = woodenOxStoredCard && validCards.some(
      card => card.id === woodenOxStoredCard.id
    ) ? [woodenOxStoredCard.id] : [];
    const playedWoodenOxCardIdSet = new Set(playedWoodenOxCardIds);
    player.removeCards(cardIds.filter(cardId => !playedWoodenOxCardIdSet.has(cardId)));
    const ironEvidenceBigJokerIds = this.recordIronEvidenceBigJokers(validCards);
    if (playedWoodenOxCardIds.length > 0 && woodenOxMule) {
      woodenOxMule.storedCard = null;
      this.emitWoodenOxPrivateState(player.id);
      this.io.to(this.room.id).emit('wooden_ox_card_played', {
        playerId: player.id,
        playerName: player.name,
        teamIndex: woodenOxMule.teamIndex,
        cardId: playedWoodenOxCardIds[0]
      });
    }
    let afterglowExpired = null;
    if (
      afterglowActiveForPlay
      && this.getAfterglowTrumpCards(player).length === 0
    ) {
      this.room.gameState.afterglowActivePlayerIds.delete(player.id);
      afterglowExpired = {
        playerId: player.id,
        playerName: player.name,
        round: this.room.gameState.currentRound
      };
    }
    const lastStandRequest = this.requestLastStandIfEligible(player);
    let wholeHandExchange = null;
    let roundCardExchange = null;
    let plannedEconomyDraw = null;
    const encircleThreeMissingOneRecordUpdate = this.recordEncircleThreeMissingOnePlay(validCards);
    const waitingRabbitPointEntries = this.recordWaitingRabbitPointAppearances(validCards);
    const hiddenDragonUpdate = this.recordHiddenDragonPlay(player, validCards);
    const administrativeReviewUpdate = this.recordAdministrativeReviewPlay(player, validCards);

    // 记录当前轮出牌
    this.room.gameState.currentRoundPlays.push({
      playerIndex,
      playerId: turnPlayerId,
      cards: playedDisplayCards,
      // 鸟尽弓藏按未转化的实体牌统计，并且只在整墩完成后固化，避免撤回也被误计。
      originalCards: validCards,
      comparisonCards: effectiveCards,
      pattern,
      comparisonPattern: comparisonPattern || pattern,
      enduringInheritance,
      activeSkillId: activeSkill?.id || null,
      activeSkillName: activeSkill?.name || null,
      treatedAsSmall,
      concealed,
      jokerSubstitutions,
      clusterAnalysisSubstitutions,
      forbiddenMagicSubstitutions,
      dreamKilling,
      oldHorseAbsolute,
      woodenOxCardIds: playedWoodenOxCardIds,
      afterglowActive: afterglowActiveForPlay,
      roundPosition: this.room.gameState.currentRoundPlays.length + 1,
      ambiguousOptions,
      ambiguousUsageConsumed: activeSkillUseConsumed,
      ironEvidenceMode: ironEvidenceModeForPlay,
      ironEvidenceBigJokerIds,
      waitingRabbitPointEntries,
      lureTigerSilenced: lureTigerSilencedForPlay
    });

    const oldHorseAbsolutePlay = oldHorseAbsolute
      ? this.consumeOldHorseAbsoluteLead(player, validCards)
      : null;

    const threeTigersTransformation = this.applyThreeTigersAfterPlay(turnPlayerId);
    const threeTigersPlayedCards = threeTigersTransformation?.active
      ? threeTigersTransformation.plays.find(play => play.playerId === turnPlayerId)?.cards || null
      : null;

    // 记录出牌历史
    this.room.gameState.playHistory.push({
      round: this.room.gameState.currentRound,
      playerId: turnPlayerId,
      playerName: player.name,
      playerIndex,
      controllerPlayerId: requestingPlayerId,
      controllerPlayerName: requester.name,
      isProxy: isProxyPlay,
      activeSkillId: activeSkill?.id || null,
      activeSkillName: activeSkill?.name || null,
      treatedAsSmall,
      concealed,
      cards: validCards.map(c => c.toJSON()),
      jokerSubstitutions,
      clusterAnalysisSubstitutions,
      forbiddenMagicSubstitutions,
      divineWeaponTransformation: divineWeaponTransformation?.publicInfo || null,
      enduringInheritance: enduringInheritance ? {
        sourceCards: enduringInheritance.sourceCards.map(card => card.toJSON ? card.toJSON() : card),
        sourcePatternType: enduringInheritance.sourcePattern?.type || null,
        inheritedComponentCount: enduringInheritance.inheritedComponentCount
      } : null,
      dreamKilling,
      dreamKillingRandom: isDreamKillingRandomPlay,
      oldHorseAbsolute,
      bushGateReplayRestriction,
      woodenOxCardIds: playedWoodenOxCardIds,
      woodenOxTeamIndex: woodenOxMule?.teamIndex ?? null,
      afterglowActive: afterglowActiveForPlay,
      afterglowExpiredAfterPlay: Boolean(afterglowExpired),
      encircleThreeMissingOneSeenSuitsBeforePlay:
        encircleThreeMissingOneRecordUpdate?.previousSuits || null,
      activeSkillUseConsumed,
      ambiguousOptions: ambiguousOptions?.map(option => ({
        index: option.index,
        cards: option.cards.map(card => card.toJSON ? card.toJSON() : card)
      })) || null,
      ironEvidenceMode: ironEvidenceModeForPlay,
      ironEvidenceBigJokerIds,
      waitingRabbitPointEntries: waitingRabbitPointEntries?.map(entry => ({
        card: entry.card.toJSON ? entry.card.toJSON() : entry.card,
        cardId: entry.cardId,
        firstAppearance: entry.firstAppearance,
        points: entry.points
      })) || null,
      lureTigerSilenced: lureTigerSilencedForPlay,
      hiddenDragonUpdate,
      administrativeReviewUpdate,
      timestamp: new Date()
    });

    // 守株待兔只在整轮结算后换牌，本次出牌过程本身不即时替换牌桌。
    const waitingRabbitExchange = null;

    if (bushGateReplayRestriction) {
      this.room.gameState.bushGateRestriction = null;
      this.room.gameState.bushGateLastResult = {
        ...(this.room.gameState.bushGateLastResult || bushGateReplayRestriction),
        replayCompleted: true,
        replayCards: validCards.map(card => card.toJSON ? card.toJSON() : card)
      };
    }

    logger.info(`房间 ${this.room.id} 玩家 ${player.name} 出牌 ${cardIds.length} 张`);

    // 回合结束时 currentWinnerIndex 会立即为下一回合重置，因此先保存本次出牌后
    // 真正领先的玩家，让客户端能在清桌前正确显示最后一手的“大”标记。
    let currentWinningPlayer = this.room.findPlayerByIndex(
      this.room.gameState.currentWinnerIndex
    );
    let currentWinningPlayerId = currentWinningPlayer?.id || null;
    const hasConcealedRoundPlay = this.room.gameState.currentRoundPlays.some(
      play => play.concealed
    );
    let publicCurrentWinningPlayerId = hasConcealedRoundPlay
      ? null
      : currentWinningPlayerId;

    // 更新回合状态
    logger.info(`[调试] 调用 onPlayerPlayed 前: playersPlayedThisRound.size=${this.room.gameState.playersPlayedThisRound.size}, players.length=${this.room.players.length}`);
    const roundUpdate = this.roundManager.onPlayerPlayed(playerIndex);
    logger.info(`[调试] 调用 onPlayerPlayed 后: playersPlayedThisRound.size=${this.room.gameState.playersPlayedThisRound.size}, roundUpdate.type=${roundUpdate?.type}`);

    if (
      roundUpdate?.type === 'round_ended'
      && !this.isFinalizingDestroyDykeRound
    ) {
      const destroyDykeDecision = this.holdDestroyDykeRoundForDecision({
        requestingPlayerId,
        turnPlayerId,
        playerIndex,
        cardIds: validCards.map(card => card.id)
      });
      if (destroyDykeDecision) {
        roundUpdate.type = 'destroy_dyke_decision_pending';
        roundUpdate.currentPlayerIndex = null;
        roundUpdate.destroyDyke = destroyDykeDecision;
        return {
          playerId: turnPlayerId,
          playerName: player.name,
          controllerPlayerId: requestingPlayerId,
          controllerPlayerName: requester.name,
          isProxy: isProxyPlay,
          playedCards: playedDisplayCards.map(card => card.toJSON ? card.toJSON() : card),
          remainingCount: this.getPlayableCardCount(player),
          gameFinished: false,
          roundUpdate,
          roundWinner: null,
          currentWinningPlayerId: publicCurrentWinningPlayerId,
          threeTigersTransformation,
          activeSkillActivation,
          treatedAsSmall,
          concealed,
          roundReveal: null,
          tenSidedAmbushReveal,
          threePowersReveal,
          trumpAction: null,
          lastStandRequest,
          destroyDykeDecision,
          destroyDykeDecisionPending: true,
          jokerSubstitutions,
          clusterAnalysisSubstitutions,
          forbiddenMagicSubstitutions,
          enduringInheritance: null,
          dreamKilling,
          oldHorseAbsolute,
          oldHorseAbsolutePlay,
          throwFailed: null,
          waitingRabbitExchange
        };
      }
    }

    if (
      roundUpdate?.type === 'round_ended'
      && !this.isFinalizingAmbiguousRound
    ) {
      const ambiguousDecision = this.holdAmbiguousRoundForChoice({
        requestingPlayerId,
        turnPlayerId,
        playerIndex,
        cardIds
      });
      if (ambiguousDecision) {
        roundUpdate.type = 'ambiguous_choice_pending';
        roundUpdate.currentPlayerIndex = null;
        roundUpdate.ambiguous = ambiguousDecision;
        return {
          playerId: turnPlayerId,
          playerName: player.name,
          controllerPlayerId: requestingPlayerId,
          controllerPlayerName: requester.name,
          isProxy: isProxyPlay,
          playedCards: (waitingRabbitExchange?.tableCards || playedDisplayCards)
            .map(card => card.toJSON ? card.toJSON() : card),
          remainingCount: this.getPlayableCardCount(player),
          gameFinished: false,
          roundUpdate,
          roundWinner: null,
          currentWinningPlayerId: null,
          threeTigersTransformation,
          activeSkillActivation,
          treatedAsSmall,
          concealed,
          roundReveal: null,
          tenSidedAmbushReveal,
          threePowersReveal,
          trumpAction: null,
          lastStandRequest,
          ambiguousOptions: ambiguousOptions?.map(option => ({
            index: option.index,
            cards: option.cards.map(card => card.toJSON ? card.toJSON() : card)
          })) || null,
          ambiguousDecision,
          ambiguousDecisionPending: true,
          jokerSubstitutions,
          clusterAnalysisSubstitutions,
          forbiddenMagicSubstitutions,
          enduringInheritance: null,
          dreamKilling,
          oldHorseAbsolute,
          oldHorseAbsolutePlay,
          throwFailed: null,
          waitingRabbitExchange
        };
      }
    }

    // 检查本轮是否结束
    let roundWinner = null;
    let roundScoreInfo = null;
    let roundReveal = null;
    let turnDirectionChange = null;
    let smallestPlayer = null;
    let averagePooling = null;
    let jointHarmony = null;
    let magicTrick = null;
    let abruptStop = null;
    let divineWeaponRefresh = null;
    let secondBattlefield = null;
    let mutualSupportReturn = null;
    let culturalRevolutionTransition = null;
    let encircleThreeMissingOneTransition = null;
    let inviteIntoUrn = null;
    let oldHorse = null;
    let trumpWins = null;
    let strawBoatDecision = null;
    let striveUpstreamOrder = null;
    let defenseAsOffenseNextStatus = null;
    let defenseAsOffenseTransition = null;
    let waitingRabbitDecision = null;
    let antinomyReselection = null;
    let antinomyReselectionPlayerIds = [];
    let destroyDykeRoundResult = null;
    if (this.room.gameState.playersPlayedThisRound.size === this.room.players.length) {
      logger.info(`[调试] 检测到轮次结束，当前轮: ${this.room.gameState.currentRound}`);
      // 魔术戏法只在四家都按各自真实手牌完成出牌后，交换两个座位的结算结果。
      magicTrick = this.applyMagicTrickAtRoundEnd();
      // 两条队内规则都必须等四家出完后统一判定，避免先出者的临时牌力提前固化牌权。
      averagePooling = this.applyAveragePoolingAtRoundEnd();
      jointHarmony = this.applyJointHarmonyAtRoundEnd();
      currentWinningPlayer = this.room.findPlayerByIndex(this.room.gameState.currentWinnerIndex);
      currentWinningPlayerId = currentWinningPlayer?.id || null;
      publicCurrentWinningPlayerId = hasConcealedRoundPlay ? null : currentWinningPlayerId;
      // 本轮结束，确定获胜者
      const winnerIndex = this.room.gameState.currentWinnerIndex;
      const winner = this.room.findPlayerByIndex(winnerIndex);
      roundWinner = {
        playerIndex: winnerIndex,
        playerId: winner.id,
        playerName: winner.name
      };

      let nextRoundLeaderIndex = winnerIndex;
      oldHorse = this.updateOldHorseAtRoundEnd(winnerIndex);
      trumpWins = this.resolveTrumpWinsAtRoundEnd(roundUpdate?.round);
      if (Number.isInteger(trumpWins?.leaderPlayerIndex)) {
        nextRoundLeaderIndex = trumpWins.leaderPlayerIndex;
      }
      if (isRespectEldersAndChildrenRule(this.room.gameState.selectedRule)) {
        const comparisonPlays = this.room.gameState.currentRoundPlays.map(play => ({
          ...play,
          cards: play.comparisonCards || play.cards
        }));
        const smallestPlay = findSmallestPlayForRespectElders(
          comparisonPlays,
          this.room.gameState.trumpSuit,
          this.room.gameState.trumpRank,
          this.room.gameState.selectedRule
        );
        const smallest = smallestPlay
          ? this.room.findPlayerByIndex(smallestPlay.playerIndex)
          : null;
        if (smallest) {
          nextRoundLeaderIndex = smallestPlay.playerIndex;
          smallestPlayer = {
            playerIndex: smallestPlay.playerIndex,
            playerId: smallest.id,
            playerName: smallest.name
          };
          logger.info(
            `房间 ${this.room.id} 尊老爱幼：${smallest.name} 打出本轮最小牌，下轮先出`
          );
        }
      }
      if (isStriveUpstreamRule(this.room.gameState.selectedRule)) {
        const comparisonPlays = this.room.gameState.currentRoundPlays.map(play => ({
          ...play,
          cards: play.comparisonCards || play.cards
        }));
        const rankedPlays = rankRoundPlaysByRespectOrder(
          comparisonPlays,
          this.room.gameState.trumpSuit,
          this.room.gameState.trumpRank,
          this.room.gameState.selectedRule
        );
        const playerIndexes = rankedPlays.map(play => play.playerIndex);
        if (playerIndexes.length === this.room.players.length) {
          this.room.gameState.striveUpstreamPlayOrder = playerIndexes;
          nextRoundLeaderIndex = playerIndexes[0];
          // “力争上游”的桌面“大”表示完整牌力排序的第一名，也就是实际
          // 取得下轮牌权的人；普通一墩的赢家仍单独用于本轮常规计分。
          const strongestPlayer = this.room.findPlayerByIndex(playerIndexes[0]);
          currentWinningPlayerId = strongestPlayer?.id || null;
          publicCurrentWinningPlayerId = hasConcealedRoundPlay
            ? null
            : currentWinningPlayerId;
          striveUpstreamOrder = {
            triggerRound: roundUpdate?.round ?? this.room.gameState.currentRound,
            playerIndexes,
            players: playerIndexes.map(playerIndex => {
              const orderedPlayer = this.room.findPlayerByIndex(playerIndex);
              return {
                playerIndex,
                playerId: orderedPlayer?.id || null,
                playerName: orderedPlayer?.name || '未知玩家'
              };
            })
          };
          logger.info(
            `房间 ${this.room.id} 力争上游：下轮顺序为 ` +
            striveUpstreamOrder.players.map(orderedPlayer => orderedPlayer.playerName).join(' → ')
          );
        }
      }
      defenseAsOffenseNextStatus = this.getDefenseAsOffenseStatusForNextRound(
        roundUpdate?.round ?? this.room.gameState.currentRound
      );

      logger.info(`房间 ${this.room.id} 第${this.room.gameState.currentRound}轮结束，${winner.name} 获胜`);

      // 计算本轮得分
      const currentLeadingPattern = this.room.gameState.leadingPattern;
      const scoringRoundPlays = this.room.gameState.currentRoundPlays.filter(
        play => !play.lureTigerSilenced
      );
      const allRoundCards = scoringRoundPlays.flatMap(play => play.cards);
      const allRoundOriginalCards = scoringRoundPlays.flatMap(
        play => play.originalCards || play.cards
      );
      const allAppearedOriginalCards = this.room.gameState.currentRoundPlays.flatMap(
        play => play.originalCards || play.cards
      );
      recordBirdsGoneBowHiddenPointCards({
        gameState: this.room.gameState,
        cards: allRoundOriginalCards
      });
      const candleLitForRound = isCandleToDawnRule(this.room.gameState.selectedRule)
        ? this.room.gameState.candleLit
        : null;
      const basePointResolver = isCandleToDawnRule(this.room.gameState.selectedRule)
        ? card => this.getCandleRoundCardPoints(card, candleLitForRound)
        : card => this.getRuleCardPoints(card);
      const weighingThousandJinScoring = this.getWeighingThousandJinRoundScoring();
      const pointResolver = card => this.adjustWeighingThousandJinCardPoints(
        basePointResolver(card),
        weighingThousandJinScoring
      );
      const waitingRabbitPointEntries = isWaitingRabbitRule(this.room.gameState.selectedRule)
        ? this.room.gameState.currentRoundPlays.flatMap(
            play => play.waitingRabbitPointEntries || []
          )
        : null;
      const unweightedBaseRoundPoints = waitingRabbitPointEntries
        ? waitingRabbitPointEntries.reduce((sum, entry) => sum + entry.points, 0)
        : calculateRoundPoints(allRoundCards, basePointResolver);
      const baseRoundPoints = waitingRabbitPointEntries
        ? waitingRabbitPointEntries.reduce(
            (sum, entry) => sum + this.adjustWeighingThousandJinCardPoints(
              entry.points,
              weighingThousandJinScoring
            ),
            0
          )
        : calculateRoundPoints(allRoundCards, pointResolver);
      const originalRoundPoints = isCandleToDawnRule(this.room.gameState.selectedRule)
        ? calculateRoundPoints(allRoundCards, getCardPoints)
        : unweightedBaseRoundPoints;
      const standardRoundPointMultiplier = getOddEvenRoundMultiplier(
        this.room.gameState.selectedRule,
        this.room.gameState.currentRound
      );
      const ironEvidenceScoring = isIronEvidenceRule(this.room.gameState.selectedRule)
        ? calculateIronEvidenceRoundScoring(
            allRoundOriginalCards,
            baseRoundPoints,
            this.ensureIronEvidenceRoundMode()
          )
        : null;
      const roundPointMultiplier = ironEvidenceScoring?.multiplier
        ?? standardRoundPointMultiplier;
      const roundPoints = ironEvidenceScoring?.roundPoints
        ?? baseRoundPoints * standardRoundPointMultiplier;
      // 烛会使某些5变为0分，但它仍是牌面分牌，收分区仍保留原牌。
      const roundPointCards = waitingRabbitPointEntries
        ? waitingRabbitPointEntries
            .filter(entry => entry.firstAppearance && entry.points > 0)
            .map(entry => entry.card)
        : extractPointCards(
            allRoundCards,
            isCandleToDawnRule(this.room.gameState.selectedRule)
              ? getCardPoints
              : basePointResolver
          );
      const ambushCardCount = this.countTenSidedAmbushCards(allRoundCards);
      const ambushPoints = ambushCardCount * TEN_SIDED_AMBUSH_CARD_POINTS;

      if (
        isRouteSwingRule(this.room.gameState.selectedRule)
        && allRoundCards.some(card => getCardPoints(card) >= 10)
      ) {
        const previousDirection = this.room.gameState.turnDirection;
        const nextDirection = previousDirection === TurnOrders.CLOCKWISE
          ? TurnOrders.COUNTER_CLOCKWISE
          : TurnOrders.CLOCKWISE;
        this.room.gameState.turnDirection = nextDirection;
        turnDirectionChange = {
          previousDirection,
          nextDirection,
          triggerRound: this.room.gameState.currentRound
        };
        logger.info(
          `房间 ${this.room.id} 路线摇摆：第${this.room.gameState.currentRound}轮结束后` +
          `出牌方向改为${nextDirection === TurnOrders.CLOCKWISE ? '顺时针' : '逆时针'}`
        );
      }

      // 获取庄家索引
      const dealerIndex = this.room.getPlayerIndex(this.room.gameState.buryingPlayerId);

      // 判断赢家是否是闲家
      const winnerIsAttacker = this.isAttackerPlayerIndex(winnerIndex, dealerIndex);
      const focusFigureScoringPending = isFocusFigureRule(this.room.gameState.selectedRule);
      const destroyDykeVoidsRound = Boolean(
        isDestroyDykeFloodFieldsRule(this.room.gameState.selectedRule)
        && this.room.gameState.destroyDykeDisaster?.triggerRound === this.room.gameState.currentRound
        && winnerIsAttacker
      );
      const accidentInsuranceExcess = isAccidentInsuranceRule(this.room.gameState.selectedRule)
        ? Math.max(0, roundPoints - 30)
        : 0;
      const accidentInsuranceWithheld = winnerIsAttacker ? accidentInsuranceExcess : 0;
      const accidentInsuranceBonus = winnerIsAttacker ? 0 : accidentInsuranceExcess;
      const attackerRoundPointsAwarded = focusFigureScoringPending
        ? null
        : winnerIsAttacker
          ? destroyDykeVoidsRound ? 0 : roundPoints - accidentInsuranceWithheld
          : accidentInsuranceBonus;
      const ambushScoreDelta = ambushPoints > 0
        ? (winnerIsAttacker ? -ambushPoints : ambushPoints)
        : 0;
      const ambushAttackerNetCardDelta = ambushCardCount > 0
        ? (winnerIsAttacker ? ambushCardCount : -ambushCardCount)
        : 0;

      if (winnerIsAttacker && roundPoints > 0) {
        if (destroyDykeVoidsRound) {
          logger.info(
            `房间 ${this.room.id} 毁堤淹田：第${this.room.gameState.currentRound}轮的 ` +
            `${roundPoints} 分暂时作废`
          );
        } else {
          // 闲家赢了且有分数牌，收集分数牌
          this.room.gameState.collectedPointCards.push(...roundPointCards);
          if (focusFigureScoringPending) {
            this.recordFocusFigureCapturedRoundPoints();
            logger.info(`焦点人物：闲家收下 ${roundPointCards.length} 张分牌，实际分数留待终局揭晓`);
          } else {
            this.room.gameState.attackerScore += attackerRoundPointsAwarded;
            logger.info(`闲家获得 ${attackerRoundPointsAwarded} 分，总分: ${this.room.gameState.attackerScore}`);
          }
          if (accidentInsuranceWithheld > 0) {
            logger.info(
              `房间 ${this.room.id} 意外保险：闲家赢得 ${roundPoints} 分，` +
              `超出30分的 ${accidentInsuranceWithheld} 分不计入闲家得分`
            );
          }
        }
      }
      if (accidentInsuranceBonus > 0) {
        this.room.gameState.attackerScore += accidentInsuranceBonus;
        logger.info(
          `房间 ${this.room.id} 意外保险：庄家方赢得 ${roundPoints} 分，` +
          `超出30分的 ${accidentInsuranceBonus} 分补给闲家，总分: ${this.room.gameState.attackerScore}`
        );
      }
      if (ambushScoreDelta !== 0) {
        this.room.gameState.attackerScore += ambushScoreDelta;
        this.room.gameState.tenSidedAmbushAttackerNetCardCount += ambushAttackerNetCardDelta;
        logger.info(
          `十面埋伏：本墩 ${ambushCardCount} 张 ${this.room.gameState.tenSidedAmbushRank}，` +
          `闲家分数变化 ${ambushScoreDelta > 0 ? '+' : ''}${ambushScoreDelta}，` +
          `总分 ${this.room.gameState.attackerScore}`
        );
      }

      if (weighingThousandJinScoring) {
        logger.info(
          `房间 ${this.room.id} 上称千斤：庄家本轮完整牌力第` +
          `${weighingThousandJinScoring.dealerRank}，压过` +
          `${weighingThousandJinScoring.outrankedAttackerCount}名闲家；` +
          `${unweightedBaseRoundPoints}分调整为${baseRoundPoints}分`
        );
      }

      if (ironEvidenceScoring) {
        this.room.gameState.ironEvidenceLastResult = {
          round: this.room.gameState.currentRound,
          ...ironEvidenceScoring,
          winnerPlayerId: winner.id,
          winnerPlayerName: winner.name,
          winnerIsAttacker
        };
        if (ironEvidenceScoring.specialCardCount > 0) {
          logger.info(
            ironEvidenceScoring.mode === 'zero'
              ? `房间 ${this.room.id} 铁证如山：本轮出现 ${ironEvidenceScoring.specialCardCount} 张铁证牌，` +
                `${baseRoundPoints} 分清零`
              : `房间 ${this.room.id} 铁证如山：本轮出现 ${ironEvidenceScoring.specialCardCount} 张铁证牌，` +
                `${baseRoundPoints} × ${ironEvidenceScoring.multiplier} = ${roundPoints} 分`
          );
        }
      }

      destroyDykeRoundResult = this.advanceDestroyDykeDisasterAtRoundEnd({
        round: this.room.gameState.currentRound,
        winnerIsAttacker,
        roundPoints,
        gameEnding: this.room.players.every(
          candidate => this.getPlayableCardCount(candidate) === 0
        )
      });

      const repeatedExhaustion = this.applyRepeatedExhaustionAtRoundEnd(winnerIndex);
      secondBattlefield = this.applySecondBattlefieldAtRoundEnd();
      inviteIntoUrn = this.resolveInviteIntoUrnAtRoundEnd(roundUpdate?.round);
      const outwardHarmonyInnerDivision = this.resolveOutwardHarmonyInnerDivisionAtRoundEnd(
        roundUpdate?.round
      );

      roundScoreInfo = {
        baseRoundPoints,
        originalRoundPoints,
        roundPointMultiplier,
        roundPoints,
        weighingThousandJin: weighingThousandJinScoring
          ? {
              ...weighingThousandJinScoring,
              originalRoundPoints: unweightedBaseRoundPoints,
              adjustedRoundPoints: baseRoundPoints
            }
          : null,
        ironEvidence: ironEvidenceScoring
          ? { ...this.room.gameState.ironEvidenceLastResult }
          : null,
        destroyDyke: destroyDykeRoundResult,
        roundPointCards: roundPointCards.map(c => c.toJSON ? c.toJSON() : c),
        ambushRank: this.room.gameState.isTenSidedAmbushRevealed
          ? this.room.gameState.tenSidedAmbushRank
          : null,
        ambushCardCount,
        ambushPoints,
        ambushScoreDelta,
        ambushAttackerNetCardDelta,
        ambushAttackerNetCardCount: this.room.gameState.tenSidedAmbushAttackerNetCardCount,
        attackerRoundPointsAwarded,
        accidentInsuranceExcess,
        accidentInsuranceWithheld,
        accidentInsuranceBonus,
        repeatedExhaustion,
        repeatedExhaustionPenalty: repeatedExhaustion?.penalty || 0,
        repeatedExhaustionScoreDelta: repeatedExhaustion?.scoreDelta || 0,
        secondBattlefield,
        inviteIntoUrn,
        outwardHarmonyInnerDivision,
        focusFigureScoringPending,
        winnerIsAttacker,
        attackerScore: focusFigureScoringPending ? null : this.room.gameState.attackerScore,
        collectedPointCards: this.room.gameState.collectedPointCards.map(c => c.toJSON ? c.toJSON() : c)
      };

      if (isCandleToDawnRule(this.room.gameState.selectedRule)) {
        roundScoreInfo.candleLit = candleLitForRound;
        // 上面的本轮分数和闲家总分都已完成结算，再决定下一轮烛态。
        roundScoreInfo.candleTransition = this.applyCandleTransitionAtRoundEnd();
      }

      // 保存最后一轮信息（用于底牌计算）
      this.room.gameState.lastRoundLeadingPattern = currentLeadingPattern;
      this.room.gameState.lastRoundWinnerIndex = winnerIndex;

      // 本轮仍使用旧主完整结算；这里只为下一轮应用围三阙一的缺门花色。
      encircleThreeMissingOneTransition = this.applyEncircleThreeMissingOneAtRoundEnd(
        roundUpdate?.round ?? this.room.gameState.currentRound
      );

      if (isThreeTigersRule(this.room.gameState.selectedRule)) {
        const state = this.room.gameState.threeTigersRoundState;
        this.room.gameState.threeTigersLastRoundState = state
          ? {
              ...state,
              contributingPlayerIds: [...(state.contributingPlayerIds || [])],
              suitCounts: { ...(state.suitCounts || {}) }
            }
          : null;
      }

      abruptStop = this.getAbruptStopAtRoundEnd();

      if (this.room.gameState.currentRoundPlays.some(play => play.concealed)) {
        roundReveal = {
          round: this.room.gameState.currentRound,
          plays: this.room.gameState.currentRoundPlays.map(play => ({
            playerId: play.playerId,
            playerName: this.room.findPlayerById(play.playerId)?.name || '未知玩家',
            cards: play.cards.map(card => card.toJSON ? card.toJSON() : card),
            concealed: Boolean(play.concealed),
            activeSkillId: play.activeSkillId || null,
            activeSkillName: play.activeSkillName || null,
            lureTigerSilenced: Boolean(play.lureTigerSilenced),
            ironEvidenceMode: play.ironEvidenceMode || null,
            jokerSubstitutions: play.jokerSubstitutions || []
          }))
        };
      }

      // 目标牌先完整参与本轮牌力与首次计分；全部结算完成后才开放拿回窗口。
      waitingRabbitDecision = this.prepareWaitingRabbitDecisionAtRoundEnd();

      // 整手交换只在一整轮全部出完并完成本轮计分后检查，不能由先出牌者提前触发。
      wholeHandExchange = this.applyWholeHandExchangeAtRoundEnd();
      // 单张交换/暗弃同样只在本轮全部出完、分数判定完成后开始；四家暗选，收齐后同时处理。
      roundCardExchange = this.prepareRoundCardExchangeAtRoundEnd(allRoundCards)
        || this.prepareRoundDiscardAtRoundEnd(allRoundCards);

      // 分数和胜负已结算、桌面牌尚未清除时确定“箭”。决定可以跨过清桌动画等待，
      // 但下一轮出牌会被冻结，直到首置位明确发动或放弃。
      strawBoatDecision = this.prepareStrawBoatBorrowingArrowsAtRoundEnd(
        roundUpdate?.round ?? this.room.gameState.currentRound,
        winnerIndex
      );

      // 当前四家的实际出牌成为下一轮各自的点数/花色冷却来源。
      this.updateCardCooldownRestrictionsForNextRound();
      // 经久不衰同样只在四家都出完后才把本轮固化为“上轮”。
      this.updateEnduringHistoryAtRoundEnd();

      // 必须趁本轮牌仍在桌上时确定哪些声明者需要重选；具体选择从下一轮开始前启动。
      antinomyReselectionPlayerIds = this.getAntinomyReselectionPlayerIds();

      const recordOnFileTransition = this.updateRecordOnFileAtRoundEnd({
        completedRound: roundUpdate?.round ?? this.room.gameState.currentRound,
        hasPointCards: allAppearedOriginalCards.some(card => getCardPoints(card) > 0),
        hasLevelOrJoker: this.room.gameState.currentRoundPlays
          .flatMap(play => play.cards || [])
          .some(card => (
            card.suit === Suits.JOKER
            || card.rank === this.room.gameState.trumpRank
          )),
        hasNextRound: this.room.players.some(
          roundPlayer => this.getPlayableCardCount(roundPlayer) > 0
        )
      });

      // 清空当前轮出牌记录，准备下一轮
      this.room.gameState.currentRoundPlays = [];
      this.room.gameState.leadingPattern = null;

      // 通常由获胜者首发；特殊规则可以改写下轮首发与完整行动顺序。
      this.room.gameState.roundStartPlayerIndex = nextRoundLeaderIndex;
      this.room.gameState.currentPlayerIndex = nextRoundLeaderIndex;
      this.room.gameState.currentWinnerIndex = null;
      this.room.gameState.playersPlayedThisRound.clear();
      this.room.gameState.currentRound++;
      this.room.gameState.threeTigersRoundState = null;
      this.beginIronEvidenceRound();

      if (
        antinomyReselectionPlayerIds.length > 0
        && !this.room.players.every(roundPlayer => this.getPlayableCardCount(roundPlayer) === 0)
      ) {
        antinomyReselection = this.beginAntinomySelection(
          antinomyReselectionPlayerIds,
          {
            stage: 'round',
            triggerRound: roundUpdate?.round ?? this.room.gameState.currentRound - 1
          }
        );
      }

      defenseAsOffenseTransition = this.applyDefenseAsOffenseForRound(
        defenseAsOffenseNextStatus,
        { emit: false }
      );

      culturalRevolutionTransition = this.expireCulturalRevolutionAtRoundEnd(
        roundUpdate?.round ?? this.room.gameState.currentRound - 1
      );

      mutualSupportReturn = this.prepareMutualSupportReturnsAtRoundEnd(
        roundUpdate?.round ?? this.room.gameState.currentRound - 1
      );

      const strengthCompensation = this.room.players.every(
        roundPlayer => this.getPlayableCardCount(roundPlayer) === 0
      ) ? null : this.applyStrengthCompensationForRound({ emit: false });

      if (!this.room.players.every(roundPlayer => this.getPlayableCardCount(roundPlayer) === 0)) {
        divineWeaponRefresh = this.refreshUsedDivineWeaponCards();
      }

      // 计划经济的20张封存牌只在庄家埋底、正式出牌后的轮末发放。
      // 每轮四家按座位顺序各摸1张，因此前五轮每家打1张后又补回1张。
      plannedEconomyDraw = this.drawPlannedEconomyRoundCards(roundUpdate?.round ?? this.room.gameState.currentRound - 1);

      if (!this.room.players.every(roundPlayer => this.getPlayableCardCount(roundPlayer) === 0)) {
        this.openWoodenOxRoundWindow();
      }

      if (isTimeReversalRule(this.room.gameState.selectedRule)) {
        // 第四家出完后的两秒仍属于刚结束的这一轮：所有人都可继续预备，下一轮不得抢跑。
        this.room.gameState.timeReversalDecisionState = 'holding';
        this.room.gameState.timeReversalWindowRound = roundUpdate?.round ?? null;
      }

      // 更新roundUpdate
      if (roundUpdate) {
        roundUpdate.roundWinner = roundWinner;
        roundUpdate.nextRound = this.room.gameState.currentRound;
        roundUpdate.scoreInfo = isLostInFogRule(this.room.gameState.selectedRule)
          ? { hidden: true }
          : roundScoreInfo;
        roundUpdate.turnDirectionChange = turnDirectionChange;
        roundUpdate.smallestPlayer = smallestPlayer;
        roundUpdate.nextRoundLeader = trumpWins?.leaderPlayerId
          ? {
              playerIndex: trumpWins.leaderPlayerIndex,
              playerId: trumpWins.leaderPlayerId,
              playerName: trumpWins.leaderPlayerName
            }
          : smallestPlayer || roundWinner;
        roundUpdate.plannedEconomyDraw = plannedEconomyDraw ? {
          round: plannedEconomyDraw.round,
          drawCount: plannedEconomyDraw.drawCount,
          remainingCards: plannedEconomyDraw.remainingCards
        } : null;
        roundUpdate.averagePooling = averagePooling;
        roundUpdate.jointHarmony = jointHarmony;
        roundUpdate.magicTrick = magicTrick;
        roundUpdate.abruptStop = abruptStop;
        roundUpdate.divineWeaponRefresh = divineWeaponRefresh;
        roundUpdate.secondBattlefield = secondBattlefield;
        roundUpdate.candleTransition = roundScoreInfo?.candleTransition || null;
        roundUpdate.strengthCompensation = strengthCompensation;
        roundUpdate.mutualSupportReturnPending = Boolean(mutualSupportReturn);
        roundUpdate.culturalRevolutionTransition = culturalRevolutionTransition;
        roundUpdate.encircleThreeMissingOneTransition = encircleThreeMissingOneTransition;
        roundUpdate.recordOnFile = recordOnFileTransition;
        roundUpdate.antinomyReselection = antinomyReselection;
        roundUpdate.inviteIntoUrn = inviteIntoUrn;
        roundUpdate.oldHorse = oldHorse;
        roundUpdate.trumpWins = trumpWins;
        roundUpdate.strawBoatBorrowingArrows = strawBoatDecision;
        roundUpdate.striveUpstreamOrder = striveUpstreamOrder;
        roundUpdate.defenseAsOffense = defenseAsOffenseTransition;
        roundUpdate.threeTigers = isThreeTigersRule(this.room.gameState.selectedRule)
          ? {
              ...(this.room.gameState.threeTigersLastRoundState || {}),
              plays: threeTigersTransformation?.plays || [],
              currentWinningPlayerId: threeTigersTransformation?.currentWinningPlayerId || null
            }
          : null;
      }
    }

    // 获取毙牌动作
    // 暗牌尚未在轮末揭示时，“毙了/盖毙”动画同样会泄露牌面性质。
    // 最后一手会先广播统一揭牌，再允许广播其毙牌结果。
    const trumpAction = hasConcealedRoundPlay && !roundReveal
      ? null
      : this.room.gameState.trumpAction;
    // 清空以防重复发送
    this.room.gameState.trumpAction = null;

    this.releaseAdministrativeReviewBottomIfReady();

    this.updateRuleHandVisibilityAfterCardChange(player, {
      roundEnded: roundUpdate?.type === 'round_ended'
    });

    const teammateCheerRequest = this.requestTeammateCheerIfEligible(player, {
      triggerRound: roundUpdate?.round ?? this.room.gameState.currentRound
    });
    const afterglowRequest = this.requestAfterglowIfEligible(player, {
      triggerRound: roundUpdate?.round ?? this.room.gameState.currentRound
    });

    // 检查游戏是否结束（所有玩家手牌为0）
    const allPlayersFinished = this.room.players.every(p => this.getPlayableCardCount(p) === 0);
    const abruptlyStopped = Boolean(abruptStop?.triggered);
    if (
      roundUpdate?.type === 'round_ended'
      && !allPlayersFinished
      && !abruptlyStopped
      && isForbiddenMagicRule(this.room.gameState.selectedRule)
    ) {
      this.enqueueForbiddenMagicRoundDecisions();
    }
    if (
      roundUpdate?.type === 'round_ended'
      && !allPlayersFinished
      && !abruptlyStopped
      && isLureTigerFromMountainRule(this.room.gameState.selectedRule)
    ) {
      this.enqueueLureTigerRoundDecisions();
    }
    const timeReversalPending = this.hasPendingTimeReversalDecision();
    const mutualSupportPending = this.hasPendingMutualSupportAction();
    const strawBoatPending = this.hasPendingStrawBoatBorrowingArrowsDecision();
    const teammateCheerPending = this.hasPendingTeammateCheerDecision();
    const afterglowPending = this.hasPendingAfterglowDecision();
    if (
      (allPlayersFinished || abruptlyStopped)
      && !timeReversalPending
      && !mutualSupportPending
      && !strawBoatPending
      && !teammateCheerPending
      && !afterglowPending
    ) {
      this.finishGame();
      if (!tenSidedAmbushReveal && this.room.gameState.bottomScoreResult?.ambushRevealedFromBottom) {
        tenSidedAmbushReveal = {
          rank: this.room.gameState.bottomScoreResult.ambushRank,
          source: 'bottom',
          playerId: null,
          playerName: null
        };
      }
      const bottomThreePowersReveal = this.room.gameState.bottomScoreResult?.threePowersRevealFromBottom;
      if (bottomThreePowersReveal?.slots?.length) {
        threePowersReveal = threePowersReveal?.slots?.length
          ? {
              ...threePowersReveal,
              slots: [...threePowersReveal.slots, ...bottomThreePowersReveal.slots]
            }
          : bottomThreePowersReveal;
      }
      return {
        playerId: turnPlayerId,
        playerName: player.name,
        controllerPlayerId: requestingPlayerId,
        controllerPlayerName: requester.name,
        isProxy: isProxyPlay,
        playedCards: (waitingRabbitExchange?.tableCards || threeTigersPlayedCards || playedDisplayCards).map(
          c => c.toJSON ? c.toJSON() : c
        ),
        remainingCount: this.getPlayableCardCount(player),
        gameFinished: true,
        roundUpdate,
        roundWinner,
        currentWinningPlayerId: publicCurrentWinningPlayerId,
        threeTigersTransformation,
        activeSkillActivation,
        ambiguousOptions: ambiguousOptions?.map(option => ({
          index: option.index,
          cards: option.cards.map(card => card.toJSON ? card.toJSON() : card)
        })) || null,
        treatedAsSmall,
        lureTigerSilenced: lureTigerSilencedForPlay,
        concealed,
        roundReveal,
        tenSidedAmbushReveal,
        threePowersReveal,
        trumpAction,
        wholeHandExchange,
        roundCardExchange,
        plannedEconomyDraw,
        mutualSupportReturn,
        strawBoatDecision,
        timeReversalPending: false,
        forbiddenMagicDecisionPending: false,
        lastStandRequest,
        teammateCheerRequest,
        afterglowRequest,
        afterglowExpired,
        jokerSubstitutions,
        clusterAnalysisSubstitutions,
        forbiddenMagicSubstitutions,
        enduringInheritance: enduringInheritance ? {
          sourceCards: enduringInheritance.sourceCards.map(card => card.toJSON ? card.toJSON() : card),
          sourcePatternType: enduringInheritance.sourcePattern?.type || null,
          inheritedComponentCount: enduringInheritance.inheritedComponentCount
        } : null,
        dreamKilling,
        oldHorseAbsolute,
        oldHorseAbsolutePlay,
        ironEvidenceMode: ironEvidenceModeForPlay,
        waitingRabbitDecision: this.getWaitingRabbitPublicDecision(waitingRabbitDecision),
        waitingRabbitExchange,
        throwFailed: throwFailed ? {
          message: '甩牌失败，强制出小',
          attemptedCards: originalRequestedCardIds.length,
          attemptedCardObjects: originalRequestedCards.map(c => c.toJSON()),
          forcedCards: validCards.map(c => c.toJSON())
        } : null
      };
    }

    return {
      playerId: turnPlayerId,
      playerName: player.name,
      controllerPlayerId: requestingPlayerId,
      controllerPlayerName: requester.name,
      isProxy: isProxyPlay,
      playedCards: (waitingRabbitExchange?.tableCards || threeTigersPlayedCards || playedDisplayCards).map(
        c => c.toJSON ? c.toJSON() : c
      ),
      remainingCount: this.getPlayableCardCount(player),
      gameFinished: false,
      roundUpdate,
      roundWinner,
      currentWinningPlayerId: publicCurrentWinningPlayerId,
      threeTigersTransformation,
      activeSkillActivation,
      ambiguousOptions: ambiguousOptions?.map(option => ({
        index: option.index,
        cards: option.cards.map(card => card.toJSON ? card.toJSON() : card)
      })) || null,
      treatedAsSmall,
      lureTigerSilenced: lureTigerSilencedForPlay,
      concealed,
      roundReveal,
      tenSidedAmbushReveal,
      threePowersReveal,
      trumpAction,
      wholeHandExchange,
      roundCardExchange,
      plannedEconomyDraw,
      mutualSupportReturn,
      strawBoatDecision,
      timeReversalPending,
      forbiddenMagicDecisionPending: this.hasPendingForbiddenMagicDecision(),
      lastStandRequest,
      teammateCheerRequest,
      afterglowRequest,
      afterglowExpired,
      jokerSubstitutions,
      clusterAnalysisSubstitutions,
      forbiddenMagicSubstitutions,
      enduringInheritance: enduringInheritance ? {
        sourceCards: enduringInheritance.sourceCards.map(card => card.toJSON ? card.toJSON() : card),
        sourcePatternType: enduringInheritance.sourcePattern?.type || null,
        inheritedComponentCount: enduringInheritance.inheritedComponentCount
      } : null,
      dreamKilling,
      oldHorseAbsolute,
      oldHorseAbsolutePlay,
      ironEvidenceMode: ironEvidenceModeForPlay,
      waitingRabbitDecision: this.getWaitingRabbitPublicDecision(waitingRabbitDecision),
      waitingRabbitExchange,
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
  undoLastPlay(requestingPlayerId) {
    if (this.room.gameState.phase !== GamePhases.PLAYING) {
      throw new Error('当前不是出牌阶段');
    }
    this.assertTimeReversalDecisionComplete();
    this.assertDestroyDykeDecisionComplete();
    this.assertForbiddenMagicDecisionComplete();
    this.assertLureTigerDecisionComplete();
    this.assertIcebergSelectionComplete();
    this.assertTenSidedAmbushSelectionComplete();
    this.assertWaitingRabbitReady();
    this.assertLastStandDecisionComplete();
    this.assertTeammateCheerDecisionComplete();
    this.assertAfterglowDecisionComplete();
    this.assertAmbiguousChoiceComplete();

    const requester = this.room.findPlayerById(requestingPlayerId);
    if (!requester) {
      throw new Error('玩家不存在');
    }

    const { openHandPlayerId, openHandControllerPlayerId } = this.room.gameState;
    if (requestingPlayerId === openHandPlayerId) {
      throw new Error('本局你的手牌由庄家代为操作');
    }
    const controllablePlayerIds = new Set([requestingPlayerId]);
    if (requestingPlayerId === openHandControllerPlayerId && openHandPlayerId) {
      controllablePlayerIds.add(openHandPlayerId);
    }

    // 检查是否有出牌记录
    if (this.room.gameState.playHistory.length === 0) {
      throw new Error('没有可撤回的出牌记录');
    }

    // 找到该玩家最后一次出牌记录
    let lastPlayIndex = -1;
    for (let i = this.room.gameState.playHistory.length - 1; i >= 0; i--) {
      if (controllablePlayerIds.has(this.room.gameState.playHistory[i].playerId)) {
        lastPlayIndex = i;
        break;
      }
    }

    if (lastPlayIndex === -1) {
      throw new Error('没有找到你的出牌记录');
    }

    const lastPlay = this.room.gameState.playHistory[lastPlayIndex];
    if (lastPlay.waitingRabbitExchange?.accepted) {
      throw new Error('守株待兔换牌已经完成，本次出牌不能撤回');
    }
    if (lastPlay.dreamKillingRandom) {
      throw new Error('梦中随机出牌不能撤回');
    }
    const roundPlayIndex = this.room.gameState.currentRoundPlays.findLastIndex(
      play => play.playerId === lastPlay.playerId && play.playerIndex === lastPlay.playerIndex
    );
    if (roundPlayIndex === -1) {
      throw new Error('本轮已经结算，无法撤回');
    }

    // 检查是否有后续的其他玩家出牌记录
    const hasSubsequentPlays = this.room.gameState.playHistory
      .slice(lastPlayIndex + 1)
      .some(play => play.playerId !== lastPlay.playerId);

    if (hasSubsequentPlays) {
      throw new Error('下一位玩家已经出牌，无法撤回');
    }

    const player = this.room.findPlayerById(lastPlay.playerId);

    // 将牌返回给玩家；若它来自木牛流马，则必须放回盒中而不能混入手牌。
    const woodenOxCardIdSet = new Set(lastPlay.woodenOxCardIds || []);
    const restoredWoodenOxCards = [];
    lastPlay.cards.forEach(cardData => {
      // 从id解析出copyIndex: "suit-rank-copyIndex"
      const parts = cardData.id.split('-');
      const copyIndex = parseInt(parts[2]) || 0;
      const card = new Card(cardData.suit, cardData.rank, copyIndex);
      card.id = cardData.id;
      card.originalSuit = cardData.originalSuit || null;
      card.originalRank = cardData.originalRank || null;
      card.isLastStandTrump = Boolean(cardData.isLastStandTrump);
      card.isUnarmed = Boolean(cardData.isUnarmed);
      card.isStrengthCompensated = Boolean(cardData.isStrengthCompensated);
      card.strengthCompensationDelta = Number(cardData.strengthCompensationDelta) || 0;
      card.isDefenseAsOffenseBoosted = Boolean(cardData.isDefenseAsOffenseBoosted);
      card.defenseAsOffenseDelta = Number(cardData.defenseAsOffenseDelta) || 0;
      card.isTeammateCheered = Boolean(cardData.isTeammateCheered);
      card.isAfterglowBoosted = Boolean(cardData.isAfterglowBoosted);
      card.isRiceToMulberryTransformed = Boolean(cardData.isRiceToMulberryTransformed);
      card.value = card.calculateValue();
      if (woodenOxCardIdSet.has(card.id)) {
        const mule = this.room.gameState.woodenOxMulesByTeam.get(lastPlay.woodenOxTeamIndex);
        if (!mule || mule.holderPlayerId !== player.id || mule.storedCard) {
          throw new Error('木牛流马状态已变化，无法撤回该次出牌');
        }
        mule.storedCard = card;
        restoredWoodenOxCards.push(cardData);
      } else {
        player.addCard(card);
      }
    });

    // 自动排序
    player.cards = DeckService.autoSortCards(player.cards);
    if (restoredWoodenOxCards.length > 0) this.emitWoodenOxPrivateState(player.id);

    // 恢复回合状态
    const playerIndex = lastPlay.playerIndex;
    this.room.gameState.playersPlayedThisRound.delete(playerIndex);

    // 撤掉桌面上的本次出牌，并重新计算首牌与当前最大者。
    this.room.gameState.currentRoundPlays.splice(roundPlayIndex, 1);
    const remainingRoundPlays = this.room.gameState.currentRoundPlays;
    if (lastPlay.oldHorseAbsolute) {
      this.room.gameState.oldHorseProtectedPlayerId = player.id;
      this.room.gameState.oldHorseLastAbsolutePlay = null;
    }
    this.room.gameState.leadingPattern = remainingRoundPlays[0]?.pattern || null;
    const threeTigersTransformation = this.applyThreeTigersAfterPlay();
    if (remainingRoundPlays.length === 0) {
      this.room.gameState.currentWinnerIndex = null;
    } else {
      const comparablePlays = remainingRoundPlays.filter(play => !play.lureTigerSilenced);
      let winningPlay = comparablePlays[0];
      for (const play of comparablePlays.slice(1)) {
        if (winningPlay.oldHorseAbsolute) continue;
        if (play.oldHorseAbsolute) {
          winningPlay = play;
          continue;
        }
        if (play.treatedAsSmall) continue;
        const comparison = compareCards(
          { ...play, pattern: play.comparisonPattern || play.pattern },
          { ...winningPlay, pattern: winningPlay.comparisonPattern || winningPlay.pattern },
          this.room.gameState.leadingPattern.suit,
          this.room.gameState.trumpSuit,
          this.room.gameState.trumpRank,
          this.getRuleRuntimeContext()
        );
        if (comparison > 0) winningPlay = play;
      }
      this.room.gameState.currentWinnerIndex = winningPlay.playerIndex;
    }

    // 如果在有序模式下，恢复当前玩家索引
    if (this.room.gameState.playMode === PlayModes.ORDERED) {
      this.room.gameState.currentPlayerIndex = playerIndex;
    }

    let teammateCheerReverted = null;
    let teammateCheerRestoredCards = [];
    const teammateCheerResolution = lastPlay.teammateCheerResolution;
    if (teammateCheerResolution?.accepted) {
      const buffedPlayer = this.room.findPlayerById(
        teammateCheerResolution.teammatePlayerId
      );
      if (buffedPlayer) {
        const snapshotsById = new Map(
          (teammateCheerResolution.buffedCardsBefore || []).map(snapshot => [snapshot.id, snapshot])
        );
        buffedPlayer.cards.forEach(card => {
          const snapshot = snapshotsById.get(card.id);
          if (!snapshot) return;
          card.suit = snapshot.suit;
          card.rank = snapshot.rank;
          card.originalSuit = snapshot.originalSuit;
          card.originalRank = snapshot.originalRank;
          card.isTeammateCheered = snapshot.isTeammateCheered;
          card.value = card.calculateValue();
        });
        buffedPlayer.cards = DeckService.autoSortCards(buffedPlayer.cards);
        teammateCheerRestoredCards = buffedPlayer.cards.map(card => (
          card.toJSON ? card.toJSON() : card
        ));
        teammateCheerReverted = {
          playerId: player.id,
          playerName: player.name,
          buffedPlayerId: buffedPlayer.id,
          buffedPlayerName: buffedPlayer.name
        };
      }
      this.room.gameState.teammateCheerUsedPlayerIds.delete(player.id);
      this.room.gameState.teammateCheerBuffedPlayerIds.delete(
        teammateCheerResolution.teammatePlayerId
      );
    }
    if (
      teammateCheerResolution
      && this.room.gameState.teammateCheerLastResult?.playerId === player.id
    ) {
      this.room.gameState.teammateCheerLastResult = null;
    }

    let afterglowReverted = null;
    let afterglowRestoredCards = [];
    const afterglowResolution = lastPlay.afterglowResolution;
    if (afterglowResolution?.accepted) {
      const snapshotsById = new Map(
        (afterglowResolution.boostedCardsBefore || []).map(snapshot => [snapshot.id, snapshot])
      );
      player.cards.forEach(card => {
        const snapshot = snapshotsById.get(card.id);
        if (!snapshot) return;
        card.suit = snapshot.suit;
        card.rank = snapshot.rank;
        card.originalSuit = snapshot.originalSuit;
        card.originalRank = snapshot.originalRank;
        card.isAfterglowBoosted = snapshot.isAfterglowBoosted;
        card.value = card.calculateValue();
      });
      player.cards = DeckService.autoSortCards(player.cards);
      afterglowRestoredCards = player.cards.map(card => (
        card.toJSON ? card.toJSON() : card
      ));
      this.room.gameState.afterglowUsedPlayerIds.delete(player.id);
      this.room.gameState.afterglowActivePlayerIds.delete(player.id);
      afterglowReverted = {
        playerId: player.id,
        playerName: player.name,
        activationReverted: true
      };
    } else if (lastPlay.afterglowExpiredAfterPlay) {
      this.room.gameState.afterglowActivePlayerIds.add(player.id);
      afterglowReverted = {
        playerId: player.id,
        playerName: player.name,
        activationReverted: false,
        effectRestored: true
      };
    }
    if (
      afterglowResolution
      && this.room.gameState.afterglowLastResult?.playerId === player.id
    ) {
      this.room.gameState.afterglowLastResult = null;
    }

    if (
      isEncircleThreeMissingOneRule(this.room.gameState.selectedRule)
      && Array.isArray(lastPlay.encircleThreeMissingOneSeenSuitsBeforePlay)
    ) {
      this.room.gameState.encircleThreeMissingOneSeenSuits = [
        ...lastPlay.encircleThreeMissingOneSeenSuitsBeforePlay
      ];
    }

    // 移除出牌记录
    for (const cardId of lastPlay.ironEvidenceBigJokerIds || []) {
      this.room.gameState.ironEvidencePlayedBigJokerIds.delete(cardId);
    }
    for (const entry of lastPlay.waitingRabbitPointEntries || []) {
      if (entry.firstAppearance) {
        this.room.gameState.waitingRabbitSeenPointCardIds.delete(entry.cardId);
      }
    }
    if (lastPlay.hiddenDragonUpdate) {
      const update = lastPlay.hiddenDragonUpdate;
      this.room.gameState.hiddenDragonPlayedRanksByPlayerId.set(
        update.playerId,
        new Set(update.previousPlayedRanks || [])
      );
      if (update.previousEvaluated) {
        this.room.gameState.hiddenDragonEvaluatedPlayerIds.add(update.playerId);
      } else {
        this.room.gameState.hiddenDragonEvaluatedPlayerIds.delete(update.playerId);
      }
      this.room.gameState.attackerScore = update.previousAttackerScore;
      this.room.gameState.hiddenDragonResults.splice(update.previousResultsLength);
      if (update.resolution) {
        this.io.to(this.room.id).emit('hidden_dragon_reverted', {
          playerId: update.playerId,
          playerName: player.name,
          declaredRank: update.resolution.declaredRank
        });
      }
    }
    if (lastPlay.administrativeReviewUpdate && this.room.gameState.administrativeReview) {
      this.room.gameState.administrativeReview.suitMatched =
        lastPlay.administrativeReviewUpdate.previousSuitMatched;
      this.room.gameState.administrativeReview.rankMatched =
        lastPlay.administrativeReviewUpdate.previousRankMatched;
    }
    this.room.gameState.playHistory.splice(lastPlayIndex, 1);

    if (lastPlay.activeSkillId && lastPlay.activeSkillUseConsumed !== false) {
      this.restoreActiveSkillUse(lastPlay.playerId, lastPlay.activeSkillId);
      if (lastPlay.activeSkillId === ActiveSkillIds.DIVINE_WEAPON) {
        this.room.gameState.divineWeaponUsedThisRound = false;
        this.room.gameState.divineWeaponUsedByPlayerId = null;
        this.room.gameState.divineWeaponUsedCardId = null;
      }
    }

    if (lastPlay.bushGateReplayRestriction) {
      this.room.gameState.bushGateRestriction = {
        ...lastPlay.bushGateReplayRestriction,
        forbiddenCardIds: [...(lastPlay.bushGateReplayRestriction.forbiddenCardIds || [])],
        returnedCards: (lastPlay.bushGateReplayRestriction.returnedCards || []).map(
          card => ({ ...card })
        )
      };
      this.room.gameState.bushGateLastResult = {
        ...(this.room.gameState.bushGateLastResult || lastPlay.bushGateReplayRestriction),
        replayCompleted: false,
        replayCards: []
      };
    }

    this.updateRuleHandVisibilityAfterCardChange(player);
    this.requestLastStandIfEligible(player);

    logger.info(`房间 ${this.room.id} 玩家 ${player.name} 撤回了出牌`);

    return {
      playerId: player.id,
      playerName: player.name,
      controllerPlayerId: requestingPlayerId,
      controllerPlayerName: requester.name,
      isProxy: player.id === openHandPlayerId,
      restoredActiveSkillId: lastPlay.activeSkillId || null,
      restoredActiveSkillName: lastPlay.activeSkillName || null,
      concealed: Boolean(lastPlay.concealed),
      cards: lastPlay.cards.filter(card => !woodenOxCardIdSet.has(card.id)),
      woodenOxCards: restoredWoodenOxCards,
      remainingCount: this.getPlayableCardCount(player),
      restoredOldHorseAbsolute: Boolean(lastPlay.oldHorseAbsolute),
      restoredBushGateRestriction: Boolean(lastPlay.bushGateReplayRestriction),
      teammateCheerReverted,
      teammateCheerRestoredCards,
      afterglowReverted,
      afterglowRestoredCards,
      threeTigersTransformation
    };
  }


  /**
   * 结束游戏
   */
  getAbruptStopAtRoundEnd() {
    const { gameState } = this.room;
    if (!isAbruptStopRule(gameState.selectedRule)) return null;
    const triggeringPlayers = this.room.players.filter(player => player.cards.length < 5);
    if (triggeringPlayers.length === 0) return null;
    return {
      triggered: true,
      round: gameState.currentRound,
      triggeringPlayers: triggeringPlayers.map(player => ({
        playerId: player.id,
        playerName: player.name,
        remainingCount: player.cards.length
      }))
    };
  }

  applyAbruptStopBonus() {
    const { gameState } = this.room;
    if (!isAbruptStopRule(gameState.selectedRule)) return null;
    const dealer = this.room.findPlayerById(gameState.buryingPlayerId);
    if (!dealer) return null;
    const pointResolver = card => this.getRuleCardPoints(card);
    const remainingPointCards = extractPointCards(dealer.cards, pointResolver);
    const dealerRemainingPoints = calculateRoundPoints(dealer.cards, pointResolver);
    const attackerBonus = dealerRemainingPoints / 2;
    const scoreBeforeBonus = gameState.attackerScore;
    gameState.attackerScore += attackerBonus;
    logger.info(
      `房间 ${this.room.id} 戛然而止：庄家 ${dealer.name} 剩余牌面分 ${dealerRemainingPoints}，` +
      `闲家获得一半 ${attackerBonus} 分`
    );
    return {
      dealerPlayerId: dealer.id,
      dealerPlayerName: dealer.name,
      dealerRemainingCards: dealer.cards.map(card => card.toJSON ? card.toJSON() : card),
      dealerRemainingPointCards: remainingPointCards.map(card => card.toJSON ? card.toJSON() : card),
      dealerRemainingPoints,
      attackerBonus,
      scoreBeforeBonus,
      totalScore: gameState.attackerScore
    };
  }

  finishGame() {
    // 若牌局在三轮灾期走完前结束，先按“事发”补回分数和20分，再结算底牌与升级。
    const destroyDykeGameEndResult = this.resolveDestroyDykeAtGameEnd()
      || (
        this.room.gameState.destroyDykeLastResult?.reason === 'attacker_won_bottom'
          ? this.room.gameState.destroyDykeLastResult
          : null
      );
    this.room.gameState.phase = GamePhases.REVEALING;
    this.room.gameState.endTime = new Date();

    logger.info(`房间 ${this.room.id} 游戏结束`);

    // 保存当前局的主牌信息（在计算升级更新trumpRank之前）
    const currentGameTrumpSuit = this.room.gameState.trumpSuit;
    const currentGameTrumpRank = this.room.gameState.trumpRank;

    // 计算底牌得分
    const bottomScoreResult = this.calculateBottomScore();
    // 保存当前局的主牌信息到底牌结果中
    bottomScoreResult.currentGameTrumpSuit = currentGameTrumpSuit;
    bottomScoreResult.currentGameTrumpRank = currentGameTrumpRank;
    if (destroyDykeGameEndResult) {
      bottomScoreResult.destroyDyke = destroyDykeGameEndResult;
      bottomScoreResult.totalScore = this.room.gameState.attackerScore;
    }

    // 戛然而止只补庄家本人剩余手牌的一半牌面分；底牌已按最后一轮胜负正常结算。
    const abruptStopResult = this.applyAbruptStopBonus();
    if (abruptStopResult) {
      Object.assign(bottomScoreResult, {
        abruptStop: abruptStopResult,
        totalScore: this.room.gameState.attackerScore
      });
    }

    // 焦点只改逐墩分牌；底牌已在上一步按普通规则独立结算。
    const focusFigureResult = this.finalizeFocusFigureScoring(bottomScoreResult);
    if (focusFigureResult) {
      Object.assign(bottomScoreResult, {
        focusFigure: focusFigureResult,
        baseScore: focusFigureResult.focusTrickScore,
        totalScore: focusFigureResult.totalScore
      });
    }

    // 轮末暗弃的庄家方分牌必须等全局结束后公开并补分，避免中途分数变化泄密。
    const lingeringDiscardResult = this.applyLingeringDiscardBonus();
    if (lingeringDiscardResult) {
      Object.assign(bottomScoreResult, lingeringDiscardResult, {
        totalScore: this.room.gameState.attackerScore
      });
    }

    // 迷雾牌必须晚于所有逐墩分和底牌分结算；补分后才计算胜负与升级。
    const mistyFogResult = this.applyMistyFogBonus();
    if (mistyFogResult) {
      Object.assign(bottomScoreResult, mistyFogResult, {
        totalScore: this.room.gameState.attackerScore
      });
    }
    this.room.gameState.bottomScoreResult = bottomScoreResult;

    logger.info(`底牌结果: ${bottomScoreResult.resultText}, 底牌分数: ${bottomScoreResult.bottomPoints}, 倍数: ${bottomScoreResult.bottomMultiplier}, 闲家总分: ${this.room.gameState.attackerScore}`);

    // 计算升级（这会更新trumpRank为下一局的级牌）
    const upgradeResult = this.calculateUpgrade();
    this.room.gameState.upgradeResult = upgradeResult;

    logger.info(`升级结果: ${upgradeResult.attackerWon ? '闲家获胜' : '庄家获胜'}, 庄家升${upgradeResult.dealerLevelUp}级, 闲家升${upgradeResult.attackerLevelUp}级`);

    // 重置下一局准备状态
    this.room.players.forEach(p => p.isReadyForNext = p.isBot);

    // 下一局规则选择权归本局最后一轮最大的玩家。
    this.room.gameState.nextRuleChooserIndex = this.room.gameState.lastRoundWinnerIndex;
  }

  /** 终局只公开庄家方两人暗弃的分牌，并按牌面分补给闲家。 */
  applyLingeringDiscardBonus() {
    if (!isLingeringDiscardRule(this.room.gameState.selectedRule)) return null;

    const dealerIndex = this.room.getPlayerIndex(this.room.gameState.buryingPlayerId);
    const dealerTeamEntries = (this.room.gameState.lingeringDiscardedCards || []).filter(entry =>
      !this.isAttackerPlayerIndex(entry.playerIndex, dealerIndex)
    );
    const cards = dealerTeamEntries.map(entry => entry.card);
    const pointCards = extractPointCards(cards);
    const lingeringDiscardPoints = calculateRoundPoints(pointCards);
    const lingeringDiscardBonus = lingeringDiscardPoints;
    const scoreBeforeLingeringDiscard = this.room.gameState.attackerScore;
    this.room.gameState.attackerScore += lingeringDiscardBonus;

    logger.info(
      `弃掷逦迤：终局公开庄家方 ${pointCards.length} 张分牌，牌面分 ${lingeringDiscardPoints}，` +
      `闲家补 ${lingeringDiscardBonus} 分，总分 ${this.room.gameState.attackerScore}`
    );

    return {
      lingeringDiscardCards: pointCards.map(card => card.toJSON ? card.toJSON() : card),
      lingeringDiscardPoints,
      lingeringDiscardBonus,
      scoreBeforeLingeringDiscard
    };
  }

  /** 终局才公开迷雾牌，并把其中总分的一半补给闲家。 */
  applyMistyFogBonus() {
    if (!isHeavyFogRule(this.room.gameState.selectedRule)) return null;

    const cards = this.room.gameState.mistyFogCards || [];
    const mistyFogPoints = calculateRoundPoints(cards);
    const mistyFogBonus = mistyFogPoints / 2;
    const scoreBeforeMistyFog = this.room.gameState.attackerScore;
    this.room.gameState.attackerScore += mistyFogBonus;

    logger.info(
      `迷雾重重：公开 ${cards.length} 张迷雾牌，牌面分 ${mistyFogPoints}，` +
      `闲家补 ${mistyFogBonus} 分，总分 ${this.room.gameState.attackerScore}`
    );

    return {
      mistyFogCards: cards.map(card => card.toJSON ? card.toJSON() : card),
      mistyFogPoints,
      mistyFogBonus,
      scoreBeforeMistyFog
    };
  }

  /**
   * 计算底牌得分
   */
  calculateBottomScore() {
    const lastRoundWinnerIndex = this.room.gameState.lastRoundWinnerIndex;
    const dealerIndex = this.room.getPlayerIndex(this.room.gameState.buryingPlayerId);

    // 判断最后一轮赢家是否是闲家
    const attackerWonLastRound = this.isAttackerPlayerIndex(lastRoundWinnerIndex, dealerIndex);

    if (isPeopleCommuneRule(this.room.gameState.selectedRule)) {
      return this.calculatePeopleCommuneBottomScore({
        attackerWonLastRound,
        dealerIndex
      });
    }

    // 底牌是终局最后公开的牌；若重载点数此前从未出现，在这里统一揭晓并照常计分。
    const threePowersRevealFromBottom = this.revealThreePowersIfNeeded(
      this.room.gameState.bottomCards,
      null,
      'bottom'
    );
    const bottomPoints = calculateBottomPoints(
      this.room.gameState.bottomCards,
      card => this.getRuleCardPoints(card)
    );
    const ambushCardCount = this.countTenSidedAmbushCards(this.room.gameState.bottomCards);
    const ambushPoints = ambushCardCount * TEN_SIDED_AMBUSH_CARD_POINTS;

    // 计算倍数
    const bottomMultiplier = calculateBottomMultiplier(this.room.gameState.lastRoundLeadingPattern);

    const normalBottomScore = attackerWonLastRound ? bottomPoints * bottomMultiplier : 0;
    // 闲家抠底时伏击牌扣分；庄家守底时伏击牌反向给闲家加分。
    const ambushScoreDelta = ambushPoints > 0
      ? (attackerWonLastRound ? -ambushPoints : ambushPoints) * bottomMultiplier
      : 0;
    const ambushAttackerNetCardDelta = ambushCardCount > 0
      ? (attackerWonLastRound ? ambushCardCount : -ambushCardCount) * bottomMultiplier
      : 0;
    const bottomScoreGained = normalBottomScore + ambushScoreDelta;

    if (bottomScoreGained !== 0) {
      this.room.gameState.attackerScore += bottomScoreGained;

      // 底牌分数牌不加入 collectedPointCards，只在底牌结果中单独展示
      logger.info(
        `底牌结算：常规 ${normalBottomScore}，十面埋伏 ${ambushScoreDelta}，` +
        `闲家净变化 ${bottomScoreGained}`
      );
    }
    if (ambushAttackerNetCardDelta !== 0) {
      this.room.gameState.tenSidedAmbushAttackerNetCardCount += ambushAttackerNetCardDelta;
    }

    const ambushRevealedFromBottom = Boolean(
      ambushCardCount > 0 && !this.room.gameState.isTenSidedAmbushRevealed
    );
    if (ambushRevealedFromBottom) {
      this.room.gameState.isTenSidedAmbushRevealed = true;
    }

    // 生成结果摘要
    return {
      ...generateScoringSummary({
        collectedPointCards: this.room.gameState.collectedPointCards.map(c => c.toJSON ? c.toJSON() : c),
        attackerScore: this.room.gameState.attackerScore,
        bottomCards: this.room.gameState.bottomCards.map(c => c.toJSON()),
        attackerWonLastRound,
        bottomMultiplier,
        bottomPoints,
        bottomScoreGained,
        ambushRank: ambushCardCount > 0 ? this.room.gameState.tenSidedAmbushRank : null,
        ambushCardCount,
        ambushPoints,
        ambushScoreDelta,
        ambushAttackerNetCardDelta,
        ambushAttackerNetCardCount: this.room.gameState.tenSidedAmbushAttackerNetCardCount,
        ambushRevealedFromBottom
      }),
      threePowersRevealFromBottom
    };
  }

  calculatePeopleCommuneBottomScore({ attackerWonLastRound, dealerIndex }) {
    const { gameState } = this.room;
    const dealerBuriedCards = [];
    const attackerBuriedCards = [];

    for (const [playerId, cards] of gameState.peopleCommuneBuriedCardsByPlayerId.entries()) {
      const playerIndex = this.room.getPlayerIndex(playerId);
      const target = this.isAttackerPlayerIndex(playerIndex, dealerIndex)
        ? attackerBuriedCards
        : dealerBuriedCards;
      target.push(...cards);
    }

    const pointResolver = card => this.getRuleCardPoints(card);
    const dealerBuriedPoints = calculateBottomPoints(dealerBuriedCards, pointResolver);
    const attackerBuriedPoints = calculateBottomPoints(attackerBuriedCards, pointResolver);
    const capturedCards = attackerWonLastRound ? dealerBuriedCards : attackerBuriedCards;
    const capturedPoints = attackerWonLastRound ? dealerBuriedPoints : attackerBuriedPoints;
    const bottomMultiplier = calculateBottomMultiplier(gameState.lastRoundLeadingPattern);
    const bottomScoreGained = capturedPoints * bottomMultiplier * (attackerWonLastRound ? 1 : -1);
    const scoreBeforeBottom = gameState.attackerScore;
    gameState.attackerScore += bottomScoreGained;

    logger.info(
      `人民公社底牌结算：${attackerWonLastRound ? '闲家抄庄家底' : '庄家方抄闲家底'}，` +
      `对方埋分 ${capturedPoints} × ${bottomMultiplier}，闲家变化 ${bottomScoreGained}`
    );

    return {
      ...generateScoringSummary({
        collectedPointCards: gameState.collectedPointCards.map(
          card => card.toJSON ? card.toJSON() : card
        ),
        attackerScore: gameState.attackerScore,
        bottomCards: gameState.bottomCards.map(card => card.toJSON ? card.toJSON() : card),
        attackerWonLastRound,
        bottomMultiplier,
        bottomPoints: capturedPoints,
        bottomScoreGained
      }),
      resultText: attackerWonLastRound ? '闲家抄庄家底' : '庄家方抄闲家底',
      scoreBeforeBottom,
      peopleCommune: {
        capturedSide: attackerWonLastRound ? 'dealer' : 'attacker',
        capturedCards: capturedCards.map(card => card.toJSON ? card.toJSON() : card),
        capturedPoints,
        dealerBuriedCards: dealerBuriedCards.map(card => card.toJSON ? card.toJSON() : card),
        dealerBuriedPoints,
        attackerBuriedCards: attackerBuriedCards.map(card => card.toJSON ? card.toJSON() : card),
        attackerBuriedPoints,
        scoreDelta: bottomScoreGained
      }
    };
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

    const dealerPlayer = this.room.findPlayerByIndex(dealerIndex);

    // 欢乐成双中队伍仍按换位前的玩家组合；其他规则按当前固定座位奇偶分队。
    const dealerTeamIndex = this.getPlayerTeamIndex(dealerPlayer?.id) ?? (dealerIndex % 2);
    const dealerTeam = dealerTeamIndex + 1;
    const attackerTeam = dealerTeam === 1 ? 2 : 1;

    // 升级前的等级
    const oldDealerLevel = dealerTeam === 1 ? this.room.gameState.team1Level : this.room.gameState.team2Level;
    const oldAttackerLevel = attackerTeam === 1 ? this.room.gameState.team1Level : this.room.gameState.team2Level;

    // 升级
    const newDealerLevel = upgradeLevel(oldDealerLevel, dealerLevelUp);
    const newAttackerLevel = upgradeLevel(oldAttackerLevel, attackerLevelUp);

    if (dealerTeam === 1) {
      this.room.gameState.team1Level = newDealerLevel;
      this.room.gameState.team2Level = newAttackerLevel;
    } else {
      this.room.gameState.team1Level = newAttackerLevel;
      this.room.gameState.team2Level = newDealerLevel;
    }

    // 势如破竹下庄家方获胜时原庄家连庄；闲家获胜仍按常规换庄。
    const dealerContinues = !attackerWon &&
      isIrresistibleForceRule(this.room.gameState.selectedRule);
    const shouldRestoreHappyTwins = isHappyTwinsRule(this.room.gameState.selectedRule)
      && this.room.gameState.happyTwins?.active
      && !this.room.gameState.happyTwins?.restored;

    let provisionalNextDealerPlayer = null;
    if (dealerContinues) {
      provisionalNextDealerPlayer = dealerPlayer;
    } else if (shouldRestoreHappyTwins) {
      provisionalNextDealerPlayer = attackerWon
        // 换位后的庄家下家，就是换位前的庄家上家。
        ? this.room.findPlayerByIndex((dealerIndex + 1) % this.room.players.length)
        // 只换座位不换队伍，庄家方获胜仍由庄家的固定队友接庄。
        : this.getFixedTeammate(dealerPlayer?.id);
    } else {
      provisionalNextDealerPlayer = this.room.findPlayerByIndex(
        getNextDealerIndex(dealerIndex, attackerWon, this.room.players.length)
      );
    }
    if (!provisionalNextDealerPlayer) throw new Error('找不到下一局庄家');

    const provisionalNextDealerIndex = this.room.getPlayerIndex(provisionalNextDealerPlayer.id);
    let nextDealerIndex = provisionalNextDealerIndex;
    let happyTwinsRestore = null;
    if (shouldRestoreHappyTwins) {
      happyTwinsRestore = this.restoreHappyTwinsPositions(provisionalNextDealerPlayer.id);
      nextDealerIndex = happyTwinsRestore?.nextDealerIndex ?? provisionalNextDealerIndex;
    } else {
      this.room.gameState.dealerPlayerIndex = nextDealerIndex;
    }

    // 更新下一局的级牌（根据下一局庄家的等级）
    const nextDealerTeam = nextDealerIndex % 2 === 0 ? 1 : 2;
    const nextDealerLevel = nextDealerTeam === 1 ? this.room.gameState.team1Level : this.room.gameState.team2Level;
    this.room.gameState.trumpRank = levelToRank(nextDealerLevel);

    logger.info(`下一局庄家: 玩家${nextDealerIndex}, 等级: ${nextDealerLevel}, 级牌: ${this.room.gameState.trumpRank}`);

    // 获取玩家名称
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
      dealerContinues,
      happyTwins: happyTwinsRestore ? {
        positionsRestored: true,
        nextDealerPlayerId: happyTwinsRestore.nextDealerPlayerId,
        restoredOrderPlayerIds: happyTwinsRestore.restoredOrderPlayerIds
      } : null,
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

    // 先由上一局最后一轮赢家完成二选一，再开始发牌。
    this.startRuleSelection();
  }

  /**
   * 重新开始游戏（房主手动重启）
   */
  restartGame() {
    this.cleanup();
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

    if (this.botActionTimer) {
      clearTimeout(this.botActionTimer);
      this.botActionTimer = null;
    }
    if (this.peopleCommuneBuryTimer) {
      clearTimeout(this.peopleCommuneBuryTimer);
      this.peopleCommuneBuryTimer = null;
    }

    if (this.timeReversalDecisionTimer) {
      clearTimeout(this.timeReversalDecisionTimer);
      this.timeReversalDecisionTimer = null;
    }
    this.timeReversalRoundSnapshot = null;

    this.cardExchangeSelections.clear();

    // 停止回合管理器（如果有需要清理的资源）
    if (this.roundManager) {
      this.roundManager = null;
    }
  }
}
