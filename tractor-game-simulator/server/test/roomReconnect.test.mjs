import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomManager } from '../src/services/RoomManager.js';
import { Player } from '../src/models/Player.js';
import { registerRoomHandlers } from '../src/socket/handlers/roomHandlers.js';
import {
  getBotServices,
  getGameEngines,
  registerGameHandlers
} from '../src/socket/handlers/gameHandlers.js';

class FakeSocket {
  constructor(id) {
    this.id = id;
    this.handlers = new Map();
    this.emitted = [];
    this.joinedRooms = new Set();
  }

  on(event, handler) {
    this.handlers.set(event, handler);
  }

  emit(event, payload) {
    this.emitted.push({ event, payload });
  }

  join(roomId) {
    this.joinedRooms.add(roomId);
  }

  leave(roomId) {
    this.joinedRooms.delete(roomId);
  }

  to() {
    return { emit: () => {} };
  }

  trigger(event, payload) {
    return this.handlers.get(event)?.(payload);
  }

  last(event) {
    return this.emitted.findLast(entry => entry.event === event)?.payload;
  }
}

function createIo() {
  return {
    broadcasts: [],
    to(roomId) {
      return {
        emit: (event, payload) => {
          this.broadcasts.push({ roomId, event, payload });
        }
      };
    }
  };
}

test('断线后保留座位，并可用私密令牌恢复同一玩家、手牌与房主身份', () => {
  const io = createIo();
  const roomManager = new RoomManager();
  const originalSocket = new FakeSocket('socket-old');
  registerRoomHandlers(io, originalSocket, roomManager);

  originalSocket.trigger('create_room', {
    name: '重连测试',
    playerName: '玩家A',
    config: {}
  });
  const created = originalSocket.last('room_created');
  const room = roomManager.getRoom(created.room.id);
  const player = room.findPlayerById(created.player.id);
  player.cards.push({ toJSON: () => ({ id: 'hearts-A-0', suit: 'hearts', rank: 'A' }) });
  const politicalReviewPending = {
    id: 'political-review-reconnect',
    round: 3,
    reviewerPlayerId: player.id,
    reviewerPlayerName: player.name,
    teammatePlayerId: 'teammate-player',
    teammatePlayerName: '队友',
    cards: [
      { id: 'spades-Q-0', suit: 'spades', rank: 'Q' },
      { id: 'spades-K-0', suit: 'spades', rank: 'K' }
    ]
  };
  room.gameState.selectedRule = { id: 'political_review', name: '政治审查' };
  room.gameState.politicalReviewPending = {
    ...politicalReviewPending,
    requestingPlayerId: 'teammate-player',
    controlledPlayerId: null,
    activeSkillId: null,
    cardIds: politicalReviewPending.cards.map(card => card.id),
    playOptions: {}
  };
  room.gameState.phase = 'playing';
  room.gameState.currentRound = 3;
  room.gameState.currentRoundPlays = [{
    playerIndex: 0,
    playerId: player.id,
    cards: [{ toJSON: () => ({ id: 'clubs-K-0', suit: 'clubs', rank: 'K' }) }],
    concealed: false,
    treatedAsSmall: false
  }, {
    playerIndex: 1,
    playerId: 'teammate-player',
    cards: [
      { toJSON: () => ({ id: 'hearts-9-0', suit: 'hearts', rank: '9' }) },
      { toJSON: () => ({ id: 'hearts-9-1', suit: 'hearts', rank: '9' }) }
    ],
    concealed: true,
    treatedAsSmall: true
  }];
  room.gameState.playHistory = [{
    round: 3,
    playerId: player.id,
    playerName: player.name,
    controllerPlayerId: player.id,
    controllerPlayerName: player.name,
    isProxy: false
  }, {
    round: 3,
    playerId: 'teammate-player',
    playerName: '队友',
    controllerPlayerId: 'controller-player',
    controllerPlayerName: '代打玩家',
    isProxy: true
  }];

  assert.ok(created.resumeToken);
  assert.equal(created.room.players[0].resumeToken, undefined, '令牌不得出现在公开房间数据中');

  originalSocket.trigger('disconnect');
  assert.equal(room.players.length, 1, '宽限期内不能释放座位');
  assert.equal(player.isOnline, false);

  const replacementSocket = new FakeSocket('socket-new');
  registerRoomHandlers(io, replacementSocket, roomManager);
  replacementSocket.trigger('resume_room', {
    roomId: room.id,
    playerId: player.id,
    resumeToken: created.resumeToken
  });

  const resumed = replacementSocket.last('room_resumed');
  assert.equal(resumed.player.id, player.id);
  assert.deepEqual(resumed.player.cards, [
    { id: 'hearts-A-0', suit: 'hearts', rank: 'A' }
  ]);
  assert.deepEqual(
    resumed.room.gameState.politicalReview.pending,
    politicalReviewPending,
    '恢复房间时必须携带尚未处理的政治审查，供审查者重建询问框'
  );
  assert.equal(resumed.room.gameState.currentRoundPlays, 2);
  assert.deepEqual(resumed.room.gameState.currentRoundTable[0].cards, [
    { id: 'clubs-K-0', suit: 'clubs', rank: 'K' }
  ]);
  assert.equal(resumed.room.gameState.currentRoundTable[1].cardsCount, 2);
  assert.deepEqual(
    resumed.room.gameState.currentRoundTable[1].cards,
    [],
    '暗置牌在重连快照中只能公开张数，不能泄露牌面'
  );
  assert.equal(resumed.room.gameState.currentRoundTable[1].controllerPlayerId, 'controller-player');
  assert.equal(player.socketId, replacementSocket.id);
  assert.equal(player.isOnline, true);
  assert.equal(room.hostId, replacementSocket.id);
  assert.ok(replacementSocket.joinedRooms.has(room.id));
});

test('错误的恢复令牌不能认领已有座位', () => {
  const io = createIo();
  const roomManager = new RoomManager();
  const ownerSocket = new FakeSocket('socket-owner');
  registerRoomHandlers(io, ownerSocket, roomManager);
  ownerSocket.trigger('create_room', {
    name: '安全测试',
    playerName: '玩家A',
    config: {}
  });
  const created = ownerSocket.last('room_created');

  const attackerSocket = new FakeSocket('socket-attacker');
  registerRoomHandlers(io, attackerSocket, roomManager);
  attackerSocket.trigger('resume_room', {
    roomId: created.room.id,
    playerId: created.player.id,
    resumeToken: 'wrong-token'
  });

  assert.match(attackerSocket.last('resume_failed').message, /无法验证/);
  assert.equal(roomManager.getRoom(created.room.id).players[0].socketId, ownerSocket.id);
});

test('牌桌监听器挂载后可按当前连接同步个人私密待办', () => {
  const io = createIo();
  const roomManager = new RoomManager();
  const socket = new FakeSocket('socket-private-sync');
  registerRoomHandlers(io, socket, roomManager);
  registerGameHandlers(io, socket, roomManager);
  socket.trigger('create_room', {
    name: '私密待办同步测试',
    playerName: '玩家A',
    config: {}
  });
  const created = socket.last('room_created');
  const room = roomManager.getRoom(created.room.id);
  const expectedPayload = {
    round: 6,
    playerId: created.player.id,
    recovered: true
  };
  getGameEngines().set(room.id, {
    getPrivateGameStateSyncEvents(playerId) {
      assert.equal(playerId, created.player.id);
      return [{
        event: 'time_reversal_decision_required',
        payload: expectedPayload
      }];
    }
  });

  socket.trigger('request_private_game_state_sync', { roomId: room.id });

  assert.deepEqual(socket.last('time_reversal_decision_required'), expectedPayload);
  assert.deepEqual(socket.last('private_game_state_synced'), {
    roomId: room.id,
    eventCount: 1
  });
  getGameEngines().delete(room.id);
});

test('等待准备阶段允许空位重新加入，并接管已离线的规则选择职责', () => {
  const io = createIo();
  const roomManager = new RoomManager();
  const ownerSocket = new FakeSocket('socket-owner');
  registerRoomHandlers(io, ownerSocket, roomManager);
  ownerSocket.trigger('create_room', {
    name: '准备补位测试',
    playerName: '房主',
    config: {}
  });
  const created = ownerSocket.last('room_created');
  const room = roomManager.getRoom(created.room.id);
  room.gameState.isWaitingForReady = true;
  room.gameState.isRuleSelectionPending = true;
  room.gameState.ruleSelectionMode = 'single';
  room.gameState.ruleOptions = [{ id: 'normal_game', name: '世事无常' }];
  room.gameState.ruleChooserPlayerId = 'removed-player';

  const replacementSocket = new FakeSocket('socket-replacement');
  registerRoomHandlers(io, replacementSocket, roomManager);
  replacementSocket.trigger('join_room', {
    roomId: room.id,
    playerName: '补位玩家'
  });

  const joined = replacementSocket.last('room_joined');
  assert.ok(joined, '准备阶段的空位应允许加入');
  assert.equal(room.gameState.ruleChooserPlayerId, joined.player.id);
  assert.equal(replacementSocket.last('error'), undefined);
  assert.ok(
    io.broadcasts.some(entry =>
      entry.event === 'rule_selection_started'
      && entry.payload.chooserPlayerId === joined.player.id
    )
  );
});

test('主动离开后房间只剩Bot时立即清理房间和服务资源', () => {
  const io = createIo();
  const roomManager = new RoomManager();
  const ownerSocket = new FakeSocket('socket-owner-bot-room');
  registerRoomHandlers(io, ownerSocket, roomManager);
  ownerSocket.trigger('create_room', {
    name: 'Bot资源清理测试',
    playerName: '唯一真人',
    config: {}
  });

  const created = ownerSocket.last('room_created');
  const room = roomManager.getRoom(created.room.id);
  room.addPlayer(new Player('bot-only', 'Bot 1', 1, true));

  let cleanupCalls = 0;
  getGameEngines().set(room.id, {
    cleanup() {
      cleanupCalls += 1;
    }
  });
  getBotServices().set(room.id, { type: 'test-bot-service' });

  ownerSocket.trigger('leave_room', { roomId: room.id });

  assert.equal(roomManager.getRoom(room.id), undefined);
  assert.equal(getGameEngines().has(room.id), false);
  assert.equal(getBotServices().has(room.id), false);
  assert.equal(cleanupCalls, 1);
});

test('真人退出后仍有其他真人时保留房间', () => {
  const io = createIo();
  const roomManager = new RoomManager();
  const ownerSocket = new FakeSocket('socket-owner-shared-room');
  registerRoomHandlers(io, ownerSocket, roomManager);
  ownerSocket.trigger('create_room', {
    name: '真人保留测试',
    playerName: '房主',
    config: {}
  });

  const created = ownerSocket.last('room_created');
  const room = roomManager.getRoom(created.room.id);
  const guestSocket = new FakeSocket('socket-guest-shared-room');
  registerRoomHandlers(io, guestSocket, roomManager);
  guestSocket.trigger('join_room', {
    roomId: room.id,
    playerName: '仍在房间的真人'
  });
  room.addPlayer(new Player('bot-shared', 'Bot 1', 2, true));

  ownerSocket.trigger('leave_room', { roomId: room.id });

  assert.ok(roomManager.getRoom(room.id));
  assert.ok(room.players.some(remainingPlayer => !remainingPlayer.isBot));
  assert.equal(room.hostId, guestSocket.id);
});
