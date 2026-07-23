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
