import { Card } from '../models/Card.js';
import { Suits, Ranks } from '../utils/constants.js';

export class DeckService {
  /**
   * 创建108张牌（2副牌 + 大小王各2张）
   */
  static createDeck() {
    const deck = [];
    const suits = [Suits.HEARTS, Suits.DIAMONDS, Suits.CLUBS, Suits.SPADES];
    const ranks = [
      Ranks.TWO, Ranks.THREE, Ranks.FOUR, Ranks.FIVE,
      Ranks.SIX, Ranks.SEVEN, Ranks.EIGHT, Ranks.NINE,
      Ranks.TEN, Ranks.JACK, Ranks.QUEEN, Ranks.KING, Ranks.ACE
    ];

    // 两副普通牌 (2 × 52 = 104张)
    for (let copy = 0; copy < 2; copy++) {
      for (const suit of suits) {
        for (const rank of ranks) {
          deck.push(new Card(suit, rank, copy));
        }
      }
    }

    // 大小王各2张 (4张)
    for (let i = 0; i < 2; i++) {
      deck.push(new Card(Suits.JOKER, Ranks.SMALL_JOKER, i));
      deck.push(new Card(Suits.JOKER, Ranks.BIG_JOKER, i));
    }

    return deck; // 总共108张
  }

  /**
   * “八王议政”：在标准两副牌中额外加入两张郡王和两张亲王。
   * 两种扩展王各自沿用 0/1 的副本编号，保证实体牌 ID 唯一且稳定。
   */
  static addEightKingsCouncilCards(deck) {
    const expandedDeck = [...deck];
    for (let copyIndex = 0; copyIndex < 2; copyIndex++) {
      expandedDeck.push(new Card(Suits.JOKER, Ranks.COUNTY_PRINCE_JOKER, copyIndex));
      expandedDeck.push(new Card(Suits.JOKER, Ranks.PRINCE_JOKER, copyIndex));
    }
    return expandedDeck;
  }

  /**
   * Fisher-Yates 洗牌算法
   */
  static shuffle(deck) {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  static transformSpadesToHearts(deck) {
    return deck.map(card => {
      if (card.suit === Suits.SPADES) {
        card.originalSuit = Suits.SPADES;
        card.suit = Suits.HEARTS;
        card.value = card.calculateValue();
      }
      return card;
    });
  }

  /**
   * “王上加白”：从当前牌堆的四张普通王中随机选择一张，永久改为白王。
   * 保留实体牌 ID，避免同一张牌在发牌、换牌和出牌记录中的身份发生变化。
   */
  static transformRandomJokerToWhite(deck, random = Math.random) {
    const ordinaryJokers = deck.filter(card => (
      card.suit === Suits.JOKER
      && [Ranks.SMALL_JOKER, Ranks.BIG_JOKER].includes(card.rank)
    ));
    if (ordinaryJokers.length === 0) return deck;

    const sample = Number(random());
    const boundedSample = Number.isFinite(sample)
      ? Math.min(0.999999999, Math.max(0, sample))
      : 0;
    const selectedJoker = ordinaryJokers[
      Math.floor(boundedSample * ordinaryJokers.length)
    ];
    selectedJoker.rank = Ranks.WHITE_JOKER;
    selectedJoker.value = selectedJoker.calculateValue();
    return deck;
  }

  static prepareUnarmedDeck(deck) {
    return deck
      .filter(card => card.suit !== Suits.JOKER)
      .map(card => {
        card.isUnarmed = true;
        return card;
      });
  }

  /**
   * 准备发牌：分离底牌和剩余牌堆
   */
  static prepareDeal(deck, bottomCardsCount) {
    const bottomCards = deck.slice(0, bottomCardsCount);
    const remainingDeck = deck.slice(bottomCardsCount);
    return { bottomCards, remainingDeck };
  }

  /**
   * 自动排序手牌
   */
  static autoSortCards(cards) {
    return [...cards].sort((a, b) => a.value - b.value);
  }
}
