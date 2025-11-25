import { useState, useEffect } from 'react';
import { Button, Space, Typography, Modal, Select, InputNumber, Input, message, Divider, Tag, Switch } from 'antd';
import { useGameStore } from '../../store/gameStore';
import socketService from '../../services/socket';
import { SOCKET_EVENTS, GamePhases, PlayModes } from '../../utils/constants';
import { detectAvailableDeclarations } from '../../utils/trumpUtils';
import { validateLeadingPlay, validateFollowingPlay } from '../../utils/cardPatternUtils';
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

  const [messageApi, contextHolder] = message.useMessage();
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
  const [newDealInterval, setNewDealInterval] = useState(500); // 新的发牌间隔
  const [newPlayMode, setNewPlayMode] = useState(PlayModes.ORDERED); // 新的出牌模式
  const [renameModal, setRenameModal] = useState(false); // 修改昵称弹窗
  const [newPlayerName, setNewPlayerName] = useState(''); // 新昵称
  const [chatModal, setChatModal] = useState(false); // 聊天弹窗
  const [chatMessage, setChatMessage] = useState(''); // 当前输入的聊天消息
  const [chatHistory, setChatHistory] = useState([]); // 聊天历史
  const [quickPhrases, setQuickPhrases] = useState(() => {
    // 从localStorage加载快捷短语
    const saved = localStorage.getItem('tractorQuickPhrases');
    return saved ? JSON.parse(saved) : ['快点出牌！', '好牌！', '加油！'];
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

  // 监听游戏事件
  useEffect(() => {
    if (!socket) return;

    // 游戏开始
    socket.on('game_started', ({ gameState }) => {
      messageApi.success('游戏开始！');
      setShownCards({}); // 清空展示的牌
    });

    // 游戏重新开始
    socket.on('game_restarted', () => {
      messageApi.success('游戏重新开始！');
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
    });

    // 收到手牌
    socket.on('card_dealt', ({ card }) => {
      addCard(card);
    });

    // 玩家展示手牌
    socket.on('cards_shown', ({ playerId, playerName, cards }) => {
      messageApi.info(`${playerName} 展示了 ${cards.length} 张牌`);
      // 更新该玩家的展示牌区域（覆盖之前的牌）
      setShownCards(prev => ({
        ...prev,
        [playerId]: { playerName, cards }
      }));
    });

    // 收到底牌（埋底玩家）
    socket.on('bottom_cards_received', ({ bottomCards, totalCards }) => {
      bottomCards.forEach(card => addCard(card));
      messageApi.success(`收到 ${bottomCards.length} 张底牌，当前共 ${totalCards} 张牌`);
    });

    // 埋底玩家设置
    socket.on('burying_player_set', ({ playerName }) => {
      messageApi.info(`${playerName} 被指定为埋底玩家`);
    });

    // 埋底完成
    socket.on('cards_buried', ({ playerName, playerId }) => {
      messageApi.success(`${playerName} 完成埋底`);
      // 如果是我自己埋的底，清空我的底牌缓存（已经埋了）
      if (playerId === currentPlayer?.id) {
        // 底牌已经保存在后端，前端不需要再显示
      }
    });

    // 首发玩家设置
    socket.on('first_player_set', ({ playerName }) => {
      messageApi.info(`${playerName} 先出牌`);
    });

    // 玩家出牌
    socket.on('cards_played', ({ playerId, playerName, cards }) => {
      console.log('收到 cards_played 事件:', { playerId, playerName, cardsCount: cards.length });
      messageApi.info(`${playerName} 出了 ${cards.length} 张牌`);
      // 更新该玩家的出牌区域（覆盖之前的牌）
      setPlayedCards(prev => {
        const updated = {
          ...prev,
          [playerId]: { playerName, cards }
        };
        console.log('更新后的 playedCards:', Object.keys(updated));
        return updated;
      });
      // 添加到出牌历史
      setPlayHistory(prev => [...prev, { playerId, playerName, timestamp: Date.now() }]);
    });

    // 玩家跳过
    socket.on('turn_passed', ({ playerName }) => {
      messageApi.info(`${playerName} 跳过了回合`);
    });

    // 展示底牌（修正事件名）
    socket.on('bottom_revealed', ({ bottomCards, bottomScoreResult, upgradeResult }) => {
      messageApi.info(`底牌已展示: ${bottomCards.length} 张`);
      setRevealedBottomCards(bottomCards);
      if (bottomScoreResult) {
        setBottomScoreResult(bottomScoreResult);
        setAttackerScore(bottomScoreResult.totalScore);
        setCollectedPointCards(bottomScoreResult.collectedPointCards || []);
        // 显示底牌得分结果
        const resultMsg = bottomScoreResult.attackerWonBottom
          ? `闲家拿底！底牌${bottomScoreResult.bottomPoints}分×${bottomScoreResult.bottomMultiplier}倍=${bottomScoreResult.bottomScoreGained}分，闲家总分：${bottomScoreResult.totalScore}分`
          : `庄家守底！闲家总分：${bottomScoreResult.totalScore}分`;
        messageApi.success(resultMsg, 5);
      }
      if (upgradeResult) {
        setUpgradeResult(upgradeResult);
        // 显示升级结果
        const winnerMsg = upgradeResult.attackerWon ? '闲家获胜' : '庄家获胜';
        const upgradeMsg = upgradeResult.attackerWon
          ? `闲家升${upgradeResult.attackerLevelUp}级`
          : `庄家升${upgradeResult.dealerLevelUp}级`;
        messageApi.success(`${winnerMsg}！${upgradeMsg}`, 5);
      }
    });

    // 收到我的底牌
    socket.on('my_bottom_cards', ({ bottomCards }) => {
      setMyBottomCards(bottomCards);
      setViewBottomModal(true);
    });

    // 玩家准备下一局
    socket.on('player_ready_for_next', ({ playerName, readyCount, totalCount }) => {
      messageApi.info(`${playerName} 已准备 (${readyCount}/${totalCount})`);
    });

    // 下一局开始
    socket.on('next_game_started', () => {
      messageApi.success('开始下一局！');
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
      // 主牌信息会通过房间状态同步的useEffect自动更新
    });

    // 分数更新
    socket.on('score_updated', ({ playerId, newScore }) => {
      messageApi.success('分数已更新');
    });

    // 等级更新
    socket.on('level_updated', ({ playerId, newLevel }) => {
      messageApi.success('等级已更新');
    });

    // 撤回出牌
    socket.on('play_undone', ({ playerId, playerName, cards }) => {
      console.log('收到 play_undone 事件:', { playerId, playerName, cardsCount: cards.length });
      messageApi.info(`${playerName} 撤回了出牌`);
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
        messageApi.info(`主牌已设置: ${trumpSuit} ${trumpRank}`);
      } else if (trumpRank) {
        console.log(`📢 级牌已设置: ${trumpRank}`);
      }
    });

    // 甩牌失败
    socket.on('throw_failed', ({ playerId, playerName, message: msg, attemptedCards, attemptedCardObjects, forcedCards }) => {
      messageApi.warning(`${playerName} ${msg}，实际出牌 ${forcedCards.length} 张`, 3);

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
      const actionText = type === 'trump' ? '毙了' : '盖毙';
      messageApi.success(`${playerName} ${actionText}！`, 2);
      // 设置动画
      setTrumpAnimation({ type, playerName });
      // 3秒后清除动画
      setTimeout(() => {
        setTrumpAnimation(null);
      }, 3000);
    });

    // 亮主成功
    socket.on('trump_declared', ({ playerId, playerName, suit, count, declarationType, strength, isCounter, cards }) => {
      const action = isCounter ? '反主' : '亮主';
      const suitMap = {
        'spades': '♠',
        'hearts': '♥',
        'clubs': '♣',
        'diamonds': '♦',
        'joker': '王'
      };
      const suitSymbol = suitMap[suit] || suit;

      console.log(`🎺 ${action}成功: ${playerName} ${action}了 ${count} 张 ${suitSymbol}`);
      messageApi.success(`${playerName} ${action}: ${count === 2 ? '一对' : '单张'}${suitSymbol}`);

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
      messageApi.success('房间设置已更新，将在下一局游戏生效');
      setNewBottomCardsCount(config.bottomCardsCount);
      setNewDealInterval(config.dealInterval);
    });

    // 玩家昵称更新
    socket.on('player_name_updated', ({ playerId, oldName, newName }) => {
      if (playerId === currentPlayer?.id) {
        messageApi.success(`昵称已修改为: ${newName}`);
      } else {
        messageApi.info(`${oldName} 修改昵称为: ${newName}`);
      }
    });

    // 接收聊天消息
    socket.on('chat_message_received', ({ playerName, message, timestamp }) => {
      setChatHistory(prev => [...prev, { playerName, message, timestamp }]);
      messageApi.info(`${playerName}: ${message}`);
    });

    // Bot添加
    socket.on('bot_added', ({ player }) => {
      messageApi.success(`Bot ${player.name} 已加入房间`);
    });

    // Bot移除
    socket.on('bot_removed', ({ playerName }) => {
      messageApi.info(`Bot ${playerName} 已离开房间`);
    });

    // 玩家准备状态更新
    socket.on('player_ready_status', ({ playerName, isReady }) => {
      messageApi.info(`${playerName} ${isReady ? '已准备' : '取消准备'}`);
    });

    // 所有玩家准备完毕
    socket.on('all_players_ready', ({ message }) => {
      messageApi.success(message);
    });

    // 规则选择
    socket.on('rule_selected', ({ playerName, rule }) => {
      setSelectedRule(rule);
      messageApi.info(`${playerName} 选择了规则: ${rule.name}`);
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
          messageApi.info(`现在轮到 ${currentPlayer.name} 出牌`);
        }
      } else if (roundUpdate.type === 'round_started') {
        messageApi.success(roundUpdate.message || `轮次 ${roundUpdate.round} 开始`);
        // 新一轮开始，清空出牌历史（因为是新的一轮，之前的牌不能再撤回）
        setPlayHistory([]);
        // 同时清空已出牌显示
        setPlayedCards({});
      } else if (roundUpdate.type === 'round_ended') {
        // 轮次结束，显示获胜者信息
        if (roundUpdate.roundWinner) {
          messageApi.success(`第${roundUpdate.round}轮结束，${roundUpdate.roundWinner.playerName} 获胜，获得下一轮出牌权`);
        }
        // 处理得分信息
        if (roundUpdate.scoreInfo) {
          const { roundPoints, winnerIsAttacker, attackerScore: newScore, collectedPointCards: newCards } = roundUpdate.scoreInfo;
          if (winnerIsAttacker && roundPoints > 0) {
            messageApi.info(`闲家得${roundPoints}分，总分：${newScore}分`, 3);
          }
          setAttackerScore(newScore);
          setCollectedPointCards(newCards || []);
        }
        // 清空出牌历史和显示，准备下一轮
        setPlayHistory([]);
        setPlayedCards({});
      }
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
      messageApi.warning('请先选择要展示的牌');
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
      messageApi.error('无效的花色');
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
      messageApi.warning('没有手牌可选择');
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
      messageApi.warning('请选择埋底玩家');
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
      messageApi.warning(`请选择 ${currentRoom.config.bottomCardsCount} 张牌进行埋底`);
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
      messageApi.warning('请选择首发玩家');
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
      messageApi.warning('请先选择要出的牌');
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
      messageApi.warning('请选择玩家');
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
      messageApi.warning('请选择玩家');
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
      messageApi.warning('底牌数量必须在1-20之间');
      return;
    }
    if (newDealInterval < 10 || newDealInterval > 5000) {
      messageApi.warning('发牌间隔必须在10-5000毫秒之间');
      return;
    }
    socket.emit(SOCKET_EVENTS.UPDATE_CONFIG, {
      roomId: currentRoom.id,
      config: {
        bottomCardsCount: newBottomCardsCount,
        dealInterval: newDealInterval,
        playMode: newPlayMode
      }
    });
    setRoomConfigModal(false);
  };

  // 修改玩家昵称
  const handleUpdatePlayerName = () => {
    const trimmedName = newPlayerName.trim();
    if (!trimmedName) {
      messageApi.warning('昵称不能为空');
      return;
    }
    if (trimmedName.length > 20) {
      messageApi.warning('昵称长度不能超过20个字符');
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
      messageApi.warning('消息不能为空');
      return;
    }
    if (messageToSend.length > 200) {
      messageApi.warning('消息长度不能超过200个字符');
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
      messageApi.warning('快捷短语不能为空');
      return;
    }
    if (trimmed.length > 50) {
      messageApi.warning('快捷短语长度不能超过50个字符');
      return;
    }
    if (quickPhrases.includes(trimmed)) {
      messageApi.warning('该快捷短语已存在');
      return;
    }
    const newPhrases = [...quickPhrases, trimmed];
    setQuickPhrases(newPhrases);
    localStorage.setItem('tractorQuickPhrases', JSON.stringify(newPhrases));
    setNewQuickPhrase('');
    messageApi.success('快捷短语已添加');
  };

  // 删除快捷短语
  const handleDeleteQuickPhrase = (phrase) => {
    const newPhrases = quickPhrases.filter(p => p !== phrase);
    setQuickPhrases(newPhrases);
    localStorage.setItem('tractorQuickPhrases', JSON.stringify(newPhrases));
    messageApi.success('快捷短语已删除');
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

  const isBuryingPlayer = gameState?.buryingPlayerId === currentPlayer?.id;
  const currentPlayMode = gameState?.playMode || currentRoom?.config?.playMode || PlayModes.ORDERED;

  // 渲染控制按钮区域
  const renderControlButtons = () => {
    const buttonStyle = { width: '100px', fontSize: '13px' };
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
                {currentPlayer?.isReady ? '取消准备' : '准备'}
              </Button>
            );
          }

          return (
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
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
              展示牌({selectedCards.length})
            </Button>,
            <Button
              key="selectAll"
              onClick={handleSelectAllCards}
              disabled={myCards.length === 0}
              style={buttonStyle}
            >
              全选
            </Button>
          ];

          if (isHost) {
            drawingButtons.push(
              <Button
                key="setBurying"
                type="primary"
                onClick={() => setBuryingPlayerModal(true)}
                style={buttonStyle}
              >
                指定埋底
              </Button>
            );
          }

          drawingButtons.push(
            <Button key="rename" onClick={handleOpenRenameModal} style={buttonStyle}>
              改昵称
            </Button>
          );

          if (isHost) {
            drawingButtons.push(
              <Button key="settings" onClick={() => setRoomConfigModal(true)} style={buttonStyle}>
                房间设置
              </Button>
            );
          }

          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', width: '100%' }}>
              {drawingButtons}
            </div>
          );
        } else {
          // 基础模式：只保留全选和房间设置（房主）
          const drawingButtons = [
            <Button
              key="selectAll"
              onClick={handleSelectAllCards}
              disabled={myCards.length === 0}
              style={buttonStyle}
            >
              全选
            </Button>
          ];

          if (isHost) {
            drawingButtons.push(
              <Button key="settings" onClick={() => setRoomConfigModal(true)} style={buttonStyle}>
                房间设置
              </Button>
            );
          }

          return (
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
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
              style={{ ...buttonStyle, width: '150px' }}
            >
              埋底({selectedCards.length}/{currentRoom.config.bottomCardsCount})
            </Button>
          );
        } else {
          buryingButtons.push(
            <Button key="waiting" disabled style={{ ...buttonStyle, width: '150px' }}>
              等待庄家埋底
            </Button>
          );
        }

        if (isHost) {
          buryingButtons.push(
            <Button key="settings" onClick={() => setRoomConfigModal(true)} style={buttonStyle}>
              房间设置
            </Button>
          );
        }

        return (
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
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
            return { valid: false, message: '请选择要出的牌' };
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
        const playButtonTitle = !isMyTurn ? '还没轮到你出牌' :
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
                出牌({selectedCards.length})
              </Button>,
              <Button key="chat" onClick={() => setChatModal(true)} style={buttonStyle}>
                聊天
              </Button>,
              <Button key="undo" onClick={handleUndoPlay} style={buttonStyle}>
                撤回
              </Button>
            );

            if (currentPlayer?.id === gameState.buryingPlayerId) {
              playingButtons.push(
                <Button key="viewBottom" onClick={handleViewMyBottomCards} style={buttonStyle}>
                  看底牌
                </Button>
              );
            }

            playingButtons.push(
              <Button key="selectAll" onClick={handleSelectAllCards} disabled={myCards.length === 0} style={buttonStyle}>
                全选
              </Button>,
              <Button key="score-5" onClick={() => handleQuickAdjustScore(-5)} style={buttonStyle}>
                -5分
              </Button>,
              <Button key="score+5" onClick={() => handleQuickAdjustScore(5)} style={buttonStyle}>
                +5分
              </Button>,
              <Button key="score+10" onClick={() => handleQuickAdjustScore(10)} style={buttonStyle}>
                +10分
              </Button>,
              <Button key="level-1" onClick={() => handleQuickAdjustLevel(-1)} style={buttonStyle}>
                -1级
              </Button>,
              <Button key="level+1" onClick={() => handleQuickAdjustLevel(1)} style={buttonStyle}>
                +1级
              </Button>
            );

            if (isHost) {
              playingButtons.push(
                <Button key="restart" danger onClick={handleRestartGame} style={buttonStyle}>
                  重新开始
                </Button>
              );
            }

            playingButtons.push(
              <Button key="rename" onClick={handleOpenRenameModal} style={buttonStyle}>
                改昵称
              </Button>
            );

            if (isHost) {
              playingButtons.push(
                <Button key="settings" onClick={() => setRoomConfigModal(true)} style={buttonStyle}>
                  房间设置
                </Button>
              );
            }
          }

          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', width: '100%' }}>
              {playingButtons}
            </div>
          );
        } else {
          // 基础模式：出牌、撤回、聊天、全选、看底牌（庄家）、重新开始（房主）、修改昵称、房间设置（房主）
          const playingButtons = [
            <Button
              key="play"
              type="primary"
              onClick={handlePlayCards}
              disabled={!canPlay}
              style={buttonStyle}
              title={playButtonTitle}
            >
              出牌({selectedCards.length})
            </Button>,
            <Button
              key="undo"
              onClick={handleUndoPlay}
              disabled={!canUndo}
              style={buttonStyle}
              title={!canUndo ? '无法撤回' : ''}
            >
              撤回
            </Button>,
            <Button key="chat" onClick={() => setChatModal(true)} style={buttonStyle}>
              聊天
            </Button>,
            <Button key="selectAll" onClick={handleSelectAllCards} disabled={myCards.length === 0} style={buttonStyle}>
              全选
            </Button>
          ];

          // 看底牌（仅庄家）
          if (currentPlayer?.id === gameState?.buryingPlayerId) {
            playingButtons.push(
              <Button key="viewBottom" onClick={handleViewMyBottomCards} style={buttonStyle}>
                看底牌
              </Button>
            );
          }

          // 重新开始（仅房主）
          if (isHost) {
            playingButtons.push(
              <Button key="restart" onClick={handleRestartGame} style={buttonStyle}>
                重新开始
              </Button>
            );
          }

          // 修改昵称
          playingButtons.push(
            <Button key="rename" onClick={handleOpenRenameModal} style={buttonStyle}>
              改昵称
            </Button>
          );

          // 房间设置（仅房主）
          if (isHost) {
            playingButtons.push(
              <Button key="settings" onClick={() => setRoomConfigModal(true)} style={buttonStyle}>
                房间设置
              </Button>
            );
          }

          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', width: '100%' }}>
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
            {isReadyForNext ? '已准备' : '开始下一局'}
          </Button>
        ];

        if (isHost) {
          revealingButtons.push(
            <Button key="settings" onClick={() => setRoomConfigModal(true)} style={buttonStyle}>
              房间设置
            </Button>
          );
        }

        return (
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            {revealingButtons}
          </div>
        );

      case GamePhases.FINISHED:
        if (!isHost) {
          return null;
        }

        return (
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Button key="settings" onClick={() => setRoomConfigModal(true)} style={buttonStyle}>
              房间设置
            </Button>
          </div>
        );

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
          return <div className="phase-content"><Text>等待加入房间...</Text></div>;
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
              />
            </div>
          );
        }

        // 正常的房间等待界面
        return (
          <div className="phase-content">
            <Title level={3}>等待开始</Title>
            <Text>当前玩家: {currentRoom.playerCount} / {currentRoom.maxPlayers}</Text>
            <br />
            <Text type="secondary">底牌数量: {currentRoom.config?.bottomCardsCount || 8} | 发牌间隔: {currentRoom.config?.dealInterval || 500}ms</Text>
            <br />
            <br />

            <Space direction="vertical" size="middle" style={{ width: '100%', alignItems: 'center' }}>
              {/* 房主操作按钮 */}
              {isHost && (
                <Space size="middle">
                  {currentRoom.playerCount >= 2 && (
                    <Button type="primary" size="large" onClick={handleStartGame}>
                      开始游戏
                    </Button>
                  )}
                  <Button size="large" onClick={() => setRoomConfigModal(true)}>
                    房间设置
                  </Button>
                  <Button size="large" onClick={handleAddBot} disabled={currentRoom.playerCount >= currentRoom.maxPlayers}>
                    添加Bot
                  </Button>
                </Space>
              )}

              {/* Bot列表 */}
              {isHost && currentRoom.players.some(p => p.isBot) && (
                <div style={{ width: '80%', maxWidth: '600px' }}>
                  <Divider>房间内的Bot</Divider>
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
              <Button onClick={handleOpenRenameModal}>
                修改昵称
              </Button>
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
            />
          </div>
        );

      case GamePhases.REVEALING:
        // 揭示底牌阶段不需要高亮边框，传递 null
        return (
          <div className="phase-content playing-phase">
            {/* 游戏桌面 - 展示底牌，保留所有人的出牌 */}
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
            <span>{trumpAnimation.type === 'overtrump' ? '盖毙！' : '毙了！'}</span>
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
        title="选择埋底玩家"
        open={buryingPlayerModal}
        onOk={handleSetBuryingPlayer}
        onCancel={() => setBuryingPlayerModal(false)}
      >
        <Select
          style={{ width: '100%' }}
          placeholder="选择玩家"
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
        title="选择首发玩家"
        open={firstPlayerModal}
        onOk={handleSetFirstPlayer}
        onCancel={() => setFirstPlayerModal(false)}
      >
        <Select
          style={{ width: '100%' }}
          placeholder="选择玩家"
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
        title="调整分数"
        open={scoreAdjustModal}
        onOk={handleUpdateScore}
        onCancel={() => setScoreAdjustModal(false)}
      >
        <Select
          style={{ width: '100%', marginBottom: 16 }}
          placeholder="选择玩家"
          onChange={setSelectedPlayerId}
        >
          {currentRoom.players.map(player => (
            <Select.Option key={player.id} value={player.id}>
              {player.name} (当前: {player.score})
            </Select.Option>
          ))}
        </Select>
        <InputNumber
          style={{ width: '100%' }}
          placeholder="新分数"
          value={adjustValue}
          onChange={setAdjustValue}
        />
      </Modal>

      {/* 调整等级弹窗 */}
      <Modal
        title="调整等级"
        open={levelAdjustModal}
        onOk={handleUpdateLevel}
        onCancel={() => setLevelAdjustModal(false)}
      >
        <Select
          style={{ width: '100%', marginBottom: 16 }}
          placeholder="选择玩家"
          onChange={setSelectedPlayerId}
        >
          {currentRoom.players.map(player => (
            <Select.Option key={player.id} value={player.id}>
              {player.name} (当前: {player.level})
            </Select.Option>
          ))}
        </Select>
        <InputNumber
          style={{ width: '100%' }}
          placeholder="新等级"
          min={2}
          max={14}
          value={adjustValue}
          onChange={setAdjustValue}
        />
      </Modal>

      {/* 查看我的底牌弹窗 */}
      <Modal
        title="我的底牌"
        open={viewBottomModal}
        onOk={() => setViewBottomModal(false)}
        onCancel={() => setViewBottomModal(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setViewBottomModal(false)}>
            关闭
          </Button>
        ]}
      >
        <div style={{ textAlign: 'center' }}>
          <Text>已埋 {myBottomCards.length} 张底牌</Text>
          <br />
          <br />
          {myBottomCards.length > 0 && (
            <Hand cards={myBottomCards} disabled small trumpSuit={trumpSuit} trumpRank={trumpRank} />
          )}
        </div>
      </Modal>

      {/* 设置主牌弹窗 */}
      <Modal
        title="设置主牌"
        open={trumpModal}
        onCancel={() => setTrumpModal(false)}
        footer={null}
      >
        <div>
          <Text strong>花色:</Text>
          <br />
          <Space wrap style={{ marginTop: 8, marginBottom: 16 }}>
            <Button onClick={() => handleSetTrump('hearts', trumpRank || '2')}>♥ 红桃</Button>
            <Button onClick={() => handleSetTrump('diamonds', trumpRank || '2')}>♦ 方块</Button>
            <Button onClick={() => handleSetTrump('clubs', trumpRank || '2')}>♣ 梅花</Button>
            <Button onClick={() => handleSetTrump('spades', trumpRank || '2')}>♠ 黑桃</Button>
            <Button onClick={() => handleSetTrump('no_trump', trumpRank || '2')}>无主</Button>
          </Space>
          <br />
          <Text strong>点数:</Text>
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
        title="房间设置"
        open={roomConfigModal}
        onOk={handleUpdateRoomConfig}
        onCancel={() => setRoomConfigModal(false)}
        okText="保存"
        cancelText="取消"
      >
        <div>
          <Text strong>底牌数量:</Text>
          <br />
          <InputNumber
            style={{ width: '100%', marginTop: 8, marginBottom: 16 }}
            min={1}
            max={20}
            value={newBottomCardsCount}
            onChange={setNewBottomCardsCount}
          />
          <br />
          <Text strong>发牌间隔（毫秒）:</Text>
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
            <Text strong>自由模式:</Text>
            <Switch
              checked={newPlayMode === PlayModes.FREE}
              onChange={(checked) => setNewPlayMode(checked ? PlayModes.FREE : PlayModes.ORDERED)}
              checkedChildren="开启"
              unCheckedChildren="关闭"
            />
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            自由模式：无出牌顺序限制，可随时出牌、展示牌、调整分数等级<br />
            基础模式：按顺序出牌，完善的亮主、得分和升级规则
          </Text>
          <br />
          <br />
          <Text type="secondary">设置将在下一局游戏开始时生效</Text>
        </div>
      </Modal>

      {/* 修改昵称弹窗 */}
      <Modal
        title="修改昵称"
        open={renameModal}
        onOk={handleUpdatePlayerName}
        onCancel={() => {
          setRenameModal(false);
          setNewPlayerName('');
        }}
        okText="保存"
        cancelText="取消"
      >
        <div>
          <Text strong>新昵称:</Text>
          <br />
          <Input
            style={{ width: '100%', marginTop: 8 }}
            placeholder="请输入新昵称（最多20字符）"
            maxLength={20}
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
            onPressEnter={handleUpdatePlayerName}
          />
        </div>
      </Modal>

      {/* 聊天弹窗 */}
      <Modal
        title="聊天"
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
              <Text type="secondary">暂无聊天记录</Text>
            ) : (
              chatHistory.map((chat, idx) => (
                <div key={idx} style={{ marginBottom: 8 }}>
                  <Text strong>{chat.playerName}: </Text>
                  <Text>{chat.message}</Text>
                </div>
              ))
            )}
          </div>

          <Divider style={{ margin: '12px 0' }}>快捷短语</Divider>

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
              管理快捷短语
            </Button>
          </Space>

          <Divider style={{ margin: '12px 0' }}>发送消息</Divider>

          {/* 消息输入 */}
          <Input.TextArea
            placeholder="输入消息（最多200字符，支持emoji）"
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
            <Text type="secondary" style={{ fontSize: 12 }}>常用表情：</Text>
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
              发送
            </Button>
          </div>
        </div>
      </Modal>

      {/* 快捷短语管理弹窗 */}
      <Modal
        title="管理快捷短语"
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
            <Text strong>现有快捷短语:</Text>
            <div style={{ marginTop: 8 }}>
              {quickPhrases.length === 0 ? (
                <Text type="secondary">暂无快捷短语</Text>
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

          <Divider style={{ margin: '12px 0' }}>添加新短语</Divider>

          {/* 添加新快捷短语 */}
          <Input
            placeholder="输入新的快捷短语（最多50字符）"
            maxLength={50}
            value={newQuickPhrase}
            onChange={(e) => setNewQuickPhrase(e.target.value)}
            onPressEnter={handleAddQuickPhrase}
          />
          <div style={{ marginTop: 8, textAlign: 'right' }}>
            <Button type="primary" onClick={handleAddQuickPhrase}>
              添加
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
    </div>
  );
}
