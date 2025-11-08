import { useState, useEffect } from 'react';
import { Layout, Typography, Button, message } from 'antd';
import socketService from './services/socket';
import { useGameStore } from './store/gameStore';
import CreateRoomModal from './components/Room/CreateRoomModal';
import GameBoard from './components/Game/GameBoard';
import { SOCKET_EVENTS, GamePhases } from './utils/constants';
import './styles/App.css';

const { Header, Content } = Layout;
const { Title } = Typography;

function App() {
  const [messageApi, contextHolder] = message.useMessage();
  const { isConnected, setIsConnected, currentRoom, setCurrentRoom, currentPlayer, setCurrentPlayer } = useGameStore();
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    // 连接Socket
    const socket = socketService.connect();

    socket.on('connect', () => {
      setIsConnected(true);
      messageApi.success('已连接到服务器');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      messageApi.warning('与服务器断开连接');
    });

    socket.on('error', (error) => {
      messageApi.error(error.message || '发生错误');
    });

    // 监听房间创建成功
    socket.on('room_created', ({ room, player }) => {
      console.log('收到房间创建成功事件:', { room, player });
      messageApi.success('房间创建成功！');
      setCurrentRoom(room);
      setCurrentPlayer(player);
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
      setCurrentRoom(room);
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
        dealInterval: values.dealInterval
      }
    });
  };

  const handleLeaveRoom = () => {
    const socket = socketService.socket;
    socket.emit(SOCKET_EVENTS.LEAVE_ROOM, {
      roomId: currentRoom.id
    });
    setCurrentRoom(null);
    setCurrentPlayer(null);
    messageApi.info('已离开房间');
  };

  // 如果在房间内，显示房间界面或游戏界面
  if (currentRoom) {
    // 如果游戏已开始，显示游戏界面
    const gamePhase = currentRoom.gameState?.phase || GamePhases.WAITING;
    if (gamePhase !== GamePhases.WAITING) {
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
                  {index + 1}. {player.name}
                  {player.id === currentRoom.hostId && ' (房主)'}
                  {player.id === currentPlayer?.id && ' (你)'}
                  - 分数: {player.score} - 等级: {player.level}
                </div>
              ))}
            </div>
            <div style={{ marginBottom: '24px' }}>
              <Title level={4}>房间配置:</Title>
              <p>底牌数量: {currentRoom.config.bottomCardsCount} 张</p>
              <p>发牌间隔: {currentRoom.config.dealInterval} 毫秒</p>
            </div>
            <Button type="default" onClick={handleLeaveRoom}>
              离开房间
            </Button>
          </div>
        </Content>
      </Layout>
    );
  }

  // 大厅界面
  return (
    <Layout style={{ minHeight: '100vh' }}>
      {contextHolder}
      <Header style={{ background: '#001529', padding: '0 24px' }}>
        <Title level={3} style={{ color: 'white', margin: '16px 0' }}>
          拖拉机纸牌游戏模拟器
        </Title>
      </Header>
      <Content style={{ padding: '24px' }}>
        <div style={{
          background: 'white',
          padding: '48px',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <Title level={2}>欢迎来到拖拉机纸牌游戏</Title>
          <p style={{ fontSize: '16px', marginBottom: '24px' }}>
            连接状态: {isConnected ? '✅ 已连接' : '❌ 未连接'}
          </p>
          <p style={{ color: '#666', marginBottom: '32px' }}>
            点击下方按钮创建房间开始游戏
          </p>
          <Button
            type="primary"
            size="large"
            disabled={!isConnected}
            onClick={() => setShowCreateModal(true)}
          >
            创建房间
          </Button>
        </div>
      </Content>

      <CreateRoomModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreateRoom={handleCreateRoom}
      />
    </Layout>
  );
}

export default App;
