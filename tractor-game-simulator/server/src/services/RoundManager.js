import { PlayModes, TurnOrders } from '../utils/constants.js';

export class RoundManager {
  constructor(room) {
    this.room = room;
    this.gameState = room.gameState;
    this.config = room.config;
  }

  /**
   * 玩家出牌后调用
   * 只负责记录出牌和移动到下一个玩家，轮次结束由 GameEngine 处理
   */
  onPlayerPlayed(playerIndex) {
    const mode = this.gameState.playMode;

    if (mode === PlayModes.ORDERED) {
      // 有序模式：记录已出牌
      this.gameState.playersPlayedThisRound.add(playerIndex);

      // 检查本轮是否所有人都出过牌
      if (this.gameState.playersPlayedThisRound.size === this.room.players.length) {
        // 本轮结束，由 GameEngine 处理获胜者和下一轮
        return {
          type: 'round_ended',
          round: this.gameState.currentRound
        };
      } else {
        // 移动到下一个玩家
        this.moveToNextPlayer(playerIndex);
        return {
          type: 'turn_changed',
          currentPlayerIndex: this.gameState.currentPlayerIndex
        };
      }
    }

    return null;
  }

  /**
   * 进入自由出牌阶段
   */
  enterFreeMode() {
    this.gameState.playMode = PlayModes.FREE;
    this.gameState.currentPlayerIndex = null; // 自由模式没有"当前玩家"

    return {
      type: 'free_play_started',
      round: this.gameState.currentRound,
      message: `第${this.gameState.currentRound}轮结束，所有玩家可以出牌`
    };
  }

  /**
   * 开始新一轮（由第一个出牌的玩家触发）
   * 注意：触发的那次出牌本身就算作该玩家在新一轮的出牌
   */
  startNewRound(firstPlayerIndex) {
    this.gameState.currentRound++;
    this.gameState.playMode = PlayModes.ORDERED;
    this.gameState.roundStartPlayerIndex = firstPlayerIndex;
    this.gameState.playersPlayedThisRound.clear();

    // 该玩家的出牌已经算作本轮的出牌
    this.gameState.playersPlayedThisRound.add(firstPlayerIndex);

    // 直接移动到下一个玩家
    this.moveToNextPlayer(firstPlayerIndex);

    const firstPlayer = this.room.findPlayerByIndex(firstPlayerIndex);
    const currentPlayer = this.room.findPlayerByIndex(this.gameState.currentPlayerIndex);

    return {
      type: 'round_started',
      round: this.gameState.currentRound,
      firstPlayerIndex,
      firstPlayerId: firstPlayer.id,
      firstPlayerName: firstPlayer.name,
      currentPlayerIndex: this.gameState.currentPlayerIndex,
      currentPlayerId: currentPlayer.id,
      currentPlayerName: currentPlayer.name,
      message: `轮次${this.gameState.currentRound}开始，${firstPlayer.name}首发并已出牌，现在轮到${currentPlayer.name}`
    };
  }

  /**
   * 移动到下一个玩家（有序模式）
   * 默认逆时针（从玩家视角，向右传递）
   */
  moveToNextPlayer(currentPlayerIndex) {
    const { turnOrder, customTurnOrder } = this.config;
    const playerCount = this.room.players.length;

    if (turnOrder === TurnOrders.CUSTOM && customTurnOrder) {
      // 自定义顺序
      const currentPos = customTurnOrder.indexOf(currentPlayerIndex);
      const nextPos = (currentPos + 1) % playerCount;
      this.gameState.currentPlayerIndex = customTurnOrder[nextPos];
    } else {
      // 默认逆时针：索引递增
      this.gameState.currentPlayerIndex =
        (currentPlayerIndex + 1) % playerCount;
    }
  }

  /**
   * 验证玩家是否可以出牌
   */
  canPlayerPlay(playerIndex) {
    const mode = this.gameState.playMode;

    if (mode === PlayModes.FREE) {
      // 自由模式：所有人都可以出牌
      return true;
    } else if (mode === PlayModes.ORDERED) {
      // 有序模式：只有当前玩家可以出牌
      return playerIndex === this.gameState.currentPlayerIndex;
    }

    return false;
  }

  /**
   * 检查游戏是否结束（所有人都出完牌）
   */
  isGameFinished() {
    return this.room.players.every(p => p.cards.length === 0);
  }
}
