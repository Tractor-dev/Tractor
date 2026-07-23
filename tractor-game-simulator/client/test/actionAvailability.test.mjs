import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getActiveBuryingPlayerId,
  getActiveSkillAvailability,
  getFinalTrickAutoSelectedCardIds,
  getPlayActionLabel,
  getRuleDisabledLeadCardIds,
  isBurySelectionValid,
  isCurrentPlayersTurn,
  validatePlaySelection
} from '../src/utils/actionAvailability.js';
import {
  calculateMustPlayCards,
  detectPattern,
  getCardStrength,
  isTrumpCard,
  PatternTypes
} from '../src/utils/cardPatternUtils.js';
import {
  calculateCardPoints,
  getCardPoints,
  getScoringDisplayCard,
  getThreePowersCardPoints
} from '../src/utils/scoringUtils.js';
import { sortCards } from '../src/utils/cardUtils.js';
import { detectThreeSixNineDeclarations } from '../src/utils/trumpUtils.js';
import { isIronEvidenceSpecialCard } from '../src/utils/ironEvidenceUtils.js';

const card = (id, suit, rank) => ({ id, suit, rank });

test('最后一墩首家出完后，按本墩首家位置自动选中跟牌者的全部剩余手牌', () => {
  const players = [
    { id: 'player-0', cardsCount: 3 },
    { id: 'player-1', cardsCount: 3 },
    { id: 'player-2', cardsCount: 0 },
    { id: 'player-3', cardsCount: 3 }
  ];
  const handCards = [
    card('heart-5', 'hearts', '5'),
    card('club-10', 'clubs', '10'),
    card('spade-K', 'spades', 'K')
  ];
  const gameState = {
    playersPlayedThisRound: [2],
    leadingPattern: { length: 3 }
  };

  assert.deepEqual(
    getFinalTrickAutoSelectedCardIds({ gameState, players, handCards }),
    handCards.map(value => value.id)
  );
});

test('非最后一墩或剩余张数与首家不一致时不触发整手自动选中', () => {
  const handCards = [
    card('heart-5', 'hearts', '5'),
    card('club-10', 'clubs', '10'),
    card('spade-K', 'spades', 'K')
  ];
  const gameState = {
    playersPlayedThisRound: [1],
    leadingPattern: { length: 3 }
  };

  assert.equal(getFinalTrickAutoSelectedCardIds({
    gameState,
    players: [{ cardsCount: 3 }, { cardsCount: 1 }],
    handCards
  }), null);
  assert.equal(getFinalTrickAutoSelectedCardIds({
    gameState,
    players: [{ cardsCount: 3 }, { cardsCount: 0 }],
    handCards: handCards.slice(0, 2)
  }), null);
});

test('二律背反前端把唯一声明牌面拆成单牌，重复声明牌面仍可成对', () => {
  const splitPair = [card('c7-0', 'clubs', '7'), card('c7-1', 'clubs', '7')];
  const duplicatePair = [card('h5-0', 'hearts', '5'), card('h5-1', 'hearts', '5')];
  const rule = {
    id: 'antinomy',
    antinomySplitFaceKeys: ['clubs:7']
  };

  assert.equal(
    detectPattern(splitPair, 'spades', '2', rule).type,
    PatternTypes.INVALID
  );
  assert.equal(
    detectPattern(duplicatePair, 'spades', '2', rule).type,
    PatternTypes.PAIR
  );
});

test('调虎离山按钮支持随时预备，并在队友抢占阵营次数后锁定', () => {
  const players = [0, 1, 2, 3].map(index => ({ id: `player-${index}` }));
  const baseState = {
    phase: 'playing',
    currentRound: 3,
    currentRoundPlays: 2,
    playersPlayedThisRound: [0, 1],
    selectedRule: {
      id: 'lure_tiger_from_mountain',
      activeSkill: {
        id: 'lure_tiger_from_mountain',
        name: '调虎离山',
        usageLimit: 1,
        timing: 'anytime_prepare_round_start_confirm',
        effect: 'silence_non_leader_for_round'
      }
    },
    activeSkillUsesByPlayerId: {},
    lureTiger: {
      reservations: [],
      usedTeamIndexes: [],
      currentDecision: null
    }
  };
  const available = getActiveSkillAvailability({
    gameState: baseState,
    players,
    currentPlayerId: 'player-2'
  });
  assert.equal(available.canActivate, true);
  assert.equal(available.targetRound, 4);

  const reserved = getActiveSkillAvailability({
    gameState: {
      ...baseState,
      lureTiger: {
        ...baseState.lureTiger,
        reservations: [{ playerId: 'player-2', targetRound: 4 }]
      }
    },
    players,
    currentPlayerId: 'player-2'
  });
  assert.equal(reserved.isReserved, true);
  assert.equal(reserved.canActivate, false);

  const teammateUsed = getActiveSkillAvailability({
    gameState: {
      ...baseState,
      activeSkillUsesByPlayerId: { 'player-0': ['lure_tiger_from_mountain'] },
      lureTiger: {
        ...baseState.lureTiger,
        usedTeamIndexes: [0]
      }
    },
    players,
    currentPlayerId: 'player-2'
  });
  assert.equal(teammateUsed.isUsed, true);
  assert.equal(teammateUsed.canActivate, false);
  assert.match(teammateUsed.reason, /队友已抢先/);
});

test('铁证如山前端只标记小王、红桃Q、黑桃J和梅花J', () => {
  assert.deepEqual([
    card('small-joker', 'joker', 'small_joker'),
    card('heart-q', 'hearts', 'Q'),
    card('spade-j', 'spades', 'J'),
    card('club-j', 'clubs', 'J'),
    card('club-k', 'clubs', 'K'),
    card('diamond-j', 'diamonds', 'J'),
    card('big-joker', 'joker', 'big_joker')
  ].map(isIronEvidenceSpecialCard), [true, true, true, true, false, false, false]);
});

test('三人成虎的扩展负数牌面仍按主牌连续比较', () => {
  const rule = { id: 'three_tigers' };
  const minusTwo = {
    ...card('heart-minus-two', 'hearts', '-2'),
    originalRank: '2',
    isThreeTigersTransformed: true,
    isThreeTigersTrump: true
  };
  const minusOne = {
    ...card('heart-minus-one', 'hearts', '-1'),
    originalRank: '3',
    isThreeTigersTransformed: true,
    isThreeTigersTrump: true
  };

  assert.equal(isTrumpCard(minusTwo, 'spades', '9'), true);
  assert.ok(
    getCardStrength(minusOne, 'spades', '9', rule)
      > getCardStrength(minusTwo, 'spades', '9', rule)
  );
});

test('三六九等前端按共享花色锁定主劣按钮，并保留原声明者的加固入口', () => {
  const currentTrumpDeclaration = {
    playerId: 'player-0',
    suit: 'hearts',
    declarationType: 'single_rank',
    strength: 1
  };
  const state = {
    currentTrumpDeclaration,
    currentInferiorDeclaration: null,
    claimedSuits: {
      hearts: { playerId: 'player-0', declarationRole: 'trump' }
    }
  };
  const otherPlayerOptions = detectThreeSixNineDeclarations([
    card('heart-2-a', 'hearts', '2'),
    card('heart-2-b', 'hearts', '2'),
    card('club-2-a', 'clubs', '2')
  ], '2', state, 'player-1');
  assert.equal(
    otherPlayerOptions.some(option => option.suit === 'hearts' && option.canDeclare),
    false
  );
  assert.equal(
    otherPlayerOptions.some(option => (
      option.suit === 'clubs'
      && option.declarationRole === 'inferior'
      && option.canDeclare
    )),
    true
  );

  const ownerOptions = detectThreeSixNineDeclarations([
    card('owner-heart-2-a', 'hearts', '2'),
    card('owner-heart-2-b', 'hearts', '2')
  ], '2', state, 'player-0');
  assert.equal(ownerOptions.some(option => (
    option.suit === 'hearts'
    && option.declarationRole === 'trump'
    && option.count === 2
    && option.isReinforce
    && option.canDeclare
  )), true);
  assert.equal(ownerOptions.some(option => (
    option.suit === 'hearts'
    && option.declarationRole === 'inferior'
    && option.canDeclare
  )), false);
});

test('三六九等前端把劣花色排在普通副牌之后，并显示正确级牌层级', () => {
  const rule = { id: 'three_six_nine_grades', inferiorSuit: 'hearts' };
  assert.deepEqual(
    sortCards([
      card('inferior-a', 'hearts', 'A'),
      card('side-club', 'clubs', '3'),
      card('trump-five', 'spades', '5'),
      card('side-diamond', 'diamonds', '4')
    ], 'spades', '2', 'hearts').map(value => value.id),
    ['trump-five', 'side-club', 'side-diamond', 'inferior-a']
  );
  assert.equal(getCardStrength(card('trump-a', 'spades', 'A'), 'spades', '2', rule), 995);
  assert.equal(getCardStrength(card('inferior-2', 'hearts', '2'), 'spades', '2', rule), 996);
  assert.equal(getCardStrength(card('side-2', 'clubs', '2'), 'spades', '2', rule), 997);
});

test('埋底按钮只在选中张数恰好正确时可用', () => {
  assert.equal(isBurySelectionValid([], 8), false);
  assert.equal(isBurySelectionValid(['1', '2', '3', '4', '5', '6', '7'], 8), false);
  assert.equal(isBurySelectionValid(['1', '2', '3', '4', '5', '6', '7', '8'], 8), true);
  assert.equal(isBurySelectionValid(['1', '2', '3', '4', '5', '6', '7', '8', '9'], 8), false);
});

test('改革开放再埋底时只把庄家队友视为当前埋底玩家', () => {
  assert.equal(getActiveBuryingPlayerId({ buryingPlayerId: 'dealer' }), 'dealer');
  assert.equal(getActiveBuryingPlayerId({
    buryingPlayerId: 'dealer',
    secondaryBuryingPlayerId: 'teammate'
  }), 'teammate');
  assert.equal(getActiveBuryingPlayerId({
    buryingPlayerId: 'dealer',
    peopleCommune: { currentBuryingPlayerId: 'commune-player' }
  }), 'commune-player');
});

test('只有当前行动玩家可以启用出牌按钮', () => {
  const players = [{ id: 'p1' }, { id: 'p2' }];
  assert.equal(isCurrentPlayersTurn({ playMode: 'ordered', currentPlayerIndex: 1 }, players, 'p1'), false);
  assert.equal(isCurrentPlayersTurn({ playMode: 'ordered', currentPlayerIndex: 1 }, players, 'p2'), true);
  assert.equal(isCurrentPlayersTurn({ playMode: 'free', currentPlayerIndex: null }, players, 'p1'), true);
});

test('只有李代桃僵发动后把按钮称为垫牌，其他主动技能仍称为出牌', () => {
  assert.equal(getPlayActionLabel({
    isActiveSkillArmed: true,
    activeSkill: { id: 'substitute_sacrifice', effect: 'free_discard_treated_small' }
  }), '垫牌');
  assert.equal(getPlayActionLabel({
    isActiveSkillArmed: true,
    activeSkill: { id: 'concealed_passage', effect: 'concealed_until_round_end' }
  }), '出牌');
  assert.equal(getPlayActionLabel({
    isActiveSkillArmed: true,
    activeSkill: { id: 'stealing_beams', effect: 'joker_wildcards' }
  }), '出牌');
});

test('算无遗策轮到明手时只有庄家获得操作权', () => {
  const players = [{ id: 'dealer' }, { id: 'attacker-1' }, { id: 'open-hand' }, { id: 'attacker-2' }];
  const gameState = {
    playMode: 'ordered',
    currentPlayerIndex: 2,
    openHandPlayerId: 'open-hand',
    openHandControllerPlayerId: 'dealer'
  };

  assert.equal(isCurrentPlayersTurn(gameState, players, 'dealer'), true);
  assert.equal(isCurrentPlayersTurn(gameState, players, 'open-hand'), false);
  assert.equal(isCurrentPlayersTurn(gameState, players, 'attacker-1'), false);
});

test('首发只有同一有效花色的选牌才会启用出牌', () => {
  const handCards = [
    card('s9', 'spades', '9'),
    card('s10', 'spades', '10'),
    card('h9', 'hearts', '9')
  ];
  const gameState = { currentRoundPlays: 0, playersPlayedThisRound: [] };

  assert.equal(validatePlaySelection({
    selectedCardIds: ['s9', 's10'], handCards, gameState
  }).valid, true);
  assert.equal(validatePlaySelection({
    selectedCardIds: ['s9', 'h9'], handCards, gameState
  }).valid, false);
});

test('一国两制前端按阵营换色后校验跟牌', () => {
  const handCards = [
    card('attacker-spade-10', 'spades', '10'),
    card('attacker-heart-A', 'hearts', 'A')
  ];
  const gameState = {
    currentRoundPlays: 1,
    playersPlayedThisRound: [0],
    currentPlayerIndex: 1,
    currentRound: 1,
    selectedRule: { id: 'one_country_two_systems', name: '一国两制' },
    leadingPattern: detectPattern(
      [card('dealer-heart-9', 'hearts', '9')],
      'hearts',
      '2'
    ),
    oneCountryTwoSystems: {
      resolved: {
        dealerTeamIndex: 0,
        attackerTeamIndex: 1,
        dealerSuit: 'hearts',
        attackerSuit: 'spades',
        canonicalTrumpSuit: 'hearts',
        teamTrumpSuits: { 0: 'hearts', 1: 'spades' },
        hasDistinctTeamSuits: true,
        isNoTrump: false
      }
    }
  };

  assert.equal(validatePlaySelection({
    selectedCardIds: ['attacker-heart-A'],
    handCards,
    gameState,
    trumpSuit: 'hearts',
    trumpRank: '2',
    currentPlayerId: 'attacker'
  }).valid, false);
  assert.equal(validatePlaySelection({
    selectedCardIds: ['attacker-spade-10'],
    handCards,
    gameState,
    trumpSuit: 'hearts',
    trumpRank: '2',
    currentPlayerId: 'attacker'
  }).valid, true);
});

test('单步调试首发禁用甩牌，但允许完整对子和拖拉机', () => {
  const handCards = [
    card('s3a', 'spades', '3'),
    card('s3b', 'spades', '3'),
    card('s4a', 'spades', '4'),
    card('s4b', 'spades', '4'),
    card('s7', 'spades', '7')
  ];
  const gameState = {
    currentRoundPlays: 0,
    playersPlayedThisRound: [],
    selectedRule: { id: 'single_step_debug', name: '单步调试' }
  };

  const throwResult = validatePlaySelection({
    selectedCardIds: ['s3a', 's7'], handCards, gameState
  });
  assert.equal(throwResult.valid, false);
  assert.equal(throwResult.message, '单步调试规则下不能甩牌');
  assert.equal(validatePlaySelection({
    selectedCardIds: ['s3a', 's3b'], handCards, gameState
  }).valid, true);
  assert.equal(validatePlaySelection({
    selectedCardIds: ['s3a', 's3b', 's4a', 's4b'], handCards, gameState
  }).valid, true);
});

test('跟牌必须满足首家张数与花色要求才会启用出牌', () => {
  const handCards = [
    card('s9', 'spades', '9'),
    card('s10', 'spades', '10'),
    card('h9', 'hearts', '9')
  ];
  const gameState = {
    currentRoundPlays: 1,
    playersPlayedThisRound: [0],
    leadingPattern: { type: 'pair', suit: 'spades', length: 2 }
  };

  assert.equal(validatePlaySelection({
    selectedCardIds: ['s9'], handCards, gameState
  }).valid, false);
  assert.equal(validatePlaySelection({
    selectedCardIds: ['s9', 'h9'], handCards, gameState
  }).valid, false);
  assert.equal(validatePlaySelection({
    selectedCardIds: ['s9', 's10'], handCards, gameState
  }).valid, true);
});

test('主动技能按钮只在自己的跟牌回合可发动，使用后保持禁用', () => {
  const players = [{ id: 'p1' }, { id: 'p2' }];
  const baseState = {
    playMode: 'ordered',
    currentPlayerIndex: 1,
    currentRoundPlays: 1,
    leadingPattern: { type: 'pair', suit: 'spades', length: 2 },
    selectedRule: {
      id: 'substitute_sacrifice',
      activeSkill: { id: 'substitute_sacrifice', name: '李代桃僵' }
    },
    activeSkillUsesByPlayerId: {}
  };

  const available = getActiveSkillAvailability({
    gameState: baseState,
    players,
    currentPlayerId: 'p2'
  });
  assert.equal(available.visible, true);
  assert.equal(available.canActivate, true);
  assert.equal(available.isUsed, false);

  assert.equal(getActiveSkillAvailability({
    gameState: baseState,
    players,
    currentPlayerId: 'p1'
  }).canActivate, false);

  const used = getActiveSkillAvailability({
    gameState: {
      ...baseState,
      activeSkillUsesByPlayerId: { p2: ['substitute_sacrifice'] }
    },
    players,
    currentPlayerId: 'p2'
  });
  assert.equal(used.isUsed, true);
  assert.equal(used.canActivate, false);
});

test('模棱两可只在二三号位亮起，且本轮后续发动者不消耗次数', () => {
  const players = ['p0', 'p1', 'p2', 'p3'].map(id => ({ id }));
  const activeSkill = {
    id: 'ambiguous',
    name: '模棱两可',
    usageLimit: 1,
    timing: 'middle_positions_play',
    effect: 'two_legal_plays_choose_at_round_end'
  };
  const stateAt = (currentPlayerIndex, playersPlayedThisRound, extra = {}) => ({
    phase: 'playing',
    playMode: 'ordered',
    currentPlayerIndex,
    currentRound: 1,
    currentRoundPlays: playersPlayedThisRound.map(playerIndex => ({ playerIndex })),
    playersPlayedThisRound,
    leadingPattern: playersPlayedThisRound.length > 0
      ? { type: 'single', suit: 'hearts', length: 1 }
      : null,
    selectedRule: { id: 'ambiguous', activeSkill },
    activeSkillUsesByPlayerId: {},
    ambiguous: { activePlayerIds: [] },
    ...extra
  });

  assert.equal(getActiveSkillAvailability({
    gameState: stateAt(0, []), players, currentPlayerId: 'p0'
  }).canActivate, false);
  assert.equal(getActiveSkillAvailability({
    gameState: stateAt(1, [0]), players, currentPlayerId: 'p1'
  }).canActivate, true);

  const freeThird = getActiveSkillAvailability({
    gameState: stateAt(2, [0, 1], {
      activeSkillUsesByPlayerId: { p2: ['ambiguous'] },
      ambiguous: { activePlayerIds: ['p1'] }
    }),
    players,
    currentPlayerId: 'p2'
  });
  assert.equal(freeThird.canActivate, true);
  assert.equal(freeThird.isFreeActivation, true);
  assert.match(freeThird.reason, /无需消耗/);

  assert.equal(getActiveSkillAvailability({
    gameState: stateAt(3, [0, 1, 2]), players, currentPlayerId: 'p3'
  }).canActivate, false);

  const handCards = [card('h5', 'hearts', '5'), card('h10', 'hearts', '10')];
  assert.equal(validatePlaySelection({
    selectedCardIds: ['h5'],
    handCards,
    gameState: stateAt(1, [0]),
    currentPlayerId: 'p1',
    activeSkillId: 'ambiguous',
    trumpSuit: 'spades',
    trumpRank: '2'
  }).valid, true);
});

test('同舟共济只在轮到自己且尚未出牌时可发动，并显示轮末返还说明', () => {
  const players = [{ id: 'p0' }, { id: 'p1' }, { id: 'p2' }, { id: 'p3' }];
  const gameState = {
    phase: 'playing',
    playMode: 'ordered',
    currentPlayerIndex: 1,
    currentRound: 3,
    currentRoundPlays: 1,
    playersPlayedThisRound: [0],
    leadingPattern: { type: 'single', suit: 'hearts', length: 1 },
    selectedRule: {
      id: 'mutual_support',
      activeSkill: {
        id: 'mutual_support',
        name: '同舟共济',
        usageLimit: 1,
        timing: 'own_turn_before_play',
        effect: 'temporary_teammate_card_transfer'
      }
    },
    activeSkillUsesByPlayerId: {}
  };

  const available = getActiveSkillAvailability({
    gameState,
    players,
    currentPlayerId: 'p1',
    handCards: [card('h3', 'hearts', '3')]
  });
  assert.equal(available.canActivate, true);
  assert.match(available.reason, /轮末.*等量返还/);
  assert.equal(getActiveSkillAvailability({
    gameState,
    players,
    currentPlayerId: 'p2'
  }).canActivate, false);

  const usedState = {
    ...gameState,
    activeSkillUsesByPlayerId: { p1: ['mutual_support'] }
  };
  assert.equal(getActiveSkillAvailability({
    gameState: usedState,
    players,
    currentPlayerId: 'p1'
  }).isUsed, true);
});

test('文化革命只在本轮一号位出牌前可发动，并明确提示先二选一', () => {
  const players = [{ id: 'p0' }, { id: 'p1' }, { id: 'p2' }, { id: 'p3' }];
  const selectedRule = {
    id: 'cultural_revolution',
    activeSkill: {
      id: 'cultural_revolution',
      name: '文化革命',
      usageLimit: 1,
      timing: 'first_position_before_play',
      effect: 'temporarily_replace_trump'
    }
  };
  const leadingState = {
    phase: 'playing',
    playMode: 'ordered',
    currentPlayerIndex: 2,
    roundStartPlayerIndex: 2,
    currentRound: 4,
    currentRoundPlays: 0,
    playersPlayedThisRound: [],
    leadingPattern: null,
    selectedRule,
    activeSkillUsesByPlayerId: {}
  };

  const available = getActiveSkillAvailability({
    gameState: leadingState,
    players,
    currentPlayerId: 'p2'
  });
  assert.equal(available.canActivate, true);
  assert.match(available.reason, /革花色或革点数/);

  assert.equal(getActiveSkillAvailability({
    gameState: { ...leadingState, currentPlayerIndex: 3 },
    players,
    currentPlayerId: 'p3'
  }).canActivate, false);
  assert.equal(getActiveSkillAvailability({
    gameState: {
      ...leadingState,
      activeSkillUsesByPlayerId: { p2: ['cultural_revolution'] }
    },
    players,
    currentPlayerId: 'p2'
  }).isUsed, true);
});

test('后发制人只在原三号位出牌前亮起，换到四号位后不再误亮', () => {
  const players = [{ id: 'p0' }, { id: 'p1' }, { id: 'p2' }, { id: 'p3' }];
  const skill = {
    id: 'late_mover_advantage',
    name: '后发制人',
    timing: 'third_position_before_play',
    effect: 'yield_turn_to_next_player'
  };
  const thirdPlayerState = {
    playMode: 'ordered',
    currentPlayerIndex: 2,
    currentRoundPlays: 2,
    playersPlayedThisRound: [0, 1],
    leadingPattern: { type: 'single', suit: 'hearts', length: 1 },
    selectedRule: { id: 'late_mover_advantage', activeSkill: skill },
    activeSkillUsesByPlayerId: {}
  };

  const ready = getActiveSkillAvailability({
    gameState: thirdPlayerState,
    players,
    currentPlayerId: 'p2'
  });
  assert.equal(ready.canActivate, true);
  assert.match(ready.reason, /下家先出牌/);

  const yieldedFourthPlayer = getActiveSkillAvailability({
    gameState: { ...thirdPlayerState, currentPlayerIndex: 3 },
    players,
    currentPlayerId: 'p3'
  });
  assert.equal(yieldedFourthPlayer.canActivate, false);
  assert.match(yieldedFourthPlayer.reason, /三号位/);

  const used = getActiveSkillAvailability({
    gameState: {
      ...thirdPlayerState,
      activeSkillUsesByPlayerId: { p2: ['late_mover_advantage'] }
    },
    players,
    currentPlayerId: 'p2'
  });
  assert.equal(used.isUsed, true);
  assert.equal(used.canActivate, false);
});

test('礼崩乐坏只在首发时禁用A，跟牌时恢复可选', () => {
  const handCards = [
    card('hA', 'hearts', 'A'),
    card('hK', 'hearts', 'K')
  ];
  const leadingState = {
    roundStartPlayerIndex: 0,
    currentRoundPlays: 0,
    playersPlayedThisRound: [],
    selectedRule: { id: 'rites_collapse' }
  };
  const players = [{ id: 'p0' }, { id: 'p1' }, { id: 'p2' }, { id: 'p3' }];

  assert.deepEqual(
    getRuleDisabledLeadCardIds({
      gameState: leadingState,
      handCards,
      players,
      currentPlayerId: 'p0'
    }),
    ['hA']
  );
  assert.deepEqual(
    getRuleDisabledLeadCardIds({
      gameState: leadingState,
      handCards,
      players,
      currentPlayerId: 'p1'
    }),
    [],
    '非一号位玩家在等待首发时不应看到自己的A变灰'
  );
  assert.equal(validatePlaySelection({
    selectedCardIds: ['hA'],
    handCards,
    gameState: leadingState,
    trumpSuit: 'spades',
    trumpRank: '2'
  }).valid, false);
  assert.equal(validatePlaySelection({
    selectedCardIds: ['hK'],
    handCards,
    gameState: leadingState,
    trumpSuit: 'spades',
    trumpRank: '2'
  }).valid, true);

  const followingState = {
    ...leadingState,
    currentRoundPlays: 1,
    playersPlayedThisRound: [0],
    leadingPattern: { type: 'single', suit: 'hearts', length: 1 }
  };
  assert.deepEqual(
    getRuleDisabledLeadCardIds({
      gameState: followingState,
      handCards,
      players,
      currentPlayerId: 'p0'
    }),
    []
  );
  assert.equal(validatePlaySelection({
    selectedCardIds: ['hA'],
    handCards,
    gameState: followingState,
    trumpSuit: 'spades',
    trumpRank: '2'
  }).valid, true);

  const onlyAHand = [
    card('hA1', 'hearts', 'A'),
    card('sA1', 'spades', 'A')
  ];
  assert.deepEqual(getRuleDisabledLeadCardIds({
    gameState: leadingState,
    handCards: onlyAHand,
    players,
    currentPlayerId: 'p0'
  }), []);
  assert.equal(validatePlaySelection({
    selectedCardIds: ['hA1'],
    handCards: onlyAHand,
    gameState: leadingState,
    trumpSuit: 'spades',
    trumpRank: '2',
    currentPlayerId: 'p0'
  }).valid, true, '一号位只剩A时必须允许首发任意A');
});

test('鸟尽弓藏只禁用一号位的弓藏花色，跟牌和仅剩禁花时自动放行', () => {
  const players = [{ id: 'p0' }, { id: 'p1' }, { id: 'p2' }, { id: 'p3' }];
  const handCards = [
    card('h8', 'hearts', '8'),
    card('h9', 'hearts', '9'),
    card('c8', 'clubs', '8')
  ];
  const leadingState = {
    roundStartPlayerIndex: 0,
    currentRoundPlays: 0,
    playersPlayedThisRound: [],
    selectedRule: { id: 'birds_gone_bow_hidden' },
    birdsGoneBowHidden: { exhaustedSuits: ['hearts'] }
  };

  assert.deepEqual(getRuleDisabledLeadCardIds({
    gameState: leadingState,
    handCards,
    players,
    currentPlayerId: 'p0'
  }), ['h8', 'h9']);
  assert.deepEqual(getRuleDisabledLeadCardIds({
    gameState: leadingState,
    handCards,
    players,
    currentPlayerId: 'p1'
  }), [], '非一号位等待时不应把自己的牌置灰');
  assert.match(validatePlaySelection({
    selectedCardIds: ['h8'],
    handCards,
    gameState: leadingState,
    trumpSuit: 'spades',
    trumpRank: '2',
    currentPlayerId: 'p0'
  }).message, /鸟尽弓藏/);

  const followingState = {
    ...leadingState,
    currentRoundPlays: 1,
    playersPlayedThisRound: [0],
    leadingPattern: { type: 'single', suit: 'hearts', length: 1 }
  };
  assert.deepEqual(getRuleDisabledLeadCardIds({
    gameState: followingState,
    handCards,
    players,
    currentPlayerId: 'p0'
  }), []);
  assert.equal(validatePlaySelection({
    selectedCardIds: ['h8'],
    handCards,
    gameState: followingState,
    trumpSuit: 'spades',
    trumpRank: '2',
    currentPlayerId: 'p0'
  }).valid, true);

  assert.deepEqual(getRuleDisabledLeadCardIds({
    gameState: leadingState,
    handCards: handCards.slice(0, 2),
    players,
    currentPlayerId: 'p0'
  }), [], '手里只剩弓藏花色时应允许主动打出');

  const pointLevelState = {
    ...leadingState,
    trumpSuit: 'spades',
    trumpRank: '5',
    birdsGoneBowHidden: { exhaustedSuits: ['trump'] }
  };
  assert.deepEqual(getRuleDisabledLeadCardIds({
    gameState: pointLevelState,
    handCards: [
      card('d5', 'diamonds', '5'),
      card('sQ', 'spades', 'Q'),
      card('c8', 'clubs', '8')
    ],
    players,
    currentPlayerId: 'p0'
  }), ['d5', 'sQ'], '带分级牌和主花色牌都应按主花色禁用');
});

test('冷却时间与时间冷却整轮禁用自己的上轮点数或花色，并在无牌可出时解除', () => {
  const players = [{ id: 'p0' }, { id: 'p1' }, { id: 'p2' }, { id: 'p3' }];
  const rankHand = [
    card('h7', 'hearts', '7'),
    card('c7', 'clubs', '7'),
    card('h8', 'hearts', '8')
  ];
  const rankState = {
    currentRound: 2,
    roundStartPlayerIndex: 0,
    currentRoundPlays: 0,
    playersPlayedThisRound: [],
    selectedRule: { id: 'cooldown_time' },
    cardCooldown: {
      type: 'rank',
      valuesByPlayerId: { p0: ['7'], p1: ['9'] }
    }
  };
  assert.deepEqual(getRuleDisabledLeadCardIds({
    gameState: rankState,
    handCards: rankHand,
    players,
    currentPlayerId: 'p0'
  }), ['h7', 'c7']);
  assert.equal(validatePlaySelection({
    selectedCardIds: ['h7'],
    handCards: rankHand,
    gameState: rankState,
    trumpSuit: 'spades',
    trumpRank: '2',
    currentPlayerId: 'p0'
  }).valid, false);

  const suitHand = [
    card('dK', 'diamonds', 'K'),
    card('c8', 'clubs', '8')
  ];
  const suitState = {
    currentRound: 2,
    roundStartPlayerIndex: 0,
    currentRoundPlays: 1,
    playersPlayedThisRound: [0],
    leadingPattern: { type: 'single', suit: 'diamonds', length: 1 },
    selectedRule: { id: 'time_cooling' },
    cardCooldown: {
      type: 'suit',
      valuesByPlayerId: { p1: ['diamonds'] }
    }
  };
  assert.deepEqual(getRuleDisabledLeadCardIds({
    gameState: suitState,
    handCards: suitHand,
    players,
    currentPlayerId: 'p1'
  }), ['dK']);
  assert.equal(validatePlaySelection({
    selectedCardIds: ['c8'],
    handCards: suitHand,
    gameState: suitState,
    trumpSuit: 'spades',
    trumpRank: '2',
    currentPlayerId: 'p1'
  }).valid, true, '已冷却的首花色不再形成跟牌义务');

  const onlyRestricted = [card('d7', 'diamonds', '7')];
  assert.deepEqual(getRuleDisabledLeadCardIds({
    gameState: suitState,
    handCards: onlyRestricted,
    players,
    currentPlayerId: 'p1'
  }), [], '手里只剩冷却花色时解除禁用');

  const trumpHand = [
    card('c2', 'clubs', '2'),
    card('sK', 'spades', 'K'),
    card('sj', 'joker', 'small_joker'),
    card('h7', 'hearts', '7')
  ];
  const trumpSuitState = {
    ...suitState,
    trumpSuit: 'spades',
    trumpRank: '2',
    currentRoundPlays: 0,
    playersPlayedThisRound: [],
    cardCooldown: {
      type: 'suit',
      valuesByPlayerId: { p1: ['trump'] }
    }
  };
  assert.deepEqual(getRuleDisabledLeadCardIds({
    gameState: trumpSuitState,
    handCards: trumpHand,
    players,
    currentPlayerId: 'p1'
  }), ['c2', 'sK', 'sj'], '级牌、主花色牌和王必须作为同一个主花色一起灰显');
});

test('举贤任能只在原一号位出牌前可发动', () => {
  const players = [{ id: 'p0' }, { id: 'p1' }, { id: 'p2' }, { id: 'p3' }];
  const skill = {
    id: 'recommend_talent',
    name: '举贤任能',
    timing: 'first_position_before_play',
    effect: 'yield_turn_to_next_player'
  };
  const leadingState = {
    playMode: 'ordered',
    currentPlayerIndex: 0,
    roundStartPlayerIndex: 0,
    currentRoundPlays: 0,
    playersPlayedThisRound: [],
    selectedRule: { id: 'recommend_talent', activeSkill: skill },
    activeSkillUsesByPlayerId: {}
  };

  assert.equal(getActiveSkillAvailability({
    gameState: leadingState,
    players,
    currentPlayerId: 'p0'
  }).canActivate, true);

  const yieldedState = { ...leadingState, currentPlayerIndex: 1 };
  const nextPlayerAvailability = getActiveSkillAvailability({
    gameState: yieldedState,
    players,
    currentPlayerId: 'p1'
  });
  assert.equal(nextPlayerAvailability.canActivate, false);
  assert.match(nextPlayerAvailability.reason, /一号位/);
});

test('等价互惠只在一号位出牌前亮起并提示点击其他玩家', () => {
  const players = [{ id: 'p0' }, { id: 'p1' }, { id: 'p2' }, { id: 'p3' }];
  const skill = {
    id: 'equivalent_reciprocity',
    name: '等价互惠',
    timing: 'first_position_before_play',
    effect: 'compare_and_exchange'
  };
  const leadingState = {
    playMode: 'ordered',
    currentPlayerIndex: 0,
    roundStartPlayerIndex: 0,
    currentRoundPlays: 0,
    playersPlayedThisRound: [],
    selectedRule: { id: 'equivalent_reciprocity', activeSkill: skill },
    activeSkillUsesByPlayerId: {}
  };

  const availability = getActiveSkillAvailability({
    gameState: leadingState,
    players,
    currentPlayerId: 'p0'
  });
  assert.equal(availability.canActivate, true);
  assert.match(availability.reason, /点击另一名玩家/);

  const afterLead = {
    ...leadingState,
    currentPlayerIndex: 1,
    currentRoundPlays: 1,
    playersPlayedThisRound: [0]
  };
  assert.equal(getActiveSkillAvailability({
    gameState: afterLead,
    players,
    currentPlayerId: 'p1'
  }).canActivate, false);
});

test('时间倒流允许多人预备，并在轮末窗口继续指向刚结束的一轮', () => {
  const players = [{ id: 'p0' }, { id: 'p1' }, { id: 'p2' }, { id: 'p3' }];
  const skill = {
    id: 'time_reversal',
    name: '时间倒流',
    timing: 'anytime_during_round',
    effect: 'rewind_completed_round'
  };
  const baseState = {
    phase: 'playing',
    playMode: 'ordered',
    currentRound: 3,
    currentPlayerIndex: 0,
    currentRoundPlays: 1,
    playersPlayedThisRound: [0],
    selectedRule: { id: 'time_reversal', activeSkill: skill },
    activeSkillUsesByPlayerId: {},
    timeReversal: { reservations: [], decisionState: null, windowRound: null, lockedRounds: [] }
  };

  const offTurn = getActiveSkillAvailability({
    gameState: baseState,
    players,
    currentPlayerId: 'p2'
  });
  assert.equal(offTurn.canActivate, true);
  assert.match(offTurn.reason, /轮末/);

  const anotherPlayerPrepared = getActiveSkillAvailability({
    gameState: {
      ...baseState,
      timeReversal: {
        ...baseState.timeReversal,
        reservations: [{ playerId: 'p1', playerName: '玩家1', round: 3 }]
      }
    },
    players,
    currentPlayerId: 'p2'
  });
  assert.equal(anotherPlayerPrepared.canActivate, true);

  const ownPrepared = getActiveSkillAvailability({
    gameState: {
      ...baseState,
      timeReversal: {
        ...baseState.timeReversal,
        reservations: [{ playerId: 'p2', playerName: '玩家2', round: 3 }]
      }
    },
    players,
    currentPlayerId: 'p2'
  });
  assert.equal(ownPrepared.canActivate, false);
  assert.match(ownPrepared.reason, /你已预备第3轮/);

  const roundEndWindow = getActiveSkillAvailability({
    gameState: {
      ...baseState,
      currentRound: 4,
      timeReversal: { reservations: [], decisionState: 'holding', windowRound: 3, lockedRounds: [] }
    },
    players,
    currentPlayerId: 'p3'
  });
  assert.equal(roundEndWindow.canActivate, true);

  const locked = getActiveSkillAvailability({
    gameState: {
      ...baseState,
      timeReversal: { reservations: [], decisionState: null, windowRound: null, lockedRounds: [3] }
    },
    players,
    currentPlayerId: 'p3'
  });
  assert.equal(locked.canActivate, false);
  assert.match(locked.reason, /本轮已经发动过/);
});

test('李代桃僵可无视跟牌要求，但仍须出与首家相同张数且不能首发', () => {
  const skill = { id: 'substitute_sacrifice', name: '李代桃僵' };
  const handCards = [
    card('sK1', 'spades', 'K'),
    card('sK2', 'spades', 'K'),
    card('j1', 'joker', 'BJ'),
    card('j2', 'joker', 'BJ')
  ];
  const followingState = {
    currentRoundPlays: 1,
    playersPlayedThisRound: [0],
    leadingPattern: { type: 'pair', suit: 'spades', length: 2 },
    selectedRule: { id: 'substitute_sacrifice', activeSkill: skill }
  };

  assert.equal(validatePlaySelection({
    selectedCardIds: ['j1', 'j2'], handCards, gameState: followingState
  }).valid, false);
  assert.equal(validatePlaySelection({
    selectedCardIds: ['j1', 'j2'],
    handCards,
    gameState: followingState,
    activeSkillId: skill.id
  }).valid, true);
  assert.equal(validatePlaySelection({
    selectedCardIds: ['j1'],
    handCards,
    gameState: followingState,
    activeSkillId: skill.id
  }).valid, false);
  assert.equal(validatePlaySelection({
    selectedCardIds: ['j1', 'j2'],
    handCards,
    gameState: {
      ...followingState,
      currentRoundPlays: 0,
      playersPlayedThisRound: []
    },
    activeSkillId: skill.id
  }).valid, false);
});

test('六六大顺选中六张连续同花牌时识别为同花顺并允许出牌', () => {
  const handCards = ['2', '3', '4', '5', '6', '7', '9']
    .map(rank => card(`h${rank}`, 'hearts', rank));
  const gameState = {
    currentRoundPlays: 0,
    playersPlayedThisRound: [],
    selectedRule: { id: 'six_six_great_success', name: '六六大顺' }
  };

  const result = validatePlaySelection({
    selectedCardIds: handCards.slice(0, 6).map(value => value.id),
    handCards,
    gameState,
    trumpSuit: 'spades',
    trumpRank: 'A'
  });
  assert.equal(result.valid, true);
  assert.equal(result.pattern.type, PatternTypes.STRAIGHT_FLUSH);
  assert.equal(
    detectPattern(handCards.slice(0, 6), 'spades', 'A').type,
    PatternTypes.INVALID
  );
});

test('跟六六大顺时若手中有同花顺，破顺选牌不会启用出牌', () => {
  const leadingCards = ['2', '3', '4', '5', '6', '7']
    .map(rank => card(`lead-${rank}`, 'hearts', rank));
  const selectedRule = { id: 'six_six_great_success', name: '六六大顺' };
  const leadingPattern = detectPattern(
    leadingCards,
    'spades',
    'A',
    selectedRule
  );
  const handCards = ['3', '4', '5', '6', '7', '8', '10']
    .map(rank => card(`follow-${rank}`, 'hearts', rank));
  const gameState = {
    currentRoundPlays: 1,
    playersPlayedThisRound: [0],
    leadingPattern,
    selectedRule
  };

  assert.equal(validatePlaySelection({
    selectedCardIds: handCards.slice(0, 6).map(value => value.id),
    handCards,
    gameState,
    trumpSuit: 'spades',
    trumpRank: 'A'
  }).valid, true);
  assert.equal(validatePlaySelection({
    selectedCardIds: [...handCards.slice(0, 5), handCards[6]].map(value => value.id),
    handCards,
    gameState,
    trumpSuit: 'spades',
    trumpRank: 'A'
  }).valid, false);
  assert.deepEqual(
    calculateMustPlayCards(
      handCards,
      leadingPattern,
      'spades',
      'A',
      selectedRule
    ).map(value => value.id),
    handCards.slice(0, 6).map(value => value.id)
  );
});

test('太极四象只在对应规则下允许四种花色同点数混合首发', () => {
  const handCards = ['hearts', 'diamonds', 'clubs', 'spades']
    .map(suit => card(`${suit}-9`, suit, '9'));
  const selectedRule = { id: 'tai_chi_four_symbols', name: '太极四象' };

  const result = validatePlaySelection({
    selectedCardIds: handCards.map(value => value.id),
    handCards,
    gameState: {
      currentRoundPlays: 0,
      playersPlayedThisRound: [],
      selectedRule
    },
    trumpSuit: 'spades',
    trumpRank: '2'
  });
  assert.equal(result.valid, true);
  assert.equal(result.pattern.type, PatternTypes.TAI_CHI_FOUR_SYMBOLS);
  assert.equal(result.pattern.strength, 9);

  assert.equal(validatePlaySelection({
    selectedCardIds: handCards.map(value => value.id),
    handCards,
    gameState: { currentRoundPlays: 0, playersPlayedThisRound: [] },
    trumpSuit: 'spades',
    trumpRank: '2'
  }).valid, false);
});

test('跟太极四象时前端强制跟出手中的四象，并可唯一自动选中', () => {
  const selectedRule = { id: 'tai_chi_four_symbols', name: '太极四象' };
  const leadingCards = ['hearts', 'diamonds', 'clubs', 'spades']
    .map(suit => card(`lead-${suit}`, suit, '9'));
  const leadingPattern = detectPattern(
    leadingCards,
    'spades',
    '2',
    selectedRule
  );
  const taiChiQueens = ['hearts', 'diamonds', 'clubs', 'spades']
    .map(suit => card(`queen-${suit}`, suit, 'Q'));
  const handCards = [...taiChiQueens, card('heart-3', 'hearts', '3')];
  const gameState = {
    currentRoundPlays: 1,
    playersPlayedThisRound: [0],
    leadingPattern,
    selectedRule
  };

  assert.equal(validatePlaySelection({
    selectedCardIds: taiChiQueens.map(value => value.id),
    handCards,
    gameState,
    trumpSuit: 'spades',
    trumpRank: '2'
  }).valid, true);
  assert.equal(validatePlaySelection({
    selectedCardIds: [...taiChiQueens.slice(1), handCards[4]].map(value => value.id),
    handCards,
    gameState,
    trumpSuit: 'spades',
    trumpRank: '2'
  }).valid, false);
  assert.deepEqual(
    calculateMustPlayCards(
      handCards,
      leadingPattern,
      'spades',
      '2',
      selectedRule
    ).map(value => value.id),
    taiChiQueens.map(value => value.id)
  );
});

test('底牌分数按 5、10、K 正确累计', () => {
  assert.equal(calculateCardPoints([
    card('1', 'spades', '5'),
    card('2', 'hearts', '10'),
    card('3', 'clubs', 'K'),
    card('4', 'diamonds', 'A')
  ]), 25);
});

test('三权分立的实时牌面分只累计已揭晓的重载点数并允许重复叠加', () => {
  const threePowers = {
    slots: [
      { sourceRank: '5', pointValue: 5, rank: '7', isRevealed: true },
      { sourceRank: '10', pointValue: 10, rank: '7', isRevealed: true },
      { sourceRank: 'K', pointValue: 10, rank: null, isRevealed: false }
    ]
  };
  const cards = [
    card('standard-five', 'spades', '5'),
    card('standard-ten', 'hearts', '10'),
    card('reloaded-seven-a', 'clubs', '7'),
    card('reloaded-seven-b', 'diamonds', '7')
  ];

  assert.equal(
    calculateCardPoints(cards, value => getThreePowersCardPoints(value, threePowers)),
    30
  );
  assert.equal(getThreePowersCardPoints(cards[0], threePowers), 0);
  assert.equal(getThreePowersCardPoints(cards[2], threePowers), 15);
});

test('暗度陈仓仍需合法跟牌，偷梁换柱可在前端识别王补对子', () => {
  const leadPattern = { type: PatternTypes.PAIR, suit: 'hearts', length: 2 };
  const handCards = [
    card('h5', 'hearts', '5'),
    card('h6', 'hearts', '6'),
    card('joker', 'joker', 'small_joker')
  ];
  const commonState = {
    currentRoundPlays: 1,
    playersPlayedThisRound: [0],
    leadingPattern: leadPattern
  };

  const concealedState = {
    ...commonState,
    selectedRule: {
      id: 'concealed_passage',
      activeSkill: {
        id: 'concealed_passage',
        name: '暗度陈仓',
        timing: 'following_play',
        effect: 'concealed_until_round_end'
      }
    }
  };
  assert.equal(validatePlaySelection({
    selectedCardIds: ['h5', 'joker'],
    handCards,
    gameState: concealedState,
    trumpSuit: 'spades',
    trumpRank: '2',
    activeSkillId: 'concealed_passage'
  }).valid, false);

  const stealingState = {
    ...commonState,
    selectedRule: {
      id: 'stealing_beams',
      activeSkill: {
        id: 'stealing_beams',
        name: '偷梁换柱',
        timing: 'any_play',
        effect: 'joker_wildcards'
      }
    }
  };
  const substitution = validatePlaySelection({
    selectedCardIds: ['h5', 'joker'],
    handCards,
    gameState: stealingState,
    trumpSuit: 'spades',
    trumpRank: '2',
    activeSkillId: 'stealing_beams',
    jokerSubstitutions: [{ cardId: 'joker', suit: 'hearts', rank: '5' }]
  });
  assert.equal(substitution.valid, true);
  assert.equal(substitution.pattern.type, PatternTypes.PAIR);
  assert.equal(substitution.substitutions[0].rank, '5');
});

test('一带一路未点亮时允许普通甩牌，点亮后识别为限一次的小甩牌', () => {
  const handCards = [
    card('hA', 'hearts', 'A'),
    card('h6', 'hearts', '6'),
    card('h5a', 'hearts', '5'),
    card('h5b', 'hearts', '5')
  ];
  const gameState = {
    phase: 'playing',
    currentPlayerIndex: 0,
    currentRound: 1,
    currentRoundPlays: 0,
    playersPlayedThisRound: [],
    selectedRule: {
      id: 'belt_and_road',
      name: '一带一路',
      activeSkill: {
        id: 'belt_and_road',
        name: '一带一路',
        timing: 'leading_play',
        effect: 'belt_and_road_lead'
      }
    },
    activeSkillUsesByPlayerId: {}
  };
  const players = [{ id: 'player-0' }, { id: 'player-1' }, { id: 'player-2' }, { id: 'player-3' }];
  const unarmed = validatePlaySelection({
    selectedCardIds: ['hA', 'h6'],
    handCards,
    gameState,
    trumpSuit: 'spades',
    trumpRank: '2',
    currentPlayerId: 'player-0'
  });
  assert.equal(unarmed.valid, true);
  assert.equal(unarmed.pattern.type, PatternTypes.INVALID);

  const availability = getActiveSkillAvailability({
    gameState,
    players,
    currentPlayerId: 'player-0'
  });
  assert.equal(availability.visible, true);
  assert.equal(availability.canActivate, true);
  assert.match(availability.reason, /两张非对子单牌/);

  const first = validatePlaySelection({
    selectedCardIds: ['hA', 'h6'],
    handCards,
    gameState,
    trumpSuit: 'spades',
    trumpRank: '2',
    activeSkillId: 'belt_and_road',
    currentPlayerId: 'player-0'
  });
  assert.equal(first.valid, true);
  assert.equal(first.pattern.type, PatternTypes.BELT_AND_ROAD);
  assert.deepEqual(first.pattern.strengths, [14, 6]);

  const armedPair = validatePlaySelection({
    selectedCardIds: ['h5a', 'h5b'],
    handCards,
    gameState,
    trumpSuit: 'spades',
    trumpRank: '2',
    activeSkillId: 'belt_and_road',
    currentPlayerId: 'player-0'
  });
  assert.equal(armedPair.valid, false);
  assert.match(armedPair.message, /两张非对子单牌/);

  const used = getActiveSkillAvailability({
    gameState: {
      ...gameState,
      activeSkillUsesByPlayerId: { 'player-0': ['belt_and_road'] }
    },
    players,
    currentPlayerId: 'player-0'
  });
  assert.equal(used.canActivate, false);
  assert.equal(used.isUsed, true);

  const following = getActiveSkillAvailability({
    gameState: {
      ...gameState,
      currentPlayerIndex: 1,
      currentRoundPlays: 1,
      playersPlayedThisRound: [0],
      leadingPattern: first.pattern
    },
    players,
    currentPlayerId: 'player-1'
  });
  assert.equal(following.canActivate, false);
  assert.match(following.reason, /只能在首发时发动/);
});

test('昼夜轮转的客户端牌力从第1轮的2开始，轮转到级牌时仍由A最大', () => {
  const two = card('h2', 'hearts', '2');
  const ace = card('hA', 'hearts', 'A');
  const roundOneRule = { id: 'day_night_rotation', currentRound: 1 };
  const roundTwoRule = { id: 'day_night_rotation', currentRound: 2 };
  assert.ok(getCardStrength(two, 'spades', '3', roundOneRule) >
    getCardStrength(ace, 'spades', '3', roundOneRule));
  assert.ok(getCardStrength(ace, 'spades', '3', roundTwoRule) >
    getCardStrength(two, 'spades', '3', roundTwoRule));
});

test('取长补短的B、1和郡王按新牌面比较，分值仍读取实体原牌', () => {
  const rule = { id: 'strength_compensation' };
  const ace = card('hA', 'hearts', 'A');
  const bonusOne = {
    ...card('hA-shifted', 'hearts', 'B'),
    originalRank: 'A',
    isStrengthCompensated: true,
    strengthCompensationDelta: 1
  };
  const one = {
    ...card('h2-shifted', 'hearts', '1'),
    originalRank: '2',
    isStrengthCompensated: true,
    strengthCompensationDelta: -1
  };
  const two = card('h2', 'hearts', '2');
  const bigJoker = card('bj', 'joker', 'big_joker');
  const countyPrinceJoker = {
    ...card('bj-shifted', 'joker', 'county_prince_joker'),
    originalRank: 'big_joker',
    isStrengthCompensated: true,
    strengthCompensationDelta: 1
  };
  const physicalFiveShownAsSix = {
    ...card('h5-shifted', 'hearts', '6'),
    originalRank: '5',
    isStrengthCompensated: true,
    strengthCompensationDelta: 1
  };

  assert.ok(getCardStrength(bonusOne, 'spades', '9', rule) >
    getCardStrength(ace, 'spades', '9', rule));
  assert.ok(getCardStrength(two, 'spades', '9', rule) >
    getCardStrength(one, 'spades', '9', rule));
  assert.ok(getCardStrength(countyPrinceJoker, 'spades', '9', rule) >
    getCardStrength(bigJoker, 'spades', '9', rule));
  assert.deepEqual(
    ['A', 'B', 'C', 'D'].map(rank => (
      getCardStrength(card(`side-${rank}`, 'hearts', rank), 'spades', '9', rule)
    )),
    [14, 15, 16, 17]
  );
  assert.deepEqual(
    ['big_joker', 'county_prince_joker', 'prince_joker', 'white_joker'].map(rank => (
      getCardStrength(card(`joker-${rank}`, 'joker', rank), 'spades', '9', rule)
    )),
    [1000, 1001, 1002, 1003]
  );
  assert.equal(getCardPoints(physicalFiveShownAsSix), 5);

  const shiftedMainChain = [
    { ...card('main-a-plus', 'hearts', '2'), isStrengthCompensated: true },
    { ...card('vice-two-plus', 'spades', '2'), isStrengthCompensated: true },
    { ...card('main-two-plus', 'joker', 'small_joker'), isStrengthCompensated: true },
    { ...card('small-plus', 'joker', 'big_joker'), isStrengthCompensated: true },
    countyPrinceJoker
  ];
  assert.deepEqual(
    shiftedMainChain.map(value => getCardStrength(value, 'spades', '2', rule)),
    [997, 998, 999, 1000, 1001]
  );
});

test('取长补短在无主局把M留在主牌类别内', () => {
  const rule = { id: 'strength_compensation' };
  const maximumSideCard = card('side-d', 'hearts', 'D');
  const underLevel = {
    ...card('under-level', 'clubs', 'M'),
    originalRank: '2',
    isStrengthCompensated: true,
    strengthCompensationDelta: -1
  };
  const levelCard = card('level', 'spades', '2');

  assert.equal(isTrumpCard(underLevel, 'no_trump', '2'), true);
  assert.ok(getCardStrength(underLevel, 'no_trump', '2', rule) >
    getCardStrength(maximumSideCard, 'no_trump', '2', rule));
  assert.ok(getCardStrength(levelCard, 'no_trump', '2', rule) >
    getCardStrength(underLevel, 'no_trump', '2', rule));
});

test('手无寸铁在客户端把级牌按原花色和点数处理', () => {
  const rule = { id: 'unarmed' };
  const unarmed = (id, suit, rank) => ({ ...card(id, suit, rank), isUnarmed: true });
  const heartLevel = unarmed('heart-2', 'hearts', '2');
  const clubLevel = unarmed('club-2', 'clubs', '2');
  const clubThree = unarmed('club-3', 'clubs', '3');
  const sideAce = unarmed('spade-A', 'spades', 'A');

  assert.equal(isTrumpCard(heartLevel, 'hearts', '2'), true);
  assert.equal(isTrumpCard(clubLevel, 'hearts', '2'), false);
  assert.ok(getCardStrength(clubThree, 'hearts', '2', rule) >
    getCardStrength(clubLevel, 'hearts', '2', rule));
  assert.ok(getCardStrength(heartLevel, 'hearts', '2', rule) >
    getCardStrength(sideAce, 'hearts', '2', rule));

  const tractor = detectPattern([
    unarmed('club-2-a', 'clubs', '2'),
    unarmed('club-2-b', 'clubs', '2'),
    unarmed('club-3-a', 'clubs', '3'),
    unarmed('club-3-b', 'clubs', '3')
  ], 'hearts', '2', rule);
  assert.equal(tractor.type, PatternTypes.TRACTOR);
  assert.equal(tractor.suit, 'clubs');

  const cannotSkipLevelRank = detectPattern([
    unarmed('club-Q-a', 'clubs', 'Q'),
    unarmed('club-Q-b', 'clubs', 'Q'),
    unarmed('club-A-a', 'clubs', 'A'),
    unarmed('club-A-b', 'clubs', 'A')
  ], 'hearts', 'K', rule);
  assert.equal(cannotSkipLevelRank.type, PatternTypes.INVALID);
});

test('梦中杀人仅在没有主牌时可随时发动，入梦后按钮显示为等待系统', () => {
  const players = [{ id: 'player-0' }, { id: 'player-1' }, { id: 'player-2' }, { id: 'player-3' }];
  const gameState = {
    phase: 'playing',
    currentPlayerIndex: 2,
    trumpSuit: 'spades',
    trumpRank: '2',
    selectedRule: {
      id: 'dream_killing',
      activeSkill: {
        id: 'dream_killing',
        name: '梦中杀人',
        timing: 'anytime_no_trump',
        effect: 'sleep_random_play'
      }
    },
    activeSkillUsesByPlayerId: {},
    dreamKilling: { sleepingPlayerIds: [] }
  };
  const sideCards = [card('h4', 'hearts', '4'), card('d5', 'diamonds', '5')];
  const available = getActiveSkillAvailability({
    gameState,
    players,
    currentPlayerId: 'player-0',
    handCards: sideCards
  });
  assert.equal(available.canActivate, true, '不必等到自己的回合才可入梦');

  const hasTrump = getActiveSkillAvailability({
    gameState,
    players,
    currentPlayerId: 'player-0',
    handCards: [...sideCards, card('s6', 'spades', '6')]
  });
  assert.equal(hasTrump.canActivate, false);
  assert.match(hasTrump.reason, /仍有主牌/);

  const sleeping = getActiveSkillAvailability({
    gameState: { ...gameState, dreamKilling: { sleepingPlayerIds: ['player-0'] } },
    players,
    currentPlayerId: 'player-0',
    handCards: sideCards
  });
  assert.equal(sleeping.canActivate, false);
  assert.match(sleeping.reason, /系统随机出牌/);
});

test('神兵天降必须先选神兵与匹配手牌，客户端按转化后牌面验证出牌', () => {
  const players = [{ id: 'player-0' }, { id: 'player-1' }, { id: 'player-2' }, { id: 'player-3' }];
  const source = card('source', 'clubs', 'A');
  const unrelated = card('unrelated', 'diamonds', '7');
  const target = card('divine-hearts-A', 'hearts', 'A');
  const gameState = {
    phase: 'playing',
    playMode: 'ordered',
    currentPlayerIndex: 0,
    currentRoundPlays: 0,
    playersPlayedThisRound: [],
    trumpSuit: 'spades',
    trumpRank: '2',
    selectedRule: {
      id: 'divine_weapon',
      activeSkill: {
        id: 'divine_weapon',
        name: '神兵天降',
        timing: 'any_play',
        effect: 'transform_matching_card'
      }
    },
    activeSkillUsesByPlayerId: {},
    divineWeapon: {
      cards: [target, card('divine-spades-9', 'spades', '9')],
      generation: 1,
      usedThisRound: false
    }
  };

  const availability = getActiveSkillAvailability({
    gameState,
    players,
    currentPlayerId: 'player-0',
    handCards: [source, unrelated]
  });
  assert.equal(availability.canActivate, true);

  const missingTarget = validatePlaySelection({
    selectedCardIds: [source.id],
    handCards: [source, unrelated],
    gameState,
    trumpSuit: 'spades',
    trumpRank: '2',
    activeSkillId: 'divine_weapon',
    currentPlayerId: 'player-0'
  });
  assert.equal(missingTarget.valid, false);
  assert.match(missingTarget.message, /先选择.*神兵牌/);

  const wrongSource = validatePlaySelection({
    selectedCardIds: [unrelated.id],
    handCards: [source, unrelated],
    gameState,
    trumpSuit: 'spades',
    trumpRank: '2',
    activeSkillId: 'divine_weapon',
    currentPlayerId: 'player-0',
    divineWeaponCardId: target.id,
    divineWeaponSourceCardId: unrelated.id
  });
  assert.equal(wrongSource.valid, false);
  assert.match(wrongSource.message, /花色或点数相同/);

  const valid = validatePlaySelection({
    selectedCardIds: [source.id],
    handCards: [source, unrelated],
    gameState,
    trumpSuit: 'spades',
    trumpRank: '2',
    activeSkillId: 'divine_weapon',
    currentPlayerId: 'player-0',
    divineWeaponCardId: target.id,
    divineWeaponSourceCardId: source.id
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.pattern.suit, 'hearts');

  const roundSpent = getActiveSkillAvailability({
    gameState: {
      ...gameState,
      divineWeapon: { ...gameState.divineWeapon, usedThisRound: true }
    },
    players,
    currentPlayerId: 'player-0',
    handCards: [source, unrelated]
  });
  assert.equal(roundSpent.canActivate, false);
  assert.match(roundSpent.reason, /本轮已有玩家发动/);
});

test('神兵天降按原牌计分，且不能转化最后一张首花色副牌来毙牌', () => {
  assert.equal(getCardPoints({
    rank: '10',
    originalRank: '5',
    isDivineWeaponTransformed: true
  }), 5);
  assert.equal(getCardPoints({
    rank: '10',
    originalRank: '7',
    isDivineWeaponTransformed: true
  }), 0);

  const players = [{ id: 'lead' }, { id: 'follower' }, { id: 'partner' }, { id: 'last' }];
  const lastClub = card('last-club', 'clubs', '7');
  const divineClubLevel = card('divine-clubs-2', 'clubs', '2');
  const divineDiamondLevel = card('divine-diamonds-2', 'diamonds', '2');
  const gameState = {
    phase: 'playing',
    playMode: 'ordered',
    currentPlayerIndex: 1,
    currentRoundPlays: 1,
    playersPlayedThisRound: [0],
    leadingPattern: { type: PatternTypes.SINGLE, suit: 'clubs', length: 1 },
    trumpSuit: 'spades',
    trumpRank: '2',
    selectedRule: {
      id: 'divine_weapon',
      activeSkill: {
        id: 'divine_weapon',
        name: '神兵天降',
        timing: 'any_play',
        effect: 'transform_matching_card'
      }
    },
    activeSkillUsesByPlayerId: {},
    divineWeapon: {
      cards: [divineClubLevel, divineDiamondLevel],
      generation: 1,
      usedThisRound: false
    }
  };

  const illegalRuff = validatePlaySelection({
    selectedCardIds: [lastClub.id],
    handCards: [lastClub, card('heart-8', 'hearts', '8')],
    gameState,
    trumpSuit: 'spades',
    trumpRank: '2',
    activeSkillId: 'divine_weapon',
    currentPlayerId: 'follower',
    divineWeaponCardId: divineClubLevel.id,
    divineWeaponSourceCardId: lastClub.id
  });
  assert.equal(illegalRuff.valid, false);
  assert.match(illegalRuff.message, /同花色.*必须优先出/);

  const diamondSource = card('diamond-7', 'diamonds', '7');
  const legalRuffAfterVoid = validatePlaySelection({
    selectedCardIds: [diamondSource.id],
    handCards: [diamondSource, card('heart-8', 'hearts', '8')],
    gameState,
    trumpSuit: 'spades',
    trumpRank: '2',
    activeSkillId: 'divine_weapon',
    currentPlayerId: 'follower',
    divineWeaponCardId: divineDiamondLevel.id,
    divineWeaponSourceCardId: diamondSource.id
  });
  assert.equal(legalRuffAfterVoid.valid, true);
  assert.equal(legalRuffAfterVoid.pattern.suit, 'trump');
});

test('请君入瓮只在本轮一号位出牌前可发动，使用后本局不再开放', () => {
  const players = [0, 1, 2, 3].map(index => ({ id: `player-${index}` }));
  const skill = {
    id: 'invite_into_urn',
    name: '请君入瓮',
    usageLimit: 1,
    timing: 'first_position_before_play',
    effect: 'declare_target_card'
  };
  const leadingState = {
    phase: 'playing',
    playMode: 'ordered',
    currentPlayerIndex: 0,
    roundStartPlayerIndex: 0,
    currentRoundPlays: 0,
    playersPlayedThisRound: [],
    selectedRule: { id: 'invite_into_urn', activeSkill: skill },
    activeSkillUsesByPlayerId: {}
  };

  const ready = getActiveSkillAvailability({
    gameState: leadingState,
    players,
    currentPlayerId: 'player-0'
  });
  assert.equal(ready.canActivate, true);
  assert.match(ready.reason, /一张或多张都只扣5分/);

  const afterLead = getActiveSkillAvailability({
    gameState: {
      ...leadingState,
      currentPlayerIndex: 1,
      currentRoundPlays: 1,
      playersPlayedThisRound: [0]
    },
    players,
    currentPlayerId: 'player-1'
  });
  assert.equal(afterLead.canActivate, false);
  assert.match(afterLead.reason, /一号位/);

  const used = getActiveSkillAvailability({
    gameState: {
      ...leadingState,
      activeSkillUsesByPlayerId: { 'player-0': ['invite_into_urn'] }
    },
    players,
    currentPlayerId: 'player-0'
  });
  assert.equal(used.isUsed, true);
  assert.equal(used.canActivate, false);
});

test('魔术戏法只允许本轮一号位在出牌前预备选择两名玩家', () => {
  const players = [{ id: 'p0' }, { id: 'p1' }, { id: 'p2' }, { id: 'p3' }];
  const selectedRule = {
    id: 'magic_trick',
    activeSkill: {
      id: 'magic_trick',
      name: '魔术戏法',
      usageLimit: 1,
      timing: 'first_position_before_play',
      effect: 'swap_two_plays_at_round_end'
    }
  };
  const baseState = {
    phase: 'playing',
    playMode: 'ordered',
    currentPlayerIndex: 0,
    roundStartPlayerIndex: 0,
    currentRoundPlays: 0,
    playersPlayedThisRound: [],
    selectedRule,
    activeSkillUsesByPlayerId: {}
  };

  const available = getActiveSkillAvailability({
    gameState: baseState,
    players,
    currentPlayerId: 'p0',
    handCards: [card('c7', 'clubs', '7')]
  });
  assert.equal(available.canActivate, true);
  assert.match(available.reason, /两名其他玩家/);

  const afterLead = getActiveSkillAvailability({
    gameState: { ...baseState, currentRoundPlays: 1, playersPlayedThisRound: [0] },
    players,
    currentPlayerId: 'p0',
    handCards: [card('c7', 'clubs', '7')]
  });
  assert.equal(afterLead.canActivate, false);
});

test('聚类分析可反复发动，并能把相邻点数转换成合法对子', () => {
  const handCards = [card('c7', 'clubs', '7'), card('c8', 'clubs', '8')];
  const selectedRule = {
    id: 'cluster_analysis',
    activeSkill: {
      id: 'cluster_analysis',
      name: '聚类分析',
      usageLimit: null,
      timing: 'any_play',
      effect: 'adjacent_rank_transform'
    }
  };
  const gameState = {
    phase: 'playing',
    playMode: 'ordered',
    currentPlayerIndex: 0,
    roundStartPlayerIndex: 0,
    currentRoundPlays: 0,
    playersPlayedThisRound: [],
    trumpSuit: 'spades',
    trumpRank: '2',
    selectedRule,
    activeSkillUsesByPlayerId: { p0: ['cluster_analysis'] }
  };
  const players = [{ id: 'p0' }, { id: 'p1' }, { id: 'p2' }, { id: 'p3' }];

  const availability = getActiveSkillAvailability({
    gameState,
    players,
    currentPlayerId: 'p0',
    handCards
  });
  assert.equal(availability.canActivate, true);
  assert.equal(availability.isUsed, false);

  const validation = validatePlaySelection({
    selectedCardIds: handCards.map(item => item.id),
    handCards,
    gameState,
    trumpSuit: 'spades',
    trumpRank: '2',
    activeSkillId: 'cluster_analysis',
    currentPlayerId: 'p0',
    clusterAnalysisSubstitutions: [{
      cardId: 'c7',
      suit: 'clubs',
      fromRank: '7',
      toRank: '8'
    }]
  });
  assert.equal(validation.valid, true);
  assert.equal(validation.pattern.type, PatternTypes.PAIR);
  assert.deepEqual(validation.effectiveCards.map(item => item.rank), ['8', '8']);
  assert.equal(validation.effectiveCards.some(item => item.isClusterAnalysisTransformed), true);

  const firstJack = card('sJ0', 'spades', 'J');
  const secondJack = card('sJ1', 'spades', 'J');
  const multiValidation = validatePlaySelection({
    selectedCardIds: [firstJack.id, secondJack.id],
    handCards: [firstJack, secondJack],
    gameState,
    trumpSuit: 'hearts',
    trumpRank: '2',
    activeSkillId: 'cluster_analysis',
    currentPlayerId: 'p0',
    clusterAnalysisSubstitutions: [
      { cardId: firstJack.id, suit: 'spades', fromRank: 'J', toRank: 'Q' },
      { cardId: secondJack.id, suit: 'spades', fromRank: 'J', toRank: 'Q' }
    ]
  });
  assert.equal(multiValidation.valid, true);
  assert.equal(multiValidation.pattern.type, PatternTypes.PAIR);
  assert.deepEqual(multiValidation.effectiveCards.map(item => item.rank), ['Q', 'Q']);
});

test('禁术秘法可随时预备、轮首确认并在发动后永久生效', () => {
  const players = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }, { id: 'p4' }];
  const activeSkill = {
    id: 'forbidden_magic',
    name: '禁术秘法',
    usageLimit: 1,
    timing: 'anytime_prepare_round_start_confirm',
    effect: 'demote_trumps_and_transform'
  };
  const baseState = {
    phase: 'playing',
    playMode: 'ordered',
    currentRound: 1,
    currentPlayerIndex: 0,
    currentRoundPlays: 0,
    playersPlayedThisRound: [],
    selectedRule: { id: 'forbidden_magic', activeSkill },
    activeSkillUsesByPlayerId: {},
    forbiddenMagic: { reservations: [], activePlayerIds: [] }
  };

  const nonLeader = getActiveSkillAvailability({
    gameState: baseState,
    players,
    currentPlayerId: 'p3',
    handCards: [card('c3', 'clubs', '3')]
  });
  assert.equal(nonLeader.canActivate, true);
  assert.match(nonLeader.reason, /随时可以预备/);

  const reserved = getActiveSkillAvailability({
    gameState: {
      ...baseState,
      forbiddenMagic: {
        reservations: [{ playerId: 'p3', targetRound: 1 }],
        activePlayerIds: []
      }
    },
    players,
    currentPlayerId: 'p3',
    handCards: [card('c3', 'clubs', '3')]
  });
  assert.equal(reserved.isReserved, true);
  assert.equal(reserved.canActivate, false);

  const active = getActiveSkillAvailability({
    gameState: {
      ...baseState,
      activeSkillUsesByPlayerId: { p3: ['forbidden_magic'] },
      forbiddenMagic: { reservations: [], activePlayerIds: ['p3'] }
    },
    players,
    currentPlayerId: 'p3',
    handCards: [card('c3', 'clubs', '3')]
  });
  assert.equal(active.isActive, true);
  assert.equal(active.isUsed, true);

  const duringRound = getActiveSkillAvailability({
    gameState: {
      ...baseState,
      currentRoundPlays: 1,
      playersPlayedThisRound: [0]
    },
    players,
    currentPlayerId: 'p3',
    handCards: [card('c3', 'clubs', '3')]
  });
  assert.equal(duringRound.canActivate, true);
  assert.equal(duringRound.targetRound, 2);
  assert.match(duringRound.reason, /第2轮开始时/);
});

test('禁术秘法前端按副牌验证级牌，并禁止王转化为当前主花色', () => {
  const mainAce = card('main-a', 'hearts', 'A');
  const levelSix = card('level-6', 'clubs', '6');
  const joker = card('joker', 'joker', 'big_joker');
  const handCards = [mainAce, levelSix, joker];
  const gameState = {
    currentRound: 1,
    currentRoundPlays: 0,
    playersPlayedThisRound: [],
    selectedRule: {
      id: 'forbidden_magic',
      activeSkill: {
        id: 'forbidden_magic',
        effect: 'demote_trumps_and_transform'
      }
    },
    forbiddenMagic: { reservations: [], activePlayerIds: ['p1'] }
  };

  const aceResult = validatePlaySelection({
    selectedCardIds: [mainAce.id],
    handCards,
    gameState,
    currentPlayerId: 'p1',
    trumpSuit: 'hearts',
    trumpRank: '6'
  });
  assert.equal(aceResult.valid, true);
  assert.equal(aceResult.pattern.suit, 'hearts');
  assert.equal(aceResult.pattern.strength, 14);

  const levelResult = validatePlaySelection({
    selectedCardIds: [levelSix.id],
    handCards,
    gameState,
    currentPlayerId: 'p1',
    trumpSuit: 'hearts',
    trumpRank: '6'
  });
  assert.equal(levelResult.valid, true);
  assert.equal(levelResult.pattern.suit, 'clubs');
  assert.equal(levelResult.pattern.strength, 6);

  const invalidJoker = validatePlaySelection({
    selectedCardIds: [joker.id],
    handCards,
    gameState,
    currentPlayerId: 'p1',
    trumpSuit: 'hearts',
    trumpRank: '6',
    forbiddenMagicSubstitutions: [{ cardId: joker.id, suit: 'hearts', rank: 'Q' }]
  });
  assert.equal(invalidJoker.valid, false);
  assert.match(invalidJoker.message, /不能转化为当前主牌花色/);

  const legalJoker = validatePlaySelection({
    selectedCardIds: [joker.id],
    handCards,
    gameState,
    currentPlayerId: 'p1',
    trumpSuit: 'hearts',
    trumpRank: '6',
    forbiddenMagicSubstitutions: [{ cardId: joker.id, suit: 'spades', rank: 'Q' }]
  });
  assert.equal(legalJoker.valid, true);
  assert.equal(legalJoker.effectiveCards[0].rank, 'Q');
  assert.equal(getCardPoints(legalJoker.effectiveCards[0]), 0);
});

test('木牛流马中的牌可选择打出，但不计入实体手牌的跟牌义务', () => {
  const physicalSpade = card('physical-spade', 'spades', 'A');
  const woodenOxHeart = {
    ...card('wooden-ox-heart', 'hearts', '2'),
    isWoodenOxCard: true
  };
  const gameState = {
    selectedRule: { id: 'wooden_ox_flowing_horse', name: '木牛流马' },
    currentRound: 3,
    leadingPattern: detectPattern(
      [card('lead-heart', 'hearts', '9')],
      'clubs',
      '6'
    ),
    currentRoundPlays: [{}]
  };

  const physicalOffSuitResult = validatePlaySelection({
    selectedCardIds: [physicalSpade.id],
    handCards: [physicalSpade, woodenOxHeart],
    gameState,
    currentPlayerId: 'p1',
    trumpSuit: 'clubs',
    trumpRank: '6'
  });
  assert.equal(physicalOffSuitResult.valid, true);

  const storedCardResult = validatePlaySelection({
    selectedCardIds: [woodenOxHeart.id],
    handCards: [physicalSpade, woodenOxHeart],
    gameState,
    currentPlayerId: 'p1',
    trumpSuit: 'clubs',
    trumpRank: '6'
  });
  assert.equal(storedCardResult.valid, true);
});

test('布什戈门只允许二号位发动，并把退回的每张实体牌禁用于紧接着的重新首发', () => {
  const activeSkill = {
    id: 'bush_gate',
    name: '布什戈门',
    usageLimit: 1,
    timing: 'second_position_after_lead',
    effect: 'force_leader_replay'
  };
  const players = [
    { id: 'p0', cardsCount: 1 },
    { id: 'p1', cardsCount: 2 },
    { id: 'p2', cardsCount: 2 },
    { id: 'p3', cardsCount: 2 }
  ];
  const activationState = {
    phase: 'playing',
    playMode: 'ordered',
    currentRound: 2,
    currentPlayerIndex: 1,
    roundStartPlayerIndex: 0,
    currentRoundPlays: 1,
    playersPlayedThisRound: [0],
    selectedRule: { id: 'bush_gate', activeSkill },
    activeSkillUsesByPlayerId: {}
  };

  const secondPosition = getActiveSkillAvailability({
    gameState: activationState,
    players,
    currentPlayerId: 'p1'
  });
  assert.equal(secondPosition.canActivate, true);
  assert.match(secondPosition.reason, /收回/);

  const notCurrentSecondPosition = getActiveSkillAvailability({
    gameState: activationState,
    players,
    currentPlayerId: 'p2'
  });
  assert.equal(notCurrentSecondPosition.canActivate, false);

  const noAlternativeCard = getActiveSkillAvailability({
    gameState: activationState,
    players: [{ ...players[0], cardsCount: 0 }, ...players.slice(1)],
    currentPlayerId: 'p1'
  });
  assert.equal(noAlternativeCard.canActivate, false);
  assert.match(noAlternativeCard.reason, /没有其他手牌/);

  const returnedA = card('returned-a', 'hearts', 'A');
  const returnedB = card('returned-b', 'hearts', 'A');
  const alternative = card('alternative', 'hearts', '3');
  const replayState = {
    ...activationState,
    currentPlayerIndex: 0,
    currentRoundPlays: 0,
    playersPlayedThisRound: [],
    bushGate: {
      restriction: {
        round: 2,
        leaderPlayerId: 'p0',
        forbiddenCardIds: [returnedA.id, returnedB.id]
      }
    }
  };
  const handCards = [returnedA, returnedB, alternative];

  assert.deepEqual(
    new Set(getRuleDisabledLeadCardIds({
      gameState: replayState,
      handCards,
      players,
      currentPlayerId: 'p0'
    })),
    new Set([returnedA.id, returnedB.id])
  );
  const returnedCardResult = validatePlaySelection({
    selectedCardIds: [returnedA.id],
    handCards,
    gameState: replayState,
    currentPlayerId: 'p0',
    trumpSuit: 'spades',
    trumpRank: '2'
  });
  assert.equal(returnedCardResult.valid, false);
  assert.match(returnedCardResult.message, /布什戈门/);

  const mixedResult = validatePlaySelection({
    selectedCardIds: [alternative.id, returnedB.id],
    handCards,
    gameState: replayState,
    currentPlayerId: 'p0',
    trumpSuit: 'spades',
    trumpRank: '2'
  });
  assert.equal(mixedResult.valid, false);
  assert.match(mixedResult.message, /布什戈门/);

  const alternativeResult = validatePlaySelection({
    selectedCardIds: [alternative.id],
    handCards,
    gameState: replayState,
    currentPlayerId: 'p0',
    trumpSuit: 'spades',
    trumpRank: '2'
  });
  assert.equal(alternativeResult.valid, true);

  assert.deepEqual(getRuleDisabledLeadCardIds({
    gameState: { ...replayState, currentRound: 3 },
    handCards,
    players,
    currentPlayerId: 'p0'
  }), []);
});

test('队友加油的B和郡王进入扩展牌力，升面分牌仍按实体原牌计分', () => {
  const rule = { id: 'teammate_cheer' };
  const boostedSideAce = {
    ...card('boosted-side-ace', 'clubs', 'B'),
    originalSuit: 'clubs',
    originalRank: 'A',
    isTeammateCheered: true
  };
  const ordinarySideAce = card('ordinary-side-ace', 'clubs', 'A');
  const boostedBigJoker = {
    ...card('boosted-big-joker', 'joker', 'county_prince_joker'),
    originalSuit: 'joker',
    originalRank: 'big_joker',
    isTeammateCheered: true
  };
  const ordinaryBigJoker = card('ordinary-big-joker', 'joker', 'big_joker');
  const boostedFive = {
    ...card('boosted-five', 'clubs', '6'),
    originalSuit: 'clubs',
    originalRank: '5',
    isTeammateCheered: true
  };

  assert.ok(
    getCardStrength(boostedSideAce, 'hearts', '2', rule)
      > getCardStrength(ordinarySideAce, 'hearts', '2', rule)
  );
  assert.ok(
    getCardStrength(boostedBigJoker, 'hearts', '2', rule)
      > getCardStrength(ordinaryBigJoker, 'hearts', '2', rule)
  );
  assert.equal(getCardPoints(boostedFive), 5);
});

test('虚虚实实仅在奇数张首家副花色时亮起，并把这些牌从本次跟牌义务中虚置', () => {
  const players = [
    { id: 'player-0' },
    { id: 'player-1' },
    { id: 'player-2' },
    { id: 'player-3' }
  ];
  const ledSuitCards = [
    card('club-7', 'clubs', '7'),
    card('club-8-a', 'clubs', '8'),
    card('club-8-b', 'clubs', '8')
  ];
  const trumpPair = [
    card('spade-3-a', 'spades', '3'),
    card('spade-3-b', 'spades', '3')
  ];
  const handCards = [...ledSuitCards, ...trumpPair];
  const gameState = {
    phase: 'playing',
    playMode: 'ordered',
    currentPlayerIndex: 1,
    currentRoundPlays: 1,
    playersPlayedThisRound: [0],
    leadingPattern: { type: 'pair', suit: 'clubs', length: 2 },
    trumpSuit: 'spades',
    trumpRank: '2',
    selectedRule: {
      id: 'illusion_and_reality',
      activeSkill: {
        id: 'illusion_and_reality',
        name: '虚虚实实',
        usageLimit: 1,
        timing: 'following_play',
        effect: 'ignore_odd_led_side_suit'
      }
    },
    activeSkillUsesByPlayerId: {}
  };

  const availability = getActiveSkillAvailability({
    gameState,
    players,
    currentPlayerId: 'player-1',
    handCards
  });
  assert.equal(availability.canActivate, true);
  assert.equal(availability.ignoredSuit, 'clubs');
  assert.deepEqual(availability.virtualizedCardIds, ledSuitCards.map(value => value.id));

  const normalOffSuit = validatePlaySelection({
    selectedCardIds: trumpPair.map(value => value.id),
    handCards,
    gameState,
    trumpSuit: 'spades',
    trumpRank: '2',
    currentPlayerId: 'player-1'
  });
  assert.equal(normalOffSuit.valid, false);

  const cannotPlayVirtualizedCards = validatePlaySelection({
    selectedCardIds: ledSuitCards.slice(0, 2).map(value => value.id),
    handCards,
    gameState,
    trumpSuit: 'spades',
    trumpRank: '2',
    activeSkillId: 'illusion_and_reality',
    currentPlayerId: 'player-1'
  });
  assert.equal(cannotPlayVirtualizedCards.valid, false);
  assert.match(cannotPlayVirtualizedCards.message, /不能打出被虚置/);

  const virtualizedPlay = validatePlaySelection({
    selectedCardIds: trumpPair.map(value => value.id),
    handCards,
    gameState,
    trumpSuit: 'spades',
    trumpRank: '2',
    activeSkillId: 'illusion_and_reality',
    currentPlayerId: 'player-1'
  });
  assert.equal(virtualizedPlay.valid, true);
  assert.equal(virtualizedPlay.ignoredSuit, 'clubs');

  const evenAvailability = getActiveSkillAvailability({
    gameState,
    players,
    currentPlayerId: 'player-1',
    handCards: handCards.filter(value => value.id !== ledSuitCards[0].id)
  });
  assert.equal(evenAvailability.canActivate, false);
  assert.match(evenAvailability.reason, /不是奇数张/);
});

test('回光返照生效时可无视花色跟牌，但整次出牌只能由主牌组成', () => {
  const heldLedSuit = card('club-7', 'clubs', '7');
  const trumpKing = card('spade-K', 'spades', 'K');
  const trumpQueen = card('spade-Q', 'spades', 'Q');
  const offSuitFive = card('diamond-5', 'diamonds', '5');
  const handCards = [heldLedSuit, trumpKing, trumpQueen, offSuitFive];
  const activeState = {
    phase: 'playing',
    playMode: 'ordered',
    currentPlayerIndex: 1,
    currentRound: 4,
    currentRoundPlays: 1,
    playersPlayedThisRound: [0],
    leadingPattern: { type: 'pair', suit: 'clubs', length: 2 },
    trumpSuit: 'spades',
    trumpRank: '2',
    selectedRule: { id: 'afterglow', name: '回光返照' },
    afterglow: { activePlayerIds: ['player-1'] }
  };

  const mixedWithSideCard = validatePlaySelection({
    selectedCardIds: [trumpKing.id, offSuitFive.id],
    handCards,
    gameState: activeState,
    trumpSuit: 'spades',
    trumpRank: '2',
    currentPlayerId: 'player-1'
  });
  assert.equal(mixedWithSideCard.valid, false);
  assert.match(mixedWithSideCard.message, /只能由主牌组成/);

  const wrongCount = validatePlaySelection({
    selectedCardIds: [trumpKing.id],
    handCards,
    gameState: activeState,
    trumpSuit: 'spades',
    trumpRank: '2',
    currentPlayerId: 'player-1'
  });
  assert.equal(wrongCount.valid, false);
  assert.match(wrongCount.message, /必须打出 2 张牌/);

  const freeFollow = validatePlaySelection({
    selectedCardIds: [trumpKing.id, trumpQueen.id],
    handCards,
    gameState: activeState,
    trumpSuit: 'spades',
    trumpRank: '2',
    currentPlayerId: 'player-1'
  });
  assert.equal(freeFollow.valid, true);
  assert.equal(freeFollow.afterglowActive, true);

  const inactiveFollow = validatePlaySelection({
    selectedCardIds: [trumpKing.id, trumpQueen.id],
    handCards,
    gameState: { ...activeState, afterglow: { activePlayerIds: [] } },
    trumpSuit: 'spades',
    trumpRank: '2',
    currentPlayerId: 'player-1'
  });
  assert.equal(inactiveFollow.valid, false);

  const noTrumpFollow = validatePlaySelection({
    selectedCardIds: [trumpKing.id, trumpQueen.id],
    handCards,
    gameState: {
      ...activeState,
      trumpSuit: 'no_trump',
      afterglow: { activePlayerIds: ['player-1'] }
    },
    trumpSuit: 'no_trump',
    trumpRank: '2',
    currentPlayerId: 'player-1'
  });
  assert.equal(noTrumpFollow.valid, false);
  assert.equal(noTrumpFollow.afterglowActive, undefined);
});

test('回光返照的升面主牌使用扩展牌力但仍按实体牌面计分', () => {
  const boostedBigJoker = {
    ...card('afterglow-big-joker', 'joker', 'county_prince_joker'),
    originalSuit: 'joker',
    originalRank: 'big_joker',
    isAfterglowBoosted: true
  };
  const boostedTrumpKing = {
    ...card('afterglow-trump-king', 'spades', 'A'),
    originalSuit: 'spades',
    originalRank: 'K',
    isAfterglowBoosted: true
  };

  assert.ok(
    getCardStrength(boostedBigJoker, 'spades', '2', { id: 'afterglow' })
      > getCardStrength(card('big-joker', 'joker', 'big_joker'), 'spades', '2', { id: 'afterglow' })
  );
  assert.equal(getCardPoints(boostedTrumpKing), 10);
  assert.deepEqual(
    [getScoringDisplayCard(boostedTrumpKing).suit, getScoringDisplayCard(boostedTrumpKing).rank],
    ['spades', 'K']
  );
});
