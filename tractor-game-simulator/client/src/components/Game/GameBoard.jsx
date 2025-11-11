import { useState, useEffect } from 'react';
import { Button, Space, Typography, Modal, Select, InputNumber, message } from 'antd';
import { useGameStore } from '../../store/gameStore';
import socketService from '../../services/socket';
import { SOCKET_EVENTS, GamePhases, PlayModes } from '../../utils/constants';
import Hand from './Hand';
import GameTable from './GameTable';
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
    reorderCards
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
      if (trumpSuit && trumpRank) {
        messageApi.info(`主牌已设置: ${trumpSuit} ${trumpRank}`);
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
      socket.off('player_confirmed');
      socket.off('game_restarted');
      socket.off('score_updated');
      socket.off('level_updated');
      socket.off('trump_updated');
    };
  }, [socket, messageApi, clearSelection, addCard, removeCards]);

  // 同步主牌状态
  useEffect(() => {
    if (gameState) {
      setTrumpSuit(gameState.trumpSuit);
      setTrumpRank(gameState.trumpRank);
    }
  }, [gameState]);

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

  const isBuryingPlayer = gameState?.buryingPlayerId === currentPlayer?.id;

  // 渲染游戏阶段内容
  const renderPhaseContent = () => {
    switch (phase) {
      case GamePhases.WAITING:
        return (
          <div className="phase-content">
            <Title level={3}>等待开始</Title>
            <Text>当前玩家: {currentRoom.playerCount} / {currentRoom.maxPlayers}</Text>
            <br />
            <br />
            {isHost && currentRoom.playerCount >= 2 && (
              <Button type="primary" size="large" onClick={handleStartGame}>
                开始游戏
              </Button>
            )}
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
            />

            {/* 控制区域 - 右下角 */}
            <div className="game-controls">
              <div className="game-info">
                <Text strong>埋底阶段</Text>
                <br />
                <Text>埋底玩家: {currentRoom.players.find(p => p.id === gameState.buryingPlayerId)?.name}</Text>
              </div>

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
                    <Button size="large" onClick={handlePass} block>
                      跳过
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
              </Space>
            </div>
          </div>
        );

      case GamePhases.REVEALING:
        return (
          <div className="phase-content playing-phase">
            {/* 游戏桌面 - 展示底牌 */}
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
              revealedBottomCards={revealedBottomCards}
            />

            {/* 控制区域 - 右下角 */}
            <div className="game-controls">
              <div className="game-info">
                <Text strong>游戏结束 - 底牌展示</Text>
                <br />
                <Text>底牌数量: {revealedBottomCards.length}</Text>
              </div>

              <Button type="primary" size="large" onClick={handleConfirmReveal} block>
                确认
              </Button>
            </div>
          </div>
        );

      case GamePhases.FINISHED:
        return (
          <div className="phase-content">
            <Title level={3}>游戏结束</Title>
            <br />
            {isHost && (
              <Space direction="vertical">
                <Button onClick={() => setScoreAdjustModal(true)}>调整分数</Button>
                <Button onClick={() => setLevelAdjustModal(true)}>调整等级</Button>
                <Button type="primary" size="large" onClick={handleRestartGame}>
                  重新开始
                </Button>
              </Space>
            )}
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
    </div>
  );
}
