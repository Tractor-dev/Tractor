import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateCardPoints,
  getCandleCardColor,
  getCandleToDawnCardPoints,
  getDisplayedCandleState,
  getScoringDisplayCard,
  getOddEvenRoundMultiplier,
  getCardPoints,
  getMeticulousAccountingCardPoints
} from '../src/utils/scoringUtils.js';

test('左上角计分区把取长补短牌还原为实体牌面', () => {
  const transformedCard = {
    id: 'spades-A-0',
    suit: 'hearts',
    rank: '2',
    originalSuit: 'spades',
    originalRank: 'A',
    isStrengthCompensated: true,
    strengthCompensationDelta: 1
  };

  const displayedCard = getScoringDisplayCard(transformedCard);

  assert.equal(displayedCard.suit, 'spades');
  assert.equal(displayedCard.rank, 'A');
  assert.equal(displayedCard.isStrengthCompensated, false);
  assert.equal(displayedCard.strengthCompensationDelta, 0);
  assert.equal(displayedCard.originalSuit, null);
  assert.equal(displayedCard.originalRank, null);
  assert.equal(transformedCard.suit, 'hearts');
  assert.equal(transformedCard.rank, '2');

  const ordinaryCard = { id: 'diamonds-5-0', suit: 'diamonds', rank: '5' };
  assert.equal(getScoringDisplayCard(ordinaryCard), ordinaryCard);
});

test('九子夺嫡永久改牌面但计分区和分值仍读取开局实体牌面', () => {
  const promotedCard = {
    id: 'hearts-4-0',
    suit: 'hearts',
    rank: '5',
    isNinePrincesPromoted: true,
    ninePrincesPromotionCount: 1,
    ninePrincesPermanentSuit: 'hearts',
    ninePrincesPermanentRank: '5',
    ninePrincesScoringSuit: 'hearts',
    ninePrincesScoringRank: '4'
  };

  assert.equal(getCardPoints(promotedCard), 0);
  assert.equal(getScoringDisplayCard(promotedCard).rank, '4');
});

test('三人成虎只改本轮牌力，中央计分仍读取实体牌点', () => {
  const transformedFive = {
    id: 'hearts-5-0',
    suit: 'hearts',
    rank: '1',
    originalSuit: 'hearts',
    originalRank: '5',
    isThreeTigersTransformed: true,
    isThreeTigersTrump: true
  };
  const transformedTen = {
    id: 'hearts-10-0',
    suit: 'hearts',
    rank: '6',
    originalSuit: 'hearts',
    originalRank: '10',
    isThreeTigersTransformed: true,
    isThreeTigersTrump: true
  };

  assert.equal(getCardPoints(transformedFive), 5);
  assert.equal(getCardPoints(transformedTen), 10);
  assert.equal(calculateCardPoints([transformedFive, transformedTen]), 15);
});

test('改稻为桑牌无论新牌面为何都永久计0分', () => {
  const transformedAce = {
    suit: 'clubs',
    rank: 'A',
    originalSuit: 'clubs',
    originalRank: 'K',
    isRiceToMulberryTransformed: true
  };
  const transformedBigJoker = {
    suit: 'joker',
    rank: 'big_joker',
    originalSuit: 'hearts',
    originalRank: '10',
    isRiceToMulberryTransformed: true
  };

  assert.equal(getCardPoints(transformedAce), 0);
  assert.equal(getCardPoints(transformedBigJoker), 0);
  assert.equal(calculateCardPoints([transformedAce, transformedBigJoker]), 0);
});

test('锱铢必较在客户端按A至7分别显示1至7分', () => {
  const cards = ['A', '2', '3', '4', '5', '6', '7', '8', '10', 'K']
    .map((rank, index) => ({ id: `hearts-${rank}-${index}`, suit: 'hearts', rank }));

  assert.deepEqual(
    cards.map(getMeticulousAccountingCardPoints),
    [1, 2, 3, 4, 5, 6, 7, 0, 0, 0]
  );
  assert.equal(calculateCardPoints(cards, getMeticulousAccountingCardPoints), 28);
});

test('无独有偶的奇数轮为0倍、偶数轮为2倍，其他规则保持原分', () => {
  const rule = { id: 'odd_even_scoring' };
  assert.equal(getOddEvenRoundMultiplier(rule, 1), 0);
  assert.equal(getOddEvenRoundMultiplier(rule, 2), 2);
  assert.equal(getOddEvenRoundMultiplier(rule, 17), 0);
  assert.equal(getOddEvenRoundMultiplier(rule, 18), 2);
  assert.equal(getOddEvenRoundMultiplier({ id: 'normal_game' }, 1), 1);
});

test('烛尽天明按烛态给红黑分牌每张加减5分，并正确识别大小王颜色', () => {
  const redFive = { suit: 'hearts', rank: '5' };
  const blackFive = { suit: 'clubs', rank: '5' };
  const redKing = { suit: 'diamonds', rank: 'K' };
  const blackTen = { suit: 'spades', rank: '10' };

  assert.equal(getCandleToDawnCardPoints(redFive, true), 10);
  assert.equal(getCandleToDawnCardPoints(blackFive, true), 0);
  assert.equal(getCandleToDawnCardPoints(redKing, true), 15);
  assert.equal(getCandleToDawnCardPoints(blackTen, true), 5);
  assert.equal(getCandleToDawnCardPoints(redFive, false), 0);
  assert.equal(getCandleToDawnCardPoints(blackFive, false), 10);
  assert.equal(getCandleCardColor({ suit: 'joker', rank: 'small_joker' }), 'black');
  assert.equal(getCandleCardColor({ suit: 'joker', rank: 'big_joker' }), 'red');
});

test('烛态在轮末四家牌面清除前保持旧值，清桌后才切换到下轮', () => {
  const candleToDawn = {
    isLit: false,
    lastTransition: {
      round: 1,
      previousLit: true,
      nextLit: false,
      changed: true
    }
  };

  assert.deepEqual(
    getDisplayedCandleState({
      candleToDawn,
      currentRound: 2,
      visiblePlayCount: 4,
      playerCount: 4
    }),
    { round: 1, isLit: true, holdsCompletedRound: true }
  );
  // room_updated 先促使重渲染、第四手的 React state 尚未提交时，
  // 同步轮次快照仍必须将中央分数锁在第1轮烛态。
  assert.deepEqual(
    getDisplayedCandleState({
      candleToDawn,
      currentRound: 2,
      displayRoundNumber: 1,
      visiblePlayCount: 3,
      playerCount: 4
    }),
    { round: 1, isLit: true, holdsCompletedRound: true }
  );
  assert.deepEqual(
    getDisplayedCandleState({
      candleToDawn,
      currentRound: 2,
      heldRoundCandle: { round: 1, isLit: true },
      visiblePlayCount: 1,
      playerCount: 4
    }),
    { round: 1, isLit: true, holdsCompletedRound: true }
  );
  assert.deepEqual(
    getDisplayedCandleState({
      candleToDawn: {
        isLit: false,
        lastTransition: null
      },
      currentRound: 2,
      displayRoundNumber: 2,
      heldRoundCandle: { round: 1, isLit: true },
      visiblePlayCount: 0,
      playerCount: 4
    }),
    { round: 1, isLit: true, holdsCompletedRound: true }
  );
  assert.deepEqual(
    getDisplayedCandleState({
      candleToDawn,
      currentRound: 2,
      visiblePlayCount: 0,
      playerCount: 4
    }),
    { round: 2, isLit: false, holdsCompletedRound: false }
  );
});
