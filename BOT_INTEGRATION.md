# Bot集成说明

## 概述

本项目已集成AI bot功能，允许房主在游戏房间中添加bot玩家。Bot使用Python实现。

## Bot类型

项目支持两种类型的bot：

### 1. WhoDesigned Bot（默认，推荐）
- **仓库**: https://github.com/Roushelfy/WhoDesigned
- **依赖**: 仅需Python 3（已移除torch依赖）
- **策略**: 基于强化学习训练的策略（不需要运行时推理）
- **优点**:
  - 部署快速
  - 无需额外Python包
  - 智能决策
  - 适合生产环境

### 2. 简化版Bot（备选）
- **位置**: `simple-bot/simple_bot.py`
- **依赖**: 仅需Python 3
- **策略**: 基于规则的简单策略
  - 开局时出最小的1-2张牌
  - 跟牌时出相同数量的牌
  - 随机选择具体出哪些牌
- **用途**: 作为备用方案或开发测试

## 安装步骤

### 本地开发环境

#### 1. 克隆bot仓库

在项目根目录下克隆bot仓库：

```bash
cd /path/to/Tractor
git clone https://github.com/Roushelfy/WhoDesigned.git
```

#### 2. 确认Python 3已安装

确保系统已安装Python 3：

```bash
python3 --version
```

WhoDesigned bot已移除torch依赖，不需要安装任何额外的Python包。

### Railway部署

Railway部署已自动配置了bot支持：

1. **自动安装Python 3.9**
   - 在nixpacks.toml中已配置Python环境

2. **自动克隆bot仓库**
   - 部署时会自动从GitHub克隆WhoDesigned仓库

3. **零额外依赖**
   - WhoDesigned bot不需要安装任何Python包
   - 部署速度快，资源占用小

✅ **开箱即用**：Railway部署时会自动配置好bot功能，无需任何额外配置。

## 配置选项

### 切换到简化版Bot（可选）

如果需要使用简化版bot而不是WhoDesigned bot，可以设置环境变量：

```bash
# .env文件或Railway环境变量
USE_SIMPLE_BOT=true
```

默认情况下使用WhoDesigned bot（推荐）。

## 使用方法

### 1. 房主添加bot

在游戏房间等待界面，房主可以通过以下Socket.IO事件添加bot：

```javascript
socket.emit('add_bot', {
  roomId: '房间ID',
  botName: 'Bot玩家名称'  // 可选，默认为Bot1, Bot2等
});
```

### 2. 房主移除bot

```javascript
socket.emit('remove_bot', {
  roomId: '房间ID',
  playerId: 'bot玩家ID'
});
```

### 3. Bot自动出牌

- 游戏开始后，设置首发玩家时，如果有bot，会自动开始出牌
- Bot会按照一定时间间隔（1.5秒思考 + 2秒轮次间隔）自动出牌
- Bot出牌失败时会自动跳过

## 技术细节

### 卡牌格式转换

项目使用的卡牌格式与bot需要的格式不同，BotService会自动进行转换：

**项目格式:**
- 花色: 'hearts', 'diamonds', 'clubs', 'spades', 'joker'
- 点数: '2'-'10', 'J', 'Q', 'K', 'A', 'small_joker', 'big_joker'
- ID: `suit-rank-copyIndex` (例如: 'hearts-A-0')

**Bot格式:**
- 花色: 'h'(红心), 'd'(方块), 'c'(梅花), 's'(黑桃)
- 点数: 'A', '2'-'9', '0'(10), 'J', 'Q', 'K'
- 大小王: 'jo'(小王), 'Jo'(大王)
- 卡牌名称: 花色+点数 (例如: 'hA', 's0', 'jo')

### Bot输入数据

Bot接收的输入格式：

```json
{
  "id": 0,           // 玩家索引 (0-3)
  "deck": ["hA", "s2", ...],  // 手牌
  "history": [["hA"], ["s2"], ...],  // 最近10次出牌历史
  "major": [],       // 主牌列表（暂未实现）
  "played": [        // 所有玩家的已出牌记录
    ["hA", "h2"],    // 玩家0的已出牌
    ["s3", "s4"],    // 玩家1的已出牌
    ["c5"],          // 玩家2的已出牌
    ["d6"]           // 玩家3的已出牌
  ]
}
```

### Bot输出数据

Bot返回的输出格式：

```json
{
  "player": 0,
  "action": ["hA", "s2"]  // 要出的牌
}
```

## Socket.IO事件

### 新增事件

1. **add_bot** - 房主添加bot
   - 请求: `{ roomId, botName? }`
   - 响应: `bot_added` - 广播bot加入信息

2. **remove_bot** - 房主移除bot
   - 请求: `{ roomId, playerId }`
   - 响应: `bot_removed` - 广播bot离开信息

### 修改的事件

- `room_updated` - 房间信息现在包含玩家的`isBot`字段
- `cards_played` - bot出牌时会触发此事件
- `player_finished` - bot打完所有牌时会触发此事件

## 限制和注意事项

1. 只能在游戏等待阶段（waiting phase）添加或移除bot
2. Bot数量 + 真实玩家数量不能超过房间最大玩家数
3. Bot使用Python 3运行，确保系统已安装Python 3
4. Bot调用超时时间为30秒
5. Bot决策失败时会自动跳过出牌

## 故障排除

### Bot无法启动

1. 检查Python 3是否已安装: `python3 --version`
2. 检查WhoDesigned目录是否存在
3. 检查__main__.py文件是否存在
4. 查看服务器日志中的错误信息

### Bot出牌失败

1. 检查bot模型文件是否存在
2. 检查Python依赖是否安装完整
3. 查看服务器日志中的详细错误信息

## 文件结构

```
Tractor/
├── WhoDesigned/                    # Bot仓库（需要手动克隆）
│   ├── __main__.py                # Bot入口
│   ├── model.py                   # Bot模型
│   ├── checkpoint/                # 模型文件
│   └── ...
└── tractor-game-simulator/
    └── server/
        └── src/
            ├── services/
            │   └── BotService.js  # Bot服务
            ├── models/
            │   └── Player.js      # 玩家模型（包含isBot字段）
            └── socket/
                └── handlers/
                    ├── roomHandlers.js   # 添加/移除bot事件
                    └── gameHandlers.js   # Bot自动出牌逻辑
```
