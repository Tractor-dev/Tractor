import { GameEngine } from '../../services/GameEngine.js';
import { GamePhases, normalizeRank } from '../../utils/constants.js';
import BotService from '../../services/BotService.js';
import logger from '../../utils/logger.js';

// 存储每个房间的游戏引擎
const gameEngines = new Map();

// 存储每个房间的bot服务
const botServices = new Map();

// 存储每个房间的bot是否正在出牌中（防止并发触发）
const botPlayingInProgress = new Map();

// 导出gameEngines供其他模块使用（如roomHandlers中清理资源）
export function getGameEngines() {
  return gameEngines;
}

// 导出botServices供其他模块使用
export function getBotServices() {
  return botServices;
}

/**
 * 获取或创建房间的BotService实例
 * @param {Object} room - Room object with the following properties:
 * @param {string} room.id - Room identifier used as key in botServices map
 * @param {Object} room.config - Room configuration
 * @param {string} room.config.botType - Bot type identifier (e.g., 'who_designed', 'simple')
 * @returns {BotService} - Bot service instance
 */
function getOrCreateBotService(room) {
  let botService = botServices.get(room.id);
  if (!botService || botService.botType !== room.config.botType) {
    if (botService) {
      logger.info(`Bot类型已变更，从 ${botService.botType} 到 ${room.config.botType}，重新创建BotService`);
      botService.clearHistory();
    }
    logger.info(`创建新的BotService实例，Bot类型: ${room.config.botType}`);
    botService = new BotService(room.config.botType);
    botServices.set(room.id, botService);
  }
  return botService;
}

/**
 * 触发当前轮到的Bot自动出牌
 * @param {Object} io - Socket.IO server instance
 * @param {Object} room - Room object
 * @param {Object} gameEngine - GameEngine instance
 */
export async function triggerBotPlay(io, room, gameEngine) {
  logger.info(`=== 检查是否需要触发Bot出牌 ===`);
  logger.info(`房间ID: ${room.id}, 游戏阶段: ${room.gameState.phase}`);

  // 防止并发触发：检查是否已有bot正在出牌
  if (botPlayingInProgress.get(room.id)) {
    logger.info(`房间 ${room.id} 已有Bot正在出牌中，跳过本次触发`);
    return;
  }

  // 检查游戏状态
  if (room.gameState.phase !== GamePhases.PLAYING) {
    logger.warn(`游戏阶段不是PLAYING，当前阶段: ${room.gameState.phase}，跳过bot出牌`);
    return;
  }

  // 获取当前应该出牌的玩家
  const currentPlayerIndex = room.gameState.currentPlayerIndex;
  if (currentPlayerIndex === null || currentPlayerIndex === undefined) {
    logger.info('当前没有指定出牌玩家（自由模式），跳过bot出牌');
    return;
  }

  const currentPlayer = room.players[currentPlayerIndex];
  if (!currentPlayer) {
    logger.warn(`找不到索引为 ${currentPlayerIndex} 的玩家`);
    return;
  }

  // 检查当前玩家是否是Bot
  if (!currentPlayer.isBot) {
    logger.info(`当前玩家 ${currentPlayer.name} 不是Bot，等待真人玩家出牌`);
    return;
  }

  // 检查Bot是否还有手牌
  if (currentPlayer.cards.length === 0) {
    logger.info(`Bot ${currentPlayer.name} 已经没有手牌了`);
    return;
  }

  logger.info(`\n--- 轮到Bot ${currentPlayer.name} 出牌 ---`);

  // 设置正在出牌标志
  botPlayingInProgress.set(room.id, true);

  // 获取或创建bot服务
  const botService = getOrCreateBotService(room);

  try {
    logger.info(`触发Bot ${currentPlayer.name} 自动出牌`);
    logger.info(`Bot ${currentPlayer.name} 当前手牌数: ${currentPlayer.cards.length}`);

    // 延迟一小段时间，模拟思考过程
    await new Promise(resolve => setTimeout(resolve, 1500));

    // 调用bot获取决策
    logger.info(`开始调用BotService.getBotAction...`);
    const cardIds = await botService.getBotAction(
      room.gameState,
      currentPlayer.cards,
      currentPlayerIndex,
      room
    );

    logger.info(`Bot ${currentPlayer.name} 决策完成，选择出牌: ${cardIds.length} 张，卡牌IDs: ${JSON.stringify(cardIds)}`);

    // 执行出牌
    logger.info(`执行Bot ${currentPlayer.name} 出牌操作...`);
    const result = gameEngine.playCards(currentPlayer.id, cardIds);
    logger.info(`Bot ${currentPlayer.name} 出牌成功，剩余 ${result.remainingCount} 张牌`);

    // 广播甩牌失败消息
    if (result.throwFailed) {
      io.to(room.id).emit('throw_failed', {
        playerId: currentPlayer.id,
        playerName: currentPlayer.name,
        message: result.throwFailed.message,
        attemptedCards: result.throwFailed.attemptedCards,
        attemptedCardObjects: result.throwFailed.attemptedCardObjects,
        forcedCards: result.throwFailed.forcedCards
      });
    }

    // 广播bot出牌
    io.to(room.id).emit('cards_played', {
      playerId: currentPlayer.id,
      playerName: currentPlayer.name,
      cards: result.playedCards,
      remainingCount: result.remainingCount,
      isLeading: result.isLeading
    });

    // 广播毙牌动作
    if (result.trumpAction) {
      io.to(room.id).emit('trump_action', {
        type: result.trumpAction.type,
        playerId: result.trumpAction.playerId,
        playerName: result.trumpAction.playerName
      });
    }

    // 广播回合状态更新
    if (result.roundUpdate) {
      io.to(room.id).emit('round_updated', result.roundUpdate);
    }

    // 检查是否有玩家打完牌
    if (result.remainingCount === 0) {
      logger.info(`Bot ${currentPlayer.name} 已打完所有牌`);
      io.to(room.id).emit('player_finished', {
        playerId: currentPlayer.id,
        playerName: currentPlayer.name
      });
    }

    // 游戏结束
    if (result.gameFinished) {
      logger.info('游戏结束，揭示底牌');
      // 发送底牌和得分结果
      io.to(room.id).emit('bottom_revealed', {
        bottomCards: room.gameState.bottomCards.map(c => c.toJSON()),
        bottomScoreResult: room.gameState.bottomScoreResult,
        upgradeResult: room.gameState.upgradeResult
      });

      io.to(room.id).emit('phase_changed', {
        phase: 'revealing',
        message: '所有玩家已出完牌，查看底牌'
      });
    }

    // 广播房间状态更新
    io.to(room.id).emit('room_updated', {
      room: room.toJSON()
    });

    // 如果游戏未结束且下一位也是Bot，继续触发
    if (!result.gameFinished && room.gameState.phase === GamePhases.PLAYING) {
      logger.info('检查下一位玩家是否是Bot...');
      // 清除正在出牌标志，允许下一位Bot出牌
      botPlayingInProgress.delete(room.id);
      // 延迟后递归调用，检查下一位玩家
      setTimeout(() => {
        triggerBotPlay(io, room, gameEngine).catch(err => {
          logger.error('触发下一位bot出牌失败:', err);
          logger.error('错误堆栈:', err.stack);
        });
      }, 1000);
    } else {
      // 清除正在出牌标志
      botPlayingInProgress.delete(room.id);
      logger.info('=== Bot出牌流程结束 ===');
    }

  } catch (error) {
    logger.error(`Bot ${currentPlayer.name} 出牌失败:`, error);
    logger.error('错误堆栈:', error.stack);
    
    // 尝试使用fallback策略：出相应数量的牌
    try {
      const leadingPattern = room.gameState.leadingPattern;
      // 使用 length 字段（单张=1，对子=2，拖拉机=连续对子数*2，甩牌=所有牌数）
      const requiredCount = leadingPattern?.length || 1;
      const patternType = leadingPattern?.type; // 'single', 'pair', 'tractor', 'throw'
      logger.info(`尝试Bot ${currentPlayer.name} fallback策略：出 ${requiredCount} 张牌, 类型: ${patternType}`);
      
      let fallbackCardIds = [];
      const trumpSuit = room.gameState.trumpSuit;
      const trumpRank = room.gameState.trumpRank;
      
      // 辅助函数：判断是否是主牌
      const isTrump = (card) => card.suit === trumpSuit || card.rank === trumpRank || card.suit === 'joker';
      
      // 辅助函数：按花色和点数分组找对子
      const findPairs = (cards) => {
        const groups = {};
        for (const c of cards) {
          const key = `${c.suit}-${c.rank}`;
          if (!groups[key]) groups[key] = [];
          groups[key].push(c);
        }
        const pairs = [];
        for (const key in groups) {
          if (groups[key].length >= 2) {
            pairs.push([groups[key][0], groups[key][1]]);
          }
        }
        return pairs;
      };
      
      if (leadingPattern) {
        // 跟牌时，找同花色的牌
        const requiredSuit = leadingPattern.suit === 'trump' ? null : leadingPattern.suit;
        
        // 收集同花色的牌
        let sameSuitCards = [];
        if (requiredSuit) {
          sameSuitCards = currentPlayer.cards.filter(c => 
            c.suit === requiredSuit && !isTrump(c)
          );
        } else if (leadingPattern.suit === 'trump') {
          sameSuitCards = currentPlayer.cards.filter(c => isTrump(c));
        }
        
        // 如果需要出对子，先找同花色的对子
        if (patternType === 'pair' && requiredCount === 2) {
          const pairs = findPairs(sameSuitCards);
          if (pairs.length > 0) {
            fallbackCardIds = pairs[0].map(c => c.id);
          } else {
            // 没有同花色对子，出两张同花色的牌
            fallbackCardIds = sameSuitCards.slice(0, 2).map(c => c.id);
          }
        } else {
          fallbackCardIds = sameSuitCards.slice(0, requiredCount).map(c => c.id);
        }
        
        // 如果同花色不够，补充其他牌
        if (fallbackCardIds.length < requiredCount) {
          const usedIds = new Set(fallbackCardIds);
          const otherCards = currentPlayer.cards.filter(c => !usedIds.has(c.id));
          
          // 如果需要对子，尝试找其他花色的对子
          if (patternType === 'pair' && fallbackCardIds.length === 0) {
            const allPairs = findPairs(otherCards);
            if (allPairs.length > 0) {
              fallbackCardIds = allPairs[0].map(c => c.id);
            }
          }
          
          // 如果还是不够，随便补充
          if (fallbackCardIds.length < requiredCount) {
            const stillUsedIds = new Set(fallbackCardIds);
            const remainingCards = currentPlayer.cards.filter(c => !stillUsedIds.has(c.id));
            const needed = requiredCount - fallbackCardIds.length;
            fallbackCardIds = fallbackCardIds.concat(remainingCards.slice(0, needed).map(c => c.id));
          }
        }
      } else {
        // 首发时，出第一张牌
        if (currentPlayer.cards.length > 0) {
          fallbackCardIds = [currentPlayer.cards[0].id];
        }
      }
      
      if (fallbackCardIds.length > 0) {
        const fallbackResult = gameEngine.playCards(currentPlayer.id, fallbackCardIds);
        logger.info(`Bot ${currentPlayer.name} fallback出牌成功`);
        
        // 更新WhoDesigned bot的响应历史（将空响应替换为实际出的牌）
        const botService = botServices.get(room.id);
        if (botService) {
          botService.updateLastResponse(currentPlayer.id, fallbackResult.playedCards);
        }
        
        // 广播bot出牌
        io.to(room.id).emit('cards_played', {
          playerId: currentPlayer.id,
          playerName: currentPlayer.name,
          cards: fallbackResult.playedCards,
          remainingCount: fallbackResult.remainingCount,
          isLeading: fallbackResult.isLeading
        });

        // 广播回合状态更新
        if (fallbackResult.roundUpdate) {
          io.to(room.id).emit('round_updated', fallbackResult.roundUpdate);
        }

        // 检查是否有玩家打完牌
        if (fallbackResult.remainingCount === 0) {
          io.to(room.id).emit('player_finished', {
            playerId: currentPlayer.id,
            playerName: currentPlayer.name
          });
        }

        // 游戏结束
        if (fallbackResult.gameFinished) {
          io.to(room.id).emit('bottom_revealed', {
            bottomCards: room.gameState.bottomCards.map(c => c.toJSON()),
            bottomScoreResult: room.gameState.bottomScoreResult,
            upgradeResult: room.gameState.upgradeResult
          });

          io.to(room.id).emit('phase_changed', {
            phase: 'revealing',
            message: '所有玩家已出完牌，查看底牌'
          });
        }

        // 广播房间状态更新
        io.to(room.id).emit('room_updated', {
          room: room.toJSON()
        });

        // 继续触发下一位bot
        if (!fallbackResult.gameFinished && room.gameState.phase === GamePhases.PLAYING) {
          // 清除正在出牌标志，允许下一位Bot出牌
          botPlayingInProgress.delete(room.id);
          setTimeout(() => {
            triggerBotPlay(io, room, gameEngine).catch(err => {
              logger.error('触发下一位bot出牌失败:', err);
            });
          }, 1000);
        } else {
          // 清除正在出牌标志
          botPlayingInProgress.delete(room.id);
        }
      } else {
        // 清除正在出牌标志
        botPlayingInProgress.delete(room.id);
        logger.error(`Bot ${currentPlayer.name} 没有手牌，无法fallback`);
      }
    } catch (fallbackError) {
      // 清除正在出牌标志
      botPlayingInProgress.delete(room.id);
      logger.error(`Bot ${currentPlayer.name} fallback也失败:`, fallbackError);
    }
  }
}

export function registerGameHandlers(io, socket, roomManager) {

  /**
   * 开始游戏（房主）
   */
  socket.on('start_game', ({ roomId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      if (room.hostId !== socket.id) {
        throw new Error('只有房主可以开始游戏');
      }

      if (!room.canStart()) {
        throw new Error(`需要${room.config.minPlayers}-${room.config.maxPlayers}名玩家才能开始`);
      }

      // 记录游戏开始时的真人玩家数量，用于断线重连判断
      room.originalHumanPlayerCount = room.getHumanPlayerCount();
      logger.info(`房间 ${room.id} 开始游戏，真人玩家数量: ${room.originalHumanPlayerCount}`);

      // 创建bot出牌回调函数
      const onBotPlayNeeded = () => {
        const currentGameEngine = gameEngines.get(room.id);
        if (currentGameEngine) {
          triggerBotPlay(io, room, currentGameEngine).catch(err => {
            logger.error('触发bot出牌失败:', err);
          });
        }
      };

      // 创建新游戏开始时的回调函数（用于清除bot服务缓存）
      const onNewGameStart = () => {
        const botService = botServices.get(room.id);
        if (botService) {
          logger.info(`房间 ${room.id} 开始新游戏，清除bot服务缓存`);
          botService.clearHistory();
          botServices.delete(room.id);
        }
      };

      // 创建获取共享bot服务的回调函数（使用helper函数）
      const getBotServiceCallback = () => getOrCreateBotService(room);

      // 创建游戏引擎，传入bot出牌回调、新游戏开始回调和获取bot服务的回调
      const gameEngine = new GameEngine(room, io, onBotPlayNeeded, onNewGameStart, getBotServiceCallback);
      gameEngines.set(room.id, gameEngine);

      // 开始游戏
      gameEngine.startGame();

      // 广播房间状态更新
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('开始游戏失败:', error);
    }
  });

  /**
   * 玩家准备
   */
  socket.on('player_ready', ({ roomId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      const player = room.findPlayerBySocketId(socket.id);
      if (!player) {
        throw new Error('玩家不存在');
      }

      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) {
        throw new Error('游戏未开始');
      }

      const allReady = gameEngine.playerReady(player.id);

      // 广播玩家准备状态
      io.to(room.id).emit('player_ready_status', {
        playerId: player.id,
        playerName: player.name,
        isReady: player.isReady
      });

      // 广播房间状态更新
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

      if (allReady) {
        // 所有玩家准备完毕
        io.to(room.id).emit('all_players_ready', {
          message: '所有玩家已准备，开始发牌'
        });
      }

      logger.info(`房间 ${room.id} 玩家 ${player.name} 已准备`);

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('玩家准备失败:', error);
    }
  });

  /**
   * 设置埋底玩家（房主）
   */
  socket.on('set_burying_player', ({ roomId, playerId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      if (room.hostId !== socket.id) {
        throw new Error('只有房主可以指定埋底玩家');
      }

      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) {
        throw new Error('游戏未开始');
      }

      // 进入埋底阶段
      room.gameState.phase = GamePhases.BURYING;

      const buryingPlayer = gameEngine.setBuryingPlayer(playerId);

      // 如果是第一局（dealerPlayerIndex为null），同时设置dealerPlayerIndex
      // 这样前端可以统一使用dealerPlayerIndex来判断庄家
      if (room.gameState.dealerPlayerIndex === null) {
        const dealerIndex = room.players.findIndex(p => p.id === playerId);
        if (dealerIndex !== -1) {
          room.gameState.dealerPlayerIndex = dealerIndex;
          logger.info(`房间 ${room.id} 第一局设置庄家索引: ${dealerIndex}`);
        }
      }

      // 私密发送底牌给埋底玩家
      io.to(buryingPlayer.socketId).emit('bottom_cards_received', {
        bottomCards: room.gameState.bottomCards.map(c => c.toJSON()),
        totalCards: buryingPlayer.cards.length
      });

      // 广播埋底玩家
      io.to(room.id).emit('burying_player_set', {
        playerId: buryingPlayer.id,
        playerName: buryingPlayer.name
      });

      // 广播房间状态更新
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

      // 如果埋底玩家是Bot，自动触发bot盖底牌
      if (buryingPlayer.isBot) {
        logger.info(`Bot ${buryingPlayer.name} 需要盖底牌`);
        setTimeout(async () => {
          try {
            // 获取或创建bot服务
            const botService = getOrCreateBotService(room);

            const playerIndex = room.players.findIndex(p => p.id === playerId);
            const bottomCards = room.gameState.bottomCards;

            // 调用bot获取盖底牌决策
            const cardIds = await botService.getBotCoverAction(
              room.gameState,
              bottomCards,
              buryingPlayer.cards,
              playerIndex,
              room
            );

            logger.info(`Bot ${buryingPlayer.name} 选择盖底牌: ${cardIds.length} 张`);

            // 执行盖底牌
            gameEngine.buryCards(playerId, cardIds);

            // 广播埋底完成
            io.to(room.id).emit('cards_buried', {
              playerId: playerId,
              playerName: buryingPlayer.name
            });

            // 广播首发玩家已设置（埋底玩家自动成为首发）
            io.to(room.id).emit('first_player_set', {
              playerId: playerId,
              playerName: buryingPlayer.name,
              currentPlayerIndex: room.gameState.currentPlayerIndex
            });

            // 广播阶段切换
            io.to(room.id).emit('phase_changed', {
              phase: 'playing',
              message: `埋底完成，${buryingPlayer.name} 先出牌`
            });

            // 广播房间状态更新
            io.to(room.id).emit('room_updated', {
              room: room.toJSON()
            });

            // 触发bot自动出牌
            triggerBotPlay(io, room, gameEngine).catch(err => {
              logger.error('触发bot出牌失败:', err);
            });

          } catch (error) {
            logger.error(`Bot ${buryingPlayer.name} 盖底牌失败:`, error);
            // Bot失败时使用默认策略：盖最小的牌
            const cardIds = buryingPlayer.cards.slice(0, room.config.bottomCardsCount).map(c => c.id);
            gameEngine.buryCards(playerId, cardIds);

            io.to(room.id).emit('cards_buried', {
              playerId: playerId,
              playerName: buryingPlayer.name
            });

            io.to(room.id).emit('first_player_set', {
              playerId: playerId,
              playerName: buryingPlayer.name,
              currentPlayerIndex: room.gameState.currentPlayerIndex
            });

            io.to(room.id).emit('phase_changed', {
              phase: 'playing',
              message: `埋底完成，${buryingPlayer.name} 先出牌`
            });

            io.to(room.id).emit('room_updated', {
              room: room.toJSON()
            });

            triggerBotPlay(io, room, gameEngine).catch(err => {
              logger.error('触发bot出牌失败:', err);
            });
          }
        }, 1500); // 延迟1.5秒模拟思考
      }

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('设置埋底玩家失败:', error);
    }
  });

  /**
   * 埋底
   */
  socket.on('bury_cards', ({ roomId, cardIds }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      const player = room.findPlayerBySocketId(socket.id);
      if (!player) {
        throw new Error('玩家不存在');
      }

      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) {
        throw new Error('游戏未开始');
      }

      gameEngine.buryCards(player.id, cardIds);

      // 广播埋底完成
      io.to(room.id).emit('cards_buried', {
        playerId: player.id,
        playerName: player.name
      });

      // 广播首发玩家已设置（埋底玩家自动成为首发）
      io.to(room.id).emit('first_player_set', {
        playerId: player.id,
        playerName: player.name,
        currentPlayerIndex: room.gameState.currentPlayerIndex
      });

      // 广播阶段切换
      io.to(room.id).emit('phase_changed', {
        phase: 'playing',
        message: `埋底完成，${player.name} 先出牌`
      });

      // 广播房间状态更新
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

      // 触发bot自动出牌
      triggerBotPlay(io, room, gameEngine).catch(err => {
        logger.error('触发bot出牌失败:', err);
      });

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('埋底失败:', error);
    }
  });

  /**
   * 设置首发玩家（房主）
   */
  socket.on('set_first_player', ({ roomId, playerId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      if (room.hostId !== socket.id) {
        throw new Error('只有房主可以指定首发玩家');
      }

      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) {
        throw new Error('游戏未开始');
      }

      const firstPlayer = gameEngine.setFirstPlayer(playerId);

      // 广播首发玩家
      io.to(room.id).emit('first_player_set', {
        playerId: firstPlayer.id,
        playerName: firstPlayer.name,
        currentPlayerIndex: room.gameState.currentPlayerIndex,
        currentPlayerId: firstPlayer.id,
        currentPlayerName: firstPlayer.name
      });

      // 广播房间状态更新
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

      logger.info(`房间 ${room.id} 首发玩家: ${firstPlayer.name}`);

      // 触发bot自动出牌
      triggerBotPlay(io, room, gameEngine).catch(err => {
        logger.error('触发bot出牌失败:', err);
      });

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('设置首发玩家失败:', error);
    }
  });

  /**
   * 设置主牌（房主）
   */
  socket.on('set_trump', ({ roomId, suit, rank }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      if (room.hostId !== socket.id) {
        throw new Error('只有房主可以设置主牌');
      }

      // 设置主牌（规范化 rank 确保类型一致）
      const normalizedRank = normalizeRank(rank);
      room.gameState.trumpSuit = suit;
      room.gameState.trumpRank = normalizedRank;

      // 广播主牌更新
      io.to(room.id).emit('trump_updated', {
        trumpSuit: suit,
        trumpRank: normalizedRank
      });

      // 广播房间状态更新
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

      logger.info(`房间 ${room.id} 主牌已设置: ${suit} ${rank}`);

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('设置主牌失败:', error);
    }
  });

  /**
   * 出牌
   */
  socket.on('play_cards', ({ roomId, cardIds }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      const player = room.findPlayerBySocketId(socket.id);
      if (!player) {
        throw new Error('玩家不存在');
      }

      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) {
        throw new Error('游戏未开始');
      }

      const result = gameEngine.playCards(player.id, cardIds);

      // 广播甩牌失败消息
      if (result.throwFailed) {
        io.to(room.id).emit('throw_failed', {
          playerId: player.id,
          playerName: player.name,
          message: result.throwFailed.message,
          attemptedCards: result.throwFailed.attemptedCards,
          attemptedCardObjects: result.throwFailed.attemptedCardObjects,
          forcedCards: result.throwFailed.forcedCards
        });
      }

      // 广播出牌
      io.to(room.id).emit('cards_played', {
        playerId: player.id,
        playerName: player.name,
        cards: result.playedCards,
        remainingCount: result.remainingCount,
        isLeading: result.isLeading
      });

      // 广播毙牌动作
      if (result.trumpAction) {
        io.to(room.id).emit('trump_action', {
          type: result.trumpAction.type,
          playerId: result.trumpAction.playerId,
          playerName: result.trumpAction.playerName
        });
      }

      // 广播回合状态更新
      if (result.roundUpdate) {
        io.to(room.id).emit('round_updated', result.roundUpdate);
      }

      // 检查是否有玩家打完牌
      if (result.remainingCount === 0) {
        io.to(room.id).emit('player_finished', {
          playerId: player.id,
          playerName: player.name
        });
      }

      // 游戏结束
      if (result.gameFinished) {
        // 发送底牌和得分结果
        io.to(room.id).emit('bottom_revealed', {
          bottomCards: room.gameState.bottomCards.map(c => c.toJSON()),
          bottomScoreResult: room.gameState.bottomScoreResult,
          upgradeResult: room.gameState.upgradeResult
        });

        io.to(room.id).emit('phase_changed', {
          phase: 'revealing',
          message: '所有玩家已出完牌，查看底牌'
        });
      }

      // 广播房间状态更新
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

      // 触发下一位bot自动出牌
      if (!result.gameFinished) {
        triggerBotPlay(io, room, gameEngine).catch(err => {
          logger.error('触发下一位bot出牌失败:', err);
        });
      }

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('出牌失败:', error);
    }
  });

  /**
   * 跳过（出0张牌）
   */
  socket.on('pass_turn', ({ roomId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      const player = room.findPlayerBySocketId(socket.id);
      if (!player) {
        throw new Error('玩家不存在');
      }

      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) {
        throw new Error('游戏未开始');
      }

      // 跳过就是出0张牌
      const result = gameEngine.playCards(player.id, []);

      // 广播跳过
      io.to(room.id).emit('turn_passed', {
        playerId: player.id,
        playerName: player.name
      });

      // 游戏结束检查
      if (result.gameFinished) {
        io.to(room.id).emit('bottom_revealed', {
          bottomCards: room.gameState.bottomCards.map(c => c.toJSON()),
          bottomScoreResult: room.gameState.bottomScoreResult,
          upgradeResult: room.gameState.upgradeResult
        });

        io.to(room.id).emit('phase_changed', {
          phase: 'revealing',
          message: '所有玩家已出完牌，查看底牌'
        });
      }

      // 广播房间状态更新
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('跳过失败:', error);
    }
  });


  /**
   * 查看我的底牌（埋底玩家）
   */
  socket.on('view_my_bottom_cards', ({ roomId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      const player = room.findPlayerBySocketId(socket.id);
      if (!player) {
        throw new Error('玩家不存在');
      }

      // 只有埋底玩家可以查看
      if (room.gameState.buryingPlayerId !== player.id) {
        throw new Error('只有埋底玩家可以查看底牌');
      }

      // 返回底牌
      socket.emit('my_bottom_cards', {
        bottomCards: room.gameState.bottomCards.map(c => c.toJSON())
      });

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('查看底牌失败:', error);
    }
  });


  /**
   * 撤回出牌
   */
  socket.on('undo_play', ({ roomId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      const player = room.findPlayerBySocketId(socket.id);
      if (!player) {
        throw new Error('玩家不存在');
      }

      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) {
        throw new Error('游戏未开始');
      }

      const result = gameEngine.undoLastPlay(player.id);

      // 广播撤回
      io.to(room.id).emit('play_undone', {
        playerId: player.id,
        playerName: player.name,
        cards: result.cards,
        remainingCount: result.remainingCount
      });

      // 广播房间状态更新
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('撤回出牌失败:', error);
    }
  });

  /**
   * 准备开始下一局
   */
  socket.on('ready_for_next_game', ({ roomId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      const player = room.findPlayerBySocketId(socket.id);
      if (!player) {
        throw new Error('玩家不存在');
      }

      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) {
        throw new Error('游戏未开始');
      }

      const allReady = gameEngine.readyForNextGame(player.id);

      // 广播准备状态
      const readyCount = room.players.filter(p => p.isReadyForNext).length;
      io.to(room.id).emit('player_ready_for_next', {
        playerId: player.id,
        playerName: player.name,
        readyCount,
        totalCount: room.players.length
      });

      // 所有人准备好后会自动开始下一局（在 readyForNextGame 中处理）
      // 这里只需要广播房间状态更新
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('准备下一局失败:', error);
    }
  });

  /**
   * 重新开始（房主）
   */
  socket.on('restart_game', ({ roomId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      if (room.hostId !== socket.id) {
        throw new Error('只有房主可以重新开始');
      }

      const gameEngine = gameEngines.get(room.id);
      if (!gameEngine) {
        throw new Error('游戏未开始');
      }

      gameEngine.restartGame();

      // 广播游戏重新开始事件
      io.to(room.id).emit('game_restarted', {
        room: room.toJSON()
      });

      // 广播房间状态更新
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

      logger.info(`房间 ${room.id} 重新开始游戏`);

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('重新开始失败:', error);
    }
  });

  /**
   * 调整分数
   */
  socket.on('update_score', ({ roomId, amount }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      const player = room.findPlayerBySocketId(socket.id);
      if (!player) {
        throw new Error('玩家不存在');
      }

      player.score = Math.max(0, player.score + amount);

      // 广播房间状态更新
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

      logger.info(`房间 ${room.id} 玩家 ${player.name} 分数调整为 ${player.score}`);

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('调整分数失败:', error);
    }
  });

  /**
   * 调整等级
   */
  socket.on('update_level', ({ roomId, amount }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      const player = room.findPlayerBySocketId(socket.id);
      if (!player) {
        throw new Error('玩家不存在');
      }

      player.level = Math.max(2, player.level + amount);

      // 广播房间状态更新
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

      logger.info(`房间 ${room.id} 玩家 ${player.name} 等级调整为 ${player.level}`);

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('调整等级失败:', error);
    }
  });

  /**
   * 选择规则
   */
  socket.on('select_rule', ({ roomId, rule }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      const player = room.findPlayerBySocketId(socket.id);
      if (!player) {
        throw new Error('玩家不存在');
      }

      // 设置房间的选中规则（覆盖之前的规则）
      room.gameState.selectedRule = rule;

      // 广播规则选择给所有玩家
      io.to(room.id).emit('rule_selected', {
        playerId: player.id,
        playerName: player.name,
        rule: rule
      });

      // 广播房间状态更新
      io.to(room.id).emit('room_updated', {
        room: room.toJSON()
      });

      logger.info(`房间 ${room.id} 玩家 ${player.name} 选择规则: ${rule.name}`);

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('选择规则失败:', error);
    }
  });

  /**
   * 获取游戏记录（房主保存全局功能）
   */
  socket.on('get_game_records', ({ roomId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      if (room.hostId !== socket.id) {
        throw new Error('只有房主可以下载游戏记录');
      }

      // 收集所有轮的出牌记录
      const playHistory = room.gameState.playHistory.map(record => ({
        playerId: record.playerId,
        playerName: record.playerName,
        playerIndex: record.playerIndex,
        cards: record.cards,
        timestamp: record.timestamp
      }));

      // 收集bot的输入输出历史
      const botHistories = {};
      const botService = botServices.get(room.id);
      if (botService && botService.whoDesignedService) {
        // WhoDesigned bot has detailed history
        const whoDesignedService = botService.whoDesignedService;
        for (const [playerId, history] of whoDesignedService.botHistory.entries()) {
          botHistories[playerId] = {
            requests: history.requests,
            responses: history.responses
          };
        }
      }

      // 构建游戏记录
      const gameRecords = {
        roomId: room.id,
        roomName: room.name,
        exportTime: new Date().toISOString(),
        gameConfig: {
          bottomCardsCount: room.config.bottomCardsCount,
          dealInterval: room.config.dealInterval,
          playMode: room.config.playMode,
          botType: room.config.botType
        },
        gameState: {
          phase: room.gameState.phase,
          trumpSuit: room.gameState.trumpSuit,
          trumpRank: room.gameState.trumpRank,
          currentRound: room.gameState.currentRound,
          attackerScore: room.gameState.attackerScore,
          team1Level: room.gameState.team1Level,
          team2Level: room.gameState.team2Level
        },
        players: room.players.map(p => ({
          id: p.id,
          name: p.name,
          isBot: p.isBot,
          score: p.score,
          level: p.level
        })),
        playHistory: playHistory,
        botHistories: botHistories,
        bottomCards: room.gameState.bottomCards.map(c => c.toJSON ? c.toJSON() : c),
        bottomScoreResult: room.gameState.bottomScoreResult,
        upgradeResult: room.gameState.upgradeResult
      };

      // 发送游戏记录
      socket.emit('game_records', {
        records: gameRecords
      });

      logger.info(`房间 ${room.id} 导出游戏记录成功`);

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('获取游戏记录失败:', error);
    }
  });

  /**
   * 观战者查看玩家手牌
   */
  socket.on('spectator_view_hand', ({ roomId, playerId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('房间不存在');
      }

      // 检查请求者是否是观战者
      const spectator = room.findSpectatorBySocketId(socket.id);
      if (!spectator) {
        throw new Error('只有观战者可以查看手牌');
      }

      // 检查房间是否允许观战者查看手牌
      if (!room.config.allowSpectatorViewHands) {
        throw new Error('房主未开启观战者查看手牌功能');
      }

      // 查找目标玩家
      const player = room.findPlayerById(playerId);
      if (!player) {
        throw new Error('玩家不存在');
      }

      // 返回玩家手牌
      socket.emit('spectator_hand_view', {
        playerId: player.id,
        playerName: player.name,
        cards: player.cards.map(c => c.toJSON ? c.toJSON() : c)
      });

      logger.info(`观战者 ${spectator.name} 查看了 ${player.name} 的手牌`);

    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('观战者查看手牌失败:', error);
    }
  });
}
