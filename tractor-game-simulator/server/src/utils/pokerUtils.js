import { Ranks, Suits, STANDARD_ORDINARY_RANKS } from './constants.js';

const POKER_SUITS = new Set([
  Suits.HEARTS,
  Suits.DIAMONDS,
  Suits.CLUBS,
  Suits.SPADES
]);

const POKER_RANK_VALUES = Object.freeze({
  [Ranks.TWO]: 2,
  [Ranks.THREE]: 3,
  [Ranks.FOUR]: 4,
  [Ranks.FIVE]: 5,
  [Ranks.SIX]: 6,
  [Ranks.SEVEN]: 7,
  [Ranks.EIGHT]: 8,
  [Ranks.NINE]: 9,
  [Ranks.TEN]: 10,
  [Ranks.JACK]: 11,
  [Ranks.QUEEN]: 12,
  [Ranks.KING]: 13,
  [Ranks.ACE]: 14
});

export const POKER_CATEGORY_NAMES = Object.freeze([
  '高牌',
  '一对',
  '两对',
  '三条',
  '顺子',
  '同花',
  '葫芦',
  '四条',
  '同花顺',
  '五条'
]);

export function comparePokerScores(left, right) {
  const length = Math.max(left?.length || 0, right?.length || 0);
  for (let index = 0; index < length; index++) {
    const difference = (left?.[index] || 0) - (right?.[index] || 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

function getStraightHighCard(rankValues) {
  const uniqueRanks = [...new Set(rankValues)].sort((left, right) => right - left);
  if (uniqueRanks.length !== 5) return null;
  if (
    uniqueRanks[0] === 14
    && uniqueRanks[1] === 5
    && uniqueRanks[2] === 4
    && uniqueRanks[3] === 3
    && uniqueRanks[4] === 2
  ) {
    return 5;
  }
  return uniqueRanks[0] - uniqueRanks[4] === 4 ? uniqueRanks[0] : null;
}

function evaluateResolvedFiveCardPokerHand(cards) {
  if (!Array.isArray(cards) || cards.length !== 5) return null;
  const rankValues = cards.map(card => POKER_RANK_VALUES[card?.rank]);
  if (rankValues.some(value => !value) || cards.some(card => !POKER_SUITS.has(card?.suit))) {
    return null;
  }

  const rankCounts = new Map();
  rankValues.forEach(value => rankCounts.set(value, (rankCounts.get(value) || 0) + 1));
  const groups = [...rankCounts.entries()]
    .map(([rank, count]) => ({ rank, count }))
    .sort((left, right) => right.count - left.count || right.rank - left.rank);
  const sortedRanks = [...rankValues].sort((left, right) => right - left);
  const isFlush = cards.every(card => card.suit === cards[0].suit);
  const straightHighCard = getStraightHighCard(rankValues);

  let category = 0;
  let tieBreak = sortedRanks;
  if (groups[0].count === 5) {
    category = 9;
    tieBreak = [groups[0].rank];
  } else if (isFlush && straightHighCard) {
    category = 8;
    tieBreak = [straightHighCard];
  } else if (groups[0].count === 4) {
    category = 7;
    tieBreak = [groups[0].rank, groups[1].rank];
  } else if (groups[0].count === 3 && groups[1].count === 2) {
    category = 6;
    tieBreak = [groups[0].rank, groups[1].rank];
  } else if (isFlush) {
    category = 5;
  } else if (straightHighCard) {
    category = 4;
    tieBreak = [straightHighCard];
  } else if (groups[0].count === 3) {
    category = 3;
    tieBreak = [
      groups[0].rank,
      ...groups.filter(group => group.count === 1).map(group => group.rank).sort((a, b) => b - a)
    ];
  } else if (groups[0].count === 2 && groups[1].count === 2) {
    category = 2;
    const pairRanks = groups
      .filter(group => group.count === 2)
      .map(group => group.rank)
      .sort((a, b) => b - a);
    tieBreak = [pairRanks[0], pairRanks[1], groups.find(group => group.count === 1).rank];
  } else if (groups[0].count === 2) {
    category = 1;
    tieBreak = [
      groups[0].rank,
      ...groups.filter(group => group.count === 1).map(group => group.rank).sort((a, b) => b - a)
    ];
  }

  return {
    category,
    categoryName: POKER_CATEGORY_NAMES[category],
    score: [category, ...tieBreak],
    cards: [...cards]
  };
}

function resolvePokerWildcards(cards) {
  const jokers = cards.filter(card => card?.suit === Suits.JOKER);
  if (jokers.length === 0) return evaluateResolvedFiveCardPokerHand(cards);

  const ordinaryCards = cards.filter(card => card?.suit !== Suits.JOKER);
  if (ordinaryCards.some(card => !POKER_SUITS.has(card?.suit) || !POKER_RANK_VALUES[card?.rank])) {
    return null;
  }

  // 花色只会影响同花与同花顺。普通牌同花时，让所有王补成该花色即可覆盖最优解；
  // 普通牌花色不一致时无论怎样转换王都无法组成同花，使用固定花色即可。
  const wildcardSuit = ordinaryCards.length > 0
    && ordinaryCards.every(card => card.suit === ordinaryCards[0].suit)
    ? ordinaryCards[0].suit
    : Suits.HEARTS;
  const jokerIndexes = cards
    .map((card, index) => card?.suit === Suits.JOKER ? index : -1)
    .filter(index => index >= 0);
  const candidateCards = [...cards];
  let bestHand = null;

  // 四张王已经可以把唯一普通牌补成五条；五张全是王时直接取最高的五条 A。
  // 这是牌型的理论上限，也避免特殊牌堆下对 13^5 种等价替代做无谓枚举。
  if (jokers.length >= 4) {
    const targetRank = ordinaryCards[0]?.rank || Ranks.ACE;
    const resolvedCards = cards.map(card => card?.suit === Suits.JOKER ? {
      ...card,
      suit: wildcardSuit,
      rank: targetRank,
      originalSuit: card.originalSuit || card.suit,
      originalRank: card.originalRank || card.rank,
      secondBattlefieldWildcard: true
    } : card);
    return evaluateResolvedFiveCardPokerHand(resolvedCards);
  }

  const visit = jokerIndex => {
    if (jokerIndex === jokerIndexes.length) {
      const candidate = evaluateResolvedFiveCardPokerHand(candidateCards);
      if (!bestHand || comparePokerScores(candidate.score, bestHand.score) > 0) {
        bestHand = candidate;
      }
      return;
    }

    const cardIndex = jokerIndexes[jokerIndex];
    const sourceCard = cards[cardIndex];
    for (const rank of STANDARD_ORDINARY_RANKS) {
      candidateCards[cardIndex] = {
        ...sourceCard,
        suit: wildcardSuit,
        rank,
        originalSuit: sourceCard.originalSuit || sourceCard.suit,
        originalRank: sourceCard.originalRank || sourceCard.rank,
        secondBattlefieldWildcard: true
      };
      visit(jokerIndex + 1);
    }
    candidateCards[cardIndex] = sourceCard;
  };

  visit(0);
  return bestHand;
}

export function evaluateFiveCardPokerHand(cards) {
  if (!Array.isArray(cards) || cards.length !== 5) return null;
  return resolvePokerWildcards(cards);
}

export function evaluateBestPokerHand(cards) {
  // 原牌局使用双副牌，因此同花色同点数的两个实体仍分别参与牌型；所有王均作万能牌。
  const eligibleCards = (cards || []).filter(
    card => (
      (POKER_SUITS.has(card?.suit) && POKER_RANK_VALUES[card?.rank])
      || card?.suit === Suits.JOKER
    )
  );
  if (eligibleCards.length < 5) return null;

  let bestHand = null;
  const selected = [];
  const visit = startIndex => {
    if (selected.length === 5) {
      const candidate = evaluateFiveCardPokerHand(selected);
      if (!bestHand || comparePokerScores(candidate.score, bestHand.score) > 0) {
        bestHand = candidate;
      }
      return;
    }
    const cardsNeeded = 5 - selected.length;
    for (let index = startIndex; index <= eligibleCards.length - cardsNeeded; index++) {
      selected.push(eligibleCards[index]);
      visit(index + 1);
      selected.pop();
    }
  };
  visit(0);
  return bestHand;
}
