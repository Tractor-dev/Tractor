// English translation
export default {
  // Common
  common: {
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    confirm: 'Confirm',
    create: 'Create',
    join: 'Join',
    leave: 'Leave',
    refresh: 'Refresh',
    send: 'Send',
    add: 'Add',
    delete: 'Delete',
    back: 'Back',
    loading: 'Loading...',
    none: 'None',
    score: 'Score',
    level: 'Level',
    cards: 'cards',
    points: 'pts',
    ready: 'Ready',
    cancelReady: 'Cancel',
    readied: 'Ready',
    notReady: 'Not Ready',
    me: 'Me',
    host: 'Host',
    bot: 'Bot',
    dealer: 'Dealer',
    attacker: 'Attacker',
    you: 'You'
  },

  // Connection status
  connection: {
    connected: 'Connected',
    disconnected: 'Disconnected',
    connecting: 'Connecting...',
    connectedToServer: 'Connected to server',
    disconnectedFromServer: 'Disconnected from server',
    connectionStatus: 'Status'
  },

  // App title
  app: {
    title: 'Tractor Card Game Simulator',
    welcome: 'Welcome to Tractor Card Game',
    subtitle: 'Online multiplayer Tractor card game simulator'
  },

  // Room related
  room: {
    createRoom: 'Create Room',
    joinRoom: 'Join Room',
    leaveRoom: 'Leave Room',
    roomList: 'Room List',
    roomName: 'Room Name',
    roomId: 'Room ID',
    players: 'Players',
    playerCount: 'Players',
    playerList: 'Player List',
    roomConfig: 'Room Config',
    roomSettings: 'Room Settings',
    modifySettings: 'Settings',
    noRooms: 'No rooms available. Click "Create Room" to start.',
    roomCreated: 'Room created successfully!',
    joinedRoom: 'Joined room successfully!',
    leftRoom: 'Left room',
    full: 'Full',
    inGame: 'In Game',
    waiting: 'Waiting',
    enterRoomId: 'Enter room ID or select from list',
    defaultRoomName: 'My Room',
    defaultPlayerName: 'Player',
    totalRooms: '{count} rooms'
  },

  // Room status
  roomStatus: {
    waiting: 'Waiting',
    drawing: 'Drawing',
    burying: 'Burying',
    playing: 'Playing',
    revealing: 'Revealing',
    finished: 'Finished'
  },

  // Create room form
  createRoomForm: {
    roomNameLabel: 'Room Name',
    roomNamePlaceholder: 'Enter room name',
    roomNameRequired: 'Please enter room name',
    playerNameLabel: 'Your Nickname',
    playerNamePlaceholder: 'Enter your nickname',
    playerNameRequired: 'Please enter nickname',
    bottomCardsLabel: 'Bottom Cards Count',
    bottomCardsRequired: 'Please enter bottom cards count',
    dealIntervalLabel: 'Deal Interval (ms)',
    dealIntervalRequired: 'Please enter deal interval',
    gameModeLabel: 'Game Mode',
    freeMode: 'Free Mode',
    freeModeOn: 'On',
    freeModeOff: 'Off',
    freeModeDesc: 'Free Mode: No turn order, can play/show cards and adjust score/level anytime',
    basicModeDesc: 'Basic Mode: Turn-based play with complete trump declaration, scoring and leveling rules',
    botTypeLabel: 'Bot Type',
    botTypeDesc: 'WhoDesigned Bot can only be used in Basic Mode',
    settingsEffectNote: 'Settings will take effect in the next game',
    bottomCardsValidation: 'Bottom cards count must be between 1-20',
    dealIntervalValidation: 'Deal interval must be between 10-5000ms'
  },

  // Bot types
  botType: {
    simple: 'Simple Bot (Basic AI)',
    whoDesigned: 'WhoDesigned Bot (Advanced AI)'
  },

  // Join room
  joinRoomForm: {
    roomIdLabel: 'Room ID',
    roomIdPlaceholder: 'Enter room ID',
    roomIdRequired: 'Please enter room ID'
  },

  // Game related
  game: {
    startGame: 'Start Game',
    restartGame: 'Restart',
    addBot: 'Add Bot',
    removeBot: 'Remove Bot',
    botsInRoom: 'Bots in Room',
    waitingToStart: 'Waiting to Start',
    gameStarted: 'Game started!',
    gameRestarted: 'Game restarted!',
    waitingForRoom: 'Waiting to join room...',
    bottomCards: 'Bottom Cards',
    dealInterval: 'Deal Interval',
    gameMode: 'Game Mode',
    freeMode: 'Free Mode',
    basicMode: 'Basic Mode'
  },

  // Playing related
  play: {
    playCards: 'Play',
    showCards: 'Show',
    selectAll: 'Select All',
    undo: 'Undo',
    pass: 'Pass',
    viewBottom: 'View Bottom',
    chat: 'Chat',
    rename: 'Rename',
    setBurying: 'Set Dealer',
    waitingBury: 'Waiting for dealer',
    bury: 'Bury',
    startNextGame: 'Next Game',
    cardCount: '({count})',
    buryCount: '({selected}/{required})',
    selectCardsFirst: 'Please select cards first',
    selectCardsToShow: 'Please select cards to show',
    selectPlayerFirst: 'Please select a player',
    selectBuryingPlayer: 'Please select burying player',
    selectCorrectBuryCount: 'Please select {count} cards to bury',
    noCardsToSelect: 'No cards to select',
    cannotUndo: 'Cannot undo',
    notYourTurn: 'Not your turn',
    myTurn: 'Your turn'
  },

  // Score and level adjustment
  adjust: {
    adjustScore: 'Adjust Score',
    adjustLevel: 'Adjust Level',
    currentScore: 'Current: {score}',
    currentLevel: 'Current: {level}',
    newScore: 'New Score',
    newLevel: 'New Level',
    scoreUpdated: 'Score updated',
    levelUpdated: 'Level updated',
    minusScore: '-5 pts',
    plusScore5: '+5 pts',
    plusScore10: '+10 pts',
    minusLevel: '-1 lvl',
    plusLevel: '+1 lvl'
  },

  // Trump related
  trump: {
    trump: 'Trump',
    trumpCard: 'Trump Card',
    setTrump: 'Set',
    modifyTrump: 'Modify',
    notSet: 'Not Set',
    trumpSet: 'Trump has been set',
    declareTrump: 'Declare:',
    suit: 'Suit',
    rank: 'Rank',
    hearts: 'Hearts',
    diamonds: 'Diamonds',
    clubs: 'Clubs',
    spades: 'Spades',
    noTrump: 'No Trump',
    joker: 'Joker',
    trumpAction: 'Trumped!',
    overTrumpAction: 'Over-trumped!',
    dealerCountdown: 'Dealer Countdown',
    countdownReset: 'Someone declared, countdown reset',
    randomDealer: 'No declaration, random dealer'
  },

  // Suit symbols
  suits: {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠',
    joker: 'Joker'
  },

  // Bottom cards and score
  bottom: {
    bottomCards: 'Bottom Cards',
    myBottomCards: 'My Bottom Cards',
    buriedCards: 'Buried {count} cards',
    bottomCardsCount: '{count} cards',
    bottomRevealed: 'Bottom cards revealed: {count} cards',
    receivedBottomCards: 'Received {count} bottom cards, total {total} cards',
    buryingPlayerSet: '{name} is set as the burying player',
    buryCompleted: '{name} completed burying',
    attackerScore: 'Attacker Score',
    pointCards: 'Point Cards',
    attackerWonBottom: 'Attacker won bottom!',
    dealerKeptBottom: 'Dealer kept bottom!',
    bottomPoints: 'Bottom {points}pts × {multiplier} = {gained}pts',
    totalScore: 'Attacker total: {score} pts',
    attackerWins: '🎉 Attacker Wins!',
    dealerWins: '👑 Dealer Wins!',
    dealerTeam: 'Dealer Team',
    attackerTeam: 'Attacker Team',
    levelUp: '↑ Up {count} level(s)',
    nextDealer: 'Next Dealer',
    level: 'Level'
  },

  // Rules related
  rules: {
    rule: 'Rule',
    selectRule: 'Select',
    changeRule: 'Change',
    noRuleSelected: 'No rule selected',
    selectGameRule: 'Select Game Rule',
    randomSelect: 'Random',
    customRule: 'Custom Rule',
    searchRule: 'Search rule name or content...',
    noMatchingRules: 'No matching rules found',
    totalRules: '{count} rules',
    filteredRules: '(filtered from {total})',
    ruleName: 'Rule Name:',
    ruleContent: 'Rule Content:',
    ruleNamePlaceholder: 'Enter rule name (max 20 chars)',
    ruleContentPlaceholder: 'Enter rule content (max 200 chars)',
    ruleSelected: 'Selected rule: {name}',
    customRuleSaved: 'Custom rule saved: {name}',
    loadRuleFailed: 'Failed to load rules, please check DLC.json',
    noRulesAvailable: 'No rules available',
    ruleNameEmpty: 'Rule name cannot be empty',
    ruleContentEmpty: 'Rule content cannot be empty',
    ruleNameTooLong: 'Rule name cannot exceed 20 characters',
    ruleContentTooLong: 'Rule content cannot exceed 200 characters'
  },

  // Chat related
  chat: {
    chat: 'Chat',
    quickPhrases: 'Quick Phrases',
    manageQuickPhrases: 'Manage Phrases',
    sendMessage: 'Send Message',
    messagePlaceholder: 'Enter message (max 200 chars, emoji supported)',
    noChatHistory: 'No chat history',
    commonEmojis: 'Common emojis:',
    existingPhrases: 'Existing phrases:',
    noQuickPhrases: 'No quick phrases',
    addNewPhrase: 'Add New Phrase',
    newPhrasePlaceholder: 'Enter quick phrase (max 50 chars)',
    phraseAdded: 'Quick phrase added',
    phraseDeleted: 'Quick phrase deleted',
    messageEmpty: 'Message cannot be empty',
    messageTooLong: 'Message cannot exceed 200 characters',
    phraseEmpty: 'Quick phrase cannot be empty',
    phraseTooLong: 'Quick phrase cannot exceed 50 characters',
    phraseExists: 'This quick phrase already exists'
  },

  // Nickname related
  nickname: {
    modifyNickname: 'Change Nickname',
    newNickname: 'New Nickname:',
    nicknamePlaceholder: 'Enter new nickname (max 20 chars)',
    nicknameEmpty: 'Nickname cannot be empty',
    nicknameTooLong: 'Nickname cannot exceed 20 characters',
    nicknameUpdated: 'Nickname changed to: {name}',
    playerRenamed: '{oldName} changed nickname to: {newName}'
  },

  // Notification messages
  messages: {
    playerJoined: '{name} joined the room',
    playerLeft: '{name} left the room',
    playerReady: '{name} is ready',
    playerCancelReady: '{name} cancelled ready',
    allPlayersReady: 'All players are ready',
    cardsShown: '{name} showed {count} cards',
    cardsPlayed: '{name} played {count} cards',
    turnPassed: '{name} passed',
    playUndone: '{name} undid the play',
    firstPlayerSet: '{name} plays first',
    currentTurn: 'It\'s {name}\'s turn',
    roundStarted: 'Round {round} started',
    roundEnded: 'Round {round} ended, {winner} wins, leads next round',
    attackerGotPoints: 'Attacker got {points}pts, total: {total}pts',
    botAdded: 'Bot {name} joined the room',
    botRemoved: 'Bot {name} left the room',
    configUpdated: 'Room settings updated, effective next game',
    throwFailed: '{name} throw failed, played {count} cards',
    declaredSingle: '{name} declared: single {suit}',
    declaredPair: '{name} declared: pair of {suit}',
    counterDeclare: '{name} counter-declared: {type} {suit}',
    ruleSelected: '{name} selected rule: {rule}',
    playerReadyForNext: '{name} is ready ({ready}/{total})',
    nextGameStarted: 'Starting next game!',
    errorOccurred: 'An error occurred'
  },

  // Hand related
  hand: {
    handCards: 'Hand',
    cardCount: 'Cards: {count}',
    tractor: 'Tractor',
    show: 'Shown:',
    myShow: 'My Show:'
  },

  // Card display
  card: {
    smallJoker: 'SJ',
    bigJoker: 'BJ'
  },

  // Team
  team: {
    myTeam: 'Our Team',
    opponentTeam: 'Opponent',
    teamLevel: 'Level'
  },

  // Language
  language: {
    switch: 'Language',
    chinese: '中文',
    english: 'English',
    japanese: '日本語'
  }
};
