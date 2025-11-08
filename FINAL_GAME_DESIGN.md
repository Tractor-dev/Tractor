# 拖拉机纸牌游戏模拟器 - 最终设计文档

## 技术栈（已确认）

### 前端
- **框架**: React 18 + Vite
- **UI组件**: Ant Design
- **拖拽**: dnd-kit
- **实时通信**: Socket.IO Client
- **状态管理**: Zustand
- **样式**: Ant Design + CSS Modules

### 后端
- **运行时**: Node.js >= 18
- **框架**: Express
- **实时通信**: Socket.IO
- **数据存储**: 内存（开发）/ Redis（生产可选）
- **工具**: uuid, lodash

## 游戏规则（已确认）

### 牌组配置
- **总牌数**: 108张
- **构成**: 2副标准扑克牌
  - 普通牌: 2-10, J, Q, K, A × 4花色 × 2副 = 104张
  - 大小王: 小王×2, 大王×2 = 4张
  - 总计: 104 + 4 = 108张

### 玩家配置
- **人数**: 2-4人（弹性）
- **初始分数**: 0
- **初始等级**: 2
- **重新开始时**: 分数重置为0，等级保持不变

### 游戏完整流程

#### 阶段0: 等待房间 (WAITING)
- 玩家加入房间
- 房主配置游戏参数
  - 底牌数量（默认8张）
  - 发牌间隔（默认500ms，最小10ms，无上限）
  - 出牌顺序（默认逆时针，可自定义）

#### 阶段1: 摸牌阶段 (DRAWING)
- **发牌方式**: 自动按间隔依次发牌
- **发牌顺序**: 玩家1 → 玩家2 → 玩家3 → 玩家4 → 循环
- **底牌**: 预留N张（房主配置，默认8张）作为底牌
- **发牌数量**: (108 - N) ÷ 4 张/人
- **特殊功能**: 玩家可以随时"展示"自己的手牌给所有人看
  - 展示的牌仍在手中
  - 所有玩家可见
  - 可以展示任意张数
- **自动排序**: 手牌默认按花色分组，组内从小到大排序
- **手动排序**: 玩家可以通过拖拽自定义排序

#### 阶段2: 埋底阶段 (BURYING)
- **埋底玩家**: 由房主手动指定
- **流程**:
  1. 埋底玩家获得所有底牌（N张）
  2. 埋底玩家从手牌中选择N张牌埋回底牌
  3. 埋底的牌对其他玩家不可见
  4. 埋底完成后进入出牌阶段

#### 阶段3: 出牌阶段 (PLAYING)
- **首发玩家**: 由房主指定（通常是埋底玩家）
- **出牌顺序**: 默认逆时针，房主可自定义
- **出牌规则**:
  - 完全自由出牌，无牌型限制
  - 每次可出0-N张牌（0张=跳过）
  - 所有玩家都能看到出的具体牌

- **回合机制（重要）**:

  出牌阶段分为两种模式交替进行：

  **模式1: 轮次内有序出牌 (PLAYING_ORDERED)**
  - 一个轮次 = 所有玩家各出一次牌
  - 按照预设顺序（逆时针或自定义）依次出牌
  - 每个玩家轮到时才能出牌
  - 例如：玩家A → 玩家B → 玩家C → 玩家D

  **模式2: 轮次间自由出牌 (PLAYING_FREE)**
  - 当一个轮次结束后，进入自由出牌阶段
  - **所有玩家都可以出牌**（抢先机制）
  - **谁第一个出牌，该次出牌直接算作新一轮的首发出牌**
  - 出牌后立即轮到下一位玩家（进入有序模式）

  **完整流程示例**:
  ```
  轮次1（有序）: 玩家A出牌 → 玩家B出牌 → 玩家C出牌 → 玩家D出牌
    ↓ (4人都出过，轮次1结束)
  进入自由出牌阶段（所有人都可以出）
    ↓
  玩家C抢先出牌！← 这次出牌同时做三件事：
                    1. 触发轮次2开始
                    2. 算作轮次2中玩家C的出牌
                    3. 直接轮到下一位
    ↓
  轮次2（有序）: ✓玩家C(已出) → 玩家B出牌 → 玩家A出牌 → 玩家D出牌
    ↓ (4人都出过，轮次2结束)
  进入自由出牌阶段
    ↓
  玩家A抢先出牌！← 同样直接算作轮次3的出牌
    ↓
  轮次3（有序）: ✓玩家A(已出) → 玩家D出牌 → ...
  ```

- **游戏继续**: 直到所有玩家都出完所有手牌

#### 阶段4: 展示底牌 (REVEALING)
- 所有玩家可以查看底牌内容
- **确认机制**: 所有玩家必须点击"确认"按钮
- 所有人确认后才进入结束阶段

#### 阶段5: 游戏结束 (FINISHED)
- 显示游戏结果
- 玩家可以调整自己的分数和等级
- 房主可以选择"重新开始"
  - 分数重置为0
  - 等级保持当前值不变

### 特殊情况处理

#### 玩家离线/退出
- **游戏未开始**: 玩家可以自由离开
- **游戏进行中**: 任何玩家离开，游戏立即终止
  - 广播"游戏因玩家离开而终止"
  - 返回房间等待状态

#### 房主离开
- **有其他玩家**: 自动转移房主权限给第一位玩家
- **无其他玩家**: 删除房间

## 数据模型

### 房间配置 (RoomConfig)
```javascript
{
  bottomCardsCount: 8,        // 底牌数量
  dealInterval: 500,          // 发牌间隔（毫秒）
  minDealInterval: 10,        // 最小发牌间隔
  turnOrder: 'counter-clockwise', // 'counter-clockwise' | 'custom'
  customTurnOrder: [0,1,2,3], // 自定义出牌顺序（玩家索引数组）
  minPlayers: 2,
  maxPlayers: 4
}
```

### 玩家属性 (Player)
```javascript
{
  id: string,
  socketId: string,
  name: string,
  score: number,              // 默认0，重新开始时重置
  level: number,              // 默认2，重新开始时不重置
  cards: Card[],
  shownCards: Set<string>,    // 已展示的牌ID
  position: number,           // 座位号0-3
  isReady: boolean,
  isOnline: boolean,
  hasConfirmedReveal: boolean // 是否确认查看底牌
}
```

### 游戏状态 (GameState)
```javascript
{
  phase: 'waiting' | 'drawing' | 'burying' | 'playing' | 'revealing' | 'finished',
  playMode: 'ordered' | 'free', // 出牌模式：有序 | 自由抢先
  deck: Card[],               // 牌堆
  bottomCards: Card[],        // 底牌
  buryingPlayerId: string,    // 埋底玩家ID
  firstPlayerId: string,      // 首发玩家ID（房主指定）
  currentPlayerIndex: number, // 当前出牌玩家索引（仅在ordered模式有效）
  currentRound: number,       // 当前轮次数（从1开始）
  roundStartPlayerIndex: number, // 本轮首发玩家索引
  playersPlayedThisRound: Set<number>, // 本轮已出牌的玩家索引
  playHistory: PlayRecord[],  // 出牌历史
  drawingIndex: number,       // 发牌进度
  startTime: Date,
  endTime: Date
}
```

### 扑克牌 (Card)
```javascript
{
  id: string,                 // 如 "hearts-A-0", "joker-big-1"
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades' | 'joker',
  rank: '2'|'3'|...|'K'|'A'|'small_joker'|'big_joker',
  value: number,              // 排序值
  displayOrder: number,       // 玩家自定义排序
  isShown: boolean            // 是否已展示
}
```

## 核心算法

### 1. 创建108张牌

```javascript
class DeckService {
  static createDeck() {
    const deck = [];
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

    // 两副普通牌（2 × 52 = 104张）
    for (let copy = 0; copy < 2; copy++) {
      for (let suit of suits) {
        for (let rank of ranks) {
          deck.push({
            id: `${suit}-${rank}-${copy}`,
            suit,
            rank,
            value: this.getCardValue(rank, suit),
            displayOrder: 0,
            isShown: false
          });
        }
      }
    }

    // 大小王（4张）
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

    return deck; // 108张
  }

  static getCardValue(rank, suit) {
    const rankValues = {
      '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
      '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
    };

    const suitValues = {
      'hearts': 0, 'diamonds': 100, 'clubs': 200, 'spades': 300
    };

    return (suitValues[suit] || 0) + (rankValues[rank] || 0);
  }

  static shuffle(deck) {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}
```

### 2. 自动排序（花色分组+组内升序）

```javascript
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
    // 先按花色
    const suitDiff = SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
    if (suitDiff !== 0) return suitDiff;

    // 同花色按大小
    return RANK_ORDER[a.rank] - RANK_ORDER[b.rank];
  });
}
```

### 3. 回合管理

```javascript
class RoundManager {
  constructor(gameState, config, playerCount) {
    this.gameState = gameState;
    this.config = config;
    this.playerCount = playerCount;
  }

  // 玩家出牌后调用
  onPlayerPlayed(playerIndex) {
    const mode = this.gameState.playMode;

    if (mode === 'ordered') {
      // 有序模式：记录已出牌
      this.gameState.playersPlayedThisRound.add(playerIndex);

      // 检查本轮是否所有人都出过牌
      if (this.gameState.playersPlayedThisRound.size === this.playerCount) {
        // 本轮结束，进入自由出牌阶段
        this.enterFreeMode();
      } else {
        // 移动到下一个玩家
        this.moveToNextPlayer(playerIndex);
      }
    } else if (mode === 'free') {
      // 自由模式：第一个出牌的人触发新一轮
      // 该玩家成为下一轮首发
      this.startNewRound(playerIndex);
    }
  }

  // 进入自由出牌阶段
  enterFreeMode() {
    this.gameState.playMode = 'free';
    this.gameState.currentPlayerIndex = null; // 自由模式没有"当前玩家"

    // 广播：轮次结束，进入自由出牌
    return {
      event: 'free_play_started',
      message: `第${this.gameState.currentRound}轮结束，所有玩家可以出牌`
    };
  }

  // 开始新一轮（由第一个出牌的玩家触发）
  // 注意：触发的那次出牌本身就算作该玩家在新一轮的出牌
  startNewRound(firstPlayerIndex) {
    this.gameState.currentRound++;
    this.gameState.playMode = 'ordered';
    this.gameState.roundStartPlayerIndex = firstPlayerIndex;
    this.gameState.playersPlayedThisRound.clear();

    // 该玩家的出牌已经算作本轮的出牌
    this.gameState.playersPlayedThisRound.add(firstPlayerIndex);

    // 直接移动到下一个玩家
    this.moveToNextPlayer(firstPlayerIndex);

    return {
      event: 'round_started',
      round: this.gameState.currentRound,
      firstPlayerIndex,
      firstPlayerName: this.getPlayerName(firstPlayerIndex),
      currentPlayerIndex: this.gameState.currentPlayerIndex,
      currentPlayerName: this.getPlayerName(this.gameState.currentPlayerIndex),
      message: `轮次${this.gameState.currentRound}开始，${this.getPlayerName(firstPlayerIndex)}首发并已出牌，现在轮到${this.getPlayerName(this.gameState.currentPlayerIndex)}`
    };
  }

  // 移动到下一个玩家（有序模式）
  moveToNextPlayer(currentPlayerIndex) {
    const { turnOrder, customTurnOrder } = this.config;

    if (turnOrder === 'counter-clockwise') {
      // 逆时针：索引递减
      this.gameState.currentPlayerIndex =
        (currentPlayerIndex - 1 + this.playerCount) % this.playerCount;
    } else if (turnOrder === 'custom') {
      // 自定义顺序
      const currentPos = customTurnOrder.indexOf(currentPlayerIndex);
      const nextPos = (currentPos + 1) % this.playerCount;
      this.gameState.currentPlayerIndex = customTurnOrder[nextPos];
    }
  }

  // 验证玩家是否可以出牌
  canPlayerPlay(playerIndex) {
    const mode = this.gameState.playMode;

    if (mode === 'free') {
      // 自由模式：所有人都可以出牌
      return true;
    } else if (mode === 'ordered') {
      // 有序模式：只有当前玩家可以出牌
      return playerIndex === this.gameState.currentPlayerIndex;
    }

    return false;
  }

  // 检查游戏是否结束（所有人都出完牌）
  isGameFinished(players) {
    return players.every(p => p.cards.length === 0);
  }
}
```

### 4. 发牌定时器

```javascript
class DrawingPhaseManager {
  constructor(room, io) {
    this.room = room;
    this.io = io;
    this.timer = null;
  }

  start() {
    const { bottomCardsCount, dealInterval } = this.room.config;

    // 洗牌
    const deck = DeckService.shuffle(DeckService.createDeck());

    // 分离底牌
    this.room.gameState.bottomCards = deck.slice(0, bottomCardsCount);
    this.room.gameState.deck = deck.slice(bottomCardsCount);
    this.room.gameState.phase = 'drawing';
    this.room.gameState.drawingIndex = 0;

    // 广播开始
    this.io.to(this.room.id).emit('drawing_started', {
      totalCards: this.room.gameState.deck.length,
      bottomCardsCount,
      dealInterval
    });

    // 定时发牌
    this.timer = setInterval(() => {
      this.dealOneCard();
    }, dealInterval);
  }

  dealOneCard() {
    const { deck, drawingIndex } = this.room.gameState;
    const players = this.room.players;

    if (drawingIndex >= deck.length) {
      this.finish();
      return;
    }

    const playerIndex = drawingIndex % players.length;
    const player = players[playerIndex];
    const card = deck[drawingIndex];

    player.cards.push(card);
    player.cards = autoSortCards(player.cards);

    // 私密发送给该玩家
    this.io.to(player.socketId).emit('card_received', { card });

    // 广播进度（不含具体牌）
    this.io.to(this.room.id).emit('deal_progress', {
      playerIndex,
      playerName: player.name,
      current: drawingIndex + 1,
      total: deck.length
    });

    this.room.gameState.drawingIndex++;
  }

  finish() {
    clearInterval(this.timer);
    this.room.gameState.phase = 'burying';

    this.io.to(this.room.id).emit('phase_changed', {
      phase: 'burying',
      message: '发牌完成，等待房主指定埋底玩家'
    });
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
```

## Socket.IO 事件完整定义

### 客户端 → 服务器

#### 房间管理
| 事件 | 参数 | 说明 | 权限 |
|------|------|------|------|
| `create_room` | `{name, config}` | 创建房间 | 任何人 |
| `join_room` | `{roomId, playerName}` | 加入房间 | 任何人 |
| `leave_room` | `{roomId}` | 离开房间 | 房间成员 |
| `update_config` | `{roomId, config}` | 更新配置 | 房主 |

#### 游戏控制
| 事件 | 参数 | 说明 | 权限 | 阶段限制 |
|------|------|------|------|----------|
| `start_game` | `{roomId}` | 开始游戏 | 房主 | WAITING |
| `set_burying_player` | `{roomId, playerId}` | 指定埋底玩家 | 房主 | BURYING |
| `set_first_player` | `{roomId, playerId}` | 指定首发玩家 | 房主 | BURYING |
| `restart_game` | `{roomId}` | 重新开始 | 房主 | FINISHED |

#### 玩家操作
| 事件 | 参数 | 说明 | 阶段限制 |
|------|------|------|----------|
| `show_cards` | `{roomId, cardIds[]}` | 展示手牌 | DRAWING |
| `bury_cards` | `{roomId, cardIds[]}` | 埋底 | BURYING |
| `play_cards` | `{roomId, cardIds[]}` | 出牌 | PLAYING |
| `pass_turn` | `{roomId}` | 跳过（出0张） | PLAYING |
| `reorder_cards` | `{roomId, cardOrder[]}` | 重排手牌 | 任意 |
| `update_score` | `{roomId, score}` | 更新分数 | 任意 |
| `update_level` | `{roomId, level}` | 更新等级 | 任意 |
| `confirm_reveal` | `{roomId}` | 确认查看底牌 | REVEALING |

### 服务器 → 客户端

#### 房间事件
| 事件 | 数据 | 说明 |
|------|------|------|
| `room_created` | `{room}` | 房间创建成功 |
| `room_joined` | `{room, player, position}` | 成功加入 |
| `player_joined` | `{player}` | 其他玩家加入 |
| `player_left` | `{playerId, playerName}` | 玩家离开 |
| `host_changed` | `{newHostId, newHostName}` | 房主变更 |

#### 阶段事件
| 事件 | 数据 | 说明 |
|------|------|------|
| `game_started` | `{phase, config}` | 游戏开始 |
| `phase_changed` | `{phase, message, ...}` | 阶段切换 |
| `drawing_started` | `{totalCards, bottomCardsCount, dealInterval}` | 开始发牌 |
| `deal_progress` | `{playerIndex, playerName, current, total}` | 发牌进度 |
| `card_received` | `{card}` | 收到牌（私密） |

#### 玩家动作事件
| 事件 | 数据 | 说明 |
|------|------|------|
| `cards_shown` | `{playerId, playerName, cards[]}` | 玩家展示牌 |
| `burying_player_set` | `{playerId, playerName}` | 埋底玩家已指定 |
| `first_player_set` | `{playerId, playerName}` | 首发玩家已指定 |
| `bottom_cards_received` | `{bottomCards[]}` | 收到底牌（私密给埋底玩家） |
| `cards_buried` | `{playerId}` | 埋底完成 |
| `cards_played` | `{playerId, playerName, cards[], remainingCount}` | 出牌 |
| `turn_changed` | `{currentPlayerIndex, currentPlayerName}` | 轮到下一位（有序模式） |
| `free_play_started` | `{round, message}` | 轮次结束，进入自由出牌 |
| `round_started` | `{round, firstPlayerIndex, firstPlayerName, currentPlayerIndex}` | 新轮次开始（有序模式） |
| `player_finished` | `{playerId, playerName}` | 玩家打完牌 |

#### 结束事件
| 事件 | 数据 | 说明 |
|------|------|------|
| `bottom_revealed` | `{bottomCards[]}` | 展示底牌 |
| `player_confirmed_reveal` | `{playerId, playerName, confirmedCount, totalCount}` | 玩家确认查看 |
| `game_finished` | `{players[], duration, totalRounds}` | 游戏结束 |
| `game_terminated` | `{reason, disconnectedPlayer}` | 游戏异常终止 |

#### 状态更新
| 事件 | 数据 | 说明 |
|------|------|------|
| `player_updated` | `{player}` | 玩家信息更新 |
| `config_updated` | `{config}` | 配置更新 |

#### 错误处理
| 事件 | 数据 | 说明 |
|------|------|------|
| `error` | `{message, code}` | 错误消息 |

## UI设计

### 主要页面

#### 1. 房间大厅
```
┌─────────────────────────────────────┐
│  拖拉机纸牌模拟器                    │
│  [创建房间]  [刷新]                  │
├─────────────────────────────────────┤
│  房间列表                            │
│  ┌───────────────────────────────┐  │
│  │ 房间1  2/4  等待中  [加入]    │  │
│  │ 房间2  4/4  游戏中   -        │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

#### 2. 房间等待
```
┌─────────────────────────────────────┐
│  房间: XXX  (房主: 玩家1)            │
├─────────────────────────────────────┤
│  玩家:                               │
│  1. 玩家1 (房主) 分数:0 等级:2       │
│  2. 玩家2        分数:0 等级:2       │
│  3. (空位)                           │
│  4. (空位)                           │
├─────────────────────────────────────┤
│  配置 (房主):                        │
│  底牌数: [8▼]                        │
│  发牌间隔: [500▼] ms                 │
│  出牌顺序: [逆时针▼]                 │
├─────────────────────────────────────┤
│  [开始游戏] [离开]                   │
└─────────────────────────────────────┘
```

#### 3. 游戏界面

**有序出牌模式示例**:
```
        玩家1 (房主) 分数:0 等级:2 手牌:26张
              [出牌区: ♥3 ♥3 ♦5]
┌──────────────────────────────────────────────┐
│玩家2           游戏状态                 玩家4 │
│分数:0          阶段: 出牌阶段           分数:0 │
│等级:2          轮次: 5                 等级:2 │
│手牌:25张       模式: 有序出牌           手牌:27张│
│[出牌区]        当前: → 玩家3 ←         [出牌区] │
│                底牌: 8张                      │
│              中央出牌区域                     │
│                                              │
├──────────────────────────────────────────────┤
│  玩家3 (你)  分数:0  等级:2  手牌:30张  ← 轮到你 │
│  ┌────────────────────────────────────────┐  │
│  │ [♥2][♥2][♥3][♥5][♦7]...[🃏][🃏]        │  │
│  └────────────────────────────────────────┘  │
│  已选: 3张                                    │
│  [出牌] [跳过] [展示] [自动排序]              │
└──────────────────────────────────────────────┘
```

**自由出牌模式示例**:
```
        玩家1 (房主) 分数:0 等级:2 手牌:26张
              [出牌区: ♥3 ♥3 ♦5]
┌──────────────────────────────────────────────┐
│玩家2           游戏状态                 玩家4 │
│分数:0          阶段: 出牌阶段           分数:0 │
│等级:2          轮次: 5 已结束          等级:2 │
│手牌:25张       模式: 🔥自由抢先🔥      手牌:27张│
│[出牌区]        提示: 谁先出牌谁首发     [出牌区] │
│                底牌: 8张                      │
│              中央出牌区域                     │
│                                              │
├──────────────────────────────────────────────┤
│  玩家3 (你)  分数:0  等级:2  手牌:30张  所有人可出牌│
│  ┌────────────────────────────────────────┐  │
│  │ [♥2][♥2][♥3][♥5][♦7]...[🃏][🃏]        │  │
│  └────────────────────────────────────────┘  │
│  已选: 3张                                    │
│  [抢先出牌!] [跳过] [展示] [自动排序]         │
└──────────────────────────────────────────────┘
```

#### 4. 埋底界面（埋底玩家）
```
┌──────────────────────────────────────┐
│  埋底阶段 - 你需要埋8张牌             │
├──────────────────────────────────────┤
│  你获得的底牌:                        │
│  [♥5][♦7][♣K][♠A][♥10][♦J][♣2][♠3]  │
├──────────────────────────────────────┤
│  你的手牌 (35张):                     │
│  [可拖拽选择要埋的牌]                 │
│  [♥2][♥2][♥3]...                     │
├──────────────────────────────────────┤
│  已选: 5张  还需: 3张                 │
│  [确认埋底]                           │
└──────────────────────────────────────┘
```

#### 5. 展示底牌
```
┌──────────────────────────────────────┐
│  游戏结束 - 查看底牌                  │
├──────────────────────────────────────┤
│  底牌内容:                            │
│  [♥5][♦7][♣K][♠A][♥10][♦J][♣2][♠3]  │
├──────────────────────────────────────┤
│  等待确认: 2/4                        │
│  ✓ 玩家1  ✓ 玩家2  ⏳ 玩家3  ⏳ 玩家4 │
├──────────────────────────────────────┤
│  [我已确认]                           │
└──────────────────────────────────────┘
```

## 项目结构

```
tractor-simulator/
├── client/                       # 前端
│   ├── src/
│   │   ├── components/
│   │   │   ├── Room/
│   │   │   │   ├── RoomList.jsx
│   │   │   │   ├── RoomLobby.jsx
│   │   │   │   └── CreateRoomModal.jsx
│   │   │   ├── Game/
│   │   │   │   ├── GameTable.jsx
│   │   │   │   ├── PlayerHand.jsx
│   │   │   │   ├── Card.jsx
│   │   │   │   ├── PlayArea.jsx
│   │   │   │   ├── PlayerPanel.jsx
│   │   │   │   ├── BuryingPanel.jsx
│   │   │   │   └── RevealPanel.jsx
│   │   │   ├── Controls/
│   │   │   │   ├── HostControls.jsx
│   │   │   │   └── PlayerControls.jsx
│   │   │   └── Common/
│   │   │       ├── Header.jsx
│   │   │       └── StatusBar.jsx
│   │   ├── hooks/
│   │   │   ├── useSocket.js
│   │   │   ├── useGame.js
│   │   │   └── useRoom.js
│   │   ├── store/
│   │   │   └── gameStore.js       # Zustand store
│   │   ├── services/
│   │   │   └── socket.js
│   │   ├── utils/
│   │   │   ├── cardSort.js
│   │   │   ├── cardUtils.js
│   │   │   └── constants.js
│   │   ├── assets/
│   │   │   └── cards/             # 扑克牌SVG
│   │   ├── styles/
│   │   │   └── global.css
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── server/                       # 后端
│   ├── src/
│   │   ├── models/
│   │   │   ├── Room.js
│   │   │   ├── Player.js
│   │   │   └── GameState.js
│   │   ├── services/
│   │   │   ├── RoomManager.js
│   │   │   ├── DeckService.js
│   │   │   ├── DrawingPhaseManager.js
│   │   │   ├── RoundManager.js
│   │   │   └── GameEngine.js
│   │   ├── socket/
│   │   │   ├── handlers/
│   │   │   │   ├── roomHandlers.js
│   │   │   │   ├── gameHandlers.js
│   │   │   │   └── playerHandlers.js
│   │   │   └── index.js
│   │   ├── utils/
│   │   │   ├── constants.js
│   │   │   ├── logger.js
│   │   │   └── validators.js
│   │   └── index.js
│   ├── package.json
│   └── .env
│
└── README.md
```

## 开发阶段

### Phase 1: 基础框架 (1周)
- [x] 确定技术栈
- [x] 完成设计文档
- [ ] 搭建前端项目（React + Vite + Ant Design）
- [ ] 搭建后端项目（Node.js + Express + Socket.IO）
- [ ] 实现基础Socket连接
- [ ] 实现房间创建/加入/列表

### Phase 2: 游戏核心 (2周)
- [ ] 实现牌组生成和洗牌
- [ ] 实现摸牌阶段（定时发牌）
- [ ] 实现展示手牌功能
- [ ] 实现埋底阶段
- [ ] 实现出牌阶段
- [ ] 实现回合管理
- [ ] 实现展示底牌和确认机制

### Phase 3: UI/UX (1周)
- [ ] 手牌拖拽排序（dnd-kit）
- [ ] 扑克牌组件美化
- [ ] 房间配置面板
- [ ] 游戏状态展示
- [ ] 动画效果

### Phase 4: 测试优化 (1周)
- [ ] 多人联机测试
- [ ] 断线重连处理
- [ ] 错误处理
- [ ] 性能优化
- [ ] 部署上线

## 待实现的可选功能

- [ ] 聊天系统
- [ ] 游戏记录和回放
- [ ] 玩家统计
- [ ] 自定义牌面样式
- [ ] 声音效果
- [ ] 移动端适配
- [ ] 观战模式

## 下一步行动

1. ✅ 完成技术设计
2. 生成项目代码框架
3. 实现MVP（最小可行产品）
4. 测试和迭代
