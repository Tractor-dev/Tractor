// 简体中文翻译
export default {
  // 通用
  common: {
    save: '保存',
    cancel: '取消',
    close: '关闭',
    confirm: '确认',
    create: '创建',
    join: '加入',
    leave: '离开',
    refresh: '刷新',
    send: '发送',
    add: '添加',
    delete: '删除',
    back: '返回',
    loading: '加载中...',
    none: '暂无',
    score: '分数',
    level: '等级',
    cards: '张',
    points: '分',
    ready: '准备',
    cancelReady: '取消准备',
    readied: '已准备',
    notReady: '未准备',
    me: '我',
    host: '房主',
    bot: 'Bot',
    dealer: '庄',
    attacker: '闲家',
    you: '你'
  },

  // 连接状态
  connection: {
    connected: '已连接',
    disconnected: '未连接',
    connecting: '连接中...',
    connectedToServer: '已连接到服务器',
    disconnectedFromServer: '与服务器断开连接',
    connectionStatus: '连接状态'
  },

  // 应用标题
  app: {
    title: '拖拉机纸牌游戏模拟器',
    welcome: '欢迎来到拖拉机纸牌游戏',
    subtitle: '在线多人拖拉机纸牌游戏模拟器'
  },

  // 房间相关
  room: {
    createRoom: '创建房间',
    joinRoom: '加入房间',
    leaveRoom: '离开房间',
    roomList: '房间列表',
    roomName: '房间名称',
    roomId: '房间ID',
    players: '玩家',
    playerCount: '玩家数',
    playerList: '玩家列表',
    roomConfig: '房间配置',
    roomSettings: '房间设置',
    modifySettings: '修改设置',
    noRooms: '暂无房间，点击上方"创建房间"开始游戏',
    roomCreated: '房间创建成功！',
    joinedRoom: '加入房间成功！',
    leftRoom: '已离开房间',
    full: '已满',
    inGame: '游戏中',
    waiting: '等待中',
    enterRoomId: '请输入房间ID或从列表选择',
    defaultRoomName: '我的房间',
    defaultPlayerName: '玩家',
    totalRooms: '共 {count} 个房间'
  },

  // 房间状态
  roomStatus: {
    waiting: '等待中',
    drawing: '摸牌中',
    burying: '埋底中',
    playing: '游戏中',
    revealing: '揭底中',
    finished: '已结束'
  },

  // 创建房间表单
  createRoomForm: {
    roomNameLabel: '房间名称',
    roomNamePlaceholder: '请输入房间名称',
    roomNameRequired: '请输入房间名称',
    playerNameLabel: '你的昵称',
    playerNamePlaceholder: '请输入你的昵称',
    playerNameRequired: '请输入昵称',
    bottomCardsLabel: '底牌数量',
    bottomCardsRequired: '请输入底牌数量',
    dealIntervalLabel: '发牌间隔（毫秒）',
    dealIntervalRequired: '请输入发牌间隔',
    gameModeLabel: '游戏模式',
    freeMode: '自由模式',
    freeModeOn: '开启',
    freeModeOff: '关闭',
    freeModeDesc: '自由模式：无出牌顺序限制，可随时出牌、展示牌、调整分数等级',
    basicModeDesc: '基础模式：按顺序出牌，完善的亮主、得分和升级规则',
    settingsEffectNote: '设置将在下一局游戏开始时生效',
    bottomCardsValidation: '底牌数量必须在1-20之间',
    dealIntervalValidation: '发牌间隔必须在10-5000毫秒之间'
  },

  // 加入房间
  joinRoomForm: {
    roomIdLabel: '房间ID',
    roomIdPlaceholder: '请输入房间ID',
    roomIdRequired: '请输入房间ID'
  },

  // 游戏相关
  game: {
    startGame: '开始游戏',
    restartGame: '重新开始',
    addBot: '添加Bot',
    removeBot: '移除Bot',
    botsInRoom: '房间内的Bot',
    waitingToStart: '等待开始',
    gameStarted: '游戏开始！',
    gameRestarted: '游戏重新开始！',
    waitingForRoom: '等待加入房间...',
    bottomCards: '底牌',
    dealInterval: '发牌间隔',
    gameMode: '游戏模式',
    freeMode: '自由模式',
    basicMode: '基础模式'
  },

  // 出牌相关
  play: {
    playCards: '出牌',
    showCards: '展示牌',
    selectAll: '全选',
    undo: '撤回',
    pass: '跳过',
    viewBottom: '看底牌',
    chat: '聊天',
    rename: '改昵称',
    setBurying: '指定埋底',
    waitingBury: '等待庄家埋底',
    bury: '埋底',
    startNextGame: '开始下一局',
    cardCount: '({count})',
    buryCount: '({selected}/{required})',
    selectCardsFirst: '请先选择要出的牌',
    selectCardsToShow: '请先选择要展示的牌',
    selectPlayerFirst: '请选择玩家',
    selectBuryingPlayer: '请选择埋底玩家',
    selectCorrectBuryCount: '请选择 {count} 张牌进行埋底',
    noCardsToSelect: '没有手牌可选择',
    cannotUndo: '无法撤回',
    notYourTurn: '还没轮到你出牌',
    myTurn: '出牌中'
  },

  // 分数和等级调整
  adjust: {
    adjustScore: '调整分数',
    adjustLevel: '调整等级',
    currentScore: '当前: {score}',
    currentLevel: '当前: {level}',
    newScore: '新分数',
    newLevel: '新等级',
    scoreUpdated: '分数已更新',
    levelUpdated: '等级已更新',
    minusScore: '-5分',
    plusScore5: '+5分',
    plusScore10: '+10分',
    minusLevel: '-1级',
    plusLevel: '+1级'
  },

  // 主牌相关
  trump: {
    trump: '主牌',
    trumpCard: '主牌',
    setTrump: '设置',
    modifyTrump: '修改',
    notSet: '未设置',
    trumpSet: '主牌已设置',
    declareTrump: '亮主',
    suit: '花色',
    rank: '点数',
    hearts: '红桃',
    diamonds: '方块',
    clubs: '梅花',
    spades: '黑桃',
    noTrump: '无主',
    joker: '王',
    trumpAction: '毙了！',
    overTrumpAction: '盖毙！',
    dealerCountdown: '指定庄家倒计时',
    countdownReset: '有人亮主，倒计时已重置',
    randomDealer: '无人亮主将随机指定'
  },

  // 花色符号
  suits: {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠',
    joker: '王'
  },

  // 底牌和得分
  bottom: {
    bottomCards: '底牌',
    myBottomCards: '我的底牌',
    buriedCards: '已埋 {count} 张底牌',
    bottomCardsCount: '{count} 张',
    bottomRevealed: '底牌已展示: {count} 张',
    receivedBottomCards: '收到 {count} 张底牌，当前共 {total} 张牌',
    buryingPlayerSet: '{name} 被指定为埋底玩家',
    buryCompleted: '{name} 完成埋底',
    attackerScore: '闲家得分',
    pointCards: '分数牌',
    attackerWonBottom: '闲家拿底！',
    dealerKeptBottom: '庄家守底！',
    bottomPoints: '底牌{points}分×{multiplier}倍={gained}分',
    totalScore: '闲家总分：{score}分',
    attackerWins: '🎉 闲家获胜！',
    dealerWins: '👑 庄家获胜！',
    dealerTeam: '庄家队伍',
    attackerTeam: '闲家队伍',
    levelUp: '↑ 升{count}级',
    nextDealer: '下一局庄家',
    level: '等级'
  },

  // 规则相关
  rules: {
    rule: '规则',
    selectRule: '选择规则',
    changeRule: '更换',
    noRuleSelected: '未选择规则',
    selectGameRule: '选择游戏规则',
    randomSelect: '随机选择',
    customRule: '自定义规则',
    searchRule: '搜索规则名称或内容...',
    noMatchingRules: '没有找到匹配的规则',
    totalRules: '共 {count} 条规则',
    filteredRules: '(从 {total} 条中筛选)',
    ruleName: '规则名称：',
    ruleContent: '规则内容：',
    ruleNamePlaceholder: '请输入规则名称（最多20字符）',
    ruleContentPlaceholder: '请输入规则内容（最多200字符）',
    ruleSelected: '已选择规则: {name}',
    customRuleSaved: '已保存自定义规则: {name}',
    loadRuleFailed: '加载规则失败，请检查DLC.json文件',
    noRulesAvailable: '没有可用的规则',
    ruleNameEmpty: '规则名称不能为空',
    ruleContentEmpty: '规则内容不能为空',
    ruleNameTooLong: '规则名称不能超过20个字符',
    ruleContentTooLong: '规则内容不能超过200个字符'
  },

  // 聊天相关
  chat: {
    chat: '聊天',
    quickPhrases: '快捷短语',
    manageQuickPhrases: '管理快捷短语',
    sendMessage: '发送消息',
    messagePlaceholder: '输入消息（最多200字符，支持emoji）',
    noChatHistory: '暂无聊天记录',
    commonEmojis: '常用表情：',
    existingPhrases: '现有快捷短语:',
    noQuickPhrases: '暂无快捷短语',
    addNewPhrase: '添加新短语',
    newPhrasePlaceholder: '输入新的快捷短语（最多50字符）',
    phraseAdded: '快捷短语已添加',
    phraseDeleted: '快捷短语已删除',
    messageEmpty: '消息不能为空',
    messageTooLong: '消息长度不能超过200个字符',
    phraseEmpty: '快捷短语不能为空',
    phraseTooLong: '快捷短语长度不能超过50个字符',
    phraseExists: '该快捷短语已存在'
  },

  // 昵称相关
  nickname: {
    modifyNickname: '修改昵称',
    newNickname: '新昵称:',
    nicknamePlaceholder: '请输入新昵称（最多20字符）',
    nicknameEmpty: '昵称不能为空',
    nicknameTooLong: '昵称长度不能超过20个字符',
    nicknameUpdated: '昵称已修改为: {name}',
    playerRenamed: '{oldName} 修改昵称为: {newName}'
  },

  // 通知消息
  messages: {
    playerJoined: '{name} 加入了房间',
    playerLeft: '{name} 离开了房间',
    playerReady: '{name} 已准备',
    playerCancelReady: '{name} 取消准备',
    allPlayersReady: '所有玩家已准备',
    cardsShown: '{name} 展示了 {count} 张牌',
    cardsPlayed: '{name} 出了 {count} 张牌',
    turnPassed: '{name} 跳过了回合',
    playUndone: '{name} 撤回了出牌',
    firstPlayerSet: '{name} 先出牌',
    currentTurn: '现在轮到 {name} 出牌',
    roundStarted: '轮次 {round} 开始',
    roundEnded: '第{round}轮结束，{winner} 获胜，获得下一轮出牌权',
    attackerGotPoints: '闲家得{points}分，总分：{total}分',
    botAdded: 'Bot {name} 已加入房间',
    botRemoved: 'Bot {name} 已离开房间',
    configUpdated: '房间设置已更新，将在下一局游戏生效',
    throwFailed: '{name} 甩牌失败，实际出牌 {count} 张',
    declaredSingle: '{name} 亮主: 单张{suit}',
    declaredPair: '{name} 亮主: 一对{suit}',
    counterDeclare: '{name} 反主: {type}{suit}',
    ruleSelected: '{name} 选择了规则: {rule}',
    playerReadyForNext: '{name} 已准备 ({ready}/{total})',
    nextGameStarted: '开始下一局！',
    errorOccurred: '发生错误'
  },

  // 手牌相关
  hand: {
    handCards: '手牌',
    cardCount: '手牌: {count}',
    tractor: '拖拉机',
    show: '展示:'
  },

  // 卡牌显示
  card: {
    smallJoker: '小王',
    bigJoker: '大王'
  },

  // 队伍
  team: {
    myTeam: '我方',
    opponentTeam: '对方',
    teamLevel: '等级'
  },

  // 语言
  language: {
    switch: '切换语言',
    chinese: '中文',
    english: 'English'
  }
};
