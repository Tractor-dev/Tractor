import { useState, useEffect, useRef, useMemo } from 'react';
import { Button, Space, Typography, Modal, Select, InputNumber, Input, message, Divider, Tag, Switch, Dropdown, Alert } from 'antd';
import { GlobalOutlined, EyeOutlined, SettingOutlined } from '@ant-design/icons';
import { useGameStore } from '../../store/gameStore';
import socketService from '../../services/socket';
import { SOCKET_EVENTS, GamePhases, PlayModes, BotTypes, Suits } from '../../utils/constants';
import { detectAvailableDeclarations } from '../../utils/trumpUtils';
import { validateLeadingPlay, validateFollowingPlay } from '../../utils/cardPatternUtils';
import { useI18n, LANGUAGE_NAMES, LANGUAGE_LIST } from '../../locales/index.jsx';
import Hand from './Hand';
import GameTable from './GameTable';
import RuleSelector from './RuleSelector';
import TrumpDeclaration from './TrumpDeclaration';
import './GameBoard.css';

const { Title, Text } = Typography;

export default function GameBoard() {
  const {
    currentRoom,
    currentPlayer,
    currentSpectator,
    isSpectator,
    setCurrentRoom,
    setCurrentSpectator,
    myCards,
    selectedCards,
    toggleCardSelection,
    clearSelection,
    setSelectedCards,
    setMyCards,
    addCard,
    removeCards,
    reorderCards,
    setTrumpInfo
  } = useGameStore();

  const { t, language, setLanguage, hideNotifications, setHideNotifications } = useI18n();
  const [messageApi, contextHolder] = message.useMessage();
  const [settingsModal, setSettingsModal] = useState(false); // 设置弹窗
  const [buryingPlayerModal, setBuryingPlayerModal] = useState(false);
  const [firstPlayerModal, setFirstPlayerModal] = useState(false);
  const [selectedBuryingPlayer, setSelectedBuryingPlayer] = useState(null);
  const [selectedFirstPlayer, setSelectedFirstPlayer] = useState(null);
  const [scoreAdjustModal, setScoreAdjustModal] = useState(false);
  const [levelAdjustModal, setLevelAdjustModal] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [adjustValue, setAdjustValue] = useState(0);
  const [viewBottomModal, setViewBottomModal] = useState(false);
  const [shownCards, setShownCards] = useState({}); // { [playerId]: { playerName, cards } }
  const [playedCards, setPlayedCards] = useState({}); // { [playerId]: { playerName, cards } }
  const [playHistory, setPlayHistory] = useState([]); // 出牌历史记录 [{ playerId, playerName, timestamp }, ...]
  const [revealedBottomCards, setRevealedBottomCards] = useState([]); // 展示的底牌
  const [myBottomCards, setMyBottomCards] = useState([]); // 我埋的底牌（仅埋底玩家可见）
  const [trumpSuit, setTrumpSuit] = useState(null); // 主牌花色
  const [trumpRank, setTrumpRank] = useState(null); // 主牌点数
  const [trumpModal, setTrumpModal] = useState(false); // 设置主牌弹窗
  const [roomConfigModal, setRoomConfigModal] = useState(false); // 房间设置弹窗
  const [newBottomCardsCount, setNewBottomCardsCount] = useState(8); // 新的底牌数量
  const [newDealInterval, setNewDealInterval] = useState(100); // 新的发牌间隔
  const [newPlayMode, setNewPlayMode] = useState(PlayModes.ORDERED); // 新的出牌模式
  const [newBotType, setNewBotType] = useState(BotTypes.SIMPLE); // 新的Bot类型
  const [newAllowSpectators, setNewAllowSpectators] = useState(true); // 是否允许观战
  const [newAllowSpectatorViewHands, setNewAllowSpectatorViewHands] = useState(false); // 是否允许观战者查看手牌
  const [renameModal, setRenameModal] = useState(false); // 修改昵称弹窗
  const [newPlayerName, setNewPlayerName] = useState(''); // 新昵称
  const [chatModal, setChatModal] = useState(false); // 聊天弹窗
  const [chatMessage, setChatMessage] = useState(''); // 当前输入的聊天消息
  const [chatHistory, setChatHistory] = useState([]); // 聊天历史
  const [quickPhrases, setQuickPhrases] = useState(() => {
    // 从localStorage加载快捷短语
    const saved = localStorage.getItem('tractorQuickPhrases');
    return saved ? JSON.parse(saved) : ['快点出牌！', '好牌！', '加油！', '大家好，很高兴见到各位！'];
  });
  const [quickPhraseModal, setQuickPhraseModal] = useState(false); // 快捷短语管理弹窗
  const [newQuickPhrase, setNewQuickPhrase] = useState(''); // 新的快捷短语输入
  const [ruleSelectorModal, setRuleSelectorModal] = useState(false); // 规则选择器弹窗
  const [selectedRule, setSelectedRule] = useState(null); // 当前选择的规则 { name, content }
  const [availableDeclarations, setAvailableDeclarations] = useState([]); // 可用的亮主选项
  const [currentTrumpDeclaration, setCurrentTrumpDeclaration] = useState(null); // 当前主牌亮主信息
  const [dealerCountdown, setDealerCountdown] = useState(null); // 庄家倒计时
  const [trumpAnimation, setTrumpAnimation] = useState(null); // 毙牌动画 { type: 'trump' | 'overtrump', playerName }
  const [attackerScore, setAttackerScore] = useState(0); // 闲家当前得分
  const [collectedPointCards, setCollectedPointCards] = useState([]); // 闲家收集的分数牌
  const [bottomScoreResult, setBottomScoreResult] = useState(null); // 底牌得分结果
  const [upgradeResult, setUpgradeResult] = useState(null); // 升级结果
  const [isReadyForNext, setIsReadyForNext] = useState(false); // 是否已准备下一局
  const [lastRoundCards, setLastRoundCards] = useState({}); // 上一轮出牌记录 { [playerId]: { playerName, cards } }
  const [lastRoundWinner, setLastRoundWinner] = useState(null); // 上一轮获胜者
  const [viewLastRoundModal, setViewLastRoundModal] = useState(false); // 查看上一轮出牌弹窗
  const [spectatorViewHandModal, setSpectatorViewHandModal] = useState(false); // 观战者查看手牌弹窗
  const [spectatorViewedHand, setSpectatorViewedHand] = useState({ playerName: '', cards: [] }); // 观战者查看的手牌

  // 用于跟踪轮次结束后清除出牌的定时器
  const roundEndTimeoutRef = useRef(null);
  // 用于在socket事件中访问最新的hideNotifications状态
  const hideNotificationsRef = useRef(hideNotifications);
  
  // 保持ref同步
  useEffect(() => {
    hideNotificationsRef.current = hideNotifications;
  }, [hideNotifications]);

  // 辅助函数：显示消息（受hideNotifications控制）
  const showMessage = (type, content, duration) => {
    if (hideNotificationsRef.current) return;
    if (type === 'success') messageApi.success(content, duration);
    else if (type === 'info') messageApi.info(content, duration);
    else if (type === 'warning') messageApi.warning(content, duration);
    else if (type === 'error') messageApi.error(content, duration);
  };

  // 辅助函数：清除轮次结束定时器
  const clearRoundEndTimeout = () => {
    if (roundEndTimeoutRef.current) {
      clearTimeout(roundEndTimeoutRef.current);
      roundEndTimeoutRef.current = null;
    }
  };

  const socket = socketService.socket;
  const isHost = currentPlayer?.socketId === currentRoom?.hostId;
  const gameState = currentRoom?.gameState;
  const phase = gameState?.phase || GamePhases.WAITING;

  // 同步房间状态中的主牌信息到本地状态和store
  useEffect(() => {
    if (gameState) {
      const roomTrumpSuit = gameState.trumpSuit;
      const roomTrumpRank = gameState.trumpRank;

      console.log(`🔄 同步房间状态: trumpSuit=${roomTrumpSuit}, trumpRank=${roomTrumpRank}`);

      // 更新本地状态
      setTrumpSuit(roomTrumpSuit);
      setTrumpRank(roomTrumpRank);
      // 更新store，触发手牌重新排序
      setTrumpInfo(roomTrumpSuit, roomTrumpRank);
    }
  }, [gameState?.trumpSuit, gameState?.trumpRank, setTrumpInfo]);

  // 检测手牌变化，更新可亮主选项（仅在摸牌阶段）
  useEffect(() => {
    if (phase !== GamePhases.DRAWING || !trumpRank) {
      setAvailableDeclarations([]);
      return;
    }

    const declarations = detectAvailableDeclarations(myCards, trumpRank, currentTrumpDeclaration, currentPlayer?.id);
    setAvailableDeclarations(declarations);
    console.log('🎯 可亮主选项更新:', declarations);
  }, [myCards, trumpRank, phase, currentTrumpDeclaration, currentPlayer?.id]);

  // 计算各花色牌数（不含主点数）
  const suitCounts = useMemo(() => {
    const counts = {
      spades: 0,
      hearts: 0,
      clubs: 0,
      diamonds: 0,
      joker: 0
    };
    
    if (!myCards || myCards.length === 0) return counts;
    
    myCards.forEach(card => {
      // 跳过主点数的牌
      if (trumpRank && card.rank === trumpRank) return;
      
      if (card.suit === Suits.SPADES) counts.spades++;
      else if (card.suit === Suits.HEARTS) counts.hearts++;
      else if (card.suit === Suits.CLUBS) counts.clubs++;
      else if (card.suit === Suits.DIAMONDS) counts.diamonds++;
      else if (card.suit === Suits.JOKER) counts.joker++;
    });
    
    return counts;
  }, [myCards, trumpRank]);

  // 监听游戏事件
  useEffect(() => {
    if (!socket) return;

    // 游戏开始
    socket.on('game_started', ({ gameState }) => {
      showMessage('success', t('game.gameStarted'));
      setShownCards({}); // 清空展示的牌
    });

    // 游戏重新开始
    socket.on('game_restarted', () => {
      showMessage('success', t('game.gameRestarted'));
      setMyCards([]); // 清空手牌
      setShownCards({}); // 清空展示的牌
      setPlayedCards({}); // 清空已出的牌
      setPlayHistory([]); // 清空出牌历史
      clearSelection(); // 清空选中的牌
      setCurrentTrumpDeclaration(null); // 清空亮主信息
      setAvailableDeclarations([]); // 清空可用亮主选项
      setAttackerScore(0); // 清空闲家得分
      setCollectedPointCards([]); // 清空收集的分数牌
      setBottomScoreResult(null); // 清空底牌得分结果
      setUpgradeResult(null); // 清空升级结果
      setRevealedBottomCards([]); // 清空底牌展示
      setIsReadyForNext(false); // 重置准备状态
      setLastRoundCards({}); // 清空上一轮出牌记录
      setLastRoundWinner(null); // 清空上一轮获胜者
    });

    // 收到手牌
    socket.on('card_dealt', ({ card }) => {
      addCard(card);
    });

    // 玩家展示手牌
    socket.on('cards_shown', ({ playerId, playerName, cards }) => {
      showMessage('info', t('messages.cardsShown', { name: playerName, count: cards.length }));
      // 更新该玩家的展示牌区域（覆盖之前的牌）
      setShownCards(prev => ({
        ...prev,
        [playerId]: { playerName, cards }
      }));
    });

    // 收到底牌（埋底玩家）
    socket.on('bottom_cards_received', ({ bottomCards, totalCards }) => {
      bottomCards.forEach(card => addCard(card));
      showMessage('success', t('bottom.receivedBottomCards', { count: bottomCards.length, total: totalCards }));
    });

    // 埋底玩家设置
    socket.on('burying_player_set', ({ playerName }) => {
      showMessage('info', t('bottom.buryingPlayerSet', { name: playerName }));
    });

    // 埋底完成
    socket.on('cards_buried', ({ playerName, playerId }) => {
      showMessage('success', t('bottom.buryCompleted', { name: playerName }));
      // 如果是我自己埋的底，清空我的底牌缓存（已经埋了）
      if (playerId === currentPlayer?.id) {
        // 底牌已经保存在后端，前端不需要再显示
      }
    });

    // 首发玩家设置
    socket.on('first_player_set', ({ playerName }) => {
      showMessage('info', t('messages.firstPlayerSet', { name: playerName }));
    });

    // 玩家出牌
    socket.on('cards_played', ({ playerId, playerName, cards, isLeading }) => {
      console.log('收到 cards_played 事件:', { playerId, playerName, cardsCount: cards.length, isLeading });
      showMessage('info', t('messages.cardsPlayed', { name: playerName, count: cards.length }));
      
      // 如果有待执行的轮次结束清除定时器，取消它（防止新一轮的第一张牌被清除）
      clearRoundEndTimeout();
      
      // 更新该玩家的出牌区域
      setPlayedCards(prev => {
        let updated;
        if (isLeading) {
          // 首发出牌时，清除其他玩家的牌，只保留当前出牌玩家的牌
          updated = {
            [playerId]: { playerName, cards }
          };
          console.log('首发出牌，清除其他玩家的牌');
        } else {
          // 跟牌时，保留其他玩家的牌
          updated = {
            ...prev,
            [playerId]: { playerName, cards }
          };
        }
        console.log('更新后的 playedCards:', Object.keys(updated));
        return updated;
      });
      // 添加到出牌历史
      setPlayHistory(prev => [...prev, { playerId, playerName, timestamp: Date.now() }]);
    });

    // 玩家跳过
    socket.on('turn_passed', ({ playerName }) => {
      showMessage('info', t('messages.turnPassed', { name: playerName }));
    });

    // 展示底牌（修正事件名）
    socket.on('bottom_revealed', ({ bottomCards, bottomScoreResult, upgradeResult }) => {
      showMessage('info', t('bottom.bottomRevealed', { count: bottomCards.length }));
      setRevealedBottomCards(bottomCards);
      if (bottomScoreResult) {
        setBottomScoreResult(bottomScoreResult);
        setAttackerScore(bottomScoreResult.totalScore);
        setCollectedPointCards(bottomScoreResult.collectedPointCards || []);
        // 显示底牌得分结果
        const resultMsg = bottomScoreResult.attackerWonBottom
          ? `${t('bottom.attackerWonBottom')} ${t('bottom.bottomPoints', { points: bottomScoreResult.bottomPoints, multiplier: bottomScoreResult.bottomMultiplier, gained: bottomScoreResult.bottomScoreGained })} ${t('bottom.totalScore', { score: bottomScoreResult.totalScore })}`
          : `${t('bottom.dealerKeptBottom')} ${t('bottom.totalScore', { score: bottomScoreResult.totalScore })}`;
        showMessage('success', resultMsg, 5);
      }
      if (upgradeResult) {
        setUpgradeResult(upgradeResult);
        // 显示升级结果
        const winnerMsg = upgradeResult.attackerWon ? t('bottom.attackerWins') : t('bottom.dealerWins');
        const upgradeMsg = upgradeResult.attackerWon
          ? t('bottom.levelUp', { count: upgradeResult.attackerLevelUp })
          : t('bottom.levelUp', { count: upgradeResult.dealerLevelUp });
        showMessage('success', `${winnerMsg} ${upgradeMsg}`, 5);
      }
    });

    // 收到我的底牌
    socket.on('my_bottom_cards', ({ bottomCards }) => {
      setMyBottomCards(bottomCards);
      setViewBottomModal(true);
    });

    // 玩家准备下一局
    socket.on('player_ready_for_next', ({ playerName, readyCount, totalCount }) => {
      showMessage('info', t('messages.playerReadyForNext', { name: playerName, ready: readyCount, total: totalCount }));
    });

    // 下一局开始
    socket.on('next_game_started', () => {
      showMessage('success', t('messages.nextGameStarted'));
      // 清空所有前端状态
      setMyCards([]);
      setShownCards({});
      setPlayedCards({});
      setPlayHistory([]);
      clearSelection();
      setCurrentTrumpDeclaration(null);
      setAvailableDeclarations([]);
      setAttackerScore(0);
      setCollectedPointCards([]);
      setBottomScoreResult(null);
      setUpgradeResult(null);
      setRevealedBottomCards([]);
      setIsReadyForNext(false); // 重置准备状态
      setLastRoundCards({}); // 清空上一轮出牌记录
      setLastRoundWinner(null); // 清空上一轮获胜者
      // 主牌信息会通过房间状态同步的useEffect自动更新
    });

    // 分数更新
    socket.on('score_updated', ({ playerId, newScore }) => {
      showMessage('success', t('adjust.scoreUpdated'));
    });

    // 等级更新
    socket.on('level_updated', ({ playerId, newLevel }) => {
      showMessage('success', t('adjust.levelUpdated'));
    });

    // 撤回出牌
    socket.on('play_undone', ({ playerId, playerName, cards }) => {
      console.log('收到 play_undone 事件:', { playerId, playerName, cardsCount: cards.length });
      showMessage('info', t('messages.playUndone', { name: playerName }));
      // 清除该玩家的已出牌显示
      setPlayedCards(prev => {
        const updated = { ...prev };
        delete updated[playerId];
        console.log('撤回后的 playedCards:', Object.keys(updated));
        return updated;
      });

      // 从出牌历史中移除该玩家的最后一次出牌
      setPlayHistory(prev => {
        const lastIndex = prev.map(p => p.playerId).lastIndexOf(playerId);
        if (lastIndex !== -1) {
          const updated = [...prev];
          updated.splice(lastIndex, 1);
          return updated;
        }
        return prev;
      });

      // 如果是自己撤回，将牌添加回手牌
      if (playerId === currentPlayer?.id) {
        console.log('将牌添加回手牌:', cards.length, '张');
        cards.forEach(cardData => {
          addCard(cardData);
        });
      }
    });

    // 主牌更新
    socket.on('trump_updated', ({ trumpSuit, trumpRank }) => {
      console.log(`🃏 收到trump_updated事件: trumpSuit=${trumpSuit}, trumpRank=${trumpRank}`);
      setTrumpSuit(trumpSuit);
      setTrumpRank(trumpRank);
      // 更新store中的主牌信息，自动重排手牌
      setTrumpInfo(trumpSuit, trumpRank);
      if (trumpSuit && trumpRank) {
        showMessage('info', `${t('trump.trumpSet')}: ${trumpSuit} ${trumpRank}`);
      } else if (trumpRank) {
        console.log(`📢 级牌已设置: ${trumpRank}`);
      }
    });

    // 甩牌失败
    socket.on('throw_failed', ({ playerId, playerName, message: msg, attemptedCards, attemptedCardObjects, forcedCards }) => {
      showMessage('warning', t('messages.throwFailed', { name: playerName, count: forcedCards.length }), 3);

      // 如果是自己甩牌失败，恢复未被强制出的牌到手牌（因为前端在发送时进行了乐观移除）
      if (playerId === currentPlayer?.id && Array.isArray(attemptedCardObjects)) {
        const forcedIds = new Set((forcedCards || []).map(c => c.id));
        const toRestore = attemptedCardObjects.filter(c => !forcedIds.has(c.id));
        if (toRestore.length > 0) {
          // 将未被强制出的牌加回手牌
          toRestore.forEach(cardData => addCard(cardData));
        }
      }
    });

    // 毙牌动作
    socket.on('trump_action', ({ type, playerId, playerName }) => {
      const actionText = type === 'trump' ? t('trump.trumpAction') : t('trump.overTrumpAction');
      showMessage('success', `${playerName} ${actionText}`, 2);
      // 设置动画
      setTrumpAnimation({ type, playerName });
      // 3秒后清除动画
      setTimeout(() => {
        setTrumpAnimation(null);
      }, 3000);
    });

    // 亮主成功
    socket.on('trump_declared', ({ playerId, playerName, suit, count, declarationType, strength, isCounter, cards }) => {
      const action = isCounter ? 'counter' : 'declare';
      const suitMap = {
        'spades': t('suits.spades'),
        'hearts': t('suits.hearts'),
        'clubs': t('suits.clubs'),
        'diamonds': t('suits.diamonds'),
        'joker': t('suits.joker')
      };
      const suitSymbol = suitMap[suit] || suit;
      const countType = count === 2 ? 'pair' : 'single';

      console.log(`🎺 ${action}成功: ${playerName} ${action}了 ${count} 张 ${suitSymbol}`);
      const msgKey = isCounter ? 'messages.counterDeclare' : (count === 2 ? 'messages.declaredPair' : 'messages.declaredSingle');
      showMessage('success', t(msgKey, { name: playerName, suit: suitSymbol, type: countType }));

      // 更新当前亮主信息
      setCurrentTrumpDeclaration({
        playerId: playerId,
        playerName: playerName,
        suit: suit,
        count: count,
        declarationType: declarationType,
        strength: strength,
        isCounter: isCounter,
        cards: cards || []
      });

      // 立即同步主牌信息到本地并重排手牌，避免在网络延迟或缺少 trump_updated 事件前出现无主排序
      try {
        const immediateTrumpSuit = suit !== 'joker' ? suit : 'no_trump';
        console.log(`📡 即时更新主牌: ${immediateTrumpSuit}, trumpRank=${trumpRank}`);
        setTrumpSuit(immediateTrumpSuit);
        // trumpRank 保持不变（由房间配置决定），但也再次传入以保证排序正确
        setTrumpInfo(immediateTrumpSuit, trumpRank);
      } catch (e) {
        console.warn('同步主牌信息失败:', e);
      }
    });

    // 房间配置更新
    socket.on('config_updated', ({ config }) => {
      showMessage('success', t('messages.configUpdated'));
      setNewBottomCardsCount(config.bottomCardsCount);
      setNewDealInterval(config.dealInterval);
      if (config.playMode) {
        setNewPlayMode(config.playMode);
      }
      if (config.botType) {
        setNewBotType(config.botType);
      }
      if (config.allowSpectators !== undefined) {
        setNewAllowSpectators(config.allowSpectators);
      }
      if (config.allowSpectatorViewHands !== undefined) {
        setNewAllowSpectatorViewHands(config.allowSpectatorViewHands);
      }
    });

    // 玩家昵称更新
    socket.on('player_name_updated', ({ playerId, oldName, newName }) => {
      if (playerId === currentPlayer?.id) {
        showMessage('success', t('nickname.nicknameUpdated', { name: newName }));
      } else {
        showMessage('info', t('nickname.playerRenamed', { oldName, newName }));
      }
    });

    // 接收聊天消息
    socket.on('chat_message_received', ({ playerName, message, timestamp }) => {
      setChatHistory(prev => [...prev, { playerName, message, timestamp }]);
      showMessage('info', `${playerName}: ${message}`);
    });

    // Bot添加
    socket.on('bot_added', ({ player }) => {
      showMessage('success', t('messages.botAdded', { name: player.name }));
    });

    // Bot移除
    socket.on('bot_removed', ({ playerName }) => {
      showMessage('info', t('messages.botRemoved', { name: playerName }));
    });

    // 玩家准备状态更新
    socket.on('player_ready_status', ({ playerName, isReady }) => {
      showMessage('info', isReady ? t('messages.playerReady', { name: playerName }) : t('messages.playerCancelReady', { name: playerName }));
    });

    // 所有玩家准备完毕
    socket.on('all_players_ready', ({ message }) => {
      showMessage('success', t('messages.allPlayersReady'));
    });

    // 规则选择
    socket.on('rule_selected', ({ playerName, rule }) => {
      setSelectedRule(rule);
      showMessage('info', t('messages.ruleSelected', { name: playerName, rule: rule.name }));
    });

    // 庄家倒计时开始/重置
    socket.on('dealer_countdown_start', ({ countdown }) => {
      setDealerCountdown(countdown);
    });

    // 庄家倒计时结束
    socket.on('dealer_countdown_end', () => {
      setDealerCountdown(null);
    });

    // 回合状态更新
    socket.on('round_updated', (roundUpdate) => {
      console.log('收到 round_updated 事件:', roundUpdate);
      if (roundUpdate.type === 'turn_changed') {
        const currentPlayer = currentRoom.players[roundUpdate.currentPlayerIndex];
        if (currentPlayer) {
          showMessage('info', t('messages.currentTurn', { name: currentPlayer.name }));
        }
      } else if (roundUpdate.type === 'round_started') {
        showMessage('success', roundUpdate.message || t('messages.roundStarted', { round: roundUpdate.round }));
        // 新一轮开始，清空出牌历史（因为是新的一轮，之前的牌不能再撤回）
        setPlayHistory([]);
        // 同时清空已出牌显示
        setPlayedCards({});
      } else if (roundUpdate.type === 'round_ended') {
        // 轮次结束，显示获胜者信息
        if (roundUpdate.roundWinner) {
          showMessage('success', t('messages.roundEnded', { round: roundUpdate.round, winner: roundUpdate.roundWinner.playerName }));
        }
        // 处理得分信息
        if (roundUpdate.scoreInfo) {
          const { roundPoints, winnerIsAttacker, attackerScore: newScore, collectedPointCards: newCards } = roundUpdate.scoreInfo;
          if (winnerIsAttacker && roundPoints > 0) {
            showMessage('info', t('messages.attackerGotPoints', { points: roundPoints, total: newScore }), 3);
          }
          setAttackerScore(newScore);
          setCollectedPointCards(newCards || []);
        }
        // 保存当前轮次的出牌记录作为"上一轮"，供查看上轮出牌按钮使用
        // 使用函数式更新确保获取最新的playedCards
        setPlayedCards(currentPlayedCards => {
          setLastRoundCards({ ...currentPlayedCards });
          return currentPlayedCards; // 暂时保持不变
        });
        setLastRoundWinner(roundUpdate.roundWinner);
        // 延迟2秒后清空出牌显示，准备下一轮
        // 使用ref保存定时器，以便在新牌打出时取消
        clearRoundEndTimeout();
        roundEndTimeoutRef.current = setTimeout(() => {
          setPlayHistory([]);
          setPlayedCards({});
          roundEndTimeoutRef.current = null;
        }, 2000);
      }
    });

    // 游戏记录（保存全局功能）
    socket.on('game_records', ({ records }) => {
      try {
        // Create a blob with the JSON data
        const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Create a download link and trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = `tractor_game_${records.roomId}_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showMessage('success', t('play.saveGlobalSuccess'));
      } catch (error) {
        console.error('下载游戏记录失败:', error);
        showMessage('error', t('play.saveGlobalError'));
      }
    });

    // 观战者查看手牌响应
    socket.on('spectator_hand_view', ({ playerId, playerName, cards }) => {
      setSpectatorViewedHand({ playerName, cards });
      setSpectatorViewHandModal(true);
    });

    return () => {
      socket.off('game_started');
      socket.off('card_dealt');
      socket.off('cards_shown');
      socket.off('bottom_cards_received');
      socket.off('burying_player_set');
      socket.off('cards_buried');
      socket.off('first_player_set');
      socket.off('cards_played');
      socket.off('turn_passed');
      socket.off('play_undone');
      socket.off('bottom_revealed');
      socket.off('my_bottom_cards');
      socket.off('player_ready_for_next');
      socket.off('next_game_started');
      socket.off('game_restarted');
      socket.off('score_updated');
      socket.off('level_updated');
      socket.off('trump_updated');
      socket.off('throw_failed');
      socket.off('trump_action');
      socket.off('trump_declared');
      socket.off('config_updated');
      socket.off('player_name_updated');
      socket.off('chat_message_received');
      socket.off('bot_added');
      socket.off('bot_removed');
      socket.off('player_ready_status');
      socket.off('all_players_ready');
      socket.off('rule_selected');
      socket.off('dealer_countdown_start');
      socket.off('dealer_countdown_end');
      socket.off('trump_action');
      socket.off('round_updated');
      socket.off('game_records');
      socket.off('spectator_hand_view');
      // 清理轮次结束定时器
      clearRoundEndTimeout();
    };
  }, [socket, messageApi, clearSelection, addCard, removeCards, currentPlayer, currentRoom]);

  // 庄家倒计时递减
  useEffect(() => {
    if (dealerCountdown === null || dealerCountdown <= 0) return;

    const timer = setInterval(() => {
      setDealerCountdown(prev => {
        if (prev === null || prev <= 1) {
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [dealerCountdown]);

  // 同步主牌状态和规则
  useEffect(() => {
    if (gameState) {
      setTrumpSuit(gameState.trumpSuit);
      setTrumpRank(gameState.trumpRank);
      if (gameState.selectedRule) {
        setSelectedRule(gameState.selectedRule);
      }
    }
  }, [gameState]);

  // 同步房间配置
  useEffect(() => {
    if (currentRoom?.config) {
      setNewBottomCardsCount(currentRoom.config.bottomCardsCount);
      setNewDealInterval(currentRoom.config.dealInterval);
      setNewPlayMode(currentRoom.config.playMode || PlayModes.ORDERED);
      setNewBotType(currentRoom.config.botType || BotTypes.SIMPLE);
      setNewAllowSpectators(currentRoom.config.allowSpectators !== false);
      setNewAllowSpectatorViewHands(currentRoom.config.allowSpectatorViewHands === true);
    }
  }, [currentRoom]);

  // 开始游戏
  const handleStartGame = () => {
    socket.emit(SOCKET_EVENTS.START_GAME, { roomId: currentRoom.id });
  };

  // 玩家准备
  const handlePlayerReady = () => {
    socket.emit('player_ready', { roomId: currentRoom.id });
  };

  // 展示手牌（仅自由模式）
  const handleShowCards = () => {
    if (selectedCards.length === 0) {
      messageApi.warning(t('play.selectCardsToShow'));
      return;
    }
    socket.emit(SOCKET_EVENTS.SHOW_CARDS, {
      roomId: currentRoom.id,
      cardIds: selectedCards
    });
    clearSelection();
  };

  // 亮主处理
  const handleDeclare = (suitType, count) => {
    // 映射suitType到实际的花色
    const suitMap = {
      'spades': 'spades',
      'hearts': 'hearts',
      'clubs': 'clubs',
      'diamonds': 'diamonds',
      'joker': 'joker'
    };

    const suit = suitMap[suitType];
    if (!suit) {
      messageApi.error(t('messages.errorOccurred'));
      return;
    }

    console.log(`🎺 尝试亮主: ${suitType}, 数量: ${count}`);

    // 发送亮主请求到服务器
    socket.emit(SOCKET_EVENTS.DECLARE_TRUMP, {
      roomId: currentRoom.id,
      suit: suit,
      count: count
    });
  };

  // 一键选中所有手牌
  const handleSelectAllCards = () => {
    if (myCards.length === 0) {
      messageApi.warning(t('play.noCardsToSelect'));
      return;
    }
    const allCardIds = myCards.map(card => card.id);
    // 如果已经全选，则取消全选
    if (selectedCards.length === myCards.length) {
      clearSelection();
    } else {
      // 选中所有牌
      setSelectedCards(allCardIds);
    }
  };

  // 设置埋底玩家
  const handleSetBuryingPlayer = () => {
    if (!selectedBuryingPlayer) {
      messageApi.warning(t('play.selectBuryingPlayer'));
      return;
    }
    socket.emit(SOCKET_EVENTS.SET_BURYING_PLAYER, {
      roomId: currentRoom.id,
      playerId: selectedBuryingPlayer
    });
    setBuryingPlayerModal(false);
  };

  // 埋底
  const handleBuryCards = () => {
    if (selectedCards.length !== currentRoom.config.bottomCardsCount) {
      messageApi.warning(t('play.selectCorrectBuryCount', { count: currentRoom.config.bottomCardsCount }));
      return;
    }
    const cardsToRemove = [...selectedCards];
    socket.emit(SOCKET_EVENTS.BURY_CARDS, {
      roomId: currentRoom.id,
      cardIds: cardsToRemove
    });
    // 立即从手牌中移除（乐观更新）
    removeCards(cardsToRemove);
    clearSelection();
  };

  // 设置首发玩家
  const handleSetFirstPlayer = () => {
    if (!selectedFirstPlayer) {
      messageApi.warning(t('play.selectPlayerFirst'));
      return;
    }
    socket.emit(SOCKET_EVENTS.SET_FIRST_PLAYER, {
      roomId: currentRoom.id,
      playerId: selectedFirstPlayer
    });
    setFirstPlayerModal(false);
  };

  // 出牌
  const handlePlayCards = () => {
    if (selectedCards.length === 0) {
      messageApi.warning(t('play.selectCardsFirst'));
      return;
    }
    const cardsToPlay = [...selectedCards];
    console.log('发送 PLAY_CARDS 事件:', { cardIds: cardsToPlay });
    socket.emit(SOCKET_EVENTS.PLAY_CARDS, {
      roomId: currentRoom.id,
      cardIds: cardsToPlay
    });
    // 立即从手牌中移除（乐观更新）
    removeCards(cardsToPlay);
    clearSelection();
  };

  // 跳过
  const handlePass = () => {
    socket.emit(SOCKET_EVENTS.PASS_TURN, {
      roomId: currentRoom.id
    });
  };

  // 撤回出牌
  const handleUndoPlay = () => {
    socket.emit(SOCKET_EVENTS.UNDO_PLAY, {
      roomId: currentRoom.id
    });
  };

  // 查看我的底牌（埋底玩家）
  const handleViewMyBottomCards = () => {
    socket.emit(SOCKET_EVENTS.VIEW_MY_BOTTOM_CARDS, {
      roomId: currentRoom.id
    });
  };

  const handleReadyForNext = () => {
    if (isReadyForNext) {
      return; // 已经准备过了，防止重复点击
    }
    setIsReadyForNext(true);
    socket.emit('ready_for_next_game', {
      roomId: currentRoom.id
    });
  };

  // 调整分数
  const handleUpdateScore = () => {
    if (!selectedPlayerId) {
      messageApi.warning(t('play.selectPlayerFirst'));
      return;
    }
    socket.emit(SOCKET_EVENTS.UPDATE_SCORE, {
      roomId: currentRoom.id,
      playerId: selectedPlayerId,
      newScore: adjustValue
    });
    setScoreAdjustModal(false);
  };

  // 调整等级
  const handleUpdateLevel = () => {
    if (!selectedPlayerId) {
      messageApi.warning(t('play.selectPlayerFirst'));
      return;
    }
    socket.emit(SOCKET_EVENTS.UPDATE_LEVEL, {
      roomId: currentRoom.id,
      playerId: selectedPlayerId,
      newLevel: adjustValue
    });
    setLevelAdjustModal(false);
  };

  // 重新开始
  const handleRestartGame = () => {
    socket.emit(SOCKET_EVENTS.RESTART_GAME, {
      roomId: currentRoom.id
    });
  };

  // 快速调整分数（快捷按钮）
  const handleQuickAdjustScore = (amount) => {
    socket.emit(SOCKET_EVENTS.UPDATE_SCORE, {
      roomId: currentRoom.id,
      amount
    });
  };

  // 快速调整等级（快捷按钮）
  const handleQuickAdjustLevel = (amount) => {
    socket.emit(SOCKET_EVENTS.UPDATE_LEVEL, {
      roomId: currentRoom.id,
      amount
    });
  };

  // 设置主牌
  const handleSetTrump = (suit, rank) => {
    socket.emit(SOCKET_EVENTS.SET_TRUMP, {
      roomId: currentRoom.id,
      suit,
      rank
    });
    setTrumpModal(false);
  };

  // 更新房间配置
  const handleUpdateRoomConfig = () => {
    if (newBottomCardsCount < 1 || newBottomCardsCount > 20) {
      messageApi.warning(t('createRoomForm.bottomCardsValidation'));
      return;
    }
    if (newDealInterval < 10 || newDealInterval > 5000) {
      messageApi.warning(t('createRoomForm.dealIntervalValidation'));
      return;
    }
    socket.emit(SOCKET_EVENTS.UPDATE_CONFIG, {
      roomId: currentRoom.id,
      config: {
        bottomCardsCount: newBottomCardsCount,
        dealInterval: newDealInterval,
        playMode: newPlayMode,
        botType: newBotType,
        allowSpectators: newAllowSpectators,
        allowSpectatorViewHands: newAllowSpectatorViewHands
      }
    });
    setRoomConfigModal(false);
  };

  // 修改玩家昵称
  const handleUpdatePlayerName = () => {
    const trimmedName = newPlayerName.trim();
    if (!trimmedName) {
      messageApi.warning(t('nickname.nicknameEmpty'));
      return;
    }
    if (trimmedName.length > 20) {
      messageApi.warning(t('nickname.nicknameTooLong'));
      return;
    }
    socket.emit(SOCKET_EVENTS.UPDATE_PLAYER_NAME, {
      roomId: currentRoom.id,
      newName: trimmedName
    });
    setRenameModal(false);
    setNewPlayerName('');
  };

  // 打开修改昵称对话框
  const handleOpenRenameModal = () => {
    setNewPlayerName(currentPlayer?.name || '');
    setRenameModal(true);
  };

  // 处理规则选择
  const handleRuleSelected = (rule) => {
    // 发送规则选择事件到服务器
    socket.emit(SOCKET_EVENTS.SELECT_RULE, {
      roomId: currentRoom.id,
      rule: rule
    });
    setRuleSelectorModal(false);
  };

  // 发送聊天消息
  const handleSendChatMessage = (msg) => {
    const messageToSend = msg || chatMessage.trim();
    if (!messageToSend) {
      messageApi.warning(t('chat.messageEmpty'));
      return;
    }
    if (messageToSend.length > 200) {
      messageApi.warning(t('chat.messageTooLong'));
      return;
    }
    socket.emit(SOCKET_EVENTS.SEND_CHAT_MESSAGE, {
      roomId: currentRoom.id,
      message: messageToSend
    });
    setChatMessage('');
  };

  // 添加快捷短语
  const handleAddQuickPhrase = () => {
    const trimmed = newQuickPhrase.trim();
    if (!trimmed) {
      messageApi.warning(t('chat.phraseEmpty'));
      return;
    }
    if (trimmed.length > 50) {
      messageApi.warning(t('chat.phraseTooLong'));
      return;
    }
    if (quickPhrases.includes(trimmed)) {
      messageApi.warning(t('chat.phraseExists'));
      return;
    }
    const newPhrases = [...quickPhrases, trimmed];
    setQuickPhrases(newPhrases);
    localStorage.setItem('tractorQuickPhrases', JSON.stringify(newPhrases));
    setNewQuickPhrase('');
    messageApi.success(t('chat.phraseAdded'));
  };

  // 删除快捷短语
  const handleDeleteQuickPhrase = (phrase) => {
    const newPhrases = quickPhrases.filter(p => p !== phrase);
    setQuickPhrases(newPhrases);
    localStorage.setItem('tractorQuickPhrases', JSON.stringify(newPhrases));
    messageApi.success(t('chat.phraseDeleted'));
  };

  // 添加Bot
  const handleAddBot = () => {
    const botCount = currentRoom.players.filter(p => p.isBot).length;
    socket.emit(SOCKET_EVENTS.ADD_BOT, {
      roomId: currentRoom.id,
      botName: `AI Bot ${botCount + 1}`
    });
  };

  // 移除Bot
  const handleRemoveBot = (playerId) => {
    socket.emit(SOCKET_EVENTS.REMOVE_BOT, {
      roomId: currentRoom.id,
      playerId
    });
  };

  // 保存全局游戏记录（房主）
  const handleSaveGlobal = () => {
    socket.emit('get_game_records', {
      roomId: currentRoom.id
    });
  };

  // 观战者退出
  const handleLeaveSpectator = () => {
    socket.emit(SOCKET_EVENTS.LEAVE_SPECTATOR, {
      roomId: currentRoom.id
    });
    setCurrentRoom(null);
    setCurrentSpectator(null);
    messageApi.info(t('room.leftSpectator'));
  };

  // 观战者查看玩家手牌
  const handleViewPlayerHand = (playerId, playerName) => {
    socket.emit(SOCKET_EVENTS.SPECTATOR_VIEW_HAND, {
      roomId: currentRoom.id,
      playerId: playerId
    });
  };

  const isBuryingPlayer = gameState?.buryingPlayerId === currentPlayer?.id;
  const currentPlayMode = gameState?.playMode || currentRoom?.config?.playMode || PlayModes.ORDERED;
  const isFreeMode = currentPlayMode === PlayModes.FREE;

  // 通用按钮样式 - 响应式设计
  const buttonStyle = { 
    minWidth: '80px',
    maxWidth: '120px',
    width: 'auto',
    fontSize: '13px',
    padding: '4px 8px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  };

  // 通用按钮组件 - 房间设置（仅房主可见）
  const renderRoomSettingsButton = () => {
    if (!isHost) return null;
    return (
      <Button key="room-settings" onClick={() => setRoomConfigModal(true)} style={buttonStyle}>
        {t('room.roomSettings')}
      </Button>
    );
  };

  // 通用按钮组件 - 修改昵称
  const renderRenameButton = () => (
    <Button key="rename" onClick={handleOpenRenameModal} style={buttonStyle}>
      {t('play.rename')}
    </Button>
  );

  // 通用按钮组件 - 聊天
  const renderChatButton = () => (
    <Button key="chat" onClick={() => setChatModal(true)} style={buttonStyle}>
      {t('play.chat')}
    </Button>
  );

  // 通用按钮组件 - 全选（仅自由模式显示）
  const renderSelectAllButton = (forceShow = false) => {
    // 在基础模式下不显示全选按钮，除非强制显示
    if (!forceShow && !isFreeMode) return null;
    return (
      <Button key="selectAll" onClick={handleSelectAllCards} disabled={myCards.length === 0} style={buttonStyle}>
        {t('play.selectAll')}
      </Button>
    );
  };

  // 通用按钮组件 - 设置（包含语言切换和隐藏提示）
  const renderSettingsButton = () => (
    <Button
      key="settings-personal"
      icon={<SettingOutlined />}
      onClick={() => setSettingsModal(true)}
      style={{ ...buttonStyle, minWidth: '44px' }}
    />
  );

  // 通用按钮组件 - 查看上一轮出牌
  const renderViewLastRoundButton = () => {
    // 只有当有上一轮记录时才显示
    if (!lastRoundCards || Object.keys(lastRoundCards).length === 0) {
      return null;
    }
    return (
      <Button key="viewLastRound" onClick={() => setViewLastRoundModal(true)} style={buttonStyle}>
        {t('play.viewLastRound')}
      </Button>
    );
  };

  // 通用按钮组件 - 保存全局（仅房主可见）
  const renderSaveGlobalButton = () => {
    if (!isHost) return null;
    return (
      <Button key="saveGlobal" onClick={handleSaveGlobal} style={buttonStyle}>
        {t('play.saveGlobal')}
      </Button>
    );
  };

  // 渲染控制按钮区域
  const renderControlButtons = () => {
    // 观战者只有退出观战按钮
    if (isSpectator) {
      return (
        <div className="responsive-flex-buttons">
          <Button
            key="leaveSpectator"
            onClick={handleLeaveSpectator}
            style={buttonStyle}
          >
            {t('room.leaveWatch')}
          </Button>
          {renderSettingsButton()}
        </div>
      );
    }

    const isFreeMode = currentPlayMode === PlayModes.FREE;

    switch (phase) {
      case GamePhases.WAITING:
        if (!currentRoom) return null;

        const isWaitingForReady = gameState?.isWaitingForReady || false;

        if (isWaitingForReady) {
          const buttons = [];

          if (!currentPlayer?.isBot) {
            buttons.push(
              <Button
                key="ready"
                type="primary"
                onClick={handlePlayerReady}
                style={buttonStyle}
              >
                {currentPlayer?.isReady ? t('common.cancelReady') : t('common.ready')}
              </Button>
            );
          }
          
          buttons.push(renderSettingsButton());

          return (
            <div className="responsive-flex-buttons">
              {buttons}
            </div>
          );
        }
        return null;

      case GamePhases.DRAWING:
        if (isFreeMode) {
          // 自由模式：展示牌、全选、指定埋底（房主）、修改昵称
          const drawingButtons = [
            <Button
              key="show"
              onClick={handleShowCards}
              disabled={selectedCards.length === 0}
              style={buttonStyle}
            >
              {t('play.showCards')}({selectedCards.length})
            </Button>,
            renderSelectAllButton()
          ];

          if (isHost) {
            drawingButtons.push(
              <Button
                key="setBurying"
                type="primary"
                onClick={() => setBuryingPlayerModal(true)}
                style={buttonStyle}
              >
                {t('play.setBurying')}
              </Button>
            );
          }

          drawingButtons.push(renderRenameButton());
          drawingButtons.push(renderSettingsButton());
          const roomSettingsBtn = renderRoomSettingsButton();
          if (roomSettingsBtn) drawingButtons.push(roomSettingsBtn);

          return (
            <div className="responsive-button-grid">
              {drawingButtons}
            </div>
          );
        } else {
          // 基础模式：只保留房间设置（房主）和设置按钮
          // 移除全选按钮
          const drawingButtons = [renderSettingsButton()];
          const roomSettingsBtnBasic = renderRoomSettingsButton();
          if (roomSettingsBtnBasic) drawingButtons.push(roomSettingsBtnBasic);

          return (
            <div className="responsive-flex-buttons">
              {drawingButtons}
            </div>
          );
        }

      case GamePhases.BURYING:
        const buryingButtons = [];

        if (isBuryingPlayer) {
          buryingButtons.push(
            <Button
              key="bury"
              type="primary"
              onClick={handleBuryCards}
              disabled={selectedCards.length !== currentRoom.config.bottomCardsCount}
              style={{ ...buttonStyle, minWidth: '120px' }}
            >
              {t('play.bury')}({selectedCards.length}/{currentRoom.config.bottomCardsCount})
            </Button>
          );
        } else {
          buryingButtons.push(
            <Button key="waiting" disabled style={{ ...buttonStyle, minWidth: '120px' }}>
              {t('play.waitingBury')}
            </Button>
          );
        }

        {
          const roomSettingsBtn = renderRoomSettingsButton();
          if (roomSettingsBtn) buryingButtons.push(roomSettingsBtn);
        }
        buryingButtons.push(renderSettingsButton());

        return (
          <div className="responsive-flex-buttons">
            {buryingButtons}
          </div>
        );

      case GamePhases.PLAYING:
        // 检查是否轮到当前玩家出牌
        const isMyTurn = gameState?.playMode === PlayModes.FREE ||
                        (gameState?.currentPlayerIndex !== null &&
                         gameState?.currentPlayerIndex !== undefined &&
                         currentRoom?.players[gameState.currentPlayerIndex]?.id === currentPlayer?.id);

        // 检查是否可以撤回
        const canUndo = (() => {
          if (!currentPlayer?.id) return false;
          const lastPlayIndex = playHistory.map(p => p.playerId).lastIndexOf(currentPlayer.id);
          if (lastPlayIndex === -1) {
            return false;
          }
          const hasSubsequentPlays = playHistory
            .slice(lastPlayIndex + 1)
            .some(p => p.playerId !== currentPlayer.id);
          return !hasSubsequentPlays;
        })();

        // 验证选中的牌是否合法
        const validateSelectedCards = (() => {
          if (selectedCards.length === 0) {
            return { valid: false, message: t('play.selectCardsFirst') };
          }

          const selectedCardObjects = myCards.filter(card => selectedCards.includes(card.id));

          const isLeading = gameState?.currentRoundPlays === 0 ||
                           gameState?.playersPlayedThisRound?.length === 0 ||
                           (Array.isArray(gameState?.playersPlayedThisRound) && gameState.playersPlayedThisRound.length === 0);

          if (isLeading) {
            return validateLeadingPlay(selectedCardObjects, trumpSuit, trumpRank);
          } else {
            const leadingPattern = gameState?.leadingPattern;
            if (!leadingPattern) {
              return validateLeadingPlay(selectedCardObjects, trumpSuit, trumpRank);
            }
            return validateFollowingPlay(selectedCardObjects, myCards, leadingPattern, trumpSuit, trumpRank);
          }
        })();

        const canPlay = isMyTurn && (isFreeMode || validateSelectedCards.valid);
        const playButtonTitle = !isMyTurn ? t('play.notYourTurn') :
                               (!isFreeMode && !validateSelectedCards.valid) ? validateSelectedCards.message : '';

        if (isFreeMode) {
          // 自由模式：出牌、撤回、聊天、看底牌（庄家）、全选、加减分按钮、加减级按钮、重新开始（房主）、修改昵称
          const playingButtons = [];

          if (gameState.buryingPlayerId) {
            playingButtons.push(
              <Button
                key="play"
                type="primary"
                onClick={handlePlayCards}
                disabled={selectedCards.length === 0}
                style={buttonStyle}
              >
                {t('play.playCards')}({selectedCards.length})
              </Button>,
              renderChatButton(),
              <Button key="undo" onClick={handleUndoPlay} style={buttonStyle}>
                {t('play.undo')}
              </Button>
            );

            if (currentPlayer?.id === gameState.buryingPlayerId) {
              playingButtons.push(
                <Button key="viewBottom" onClick={handleViewMyBottomCards} style={buttonStyle}>
                  {t('play.viewBottom')}
                </Button>
              );
            }

            playingButtons.push(
              renderSelectAllButton(),
              <Button key="score-5" onClick={() => handleQuickAdjustScore(-5)} style={buttonStyle}>
                {t('adjust.minusScore')}
              </Button>,
              <Button key="score+5" onClick={() => handleQuickAdjustScore(5)} style={buttonStyle}>
                {t('adjust.plusScore5')}
              </Button>,
              <Button key="score+10" onClick={() => handleQuickAdjustScore(10)} style={buttonStyle}>
                {t('adjust.plusScore10')}
              </Button>,
              <Button key="level-1" onClick={() => handleQuickAdjustLevel(-1)} style={buttonStyle}>
                {t('adjust.minusLevel')}
              </Button>,
              <Button key="level+1" onClick={() => handleQuickAdjustLevel(1)} style={buttonStyle}>
                {t('adjust.plusLevel')}
              </Button>
            );

            if (isHost) {
              playingButtons.push(
                <Button key="restart" danger onClick={handleRestartGame} style={buttonStyle}>
                  {t('game.restartGame')}
                </Button>
              );
            }

            playingButtons.push(renderRenameButton());
            // 查看上一轮出牌按钮
            const viewLastRoundBtn = renderViewLastRoundButton();
            if (viewLastRoundBtn) playingButtons.push(viewLastRoundBtn);
            // 保存全局按钮（仅房主）
            const saveGlobalBtn = renderSaveGlobalButton();
            if (saveGlobalBtn) playingButtons.push(saveGlobalBtn);
            playingButtons.push(renderSettingsButton());
            const roomSettingsBtn = renderRoomSettingsButton();
            if (roomSettingsBtn) playingButtons.push(roomSettingsBtn);
          }

          return (
            <div className="responsive-button-grid">
              {playingButtons}
            </div>
          );
        } else {
          // 基础模式：出牌、撤回、聊天、看底牌（庄家）、重新开始（房主）、修改昵称、房间设置（房主）
          // 注：基础模式移除全选按钮
          const playingButtons = [
            <Button
              key="play"
              type="primary"
              onClick={handlePlayCards}
              disabled={!canPlay}
              style={buttonStyle}
              title={playButtonTitle}
            >
              {t('play.playCards')}({selectedCards.length})
            </Button>,
            <Button
              key="undo"
              onClick={handleUndoPlay}
              disabled={!canUndo}
              style={buttonStyle}
              title={!canUndo ? t('play.cannotUndo') : ''}
            >
              {t('play.undo')}
            </Button>,
            renderChatButton()
          ];

          // 看底牌（仅庄家）
          if (currentPlayer?.id === gameState?.buryingPlayerId) {
            playingButtons.push(
              <Button key="viewBottom" onClick={handleViewMyBottomCards} style={buttonStyle}>
                {t('play.viewBottom')}
              </Button>
            );
          }

          // 重新开始（仅房主）
          if (isHost) {
            playingButtons.push(
              <Button key="restart" onClick={handleRestartGame} style={buttonStyle}>
                {t('game.restartGame')}
              </Button>
            );
          }

          // 修改昵称
          playingButtons.push(renderRenameButton());
          // 查看上一轮出牌按钮
          const viewLastRoundBtnBasic = renderViewLastRoundButton();
          if (viewLastRoundBtnBasic) playingButtons.push(viewLastRoundBtnBasic);
          // 保存全局按钮（仅房主）
          const saveGlobalBtnBasic = renderSaveGlobalButton();
          if (saveGlobalBtnBasic) playingButtons.push(saveGlobalBtnBasic);
          playingButtons.push(renderSettingsButton());

          // 房间设置（仅房主）
          {
            const roomSettingsBtnBasic = renderRoomSettingsButton();
            if (roomSettingsBtnBasic) playingButtons.push(roomSettingsBtnBasic);
          }

          return (
            <div className="responsive-button-grid">
              {playingButtons}
            </div>
          );
        }

      case GamePhases.REVEALING:
        const revealingButtons = [
          <Button
            key="ready"
            type="primary"
            onClick={handleReadyForNext}
            disabled={isReadyForNext}
            style={buttonStyle}
          >
            {isReadyForNext ? t('common.readied') : t('play.startNextGame')}
          </Button>
        ];

        const revealingRoomSettingsBtn = renderRoomSettingsButton();
        if (revealingRoomSettingsBtn) revealingButtons.push(revealingRoomSettingsBtn);
        const revealingSaveGlobalBtn = renderSaveGlobalButton();
        if (revealingSaveGlobalBtn) revealingButtons.push(revealingSaveGlobalBtn);
        revealingButtons.push(renderSettingsButton());

        return (
          <div className="responsive-flex-buttons">
            {revealingButtons}
          </div>
        );

      case GamePhases.FINISHED:
        {
          const buttons = [];
          const roomSettingsBtnFinished = renderRoomSettingsButton();
          if (roomSettingsBtnFinished) buttons.push(roomSettingsBtnFinished);
          buttons.push(renderSettingsButton());
          if (buttons.length === 0) return null;
          return (
            <div className="responsive-flex-buttons">
              {buttons}
            </div>
          );
        }

      default:
        return null;
    }
  };

  // 渲染游戏阶段内容
  const renderPhaseContent = () => {
    const isFreeMode = currentPlayMode === PlayModes.FREE;

    switch (phase) {
      case GamePhases.WAITING:
        if (!currentRoom) {
          return <div className="phase-content"><Text>{t('game.waitingForRoom')}</Text></div>;
        }

        const isWaitingForReady = gameState?.isWaitingForReady || false;

        // 如果在准备等待阶段
        if (isWaitingForReady) {
          return (
            <div className="phase-content playing-phase">
              {/* 游戏桌面 */}
              <GameTable
                players={currentRoom.players}
                currentPlayer={currentPlayer}
                playedCards={{}}
                shownCards={{}}
                myCards={[]}
                buryingPlayerId={gameState?.buryingPlayerId}
                dealerCountdown={dealerCountdown}
                selectedCards={[]}
                onCardClick={() => {}}
                onReorder={() => {}}
                currentTurnPlayerId={null}
                trumpSuit={trumpSuit}
                trumpRank={trumpRank}
                isHost={isHost}
                onSetTrump={isFreeMode ? () => setTrumpModal(true) : undefined}
                selectedRule={selectedRule}
                onSelectRule={() => setRuleSelectorModal(true)}
                renderControls={renderControlButtons()}
                isWaitingForReady={isWaitingForReady}
                team1Level={gameState?.team1Level}
                team2Level={gameState?.team2Level}
                dealerPlayerIndex={gameState?.dealerPlayerIndex}
                onRename={handleOpenRenameModal}
                isSpectator={isSpectator}
                isFreeMode={isFreeMode}
                allowSpectatorViewHands={currentRoom?.config?.allowSpectatorViewHands}
                onViewPlayerHand={handleViewPlayerHand}
              />
            </div>
          );
        }

        // 正常的房间等待界面
        return (
          <div className="phase-content">
            <Title level={3}>{t('game.waitingToStart')}</Title>
            <Text>{t('room.players')}: {currentRoom.playerCount} / {currentRoom.maxPlayers}</Text>
            <br />
            <Text type="secondary">{t('game.bottomCards')}: {currentRoom.config?.bottomCardsCount || 8} | {t('game.dealInterval')}: {currentRoom.config?.dealInterval || 500}ms</Text>
            <br />
            <br />

            <Space direction="vertical" size="middle" style={{ width: '100%', alignItems: 'center' }}>
              {/* 房主操作按钮 */}
              {isHost && (
                <Space size="middle">
                  {currentRoom.playerCount >= 2 && (
                    <Button type="primary" size="large" onClick={handleStartGame}>
                      {t('game.startGame')}
                    </Button>
                  )}
                  <Button size="large" onClick={() => setRoomConfigModal(true)}>
                    {t('room.roomSettings')}
                  </Button>
                  <Button size="large" onClick={handleAddBot} disabled={currentRoom.playerCount >= currentRoom.maxPlayers}>
                    {t('game.addBot')}
                  </Button>
                </Space>
              )}

              {/* Bot列表 */}
              {isHost && currentRoom.players.some(p => p.isBot) && (
                <div style={{ width: '80%', maxWidth: '600px' }}>
                  <Divider>{t('game.botsInRoom')}</Divider>
                  <Space wrap>
                    {currentRoom.players.filter(p => p.isBot).map(bot => (
                      <Tag
                        key={bot.id}
                        closable
                        onClose={() => handleRemoveBot(bot.id)}
                        color="blue"
                      >
                        🤖 {bot.name}
                      </Tag>
                    ))}
                  </Space>
                </div>
              )}

              {/* 所有玩家可用按钮 */}
              <Space>
                <Button onClick={handleOpenRenameModal}>
                  {t('nickname.modifyNickname')}
                </Button>
                <Dropdown
                  menu={{
                    items: LANGUAGE_LIST.map(lang => ({
                      key: lang.key,
                      label: lang.label,
                    })),
                    onClick: ({ key }) => setLanguage(key),
                    selectedKeys: [language],
                  }}
                  trigger={['click']}
                >
                  <Button icon={<GlobalOutlined />} />
                </Dropdown>
              </Space>
            </Space>
          </div>
        );

      case GamePhases.DRAWING:
        return (
          <div className="phase-content playing-phase">
            {/* 游戏桌面 - 摸牌阶段显示展示的牌 */}
            <GameTable
              trumpDeclarationComponent={
                <TrumpDeclaration
                  availableDeclarations={availableDeclarations}
                  onDeclare={handleDeclare}
                  currentTrump={currentTrumpDeclaration}
                  suitCounts={suitCounts}
                />
              }
              currentTrumpDeclaration={currentTrumpDeclaration}
              players={currentRoom.players}
              currentPlayer={currentPlayer}
              playedCards={{}}
              shownCards={shownCards}
              myCards={myCards}
              selectedCards={selectedCards}
              onCardClick={toggleCardSelection}
              onReorder={reorderCards}
              currentTurnPlayerId={null}
              trumpSuit={trumpSuit}
              trumpRank={trumpRank}
              isHost={isHost}
              onSetTrump={isFreeMode ? () => setTrumpModal(true) : undefined}
              selectedRule={selectedRule}
              onSelectRule={() => setRuleSelectorModal(true)}
              renderControls={renderControlButtons()}
              isWaitingForReady={false}
              buryingPlayerId={gameState?.buryingPlayerId}
              dealerCountdown={dealerCountdown}
              team1Level={gameState?.team1Level}
              team2Level={gameState?.team2Level}
              dealerPlayerIndex={gameState?.dealerPlayerIndex}
              onRename={handleOpenRenameModal}
              isSpectator={isSpectator}
              isFreeMode={isFreeMode}
              allowSpectatorViewHands={currentRoom?.config?.allowSpectatorViewHands}
              onViewPlayerHand={handleViewPlayerHand}
            />
          </div>
        );

      case GamePhases.BURYING:
        return (
          <div className="phase-content playing-phase">
            {/* 游戏桌面 - 埋底阶段 */}
            <GameTable
              players={currentRoom.players}
              currentPlayer={currentPlayer}
              playedCards={{}}
              shownCards={{}}
              myCards={myCards}
              selectedCards={selectedCards}
              onCardClick={toggleCardSelection}
              onReorder={reorderCards}
              currentTurnPlayerId={null}
              trumpSuit={trumpSuit}
              trumpRank={trumpRank}
              isHost={isHost}
              onSetTrump={isFreeMode ? () => setTrumpModal(true) : undefined}
              selectedRule={selectedRule}
              onSelectRule={() => setRuleSelectorModal(true)}
              renderControls={renderControlButtons()}
              isWaitingForReady={false}
              currentTrumpDeclaration={currentTrumpDeclaration}
              buryingPlayerId={gameState?.buryingPlayerId}
              dealerCountdown={dealerCountdown}
              team1Level={gameState?.team1Level}
              team2Level={gameState?.team2Level}
              dealerPlayerIndex={gameState?.dealerPlayerIndex}
              onRename={handleOpenRenameModal}
              isSpectator={isSpectator}
              isFreeMode={isFreeMode}
              allowSpectatorViewHands={currentRoom?.config?.allowSpectatorViewHands}
              onViewPlayerHand={handleViewPlayerHand}
            />
          </div>
        );

      case GamePhases.PLAYING:
        // 获取当前轮到出牌的玩家ID
        const currentTurnPlayerId = gameState?.currentPlayerIndex !== null && gameState?.currentPlayerIndex !== undefined
          ? currentRoom.players[gameState.currentPlayerIndex]?.id
          : null;

        return (
          <div className="phase-content playing-phase">
            {/* 游戏桌面 - 出牌阶段不显示展示的牌 */}
            <GameTable
              players={currentRoom.players}
              currentPlayer={currentPlayer}
              playedCards={playedCards}
              shownCards={{}}
              myCards={myCards}
              selectedCards={selectedCards}
              onCardClick={toggleCardSelection}
              onReorder={reorderCards}
              currentTurnPlayerId={currentTurnPlayerId}
              trumpSuit={trumpSuit}
              trumpRank={trumpRank}
              isHost={isHost}
              onSetTrump={isFreeMode ? () => setTrumpModal(true) : undefined}
              selectedRule={selectedRule}
              onSelectRule={() => setRuleSelectorModal(true)}
              renderControls={renderControlButtons()}
              isWaitingForReady={false}
              currentTrumpDeclaration={currentTrumpDeclaration}
              buryingPlayerId={gameState?.buryingPlayerId}
              dealerCountdown={dealerCountdown}
              attackerScore={attackerScore}
              collectedPointCards={collectedPointCards}
              team1Level={gameState?.team1Level}
              team2Level={gameState?.team2Level}
              dealerPlayerIndex={gameState?.dealerPlayerIndex}
              onRename={handleOpenRenameModal}
              isSpectator={isSpectator}
              isFreeMode={isFreeMode}
              allowSpectatorViewHands={currentRoom?.config?.allowSpectatorViewHands}
              onViewPlayerHand={handleViewPlayerHand}
            />
          </div>
        );

      case GamePhases.REVEALING:
        // 揭示底牌阶段不需要高亮边框，传递 null
        // 清空所有人出的牌，避免遮挡底牌展示
        return (
          <div className="phase-content playing-phase">
            {/* 游戏桌面 - 展示底牌，清空出牌区域 */}
            <GameTable
              players={currentRoom.players}
              currentPlayer={currentPlayer}
              playedCards={{}}
              shownCards={{}}
              myCards={myCards}
              selectedCards={selectedCards}
              onCardClick={toggleCardSelection}
              onReorder={reorderCards}
              currentTurnPlayerId={null}
              trumpSuit={trumpSuit}
              trumpRank={trumpRank}
              isHost={isHost}
              onSetTrump={isFreeMode ? () => setTrumpModal(true) : undefined}
              revealedBottomCards={revealedBottomCards}
              selectedRule={selectedRule}
              onSelectRule={() => setRuleSelectorModal(true)}
              renderControls={renderControlButtons()}
              isWaitingForReady={false}
              currentTrumpDeclaration={currentTrumpDeclaration}
              buryingPlayerId={gameState?.buryingPlayerId}
              dealerCountdown={dealerCountdown}
              attackerScore={attackerScore}
              collectedPointCards={collectedPointCards}
              bottomScoreResult={bottomScoreResult}
              upgradeResult={upgradeResult}
              team1Level={gameState?.team1Level}
              team2Level={gameState?.team2Level}
              dealerPlayerIndex={gameState?.dealerPlayerIndex}
              isRevealingPhase={true}
              isSpectator={isSpectator}
              isFreeMode={isFreeMode}
              allowSpectatorViewHands={currentRoom?.config?.allowSpectatorViewHands}
              onViewPlayerHand={handleViewPlayerHand}
            />
          </div>
        );

      case GamePhases.FINISHED:
        // 游戏结束阶段不需要高亮边框，传递 null
        return (
          <div className="phase-content playing-phase">
            {/* 游戏桌面 - 游戏结束，保留所有人的出牌和底牌 */}
            <GameTable
              players={currentRoom.players}
              currentPlayer={currentPlayer}
              playedCards={playedCards}
              shownCards={{}}
              myCards={myCards}
              selectedCards={selectedCards}
              onCardClick={toggleCardSelection}
              onReorder={reorderCards}
              currentTurnPlayerId={null}
              trumpSuit={trumpSuit}
              trumpRank={trumpRank}
              isHost={isHost}
              onSetTrump={isFreeMode ? () => setTrumpModal(true) : undefined}
              revealedBottomCards={revealedBottomCards}
              selectedRule={selectedRule}
              onSelectRule={() => setRuleSelectorModal(true)}
              renderControls={renderControlButtons()}
              isWaitingForReady={false}
              currentTrumpDeclaration={currentTrumpDeclaration}
              buryingPlayerId={gameState?.buryingPlayerId}
              dealerCountdown={dealerCountdown}
              attackerScore={attackerScore}
              collectedPointCards={collectedPointCards}
              bottomScoreResult={bottomScoreResult}
              upgradeResult={upgradeResult}
              team1Level={gameState?.team1Level}
              team2Level={gameState?.team2Level}
              dealerPlayerIndex={gameState?.dealerPlayerIndex}
              onRename={handleOpenRenameModal}
              isSpectator={isSpectator}
              isFreeMode={isFreeMode}
              allowSpectatorViewHands={currentRoom?.config?.allowSpectatorViewHands}
              onViewPlayerHand={handleViewPlayerHand}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="game-board">
      {contextHolder}

      {/* 观战模式提示 */}
      {isSpectator && (
        <Alert
          message={t('spectator.spectatorMode')}
          description={t('spectator.spectatorModeHint')}
          type="info"
          showIcon
          icon={<EyeOutlined />}
          style={{
            position: 'fixed',
            top: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1001,
            maxWidth: '400px'
          }}
          closable
        />
      )}

      {/* 毙牌动画 */}
      {trumpAnimation && (
        <div
          className="trump-animation-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            pointerEvents: 'none',
            zIndex: 1000
          }}
        >
          <div
            className={`trump-animation ${trumpAnimation.type}`}
            style={{
              fontSize: trumpAnimation.type === 'overtrump' ? '72px' : '64px',
              fontWeight: 'bold',
              color: trumpAnimation.type === 'overtrump' ? '#ff4757' : '#ffa502',
              textShadow: trumpAnimation.type === 'overtrump'
                ? '0 0 20px #ff4757, 0 0 40px #ff4757, 0 0 60px #ff6b81'
                : '0 0 20px #ffa502, 0 0 40px #ffa502, 0 0 60px #eccc68',
              animation: 'trumpPop 0.5s ease-out forwards',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>{trumpAnimation.type === 'overtrump' ? t('trump.overTrumpAction') : t('trump.trumpAction')}</span>
            <span style={{ fontSize: '24px', opacity: 0.8 }}>{trumpAnimation.playerName}</span>
          </div>
        </div>
      )}

      {/* 主游戏区域 */}
      <div className="main-game-area">
        {renderPhaseContent()}
      </div>

      {/* 埋底玩家选择弹窗 */}
      <Modal
        title={t('play.selectBuryingPlayer')}
        open={buryingPlayerModal}
        onOk={handleSetBuryingPlayer}
        onCancel={() => setBuryingPlayerModal(false)}
      >
        <Select
          style={{ width: '100%' }}
          placeholder={t('play.selectPlayerFirst')}
          onChange={setSelectedBuryingPlayer}
        >
          {currentRoom.players.map(player => (
            <Select.Option key={player.id} value={player.id}>
              {player.name}
            </Select.Option>
          ))}
        </Select>
      </Modal>

      {/* 首发玩家选择弹窗 */}
      <Modal
        title={t('play.selectPlayerFirst')}
        open={firstPlayerModal}
        onOk={handleSetFirstPlayer}
        onCancel={() => setFirstPlayerModal(false)}
      >
        <Select
          style={{ width: '100%' }}
          placeholder={t('play.selectPlayerFirst')}
          onChange={setSelectedFirstPlayer}
        >
          {currentRoom.players.map(player => (
            <Select.Option key={player.id} value={player.id}>
              {player.name}
            </Select.Option>
          ))}
        </Select>
      </Modal>

      {/* 调整分数弹窗 */}
      <Modal
        title={t('adjust.adjustScore')}
        open={scoreAdjustModal}
        onOk={handleUpdateScore}
        onCancel={() => setScoreAdjustModal(false)}
      >
        <Select
          style={{ width: '100%', marginBottom: 16 }}
          placeholder={t('play.selectPlayerFirst')}
          onChange={setSelectedPlayerId}
        >
          {currentRoom.players.map(player => (
            <Select.Option key={player.id} value={player.id}>
              {player.name} ({t('adjust.currentScore', { score: player.score })})
            </Select.Option>
          ))}
        </Select>
        <InputNumber
          style={{ width: '100%' }}
          placeholder={t('adjust.newScore')}
          value={adjustValue}
          onChange={setAdjustValue}
        />
      </Modal>

      {/* 调整等级弹窗 */}
      <Modal
        title={t('adjust.adjustLevel')}
        open={levelAdjustModal}
        onOk={handleUpdateLevel}
        onCancel={() => setLevelAdjustModal(false)}
      >
        <Select
          style={{ width: '100%', marginBottom: 16 }}
          placeholder={t('play.selectPlayerFirst')}
          onChange={setSelectedPlayerId}
        >
          {currentRoom.players.map(player => (
            <Select.Option key={player.id} value={player.id}>
              {player.name} ({t('adjust.currentLevel', { level: player.level })})
            </Select.Option>
          ))}
        </Select>
        <InputNumber
          style={{ width: '100%' }}
          placeholder={t('adjust.newLevel')}
          min={2}
          max={14}
          value={adjustValue}
          onChange={setAdjustValue}
        />
      </Modal>

      {/* 查看我的底牌弹窗 */}
      <Modal
        title={t('bottom.myBottomCards')}
        open={viewBottomModal}
        onOk={() => setViewBottomModal(false)}
        onCancel={() => setViewBottomModal(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setViewBottomModal(false)}>
            {t('common.close')}
          </Button>
        ]}
      >
        <div style={{ textAlign: 'center' }}>
          <Text>{t('bottom.buriedCards', { count: myBottomCards.length })}</Text>
          <br />
          <br />
          {myBottomCards.length > 0 && (
            <Hand cards={myBottomCards} disabled small trumpSuit={trumpSuit} trumpRank={trumpRank} />
          )}
        </div>
      </Modal>

      {/* 查看上一轮出牌弹窗 */}
      <Modal
        title={t('play.lastRoundTitle')}
        open={viewLastRoundModal}
        onOk={() => setViewLastRoundModal(false)}
        onCancel={() => setViewLastRoundModal(false)}
        width={700}
        footer={[
          <Button key="close" type="primary" onClick={() => setViewLastRoundModal(false)}>
            {t('common.close')}
          </Button>
        ]}
      >
        <div style={{ textAlign: 'center' }}>
          {lastRoundWinner && (
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ fontSize: '16px', color: '#52c41a' }}>
                {t('play.lastRoundWinner', { name: lastRoundWinner.playerName })}
              </Text>
            </div>
          )}
          {Object.keys(lastRoundCards).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
              {Object.entries(lastRoundCards).map(([playerId, { playerName, cards }]) => (
                <div key={playerId} style={{
                  padding: '12px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '8px',
                  width: '100%'
                }}>
                  <Text strong style={{ display: 'block', marginBottom: '8px' }}>
                    {playerName}:
                  </Text>
                  {cards && cards.length > 0 ? (
                    <Hand cards={cards} disabled small trumpSuit={trumpSuit} trumpRank={trumpRank} />
                  ) : (
                    <Text type="secondary">{t('common.none')}</Text>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Text type="secondary">{t('play.noLastRound')}</Text>
          )}
        </div>
      </Modal>

      {/* 观战者查看手牌弹窗 */}
      <Modal
        title={t('spectator.viewHandTitle', { name: spectatorViewedHand.playerName })}
        open={spectatorViewHandModal}
        onOk={() => setSpectatorViewHandModal(false)}
        onCancel={() => setSpectatorViewHandModal(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setSpectatorViewHandModal(false)}>
            {t('common.close')}
          </Button>
        ]}
      >
        <div style={{ textAlign: 'center' }}>
          {spectatorViewedHand.cards && spectatorViewedHand.cards.length > 0 ? (
            <Hand cards={spectatorViewedHand.cards} disabled trumpSuit={trumpSuit} trumpRank={trumpRank} />
          ) : (
            <Text type="secondary">{t('common.none')}</Text>
          )}
        </div>
      </Modal>

      {/* 设置主牌弹窗 */}
      <Modal
        title={t('trump.trump')}
        open={trumpModal}
        onCancel={() => setTrumpModal(false)}
        footer={null}
      >
        <div>
          <Text strong>{t('trump.suit')}:</Text>
          <br />
          <Space wrap style={{ marginTop: 8, marginBottom: 16 }}>
            <Button onClick={() => handleSetTrump('hearts', trumpRank || '2')}>♥ {t('trump.hearts')}</Button>
            <Button onClick={() => handleSetTrump('diamonds', trumpRank || '2')}>♦ {t('trump.diamonds')}</Button>
            <Button onClick={() => handleSetTrump('clubs', trumpRank || '2')}>♣ {t('trump.clubs')}</Button>
            <Button onClick={() => handleSetTrump('spades', trumpRank || '2')}>♠ {t('trump.spades')}</Button>
            <Button onClick={() => handleSetTrump('no_trump', trumpRank || '2')}>{t('trump.noTrump')}</Button>
          </Space>
          <br />
          <Text strong>{t('trump.rank')}:</Text>
          <br />
          <Space wrap style={{ marginTop: 8 }}>
            {['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'].map(rank => (
              <Button key={rank} onClick={() => handleSetTrump(trumpSuit || 'hearts', rank)}>
                {rank}
              </Button>
            ))}
          </Space>
        </div>
      </Modal>

      {/* 房间设置弹窗 */}
      <Modal
        title={t('room.roomSettings')}
        open={roomConfigModal}
        onOk={handleUpdateRoomConfig}
        onCancel={() => setRoomConfigModal(false)}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
      >
        <div>
          <Text strong>{t('createRoomForm.bottomCardsLabel')}:</Text>
          <br />
          <InputNumber
            style={{ width: '100%', marginTop: 8, marginBottom: 16 }}
            min={1}
            max={20}
            value={newBottomCardsCount}
            onChange={setNewBottomCardsCount}
          />
          <br />
          <Text strong>{t('createRoomForm.dealIntervalLabel')}:</Text>
          <br />
          <InputNumber
            style={{ width: '100%', marginTop: 8, marginBottom: 16 }}
            min={10}
            max={5000}
            step={100}
            value={newDealInterval}
            onChange={setNewDealInterval}
          />
          <br />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text strong>{t('createRoomForm.freeMode')}:</Text>
            <Switch
              checked={newPlayMode === PlayModes.FREE}
              onChange={(checked) => setNewPlayMode(checked ? PlayModes.FREE : PlayModes.ORDERED)}
              checkedChildren={t('createRoomForm.freeModeOn')}
              unCheckedChildren={t('createRoomForm.freeModeOff')}
            />
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('createRoomForm.freeModeDesc')}<br />
            {t('createRoomForm.basicModeDesc')}
          </Text>
          <br />
          <br />
          <Text strong>{t('createRoomForm.botTypeLabel')}:</Text>
          <br />
          <Select
            style={{ width: '100%', marginTop: 8, marginBottom: 8 }}
            value={newBotType}
            onChange={setNewBotType}
          >
            <Select.Option value={BotTypes.SIMPLE}>{t('botType.simple')}</Select.Option>
            <Select.Option value={BotTypes.WHO_DESIGNED}>{t('botType.whoDesigned')}</Select.Option>
          </Select>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('createRoomForm.botTypeDesc')}
          </Text>
          <br />
          <br />
          <Divider style={{ margin: '12px 0' }}>{t('spectator.spectatorMode')}</Divider>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text strong>{t('spectator.allowSpectators')}:</Text>
            <Switch
              checked={newAllowSpectators}
              onChange={setNewAllowSpectators}
              checkedChildren={t('createRoomForm.freeModeOn')}
              unCheckedChildren={t('createRoomForm.freeModeOff')}
            />
          </div>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
            {t('spectator.spectatorSettingsDesc')}
          </Text>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text strong>{t('spectator.allowSpectatorViewHands')}:</Text>
            <Switch
              checked={newAllowSpectatorViewHands}
              onChange={setNewAllowSpectatorViewHands}
              disabled={!newAllowSpectators}
              checkedChildren={t('createRoomForm.freeModeOn')}
              unCheckedChildren={t('createRoomForm.freeModeOff')}
            />
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('spectator.viewHandsSettingsDesc')}
          </Text>
          <br />
          <br />
          <Text type="secondary">{t('createRoomForm.settingsEffectNote')}</Text>
        </div>
      </Modal>

      {/* 修改昵称弹窗 */}
      <Modal
        title={t('nickname.modifyNickname')}
        open={renameModal}
        onOk={handleUpdatePlayerName}
        onCancel={() => {
          setRenameModal(false);
          setNewPlayerName('');
        }}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
      >
        <div>
          <Text strong>{t('nickname.newNickname')}</Text>
          <br />
          <Input
            style={{ width: '100%', marginTop: 8 }}
            placeholder={t('nickname.nicknamePlaceholder')}
            maxLength={20}
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
            onPressEnter={handleUpdatePlayerName}
          />
        </div>
      </Modal>

      {/* 聊天弹窗 */}
      <Modal
        title={t('chat.chat')}
        open={chatModal}
        onCancel={() => setChatModal(false)}
        footer={null}
        width={500}
      >
        <div>
          {/* 聊天历史 */}
          <div style={{
            maxHeight: '200px',
            overflowY: 'auto',
            marginBottom: 12,
            border: '1px solid #d9d9d9',
            borderRadius: 4,
            padding: 8
          }}>
            {chatHistory.length === 0 ? (
              <Text type="secondary">{t('chat.noChatHistory')}</Text>
            ) : (
              chatHistory.map((chat, idx) => (
                <div key={idx} style={{ marginBottom: 8 }}>
                  <Text strong>{chat.playerName}: </Text>
                  <Text>{chat.message}</Text>
                </div>
              ))
            )}
          </div>

          <Divider style={{ margin: '12px 0' }}>{t('chat.quickPhrases')}</Divider>

          {/* 快捷短语按钮 */}
          <Space wrap style={{ marginBottom: 12 }}>
            {quickPhrases.map((phrase, idx) => (
              <Button
                key={idx}
                onClick={() => handleSendChatMessage(phrase)}
                size="small"
              >
                {phrase}
              </Button>
            ))}
            <Button
              size="small"
              type="dashed"
              onClick={() => setQuickPhraseModal(true)}
            >
              {t('chat.manageQuickPhrases')}
            </Button>
          </Space>

          <Divider style={{ margin: '12px 0' }}>{t('chat.sendMessage')}</Divider>

          {/* 消息输入 */}
          <Input.TextArea
            placeholder={t('chat.messagePlaceholder')}
            maxLength={200}
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSendChatMessage();
              }
            }}
            rows={3}
          />

          {/* Emoji 选择器 */}
          <div style={{ marginTop: 8, marginBottom: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>{t('chat.commonEmojis')}</Text>
            <div style={{ marginTop: 4 }}>
              <Space wrap>
                {['😀', '😃', '😄', '😁', '😊', '😂', '🤣', '😍', '🥰', '😘', '😎', '🤔', '😮', '😢', '😭', '😡', '👍', '👎', '👏', '🙏', '💪', '🎉', '🎊', '❤️', '💯', '🔥', '✨', '⭐', '🌟', '💎'].map((emoji, idx) => (
                  <Button
                    key={idx}
                    size="small"
                    onClick={() => setChatMessage(prev => prev + emoji)}
                    style={{ padding: '0 8px', minWidth: 32 }}
                  >
                    {emoji}
                  </Button>
                ))}
              </Space>
            </div>
          </div>

          <div style={{ marginTop: 8, textAlign: 'right' }}>
            <Button type="primary" onClick={() => handleSendChatMessage()}>
              {t('common.send')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 快捷短语管理弹窗 */}
      <Modal
        title={t('chat.manageQuickPhrases')}
        open={quickPhraseModal}
        onCancel={() => {
          setQuickPhraseModal(false);
          setNewQuickPhrase('');
        }}
        footer={null}
      >
        <div>
          {/* 现有快捷短语 */}
          <div style={{ marginBottom: 12 }}>
            <Text strong>{t('chat.existingPhrases')}</Text>
            <div style={{ marginTop: 8 }}>
              {quickPhrases.length === 0 ? (
                <Text type="secondary">{t('chat.noQuickPhrases')}</Text>
              ) : (
                quickPhrases.map((phrase, idx) => (
                  <Tag
                    key={idx}
                    closable
                    onClose={() => handleDeleteQuickPhrase(phrase)}
                    style={{ marginBottom: 8 }}
                  >
                    {phrase}
                  </Tag>
                ))
              )}
            </div>
          </div>

          <Divider style={{ margin: '12px 0' }}>{t('chat.addNewPhrase')}</Divider>

          {/* 添加新快捷短语 */}
          <Input
            placeholder={t('chat.newPhrasePlaceholder')}
            maxLength={50}
            value={newQuickPhrase}
            onChange={(e) => setNewQuickPhrase(e.target.value)}
            onPressEnter={handleAddQuickPhrase}
          />
          <div style={{ marginTop: 8, textAlign: 'right' }}>
            <Button type="primary" onClick={handleAddQuickPhrase}>
              {t('common.add')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 规则选择器弹窗 */}
      <RuleSelector
        visible={ruleSelectorModal}
        onClose={() => setRuleSelectorModal(false)}
        onRuleSelected={handleRuleSelected}
      />

      {/* 个人设置弹窗 */}
      <Modal
        title={t('settings.settings')}
        open={settingsModal}
        onCancel={() => setSettingsModal(false)}
        footer={null}
      >
        <div>
          {/* 语言设置 */}
          <div style={{ marginBottom: 16 }}>
            <Text strong>{t('settings.language')}</Text>
            <br />
            <Select
              style={{ width: '100%', marginTop: 8 }}
              value={language}
              onChange={setLanguage}
            >
              {LANGUAGE_LIST.map(lang => (
                <Select.Option key={lang.key} value={lang.key}>
                  {lang.label}
                </Select.Option>
              ))}
            </Select>
          </div>

          <Divider />

          {/* 隐藏提示设置 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Text strong>{t('settings.hideNotifications')}</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('settings.hideNotificationsDesc')}
              </Text>
            </div>
            <Switch
              checked={hideNotifications}
              onChange={setHideNotifications}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
