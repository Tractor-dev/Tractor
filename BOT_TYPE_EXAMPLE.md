# Bot类型选择功能使用示例

## 前端集成示例

### 1. 在房间等待界面添加Bot类型选择器

```javascript
// 导入常量（需要与服务器端保持一致）
const BotTypes = {
  SIMPLE: 'simple',
  WHO_DESIGNED: 'who_designed'
};

// 房间组件示例
function RoomWaitingPanel({ socket, roomId, isHost }) {
  const [currentBotType, setCurrentBotType] = useState('simple');

  // 监听Bot类型更新
  useEffect(() => {
    socket.on('bot_type_updated', (data) => {
      console.log('Bot类型已更新:', data.botTypeName);
      setCurrentBotType(data.botType);
      // 可以显示通知：`Bot类型已设置为: ${data.botTypeName}`
    });

    return () => {
      socket.off('bot_type_updated');
    };
  }, [socket]);

  // 设置Bot类型
  const handleSetBotType = (botType) => {
    socket.emit('set_bot_type', {
      roomId: roomId,
      botType: botType
    });
  };

  return (
    <div className="room-waiting-panel">
      {isHost && (
        <div className="bot-type-selector">
          <h3>选择Bot类型</h3>
          <select
            value={currentBotType}
            onChange={(e) => handleSetBotType(e.target.value)}
          >
            <option value={BotTypes.SIMPLE}>简单Bot（默认）</option>
            <option value={BotTypes.WHO_DESIGNED}>WhoDesigned Bot（智能）</option>
          </select>
          <p className="bot-type-description">
            {currentBotType === BotTypes.SIMPLE
              ? '基于规则的简单策略，快速响应'
              : '基于强化学习的智能策略，更具挑战性'}
          </p>
        </div>
      )}

      {!isHost && (
        <div className="bot-type-info">
          <p>当前Bot类型: {currentBotType === BotTypes.SIMPLE ? '简单Bot' : 'WhoDesigned Bot'}</p>
        </div>
      )}
    </div>
  );
}
```

### 2. 使用 Socket.IO 直接调用

```javascript
// 连接到服务器
const socket = io('http://localhost:3000');

// 创建房间后设置Bot类型
socket.emit('create_room', {
  name: '我的房间',
  playerName: '玩家1'
});

socket.on('room_created', (data) => {
  const roomId = data.room.id;

  // 设置为WhoDesigned Bot
  socket.emit('set_bot_type', {
    roomId: roomId,
    botType: 'who_designed'
  });
});

// 监听Bot类型更新
socket.on('bot_type_updated', (data) => {
  console.log('Bot类型:', data.botType);
  console.log('Bot类型名称:', data.botTypeName);
});

// 错误处理
socket.on('error', (error) => {
  console.error('错误:', error.message);
});
```

### 3. React示例（完整流程）

```javascript
import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

const BotTypes = {
  SIMPLE: 'simple',
  WHO_DESIGNED: 'who_designed'
};

function GameRoom() {
  const [socket, setSocket] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [botType, setBotType] = useState('simple');
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    const newSocket = io('http://localhost:3000');
    setSocket(newSocket);

    // 监听事件
    newSocket.on('room_created', (data) => {
      setRoomId(data.room.id);
      setIsHost(true);
      setBotType(data.room.config.botType);
    });

    newSocket.on('bot_type_updated', (data) => {
      setBotType(data.botType);
      alert(`Bot类型已设置为: ${data.botTypeName}`);
    });

    newSocket.on('room_updated', (data) => {
      setPlayers(data.room.players);
      setBotType(data.room.config.botType);
    });

    return () => newSocket.close();
  }, []);

  const createRoom = () => {
    socket.emit('create_room', {
      name: '新房间',
      playerName: '房主'
    });
  };

  const changeBotType = (newBotType) => {
    socket.emit('set_bot_type', {
      roomId: roomId,
      botType: newBotType
    });
  };

  const addBot = () => {
    socket.emit('add_bot', {
      roomId: roomId,
      botName: `Bot${players.length + 1}`
    });
  };

  return (
    <div>
      <h1>拖拉机游戏房间</h1>

      {!roomId && (
        <button onClick={createRoom}>创建房间</button>
      )}

      {roomId && isHost && (
        <div>
          <h2>房间ID: {roomId}</h2>

          <div className="bot-settings">
            <h3>Bot设置</h3>

            <div className="bot-type-selector">
              <label>Bot类型:</label>
              <select
                value={botType}
                onChange={(e) => changeBotType(e.target.value)}
              >
                <option value={BotTypes.SIMPLE}>简单Bot</option>
                <option value={BotTypes.WHO_DESIGNED}>WhoDesigned Bot</option>
              </select>
            </div>

            <button onClick={addBot}>添加Bot</button>
          </div>

          <div className="players-list">
            <h3>玩家列表 ({players.length}人)</h3>
            <ul>
              {players.map(player => (
                <li key={player.id}>
                  {player.name} {player.isBot && '(Bot)'}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default GameRoom;
```

## 服务器端验证

### 测试Bot类型设置

```javascript
// 在服务器端可以通过日志查看Bot类型
// 日志会显示:
// "创建新的BotService实例，Bot类型: simple"
// 或
// "创建新的BotService实例，Bot类型: who_designed"
```

### 测试脚本

```javascript
// test_bot_type.js
const io = require('socket.io-client');
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('已连接到服务器');

  // 创建房间
  socket.emit('create_room', {
    name: '测试房间',
    playerName: '测试玩家'
  });
});

socket.on('room_created', (data) => {
  const roomId = data.room.id;
  console.log('房间已创建:', roomId);
  console.log('默认Bot类型:', data.room.config.botType);

  // 设置为WhoDesigned Bot
  setTimeout(() => {
    console.log('设置Bot类型为 WhoDesigned...');
    socket.emit('set_bot_type', {
      roomId: roomId,
      botType: 'who_designed'
    });
  }, 1000);
});

socket.on('bot_type_updated', (data) => {
  console.log('Bot类型已更新:');
  console.log('  - botType:', data.botType);
  console.log('  - botTypeName:', data.botTypeName);
});

socket.on('error', (error) => {
  console.error('错误:', error.message);
});
```

## 注意事项

1. **权限控制**: 只有房主可以设置Bot类型
2. **时机限制**: 只能在游戏等待阶段（waiting）修改
3. **自动清理**: 修改Bot类型后会自动清除现有的BotService实例
4. **默认值**: 新房间默认使用简单Bot（`simple`）
5. **持久化**: Bot类型设置会保存在房间配置中，通过`room_updated`事件同步
