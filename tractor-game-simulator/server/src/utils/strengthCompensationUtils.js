import { EXTENDED_ORDINARY_RANKS, Ranks, Suits } from './constants.js';

const STANDARD_SUITS = Object.freeze([
  Suits.HEARTS,
  Suits.DIAMONDS,
  Suits.CLUBS,
  Suits.SPADES
]);

function getDelta(delta) {
  return Number.isFinite(Number(delta)) ? Math.trunc(Number(delta)) : 0;
}

function shiftWithin(rank, direction, ranks) {
  const index = ranks.indexOf(rank);
  if (index === -1) return rank;
  return ranks[Math.max(0, Math.min(ranks.length - 1, index + direction))];
}

function getOrdinaryRanks(trumpRank, includeF) {
  return EXTENDED_ORDINARY_RANKS.filter(rank => (
    String(rank) !== String(trumpRank)
    && (includeF || rank !== Ranks.FIFTEEN)
  ));
}

function hasSuitTrump(trumpSuit) {
  return STANDARD_SUITS.includes(trumpSuit);
}

function getViceSuit(trumpSuit) {
  return STANDARD_SUITS.find(suit => suit !== trumpSuit) || Suits.HEARTS;
}

function shiftFaceOnce(face, trumpSuit, trumpRank, direction) {
  const suitedTrump = hasSuitTrump(trumpSuit);

  if (face.rank === Ranks.NO_TRUMP_MINUS) {
    return direction > 0
      ? { suit: face.suit, rank: trumpRank }
      : face;
  }

  if (face.rank === Ranks.WHITE_JOKER) {
    return direction < 0
      ? { suit: Suits.JOKER, rank: Ranks.BIG_JOKER }
      : face;
  }
  if (face.rank === Ranks.BIG_JOKER) {
    return {
      suit: Suits.JOKER,
      rank: direction > 0 ? Ranks.WHITE_JOKER : Ranks.SMALL_JOKER
    };
  }
  if (face.rank === Ranks.SMALL_JOKER) {
    if (direction > 0) return { suit: Suits.JOKER, rank: Ranks.BIG_JOKER };
    return {
      suit: suitedTrump ? trumpSuit : Suits.HEARTS,
      rank: trumpRank
    };
  }

  const isLevelCard = String(face.rank) === String(trumpRank);
  if (isLevelCard) {
    const isMainLevel = suitedTrump && face.suit === trumpSuit;
    if (direction > 0) {
      if (isMainLevel || !suitedTrump) {
        return { suit: Suits.JOKER, rank: Ranks.SMALL_JOKER };
      }
      return { suit: trumpSuit, rank: trumpRank };
    }

    if (isMainLevel) {
      return { suit: getViceSuit(trumpSuit), rank: trumpRank };
    }
    if (!suitedTrump) {
      return { suit: face.suit, rank: Ranks.NO_TRUMP_MINUS };
    }
    const targetSuit = trumpSuit;
    const targetRanks = getOrdinaryRanks(trumpRank, false);
    return { suit: targetSuit, rank: targetRanks[targetRanks.length - 1] };
  }

  if (suitedTrump && face.suit === trumpSuit) {
    const mainRanks = getOrdinaryRanks(trumpRank, false);
    const nextRank = shiftWithin(face.rank, direction, mainRanks);
    if (direction > 0 && face.rank === mainRanks[mainRanks.length - 1]) {
      return { suit: getViceSuit(trumpSuit), rank: trumpRank };
    }
    return { suit: face.suit, rank: nextRank };
  }

  const sideRanks = getOrdinaryRanks(trumpRank, true);
  return {
    suit: face.suit,
    rank: shiftWithin(face.rank, direction, sideRanks)
  };
}

/**
 * 沿当前牌局的真实牌力序列移动牌面。主牌链为：
 * 有花色主牌链：主普通牌 < 副级牌 < 主级牌 < 小王 < 大王 < 白王。
 * 无主主牌链：M（Minus）< 无主级牌 < 小王 < 大王 < 白王。
 * 副牌始终留在副牌类别内，跳过级牌点数，A 之上使用 F，绝不跨入主牌链。
 */
export function shiftStrengthCompensationCardFace(card, trumpSuit, trumpRank, delta) {
  const numericDelta = getDelta(delta);
  let face = { suit: card.suit, rank: card.rank };
  const direction = Math.sign(numericDelta);
  for (let step = 0; step < Math.abs(numericDelta); step++) {
    face = shiftFaceOnce(face, trumpSuit, trumpRank, direction);
  }
  return face;
}
