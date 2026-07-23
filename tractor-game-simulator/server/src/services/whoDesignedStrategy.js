import { BotTypes, Ranks, Suits, normalizeRank } from '../utils/constants.js';
import { isTrumpCard } from '../utils/cardPatternUtils.js';

const STANDARD_SUITS = Object.freeze([
  Suits.SPADES,
  Suits.HEARTS,
  Suits.CLUBS,
  Suits.DIAMONDS
]);

const RANK_ORDER = Object.freeze([
  Ranks.TWO,
  Ranks.THREE,
  Ranks.FOUR,
  Ranks.FIVE,
  Ranks.SIX,
  Ranks.SEVEN,
  Ranks.EIGHT,
  Ranks.NINE,
  Ranks.TEN,
  Ranks.JACK,
  Ranks.QUEEN,
  Ranks.KING,
  Ranks.ACE
]);

const POINT_RANKS = new Set([Ranks.FIVE, Ranks.TEN, Ranks.KING]);

function evaluateSuit(cards, trumpRank) {
  const counts = new Map();
  cards.forEach(card => counts.set(card.rank, (counts.get(card.rank) || 0) + 1));

  let score = 0;
  for (const [rank, count] of counts) {
    const isPair = count >= 2;
    score += isPair ? 2.2 : 1;
    if (rank === trumpRank) {
      score += isPair ? 1 : 0.5;
      continue;
    }

    const rankIndex = RANK_ORDER.indexOf(rank);
    if (rankIndex >= 8) {
      score += (isPair ? 0.2 : 0.1) * (rankIndex - 7);
    }
  }
  return score;
}

/**
 * Port of WhoDesigned/myutils.py call_Snatch for the normal four-suit game.
 * The original strategy deliberately does not call no-trump.
 */
export function chooseWhoDesignedTrumpDeclaration({
  cards,
  trumpRank,
  currentTrumpDeclaration = null,
  playerId = null
}) {
  const level = normalizeRank(trumpRank);
  if (!RANK_ORDER.includes(level) || !Array.isArray(cards) || cards.length === 0) {
    return null;
  }

  const levelSuitCounts = new Map();
  const scoredSuits = STANDARD_SUITS.map(suit => {
    const suitCards = cards.filter(card => card.suit === suit);
    levelSuitCounts.set(
      suit,
      suitCards.filter(card => card.rank === level).length
    );
    return { suit, score: evaluateSuit(suitCards, level) };
  }).sort((a, b) => b.score - a.score);

  if (!currentTrumpDeclaration) {
    const candidate = scoredSuits.find(
      ({ suit, score }) => levelSuitCounts.get(suit) >= 1 && score >= 5.6
    );
    return candidate ? { suit: candidate.suit, count: 1 } : null;
  }

  // call_Snatch only counters an initial single declaration. The server may
  // support stronger DLC declarations, but those are outside this bot's model.
  if (currentTrumpDeclaration.strength >= 2) return null;

  const currentSuitScore = scoredSuits.find(
    item => item.suit === currentTrumpDeclaration.suit
  )?.score ?? 0;
  const candidate = scoredSuits.find(({ suit, score }) => {
    if (levelSuitCounts.get(suit) < 2) return false;
    if (
      playerId
      && currentTrumpDeclaration.playerId === playerId
      && currentTrumpDeclaration.suit !== suit
    ) return false;
    return currentSuitScore <= 4 || score >= currentSuitScore + 0.5;
  });

  return candidate ? { suit: candidate.suit, count: 2 } : null;
}

function cardRankIndex(card) {
  const index = RANK_ORDER.indexOf(card.rank);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function sortLowCards(cards) {
  return [...cards].sort((a, b) => (
    cardRankIndex(a) - cardRankIndex(b)
    || String(a.id).localeCompare(String(b.id))
  ));
}

/**
 * Port of move_generator.cover_Pub's priorities, generalized to the room's
 * configured bottom-card count.
 */
export function chooseWhoDesignedCardsToBury(
  cards,
  requiredCount,
  trumpSuit,
  trumpRank
) {
  if (!Array.isArray(cards) || requiredCount <= 0) return [];

  const selected = [];
  const selectedIds = new Set();
  const add = card => {
    if (!card || selectedIds.has(card.id) || selected.length >= requiredCount) return false;
    selected.push(card);
    selectedIds.add(card.id);
    return true;
  };

  const sideSuitGroups = STANDARD_SUITS
    .filter(suit => suit !== trumpSuit)
    .map(suit => {
      const suitCards = sortLowCards(
        cards.filter(card => (
          card.suit === suit
          && !isTrumpCard(card, trumpSuit, trumpRank)
        ))
      );
      const counts = new Map();
      suitCards.forEach(card => counts.set(card.rank, (counts.get(card.rank) || 0) + 1));
      return {
        suit,
        singles: suitCards.filter(card => (counts.get(card.rank) || 0) === 1),
        pairs: suitCards.filter(card => (counts.get(card.rank) || 0) >= 2)
      };
    });

  // First make short side suits void with low, non-point singletons.
  [...sideSuitGroups]
    .sort((a, b) => (
      a.singles.filter(card => !POINT_RANKS.has(card.rank) && card.rank !== Ranks.ACE).length
      - b.singles.filter(card => !POINT_RANKS.has(card.rank) && card.rank !== Ranks.ACE).length
    ))
    .forEach(group => {
      group.singles
        .filter(card => !POINT_RANKS.has(card.rank) && card.rank !== Ranks.ACE)
        .forEach(add);
    });

  // The original bot next sacrifices isolated point cards, one suit at a time.
  [...sideSuitGroups]
    .sort((a, b) => a.singles.length - b.singles.length)
    .forEach(group => {
      group.singles.filter(card => POINT_RANKS.has(card.rank)).forEach(add);
    });

  // Break low, non-point side pairs only when there is room for both cards.
  [...sideSuitGroups]
    .sort((a, b) => a.pairs.length - b.pairs.length)
    .forEach(group => {
      const ranks = [...new Set(
        group.pairs
          .filter(card => !POINT_RANKS.has(card.rank) && card.rank !== Ranks.ACE)
          .map(card => card.rank)
      )];
      ranks.forEach(rank => {
        if (requiredCount - selected.length < 2) return;
        group.pairs.filter(card => card.rank === rank).slice(0, 2).forEach(add);
      });
    });

  // If still short, give up low non-point trump singletons before protected
  // pairs and high/value cards.
  const trumpCards = sortLowCards(
    cards.filter(card => isTrumpCard(card, trumpSuit, trumpRank))
  );
  const trumpCounts = new Map();
  trumpCards.forEach(card => {
    const key = `${card.suit}:${card.rank}`;
    trumpCounts.set(key, (trumpCounts.get(key) || 0) + 1);
  });
  trumpCards
    .filter(card => (
      (trumpCounts.get(`${card.suit}:${card.rank}`) || 0) === 1
      && !POINT_RANKS.has(card.rank)
      && card.suit !== Suits.JOKER
      && card.rank !== trumpRank
    ))
    .forEach(add);

  // Defensive completion for unusual rules/hands. Keep the same broad
  // priorities: side cards, non-points, low cards, then trumps.
  [...cards]
    .filter(card => !selectedIds.has(card.id))
    .sort((a, b) => {
      const aTrump = isTrumpCard(a, trumpSuit, trumpRank) ? 1 : 0;
      const bTrump = isTrumpCard(b, trumpSuit, trumpRank) ? 1 : 0;
      if (aTrump !== bTrump) return aTrump - bTrump;
      const aPoint = POINT_RANKS.has(a.rank) ? 1 : 0;
      const bPoint = POINT_RANKS.has(b.rank) ? 1 : 0;
      if (aPoint !== bPoint) return aPoint - bPoint;
      return cardRankIndex(a) - cardRankIndex(b);
    })
    .forEach(add);

  return selected.slice(0, requiredCount);
}

export function shouldUseWhoDesignedStrategy(room) {
  return room?.config?.botType === BotTypes.WHO_DESIGNED;
}
