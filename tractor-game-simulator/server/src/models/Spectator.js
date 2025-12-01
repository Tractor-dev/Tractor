import { v4 as uuidv4 } from 'uuid';

export class Spectator {
  constructor(socketId, name) {
    this.id = uuidv4();
    this.socketId = socketId;
    this.name = name;
    this.joinedAt = new Date();
  }

  toJSON() {
    return {
      id: this.id,
      socketId: this.socketId,
      name: this.name,
      joinedAt: this.joinedAt
    };
  }
}
