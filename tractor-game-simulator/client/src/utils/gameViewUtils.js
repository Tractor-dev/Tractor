import { ruleIncludesId } from './ruleCatalog.js';

/**
 * WAITING 也可能是首局准备或两局之间的规则选择阶段；这两种情况都应留在牌桌。
 */
export function shouldShowGameBoard(gameState) {
  const phase = gameState?.phase || 'waiting';
  return phase !== 'waiting' ||
    Boolean(gameState?.isWaitingForReady) ||
    Boolean(gameState?.isRuleSelectionPending);
}

/**
 * 规则候选属于全房间公开信息，但确认权只属于服务端指定的选择者。
 */
export function getRuleSelectionAccess(gameState, playerId) {
  const canView = Boolean(gameState?.isRuleSelectionPending);
  return {
    canView,
    canChoose: canView && gameState?.ruleChooserPlayerId === playerId
  };
}

/**
 * “算无遗策”的明手牌已是全房间公开信息；明手本人也应以这份服务端快照为准，
 * 不能长期依赖发牌时建立的本地副本。
 */
export function getCanonicalOpenHandCards(gameState, playerId) {
  const openHand = gameState?.openHand;
  if (
    !playerId
    || openHand?.playerId !== playerId
    || !Array.isArray(openHand?.cards)
  ) {
    return null;
  }
  return openHand.cards;
}

/**
 * 普通玩家发起甩牌时会先乐观移除整组牌，失败后需要加回未被强制打出的部分。
 * “算无遗策”代打没有移除明手本人的本地手牌，因此绝不能执行同一恢复动作。
 */
export function getThrowFailedCardsToRestore({
  playerId,
  currentPlayerId,
  openHandPlayerId = null,
  isProxy = false,
  attemptedCardObjects,
  forcedCards
}) {
  if (
    playerId !== currentPlayerId
    || isProxy
    || playerId === openHandPlayerId
    || !Array.isArray(attemptedCardObjects)
  ) {
    return [];
  }

  const forcedIds = new Set((forcedCards || []).map(card => card.id));
  return attemptedCardObjects.filter(card => !forcedIds.has(card.id));
}

export const THROW_FAILED_PREVIEW_DURATION_MS = 1000;

/**
 * 甩牌失败时先把完整尝试牌面留在对应玩家的出牌区，实际被强制出的
 * 最小组件已经由 cards_played 事件在底层更新；预览结束后再露出它。
 */
export function getThrowFailedPreview(playerName, attemptedCardObjects, previewKey) {
  if (!Array.isArray(attemptedCardObjects) || attemptedCardObjects.length === 0) {
    return null;
  }

  return {
    previewKey,
    playerName,
    cards: attemptedCardObjects,
    cardsCount: attemptedCardObjects.length,
    throwFailedAttempt: true
  };
}

/**
 * “毁堤淹田”在未发动时只需要一个紧凑提示；进入决策或灾期后再展示分数信息。
 * 将显示语义集中在这里，避免状态卡因通用双栏布局产生大片空白。
 */
export function getDestroyDykeDisplayState(destroyDyke) {
  if (!destroyDyke) return null;

  if (destroyDyke.pending) {
    return {
      tone: 'decision',
      badge: '决策中',
      value: `${destroyDyke.pending.roundPoints ?? 0}分`,
      detail: '本轮计分暂停',
      progress: null
    };
  }

  if (destroyDyke.disaster) {
    const attackerPoints = Number(destroyDyke.disaster.disasterAttackerPoints) || 0;
    return {
      tone: 'disaster',
      badge: `灾期 ${destroyDyke.disaster.roundsElapsed ?? 0}/3`,
      value: `${attackerPoints}/20`,
      detail: `已封存 ${destroyDyke.disaster.voidedPoints ?? 0} 分`,
      progress: Math.min(100, Math.max(0, attackerPoints * 5))
    };
  }

  if (destroyDyke.lastResult?.status === 'incident') {
    return {
      tone: 'incident',
      badge: '已事发',
      value: `+${destroyDyke.lastResult.scoreDelta ?? 0}`,
      detail: '封存分返还并追加20分',
      progress: 100
    };
  }

  if (destroyDyke.lastResult?.status === 'expired') {
    return {
      tone: 'expired',
      badge: '灾期结束',
      value: '封存生效',
      detail: `${destroyDyke.lastResult.voidedPoints ?? 0} 分永久作废`,
      progress: 0
    };
  }

  if (destroyDyke.used) {
    return {
      tone: 'spent',
      badge: '已发动',
      value: null,
      detail: '本局次数已用尽',
      progress: null
    };
  }

  return {
    tone: 'idle',
    badge: '待命',
    value: null,
    detail: '闲家赢墩后可发动 · 本局一次',
    progress: null
  };
}

/**
 * 发牌进度是逐张推送的，而完整房间快照不会逐张更新。仅在发牌阶段用实时计数
 * 覆盖快照，离开发牌阶段后立刻恢复以房间状态为准，避免旧计数影响出牌阶段。
 */
export function mergeLivePlayerCardCounts(players, liveCounts, isDrawing) {
  if (!Array.isArray(players)) return [];
  if (!isDrawing) return players;

  return players.map(player => ({
    ...player,
    cardsCount: liveCounts?.[player.id] ?? player.cardsCount
  }));
}

/**
 * 私密换牌动画结束时一次性合并手牌。先删去自己交出的牌，再加入收到的牌，
 * 同时按牌 ID 去重，避免逐张 addCard 导致手牌在动画落点处连续跳动、重排。
 */
export function mergeTransferredHandCards(currentCards, sentCardIds, receivedCards) {
  const sentIds = new Set(Array.isArray(sentCardIds) ? sentCardIds : []);
  const incomingCards = Array.isArray(receivedCards) ? receivedCards : [];
  const incomingIds = new Set(incomingCards.map(card => card?.id).filter(Boolean));
  const retainedCards = (Array.isArray(currentCards) ? currentCards : []).filter(card => (
    card?.id && !sentIds.has(card.id) && !incomingIds.has(card.id)
  ));
  return [...retainedCards, ...incomingCards];
}

/** 把服务端公布的座位索引队列转换为某名玩家的行动次序。 */
export function getStriveUpstreamActionOrder(players, gameState, playerId) {
  if (!ruleIncludesId(gameState?.selectedRule, 'strive_upstream')) return null;
  if (!Array.isArray(players) || !Array.isArray(gameState?.striveUpstreamPlayOrder)) return null;

  const playerIndex = players.findIndex(player => player.id === playerId);
  if (playerIndex < 0) return null;
  const actionIndex = gameState.striveUpstreamPlayOrder.indexOf(playerIndex);
  return actionIndex >= 0 ? actionIndex + 1 : null;
}

/** 轮末停留时，玩家标签必须与仍在桌面上的那一轮牌面保持一致。 */
export function getDisplayedDefenseAsOffense(gameState, displayRoundNumber = null) {
  const displayedRound = Number(displayRoundNumber ?? gameState?.currentRound);
  if (!Number.isInteger(displayedRound)) return null;
  return [gameState?.defenseAsOffense, gameState?.defenseAsOffenseLastRound]
    .find(status => status?.round === displayedRound) || null;
}

export const RECORD_ON_FILE_RANKS = Object.freeze([
  '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'
]);

const RECORD_ON_FILE_SUITS = Object.freeze([
  { id: 'spades', label: '♠' },
  { id: 'hearts', label: '♥' },
  { id: 'clubs', label: '♣' },
  { id: 'diamonds', label: '♦' }
]);

/**
 * 只为牌桌当前展示的轮次生成记牌器；轮末停留时仍显示刚结束的生效轮，
 * 清桌切到下一轮后再严格按 activeRound 决定是否继续。
 */
export function getRecordOnFileTrackerView(recordOnFile, displayRoundNumber) {
  const displayedRound = Number(displayRoundNumber);
  if (!recordOnFile || !Number.isInteger(displayedRound)) return null;
  if (
    recordOnFile.activeRound !== displayedRound
    && recordOnFile.lastActiveRound !== displayedRound
  ) {
    return null;
  }

  const counts = recordOnFile.counts || {};
  return {
    round: displayedRound,
    playedCardCount: Number(recordOnFile.playedCardCount) || 0,
    ranks: RECORD_ON_FILE_RANKS,
    suits: RECORD_ON_FILE_SUITS.map(suit => ({
      ...suit,
      counts: RECORD_ON_FILE_RANKS.map(rank => Number(counts[suit.id]?.[rank]) || 0)
    })),
    jokers: [
      Number(counts.joker?.small_joker) || 0,
      Number(counts.joker?.big_joker) || 0
    ]
  };
}
