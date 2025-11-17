import { GamePhases, PlayModes } from '../utils/constants.js';

export class GameState {
  constructor() {
    this.phase = GamePhases.WAITING;
    this.playMode = PlayModes.ORDERED;
    this.deck = [];
    this.bottomCards = [];
    this.buryingPlayerId = null;
    this.firstPlayerId = null;
    this.currentPlayerIndex = null;
    this.currentRound = 0;
    this.roundStartPlayerIndex = null;
    this.playersPlayedThisRound = new Set();
    this.playHistory = [];
    this.drawingIndex = 0;
    this.startTime = null;
    this.endTime = null;
    this.trumpSuit = null; // 主牌花色
    this.trumpRank = null; // 主牌点数
    this.isWaitingForReady = false; // 是否在等待玩家准备
    this.selectedRule = null; // 选中的规则 { name, content }
  }

  reset() {
    this.phase = GamePhases.WAITING;
    this.playMode = PlayModes.ORDERED;
    this.deck = [];
    this.bottomCards = [];
    this.buryingPlayerId = null;
    this.firstPlayerId = null;
    this.currentPlayerIndex = null;
    this.currentRound = 0;
    this.roundStartPlayerIndex = null;
    this.playersPlayedThisRound.clear();
    this.playHistory = [];
    this.drawingIndex = 0;
    this.startTime = null;
    this.endTime = null;
    this.trumpSuit = null;
    this.trumpRank = null;
    this.isWaitingForReady = false;
    this.selectedRule = null;
  }

  toJSON() {
    return {
      phase: this.phase,
      playMode: this.playMode,
      bottomCardsCount: this.bottomCards.length,
      buryingPlayerId: this.buryingPlayerId,
      firstPlayerId: this.firstPlayerId,
      currentPlayerIndex: this.currentPlayerIndex,
      currentRound: this.currentRound,
      roundStartPlayerIndex: this.roundStartPlayerIndex,
      playersPlayedThisRound: Array.from(this.playersPlayedThisRound),
      playHistoryCount: this.playHistory.length,
      drawingProgress: this.drawingIndex,
      totalCards: this.deck.length,
      startTime: this.startTime,
      endTime: this.endTime,
      trumpSuit: this.trumpSuit,
      trumpRank: this.trumpRank,
      isWaitingForReady: this.isWaitingForReady,
      selectedRule: this.selectedRule
    };
  }
}
