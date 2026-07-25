import {
  getEffectiveSuit,
  PatternTypes,
  resolveClusterAnalysisPlay,
  resolveForbiddenMagicPlay,
  resolveJokerSubstitutionPlay,
  validateFollowingPlay,
  validateLeadingPlay
} from './cardPatternUtils.js';
import { PlayModes } from './constants.js';
import { ruleIncludesId } from './ruleCatalog.js';

export function isCurrentPlayersTurn(gameState, players = [], currentPlayerId = null) {
  if (!gameState || !currentPlayerId) return false;
  if (currentPlayerId === gameState.openHandPlayerId) return false;
  if (gameState.playMode === PlayModes.FREE) return true;
  if (!Number.isInteger(gameState.currentPlayerIndex)) return false;
  const turnPlayerId = players[gameState.currentPlayerIndex]?.id;
  if (turnPlayerId === gameState.openHandPlayerId) {
    return gameState.openHandControllerPlayerId === currentPlayerId;
  }
  return turnPlayerId === currentPlayerId;
}

export function getFinalTrickAutoSelectedCardIds({
  gameState,
  players = [],
  handCards = []
} = {}) {
  const playedPlayerIndexes = gameState?.playersPlayedThisRound;
  const requiredLength = Number(gameState?.leadingPattern?.length);
  if (
    !Array.isArray(playedPlayerIndexes)
    || playedPlayerIndexes.length === 0
    || !Number.isInteger(requiredLength)
    || requiredLength < 1
    || !Array.isArray(handCards)
    || handCards.length !== requiredLength
  ) {
    return null;
  }

  // “一号位”指本墩首家，不一定是固定座位 0。
  const leadingPlayer = players[playedPlayerIndexes[0]];
  if (!leadingPlayer || Number(leadingPlayer.cardsCount) !== 0) return null;

  const cardIds = handCards.map(card => card?.id);
  return cardIds.every(Boolean) ? cardIds : null;
}

export function isBurySelectionValid(selectedCardIds = [], requiredCount = 0) {
  return Number.isInteger(requiredCount) &&
    requiredCount > 0 &&
    selectedCardIds.length === requiredCount;
}

export function getPlayActionLabel({ isActiveSkillArmed = false, activeSkill = null } = {}) {
  const isSmallDiscardSkill = activeSkill?.effect === 'free_discard_treated_small'
    || activeSkill?.id === 'substitute_sacrifice';
  return isActiveSkillArmed && isSmallDiscardSkill ? '垫牌' : '出牌';
}

export function getActiveBuryingPlayerId(gameState) {
  return gameState?.peopleCommune?.currentBuryingPlayerId
    || gameState?.secondaryBuryingPlayerId
    || gameState?.buryingPlayerId
    || null;
}

export function canPlayerViewBottomCards({
  gameState,
  currentPlayerId,
  selectedRule = null,
  bottomCardsCount = 0
} = {}) {
  if (!gameState || !currentPlayerId || bottomCardsCount <= 0) return false;
  const activeRule = gameState.selectedRule || selectedRule;
  const isPeopleCommune = ruleIncludesId(activeRule, 'people_commune');
  if (isPeopleCommune) {
    return Boolean(
      gameState.peopleCommune?.submittedPlayerIds?.includes(currentPlayerId)
    );
  }
  if (ruleIncludesId(activeRule, 'administrative_review')) {
    if (!gameState.administrativeReview?.isBottomReleased) return false;
  }
  if (ruleIncludesId(activeRule, 'openly_revealed')) return true;

  const isDealer = gameState.buryingPlayerId === currentPlayerId;
  const isReformAndOpeningUp = ruleIncludesId(activeRule, 'reform_and_opening_up');
  if (!isReformAndOpeningUp) return isDealer;

  // 首次埋底时庄家照常查看；底牌交给队友后暂时没有“最终底牌”，因此隐藏按钮。
  if (gameState.phase === 'burying') {
    return isDealer && !gameState.secondaryBuryingPlayerId;
  }
  return isDealer
    || gameState.reformAndOpeningUpTeammatePlayerId === currentPlayerId;
}

function isLeadingPlayState(gameState) {
  const noRecordedPlays = Array.isArray(gameState?.currentRoundPlays)
    ? gameState.currentRoundPlays.length === 0
    : gameState?.currentRoundPlays === 0;
  const noPlayedPlayers = Array.isArray(gameState?.playersPlayedThisRound)
    && gameState.playersPlayedThisRound.length === 0;
  return noRecordedPlays || noPlayedPlayers;
}

export function mapOneCountryCardsForCurrentPlayer(cards, gameState) {
  const resolution = gameState?.oneCountryTwoSystems?.resolved;
  const playerIndex = gameState?.currentPlayerIndex;
  if (
    !ruleIncludesId(gameState?.selectedRule, 'one_country_two_systems')
    || !resolution?.hasDistinctTeamSuits
    || !Number.isInteger(playerIndex)
    || playerIndex % 2 === resolution.dealerTeamIndex
  ) {
    return cards;
  }

  return cards.map(card => {
    if (card.suit === resolution.attackerSuit) {
      return { ...card, suit: resolution.dealerSuit, oneCountryOriginalSuit: card.suit };
    }
    if (card.suit === resolution.dealerSuit) {
      return { ...card, suit: resolution.attackerSuit, oneCountryOriginalSuit: card.suit };
    }
    return card;
  });
}

export function getRuleDisabledCardIds({
  gameState,
  handCards = [],
  players = [],
  currentPlayerId = null
} = {}) {
  if (ruleIncludesId(gameState?.selectedRule, 'bush_gate') && isLeadingPlayState(gameState)) {
    const restriction = gameState?.bushGate?.restriction;
    if (
      restriction?.round === gameState.currentRound
      && restriction?.leaderPlayerId === currentPlayerId
    ) {
      const forbiddenIds = new Set(restriction.forbiddenCardIds || []);
      return handCards.filter(card => forbiddenIds.has(card.id)).map(card => card.id);
    }
  }

  if (ruleIncludesId(gameState?.selectedRule, 'rites_collapse') && isLeadingPlayState(gameState)) {
    const roundLeaderId = Number.isInteger(gameState?.roundStartPlayerIndex)
      ? players[gameState.roundStartPlayerIndex]?.id
      : null;
    if (roundLeaderId === currentPlayerId && handCards.some(card => card.rank !== 'A')) {
      return handCards.filter(card => card.rank === 'A').map(card => card.id);
    }
  }

  if (ruleIncludesId(gameState?.selectedRule, 'birds_gone_bow_hidden') && isLeadingPlayState(gameState)) {
    const roundLeaderId = Number.isInteger(gameState?.roundStartPlayerIndex)
      ? players[gameState.roundStartPlayerIndex]?.id
      : null;
    if (currentPlayerId && roundLeaderId && roundLeaderId !== currentPlayerId) return [];
    const exhaustedSuits = new Set(
      gameState?.birdsGoneBowHidden?.exhaustedSuits || []
    );
    const restrictedCards = handCards.filter(card => exhaustedSuits.has(
      getEffectiveSuit(card, gameState?.trumpSuit, gameState?.trumpRank)
    ));
    if (handCards.length - restrictedCards.length >= 1) {
      return restrictedCards.map(card => card.id);
    }
    return [];
  }

  const cooldownType = gameState?.cardCooldown?.type;
  const expectedType = ruleIncludesId(gameState?.selectedRule, 'cooldown_time')
    ? 'rank'
    : ruleIncludesId(gameState?.selectedRule, 'time_cooling')
      ? 'suit'
      : null;
  if (!expectedType || cooldownType !== expectedType || !currentPlayerId) return [];
  const restrictedValues = new Set(
    gameState.cardCooldown?.valuesByPlayerId?.[currentPlayerId] || []
  );
  if (restrictedValues.size === 0) return [];
  const restrictedCards = handCards.filter(card => (
    restrictedValues.has(
      expectedType === 'rank'
        ? card.rank
        : getEffectiveSuit(card, gameState?.trumpSuit, gameState?.trumpRank)
    )
  ));
  const requiredCount = isLeadingPlayState(gameState)
    ? 1
    : (gameState?.leadingPattern?.length || 1);
  return handCards.length - restrictedCards.length >= requiredCount
    ? restrictedCards.map(card => card.id)
    : [];
}

// 兼容已有调用；该函数现在也负责整轮生效的冷却牌。
export const getRuleDisabledLeadCardIds = getRuleDisabledCardIds;

export function getRuleDisabledCardReason(gameState) {
  if (ruleIncludesId(gameState?.selectedRule, 'bush_gate')) {
    return '布什戈门：重新首发不能包含刚刚被收回的任意一张牌';
  }
  if (ruleIncludesId(gameState?.selectedRule, 'birds_gone_bow_hidden')) {
    return '鸟尽弓藏：该花色的分数牌已经全部打出，不能再主动打出该花色';
  }
  if (ruleIncludesId(gameState?.selectedRule, 'cooldown_time')) {
    return '冷却时间：该点数在本轮冷却中';
  }
  if (ruleIncludesId(gameState?.selectedRule, 'time_cooling')) {
    return '时间冷却：该花色在本轮冷却中';
  }
  return '礼崩乐坏：一号位不能主动打出A';
}

function getTurnPlayerIndexAtOffset(currentPlayerIndex, offset, playerCount, roomConfig = {}) {
  const customTurnOrder = roomConfig?.customTurnOrder;
  if (roomConfig?.turnOrder === 'custom' && Array.isArray(customTurnOrder)) {
    const currentPosition = customTurnOrder.indexOf(currentPlayerIndex);
    if (currentPosition >= 0) {
      return customTurnOrder[(currentPosition + offset + playerCount) % playerCount];
    }
  }
  return (currentPlayerIndex + offset + playerCount) % playerCount;
}

export function getActiveSkillAvailability({
  gameState,
  players = [],
  currentPlayerId = null,
  roomConfig = {},
  handCards = []
}) {
  const skill = gameState?.selectedRule?.activeSkill || null;
  if (!skill || !currentPlayerId) {
    return {
      visible: false,
      skill,
      canActivate: false,
      isUsed: false,
      reason: ''
    };
  }

  const usedSkills = gameState?.activeSkillUsesByPlayerId?.[currentPlayerId] || [];
  const skillEffect = skill.effect || (
    skill.id === 'substitute_sacrifice' ? 'free_discard_treated_small' : null
  );
  const skillTiming = skill.timing || (
    skill.id === 'stealing_beams' ? 'any_play' : 'following_play'
  );
  const isUsed = skill.usageLimit !== null && usedSkills.includes(skill.id);
  if (skillEffect === 'two_legal_plays_choose_at_round_end') {
    const isCurrentTurn = isCurrentPlayersTurn(gameState, players, currentPlayerId);
    const playedCount = Array.isArray(gameState?.playersPlayedThisRound)
      ? gameState.playersPlayedThisRound.length
      : Array.isArray(gameState?.currentRoundPlays)
        ? gameState.currentRoundPlays.length
        : Number(gameState?.currentRoundPlays || 0);
    const priorActivatorIds = gameState?.ambiguous?.activePlayerIds || [];
    const isFreeActivation = priorActivatorIds.length > 0;
    const isMiddlePosition = playedCount === 1 || playedCount === 2;
    const canActivate = isCurrentTurn
      && isMiddlePosition
      && (!isUsed || isFreeActivation);
    let reason = '仅本轮二、三号位可以发动';
    if (!isCurrentTurn) reason = '轮到你出牌时才能发动';
    else if (playedCount === 0) reason = '一号位不能发动模棱两可';
    else if (playedCount >= 3) reason = '四号位发动没有意义，不能发动';
    else if (isUsed && !isFreeActivation) reason = '本局已经发动过';
    else if (isFreeActivation) reason = '本轮已有玩家发动，你作为后续发动者无需消耗次数';
    else reason = '先保存方案A，再选择不同且同样合法的方案B并公开展示';
    return {
      visible: true,
      skill,
      canActivate,
      isUsed,
      isFreeActivation,
      reason
    };
  }
  if (skillEffect === 'demote_trumps_and_transform') {
    const isActive = Boolean(
      gameState?.forbiddenMagic?.activePlayerIds?.includes(currentPlayerId)
    );
    if (isActive) {
      return {
        visible: true,
        skill,
        canActivate: false,
        isUsed: true,
        isActive: true,
        reason: '本局已永久生效：你的原有主牌均按副牌处理，可点击“转”改变牌面'
      };
    }
    if (isUsed) {
      return {
        visible: true,
        skill,
        canActivate: false,
        isUsed: true,
        reason: '本局已经发动过'
      };
    }
    const reservation = gameState?.forbiddenMagic?.reservations?.find(
      item => item.playerId === currentPlayerId
    );
    if (reservation) {
      return {
        visible: true,
        skill,
        canActivate: false,
        isUsed: false,
        isReserved: true,
        targetRound: reservation.targetRound,
        reason: `已预备，将在第${reservation.targetRound}轮开始时确认；暂不发动不会消耗机会`
      };
    }
    const hasRoundPlay = Array.isArray(gameState?.currentRoundPlays)
      ? gameState.currentRoundPlays.length > 0
      : Number(gameState?.currentRoundPlays || 0) > 0;
    const hasPlayedPlayer = Array.isArray(gameState?.playersPlayedThisRound)
      && gameState.playersPlayedThisRound.length > 0;
    if (
      gameState?.phase !== 'playing'
      || !Number.isInteger(gameState?.currentRound)
      || gameState.currentRound < 1
    ) {
      return {
        visible: true,
        skill,
        canActivate: false,
        isUsed: false,
        reason: '进入出牌阶段后才能预备'
      };
    }
    const targetRound = hasRoundPlay || hasPlayedPlayer
      ? gameState.currentRound + 1
      : gameState.currentRound;
    return {
      visible: true,
      skill,
      canActivate: true,
      isUsed: false,
      targetRound,
      reason: `随时可以预备；将在第${targetRound}轮开始时逐个确认，确认后本局永久生效`
    };
  }
  if (skillEffect === 'silence_non_leader_for_round') {
    const lureTiger = gameState?.lureTiger || {};
    const playerIndex = players.findIndex(player => player.id === currentPlayerId);
    const teamIndex = playerIndex >= 0 ? playerIndex % 2 : null;
    const isTeamUsed = teamIndex !== null
      && lureTiger.usedTeamIndexes?.includes(teamIndex);
    if (isTeamUsed) {
      return {
        visible: true,
        skill,
        canActivate: false,
        isUsed: true,
        isTeamUsed: true,
        reason: usedSkills.includes(skill.id)
          ? '你已抢先使用本方阵营的唯一一次调虎离山'
          : '队友已抢先使用本方阵营的唯一一次调虎离山'
      };
    }
    const reservation = lureTiger.reservations?.find(
      item => item.playerId === currentPlayerId
    );
    if (reservation) {
      return {
        visible: true,
        skill,
        canActivate: false,
        isUsed: false,
        isReserved: true,
        targetRound: reservation.targetRound,
        reason: `已预备，将在第${reservation.targetRound}轮开始时询问；放弃不会占用本方次数`
      };
    }
    if (
      gameState?.phase !== 'playing'
      || !Number.isInteger(gameState?.currentRound)
      || gameState.currentRound < 1
    ) {
      return {
        visible: true,
        skill,
        canActivate: false,
        isUsed: false,
        reason: '进入出牌阶段后才能预备'
      };
    }
    const hasRoundPlay = Array.isArray(gameState?.currentRoundPlays)
      ? gameState.currentRoundPlays.length > 0
      : Number(gameState?.currentRoundPlays || 0) > 0;
    const hasPlayedPlayer = Array.isArray(gameState?.playersPlayedThisRound)
      && gameState.playersPlayedThisRound.length > 0;
    const targetRound = hasRoundPlay || hasPlayedPlayer
      ? gameState.currentRound + 1
      : gameState.currentRound;
    return {
      visible: true,
      skill,
      canActivate: true,
      isUsed: false,
      targetRound,
      reason: `随时可以预备；将在第${targetRound}轮开始、首张牌打出前按座次确认`
    };
  }
  if (isUsed) {
    return {
      visible: true,
      skill,
      canActivate: false,
      isUsed: true,
      reason: '本局已经发动过'
    };
  }

  if (skillEffect === 'sleep_random_play') {
    const isSleeping = gameState?.dreamKilling?.sleepingPlayerIds?.includes(currentPlayerId);
    if (isSleeping) {
      return {
        visible: true,
        skill,
        canActivate: false,
        isUsed: false,
        reason: '你仍在梦中，轮到你时由系统随机出牌'
      };
    }
    if (gameState?.phase !== 'playing' || handCards.length === 0) {
      return {
        visible: true,
        skill,
        canActivate: false,
        isUsed: false,
        reason: '进入出牌阶段且仍有手牌时才能发动'
      };
    }
    if (handCards.some(card => (
      getEffectiveSuit(card, gameState?.trumpSuit, gameState?.trumpRank) === 'trump'
    ))) {
      return {
        visible: true,
        skill,
        canActivate: false,
        isUsed: false,
        reason: '手牌中仍有主牌，不能发动'
      };
    }
    return {
      visible: true,
      skill,
      canActivate: true,
      isUsed: false,
      reason: '暗置全部手牌，之后由系统完全随机出牌且不检查合法性，命中首家花色或点数后醒来'
    };
  }

  if (skillEffect === 'rewind_completed_round') {
    const reversal = gameState?.timeReversal || {};
    const targetRound = ['holding', 'awaiting_response'].includes(reversal.decisionState)
      ? reversal.windowRound
      : gameState?.currentRound;
    if (reversal.lockedRounds?.includes(targetRound)) {
      return {
        visible: true,
        skill,
        canActivate: false,
        isUsed: false,
        reason: '本轮已经发动过时间倒流'
      };
    }
    const ownReservation = reversal.reservations?.find(
      reservation => reservation.playerId === currentPlayerId
    );
    if (ownReservation) {
      return {
        visible: true,
        skill,
        canActivate: false,
        isUsed: false,
        reason: `你已预备第${ownReservation.round}轮时间倒流`
      };
    }
    if (reversal.decisionState === 'awaiting_response') {
      return {
        visible: true,
        skill,
        canActivate: false,
        isUsed: false,
        reason: '本轮预备窗口已经结束'
      };
    }
    if (gameState?.phase !== 'playing' || !Number.isInteger(targetRound) || targetRound < 1) {
      return {
        visible: true,
        skill,
        canActivate: false,
        isUsed: false,
        reason: '进入出牌阶段后才能预备'
      };
    }
    return {
      visible: true,
      skill,
      canActivate: true,
      isUsed: false,
      reason: '预备回溯本轮；轮末停留后再确认是否发动'
    };
  }

  if (!isCurrentPlayersTurn(gameState, players, currentPlayerId)) {
    return {
      visible: true,
      skill,
      canActivate: false,
      isUsed: false,
      reason: '还没有轮到你出牌'
    };
  }

  const isFollowing = Boolean(gameState?.leadingPattern) && !(
    gameState?.currentRoundPlays === 0 ||
    (Array.isArray(gameState?.playersPlayedThisRound) && gameState.playersPlayedThisRound.length === 0)
  );
  if (skillTiming === 'following_play' && !isFollowing) {
    return {
      visible: true,
      skill,
      canActivate: false,
      isUsed: false,
      reason: '只能在跟牌时发动'
    };
  }
  if (skillTiming === 'leading_play' && isFollowing) {
    return {
      visible: true,
      skill,
      canActivate: false,
      isUsed: false,
      reason: '只能在首发时发动'
    };
  }

  if (skillEffect === 'ignore_odd_led_side_suit') {
    const leadingSuit = gameState?.leadingPattern?.suit;
    if (!isFollowing || !leadingSuit) {
      return {
        visible: true,
        skill,
        canActivate: false,
        isUsed: false,
        reason: '只能在跟牌时发动'
      };
    }
    if (leadingSuit === 'trump') {
      return {
        visible: true,
        skill,
        canActivate: false,
        isUsed: false,
        reason: '当前要求跟出主牌，虚虚实实只能虚置副花色'
      };
    }
    const virtualizedCards = handCards.filter(card => (
      getEffectiveSuit(card, gameState?.trumpSuit, gameState?.trumpRank) === leadingSuit
    ));
    if (virtualizedCards.length === 0 || virtualizedCards.length % 2 === 0) {
      return {
        visible: true,
        skill,
        canActivate: false,
        isUsed: false,
        ignoredSuit: leadingSuit,
        virtualizedCardIds: [],
        reason: virtualizedCards.length === 0
          ? '手中没有当前要求跟出的副花色'
          : `当前副花色剩余${virtualizedCards.length}张，不是奇数张`
      };
    }
    const requiredCount = gameState?.leadingPattern?.length || 1;
    if (handCards.length - virtualizedCards.length < requiredCount) {
      return {
        visible: true,
        skill,
        canActivate: false,
        isUsed: false,
        ignoredSuit: leadingSuit,
        virtualizedCardIds: [],
        reason: `虚置后其余手牌不足${requiredCount}张，无法完成本次出牌`
      };
    }
    return {
      visible: true,
      skill,
      canActivate: true,
      isUsed: false,
      ignoredSuit: leadingSuit,
      virtualizedCardIds: virtualizedCards.map(card => card.id),
      reason: `虚置${virtualizedCards.length}张当前副花色牌，本次视为该花色缺门`
    };
  }

  if (skillTiming === 'third_position_before_play') {
    const playedPlayerIndexes = Array.isArray(gameState?.playersPlayedThisRound)
      ? gameState.playersPlayedThisRound
      : [];
    const secondPlayerIndex = playedPlayerIndexes.at(-1);
    const expectedThirdPlayerIndex = Number.isInteger(secondPlayerIndex)
      ? getTurnPlayerIndexAtOffset(secondPlayerIndex, 1, players.length, roomConfig)
      : null;
    if (
      playedPlayerIndexes.length !== 2
      || gameState.currentPlayerIndex !== expectedThirdPlayerIndex
    ) {
      return {
        visible: true,
        skill,
        canActivate: false,
        isUsed: false,
        reason: '只能在作为本轮三号位出牌前发动'
      };
    }
  }

  if (skillTiming === 'first_position_before_play') {
    const playedPlayerIndexes = Array.isArray(gameState?.playersPlayedThisRound)
      ? gameState.playersPlayedThisRound
      : [];
    if (
      !isLeadingPlayState(gameState)
      || playedPlayerIndexes.length !== 0
      || gameState.currentPlayerIndex !== gameState.roundStartPlayerIndex
    ) {
      return {
        visible: true,
        skill,
        canActivate: false,
        isUsed: false,
        reason: '只能在作为本轮一号位出牌前发动'
      };
    }
  }

  if (skillTiming === 'second_position_after_lead') {
    const playedPlayerIndexes = Array.isArray(gameState?.playersPlayedThisRound)
      ? gameState.playersPlayedThisRound
      : [];
    const leaderIndex = playedPlayerIndexes[0];
    const expectedSecondPlayerIndex = Number.isInteger(leaderIndex)
      ? getTurnPlayerIndexAtOffset(leaderIndex, 1, players.length, roomConfig)
      : null;
    const currentRoundPlayCount = Array.isArray(gameState?.currentRoundPlays)
      ? gameState.currentRoundPlays.length
      : Number(gameState?.currentRoundPlays || 0);
    if (
      playedPlayerIndexes.length !== 1
      || currentRoundPlayCount !== 1
      || gameState.currentPlayerIndex !== expectedSecondPlayerIndex
    ) {
      return {
        visible: true,
        skill,
        canActivate: false,
        isUsed: false,
        reason: '只能由本轮二号位在一号位出牌后、自己出牌前发动'
      };
    }
    const leader = players[leaderIndex];
    if (!leader || Number(leader.cardsCount) < 1) {
      return {
        visible: true,
        skill,
        canActivate: false,
        isUsed: false,
        reason: '一号位已经没有其他手牌，无法要求其改用别的牌重新首发'
      };
    }
  }

  if (skillEffect === 'transform_matching_card') {
    if (gameState?.divineWeapon?.usedThisRound) {
      return {
        visible: true,
        skill,
        canActivate: false,
        isUsed: false,
        reason: '本轮已有玩家发动神兵天降'
      };
    }
    if ((gameState?.divineWeapon?.cards || []).length !== 2) {
      return {
        visible: true,
        skill,
        canActivate: false,
        isUsed: false,
        reason: '本轮神兵牌尚未就位'
      };
    }
  }

  return {
    visible: true,
    skill,
    canActivate: true,
    isUsed: false,
    reason: skillEffect === 'yield_turn_to_next_player'
      ? '令下家先出牌，自己改为本轮最后出牌'
      : skillEffect === 'temporarily_replace_trump'
        ? '先选择革花色或革点数，再声明目标；替换原主并持续本轮与下一轮'
      : skillEffect === 'declare_target_card'
        ? '指定一名玩家和一种实体牌面；其本轮打出一张或多张都只扣5分'
      : skillEffect === 'temporary_teammate_card_transfer'
        ? '向队友请求0至2张牌，或交给队友1至2张牌；轮末由收牌者等量返还'
      : skillEffect === 'compare_and_exchange'
        ? '点击另一名玩家的玩家框，与其各选一张牌拼点并交换'
      : skillEffect === 'swap_two_plays_at_round_end'
        ? '暗选两名其他玩家，仅在本轮结算时交换二者的出牌结果'
      : skillEffect === 'force_leader_replay'
        ? '令一号位收回本次首发；被收回的每张牌均不能用于紧接着的重新首发'
      : skillEffect === 'concealed_until_round_end'
      ? '本次出牌暗置，到本轮结束时同时公开并正常结算'
      : skillEffect === 'joker_wildcards'
        ? '点击王牌明确选择目标花色和点数，再自行选牌出牌'
        : skillEffect === 'belt_and_road_lead'
          ? '首发同一有效花色的两张非对子单牌'
        : skillEffect === 'transform_matching_card'
          ? '先选择牌桌中央的一张神兵牌，再选择一张同花色或同点数手牌转化'
        : skillEffect === 'adjacent_rank_transform'
          ? '可依次点击多张普通牌选择相邻目标点数，再自行选牌出牌'
        : '发动后可任意垫牌，本次出牌始终视为小'
  };
}

export function validatePlaySelection({
  selectedCardIds = [],
  handCards = [],
  gameState,
  trumpSuit = null,
  trumpRank = null,
  activeSkillId = null,
  currentPlayerId = null,
  jokerSubstitutions = [],
  clusterAnalysisSubstitutions = [],
  forbiddenMagicSubstitutions = [],
  divineWeaponCardId = null,
  divineWeaponSourceCardId = null
}) {
  if (selectedCardIds.length === 0) {
    return { valid: false, message: '请选择要出的牌', pattern: null };
  }

  const selectedIdSet = new Set(selectedCardIds);
  const selectedCards = handCards.filter(card => selectedIdSet.has(card.id));
  if (selectedCards.length !== selectedIdSet.size) {
    return { valid: false, message: '选中的牌已不在手牌中', pattern: null };
  }

  const isLeading = isLeadingPlayState(gameState);
  const activeRuleContext = gameState?.selectedRule
    ? {
        ...gameState.selectedRule,
        currentRound: gameState.currentRound,
        inferiorSuit: gameState?.threeSixNine?.inferiorSuit || null,
        antinomySplitFaceKeys: Object.values(
          gameState?.antinomy?.declarationsByPlayerId || {}
        )
          .filter(declaration => declaration?.effective)
          .map(declaration => declaration.faceKey)
      }
    : null;

  if (
    isLeading
    && ruleIncludesId(gameState?.selectedRule, 'rites_collapse')
    && selectedCards.some(card => card.rank === 'A')
    && handCards.some(card => card.rank !== 'A')
  ) {
    return {
      valid: false,
      message: '礼崩乐坏：一号位不能主动打出A',
      pattern: null
    };
  }

  const ruleDisabledCardIds = new Set(getRuleDisabledCardIds({
    gameState,
    handCards,
    currentPlayerId
  }));
  if (selectedCards.some(card => ruleDisabledCardIds.has(card.id))) {
    return {
      valid: false,
      message: getRuleDisabledCardReason(gameState),
      pattern: null
    };
  }
  const availableHandCards = handCards.filter(card => !ruleDisabledCardIds.has(card.id));
  const followingObligationCards = ruleIncludesId(gameState?.selectedRule, 'wooden_ox_flowing_horse')
    ? availableHandCards.filter(card => !card.isWoodenOxCard)
    : availableHandCards;

  if (ruleIncludesId(gameState?.selectedRule, 'one_country_two_systems')) {
    const effectiveSelectedCards = mapOneCountryCardsForCurrentPlayer(
      selectedCards,
      gameState
    );
    const effectiveHandCards = mapOneCountryCardsForCurrentPlayer(
      availableHandCards,
      gameState
    );
    return isLeading || !gameState?.leadingPattern
      ? validateLeadingPlay(
          effectiveSelectedCards,
          trumpSuit,
          trumpRank,
          activeRuleContext
        )
      : validateFollowingPlay(
          effectiveSelectedCards,
          effectiveHandCards,
          gameState.leadingPattern,
          trumpSuit,
          trumpRank,
          activeRuleContext
        );
  }

  if (
    ruleIncludesId(gameState?.selectedRule, 'forbidden_magic')
    && gameState?.forbiddenMagic?.activePlayerIds?.includes(currentPlayerId)
  ) {
    return resolveForbiddenMagicPlay({
      selectedCards,
      handCards: availableHandCards,
      substitutions: forbiddenMagicSubstitutions,
      leadingPattern: isLeading ? null : gameState.leadingPattern,
      trumpSuit,
      trumpRank,
      activeRule: activeRuleContext
    });
  }

  const afterglowActive = Boolean(
    ruleIncludesId(gameState?.selectedRule, 'afterglow')
    && trumpSuit !== 'no_trump'
    && gameState?.afterglow?.activePlayerIds?.includes(currentPlayerId)
  );
  const afterglowHeldTrumps = afterglowActive
    ? availableHandCards.filter(card => (
        getEffectiveSuit(card, trumpSuit, trumpRank) === 'trump'
      ))
    : [];
  if (afterglowHeldTrumps.length > 0) {
    if (!selectedCards.every(card => (
      getEffectiveSuit(card, trumpSuit, trumpRank) === 'trump'
    ))) {
      return {
        valid: false,
        message: '回光返照：只要手中仍有主牌，本次出牌就只能由主牌组成，不能混入副牌',
        pattern: null
      };
    }
    if (isLeading || !gameState?.leadingPattern) {
      return validateLeadingPlay(
        selectedCards,
        trumpSuit,
        trumpRank,
        activeRuleContext
      );
    }
    if (selectedCards.length !== gameState.leadingPattern.length) {
      return {
        valid: false,
        message: `回光返照：本轮必须打出 ${gameState.leadingPattern.length} 张牌`,
        pattern: null
      };
    }
    return {
      valid: true,
      message: '回光返照：本次只出主牌并无视通常的跟牌要求，牌面+1',
      pattern: null,
      afterglowActive: true
    };
  }

  if (activeSkillId) {
    const configuredSkill = gameState?.selectedRule?.activeSkill;
    if (!configuredSkill || configuredSkill.id !== activeSkillId) {
      return { valid: false, message: '当前规则没有这个主动技能', pattern: null };
    }
    const configuredEffect = configuredSkill.effect || (
      configuredSkill.id === 'substitute_sacrifice' ? 'free_discard_treated_small' : null
    );
    const configuredTiming = configuredSkill.timing || (
      configuredSkill.id === 'stealing_beams' ? 'any_play' : 'following_play'
    );
    if (configuredTiming === 'following_play' && (isLeading || !gameState?.leadingPattern)) {
      return { valid: false, message: `${configuredSkill.name}只能在跟牌时发动`, pattern: null };
    }
    if (configuredTiming === 'leading_play' && !isLeading) {
      return { valid: false, message: `${configuredSkill.name}只能在首发时发动`, pattern: null };
    }
    if (!isLeading && selectedCards.length !== gameState.leadingPattern.length) {
      return {
        valid: false,
        message: `本轮需要出 ${gameState.leadingPattern.length} 张牌`,
        pattern: null
      };
    }
    if (configuredEffect === 'free_discard_treated_small') {
      return {
        valid: true,
        message: `${configuredSkill.name}：本次垫牌始终视为小`,
        pattern: null,
        activeSkill: configuredSkill
      };
    }
    if (configuredEffect === 'ignore_odd_led_side_suit') {
      const leadingSuit = gameState?.leadingPattern?.suit;
      if (isLeading || !leadingSuit) {
        return { valid: false, message: '虚虚实实只能在跟牌时发动', pattern: null };
      }
      if (leadingSuit === 'trump') {
        return { valid: false, message: '虚虚实实只能虚置当前要求跟出的副花色', pattern: null };
      }
      const virtualizedCards = availableHandCards.filter(card => (
        getEffectiveSuit(card, trumpSuit, trumpRank) === leadingSuit
      ));
      if (virtualizedCards.length === 0 || virtualizedCards.length % 2 === 0) {
        return {
          valid: false,
          message: '虚虚实实要求对应副花色恰好剩余奇数张',
          pattern: null
        };
      }
      if (selectedCards.some(card => (
        getEffectiveSuit(card, trumpSuit, trumpRank) === leadingSuit
      ))) {
        return {
          valid: false,
          message: '发动虚虚实实时不能打出被虚置的副花色牌',
          pattern: null
        };
      }
      const requiredCount = gameState.leadingPattern.length || 1;
      const effectiveHandCards = availableHandCards.filter(card => (
        getEffectiveSuit(card, trumpSuit, trumpRank) !== leadingSuit
      ));
      if (effectiveHandCards.length < requiredCount) {
        return {
          valid: false,
          message: `虚置后其余手牌不足${requiredCount}张，不能发动虚虚实实`,
          pattern: null
        };
      }
      const validation = validateFollowingPlay(
        selectedCards,
        effectiveHandCards,
        gameState.leadingPattern,
        trumpSuit,
        trumpRank,
        activeRuleContext
      );
      return validation.valid
        ? { ...validation, activeSkill: configuredSkill, ignoredSuit: leadingSuit }
        : validation;
    }
    if (configuredEffect === 'concealed_until_round_end') {
      const validation = validateFollowingPlay(
        selectedCards,
        handCards,
        gameState.leadingPattern,
        trumpSuit,
        trumpRank,
        activeRuleContext
      );
      return validation.valid
        ? { ...validation, activeSkill: configuredSkill }
        : validation;
    }
    if (configuredEffect === 'joker_wildcards') {
      return resolveJokerSubstitutionPlay({
        selectedCards,
        handCards,
        substitutions: jokerSubstitutions,
        leadingPattern: isLeading ? null : gameState.leadingPattern,
        trumpSuit,
        trumpRank,
        activeRule: activeRuleContext
      });
    }
    if (configuredEffect === 'adjacent_rank_transform') {
      return resolveClusterAnalysisPlay({
        selectedCards,
        handCards: availableHandCards,
        substitutions: clusterAnalysisSubstitutions,
        leadingPattern: isLeading ? null : gameState.leadingPattern,
        trumpSuit,
        trumpRank,
        activeRule: activeRuleContext
      });
    }
    if (configuredEffect === 'belt_and_road_lead') {
      const beltAndRoadRuleContext = {
        ...activeRuleContext,
        beltAndRoadSkillActive: true
      };
      const validation = validateLeadingPlay(
        selectedCards,
        trumpSuit,
        trumpRank,
        beltAndRoadRuleContext
      );
      if (!validation.valid) return validation;
      if (validation.pattern?.type !== PatternTypes.BELT_AND_ROAD) {
        return {
          valid: false,
          message: '一带一路必须首发同一有效花色的两张非对子单牌',
          pattern: validation.pattern
        };
      }
      return { ...validation, activeSkill: configuredSkill };
    }
    if (configuredEffect === 'transform_matching_card') {
      if (gameState?.divineWeapon?.usedThisRound) {
        return { valid: false, message: '本轮已有玩家发动神兵天降', pattern: null };
      }
      const targetCard = gameState?.divineWeapon?.cards?.find(
        card => card.id === divineWeaponCardId
      );
      if (!targetCard) {
        return { valid: false, message: '请先选择牌桌中央的一张神兵牌', pattern: null };
      }
      const sourceCard = selectedCards.find(card => card.id === divineWeaponSourceCardId);
      if (!sourceCard) {
        return { valid: false, message: '请选中一张手牌作为神兵转化牌', pattern: null };
      }
      if (sourceCard.suit !== targetCard.suit && sourceCard.rank !== targetCard.rank) {
        return { valid: false, message: '转化牌必须与神兵牌花色或点数相同', pattern: null };
      }
      const transformCard = card => card.id === sourceCard.id
        ? {
            ...card,
            suit: targetCard.suit,
            rank: targetCard.rank,
            originalSuit: card.suit,
            originalRank: card.rank,
            isDivineWeaponTransformed: true,
            divineWeaponCardId: targetCard.id
          }
        : card;
      const effectiveSelectedCards = selectedCards.map(transformCard);
      // 跟牌义务以发动前的实体手牌为准；转化牌只作为本次实际打出的牌面参与校验。
      const effectiveHandCards = availableHandCards;
      const validation = isLeading || !gameState?.leadingPattern
        ? validateLeadingPlay(
            effectiveSelectedCards,
            trumpSuit,
            trumpRank,
            activeRuleContext
          )
        : validateFollowingPlay(
            effectiveSelectedCards,
            effectiveHandCards,
            gameState.leadingPattern,
            trumpSuit,
            trumpRank,
            activeRuleContext
          );
      return validation.valid
        ? { ...validation, activeSkill: configuredSkill }
        : validation;
    }
    if (configuredEffect === 'two_legal_plays_choose_at_round_end') {
      const validation = validateFollowingPlay(
        selectedCards,
        followingObligationCards,
        gameState.leadingPattern,
        trumpSuit,
        trumpRank,
        activeRuleContext
      );
      return validation.valid
        ? { ...validation, activeSkill: configuredSkill }
        : validation;
    }
  }

  if (isLeading || !gameState?.leadingPattern) {
    return validateLeadingPlay(
      selectedCards,
      trumpSuit,
      trumpRank,
      activeRuleContext
    );
  }

  return validateFollowingPlay(
    selectedCards,
    followingObligationCards,
    gameState.leadingPattern,
    trumpSuit,
    trumpRank,
    activeRuleContext
  );
}
