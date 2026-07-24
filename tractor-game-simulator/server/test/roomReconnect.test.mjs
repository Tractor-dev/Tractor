import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomManager } from '../src/services/RoomManager.js';
import { registerRoomHandlers } from '../src/socket/handlers/roomHandlers.js';

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
