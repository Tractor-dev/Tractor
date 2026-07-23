import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getDisplayedDefenseAsOffense,
  getStriveUpstreamActionOrder,
  mergeLivePlayerCardCounts,
  shouldShowGameBoard
} from '../src/utils/gameViewUtils.js';

test('以守为攻的玩家标签与轮末停留牌桌属于同一轮', () => {
  const gameState = {
    currentRound: 3,
    defenseAsOffense: { round: 3, playerId: 'player-1', delta: 2 },
    defenseAsOffenseLastRound: { round: 2, playerId: 'player-0', delta: 1 }
  };

  assert.deepEqual(getDisplayedDefenseAsOffense(gameState, 2), {
    round: 2,
    playerId: 'player-0',
    delta: 1
  });
  assert.deepEqual(getDisplayedDefenseAsOffense(gameState, 3), {
    round: 3,
    playerId: 'player-1',
    delta: 2
  });
  assert.equal(getDisplayedDefenseAsOffense(gameState, 1), null);
});

test('力争上游按服务端座位队列标记每名玩家的行动次序', () => {
  const players = [0, 1, 2, 3].map(index => ({ id: `player-${index}` }));
  const gameState = {
    selectedRule: { id: 'strive_upstream' },
    striveUpstreamPlayOrder: [2, 0, 3, 1]
  };

  assert.deepEqual(
    players.map(player => getStriveUpstreamActionOrder(players, gameState, player.id)),
    [2, 4, 1, 3]
  );
  assert.equal(
    getStriveUpstreamActionOrder(players, { ...gameState, selectedRule: { id: 'normal_game' } }, 'player-0'),
    null
  );
});

test('下一局等待选规则时继续显示牌桌', () => {
  assert.equal(shouldShowGameBoard({
    phase: 'waiting',
    isWaitingForReady: false,
    isRuleSelectionPending: true
  }), true);
});

test('尚未开始游戏的普通等待状态显示房间界面', () => {
  assert.equal(shouldShowGameBoard({
    phase: 'waiting',
    isWaitingForReady: false,
    isRuleSelectionPending: false
  }), false);
});

test('发牌阶段用逐张进度更新各家手牌数，离开发牌阶段后不沿用旧计数', () => {
  const players = [
    { id: 'player-1', cardsCount: 0 },
    { id: 'player-2', cardsCount: 0 }
  ];
  const liveCounts = { 'player-1': 3, 'player-2': 2 };

  assert.deepEqual(
    mergeLivePlayerCardCounts(players, liveCounts, true).map(player => player.cardsCount),
    [3, 2]
  );
  assert.equal(mergeLivePlayerCardCounts(players, liveCounts, false), players);
});
