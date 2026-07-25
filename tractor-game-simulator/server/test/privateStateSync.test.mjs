import test from 'node:test';
import assert from 'node:assert/strict';

import { Card } from '../src/models/Card.js';
import { Player } from '../src/models/Player.js';
import { Room } from '../src/models/Room.js';
import { GameEngine } from '../src/services/GameEngine.js';
import { getRuleById, RuleIds } from '../src/rules/ruleRegistry.js';
import { GamePhases } from '../src/utils/constants.js';

function createRoom() {
  const room = new Room('私密状态恢复测试', 'socket-0', { dealInterval: 10 });
  for (let index = 0; index < 4; index++) {
    room.addPlayer(new Player(`socket-${index}`, `玩家${index}`, index));
  }
  return room;
}

function createIo() {
  return {
    to() {
      return { emit() {} };
    }
  };
}

function eventMap(events) {
  return new Map(events.map(entry => [entry.event, entry.payload]));
}

test('统一私密同步恢复所有会冻结牌局的个人待办', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const player = room.players[0];
  const teammate = room.players[2];
  const opponent = room.players[1];
  player.cards = [
    new Card('hearts', '5', 0),
    new Card('clubs', '7', 0),
    new Card('diamonds', '9', 0)
  ];

  const state = room.gameState;
  state.selectedRule = getRuleById(RuleIds.NORMAL_GAME);
  state.phase = GamePhases.PLAYING;
  state.trumpSuit = 'spades';
  state.trumpRank = '2';
  state.currentRound = 3;

  state.removeFirewoodCurrentDecision = {
    counteredPlayerId: player.id,
    counteringPlayerId: opponent.id
  };
  state.mainstayCurrentAction = {
    id: 'mainstay-1',
    stage: 'decision',
    chooserPlayerId: player.id,
    trumpCount: 2
  };
  state.woodenOxMulesByTeam.set(0, {
    teamIndex: 0,
    initialHolderPlayerId: player.id,
    holderPlayerId: player.id,
    storedCard: new Card('clubs', 'A', 1),
    transfersUsed: 1,
    maxTransfers: 4
  });
  state.woodenOxRoundWindow = {
    round: 3,
    pendingPlayerIds: new Set([player.id]),
    requiredTransferPlayerIds: new Set([player.id])
  };
  state.politicalReviewPending = {
    id: 'political-pending',
    round: 3,
    reviewerPlayerId: player.id,
    reviewerPlayerName: player.name,
    teammatePlayerId: teammate.id,
    teammatePlayerName: teammate.name,
    requestingPlayerId: teammate.id,
    controlledPlayerId: null,
    activeSkillId: null,
    cardIds: ['spades-Q-0'],
    playOptions: {},
    cards: [{ id: 'spades-Q-0', suit: 'spades', rank: 'Q' }]
  };
  state.timeReversalDecisionState = 'awaiting_response';
  state.timeReversalWindowRound = 3;
  state.timeReversalReservations.set(player.id, {
    playerId: player.id,
    playerName: player.name,
    round: 3
  });
  state.lastStandPendingPlayerIds.add(player.id);
  state.teammateCheerPending = {
    playerId: player.id,
    playerName: player.name,
    teammatePlayerId: teammate.id,
    teammatePlayerName: teammate.name,
    triggerRound: 3
  };
  state.afterglowPending = {
    playerId: player.id,
    playerName: player.name,
    trumpCount: 2,
    triggerRound: 3
  };
  state.forbiddenMagicCurrentDecisionPlayerId = player.id;
  state.forbiddenMagicDecisionRound = 3;
  state.forbiddenMagicDecisionQueue = [opponent.id];
  state.lureTigerCurrentDecision = {
    round: 3,
    playerId: player.id,
    playerName: player.name,
    stage: 'target',
    eligibleTargetIds: [opponent.id]
  };
  state.icebergPendingPlayerIds.add(player.id);
  engine.icebergSelectionRequests.set(player.id, {
    playerId: player.id,
    reason: 'replenish',
    requiredCount: 1,
    targetCount: 2,
    currentlyRevealedCardIds: [player.cards[0].id]
  });
  state.tenSidedAmbushSelectorPlayerId = player.id;
  state.isTenSidedAmbushSelectionPending = true;
  state.threePowersSlots = [{
    sourceRank: '5',
    pointValue: 5,
    selectorPosition: 3,
    selectorPlayerId: player.id,
    selectedRank: null,
    isRevealed: false
  }];
  state.waitingRabbitPendingSelectionPlayerIds.add(player.id);
  state.gentlemanPromisePendingPlayerIds.add(player.id);
  state.hiddenDragonPendingPlayerIds.add(player.id);
  state.antinomyPendingPlayerIds.add(player.id);
  state.antinomySelectionStage = 'opening';
  state.riceToMulberryPendingPlayerIds.add(player.id);
  state.destroyDykeDecision = {
    round: 3,
    dealerPlayerId: player.id,
    dealerPlayerName: player.name,
    roundPoints: 10
  };
  state.administrativeReview = {
    suitSelectorPlayerId: player.id,
    rankSelectorPlayerId: opponent.id,
    suit: null,
    rank: null
  };
  state.isFocusFigureVotingStarted = true;
  state.focusFigureTeams = [{
    team: 1,
    playerIds: [player.id, teammate.id],
    nomineePlayerId: teammate.id,
    finalPlayerId: null,
    attempt: 1,
    votes: new Map(),
    isFinalized: false
  }];
  state.equivalentReciprocityChallenge = {
    id: 'equivalent-1',
    initiatorPlayerId: player.id,
    targetPlayerId: opponent.id,
    selectedCardsByPlayerId: new Map()
  };
  state.ambiguousRoundDecision = {
    round: 3,
    currentPlayerId: player.id,
    queuePlayerIds: [],
    selections: [{
      playerId: player.id,
      playerName: player.name,
      position: 2,
      options: [
        { index: 0, cards: [player.cards[0]] },
        { index: 1, cards: [player.cards[1]] }
      ]
    }]
  };

  const events = engine.getPrivateGameStateSyncEvents(player.id);
  const names = new Set(events.map(entry => entry.event));
  const expected = [
    'remove_firewood_decision_required',
    'mainstay_decision_required',
    'wooden_ox_private_state',
    'wooden_ox_decision_required',
    'political_review_decision_required',
    'time_reversal_decision_required',
    'last_stand_decision_required',
    'teammate_cheer_decision_required',
    'afterglow_decision_required',
    'forbidden_magic_decision_required',
    'lure_tiger_target_required',
    'iceberg_reveal_selection_required',
    'ten_sided_ambush_selection_required',
    'three_powers_selection_required',
    'waiting_rabbit_selection_required',
    'gentleman_promise_selection_required',
    'hidden_dragon_selection_required',
    'antinomy_selection_required',
    'rice_to_mulberry_selection_required',
    'destroy_dyke_decision_required',
    'administrative_review_selection_required',
    'focus_figure_vote_required',
    'equivalent_reciprocity_card_required',
    'ambiguous_choice_required'
  ];

  expected.forEach(event => assert.ok(names.has(event), `缺少恢复事件 ${event}`));
  assert.ok(events.every(entry => entry.payload.recovered === true));
});

test('私密同步重放暗选结果和政治审查放行凭证且不泄露给其他玩家', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const player = room.players[0];
  const teammate = room.players[2];
  const otherPlayer = room.players[1];
  const state = room.gameState;
  state.selectedRule = getRuleById(RuleIds.NORMAL_GAME);
  state.phase = GamePhases.PLAYING;
  state.trumpSuit = 'spades';
  state.trumpRank = '2';
  state.currentRound = 4;

  state.politicalReviewApproval = {
    id: 'political-approved',
    requestingPlayerId: player.id,
    controlledPlayerId: null,
    teammatePlayerId: player.id,
    cardIds: ['hearts-A-0'],
    activeSkillId: null,
    playOptions: {
      jokerSubstitutions: [],
      clusterAnalysisSubstitutions: [],
      forbiddenMagicSubstitutions: [],
      ambiguousAlternativeCardIds: ['hearts-K-0']
    }
  };
  state.tenSidedAmbushSelectorPlayerId = player.id;
  state.tenSidedAmbushRank = '7';
  state.isTenSidedAmbushSelectionPending = false;
  state.isTenSidedAmbushRevealed = false;
  state.threePowersSlots = [{
    sourceRank: '10',
    pointValue: 10,
    selectorPosition: 2,
    selectorPlayerId: player.id,
    selectedRank: 'Q',
    isRevealed: false
  }];
  state.waitingRabbitDeclarationsByPlayerId.set(player.id, {
    suit: 'clubs',
    rank: 'K'
  });
  state.focusFigureTeams = [{
    team: 1,
    playerIds: [player.id, teammate.id],
    nomineePlayerId: teammate.id,
    finalPlayerId: teammate.id,
    attempt: 1,
    votes: new Map([
      [player.id, true],
      [teammate.id, true]
    ]),
    isFinalized: true
  }];
  state.magicTrickSelection = {
    round: 4,
    playerId: player.id,
    targetPlayerIds: [otherPlayer.id, teammate.id]
  };

  const ownEvents = eventMap(engine.getPrivateGameStateSyncEvents(player.id));
  assert.deepEqual(
    ownEvents.get('political_review_play_approved').ambiguousAlternativeCardIds,
    ['hearts-K-0']
  );
  assert.equal(ownEvents.get('ten_sided_ambush_rank_selected').rank, '7');
  assert.equal(ownEvents.get('three_powers_rank_selected').rank, 'Q');
  assert.deepEqual(
    {
      suit: ownEvents.get('waiting_rabbit_target_selected').suit,
      rank: ownEvents.get('waiting_rabbit_target_selected').rank
    },
    { suit: 'clubs', rank: 'K' }
  );
  assert.equal(ownEvents.get('focus_figure_team_finalized').focusPlayerId, teammate.id);
  assert.deepEqual(
    ownEvents.get('magic_trick_prepared').targetPlayerIds,
    [otherPlayer.id, teammate.id]
  );

  const otherEvents = eventMap(engine.getPrivateGameStateSyncEvents(otherPlayer.id));
  [
    'political_review_play_approved',
    'ten_sided_ambush_rank_selected',
    'three_powers_rank_selected',
    'waiting_rabbit_target_selected',
    'focus_figure_team_finalized',
    'magic_trick_prepared'
  ].forEach(event => assert.equal(otherEvents.has(event), false, `${event} 不得泄露`));
});
