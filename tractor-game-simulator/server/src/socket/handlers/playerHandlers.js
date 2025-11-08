import logger from '../../utils/logger.js';

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
   * 更新分数
   */
  socket.on('update_score', ({ roomId, score }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      const player = room.findPlayerBySocketId(socket.id);
      if (!player) {
        throw new Error('玩家不存在');
      }

      if (typeof score !== 'number' || score < 0) {
        throw new Error('分数必须是非负数');
      }

      player.score = Math.floor(score);

      // 广播更新
      io.to(room.id).emit('player_updated', {
        player: player.toJSON()
      });

      logger.info(`玩家 ${player.name} 更新分数: ${player.score}`);

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('更新分数失败:', error);
    }
  });

  /**
   * 更新等级
   */
  socket.on('update_level', ({ roomId, level }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      const player = room.findPlayerBySocketId(socket.id);
      if (!player) {
        throw new Error('玩家不存在');
      }

      if (typeof level !== 'number' || level < 1) {
        throw new Error('等级必须是正整数');
      }

      player.level = Math.floor(level);

      // 广播更新
      io.to(room.id).emit('player_updated', {
        player: player.toJSON()
      });

      logger.info(`玩家 ${player.name} 更新等级: ${player.level}`);

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
}
