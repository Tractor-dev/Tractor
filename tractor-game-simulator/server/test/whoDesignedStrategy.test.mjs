import test from 'node:test';
import assert from 'node:assert/strict';

import { Card } from '../src/models/Card.js';
import { Player } from '../src/models/Player.js';
import { Room } from '../src/models/Room.js';
import { BotService } from '../src/services/BotService.js';
import { GameEngine } from '../src/services/GameEngine.js';
import {
  chooseWhoDesignedCardsToBury,
  chooseWhoDesignedTrumpDeclaration
} from '../src/services/whoDesignedStrategy.js';
import { BotTypes, GamePhases } from '../src/utils/constants.js';

function card(suit, rank, copyIndex = 0) {
  return new Card(suit, rank, copyIndex);
}

function createBotRoom() {
  const room = new Room('WhoDesigned 测试房', 'bot-0', {
    botType: BotTypes.WHO_DESIGNED,
    dealInterval: 10
  });
  for (let index = 0; index < 4; index++) {
    room.addPlayer(new Player(`bot-${index}`, `Bot ${index}`, index, true));
  }
  return room;
}

test('WhoDesigned 摸到有强度的级牌花色后会主动亮主', () => {
  const cards = [
    card('spades', '2'),
    card('spades', 'A'),
    card('spades', 'K'),
    card('spades', 'Q'),
    card('spades', '10')
  ];

  assert.deepEqual(
    chooseWhoDesignedTrumpDeclaration({ cards, trumpRank: '2' }),
    { suit: 'spades', count: 1 }
  );
});

test('WhoDesigned 可用一对级牌反掉较弱的单张亮主', () => {
  const cards = [
    card('spades', '2', 0),
    card('spades', '2', 1),
    card('spades', 'A'),
    card('spades', 'K'),
    card('spades', 'Q')
  ];

  assert.deepEqual(
    chooseWhoDesignedTrumpDeclaration({
      cards,
      trumpRank: '2',
      currentTrumpDeclaration: {
        playerId: 'other',
        suit: 'hearts',
        strength: 1
      },
      playerId: 'bot'
    }),
    { suit: 'spades', count: 2 }
  );
});

test('GameEngine 在 WhoDesigned Bot 摸牌时写入并广播亮主', () => {
  const room = createBotRoom();
  const bot = room.players[0];
  bot.cards = [
    card('clubs', '2'),
    card('clubs', 'A'),
    card('clubs', 'K'),
    card('clubs', 'Q'),
    card('clubs', 'J')
  ];
  room.gameState.phase = GamePhases.DRAWING;
  room.gameState.trumpRank = '2';

  const events = [];
  const io = {
    to: target => ({
      emit: (event, payload) => events.push({ target, event, payload })
    })
  };
  const engine = new GameEngine(room, io);
  const result = engine.handleRuleCardDealt(bot, bot.cards.at(-1));

  assert.equal(result, null);
  assert.equal(room.gameState.trumpSuit, 'clubs');
  assert.equal(room.gameState.currentTrumpDeclaration.playerId, bot.id);
  assert.equal(room.gameState.currentTrumpDeclaration.count, 1);
  assert.ok(events.some(entry => (
    entry.event === 'trump_declared'
    && entry.payload.playerId === bot.id
    && entry.payload.suit === 'clubs'
  )));
});

test('WhoDesigned 埋牌优先造缺且保留主牌和副牌 A', () => {
  const cards = [
    card('clubs', '3'),
    card('diamonds', '4'),
    card('diamonds', '6'),
    card('clubs', 'A'),
    card('hearts', '3'),
    card('hearts', '4'),
    card('spades', '2'),
    card('joker', 'small_joker')
  ];

  const buried = chooseWhoDesignedCardsToBury(cards, 3, 'spades', '2');
  assert.equal(buried.length, 3);
  assert.ok(buried.some(item => item.suit === 'clubs' && item.rank === '3'));
  assert.ok(buried.every(item => item.suit !== 'spades' && item.suit !== 'joker'));
  assert.ok(buried.every(item => item.rank !== 'A'));
});

test('BotService 会从完整墩历史恢复各家的缺门信息', () => {
  const room = createBotRoom();
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  const plays = [
    { playerIndex: 0, cards: [card('hearts', '10')] },
    { playerIndex: 1, cards: [card('hearts', '3')] },
    { playerIndex: 2, cards: [card('clubs', '4')] },
    { playerIndex: 3, cards: [card('spades', '5')] }
  ];
  room.gameState.playHistory = plays.map(play => ({
    ...play,
    playerId: room.players[play.playerIndex].id
  }));

  const service = new BotService(BotTypes.WHO_DESIGNED);
  const input = service._buildBotInput(room.gameState, [], 0, room);

  assert.deepEqual(input.emptySuits, [[], [], ['h'], ['h']]);
});
