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
  on(event, handler) { this.handlers.set(event, handler); }
  emit(event, payload) { this.emitted.push({ event, payload }); }
  join(roomId) { this.joinedRooms.add(roomId); }
  leave(roomId) { this.joinedRooms.delete(roomId); }
  to() { return { emit: () => {} }; }
  trigger(event, payload) { return this.handlers.get(event)?.(payload); }
  last(event) { return this.emitted.findLast(e => e.event === event)?.payload; }
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

function setupRoomWithBots({ humanCount = 1, botCount = 2 } = {}) {
  const io = createIo();
  const roomManager = new RoomManager();

  // 房主（真人）
  const hostSocket = new FakeSocket('socket-host');
  registerRoomHandlers(io, hostSocket, roomManager);
  hostSocket.trigger('create_room', { name: 'bot清理测试', playerName: '房主', config: {} });
  const created = hostSocket.last('room_created');
  const room = roomManager.getRoom(created.room.id);

  // 追加真人
  const extraHumans = [];
  for (let i = 1; i < humanCount; i++) {
    const s = new FakeSocket(`socket-human-${i}`);
    registerRoomHandlers(io, s, roomManager);
    s.trigger('join_room', { roomId: room.id, playerName: `真人${i}` });
    extraHumans.push(s);
  }

  // 追加 bot（通过房主）
  for (let i = 0; i < botCount; i++) {
    hostSocket.trigger('add_bot', { roomId: room.id, botName: `Bot${i + 1}` });
  }

  return { io, roomManager, room, hostSocket, extraHumans };
}

test('唯一真人（房主）离开后，房间内只剩 bot，房间应被删除', () => {
  const { roomManager, room, hostSocket } = setupRoomWithBots({ humanCount: 1, botCount: 2 });
  assert.equal(room.players.length, 3, '开始应有 1 真人 + 2 bot');

  hostSocket.trigger('leave_room', { roomId: room.id });

  assert.equal(roomManager.getRoom(room.id), undefined, '只剩 bot 时房间应被删除');
});

test('非房主真人最后一个离开时也应删除房间', () => {
  // 房主真人 + 1 真人 + 1 bot
  const { roomManager, room, hostSocket, extraHumans } = setupRoomWithBots({ humanCount: 2, botCount: 1 });
  assert.equal(room.players.length, 3);

  // 先让房主离开：应转给另一位真人，房间保留
  hostSocket.trigger('leave_room', { roomId: room.id });
  assert.ok(roomManager.getRoom(room.id), '仍有真人在，房间应保留');
  const remaining = roomManager.getRoom(room.id);
  assert.equal(
    remaining.hostId,
    extraHumans[0].id,
    '房主应转给真人而不是 bot'
  );

  // 最后一名真人离开 → 房间应被删除
  extraHumans[0].trigger('leave_room', { roomId: room.id });
  assert.equal(roomManager.getRoom(room.id), undefined, '最后真人离开后房间应被删除');
});

test('房主离开但仍有其它真人时，房主转给真人（跳过 bot）', () => {
  const { roomManager, room, hostSocket, extraHumans } = setupRoomWithBots({ humanCount: 2, botCount: 2 });
  // 房间人员顺序：房主(0) 真人1(1) Bot1(2) Bot2(3)
  // 注意 add_bot 是房主主动加的，因此加入顺序中 bot 在真人后面

  hostSocket.trigger('leave_room', { roomId: room.id });
  const remaining = roomManager.getRoom(room.id);
  assert.ok(remaining, '还有真人，房间应保留');
  assert.equal(remaining.hostId, extraHumans[0].id, '新房主必须是真人');
  // 确认房间里仍然保留 bot
  assert.ok(remaining.players.some(p => p.isBot), 'bot 应仍然在房间');
});
