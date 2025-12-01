import { useState, useEffect } from 'react';
import { Layout, Typography, Button, message, Space, Tabs, Tag, Divider, Modal, InputNumber, Switch, Dropdown, Select, Input } from 'antd';
import { GlobalOutlined, EyeOutlined } from '@ant-design/icons';
import socketService from './services/socket';
import { useGameStore } from './store/gameStore';
import { useI18n, LANGUAGES, LANGUAGE_NAMES, LANGUAGE_LIST } from './locales/index.jsx';
import CreateRoomModal from './components/Room/CreateRoomModal';
import JoinRoomModal from './components/Room/JoinRoomModal';
import RoomList from './components/Room/RoomList';
import GameBoard from './components/Game/GameBoard';
import { SOCKET_EVENTS, GamePhases, BotTypes } from './utils/constants';
import './styles/App.css';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

function App() {
  const [messageApi, contextHolder] = message.useMessage();
  const { isConnected, setIsConnected, currentRoom, setCurrentRoom, currentPlayer, setCurrentPlayer, currentSpectator, setCurrentSpectator, isSpectator, roomList, setRoomList } = useGameStore();
  const { t, language, setLanguage } = useI18n();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showWatchModal, setShowWatchModal] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [spectatorName, setSpectatorName] = useState('');
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [newBottomCardsCount, setNewBottomCardsCount] = useState(8);
  const [newDealInterval, setNewDealInterval] = useState(100);
  const [newIsFreeMode, setNewIsFreeMode] = useState(false);
  const [newBotType, setNewBotType] = useState(BotTypes.SIMPLE);

  useEffect(() => {
    // 连接Socket
    const socket = socketService.connect();

    socket.on('connect', () => {
      setIsConnected(true);
      messageApi.success(t('connection.connectedToServer'));
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      messageApi.warning(t('connection.disconnectedFromServer'));
    });

    socket.on('error', (error) => {
      messageApi.error(error.message || t('messages.errorOccurred'));
    });

    // 监听房间创建成功
    socket.on('room_created', ({ room, player }) => {
      console.log('收到房间创建成功事件:', { room, player });
      console.log('🎮 创建时 gameState.trumpRank =', room?.gameState?.trumpRank);
      messageApi.success(t('room.roomCreated'));
      setCurrentRoom(room);
      setCurrentPlayer(player);
      setShowCreateModal(false);
    });

    // 监听其他玩家加入
    socket.on('player_joined', ({ player }) => {
      messageApi.info(t('messages.playerJoined', { name: player.name }));
    });

    // 监听玩家离开
    socket.on('player_left', ({ playerName }) => {
      messageApi.warning(t('messages.playerLeft', { name: playerName }));
    });

    // 监听房间状态更新
    socket.on('room_updated', ({ room }) => {
      console.log('房间状态更新:', room);
      console.log('🎮 gameState.trumpRank =', room?.gameState?.trumpRank);
      console.log('🎮 gameState.trumpSuit =', room?.gameState?.trumpSuit);
      setCurrentRoom(room);
    });

    // 监听加入房间成功
    socket.on('room_joined', ({ room, player }) => {
      console.log('加入房间成功:', { room, player });
      messageApi.success(t('room.joinedRoom'));
      setCurrentRoom(room);
      setCurrentPlayer(player);
      setShowJoinModal(false);
    });

    // 监听观战者加入成功
    socket.on('spectator_joined', ({ room, spectator }) => {
      console.log('观战加入成功:', { room, spectator });
      messageApi.success(t('room.joinedAsSpectator'));
      setCurrentRoom(room);
      setCurrentSpectator(spectator);
      setShowWatchModal(false);
    });

    // 监听其他观战者加入
    socket.on('spectator_joined_room', ({ spectator }) => {
      messageApi.info(t('messages.spectatorJoined', { name: spectator.name }));
    });

    // 监听观战者离开
    socket.on('spectator_left', ({ spectatorName }) => {
      messageApi.info(t('messages.spectatorLeft', { name: spectatorName }));
    });

    // 监听房间列表
    socket.on('room_list', ({ rooms }) => {
      console.log('收到房间列表:', rooms);
      setRoomList(rooms);
      setLoadingRooms(false);
    });

    // Bot添加
    socket.on('bot_added', ({ player }) => {
      messageApi.success(t('messages.botAdded', { name: player.name }));
    });

    // Bot移除
    socket.on('bot_removed', ({ playerName }) => {
      messageApi.info(t('messages.botRemoved', { name: playerName }));
    });

    // 配置更新
    socket.on('config_updated', ({ config }) => {
      messageApi.success(t('messages.configUpdated'));
    });

    // 游戏开始 - 进入准备等待
    socket.on('game_started', ({ phase, isWaitingForReady }) => {
      console.log('游戏开始，等待玩家准备:', { phase, isWaitingForReady });
    });

    // 玩家准备状态更新
    socket.on('player_ready_status', ({ playerId, playerName, isReady }) => {
      messageApi.info(isReady ? t('messages.playerReady', { name: playerName }) : t('messages.playerCancelReady', { name: playerName }));
    });

    // 所有玩家准备完毕
    socket.on('all_players_ready', ({ message }) => {
      messageApi.success(t('messages.allPlayersReady'));
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
        bottomCardsCount: values.bottomCardsCount,
        dealInterval: values.dealInterval,
        playMode: values.isFreeMode ? 'free' : 'ordered'
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

  const handleWatchRoomFromList = (roomId) => {
    setSelectedRoomId(roomId);
    setSpectatorName(`${t('room.defaultSpectatorName')}${Math.floor(Math.random() * 1000)}`);
    setShowWatchModal(true);
  };

  const handleWatchRoom = () => {
    const socket = socketService.socket;
    socket.emit(SOCKET_EVENTS.JOIN_AS_SPECTATOR, {
      roomId: selectedRoomId,
      spectatorName: spectatorName || `${t('room.defaultSpectatorName')}${Math.floor(Math.random() * 1000)}`
    });
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
    messageApi.info(t('room.leftRoom'));
  };

  const handleLeaveSpectator = () => {
    const socket = socketService.socket;
    socket.emit(SOCKET_EVENTS.LEAVE_SPECTATOR, {
      roomId: currentRoom.id
    });
    setCurrentRoom(null);
    setCurrentSpectator(null);
    messageApi.info(t('room.leftSpectator'));
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
    if (newBottomCardsCount < 1 || newBottomCardsCount > 20) {
      messageApi.warning(t('createRoomForm.bottomCardsValidation'));
      return;
    }
    if (newDealInterval < 10 || newDealInterval > 5000) {
      messageApi.warning(t('createRoomForm.dealIntervalValidation'));
      return;
    }
    const socket = socketService.socket;
    socket.emit(SOCKET_EVENTS.UPDATE_CONFIG, {
      roomId: currentRoom.id,
      config: {
        bottomCardsCount: newBottomCardsCount,
        dealInterval: newDealInterval,
        playMode: newIsFreeMode ? 'free' : 'ordered',
        botType: newBotType
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
      setNewBottomCardsCount(currentRoom.config.bottomCardsCount);
      setNewDealInterval(currentRoom.config.dealInterval);
      setNewIsFreeMode(currentRoom.config.playMode === 'free');
      setNewBotType(currentRoom.config.botType || BotTypes.SIMPLE);
    }
  }, [currentRoom]);

  // 如果在房间内，显示房间界面或游戏界面
  if (currentRoom) {
    // 如果是观战者模式
    if (isSpectator) {
      return <GameBoard />;
    }

    // 如果游戏已开始（不在WAITING阶段）或正在等待准备，显示游戏界面
    const gamePhase = currentRoom.gameState?.phase || GamePhases.WAITING;
    const isWaitingForReady = currentRoom.gameState?.isWaitingForReady || false;
    if (gamePhase !== GamePhases.WAITING || isWaitingForReady) {
      return <GameBoard />;
    }

    // 否则显示房间等待界面
    return (
      <Layout style={{ minHeight: '100vh' }}>
        {contextHolder}
        <Header style={{ background: '#001529', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={3} style={{ color: 'white', margin: '16px 0' }}>
            {t('app.title')} - {currentRoom.name}
          </Title>
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
            <Button
              icon={<GlobalOutlined />}
              style={{ color: 'white', borderColor: 'white' }}
              ghost
            />
          </Dropdown>
        </Header>
        <Content style={{ padding: '24px' }}>
          <div style={{
            background: 'white',
            padding: '48px',
            borderRadius: '8px'
          }}>
            <Title level={2}>{t('room.roomName')}: {currentRoom.name}</Title>
            <p style={{ fontSize: '16px', marginBottom: '24px' }}>
              {t('room.roomId')}: {currentRoom.id}
            </p>
            <p style={{ fontSize: '16px', marginBottom: '24px' }}>
              {t('room.playerCount')}: {currentRoom.playerCount} / {currentRoom.maxPlayers}
            </p>
            <div style={{ marginBottom: '24px' }}>
              <Title level={4}>{t('room.playerList')}:</Title>
              {currentRoom.players.map((player, index) => (
                <div key={player.id} style={{ padding: '8px', background: '#f5f5f5', marginBottom: '8px', borderRadius: '4px' }}>
                  {index + 1}. {player.isBot && '🤖 '}{player.name}
                  {player.socketId === currentRoom.hostId && ` (${t('common.host')})`}
                  {player.id === currentPlayer?.id && ` (${t('common.you')})`}
                  {player.isBot && ` (${t('common.bot')})`}
                  {' - '} {t('common.score')}: {player.score} - {t('common.level')}: {player.level}
                </div>
              ))}
            </div>
            <div style={{ marginBottom: '24px' }}>
              <Title level={4}>{t('room.roomConfig')}:</Title>
              <p>{t('game.bottomCards')}: {currentRoom.config.bottomCardsCount} {t('common.cards')}</p>
              <p>{t('game.dealInterval')}: {currentRoom.config.dealInterval} ms</p>
              <p>{t('game.gameMode')}: {currentRoom.config.playMode === 'free' ? t('game.freeMode') : t('game.basicMode')}</p>
            </div>

            {/* Bot管理区域 - 仅房主可见 */}
            {currentPlayer?.socketId === currentRoom.hostId && currentRoom.players.some(p => p.isBot) && (
              <div style={{ marginBottom: '24px' }}>
                <Divider>{t('game.botsInRoom')}</Divider>
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
                    {t('game.startGame')}
                  </Button>
                  <Button
                    size="large"
                    onClick={handleAddBot}
                    disabled={currentRoom.playerCount >= currentRoom.maxPlayers}
                  >
                    {t('game.addBot')}
                  </Button>
                  <Button
                    size="large"
                    onClick={() => setShowConfigModal(true)}
                  >
                    {t('room.modifySettings')}
                  </Button>
                </>
              )}
              <Button type="default" onClick={handleLeaveRoom}>
                {t('room.leaveRoom')}
              </Button>
            </Space>
          </div>
        </Content>

        {/* 房间设置弹窗 */}
        <Modal
          title={t('room.roomSettings')}
          open={showConfigModal}
          onOk={handleUpdateConfig}
          onCancel={() => setShowConfigModal(false)}
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
                checked={newIsFreeMode}
                onChange={setNewIsFreeMode}
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
            <Text type="secondary">{t('createRoomForm.settingsEffectNote')}</Text>
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
          {t('app.title')}
        </Title>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ color: 'white' }}>
            {t('connection.connectionStatus')}: {isConnected ? `✅ ${t('connection.connected')}` : `❌ ${t('connection.disconnected')}`}
          </div>
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
            <Button
              icon={<GlobalOutlined />}
              style={{ color: 'white', borderColor: 'white' }}
              ghost
            />
          </Dropdown>
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
            <Title level={2}>{t('app.welcome')}</Title>
            <p style={{ color: '#666', marginBottom: '24px' }}>
              {t('app.subtitle')}
            </p>
            <Space size="large">
              <Button
                type="primary"
                size="large"
                disabled={!isConnected}
                onClick={() => setShowCreateModal(true)}
              >
                {t('room.createRoom')}
              </Button>
              <Button
                size="large"
                disabled={!isConnected}
                onClick={() => {
                  setSelectedRoomId('');
                  setShowJoinModal(true);
                }}
              >
                {t('room.joinRoom')}
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
            onWatchRoom={handleWatchRoomFromList}
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

      {/* 观战输入昵称弹窗 */}
      <Modal
        title={t('room.watch')}
        open={showWatchModal}
        onOk={handleWatchRoom}
        onCancel={() => {
          setShowWatchModal(false);
          setSelectedRoomId('');
          setSpectatorName('');
        }}
        okText={t('room.watch')}
        cancelText={t('common.cancel')}
      >
        <div>
          <Text strong>{t('createRoomForm.playerNameLabel')}:</Text>
          <br />
          <Input
            style={{ width: '100%', marginTop: 8 }}
            placeholder={t('room.defaultSpectatorName')}
            value={spectatorName}
            onChange={(e) => setSpectatorName(e.target.value)}
            maxLength={20}
          />
        </div>
      </Modal>
    </Layout>
  );
}

export default App;
