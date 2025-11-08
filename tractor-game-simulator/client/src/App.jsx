import { useState, useEffect } from 'react';
import { Layout, Typography, Button, message } from 'antd';
import socketService from './services/socket';
import { useGameStore } from './store/gameStore';
import './styles/App.css';

const { Header, Content } = Layout;
const { Title } = Typography;

function App() {
  const [messageApi, contextHolder] = message.useMessage();
  const { isConnected, setIsConnected } = useGameStore();

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

    return () => {
      socketService.disconnect();
    };
  }, []);

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
            完整的游戏UI组件正在开发中...
          </p>
          <Button type="primary" size="large" disabled={!isConnected}>
            创建房间
          </Button>
        </div>
      </Content>
    </Layout>
  );
}

export default App;
