import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';
import { BotTypes } from '../utils/constants.js';
import { WhoDesignedBotService } from './WhoDesignedBotService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 卡牌格式转换工具
 */
class CardConverter {
  /**
   * 将项目卡牌格式转换为bot需要的格式
   * 项目格式: {suit: 'hearts', rank: 'A', id: 'hearts-A-0'}
   * Bot格式: 'hA' (花色首字母 + 点数)
   */
  static toBotFormat(card) {
    // 花色映射
    const suitMap = {
      'hearts': 'h',
      'diamonds': 'd',
      'clubs': 'c',
      'spades': 's',
      'joker': ''
    };

    // 点数映射
    const rankMap = {
      '2': '2', '3': '3', '4': '4', '5': '5',
      '6': '6', '7': '7', '8': '8', '9': '9',
      '10': '0',
      'J': 'J', 'Q': 'Q', 'K': 'K', 'A': 'A',
      'small_joker': 'jo',
      'big_joker': 'Jo'
    };

    // 大小王特殊处理
    if (card.rank === 'small_joker') return 'jo';
    if (card.rank === 'big_joker') return 'Jo';

    const suit = suitMap[card.suit] || '';
    const rank = rankMap[card.rank] || '';

    return suit + rank;
  }

  /**
   * 将bot格式转换回项目格式（仅卡牌名称，不含完整card对象）
   * Bot格式: 'hA'
   * 返回: {suit: 'hearts', rank: 'A'}
   */
  static fromBotFormat(botCard) {
    // 花色映射（反向）
    const suitMap = {
      'h': 'hearts',
      'd': 'diamonds',
      'c': 'clubs',
      's': 'spades'
    };

    // 大小王特殊处理
    if (botCard === 'jo') return { suit: 'joker', rank: 'small_joker' };
    if (botCard === 'Jo') return { suit: 'joker', rank: 'big_joker' };

    // 解析花色和点数
    const suitChar = botCard[0];
    const rankStr = botCard.slice(1);

    const suit = suitMap[suitChar] || 'hearts';

    // 点数映射（反向）
    const rankMap = {
      '2': '2', '3': '3', '4': '4', '5': '5',
      '6': '6', '7': '7', '8': '8', '9': '9',
      '0': '10',
      'J': 'J', 'Q': 'Q', 'K': 'K', 'A': 'A'
    };

    const rank = rankMap[rankStr] || rankStr;

    return { suit, rank };
  }

  /**
   * 批量转换为bot格式
   */
  static cardsArrayToBotFormat(cards) {
    return cards.map(card => this.toBotFormat(card));
  }
}

/**
 * Bot服务 - 管理和调用Python bot
 */
export class BotService {
  constructor(botType = null) {
    // 优先使用传入的 botType 参数，其次检查环境变量
    let selectedBotType = botType;

    if (!selectedBotType) {
      const useSimpleBot = process.env.USE_SIMPLE_BOT === 'true' || process.env.USE_SIMPLE_BOT === '1';
      selectedBotType = useSimpleBot ? BotTypes.SIMPLE : BotTypes.WHO_DESIGNED;
    }

    this.botType = selectedBotType;

    // 如果是WhoDesigned bot，使用专门的服务
    if (selectedBotType === BotTypes.WHO_DESIGNED) {
      this.whoDesignedService = new WhoDesignedBotService();
      logger.info('使用WhoDesigned Bot（专用服务）');
    } else if (selectedBotType === BotTypes.SIMPLE) {
      // 使用简化版bot（不依赖torch）
      this.botScriptPath = path.resolve(__dirname, '../../../../simple-bot/simple_bot.py');
      logger.info('使用简化版Bot（不依赖任何Python包）');
    } else {
      // 默认使用简化版bot
      this.botScriptPath = path.resolve(__dirname, '../../../../simple-bot/simple_bot.py');
      logger.warn(`未知的bot类型: ${selectedBotType}，使用简化版Bot`);
    }

    this.converter = CardConverter;
  }

  /**
   * 调用bot获取决策（play阶段）
   * @param {Object} gameState - 游戏状态
   * @param {Array} playerCards - 玩家手牌
   * @param {Number} playerIndex - 玩家索引 (0-3)
   * @param {Object} room - 房间对象（用于获取所有玩家信息）
   * @returns {Promise<Array>} - bot返回的卡牌ID数组
   */
  async getBotAction(gameState, playerCards, playerIndex, room) {
    // 如果是WhoDesigned bot，使用专门的服务
    if (this.botType === BotTypes.WHO_DESIGNED && this.whoDesignedService) {
      const player = room.players[playerIndex];
      return await this.whoDesignedService.getBotAction({
        stage: 'play',
        gameState,
        room,
        playerId: player.id,
        playerIndex,
        playerCards,
        deliverCards: null
      });
    }

    // Simple bot的原有逻辑
    try {
      // 构建bot需要的输入格式
      const botInput = this._buildBotInput(gameState, playerCards, playerIndex, room);

      logger.info(`Bot输入数据: ${JSON.stringify(botInput)}`);

      // 调用Python bot
      const botResponse = await this._callPythonBot(botInput);

      logger.info(`Bot响应数据: ${JSON.stringify(botResponse)}`);

      // 解析bot返回的卡牌，转换为项目格式的卡牌ID
      return this._parseBotResponse(botResponse, playerCards);

    } catch (error) {
      logger.error('Bot决策失败:', error);
      // 如果bot失败，返回空数组（跳过）
      return [];
    }
  }

  /**
   * 调用bot获取deal阶段决策（报主/反主）
   * @param {Object} gameState - 游戏状态
   * @param {Object} card - 新发的牌
   * @param {Array} playerCards - 玩家手牌
   * @param {Number} playerIndex - 玩家索引 (0-3)
   * @param {Object} room - 房间对象
   * @returns {Promise<Array>} - bot返回的卡牌ID数组（用于报主/反主），空数组表示不报主
   */
  async getBotDealAction(gameState, card, playerCards, playerIndex, room) {
    // 只有WhoDesigned bot支持deal阶段
    if (this.botType === BotTypes.WHO_DESIGNED && this.whoDesignedService) {
      const player = room.players[playerIndex];
      return await this.whoDesignedService.getBotAction({
        stage: 'deal',
        gameState,
        room,
        playerId: player.id,
        playerIndex,
        playerCards,
        deliverCards: [card]
      });
    }

    // Simple bot不支持报主，返回空数组
    return [];
  }

  /**
   * 调用bot获取cover阶段决策（盖底牌）
   * @param {Object} gameState - 游戏状态
   * @param {Array} bottomCards - 底牌
   * @param {Array} playerCards - 玩家手牌（包含底牌）
   * @param {Number} playerIndex - 玩家索引 (0-3)
   * @param {Object} room - 房间对象
   * @returns {Promise<Array>} - bot返回的卡牌ID数组（要盖的底牌）
   */
  async getBotCoverAction(gameState, bottomCards, playerCards, playerIndex, room) {
    // 只有WhoDesigned bot支持cover阶段
    if (this.botType === BotTypes.WHO_DESIGNED && this.whoDesignedService) {
      const player = room.players[playerIndex];
      return await this.whoDesignedService.getBotAction({
        stage: 'cover',
        gameState,
        room,
        playerId: player.id,
        playerIndex,
        playerCards,
        deliverCards: bottomCards
      });
    }

    // Simple bot使用简单策略：盖掉非分牌
    const nonPointCards = playerCards.filter(card => {
      const rank = card.rank;
      return rank !== '5' && rank !== '10' && rank !== 'K';
    });

    // 如果非分牌足够，盖掉最小的
    if (nonPointCards.length >= bottomCards.length) {
      return nonPointCards.slice(0, bottomCards.length).map(c => c.id);
    }

    // 否则盖掉最小的牌
    return playerCards.slice(0, bottomCards.length).map(c => c.id);
  }

  /**
   * 清空bot历史（用于新游戏开始）
   */
  clearHistory() {
    if (this.whoDesignedService) {
      this.whoDesignedService.clearAllBotHistory();
    }
  }

  /**
   * 构建bot需要的输入数据
   */
  _buildBotInput(gameState, playerCards, playerIndex, room) {
    // 转换手牌为bot格式
    const deck = this.converter.cardsArrayToBotFormat(playerCards);

    // 转换历史出牌记录
    const history = this._buildHistory(gameState, room);

    // 构建主牌列表（major）
    const major = this._buildMajor(gameState);

    // 构建已出牌记录（played）
    const played = this._buildPlayed(gameState, room);

    return {
      id: playerIndex,
      deck,
      history,
      major,
      played
    };
  }

  /**
   * 构建历史出牌记录（当前回合）
   */
  _buildHistory(gameState, room) {
    // 对于自由出牌模式，返回最近的几次出牌记录
    if (!gameState.playHistory || gameState.playHistory.length === 0) {
      return [];
    }

    // 获取最近的出牌记录（最多10条）
    const recentHistory = [];
    const maxRecords = 10;
    const startIndex = Math.max(0, gameState.playHistory.length - maxRecords);

    for (let i = startIndex; i < gameState.playHistory.length; i++) {
      const record = gameState.playHistory[i];
      const cards = this.converter.cardsArrayToBotFormat(record.cards);
      recentHistory.push(cards);
    }

    return recentHistory;
  }

  /**
   * 构建主牌列表
   */
  _buildMajor(gameState) {
    const major = [];

    // 如果没有设置主牌，返回空数组
    if (!gameState.trumpSuit && !gameState.trumpRank) {
      return major;
    }

    // 构建主牌顺序（这是一个简化版本，实际可能需要更复杂的逻辑）
    // 主牌顺序通常是：主花色的牌 + 级牌 + 大小王

    // 这里暂时返回空数组，实际使用时可以根据游戏规则完善
    return major;
  }

  /**
   * 构建所有玩家的已出牌记录
   */
  _buildPlayed(gameState, room) {
    const played = [[], [], [], []]; // 4个玩家

    if (!gameState.playHistory || !room) {
      return played;
    }

    // 遍历所有历史记录，按玩家分组
    for (const record of gameState.playHistory) {
      // 通过playerId找到playerIndex
      const playerIndex = room.getPlayerIndex(record.playerId);
      if (playerIndex !== -1 && playerIndex < 4) {
        const cards = this.converter.cardsArrayToBotFormat(record.cards);
        played[playerIndex] = played[playerIndex].concat(cards);
      }
    }

    return played;
  }

  /**
   * 调用Python bot脚本
   */
  async _callPythonBot(input) {
    return new Promise((resolve, reject) => {
      logger.info(`调用Bot脚本: ${this.botScriptPath}`);
      logger.info(`Bot输入: ${JSON.stringify(input)}`);

      const pythonProcess = spawn('python3', [this.botScriptPath]);

      let output = '';
      let errorOutput = '';

      // 发送输入数据
      pythonProcess.stdin.write(JSON.stringify(input));
      pythonProcess.stdin.end();

      // 收集输出
      pythonProcess.stdout.on('data', (data) => {
        const dataStr = data.toString();
        logger.info(`Bot stdout: ${dataStr}`);
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
   * 解析bot响应，转换为项目卡牌ID
   */
  _parseBotResponse(response, playerCards) {
    // bot返回格式: {player: int, action: list[string]}
    // 例如: {player: 0, action: ['hA', 's2']}

    if (!response || !response.action) {
      return [];
    }

    const botCards = response.action;
    const cardIds = [];

    // 将bot返回的卡牌名称转换为项目中的卡牌ID
    for (const botCard of botCards) {
      const { suit, rank } = this.converter.fromBotFormat(botCard);

      // 在玩家手牌中查找匹配的卡牌
      const matchingCard = playerCards.find(card =>
        card.suit === suit && card.rank === rank && !cardIds.includes(card.id)
      );

      if (matchingCard) {
        cardIds.push(matchingCard.id);
      }
    }

    return cardIds;
  }

  /**
   * 检查bot是否可用
   */
  async checkBotAvailability() {
    try {
      const mainFilePath = path.join(this.botScriptPath, '__main__.py');
      // 可以在这里添加文件存在性检查
      return true;
    } catch (error) {
      logger.error('Bot不可用:', error);
      return false;
    }
  }
}

export default BotService;
