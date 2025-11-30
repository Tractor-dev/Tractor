// 测试WhoDesignedBotService能否正确调用bot
import { WhoDesignedBotService } from './tractor-game-simulator/server/src/services/WhoDesignedBotService.js';
import { Card } from './tractor-game-simulator/server/src/models/Card.js';
import { Suits, Ranks, PlayModes } from './tractor-game-simulator/server/src/utils/constants.js';

console.log('=== 测试WhoDesigned Bot服务 ===\n');

// 创建bot服务实例
const botService = new WhoDesignedBotService();

// 创建测试用的卡牌
function createTestCards() {
  return [
    new Card(Suits.HEARTS, Ranks.ACE, 0),
    new Card(Suits.DIAMONDS, Ranks.TWO, 0),
    new Card(Suits.SPADES, Ranks.THREE, 0),
    new Card(Suits.CLUBS, Ranks.FOUR, 0),
    new Card(Suits.HEARTS, Ranks.FIVE, 0),
    new Card(Suits.DIAMONDS, Ranks.SIX, 0),
    new Card(Suits.SPADES, Ranks.SEVEN, 0),
    new Card(Suits.CLUBS, Ranks.EIGHT, 0),
    new Card(Suits.HEARTS, Ranks.NINE, 0),
    new Card(Suits.DIAMONDS, Ranks.TEN, 0),
  ];
}

// 创建模拟的游戏状态
function createMockGameState() {
  return {
    playMode: PlayModes.ORDERED,
    trumpSuit: Suits.DIAMONDS,
    dealerPlayerIndex: 0,
    currentPlayerIndex: 0,
    currentRoundPlays: [],
    playHistory: [],
    collectedPointCards: {},
    team1Level: 2,
  };
}

// 创建模拟的房间
function createMockRoom() {
  return {
    id: 'test-room',
    config: {
      playMode: PlayModes.ORDERED,
      botType: 'who_designed',
      bottomCardsCount: 8,
    },
    gameState: createMockGameState(),
    players: [
      { id: 'player-0', name: 'Bot1', isBot: true },
      { id: 'player-1', name: 'Bot2', isBot: true },
      { id: 'player-2', name: 'Bot3', isBot: true },
      { id: 'player-3', name: 'Bot4', isBot: true },
    ],
  };
}

async function testDealStage() {
  console.log('测试1: Deal阶段（报主/反主）');
  console.log('-----------------------------------');

  try {
    const gameState = createMockGameState();
    const room = createMockRoom();
    const deliverCards = createTestCards().slice(0, 1); // 发一张牌

    const result = await botService.getBotAction({
      stage: 'deal',
      gameState,
      room,
      playerId: 'player-0',
      playerIndex: 0,
      playerCards: deliverCards,
      deliverCards: deliverCards,
    });

    console.log('✓ Deal阶段调用成功');
    console.log(`  Bot返回: ${JSON.stringify(result)}`);
    console.log(`  返回类型: ${Array.isArray(result) ? '数组' : typeof result}`);
    console.log();
    return true;
  } catch (error) {
    console.log('✗ Deal阶段调用失败');
    console.log(`  错误: ${error.message}`);
    console.log();
    return false;
  }
}

async function testCoverStage() {
  console.log('测试2: Cover阶段（盖底牌）');
  console.log('-----------------------------------');

  // 清空历史，避免受之前测试影响
  botService.clearAllBotHistory();

  try {
    const gameState = createMockGameState();
    const room = createMockRoom();
    const playerCards = createTestCards();
    // deliverCards只包含底牌（8张），bot会自动处理deal阶段的历史
    const deliverCards = playerCards.slice(0, 8);

    const result = await botService.getBotAction({
      stage: 'cover',
      gameState,
      room,
      playerId: 'player-0',
      playerIndex: 0,
      playerCards: playerCards,
      deliverCards: deliverCards,
    });

    console.log('✓ Cover阶段调用成功');
    console.log(`  Bot返回: ${JSON.stringify(result)}`);
    console.log(`  返回卡牌数量: ${result.length}`);
    console.log(`  返回类型: ${Array.isArray(result) ? '数组' : typeof result}`);
    console.log();
    return true;
  } catch (error) {
    console.log('✗ Cover阶段调用失败');
    console.log(`  错误: ${error.message}`);
    console.log();
    return false;
  }
}

async function testPlayStage() {
  console.log('测试3: Play阶段（出牌）');
  console.log('-----------------------------------');

  // 清空历史，避免受之前测试影响
  botService.clearAllBotHistory();

  try {
    const gameState = createMockGameState();
    const room = createMockRoom();
    const playerCards = createTestCards();

    const result = await botService.getBotAction({
      stage: 'play',
      gameState,
      room,
      playerId: 'player-0',
      playerIndex: 0,
      playerCards: playerCards,
      deliverCards: null,
    });

    console.log('✓ Play阶段调用成功');
    console.log(`  Bot返回: ${JSON.stringify(result)}`);
    console.log(`  返回卡牌数量: ${result.length}`);
    console.log(`  返回类型: ${Array.isArray(result) ? '数组' : typeof result}`);
    console.log();
    return true;
  } catch (error) {
    console.log('✗ Play阶段调用失败');
    console.log(`  错误: ${error.message}`);
    console.log();
    return false;
  }
}

// 运行所有测试
async function runAllTests() {
  const results = {
    deal: false,
    cover: false,
    play: false,
  };

  results.deal = await testDealStage();
  results.cover = await testCoverStage();
  results.play = await testPlayStage();

  console.log('=== 测试总结 ===');
  console.log(`Deal阶段:  ${results.deal ? '✓ 通过' : '✗ 失败'}`);
  console.log(`Cover阶段: ${results.cover ? '✓ 通过' : '✗ 失败'}`);
  console.log(`Play阶段:  ${results.play ? '✓ 通过' : '✗ 失败'}`);

  const allPassed = results.deal && results.cover && results.play;
  console.log(`\n总体结果: ${allPassed ? '✓ 全部通过' : '✗ 部分或全部失败'}`);

  process.exit(allPassed ? 0 : 1);
}

// 执行测试
runAllTests().catch(error => {
  console.error('测试运行出错:', error);
  process.exit(1);
});
