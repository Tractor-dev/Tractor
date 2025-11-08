# 拖拉机纸牌游戏模拟器 - 技术设计文档

## 项目概述

在线多人拖拉机纸牌游戏模拟器，支持4名玩家实时对战。

## 核心需求

### 功能需求
1. **房间系统**
   - 4名玩家加入房间
   - 房主权限管理
   - 房间状态管理

2. **游戏逻辑**
   - 108张扑克牌洗牌
   - 底牌数量可配置（N张）
   - 自动发牌（108-N张均分给4名玩家）
   - 牌自动排序（按花色分组，组内升序）
   - 支持玩家自定义排序

3. **游戏流程**
   - 房主指定首发玩家
   - 玩家依次出牌
   - 每次可出任意多张牌
   - 游戏进行直到所有牌打完

4. **玩家属性**
   - 分数（整数，全局可见，玩家可调整）
   - 等级（整数，全局可见，玩家可调整）
   - 重新开始时不重置

5. **房主控制**
   - 开始游戏
   - 重新开始
   - 配置底牌数量

## 技术方案

### 架构选择：网页端（前后端分离）

#### 方案对比

| 方案 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| 纯网页端 | 跨平台、无需安装、易部署 | 需要服务器 | ⭐⭐⭐⭐⭐ |
| 桌面客户端 | 性能好、体验佳 | 需要安装、更新麻烦 | ⭐⭐⭐ |
| 混合方案 | 灵活 | 开发成本高 | ⭐⭐ |

**最终推荐：网页端实现**

### 技术栈

#### 方案A：JavaScript全栈（推荐）

**前端：**
- React.js / Vue.js - UI框架
- Socket.IO Client - 实时通信
- CSS3 / Tailwind CSS - 样式
- react-dnd / Sortable.js - 拖拽排序

**后端：**
- Node.js + Express - Web框架
- Socket.IO - WebSocket实时通信
- 内存存储（开发阶段）或Redis（生产环境）

**优点：**
- 全栈使用JavaScript，技术栈统一
- Socket.IO提供完善的实时通信
- 生态丰富，社区支持好
- 适合实时游戏场景

#### 方案B：Python后端

**前端：** 同方案A

**后端：**
- Python + FastAPI - Web框架
- WebSocket / python-socketio - 实时通信
- Redis - 状态存储

**优点：**
- Python开发效率高
- 游戏逻辑代码清晰
- 适合熟悉Python的开发者

## 系统架构

```
┌─────────────────────────────────────────────────────┐
│                    前端 (Browser)                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ 房间界面 │  │ 游戏界面 │  │ 牌组件   │          │
│  └──────────┘  └──────────┘  └──────────┘          │
│              Socket.IO Client                        │
└─────────────────────────────────────────────────────┘
                        ↕ WebSocket
┌─────────────────────────────────────────────────────┐
│                   后端 (Node.js)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │房间管理器│  │游戏引擎  │  │ 状态管理 │          │
│  └──────────┘  └──────────┘  └──────────┘          │
│              Socket.IO Server                        │
└─────────────────────────────────────────────────────┘
```

## 数据模型

### 房间 (Room)
```javascript
{
  id: string,              // 房间ID
  name: string,            // 房间名称
  hostId: string,          // 房主玩家ID
  players: Player[],       // 玩家列表（最多4人）
  gameState: GameState,    // 游戏状态
  config: {
    bottomCardsCount: number  // 底牌数量
  }
}
```

### 玩家 (Player)
```javascript
{
  id: string,              // 玩家ID
  name: string,            // 玩家昵称
  score: number,           // 分数（玩家可调整）
  level: number,           // 等级（玩家可调整）
  cards: Card[],           // 手牌
  position: number         // 座位号（0-3）
}
```

### 游戏状态 (GameState)
```javascript
{
  status: 'waiting' | 'playing' | 'finished',
  deck: Card[],            // 剩余牌堆
  bottomCards: Card[],     // 底牌
  currentPlayerIndex: number,  // 当前出牌玩家索引
  playedCards: {           // 已打出的牌
    playerId: string,
    cards: Card[]
  }[],
  round: number            // 回合数
}
```

### 扑克牌 (Card)
```javascript
{
  id: string,              // 唯一ID
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades',
  rank: 2-10 | 'J' | 'Q' | 'K' | 'A',
  displayOrder: number     // 玩家自定义排序
}
```

## 核心功能模块

### 1. 房间管理模块
- 创建房间
- 加入房间
- 离开房间
- 房间列表查询

### 2. 游戏引擎模块
- 洗牌算法（Fisher-Yates）
- 发牌逻辑
- 自动排序（花色分组 + 大小排序）
- 出牌验证
- 回合管理

### 3. 实时通信模块
- 房间事件广播
- 玩家动作同步
- 状态更新推送

### 4. UI组件模块
- 房间大厅
- 游戏桌面
- 手牌展示（支持拖拽排序）
- 玩家信息面板
- 房主控制面板

## WebSocket事件定义

### 客户端 → 服务器

| 事件名 | 参数 | 说明 |
|--------|------|------|
| `create_room` | `{name, config}` | 创建房间 |
| `join_room` | `{roomId, playerName}` | 加入房间 |
| `leave_room` | `{roomId}` | 离开房间 |
| `start_game` | `{roomId}` | 开始游戏（房主） |
| `restart_game` | `{roomId}` | 重新开始（房主） |
| `play_cards` | `{roomId, cardIds}` | 出牌 |
| `update_score` | `{roomId, score}` | 更新分数 |
| `update_level` | `{roomId, level}` | 更新等级 |
| `reorder_cards` | `{roomId, cardOrder}` | 手牌重新排序 |
| `set_first_player` | `{roomId, playerId}` | 设置首发玩家（房主） |

### 服务器 → 客户端

| 事件名 | 参数 | 说明 |
|--------|------|------|
| `room_created` | `{room}` | 房间创建成功 |
| `room_joined` | `{room, playerId}` | 加入房间成功 |
| `player_joined` | `{player}` | 其他玩家加入 |
| `player_left` | `{playerId}` | 玩家离开 |
| `game_started` | `{gameState}` | 游戏开始 |
| `cards_dealt` | `{cards}` | 收到手牌 |
| `cards_played` | `{playerId, cards}` | 玩家出牌 |
| `turn_changed` | `{currentPlayerId}` | 回合切换 |
| `player_updated` | `{player}` | 玩家信息更新 |
| `game_finished` | `{winner}` | 游戏结束 |
| `error` | `{message}` | 错误消息 |

## 开发阶段规划

### Phase 1: 基础架构（1-2周）
- [ ] 搭建前端项目框架
- [ ] 搭建后端服务器
- [ ] 实现Socket.IO连接
- [ ] 实现房间创建和加入功能
- [ ] 基础UI界面

### Phase 2: 游戏核心（2-3周）
- [ ] 实现洗牌发牌逻辑
- [ ] 手牌排序功能
- [ ] 出牌功能
- [ ] 回合管理
- [ ] 游戏状态同步

### Phase 3: 玩家交互（1-2周）
- [ ] 手牌拖拽排序
- [ ] 分数/等级调整
- [ ] 房主控制面板
- [ ] 玩家信息展示

### Phase 4: 优化和测试（1-2周）
- [ ] UI/UX优化
- [ ] 性能优化
- [ ] 断线重连
- [ ] 错误处理
- [ ] 多人测试

## 部署方案

### 开发环境
- 前端：`npm run dev` (localhost:3000)
- 后端：`npm run server` (localhost:5000)

### 生产环境

#### 方案1：一体部署
- 使用Express同时托管静态文件和WebSocket
- 部署到Heroku/Render/Railway等平台

#### 方案2：分离部署
- 前端：Vercel/Netlify
- 后端：Heroku/Render/Railway
- 需要配置CORS

## 技术挑战与解决方案

### 1. 实时性保证
**挑战：** 多人游戏需要低延迟通信
**方案：** 使用WebSocket (Socket.IO) + 优化数据传输

### 2. 状态同步
**挑战：** 4名玩家状态一致性
**方案：** 服务器作为唯一真实状态源，客户端只做展示

### 3. 断线处理
**挑战：** 玩家网络断开
**方案：** 实现断线重连 + 状态恢复机制

### 4. 防作弊
**挑战：** 玩家不能看到其他玩家手牌
**方案：** 服务器只发送玩家自己的手牌，其他玩家只显示牌数

## 扩展功能（未来）
- 聊天系统
- 游戏回放
- 游戏记录统计
- AI玩家
- 观战模式
- 自定义规则（结合现有DLC.json）

## 开发工具
- VS Code
- Postman / Insomnia (API测试)
- Chrome DevTools
- Git版本控制

## 代码仓库结构

```
tractor-game-simulator/
├── client/                 # 前端代码
│   ├── src/
│   │   ├── components/    # React组件
│   │   ├── pages/         # 页面
│   │   ├── hooks/         # 自定义Hooks
│   │   ├── utils/         # 工具函数
│   │   └── socket.js      # Socket.IO客户端
│   ├── public/
│   └── package.json
├── server/                # 后端代码
│   ├── src/
│   │   ├── models/        # 数据模型
│   │   ├── services/      # 业务逻辑
│   │   ├── socket/        # Socket.IO处理
│   │   └── index.js       # 入口文件
│   └── package.json
└── README.md
```

## 估算工作量
- 单人开发：6-8周
- 双人开发：4-5周

## 下一步行动
1. 确认技术栈选择（JavaScript全栈 vs Python后端）
2. 创建项目代码仓库
3. 搭建基础框架
4. 开发MVP（最小可行产品）
