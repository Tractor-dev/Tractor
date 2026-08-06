import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_PLAYER } from '../utils/constants.js';

export class Player {
  constructor(socketId, name, position, isBot = false) {
    this.id = uuidv4();
    // Stable secret used to reclaim this seat after Socket.IO assigns a new id.
    // It is deliberately omitted from toJSON() and is only returned to its owner.
    this.resumeToken = isBot ? null : uuidv4();
    this.socketId = socketId;
    this.name = name;
    this.score = DEFAULT_PLAYER.score;
    this.level = DEFAULT_PLAYER.level;
    this.cards = [];
    this.shownCards = new Set();
    this.position = position;
    this.isReady = false;
    this.isReadyForNext = false;
    this.isOnline = true;
    this.hasConfirmedReveal = false;
    this.isBot = isBot; // 标记是否为bot
  }

  addCard(card) {
    this.cards.push(card);
  }

  removeCards(cardIds) {
    this.cards = this.cards.filter(card => !cardIds.includes(card.id));
  }

  showCards(cardIds) {
    cardIds.forEach(id => this.shownCards.add(id));
  }

  resetForNewGame() {
    // 重置分数，但保持等级
    this.score = DEFAULT_PLAYER.score;
    this.cards = [];
    this.shownCards.clear();
    this.isReady = false;
    this.isReadyForNext = false;
    this.hasConfirmedReveal = false;
  }

  toJSON() {
    return {
      id: this.id,
      socketId: this.socketId,
      name: this.name,
      score: this.score,
      level: this.level,
      cardsCount: this.cards.length,
      position: this.position,
      isReady: this.isReady,
      isReadyForNext: this.isReadyForNext,
      isOnline: this.isOnline,
      hasConfirmedReveal: this.hasConfirmedReveal,
      isBot: this.isBot
    };
  }

  toJSONWithCards() {
    return {
      ...this.toJSON(),
      cards: this.cards.map(c => c.toJSON()),
      shownCards: Array.from(this.shownCards)
    };
  }
}
