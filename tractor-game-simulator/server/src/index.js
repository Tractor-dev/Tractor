import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { RoomManager } from './services/RoomManager.js';
import { setupSocketIO } from './socket/index.js';
import logger from './utils/logger.js';

// 加载环境变量
dotenv.config();

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

// 创建Express应用
const app = express();

// 中间件
app.use(cors({
  origin: CLIENT_URL,
  credentials: true
}));
app.use(express.json());

// 健康检查接口
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 创建HTTP服务器
const httpServer = createServer(app);

// 创建Socket.IO服务器
const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_URL,
    credentials: true
  }
});

// 创建房间管理器
const roomManager = new RoomManager();

// 设置Socket.IO
setupSocketIO(io, roomManager);

// 启动服务器
httpServer.listen(PORT, () => {
  logger.info(`=========================================`);
  logger.info(`🚀 拖拉机纸牌游戏服务器已启动`);
  logger.info(`📡 端口: ${PORT}`);
  logger.info(`🌐 客户端URL: ${CLIENT_URL}`);
  logger.info(`⏰ 启动时间: ${new Date().toLocaleString()}`);
  logger.info(`=========================================`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  logger.info('收到SIGTERM信号，准备关闭服务器...');
  httpServer.close(() => {
    logger.info('服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('收到SIGINT信号，准备关闭服务器...');
  httpServer.close(() => {
    logger.info('服务器已关闭');
    process.exit(0);
  });
});
