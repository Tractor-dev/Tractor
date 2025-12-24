// 日本語翻訳
export default {
  // 共通
  common: {
    save: '保存',
    cancel: 'キャンセル',
    close: '閉じる',
    confirm: '確認',
    create: '作成',
    join: '参加',
    leave: '退出',
    refresh: '更新',
    send: '送信',
    add: '追加',
    delete: '削除',
    back: '戻る',
    loading: '読み込み中...',
    none: 'なし',
    score: 'スコア',
    level: 'レベル',
    cards: '枚',
    points: '点',
    ready: '準備完了',
    cancelReady: '準備取消',
    readied: '準備済み',
    notReady: '未準備',
    me: '自分',
    host: 'ホスト',
    bot: 'Bot',
    dealer: '親',
    attacker: '攻撃側',
    you: 'あなた'
  },

  // 接続状態
  connection: {
    connected: '接続済み',
    disconnected: '未接続',
    connecting: '接続中...',
    connectedToServer: 'サーバーに接続しました',
    disconnectedFromServer: 'サーバーから切断されました',
    connectionStatus: '接続状態'
  },

  // アプリタイトル
  app: {
    title: 'トラクターカードゲームシミュレーター',
    welcome: 'トラクターカードゲームへようこそ',
    subtitle: 'オンラインマルチプレイヤートラクターカードゲームシミュレーター'
  },

  // ルーム関連
  room: {
    createRoom: 'ルーム作成',
    joinRoom: 'ルーム参加',
    leaveRoom: 'ルーム退出',
    watch: '観戦',
    leaveWatch: '観戦終了',
    roomList: 'ルーム一覧',
    roomName: 'ルーム名',
    roomId: 'ルームID',
    players: 'プレイヤー',
    playerCount: 'プレイヤー数',
    playerList: 'プレイヤー一覧',
    spectators: '観戦者',
    spectatorCount: '観戦者数',
    roomConfig: 'ルーム設定',
    roomSettings: 'ルーム設定',
    modifySettings: '設定変更',
    noRooms: 'ルームがありません。「ルーム作成」をクリックしてゲームを開始してください。',
    roomCreated: 'ルームが作成されました！',
    joinedRoom: 'ルームに参加しました！',
    joinedAsSpectator: '観戦を開始しました！',
    leftRoom: 'ルームを退出しました',
    leftSpectator: '観戦を終了しました',
    full: '満員',
    inGame: 'ゲーム中',
    waiting: '待機中',
    enterRoomId: 'ルームIDを入力するか、リストから選択してください',
    defaultRoomName: 'マイルーム',
    defaultPlayerName: 'プレイヤー',
    defaultSpectatorName: '観戦者',
    totalRooms: '{count} ルーム',
    waitingReconnect: '再接続待ち',
    reconnect: '再接続'
  },

  // ルーム状態
  roomStatus: {
    waiting: '待機中',
    drawing: '配牌中',
    burying: '埋め中',
    playing: 'プレイ中',
    revealing: '公開中',
    finished: '終了',
    paused: '一時停止'
  },

  // ルーム作成フォーム
  createRoomForm: {
    roomNameLabel: 'ルーム名',
    roomNamePlaceholder: 'ルーム名を入力',
    roomNameRequired: 'ルーム名を入力してください',
    playerNameLabel: 'ニックネーム',
    playerNamePlaceholder: 'ニックネームを入力',
    playerNameRequired: 'ニックネームを入力してください',
    bottomCardsLabel: '底牌の枚数',
    bottomCardsRequired: '底牌の枚数を入力してください',
    dealIntervalLabel: '配牌間隔（ミリ秒）',
    dealIntervalRequired: '配牌間隔を入力してください',
    gameModeLabel: 'ゲームモード',
    freeMode: 'フリーモード',
    freeModeOn: 'オン',
    freeModeOff: 'オフ',
    freeModeDesc: 'フリーモード：順番制限なし、いつでもカードをプレイ/表示、スコア/レベル調整可能',
    basicModeDesc: 'ベーシックモード：順番制プレイ、完全なトランプ宣言、スコアリング、レベルアップルール',
    botTypeLabel: 'Botタイプ',
    botTypeDesc: 'WhoDesigned Botはベーシックモードでのみ使用可能です',
    settingsEffectNote: '設定は次のゲームから有効になります',
    bottomCardsValidation: '底牌の枚数は1-20の間である必要があります',
    dealIntervalValidation: '配牌間隔は10-5000ミリ秒の間である必要があります',
    // 初期状態設定
    initialSettingsTitle: '初期状態設定',
    initialSettingsDesc: '設定すると、最初のゲームでデフォルト値の代わりに指定した初期レベルと親を使用します',
    team1InitialLevel: 'チーム1の初期レベル',
    team2InitialLevel: 'チーム2の初期レベル',
    defaultLevel: 'デフォルト（2）',
    initialDealerLabel: '初期の親',
    initialDealerDesc: '設定しない場合、親はトランプ宣言またはランダムで決定されます',
    defaultDealer: 'デフォルト（宣言で決定）',
    position: 'ポジション'
  },

  // Botタイプ
  botType: {
    simple: 'Simple Bot（シンプルAI）',
    whoDesigned: 'WhoDesigned Bot（高度なAI）'
  },

  // ルーム参加
  joinRoomForm: {
    roomIdLabel: 'ルームID',
    roomIdPlaceholder: 'ルームIDを入力',
    roomIdRequired: 'ルームIDを入力してください'
  },

  // ゲーム関連
  game: {
    startGame: 'ゲーム開始',
    restartGame: '再開',
    addBot: 'Bot追加',
    removeBot: 'Bot削除',
    botsInRoom: 'ルーム内のBot',
    waitingToStart: '開始待ち',
    gameStarted: 'ゲーム開始！',
    gameRestarted: 'ゲームを再開しました！',
    waitingForRoom: 'ルーム参加待ち...',
    bottomCards: '底牌',
    dealInterval: '配牌間隔',
    gameMode: 'ゲームモード',
    freeMode: 'フリーモード',
    basicMode: 'ベーシックモード'
  },

  // プレイ関連
  play: {
    playCards: '出す',
    showCards: '見せる',
    selectAll: '全選択',
    undo: '取消',
    pass: 'パス',
    viewBottom: '底牌を見る',
    chat: 'チャット',
    rename: '名前変更',
    setBurying: '親を指定',
    waitingBury: '親の埋め待ち',
    bury: '埋める',
    startNextGame: '次のゲーム',
    cardCount: '({count})',
    buryCount: '({selected}/{required})',
    selectCardsFirst: '先にカードを選択してください',
    selectCardsToShow: '見せるカードを選択してください',
    selectPlayerFirst: 'プレイヤーを選択してください',
    selectBuryingPlayer: '埋めプレイヤーを選択してください',
    selectCorrectBuryCount: '{count}枚のカードを選択して埋めてください',
    noCardsToSelect: '選択できるカードがありません',
    cannotUndo: '取消できません',
    notYourTurn: 'あなたの番ではありません',
    myTurn: 'あなたの番',
    viewLastRound: '前ラウンド',
    lastRoundTitle: '前ラウンドのカード',
    lastRoundWinner: '勝者: {name}',
    noLastRound: '前ラウンドの記録がありません',
    saveGlobal: 'ゲーム保存',
    saveGlobalSuccess: 'ゲーム記録をダウンロードしました',
    saveGlobalError: 'ゲーム記録のダウンロードに失敗しました'
  },

  // スコアとレベル調整
  adjust: {
    adjustScore: 'スコア調整',
    adjustLevel: 'レベル調整',
    currentScore: '現在: {score}',
    currentLevel: '現在: {level}',
    newScore: '新しいスコア',
    newLevel: '新しいレベル',
    scoreUpdated: 'スコアが更新されました',
    levelUpdated: 'レベルが更新されました',
    minusScore: '-5点',
    plusScore5: '+5点',
    plusScore10: '+10点',
    minusLevel: '-1レベル',
    plusLevel: '+1レベル'
  },

  // トランプ関連
  trump: {
    trump: 'トランプ',
    trumpCard: 'トランプカード',
    setTrump: '設定',
    modifyTrump: '変更',
    notSet: '未設定',
    trumpSet: 'トランプが設定されました',
    declareTrump: '宣言:',
    suit: 'スート',
    rank: 'ランク',
    hearts: 'ハート',
    diamonds: 'ダイヤ',
    clubs: 'クラブ',
    spades: 'スペード',
    noTrump: 'ノートランプ',
    joker: 'ジョーカー',
    trumpAction: '切り札！',
    overTrumpAction: 'オーバートランプ！',
    dealerCountdown: '親決定カウントダウン',
    countdownReset: '誰かが宣言、カウントダウンリセット',
    randomDealer: '宣言なし、ランダムで親を決定'
  },

  // スートシンボル
  suits: {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠',
    joker: 'ジョーカー'
  },

  // 底牌とスコア
  bottom: {
    bottomCards: '底牌',
    myBottomCards: '自分の底牌',
    buriedCards: '{count}枚を埋めました',
    bottomCardsCount: '{count}枚',
    bottomRevealed: '底牌公開: {count}枚',
    receivedBottomCards: '底牌{count}枚を受け取りました、合計{total}枚',
    buryingPlayerSet: '{name}が埋めプレイヤーに指定されました',
    buryCompleted: '{name}が埋めを完了しました',
    attackerScore: '攻撃側スコア',
    pointCards: 'ポイントカード',
    attackerWonBottom: '攻撃側が底牌を獲得！',
    dealerKeptBottom: '親が底牌を守った！',
    bottomPoints: '底牌{points}点×{multiplier}倍={gained}点',
    totalScore: '攻撃側合計: {score}点',
    attackerWins: '🎉 攻撃側の勝利！',
    dealerWins: '👑 親の勝利！',
    dealerTeam: '親チーム',
    attackerTeam: '攻撃チーム',
    levelUp: '↑ {count}レベルアップ',
    nextDealer: '次の親',
    level: 'レベル'
  },

  // ルール関連
  rules: {
    rule: 'ルール',
    selectRule: '選択',
    changeRule: '変更',
    noRuleSelected: 'ルール未選択',
    selectGameRule: 'ゲームルールを選択',
    randomSelect: 'ランダム',
    customRule: 'カスタムルール',
    searchRule: 'ルール名または内容を検索...',
    noMatchingRules: '一致するルールが見つかりません',
    totalRules: '{count}件のルール',
    filteredRules: '({total}件からフィルタ)',
    ruleName: 'ルール名:',
    ruleContent: 'ルール内容:',
    ruleNamePlaceholder: 'ルール名を入力（最大20文字）',
    ruleContentPlaceholder: 'ルール内容を入力（最大200文字）',
    ruleSelected: '選択されたルール: {name}',
    customRuleSaved: 'カスタムルールを保存: {name}',
    loadRuleFailed: 'ルールの読み込みに失敗しました。DLC.jsonを確認してください',
    noRulesAvailable: '利用可能なルールがありません',
    ruleNameEmpty: 'ルール名は空にできません',
    ruleContentEmpty: 'ルール内容は空にできません',
    ruleNameTooLong: 'ルール名は20文字以下にしてください',
    ruleContentTooLong: 'ルール内容は200文字以下にしてください'
  },

  // チャット関連
  chat: {
    chat: 'チャット',
    quickPhrases: 'クイックフレーズ',
    manageQuickPhrases: 'フレーズ管理',
    sendMessage: 'メッセージ送信',
    messagePlaceholder: 'メッセージを入力（最大200文字、絵文字対応）',
    noChatHistory: 'チャット履歴なし',
    commonEmojis: 'よく使う絵文字:',
    existingPhrases: '既存のフレーズ:',
    noQuickPhrases: 'クイックフレーズなし',
    addNewPhrase: '新しいフレーズを追加',
    newPhrasePlaceholder: 'クイックフレーズを入力（最大50文字）',
    phraseAdded: 'クイックフレーズを追加しました',
    phraseDeleted: 'クイックフレーズを削除しました',
    messageEmpty: 'メッセージは空にできません',
    messageTooLong: 'メッセージは200文字以下にしてください',
    phraseEmpty: 'クイックフレーズは空にできません',
    phraseTooLong: 'クイックフレーズは50文字以下にしてください',
    phraseExists: 'このクイックフレーズは既に存在します'
  },

  // ニックネーム関連
  nickname: {
    modifyNickname: 'ニックネーム変更',
    newNickname: '新しいニックネーム:',
    nicknamePlaceholder: '新しいニックネームを入力（最大20文字）',
    nicknameEmpty: 'ニックネームは空にできません',
    nicknameTooLong: 'ニックネームは20文字以下にしてください',
    nicknameUpdated: 'ニックネームを変更しました: {name}',
    playerRenamed: '{oldName}がニックネームを変更しました: {newName}'
  },

  // 通知メッセージ
  messages: {
    playerJoined: '{name}がルームに参加しました',
    playerLeft: '{name}がルームを退出しました',
    spectatorJoined: '{name}が観戦を開始しました',
    spectatorLeft: '{name}が観戦を終了しました',
    playerReady: '{name}が準備完了しました',
    playerCancelReady: '{name}が準備を取り消しました',
    allPlayersReady: '全員が準備完了しました',
    cardsShown: '{name}が{count}枚のカードを見せました',
    cardsPlayed: '{name}が{count}枚のカードを出しました',
    turnPassed: '{name}がパスしました',
    playUndone: '{name}が取り消しました',
    firstPlayerSet: '{name}が最初にプレイします',
    currentTurn: '{name}の番です',
    roundStarted: 'ラウンド{round}開始',
    roundEnded: 'ラウンド{round}終了、{winner}が勝ち、次のラウンドを先行',
    attackerGotPoints: '攻撃側が{points}点獲得、合計: {total}点',
    botAdded: 'Bot {name}がルームに参加しました',
    botRemoved: 'Bot {name}がルームを退出しました',
    configUpdated: 'ルーム設定が更新されました、次のゲームから有効',
    throwFailed: '{name}の投げが失敗、{count}枚をプレイ',
    declaredSingle: '{name}が宣言: シングル{suit}',
    declaredPair: '{name}が宣言: ペア{suit}',
    counterDeclare: '{name}が反宣言: {type} {suit}',
    ruleSelected: '{name}がルールを選択: {rule}',
    playerReadyForNext: '{name}が準備完了 ({ready}/{total})',
    nextGameStarted: '次のゲームを開始！',
    errorOccurred: 'エラーが発生しました',
    playerDisconnected: '{name}が切断されました、再接続待ち...',
    playerReconnected: '{name}が再接続しました',
    youRejoined: '再接続に成功しました、{from}のポジションを継承しました',
    gamePaused: 'プレイヤー {name} が切断されました、ゲームが一時停止しました',
    gameResumed: 'ゲームが再開しました'
  },

  // 手札関連
  hand: {
    handCards: '手札',
    cardCount: 'カード: {count}',
    tractor: 'トラクター',
    show: '表示:',
    myShow: '自分の表示:'
  },

  // カード表示
  card: {
    smallJoker: '小ジョーカー',
    bigJoker: '大ジョーカー'
  },

  // チーム
  team: {
    myTeam: '自チーム',
    opponentTeam: '相手チーム',
    teamLevel: 'レベル'
  },

  // 観戦関連
  spectator: {
    spectatorMode: '観戦モード',
    spectatorModeHint: 'このルームを観戦しています',
    spectatorList: '観戦者一覧',
    spectatorCount: '{count}人が観戦中',
    noSpectators: '観戦者なし',
    watchingGame: 'ゲームを観戦中...',
    cannotInteract: '観戦者は操作できません',
    viewHand: '手札を見る',
    viewHandTitle: '{name}の手札',
    viewHandNotAllowed: 'ホストが手札閲覧を無効にしています',
    allowSpectators: '観戦を許可',
    allowSpectatorViewHands: '手札閲覧を許可',
    spectatorSettingsDesc: '観戦者がルームに参加してゲームを観戦できるようにする',
    viewHandsSettingsDesc: '観戦者がプレイヤーの手札を見られるようにする'
  },

  // ゲーム一時停止関連
  pause: {
    gamePaused: 'ゲームが一時停止しました',
    playerDisconnected: 'プレイヤー {name} が切断されました',
    waitingForReconnect: '再接続待ち...'
  },

  // 言語
  language: {
    switch: '言語切替',
    chinese: '中文',
    english: 'English',
    japanese: '日本語'
  },

  // 設定
  settings: {
    settings: '設定',
    language: '言語',
    hideNotifications: '通知を非表示',
    hideNotificationsDesc: '有効にすると、すべてのポップアップ（誰がカードを出したかなど）をブロックします'
  }
};
