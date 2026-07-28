import { GameEngine } from '../../services/GameEngine.js';
import { GamePhases } from '../../utils/constants.js';
import {
  isAdministrativeReviewRule,
  isOpenlyRevealedRule,
  isPeopleCommuneRule,
  isReformAndOpeningUpRule
} from '../../rules/ruleRegistry.js';
import BotService from '../../services/BotService.js';
import logger from '../../utils/logger.js';

// 存储每个房间的游戏引擎
const gameEngines = new Map();

// 存储每个房间的bot服务
const botServices = new Map();

// 导出gameEngines供其他模块使用（如roomHandlers中清理资源）
export function getGameEngines() {
  return gameEngines;
}

// 导出botServices供其他模块使用
export function getBotServices() {
  return botServices;
}

function emitWholeHandExchange(io, room, exchange) {
  if (!exchange) return;
  io.to(room.id).emit('whole_hand_exchange_resolved', exchange);
  room.players.forEach(player => {
    if (!player.socketId) return;
    const incoming = exchange.transfers.find(transfer => transfer.toPlayerId === player.id);
    io.to(player.socketId).emit('whole_hand_exchange_hand_updated', {
      ...exchange,
      fromPlayerId: incoming?.fromPlayerId || null,
      fromPlayerName: incoming?.fromPlayerName || null,
      cards: player.cards.map(card => card.toJSON())
    });
  });
}

function emitPlannedEconomyDraw(io, room, draw) {
  if (!draw?.draws?.length) return;
  io.to(room.id).emit('planned_economy_cards_drawn', {
    round: draw.round,
    draws: draw.draws.map(({ playerId, playerName, cardsCount }) => ({
      playerId,
      playerName,
      cardsCount
    })),
    remainingCards: draw.remainingCards,
    animationDuration: draw.animationDuration
  });
  draw.draws.forEach(({ playerId, card, cardsCount }) => {
    const player = room.findPlayerById(playerId);
    if (!player?.socketId) return;
    io.to(player.socketId).emit('card_dealt', {
      card,
      totalCards: cardsCount,
      source: 'planned_economy',
      round: draw.round
    });
  });
}

function emitEquivalentReciprocityResolution(io, room, result) {
  if (!result?.resolved) return;
  const { hands = [], ...publicResult } = result;
  io.to(room.id).emit('equivalent_reciprocity_resolved', publicResult);
  hands.forEach(hand => {
    const player = room.findPlayerById(hand.playerId);
    if (!player?.socketId) return;
    io.to(player.socketId).emit('equivalent_reciprocity_hand_updated', {
      challengeId: result.challengeId,
      cards: hand.cards,
      animationDuration: result.animationDuration
    });
  });
}

function getPublicMutualSupportAction(room, action) {
  if (!action) return null;
  return {
    actionId: action.id,
    stage: action.stage,
    round: action.round,
    chooserPlayerId: action.chooserPlayerId,
    chooserPlayerName: room.findPlayerById(action.chooserPlayerId)?.name || '未知玩家',
    otherPlayerId: action.otherPlayerId,
    otherPlayerName: room.findPlayerById(action.otherPlayerId)?.name || '未知玩家',
    fromPlayerId: action.fromPlayerId,
    toPlayerId: action.toPlayerId,
    minCards: action.minCards,
    maxCards: action.maxCards,
    requiredCards: action.requiredCards ?? null
  };
}

function emitMutualSupportActionRequired(io, room, action) {
  if (!action) return;
  const chooser = room.findPlayerById(action.chooserPlayerId);
  if (!chooser?.socketId || chooser.isBot) return;
  io.to(chooser.socketId).emit(
    'mutual_support_cards_required',
    getPublicMutualSupportAction(room, action)
  );
}

function emitMutualSupportResolution(io, room, result) {
  if (!result?.resolved || !result.transfer) return;
  const { hands = [], ...publicTransfer } = result.transfer;
  io.to(room.id).emit('mutual_support_transfer_resolved', {
    actionId: result.actionId,
    stage: result.stage || result.transfer.stage,
    ...publicTransfer
  });
  hands.forEach(hand => {
    const player = room.findPlayerById(hand.playerId);
    if (!player?.socketId) return;
    io.to(player.socketId).emit('mutual_support_hand_updated', {
      actionId: result.actionId,
      stage: result.stage || result.transfer.stage,
      cards: hand.cards,
      animationDuration: result.transfer.animationDuration
    });
  });
}

function emitCulturalRevolutionExpiry(io, room, transition) {
  if (!transition) return;
  io.to(room.id).emit('cultural_revolution_expired', transition);
  io.to(room.id).emit('trump_updated', {
    trumpSuit: transition.restoredTrumpSuit,
    trumpRank: transition.restoredTrumpRank,
    culturalRevolutionExpired: transition
  });
}

function emitCulturalRevolutionActivation(io, room, result) {
  if (!result) return;
  io.to(room.id).emit('active_skill_activated', {
    id: result.activeSkillId,
    name: result.activeSkillName,
    playerId: result.playerId,
    playerName: result.playerName
  });
  io.to(room.id).emit('cultural_revolution_activated', result);
  io.to(room.id).emit('trump_updated', {
    trumpSuit: result.effectiveTrumpSuit,
    trumpRank: result.effectiveTrumpRank,
    culturalRevolution: result
  });
}

function emitThreeTigersTransformation(io, room, transformation) {
  if (!transformation) return;
  io.to(room.id).emit('three_tigers_transformed', transformation);
}

function emitConcealedCardsToPlayer(io, room, result) {
  if (!result?.concealed) return;
  const concealedPlayer = room.findPlayerById(result.playerId);
  if (!concealedPlayer?.socketId) return;
  // 必须先于公共 cards_played 发送。出牌者客户端会先缓存真实牌面，
  // 从而第一帧就画正面；其他玩家仍只能从公共事件看到牌背与张数。
  io.to(concealedPlayer.socketId).emit('concealed_cards_played_private', {
    playerId: result.playerId,
    cards: result.playedCards
  });
}

export function emitCardsPlayed(io, room, result) {
  // 私有牌面先到达出牌者，随后才广播只含张数的公共事件。
  emitConcealedCardsToPlayer(io, room, result);
  io.to(room.id).emit('cards_played', {
    playerId: result.playerId,
    playerName: result.playerName,
    controllerPlayerId: result.controllerPlayerId,
    controllerPlayerName: result.controllerPlayerName,
    isProxy: result.isProxy,
    cards: result.concealed ? [] : result.playedCards,
    removedCardIds: result.waitingRabbitPlayedCardIds || result.playedCards.map(card => card.id),
    cardsCount: result.playedCards.length,
    concealed: result.concealed,
    treatedAsSmall: result.treatedAsSmall,
    activeSkillId: result.activeSkillActivation?.id || null,
    activeSkillName: result.activeSkillActivation?.name || null,
    jokerSubstitutions: result.jokerSubstitutions || [],
    clusterAnalysisSubstitutions: result.clusterAnalysisSubstitutions || [],
    forbiddenMagicSubstitutions: result.forbiddenMagicSubstitutions || [],
    enduringInheritance: result.enduringInheritance || null,
    dreamKilling: result.dreamKilling || null,
    oldHorseAbsolute: Boolean(result.oldHorseAbsolute),
    lureTigerSilenced: Boolean(result.lureTigerSilenced),
    ironEvidenceMode: result.ironEvidenceMode || null,
    waitingRabbitExchange: result.waitingRabbitExchange || null,
    ambiguousOptions: result.ambiguousOptions || null,
    remainingCount: result.remainingCount,
    currentWinningPlayerId: result.currentWinningPlayerId
  });
}

function submitAutomaticMutualSupportActions(io, room, gameEngine) {
  let lastResult = null;
  while (room.gameState.mutualSupportPendingAction) {
    const action = room.gameState.mutualSupportPendingAction;
    const chooser = room.findPlayerById(action.chooserPlayerId);
    if (!chooser?.isBot) {
      emitMutualSupportActionRequired(io, room, action);
      break;
    }
    const cardIds = gameEngine.selectMutualSupportCardsForBot(chooser.id);
    lastResult = gameEngine.submitMutualSupportCards(chooser.id, action.id, cardIds);
    emitMutualSupportResolution(io, room, lastResult);
    if (lastResult.gameFinished) {
      emitFinishedGame(io, room);
      break;
    }
  }
  return lastResult;
}

function submitAutomaticEquivalentReciprocityCards(io, room, gameEngine, participantPlayerIds) {
  let lastResult = null;
  for (const playerId of participantPlayerIds) {
    const challenge = room.gameState.equivalentReciprocityChallenge;
    if (!challenge) break;
    const player = room.findPlayerById(playerId);
    if (!player?.isBot || challenge.selectedCardsByPlayerId.has(player.id)) continue;
    const card = gameEngine.selectEquivalentReciprocityCardForBot(player.id);
    if (!card) continue;
    lastResult = gameEngine.submitEquivalentReciprocityCard(player.id, challenge.id, card.id);
    io.to(room.id).emit('equivalent_reciprocity_selection_recorded', {
      challengeId: challenge.id,
      playerId: player.id,
      playerName: player.name,
      selectedPlayerIds: lastResult.selectedPlayerIds
    });
    if (lastResult.resolved) {
      emitEquivalentReciprocityResolution(io, room, lastResult);
      break;
    }
  }
  return lastResult;
}

function beginRoundCardExchange(io, room, gameEngine, exchange) {
  if (!exchange) return null;
  io.to(room.id).emit('card_exchange_started', exchange);
  io.to(room.id).emit('room_updated', { room: room.toJSON() });
  return gameEngine.submitAutomaticRoundCardExchanges();
}

function emitStrawBoatBorrowingArrowsResolution(io, room, result) {
  if (!result) return;
  const { handCards = [], ...publicResult } = result;
  io.to(room.id).emit('straw_boat_borrowing_arrows_resolved', publicResult);
  const player = room.findPlayerById(result.playerId);
  if (result.accepted && player?.socketId) {
    io.to(player.socketId).emit('straw_boat_borrowing_arrows_hand_updated', {
      decisionId: result.decisionId,
      cards: handCards
    });
  }
}

function beginWaitingRabbitDecision(io, room, gameEngine, decision) {
  if (!decision) return null;
  io.to(room.id).emit('waiting_rabbit_triggered', decision);
  const chooser = room.findPlayerById(decision.chooserPlayerId);
  if (chooser?.isBot) {
    const discardCard = chooser.cards.find(card => gameEngine.getRuleCardPoints(card) === 0);
    const { roundResult } = gameEngine.resolveWaitingRabbitDecision(chooser.id, {
      accept: Boolean(discardCard),
      discardCardId: discardCard?.id || null
    });
    emitWaitingRabbitResolution(io, room, roundResult);
    return roundResult;
  }
  if (chooser?.socketId && !chooser.isBot) {
    io.to(chooser.socketId).emit('waiting_rabbit_exchange_required', {
      ...decision,
      eligibleDiscardCardIds: chooser.cards
        .filter(card => gameEngine.getRuleCardPoints(card) === 0)
        .map(card => card.id)
    });
  }
  return null;
}

function emitWaitingRabbitResolution(io, room, result) {
  if (!result?.waitingRabbitResolution) return;
  io.to(room.id).emit('waiting_rabbit_resolved', result.waitingRabbitResolution);
  const chooser = room.findPlayerById(result.waitingRabbitResolution.chooserPlayerId);
  if (result.waitingRabbitChooserHand && chooser?.socketId) {
    io.to(chooser.socketId).emit('waiting_rabbit_hand_updated', {
      decisionId: result.waitingRabbitResolution.id,
      cards: result.waitingRabbitChooserHand
    });
  }
}

function beginStrawBoatBorrowingArrowsDecision(io, room, gameEngine, decision) {
  if (!decision) return null;
  io.to(room.id).emit('straw_boat_borrowing_arrows_required', decision);
  const player = room.findPlayerById(decision.playerId);
  if (!player?.isBot) return null;

  const choice = gameEngine.selectStrawBoatBorrowingArrowsForBot(player.id)
    || { accept: false, cardId: null };
  const result = gameEngine.resolveStrawBoatBorrowingArrows(player.id, choice);
  emitStrawBoatBorrowingArrowsResolution(io, room, result);
  return result;
}

function emitTeammateCheerResolution(io, room, result) {
  if (!result) return;
  const { transformedCards = [], ...publicResult } = result;
  io.to(room.id).emit(
    result.accepted ? 'teammate_cheer_activated' : 'teammate_cheer_declined',
    publicResult
  );
  if (result.accepted) {
    const buffedPlayer = room.findPlayerById(result.buffedPlayerId);
    if (buffedPlayer?.socketId && !buffedPlayer.isBot) {
      io.to(buffedPlayer.socketId).emit('teammate_cheer_hand_updated', {
        sourcePlayerId: result.playerId,
        sourcePlayerName: result.playerName,
        cards: transformedCards
      });
    }
  }
}

function beginTeammateCheerDecision(io, room, gameEngine, decision) {
  if (!decision) return null;
  io.to(room.id).emit('teammate_cheer_decision_pending', decision);
  const player = room.findPlayerById(decision.playerId);
  if (!player?.isBot) {
    if (player?.socketId) {
      io.to(player.socketId).emit('teammate_cheer_decision_required', decision);
    }
    return null;
  }

  const result = gameEngine.respondTeammateCheer(player.id, true);
  emitTeammateCheerResolution(io, room, result);
  if (result.gameFinished) emitFinishedGame(io, room);
  return result;
}

function broadcastAfterglowResolution(io, room, result) {
  if (!result) return;
  const { transformedCards = [], ...publicResult } = result;
  io.to(room.id).emit(
    result.accepted ? 'afterglow_activated' : 'afterglow_declined',
    publicResult
  );
  if (!result.accepted) return;
  const player = room.findPlayerById(result.playerId);
  if (player?.socketId && !player.isBot) {
    io.to(player.socketId).emit('afterglow_hand_updated', {
      cards: transformedCards
    });
  }
}

function beginAfterglowDecision(io, room, gameEngine, decision) {
  if (!decision) return null;
  io.to(room.id).emit('afterglow_decision_pending', decision);
  const player = room.findPlayerById(decision.playerId);
  if (!player?.isBot) {
    if (player?.socketId) {
      io.to(player.socketId).emit('afterglow_decision_required', decision);
    }
    return null;
  }

  const result = gameEngine.respondAfterglow(player.id, true);
  broadcastAfterglowResolution(io, room, result);
  return result;
}

function emitAmbiguousFinalRound(io, room, gameEngine, result) {
  const roundResult = result?.roundResult;
  if (!roundResult) return;
  io.to(room.id).emit('ambiguous_round_resolved', result.resolution);
  if (roundResult.roundUpdate) {
    io.to(room.id).emit('round_updated', roundResult.roundUpdate);
  }
  if (roundResult.remainingCount === 0) {
    io.to(room.id).emit('player_finished', {
      playerId: roundResult.playerId,
      playerName: roundResult.playerName
    });
  }
  if (roundResult.gameFinished) emitFinishedGame(io, room);
  io.to(room.id).emit('room_updated', { room: room.toJSON() });
  if (!roundResult.gameFinished) {
    triggerBotPlay(io, room, gameEngine).catch(error => {
      logger.error('模棱两可选择完成后触发Bot出牌失败:', error);
    });
  }
}

function emitAmbiguousChoiceResult(io, room, result) {
  io.to(room.id).emit('ambiguous_choice_resolved', result.choice);
  const player = room.findPlayerById(result.choice.playerId);
  if (player?.socketId && !player.isBot) {
    io.to(player.socketId).emit('ambiguous_hand_updated', {
      cards: result.handCards
    });
  }
}

function beginAmbiguousChoiceDecision(io, room, gameEngine, decision) {
  let request = decision?.currentRequest || decision;
  if (!request?.playerId) return null;
  io.to(room.id).emit('ambiguous_choice_pending', {
    round: request.round,
    playerId: request.playerId,
    playerName: request.playerName,
    position: request.position
  });

  while (request?.playerId) {
    const player = room.findPlayerById(request.playerId);
    if (!player?.isBot) {
      if (player?.socketId) {
        io.to(player.socketId).emit('ambiguous_choice_required', request);
      }
      return null;
    }
    const result = gameEngine.resolveAmbiguousChoice(player.id, 0);
    emitAmbiguousChoiceResult(io, room, result);
    if (result.completed) {
      emitAmbiguousFinalRound(io, room, gameEngine, result);
      return result;
    }
    request = result.nextDecision;
    io.to(room.id).emit('ambiguous_choice_pending', {
      round: request.round,
      playerId: request.playerId,
      playerName: request.playerName,
      position: request.position
    });
  }
  return null;
}

function emitDestroyDykeFinalRound(io, room, gameEngine, response) {
  const roundResult = response?.roundResult;
  if (!roundResult) return null;
  if (roundResult.roundUpdate) {
    io.to(room.id).emit('round_updated', roundResult.roundUpdate);
  }
  if (roundResult.remainingCount === 0) {
    io.to(room.id).emit('player_finished', {
      playerId: roundResult.playerId,
      playerName: roundResult.playerName
    });
  }
  if (roundResult.gameFinished) emitFinishedGame(io, room);
  io.to(room.id).emit('room_updated', { room: room.toJSON() });
  if (!roundResult.gameFinished) {
    triggerBotPlay(io, room, gameEngine).catch(error => {
      logger.error('毁堤淹田决定完成后触发Bot出牌失败:', error);
    });
  }
  return response;
}

function beginDestroyDykeDecision(io, room, gameEngine, decision) {
  if (!decision?.dealerPlayerId) return null;
  io.to(room.id).emit('destroy_dyke_decision_pending', decision);
  const dealer = room.findPlayerById(decision.dealerPlayerId);
  if (!dealer?.isBot) {
    if (dealer?.socketId) {
      io.to(dealer.socketId).emit('destroy_dyke_decision_required', decision);
    }
    return null;
  }
  const response = gameEngine.respondDestroyDyke(
    dealer.id,
    gameEngine.selectDestroyDykeForBot()
  );
  return emitDestroyDykeFinalRound(io, room, gameEngine, response);
}

function emitFinishedGame(io, room) {
  io.to(room.id).emit('bottom_revealed', {
    bottomCards: room.gameState.bottomCards.map(card => card.toJSON()),
    bottomScoreResult: room.gameState.bottomScoreResult,
    upgradeResult: room.gameState.upgradeResult
  });
  const result = room.gameState.bottomScoreResult;
  const hasExtraReveal = result?.mistyFogCards?.length || result?.lingeringDiscardCards?.length;
  io.to(room.id).emit('phase_changed', {
    phase: 'revealing',
    message: result?.surrender
      ? `${result.surrender.initiatorPlayerName}一方投降，牌局结束`
      : hasExtraReveal
      ? '所有玩家已出完牌，查看底牌与终局公开牌'
      : '所有玩家已出完牌，查看底牌'
  });
}

function emitSurrenderDecision(io, room, decision) {
  if (!decision) return;
  io.to(room.id).emit('surrender_decision_pending', decision);
  const teammate = room.findPlayerById(decision.teammatePlayerId);
  if (teammate?.socketId && !teammate.isBot) {
    io.to(teammate.socketId).emit('surrender_decision_required', decision);
  }
}

function beginSurrenderDecision(io, room, gameEngine, initialDecision = null) {
  let decision = initialDecision || gameEngine.prepareSurrenderReview();
  let lastResult = null;
  while (decision) {
    emitSurrenderDecision(io, room, decision);
    const teammate = room.findPlayerById(decision.teammatePlayerId);
    if (!teammate?.isBot) {
      io.to(room.id).emit('room_updated', { room: room.toJSON() });
      return { pending: true, decision, gameFinished: false };
    }

    lastResult = gameEngine.respondSurrender(teammate.id, true);
    io.to(room.id).emit('game_surrendered', lastResult.surrender);
    if (lastResult.gameFinished) {
      emitFinishedGame(io, room);
      io.to(room.id).emit('room_updated', { room: room.toJSON() });
      return lastResult;
    }
    decision = lastResult.nextDecision;
  }
  return lastResult;
}

function continueAfterTimeReversalWindow(io, room, gameEngine, result) {
  io.to(room.id).emit('time_reversal_resolved', result);
  if (result.gameFinished) emitFinishedGame(io, room);
  const surrenderResult = !result.gameFinished
    ? beginSurrenderDecision(io, room, gameEngine, result.surrenderDecision)
    : null;
  io.to(room.id).emit('room_updated', { room: room.toJSON() });
  if (!result.gameFinished && !surrenderResult?.pending && !surrenderResult?.gameFinished) {
    triggerBotPlay(io, room, gameEngine).catch(error => {
      logger.error('时间倒流窗口结束后触发Bot出牌失败:', error);
    });
  }
}

/**
 * 触发当前轮到的Bot自动出牌
 */
async function triggerBotPlay(io, room, gameEngine) {
  logger.info(`=== 检查是否需要触发Bot出牌 ===`);
  logger.info(`房间ID: ${room.id}, 游戏阶段: ${room.gameState.phase}`);

  // 检查游戏状态
  if (room.gameState.phase !== GamePhases.PLAYING) {
    logger.warn(`游戏阶段不是PLAYING，当前阶段: ${room.gameState.phase}，跳过bot出牌`);
    return;
  }
  const surrenderResult = beginSurrenderDecision(io, room, gameEngine);
  if (surrenderResult?.pending || surrenderResult?.gameFinished) {
    logger.info('投降申请正在等待队友决定，暂不触发Bot出牌');
    return;
  }
  if (gameEngine.hasPendingSurrenderDecision()) {
    logger.info('投降申请正在按庄家起顺序处理，暂不触发Bot出牌');
    return;
  }
  if (gameEngine.hasPendingIcebergSelection()) {
    logger.info('仍有玩家需要选择冰山明牌，暂不触发Bot出牌');
    return;
  }
  if (gameEngine.hasPendingTenSidedAmbushSelection()) {
    logger.info('庄家队友尚未指定十面埋伏点数，暂不触发Bot出牌');
    return;
  }
  if (
    gameEngine.hasPendingWaitingRabbitSelection()
    || gameEngine.hasPendingWaitingRabbitDecision()
  ) {
    logger.info('守株待兔仍在暗选或等待换牌决定，暂不触发Bot出牌');
    return;
  }
  if (gameEngine.hasPendingThreePowersSelection()) {
    logger.info('2、3、4号位尚未完成三权分立暗选，暂不触发Bot出牌');
    return;
  }
  if (gameEngine.hasPendingGentlemanPromiseSelection()) {
    logger.info('仍有玩家需要完成君子一言最短花色声明，暂不触发Bot出牌');
    return;
  }
  if (gameEngine.hasPendingHiddenDragonSelection()) {
    logger.info('仍有玩家需要完成潜龙在渊最多点数声明，暂不触发Bot出牌');
    return;
  }
  if (gameEngine.hasPendingAntinomySelection()) {
    logger.info('二律背反仍在等待选择牌面，暂不触发Bot出牌');
    return;
  }
  if (gameEngine.hasPendingRiceToMulberrySelection()) {
    logger.info('闲家尚未完成改稻为桑分牌选择，暂不触发Bot出牌');
    return;
  }
  if (gameEngine.hasPendingDestroyDykeDecision()) {
    logger.info('毁堤淹田正在等待庄家决定，暂不触发Bot出牌');
    return;
  }
  if (gameEngine.hasPendingAdministrativeReviewSelection()) {
    logger.info('闲家尚未完成行政审查公开声明，暂不触发Bot出牌');
    return;
  }
  if (gameEngine.hasPendingPoliticalReviewDecision()) {
    logger.info('政治审查正在等待队友决定，暂不触发Bot出牌');
    return;
  }
  if (gameEngine.hasPendingCandleSelection()) {
    logger.info('庄家队友尚未选择烛的初始状态，暂不触发Bot出牌');
    return;
  }
  if (gameEngine.hasPendingFocusFigureVote()) {
    logger.info('两队尚未完成焦点人物表决，暂不触发Bot出牌');
    return;
  }
  if (gameEngine.hasPendingMainstayAction()) {
    logger.info('中流砥柱尚未完成，暂不触发Bot出牌');
    return;
  }
  if (gameEngine.hasPendingLastStandDecision()) {
    logger.info('仍有玩家需要决定是否发动绝处逢生，暂不触发Bot出牌');
    return;
  }
  if (gameEngine.hasPendingTeammateCheerDecision()) {
    logger.info('仍有玩家需要决定是否发动队友加油，暂不触发Bot出牌');
    return;
  }
  if (gameEngine.hasPendingAfterglowDecision()) {
    logger.info('仍有玩家需要决定是否发动回光返照，暂不触发Bot出牌');
    return;
  }
  if (gameEngine.hasPendingAmbiguousChoice()) {
    logger.info('模棱两可正在等待轮末方案选择，暂不触发Bot出牌');
    return;
  }
  if (gameEngine.hasPendingTimeReversalDecision()) {
    logger.info('本轮正在等待时间倒流确认，暂不触发Bot出牌');
    return;
  }
  if (gameEngine.hasPendingForbiddenMagicDecision()) {
    logger.info('轮首正在逐个确认禁术秘法，暂不触发Bot出牌');
    return;
  }
  if (gameEngine.hasPendingLureTigerDecision()) {
    logger.info('轮首正在逐个处理调虎离山，暂不触发Bot出牌');
    return;
  }
  if (gameEngine.hasPendingEquivalentReciprocityChallenge()) {
    logger.info('等价互惠正在等待双方选择拼点牌，暂不触发Bot出牌');
    return;
  }
  if (gameEngine.hasPendingMutualSupportAction()) {
    logger.info('同舟共济正在等待交牌或轮末返还，暂不触发Bot出牌');
    return;
  }
  if (gameEngine.hasPendingStrawBoatBorrowingArrowsDecision()) {
    logger.info('草船借箭正在等待首置位玩家决定，暂不触发Bot出牌');
    return;
  }
  if (gameEngine.hasPendingWoodenOxDecision()) {
    logger.info('木牛流马轮首操作尚未完成，暂不触发Bot出牌');
    return;
  }
  if (room.gameState.cardExchange?.stage === 'round') {
    logger.info('仍有玩家需要完成轮末换牌，暂不触发Bot出牌');
    return;
  }

  // 获取当前应该出牌的玩家
  const currentPlayerIndex = room.gameState.currentPlayerIndex;
  if (currentPlayerIndex === null || currentPlayerIndex === undefined) {
    logger.info('当前没有指定出牌玩家（自由模式），跳过bot出牌');
    return;
  }

  const currentPlayer = room.players[currentPlayerIndex];
  if (!currentPlayer) {
    logger.warn(`找不到索引为 ${currentPlayerIndex} 的玩家`);
    return;
  }

  // 明手座位由庄家接管；是否自动操作取决于实际操作者，而不是牌的所有者。
  const controller = gameEngine.getTurnControllerPlayer(currentPlayer.id);
  if (controller?.isBot && gameEngine.canActivateDreamKilling(currentPlayer.id)) {
    const activation = gameEngine.activateDreamKilling(currentPlayer.id);
    io.to(room.id).emit('active_skill_activated', activation);
    io.to(room.id).emit('dream_killing_started', activation);
    io.to(room.id).emit('room_updated', { room: room.toJSON() });
  }
  const isDreaming = gameEngine.isDreamKillingSleeping(currentPlayer.id);
  if (!controller?.isBot && !isDreaming) {
    logger.info(`当前座位 ${currentPlayer.name} 由 ${controller?.name || currentPlayer.name} 操作，等待真人玩家出牌`);
    return;
  }

  // 检查Bot是否还有手牌
  if (gameEngine.getPlayableCardCount(currentPlayer) === 0) {
    logger.info(`Bot ${currentPlayer.name} 已经没有手牌了`);
    return;
  }

  if (controller?.isBot && !isDreaming) {
    const declaration = gameEngine.selectCulturalRevolutionForBot(currentPlayer.id);
    if (declaration) {
      const activation = gameEngine.activateCulturalRevolution(
        currentPlayer.id,
        declaration.declarationType,
        declaration.value
      );
      emitCulturalRevolutionActivation(io, room, activation);
      io.to(room.id).emit('room_updated', { room: room.toJSON() });
    }
  }

  logger.info(`\n--- 轮到Bot ${currentPlayer.name} 出牌 ---`);

  // 获取或创建bot服务
  let botService = botServices.get(room.id);
  if (!botService) {
    logger.info(`创建新的BotService实例，Bot类型: ${room.config.botType}`);
    botService = new BotService(room.config.botType);
    botServices.set(room.id, botService);
  }

  try {
    logger.info(`触发Bot ${currentPlayer.name} 自动出牌`);
    logger.info(`Bot ${currentPlayer.name} 当前手牌数: ${currentPlayer.cards.length}`);

    // 延迟一小段时间，模拟思考过程
    await new Promise(resolve => setTimeout(resolve, isDreaming ? 700 : 1500));

    // 调用bot获取决策
    logger.info(`开始调用BotService.getBotAction...`);
    const woodenOxCard = gameEngine.getWoodenOxStoredCardForPlayer(currentPlayer.id);
    const woodenOxCards = woodenOxCard ? [woodenOxCard] : [];
    let cardIds = isDreaming
      ? botService.getRandomAction(room.gameState, gameEngine.getPlayableCardsForPlayer(currentPlayer))
      : await botService.getBotAction(
          room.gameState,
          currentPlayer.cards,
          currentPlayerIndex,
          room,
          woodenOxCards
        );

    logger.info(`Bot ${currentPlayer.name} 决策完成，选择出牌: ${cardIds.length} 张，卡牌IDs: ${JSON.stringify(cardIds)}`);

    // 执行出牌
    logger.info(`执行Bot ${currentPlayer.name} 出牌操作...`);
    let result;
    try {
      result = gameEngine.playCards(
        controller.id,
        cardIds,
        controller.id === currentPlayer.id ? null : currentPlayer.id,
        null,
        isDreaming ? { dreamKillingRandom: true } : {}
      );
    } catch (botPlayError) {
      if (isDreaming) {
        throw botPlayError;
      }
      cardIds = botService.getFallbackAction(
        room.gameState,
        currentPlayer.cards,
        currentPlayer.id,
        currentPlayerIndex,
        woodenOxCards
      );
      logger.warn(
        `Bot ${currentPlayer.name} 的策略出牌不合法（${botPlayError.message}），改用合法保底牌: ${JSON.stringify(cardIds)}`
      );
      result = gameEngine.playCards(
        controller.id,
        cardIds,
        controller.id === currentPlayer.id ? null : currentPlayer.id,
        null,
        isDreaming ? { dreamKillingRandom: true } : {}
      );
    }
    if (result.politicalReviewDeferred) {
      logger.info(`Bot ${currentPlayer.name} 的出牌正在等待政治审查`);
      return;
    }
    logger.info(`Bot ${currentPlayer.name} 出牌成功，剩余 ${result.remainingCount} 张牌`);

    if (result.throwFailed) {
      io.to(room.id).emit('throw_failed', {
        playerId: result.playerId,
        playerName: result.playerName,
        isProxy: result.isProxy,
        message: result.throwFailed.message,
        attemptedCards: result.throwFailed.attemptedCards,
        attemptedCardObjects: result.throwFailed.attemptedCardObjects,
        forcedCards: result.throwFailed.forcedCards
      });
    }

    // 广播bot出牌
    if (result.activeSkillActivation) {
      io.to(room.id).emit('active_skill_activated', result.activeSkillActivation);
    }
    emitCardsPlayed(io, room, result);
    emitThreeTigersTransformation(io, room, result.threeTigersTransformation);
    if (result.roundUpdate?.strengthCompensation) {
      gameEngine.emitStrengthCompensationHands(result.roundUpdate.strengthCompensation);
    }
    if (result.roundUpdate?.defenseAsOffense) {
      gameEngine.emitDefenseAsOffenseHands(result.roundUpdate.defenseAsOffense);
    }
    if (result.dreamKilling?.awakened) {
      io.to(room.id).emit('dream_killing_awakened', {
        playerId: result.playerId,
        playerName: result.playerName,
        ...result.dreamKilling
      });
    }
    if (result.roundReveal) {
      io.to(room.id).emit('concealed_plays_revealed', result.roundReveal);
    }

    if (result.tenSidedAmbushReveal) {
      io.to(room.id).emit('ten_sided_ambush_revealed', result.tenSidedAmbushReveal);
    }
    if (result.threePowersReveal) {
      io.to(room.id).emit('three_powers_revealed', result.threePowersReveal);
    }

    // 广播毙牌动作
    if (result.trumpAction) {
      io.to(room.id).emit('trump_action', {
        type: result.trumpAction.type,
        playerId: result.trumpAction.playerId,
        playerName: result.trumpAction.playerName,
        targetPlayerId: result.trumpAction.targetPlayerId,
        targetPlayerName: result.trumpAction.targetPlayerName
      });
    }

    // 广播回合状态更新
    if (result.roundUpdate) {
      io.to(room.id).emit('round_updated', result.roundUpdate);
    }
    const surrenderReviewResult = beginSurrenderDecision(
      io,
      room,
      gameEngine,
      result.surrenderDecision
    );
    if (surrenderReviewResult?.pending || surrenderReviewResult?.gameFinished) {
      io.to(room.id).emit('room_updated', { room: room.toJSON() });
      return;
    }
    const automaticDestroyDykeResult = beginDestroyDykeDecision(
      io,
      room,
      gameEngine,
      result.destroyDykeDecision
    );
    if (automaticDestroyDykeResult?.roundResult) return;
    beginWaitingRabbitDecision(io, room, gameEngine, result.waitingRabbitDecision);
    beginAmbiguousChoiceDecision(io, room, gameEngine, result.ambiguousDecision);
    const automaticTeammateCheerResult = beginTeammateCheerDecision(
      io,
      room,
      gameEngine,
      result.teammateCheerRequest
    );
    beginAfterglowDecision(io, room, gameEngine, result.afterglowRequest);
    if (result.afterglowExpired) {
      io.to(room.id).emit('afterglow_expired', result.afterglowExpired);
    }
    beginStrawBoatBorrowingArrowsDecision(
      io,
      room,
      gameEngine,
      result.strawBoatDecision
    );
    emitCulturalRevolutionExpiry(
      io,
      room,
      result.roundUpdate?.culturalRevolutionTransition
    );
    if (result.mutualSupportReturn) {
      submitAutomaticMutualSupportActions(io, room, gameEngine);
    }
    emitPlannedEconomyDraw(io, room, result.plannedEconomyDraw);
    if (result.timeReversalPending) {
      gameEngine.scheduleTimeReversalDecision();
    }
    emitWholeHandExchange(io, room, result.wholeHandExchange);
    const roundSelectionResult = beginRoundCardExchange(
      io,
      room,
      gameEngine,
      result.roundCardExchange
    );
    if (roundSelectionResult?.gameFinished) {
      emitFinishedGame(io, room);
    }

    // 检查是否有玩家打完牌
    if (
      result.remainingCount === 0
      && !result.timeReversalPending
      && !result.ambiguousDecisionPending
      && !result.destroyDykeDecisionPending
    ) {
      logger.info(`Bot ${currentPlayer.name} 已打完所有牌`);
      io.to(room.id).emit('player_finished', {
        playerId: result.playerId,
        playerName: result.playerName
      });
    }

    // 游戏结束
    if (result.gameFinished) {
      logger.info('游戏结束，揭示底牌');
      // 发送底牌和得分结果
      io.to(room.id).emit('bottom_revealed', {
        bottomCards: room.gameState.bottomCards.map(c => c.toJSON()),
        bottomScoreResult: room.gameState.bottomScoreResult,
        upgradeResult: room.gameState.upgradeResult
      });

      io.to(room.id).emit('phase_changed', {
        phase: 'revealing',
        message: room.gameState.bottomScoreResult?.abruptStop
          ? '戛然而止，查看最后一轮与底牌结算'
          : room.gameState.bottomScoreResult?.mistyFogCards?.length
          ? '所有玩家已出完牌，查看底牌与迷雾牌'
          : '所有玩家已出完牌，查看底牌'
      });
    }

    // 广播房间状态更新
    io.to(room.id).emit('room_updated', {
      room: room.toJSON()
    });

    // 如果游戏未结束且下一位也是Bot，继续触发
    if (
      !result.gameFinished
      && !automaticTeammateCheerResult?.gameFinished
      && room.gameState.phase === GamePhases.PLAYING
    ) {
      logger.info('检查下一位玩家是否是Bot...');
      // 延迟后递归调用，检查下一位玩家
      setTimeout(() => {
        triggerBotPlay(io, room, gameEngine).catch(err => {
          logger.error('触发下一位bot出牌失败:', err);
          logger.error('错误堆栈:', err.stack);
        });
      }, 1000);
    } else {
      logger.info('=== Bot出牌流程结束 ===');
    }

  } catch (error) {
    logger.error(`Bot ${currentPlayer.name} 出牌失败:`, error);
    logger.error('错误堆栈:', error.stack);
    logger.info(`Bot ${currentPlayer.name} 出牌失败，跳过这一轮`);
  }
}

export function registerGameHandlers(io, socket, roomManager) {
  socket.on('request_private_game_state_sync', ({ roomId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) {
        socket.emit('private_game_state_synced', { roomId, eventCount: 0 });
        return;
      }

      const events = gameEngine.getPrivateGameStateSyncEvents(player.id);
      events.forEach(({ event, payload }) => socket.emit(event, payload));
      socket.emit('private_game_state_synced', {
        roomId,
        eventCount: events.length
      });
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('恢复玩家私密牌局状态失败:', error);
    }
  });

  socket.on('select_initial_candle_state', ({ roomId, isLit }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      gameEngine.selectInitialCandleState(player.id, isLit);
      io.to(room.id).emit('room_updated', { room: room.toJSON() });
      triggerBotPlay(io, room, gameEngine).catch(error => {
        logger.error('烛的初始状态确定后触发Bot出牌失败:', error);
      });
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('选择烛的初始状态失败:', error);
    }
  });

  socket.on('request_wooden_ox_private_state', ({ roomId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');
      gameEngine.emitWoodenOxPrivateState(player.id);
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('manage_wooden_ox', ({ roomId, action, cardId = null }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      const result = gameEngine.manageWoodenOx(player.id, action, cardId);
      socket.emit('wooden_ox_action_recorded', result);
      if (result.completed) {
        triggerBotPlay(io, room, gameEngine).catch(error => {
          logger.error('木牛流马轮首操作完成后触发Bot出牌失败:', error);
        });
      }
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('操作木牛流马失败:', error);
    }
  });

  socket.on('activate_magic_trick', ({ roomId, targetPlayerIds }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      const result = gameEngine.prepareMagicTrick(player.id, targetPlayerIds);
      // 暗选结果只回给发动者；直到整轮结束才会随 round_updated 统一揭晓。
      socket.emit('magic_trick_prepared', result);
      io.to(room.id).emit('room_updated', { room: room.toJSON() });
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('准备魔术戏法失败:', error);
    }
  });

  socket.on('activate_equivalent_reciprocity', ({ roomId, targetPlayerId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      const result = gameEngine.startEquivalentReciprocity(player.id, targetPlayerId);
      io.to(room.id).emit('active_skill_activated', {
        id: result.activeSkillId,
        name: result.activeSkillName,
        playerId: result.initiatorPlayerId,
        playerName: result.initiatorPlayerName
      });
      io.to(room.id).emit('equivalent_reciprocity_started', result);
      result.participantPlayerIds.forEach(participantPlayerId => {
        const participant = room.findPlayerById(participantPlayerId);
        if (!participant?.socketId || participant.isBot) return;
        const opponent = room.findPlayerById(
          participantPlayerId === result.initiatorPlayerId
            ? result.targetPlayerId
            : result.initiatorPlayerId
        );
        io.to(participant.socketId).emit('equivalent_reciprocity_card_required', {
          challengeId: result.challengeId,
          opponentPlayerId: opponent.id,
          opponentPlayerName: opponent.name
        });
      });
      const automaticResult = submitAutomaticEquivalentReciprocityCards(
        io,
        room,
        gameEngine,
        result.participantPlayerIds
      );
      io.to(room.id).emit('room_updated', { room: room.toJSON() });
      if (automaticResult?.resolved) {
        triggerBotPlay(io, room, gameEngine).catch(error => {
          logger.error('等价互惠结算后触发Bot出牌失败:', error);
        });
      }
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('发动等价互惠失败:', error);
    }
  });

  socket.on('submit_equivalent_reciprocity_card', ({ roomId, challengeId, cardId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      const result = gameEngine.submitEquivalentReciprocityCard(player.id, challengeId, cardId);
      io.to(room.id).emit('equivalent_reciprocity_selection_recorded', {
        challengeId: result.challengeId,
        playerId: result.playerId,
        playerName: result.playerName,
        selectedPlayerIds: result.selectedPlayerIds
      });
      if (result.resolved) {
        emitEquivalentReciprocityResolution(io, room, result);
      }
      io.to(room.id).emit('room_updated', { room: room.toJSON() });
      if (result.resolved) {
        triggerBotPlay(io, room, gameEngine).catch(error => {
          logger.error('等价互惠结算后触发Bot出牌失败:', error);
        });
      }
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('提交等价互惠拼点牌失败:', error);
    }
  });

  socket.on('activate_mutual_support', ({ roomId, direction, cardIds = [] }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      const result = gameEngine.activateMutualSupport(player.id, direction, cardIds);
      io.to(room.id).emit('active_skill_activated', {
        id: result.activeSkillId,
        name: result.activeSkillName,
        playerId: result.initiatorPlayerId,
        playerName: result.initiatorPlayerName
      });
      io.to(room.id).emit('mutual_support_started', {
        actionId: result.actionId,
        round: result.round,
        direction: result.direction,
        initiatorPlayerId: result.initiatorPlayerId,
        initiatorPlayerName: result.initiatorPlayerName,
        teammatePlayerId: result.teammatePlayerId,
        teammatePlayerName: result.teammatePlayerName,
        pending: result.pending,
        minCards: result.minCards ?? null,
        maxCards: result.maxCards ?? null
      });
      if (result.resolved) emitMutualSupportResolution(io, room, result);
      const automaticResult = submitAutomaticMutualSupportActions(io, room, gameEngine);
      io.to(room.id).emit('room_updated', { room: room.toJSON() });
      if (!room.gameState.mutualSupportPendingAction && !automaticResult?.gameFinished) {
        triggerBotPlay(io, room, gameEngine).catch(error => {
          logger.error('同舟共济发动后触发Bot出牌失败:', error);
        });
      }
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('发动同舟共济失败:', error);
    }
  });

  socket.on('activate_cultural_revolution', ({ roomId, declarationType, value }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      const result = gameEngine.activateCulturalRevolution(
        player.id,
        declarationType,
        value
      );
      emitCulturalRevolutionActivation(io, room, result);
      io.to(room.id).emit('room_updated', { room: room.toJSON() });
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('发动文化革命失败:', error);
    }
  });

  socket.on('activate_invite_into_urn', ({ roomId, targetPlayerId, suit, rank }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      const result = gameEngine.activateInviteIntoUrn(
        player.id,
        targetPlayerId,
        suit,
        rank
      );
      io.to(room.id).emit('active_skill_activated', {
        id: result.activeSkillId,
        name: result.activeSkillName,
        playerId: result.sourcePlayerId,
        playerName: result.sourcePlayerName
      });
      io.to(room.id).emit('invite_into_urn_activated', result);
      io.to(room.id).emit('room_updated', { room: room.toJSON() });
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('发动请君入瓮失败:', error);
    }
  });

  socket.on('submit_mutual_support_cards', ({ roomId, actionId, cardIds = [] }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      const result = gameEngine.submitMutualSupportCards(player.id, actionId, cardIds);
      emitMutualSupportResolution(io, room, result);
      const automaticResult = submitAutomaticMutualSupportActions(io, room, gameEngine);
      io.to(room.id).emit('room_updated', { room: room.toJSON() });
      const gameFinished = result.gameFinished || automaticResult?.gameFinished;
      if (result.gameFinished) emitFinishedGame(io, room);
      if (!gameFinished && !room.gameState.mutualSupportPendingAction) {
        triggerBotPlay(io, room, gameEngine).catch(error => {
          logger.error('同舟共济交牌完成后触发Bot出牌失败:', error);
        });
      }
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('提交同舟共济手牌失败:', error);
    }
  });

  socket.on('activate_time_reversal', ({ roomId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      const result = gameEngine.activateTimeReversal(player.id);
      io.to(room.id).emit('time_reversal_activated', result);
      io.to(room.id).emit('room_updated', { room: room.toJSON() });
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('预备时间倒流失败:', error);
    }
  });

  socket.on('activate_dream_killing', ({ roomId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      const result = gameEngine.activateDreamKilling(player.id);
      io.to(room.id).emit('active_skill_activated', result);
      io.to(room.id).emit('dream_killing_started', result);
      io.to(room.id).emit('room_updated', { room: room.toJSON() });
      triggerBotPlay(io, room, gameEngine).catch(error => {
        logger.error('梦中杀人发动后触发随机出牌失败:', error);
      });
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('发动梦中杀人失败:', error);
    }
  });

  socket.on('activate_lure_tiger', ({ roomId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      const result = gameEngine.activateLureTiger(player.id);
      io.to(room.id).emit('lure_tiger_reserved', result);
      io.to(room.id).emit('room_updated', { room: room.toJSON() });
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('预备调虎离山失败:', error);
    }
  });

  socket.on('respond_lure_tiger', ({ roomId, accept }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      const result = gameEngine.respondLureTiger(player.id, accept === true);
      if (!result.accepted) {
        io.to(room.id).emit('lure_tiger_declined', result);
      }
      io.to(room.id).emit('room_updated', { room: room.toJSON() });
      if (result.resolved) {
        triggerBotPlay(io, room, gameEngine).catch(error => {
          logger.error('调虎离山确认完成后触发Bot出牌失败:', error);
        });
      }
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('处理调虎离山确认失败:', error);
    }
  });

  socket.on('select_lure_tiger_target', ({ roomId, targetPlayerId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      const result = gameEngine.selectLureTigerTarget(player.id, targetPlayerId);
      io.to(room.id).emit('active_skill_activated', {
        id: result.activeSkillId,
        name: result.activeSkillName,
        playerId: result.playerId,
        playerName: result.playerName
      });
      io.to(room.id).emit('lure_tiger_activated', result);
      io.to(room.id).emit('room_updated', { room: room.toJSON() });
      if (result.resolved) {
        triggerBotPlay(io, room, gameEngine).catch(error => {
          logger.error('调虎离山目标选择完成后触发Bot出牌失败:', error);
        });
      }
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('选择调虎离山目标失败:', error);
    }
  });

  socket.on('activate_forbidden_magic', ({ roomId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      const result = gameEngine.activateForbiddenMagic(player.id);
      io.to(room.id).emit('forbidden_magic_reserved', result);
      io.to(room.id).emit('room_updated', { room: room.toJSON() });
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('预备禁术秘法失败:', error);
    }
  });

  socket.on('respond_forbidden_magic', ({ roomId, accept }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      const result = gameEngine.respondForbiddenMagic(player.id, accept === true);
      if (result.accepted) {
        io.to(room.id).emit('active_skill_activated', {
          id: result.activeSkillId,
          name: result.activeSkillName,
          playerId: result.playerId,
          playerName: result.playerName
        });
        io.to(room.id).emit('forbidden_magic_activated', result);
      } else {
        io.to(room.id).emit('forbidden_magic_declined', result);
      }
      io.to(room.id).emit('room_updated', { room: room.toJSON() });
      if (result.resolved) {
        triggerBotPlay(io, room, gameEngine).catch(error => {
          logger.error('禁术秘法确认完成后触发Bot出牌失败:', error);
        });
      }
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('处理禁术秘法确认失败:', error);
    }
  });

  socket.on('respond_remove_firewood', ({ roomId, accept }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      gameEngine.respondRemoveFirewood(player.id, accept === true);
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('处理釜底抽薪选择失败:', error);
    }
  });

  socket.on('respond_mainstay', ({ roomId, accept }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      gameEngine.respondMainstay(player.id, accept === true);
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('处理中流砥柱决定失败:', error);
    }
  });

  socket.on('submit_mainstay_cards', ({ roomId, actionId, cardIds = [] }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      gameEngine.submitMainstayCards(player.id, actionId, cardIds);
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('提交中流砥柱手牌失败:', error);
    }
  });

  socket.on('respond_time_reversal', ({ roomId, accept }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      const result = gameEngine.respondTimeReversal(player.id, accept === true);
      if (!result.resolved) {
        io.to(room.id).emit('time_reversal_response_recorded', result);
        io.to(room.id).emit('room_updated', { room: room.toJSON() });
        return;
      }
      if (result.accepted) {
        io.to(room.id).emit('active_skill_activated', {
          id: 'time_reversal',
          name: '时间倒流',
          playerId: result.playerId,
          playerName: result.playerName
        });
        for (const hand of result.hands) {
          const handOwner = room.findPlayerById(hand.playerId);
          if (!handOwner?.socketId) continue;
          io.to(handOwner.socketId).emit('time_reversal_hand_restored', {
            round: result.round,
            cards: hand.cards
          });
        }
      }
      continueAfterTimeReversalWindow(io, room, gameEngine, result);
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('处理时间倒流决定失败:', error);
    }
  });

  socket.on('respond_last_stand', ({ roomId, accept }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');
      gameEngine.respondLastStand(player.id, accept === true);
      triggerBotPlay(io, room, gameEngine).catch(error => {
        logger.error('绝处逢生决定后触发Bot出牌失败:', error);
      });
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('处理绝处逢生决定失败:', error);
    }
  });

  socket.on('respond_teammate_cheer', ({ roomId, accept }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      const result = gameEngine.respondTeammateCheer(player.id, accept === true);
      emitTeammateCheerResolution(io, room, result);
      if (result.gameFinished) emitFinishedGame(io, room);
      io.to(room.id).emit('room_updated', { room: room.toJSON() });
      if (!result.gameFinished) {
        triggerBotPlay(io, room, gameEngine).catch(error => {
          logger.error('队友加油决定后触发Bot出牌失败:', error);
        });
      }
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('处理队友加油决定失败:', error);
    }
  });

  socket.on('respond_afterglow', ({ roomId, accept }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      const result = gameEngine.respondAfterglow(player.id, accept === true);
      broadcastAfterglowResolution(io, room, result);
      io.to(room.id).emit('room_updated', { room: room.toJSON() });
      triggerBotPlay(io, room, gameEngine).catch(error => {
        logger.error('回光返照决定后触发Bot出牌失败:', error);
      });
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('处理回光返照决定失败:', error);
    }
  });

  socket.on('activate_late_mover_advantage', ({ roomId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      const result = gameEngine.activateLateMoverAdvantage(player.id);
      io.to(room.id).emit('active_skill_activated', {
        id: result.activeSkillId,
        name: result.activeSkillName,
        playerId: result.playerId,
        playerName: result.playerName
      });
      io.to(room.id).emit('late_mover_advantage_activated', result);
      io.to(room.id).emit('round_updated', {
        type: 'turn_changed',
        currentPlayerIndex: result.currentPlayerIndex,
        message: result.message
      });
      io.to(room.id).emit('room_updated', { room: room.toJSON() });

      triggerBotPlay(io, room, gameEngine).catch(error => {
        logger.error('后发制人换序后触发Bot出牌失败:', error);
      });
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('发动后发制人失败:', error);
    }
  });

  socket.on('activate_recommend_talent', ({ roomId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      const result = gameEngine.activateRecommendTalent(player.id);
      io.to(room.id).emit('active_skill_activated', {
        id: result.activeSkillId,
        name: result.activeSkillName,
        playerId: result.playerId,
        playerName: result.playerName
      });
      io.to(room.id).emit('recommend_talent_activated', result);
      io.to(room.id).emit('round_updated', {
        type: 'turn_changed',
        currentPlayerIndex: result.currentPlayerIndex,
        message: result.message
      });
      io.to(room.id).emit('room_updated', { room: room.toJSON() });

      triggerBotPlay(io, room, gameEngine).catch(error => {
        logger.error('举贤任能换序后触发Bot出牌失败:', error);
      });
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('发动举贤任能失败:', error);
    }
  });

  socket.on('activate_bush_gate', ({ roomId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      const result = gameEngine.activateBushGate(player.id);
      io.to(room.id).emit('active_skill_activated', {
        id: result.activeSkillId,
        name: result.activeSkillName,
        playerId: result.activatorPlayerId,
        playerName: result.activatorPlayerName
      });
      io.to(room.id).emit('bush_gate_activated', result);
      io.to(room.id).emit('round_updated', {
        type: 'turn_changed',
        currentPlayerIndex: result.currentPlayerIndex,
        bushGate: result,
        message: result.message
      });
      io.to(room.id).emit('room_updated', { room: room.toJSON() });

      triggerBotPlay(io, room, gameEngine).catch(error => {
        logger.error('布什戈门退牌后触发Bot出牌失败:', error);
      });
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('发动布什戈门失败:', error);
    }
  });

  /**
   * 开始游戏（房主）
   */
  socket.on('start_game', ({ roomId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      if (room.hostId !== socket.id) {
        throw new Error('只有房主可以开始游戏');
      }

      if (room.gameState.phase !== GamePhases.WAITING || room.gameState.isWaitingForReady) {
        throw new Error('游戏已经开始，请勿重复开始');
      }

      if (!room.canStart()) {
        throw new Error(`需要${room.config.minPlayers}-${room.config.maxPlayers}名玩家才能开始`);
      }

      // 创建游戏引擎
      const gameEngine = new GameEngine(room, io);
      gameEngine.onBotTurn = () => {
        triggerBotPlay(io, room, gameEngine).catch(err => {
          logger.error('触发bot出牌失败:', err);
        });
      };
      gameEngine.onTimeReversalWindowClosed = result => {
        continueAfterTimeReversalWindow(io, room, gameEngine, result);
      };
      gameEngines.set(room.id, gameEngine);

      // 开始游戏
      gameEngine.startGame();

      // 广播房间状态更新
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('开始游戏失败:', error);
    }
  });

  /**
   * 玩家准备
   */
  socket.on('player_ready', ({ roomId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      const player = room.findPlayerBySocketId(socket.id);
      if (!player) {
        throw new Error('玩家不存在');
      }

      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) {
        throw new Error('游戏未开始');
      }

      const allReady = gameEngine.playerReady(player.id);

      // 广播玩家准备状态
      io.to(room.id).emit('player_ready_status', {
        playerId: player.id,
        playerName: player.name,
        isReady: player.isReady
      });

      // 广播房间状态更新
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

      if (allReady) {
        // 所有玩家准备完毕
        io.to(room.id).emit('all_players_ready', {
          message: room.gameState.isRuleSelectionPending
            ? '所有玩家已准备，等待规则选择者做出选择'
            : '所有玩家已准备，开始发牌'
        });
      }

      logger.info(`房间 ${room.id} 玩家 ${player.name} 已准备`);

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('玩家准备失败:', error);
    }
  });

  /**
   * 摸牌后规则：每位真人玩家暗中确认要交出的两张牌。
   * 牌面只在 GameEngine 的私有结果事件中发给对应玩家。
   */
  socket.on('submit_card_exchange', ({ roomId, cardIds }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');

      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');

      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      const result = gameEngine.submitOpeningCardExchange(player.id, cardIds);
      if (result.gameFinished) {
        emitFinishedGame(io, room);
      } else if (result.resolved && result.stage === 'round') {
        triggerBotPlay(io, room, gameEngine).catch(error => {
          logger.error('轮末换牌完成后触发Bot出牌失败:', error);
        });
      }
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('提交换牌失败:', error);
    }
  });

  /** 冰山一角：每名真人玩家自行提交需要明置的牌。 */
  socket.on('submit_iceberg_reveals', ({ roomId, cardIds }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');

      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');

      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      const result = gameEngine.submitIcebergRevealSelection(player.id, cardIds);
      if (result.resolved) {
        triggerBotPlay(io, room, gameEngine).catch(err => {
          logger.error('冰山明牌确认后触发Bot出牌失败:', err);
        });
      }
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('提交冰山明牌失败:', error);
    }
  });

  /** 十面埋伏：庄家队友在埋底后暗中指定点数。 */
  socket.on('select_waiting_rabbit_target', ({ roomId, suit, rank }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      const result = gameEngine.selectWaitingRabbitTarget(player.id, suit, rank);
      if (!result.pending) {
        triggerBotPlay(io, room, gameEngine).catch(error => {
          logger.error('守株待兔暗选完成后触发Bot出牌失败:', error);
        });
      }
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('选择守株待兔目标牌失败:', error);
    }
  });

  socket.on('select_ten_sided_ambush_rank', ({ roomId, rank }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');

      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');

      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      gameEngine.selectTenSidedAmbushRank(player.id, rank);
      triggerBotPlay(io, room, gameEngine).catch(err => {
        logger.error('十面埋伏选点后触发Bot出牌失败:', err);
      });
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('选择十面埋伏点数失败:', error);
    }
  });

  /** 三权分立：初始2、3、4号位各自暗选自己的分牌重载点数。 */
  socket.on('select_three_powers_rank', ({ roomId, sourceRank, rank }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      const result = gameEngine.selectThreePowersRank(player.id, sourceRank, rank);
      if (!result.pending) {
        triggerBotPlay(io, room, gameEngine).catch(err => {
          logger.error('三权分立暗选完成后触发Bot出牌失败:', err);
        });
      }
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('选择三权分立重载点数失败:', error);
    }
  });

  /** 君子一言：并列最短有效花色时，由玩家公开选择其中一种。 */
  socket.on('select_gentleman_promise_suit', ({ roomId, suit }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      const result = gameEngine.selectGentlemanPromiseSuit(player.id, suit);
      if (!result.pending) {
        triggerBotPlay(io, room, gameEngine).catch(err => {
          logger.error('君子一言声明完成后触发Bot出牌失败:', err);
        });
      }
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('选择君子一言最短花色失败:', error);
    }
  });

  /** 潜龙在渊：并列最多的非级牌点数由玩家公开选择其中一个。 */
  socket.on('select_hidden_dragon_rank', ({ roomId, rank }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      const result = gameEngine.selectHiddenDragonRank(player.id, rank);
      if (!result.pending) {
        triggerBotPlay(io, room, gameEngine).catch(err => {
          logger.error('潜龙在渊声明完成后触发Bot出牌失败:', err);
        });
      }
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('选择潜龙在渊最多点数失败:', error);
    }
  });

  /** 二律背反：选择花色+点数，全部提交后才同时公开。 */
  socket.on('select_antinomy_card', ({ roomId, suit, rank }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      const result = gameEngine.selectAntinomyCard(player.id, suit, rank);
      if (!result.pending) {
        triggerBotPlay(io, room, gameEngine).catch(err => {
          logger.error('二律背反选择完成后触发Bot出牌失败:', err);
        });
      }
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('选择二律背反牌面失败:', error);
    }
  });

  /** 改稻为桑：两名闲家在首张牌打出前选择要改造的分牌。 */
  socket.on('select_rice_to_mulberry_cards', ({ roomId, cardIds = [] }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      const result = gameEngine.selectRiceToMulberryCards(player.id, cardIds);
      if (!result.pending) {
        triggerBotPlay(io, room, gameEngine).catch(err => {
          logger.error('改稻为桑选择完成后触发Bot出牌失败:', err);
        });
      }
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('选择改稻为桑分牌失败:', error);
    }
  });

  /** 行政审查：庄家下家选副花色、上家选点数，两项声明均向全桌公开。 */
  socket.on('select_administrative_review', ({ roomId, type, value }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      const result = gameEngine.selectAdministrativeReviewDeclaration(
        player.id,
        type,
        value
      );
      if (!result.pending) {
        triggerBotPlay(io, room, gameEngine).catch(err => {
          logger.error('行政审查声明完成后触发Bot出牌失败:', err);
        });
      }
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('选择行政审查条件失败:', error);
    }
  });

  /** 焦点人物：表决仅在本队内部流转，两队都通过后才允许开始出牌。 */
  socket.on('vote_focus_figure', ({ roomId, team, attempt, agree }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      const result = gameEngine.submitFocusFigureVote(player.id, agree, { team, attempt });
      if (!result.pending) {
        triggerBotPlay(io, room, gameEngine).catch(err => {
          logger.error('焦点人物表决完成后触发Bot出牌失败:', err);
        });
      }
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('焦点人物表决失败:', error);
    }
  });

  /**
   * 设置埋底玩家（房主）
   */
  socket.on('set_burying_player', ({ roomId, playerId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      if (room.hostId !== socket.id) {
        throw new Error('只有房主可以指定埋底玩家');
      }

      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) {
        throw new Error('游戏未开始');
      }

      if (room.gameState.phase !== GamePhases.BURYING) {
        throw new Error('当前不是埋底阶段');
      }

      if (room.gameState.buryingPlayerId) {
        throw new Error('庄家已经确定，不能重复发放底牌');
      }

      // 进入埋底阶段
      room.gameState.phase = GamePhases.BURYING;

      const buryingPlayer = gameEngine.setBuryingPlayer(playerId);

      // 私密发送底牌给埋底玩家
      io.to(buryingPlayer.socketId).emit('bottom_cards_received', {
        bottomCards: room.gameState.bottomCards.map(c => c.toJSON()),
        totalCards: buryingPlayer.cards.length
      });

      // 广播埋底玩家
      io.to(room.id).emit('burying_player_set', {
        playerId: buryingPlayer.id,
        playerName: buryingPlayer.name
      });

      // 广播房间状态更新
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('设置埋底玩家失败:', error);
    }
  });

  /**
   * 埋底
   */
  socket.on('bury_cards', ({ roomId, cardIds }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      const player = room.findPlayerBySocketId(socket.id);
      if (!player) {
        throw new Error('玩家不存在');
      }

      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) {
        throw new Error('游戏未开始');
      }

      gameEngine.buryCards(player.id, cardIds);

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('埋底失败:', error);
    }
  });

  /**
   * 设置首发玩家（房主）
   */
  socket.on('set_first_player', ({ roomId, playerId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      if (room.hostId !== socket.id) {
        throw new Error('只有房主可以指定首发玩家');
      }

      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) {
        throw new Error('游戏未开始');
      }

      const firstPlayer = gameEngine.setFirstPlayer(playerId);

      // 广播首发玩家
      io.to(room.id).emit('first_player_set', {
        playerId: firstPlayer.id,
        playerName: firstPlayer.name,
        currentPlayerIndex: room.gameState.currentPlayerIndex,
        currentPlayerId: firstPlayer.id,
        currentPlayerName: firstPlayer.name
      });

      // 广播房间状态更新
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

      logger.info(`房间 ${room.id} 首发玩家: ${firstPlayer.name}`);

      // 触发bot自动出牌
      triggerBotPlay(io, room, gameEngine).catch(err => {
        logger.error('触发bot出牌失败:', err);
      });

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('设置首发玩家失败:', error);
    }
  });

  /**
   * 出牌
   */
  socket.on('respond_straw_boat_borrowing_arrows', ({ roomId, accept, cardId = null }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      const result = gameEngine.resolveStrawBoatBorrowingArrows(player.id, {
        accept: Boolean(accept),
        cardId
      });
      emitStrawBoatBorrowingArrowsResolution(io, room, result);
      io.to(room.id).emit('room_updated', { room: room.toJSON() });
      triggerBotPlay(io, room, gameEngine).catch(error => {
        logger.error('草船借箭处理后触发Bot出牌失败:', error);
      });
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('处理草船借箭失败:', error);
    }
  });

  socket.on('respond_waiting_rabbit', ({ roomId, accept, discardCardId = null }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      const { roundResult } = gameEngine.resolveWaitingRabbitDecision(player.id, {
        accept: Boolean(accept),
        discardCardId
      });
      emitWaitingRabbitResolution(io, room, roundResult);
      io.to(room.id).emit('room_updated', { room: room.toJSON() });
      triggerBotPlay(io, room, gameEngine).catch(error => {
        logger.error('守株待兔轮末处理后触发Bot出牌失败:', error);
      });
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('处理守株待兔换牌失败:', error);
    }
  });

  socket.on('respond_political_review', ({ roomId, returnPlay }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      gameEngine.respondPoliticalReview(player.id, returnPlay === true);
      triggerBotPlay(io, room, gameEngine).catch(error => {
        logger.error('政治审查决定后触发Bot出牌失败:', error);
      });
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('处理政治审查决定失败:', error);
    }
  });

  socket.on('request_surrender', ({ roomId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      const request = gameEngine.requestSurrender(player.id);
      io.to(room.id).emit('surrender_requested', request);
      beginSurrenderDecision(io, room, gameEngine);
      io.to(room.id).emit('room_updated', { room: room.toJSON() });
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('发起投降失败:', error);
    }
  });

  socket.on('respond_surrender', ({ roomId, accept }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      const result = gameEngine.respondSurrender(player.id, accept === true);
      if (result.accepted) {
        io.to(room.id).emit('game_surrendered', result.surrender);
        emitFinishedGame(io, room);
      } else {
        io.to(room.id).emit('surrender_rejected', result.rejection);
        if (result.gameFinished) {
          emitFinishedGame(io, room);
        } else if (result.nextDecision) {
          beginSurrenderDecision(io, room, gameEngine, result.nextDecision);
        }
      }
      io.to(room.id).emit('room_updated', { room: room.toJSON() });
      if (!result.gameFinished && !result.nextDecision) {
        triggerBotPlay(io, room, gameEngine).catch(error => {
          logger.error('投降表决结束后触发牌局继续失败:', error);
        });
      }
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('处理投降决定失败:', error);
    }
  });

  socket.on('play_cards', ({
    roomId,
    cardIds,
    controlledPlayerId = null,
    activeSkillId = null,
    jokerSubstitutions = [],
    clusterAnalysisSubstitutions = [],
    forbiddenMagicSubstitutions = [],
    divineWeaponCardId = null,
    divineWeaponSourceCardId = null,
    ambiguousAlternativeCardIds = [],
    politicalReviewApprovalId = null
  }, acknowledge) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      const player = room.findPlayerBySocketId(socket.id);
      if (!player) {
        throw new Error('玩家不存在');
      }

      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) {
        throw new Error('游戏未开始');
      }

      const result = gameEngine.playCards(
        player.id,
        cardIds,
        controlledPlayerId,
        activeSkillId,
        {
          jokerSubstitutions,
          clusterAnalysisSubstitutions,
          forbiddenMagicSubstitutions,
          divineWeaponCardId,
          divineWeaponSourceCardId,
          ambiguousAlternativeCardIds,
          politicalReviewApprovalId
        }
      );

      if (typeof acknowledge === 'function') {
        acknowledge({
          ok: true,
          pending: Boolean(result.politicalReviewDeferred)
        });
      }
      if (result.politicalReviewDeferred) return;

      if (result.throwFailed) {
        io.to(room.id).emit('throw_failed', {
          playerId: result.playerId,
          playerName: result.playerName,
          isProxy: result.isProxy,
          message: result.throwFailed.message,
          attemptedCards: result.throwFailed.attemptedCards,
          attemptedCardObjects: result.throwFailed.attemptedCardObjects,
          forcedCards: result.throwFailed.forcedCards
        });
      }

      // 广播出牌
      if (result.activeSkillActivation) {
        io.to(room.id).emit('active_skill_activated', result.activeSkillActivation);
      }
      emitCardsPlayed(io, room, result);
      emitThreeTigersTransformation(io, room, result.threeTigersTransformation);
      if (result.roundUpdate?.strengthCompensation) {
        gameEngine.emitStrengthCompensationHands(result.roundUpdate.strengthCompensation);
      }
      if (result.roundUpdate?.defenseAsOffense) {
        gameEngine.emitDefenseAsOffenseHands(result.roundUpdate.defenseAsOffense);
      }
      if (result.dreamKilling?.awakened) {
        io.to(room.id).emit('dream_killing_awakened', {
          playerId: result.playerId,
          playerName: result.playerName,
          ...result.dreamKilling
        });
      }
      if (result.roundReveal) {
        io.to(room.id).emit('concealed_plays_revealed', result.roundReveal);
      }

      if (result.tenSidedAmbushReveal) {
        io.to(room.id).emit('ten_sided_ambush_revealed', result.tenSidedAmbushReveal);
      }
      if (result.threePowersReveal) {
        io.to(room.id).emit('three_powers_revealed', result.threePowersReveal);
      }

      // 广播毙牌动作
      if (result.trumpAction) {
        io.to(room.id).emit('trump_action', {
          type: result.trumpAction.type,
          playerId: result.trumpAction.playerId,
          playerName: result.trumpAction.playerName,
          targetPlayerId: result.trumpAction.targetPlayerId,
          targetPlayerName: result.trumpAction.targetPlayerName
        });
      }

      // 广播回合状态更新
      if (result.roundUpdate) {
        io.to(room.id).emit('round_updated', result.roundUpdate);
      }
      const surrenderReviewResult = beginSurrenderDecision(
        io,
        room,
        gameEngine,
        result.surrenderDecision
      );
      if (surrenderReviewResult?.pending || surrenderReviewResult?.gameFinished) {
        io.to(room.id).emit('room_updated', { room: room.toJSON() });
        return;
      }
      const automaticDestroyDykeResult = beginDestroyDykeDecision(
        io,
        room,
        gameEngine,
        result.destroyDykeDecision
      );
      if (automaticDestroyDykeResult?.roundResult) return;
      beginWaitingRabbitDecision(io, room, gameEngine, result.waitingRabbitDecision);
      beginAmbiguousChoiceDecision(io, room, gameEngine, result.ambiguousDecision);
      const automaticTeammateCheerResult = beginTeammateCheerDecision(
        io,
        room,
        gameEngine,
        result.teammateCheerRequest
      );
      beginAfterglowDecision(io, room, gameEngine, result.afterglowRequest);
      if (result.afterglowExpired) {
        io.to(room.id).emit('afterglow_expired', result.afterglowExpired);
      }
      beginStrawBoatBorrowingArrowsDecision(
        io,
        room,
        gameEngine,
        result.strawBoatDecision
      );
      emitCulturalRevolutionExpiry(
        io,
        room,
        result.roundUpdate?.culturalRevolutionTransition
      );
      if (result.mutualSupportReturn) {
        submitAutomaticMutualSupportActions(io, room, gameEngine);
      }
      emitPlannedEconomyDraw(io, room, result.plannedEconomyDraw);
      if (result.timeReversalPending) {
        gameEngine.scheduleTimeReversalDecision();
      }
      emitWholeHandExchange(io, room, result.wholeHandExchange);
      const roundSelectionResult = beginRoundCardExchange(
        io,
        room,
        gameEngine,
        result.roundCardExchange
      );
      if (roundSelectionResult?.gameFinished) {
        emitFinishedGame(io, room);
      }

      // 检查是否有玩家打完牌
      if (
        result.remainingCount === 0
        && !result.timeReversalPending
        && !result.ambiguousDecisionPending
        && !result.destroyDykeDecisionPending
      ) {
        io.to(room.id).emit('player_finished', {
          playerId: result.playerId,
          playerName: result.playerName
        });
      }

      // 游戏结束
      if (result.gameFinished) {
        // 发送底牌和得分结果
        io.to(room.id).emit('bottom_revealed', {
          bottomCards: room.gameState.bottomCards.map(c => c.toJSON()),
          bottomScoreResult: room.gameState.bottomScoreResult,
          upgradeResult: room.gameState.upgradeResult
        });

        io.to(room.id).emit('phase_changed', {
          phase: 'revealing',
          message: room.gameState.bottomScoreResult?.abruptStop
            ? '戛然而止，查看最后一轮与底牌结算'
            : room.gameState.bottomScoreResult?.mistyFogCards?.length
            ? '所有玩家已出完牌，查看底牌与迷雾牌'
            : '所有玩家已出完牌，查看底牌'
        });
      }

      // 广播房间状态更新
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

      // 触发下一位bot自动出牌
      if (!result.gameFinished && !automaticTeammateCheerResult?.gameFinished) {
        triggerBotPlay(io, room, gameEngine).catch(err => {
          logger.error('触发下一位bot出牌失败:', err);
        });
      }

    } catch (error) {
      if (typeof acknowledge === 'function') {
        acknowledge({ ok: false, message: error.message });
      }
      socket.emit('error', { message: error.message });
      logger.error('出牌失败:', error);
    }
  });

  socket.on('respond_ambiguous_choice', ({ roomId, optionIndex }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      const result = gameEngine.resolveAmbiguousChoice(player.id, optionIndex);
      emitAmbiguousChoiceResult(io, room, result);
      if (result.completed) {
        emitAmbiguousFinalRound(io, room, gameEngine, result);
      } else {
        io.to(room.id).emit('room_updated', { room: room.toJSON() });
        beginAmbiguousChoiceDecision(io, room, gameEngine, result.nextDecision);
      }
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('处理模棱两可选择失败:', error);
    }
  });

  socket.on('respond_destroy_dyke', ({ roomId, accept }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');
      const player = room.findPlayerBySocketId(socket.id);
      if (!player) throw new Error('玩家不存在');
      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      const response = gameEngine.respondDestroyDyke(player.id, accept === true);
      emitDestroyDykeFinalRound(io, room, gameEngine, response);
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('处理毁堤淹田决定失败:', error);
    }
  });

  /**
   * 跳过（出0张牌）
   */
  socket.on('pass_turn', ({ roomId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      const player = room.findPlayerBySocketId(socket.id);
      if (!player) {
        throw new Error('玩家不存在');
      }

      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) {
        throw new Error('游戏未开始');
      }

      // 跳过就是出0张牌
      const result = gameEngine.playCards(player.id, []);

      // 广播跳过
      io.to(room.id).emit('turn_passed', {
        playerId: player.id,
        playerName: player.name
      });

      // 游戏结束检查
      if (result.gameFinished) {
        io.to(room.id).emit('bottom_revealed', {
          bottomCards: room.gameState.bottomCards.map(c => c.toJSON()),
          bottomScoreResult: room.gameState.bottomScoreResult,
          upgradeResult: room.gameState.upgradeResult
        });

        io.to(room.id).emit('phase_changed', {
          phase: 'revealing',
          message: room.gameState.bottomScoreResult?.mistyFogCards?.length
            ? '所有玩家已出完牌，查看底牌与迷雾牌'
            : '所有玩家已出完牌，查看底牌'
        });
      }

      // 广播房间状态更新
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('跳过失败:', error);
    }
  });


  /** 普通规则仅庄家可私密查看；特殊公开规则按各自权限返回底牌。 */
  socket.on('view_my_bottom_cards', ({ roomId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      const player = room.findPlayerBySocketId(socket.id);
      if (!player) {
        throw new Error('玩家不存在');
      }

      const isPublic = isOpenlyRevealedRule(room.gameState.selectedRule);
      const isPeopleCommune = isPeopleCommuneRule(room.gameState.selectedRule);
      const isAdministrativeReview = isAdministrativeReviewRule(room.gameState.selectedRule);
      const isReformAndOpeningUp = isReformAndOpeningUpRule(room.gameState.selectedRule);
      const ownPeopleCommuneCards = isPeopleCommune
        ? room.gameState.peopleCommuneBuriedCardsByPlayerId.get(player.id)
        : null;
      const isDealer = room.gameState.buryingPlayerId === player.id;
      const isReformTeammate = (
        isReformAndOpeningUp
        && room.gameState.reformAndOpeningUpTeammatePlayerId === player.id
      );
      const isReformBottomFinalized = (
        isReformAndOpeningUp
        && room.gameState.phase !== GamePhases.BURYING
        && !room.gameState.secondaryBuryingPlayerId
        && room.gameState.bottomCards.length === room.gameState.bottomCardsCount
      );

      // 人民公社只允许看自己已经埋下的两张牌；其他三家的牌仍然保密。
      if (isPeopleCommune && !ownPeopleCommuneCards) {
        throw new Error('请先完成自己的埋牌');
      }
      // 改革开放在队友完成再埋底后，由庄家和该队友共同查看最终底牌。
      // 其他普通规则的私密查看权仍只属于庄家；昭然若揭不限制身份和阶段。
      const canViewPrivateBottom = isDealer
        || (isReformBottomFinalized && isReformTeammate);
      if (!isPublic && !isPeopleCommune && !canViewPrivateBottom) {
        throw new Error(
          isReformAndOpeningUp
            ? '只有本局庄家和庄家队友可以查看底牌'
            : '只有本局庄家可以查看底牌'
        );
      }
      if (
        isReformAndOpeningUp
        && room.gameState.secondaryBuryingPlayerId
        && isDealer
      ) {
        throw new Error('庄家队友尚未完成再埋底');
      }
      if (
        isAdministrativeReview
        && !room.gameState.administrativeReview?.isBottomReleased
      ) {
        throw new Error('行政审查条件尚未满足，庄家暂时不能查看底牌');
      }

      const visibleBottomCards = isPeopleCommune
        ? ownPeopleCommuneCards
        : room.gameState.bottomCards;
      socket.emit('my_bottom_cards', {
        bottomCards: visibleBottomCards.map(c => c.toJSON()),
        isPublic,
        isPeopleCommune,
        isReformAndOpeningUp
      });

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('查看底牌失败:', error);
    }
  });


  /**
   * 撤回出牌
   */
  socket.on('undo_play', ({ roomId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      const player = room.findPlayerBySocketId(socket.id);
      if (!player) {
        throw new Error('玩家不存在');
      }

      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) {
        throw new Error('游戏未开始');
      }

      const result = gameEngine.undoLastPlay(player.id);

      // 广播撤回
      io.to(room.id).emit('play_undone', {
        playerId: result.playerId,
        playerName: result.playerName,
        controllerPlayerId: result.controllerPlayerId,
        controllerPlayerName: result.controllerPlayerName,
        isProxy: result.isProxy,
        cards: result.concealed ? [] : result.cards,
        cardsCount: result.cards.length,
        concealed: result.concealed,
        remainingCount: result.remainingCount,
        restoredActiveSkillId: result.restoredActiveSkillId,
        restoredActiveSkillName: result.restoredActiveSkillName
      });
      emitThreeTigersTransformation(io, room, result.threeTigersTransformation);
      if (result.teammateCheerReverted) {
        io.to(room.id).emit('teammate_cheer_reverted', result.teammateCheerReverted);
        const buffedPlayer = room.findPlayerById(result.teammateCheerReverted.buffedPlayerId);
        if (buffedPlayer?.socketId && !buffedPlayer.isBot) {
          io.to(buffedPlayer.socketId).emit('teammate_cheer_hand_updated', {
            sourcePlayerId: result.teammateCheerReverted.playerId,
            sourcePlayerName: result.teammateCheerReverted.playerName,
            cards: result.teammateCheerRestoredCards
          });
        }
      }
      if (result.afterglowReverted) {
        io.to(room.id).emit('afterglow_reverted', result.afterglowReverted);
        const afterglowPlayer = room.findPlayerById(result.afterglowReverted.playerId);
        if (afterglowPlayer?.socketId && !afterglowPlayer.isBot) {
          io.to(afterglowPlayer.socketId).emit('afterglow_hand_updated', {
            cards: result.afterglowRestoredCards
          });
        }
      }
      if (result.concealed) {
        const concealedPlayer = room.findPlayerById(result.playerId);
        if (concealedPlayer?.socketId) {
          io.to(concealedPlayer.socketId).emit('concealed_play_undone_private', {
            playerId: result.playerId,
            cards: result.cards
          });
        }
      }

      // 广播房间状态更新
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('撤回出牌失败:', error);
    }
  });

  /**
   * 准备开始下一局
   */
  socket.on('ready_for_next_game', ({ roomId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      const player = room.findPlayerBySocketId(socket.id);
      if (!player) {
        throw new Error('玩家不存在');
      }

      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) {
        throw new Error('游戏未开始');
      }

      if (room.gameState.phase !== GamePhases.REVEALING) {
        throw new Error('只能在本局结束后准备下一局');
      }

      const allReady = gameEngine.readyForNextGame(player.id);

      // 广播准备状态
      const readyCount = room.players.filter(p => p.isReadyForNext).length;
      io.to(room.id).emit('player_ready_for_next', {
        playerId: player.id,
        playerName: player.name,
        readyCount,
        totalCount: room.players.length
      });

      // 所有人准备好后会自动开始下一局（在 readyForNextGame 中处理）
      // 这里只需要广播房间状态更新
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('准备下一局失败:', error);
    }
  });

  /**
   * 重新开始（房主）
   */
  socket.on('restart_game', ({ roomId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      if (room.hostId !== socket.id) {
        throw new Error('只有房主可以重新开始');
      }

      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) {
        throw new Error('游戏未开始');
      }

      gameEngine.restartGame();

      // 广播游戏重新开始事件
      io.to(room.id).emit('game_restarted', {
        room: room.toJSON()
      });

      // 广播房间状态更新
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

      logger.info(`房间 ${room.id} 重新开始游戏`);

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('重新开始失败:', error);
    }
  });

  /**
   * 调整分数
   */
  socket.on('update_score', ({ roomId, amount }) => {
    try {
      // 另一种同名事件由playerHandlers处理（房主设置指定玩家的绝对分数）。
      if (typeof amount !== 'number') return;

      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      const player = room.findPlayerBySocketId(socket.id);
      if (!player) {
        throw new Error('玩家不存在');
      }

      player.score = Math.max(0, player.score + amount);

      // 广播房间状态更新
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

      logger.info(`房间 ${room.id} 玩家 ${player.name} 分数调整为 ${player.score}`);

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('调整分数失败:', error);
    }
  });

  /**
   * 调整等级
   */
  socket.on('update_level', ({ roomId, amount }) => {
    try {
      // 另一种同名事件由playerHandlers处理（房主设置指定玩家的绝对等级）。
      if (typeof amount !== 'number') return;

      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      const player = room.findPlayerBySocketId(socket.id);
      if (!player) {
        throw new Error('玩家不存在');
      }

      player.level = Math.max(2, player.level + amount);

      // 广播房间状态更新
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

      logger.info(`房间 ${room.id} 玩家 ${player.name} 等级调整为 ${player.level}`);

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('调整等级失败:', error);
    }
  });

  /**
   * 选择规则
   */
  socket.on('select_rule', ({ roomId, rule }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      const player = room.findPlayerBySocketId(socket.id);
      if (!player) {
        throw new Error('玩家不存在');
      }

      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) {
        throw new Error('游戏未开始');
      }

      gameEngine.selectRule(player.id, rule);

      // 广播房间状态更新
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('选择规则失败:', error);
    }
  });

  /**
   * 双喜临门三选二阶段：仅房主可以把指定位置的候选换成一条新规则。
   */
  socket.on('refresh_double_happiness_option', ({ roomId, optionIndex }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) throw new Error('房间不存在');

      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) throw new Error('游戏未开始');

      gameEngine.refreshDoubleHappinessOption(socket.id, optionIndex);
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('刷新双喜临门候选失败:', error);
    }
  });
}
