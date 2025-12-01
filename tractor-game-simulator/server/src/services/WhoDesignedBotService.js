import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';
import { CardNumberingSystem } from '../utils/cardNumbering.js';
import { Suits, PlayModes, GamePhases } from '../utils/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * WhoDesigned Bot服务
 * 负责管理和调用WhoDesigned Python bot
 */
export class WhoDesignedBotService {
  constructor() {
    this.botScriptPath = path.resolve(__dirname, '../bots/WhoDesigned/__main__.py');
    logger.info('使用WhoDesigned Bot');

    // 存储每个bot的历史请求和响应
    // key: playerId, value: {requests: [], responses: []}
    this.botHistory = new Map();
  }

  /**
   * 调用bot获取决策
   * @param {Object} params
   * @param {string} params.stage - 阶段：'deal', 'cover', 'play'
   * @param {Object} params.gameState - 游戏状态
   * @param {Object} params.room - 房间对象
   * @param {string} params.playerId - 玩家ID
   * @param {number} params.playerIndex - 玩家索引 (0-3)
   * @param {Array} params.playerCards - 玩家手牌
   * @param {Array} params.deliverCards - 本次发给玩家的牌（deal/cover阶段）
   * @returns {Promise<Array>} - bot返回的卡牌ID数组
   */
  async getBotAction(params) {
    const { stage, gameState, room, playerId, playerIndex, playerCards, deliverCards } = params;

    logger.info(`\n========== WhoDesigned Bot 决策开始 ==========`);
    logger.info(`玩家ID: ${playerId}, 玩家索引: ${playerIndex}, 阶段: ${stage}`);
    logger.info(`手牌数量: ${playerCards?.length || 0}, deliver牌数量: ${deliverCards?.length || 0}`);
    
    // 获取历史记录（在try外面，这样catch块也能访问）
    const history = this._getBotHistory(playerId);
    logger.info(`历史记录: requests=${history.requests.length}, responses=${history.responses.length}`);

    try {
      // 检查是否只在ORDERED模式下使用bot
      if (gameState.playMode !== PlayModes.ORDERED) {
        logger.warn('WhoDesigned bot只能在基础模式(ORDERED)下使用，当前模式为：' + gameState.playMode);
        throw new Error('WhoDesigned bot只能在基础模式下使用');
      }

      // 特殊处理：如果历史为空，需要先模拟deal阶段
      // 因为bot需要从第一个request中获取playerpos
      if (history.requests.length === 0) {
        if (stage === 'cover') {
          // Cover阶段：模拟deal阶段，包含除底牌外的所有手牌
          const bottomCardIds = new Set(deliverCards.map(c => c.id));
          const dealtCards = playerCards.filter(card => !bottomCardIds.has(card.id));

          const dealRequest = {
            stage: 'deal',
            deliver: CardNumberingSystem.cardsToNumbers(dealtCards),
            global: this._buildGlobal(gameState, room, 'deal'),
            playerpos: playerIndex
          };

          history.requests.push(dealRequest);
          history.responses.push([]);

          logger.info(`[模拟deal] Cover阶段：自动添加模拟的deal请求，包含${dealtCards.length}张牌`);
          logger.info(`[模拟deal] dealRequest: ${JSON.stringify(dealRequest)}`);
        } else if (stage === 'play') {
          // Play阶段：模拟deal阶段，包含所有手牌
          const dealRequest = {
            stage: 'deal',
            deliver: CardNumberingSystem.cardsToNumbers(playerCards),
            global: this._buildGlobal(gameState, room, 'deal'),
            playerpos: playerIndex
          };

          history.requests.push(dealRequest);
          history.responses.push([]);

          logger.info(`[模拟deal] Play阶段：自动添加模拟的deal请求，包含${playerCards.length}张牌`);
          logger.info(`[模拟deal] dealRequest: ${JSON.stringify(dealRequest)}`);
        }
      }

      // 构建bot需要的request
      const request = this._buildRequest(stage, gameState, room, playerIndex, deliverCards);
      logger.info(`[构建request] 当前阶段request: ${JSON.stringify(request)}`);

      // 添加当前request到历史
      history.requests.push(request);

      // 构建bot输入
      const botInput = {
        requests: history.requests,
        responses: history.responses
      };

      logger.info(`[Bot输入] requests数量: ${botInput.requests.length}, responses数量: ${botInput.responses.length}`);

      // 调用Python bot
      const botResponse = await this._callPythonBot(botInput);

      logger.info(`[Bot响应] 原始响应 (player ${playerIndex}): ${JSON.stringify(botResponse)}`);

      // 解析bot返回的卡牌编号，转换为项目格式的卡牌ID数组
      const cardIds = this._parseBotResponse(botResponse, playerCards);
      logger.info(`[解析响应] 转换后的cardIds: ${JSON.stringify(cardIds)}`);

      // 将响应添加到历史
      history.responses.push(botResponse.response || []);
      logger.info(`[更新历史] 响应已添加到历史，新responses长度: ${history.responses.length}`);
      logger.info(`========== WhoDesigned Bot 决策完成 ==========\n`);

      return cardIds;

    } catch (error) {
      logger.error(`[Bot决策失败] 阶段: ${stage}, 错误: ${error.message}`);
      logger.error(`[Bot决策失败] 错误堆栈: ${error.stack}`);

      // 根据阶段返回合适的默认值
      let defaultCardIds = [];
      let defaultResponse = [];

      if (stage === 'deal') {
        defaultCardIds = []; // 不报主
        defaultResponse = [];
        logger.info(`[Fallback] deal阶段: 返回空数组（不报主）`);
      } else if (stage === 'cover') {
        // 返回前8张牌作为底牌
        const coverCards = playerCards.slice(0, 8);
        defaultCardIds = coverCards.map(c => c.id);
        // 将卡牌转换为bot编号格式添加到历史
        defaultResponse = CardNumberingSystem.cardsToNumbers(coverCards);
        logger.info(`[Fallback] cover阶段: 返回前8张牌作为底牌`);
      } else {
        // play阶段：跳过
        defaultCardIds = [];
        defaultResponse = [];
        logger.info(`[Fallback] play阶段: 返回空数组（跳过），将由gameHandlers的fallback处理`);
      }

      // 重要：将默认响应添加到历史，确保下次调用时responses长度正确
      history.responses.push(defaultResponse);
      logger.info(`[Fallback] 已将默认响应添加到历史，新responses长度: ${history.responses.length}`);
      logger.info(`========== WhoDesigned Bot 决策失败，使用Fallback ==========\n`);

      return defaultCardIds;
    }
  }

  /**
   * 构建bot request对象
   */
  _buildRequest(stage, gameState, room, playerIndex, deliverCards) {
    const request = {
      stage,
      deliver: deliverCards ? CardNumberingSystem.cardsToNumbers(deliverCards) : [],
      global: this._buildGlobal(gameState, room, stage)
    };

    // deal阶段需要playerpos
    if (stage === 'deal') {
      request.playerpos = playerIndex;
    }

    // play阶段需要history
    if (stage === 'play') {
      request.history = this._buildHistory(gameState, room);
    }

    return request;
  }

  /**
   * 构建global对象
   */
  _buildGlobal(gameState, room, stage) {
    const global = {
      first_round: true, // 暂时总是true，后续可以根据游戏局数调整
      level: this._getLevelString(room),
      banking: this._buildBanking(gameState, room)
    };

    // play阶段需要total_score
    if (stage === 'play') {
      global.total_score = this._calculateIdlerScore(gameState, room);
    }

    return global;
  }

  /**
   * 获取级牌字符串
   */
  _getLevelString(room) {
    // 从房间中获取庄家队的等级
    // 根据dealerPlayerIndex确定庄家所在队伍，然后返回该队伍的等级
    if (room.gameState) {
      const dealerPlayerIndex = room.gameState.dealerPlayerIndex;
      if (dealerPlayerIndex !== null && dealerPlayerIndex !== undefined) {
        // 队伍1: 索引0和2, 队伍2: 索引1和3
        const dealerTeam = dealerPlayerIndex % 2 === 0 ? 1 : 2;
        const dealerLevel = dealerTeam === 1 ? room.gameState.team1Level : room.gameState.team2Level;
        if (dealerLevel !== undefined && dealerLevel !== null) {
          return String(dealerLevel);
        }
      }
      // 如果dealerPlayerIndex为null（第一局），使用team1Level作为默认值
      if (room.gameState.team1Level !== undefined && room.gameState.team1Level !== null) {
        return String(room.gameState.team1Level);
      }
    }
    return '2'; // 默认从2开始
  }

  /**
   * 构建banking对象（报主/反主信息）
   */
  _buildBanking(gameState, room) {
    const banking = {
      called: -1,      // 报主玩家id
      snatched: -1,    // 反主玩家id
      major: '',       // 主花色
      banker: -1       // 庄家id
    };

    // 获取主花色
    if (gameState.trumpSuit) {
      if (gameState.trumpSuit === Suits.NO_TRUMP || gameState.trumpSuit === 'n') {
        banking.major = 'n';
      } else {
        // 映射花色到bot格式
        const suitMap = {
          [Suits.HEARTS]: 'h',
          [Suits.DIAMONDS]: 'd',
          [Suits.SPADES]: 's',
          [Suits.CLUBS]: 'c'
        };
        banking.major = suitMap[gameState.trumpSuit] || '';
      }
    }

    // 获取庄家
    if (gameState.dealerPlayerIndex !== undefined && gameState.dealerPlayerIndex !== null) {
      banking.banker = gameState.dealerPlayerIndex;
    }

    // 获取报主玩家索引（第一个亮主的玩家）
    if (gameState.trumpCalledPlayerIndex !== undefined && gameState.trumpCalledPlayerIndex !== null) {
      banking.called = gameState.trumpCalledPlayerIndex;
    }

    // 获取反主玩家索引（最后一个反主的玩家）
    if (gameState.trumpSnatchedPlayerIndex !== undefined && gameState.trumpSnatchedPlayerIndex !== null) {
      banking.snatched = gameState.trumpSnatchedPlayerIndex;
    }

    return banking;
  }

  /**
   * 构建history数组（play阶段）
   * history格式: [最近一轮的出牌, 当前轮的出牌, 最近一轮的首家id, 当前轮的首家id]
   * 
   * 重要: 每个轮次的出牌必须按照从首家开始的顺序排列
   * 例如，如果首家是玩家2，则顺序应为: [玩家2的牌, 玩家3的牌, 玩家0的牌, 玩家1的牌]
   */
  _buildHistory(gameState, room) {
    // 当前回合首家索引
    const currentRoundLeader = gameState.roundStartPlayerIndex !== undefined
      ? gameState.roundStartPlayerIndex
      : (gameState.currentPlayerIndex || 0);

    // 当前回合的出牌记录（按照从首家开始的顺序）
    const currentRoundPlays = gameState.currentRoundPlays || [];
    const currentRoundCards = [];

    // currentRoundPlays已经是按出牌顺序排列的，直接转换
    for (const play of currentRoundPlays) {
      currentRoundCards.push(CardNumberingSystem.cardsToNumbers(play.cards));
    }

    // 获取上一回合的数据
    const { previousRoundCards, previousRoundLeader } = this._getPreviousRoundData(gameState, room, 4);

    const history = [
      previousRoundCards, // 上一回合的出牌（按首家顺序排列）
      currentRoundCards,  // 当前回合的出牌
      previousRoundLeader, // 上一回合的首家
      currentRoundLeader   // 当前回合的首家
    ];

    logger.info(`构建history: previousRoundCards长度=${previousRoundCards.length}, currentRoundCards长度=${currentRoundCards.length}, previousLeader=${previousRoundLeader}, currentLeader=${currentRoundLeader}`);

    return history;
  }

  /**
   * 获取上一回合的出牌记录和首家
   * @param {Object} gameState - 游戏状态
   * @param {Object} room - 房间对象
   * @param {number} playersPerRound - 每轮玩家数（通常为4）
   * @returns {Object} { previousRoundCards: Array, previousRoundLeader: number }
   */
  _getPreviousRoundData(gameState, room, playersPerRound = 4) {
    const defaultResult = { previousRoundCards: [], previousRoundLeader: 0 };

    // 如果没有历史记录，返回默认值
    if (!gameState.playHistory || gameState.playHistory.length === 0) {
      return defaultResult;
    }

    const playHistory = gameState.playHistory;
    const currentRoundPlaysCount = (gameState.currentRoundPlays || []).length;

    // playHistory包含所有已完成轮次的出牌 + 当前轮次的出牌(如果在当前轮次内)
    // 注意: 当一轮结束后，currentRoundPlays会被清空，但playHistory保留所有记录
    // 所以上一轮的出牌在 playHistory 中的位置是:
    // - 如果当前轮没有人出牌(currentRoundPlaysCount = 0)，上一轮是最后4条记录
    // - 如果当前轮有人出牌，需要跳过当前轮的记录

    // 计算上一轮的结束位置（在playHistory中的索引）
    const previousRoundEndIndex = playHistory.length - currentRoundPlaysCount;
    const previousRoundStartIndex = previousRoundEndIndex - playersPerRound;

    // 如果没有完整的上一轮，返回默认值
    if (previousRoundStartIndex < 0 || previousRoundEndIndex <= 0) {
      return defaultResult;
    }

    // 提取上一轮的出牌记录
    const previousRoundPlays = playHistory.slice(previousRoundStartIndex, previousRoundEndIndex);

    if (previousRoundPlays.length !== playersPerRound) {
      // 上一轮不完整，可能是第一轮
      return defaultResult;
    }

    // 获取上一轮的首家
    const previousRoundLeader = previousRoundPlays[0].playerIndex;

    // 转换为bot需要的格式（按从首家开始的顺序排列）
    const previousRoundCards = previousRoundPlays.map(play => 
      CardNumberingSystem.cardsToNumbers(play.cards)
    );

    return { previousRoundCards, previousRoundLeader };
  }

  /**
   * 计算闲家已获得的分数
   */
  _calculateIdlerScore(gameState, room) {
    // gameState.attackerScore 直接存储了闲家的总分
    // collectedPointCards 是闲家收集的分数牌数组（不是按玩家索引的）
    if (typeof gameState.attackerScore === 'number') {
      return gameState.attackerScore;
    }

    // 如果没有 attackerScore，尝试从 collectedPointCards 计算
    if (!gameState.collectedPointCards || !Array.isArray(gameState.collectedPointCards)) {
      return 0;
    }

    let totalScore = 0;
    for (const card of gameState.collectedPointCards) {
      totalScore += this._getCardPoints(card);
    }

    return totalScore;
  }

  /**
   * 判断玩家是否在庄家队伍
   * 拖拉机是0和2一队，1和3一队
   */
  _isPlayerInDealerTeam(playerIndex, dealerIndex) {
    if (dealerIndex === undefined || dealerIndex === null) {
      return false;
    }
    // 同队的条件：playerIndex % 2 === dealerIndex % 2
    return playerIndex % 2 === dealerIndex % 2;
  }

  /**
   * 获取卡牌分数
   */
  _getCardPoints(card) {
    if (!card || !card.rank) {
      return 0;
    }

    // 5分牌
    if (card.rank === '5') return 5;
    // 10分牌
    if (card.rank === '10' || card.rank === 'K') return 10;

    return 0;
  }

  /**
   * 获取bot的历史记录
   */
  _getBotHistory(playerId) {
    if (!this.botHistory.has(playerId)) {
      this.botHistory.set(playerId, {
        requests: [],
        responses: []
      });
    }
    return this.botHistory.get(playerId);
  }

  /**
   * 清空指定玩家的bot历史
   */
  clearBotHistory(playerId) {
    this.botHistory.delete(playerId);
  }

  /**
   * 清空所有bot历史
   */
  clearAllBotHistory() {
    this.botHistory.clear();
  }

  /**
   * 更新最后一次响应的卡牌（用于fallback后修正历史）
   * @param {string} playerId - 玩家ID
   * @param {Array} cards - 实际出的卡牌数组
   */
  updateLastResponse(playerId, cards) {
    const history = this.botHistory.get(playerId);
    if (!history || history.responses.length === 0) {
      logger.warn(`无法更新玩家 ${playerId} 的响应历史：历史不存在或为空`);
      return;
    }

    // 将卡牌转换为bot编号格式
    const cardNumbers = CardNumberingSystem.cardsToNumbers(cards);

    // 替换最后一个响应
    history.responses[history.responses.length - 1] = cardNumbers;
    logger.info(`已更新玩家 ${playerId} 的最后响应为: ${JSON.stringify(cardNumbers)}`);
  }

  /**
   * 调用Python bot脚本
   */
  async _callPythonBot(input) {
    return new Promise((resolve, reject) => {
      logger.info(`调用Bot脚本: ${this.botScriptPath}`);

      // 设置环境变量，让bot知道是在线模式
      const env = { ...process.env, USER: 'root' };

      const pythonProcess = spawn('python3', [this.botScriptPath], { env });

      let output = '';
      let errorOutput = '';

      // 发送输入数据
      pythonProcess.stdin.write(JSON.stringify(input));
      pythonProcess.stdin.end();

      // 收集输出
      pythonProcess.stdout.on('data', (data) => {
        const dataStr = data.toString();
        output += dataStr;
      });

      pythonProcess.stderr.on('data', (data) => {
        const dataStr = data.toString();
        logger.warn(`Bot stderr: ${dataStr}`);
        errorOutput += dataStr;
      });

      // 处理完成
      pythonProcess.on('close', (code) => {
        logger.info(`Bot进程退出，代码: ${code}`);

        if (code !== 0) {
          const errorMsg = `Bot进程退出，代码: ${code}, 错误: ${errorOutput}`;
          logger.error(errorMsg);
          reject(new Error(errorMsg));
          return;
        }

        try {
          logger.info(`Bot原始输出: ${output}`);
          const result = JSON.parse(output);
          logger.info(`Bot解析后结果: ${JSON.stringify(result)}`);
          resolve(result);
        } catch (error) {
          const errorMsg = `解析bot输出失败: ${error.message}, 输出: ${output}`;
          logger.error(errorMsg);
          reject(new Error(errorMsg));
        }
      });

      // 超时处理
      setTimeout(() => {
        logger.error('Bot响应超时，强制结束进程');
        pythonProcess.kill();
        reject(new Error('Bot响应超时'));
      }, 30000); // 30秒超时
    });
  }

  /**
   * 解析bot响应，转换为项目卡牌ID数组
   * bot返回格式: {response: [number, number, ...]}
   * 返回: [cardId, cardId, ...]
   */
  _parseBotResponse(response, playerCards) {
    if (!response || !response.response) {
      return [];
    }

    const cardNumbers = response.response;
    const cardIds = [];

    // 使用CardNumberingSystem查找对应的卡牌
    const cards = CardNumberingSystem.findCardsByNumbers(cardNumbers, playerCards);

    return cards.map(card => card.id);
  }
}

export default WhoDesignedBotService;
