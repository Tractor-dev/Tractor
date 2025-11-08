import { useState, useEffect } from 'react';
import { Button, Space, Typography, Modal, Select, InputNumber, message } from 'antd';
import { useGameStore } from '../../store/gameStore';
import socketService from '../../services/socket';
import { SOCKET_EVENTS, GamePhases, PlayModes } from '../../utils/constants';
import Hand from './Hand';
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
    setMyCards
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

  const socket = socketService.socket;
  const isHost = currentPlayer?.id === currentRoom?.hostId;
  const gameState = currentRoom?.gameState;
  const phase = gameState?.phase || GamePhases.WAITING;

  // 监听游戏事件
  useEffect(() => {
    if (!socket) return;

    // 游戏开始
    socket.on('game_started', ({ gameState }) => {
      messageApi.success('游戏开始！');
    });

    // 收到手牌
    socket.on('card_dealt', ({ card }) => {
      setMyCards([...myCards, card]);
    });

    // 玩家展示手牌
    socket.on('cards_shown', ({ playerName, cards }) => {
      messageApi.info(`${playerName} 展示了 ${cards.length} 张牌`);
    });

    // 埋底玩家设置
    socket.on('burying_player_set', ({ playerName }) => {
      messageApi.info(`${playerName} 被指定为埋底玩家`);
    });

    // 埋底完成
    socket.on('cards_buried', ({ playerName }) => {
      messageApi.success(`${playerName} 完成埋底`);
    });

    // 玩家出牌
    socket.on('cards_played', ({ playerName, cards, playedCards }) => {
      messageApi.info(`${playerName} 出了 ${cards.length} 张牌`);
    });

    // 玩家跳过
    socket.on('turn_passed', ({ playerName }) => {
      messageApi.info(`${playerName} 跳过了回合`);
    });

    // 展示底牌
    socket.on('bottom_cards_revealed', ({ bottomCards }) => {
      messageApi.info(`底牌已展示: ${bottomCards.length} 张`);
    });

    // 玩家确认
    socket.on('player_confirmed', ({ playerName }) => {
      messageApi.info(`${playerName} 已确认`);
    });

    // 游戏重新开始
    socket.on('game_restarted', () => {
      messageApi.success('游戏重新开始！');
      clearSelection();
    });

    // 分数更新
    socket.on('score_updated', ({ playerId, newScore }) => {
      messageApi.success('分数已更新');
    });

    // 等级更新
    socket.on('level_updated', ({ playerId, newLevel }) => {
      messageApi.success('等级已更新');
    });

    return () => {
      socket.off('game_started');
      socket.off('card_dealt');
      socket.off('cards_shown');
      socket.off('burying_player_set');
      socket.off('cards_buried');
      socket.off('cards_played');
      socket.off('turn_passed');
      socket.off('bottom_cards_revealed');
      socket.off('player_confirmed');
      socket.off('game_restarted');
      socket.off('score_updated');
      socket.off('level_updated');
    };
  }, [socket, myCards]);

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
    socket.emit(SOCKET_EVENTS.BURY_CARDS, {
      roomId: currentRoom.id,
      cardIds: selectedCards
    });
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
    socket.emit(SOCKET_EVENTS.PLAY_CARDS, {
      roomId: currentRoom.id,
      cardIds: selectedCards
    });
    clearSelection();
  };

  // 跳过
  const handlePass = () => {
    socket.emit(SOCKET_EVENTS.PASS_TURN, {
      roomId: currentRoom.id
    });
  };

  // 确认底牌
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

  // 获取当前玩家
  const getCurrentTurnPlayer = () => {
    if (!gameState?.currentPlayerIndex) return null;
    return currentRoom.players[gameState.currentPlayerIndex];
  };

  const currentTurnPlayer = getCurrentTurnPlayer();
  const isMyTurn = currentTurnPlayer?.id === currentPlayer?.id;
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
          <div className="phase-content">
            <Title level={3}>摸牌阶段</Title>
            <Text>系统正在自动发牌...</Text>
            <br />
            <Text>已发牌数: {myCards.length}</Text>
            <br />
            <br />
            <Space>
              <Button onClick={handleShowCards} disabled={selectedCards.length === 0}>
                展示选中的牌 ({selectedCards.length})
              </Button>
              {isHost && (
                <Button type="primary" onClick={() => setBuryingPlayerModal(true)}>
                  指定埋底玩家（结束摸牌）
                </Button>
              )}
            </Space>
          </div>
        );

      case GamePhases.BURYING:
        return (
          <div className="phase-content">
            <Title level={3}>埋底阶段</Title>
            <Text>埋底玩家: {currentRoom.players.find(p => p.id === gameState.buryingPlayerId)?.name}</Text>
            <br />
            <br />
            {isBuryingPlayer ? (
              <Button
                type="primary"
                size="large"
                onClick={handleBuryCards}
                disabled={selectedCards.length !== currentRoom.config.bottomCardsCount}
              >
                确认埋底 (已选 {selectedCards.length}/{currentRoom.config.bottomCardsCount})
              </Button>
            ) : (
              <Text>等待埋底玩家埋底...</Text>
            )}
          </div>
        );

      case GamePhases.PLAYING:
        return (
          <div className="phase-content">
            <Title level={3}>出牌阶段</Title>
            <Text>出牌模式: {gameState.playMode === PlayModes.ORDERED ? '有序出牌' : '自由抢先'}</Text>
            <br />
            <Text>当前玩家: {currentTurnPlayer?.name}</Text>
            <br />
            <br />
            {phase === GamePhases.PLAYING && !gameState.buryingPlayerId && isHost && (
              <Button type="primary" onClick={() => setFirstPlayerModal(true)} style={{ marginBottom: 16 }}>
                设置首发玩家
              </Button>
            )}
            {gameState.buryingPlayerId && (
              <>
                {isMyTurn ? (
                  <Space>
                    <Button
                      type="primary"
                      size="large"
                      onClick={handlePlayCards}
                      disabled={selectedCards.length === 0}
                    >
                      出牌 (已选 {selectedCards.length})
                    </Button>
                    <Button size="large" onClick={handlePass}>
                      跳过
                    </Button>
                  </Space>
                ) : (
                  <Text>等待其他玩家出牌...</Text>
                )}
              </>
            )}
          </div>
        );

      case GamePhases.REVEALING:
        return (
          <div className="phase-content">
            <Title level={3}>展示底牌</Title>
            <Text>底牌数量: {gameState.bottomCards?.length || 0}</Text>
            <br />
            <br />
            {gameState.bottomCards && gameState.bottomCards.length > 0 && (
              <Hand cards={gameState.bottomCards} disabled small />
            )}
            <br />
            <br />
            <Button type="primary" size="large" onClick={handleConfirmReveal}>
              确认
            </Button>
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

      {/* 玩家信息区域 */}
      <div className="players-area">
        {currentRoom.players.map((player) => (
          <div
            key={player.id}
            className={`player-info ${player.id === currentPlayer.id ? 'self' : ''} ${
              currentTurnPlayer?.id === player.id ? 'active-turn' : ''
            }`}
          >
            <Text strong>{player.name}</Text>
            {player.id === currentRoom.hostId && <Text type="secondary"> (房主)</Text>}
            {player.id === currentPlayer.id && <Text type="success"> (你)</Text>}
            <br />
            <Text>分数: {player.score} | 等级: {player.level}</Text>
            {player.id === gameState?.buryingPlayerId && <Text type="warning"> [埋底]</Text>}
          </div>
        ))}
      </div>

      {/* 中央出牌区域 */}
      <div className="play-area">
        {renderPhaseContent()}

        {/* 显示所有玩家的出牌 */}
        {gameState?.playedCards && Object.keys(gameState.playedCards).length > 0 && (
          <div className="played-cards-area">
            <Title level={4}>出牌区</Title>
            {Object.entries(gameState.playedCards).map(([playerId, cards]) => {
              const player = currentRoom.players.find(p => p.id === playerId);
              return (
                <div key={playerId} className="player-played">
                  <Text strong>{player?.name}:</Text>
                  <Hand cards={cards} disabled small />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 我的手牌区域 */}
      <div className="my-hand-area">
        <Title level={4}>我的手牌 ({myCards.length})</Title>
        <Hand
          cards={myCards}
          selectedCards={selectedCards}
          onCardClick={toggleCardSelection}
          disabled={phase === GamePhases.WAITING || phase === GamePhases.FINISHED}
        />
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
    </div>
  );
}
