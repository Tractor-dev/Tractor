import { Player } from '../../models/Player.js';
import logger from '../../utils/logger.js';
import { getGameEngines, getBotServices } from './gameHandlers.js';
import { BotTypes } from '../../utils/constants.js';

export const DISCONNECT_GRACE_MS = 120_000;
const disconnectTimers = new Map();

function getDisconnectTimerKey(roomId, playerId) {
  return `${roomId}:${playerId}`;
}

function clearDisconnectTimer(roomId, playerId) {
  const key = getDisconnectTimerKey(roomId, playerId);
  const timer = disconnectTimers.get(key);
  if (timer) clearTimeout(timer);
  disconnectTimers.delete(key);
}

export function registerRoomHandlers(io, socket, roomManager) {

  /**
   * 创建房间
   */
  socket.on('create_room', ({ name, playerName, config }) => {
    try {
      const room = roomManager.createRoom(name || '新房间', socket.id, config);

      // 创建房主玩家
      const host = new Player(socket.id, playerName || '房主', 0);
      room.addPlayer(host);

      // 加入Socket.IO房间
      socket.join(room.id);

      // 返回房间信息
      socket.emit('room_created', {
        room: room.toJSON(),
        player: host.toJSON(),
        resumeToken: host.resumeToken
      });

      logger.info(`玩家 ${host.name} 创建房间: ${room.id}`);
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('创建房间失败:', error);
    }
  });

  /**
   * 加入房间
   */
  socket.on('join_room', ({ roomId, playerName }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      // “等待准备”仍未开始发牌，允许空位由玩家重新加入；只有进入
      // 摸牌及后续阶段后才禁止陌生玩家中途补位。
      if (room.gameState.phase !== 'waiting') {
        throw new Error('游戏已经开始，无法中途加入');
      }

      if (room.players.length >= room.config.maxPlayers) {
        throw new Error('房间已满');
      }

      // 创建玩家
      const player = new Player(socket.id, playerName || `玩家${room.players.length + 1}`, room.players.length);
      room.addPlayer(player);

      // 若离开的恰好是规则选择者，让补位玩家接管同一组选项，避免
      // 准备阶段永远等待一个已经不存在的 playerId。
      const chooserStillExists = room.findPlayerById(room.gameState.ruleChooserPlayerId);
      if (
        room.gameState.isWaitingForReady
        && room.gameState.isRuleSelectionPending
        && !chooserStillExists
      ) {
        room.gameState.ruleChooserPlayerId = player.id;
        io.to(room.id).emit('rule_selection_started', {
          chooserPlayerId: player.id,
          chooserPlayerName: player.name,
          selectionMode: room.gameState.ruleSelectionMode,
          options: room.gameState.ruleOptions
        });
      }

      // 加入Socket.IO房间
      socket.join(room.id);

      // 通知该玩家
      socket.emit('room_joined', {
        room: room.toJSON(),
        player: player.toJSON(),
        resumeToken: player.resumeToken
      });

      // 广播给其他玩家
      socket.to(room.id).emit('player_joined', {
        player: player.toJSON()
      });

      // 广播房间状态更新给所有人（包括新加入的玩家）
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

      logger.info(`玩家 ${player.name} 加入房间: ${room.id}`);
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('加入房间失败:', error);
    }
  });

  /**
   * Reclaim an existing seat after refresh or a transient connection loss.
   */
  socket.on('resume_room', ({ roomId, playerId, resumeToken }) => {
    try {
      const room = roomManager.getRoom(roomId)
        || roomManager.findRoomByResumeToken(resumeToken);
      if (!room) throw new Error('原房间已不存在');

      const player = room.findPlayerById(playerId);
      if (!player || !resumeToken || player.resumeToken !== resumeToken) {
        throw new Error('无法验证原座位');
      }

      const previousSocketId = player.socketId;
      clearDisconnectTimer(room.id, player.id);
      player.socketId = socket.id;
      player.isOnline = true;
      room.updatedAt = new Date();
      if (room.hostId === previousSocketId) room.hostId = socket.id;
      socket.join(room.id);

      socket.emit('room_resumed', {
        room: room.toJSON(),
        player: player.toJSONWithCards(),
        resumeToken: player.resumeToken
      });
      socket.to(room.id).emit('player_reconnected', {
        playerId: player.id,
        playerName: player.name
      });
      io.to(room.id).emit('room_updated', { room: room.toJSON() });
      logger.info(`玩家 ${player.name} 已恢复房间 ${room.id} 的座位`);
    } catch (error) {
      socket.emit('resume_failed', { message: error.message });
      logger.warn(`恢复房间失败: ${error.message}`);
    }
  });

  /**
   * 离开房间
   */
  socket.on('leave_room', ({ roomId }) => {
    handlePlayerLeave(io, socket, roomManager, roomId, { immediate: true });
  });

  /**
   * 获取房间列表
   */
  socket.on('get_room_list', () => {
    const roomList = roomManager.getRoomList();
    socket.emit('room_list', { rooms: roomList });
  });

  /**
   * 更新房间配置（房主）
   */
  socket.on('update_config', ({ roomId, config }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      if (room.hostId !== socket.id) {
        throw new Error('只有房主可以修改配置');
      }

      if (room.gameState.phase !== 'waiting' || room.gameState.isWaitingForReady) {
        throw new Error('只能在游戏开始前修改配置');
      }

      room.updateConfig(config);

      // 广播配置更新
      io.to(room.id).emit('config_updated', {
        config: room.config
      });

      logger.info(`房间 ${room.id} 配置已更新`);
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('更新配置失败:', error);
    }
  });

  /**
   * 设置Bot类型（房主）
   */
  socket.on('set_bot_type', ({ roomId, botType }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      if (room.hostId !== socket.id) {
        throw new Error('只有房主可以设置Bot类型');
      }

      if (room.gameState.phase !== 'waiting' || room.gameState.isWaitingForReady) {
        throw new Error('游戏进行中无法更改Bot类型');
      }

      // 验证botType是否有效
      if (botType !== BotTypes.SIMPLE && botType !== BotTypes.WHO_DESIGNED) {
        throw new Error(`无效的Bot类型: ${botType}`);
      }

      // 更新配置
      room.updateConfig({ botType });

      // 清除现有的bot服务（下次需要时会用新的bot类型重新创建）
      const botServices = getBotServices();
      botServices.delete(room.id);

      // 广播Bot类型更新
      io.to(room.id).emit('bot_type_updated', {
        botType: botType,
        botTypeName: botType === BotTypes.SIMPLE ? '简单Bot' : 'WhoDesigned Bot'
      });

      // 广播房间状态更新
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

      logger.info(`房间 ${room.id} Bot类型已设置为: ${botType}`);
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('设置Bot类型失败:', error);
    }
  });

  /**
   * 添加bot（房主）
   */
  socket.on('add_bot', ({ roomId, botName }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      if (room.hostId !== socket.id) {
        throw new Error('只有房主可以添加bot');
      }

      if (room.players.length >= room.config.maxPlayers) {
        throw new Error('房间已满');
      }

      if (room.gameState.phase !== 'waiting' || room.gameState.isWaitingForReady) {
        throw new Error('游戏进行中无法添加bot');
      }

      // 创建bot玩家（使用特殊的socketId标识）
      const botSocketId = `bot_${Date.now()}_${Math.random()}`;
      const bot = new Player(
        botSocketId,
        botName || `Bot${room.players.length + 1}`,
        room.players.length,
        true  // isBot = true
      );

      room.addPlayer(bot);

      // 广播bot加入
      io.to(room.id).emit('bot_added', {
        player: bot.toJSON()
      });

      // 广播房间状态更新
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

      logger.info(`Bot ${bot.name} 加入房间: ${room.id}`);
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('添加bot失败:', error);
    }
  });

  /**
   * 移除bot（房主）
   */
  socket.on('remove_bot', ({ roomId, playerId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      if (room.hostId !== socket.id) {
        throw new Error('只有房主可以移除bot');
      }

      const player = room.findPlayerById(playerId);
      if (!player) {
        throw new Error('玩家不存在');
      }

      if (!player.isBot) {
        throw new Error('该玩家不是bot');
      }

      if (room.gameState.phase !== 'waiting' || room.gameState.isWaitingForReady) {
        throw new Error('游戏进行中无法移除bot');
      }

      // 移除bot
      room.removePlayer(player.id);

      // 广播bot离开
      io.to(room.id).emit('bot_removed', {
        playerId: player.id,
        playerName: player.name
      });

      // 广播房间状态更新
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

      logger.info(`Bot ${player.name} 离开房间: ${room.id}`);
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('移除bot失败:', error);
    }
  });

  /**
   * 断线处理
   */
  socket.on('disconnect', () => {
    const room = roomManager.findRoomBySocketId(socket.id);
    if (room) {
      handlePlayerLeave(io, socket, roomManager, room.id);
    }
  });
}

/**
 * 处理玩家离开
 */
function handlePlayerLeave(io, socket, roomManager, roomId, { immediate = false } = {}) {
  try {
    const room = roomManager.getRoom(roomId);
    if (!room) return;

    const player = room.findPlayerBySocketId(socket.id);
    if (!player) return;

    if (!immediate) {
      player.isOnline = false;
      room.updatedAt = new Date();
      io.to(room.id).emit('player_disconnected', {
        playerId: player.id,
        playerName: player.name,
        graceMs: DISCONNECT_GRACE_MS
      });
      io.to(room.id).emit('room_updated', { room: room.toJSON() });

      clearDisconnectTimer(room.id, player.id);
      const timer = setTimeout(() => {
        disconnectTimers.delete(getDisconnectTimerKey(room.id, player.id));
        // A successful resume changes both fields, so a stale timer can never
        // evict the newly connected player.
        if (player.isOnline || player.socketId !== socket.id) return;
        removePlayerPermanently(io, roomManager, room, player, socket);
      }, DISCONNECT_GRACE_MS);
      timer.unref?.();
      disconnectTimers.set(getDisconnectTimerKey(room.id, player.id), timer);
      logger.info(`玩家 ${player.name} 断线，座位保留 ${DISCONNECT_GRACE_MS / 1000} 秒`);
      return;
    }

    clearDisconnectTimer(room.id, player.id);
    removePlayerPermanently(io, roomManager, room, player, socket);
  } catch (error) {
    logger.error('处理玩家离开失败:', error);
  }
}

function deleteRoomAndResources(roomManager, room) {
  const gameEngines = getGameEngines();
  const gameEngine = gameEngines.get(room.id);
  try {
    gameEngine?.cleanup?.();
  } catch (error) {
    logger.error(`清理房间 ${room.id} 的游戏引擎失败:`, error);
  } finally {
    gameEngines.delete(room.id);
    getBotServices().delete(room.id);
    roomManager.deleteRoom(room.id);
  }
}

function removePlayerPermanently(io, roomManager, room, player, socket) {
  try {

    // 如果游戏正在进行，终止游戏
    if (room.gameState.phase !== 'waiting' && room.gameState.phase !== 'finished') {
      // 清理游戏引擎资源（停止发牌定时器等）
      const gameEngines = getGameEngines();
      const gameEngine = gameEngines.get(room.id);
      if (gameEngine) {
        gameEngine.cleanup();
        gameEngines.delete(room.id);
      }

      io.to(room.id).emit('game_terminated', {
        reason: `玩家 ${player.name} 离开，游戏终止`,
        disconnectedPlayer: player.name
      });

      room.gameState.phase = 'finished';
    }

    // 移除玩家
    room.removePlayer(player.id);

    // 离开Socket.IO房间
    socket?.leave?.(room.id);

    // 广播玩家离开
    io.to(room.id).emit('player_left', {
      playerId: player.id,
      playerName: player.name
    });

    // Bot-only rooms have no human who can continue or reclaim them. Delete
    // the room immediately instead of transferring ownership to a bot.
    if (!room.players.some(remainingPlayer => !remainingPlayer.isBot)) {
      deleteRoomAndResources(roomManager, room);
      logger.info(`玩家 ${player.name} 离开房间: ${room.id}，仅剩Bot，房间已删除`);
      return;
    }

    // 如果房主离开，转移房主权限或删除房间
    if (room.hostId === player.socketId) {
      if (room.players.length > 0) {
        room.hostId = room.players[0].socketId;
        io.to(room.id).emit('host_changed', {
          newHostId: room.players[0].id,
          newHostName: room.players[0].name
        });
        logger.info(`房间 ${room.id} 房主转移给: ${room.players[0].name}`);
      } else {
        deleteRoomAndResources(roomManager, room);
        logger.info(`玩家 ${player.name} 离开房间: ${room.id}，房间已删除`);
        return; // 房间已删除，不需要再广播
      }
    }

    // 广播房间状态更新（在房间未被删除的情况下）
    io.to(room.id).emit('room_updated', {
      room: room.toJSON()
    });

    logger.info(`玩家 ${player.name} 离开房间: ${room.id}`);
  } catch (error) {
    logger.error('处理玩家离开失败:', error);
  }
}
