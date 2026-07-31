import { Suits, Ranks, RANK_ORDER, SUIT_ORDER } from '../utils/constants.js';

export class Card {
  constructor(suit, rank, copyIndex = 0) {
    this.id = `${suit}-${rank}-${copyIndex}`;
    this.suit = suit;
    this.rank = rank;
    this.value = this.calculateValue();
    this.displayOrder = 0;
    this.isShown = false;
    this.originalSuit = null;
    this.originalRank = null;
    this.isLastStandTrump = false;
    this.isDivineWeaponTransformed = false;
    this.divineWeaponCardId = null;
    this.isStrengthCompensated = false;
    this.strengthCompensationDelta = 0;
    this.isDefenseAsOffenseBoosted = false;
    this.defenseAsOffenseDelta = 0;
    this.isTeammateCheered = false;
    this.isAfterglowBoosted = false;
    this.isUnarmed = false;
    this.isRiceToMulberryTransformed = false;
    this.isNinePrincesPromoted = false;
    this.ninePrincesPromotionCount = 0;
    this.ninePrincesPermanentSuit = null;
    this.ninePrincesPermanentRank = null;
    this.ninePrincesScoringSuit = null;
    this.ninePrincesScoringRank = null;
  }

  calculateValue() {
    const suitValue = SUIT_ORDER[this.suit] * 1000;
    const rankValue = RANK_ORDER[this.rank] || 0;
    return suitValue + rankValue;
  }

  toJSON() {
    return {
      id: this.id,
      suit: this.suit,
      rank: this.rank,
      value: this.value,
      displayOrder: this.displayOrder,
      isShown: this.isShown,
      ...(this.originalSuit ? { originalSuit: this.originalSuit } : {}),
      ...(this.originalRank ? { originalRank: this.originalRank } : {}),
      ...(this.isDivineWeaponTransformed ? { isDivineWeaponTransformed: true } : {}),
      ...(this.divineWeaponCardId ? { divineWeaponCardId: this.divineWeaponCardId } : {}),
      ...(this.isStrengthCompensated ? {
        isStrengthCompensated: true,
        strengthCompensationDelta: this.strengthCompensationDelta
      } : {}),
      ...(this.isDefenseAsOffenseBoosted ? {
        isDefenseAsOffenseBoosted: true,
        defenseAsOffenseDelta: this.defenseAsOffenseDelta
      } : {}),
      ...(this.isTeammateCheered ? { isTeammateCheered: true } : {}),
      ...(this.isAfterglowBoosted ? { isAfterglowBoosted: true } : {}),
      ...(this.isUnarmed ? { isUnarmed: true } : {}),
      ...(this.isRiceToMulberryTransformed ? { isRiceToMulberryTransformed: true } : {}),
      ...(this.isNinePrincesPromoted ? {
        isNinePrincesPromoted: true,
        ninePrincesPromotionCount: this.ninePrincesPromotionCount,
        ninePrincesPermanentSuit: this.ninePrincesPermanentSuit,
        ninePrincesPermanentRank: this.ninePrincesPermanentRank,
        ninePrincesScoringSuit: this.ninePrincesScoringSuit,
        ninePrincesScoringRank: this.ninePrincesScoringRank
      } : {}),
      ...(this.isLastStandTrump ? { isLastStandTrump: true } : {})
    };
  }
}
