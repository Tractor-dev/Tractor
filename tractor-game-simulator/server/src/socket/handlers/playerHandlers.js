import logger from '../../utils/logger.js';
import { validateDeclaration } from '../../utils/trumpUtils.js';
import { getGameEngines } from './gameHandlers.js';

export function registerPlayerHandlers(io, socket, roomManager) {

  /**
   * 展示手牌（摸牌阶段）
   */
  socket.on('show_cards', ({ roomId, cardIds }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      const player = room.findPlayerBySocketId(socket.id);
      if (!player) {
        throw new Error('玩家不存在');
      }

      if (room.gameState.phase !== 'drawing') {
        throw new Error('只能在摸牌阶段展示手牌');
      }

      // 验证牌是否在手中
      const validCards = player.cards.filter(card => cardIds.includes(card.id));
      if (validCards.length !== cardIds.length) {
        throw new Error('选择的牌不在手中');
      }

      // 标记为已展示
      player.showCards(cardIds);

      // 广播展示的牌
      io.to(room.id).emit('cards_shown', {
        playerId: player.id,
        playerName: player.name,
        cards: validCards.map(c => c.toJSON())
      });

      logger.info(`玩家 ${player.name} 展示了 ${validCards.length} 张牌`);

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('展示手牌失败:', error);
    }
  });

  /**
   * 亮主（摸牌阶段）
   */
  socket.on('declare_trump', ({ roomId, suit, count }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      const player = room.findPlayerBySocketId(socket.id);
      if (!player) {
        throw new Error('玩家不存在');
      }

      if (room.gameState.phase !== 'drawing') {
        throw new Error('只能在摸牌阶段亮主');
      }

      const trumpRank = room.gameState.trumpRank;
      if (!trumpRank) {
        throw new Error('未设置级牌');
      }

      // 获取当前亮主信息
      const currentTrump = room.gameState.currentTrumpDeclaration || null;

      // 验证亮主是否合法
      const validation = validateDeclaration(player.cards, suit, count, trumpRank, currentTrump, player.id);

      if (!validation.valid) {
        throw new Error(validation.message);
      }

      // 判断是亮主还是反主
      const isCounter = currentTrump !== null;

      // 记录亮主信息
      room.gameState.currentTrumpDeclaration = {
        playerId: player.id,
        playerName: player.name,
        suit: suit,
        count: count,
        declarationType: validation.declarationType,
        strength: validation.strength,
        jokerType: validation.jokerType,
        isCounter: isCounter,
        cards: validation.cards
      };

      // 设置主牌花色（除非是亮王，亮王表示无主）
      if (suit !== 'joker') {
        room.gameState.trumpSuit = suit;
      } else {
        room.gameState.trumpSuit = 'no_trump'; // 无主
      }

      // 广播亮主成功
      io.to(room.id).emit('trump_declared', {
        playerId: player.id,
        playerName: player.name,
        suit: suit,
        count: count,
        declarationType: validation.declarationType,
        strength: validation.strength,
        isCounter: isCounter,
        cards: validation.cards.map(c => c.toJSON())
      });

      // 广播主牌更新
      io.to(room.id).emit('trump_updated', {
        trumpSuit: room.gameState.trumpSuit,
        trumpRank: room.gameState.trumpRank
      });

      const action = isCounter ? '反主' : '亮主';
      logger.info(`玩家 ${player.name} ${action}: ${count === 2 ? '一对' : '单张'} ${suit}`);

      // 只有在摸牌结束后才重置庄家倒计时
      // 摸牌过程中亮主不触发倒计时
      const gameEngines = getGameEngines();
      const gameEngine = gameEngines.get(room.id);
      if (gameEngine && gameEngine.drawingManager) {
        const { deck, drawingIndex } = room.gameState;
        // 检查发牌是否已完成
        if (drawingIndex >= deck.length) {
          gameEngine.drawingManager.startDealerCountdown();
          logger.info(`房间 ${room.id} 重置庄家倒计时`);
        } else {
          logger.info(`房间 ${room.id} 摸牌中，暂不触发倒计时`);
        }
      }

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('亮主失败:', error);
    }
  });

  /**
   * 更新分数（房主）
   */
  socket.on('update_score', ({ roomId, playerId, newScore }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      if (room.hostId !== socket.id) {
        throw new Error('只有房主可以调整分数');
      }

      const player = room.players.find(p => p.id === playerId);
      if (!player) {
        throw new Error('玩家不存在');
      }

      if (typeof newScore !== 'number' || newScore < 0) {
        throw new Error('分数必须是非负数');
      }

      player.score = Math.floor(newScore);

      // 广播更新
      io.to(room.id).emit('score_updated', {
        playerId: player.id,
        playerName: player.name,
        newScore: player.score
      });

      // 广播房间状态更新
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

      logger.info(`房主调整 ${player.name} 分数为: ${player.score}`);

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('更新分数失败:', error);
    }
  });

  /**
   * 更新等级（房主）
   */
  socket.on('update_level', ({ roomId, playerId, newLevel }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      if (room.hostId !== socket.id) {
        throw new Error('只有房主可以调整等级');
      }

      const player = room.players.find(p => p.id === playerId);
      if (!player) {
        throw new Error('玩家不存在');
      }

      if (typeof newLevel !== 'number' || newLevel < 2 || newLevel > 14) {
        throw new Error('等级必须在2-14之间');
      }

      player.level = Math.floor(newLevel);

      // 广播更新
      io.to(room.id).emit('level_updated', {
        playerId: player.id,
        playerName: player.name,
        newLevel: player.level
      });

      // 广播房间状态更新
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

      logger.info(`房主调整 ${player.name} 等级为: ${player.level}`);

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('更新等级失败:', error);
    }
  });

  /**
   * 重新排序手牌（客户端本地处理，这里只是记录）
   */
  socket.on('reorder_cards', ({ roomId, cardOrder }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      const player = room.findPlayerBySocketId(socket.id);
      if (!player) {
        throw new Error('玩家不存在');
      }

      // 更新displayOrder（可选，主要由客户端处理）
      cardOrder.forEach((cardId, index) => {
        const card = player.cards.find(c => c.id === cardId);
        if (card) {
          card.displayOrder = index;
        }
      });

      logger.debug(`玩家 ${player.name} 重新排序手牌`);

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('重新排序失败:', error);
    }
  });

  /**
   * 更新玩家昵称
   */
  socket.on('update_player_name', ({ roomId, newName }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      const player = room.findPlayerBySocketId(socket.id);
      if (!player) {
        throw new Error('玩家不存在');
      }

      if (!newName || typeof newName !== 'string') {
        throw new Error('昵称不能为空');
      }

      const trimmedName = newName.trim();
      if (trimmedName.length === 0) {
        throw new Error('昵称不能为空');
      }

      if (trimmedName.length > 20) {
        throw new Error('昵称长度不能超过20个字符');
      }

      const oldName = player.name;
      player.name = trimmedName;

      // 广播昵称更新
      io.to(room.id).emit('player_name_updated', {
        playerId: player.id,
        oldName: oldName,
        newName: player.name
      });

      // 广播房间状态更新
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

      logger.info(`玩家 ${oldName} 修改昵称为: ${player.name}`);

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('更新昵称失败:', error);
    }
  });

  /**
   * 发送聊天消息
   */
  socket.on('send_chat_message', ({ roomId, message }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      const player = room.findPlayerBySocketId(socket.id);
      if (!player) {
        throw new Error('玩家不存在');
      }

      if (!message || typeof message !== 'string') {
        throw new Error('消息不能为空');
      }

      const trimmedMessage = message.trim();
      if (trimmedMessage.length === 0) {
        throw new Error('消息不能为空');
      }

      if (trimmedMessage.length > 200) {
        throw new Error('消息长度不能超过200个字符');
      }

      // 广播聊天消息
      io.to(room.id).emit('chat_message_received', {
        playerName: player.name,
        message: trimmedMessage,
        timestamp: Date.now()
      });

      logger.info(`玩家 ${player.name} 发送聊天消息: ${trimmedMessage}`);

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('发送聊天消息失败:', error);
    }
  });
}
