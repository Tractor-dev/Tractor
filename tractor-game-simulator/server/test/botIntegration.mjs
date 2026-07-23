import assert from 'node:assert/strict';
import { Room } from '../src/models/Room.js';
import { Player } from '../src/models/Player.js';
import { Card } from '../src/models/Card.js';
import { GameEngine } from '../src/services/GameEngine.js';
import { DeckService } from '../src/services/DeckService.js';
import BotService from '../src/services/BotService.js';
import { BotTypes, GamePhases } from '../src/utils/constants.js';
import { detectPattern } from '../src/utils/cardPatternUtils.js';
import logger from '../src/utils/logger.js';

const originalInfo = logger.info;
logger.info = () => {};

const io = { to: () => ({ emit: () => {} }) };

async function playBotGame(trumpSuit) {
  const room = new Room('bot-integration', 'host', { botType: BotTypes.WHO_DESIGNED });
  for (let index = 0; index < 4; index++) {
    room.addPlayer(new Player(`bot-${index}`, `Bot ${index}`, index, true));
  }

  const deck = DeckService.shuffle(DeckService.createDeck());
  room.gameState.bottomCards = deck.slice(0, 8);
  deck.slice(8).forEach((card, index) => room.players[index % 4].addCard(card));
  room.gameState.trumpSuit = trumpSuit;
  room.gameState.trumpRank = '6';
  room.gameState.phase = GamePhases.BURYING;

  const engine = new GameEngine(room, io);
  const dealer = engine.setBuryingPlayer(room.players[0].id);
  engine.buryCards(dealer.id, dealer.cards.slice(0, 8).map(card => card.id));

  const bot = new BotService(BotTypes.WHO_DESIGNED);
  assert.equal(await bot.checkBotAvailability(), true, 'WhoDesigned files should be available');

  let actions = 0;
  let fallbacks = 0;
  while (room.gameState.phase === GamePhases.PLAYING && actions < 200) {
    const index = room.gameState.currentPlayerIndex;
    const player = room.players[index];
    let cardIds = await bot.getBotAction(room.gameState, player.cards, index, room);
    try {
      engine.playCards(player.id, cardIds);
    } catch {
      fallbacks++;
      cardIds = bot.getFallbackAction(room.gameState, player.cards);
      engine.playCards(player.id, cardIds);
    }
    actions++;
  }

  assert.ok(actions < 200, 'Bot game should not stall');
  assert.ok(room.players.every(player => player.cards.length === 0), 'Every bot should finish its hand');
  return { trumpSuit, actions, fallbacks, phase: room.gameState.phase };
}

async function verifyKnownVoidPointProtection() {
  const room = new Room('bot-point-protection', 'host', { botType: BotTypes.WHO_DESIGNED });
  for (let index = 0; index < 4; index++) {
    room.addPlayer(new Player(`bot-${index}`, `Bot ${index}`, index, true));
  }

  const completedTrick = [
    { playerIndex: 0, cards: [new Card('diamonds', 'A')] },
    { playerIndex: 1, cards: [new Card('diamonds', 'K')] },
    { playerIndex: 2, cards: [new Card('diamonds', 'Q')] },
    { playerIndex: 3, cards: [new Card('clubs', '3')] }
  ];
  const currentTrick = [
    { playerIndex: 0, cards: [new Card('diamonds', '10')] },
    { playerIndex: 1, cards: [new Card('diamonds', '4')] }
  ];
  room.gameState.trumpSuit = 'hearts';
  room.gameState.trumpRank = '2';
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.currentPlayerIndex = 2;
  room.gameState.currentRoundPlays = currentTrick;
  room.gameState.leadingPattern = detectPattern(
    currentTrick[0].cards,
    room.gameState.trumpSuit,
    room.gameState.trumpRank
  );
  room.gameState.playHistory = [...completedTrick, ...currentTrick].map(play => ({
    ...play,
    playerId: room.players[play.playerIndex].id
  }));

  const protectingTrump = new Card('hearts', '3');
  room.players[2].cards = [protectingTrump, new Card('clubs', '4')];
  const bot = new BotService(BotTypes.WHO_DESIGNED);
  const action = await bot.getBotAction(
    room.gameState,
    room.players[2].cards,
    2,
    room
  );
  assert.deepEqual(action, [protectingTrump.id], 'Bot should trump the exposed 10 before a known-void opponent');
}

const results = [];
await verifyKnownVoidPointProtection();
results.push(await playBotGame('hearts'));
results.push(await playBotGame('no_trump'));
logger.info = originalInfo;
console.log(JSON.stringify(results));
