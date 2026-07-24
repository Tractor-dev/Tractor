import { io } from 'socket.io-client';
import { SERVER_URL } from '../utils/constants';

class SocketService {
  constructor() {
    this.socket = null;
  }

  connect() {
    if (!this.socket) {
      this.socket = io(SERVER_URL, {
        // Allow HTTP polling as a fallback on mobile/proxied networks, then
        // upgrade to WebSocket when available.
        transports: ['polling', 'websocket'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 500,
        reconnectionDelayMax: 5000
      });

      this.socket.on('connect', () => {
        console.log('Socket连接成功:', this.socket.id);
      });

      this.socket.on('disconnect', () => {
        console.log('Socket断开连接');
      });

      this.socket.on('error', (error) => {
        console.error('Socket错误:', error);
      });
    }

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  emit(event, data) {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }
}

export default new SocketService();
