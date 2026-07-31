import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';
import { BotTypes } from '../utils/constants.js';
import {
  getCardStrength,
  getEffectiveSuit,
  isTrumpCard,
  validateFollowingPlay,
  validateLeadingPlay
} from '../utils/cardPatternUtils.js';
import {
  isOneCountryTwoSystemsRule,
  isAfterglowRule,
  isRitesCollapseRule,
  isSingleStepDebugRule
} from '../rules/ruleRegistry.js';
import { getRulePlayableCards } from '../utils/cardCooldownUtils.js';
import { mapOneCountryCards } from '../utils/oneCountryTwoSystemsUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 卡牌格式转换工具
 */
class CardConverter {
  static supportedRanks = new Set([
    '2', '3', '4', '5', '6', '7', '8', '9', '10',
    'J', 'Q', 'K', 'A', 'small_joker', 'big_joker'
  ]);

  static isSupportedCard(card) {
    return Boolean(card && this.supportedRanks.has(card.rank));
  }

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

    if (selectedBotType === BotTypes.SIMPLE) {
      // 使用简化版bot（不依赖torch）
      this.botScriptPath = path.resolve(__dirname, '../../../../simple-bot/simple_bot.py');
      logger.info('使用简化版Bot（不依赖任何Python包）');
    } else if (selectedBotType === BotTypes.WHO_DESIGNED) {
      // 使用WhoDesigned bot
      this.botScriptPath = path.resolve(__dirname, '../../../../simple-bot/who_designed_adapter.py');
      logger.info('使用WhoDesigned Bot');
    } else {
      // 默认使用简化版bot
      this.botScriptPath = path.resolve(__dirname, '../../../../simple-bot/simple_bot.py');
      logger.warn(`未知的bot类型: ${selectedBotType}，使用简化版Bot`);
    }

    this.converter = CardConverter;
  }

  /**
   * 调用bot获取决策
   * @param {Object} gameState - 游戏状态
   * @param {Array} playerCards - 玩家手牌
   * @param {Number} playerIndex - 玩家索引 (0-3)
   * @param {Object} room - 房间对象（用于获取所有玩家信息）
   * @returns {Promise<Array>} - bot返回的卡牌ID数组
   */
  async getBotAction(gameState, playerCards, playerIndex, room, externalPlayableCards = []) {
    try {
      const physicalDecisionCards = getRulePlayableCards({
        gameState,
        playerId: room?.players?.[playerIndex]?.id,
        playerCards,
        requiredCount: gameState.leadingPattern?.length || 1,
        isLeading: !gameState.leadingPattern
      });
      const decisionCards = [...physicalDecisionCards, ...externalPlayableCards];
      const visibleCards = [
        ...decisionCards,
        ...(gameState.currentRoundPlays || []).flatMap(play => play.cards || []),
        ...(gameState.playHistory || []).flatMap(play => play.cards || [])
      ];
      if (visibleCards.some(card => !this.converter.isSupportedCard(card))) {
        logger.info('当前牌局含外部 Bot 不认识的扩展牌面，改用内置合法出牌策略');
        return this.getFallbackAction(
          gameState,
          playerCards,
          room?.players?.[playerIndex]?.id,
          playerIndex,
          externalPlayableCards
        );
      }
      // 构建bot需要的输入格式
      const botInput = this._buildBotInput(gameState, decisionCards, playerIndex, room);

      logger.info(`Bot输入数据: ${JSON.stringify(botInput)}`);

      // 调用Python bot
      const botResponse = await this._callPythonBot(botInput);

      logger.info(`Bot响应数据: ${JSON.stringify(botResponse)}`);

      // 解析bot返回的卡牌，转换为项目格式的卡牌ID
      const action = this._parseBotResponse(botResponse, decisionCards);
      if (isRitesCollapseRule(gameState.selectedRule) && !gameState.leadingPattern) {
        const actionIds = new Set(action);
        const selectedCards = decisionCards.filter(card => actionIds.has(card.id));
        if (
          selectedCards.some(card => card.rank === 'A')
          && decisionCards.some(card => card.rank !== 'A')
        ) {
          logger.info('礼崩乐坏规则中 Bot 尝试首发A，改为合法的非A单张首发');
          return this.getFallbackAction(
            gameState,
            playerCards,
            room?.players?.[playerIndex]?.id,
            playerIndex,
            externalPlayableCards
          );
        }
      }
      if (isSingleStepDebugRule(gameState.selectedRule) && !gameState.leadingPattern) {
        const actionIds = new Set(action);
        const selectedCards = playerCards.filter(card => actionIds.has(card.id));
        const validation = validateLeadingPlay(
          selectedCards,
          gameState.trumpSuit,
          gameState.trumpRank,
          { ...gameState.selectedRule, currentRound: gameState.currentRound }
        );
        if (!validation.valid) {
          logger.info('单步调试规则下 Bot 尝试甩牌，改为合法的单张首发');
          return this.getFallbackAction(
            gameState,
            playerCards,
            room?.players?.[playerIndex]?.id,
            playerIndex,
            externalPlayableCards
          );
        }
      }
      return action;

    } catch (error) {
      logger.error('Bot决策失败:', error);
      // 如果bot失败，返回空数组（跳过）
      return [];
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
    const emptySuits = this._buildEmptySuits(gameState, room);

    return {
      id: playerIndex,
      deck,
      history,
      major,
      played,
      emptySuits,
      level: gameState.trumpRank,
      trumpSuit: this._toBotSuit(gameState.trumpSuit)
    };
  }

  _toBotSuit(suit) {
    const suitMap = {
      hearts: 'h',
      diamonds: 'd',
      clubs: 'c',
      spades: 's',
      no_trump: 'n'
    };
    return suitMap[suit] || 'n';
  }

  /**
   * 构建历史出牌记录（当前回合）
   */
  _buildHistory(gameState, room) {
    // 对于自由出牌模式，返回最近的几次出牌记录
    if (!gameState.currentRoundPlays || gameState.currentRoundPlays.length === 0) {
      return [];
    }

    // 获取最近的出牌记录（最多10条）
    const plays = gameState.currentRoundPlays.map(play => ({
      playerIndex: play.playerIndex,
      cards: this.converter.cardsArrayToBotFormat(play.cards)
    }));
    return this.botType === BotTypes.SIMPLE ? plays.map(play => play.cards) : plays;
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
   * 复原 WhoDesigned 构造器原本会从完整墩历史推断的“缺门”信息。
   * playHistory 按实际出牌顺序写入；普通四人牌局中每四条是一整墩。
   */
  _buildEmptySuits(gameState, room) {
    const emptySuits = [[], [], [], []];
    const records = gameState.playHistory || [];
    const playerCount = room?.players?.length || 4;
    if (playerCount !== 4) return emptySuits;

    for (let offset = 0; offset + playerCount <= records.length; offset += playerCount) {
      const trick = records.slice(offset, offset + playerCount);
      const leadCard = trick[0]?.cards?.[0];
      if (!leadCard) continue;

      const leadingSuit = getEffectiveSuit(
        leadCard,
        gameState.trumpSuit,
        gameState.trumpRank
      );
      const botSuit = leadingSuit === 'trump'
        ? this._toBotSuit(gameState.trumpSuit)
        : this._toBotSuit(leadingSuit);

      trick.slice(1).forEach(record => {
        const playerIndex = Number.isInteger(record.playerIndex)
          ? record.playerIndex
          : room.getPlayerIndex(record.playerId);
        if (playerIndex < 0 || playerIndex >= 4 || !Array.isArray(record.cards)) return;

        const exhaustedLedSuit = record.cards.some(card => (
          getEffectiveSuit(card, gameState.trumpSuit, gameState.trumpRank) !== leadingSuit
        ));
        if (exhaustedLedSuit && !emptySuits[playerIndex].includes(botSuit)) {
          emptySuits[playerIndex].push(botSuit);
        }
      });
    }

    return emptySuits;
  }

  /**
   * 调用Python bot脚本
   */
  async _callPythonBot(input) {
    return new Promise((resolve, reject) => {
      logger.info(`调用Bot脚本: ${this.botScriptPath}`);
      logger.info(`Bot输入: ${JSON.stringify(input)}`);

      const pythonCommand = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
      const pythonProcess = spawn(pythonCommand, [this.botScriptPath], {
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });

      let output = '';
      let errorOutput = '';
      let settled = false;
      let timeout;

      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        if (timeout) clearTimeout(timeout);
        callback(value);
      };

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
          finish(reject, new Error(errorMsg));
          return;
        }

        try {
          logger.info(`Bot原始输出: ${output}`);
          const result = JSON.parse(output);
          logger.info(`Bot解析后结果: ${JSON.stringify(result)}`);
          finish(resolve, result);
        } catch (error) {
          const errorMsg = `解析bot输出失败: ${error.message}, 输出: ${output}`;
          logger.error(errorMsg);
          finish(reject, new Error(errorMsg));
        }
      });

      pythonProcess.on('error', (error) => {
        finish(reject, new Error(`无法启动 ${pythonCommand}: ${error.message}`));
      });

      // 超时处理
      timeout = setTimeout(() => {
        logger.error('Bot响应超时，强制结束进程');
        pythonProcess.kill();
        finish(reject, new Error('Bot响应超时'));
      }, 30000); // 30秒超时
    });
  }

  /** Generate a deterministic legal play when an external bot fails. */
  getFallbackAction(
    gameState,
    playerCards,
    playerId = null,
    playerIndex = null,
    externalPlayableCards = []
  ) {
    const leadingPattern = gameState.leadingPattern;
    const trumpSuit = gameState.trumpSuit;
    const trumpRank = gameState.trumpRank;
    const activeRule = gameState.selectedRule
      ? {
          ...gameState.selectedRule,
          currentRound: gameState.currentRound,
          antinomySplitFaceKeys: Array.from(
            gameState.antinomyDeclarationsByPlayerId?.values?.() || []
          )
            .filter(declaration => declaration?.effective)
            .map(declaration => declaration.faceKey)
        }
      : null;
    const playableCards = getRulePlayableCards({
      gameState,
      playerId,
      playerCards,
      requiredCount: leadingPattern?.length || 1,
      isLeading: !leadingPattern
    });
    const effectivePlayableCards = isOneCountryTwoSystemsRule(gameState.selectedRule)
      ? mapOneCountryCards(playableCards, playerIndex, gameState.oneCountryResolved)
      : playableCards;
    const effectiveExternalCards = isOneCountryTwoSystemsRule(gameState.selectedRule)
      ? mapOneCountryCards(externalPlayableCards, playerIndex, gameState.oneCountryResolved)
      : externalPlayableCards;
    const sorted = [...effectivePlayableCards, ...effectiveExternalCards].sort((a, b) =>
      getCardStrength(a, trumpSuit, trumpRank, activeRule) -
        getCardStrength(b, trumpSuit, trumpRank, activeRule)
    );
    const afterglowActive = Boolean(
      isAfterglowRule(gameState.selectedRule)
      && gameState.afterglowActivePlayerIds?.has(playerId)
    );
    const afterglowTrumps = afterglowActive
      ? sorted.filter(card => isTrumpCard(card, trumpSuit, trumpRank))
      : [];

    if (afterglowTrumps.length > 0) {
      if (!leadingPattern) return [afterglowTrumps[0].id];
      const required = leadingPattern.length;
      return afterglowTrumps.slice(0, required).map(card => card.id);
    }

    if (!leadingPattern) {
      const legalLeadingCards = isRitesCollapseRule(gameState.selectedRule)
        ? sorted.filter(card => card.rank !== 'A')
        : sorted;
      const fallbackCards = legalLeadingCards.length > 0 ? legalLeadingCards : sorted;
      return fallbackCards.length > 0 ? [fallbackCards[0].id] : [];
    }

    const required = leadingPattern.length;

    // 木牛流马中的牌可选，但不能被当成实体手牌来推导跟牌义务。
    if (effectiveExternalCards.length > 0) {
      let checked = 0;
      const limit = 50000;
      const chosen = [];
      const search = start => {
        if (checked >= limit) return null;
        if (chosen.length === required) {
          checked += 1;
          const candidate = chosen.map(index => sorted[index]);
          return validateFollowingPlay(
            candidate,
            effectivePlayableCards,
            leadingPattern,
            trumpSuit,
            trumpRank,
            activeRule
          ).valid ? candidate : null;
        }
        for (let index = start; index <= sorted.length - (required - chosen.length); index += 1) {
          chosen.push(index);
          const result = search(index + 1);
          chosen.pop();
          if (result) return result;
        }
        return null;
      };
      return (search(0) || sorted.slice(0, required)).map(card => card.id);
    }

    if (leadingPattern.type === 'tai_chi_four_symbols') {
      let checked = 0;
      const limit = 50000;
      const chosen = [];
      const searchAllCards = (start) => {
        if (checked >= limit) return null;
        if (chosen.length === required) {
          checked++;
          const candidate = chosen.map(index => sorted[index]);
          return validateFollowingPlay(
            candidate,
            effectivePlayableCards,
            leadingPattern,
            trumpSuit,
            trumpRank,
            activeRule
          ).valid ? candidate : null;
        }

        for (let index = start; index <= sorted.length - (required - chosen.length); index++) {
          chosen.push(index);
          const result = searchAllCards(index + 1);
          chosen.pop();
          if (result) return result;
        }
        return null;
      };

      return (searchAllCards(0) || sorted.slice(0, required)).map(card => card.id);
    }

    const sameSuit = sorted.filter(card =>
      getEffectiveSuit(card, trumpSuit, trumpRank) === leadingPattern.suit
    );
    const otherSuit = sorted.filter(card =>
      getEffectiveSuit(card, trumpSuit, trumpRank) !== leadingPattern.suit
    );

    if (sameSuit.length <= required) {
      return [...sameSuit, ...otherSuit.slice(0, required - sameSuit.length)].map(card => card.id);
    }

    const direct = sameSuit.slice(0, required);
    if (validateFollowingPlay(
      direct,
      effectivePlayableCards,
      leadingPattern,
      trumpSuit,
      trumpRank,
      activeRule
    ).valid) {
      return direct.map(card => card.id);
    }

    let checked = 0;
    const limit = 50000;
    const chosen = [];
    const search = (start) => {
      if (checked >= limit) return null;
      if (chosen.length === required) {
        checked++;
        const candidate = chosen.map(index => sameSuit[index]);
        return validateFollowingPlay(
          candidate,
          effectivePlayableCards,
          leadingPattern,
          trumpSuit,
          trumpRank,
          activeRule
        ).valid ? candidate : null;
      }

      for (let index = start; index <= sameSuit.length - (required - chosen.length); index++) {
        chosen.push(index);
        const result = search(index + 1);
        chosen.pop();
        if (result) return result;
      }
      return null;
    };

    return (search(0) || direct).map(card => card.id);
  }

  /** “梦中杀人”按首家张数盲抽手牌，不检查花色、牌型或跟牌义务。 */
  getRandomAction(gameState, playerCards, random = Math.random) {
    if (playerCards.length === 0) return [];
    const required = Math.min(
      gameState.leadingPattern?.length || 1,
      playerCards.length
    );
    const shuffled = [...playerCards];
    const randomIndex = upperBound => {
      const sample = Number(random());
      const bounded = Number.isFinite(sample)
        ? Math.min(0.999999999, Math.max(0, sample))
        : 0;
      return Math.floor(bounded * upperBound);
    };

    for (let index = 0; index < required; index += 1) {
      const swapIndex = index + randomIndex(shuffled.length - index);
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled.slice(0, required).map(card => card.id);
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
      return fs.existsSync(this.botScriptPath) &&
        (this.botType !== BotTypes.WHO_DESIGNED ||
          fs.existsSync(path.resolve(__dirname, '../../../../WhoDesigned/mvGen.py')));
    } catch (error) {
      logger.error('Bot不可用:', error);
      return false;
    }
  }
}

export default BotService;
