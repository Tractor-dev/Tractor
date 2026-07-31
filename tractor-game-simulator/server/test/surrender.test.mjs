import test from 'node:test';
import assert from 'node:assert/strict';

import { Room } from '../src/models/Room.js';
import { Player } from '../src/models/Player.js';
import { Card } from '../src/models/Card.js';
import { GameEngine } from '../src/services/GameEngine.js';
import { GamePhases } from '../src/utils/constants.js';
import { getRuleById, RuleIds } from '../src/rules/ruleRegistry.js';

const NORMAL_RULE = getRuleById(RuleIds.NORMAL_GAME);
const BURN_THE_BOATS_RULE = getRuleById(RuleIds.BURN_THE_BOATS);
const NO_ONE_SURVIVES_RULE = getRuleById(RuleIds.NO_ONE_SURVIVES);

function createIo() {
  const events = [];
  return {
    events,
    to(target) {
      return {
        emit(event, payload) {
          events.push({ target, event, payload });
        }
      };
    }
  };
}

function createSurrenderGame({
  dealerIndex = 0,
  currentRound = 2,
  attackerScore = 0,
  selectedRule = NORMAL_RULE
} = {}) {
  const room = new Room('投降测试房', 'socket-0', { dealInterval: 10 });
  for (let index = 0; index < 4; index += 1) {
    room.addPlayer(new Player(`socket-${index}`, `玩家${index}`, index));
  }
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = selectedRule;
  room.gameState.buryingPlayerId = room.players[dealerIndex].id;
  room.gameState.dealerPlayerIndex = dealerIndex;
  room.gameState.currentRound = currentRound;
  room.gameState.lastRoundWinnerIndex = (dealerIndex + 1) % 4;
  room.gameState.attackerScore = attackerScore;
  return {
    room,
    engine: new GameEngine(room, createIo())
  };
}

test('投降申请等待完整墩结束，并从庄家座位开始排序', () => {
  const { room, engine } = createSurrenderGame({ dealerIndex: 2 });
  room.gameState.currentRoundPlays.push({ playerId: room.players[2].id, cards: [] });
  room.gameState.playersPlayedThisRound.add(2);

  engine.requestSurrender(room.players[1].id);
  engine.requestSurrender(room.players[0].id);
  engine.requestSurrender(room.players[2].id);
  assert.equal(engine.prepareSurrenderReview({ completedRound: 1 }), null);

  room.gameState.currentRoundPlays = [];
  room.gameState.playersPlayedThisRound.clear();
  const first = engine.prepareSurrenderReview({ completedRound: 1 });
  assert.equal(first.initiatorPlayerId, room.players[2].id);
  assert.deepEqual(
    room.gameState.surrenderDecisionQueue.map(decision => decision.initiatorPlayerId),
    [room.players[0].id, room.players[1].id]
  );
});

test('摸牌或埋底时预先申请，也必须等本局第一墩完整结束后才询问', () => {
  const { room, engine } = createSurrenderGame({ currentRound: 1 });
  room.gameState.lastRoundWinnerIndex = 3;
  engine.requestSurrender(room.players[0].id);

  assert.equal(engine.prepareSurrenderReview({ completedRound: 0 }), null);
  assert.equal(room.gameState.surrenderRequests.has(room.players[0].id), true);
});

test('实际出牌流程在第四家完成本墩后才返回投降询问', () => {
  const { room, engine } = createSurrenderGame({ currentRound: 0 });
  const hands = [
    [new Card('hearts', '3', 0), new Card('clubs', '3', 0)],
    [new Card('hearts', '4', 0), new Card('clubs', '4', 0)],
    [new Card('hearts', '5', 0), new Card('clubs', '5', 0)],
    [new Card('hearts', '6', 0), new Card('clubs', '6', 0)]
  ];
  hands.forEach((hand, playerIndex) => {
    hand.forEach(card => room.players[playerIndex].addCard(card));
  });
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.lastRoundWinnerIndex = null;
  engine.setFirstPlayer(room.players[0].id);
  engine.requestSurrender(room.players[1].id);

  const first = engine.playCards(room.players[0].id, [hands[0][0].id]);
  assert.equal(first.surrenderDecision, null);
  engine.playCards(room.players[1].id, [hands[1][0].id]);
  engine.playCards(room.players[2].id, [hands[2][0].id]);
  const completed = engine.playCards(room.players[3].id, [hands[3][0].id]);

  assert.equal(completed.roundUpdate.round, 1);
  assert.equal(completed.surrenderDecision.initiatorPlayerId, room.players[1].id);
  assert.equal(room.gameState.currentRound, 2);
  assert.throws(
    () => engine.playCards(room.players[3].id, [hands[3][1].id]),
    /投降表决/
  );

  engine.respondSurrender(room.players[3].id, false);
  assert.equal(engine.hasPendingSurrenderDecision(), false);
  assert.doesNotThrow(
    () => engine.playCards(room.players[3].id, [hands[3][1].id])
  );
});

test('拒绝投降后继续询问下一位申请者，断线同步只恢复给当前队友', () => {
  const { room, engine } = createSurrenderGame();
  engine.requestSurrender(room.players[0].id);
  engine.requestSurrender(room.players[1].id);
  const first = engine.prepareSurrenderReview({ completedRound: 1 });
  assert.equal(first.teammatePlayerId, room.players[2].id);

  const privateEvents = engine.getPrivateGameStateSyncEvents(room.players[2].id);
  assert.ok(privateEvents.some(event => event.event === 'surrender_decision_required'));
  assert.equal(
    engine.getPrivateGameStateSyncEvents(room.players[3].id)
      .some(event => event.event === 'surrender_decision_required'),
    false
  );

  const rejected = engine.respondSurrender(room.players[2].id, false);
  assert.equal(rejected.gameFinished, false);
  assert.equal(rejected.nextDecision.initiatorPlayerId, room.players[1].id);
  assert.equal(rejected.nextDecision.teammatePlayerId, room.players[3].id);
});

test('庄家方投降按闲家当前实得分加80并让闲家方获胜', () => {
  const { room, engine } = createSurrenderGame({ attackerScore: 50 });
  room.players.forEach((player, playerIndex) => {
    player.addCard(new Card(playerIndex % 2 === 0 ? 'hearts' : 'clubs', `${playerIndex + 3}`, 0));
    player.addCard(new Card(playerIndex % 2 === 0 ? 'diamonds' : 'spades', 'K', 1));
  });
  engine.requestSurrender(room.players[0].id);
  const decision = engine.prepareSurrenderReview({ completedRound: 3 });
  const result = engine.respondSurrender(room.players[2].id, true);

  assert.equal(result.gameFinished, true);
  assert.equal(room.gameState.phase, GamePhases.REVEALING);
  assert.equal(room.gameState.attackerScore, 130);
  assert.equal(room.gameState.bottomScoreResult.bottomScoreGained, 0);
  assert.equal(room.gameState.bottomScoreResult.surrender.scoreAdjustment, 80);
  assert.equal(room.gameState.upgradeResult.attackerWon, true);
  assert.equal(room.gameState.upgradeResult.attackerLevelUp, 1);
  assert.equal(decision.surrenderingSide, 'dealer');
  assert.equal(room.gameState.bottomScoreResult.surrender.revealedHands.length, 4);
  assert.deepEqual(
    room.gameState.bottomScoreResult.surrender.revealedHands.map(hand => ({
      playerId: hand.playerId,
      side: hand.side,
      isDealer: hand.isDealer,
      cardCount: hand.cards.length
    })),
    room.players.map((player, playerIndex) => ({
      playerId: player.id,
      side: playerIndex % 2 === 0 ? 'dealer' : 'attacker',
      isDealer: playerIndex === 0,
      cardCount: 2
    }))
  );
});

test('闲家方在前两墩投降固定让庄家方升1级，不伪装成75分', () => {
  const { room, engine } = createSurrenderGame({ attackerScore: 0 });
  engine.requestSurrender(room.players[1].id);
  const decision = engine.prepareSurrenderReview({ completedRound: 2 });
  engine.respondSurrender(room.players[3].id, true);

  assert.equal(decision.surrenderingSide, 'attacker');
  assert.equal(room.gameState.attackerScore, 0);
  assert.equal(room.gameState.upgradeResult.attackerWon, false);
  assert.equal(room.gameState.upgradeResult.dealerLevelUp, 1);
  assert.equal(room.gameState.bottomScoreResult.surrender.earlyAttackerSurrender, true);
});

test('闲家方从第三墩起按当前实得分决定庄家升级且仍保证庄家方获胜', () => {
  const { room, engine } = createSurrenderGame({ attackerScore: 25 });
  engine.requestSurrender(room.players[1].id);
  engine.prepareSurrenderReview({ completedRound: 3 });
  engine.respondSurrender(room.players[3].id, true);

  assert.equal(room.gameState.attackerScore, 25);
  assert.equal(room.gameState.upgradeResult.attackerWon, false);
  assert.equal(room.gameState.upgradeResult.dealerLevelUp, 2);
});

test('破釜沉舟规则禁止投降和重开', () => {
  const { room, engine } = createSurrenderGame({
    selectedRule: BURN_THE_BOATS_RULE
  });
  assert.throws(
    () => engine.requestSurrender(room.players[0].id),
    /禁止投降/
  );
  assert.throws(() => engine.restartGame(), /禁止重开/);
});

test('无人生还只暗置牌面，不会误禁投降', () => {
  const { room, engine } = createSurrenderGame({
    selectedRule: NO_ONE_SURVIVES_RULE
  });
  assert.doesNotThrow(() => engine.requestSurrender(room.players[0].id));
});
