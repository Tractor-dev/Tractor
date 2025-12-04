import { Player } from '../../models/Player.js';
import { Spectator } from '../../models/Spectator.js';
import logger from '../../utils/logger.js';
import { getGameEngines, getBotServices } from './gameHandlers.js';
import { BotTypes } from '../../utils/constants.js';

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
        player: host.toJSON()
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

      // 检查是否有断线的位置可以重连
      if (room.hasDisconnectedSlot()) {
        // 获取第一个断线位置
        const disconnectedSlot = room.getFirstDisconnectedSlot();
        
        // 让新玩家继承断线玩家的状态
        const player = room.reconnectPlayer(socket.id, playerName || `玩家${disconnectedSlot.position + 1}`, disconnectedSlot.position);
        
        if (player) {
          // 加入Socket.IO房间
          socket.join(room.id);

          // 通知该玩家（带有完整的手牌信息）
          socket.emit('room_rejoined', {
            room: room.toJSON(),
            player: player.toJSONWithCards(),
            reconnected: true,
            inheritedFrom: disconnectedSlot.player.name
          });

          // 广播给其他玩家
          io.to(room.id).emit('player_reconnected', {
            player: player.toJSON(),
            previousName: disconnectedSlot.player.name,
            message: `玩家 ${player.name} 重新连接`
          });

          // 广播房间状态更新给所有人
          io.to(room.id).emit('room_updated', {
            room: room.toJSON()
          });

          logger.info(`玩家 ${player.name} 重连到房间: ${room.id}，继承位置 ${player.position}`);
          return;
        }
      }

      if (room.players.length >= room.config.maxPlayers) {
        throw new Error('房间已满');
      }

      // 创建玩家
      const player = new Player(socket.id, playerName || `玩家${room.players.length + 1}`, room.players.length);
      room.addPlayer(player);

      // 加入Socket.IO房间
      socket.join(room.id);

      // 通知该玩家
      socket.emit('room_joined', {
        room: room.toJSON(),
        player: player.toJSON()
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
   * 离开房间
   */
  socket.on('leave_room', ({ roomId }) => {
    handlePlayerLeave(io, socket, roomManager, roomId);
  });

  /**
   * 作为观战者加入房间
   */
  socket.on('join_as_spectator', ({ roomId, spectatorName }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      // 检查房间是否允许观战
      if (room.config.allowSpectators === false) {
        throw new Error('房主已禁止观战');
      }

      // 创建观战者
      const spectator = new Spectator(socket.id, spectatorName || `观战者${room.spectators.length + 1}`);
      room.addSpectator(spectator);

      // 加入Socket.IO房间
      socket.join(room.id);

      // 通知该观战者
      socket.emit('spectator_joined', {
        room: room.toJSON(),
        spectator: spectator.toJSON()
      });

      // 广播给房间内所有人（玩家和观战者）
      socket.to(room.id).emit('spectator_joined_room', {
        spectator: spectator.toJSON()
      });

      // 广播房间状态更新给所有人
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

      logger.info(`观战者 ${spectator.name} 加入房间: ${room.id}`);
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('加入观战失败:', error);
    }
  });

  /**
   * 观战者离开房间
   */
  socket.on('leave_spectator', ({ roomId }) => {
    handleSpectatorLeave(io, socket, roomManager, roomId);
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

      // 如果配置中包含botType，需要特殊处理
      if (config.botType !== undefined) {
        // 验证botType是否有效
        if (config.botType !== BotTypes.SIMPLE && config.botType !== BotTypes.WHO_DESIGNED) {
          throw new Error(`无效的Bot类型: ${config.botType}`);
        }

        // 只允许在waiting、revealing、finished阶段修改botType
        const allowedPhases = ['waiting', 'revealing', 'finished'];
        if (!allowedPhases.includes(room.gameState.phase)) {
          throw new Error('只能在等待或游戏结束阶段更改Bot类型');
        }

        // 检查是否在自由模式下使用WhoDesigned bot
        const playMode = config.playMode || room.config.playMode;
        if (playMode === 'free' && config.botType === 'who_designed' && room.players.some(p => p.isBot)) {
          throw new Error('WhoDesigned bot只能在基础模式下使用，当前有bot玩家，请先移除bot或切换到基础模式');
        }

        // 清除现有的bot服务（下次需要时会用新的bot类型重新创建）
        const botServices = getBotServices();
        const botService = botServices.get(room.id);
        if (botService) {
          botService.clearHistory();
          botServices.delete(room.id);
        }

        logger.info(`房间 ${room.id} Bot类型将从 ${room.config.botType} 改为 ${config.botType}`);
      }

      // 如果配置中包含playMode，需要检查与botType的兼容性
      if (config.playMode !== undefined) {
        const botType = config.botType || room.config.botType;
        if (config.playMode === 'free' && botType === 'who_designed' && room.players.some(p => p.isBot)) {
          throw new Error('WhoDesigned bot只能在基础模式下使用，请先移除bot或更改bot类型');
        }
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

      // 只允许在waiting、revealing、finished阶段修改botType
      const allowedPhases = ['waiting', 'revealing', 'finished'];
      if (!allowedPhases.includes(room.gameState.phase)) {
        throw new Error('只能在等待或游戏结束阶段更改Bot类型');
      }

      // 验证botType是否有效
      if (botType !== BotTypes.SIMPLE && botType !== BotTypes.WHO_DESIGNED) {
        throw new Error(`无效的Bot类型: ${botType}`);
      }

      // 检查是否在自由模式下使用WhoDesigned bot
      if (room.config.playMode === 'free' && botType === 'who_designed' && room.players.some(p => p.isBot)) {
        throw new Error('WhoDesigned bot只能在基础模式下使用，当前有bot玩家，请先移除bot或切换到基础模式');
      }

      // 更新配置
      room.updateConfig({ botType });

      // 清除现有的bot服务（下次需要时会用新的bot类型重新创建）
      const botServices = getBotServices();
      const botService = botServices.get(room.id);
      if (botService) {
        botService.clearHistory();
        botServices.delete(room.id);
      }

      // 广播Bot类型更新
      io.to(room.id).emit('bot_type_updated', {
        botType: botType,
        botTypeName: botType === BotTypes.SIMPLE ? '简单Bot' : 'WhoDesigned Bot'
      });

      // 广播配置更新
      io.to(room.id).emit('config_updated', {
        config: room.config
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

      if (room.gameState.phase !== 'waiting') {
        throw new Error('游戏进行中无法添加bot');
      }

      // 检查是否在自由模式下使用WhoDesigned bot
      if (room.config.playMode === 'free' && room.config.botType === 'who_designed') {
        throw new Error('WhoDesigned bot只能在基础模式下使用，请切换到基础模式或使用Simple bot');
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

      if (room.gameState.phase !== 'waiting') {
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
      // Check if socket is a player
      const player = room.findPlayerBySocketId(socket.id);
      if (player) {
        handlePlayerLeave(io, socket, roomManager, room.id);
      } else {
        // Check if socket is a spectator
        const spectator = room.findSpectatorBySocketId(socket.id);
        if (spectator) {
          handleSpectatorLeave(io, socket, roomManager, room.id);
        }
      }
    }
  });
}

/**
 * 处理玩家离开
 */
function handlePlayerLeave(io, socket, roomManager, roomId) {
  try {
    const room = roomManager.getRoom(roomId);
    if (!room) return;

    const player = room.findPlayerBySocketId(socket.id);
    if (!player) return;

    // 检查是否可以保留游戏状态等待重连
    // 条件：原始真人玩家数量 > 2 且游戏进行中 且断线的是真人玩家
    if (room.canWaitForReconnect() && !player.isBot) {
      // 保存断线玩家状态，不终止游戏
      room.saveDisconnectedPlayer(player);
      
      // 离开Socket.IO房间
      socket.leave(room.id);

      // 广播玩家断线（区别于完全离开）
      io.to(room.id).emit('player_disconnected', {
        playerId: player.id,
        playerName: player.name,
        position: player.position,
        message: `玩家 ${player.name} 断线，等待重连...`
      });

      // 如果房主断线，转移房主权限给下一个在线的真人玩家
      if (room.hostId === socket.id) {
        const newHost = room.players.find(p => !p.isBot && p.isOnline);
        if (newHost) {
          room.hostId = newHost.socketId;
          io.to(room.id).emit('host_changed', {
            newHostId: newHost.id,
            newHostName: newHost.name
          });
          logger.info(`房间 ${room.id} 房主转移给: ${newHost.name}`);
        }
      }

      // 检查是否所有真人玩家都断线了
      if (room.hasNoOnlineHumanPlayers()) {
        // 所有真人玩家都断线，但保留房间一段时间等待重连
        logger.info(`房间 ${room.id} 所有真人玩家断线，保留房间等待重连`);
      }

      // 广播房间状态更新
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

      logger.info(`玩家 ${player.name} 断线（等待重连）: ${room.id}`);
      return;
    }

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
    socket.leave(room.id);

    // 广播玩家离开
    io.to(room.id).emit('player_left', {
      playerId: player.id,
      playerName: player.name
    });

    // 检查房间是否需要删除：没有玩家或者只剩机器人
    if (room.players.length === 0 || room.hasOnlyBots()) {
      // 房间被删除时也清理游戏引擎和bot服务
      const gameEngines = getGameEngines();
      const botServices = getBotServices();
      gameEngines.delete(room.id);
      botServices.delete(room.id);
      roomManager.deleteRoom(room.id);
      const reason = room.players.length === 0 ? '房间已删除' : '房间只剩机器人，已自动删除';
      logger.info(`玩家 ${player.name} 离开房间: ${room.id}，${reason}`);
      return; // 房间已删除，不需要再广播
    }

    // 如果房主离开，转移房主权限给下一个真人玩家
    if (room.hostId === socket.id) {
      // 找到第一个非机器人玩家作为新房主
      const newHost = room.players.find(p => !p.isBot);
      if (newHost) {
        room.hostId = newHost.socketId;
        io.to(room.id).emit('host_changed', {
          newHostId: newHost.id,
          newHostName: newHost.name
        });
        logger.info(`房间 ${room.id} 房主转移给: ${newHost.name}`);
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

/**
 * 处理观战者离开
 */
function handleSpectatorLeave(io, socket, roomManager, roomId) {
  try {
    const room = roomManager.getRoom(roomId);
    if (!room) return;

    const spectator = room.findSpectatorBySocketId(socket.id);
    if (!spectator) return;

    // 移除观战者
    room.removeSpectator(spectator.id);

    // 离开Socket.IO房间
    socket.leave(room.id);

    // 广播观战者离开
    io.to(room.id).emit('spectator_left', {
      spectatorId: spectator.id,
      spectatorName: spectator.name
    });

    // 广播房间状态更新
    io.to(room.id).emit('room_updated', {
      room: room.toJSON()
    });

    logger.info(`观战者 ${spectator.name} 离开房间: ${room.id}`);
  } catch (error) {
    logger.error('处理观战者离开失败:', error);
  }
}
