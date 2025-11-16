import { Player } from '../../models/Player.js';
import logger from '../../utils/logger.js';
import { getGameEngines } from './gameHandlers.js';

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
function handlePlayerLeave(io, socket, roomManager, roomId) {
  try {
    const room = roomManager.getRoom(roomId);
    if (!room) return;

    const player = room.findPlayerBySocketId(socket.id);
    if (!player) return;

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

    // 如果房主离开，转移房主权限或删除房间
    if (room.hostId === socket.id) {
      if (room.players.length > 0) {
        room.hostId = room.players[0].socketId;
        io.to(room.id).emit('host_changed', {
          newHostId: room.players[0].id,
          newHostName: room.players[0].name
        });
        logger.info(`房间 ${room.id} 房主转移给: ${room.players[0].name}`);
      } else {
        // 房间被删除时也清理游戏引擎
        const gameEngines = getGameEngines();
        gameEngines.delete(room.id);
        roomManager.deleteRoom(room.id);
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
