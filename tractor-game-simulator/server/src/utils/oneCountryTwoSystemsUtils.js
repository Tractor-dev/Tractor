import { Suits } from './constants.js';

const PLAIN_SUITS = new Set([
  Suits.HEARTS,
  Suits.DIAMONDS,
  Suits.CLUBS,
  Suits.SPADES
]);

export function getOneCountryTeamIndex(playerIndex) {
  if (!Number.isInteger(playerIndex) || playerIndex < 0) return null;
  return playerIndex % 2;
}

export function isOneCountryJokerDeclaration(declaration) {
  return declaration?.suit === Suits.JOKER || declaration?.suit === 'joker';
}

function getTeamDeclaration(declarationsByTeam, teamIndex) {
  if (declarationsByTeam instanceof Map) {
    return declarationsByTeam.get(teamIndex) || declarationsByTeam.get(String(teamIndex)) || null;
  }
  return declarationsByTeam?.[teamIndex] || declarationsByTeam?.[String(teamIndex)] || null;
}

export function resolveOneCountryTwoSystems(declarationsByTeam, dealerPlayerIndex) {
  const dealerTeamIndex = getOneCountryTeamIndex(dealerPlayerIndex);
  if (dealerTeamIndex === null) return null;

  const declarations = {
    0: getTeamDeclaration(declarationsByTeam, 0),
    1: getTeamDeclaration(declarationsByTeam, 1)
  };
  const hasJokerDeclaration = Object.values(declarations).some(isOneCountryJokerDeclaration);
  const declaredSuits = Object.values(declarations)
    .map(declaration => declaration?.suit)
    .filter(suit => PLAIN_SUITS.has(suit));
  const uniqueSuits = [...new Set(declaredSuits)];
  const attackerTeamIndex = 1 - dealerTeamIndex;

  if (hasJokerDeclaration || uniqueSuits.length === 0) {
    return {
      dealerTeamIndex,
      attackerTeamIndex,
      dealerSuit: null,
      attackerSuit: null,
      canonicalTrumpSuit: Suits.NO_TRUMP,
      teamTrumpSuits: { 0: null, 1: null },
      hasJokerDeclaration,
      hasDistinctTeamSuits: false,
      isNoTrump: true
    };
  }

  if (uniqueSuits.length === 1) {
    const sharedSuit = uniqueSuits[0];
    return {
      dealerTeamIndex,
      attackerTeamIndex,
      dealerSuit: sharedSuit,
      attackerSuit: sharedSuit,
      canonicalTrumpSuit: sharedSuit,
      teamTrumpSuits: { 0: sharedSuit, 1: sharedSuit },
      hasJokerDeclaration: false,
      hasDistinctTeamSuits: false,
      isNoTrump: false
    };
  }

  const dealerSuit = declarations[dealerTeamIndex]?.suit;
  const attackerSuit = declarations[attackerTeamIndex]?.suit;
  return {
    dealerTeamIndex,
    attackerTeamIndex,
    dealerSuit,
    attackerSuit,
    canonicalTrumpSuit: dealerSuit,
    teamTrumpSuits: {
      0: declarations[0]?.suit || null,
      1: declarations[1]?.suit || null
    },
    hasJokerDeclaration: false,
    hasDistinctTeamSuits: dealerSuit !== attackerSuit,
    isNoTrump: false
  };
}

function cloneCardWithSuit(card, suit) {
  const prototype = Object.getPrototypeOf(card) || Object.prototype;
  return Object.assign(Object.create(prototype), card, {
    suit,
    oneCountryOriginalSuit: card.suit
  });
}

/**
 * 将某名玩家的实体牌投影到庄家方的规范花色坐标。
 * 只有双方亮出不同花色时，闲家方才互换两种花色。
 */
export function mapOneCountryCard(card, playerIndex, resolution) {
  if (!card || !resolution?.hasDistinctTeamSuits) return card;
  const playerTeamIndex = getOneCountryTeamIndex(playerIndex);
  if (playerTeamIndex === null || playerTeamIndex === resolution.dealerTeamIndex) return card;

  if (card.suit === resolution.attackerSuit) {
    return cloneCardWithSuit(card, resolution.dealerSuit);
  }
  if (card.suit === resolution.dealerSuit) {
    return cloneCardWithSuit(card, resolution.attackerSuit);
  }
  return card;
}

export function mapOneCountryCards(cards, playerIndex, resolution) {
  return (cards || []).map(card => mapOneCountryCard(card, playerIndex, resolution));
}

export function serializeOneCountryDeclaration(declaration) {
  if (!declaration) return null;
  return {
    ...declaration,
    cards: (declaration.cards || []).map(card => card?.toJSON ? card.toJSON() : card)
  };
}

export function getOneCountryPublicState(gameState) {
  if (!gameState) return null;
  return {
    declarationsByTeam: Object.fromEntries(
      [0, 1]
        .map(teamIndex => [
          teamIndex,
          serializeOneCountryDeclaration(getTeamDeclaration(
            gameState.oneCountryDeclarationsByTeam,
            teamIndex
          ))
        ])
        .filter(([, declaration]) => declaration)
    ),
    resolved: gameState.oneCountryResolved ? {
      ...gameState.oneCountryResolved,
      teamTrumpSuits: { ...gameState.oneCountryResolved.teamTrumpSuits }
    } : null,
    hasJokerDeclaration: [0, 1].some(teamIndex => isOneCountryJokerDeclaration(
      getTeamDeclaration(gameState.oneCountryDeclarationsByTeam, teamIndex)
    ))
  };
}
