import { GamePhases, PlayModes, Ranks, levelToRank } from '../utils/constants.js';

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
    this.trumpRank = Ranks.TWO; // 主牌点数，默认为2
    this.currentTrumpDeclaration = null; // 当前亮主信息 {playerId, playerName, suit, count, declarationType, strength, jokerType}
    this.trumpCalledPlayerIndex = null; // 报主玩家索引（第一个亮主的玩家）
    this.trumpSnatchedPlayerIndex = null; // 反主玩家索引（最后一个反主的玩家）
    this.isWaitingForReady = false; // 是否在等待玩家准备
    this.selectedRule = null; // 选中的规则 { name, content }

    // 当前轮出牌记录
    this.currentRoundPlays = []; // [{ playerIndex, playerId, cards, pattern }]
    this.previousRoundPlays = []; // 上一轮出牌记录（在下一轮首发时清除）
    this.leadingPattern = null; // 首发牌型
    this.currentWinnerIndex = null; // 当前轮最大的玩家索引

    // 得分相关
    this.collectedPointCards = []; // 闲家收集的分数牌
    this.attackerScore = 0; // 闲家总得分
    this.lastRoundLeadingPattern = null; // 最后一轮的首发牌型（用于计算底牌倍数）
    this.lastRoundWinnerIndex = null; // 最后一轮的获胜者索引

    // 升级相关
    this.team1Level = 2; // 索引0和2的队伍等级
    this.team2Level = 2; // 索引1和3的队伍等级
    this.dealerPlayerIndex = null; // 当前庄家玩家索引
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

    // 根据下一局庄家的等级设置级牌
    if (this.dealerPlayerIndex !== null) {
      // 如果已经有庄家了，根据庄家所属队伍的等级设置级牌
      const dealerTeam = this.dealerPlayerIndex % 2 === 0 ? 1 : 2;
      const dealerLevel = dealerTeam === 1 ? this.team1Level : this.team2Level;
      this.trumpRank = levelToRank(dealerLevel);
    } else {
      // 第一局，默认为2
      this.trumpRank = Ranks.TWO;
    }

    this.currentTrumpDeclaration = null; // 清空亮主信息
    this.trumpCalledPlayerIndex = null; // 清空报主玩家索引
    this.trumpSnatchedPlayerIndex = null; // 清空反主玩家索引
    this.isWaitingForReady = false;
    this.selectedRule = null;

    // 重置当前轮出牌记录
    this.currentRoundPlays = [];
    this.previousRoundPlays = [];
    this.leadingPattern = null;
    this.currentWinnerIndex = null;

    // 重置得分相关
    this.collectedPointCards = [];
    this.attackerScore = 0;
    this.lastRoundLeadingPattern = null;
    this.lastRoundWinnerIndex = null;

    // 注意：不重置升级相关字段（team1Level, team2Level, dealerPlayerIndex）
    // 这些字段需要在多局游戏中保持
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
      selectedRule: this.selectedRule,
      // Include actual currentRoundPlays for clients to determine lead suit
      currentRoundPlays: this.currentRoundPlays.map(play => ({
        playerIndex: play.playerIndex,
        playerId: play.playerId,
        cards: play.cards.map(c => c.toJSON ? c.toJSON() : c),
        pattern: play.pattern
      })),
      // Include previous round plays for display purposes
      previousRoundPlays: this.previousRoundPlays.map(play => ({
        playerIndex: play.playerIndex,
        playerId: play.playerId,
        cards: play.cards.map(c => c.toJSON ? c.toJSON() : c),
        pattern: play.pattern
      })),
      leadingPattern: this.leadingPattern,
      currentWinnerIndex: this.currentWinnerIndex,
      // 得分相关
      collectedPointCards: this.collectedPointCards.map(c => c.toJSON ? c.toJSON() : c),
      attackerScore: this.attackerScore,
      lastRoundWinnerIndex: this.lastRoundWinnerIndex,
      // 升级相关
      team1Level: this.team1Level,
      team2Level: this.team2Level,
      dealerPlayerIndex: this.dealerPlayerIndex
    };
  }
}
