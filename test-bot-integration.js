// 测试bot集成的脚本
import { CardNumberingSystem } from './tractor-game-simulator/server/src/utils/cardNumbering.js';
import { Card } from './tractor-game-simulator/server/src/models/Card.js';
import { Suits, Ranks } from './tractor-game-simulator/server/src/utils/constants.js';

console.log('=== 测试卡牌编号系统 ===\n');

// 测试1: 基本编号转换
console.log('测试1: 基本编号转换');
const testCards = [
  new Card(Suits.HEARTS, Ranks.ACE, 0),    // 应该是 0
  new Card(Suits.DIAMONDS, Ranks.ACE, 0),  // 应该是 1
  new Card(Suits.SPADES, Ranks.ACE, 0),    // 应该是 2
  new Card(Suits.CLUBS, Ranks.ACE, 0),     // 应该是 3
  new Card(Suits.HEARTS, Ranks.TWO, 0),    // 应该是 4
  new Card(Suits.JOKER, Ranks.SMALL_JOKER, 0), // 应该是 52
  new Card(Suits.JOKER, Ranks.BIG_JOKER, 0),   // 应该是 53
  new Card(Suits.HEARTS, Ranks.ACE, 1),    // 应该是 54 (第二副牌)
];

const expectedNumbers = [0, 1, 2, 3, 4, 52, 53, 54];

for (let i = 0; i < testCards.length; i++) {
  const card = testCards[i];
  const number = CardNumberingSystem.cardToNumber(card);
  const expected = expectedNumbers[i];
  const status = number === expected ? '✓' : '✗';
  console.log(`  ${status} ${card.suit}-${card.rank}-${CardNumberingSystem._getCopyIndex(card.id)} => ${number} (期望: ${expected})`);
}

// 测试2: 反向转换
console.log('\n测试2: 反向转换');
const testNumbers = [0, 1, 52, 53, 54, 107];
for (const num of testNumbers) {
  const cardInfo = CardNumberingSystem.numberToCard(num);
  console.log(`  ${num} => ${cardInfo.suit}-${cardInfo.rank}-${cardInfo.copyIndex}`);
}

// 测试3: 完整循环测试（0-107）
console.log('\n测试3: 完整循环测试 (0-107)');
let errors = 0;
for (let i = 0; i < 108; i++) {
  try {
    const cardInfo = CardNumberingSystem.numberToCard(i);
    // 创建对应的Card对象
    const card = new Card(cardInfo.suit, cardInfo.rank, cardInfo.copyIndex);
    const number = CardNumberingSystem.cardToNumber(card);
    if (number !== i) {
      console.log(`  ✗ 错误: ${i} -> ${cardInfo.suit}-${cardInfo.rank}-${cardInfo.copyIndex} -> ${number}`);
      errors++;
    }
  } catch (e) {
    console.log(`  ✗ 编号 ${i} 转换失败: ${e.message}`);
    errors++;
  }
}
if (errors === 0) {
  console.log('  ✓ 所有108张牌的双向转换都正确');
} else {
  console.log(`  ✗ 发现 ${errors} 个错误`);
}

console.log('\n=== 测试完成 ===');
