import { useState, useEffect } from 'react';
import { Button, Space, Typography, Modal, Select, InputNumber, Input, message, Divider, Tag } from 'antd';
import { useGameStore } from '../../store/gameStore';
import socketService from '../../services/socket';
import { SOCKET_EVENTS, GamePhases, PlayModes } from '../../utils/constants';
import Hand from './Hand';
import GameTable from './GameTable';
import RuleSelector from './RuleSelector';
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
  const [revealedBottomCards, setRevealedBottomCards] = useState([]); // 展示的底牌
  const [myBottomCards, setMyBottomCards] = useState([]); // 我埋的底牌（仅埋底玩家可见）
  const [trumpSuit, setTrumpSuit] = useState(null); // 主牌花色
  const [trumpRank, setTrumpRank] = useState(null); // 主牌点数
  const [trumpModal, setTrumpModal] = useState(false); // 设置主牌弹窗
  const [roomConfigModal, setRoomConfigModal] = useState(false); // 房间设置弹窗
  const [newBottomCardsCount, setNewBottomCardsCount] = useState(8); // 新的底牌数量
  const [newDealInterval, setNewDealInterval] = useState(500); // 新的发牌间隔
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

  const socket = socketService.socket;
  const isHost = currentPlayer?.socketId === currentRoom?.hostId;
  const gameState = currentRoom?.gameState;
  const phase = gameState?.phase || GamePhases.WAITING;

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
      clearSelection(); // 清空选中的牌
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
    });

    // 玩家跳过
    socket.on('turn_passed', ({ playerName }) => {
      messageApi.info(`${playerName} 跳过了回合`);
    });

    // 展示底牌（修正事件名）
    socket.on('bottom_revealed', ({ bottomCards }) => {
      messageApi.info(`底牌已展示: ${bottomCards.length} 张`);
      setRevealedBottomCards(bottomCards);
    });

    // 收到我的底牌
    socket.on('my_bottom_cards', ({ bottomCards }) => {
      setMyBottomCards(bottomCards);
      setViewBottomModal(true);
    });

    // 玩家确认
    socket.on('player_confirmed', ({ playerName }) => {
      messageApi.info(`${playerName} 已确认`);
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
      setTrumpSuit(trumpSuit);
      setTrumpRank(trumpRank);
      // 更新store中的主牌信息，自动重排手牌
      setTrumpInfo(trumpSuit, trumpRank);
      if (trumpSuit && trumpRank) {
        messageApi.info(`主牌已设置: ${trumpSuit} ${trumpRank}`);
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
      socket.off('player_confirmed');
      socket.off('game_restarted');
      socket.off('score_updated');
      socket.off('level_updated');
      socket.off('trump_updated');
      socket.off('config_updated');
      socket.off('player_name_updated');
      socket.off('chat_message_received');
      socket.off('bot_added');
      socket.off('bot_removed');
    };
  }, [socket, messageApi, clearSelection, addCard, removeCards, currentPlayer]);

  // 同步主牌状态
  useEffect(() => {
    if (gameState) {
      setTrumpSuit(gameState.trumpSuit);
      setTrumpRank(gameState.trumpRank);
    }
  }, [gameState]);

  // 同步房间配置
  useEffect(() => {
    if (currentRoom?.config) {
      setNewBottomCardsCount(currentRoom.config.bottomCardsCount);
      setNewDealInterval(currentRoom.config.dealInterval);
    }
  }, [currentRoom]);

  // 开始游戏
  const handleStartGame = () => {
    socket.emit(SOCKET_EVENTS.START_GAME, { roomId: currentRoom.id });
  };

  // 展示手牌
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

  const handleConfirmReveal = () => {
    socket.emit(SOCKET_EVENTS.CONFIRM_REVEAL, {
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
        dealInterval: newDealInterval
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
    setSelectedRule(rule);
    messageApi.success(`已设置规则: ${rule.name}`);
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

  // 渲染游戏阶段内容
  const renderPhaseContent = () => {
    switch (phase) {
      case GamePhases.WAITING:
        if (!currentRoom) {
          return <div className="phase-content"><Text>等待加入房间...</Text></div>;
        }
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
              onSetTrump={() => setTrumpModal(true)}
              selectedRule={selectedRule}
              onSelectRule={() => setRuleSelectorModal(true)}
            />

            {/* 控制区域 - 右下角 */}
            <div className="game-controls">
              <div className="game-info">
                <Text strong>摸牌阶段</Text>
                <br />
                <Text>已发牌数: {myCards.length}</Text>
              </div>

              <Space direction="vertical" style={{ width: '100%' }}>
                <Button
                  onClick={handleShowCards}
                  disabled={selectedCards.length === 0}
                  block
                >
                  展示选中的牌 ({selectedCards.length})
                </Button>
                <Button
                  onClick={handleSelectAllCards}
                  disabled={myCards.length === 0}
                  block
                >
                  一键选中所有牌
                </Button>
                {isHost && (
                  <Button
                    type="primary"
                    onClick={() => setBuryingPlayerModal(true)}
                    block
                  >
                    指定埋底玩家
                  </Button>
                )}
                <Button
                  onClick={handleOpenRenameModal}
                  block
                >
                  修改昵称
                </Button>
              </Space>
            </div>
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
              onSetTrump={() => setTrumpModal(true)}
              selectedRule={selectedRule}
              onSelectRule={() => setRuleSelectorModal(true)}
            />

            {/* 控制区域 - 右下角 */}
            <div className="game-controls">
              <div className="game-info">
                <Text strong>埋底阶段</Text>
                <br />
                <Text>埋底玩家: {currentRoom.players.find(p => p.id === gameState.buryingPlayerId)?.name}</Text>
              </div>

              <Space direction="vertical" style={{ width: '100%' }}>
                {isBuryingPlayer && (
                  <Button
                    type="primary"
                    size="large"
                    onClick={handleBuryCards}
                    disabled={selectedCards.length !== currentRoom.config.bottomCardsCount}
                    block
                  >
                    确认埋底 ({selectedCards.length}/{currentRoom.config.bottomCardsCount})
                  </Button>
                )}
                <Button
                  onClick={handleOpenRenameModal}
                  block
                >
                  修改昵称
                </Button>
              </Space>
            </div>
          </div>
        );

      case GamePhases.PLAYING:
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
              currentTurnPlayerId={null}
              trumpSuit={trumpSuit}
              trumpRank={trumpRank}
              isHost={isHost}
              onSetTrump={() => setTrumpModal(true)}
              selectedRule={selectedRule}
              onSelectRule={() => setRuleSelectorModal(true)}
            />

            {/* 辅助信息和操作区域 - 右下角 */}
            <div className="game-controls">
              <div className="game-info">
                <Text strong>自由出牌阶段</Text>
                <br />
                <Text type="secondary">任何玩家都可以随时出牌</Text>
              </div>

              <Space direction="vertical" style={{ width: '100%', marginTop: '12px' }}>
                {gameState.buryingPlayerId && (
                  <>
                    <Button
                      type="primary"
                      size="large"
                      onClick={handlePlayCards}
                      disabled={selectedCards.length === 0}
                      block
                    >
                      出牌 (已选 {selectedCards.length})
                    </Button>
                    <Button size="large" onClick={() => setChatModal(true)} block>
                      聊天
                    </Button>
                    <Button size="large" onClick={handleUndoPlay} block>
                      撤回出牌
                    </Button>
                    {/* 埋底玩家可以查看底牌 */}
                    {currentPlayer?.id === gameState.buryingPlayerId && (
                      <Button onClick={handleViewMyBottomCards} block>
                        查看我的底牌
                      </Button>
                    )}
                  </>
                )}

                {/* 一键选中所有牌按钮 - 任何阶段都可用 */}
                <Button onClick={handleSelectAllCards} disabled={myCards.length === 0} block>
                  一键选中所有牌
                </Button>

                {/* 快捷操作按钮 */}
                <Space.Compact style={{ width: '100%' }}>
                  <Button onClick={() => handleQuickAdjustScore(-5)}>-5分</Button>
                  <Button onClick={() => handleQuickAdjustScore(5)}>+5分</Button>
                  <Button onClick={() => handleQuickAdjustScore(10)}>+10分</Button>
                </Space.Compact>
                <Space.Compact style={{ width: '100%' }}>
                  <Button onClick={() => handleQuickAdjustLevel(-1)}>-1级</Button>
                  <Button onClick={() => handleQuickAdjustLevel(1)}>+1级</Button>
                </Space.Compact>

                {/* 房主可以随时重新开始 */}
                {isHost && (
                  <Button danger onClick={handleRestartGame} block>
                    重新开始
                  </Button>
                )}

                {/* 修改昵称按钮 */}
                <Button onClick={handleOpenRenameModal} block>
                  修改昵称
                </Button>
              </Space>
            </div>
          </div>
        );

      case GamePhases.REVEALING:
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
              onSetTrump={() => setTrumpModal(true)}
              revealedBottomCards={revealedBottomCards}
              selectedRule={selectedRule}
              onSelectRule={() => setRuleSelectorModal(true)}
            />

            {/* 控制区域 - 右下角 */}
            <div className="game-controls">
              <div className="game-info">
                <Text strong>游戏结束 - 底牌展示</Text>
                <br />
                <Text>底牌数量: {revealedBottomCards.length}</Text>
              </div>

              <Space direction="vertical" style={{ width: '100%' }}>
                <Button type="primary" size="large" onClick={handleConfirmReveal} block>
                  确认
                </Button>
                <Button onClick={handleOpenRenameModal} block>
                  修改昵称
                </Button>
              </Space>
            </div>
          </div>
        );

      case GamePhases.FINISHED:
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
              onSetTrump={() => setTrumpModal(true)}
              revealedBottomCards={revealedBottomCards}
              selectedRule={selectedRule}
              onSelectRule={() => setRuleSelectorModal(true)}
            />

            {/* 控制区域 - 右下角 */}
            <div className="game-controls">
              <div className="game-info">
                <Text strong>游戏结束</Text>
              </div>

              <Space direction="vertical" style={{ width: '100%', marginTop: '12px' }}>
                {isHost && (
                  <>
                    <Button onClick={() => setScoreAdjustModal(true)} block>调整分数</Button>
                    <Button onClick={() => setLevelAdjustModal(true)} block>调整等级</Button>
                    <Button type="primary" size="large" onClick={handleRestartGame} block>
                      重新开始
                    </Button>
                  </>
                )}
                <Button onClick={handleOpenRenameModal} block>
                  修改昵称
                </Button>
              </Space>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="game-board">
      {contextHolder}

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
            <Hand cards={myBottomCards} disabled small />
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
            style={{ width: '100%', marginTop: 8 }}
            min={10}
            max={5000}
            step={100}
            value={newDealInterval}
            onChange={setNewDealInterval}
          />
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
