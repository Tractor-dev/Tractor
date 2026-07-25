import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getCanonicalOpenHandCards,
  getDestroyDykeDisplayState,
  getDisplayedDefenseAsOffense,
  getPendingPoliticalReviewDecision,
  getRecordOnFileTrackerView,
  getRuleSelectionAccess,
  getStriveUpstreamActionOrder,
  getThrowFailedPreview,
  getThrowFailedCardsToRestore,
  mergeLivePlayerCardCounts,
  mergeTransferredHandCards,
  shouldShowGameBoard,
  THROW_FAILED_PREVIEW_DURATION_MS
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

test('规则候选对所有玩家可见，但只有指定玩家可以选择', () => {
  const gameState = {
    isRuleSelectionPending: true,
    ruleChooserPlayerId: 'player-2'
  };

  assert.deepEqual(getRuleSelectionAccess(gameState, 'player-1'), {
    canView: true,
    canChoose: false
  });
  assert.deepEqual(getRuleSelectionAccess(gameState, 'player-2'), {
    canView: true,
    canChoose: true
  });
  assert.deepEqual(getRuleSelectionAccess({
    ...gameState,
    isRuleSelectionPending: false
  }, 'player-2'), {
    canView: false,
    canChoose: false
  });
});

test('算无遗策的明手本人使用服务端公开手牌作为权威牌面', () => {
  const cards = [
    { id: 'hearts-K-0', suit: 'hearts', rank: 'K' },
    { id: 'hearts-J-0', suit: 'hearts', rank: 'J' }
  ];
  const gameState = {
    openHand: {
      playerId: 'open-hand',
      cards
    }
  };

  assert.equal(getCanonicalOpenHandCards(gameState, 'open-hand'), cards);
  assert.equal(getCanonicalOpenHandCards(gameState, 'dealer'), null);
  assert.equal(getCanonicalOpenHandCards({ openHand: null }, 'open-hand'), null);
});

test('政治审查的审查者断线重连后可从房间快照恢复待决询问', () => {
  const pending = {
    id: 'political-review-3-1',
    round: 3,
    reviewerPlayerId: 'reviewer',
    reviewerPlayerName: '审查者',
    teammatePlayerId: 'teammate',
    teammatePlayerName: '队友',
    cards: [
      { id: 'spades-Q-0', suit: 'spades', rank: 'Q' },
      { id: 'spades-K-0', suit: 'spades', rank: 'K' }
    ]
  };
  const gameState = {
    politicalReview: { pending }
  };

  assert.equal(
    getPendingPoliticalReviewDecision(gameState, 'reviewer'),
    pending
  );
  assert.equal(
    getPendingPoliticalReviewDecision(gameState, 'teammate'),
    null
  );
  assert.equal(
    getPendingPoliticalReviewDecision({ politicalReview: { pending: null } }, 'reviewer'),
    null
  );
});

test('算无遗策代打甩牌失败时不向明手本地重复恢复卡牌', () => {
  const attemptedCardObjects = [
    { id: 'hearts-K-0', suit: 'hearts', rank: 'K' },
    { id: 'hearts-J-0', suit: 'hearts', rank: 'J' }
  ];
  const forcedCards = [attemptedCardObjects[1]];

  assert.deepEqual(getThrowFailedCardsToRestore({
    playerId: 'ordinary-player',
    currentPlayerId: 'ordinary-player',
    attemptedCardObjects,
    forcedCards
  }), [attemptedCardObjects[0]]);

  assert.deepEqual(getThrowFailedCardsToRestore({
    playerId: 'open-hand',
    currentPlayerId: 'open-hand',
    openHandPlayerId: 'open-hand',
    isProxy: true,
    attemptedCardObjects,
    forcedCards
  }), []);

  // 即使连接到旧服务端、事件里尚未携带 isProxy，也能通过明手身份阻止重复恢复。
  assert.deepEqual(getThrowFailedCardsToRestore({
    playerId: 'open-hand',
    currentPlayerId: 'open-hand',
    openHandPlayerId: 'open-hand',
    attemptedCardObjects,
    forcedCards
  }), []);
});

test('甩牌失败完整牌面保留一秒，再露出服务端强制打出的最小组件', () => {
  const attemptedCardObjects = [
    { id: 'hearts-A-0', suit: 'hearts', rank: 'A' },
    { id: 'hearts-K-0', suit: 'hearts', rank: 'K' },
    { id: 'hearts-9-0', suit: 'hearts', rank: '9' }
  ];

  assert.equal(THROW_FAILED_PREVIEW_DURATION_MS, 1000);
  assert.deepEqual(
    getThrowFailedPreview('玩家1', attemptedCardObjects, 'preview-1'),
    {
      previewKey: 'preview-1',
      playerName: '玩家1',
      cards: attemptedCardObjects,
      cardsCount: 3,
      throwFailedAttempt: true
    }
  );
  assert.equal(getThrowFailedPreview('玩家1', [], 'preview-2'), null);
});

test('毁堤淹田未发动时使用紧凑待命状态，不渲染突兀的大号数值', () => {
  assert.deepEqual(getDestroyDykeDisplayState({
    used: false,
    pending: null,
    disaster: null,
    lastResult: null
  }), {
    tone: 'idle',
    badge: '待命',
    value: null,
    detail: '闲家赢墩后可发动 · 本局一次',
    progress: null
  });
});

test('毁堤淹田灾期状态给出轮次、封存分和安全范围内的进度', () => {
  assert.deepEqual(getDestroyDykeDisplayState({
    used: true,
    disaster: {
      roundsElapsed: 2,
      disasterAttackerPoints: 15,
      voidedPoints: 20
    }
  }), {
    tone: 'disaster',
    badge: '灾期 2/3',
    value: '15/20',
    detail: '已封存 20 分',
    progress: 75
  });

  assert.equal(getDestroyDykeDisplayState({
    disaster: { disasterAttackerPoints: 30 }
  }).progress, 100);
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

test('换牌落入手牌时只重排一次，并按牌 ID 去除旧副本', () => {
  const currentCards = [
    { id: 'spades-2-0', suit: 'spades', rank: '2' },
    { id: 'hearts-5-0', suit: 'hearts', rank: '5' },
    { id: 'clubs-K-0', suit: 'clubs', rank: 'K' }
  ];
  const receivedCards = [
    { id: 'diamonds-A-1', suit: 'diamonds', rank: 'A' },
    // 模拟重复推送：已有牌不能在手牌中出现两次。
    { id: 'clubs-K-0', suit: 'clubs', rank: 'K' }
  ];

  assert.deepEqual(
    mergeTransferredHandCards(currentCards, ['hearts-5-0'], receivedCards),
    [
      currentCards[0],
      receivedCards[0],
      receivedCards[1]
    ]
  );
  assert.deepEqual(mergeTransferredHandCards(null, null, null), []);
});

test('记录在案用共用点数轴压缩四种花色，并精确保留两副牌计数和大小王', () => {
  const view = getRecordOnFileTrackerView({
    activeRound: 3,
    lastActiveRound: null,
    playedCardCount: 7,
    counts: {
      spades: { K: 1 },
      hearts: { '10': 2 },
      clubs: {},
      diamonds: { '5': 1 },
      joker: { small_joker: 1, big_joker: 2 }
    }
  }, 3);

  assert.equal(view.ranks.length, 13);
  assert.equal(view.suits.length, 4);
  assert.equal(view.suits.find(suit => suit.id === 'hearts').counts[8], 2);
  assert.equal(view.suits.find(suit => suit.id === 'spades').counts[11], 1);
  assert.deepEqual(view.jokers, [1, 2]);
  assert.equal(getRecordOnFileTrackerView({
    activeRound: 3,
    lastActiveRound: null
  }, 4), null);
});
