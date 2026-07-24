import test from 'node:test';
import assert from 'node:assert/strict';

import { Room } from '../src/models/Room.js';
import { Player } from '../src/models/Player.js';
import { GameEngine } from '../src/services/GameEngine.js';
import { RuleIds } from '../src/rules/ruleRegistry.js';

function createIo() {
  const events = [];
  return {
    events,
    to() {
      return {
        emit(event, payload) {
          events.push({ event, payload });
        }
      };
    }
  };
}

function createRoom(config = {}) {
  const room = new Room('普通对局房', 'socket-host', { dealInterval: 10, ...config });
  for (let i = 0; i < 4; i++) {
    room.addPlayer(new Player(`socket-${i}`, `玩家${i}`, i));
  }
  return room;
}

test('validateConfig 正确保存 normalModeOnly=true', () => {
  const room = createRoom({ normalModeOnly: true });
  assert.equal(room.config.normalModeOnly, true);
  assert.equal(room.config.testMode, false);
});

test('normalModeOnly 与 testMode 冲突时以 testMode 为准', () => {
  const room = createRoom({
    normalModeOnly: true,
    testMode: true,
    testRuleId: RuleIds.NORMAL_GAME
  });
  assert.equal(room.config.testMode, true);
  assert.equal(room.config.normalModeOnly, false);
});

test('normalModeOnly 房间：startRuleSelection 直接选定 normal_game 并跳过二选一', () => {
  const room = createRoom({ normalModeOnly: true });
  const io = createIo();
  const engine = new GameEngine(room, io);

  // 避免副作用（发牌等）
  engine.initializeFocusFigureCandidates = () => {};

  const result = engine.startRuleSelection();
  assert.equal(result, null, 'normalModeOnly 时不应返回 chooser');

  const gs = room.gameState;
  assert.equal(gs.selectedRule?.id, RuleIds.NORMAL_GAME);
  assert.equal(gs.isRuleSelectionPending, false);
  assert.equal(gs.ruleOptions.length, 0);
  assert.equal(gs.ruleChooserPlayerId, null);
  assert.equal(gs.ruleSelectionMode, null);

  const selectionStarted = io.events.find(e => e.event === 'rule_selection_started');
  assert.equal(selectionStarted, undefined, '不应触发 rule_selection_started');

  const selected = io.events.find(e => e.event === 'rule_selected');
  assert.ok(selected, '应触发 rule_selected');
  assert.equal(selected.payload.rule.id, RuleIds.NORMAL_GAME);
  assert.equal(selected.payload.normalModeOnly, true);
});

test('非 normalModeOnly 房间：仍走随机二选一（保留原行为）', () => {
  const room = createRoom(); // 默认 normalModeOnly=false
  const io = createIo();
  const engine = new GameEngine(room, io, () => 0.1);
  engine.initializeFocusFigureCandidates = () => {};

  engine.startRuleSelection();

  const gs = room.gameState;
  assert.equal(gs.isRuleSelectionPending, true, '默认模式下仍需选择规则');
  assert.ok(gs.ruleOptions.length >= 2, '应生成至少两条候选');
  assert.ok(io.events.some(e => e.event === 'rule_selection_started'));
});
