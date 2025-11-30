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
    this.botScriptPath = path.resolve(__dirname, '../../../../WhoDesigned/__main__.py');
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

    try {
      // 检查是否只在ORDERED模式下使用bot
      if (gameState.playMode !== PlayModes.ORDERED) {
        logger.warn('WhoDesigned bot只能在基础模式(ORDERED)下使用，当前模式为：' + gameState.playMode);
        throw new Error('WhoDesigned bot只能在基础模式下使用');
      }

      // 构建bot需要的request
      const request = this._buildRequest(stage, gameState, room, playerIndex, deliverCards);

      // 获取历史记录
      const history = this._getBotHistory(playerId);

      // 添加当前request到历史
      history.requests.push(request);

      // 构建bot输入
      const botInput = {
        requests: history.requests,
        responses: history.responses
      };

      logger.info(`Bot输入数据 (player ${playerIndex}): ${JSON.stringify(botInput)}`);

      // 调用Python bot
      const botResponse = await this._callPythonBot(botInput);

      logger.info(`Bot响应数据 (player ${playerIndex}): ${JSON.stringify(botResponse)}`);

      // 解析bot返回的卡牌编号，转换为项目格式的卡牌ID数组
      const cardIds = this._parseBotResponse(botResponse, playerCards);

      // 将响应添加到历史
      history.responses.push(botResponse.response || []);

      return cardIds;

    } catch (error) {
      logger.error('Bot决策失败:', error);
      // 如果bot失败，根据阶段返回合适的默认值
      if (stage === 'deal') {
        return []; // 不报主
      } else if (stage === 'cover') {
        // 返回前8张牌作为底牌
        return playerCards.slice(0, 8).map(c => c.id);
      } else {
        return []; // 跳过
      }
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
    // 从房间中获取庄家等级
    // 假设team1是庄家队，返回他们的等级
    // 这里需要根据实际的game state来获取
    if (room.gameState && room.gameState.team1Level) {
      return String(room.gameState.team1Level);
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

    // TODO: 需要添加called和snatched的逻辑
    // 这需要在游戏状态中跟踪谁报主和谁反主

    return banking;
  }

  /**
   * 构建history数组（play阶段）
   * history格式: [最近一轮的出牌, 当前轮的出牌, 最近一轮的首家id, 当前轮的首家id]
   */
  _buildHistory(gameState, room) {
    const history = [[], [], null, null];

    if (!gameState.currentRoundPlays) {
      return [[], [], 0, 0]; // 如果没有当前回合数据，返回默认值
    }

    // 当前回合的出牌记录
    const currentRoundPlays = gameState.currentRoundPlays || [];
    const currentRoundCards = [];

    for (const play of currentRoundPlays) {
      currentRoundCards.push(CardNumberingSystem.cardsToNumbers(play.cards));
    }

    // 上一回合的出牌记录
    // 需要从playHistory中获取
    const previousRoundCards = this._getPreviousRoundCards(gameState, room);

    history[0] = previousRoundCards; // 上一回合的出牌
    history[1] = currentRoundCards;  // 当前回合的出牌

    // 获取首家id
    const previousRoundLeader = this._getPreviousRoundLeader(gameState);
    const currentRoundLeader = gameState.roundStartPlayerIndex !== undefined
      ? gameState.roundStartPlayerIndex
      : (gameState.currentPlayerIndex || 0);

    history[2] = previousRoundLeader; // 上一回合的首家
    history[3] = currentRoundLeader;  // 当前回合的首家

    return history;
  }

  /**
   * 获取上一回合的出牌记录
   */
  _getPreviousRoundCards(gameState, room) {
    // 如果当前是第一个回合，返回空数组
    if (!gameState.playHistory || gameState.playHistory.length === 0) {
      return [];
    }

    // 一个回合有4次出牌
    // 找到倒数第5到倒数第8个记录（如果存在）
    const history = gameState.playHistory;
    const result = [];

    // 计算上一回合的起始位置
    // 假设currentRoundPlays.length是当前回合已经出的牌数
    const currentRoundSize = (gameState.currentRoundPlays || []).length;
    const previousRoundEnd = history.length;
    const previousRoundStart = Math.max(0, previousRoundEnd - 4);

    if (previousRoundStart < previousRoundEnd) {
      for (let i = previousRoundStart; i < previousRoundEnd; i++) {
        const play = history[i];
        result.push(CardNumberingSystem.cardsToNumbers(play.cards));
      }
    }

    return result;
  }

  /**
   * 获取上一回合的首家玩家索引
   */
  _getPreviousRoundLeader(gameState) {
    if (!gameState.playHistory || gameState.playHistory.length < 4) {
      return 0;
    }

    // 上一回合的第一个出牌者
    const previousRoundStart = Math.max(0, gameState.playHistory.length - 4);
    if (previousRoundStart < gameState.playHistory.length) {
      const firstPlay = gameState.playHistory[previousRoundStart];
      // 需要从playerId转换为playerIndex
      // 这里假设playHistory中有playerIndex信息
      return firstPlay.playerIndex || 0;
    }

    return 0;
  }

  /**
   * 计算闲家已获得的分数
   */
  _calculateIdlerScore(gameState, room) {
    // 从gameState中获取闲家的分数
    // 闲家是非庄家队伍
    // 假设collectedPointCards存储了已收集的分牌

    if (!gameState.collectedPointCards) {
      return 0;
    }

    let totalScore = 0;

    // 遍历所有玩家的收集牌
    for (let playerIndex = 0; playerIndex < 4; playerIndex++) {
      // 判断该玩家是否是闲家
      // 庄家索引是dealerPlayerIndex
      const isDealerTeam = this._isPlayerInDealerTeam(playerIndex, gameState.dealerPlayerIndex);

      if (!isDealerTeam && gameState.collectedPointCards[playerIndex]) {
        // 计算这个玩家的分数
        for (const card of gameState.collectedPointCards[playerIndex]) {
          totalScore += this._getCardPoints(card);
        }
      }
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
