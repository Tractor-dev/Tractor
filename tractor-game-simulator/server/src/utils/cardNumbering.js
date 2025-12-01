import { Suits, Ranks } from './constants.js';

/**
 * WhoDesigned Bot使用的卡牌编号系统 (0-107)
 *
 * 编号规则：
 * - 每个点数有4张牌，顺序为：s(黑桃), h(红桃), c(草花), d(方片)
 * - 点数顺序为：A, 2, 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K
 * - 0-3:   A (s, h, c, d)
 * - 4-7:   2 (s, h, c, d)
 * - 8-11:  3 (s, h, c, d)
 * - ...
 * - 48-51: K (s, h, c, d)
 * - 52:    小王(joker)
 * - 53:    大王(Joker)
 * - 54-107: 重复0-53的排列（第二副牌）
 */
export class CardNumberingSystem {

  /**
   * 点数顺序（按照bot编号顺序）
   * 注意：拖拉机游戏中A通常是最大的，但在编号中A排在第一位
   */
  static RANK_ORDER = [
    Ranks.ACE,    // 0-3
    Ranks.TWO,    // 4-7
    Ranks.THREE,  // 8-11
    Ranks.FOUR,   // 12-15
    Ranks.FIVE,   // 16-19
    Ranks.SIX,    // 20-23
    Ranks.SEVEN,  // 24-27
    Ranks.EIGHT,  // 28-31
    Ranks.NINE,   // 32-35
    Ranks.TEN,    // 36-39
    Ranks.JACK,   // 40-43
    Ranks.QUEEN,  // 44-47
    Ranks.KING    // 48-51
  ];

  /**
   * 花色顺序（按照bot编号顺序）
   * 必须与Python bot的 suitset = ['s','h','c','d'] 保持一致
   */
  static SUIT_ORDER = [
    Suits.SPADES,   // s - 偏移0
    Suits.HEARTS,   // h - 偏移1
    Suits.CLUBS,    // c - 偏移2
    Suits.DIAMONDS  // d - 偏移3
  ];

  /**
   * 将Card对象转换为0-107的编号
   * @param {Object} card - Card对象 {suit, rank, id}
   * @returns {number} 0-107的编号
   */
  static cardToNumber(card) {
    // 处理大小王
    if (card.suit === Suits.JOKER) {
      if (card.rank === Ranks.SMALL_JOKER) {
        // 小王：52或106
        // 通过card.id判断是第几张（copyIndex）
        const copyIndex = this._getCopyIndex(card.id);
        return copyIndex === 0 ? 52 : 106;
      } else if (card.rank === Ranks.BIG_JOKER) {
        // 大王：53或107
        const copyIndex = this._getCopyIndex(card.id);
        return copyIndex === 0 ? 53 : 107;
      }
    }

    // 处理普通牌
    const rankIndex = this.RANK_ORDER.indexOf(card.rank);
    const suitIndex = this.SUIT_ORDER.indexOf(card.suit);

    if (rankIndex === -1 || suitIndex === -1) {
      throw new Error(`Invalid card: ${JSON.stringify(card)}`);
    }

    // 基础编号（0-51）
    const baseNumber = rankIndex * 4 + suitIndex;

    // 根据copyIndex决定是否加54
    const copyIndex = this._getCopyIndex(card.id);
    return copyIndex === 0 ? baseNumber : baseNumber + 54;
  }

  /**
   * 将0-107的编号转换为Card信息（suit, rank, copyIndex）
   * @param {number} number - 0-107的编号
   * @returns {Object} {suit, rank, copyIndex}
   */
  static numberToCard(number) {
    if (number < 0 || number > 107) {
      throw new Error(`Invalid card number: ${number}`);
    }

    // 处理大小王
    if (number === 52) return { suit: Suits.JOKER, rank: Ranks.SMALL_JOKER, copyIndex: 0 };
    if (number === 53) return { suit: Suits.JOKER, rank: Ranks.BIG_JOKER, copyIndex: 0 };
    if (number === 106) return { suit: Suits.JOKER, rank: Ranks.SMALL_JOKER, copyIndex: 1 };
    if (number === 107) return { suit: Suits.JOKER, rank: Ranks.BIG_JOKER, copyIndex: 1 };

    // 处理普通牌
    let copyIndex = 0;
    let baseNumber = number;

    if (number >= 54) {
      copyIndex = 1;
      baseNumber = number - 54;
    }

    const rankIndex = Math.floor(baseNumber / 4);
    const suitIndex = baseNumber % 4;

    return {
      suit: this.SUIT_ORDER[suitIndex],
      rank: this.RANK_ORDER[rankIndex],
      copyIndex
    };
  }

  /**
   * 批量转换Card数组为编号数组
   * @param {Array} cards - Card对象数组
   * @returns {Array} 编号数组
   */
  static cardsToNumbers(cards) {
    return cards.map(card => this.cardToNumber(card));
  }

  /**
   * 批量转换编号数组为Card信息数组
   * @param {Array} numbers - 编号数组
   * @returns {Array} Card信息数组
   */
  static numbersToCards(numbers) {
    return numbers.map(number => this.numberToCard(number));
  }

  /**
   * 从card.id中提取copyIndex
   * card.id格式: "suit-rank-copyIndex"
   * @param {string} cardId
   * @returns {number} copyIndex (0 or 1)
   */
  static _getCopyIndex(cardId) {
    const parts = cardId.split('-');
    return parseInt(parts[parts.length - 1]) || 0;
  }

  /**
   * 在玩家手牌中查找匹配指定编号的Card对象
   * @param {number} number - 0-107的编号
   * @param {Array} playerCards - 玩家手牌数组
   * @returns {Object|null} 匹配的Card对象，如果未找到返回null
   */
  static findCardByNumber(number, playerCards) {
    const { suit, rank, copyIndex } = this.numberToCard(number);

    return playerCards.find(card =>
      card.suit === suit &&
      card.rank === rank &&
      this._getCopyIndex(card.id) === copyIndex
    ) || null;
  }

  /**
   * 在玩家手牌中查找匹配多个编号的Card对象数组
   * @param {Array} numbers - 编号数组
   * @param {Array} playerCards - 玩家手牌数组
   * @returns {Array} 匹配的Card对象数组
   */
  static findCardsByNumbers(numbers, playerCards) {
    const result = [];
    const remainingCards = [...playerCards];

    for (const number of numbers) {
      const { suit, rank, copyIndex } = this.numberToCard(number);

      const cardIndex = remainingCards.findIndex(card =>
        card.suit === suit &&
        card.rank === rank &&
        this._getCopyIndex(card.id) === copyIndex
      );

      if (cardIndex !== -1) {
        result.push(remainingCards[cardIndex]);
        remainingCards.splice(cardIndex, 1);
      }
    }

    return result;
  }
}

export default CardNumberingSystem;
