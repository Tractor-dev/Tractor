# WhoDesigned Bot 集成说明

## 依赖要求

### Python依赖
WhoDesigned bot需要以下Python包：
- **numpy**: 必需的数值计算库

安装命令：
```bash
pip3 install numpy
```

### 系统要求
- Python 3.x
- Node.js (用于运行游戏服务器)

## 测试状态

### ✅ 已完成的测试

#### 1. WhoDesigned Bot本身
```bash
cd WhoDesigned
mkdir -p input  # 创建必需的目录
python3 test_runner.py
```
**结果**: 5/5 测试通过 ✓

#### 2. 卡牌编号系统 (CardNumberingSystem)
```bash
node test-bot-integration.js
```
**结果**:
- 基本编号转换: ✓
- 反向转换: ✓
- 完整循环测试 (0-107): ✓

### 🔧 集成点

#### 已实现的集成点:

1. **卡牌编号映射** (`cardNumbering.js`)
   - 实现0-107编号系统
   - 支持双向转换（Card对象 ↔ 编号）
   - 已测试验证所有108张牌

2. **Bot服务** (`WhoDesignedBotService.js`)
   - 实现三个阶段的bot调用：
     - `deal`: 报主/反主决策
     - `cover`: 盖底牌决策
     - `play`: 出牌决策
   - 构建正确的request格式
   - 解析bot的response

3. **游戏流程集成** (`gameHandlers.js`)
   - Cover阶段：bot自动盖底牌
   - Play阶段：bot自动出牌（已有）

4. **模式限制**
   - 禁止在自由模式使用WhoDesigned bot
   - 在添加bot、开始游戏、更新配置时都有检查

5. **前端配置UI**
   - 房间设置中可选择bot类型
   - 支持在waiting/revealing/finished阶段切换
   - 多语言支持（中文、英文、日文）

## Bot输入格式示例

### Deal阶段
```json
{
  "requests": [{
    "stage": "deal",
    "deliver": [0],
    "global": {
      "first_round": true,
      "level": "2",
      "banking": {
        "called": -1,
        "snatched": -1,
        "major": "",
        "banker": -1
      }
    },
    "playerpos": 0
  }],
  "responses": []
}
```

### Cover阶段
```json
{
  "requests": [{
    "stage": "cover",
    "deliver": [105, 68, 37, 26, 47, 17, 51, 23],
    "global": {
      "first_round": true,
      "level": "2",
      "banking": {
        "called": 3,
        "snatched": 3,
        "major": "d",
        "banker": 3
      }
    }
  }],
  "responses": [[]]
}
```

### Play阶段
```json
{
  "requests": [{
    "stage": "play",
    "history": [[], [], 0, 0],
    "global": {
      "first_round": true,
      "level": "2",
      "banking": {
        "called": 3,
        "snatched": 3,
        "major": "d",
        "banker": 3
      },
      "total_score": 0
    }
  }],
  "responses": [[]]
}
```

## 卡牌编号规则 (0-107)

每个点数有4张牌，顺序为：h(红桃), d(方片), s(黑桃), c(草花)

- 0-3: A (h, d, s, c)
- 4-7: 2 (h, d, s, c)
- 8-11: 3 (h, d, s, c)
- ...
- 48-51: K (h, d, s, c)
- 52: 小王
- 53: 大王
- 54-107: 重复0-53（第二副牌）

## 已知问题

### ⚠️ 需要进一步测试的部分

1. **Deal阶段集成** - 报主/反主功能预留了接口但未完全集成到发牌流程
2. **History构建** - `_buildHistory`和`_getPreviousRoundCards`需要在实际游戏中验证
3. **Banking信息** - `called`和`snatched`字段需要在游戏状态中跟踪
4. **Level和Score计算** - 需要确保与bot期望格式一致

### 🔄 需要端到端测试

建议进行以下测试：
1. 启动游戏服务器
2. 创建房间，选择WhoDesigned bot
3. 添加3个bot玩家
4. 开始游戏并完整玩一局
5. 观察bot在cover和play阶段的行为

## 环境变量

在WhoDesignedBotService中，调用bot时设置：
```javascript
const env = { ...process.env, USER: 'root' };
```
这确保bot运行在"在线"模式，从stdin读取输入。

## 故障排查

### Bot进程超时
- 当前超时设置：30秒
- 如果bot计算时间过长，可以增加`WhoDesignedBotService._callPythonBot`中的timeout值

### Bot输出解析失败
- 检查bot的stderr输出
- 验证bot返回的JSON格式
- 确保numpy已正确安装

### 卡牌ID匹配失败
- 确保playerCards包含所有bot选择的牌
- 检查copyIndex是否正确识别
