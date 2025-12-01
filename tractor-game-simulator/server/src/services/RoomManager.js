import { Room } from '../models/Room.js';
import logger from '../utils/logger.js';

export class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  createRoom(name, hostSocketId, config) {
    const room = new Room(name, hostSocketId, config);
    this.rooms.set(room.id, room);
    logger.info(`房间创建成功: ${room.id} (${name})`);
    return room;
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  deleteRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (room) {
      this.rooms.delete(roomId);
      logger.info(`房间已删除: ${roomId} (${room.name})`);
      return true;
    }
    return false;
  }

  getAllRooms() {
    return Array.from(this.rooms.values());
  }

  findRoomBySocketId(socketId) {
    for (const room of this.rooms.values()) {
      if (room.findPlayerBySocketId(socketId)) {
        return room;
      }
      // Also check spectators
      if (room.findSpectatorBySocketId(socketId)) {
        return room;
      }
    }
    return null;
  }

  getRoomList() {
    return this.getAllRooms().map(room => ({
      id: room.id,
      name: room.name,
      playerCount: room.players.length,
      spectatorCount: room.spectators.length,
      maxPlayers: room.config.maxPlayers,
      phase: room.gameState.phase,
      gameState: room.gameState.toJSON(),
      config: room.config,
      createdAt: room.createdAt
    }));
  }
}
