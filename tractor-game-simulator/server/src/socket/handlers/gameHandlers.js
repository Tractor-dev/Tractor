import { GameEngine } from '../../services/GameEngine.js';
import { GamePhases } from '../../utils/constants.js';
import logger from '../../utils/logger.js';

// 存储每个房间的游戏引擎
const gameEngines = new Map();

// 导出gameEngines供其他模块使用（如roomHandlers中清理资源）
export function getGameEngines() {
  return gameEngines;
}

export function registerGameHandlers(io, socket, roomManager) {

  /**
   * 开始游戏（房主）
   */
  socket.on('start_game', ({ roomId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      if (room.hostId !== socket.id) {
        throw new Error('只有房主可以开始游戏');
      }

      if (!room.canStart()) {
        throw new Error(`需要${room.config.minPlayers}-${room.config.maxPlayers}名玩家才能开始`);
      }

      // 创建游戏引擎
      const gameEngine = new GameEngine(room, io);
      gameEngines.set(room.id, gameEngine);

      // 开始游戏
      gameEngine.startGame();

      // 广播房间状态更新
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('开始游戏失败:', error);
    }
  });

  /**
   * 设置埋底玩家（房主）
   */
  socket.on('set_burying_player', ({ roomId, playerId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      if (room.hostId !== socket.id) {
        throw new Error('只有房主可以指定埋底玩家');
      }

      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) {
        throw new Error('游戏未开始');
      }

      // 进入埋底阶段
      room.gameState.phase = GamePhases.BURYING;

      const buryingPlayer = gameEngine.setBuryingPlayer(playerId);

      // 私密发送底牌给埋底玩家
      io.to(buryingPlayer.socketId).emit('bottom_cards_received', {
        bottomCards: room.gameState.bottomCards.map(c => c.toJSON()),
        totalCards: buryingPlayer.cards.length
      });

      // 广播埋底玩家
      io.to(room.id).emit('burying_player_set', {
        playerId: buryingPlayer.id,
        playerName: buryingPlayer.name
      });

      // 广播房间状态更新
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('设置埋底玩家失败:', error);
    }
  });

  /**
   * 埋底
   */
  socket.on('bury_cards', ({ roomId, cardIds }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      const player = room.findPlayerBySocketId(socket.id);
      if (!player) {
        throw new Error('玩家不存在');
      }

      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) {
        throw new Error('游戏未开始');
      }

      gameEngine.buryCards(player.id, cardIds);

      // 广播埋底完成
      io.to(room.id).emit('cards_buried', {
        playerId: player.id,
        playerName: player.name
      });

      // 广播首发玩家已设置（埋底玩家自动成为首发）
      io.to(room.id).emit('first_player_set', {
        playerId: player.id,
        playerName: player.name,
        currentPlayerIndex: room.gameState.currentPlayerIndex
      });

      // 广播阶段切换
      io.to(room.id).emit('phase_changed', {
        phase: 'playing',
        message: `埋底完成，${player.name} 先出牌`
      });

      // 广播房间状态更新
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('埋底失败:', error);
    }
  });

  /**
   * 设置首发玩家（房主）
   */
  socket.on('set_first_player', ({ roomId, playerId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      if (room.hostId !== socket.id) {
        throw new Error('只有房主可以指定首发玩家');
      }

      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) {
        throw new Error('游戏未开始');
      }

      const firstPlayer = gameEngine.setFirstPlayer(playerId);

      // 广播首发玩家
      io.to(room.id).emit('first_player_set', {
        playerId: firstPlayer.id,
        playerName: firstPlayer.name,
        currentPlayerIndex: room.gameState.currentPlayerIndex,
        currentPlayerId: firstPlayer.id,
        currentPlayerName: firstPlayer.name
      });

      // 广播房间状态更新
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

      logger.info(`房间 ${room.id} 首发玩家: ${firstPlayer.name}`);

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('设置首发玩家失败:', error);
    }
  });

  /**
   * 出牌
   */
  socket.on('play_cards', ({ roomId, cardIds }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      const player = room.findPlayerBySocketId(socket.id);
      if (!player) {
        throw new Error('玩家不存在');
      }

      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) {
        throw new Error('游戏未开始');
      }

      const result = gameEngine.playCards(player.id, cardIds);

      // 广播出牌
      io.to(room.id).emit('cards_played', {
        playerId: player.id,
        playerName: player.name,
        cards: result.playedCards,
        remainingCount: result.remainingCount
      });

      // 根据回合结果广播不同事件
      if (result.type === 'turn_changed') {
        const currentPlayer = room.findPlayerByIndex(result.currentPlayerIndex);
        io.to(room.id).emit('turn_changed', {
          currentPlayerIndex: result.currentPlayerIndex,
          currentPlayerId: currentPlayer.id,
          currentPlayerName: currentPlayer.name
        });
      } else if (result.type === 'free_play_started') {
        io.to(room.id).emit('free_play_started', {
          round: result.round,
          message: result.message
        });
      } else if (result.type === 'round_started') {
        io.to(room.id).emit('round_started', {
          round: result.round,
          firstPlayerIndex: result.firstPlayerIndex,
          firstPlayerId: result.firstPlayerId,
          firstPlayerName: result.firstPlayerName,
          currentPlayerIndex: result.currentPlayerIndex,
          currentPlayerId: result.currentPlayerId,
          currentPlayerName: result.currentPlayerName,
          message: result.message
        });
      }

      // 检查是否有玩家打完牌
      if (result.remainingCount === 0) {
        io.to(room.id).emit('player_finished', {
          playerId: player.id,
          playerName: player.name
        });
      }

      // 游戏结束
      if (result.gameFinished) {
        io.to(room.id).emit('bottom_revealed', {
          bottomCards: room.gameState.bottomCards.map(c => c.toJSON())
        });

        io.to(room.id).emit('phase_changed', {
          phase: 'revealing',
          message: '游戏结束，查看底牌'
        });
      }

      // 广播房间状态更新
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('出牌失败:', error);
    }
  });

  /**
   * 跳过（出0张牌）
   */
  socket.on('pass_turn', ({ roomId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      const player = room.findPlayerBySocketId(socket.id);
      if (!player) {
        throw new Error('玩家不存在');
      }

      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) {
        throw new Error('游戏未开始');
      }

      // 跳过就是出0张牌
      const result = gameEngine.playCards(player.id, []);

      // 广播跳过
      io.to(room.id).emit('turn_passed', {
        playerId: player.id,
        playerName: player.name
      });

      // 根据回合结果广播不同事件
      if (result.type === 'turn_changed') {
        const currentPlayer = room.findPlayerByIndex(result.currentPlayerIndex);
        io.to(room.id).emit('turn_changed', {
          currentPlayerIndex: result.currentPlayerIndex,
          currentPlayerId: currentPlayer.id,
          currentPlayerName: currentPlayer.name
        });
      } else if (result.type === 'free_play_started') {
        io.to(room.id).emit('free_play_started', {
          round: result.round,
          message: result.message
        });
      } else if (result.type === 'round_started') {
        io.to(room.id).emit('round_started', {
          round: result.round,
          firstPlayerId: result.firstPlayerId,
          firstPlayerName: result.firstPlayerName,
          currentPlayerId: result.currentPlayerId,
          currentPlayerName: result.currentPlayerName
        });
      }

      // 广播房间状态更新
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('跳过失败:', error);
    }
  });

  /**
   * 确认查看底牌
   */
  socket.on('confirm_reveal', ({ roomId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      const player = room.findPlayerBySocketId(socket.id);
      if (!player) {
        throw new Error('玩家不存在');
      }

      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) {
        throw new Error('游戏未开始');
      }

      const allConfirmed = gameEngine.confirmReveal(player.id);

      // 广播确认状态
      const confirmedCount = room.players.filter(p => p.hasConfirmedReveal).length;
      io.to(room.id).emit('player_confirmed_reveal', {
        playerId: player.id,
        playerName: player.name,
        confirmedCount,
        totalCount: room.players.length
      });

      // 所有人确认后进入finished阶段
      if (allConfirmed) {
        const duration = (room.gameState.endTime - room.gameState.startTime) / 1000;
        io.to(room.id).emit('game_finished', {
          players: room.players.map(p => p.toJSON()),
          duration,
          totalRounds: room.gameState.currentRound
        });

        // 广播房间状态更新
        io.to(room.id).emit('room_updated', {
          room: room.toJSON()
        });
      }

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('确认查看底牌失败:', error);
    }
  });

  /**
   * 重新开始（房主）
   */
  socket.on('restart_game', ({ roomId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      if (room.hostId !== socket.id) {
        throw new Error('只有房主可以重新开始');
      }

      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) {
        throw new Error('游戏未开始');
      }

      gameEngine.restartGame();

      // 广播游戏重新开始事件
      io.to(room.id).emit('game_restarted', {
        room: room.toJSON()
      });

      // 广播房间状态更新
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

      logger.info(`房间 ${room.id} 重新开始游戏`);

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('重新开始失败:', error);
    }
  });

  /**
   * 调整分数
   */
  socket.on('update_score', ({ roomId, amount }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      const player = room.findPlayerBySocketId(socket.id);
      if (!player) {
        throw new Error('玩家不存在');
      }

      player.score = Math.max(0, player.score + amount);

      // 广播房间状态更新
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

      logger.info(`房间 ${room.id} 玩家 ${player.name} 分数调整为 ${player.score}`);

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('调整分数失败:', error);
    }
  });

  /**
   * 调整等级
   */
  socket.on('update_level', ({ roomId, amount }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      const player = room.findPlayerBySocketId(socket.id);
      if (!player) {
        throw new Error('玩家不存在');
      }

      player.level = Math.max(2, player.level + amount);

      // 广播房间状态更新
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

      logger.info(`房间 ${room.id} 玩家 ${player.name} 等级调整为 ${player.level}`);

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('调整等级失败:', error);
    }
  });
}
