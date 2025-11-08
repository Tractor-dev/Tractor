import { registerRoomHandlers } from './handlers/roomHandlers.js';
import { registerGameHandlers } from './handlers/gameHandlers.js';
import { registerPlayerHandlers } from './handlers/playerHandlers.js';
import logger from '../utils/logger.js';

export function setupSocketIO(io, roomManager) {
  io.on('connection', (socket) => {
    logger.info(`客户端连接: ${socket.id}`);

    // 注册所有事件处理器
    registerRoomHandlers(io, socket, roomManager);
    registerGameHandlers(io, socket, roomManager);
    registerPlayerHandlers(io, socket, roomManager);

    socket.on('disconnect', () => {
      logger.info(`客户端断开: ${socket.id}`);
    });
  });

  logger.info('Socket.IO 已初始化');
}
