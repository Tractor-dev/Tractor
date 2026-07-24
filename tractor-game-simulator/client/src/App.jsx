import { useState, useEffect } from 'react';
import { Layout, Typography, Button, message, Space, Tabs, Tag, Divider, Modal, InputNumber, Checkbox, Select } from 'antd';
import socketService from './services/socket';
import { useGameStore } from './store/gameStore';
import CreateRoomModal from './components/Room/CreateRoomModal';
import JoinRoomModal from './components/Room/JoinRoomModal';
import RoomList from './components/Room/RoomList';
import GameBoard from './components/Game/GameBoard';
import { SOCKET_EVENTS } from './utils/constants';
import { shouldShowGameBoard } from './utils/gameViewUtils';
import { RULE_SELECT_OPTIONS } from './utils/ruleCatalog';
import './styles/App.css';

const { Header, Content } = Layout;
const { Title } = Typography;
const ROOM_SESSION_KEY = 'tractorRoomSession';

function loadRoomSession() {
  try {
    return JSON.parse(localStorage.getItem(ROOM_SESSION_KEY) || 'null');
  } catch {
    localStorage.removeItem(ROOM_SESSION_KEY);
    return null;
  }
}

function saveRoomSession(room, player, resumeToken) {
  if (!room?.id || !player?.id || !resumeToken) return;
  localStorage.setItem(ROOM_SESSION_KEY, JSON.stringify({
    roomId: room.id,
    playerId: player.id,
    resumeToken
  }));
}

function clearRoomSession() {
  localStorage.removeItem(ROOM_SESSION_KEY);
}

function App() {
  const [messageApi, contextHolder] = message.useMessage();
  const { isConnected, setIsConnected, currentRoom, setCurrentRoom, currentPlayer, setCurrentPlayer, setMyCards, roomList, setRoomList } = useGameStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [newDealInterval, setNewDealInterval] = useState(500);
  const [testMode, setTestMode] = useState(false);
  const [testRuleId, setTestRuleId] = useState('normal_game');

  useEffect(() => {
    // 连接Socket
    const socket = socketService.connect();

    socket.on('connect', () => {
      setIsConnected(true);
      messageApi.success('已连接到服务器');
      const session = loadRoomSession();
      if (session?.roomId && session?.playerId && session?.resumeToken) {
        socket.emit(SOCKET_EVENTS.RESUME_ROOM, session);
      }
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      messageApi.warning('与服务器断开连接');
    });

    socket.on('error', (error) => {
      messageApi.error(error.message || '发生错误');
    });

    // 监听房间创建成功
    socket.on('room_created', ({ room, player, resumeToken }) => {
      console.log('收到房间创建成功事件:', { room, player });
      console.log('🎮 创建时 gameState.trumpRank =', room?.gameState?.trumpRank);
      messageApi.success('房间创建成功！');
      setCurrentRoom(room);
      setCurrentPlayer(player);
      saveRoomSession(room, player, resumeToken);
      setShowCreateModal(false);
    });

    // 监听其他玩家加入
    socket.on('player_joined', ({ player }) => {
      messageApi.info(`${player.name} 加入了房间`);
    });

    // 监听玩家离开
    socket.on('player_left', ({ playerName }) => {
      messageApi.warning(`${playerName} 离开了房间`);
    });

    // 监听房间状态更新
    socket.on('room_updated', ({ room }) => {
      console.log('房间状态更新:', room);
      console.log('🎮 gameState.trumpRank =', room?.gameState?.trumpRank);
      console.log('🎮 gameState.trumpSuit =', room?.gameState?.trumpSuit);
      setCurrentRoom(room);
    });

    // 监听加入房间成功
    socket.on('room_joined', ({ room, player, resumeToken }) => {
      console.log('加入房间成功:', { room, player });
      messageApi.success('加入房间成功！');
      setCurrentRoom(room);
      setCurrentPlayer(player);
      saveRoomSession(room, player, resumeToken);
      setShowJoinModal(false);
    });

    socket.on('room_resumed', ({ room, player, resumeToken }) => {
      setCurrentRoom(room);
      setCurrentPlayer(player);
      setMyCards(player.cards || []);
      saveRoomSession(room, player, resumeToken);
      messageApi.success('已恢复原房间和座位');
    });

    socket.on('resume_failed', ({ message }) => {
      clearRoomSession();
      setCurrentRoom(null);
      setCurrentPlayer(null);
      setMyCards([]);
      messageApi.warning(message || '原房间已无法恢复');
    });

    socket.on('player_disconnected', ({ playerName }) => {
      messageApi.warning(`${playerName} 断线，正在为其保留座位`);
    });

    socket.on('player_reconnected', ({ playerName }) => {
      messageApi.success(`${playerName} 已重新连接`);
    });

    // 监听房间列表
    socket.on('room_list', ({ rooms }) => {
      console.log('收到房间列表:', rooms);
      setRoomList(rooms);
      setLoadingRooms(false);
    });

    // Bot添加
    socket.on('bot_added', ({ player }) => {
      messageApi.success(`Bot ${player.name} 已加入房间`);
    });

    // Bot移除
    socket.on('bot_removed', ({ playerName }) => {
      messageApi.info(`Bot ${playerName} 已离开房间`);
    });

    // 配置更新
    socket.on('config_updated', ({ config }) => {
      messageApi.success('房间设置已更新，将在下一局游戏生效');
    });

    // 游戏开始 - 进入准备等待
    socket.on('game_started', ({ phase, isWaitingForReady }) => {
      console.log('游戏开始，等待玩家准备:', { phase, isWaitingForReady });
    });

    // 玩家准备状态更新
    socket.on('player_ready_status', ({ playerId, playerName, isReady }) => {
      messageApi.info(`${playerName} ${isReady ? '已准备' : '取消准备'}`);
    });

    // 所有玩家准备完毕
    socket.on('all_players_ready', ({ message }) => {
      messageApi.success(message);
    });

    // 开始发牌
    socket.on('start_drawing', ({ phase }) => {
      console.log('开始发牌阶段:', phase);
    });

    return () => {
      socketService.disconnect();
    };
  }, []);

  const handleCreateRoom = (values) => {
    const socket = socketService.socket;
    socket.emit(SOCKET_EVENTS.CREATE_ROOM, {
      name: values.roomName,
      playerName: values.playerName,
      config: {
        dealInterval: values.dealInterval,
        normalModeOnly: values.normalModeOnly === true,
        testMode: values.testMode === true,
        testRuleId: values.testMode ? values.testRuleId : null
      }
    });
  };

  const handleJoinRoom = (values) => {
    const socket = socketService.socket;
    socket.emit(SOCKET_EVENTS.JOIN_ROOM, {
      roomId: values.roomId,
      playerName: values.playerName
    });
  };

  const handleJoinRoomFromList = (roomId) => {
    setSelectedRoomId(roomId);
    setShowJoinModal(true);
  };

  const handleRefreshRooms = () => {
    setLoadingRooms(true);
    const socket = socketService.socket;
    socket.emit(SOCKET_EVENTS.GET_ROOM_LIST);
  };

  const handleLeaveRoom = () => {
    const socket = socketService.socket;
    socket.emit(SOCKET_EVENTS.LEAVE_ROOM, {
      roomId: currentRoom.id
    });
    setCurrentRoom(null);
    setCurrentPlayer(null);
    setMyCards([]);
    clearRoomSession();
    messageApi.info('已离开房间');
  };

  const handleAddBot = () => {
    const socket = socketService.socket;
    const botCount = currentRoom.players.filter(p => p.isBot).length;
    socket.emit(SOCKET_EVENTS.ADD_BOT, {
      roomId: currentRoom.id,
      botName: `AI Bot ${botCount + 1}`
    });
  };

  const handleRemoveBot = (playerId) => {
    const socket = socketService.socket;
    socket.emit(SOCKET_EVENTS.REMOVE_BOT, {
      roomId: currentRoom.id,
      playerId
    });
  };

  const handleUpdateConfig = () => {
    if (newDealInterval < 10 || newDealInterval > 5000) {
      messageApi.warning('发牌间隔必须在10-5000毫秒之间');
      return;
    }
    const socket = socketService.socket;
    socket.emit(SOCKET_EVENTS.UPDATE_CONFIG, {
      roomId: currentRoom.id,
      config: {
        dealInterval: newDealInterval,
        testMode,
        testRuleId: testMode ? testRuleId : null
      }
    });
    setShowConfigModal(false);
  };

  // 初始加载房间列表
  useEffect(() => {
    if (isConnected && !currentRoom) {
      handleRefreshRooms();
    }
  }, [isConnected, currentRoom]);

  // 同步房间配置
  useEffect(() => {
    if (currentRoom?.config) {
      setNewDealInterval(currentRoom.config.dealInterval);
      setTestMode(currentRoom.config.testMode === true);
      setTestRuleId(currentRoom.config.testRuleId || 'normal_game');
    }
  }, [currentRoom]);

  // 如果在房间内，显示房间界面或游戏界面
  if (currentRoom) {
    // 规则选择属于两局之间的牌桌流程，不能因为阶段暂时回到 WAITING 就卸载牌桌。
    if (shouldShowGameBoard(currentRoom.gameState)) {
      return <GameBoard />;
    }

    // 否则显示房间等待界面
    return (
      <Layout style={{ minHeight: '100vh' }}>
        {contextHolder}
        <Header style={{ background: '#001529', padding: '0 24px' }}>
          <Title level={3} style={{ color: 'white', margin: '16px 0' }}>
            拖拉机纸牌游戏模拟器 - {currentRoom.name}
          </Title>
        </Header>
        <Content style={{ padding: '24px' }}>
          <div style={{
            background: 'white',
            padding: '48px',
            borderRadius: '8px'
          }}>
            <Title level={2}>房间: {currentRoom.name}</Title>
            <p style={{ fontSize: '16px', marginBottom: '24px' }}>
              房间ID: {currentRoom.id}
            </p>
            <p style={{ fontSize: '16px', marginBottom: '24px' }}>
              玩家数: {currentRoom.playerCount} / {currentRoom.maxPlayers}
            </p>
            <div style={{ marginBottom: '24px' }}>
              <Title level={4}>玩家列表:</Title>
              {currentRoom.players.map((player, index) => (
                <div key={player.id} style={{ padding: '8px', background: '#f5f5f5', marginBottom: '8px', borderRadius: '4px' }}>
                  {index + 1}. {player.isBot && '🤖 '}{player.name}
                  {player.socketId === currentRoom.hostId && ' (房主)'}
                  {player.id === currentPlayer?.id && ' (你)'}
                  {player.isBot && ' (Bot)'}
                  {' - '} 分数: {player.score} - 等级: {player.level}
                </div>
              ))}
            </div>
            <div style={{ marginBottom: '24px' }}>
              <Title level={4}>房间配置:</Title>
              <p>默认底牌: 8 张（特殊规则可能调整）</p>
              <p>发牌间隔: {currentRoom.config.dealInterval} 毫秒</p>
              <p>规则模式: {currentRoom.config.testMode
                ? `测试模式（${RULE_SELECT_OPTIONS.find(option => option.value === currentRoom.config.testRuleId)?.label || currentRoom.config.testRuleId}）`
                : currentRoom.config.normalModeOnly
                  ? '普通对局（无特殊规则）'
                  : '正常随机二选一'}</p>
            </div>

            {/* Bot管理区域 - 仅房主可见 */}
            {currentPlayer?.socketId === currentRoom.hostId && currentRoom.players.some(p => p.isBot) && (
              <div style={{ marginBottom: '24px' }}>
                <Divider>房间内的Bot</Divider>
                <Space wrap>
                  {currentRoom.players.filter(p => p.isBot).map(bot => (
                    <Tag
                      key={bot.id}
                      closable
                      onClose={() => handleRemoveBot(bot.id)}
                      color="blue"
                      style={{ fontSize: '14px', padding: '4px 8px' }}
                    >
                      🤖 {bot.name}
                    </Tag>
                  ))}
                </Space>
              </div>
            )}

            <Space>
              {currentPlayer?.socketId === currentRoom.hostId && (
                <>
                  <Button
                    type="primary"
                    size="large"
                    onClick={() => {
                      const socket = socketService.socket;
                      socket.emit(SOCKET_EVENTS.START_GAME, { roomId: currentRoom.id });
                    }}
                    disabled={currentRoom.playerCount < 2}
                  >
                    开始游戏
                  </Button>
                  <Button
                    size="large"
                    onClick={handleAddBot}
                    disabled={currentRoom.playerCount >= currentRoom.maxPlayers}
                  >
                    添加Bot
                  </Button>
                  <Button
                    size="large"
                    onClick={() => setShowConfigModal(true)}
                  >
                    修改设置
                  </Button>
                </>
              )}
              <Button type="default" onClick={handleLeaveRoom}>
                离开房间
              </Button>
            </Space>
          </div>
        </Content>

        {/* 房间设置弹窗 */}
        <Modal
          title="房间设置"
          open={showConfigModal}
          onOk={handleUpdateConfig}
          onCancel={() => setShowConfigModal(false)}
          okText="保存"
          cancelText="取消"
        >
          <div>
            <Typography.Text strong>发牌间隔（毫秒）:</Typography.Text>
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
            <Checkbox checked={testMode} onChange={event => setTestMode(event.target.checked)}>
              规则测试模式
            </Checkbox>
            {testMode && (
              <Select
                aria-label="测试规则"
                style={{ width: '100%', marginTop: 12 }}
                value={testRuleId}
                options={RULE_SELECT_OPTIONS}
                onChange={setTestRuleId}
                showSearch
                optionFilterProp="label"
              />
            )}
            <br />
            <br />
            <Typography.Text type="secondary">设置将在下一局游戏开始时生效</Typography.Text>
          </div>
        </Modal>
      </Layout>
    );
  }

  // 大厅界面
  return (
    <Layout style={{ minHeight: '100vh' }}>
      {contextHolder}
      <Header style={{ background: '#001529', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ color: 'white', margin: '16px 0' }}>
          拖拉机纸牌游戏模拟器
        </Title>
        <div style={{ color: 'white' }}>
          连接状态: {isConnected ? '✅ 已连接' : '❌ 未连接'}
        </div>
      </Header>
      <Content style={{ padding: '24px' }}>
        <div style={{
          background: 'white',
          padding: '32px',
          borderRadius: '8px',
          marginBottom: '24px'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <Title level={2}>欢迎来到拖拉机纸牌游戏</Title>
            <p style={{ color: '#666', marginBottom: '24px' }}>
              在线多人拖拉机纸牌游戏模拟器
            </p>
            <Space size="large">
              <Button
                type="primary"
                size="large"
                disabled={!isConnected}
                onClick={() => setShowCreateModal(true)}
              >
                创建房间
              </Button>
              <Button
                size="large"
                disabled={!isConnected}
                onClick={() => {
                  setSelectedRoomId('');
                  setShowJoinModal(true);
                }}
              >
                加入房间
              </Button>
            </Space>
          </div>
        </div>

        {/* 房间列表 */}
        <div style={{
          background: 'white',
          padding: '32px',
          borderRadius: '8px'
        }}>
          <RoomList
            rooms={roomList}
            onJoinRoom={handleJoinRoomFromList}
            onRefresh={handleRefreshRooms}
            loading={loadingRooms}
          />
        </div>
      </Content>

      <CreateRoomModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreateRoom={handleCreateRoom}
      />

      <JoinRoomModal
        visible={showJoinModal}
        roomId={selectedRoomId}
        onClose={() => {
          setShowJoinModal(false);
          setSelectedRoomId('');
        }}
        onJoinRoom={handleJoinRoom}
      />
    </Layout>
  );
}

export default App;
