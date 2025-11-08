# 拖拉机纸牌游戏模拟器

一个在线多人拖拉机纸牌游戏模拟器，支持2-4名玩家实时对战。

## 技术栈

### 前端
- React 18 + Vite
- Ant Design - UI组件库
- Socket.IO Client - 实时通信
- Zustand - 状态管理
- @dnd-kit - 拖拽功能

### 后端
- Node.js + Express
- Socket.IO - WebSocket服务器
- UUID - 唯一ID生成

## 项目结构

```
tractor-game-simulator/
├── client/                 # 前端项目
│   ├── src/
│   │   ├── components/    # React组件
│   │   ├── services/      # Socket.IO客户端
│   │   ├── store/         # Zustand状态管理
│   │   ├── utils/         # 工具函数
│   │   ├── styles/        # 样式文件
│   │   ├── App.jsx        # 主应用组件
│   │   └── main.jsx       # 入口文件
│   ├── package.json
│   └── vite.config.js
│
├── server/                # 后端项目
│   ├── src/
│   │   ├── models/        # 数据模型
│   │   ├── services/      # 业务逻辑
│   │   ├── socket/        # Socket.IO处理
│   │   ├── utils/         # 工具函数
│   │   └── index.js       # 服务器入口
│   ├── package.json
│   └── .env
│
└── README.md
```

## 快速开始

### 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0

### 安装依赖

```bash
# 安装后端依赖
cd server
npm install

# 安装前端依赖
cd ../client
npm install
```

### 启动项目

**1. 启动后端服务器**

```bash
cd server
npm run dev
```

服务器将运行在 `http://localhost:5001`

> **注意**: 端口使用5001而非5000，以避免与macOS AirPlay Receiver冲突

**2. 启动前端开发服务器**

新开一个终端窗口：

```bash
cd client
npm run dev
```

前端将运行在 `http://localhost:3000`

### 访问应用

在浏览器中打开 `http://localhost:3000`

## 游戏规则

### 牌组配置
- **总牌数**: 108张
- **构成**: 2副标准扑克牌（含大小王各2张）

### 玩家配置
- **人数**: 2-4人（弹性）
- **初始分数**: 0
- **初始等级**: 2

### 游戏流程

#### 1. 摸牌阶段 (DRAWING)
- 系统按间隔自动发牌
- 玩家可以随时展示手牌
- 手牌自动排序

#### 2. 埋底阶段 (BURYING)
- 房主指定埋底玩家
- 埋底玩家获得底牌并埋牌

#### 3. 出牌阶段 (PLAYING)
- 两种模式交替：有序出牌 / 自由抢先
- 完全自由出牌，无牌型限制
- 支持跳过

#### 4. 展示底牌 (REVEALING)
- 所有玩家查看底牌
- 所有人确认后进入结束

#### 5. 游戏结束 (FINISHED)
- 可调整分数和等级
- 房主可重新开始

## 核心功能

### 已实现（后端）
- ✅ 房间创建和管理
- ✅ 玩家加入/离开
- ✅ 洗牌和发牌系统
- ✅ 摸牌阶段（定时发牌）
- ✅ 埋底系统
- ✅ 出牌系统
- ✅ 回合管理（有序/自由模式）
- ✅ 展示手牌功能
- ✅ 分数/等级管理
- ✅ 断线处理

### 开发中（前端）
- 🚧 房间大厅界面
- 🚧 游戏主界面
- 🚧 手牌展示和拖拽
- 🚧 出牌控制
- 🚧 实时状态同步

## 环境变量

### 后端 (.env)
```env
PORT=5001
CLIENT_URL=http://localhost:3000
LOG_LEVEL=INFO
```

### 前端
在 `client/.env` 中配置（可选）:
```env
VITE_SERVER_URL=http://localhost:5001
```

## API文档

### Socket.IO事件

详细的Socket事件定义请参考 `FINAL_GAME_DESIGN.md`

### 客户端 → 服务器
- `create_room` - 创建房间
- `join_room` - 加入房间
- `start_game` - 开始游戏
- `play_cards` - 出牌
- ...更多

### 服务器 → 客户端
- `room_created` - 房间创建成功
- `game_started` - 游戏开始
- `cards_played` - 玩家出牌
- ...更多

## 开发计划

### Phase 1: 基础框架 ✅
- [x] 项目结构搭建
- [x] 后端核心功能
- [x] 前端基础设施

### Phase 2: 核心游戏功能 🚧
- [ ] 完整游戏UI
- [ ] 手牌拖拽排序
- [ ] 房间管理界面
- [ ] 游戏状态展示

### Phase 3: 优化和测试
- [ ] 性能优化
- [ ] 错误处理
- [ ] 多人测试
- [ ] UI/UX优化

### Phase 4: 部署
- [ ] 生产环境配置
- [ ] Docker化
- [ ] 部署文档

## 故障排查

### 后端无法启动
- 检查Node.js版本
- 检查端口5001是否被占用（macOS用户注意：端口5000被AirPlay占用）
- 查看 `server/.env` 配置

### 前端无法连接
- 确保后端服务器正在运行
- 检查 `vite.config.js` 中的代理配置
- 查看浏览器控制台错误

### Socket连接失败
- 确认服务器URL正确
- 检查CORS配置
- 查看服务器日志

## 贡献

欢迎提交Issue和Pull Request！

## 许可证

MIT License

## 联系方式

如有问题请提交Issue。
