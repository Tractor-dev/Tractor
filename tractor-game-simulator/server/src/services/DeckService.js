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
