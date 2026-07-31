import { DEFAULT_CONFIG, GamePhases, PlayModes, Ranks, TurnOrders, levelToRank } from '../utils/constants.js';
import {
  getDayNightHighestRank,
  isAdministrativeReviewRule,
  isAntinomyRule,
  isAmbiguousRule,
  isAfterglowRule,
  isBushGateRule,
  isCandleToDawnRule,
  isChangeRiceToMulberryRule,
  isCulturalRevolutionRule,
  isDayNightRotationRule,
  isDefenseAsOffenseRule,
  isDestroyDykeFloodFieldsRule,
  isEncircleThreeMissingOneRule,
  isHappyTwinsRule,
  isHiddenDragonInAbyssRule,
  isIronEvidenceRule,
  isInviteIntoUrnRule,
  isLostInFogRule,
  isLureTigerFromMountainRule,
  isMainstayRule,
  isMutualSupportRule,
  isOpenlyRevealedRule,
  isOldHorseStillHasStrengthRule,
  isOneCountryTwoSystemsRule,
  isPeopleCommuneRule,
  isPoliticalReviewRule,
  isRecordOnFileRule,
  isRemoveFirewoodRule,
  isSecondBattlefieldRule,
  isStrengthCompensationRule,
  isStrawBoatBorrowingArrowsRule,
  isStriveUpstreamRule,
  isTeammateCheerRule,
  isThreeTigersRule,
  isThreeSixNineGradesRule,
  isTwoGhostsKnockDoorRule,
  isTrumpWinsRule,
  isWaitingRabbitRule,
  isWoodenOxFlowingHorseRule,
  ruleIncludesId
} from '../rules/ruleRegistry.js';
import { getOneCountryPublicState } from '../utils/oneCountryTwoSystemsUtils.js';
import { getIronEvidenceRoundMode } from '../utils/ironEvidenceUtils.js';

export class GameState {
  constructor() {
    this.phase = GamePhases.WAITING;
    this.playMode = PlayModes.ORDERED;
    this.deck = [];
    this.bottomCards = [];
    // “迷雾重重”从牌堆顶暗中移除的八张牌；只在终局结算事件中公开。
    this.mistyFogCards = [];
    // “弃掷逦迤”的弃牌只保存在服务端；终局前不进入公开快照。
    this.lingeringDiscardedCards = [];
    this.bottomCardsCount = DEFAULT_CONFIG.bottomCardsCount;
    this.buryingPlayerId = null;
    this.secondaryBuryingPlayerId = null;
    // “改革开放”的二次埋底者在完成后仍需与庄家共同拥有最终底牌查看权。
    this.reformAndOpeningUpTeammatePlayerId = null;
    // “人民公社”四家依次各埋两张；具体牌面只保存在服务端 Map 中，终局统一公开。
    this.peopleCommuneBuryingOrder = [];
    this.peopleCommuneCurrentBuryingPlayerId = null;
    this.peopleCommuneBuriedCardsByPlayerId = new Map();
    this.activeSkillUsesByPlayerId = new Map();
    // 牌桌默认按逆时针行动；“路线摇摆”在符合条件的整轮结算后翻转。
    this.turnDirection = TurnOrders.COUNTER_CLOCKWISE;
    // “时间倒流”允许多人预备；轮末确认时首个选择发动的人获得回溯权。
    this.timeReversalReservations = new Map();
    this.timeReversalDecisionState = null; // holding | awaiting_response
    this.timeReversalWindowRound = null;
    this.timeReversalLockedRounds = new Set();
    this.wholeHandExchangeTriggers = new Set();
    this.lastStandActivatedPlayerIds = new Set();
    this.lastStandPendingPlayerIds = new Set();
    this.fatalBeautyTrumpBonusApplied = false;
    this.firstPlayerId = null;
    this.currentPlayerIndex = null;
    this.currentRound = 0;
    this.roundStartPlayerIndex = null;
    this.playersPlayedThisRound = new Set();
    // 投降申请可在一墩中的任意时刻提出，但只在完整墩结算后按庄家起顺序处理。
    this.surrenderRequests = new Map();
    this.surrenderDecisionQueue = [];
    this.surrenderCurrentDecision = null;
    this.surrenderLastResult = null;
    this.surrenderFinishGameAfterReview = false;
    // 「力争上游」下，当前轮四家按上轮牌力由大到小的行动顺序。
    this.striveUpstreamPlayOrder = [];
    // “以守为攻”保存上一轮首家在当前轮获得的牌面加成。
    this.defenseAsOffense = null;
    // 轮末停留仍展示刚结束的牌桌，因此额外保留该轮实际生效的加成。
    this.defenseAsOffenseLastRound = null;
    // “二律背反”的当前公开声明；暗选中的新牌面只保存在 GameEngine，避免提前泄露。
    this.antinomyDeclarationsByPlayerId = new Map();
    this.antinomyPendingPlayerIds = new Set();
    this.antinomySelectionStage = null;
    this.antinomyTriggerRound = null;
    // “改稻为桑”只公开选择进度，具体被改造的手牌仍属于私有信息。
    this.riceToMulberryPendingPlayerIds = new Set();
    this.riceToMulberryCompletedPlayerIds = new Set();
    // “毁堤淹田”的最终一手在庄家决定前只保存在服务端；公共状态只展示分数与灾期进度。
    this.destroyDykeUsed = false;
    this.destroyDykeDecision = null;
    this.destroyDykeDisaster = null;
    this.destroyDykeLastResult = null;
    // “记录在案”只公开当前生效轮；lastActiveRound 用于客户端轮末停牌的一秒多展示。
    this.recordOnFileActiveRound = null;
    this.recordOnFileLastActiveRound = null;
    // “九子夺嫡”的候选手牌只对获胜者私发；公共状态仅说明正在等待谁以及规则是否已终止。
    this.ninePrincesDecision = null;
    this.ninePrincesResolved = false;
    this.ninePrincesLastResult = null;
    this.playHistory = [];
    this.drawingIndex = 0;
    this.startTime = null;
    this.endTime = null;
    this.trumpSuit = null; // 主牌花色
    this.trumpRank = Ranks.TWO; // 主牌点数，默认为2
    this.currentTrumpDeclaration = null; // 当前亮主信息 {playerId, playerName, suit, count, declarationType, strength, jokerType}
    // “三六九等”的亮劣与亮主各自反亮，但四种实体级牌花色全桌共用。
    this.currentInferiorDeclaration = null;
    this.threeSixNineClaimedSuits = new Map();
    this.inferiorSuit = null;
    // “铁证如山”在每轮开始时锁定倍增/清零模式；已打出的大王按实体牌ID记录。
    this.ironEvidencePlayedBigJokerIds = new Set();
    this.ironEvidenceRoundMode = null;
    this.ironEvidenceLastResult = null;
    // “守株待兔”的牌面声明保密；仅公开谁已完成暗选、谁已成功交换以及当前待响应交换。
    this.waitingRabbitDeclarationsByPlayerId = new Map();
    this.waitingRabbitPendingSelectionPlayerIds = new Set();
    this.waitingRabbitUsedPlayerIds = new Set();
    // 分牌按实体牌 ID 只在第一次真正上桌时计分。
    this.waitingRabbitSeenPointCardIds = new Set();
    this.waitingRabbitDecision = null;
    this.waitingRabbitLastResult = null;
    this.waitingRabbitBehaviorRecords = [];
    // “釜底抽薪”记录每次真正的反主关系；亮主窗口关闭后倒序逐项询问被反主者。
    this.removeFirewoodCounterPairs = [];
    this.removeFirewoodExchangeQueue = [];
    this.removeFirewoodCurrentDecision = null;
    this.removeFirewoodExchangeResults = [];
    this.oneCountryDeclarationsByTeam = new Map();
    this.oneCountryResolved = null;
    // 每队一具木牛流马；盒中牌仅在服务端保存，公开快照只显示是否有牌。
    this.woodenOxMulesByTeam = new Map();
    this.woodenOxRoundWindow = null;
    this.strengthCompensation = null;
    this.isTrumpDeclarationLocked = false; // 倒计时结束后锁定，换牌期间不可再反主
    // 开局衔接阶段；mainstay 在庄家完成埋底后生效，其余值位于摸牌结束至收底牌之间。
    this.postDrawStage = null; // dealing | trump_window | card_exchange | remove_firewood_exchange | mainstay
    this.pendingDealerPlayerId = null; // 已锁定但尚未收底牌的庄家
    this.isWaitingForReady = false; // 是否在等待玩家准备
    this.selectedRule = null; // 选中的规则 { name, content }
    this.ruleOptions = []; // 本局由服务端提供的规则候选
    this.ruleChooserPlayerId = null; // 本局有权选择规则的玩家
    this.isRuleSelectionPending = false;
    this.ruleSelectionMode = null; // single | double_happiness
    // 摸牌结束后的同时换牌状态；具体选牌只保存在 GameEngine，绝不进入公开快照。
    this.cardExchange = null;
    // “中流砥柱”按一至四号位串行处理；每个人轮到时才按实时手牌重新计算主牌数。
    this.mainstayPlayerQueue = [];
    this.mainstayCurrentAction = null;
    this.mainstayResults = [];
    // “欢乐成双”记录本局临时座次与原始顺序；终局按玩家ID恢复，不能只交换索引。
    this.happyTwins = null;
    // “围三阙一”按每次合法出牌原子化记录实体普通牌花色；摸牌亮主不进入这份状态。
    this.encircleThreeMissingOneSeenSuits = [];
    this.encircleThreeMissingOneLastTransition = null;
    // “算无遗策”的明手与其唯一操作者。牌面由 Room.toJSON 从玩家实时手牌生成。
    this.openHandPlayerId = null;
    this.openHandControllerPlayerId = null;
    this.icebergRevealedCardIdsByPlayer = new Map();
    // “二鬼拍门”达到两王门槛后持续公开该玩家仍在手中的王；即使后来只剩一张也不重新隐藏。
    this.twoGhostsRevealedPlayerIds = new Set();
    // “冰山一角”只公开谁正在选择，不公开其候选牌或已提交牌面。
    this.icebergPendingPlayerIds = new Set();
    this.areAllHandsRevealed = false;
    // “十面埋伏”的点数在首次出现前只对庄家队友可见。
    this.tenSidedAmbushSelectorPlayerId = null;
    this.tenSidedAmbushRank = null;
    this.isTenSidedAmbushSelectionPending = false;
    this.isTenSidedAmbushRevealed = false;
    // 闲家赢得伏击牌记正数，庄家方赢得记负数；底牌按抠底倍数折算。
    this.tenSidedAmbushAttackerNetCardCount = 0;
    // “三权分立”的三个分值槽：实际选择仅保存在服务端，首次出现后才进入公共快照。
    this.threePowersSlots = [];
    this.threePowersPendingPlayerIds = new Set();
    // “君子一言”的声明公开，但并列最短花色候选只私发给对应玩家。
    this.gentlemanPromiseDeclarationsByPlayerId = new Map();
    this.gentlemanPromisePendingPlayerIds = new Set();
    // “潜龙在渊”的声明公开；打出历史按牌面原始点数记录，首次降至12张时只结算一次。
    this.hiddenDragonDeclarationsByPlayerId = new Map();
    this.hiddenDragonPendingPlayerIds = new Set();
    this.hiddenDragonPlayedRanksByPlayerId = new Map();
    this.hiddenDragonEvaluatedPlayerIds = new Set();
    this.hiddenDragonResults = [];
    // “行政审查”在公开声明后先出牌，满足条件前底牌始终封存；命中与延迟埋底状态公开。
    this.administrativeReview = null;
    // “政治审查”先冻结队友提交的整手牌；放行后只批准这一手，收回则不留下任何禁出限制。
    this.politicalReviewPending = null;
    this.politicalReviewApproval = null;
    this.politicalReviewLastResult = null;
    // “再衰三竭”只记录当前连续赢墩者；一旦换人即从1重新累计。
    this.repeatedExhaustionPlayerId = null;
    this.repeatedExhaustionStreak = 0;
    this.repeatedExhaustionLastPenalty = 0;
    this.repeatedExhaustionLastScoreDelta = 0;
    // “焦点人物”的候选、队内投票和逐人缴获分在终局前均留在服务端。
    this.focusFigureTeams = [];
    this.focusFigureCapturedPointsByPlayerId = new Map();
    this.isFocusFigureVotingStarted = false;
    this.isFocusFigureRevealed = false;
    // “计划经济”封存的20张牌不属于底牌，只在正式出牌后的轮末逐张发放。
    this.plannedEconomyReserveCards = [];
    this.plannedEconomyDrawRounds = 0;
    // “等价互惠”拼点期间冻结出牌；双方选牌只在服务端保存，公共快照仅公开参与者与提交进度。
    this.equivalentReciprocityChallenge = null;
    // “同舟共济”的即时请求与轮末返还都冻结出牌；选中的具体牌只保存在服务端。
    this.mutualSupportPendingAction = null;
    this.mutualSupportRoundTransfers = [];
    this.mutualSupportReturnQueue = [];
    // 轮末停留期间由 lastTransition.previousLit 回显刚结算的旧烛态。
    this.candleSelectorPlayerId = null;
    this.candleSelectionPending = false;
    this.candleLit = null;
    this.candleLastTransition = null;
    // “文化革命”真正替换当前主定义；原主单独保存，覆盖声明时从原主重新计算。
    this.culturalRevolution = null;
    this.culturalRevolutionBaseTrumpSuit = null;
    this.culturalRevolutionBaseTrumpRank = null;
    // “三人成虎”只在当前一轮内累计；lastRoundState 供轮末停留期间继续显示旧状态。
    this.threeTigersRoundState = null;
    this.threeTigersLastRoundState = null;
    // “请君入瓮”按声明所在轮次结算；lastResult 供轮末停留及下一轮状态框回显。
    this.inviteIntoUrnDeclarations = [];
    this.inviteIntoUrnLastResult = null;
    // “老骥伏枥”记录哪些玩家曾获得牌权，以及最后一名首次获得者尚未消耗的绝大首发。
    this.oldHorseRightHolderPlayerIds = new Set();
    this.oldHorseProtectedPlayerId = null;
    this.oldHorseLastAbsolutePlay = null;
    // “Trump wins”只替换下一轮首发者，正常牌力赢家仍单独保留。
    this.trumpWinsLastResult = null;
    // “草船借箭”在轮末冻结下一轮出牌；待选的箭是公开牌，弃牌结果同样全场公开。
    this.strawBoatBorrowingArrowsDecision = null;
    this.strawBoatBorrowingArrowsLastResult = null;
    // “布什戈门”只封锁被退回牌在紧接着的那一次重新首发；牌面与限制均全场公开。
    this.bushGateRestriction = null;
    this.bushGateLastResult = null;
    // “队友加油”在每次出牌后询问无主者；确认者给队友施加永久+1牌面 Buff。
    this.teammateCheerPending = null;
    this.teammateCheerUsedPlayerIds = new Set();
    this.teammateCheerBuffedPlayerIds = new Set();
    this.teammateCheerLastResult = null;
    // “回光返照”在开局首家出牌前或玩家出牌后询问仅剩1至3张主牌者；发动后只准出主，直至主牌出尽。
    this.afterglowPending = null;
    this.afterglowUsedPlayerIds = new Set();
    this.afterglowActivePlayerIds = new Set();
    this.afterglowLastResult = null;
    // “模棱两可”在四家出完后冻结轮末；双方案公开，最终选择按三号位到二号位处理。
    this.ambiguousRoundDecision = null;
    // “经久不衰”只保存每名玩家上一个完整轮次的出牌和继承后牌力，不进入公开房间快照。
    this.enduringLastPlaysByPlayerId = new Map();
    // “梦中杀人”可反复入梦；成功命中首家花色或点数时立即移出并恢复玩家控制。
    this.dreamKillingSleepingPlayerIds = new Set();
    // “神兵天降”使用独立的无王牌堆；只有当前两张进入公开快照。
    this.divineWeaponReserveCards = [];
    this.divineWeaponCards = [];
    this.divineWeaponGeneration = 0;
    this.divineWeaponUsedThisRound = false;
    this.divineWeaponUsedByPlayerId = null;
    this.divineWeaponUsedCardId = null;
    // “魔术戏法”的暗选在本轮结算前只保存在服务端，绝不进入公开快照。
    this.magicTrickSelection = null;
    // “禁术秘法”允许所有玩家随时预备；轮首按座位顺序逐个确认，确认后永久生效。
    this.forbiddenMagicReservations = new Map();
    this.forbiddenMagicDecisionQueue = [];
    this.forbiddenMagicCurrentDecisionPlayerId = null;
    this.forbiddenMagicDecisionRound = null;
    this.forbiddenMagicActivePlayerIds = new Set();
    // “调虎离山”允许双方分别抢占一次；预备不占次数，选定目标才锁定本方。
    this.lureTigerReservations = new Map();
    this.lureTigerDecisionQueue = [];
    this.lureTigerCurrentDecision = null;
    this.lureTigerUsedTeamIndexes = new Set();
    this.lureTigerSilencedPlayerIds = new Set();
    this.lureTigerSilencedRound = null;
    this.lureTigerRoundActivations = [];
    // 冷却规则：保存每名玩家上一轮出牌产生的本轮禁用点数/花色。
    this.cardCooldownType = null;
    this.cardCooldownValuesByPlayerId = new Map();
    // “鸟尽弓藏”按实体牌及其有效花色记录传统分牌；某有效花色的分牌齐出后封锁主动首发。
    this.birdPlayedPointCardIds = new Set();
    this.birdPlayedPointCardSuitsById = new Map();
    this.birdExhaustedSuits = new Set();
    // “第二战场”使用独立的标准52张牌堆公开公共牌；各家实体出牌只在完整轮次结束后累计。
    this.secondBattlefieldReserveCards = [];
    this.secondBattlefieldCommunityCards = [];
    this.secondBattlefieldAccumulatedCardsByPlayerId = new Map();
    this.secondBattlefieldGeneration = 0;
    this.secondBattlefieldShowdownCount = 0;
    this.secondBattlefieldFinalStage = false;
    this.secondBattlefieldLastResult = null;
    // 跨局保留：上一局最后一轮赢家将为下一局选择规则。
    this.nextRuleChooserIndex = null;

    // 当前轮出牌记录
    this.currentRoundPlays = []; // [{ playerIndex, playerId, cards, pattern }]
    this.leadingPattern = null; // 首发牌型
    this.currentWinnerIndex = null; // 当前轮最大的玩家索引

    // 得分相关
    this.collectedPointCards = []; // 闲家收集的分数牌
    this.attackerScore = 0; // 闲家总得分
    this.lastRoundLeadingPattern = null; // 最后一轮的首发牌型（用于计算底牌倍数）
    this.lastRoundWinnerIndex = null; // 最后一轮的获胜者索引

    // 升级相关
    this.team1Level = 2; // 索引0和2的队伍等级
    this.team2Level = 2; // 索引1和3的队伍等级
    this.dealerPlayerIndex = null; // 当前庄家玩家索引
  }

  reset() {
    this.phase = GamePhases.WAITING;
    this.playMode = PlayModes.ORDERED;
    this.deck = [];
    this.bottomCards = [];
    this.mistyFogCards = [];
    this.lingeringDiscardedCards = [];
    this.bottomCardsCount = DEFAULT_CONFIG.bottomCardsCount;
    this.buryingPlayerId = null;
    this.secondaryBuryingPlayerId = null;
    this.reformAndOpeningUpTeammatePlayerId = null;
    this.peopleCommuneBuryingOrder = [];
    this.peopleCommuneCurrentBuryingPlayerId = null;
    this.peopleCommuneBuriedCardsByPlayerId.clear();
    this.activeSkillUsesByPlayerId.clear();
    this.turnDirection = TurnOrders.COUNTER_CLOCKWISE;
    this.timeReversalReservations.clear();
    this.timeReversalDecisionState = null;
    this.timeReversalWindowRound = null;
    this.timeReversalLockedRounds.clear();
    this.wholeHandExchangeTriggers.clear();
    this.lastStandActivatedPlayerIds.clear();
    this.lastStandPendingPlayerIds.clear();
    this.fatalBeautyTrumpBonusApplied = false;
    this.firstPlayerId = null;
    this.currentPlayerIndex = null;
    this.currentRound = 0;
    this.roundStartPlayerIndex = null;
    this.playersPlayedThisRound.clear();
    this.surrenderRequests.clear();
    this.surrenderDecisionQueue = [];
    this.surrenderCurrentDecision = null;
    this.surrenderLastResult = null;
    this.surrenderFinishGameAfterReview = false;
    this.striveUpstreamPlayOrder = [];
    this.defenseAsOffense = null;
    this.defenseAsOffenseLastRound = null;
    this.antinomyDeclarationsByPlayerId.clear();
    this.antinomyPendingPlayerIds.clear();
    this.antinomySelectionStage = null;
    this.antinomyTriggerRound = null;
    this.riceToMulberryPendingPlayerIds.clear();
    this.riceToMulberryCompletedPlayerIds.clear();
    this.destroyDykeUsed = false;
    this.destroyDykeDecision = null;
    this.destroyDykeDisaster = null;
    this.destroyDykeLastResult = null;
    this.recordOnFileActiveRound = null;
    this.recordOnFileLastActiveRound = null;
    this.ninePrincesDecision = null;
    this.ninePrincesResolved = false;
    this.ninePrincesLastResult = null;
    this.playHistory = [];
    this.drawingIndex = 0;
    this.startTime = null;
    this.endTime = null;
    this.trumpSuit = null;

    // 根据下一局庄家的等级设置级牌
    if (this.dealerPlayerIndex !== null) {
      // 如果已经有庄家了，根据庄家所属队伍的等级设置级牌
      const dealerTeam = this.dealerPlayerIndex % 2 === 0 ? 1 : 2;
      const dealerLevel = dealerTeam === 1 ? this.team1Level : this.team2Level;
      this.trumpRank = levelToRank(dealerLevel);
    } else {
      // 第一局，默认为2
      this.trumpRank = Ranks.TWO;
    }

    this.currentTrumpDeclaration = null; // 清空亮主信息
    this.currentInferiorDeclaration = null;
    this.threeSixNineClaimedSuits.clear();
    this.inferiorSuit = null;
    this.ironEvidencePlayedBigJokerIds.clear();
    this.ironEvidenceRoundMode = null;
    this.ironEvidenceLastResult = null;
    this.removeFirewoodCounterPairs = [];
    this.removeFirewoodExchangeQueue = [];
    this.removeFirewoodCurrentDecision = null;
    this.removeFirewoodExchangeResults = [];
    this.oneCountryDeclarationsByTeam.clear();
    this.oneCountryResolved = null;
    this.woodenOxMulesByTeam.clear();
    this.woodenOxRoundWindow = null;
    this.strengthCompensation = null;
    this.isTrumpDeclarationLocked = false;
    this.postDrawStage = null;
    this.pendingDealerPlayerId = null;
    this.isWaitingForReady = false;
    this.selectedRule = null;
    this.ruleOptions = [];
    this.ruleChooserPlayerId = null;
    this.isRuleSelectionPending = false;
    this.ruleSelectionMode = null;
    this.cardExchange = null;
    this.mainstayPlayerQueue = [];
    this.mainstayCurrentAction = null;
    this.mainstayResults = [];
    this.happyTwins = null;
    this.encircleThreeMissingOneSeenSuits = [];
    this.encircleThreeMissingOneLastTransition = null;
    this.waitingRabbitDeclarationsByPlayerId.clear();
    this.waitingRabbitPendingSelectionPlayerIds.clear();
    this.waitingRabbitUsedPlayerIds.clear();
    this.waitingRabbitSeenPointCardIds.clear();
    this.waitingRabbitDecision = null;
    this.waitingRabbitLastResult = null;
    this.waitingRabbitBehaviorRecords = [];
    this.openHandPlayerId = null;
    this.openHandControllerPlayerId = null;
    this.icebergRevealedCardIdsByPlayer.clear();
    this.twoGhostsRevealedPlayerIds.clear();
    this.icebergPendingPlayerIds.clear();
    this.areAllHandsRevealed = false;
    this.tenSidedAmbushSelectorPlayerId = null;
    this.tenSidedAmbushRank = null;
    this.isTenSidedAmbushSelectionPending = false;
    this.isTenSidedAmbushRevealed = false;
    this.tenSidedAmbushAttackerNetCardCount = 0;
    this.threePowersSlots = [];
    this.threePowersPendingPlayerIds.clear();
    this.gentlemanPromiseDeclarationsByPlayerId.clear();
    this.gentlemanPromisePendingPlayerIds.clear();
    this.hiddenDragonDeclarationsByPlayerId.clear();
    this.hiddenDragonPendingPlayerIds.clear();
    this.hiddenDragonPlayedRanksByPlayerId.clear();
    this.hiddenDragonEvaluatedPlayerIds.clear();
    this.hiddenDragonResults = [];
    this.administrativeReview = null;
    this.politicalReviewPending = null;
    this.politicalReviewApproval = null;
    this.politicalReviewLastResult = null;
    this.repeatedExhaustionPlayerId = null;
    this.repeatedExhaustionStreak = 0;
    this.repeatedExhaustionLastPenalty = 0;
    this.repeatedExhaustionLastScoreDelta = 0;
    this.focusFigureTeams = [];
    this.focusFigureCapturedPointsByPlayerId.clear();
    this.isFocusFigureVotingStarted = false;
    this.isFocusFigureRevealed = false;
    this.plannedEconomyReserveCards = [];
    this.plannedEconomyDrawRounds = 0;
    this.equivalentReciprocityChallenge = null;
    this.mutualSupportPendingAction = null;
    this.mutualSupportRoundTransfers = [];
    this.mutualSupportReturnQueue = [];
    this.candleSelectorPlayerId = null;
    this.candleSelectionPending = false;
    this.candleLit = null;
    this.candleLastTransition = null;
    this.culturalRevolution = null;
    this.culturalRevolutionBaseTrumpSuit = null;
    this.culturalRevolutionBaseTrumpRank = null;
    this.threeTigersRoundState = null;
    this.threeTigersLastRoundState = null;
    this.inviteIntoUrnDeclarations = [];
    this.inviteIntoUrnLastResult = null;
    this.oldHorseRightHolderPlayerIds.clear();
    this.oldHorseProtectedPlayerId = null;
    this.oldHorseLastAbsolutePlay = null;
    this.trumpWinsLastResult = null;
    this.strawBoatBorrowingArrowsDecision = null;
    this.strawBoatBorrowingArrowsLastResult = null;
    this.bushGateRestriction = null;
    this.bushGateLastResult = null;
    this.teammateCheerPending = null;
    this.teammateCheerUsedPlayerIds.clear();
    this.teammateCheerBuffedPlayerIds.clear();
    this.teammateCheerLastResult = null;
    this.afterglowPending = null;
    this.afterglowUsedPlayerIds.clear();
    this.afterglowActivePlayerIds.clear();
    this.afterglowLastResult = null;
    this.ambiguousRoundDecision = null;
    this.enduringLastPlaysByPlayerId.clear();
    this.dreamKillingSleepingPlayerIds.clear();
    this.divineWeaponReserveCards = [];
    this.divineWeaponCards = [];
    this.divineWeaponGeneration = 0;
    this.divineWeaponUsedThisRound = false;
    this.divineWeaponUsedByPlayerId = null;
    this.divineWeaponUsedCardId = null;
    this.magicTrickSelection = null;
    this.forbiddenMagicReservations.clear();
    this.forbiddenMagicDecisionQueue = [];
    this.forbiddenMagicCurrentDecisionPlayerId = null;
    this.forbiddenMagicDecisionRound = null;
    this.forbiddenMagicActivePlayerIds.clear();
    this.lureTigerReservations.clear();
    this.lureTigerDecisionQueue = [];
    this.lureTigerCurrentDecision = null;
    this.lureTigerUsedTeamIndexes.clear();
    this.lureTigerSilencedPlayerIds.clear();
    this.lureTigerSilencedRound = null;
    this.lureTigerRoundActivations = [];
    this.cardCooldownType = null;
    this.cardCooldownValuesByPlayerId.clear();
    this.birdPlayedPointCardIds.clear();
    this.birdPlayedPointCardSuitsById.clear();
    this.birdExhaustedSuits.clear();
    this.secondBattlefieldReserveCards = [];
    this.secondBattlefieldCommunityCards = [];
    this.secondBattlefieldAccumulatedCardsByPlayerId.clear();
    this.secondBattlefieldGeneration = 0;
    this.secondBattlefieldShowdownCount = 0;
    this.secondBattlefieldFinalStage = false;
    this.secondBattlefieldLastResult = null;

    // 重置当前轮出牌记录
    this.currentRoundPlays = [];
    this.leadingPattern = null;
    this.currentWinnerIndex = null;

    // 重置得分相关
    this.collectedPointCards = [];
    this.attackerScore = 0;
    this.lastRoundLeadingPattern = null;
    this.lastRoundWinnerIndex = null;

    // 注意：不重置升级相关字段（team1Level, team2Level, dealerPlayerIndex）
    // 这些字段需要在多局游戏中保持
  }

  getRecordOnFilePublicState() {
    if (!isRecordOnFileRule(this.selectedRule)) return null;

    const hasVisibleWindow = Number.isInteger(this.recordOnFileActiveRound)
      || Number.isInteger(this.recordOnFileLastActiveRound);
    const counts = {
      spades: {},
      hearts: {},
      clubs: {},
      diamonds: {},
      joker: {}
    };
    let playedCardCount = 0;

    if (hasVisibleWindow) {
      // 暗置牌在本轮统一揭晓前不能通过记牌器反推出牌面；清桌后它们会自然进入统计。
      const concealedCardIds = new Set(
        this.currentRoundPlays
          .filter(play => play.concealed)
          .flatMap(play => play.originalCards || play.cards || [])
          .map(card => card.id)
      );
      const ordinaryRanks = new Set([
        '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'
      ]);
      const ordinarySuits = new Set(['spades', 'hearts', 'clubs', 'diamonds']);

      this.playHistory.forEach(play => {
        (play.cards || []).forEach(card => {
          if (concealedCardIds.has(card.id)) return;
          const suit = card.ninePrincesScoringSuit || card.originalSuit || card.suit;
          const rank = card.ninePrincesScoringRank || card.originalRank || card.rank;
          const isOrdinaryCard = ordinarySuits.has(suit) && ordinaryRanks.has(rank);
          const isJoker = suit === 'joker'
            && [
              'small_joker',
              'big_joker',
              'county_prince_joker',
              'prince_joker',
              'white_joker'
            ].includes(rank);
          if (!isOrdinaryCard && !isJoker) return;
          counts[suit][rank] = (counts[suit][rank] || 0) + 1;
          playedCardCount++;
        });
      });
    }

    return {
      activeRound: this.recordOnFileActiveRound,
      lastActiveRound: this.recordOnFileLastActiveRound,
      playedCardCount,
      counts
    };
  }

  toJSON() {
    const isLostInFogScoringHidden = isLostInFogRule(this.selectedRule)
      && ![GamePhases.REVEALING, GamePhases.FINISHED].includes(this.phase);
    const recordOnFile = this.getRecordOnFilePublicState();
    // cards_played 是一次性消息，玩家刷新或暂时返回房间页后无法重放。
    // 因此把尚未结算的本墩牌作为公开快照一并下发，供客户端重建牌桌。
    // 暗置牌在揭晓前只公开张数，绝不能借重连快照泄露牌面。
    const currentRoundHistory = this.playHistory.filter(
      entry => entry.round === this.currentRound
    );
    const currentRoundTable = this.currentRoundPlays.map((play, index) => {
      const historyEntry = currentRoundHistory[index]
        || currentRoundHistory.find(entry => entry.playerId === play.playerId)
        || null;
      const serializeCard = card => card?.toJSON ? card.toJSON() : card;
      const visibleCards = play.concealed ? [] : (play.cards || []).map(serializeCard);

      return {
        playerIndex: play.playerIndex,
        playerId: play.playerId,
        playerName: historyEntry?.playerName || null,
        controllerPlayerId: historyEntry?.controllerPlayerId || play.playerId,
        controllerPlayerName: historyEntry?.controllerPlayerName || historyEntry?.playerName || null,
        isProxy: Boolean(historyEntry?.isProxy),
        cards: visibleCards,
        cardsCount: (play.cards || []).length,
        concealed: Boolean(play.concealed),
        treatedAsSmall: Boolean(play.treatedAsSmall),
        activeSkillId: play.activeSkillId || null,
        activeSkillName: play.activeSkillName || null,
        jokerSubstitutions: play.jokerSubstitutions || [],
        clusterAnalysisSubstitutions: play.clusterAnalysisSubstitutions || [],
        forbiddenMagicSubstitutions: play.forbiddenMagicSubstitutions || [],
        enduringInheritance: play.enduringInheritance || null,
        dreamKilling: play.dreamKilling || null,
        oldHorseAbsolute: Boolean(play.oldHorseAbsolute),
        lureTigerSilenced: Boolean(play.lureTigerSilenced),
        ironEvidenceMode: play.ironEvidenceMode || null,
        ambiguousOptions: play.concealed ? null : (play.ambiguousOptions || null),
        timestamp: historyEntry?.timestamp || null
      };
    });
    return {
      phase: this.phase,
      playMode: this.playMode,
      bottomCardsCount: this.bottomCardsCount,
      ...(isOpenlyRevealedRule(this.selectedRule) ? {
        publicBottomCards: this.bottomCards.map(card => card.toJSON())
      } : {}),
      buryingPlayerId: this.buryingPlayerId,
      secondaryBuryingPlayerId: this.secondaryBuryingPlayerId,
      reformAndOpeningUpTeammatePlayerId: this.reformAndOpeningUpTeammatePlayerId,
      peopleCommune: isPeopleCommuneRule(this.selectedRule) ? {
        requiredCards: 2,
        currentBuryingPlayerId: this.peopleCommuneCurrentBuryingPlayerId,
        buryingOrder: [...this.peopleCommuneBuryingOrder],
        submittedPlayerIds: Array.from(this.peopleCommuneBuriedCardsByPlayerId.keys())
      } : null,
      activeSkillUsesByPlayerId: Object.fromEntries(
        [...this.activeSkillUsesByPlayerId.entries()].map(([playerId, skillIds]) => [
          playerId,
          Array.from(skillIds)
        ])
      ),
      turnDirection: this.turnDirection,
      dayNightHighestRank: isDayNightRotationRule(this.selectedRule)
        ? getDayNightHighestRank(this.currentRound, this.trumpRank)
        : null,
      timeReversal: ruleIncludesId(this.selectedRule, 'time_reversal') ? {
        reservations: Array.from(this.timeReversalReservations.values(), reservation => ({
          ...reservation
        })),
        decisionState: this.timeReversalDecisionState,
        windowRound: this.timeReversalWindowRound,
        lockedRounds: Array.from(this.timeReversalLockedRounds)
      } : null,
      wholeHandExchangeTriggers: Array.from(this.wholeHandExchangeTriggers),
      lastStandActivatedPlayerIds: Array.from(this.lastStandActivatedPlayerIds),
      lastStandPendingPlayerIds: Array.from(this.lastStandPendingPlayerIds),
      firstPlayerId: this.firstPlayerId,
      currentPlayerIndex: this.currentPlayerIndex,
      currentRound: this.currentRound,
      roundStartPlayerIndex: this.roundStartPlayerIndex,
      playersPlayedThisRound: Array.from(this.playersPlayedThisRound),
      surrender: {
        requestedPlayerIds: Array.from(this.surrenderRequests.keys()),
        requests: Array.from(this.surrenderRequests.values(), request => ({ ...request })),
        currentDecision: this.surrenderCurrentDecision
          ? { ...this.surrenderCurrentDecision }
          : null,
        queuedPlayerIds: this.surrenderDecisionQueue.map(
          decision => decision.initiatorPlayerId
        ),
        lastResult: this.surrenderLastResult
          ? { ...this.surrenderLastResult }
          : null
      },
      striveUpstreamPlayOrder: isStriveUpstreamRule(this.selectedRule)
        ? [...this.striveUpstreamPlayOrder]
        : [],
      defenseAsOffense: isDefenseAsOffenseRule(this.selectedRule)
        ? (this.defenseAsOffense ? { ...this.defenseAsOffense } : null)
        : null,
      defenseAsOffenseLastRound: isDefenseAsOffenseRule(this.selectedRule)
        ? (this.defenseAsOffenseLastRound ? { ...this.defenseAsOffenseLastRound } : null)
        : null,
      antinomy: isAntinomyRule(this.selectedRule) ? {
        declarationsByPlayerId: Object.fromEntries(
          Array.from(this.antinomyDeclarationsByPlayerId, ([playerId, declaration]) => [
            playerId,
            { ...declaration }
          ])
        ),
        pendingPlayerIds: Array.from(this.antinomyPendingPlayerIds),
        selectionStage: this.antinomySelectionStage,
        triggerRound: this.antinomyTriggerRound
      } : null,
      riceToMulberry: isChangeRiceToMulberryRule(this.selectedRule) ? {
        pendingPlayerIds: Array.from(this.riceToMulberryPendingPlayerIds),
        completedPlayerIds: Array.from(this.riceToMulberryCompletedPlayerIds)
      } : null,
      destroyDyke: isDestroyDykeFloodFieldsRule(this.selectedRule) ? {
        used: this.destroyDykeUsed,
        pending: this.destroyDykeDecision ? {
          round: this.destroyDykeDecision.round,
          dealerPlayerId: this.destroyDykeDecision.dealerPlayerId,
          dealerPlayerName: this.destroyDykeDecision.dealerPlayerName,
          winnerPlayerId: this.destroyDykeDecision.winnerPlayerId,
          winnerPlayerName: this.destroyDykeDecision.winnerPlayerName,
          roundPoints: this.destroyDykeDecision.roundPoints
        } : null,
        disaster: this.destroyDykeDisaster ? { ...this.destroyDykeDisaster } : null,
        lastResult: this.destroyDykeLastResult ? { ...this.destroyDykeLastResult } : null
      } : null,
      recordOnFile,
      ninePrinces: ruleIncludesId(this.selectedRule, 'nine_princes_succession') ? {
        resolved: this.ninePrincesResolved,
        pending: this.ninePrincesDecision ? {
          decisionId: this.ninePrincesDecision.decisionId,
          round: this.ninePrincesDecision.round,
          playerId: this.ninePrincesDecision.playerId,
          playerName: this.ninePrincesDecision.playerName
        } : null,
        lastResult: this.ninePrincesLastResult
          ? { ...this.ninePrincesLastResult }
          : null
      } : null,
      playHistoryCount: this.playHistory.length,
      drawingProgress: this.drawingIndex,
      totalCards: this.deck.length,
      startTime: this.startTime,
      endTime: this.endTime,
      trumpSuit: this.trumpSuit,
      trumpRank: this.trumpRank,
      // 亮主牌是已经公开的牌局记录，不应随着实体牌离开手牌或客户端重连而消失。
      currentTrumpDeclaration: this.currentTrumpDeclaration
        ? {
            ...this.currentTrumpDeclaration,
            cards: (this.currentTrumpDeclaration.cards || []).map(
              card => card.toJSON ? card.toJSON() : card
            )
          }
        : null,
      currentInferiorDeclaration: this.currentInferiorDeclaration
        ? {
            ...this.currentInferiorDeclaration,
            cards: (this.currentInferiorDeclaration.cards || []).map(
              card => card.toJSON ? card.toJSON() : card
            )
          }
        : null,
      oneCountryTwoSystems: isOneCountryTwoSystemsRule(this.selectedRule)
        ? getOneCountryPublicState(this)
        : null,
      threeSixNine: isThreeSixNineGradesRule(this.selectedRule) ? {
        inferiorSuit: this.inferiorSuit,
        currentTrumpDeclaration: this.currentTrumpDeclaration
          ? {
              ...this.currentTrumpDeclaration,
              cards: (this.currentTrumpDeclaration.cards || []).map(
                card => card.toJSON ? card.toJSON() : card
              )
            }
          : null,
        currentInferiorDeclaration: this.currentInferiorDeclaration
          ? {
              ...this.currentInferiorDeclaration,
              cards: (this.currentInferiorDeclaration.cards || []).map(
                card => card.toJSON ? card.toJSON() : card
              )
            }
          : null,
        claimedSuits: Object.fromEntries(
          Array.from(this.threeSixNineClaimedSuits.entries(), ([suit, claim]) => [
            suit,
            { ...claim }
          ])
        )
      } : null,
      ironEvidence: isIronEvidenceRule(this.selectedRule) ? {
        roundMode: this.ironEvidenceRoundMode || getIronEvidenceRoundMode(
          this.ironEvidencePlayedBigJokerIds.size
        ),
        playedBigJokerCount: this.ironEvidencePlayedBigJokerIds.size,
        lastResult: this.ironEvidenceLastResult
          ? { ...this.ironEvidenceLastResult }
          : null
      } : null,
      waitingRabbit: isWaitingRabbitRule(this.selectedRule) ? {
        pendingSelectionPlayerIds: Array.from(this.waitingRabbitPendingSelectionPlayerIds),
        selectedPlayerIds: Array.from(this.waitingRabbitDeclarationsByPlayerId.keys()),
        usedPlayerIds: Array.from(this.waitingRabbitUsedPlayerIds),
        pendingDecision: this.waitingRabbitDecision ? {
          id: this.waitingRabbitDecision.id,
          round: this.waitingRabbitDecision.round,
          chooserPlayerId: this.waitingRabbitDecision.chooserPlayerId,
          chooserPlayerName: this.waitingRabbitDecision.chooserPlayerName,
          sourcePlayerId: this.waitingRabbitDecision.sourcePlayerId,
          sourcePlayerName: this.waitingRabbitDecision.sourcePlayerName,
          targetCard: this.waitingRabbitDecision.targetCard?.toJSON
            ? this.waitingRabbitDecision.targetCard.toJSON()
            : this.waitingRabbitDecision.targetCard
        } : null,
        lastResult: this.waitingRabbitLastResult
          ? { ...this.waitingRabbitLastResult }
          : null,
        behaviorRecords: this.waitingRabbitBehaviorRecords.map(record => ({
          ...record,
          targetCard: record.targetCard?.toJSON
            ? record.targetCard.toJSON()
            : record.targetCard || null,
          discardedCard: record.discardedCard?.toJSON
            ? record.discardedCard.toJSON()
            : record.discardedCard || null
        }))
      } : null,
      woodenOx: isWoodenOxFlowingHorseRule(this.selectedRule) ? {
        round: this.woodenOxRoundWindow?.round ?? this.currentRound,
        pendingPlayerIds: Array.from(this.woodenOxRoundWindow?.pendingPlayerIds || []),
        requiredTransferPlayerIds: Array.from(
          this.woodenOxRoundWindow?.requiredTransferPlayerIds || []
        ),
        mules: Array.from(this.woodenOxMulesByTeam.values(), mule => ({
          teamIndex: mule.teamIndex,
          initialHolderPlayerId: mule.initialHolderPlayerId,
          holderPlayerId: mule.holderPlayerId,
          hasStoredCard: Boolean(mule.storedCard),
          transfersUsed: mule.transfersUsed,
          maxTransfers: mule.maxTransfers,
          completedRoundTrips: Math.floor(mule.transfersUsed / 2),
          maxRoundTrips: 2
        }))
      } : null,
      strengthCompensation: isStrengthCompensationRule(this.selectedRule)
        ? (this.strengthCompensation ? { ...this.strengthCompensation } : null)
        : null,
      isTrumpDeclarationLocked: this.isTrumpDeclarationLocked,
      postDrawStage: this.postDrawStage,
      pendingDealerPlayerId: this.pendingDealerPlayerId,
      removeFirewood: isRemoveFirewoodRule(this.selectedRule) ? {
        counterCount: this.removeFirewoodCounterPairs.length,
        currentDecision: this.removeFirewoodCurrentDecision
          ? { ...this.removeFirewoodCurrentDecision }
          : null,
        remainingCount: this.removeFirewoodExchangeQueue.length,
        resolved: this.removeFirewoodExchangeResults.map(result => ({ ...result }))
      } : null,
      isWaitingForReady: this.isWaitingForReady,
      selectedRule: this.selectedRule,
      ruleOptions: this.ruleOptions,
      ruleChooserPlayerId: this.ruleChooserPlayerId,
      isRuleSelectionPending: this.isRuleSelectionPending,
      ruleSelectionMode: this.ruleSelectionMode,
      cardExchange: this.cardExchange ? {
        stage: this.cardExchange.stage || 'opening',
        operation: this.cardExchange.operation || 'exchange',
        triggerRound: this.cardExchange.triggerRound ?? null,
        ruleId: this.cardExchange.ruleId,
        ruleName: this.cardExchange.ruleName,
        requiredCards: this.cardExchange.requiredCards,
        targetByPlayerId: { ...this.cardExchange.targetByPlayerId },
        submittedPlayerIds: Array.from(this.cardExchange.submittedPlayerIds || [])
      } : null,
      mainstay: isMainstayRule(this.selectedRule) ? {
        currentAction: this.mainstayCurrentAction
          ? Object.fromEntries(
              Object.entries(this.mainstayCurrentAction)
                .filter(([key]) => key !== 'trumpCount')
            )
          : null,
        remainingPlayerIds: [...this.mainstayPlayerQueue],
        results: this.mainstayResults.map(result => Object.fromEntries(
          Object.entries(result).filter(([key]) => key !== 'trumpCount')
        ))
      } : null,
      happyTwins: isHappyTwinsRule(this.selectedRule) && this.happyTwins
        ? {
            active: this.happyTwins.active === true,
            restored: this.happyTwins.restored === true,
            dealerPlayerId: this.happyTwins.dealerPlayerId,
            upstreamPlayerId: this.happyTwins.upstreamPlayerId,
            originalDealerIndex: this.happyTwins.originalDealerIndex,
            originalUpstreamIndex: this.happyTwins.originalUpstreamIndex,
            swappedDealerIndex: this.happyTwins.swappedDealerIndex,
            swappedUpstreamIndex: this.happyTwins.swappedUpstreamIndex,
            teamIndexByPlayerId: Object.fromEntries(
              (this.happyTwins.originalOrderPlayerIds || []).map((playerId, index) => [
                playerId,
                index % 2
              ])
            ),
            nextDealerPlayerId: this.happyTwins.nextDealerPlayerId || null,
            nextDealerIndex: this.happyTwins.nextDealerIndex ?? null
        }
        : null,
      encircleThreeMissingOne: isEncircleThreeMissingOneRule(this.selectedRule)
        ? {
            seenSuits: [...this.encircleThreeMissingOneSeenSuits],
            lastTransition: this.encircleThreeMissingOneLastTransition
              ? { ...this.encircleThreeMissingOneLastTransition }
              : null
          }
        : null,
      openHandPlayerId: this.openHandPlayerId,
      openHandControllerPlayerId: this.openHandControllerPlayerId,
      icebergPendingPlayerIds: Array.from(this.icebergPendingPlayerIds),
      twoGhosts: isTwoGhostsKnockDoorRule(this.selectedRule) ? {
        revealedPlayerIds: Array.from(this.twoGhostsRevealedPlayerIds)
      } : null,
      tenSidedAmbush: this.tenSidedAmbushSelectorPlayerId ? {
        selectorPlayerId: this.tenSidedAmbushSelectorPlayerId,
        isSelectionPending: this.isTenSidedAmbushSelectionPending,
        isRevealed: this.isTenSidedAmbushRevealed,
        attackerNetCardCount: this.tenSidedAmbushAttackerNetCardCount,
        // 未公开时绝不把秘密点数放入公共房间快照。
        rank: this.isTenSidedAmbushRevealed ? this.tenSidedAmbushRank : null
      } : null,
      threePowers: this.threePowersSlots.length > 0 ? {
        isSelectionPending: this.threePowersPendingPlayerIds.size > 0,
        pendingPlayerIds: Array.from(this.threePowersPendingPlayerIds),
        slots: this.threePowersSlots.map(slot => ({
          sourceRank: slot.sourceRank,
          pointValue: slot.pointValue,
          selectorPlayerId: slot.selectorPlayerId,
          isSelected: Boolean(slot.selectedRank),
          isRevealed: Boolean(slot.isRevealed),
          // 未揭晓的重载点数绝不进入公共房间快照。
          rank: slot.isRevealed ? slot.selectedRank : null
        }))
      } : null,
      gentlemanPromise: (
        this.gentlemanPromiseDeclarationsByPlayerId.size > 0 ||
        this.gentlemanPromisePendingPlayerIds.size > 0
      ) ? {
          pendingPlayerIds: Array.from(this.gentlemanPromisePendingPlayerIds),
          declarationsByPlayerId: Object.fromEntries(this.gentlemanPromiseDeclarationsByPlayerId)
        } : null,
      hiddenDragon: isHiddenDragonInAbyssRule(this.selectedRule) ? {
        pendingPlayerIds: Array.from(this.hiddenDragonPendingPlayerIds),
        declarationsByPlayerId: Object.fromEntries(this.hiddenDragonDeclarationsByPlayerId),
        playedDeclaredRankByPlayerId: Object.fromEntries(
          Array.from(this.hiddenDragonDeclarationsByPlayerId, ([playerId, rank]) => [
            playerId,
            this.hiddenDragonPlayedRanksByPlayerId.get(playerId)?.has(rank) || false
          ])
        ),
        evaluatedPlayerIds: Array.from(this.hiddenDragonEvaluatedPlayerIds),
        results: this.hiddenDragonResults.map(result => ({ ...result }))
      } : null,
      administrativeReview: isAdministrativeReviewRule(this.selectedRule)
        ? (this.administrativeReview ? { ...this.administrativeReview } : null)
        : null,
      politicalReview: isPoliticalReviewRule(this.selectedRule) ? {
        pending: this.politicalReviewPending ? {
          id: this.politicalReviewPending.id,
          round: this.politicalReviewPending.round,
          reviewerPlayerId: this.politicalReviewPending.reviewerPlayerId,
          reviewerPlayerName: this.politicalReviewPending.reviewerPlayerName,
          teammatePlayerId: this.politicalReviewPending.teammatePlayerId,
          teammatePlayerName: this.politicalReviewPending.teammatePlayerName,
          cards: this.politicalReviewPending.cards.map(card => ({ ...card }))
        } : null,
        usedPlayerIds: [...this.activeSkillUsesByPlayerId.entries()]
          .filter(([, skillIds]) => skillIds.has('political_review'))
          .map(([playerId]) => playerId),
        lastResult: this.politicalReviewLastResult
          ? {
              ...this.politicalReviewLastResult,
              cards: this.politicalReviewLastResult.cards.map(card => ({ ...card }))
            }
          : null
      } : null,
      repeatedExhaustion: this.repeatedExhaustionPlayerId ? {
        playerId: this.repeatedExhaustionPlayerId,
        streak: this.repeatedExhaustionStreak,
        lastPenalty: this.repeatedExhaustionLastPenalty,
        lastScoreDelta: this.repeatedExhaustionLastScoreDelta
      } : null,
      focusFigure: this.focusFigureTeams.length > 0 ? {
        isVotingPending: this.isFocusFigureVotingStarted &&
          this.focusFigureTeams.some(team => !team.isFinalized),
        finalizedTeamCount: this.focusFigureTeams.filter(team => team.isFinalized).length,
        isRevealed: this.isFocusFigureRevealed,
        // 每名玩家打出的分牌被闲家收走多少是公开进度；焦点身份与队内票型仍严格保密。
        capturedPointsByPlayerId: Object.fromEntries(this.focusFigureCapturedPointsByPlayerId),
        ...(this.isFocusFigureRevealed ? {
          teams: this.focusFigureTeams.map(team => ({
            team: team.team,
            playerIds: [...team.playerIds],
            focusPlayerId: team.finalPlayerId
          }))
        } : {})
      } : null,
      plannedEconomy: ruleIncludesId(this.selectedRule, 'planned_economy') ? {
        totalReservedCards: 20,
        remainingCards: this.plannedEconomyReserveCards.length,
        completedDrawRounds: this.plannedEconomyDrawRounds,
        isDrawingEnabled: this.phase === GamePhases.PLAYING
      } : null,
      equivalentReciprocity: this.equivalentReciprocityChallenge ? {
        challengeId: this.equivalentReciprocityChallenge.id,
        initiatorPlayerId: this.equivalentReciprocityChallenge.initiatorPlayerId,
        targetPlayerId: this.equivalentReciprocityChallenge.targetPlayerId,
        selectedPlayerIds: Array.from(
          this.equivalentReciprocityChallenge.selectedCardsByPlayerId?.keys?.() || []
        )
      } : null,
      mutualSupport: isMutualSupportRule(this.selectedRule) ? {
        pendingAction: this.mutualSupportPendingAction ? {
          actionId: this.mutualSupportPendingAction.id,
          stage: this.mutualSupportPendingAction.stage,
          round: this.mutualSupportPendingAction.round,
          chooserPlayerId: this.mutualSupportPendingAction.chooserPlayerId,
          otherPlayerId: this.mutualSupportPendingAction.otherPlayerId,
          fromPlayerId: this.mutualSupportPendingAction.fromPlayerId,
          toPlayerId: this.mutualSupportPendingAction.toPlayerId,
          minCards: this.mutualSupportPendingAction.minCards,
          maxCards: this.mutualSupportPendingAction.maxCards,
          requiredCards: this.mutualSupportPendingAction.requiredCards ?? null
        } : null,
        pendingReturnCount: this.mutualSupportReturnQueue.length
          + (this.mutualSupportPendingAction?.stage === 'return' ? 1 : 0),
        outstandingTransferCount: this.mutualSupportRoundTransfers.length
      } : null,
      candleToDawn: isCandleToDawnRule(this.selectedRule) ? {
        selectorPlayerId: this.candleSelectorPlayerId,
        isSelectionPending: this.candleSelectionPending,
        isLit: this.candleLit,
        lastTransition: this.candleLastTransition
          ? { ...this.candleLastTransition }
          : null
      } : null,
      culturalRevolution: isCulturalRevolutionRule(this.selectedRule) ? {
        active: Boolean(this.culturalRevolution),
        baseTrumpSuit: this.culturalRevolutionBaseTrumpSuit,
        baseTrumpRank: this.culturalRevolutionBaseTrumpRank,
        declaration: this.culturalRevolution ? { ...this.culturalRevolution } : null
      } : null,
      threeTigers: isThreeTigersRule(this.selectedRule) ? {
        currentRound: this.threeTigersRoundState
          ? {
              ...this.threeTigersRoundState,
              contributingPlayerIds: [...(this.threeTigersRoundState.contributingPlayerIds || [])],
              suitCounts: { ...(this.threeTigersRoundState.suitCounts || {}) }
            }
          : null,
        lastRound: this.threeTigersLastRoundState
          ? {
              ...this.threeTigersLastRoundState,
              contributingPlayerIds: [...(this.threeTigersLastRoundState.contributingPlayerIds || [])],
              suitCounts: { ...(this.threeTigersLastRoundState.suitCounts || {}) }
            }
          : null
      } : null,
      inviteIntoUrn: isInviteIntoUrnRule(this.selectedRule) ? {
        declarations: this.inviteIntoUrnDeclarations.map(declaration => ({ ...declaration })),
        lastResult: this.inviteIntoUrnLastResult
          ? {
              ...this.inviteIntoUrnLastResult,
              declarations: (this.inviteIntoUrnLastResult.declarations || []).map(
                declaration => ({ ...declaration })
              )
            }
          : null
      } : null,
      oldHorse: isOldHorseStillHasStrengthRule(this.selectedRule) ? {
        rightHolderPlayerIds: Array.from(this.oldHorseRightHolderPlayerIds),
        protectedPlayerId: this.oldHorseProtectedPlayerId,
        lastAbsolutePlay: this.oldHorseLastAbsolutePlay
          ? { ...this.oldHorseLastAbsolutePlay }
          : null
      } : null,
      trumpWins: isTrumpWinsRule(this.selectedRule) ? {
        lastResult: this.trumpWinsLastResult
          ? {
              ...this.trumpWinsLastResult,
              players: (this.trumpWinsLastResult.players || []).map(player => ({ ...player }))
            }
          : null
      } : null,
      dreamKilling: ruleIncludesId(this.selectedRule, 'dream_killing') ? {
        sleepingPlayerIds: Array.from(this.dreamKillingSleepingPlayerIds)
      } : null,
      divineWeapon: ruleIncludesId(this.selectedRule, 'divine_weapon') ? {
        cards: this.divineWeaponCards.map(card => card.toJSON ? card.toJSON() : card),
        generation: this.divineWeaponGeneration,
        usedThisRound: this.divineWeaponUsedThisRound,
        usedByPlayerId: this.divineWeaponUsedByPlayerId,
        usedCardId: this.divineWeaponUsedCardId
      } : null,
      forbiddenMagic: ruleIncludesId(this.selectedRule, 'forbidden_magic') ? {
        reservations: Array.from(this.forbiddenMagicReservations.values(), reservation => ({
          ...reservation
        })),
        activePlayerIds: Array.from(this.forbiddenMagicActivePlayerIds),
        decisionPlayerId: this.forbiddenMagicCurrentDecisionPlayerId,
        decisionRound: this.forbiddenMagicDecisionRound,
        pendingPlayerIds: [
          this.forbiddenMagicCurrentDecisionPlayerId,
          ...this.forbiddenMagicDecisionQueue
        ].filter(Boolean)
      } : null,
      lureTiger: isLureTigerFromMountainRule(this.selectedRule) ? {
        reservations: Array.from(this.lureTigerReservations.values(), reservation => ({
          ...reservation
        })),
        usedTeamIndexes: Array.from(this.lureTigerUsedTeamIndexes),
        currentDecision: this.lureTigerCurrentDecision ? {
          ...this.lureTigerCurrentDecision,
          eligibleTargetIds: [...(this.lureTigerCurrentDecision.eligibleTargetIds || [])]
        } : null,
        pendingPlayerIds: [
          this.lureTigerCurrentDecision?.playerId,
          ...this.lureTigerDecisionQueue
        ].filter(Boolean),
        silencedPlayerIds: this.lureTigerSilencedRound === this.currentRound
          ? Array.from(this.lureTigerSilencedPlayerIds)
          : [],
        silencedRound: this.lureTigerSilencedRound,
        roundActivations: this.lureTigerRoundActivations.map(activation => ({ ...activation }))
      } : null,
      cardCooldown: this.cardCooldownType ? {
        type: this.cardCooldownType,
        valuesByPlayerId: Object.fromEntries(
          Array.from(this.cardCooldownValuesByPlayerId.entries()).map(([playerId, values]) => (
            [playerId, [...values]]
          ))
        )
      } : null,
      birdsGoneBowHidden: ruleIncludesId(this.selectedRule, 'birds_gone_bow_hidden') ? {
        exhaustedSuits: Array.from(this.birdExhaustedSuits)
      } : null,
      secondBattlefield: isSecondBattlefieldRule(this.selectedRule) ? {
        communityCards: this.secondBattlefieldCommunityCards.map(
          card => card.toJSON ? card.toJSON() : card
        ),
        generation: this.secondBattlefieldGeneration,
        showdownCount: this.secondBattlefieldShowdownCount,
        accumulatedCardsByPlayerId: Object.fromEntries(
          Array.from(this.secondBattlefieldAccumulatedCardsByPlayerId.entries()).map(
            ([playerId, cards]) => [
              playerId,
              cards.map(card => card.toJSON ? card.toJSON() : card)
            ]
          )
        ),
        accumulatedCountsByPlayerId: Object.fromEntries(
          Array.from(this.secondBattlefieldAccumulatedCardsByPlayerId.entries()).map(
            ([playerId, cards]) => [playerId, cards.length]
          )
        ),
        isFinalStage: this.secondBattlefieldFinalStage,
        lastResult: this.secondBattlefieldLastResult
      } : null,
      strawBoatBorrowingArrows: isStrawBoatBorrowingArrowsRule(this.selectedRule) ? {
        pending: this.strawBoatBorrowingArrowsDecision ? {
          id: this.strawBoatBorrowingArrowsDecision.id,
          round: this.strawBoatBorrowingArrowsDecision.round,
          playerId: this.strawBoatBorrowingArrowsDecision.playerId,
          playerName: this.strawBoatBorrowingArrowsDecision.playerName,
          leadingPoints: this.strawBoatBorrowingArrowsDecision.leadingPoints,
          borrowedCard: this.strawBoatBorrowingArrowsDecision.borrowedCard?.toJSON
            ? this.strawBoatBorrowingArrowsDecision.borrowedCard.toJSON()
            : this.strawBoatBorrowingArrowsDecision.borrowedCard
        } : null,
        lastResult: this.strawBoatBorrowingArrowsLastResult
      } : null,
      bushGate: isBushGateRule(this.selectedRule) ? {
        restriction: this.bushGateRestriction ? {
          ...this.bushGateRestriction,
          forbiddenCardIds: [...(this.bushGateRestriction.forbiddenCardIds || [])],
          returnedCards: (this.bushGateRestriction.returnedCards || []).map(card => ({ ...card }))
        } : null,
        lastResult: this.bushGateLastResult ? {
          ...this.bushGateLastResult,
          returnedCards: (this.bushGateLastResult.returnedCards || []).map(card => ({ ...card }))
        } : null
      } : null,
      teammateCheer: isTeammateCheerRule(this.selectedRule) ? {
        pending: this.teammateCheerPending ? { ...this.teammateCheerPending } : null,
        usedPlayerIds: Array.from(this.teammateCheerUsedPlayerIds),
        buffedPlayerIds: Array.from(this.teammateCheerBuffedPlayerIds),
        lastResult: this.teammateCheerLastResult
          ? { ...this.teammateCheerLastResult }
          : null
      } : null,
      afterglow: isAfterglowRule(this.selectedRule) ? {
        pending: this.afterglowPending ? { ...this.afterglowPending } : null,
        usedPlayerIds: Array.from(this.afterglowUsedPlayerIds),
        activePlayerIds: Array.from(this.afterglowActivePlayerIds),
        lastResult: this.afterglowLastResult ? { ...this.afterglowLastResult } : null
      } : null,
      ambiguous: isAmbiguousRule(this.selectedRule) ? {
        activePlayerIds: this.currentRoundPlays
          .filter(play => play.activeSkillId === 'ambiguous')
          .map(play => play.playerId),
        pending: this.ambiguousRoundDecision ? {
          round: this.ambiguousRoundDecision.round,
          currentPlayerId: this.ambiguousRoundDecision.currentPlayerId,
          queuePlayerIds: [...this.ambiguousRoundDecision.queuePlayerIds],
          selections: this.ambiguousRoundDecision.selections.map(selection => ({
            playerId: selection.playerId,
            playerName: selection.playerName,
            position: selection.position,
            usageConsumed: selection.usageConsumed,
            selectedOptionIndex: selection.selectedOptionIndex,
            options: selection.options.map(option => ({
              index: option.index,
              cards: option.cards.map(card => card.toJSON ? card.toJSON() : card)
            }))
          }))
        } : null
      } : null,
      currentRoundPlays: this.currentRoundPlays.length,
      currentRoundTable,
      leadingPattern: this.leadingPattern,
      // 暗置牌揭牌前，连当前赢牌座位也属于秘密信息。
      // 否则即使客户端只画牌背，仍可从房间快照反推出暗牌大小。
      currentWinnerIndex: this.currentRoundPlays.some(play => play.concealed)
        ? null
        : this.currentWinnerIndex,
      // 得分相关
      collectedPointCards: isLostInFogScoringHidden
        ? null
        : this.collectedPointCards.map(c => c.toJSON ? c.toJSON() : c),
      attackerScore: isLostInFogScoringHidden || (
        ruleIncludesId(this.selectedRule, 'focus_figure') && !this.isFocusFigureRevealed
      )
        ? null
        : this.attackerScore,
      lastRoundWinnerIndex: this.lastRoundWinnerIndex,
      // 升级相关
      team1Level: this.team1Level,
      team2Level: this.team2Level,
      dealerPlayerIndex: this.dealerPlayerIndex
    };
  }
}
