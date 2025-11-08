# 拖拉机纸牌游戏模拟器 - 详细实现文档

## 技术栈确认

### 前端
- **框架**: React 18 + Vite
- **UI组件**: Ant Design
- **拖拽**: dnd-kit
- **实时通信**: Socket.IO Client
- **状态管理**: Zustand (轻量级)
- **HTTP请求**: Axios

### 后端
- **运行时**: Node.js >= 18
- **框架**: Express
- **实时通信**: Socket.IO
- **数据存储**: 内存（开发阶段）

## 游戏完整流程

### 阶段1: 摸牌阶段 (DRAWING)
- 系统以固定间隔（房主可调整，如每0.5秒）依次给4名玩家发牌
- 发牌顺序：玩家1 → 玩家2 → 玩家3 → 玩家4 → 玩家1 → ...
- 每次每人发1张，直到发完 (108 - 底牌数) 张
- **玩家可以随时"展示"（show）自己的任意牌给所有人看**
- 展示的牌仍在手中，只是公开可见

### 阶段2: 埋底阶段 (BURYING)
- **确定埋底玩家**: 由房主指定 或 通过某种规则确定（需确认）
- 埋底玩家拿走所有底牌（默认8张）
- 埋底玩家从自己手牌中选择等量的牌埋回底牌
- 埋底的牌对其他玩家不可见
- 埋底完成后进入出牌阶段

### 阶段3: 出牌阶段 (PLAYING)
- 由埋底的玩家开始首发出牌
- 玩家依次出牌（顺时针或房主指定顺序）
- 每次可出任意多张牌（包括0张=跳过）
- 完全自由出牌，无牌型限制
- 所有玩家都能看到出的具体牌
- 出完所有手牌的玩家等待其他人
- 直到所有玩家都出完手牌

### 阶段4: 展示底牌 (REVEALING)
- 自动展示底牌给所有玩家查看
- 玩家可以查看底牌内容

### 阶段5: 游戏结束 (FINISHED)
- 显示游戏结果
- 玩家可以调整自己的分数和等级
- 房主可以选择"重新开始"（分数和等级不重置）

## 游戏状态机

```javascript
const GamePhases = {
  WAITING: 'waiting',         // 等待玩家加入
  DRAWING: 'drawing',         // 摸牌阶段
  BURYING: 'burying',         // 埋底阶段
  PLAYING: 'playing',         // 出牌阶段
  REVEALING: 'revealing',     // 展示底牌
  FINISHED: 'finished'        // 游戏结束
};

// 状态转换
WAITING → (房主点击开始) → DRAWING
DRAWING → (发牌完成) → BURYING
BURYING → (埋底完成) → PLAYING
PLAYING → (所有人出完牌) → REVEALING
REVEALING → (查看完底牌) → FINISHED
FINISHED → (房主重新开始) → DRAWING
```

## 数据模型

### 房间 (Room)
```javascript
{
  id: string,                    // 房间ID
  name: string,                  // 房间名称
  hostId: string,                // 房主玩家ID
  players: Player[],             // 玩家列表（2-4人）
  gameState: GameState,          // 游戏状态
  config: {
    bottomCardsCount: number,    // 底牌数量（默认8）
    dealInterval: number,        // 发牌间隔（毫秒，默认500）
    minPlayers: number,          // 最少玩家数（默认2）
    maxPlayers: number           // 最多玩家数（4）
  },
  createdAt: Date,
  updatedAt: Date
}
```

### 玩家 (Player)
```javascript
{
  id: string,                    // 玩家唯一ID
  socketId: string,              // Socket连接ID
  name: string,                  // 玩家昵称
  score: number,                 // 分数（默认0）
  level: number,                 // 等级（默认1）
  cards: Card[],                 // 手牌
  shownCards: Set<string>,       // 已展示的牌ID集合
  position: number,              // 座位号（0-3）
  isReady: boolean,              // 是否准备
  isOnline: boolean              // 是否在线
}
```

### 游戏状态 (GameState)
```javascript
{
  phase: GamePhases,             // 当前阶段
  deck: Card[],                  // 剩余牌堆（摸牌阶段使用）
  bottomCards: Card[],           // 底牌
  buryingPlayerId: string | null,// 埋底玩家ID
  currentPlayerIndex: number,    // 当前出牌玩家索引
  drawingIndex: number,          // 当前发牌到第几张
  playedHistory: PlayRecord[],   // 出牌记录
  round: number,                 // 当前回合数
  startTime: Date | null,        // 游戏开始时间
  endTime: Date | null           // 游戏结束时间
}
```

### 扑克牌 (Card)
```javascript
{
  id: string,                    // 唯一ID（如 "hearts-A-0"）
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades' | 'joker',
  rank: '2' | '3' | ... | 'K' | 'A' | 'small_joker' | 'big_joker',
  value: number,                 // 排序用的数值
  displayOrder: number,          // 玩家自定义排序
  isShown: boolean               // 是否已被展示
}
```

### 出牌记录 (PlayRecord)
```javascript
{
  playerId: string,
  playerName: string,
  cards: Card[],                 // 打出的牌
  timestamp: Date,
  round: number
}
```

## 核心算法

### 1. 创建牌堆（108张牌）

```javascript
// server/src/services/DeckService.js

class DeckService {
  static createDeck() {
    const deck = [];
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

    // 两副普通牌（每副52张）
    for (let copy = 0; copy < 2; copy++) {
      for (let suit of suits) {
        for (let rank of ranks) {
          deck.push({
            id: `${suit}-${rank}-${copy}`,
            suit,
            rank,
            value: this.getCardValue(rank),
            displayOrder: 0,
            isShown: false
          });
        }
      }
    }

    // 添加大小王各2张（共4张）
    for (let i = 0; i < 2; i++) {
      deck.push({
        id: `joker-small-${i}`,
        suit: 'joker',
        rank: 'small_joker',
        value: 100,
        displayOrder: 0,
        isShown: false
      });

      deck.push({
        id: `joker-big-${i}`,
        suit: 'joker',
        rank: 'big_joker',
        value: 101,
        displayOrder: 0,
        isShown: false
      });
    }

    return deck; // 总共108张
  }

  static getCardValue(rank) {
    const values = {
      '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
      '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
    };
    return values[rank] || 0;
  }

  // Fisher-Yates 洗牌
  static shuffle(deck) {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // 准备发牌（分离底牌）
  static prepareDeal(deck, bottomCardsCount) {
    const bottomCards = deck.slice(0, bottomCardsCount);
    const remainingDeck = deck.slice(bottomCardsCount);
    return { bottomCards, remainingDeck };
  }
}

export default DeckService;
```

### 2. 自动排序算法

```javascript
// client/src/utils/cardSort.js

const SUIT_ORDER = {
  'hearts': 0,
  'diamonds': 1,
  'clubs': 2,
  'spades': 3,
  'joker': 4
};

const RANK_ORDER = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
  'small_joker': 100,
  'big_joker': 101
};

export function autoSortCards(cards) {
  return [...cards].sort((a, b) => {
    // 先按花色排序
    const suitDiff = SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
    if (suitDiff !== 0) return suitDiff;

    // 同花色按大小排序
    return RANK_ORDER[a.rank] - RANK_ORDER[b.rank];
  });
}
```

### 3. 摸牌定时器

```javascript
// server/src/services/GameEngine.js

class GameEngine {
  constructor(room, io) {
    this.room = room;
    this.io = io;
    this.dealTimer = null;
  }

  startDrawingPhase() {
    const { bottomCardsCount, dealInterval } = this.room.config;
    const playerCount = this.room.players.length;

    // 洗牌并准备
    const deck = DeckService.shuffle(DeckService.createDeck());
    const { bottomCards, remainingDeck } = DeckService.prepareDeal(deck, bottomCardsCount);

    this.room.gameState.bottomCards = bottomCards;
    this.room.gameState.deck = remainingDeck;
    this.room.gameState.phase = 'drawing';
    this.room.gameState.drawingIndex = 0;

    // 广播摸牌开始
    this.io.to(this.room.id).emit('drawing_started', {
      totalCards: remainingDeck.length,
      bottomCardsCount,
      dealInterval
    });

    // 定时发牌
    this.dealTimer = setInterval(() => {
      this.dealOneCard();
    }, dealInterval);
  }

  dealOneCard() {
    const { deck, drawingIndex } = this.room.gameState;
    const playerCount = this.room.players.length;

    // 检查是否发完
    if (drawingIndex >= deck.length) {
      clearInterval(this.dealTimer);
      this.dealTimer = null;
      this.finishDrawingPhase();
      return;
    }

    // 确定这张牌发给谁
    const playerIndex = drawingIndex % playerCount;
    const player = this.room.players[playerIndex];
    const card = deck[drawingIndex];

    // 将牌加入玩家手牌
    player.cards.push(card);

    // 自动排序
    player.cards = autoSortCards(player.cards);

    // 只发给该玩家（隐私）
    this.io.to(player.socketId).emit('card_received', {
      card,
      totalCards: player.cards.length
    });

    // 广播发牌进度（不包含具体牌）
    this.io.to(this.room.id).emit('deal_progress', {
      playerIndex,
      playerName: player.name,
      progress: drawingIndex + 1,
      total: deck.length
    });

    this.room.gameState.drawingIndex++;
  }

  finishDrawingPhase() {
    this.room.gameState.phase = 'burying';

    // 广播进入埋底阶段
    this.io.to(this.room.id).emit('phase_changed', {
      phase: 'burying',
      message: '摸牌完成，等待房主指定埋底玩家'
    });
  }
}
```

## Socket事件完整列表

### 客户端 → 服务器

#### 房间管理
| 事件名 | 参数 | 说明 |
|--------|------|------|
| `create_room` | `{name, config}` | 创建房间 |
| `join_room` | `{roomId, playerName}` | 加入房间 |
| `leave_room` | `{roomId}` | 离开房间 |
| `get_room_list` | - | 获取房间列表 |

#### 游戏控制（房主）
| 事件名 | 参数 | 说明 |
|--------|------|------|
| `start_game` | `{roomId}` | 开始游戏（进入摸牌阶段） |
| `restart_game` | `{roomId}` | 重新开始 |
| `update_config` | `{roomId, config}` | 更新房间配置 |
| `set_burying_player` | `{roomId, playerId}` | 指定埋底玩家 |

#### 玩家操作
| 事件名 | 参数 | 说明 |
|--------|------|------|
| `show_cards` | `{roomId, cardIds}` | 展示手牌（摸牌阶段） |
| `bury_cards` | `{roomId, cardIds}` | 埋底（埋底阶段） |
| `play_cards` | `{roomId, cardIds}` | 出牌（出牌阶段） |
| `pass_turn` | `{roomId}` | 跳过本回合 |
| `reorder_cards` | `{roomId, cardOrder}` | 手牌重排序 |
| `update_score` | `{roomId, score}` | 更新自己的分数 |
| `update_level` | `{roomId, level}` | 更新自己的等级 |
| `reveal_bottom` | `{roomId}` | 确认查看底牌完毕 |

### 服务器 → 客户端

#### 房间事件
| 事件名 | 参数 | 说明 |
|--------|------|------|
| `room_created` | `{room}` | 房间创建成功 |
| `room_list` | `{rooms}` | 房间列表 |
| `room_joined` | `{room, player, position}` | 加入房间成功 |
| `player_joined` | `{player}` | 其他玩家加入 |
| `player_left` | `{playerId, playerName}` | 玩家离开 |
| `room_updated` | `{room}` | 房间信息更新 |

#### 游戏阶段事件
| 事件名 | 参数 | 说明 |
|--------|------|------|
| `game_started` | `{phase, config}` | 游戏开始 |
| `phase_changed` | `{phase, message}` | 阶段切换 |
| `drawing_started` | `{totalCards, bottomCardsCount}` | 开始摸牌 |
| `deal_progress` | `{playerIndex, progress, total}` | 发牌进度 |
| `card_received` | `{card, totalCards}` | 收到一张牌（私密） |

#### 玩家动作事件
| 事件名 | 参数 | 说明 |
|--------|------|------|
| `cards_shown` | `{playerId, playerName, cards}` | 玩家展示牌 |
| `burying_player_set` | `{playerId, playerName}` | 埋底玩家已指定 |
| `bottom_cards_taken` | `{playerId}` | 埋底玩家拿走底牌 |
| `cards_buried` | `{playerId}` | 埋底完成 |
| `cards_played` | `{playerId, playerName, cards, remainingCount}` | 玩家出牌 |
| `turn_passed` | `{playerId, playerName}` | 玩家跳过 |
| `turn_changed` | `{currentPlayerId, currentPlayerName}` | 回合切换 |
| `player_finished` | `{playerId, playerName}` | 玩家打完所有牌 |

#### 游戏结束事件
| 事件名 | 参数 | 说明 |
|--------|------|------|
| `bottom_revealed` | `{bottomCards}` | 展示底牌 |
| `game_finished` | `{players, duration}` | 游戏结束 |

#### 玩家状态事件
| 事件名 | 参数 | 说明 |
|--------|------|------|
| `player_updated` | `{player}` | 玩家信息更新 |
| `player_disconnected` | `{playerId}` | 玩家断线 |
| `game_terminated` | `{reason}` | 游戏因玩家离开而终止 |

#### 错误事件
| 事件名 | 参数 | 说明 |
|--------|------|------|
| `error` | `{message, code}` | 错误消息 |

## UI界面设计

### 1. 房间大厅页面
```
┌─────────────────────────────────────────┐
│  拖拉机纸牌模拟器                        │
├─────────────────────────────────────────┤
│  [创建房间]  [刷新列表]                  │
├─────────────────────────────────────────┤
│  房间列表:                               │
│  ┌────────────────────────────────────┐ │
│  │ 房间名    玩家数    状态    操作   │ │
│  │ 测试房间   2/4     等待中  [加入] │ │
│  │ 第二局     4/4     游戏中   -     │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### 2. 房间准备页面
```
┌──────────────────────────────────────────┐
│  房间: 测试房间  (房主: 玩家1)            │
├──────────────────────────────────────────┤
│  玩家列表:                                │
│  1. 玩家1 (房主) - 分数:0  等级:1         │
│  2. 玩家2       - 分数:0  等级:1         │
│  3. (空位)                                │
│  4. (空位)                                │
├──────────────────────────────────────────┤
│  房间设置 (房主可调整):                   │
│  底牌数量: [8] 张                         │
│  发牌间隔: [500] 毫秒                     │
├──────────────────────────────────────────┤
│  [开始游戏]  [离开房间]                   │
└──────────────────────────────────────────┘
```

### 3. 游戏主界面（摸牌/出牌阶段）

```
┌─────────────────────────────────────────────────┐
│          玩家1 (房主)  分数:0  等级:1  牌:26张   │
│                  [已出牌区域]                    │
├─────────────────────────────────────────────────┤
│ 玩家2           游戏状态: 出牌阶段              玩家4 │
│ 分数:0          当前玩家: 玩家3                 分数:0 │
│ 等级:1          底牌: 8张                       等级:1 │
│ 牌:25张         回合: 15                        牌:27张 │
│                                                        │
│ [已出牌]                            [已出牌]           │
├────────────────────────────────────────────────┤
│  玩家3 (你)    分数:0  等级:1  牌:30张          │
│  ┌─────────────────────────────────────────┐   │
│  │ 手牌区域（可拖拽排序）:                 │   │
│  │ [♥2] [♥2] [♥3] [♦5] [♠K] ... [🃏] [🃏]  │   │
│  └─────────────────────────────────────────┘   │
│  选中: 3张  [出牌] [跳过] [展示选中牌] [自动排序] │
└────────────────────────────────────────────────┘
```

### 4. 埋底界面（埋底玩家专用）

```
┌─────────────────────────────────────────┐
│  埋底阶段 - 你是埋底玩家                 │
├─────────────────────────────────────────┤
│  底牌（8张）:                            │
│  [♥5] [♦7] [♣K] [♠A] [♥10] [♦J] [♣2] [♠3] │
├─────────────────────────────────────────┤
│  你的手牌（35张）:                       │
│  [可拖拽选择要埋的牌]                    │
│  [♥2] [♥2] [♥3] [♦5] ...                │
├─────────────────────────────────────────┤
│  已选择埋底: 5张  还需选择: 3张          │
│  [确认埋底]                              │
└─────────────────────────────────────────┘
```

## 关键功能实现细节

### 1. 展示手牌功能（摸牌阶段）

玩家可以在摸牌阶段随时选择部分手牌展示给所有人看：

```javascript
// 客户端
function showSelectedCards(selectedCardIds) {
  socket.emit('show_cards', {
    roomId: currentRoom.id,
    cardIds: selectedCardIds
  });
}

// 服务器
socket.on('show_cards', ({ roomId, cardIds }) => {
  const room = roomManager.getRoom(roomId);
  const player = room.findPlayerBySocketId(socket.id);

  // 只在摸牌阶段允许展示
  if (room.gameState.phase !== 'drawing') {
    socket.emit('error', { message: '只能在摸牌阶段展示手牌' });
    return;
  }

  // 验证牌是否在玩家手中
  const validCards = cardIds.filter(id =>
    player.cards.some(c => c.id === id)
  );

  // 标记为已展示
  validCards.forEach(id => player.shownCards.add(id));

  // 广播展示的牌
  const cardsToShow = player.cards.filter(c => validCards.includes(c.id));
  io.to(roomId).emit('cards_shown', {
    playerId: player.id,
    playerName: player.name,
    cards: cardsToShow
  });
});
```

### 2. 埋底流程

```javascript
// 服务器：房主指定埋底玩家
socket.on('set_burying_player', ({ roomId, playerId }) => {
  const room = roomManager.getRoom(roomId);

  // 验证权限
  if (room.hostId !== socket.id) {
    socket.emit('error', { message: '只有房主可以指定埋底玩家' });
    return;
  }

  // 验证阶段
  if (room.gameState.phase !== 'burying') {
    socket.emit('error', { message: '当前不是埋底阶段' });
    return;
  }

  room.gameState.buryingPlayerId = playerId;
  const buryingPlayer = room.findPlayerById(playerId);

  // 将底牌发给埋底玩家
  buryingPlayer.cards = [...buryingPlayer.cards, ...room.gameState.bottomCards];
  buryingPlayer.cards = autoSortCards(buryingPlayer.cards);

  // 私密发送底牌
  io.to(buryingPlayer.socketId).emit('bottom_cards_taken', {
    bottomCards: room.gameState.bottomCards,
    totalCards: buryingPlayer.cards.length
  });

  // 广播埋底玩家
  io.to(roomId).emit('burying_player_set', {
    playerId,
    playerName: buryingPlayer.name
  });
});

// 埋底玩家埋牌
socket.on('bury_cards', ({ roomId, cardIds }) => {
  const room = roomManager.getRoom(roomId);
  const player = room.findPlayerBySocketId(socket.id);

  // 验证是否是埋底玩家
  if (room.gameState.buryingPlayerId !== player.id) {
    socket.emit('error', { message: '你不是埋底玩家' });
    return;
  }

  // 验证数量
  const requiredCount = room.config.bottomCardsCount;
  if (cardIds.length !== requiredCount) {
    socket.emit('error', {
      message: `必须埋${requiredCount}张牌`
    });
    return;
  }

  // 移除选中的牌并放入底牌
  const buriedCards = [];
  player.cards = player.cards.filter(card => {
    if (cardIds.includes(card.id)) {
      buriedCards.push(card);
      return false;
    }
    return true;
  });

  room.gameState.bottomCards = buriedCards;

  // 进入出牌阶段
  room.gameState.phase = 'playing';
  room.gameState.currentPlayerIndex = room.players.findIndex(p => p.id === player.id);

  // 广播埋底完成
  io.to(roomId).emit('cards_buried', {
    playerId: player.id
  });

  io.to(roomId).emit('phase_changed', {
    phase: 'playing',
    currentPlayerId: player.id,
    currentPlayerName: player.name
  });
});
```

### 3. 断线处理

```javascript
socket.on('disconnect', () => {
  const room = roomManager.findRoomBySocketId(socket.id);
  if (!room) return;

  const player = room.findPlayerBySocketId(socket.id);

  // 如果游戏正在进行，直接结束游戏
  if (room.gameState.phase !== 'waiting' && room.gameState.phase !== 'finished') {
    io.to(room.id).emit('game_terminated', {
      reason: `玩家 ${player.name} 离开，游戏终止`,
      disconnectedPlayer: player.name
    });

    room.gameState.phase = 'finished';
  }

  // 移除玩家
  room.removePlayer(player.id);

  // 广播玩家离开
  io.to(room.id).emit('player_left', {
    playerId: player.id,
    playerName: player.name
  });

  // 如果房主离开，转移房主权限或删除房间
  if (room.hostId === socket.id) {
    if (room.players.length > 0) {
      room.hostId = room.players[0].socketId;
      io.to(room.id).emit('host_changed', {
        newHostId: room.players[0].id,
        newHostName: room.players[0].name
      });
    } else {
      roomManager.deleteRoom(room.id);
    }
  }
});
```

## 待确认的细节

还有几个细节需要你确认：

### 1. 埋底玩家的确定方式
- **选项A**: 房主手动指定
- **选项B**: 根据游戏规则自动确定（比如展示特定牌的玩家）
- **你的选择？**

### 2. 分数和等级的初始值
- 分数默认值: ? （建议0）
- 等级默认值: ? （建议1）

### 3. 出牌顺序
- 出牌顺序是顺时针吗？
- 还是房主可以自定义出牌顺序？

### 4. "跳过"的逻辑
- 跳过后是否还能在本轮出牌？
- 还是跳过后本轮不能再出？

### 5. 展示底牌后
- 展示底牌后玩家需要手动点击"确认"才能结束游戏？
- 还是自动进入结束阶段？

### 6. 发牌间隔的默认值和范围
- 默认值建议: 500毫秒
- 最小值: 100毫秒？
- 最大值: 2000毫秒？

请确认这些细节，我会据此完善设计！
