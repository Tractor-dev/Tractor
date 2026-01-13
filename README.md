# 拖拉机纸牌游戏模拟器

<div align="center">

一个功能完整的在线多人拖拉机纸牌游戏模拟器，支持2-4名玩家实时对战。

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-brightgreen)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-blue)](https://react.dev/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-orange)](https://socket.io/)
[![Deploy on Zeabur](https://img.shields.io/badge/Deploy%20on-Zeabur-blue)](https://zeabur.com)
[![License](https://img.shields.io/badge/License-MIT-yellow)](./LICENSE)

[功能特性](#功能特性) • [快速开始](#快速开始) • [游戏规则](#游戏规则) • [技术栈](#技术栈) • [部署指南](./DEPLOYMENT.md) • [文档](#文档)

</div>

---

## 功能特性

### ✅ 完整实现

- **房间系统**
  - 创建/加入房间
  - 房间列表实时更新
  - 房主权限管理
  - 断线重连处理

- **游戏流程**
  - 摸牌阶段：自动发牌、展示手牌
  - 埋底阶段：房主指定埋底玩家
  - 出牌阶段：有序/自由两种模式
  - 展示底牌：所有玩家确认
  - 游戏结束：分数/等级调整、重新开始

- **实时通信**
  - WebSocket 实时同步
  - 状态自动广播
  - 断线检测与通知

- **用户界面**
  - 精美的卡牌显示
  - 流畅的动画效果
  - 响应式布局
  - 房间列表管理

### 🎮 游戏规则

- **牌组**：2副标准扑克牌（含大小王）共108张
- **玩家**：2-4人
- **阶段**：等待 → 摸牌 → 埋底 → 出牌 → 揭底 → 结束
- **出牌模式**：
  - 有序模式：按顺序轮流出牌
  - 自由模式：抢先出牌

详细规则请参考 [游戏设计文档](docs/FINAL_GAME_DESIGN.md)

---

## 快速开始

### 一键部署到 Zeabur（推荐）🚀

最快的上线方式，无需配置服务器：

1. 访问 [Zeabur.com](https://zeabur.com/)
2. 使用 GitHub 登录
3. 选择 "从 GitHub 部署"
4. 选择本仓库 `Tractor-dev/Tractor`
5. 等待自动构建完成
6. 获得你的专属游戏链接！

完整部署指南请查看 [部署文档](./DEPLOYMENT.md)

### 本地开发环境

### 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0

### 安装与运行

#### 1. 克隆项目

```bash
git clone <repository-url>
cd Tractor
```

#### 2. 安装依赖

```bash
# 安装后端依赖
cd tractor-game-simulator/server
npm install

# 安装前端依赖
cd ../client
npm install
```

#### 3. 启动服务器

```bash
# 在 tractor-game-simulator/server 目录
npm start
```

服务器将运行在 `http://localhost:5001`

> **注意**：端口使用5001而非5000，以避免与macOS AirPlay Receiver冲突

#### 4. 启动前端

在新的终端窗口：

```bash
# 在 tractor-game-simulator/client 目录
npm run dev
```

前端将运行在 `http://localhost:3000`

#### 5. 开始游戏

1. 打开浏览器访问 `http://localhost:3000`
2. 点击"创建房间"或从房间列表"加入房间"
3. 等待其他玩家加入
4. 房主点击"开始游戏"

---

## 技术栈

### 后端

| 技术 | 版本 | 用途 |
|------|------|------|
| Node.js | 18+ | 运行环境 |
| Express | 4.x | Web框架 |
| Socket.IO | 4.x | WebSocket通信 |
| UUID | 9.x | 唯一ID生成 |

### 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18 | UI框架 |
| Vite | 5.x | 构建工具 |
| Ant Design | 5.x | UI组件库 |
| Socket.IO Client | 4.x | 实时通信 |
| Zustand | 4.x | 状态管理 |

---

## 项目结构

```
Tractor/
├── tractor-game-simulator/     # 主项目目录
│   ├── client/                  # 前端项目
│   │   ├── src/
│   │   │   ├── components/      # React组件
│   │   │   │   ├── Game/        # 游戏组件
│   │   │   │   │   ├── Card.jsx           # 卡牌组件
│   │   │   │   │   ├── Hand.jsx           # 手牌组件
│   │   │   │   │   └── GameBoard.jsx      # 游戏主界面
│   │   │   │   └── Room/        # 房间组件
│   │   │   │       ├── CreateRoomModal.jsx
│   │   │   │       ├── JoinRoomModal.jsx
│   │   │   │       └── RoomList.jsx
│   │   │   ├── services/        # 服务层
│   │   │   │   └── socket.js    # Socket.IO客户端
│   │   │   ├── store/           # 状态管理
│   │   │   │   └── gameStore.js # Zustand store
│   │   │   ├── utils/           # 工具函数
│   │   │   │   └── constants.js # 常量定义
│   │   │   ├── styles/          # 样式文件
│   │   │   ├── App.jsx          # 主应用
│   │   │   └── main.jsx         # 入口文件
│   │   ├── package.json
│   │   └── vite.config.js
│   │
│   └── server/                  # 后端项目
│       ├── src/
│       │   ├── models/          # 数据模型
│       │   │   ├── Card.js      # 卡牌模型
│       │   │   ├── Player.js    # 玩家模型
│       │   │   ├── Room.js      # 房间模型
│       │   │   └── GameState.js # 游戏状态
│       │   ├── services/        # 业务逻辑
│       │   │   ├── DeckService.js           # 牌组服务
│       │   │   ├── RoundManager.js          # 回合管理
│       │   │   ├── DrawingPhaseManager.js   # 摸牌阶段
│       │   │   ├── GameEngine.js            # 游戏引擎
│       │   │   └── RoomManager.js           # 房间管理
│       │   ├── socket/          # Socket处理
│       │   │   ├── handlers/
│       │   │   │   ├── roomHandlers.js      # 房间事件
│       │   │   │   ├── gameHandlers.js      # 游戏事件
│       │   │   │   └── playerHandlers.js    # 玩家事件
│       │   │   └── index.js     # Socket初始化
│       │   ├── utils/           # 工具函数
│       │   │   └── logger.js    # 日志工具
│       │   └── index.js         # 服务器入口
│       ├── package.json
│       └── .env                 # 环境变量
│
├── docs/                        # 文档目录
│   ├── FINAL_GAME_DESIGN.md     # 完整游戏设计
│   ├── DETAILED_IMPLEMENTATION.md # 实现细节
│   ├── SIMULATOR_DESIGN.md      # 初始设计
│   ├── TEST_REPORT.md           # 测试报告
│   └── archive/                 # 归档文件
│
├── TESTING_GUIDE.md             # 测试指南
├── README.md                    # 本文件
└── .gitignore
```

---

## 文档

- **[部署指南](DEPLOYMENT.md)** - 服务器部署完整教程
- **[测试指南](TESTING_GUIDE.md)** - 详细的测试步骤和检查清单
- **[游戏设计](docs/FINAL_GAME_DESIGN.md)** - 完整的游戏规则和设计文档
- **[实现细节](docs/DETAILED_IMPLEMENTATION.md)** - 技术实现说明
- **[测试报告](docs/TEST_REPORT.md)** - 项目测试结果

---

## 环境变量

### 后端 (.env)

```env
# 服务器端口（改为5001以避免与macOS AirPlay冲突）
PORT=5001

# 客户端URL（CORS配置）
CLIENT_URL=http://localhost:3000

# 日志级别 (ERROR, WARN, INFO, DEBUG)
LOG_LEVEL=INFO
```

### 前端

在 `client/.env` 中配置（可选）:

```env
VITE_SERVER_URL=http://localhost:5001
```

---

## Socket.IO 事件

### 客户端 → 服务器

| 事件 | 参数 | 说明 |
|------|------|------|
| `create_room` | `{name, playerName, config}` | 创建房间 |
| `join_room` | `{roomId, playerName}` | 加入房间 |
| `leave_room` | `{roomId}` | 离开房间 |
| `get_room_list` | - | 获取房间列表 |
| `start_game` | `{roomId}` | 开始游戏 |
| `show_cards` | `{roomId, cardIds}` | 展示手牌 |
| `set_burying_player` | `{roomId, playerId}` | 设置埋底玩家 |
| `bury_cards` | `{roomId, cardIds}` | 埋底 |
| `set_first_player` | `{roomId, playerId}` | 设置首发玩家 |
| `play_cards` | `{roomId, cardIds}` | 出牌 |
| `pass_turn` | `{roomId}` | 跳过 |
| `confirm_reveal` | `{roomId}` | 确认查看底牌 |
| `update_score` | `{roomId, playerId, newScore}` | 更新分数 |
| `update_level` | `{roomId, playerId, newLevel}` | 更新等级 |
| `restart_game` | `{roomId}` | 重新开始 |

### 服务器 → 客户端

| 事件 | 参数 | 说明 |
|------|------|------|
| `room_created` | `{room, player}` | 房间创建成功 |
| `room_joined` | `{room, player}` | 加入房间成功 |
| `room_updated` | `{room}` | 房间状态更新 |
| `room_list` | `{rooms}` | 房间列表 |
| `player_joined` | `{player}` | 玩家加入 |
| `player_left` | `{playerName}` | 玩家离开 |
| `game_started` | `{gameState}` | 游戏开始 |
| `card_dealt` | `{card}` | 收到手牌 |
| `cards_shown` | `{playerName, cards}` | 玩家展示手牌 |
| `burying_player_set` | `{playerName}` | 埋底玩家已设置 |
| `bottom_cards_received` | `{bottomCards}` | 收到底牌（私密） |
| `cards_buried` | `{playerName}` | 埋底完成 |
| `first_player_set` | `{playerName}` | 首发玩家已设置 |
| `cards_played` | `{playerName, cards}` | 玩家出牌 |
| `turn_passed` | `{playerName}` | 玩家跳过 |
| `turn_changed` | `{currentPlayerName}` | 回合切换 |
| `bottom_revealed` | `{bottomCards}` | 展示底牌 |
| `game_finished` | `{players, duration}` | 游戏结束 |
| `score_updated` | `{playerId, newScore}` | 分数已更新 |
| `level_updated` | `{playerId, newLevel}` | 等级已更新 |
| `game_restarted` | - | 游戏重新开始 |
| `error` | `{message}` | 错误消息 |

详细的事件定义和参数说明请参考 [游戏设计文档](docs/FINAL_GAME_DESIGN.md)

---

## 故障排查

### 后端无法启动

```bash
# 检查端口占用
lsof -i :5001

# 检查Node.js版本
node -v  # 应该 >= 18.0.0

# 检查环境变量
cat server/.env
```

### 前端无法连接

1. 确保后端服务器正在运行
2. 检查 `vite.config.js` 中的代理配置
3. 查看浏览器控制台错误
4. 确认防火墙未阻止端口

### Socket连接失败

1. 确认服务器URL正确
2. 检查CORS配置（`server/.env` 中的 `CLIENT_URL`）
3. 查看服务器日志

### 游戏状态不同步

1. 检查 `room_updated` 事件是否正确接收
2. 查看后端日志确认事件已发送
3. 确认所有客户端都在同一个Socket.IO房间

---

## 开发计划

### 已完成 ✅

- [x] 项目架构搭建
- [x] 后端核心功能
- [x] 前端基础框架
- [x] 房间系统
- [x] 游戏流程（所有阶段）
- [x] 卡牌UI组件
- [x] 实时状态同步
- [x] 房间列表与加入功能

### 待优化 🚧

- [ ] 牌型验证规则
- [ ] 胜负判定逻辑
- [ ] 手牌拖拽排序
- [ ] 游戏音效
- [ ] 聊天系统
- [ ] 观战模式
- [ ] 游戏回放
- [ ] 排行榜系统

### 部署 📦

- [ ] Docker化
- [ ] CI/CD配置
- [ ] 生产环境优化
- [ ] 性能优化
- [ ] 安全加固

---

## 贡献

欢迎提交Issue和Pull Request！

在提交PR前，请确保：
1. 代码通过ESLint检查
2. 所有测试通过
3. 更新相关文档

---

## 许可证

MIT License

---

## 联系方式

如有问题或建议，请提交Issue。

---

<div align="center">
Made with ❤️ by the Tractor Game Team
</div>
