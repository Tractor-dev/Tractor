import test from 'node:test';
import assert from 'node:assert/strict';

import { Room } from '../src/models/Room.js';
import { Player } from '../src/models/Player.js';
import { Card } from '../src/models/Card.js';
import { GameEngine } from '../src/services/GameEngine.js';
import { DrawingPhaseManager } from '../src/services/DrawingPhaseManager.js';
import { DeckService } from '../src/services/DeckService.js';
import { BotService } from '../src/services/BotService.js';
import { registerPlayerHandlers } from '../src/socket/handlers/playerHandlers.js';
import {
  emitCardsPlayed,
  registerGameHandlers
} from '../src/socket/handlers/gameHandlers.js';
import {
  compareCards,
  detectPattern,
  findSmallestPlayForRespectElders,
  getSuitlessPatternProfile,
  rankRoundPlaysByRespectOrder,
  getCardStrength,
  isTrumpCard,
  parseThrowCombination,
  PatternTypes,
  resolveClusterAnalysisPlay,
  resolveEnduringComparison,
  resolveForbiddenMagicPlay,
  resolveJokerSubstitutionPlay,
  validateFollowingPlay,
  validateLeadingPlay
} from '../src/utils/cardPatternUtils.js';
import {
  ActiveSkillIds,
  getImplementedRules,
  getOpeningCardExchangeOffset,
  getDayNightHighestRank,
  getOddEvenRoundMultiplier,
  getRuleById,
  getRuleSetup,
  isReverseRankOrderRule,
  isSingleStepDebugRule,
  RuleIds
} from '../src/rules/ruleRegistry.js';
import { GamePhases, Ranks, TurnOrders } from '../src/utils/constants.js';
import {
  calculateRoundPoints,
  getCardPoints,
  getMeticulousAccountingCardPoints
} from '../src/utils/scoringUtils.js';
import { comparePokerScores, evaluateBestPokerHand } from '../src/utils/pokerUtils.js';
import {
  getBirdsGoneBowHiddenDisabledCards,
  getCardCooldownDisabledCards,
  recordBirdsGoneBowHiddenPointCards
} from '../src/utils/cardCooldownUtils.js';
import {
  mapOneCountryCards,
  resolveOneCountryTwoSystems
} from '../src/utils/oneCountryTwoSystemsUtils.js';
import { shiftStrengthCompensationCardFace } from '../src/utils/strengthCompensationUtils.js';
import {
  shiftThreeTigersRank,
  transformThreeTigersCard
} from '../src/utils/threeTigersUtils.js';
import { validateDeclaration } from '../src/utils/trumpUtils.js';
import {
  calculateIronEvidenceRoundScoring,
  IronEvidenceModes,
  isIronEvidenceSpecialCard
} from '../src/utils/ironEvidenceUtils.js';

const NORMAL_RULE = getRuleById(RuleIds.NORMAL_GAME);
const DOUBLE_HAPPINESS_RULE = getRuleById(RuleIds.DOUBLE_HAPPINESS);
const REVERSE_RULE = getRuleById(RuleIds.REVERSE_RANK_ORDER);
const IRRESISTIBLE_FORCE_RULE = getRuleById(RuleIds.IRRESISTIBLE_FORCE);
const SINGLE_STEP_DEBUG_RULE = getRuleById(RuleIds.SINGLE_STEP_DEBUG);
const REFORM_AND_OPENING_UP_RULE = getRuleById(RuleIds.REFORM_AND_OPENING_UP);
const SUBSTITUTE_SACRIFICE_RULE = getRuleById(RuleIds.SUBSTITUTE_SACRIFICE);
const SIX_SIX_GREAT_SUCCESS_RULE = getRuleById(RuleIds.SIX_SIX_GREAT_SUCCESS);
const TAI_CHI_FOUR_SYMBOLS_RULE = getRuleById(RuleIds.TAI_CHI_FOUR_SYMBOLS);
const ONE_HORSE_LEADS_RULE = getRuleById(RuleIds.ONE_HORSE_LEADS);
const HEAVY_FOG_RULE = getRuleById(RuleIds.HEAVY_FOG);
const ROUTE_SWING_RULE = getRuleById(RuleIds.ROUTE_SWING);
const BELT_AND_ROAD_RULE = getRuleById(RuleIds.BELT_AND_ROAD);
const DAY_NIGHT_ROTATION_RULE = getRuleById(RuleIds.DAY_NIGHT_ROTATION);
const RESPECT_ELDERS_AND_CHILDREN_RULE = getRuleById(RuleIds.RESPECT_ELDERS_AND_CHILDREN);
const RITES_COLLAPSE_RULE = getRuleById(RuleIds.RITES_COLLAPSE);
const RECOMMEND_TALENT_RULE = getRuleById(RuleIds.RECOMMEND_TALENT);
const ACCIDENT_INSURANCE_RULE = getRuleById(RuleIds.ACCIDENT_INSURANCE);
const THREE_POWERS_RULE = getRuleById(RuleIds.THREE_POWERS);
const GENTLEMAN_PROMISE_RULE = getRuleById(RuleIds.GENTLEMAN_PROMISE);
const REPEATED_EXHAUSTION_RULE = getRuleById(RuleIds.REPEATED_EXHAUSTION);
const FOCUS_FIGURE_RULE = getRuleById(RuleIds.FOCUS_FIGURE);
const COOLDOWN_TIME_RULE = getRuleById(RuleIds.COOLDOWN_TIME);
const TIME_COOLING_RULE = getRuleById(RuleIds.TIME_COOLING);
const PLANNED_ECONOMY_RULE = getRuleById(RuleIds.PLANNED_ECONOMY);
const EQUIVALENT_RECIPROCITY_RULE = getRuleById(RuleIds.EQUIVALENT_RECIPROCITY);
const ENDURING_RULE = getRuleById(RuleIds.ENDURING);
const AVERAGE_POOLING_RULE = getRuleById(RuleIds.AVERAGE_POOLING);
const DREAM_KILLING_RULE = getRuleById(RuleIds.DREAM_KILLING);
const JOINT_HARMONY_RULE = getRuleById(RuleIds.JOINT_HARMONY);
const DIVINE_WEAPON_RULE = getRuleById(RuleIds.DIVINE_WEAPON);
const MAGIC_TRICK_RULE = getRuleById(RuleIds.MAGIC_TRICK);
const ABRUPT_STOP_RULE = getRuleById(RuleIds.ABRUPT_STOP);
const CLUSTER_ANALYSIS_RULE = getRuleById(RuleIds.CLUSTER_ANALYSIS);
const FORBIDDEN_MAGIC_RULE = getRuleById(RuleIds.FORBIDDEN_MAGIC);
const METICULOUS_ACCOUNTING_RULE = getRuleById(RuleIds.METICULOUS_ACCOUNTING);
const LOST_IN_FOG_RULE = getRuleById(RuleIds.LOST_IN_FOG);
const BIRDS_GONE_BOW_HIDDEN_RULE = getRuleById(RuleIds.BIRDS_GONE_BOW_HIDDEN);
const ODD_EVEN_SCORING_RULE = getRuleById(RuleIds.ODD_EVEN_SCORING);
const SECOND_BATTLEFIELD_RULE = getRuleById(RuleIds.SECOND_BATTLEFIELD);
const ONE_COUNTRY_TWO_SYSTEMS_RULE = getRuleById(RuleIds.ONE_COUNTRY_TWO_SYSTEMS);
const WOODEN_OX_FLOWING_HORSE_RULE = getRuleById(RuleIds.WOODEN_OX_FLOWING_HORSE);
const STRENGTH_COMPENSATION_RULE = getRuleById(RuleIds.STRENGTH_COMPENSATION);
const UNARMED_RULE = getRuleById(RuleIds.UNARMED);
const MUTUAL_SUPPORT_RULE = getRuleById(RuleIds.MUTUAL_SUPPORT);
const CANDLE_TO_DAWN_RULE = getRuleById(RuleIds.CANDLE_TO_DAWN);
const CULTURAL_REVOLUTION_RULE = getRuleById(RuleIds.CULTURAL_REVOLUTION);
const THREE_TIGERS_RULE = getRuleById(RuleIds.THREE_TIGERS);
const INVITE_INTO_URN_RULE = getRuleById(RuleIds.INVITE_INTO_URN);
const OLD_HORSE_RULE = getRuleById(RuleIds.OLD_HORSE_STILL_HAS_STRENGTH);
const TRUMP_WINS_RULE = getRuleById(RuleIds.TRUMP_WINS);
const OPENLY_REVEALED_RULE = getRuleById(RuleIds.OPENLY_REVEALED);
const STRAW_BOAT_BORROWING_ARROWS_RULE = getRuleById(RuleIds.STRAW_BOAT_BORROWING_ARROWS);
const BUSH_GATE_RULE = getRuleById(RuleIds.BUSH_GATE);
const TEAMMATE_CHEER_RULE = getRuleById(RuleIds.TEAMMATE_CHEER);
const ILLUSION_AND_REALITY_RULE = getRuleById(RuleIds.ILLUSION_AND_REALITY);
const STRIVE_UPSTREAM_RULE = getRuleById(RuleIds.STRIVE_UPSTREAM);
const AFTERGLOW_RULE = getRuleById(RuleIds.AFTERGLOW);
const OUTWARD_HARMONY_INNER_DIVISION_RULE = getRuleById(
  RuleIds.OUTWARD_HARMONY_INNER_DIVISION
);
const AMBIGUOUS_RULE = getRuleById(RuleIds.AMBIGUOUS);
const TWO_GHOSTS_KNOCK_DOOR_RULE = getRuleById(RuleIds.TWO_GHOSTS_KNOCK_DOOR);
const PEOPLE_COMMUNE_RULE = getRuleById(RuleIds.PEOPLE_COMMUNE);
const REMOVE_FIREWOOD_RULE = getRuleById(RuleIds.REMOVE_FIREWOOD_FROM_UNDER_CAULDRON);
const MAINSTAY_RULE = getRuleById(RuleIds.MAINSTAY);
const HAPPY_TWINS_RULE = getRuleById(RuleIds.HAPPY_TWINS);
const ENCIRCLE_THREE_MISSING_ONE_RULE = getRuleById(RuleIds.ENCIRCLE_THREE_MISSING_ONE);
const THREE_SIX_NINE_GRADES_RULE = getRuleById(RuleIds.THREE_SIX_NINE_GRADES);
const IRON_EVIDENCE_RULE = getRuleById(RuleIds.IRON_EVIDENCE);
const WAITING_RABBIT_RULE = getRuleById(RuleIds.WAITING_RABBIT);
const HIDDEN_DRAGON_RULE = getRuleById(RuleIds.HIDDEN_DRAGON_IN_ABYSS);
const ADMINISTRATIVE_REVIEW_RULE = getRuleById(RuleIds.ADMINISTRATIVE_REVIEW);
const POLITICAL_REVIEW_RULE = getRuleById(RuleIds.POLITICAL_REVIEW);
const NO_ONE_SURVIVES_RULE = getRuleById(RuleIds.NO_ONE_SURVIVES);
const LURE_TIGER_RULE = getRuleById(RuleIds.LURE_TIGER_FROM_MOUNTAIN);
const DEFENSE_AS_OFFENSE_RULE = getRuleById(RuleIds.DEFENSE_AS_OFFENSE);
const ANTINOMY_RULE = getRuleById(RuleIds.ANTINOMY);
const CHANGE_RICE_TO_MULBERRY_RULE = getRuleById(RuleIds.CHANGE_RICE_TO_MULBERRY);
const DESTROY_DYKE_RULE = getRuleById(RuleIds.DESTROY_DYKE_FLOOD_FIELDS);
const RECORD_ON_FILE_RULE = getRuleById(RuleIds.RECORD_ON_FILE);
const WEIGHING_THOUSAND_JIN_RULE = getRuleById(RuleIds.WEIGHING_THOUSAND_JIN);
const KING_OVER_WHITE_RULE = getRuleById(RuleIds.KING_OVER_WHITE);
const FEAR_OF_BREAKING_VASE_RULE = getRuleById(RuleIds.FEAR_OF_BREAKING_VASE);

function createRoom(config = {}) {
  const room = new Room('规则测试房', 'socket-0', { dealInterval: 10, ...config });
  for (let index = 0; index < 4; index++) {
    room.addPlayer(new Player(`socket-${index}`, `玩家${index}`, index));
  }
  return room;
}

function createIo() {
  const events = [];
  return {
    events,
    to(target) {
      return {
        emit(event, payload) {
          events.push({ target, event, payload });
        }
      };
    }
  };
}

function sequenceRandom(values) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

function card(suit, rank, copyIndex = 0) {
  return new Card(suit, rank, copyIndex);
}

function singlePlay(cardValue, trumpSuit, trumpRank, rule) {
  return {
    cards: [cardValue],
    pattern: detectPattern([cardValue], trumpSuit, trumpRank, rule)
  };
}

test('首家甩散牌时对子可拆成单牌通道，仍由最大单张决定', () => {
  const trumpSuit = 'spades';
  const trumpRank = '2';
  const leadingCards = [card('hearts', 'A'), card('hearts', 'K')];
  const leadingThrow = parseThrowCombination(
    leadingCards,
    trumpSuit,
    trumpRank,
    NORMAL_RULE
  );
  const leadingPattern = {
    type: PatternTypes.THROW,
    suit: leadingThrow.suit,
    components: leadingThrow.components,
    length: leadingCards.length,
    strength: Math.max(...leadingThrow.components.map(component => component.strength))
  };
  const pairTens = [card('hearts', '10', 0), card('hearts', '10', 1)];
  const following = validateFollowingPlay(
    pairTens,
    pairTens,
    leadingPattern,
    trumpSuit,
    trumpRank,
    NORMAL_RULE
  );

  assert.equal(following.valid, true);
  assert.deepEqual(
    leadingPattern.components.map(component => component.type),
    [PatternTypes.SINGLE, PatternTypes.SINGLE]
  );
  assert.deepEqual(
    following.pattern.components.map(component => component.type),
    [PatternTypes.PAIR]
  );
  assert.ok(
    compareCards(
      { cards: pairTens, pattern: following.pattern },
      { cards: leadingCards, pattern: leadingPattern },
      leadingPattern.suit,
      trumpSuit,
      trumpRank,
      NORMAL_RULE,
      leadingPattern
    ) <= 0
  );

  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  leadingCards.forEach(value => room.players[0].addCard(value));
  room.players[0].addCard(card('clubs', '3'));
  pairTens.forEach(value => room.players[1].addCard(value));
  room.players[1].addCard(card('clubs', '4'));
  [card('hearts', '9'), card('hearts', '8'), card('clubs', '5')]
    .forEach(value => room.players[2].addCard(value));
  [card('hearts', '7'), card('hearts', '6'), card('clubs', '6')]
    .forEach(value => room.players[3].addCard(value));
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.trumpSuit = trumpSuit;
  room.gameState.trumpRank = trumpRank;
  room.gameState.selectedRule = NORMAL_RULE;
  engine.setFirstPlayer(room.players[0].id);

  engine.playCards(room.players[0].id, leadingCards.map(value => value.id));
  engine.playCards(room.players[1].id, pairTens.map(value => value.id));

  assert.equal(room.gameState.currentWinnerIndex, 0);
});

test('首家甩三张散主时，小王加对子按最大单张取得牌权', () => {
  const trumpSuit = 'hearts';
  const trumpRank = '2';
  const leadingCards = [
    card('clubs', trumpRank, 10),
    card(trumpSuit, 'A', 10),
    card(trumpSuit, 'Q', 10)
  ];
  const leadingThrow = parseThrowCombination(
    leadingCards,
    trumpSuit,
    trumpRank,
    NORMAL_RULE
  );
  const leadingPattern = {
    type: PatternTypes.THROW,
    suit: leadingThrow.suit,
    components: leadingThrow.components,
    length: leadingCards.length,
    strength: Math.max(...leadingThrow.components.map(component => component.strength))
  };
  const challengerCards = [
    card('joker', 'small_joker', 10),
    card(trumpSuit, '7', 10),
    card(trumpSuit, '7', 11)
  ];
  const challengerThrow = parseThrowCombination(
    challengerCards,
    trumpSuit,
    trumpRank,
    NORMAL_RULE
  );
  const challengerPattern = {
    type: PatternTypes.THROW,
    suit: challengerThrow.suit,
    components: challengerThrow.components,
    length: challengerCards.length,
    strength: Math.max(...challengerThrow.components.map(component => component.strength))
  };

  assert.deepEqual(
    leadingPattern.components.map(component => component.type),
    [PatternTypes.SINGLE, PatternTypes.SINGLE, PatternTypes.SINGLE]
  );
  assert.deepEqual(
    challengerPattern.components.map(component => component.type).sort(),
    [PatternTypes.PAIR, PatternTypes.SINGLE].sort()
  );
  assert.equal(
    compareCards(
      { cards: challengerCards, pattern: challengerPattern },
      { cards: leadingCards, pattern: leadingPattern },
      leadingPattern.suit,
      trumpSuit,
      trumpRank,
      NORMAL_RULE,
      leadingPattern
    ),
    1
  );
});

test('已按首家散牌结构完成毙牌后，异门对子加单牌不能反压主牌', () => {
  const trumpSuit = 'spades';
  const trumpRank = '2';
  const makeThrowPattern = cards => {
    const parsed = parseThrowCombination(cards, trumpSuit, trumpRank, NORMAL_RULE);
    return {
      type: PatternTypes.THROW,
      suit: parsed.suit,
      components: parsed.components,
      length: cards.length,
      strength: Math.max(...parsed.components.map(component => component.strength))
    };
  };
  const leadingCards = [
    card('hearts', 'Q', 20),
    card('hearts', '8', 20),
    card('hearts', '7', 20)
  ];
  const trumpCards = [
    card(trumpSuit, 'K', 20),
    card(trumpSuit, 'J', 20),
    card(trumpSuit, '5', 20)
  ];
  const offSuitCards = [
    card('diamonds', '8', 20),
    card('diamonds', '8', 21),
    card('diamonds', '7', 20)
  ];
  const leadingPattern = makeThrowPattern(leadingCards);

  assert.equal(
    compareCards(
      { cards: offSuitCards, pattern: makeThrowPattern(offSuitCards) },
      { cards: trumpCards, pattern: makeThrowPattern(trumpCards) },
      leadingPattern.suit,
      trumpSuit,
      trumpRank,
      NORMAL_RULE,
      leadingPattern
    ),
    -1
  );
});

test('毙了和盖毙结果会记录攻击者与被压牌玩家，供局部动画定位', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const lead = card('hearts', 'A', 90);
  const ruff = card('spades', '3', 90);
  const overruff = card('spades', 'A', 90);
  const last = card('clubs', '4', 90);
  [lead, ruff, overruff, last].forEach((value, index) => {
    room.players[index].addCard(value);
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.selectedRule = NORMAL_RULE;
  engine.setFirstPlayer(room.players[0].id);

  engine.playCards(room.players[0].id, [lead.id]);
  const ruffResult = engine.playCards(room.players[1].id, [ruff.id]);
  assert.deepEqual(
    ruffResult.trumpAction,
    {
      type: 'trump',
      playerId: room.players[1].id,
      playerName: room.players[1].name,
      targetPlayerId: room.players[0].id,
      targetPlayerName: room.players[0].name
    }
  );

  const overruffResult = engine.playCards(room.players[2].id, [overruff.id]);
  assert.deepEqual(
    overruffResult.trumpAction,
    {
      type: 'overtrump',
      playerId: room.players[2].id,
      playerName: room.players[2].name,
      targetPlayerId: room.players[1].id,
      targetPlayerName: room.players[1].name
    }
  );
});

test('首局随机玩家获得二选一权限，其他玩家和伪造规则都会被拒绝', () => {
  const room = createRoom();
  const io = createIo();
  // 0.6 -> 玩家2；0.2 -> 仅改变两个候选的展示顺序。
  const engine = new GameEngine(room, io, sequenceRandom([0.6, 0.2]));

  engine.startGame();

  assert.equal(room.gameState.ruleChooserPlayerId, room.players[2].id);
  assert.equal(room.gameState.isRuleSelectionPending, true);
  assert.equal(room.gameState.ruleOptions.length, 2);
  assert.equal(new Set(room.gameState.ruleOptions.map(rule => rule.id)).size, 2);
  const implementedIds = new Set(getImplementedRules().map(rule => rule.id));
  assert.ok(room.gameState.ruleOptions.every(rule => implementedIds.has(rule.id)));
  assert.throws(
    () => engine.selectRule(room.players[1].id, room.gameState.ruleOptions[0]),
    /不是本局的规则选择者/
  );
  assert.throws(
    () => engine.selectRule(room.players[2].id, { id: 'unimplemented_rule' }),
    /只能从本局提供的两条规则中选择/
  );
});

test('准备和规则选择两个条件都完成后才开始发牌，且规则不能二次更换', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo(), sequenceRandom([0.1, 0.8]));
  let drawingStarts = 0;
  engine.startDrawing = () => { drawingStarts++; };

  engine.startGame();
  const chooser = room.findPlayerById(room.gameState.ruleChooserPlayerId);

  room.players.forEach(player => engine.playerReady(player.id));
  assert.equal(room.gameState.isWaitingForReady, false);
  assert.equal(room.gameState.isRuleSelectionPending, true);
  assert.equal(drawingStarts, 0);

  const selectedOption = room.gameState.ruleOptions[0];
  engine.selectRule(chooser.id, { id: selectedOption.id, content: '客户端伪造描述' });
  assert.equal(room.gameState.selectedRule.id, selectedOption.id);
  assert.equal(room.gameState.selectedRule.content, getRuleById(selectedOption.id).content);
  assert.equal(drawingStarts, 1);
  assert.throws(
    () => engine.selectRule(chooser.id, { id: RuleIds.NORMAL_GAME }),
    /当前不在规则选择阶段/
  );
});

test('双喜临门改为三选二，房主可逐条刷新且两条子规则同时生效', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io, sequenceRandom([0.1, 0.8, 0.3, 0.6]));
  const chooser = room.players[1];
  room.gameState.isWaitingForReady = true;
  room.gameState.isRuleSelectionPending = true;
  room.gameState.ruleSelectionMode = 'single';
  room.gameState.ruleChooserPlayerId = chooser.id;
  room.gameState.ruleOptions = [DOUBLE_HAPPINESS_RULE, NORMAL_RULE];

  const enteredSecondStage = engine.selectRule(chooser.id, DOUBLE_HAPPINESS_RULE);
  assert.equal(enteredSecondStage, false);
  assert.equal(room.gameState.isRuleSelectionPending, true);
  assert.equal(room.gameState.ruleSelectionMode, 'double_happiness');
  assert.equal(room.gameState.ruleOptions.length, 3);
  assert.equal(new Set(room.gameState.ruleOptions.map(rule => rule.id)).size, 3);
  assert.ok(
    room.gameState.ruleOptions.every(rule => rule.id !== RuleIds.DOUBLE_HAPPINESS)
  );

  assert.throws(
    () => engine.refreshDoubleHappinessOption('socket-2', 0),
    /只有房主/
  );
  const idsBeforeRefresh = room.gameState.ruleOptions.map(rule => rule.id);
  const refreshed = engine.refreshDoubleHappinessOption('socket-0', 0);
  assert.equal(refreshed.oldRule.id, idsBeforeRefresh[0]);
  assert.notEqual(refreshed.rule.id, refreshed.oldRule.id);
  assert.equal(new Set(room.gameState.ruleOptions.map(rule => rule.id)).size, 3);
  assert.ok(!idsBeforeRefresh.includes(refreshed.rule.id));

  room.gameState.ruleOptions = [
    REVERSE_RULE,
    SINGLE_STEP_DEBUG_RULE,
    NORMAL_RULE
  ];
  engine.selectRule(chooser.id, {
    ids: [RuleIds.REVERSE_RANK_ORDER, RuleIds.SINGLE_STEP_DEBUG]
  });

  assert.equal(room.gameState.isRuleSelectionPending, false);
  assert.equal(room.gameState.selectedRule.id, RuleIds.DOUBLE_HAPPINESS);
  assert.deepEqual(
    room.gameState.selectedRule.rules.map(rule => rule.id),
    [RuleIds.REVERSE_RANK_ORDER, RuleIds.SINGLE_STEP_DEBUG]
  );
  assert.equal(isReverseRankOrderRule(room.gameState.selectedRule), true);
  assert.equal(isSingleStepDebugRule(room.gameState.selectedRule), true);
  assert.ok(
    getCardStrength(
      card('hearts', '2'),
      'spades',
      '7',
      room.gameState.selectedRule
    ) > getCardStrength(
      card('hearts', 'A'),
      'spades',
      '7',
      room.gameState.selectedRule
    )
  );
  assert.deepEqual(getRuleSetup(room.gameState.selectedRule), {
    bottomCardsCount: 8,
    attackerStartingScore: 0
  });
  assert.equal(
    io.events.some(({ event }) => event === 'double_happiness_option_refreshed'),
    true
  );
});

test('规则测试模式跳过随机二选一并在准备完成后直接发牌', () => {
  const room = createRoom({
    testMode: true,
    testRuleId: RuleIds.PERFECT_STRATEGY
  });
  const io = createIo();
  const engine = new GameEngine(room, io, sequenceRandom([0.1, 0.8]));
  let drawingStarts = 0;
  engine.startDrawing = () => { drawingStarts++; };

  engine.startGame();

  assert.equal(room.gameState.selectedRule.id, RuleIds.PERFECT_STRATEGY);
  assert.equal(room.gameState.isRuleSelectionPending, false);
  assert.equal(room.gameState.ruleChooserPlayerId, null);
  assert.equal(room.gameState.bottomCardsCount, 8);
  assert.equal(room.gameState.attackerScore, 10);
  assert.equal(io.events.some(({ event }) => event === 'rule_selection_started'), false);
  assert.equal(io.events.find(({ event }) => event === 'rule_selected')?.payload.testMode, true);

  room.players.forEach(player => engine.playerReady(player.id));
  assert.equal(drawingStarts, 1);
});

test('规则测试模式选择双喜临门时由房主直接进入三选二', () => {
  const room = createRoom({
    testMode: true,
    testRuleId: RuleIds.DOUBLE_HAPPINESS
  });
  const io = createIo();
  const engine = new GameEngine(room, io, sequenceRandom([0.9, 0.2, 0.7]));

  engine.startGame();

  assert.equal(room.gameState.selectedRule, null);
  assert.equal(room.gameState.isRuleSelectionPending, true);
  assert.equal(room.gameState.ruleSelectionMode, 'double_happiness');
  assert.equal(room.gameState.ruleChooserPlayerId, room.players[0].id);
  assert.equal(room.gameState.ruleOptions.length, 3);
  assert.ok(
    room.gameState.ruleOptions.every(rule => rule.id !== RuleIds.DOUBLE_HAPPINESS)
  );
  assert.equal(
    io.events.some(({ event, payload }) => (
      event === 'rule_selected' && payload.rule?.id === RuleIds.NORMAL_GAME
    )),
    false
  );
});

test('规则测试模式拒绝不存在的规则', () => {
  assert.throws(
    () => createRoom({ testMode: true, testRuleId: 'not-implemented' }),
    /必须选择一条已实现规则/
  );
});

test('下一局由上一局最后一轮赢家选择规则', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo(), sequenceRandom([0.4]));
  engine.startDrawing = () => {};

  room.gameState.buryingPlayerId = room.players[0].id;
  room.gameState.lastRoundWinnerIndex = 3;
  room.gameState.lastRoundLeadingPattern = { type: PatternTypes.SINGLE, length: 1 };
  engine.finishGame();

  assert.equal(room.gameState.nextRuleChooserIndex, 3);
  engine.startNextGame();
  assert.equal(room.gameState.ruleChooserPlayerId, room.players[3].id);
  assert.equal(room.gameState.isRuleSelectionPending, true);
});

test('倒反天罡颠倒普通牌大小，但级牌和王保持最高层级', () => {
  const trumpSuit = 'spades';
  const trumpRank = '7';
  const two = card('hearts', '2');
  const ace = card('hearts', 'A');
  const offSuitLevel = card('hearts', '7');
  const mainLevel = card('spades', '7');
  const smallJoker = card('joker', 'small_joker');
  const bigJoker = card('joker', 'big_joker');

  assert.ok(getCardStrength(ace, trumpSuit, trumpRank, NORMAL_RULE) >
    getCardStrength(two, trumpSuit, trumpRank, NORMAL_RULE));
  assert.ok(getCardStrength(two, trumpSuit, trumpRank, REVERSE_RULE) >
    getCardStrength(ace, trumpSuit, trumpRank, REVERSE_RULE));

  const ordered = [two, offSuitLevel, mainLevel, smallJoker, bigJoker]
    .map(value => getCardStrength(value, trumpSuit, trumpRank, REVERSE_RULE));
  assert.deepEqual(ordered, [...ordered].sort((a, b) => a - b));

  const twoPlay = singlePlay(two, trumpSuit, trumpRank, REVERSE_RULE);
  const acePlay = singlePlay(ace, trumpSuit, trumpRank, REVERSE_RULE);
  assert.equal(
    compareCards(twoPlay, acePlay, 'hearts', trumpSuit, trumpRank, REVERSE_RULE),
    1
  );
});

test('倒反天罡下拖拉机仍按颠倒后的相邻顺序并跳过级牌', () => {
  const cardsAcrossLevel = [
    card('hearts', '8', 0),
    card('hearts', '8', 1),
    card('hearts', '6', 0),
    card('hearts', '6', 1)
  ];
  const cardsWithGap = [
    card('hearts', '8', 0),
    card('hearts', '8', 1),
    card('hearts', '5', 0),
    card('hearts', '5', 1)
  ];

  assert.equal(
    detectPattern(cardsAcrossLevel, 'spades', '7', REVERSE_RULE).type,
    PatternTypes.TRACTOR
  );
  assert.equal(
    detectPattern(cardsWithGap, 'spades', '7', REVERSE_RULE).type,
    PatternTypes.INVALID
  );
});

test('特殊开局规则具有正确的底牌数量与闲家初始分', () => {
  const expectedSetups = [
    [RuleIds.ABUNDANT_HARVEST, '五谷丰登', 12, 30],
    [RuleIds.EXTREME_CHALLENGE, '极限挑战', 16, 60],
    [RuleIds.HALF_REALM, '江山半壁', 4, -10],
    [RuleIds.SHARED_PROSPERITY, '与民同乐', 0, -20],
    [RuleIds.PERFECT_STRATEGY, '算无遗策', 8, 10],
    [RuleIds.PEOPLE_COMMUNE, '人民公社', 0, -20],
    [RuleIds.ADMINISTRATIVE_REVIEW, '行政审查', 12, 0],
    [RuleIds.POLITICAL_REVIEW, '政治审查', 8, 0],
    [RuleIds.NO_ONE_SURVIVES, '无人生还', 8, 0],
    [RuleIds.LURE_TIGER_FROM_MOUNTAIN, '调虎离山', 8, 0],
    [RuleIds.DEFENSE_AS_OFFENSE, '以守为攻', 8, 0],
    [RuleIds.ANTINOMY, '二律背反', 8, 0],
    [RuleIds.CHANGE_RICE_TO_MULBERRY, '改稻为桑', 8, 0],
    [RuleIds.DESTROY_DYKE_FLOOD_FIELDS, '毁堤淹田', 8, 0],
    [RuleIds.RECORD_ON_FILE, '记录在案', 8, 0],
    [RuleIds.WEIGHING_THOUSAND_JIN, '上称千斤', 8, 0],
    [RuleIds.KING_OVER_WHITE, '王上加白', 8, 0],
    [RuleIds.FEAR_OF_BREAKING_VASE, '投鼠忌器', 8, 0]
  ];

  assert.equal(getImplementedRules().length, 106);
  for (const [id, name, bottomCardsCount, attackerStartingScore] of expectedSetups) {
    assert.equal(getRuleById(id).name, name);
    assert.deepEqual(getRuleSetup({ id }), { bottomCardsCount, attackerStartingScore });
  }
});

test('王上加白在洗牌后随机将且仅将一张普通王变为全局最大的白王', () => {
  assert.equal(KING_OVER_WHITE_RULE.name, '王上加白');
  assert.deepEqual(getRuleSetup(KING_OVER_WHITE_RULE), {
    bottomCardsCount: 8,
    attackerStartingScore: 0
  });

  const room = createRoom();
  const manager = new DrawingPhaseManager(
    room,
    createIo(),
    null,
    null,
    null,
    () => 0.5
  );
  const originalShuffle = DeckService.shuffle;
  room.gameState.selectedRule = KING_OVER_WHITE_RULE;

  try {
    DeckService.shuffle = deck => [...deck];
    manager.start();
    manager.stop();
  } finally {
    DeckService.shuffle = originalShuffle;
  }

  const fullDeck = [
    ...room.gameState.bottomCards,
    ...room.gameState.deck
  ];
  const jokers = fullDeck.filter(value => value.suit === 'joker');
  const whiteJokers = jokers.filter(value => value.rank === Ranks.WHITE_JOKER);
  const ordinaryJokers = jokers.filter(value => (
    [Ranks.SMALL_JOKER, Ranks.BIG_JOKER].includes(value.rank)
  ));

  assert.equal(fullDeck.length, 108);
  assert.equal(jokers.length, 4);
  assert.equal(whiteJokers.length, 1);
  assert.equal(ordinaryJokers.length, 3);
  assert.equal(whiteJokers[0].id, 'joker-small_joker-1');
  assert.equal(whiteJokers[0].value, whiteJokers[0].calculateValue());
  assert.equal(whiteJokers[0].toJSON().rank, Ranks.WHITE_JOKER);
  assert.ok(
    getCardStrength(whiteJokers[0], 'hearts', '2', KING_OVER_WHITE_RULE)
      > getCardStrength(card('joker', Ranks.BIG_JOKER), 'hearts', '2', KING_OVER_WHITE_RULE)
  );
  assert.equal(
    DeckService.createDeck().filter(value => value.rank === Ranks.WHITE_JOKER).length,
    0
  );
});

test('二鬼拍门在摸到第二张王时立即公开，后摸到的王也加入明置手牌', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io);
  const firstJoker = card('joker', 'small_joker', 1900);
  const secondJoker = card('joker', 'big_joker', 1901);
  const thirdJoker = card('joker', 'small_joker', 1902);
  room.gameState.selectedRule = TWO_GHOSTS_KNOCK_DOOR_RULE;
  room.gameState.phase = GamePhases.DRAWING;
  room.gameState.deck = [
    firstJoker,
    card('hearts', '3', 1903),
    card('clubs', '4', 1904),
    card('diamonds', '5', 1905),
    secondJoker,
    card('spades', '6', 1906),
    card('hearts', '7', 1907),
    card('clubs', '8', 1908),
    thirdJoker
  ];

  const manager = new DrawingPhaseManager(
    room,
    io,
    null,
    null,
    null,
    Math.random,
    player => engine.handleRuleCardDealt(player)
  );

  manager.dealOneCard();
  assert.equal(room.gameState.twoGhostsRevealedPlayerIds.size, 0);
  assert.equal(io.events.some(({ event }) => event === 'rule_visible_hands_updated'), false);

  for (let index = 0; index < 4; index++) manager.dealOneCard();
  assert.deepEqual(
    [...room.gameState.twoGhostsRevealedPlayerIds],
    [room.players[0].id]
  );
  let updates = io.events.filter(({ event }) => event === 'rule_visible_hands_updated');
  assert.equal(updates.length, 4, '四名玩家应同时收到公开手牌');
  updates.forEach(({ payload }) => {
    assert.equal(payload.hands.length, 1);
    assert.equal(payload.hands[0].kind, 'jokers');
    assert.deepEqual(
      payload.hands[0].cards.map(value => value.id),
      [firstJoker.id, secondJoker.id]
    );
  });

  for (let index = 0; index < 4; index++) manager.dealOneCard();
  updates = io.events.filter(({ event }) => event === 'rule_visible_hands_updated');
  assert.deepEqual(
    updates.at(-1).payload.hands[0].cards.map(value => value.id).sort(),
    [firstJoker.id, secondJoker.id, thirdJoker.id].sort()
  );
  assert.deepEqual(
    room.toJSON().gameState.twoGhosts.revealedHands[0].cards.map(value => value.id).sort(),
    [firstJoker.id, secondJoker.id, thirdJoker.id].sort()
  );
});

test('二鬼拍门只展示仍在手中的王，降到一张不会重新藏起，出尽后不留历史牌', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io);
  const jokers = [
    card('joker', 'small_joker', 1910),
    card('joker', 'big_joker', 1911)
  ];
  room.gameState.selectedRule = TWO_GHOSTS_KNOCK_DOOR_RULE;
  room.gameState.phase = GamePhases.DRAWING;
  jokers.forEach(value => room.players[0].addCard(value));
  engine.handleRuleCardDealt(room.players[0]);

  room.gameState.phase = GamePhases.PLAYING;
  room.players[0].removeCards([jokers[0].id]);
  engine.updateRuleHandVisibilityAfterCardChange(room.players[0]);
  let latest = io.events.filter(({ event }) => event === 'rule_visible_hands_updated').at(-1);
  assert.deepEqual(
    latest.payload.hands[0].cards.map(value => value.id),
    [jokers[1].id],
    '已经明置的一张余王必须继续公开'
  );

  room.players[0].removeCards([jokers[1].id]);
  engine.updateRuleHandVisibilityAfterCardChange(room.players[0]);
  latest = io.events.filter(({ event }) => event === 'rule_visible_hands_updated').at(-1);
  assert.deepEqual(latest.payload.hands, []);
  assert.deepEqual(room.toJSON().gameState.twoGhosts.revealedHands, []);
  assert.equal(JSON.stringify(room.toJSON()).includes(jokers[0].id), false);
  assert.equal(JSON.stringify(room.toJSON()).includes(jokers[1].id), false);
});

test('人民公社把108张牌全部摸完，四家各27张后再依次各埋两张', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io);
  room.gameState.selectedRule = PEOPLE_COMMUNE_RULE;
  room.gameState.bottomCardsCount = 0;
  room.gameState.attackerScore = -20;

  const manager = new DrawingPhaseManager(
    room,
    io,
    dealer => engine.handleDealerAssigned(dealer)
  );
  engine.drawingManager = manager;
  manager.start();
  manager.stop();
  for (let index = 0; index < 108; index++) manager.dealOneCard();

  assert.equal(room.gameState.bottomCards.length, 0);
  assert.deepEqual(room.players.map(player => player.cards.length), [27, 27, 27, 27]);

  const dealer = room.players[1];
  manager.completeDealerAssignment(dealer);
  assert.equal(room.gameState.phase, GamePhases.BURYING);
  assert.deepEqual(
    room.gameState.peopleCommuneBuryingOrder,
    [room.players[1].id, room.players[2].id, room.players[3].id, room.players[0].id]
  );
  assert.equal(room.gameState.peopleCommuneCurrentBuryingPlayerId, dealer.id);
  assert.equal(io.events.some(({ event }) => event === 'bottom_cards_received'), false);

  assert.throws(
    () => engine.buryCards(room.players[2].id, room.players[2].cards.slice(0, 2).map(value => value.id)),
    /还没有轮到你/
  );

  for (const [orderIndex, playerId] of room.gameState.peopleCommuneBuryingOrder.entries()) {
    const player = room.findPlayerById(playerId);
    const buriedIds = player.cards.slice(0, 2).map(value => value.id);
    engine.buryCards(player.id, buriedIds);
    if (orderIndex < 3) {
      buriedIds.forEach(cardId => {
        assert.equal(JSON.stringify(room.toJSON()).includes(cardId), false);
      });
    }
  }

  assert.equal(room.gameState.phase, GamePhases.PLAYING);
  assert.equal(room.gameState.firstPlayerId, dealer.id);
  assert.equal(room.gameState.bottomCards.length, 8);
  assert.deepEqual(room.players.map(player => player.cards.length), [25, 25, 25, 25]);
  assert.equal(room.gameState.peopleCommuneBuriedCardsByPlayerId.size, 4);
});

test('人民公社每名玩家只能查看自己埋下的两张牌', () => {
  const room = createRoom();
  room.gameState.selectedRule = PEOPLE_COMMUNE_RULE;
  const buriedCardsByPlayer = room.players.map((player, playerIndex) => [
    card('hearts', playerIndex === 2 ? '5' : '3', 1930 + playerIndex * 2),
    card('clubs', playerIndex === 2 ? 'K' : '4', 1931 + playerIndex * 2)
  ]);
  buriedCardsByPlayer.forEach((cards, playerIndex) => {
    room.gameState.peopleCommuneBuriedCardsByPlayerId.set(
      room.players[playerIndex].id,
      cards
    );
  });
  room.gameState.bottomCards = buriedCardsByPlayer.flat();

  const handlers = new Map();
  const emitted = [];
  const viewer = room.players[2];
  const socket = {
    id: viewer.socketId,
    on(event, handler) {
      handlers.set(event, handler);
    },
    emit(event, payload) {
      emitted.push({ event, payload });
    }
  };

  registerGameHandlers(createIo(), socket, {
    getRoom: roomId => roomId === room.id ? room : null
  });
  handlers.get('view_my_bottom_cards')({ roomId: room.id });

  const response = emitted.find(({ event }) => event === 'my_bottom_cards');
  assert.equal(response.payload.isPeopleCommune, true);
  assert.equal(response.payload.isPublic, false);
  assert.deepEqual(
    response.payload.bottomCards,
    buriedCardsByPlayer[2].map(value => value.toJSON())
  );
  assert.equal(calculateRoundPoints(response.payload.bottomCards), 15);
  buriedCardsByPlayer
    .filter((_, playerIndex) => playerIndex !== 2)
    .flat()
    .forEach(otherCard => {
      assert.equal(JSON.stringify(response.payload).includes(otherCard.id), false);
    });
  assert.equal(emitted.some(({ event }) => event === 'error'), false);
});

test('人民公社只抄对方埋分：闲家拿底加分，庄家方拿底令闲家扣分', () => {
  const calculate = lastRoundWinnerIndex => {
    const room = createRoom();
    const engine = new GameEngine(room, createIo());
    room.gameState.selectedRule = PEOPLE_COMMUNE_RULE;
    room.gameState.buryingPlayerId = room.players[0].id;
    room.gameState.attackerScore = -20;
    room.gameState.lastRoundWinnerIndex = lastRoundWinnerIndex;

    const buriedByPlayer = [
      [card('hearts', '5', 1920), card('hearts', '3', 1921)],
      [card('clubs', '10', 1922), card('clubs', '5', 1923)],
      [card('diamonds', 'K', 1924), card('diamonds', '4', 1925)],
      [card('spades', 'K', 1926), card('spades', '10', 1927)]
    ];
    buriedByPlayer.forEach((cards, playerIndex) => {
      room.gameState.peopleCommuneBuriedCardsByPlayerId.set(
        room.players[playerIndex].id,
        cards
      );
    });
    room.gameState.bottomCards = buriedByPlayer.flat();
    return { room, result: engine.calculateBottomScore() };
  };

  const attackerBottom = calculate(1);
  assert.equal(attackerBottom.result.peopleCommune.dealerBuriedPoints, 15);
  assert.equal(attackerBottom.result.peopleCommune.attackerBuriedPoints, 35);
  assert.equal(attackerBottom.result.bottomPoints, 15);
  assert.equal(attackerBottom.result.bottomScoreGained, 30);
  assert.equal(attackerBottom.room.gameState.attackerScore, 10);
  assert.equal(attackerBottom.result.resultText, '闲家抄庄家底');

  const dealerBottom = calculate(0);
  assert.equal(dealerBottom.result.bottomPoints, 35);
  assert.equal(dealerBottom.result.bottomScoreGained, -70);
  assert.equal(dealerBottom.room.gameState.attackerScore, -90);
  assert.equal(dealerBottom.result.resultText, '庄家方抄闲家底');
});

test('釜底抽薪记录每次反主，并由后向前让被反主者自由决定是否交换整手', () => {
  const room = createRoom();
  const io = createIo();
  room.gameState.phase = GamePhases.DRAWING;
  room.gameState.selectedRule = REMOVE_FIREWOOD_RULE;
  room.gameState.trumpRank = '2';
  room.players[0].cards = [card('hearts', '2', 1940), card('clubs', '3', 1941)];
  room.players[1].cards = [
    card('spades', '2', 1942), card('spades', '2', 1943), card('clubs', '4', 1944)
  ];
  room.players[2].cards = [
    card('joker', 'small_joker', 1945), card('joker', 'small_joker', 1946), card('clubs', '5', 1947)
  ];
  room.players[3].cards = [
    card('joker', 'big_joker', 1948), card('joker', 'big_joker', 1949), card('clubs', '6', 1950)
  ];

  const declare = (player, suit, count) => {
    const handlers = new Map();
    const emitted = [];
    const socket = {
      id: player.socketId,
      on(event, handler) {
        handlers.set(event, handler);
      },
      emit(event, payload) {
        emitted.push({ event, payload });
      }
    };
    registerPlayerHandlers(io, socket, {
      getRoom: roomId => roomId === room.id ? room : null
    });
    handlers.get('declare_trump')({ roomId: room.id, suit, count });
    assert.equal(emitted.some(({ event }) => event === 'error'), false);
  };

  declare(room.players[0], 'hearts', 1);
  declare(room.players[1], 'spades', 2);
  declare(room.players[2], 'joker', 2);
  declare(room.players[3], 'joker', 2);
  assert.deepEqual(
    room.gameState.removeFirewoodCounterPairs.map(pair => [
      pair.counteredPlayerId,
      pair.counteringPlayerId
    ]),
    [
      [room.players[0].id, room.players[1].id],
      [room.players[1].id, room.players[2].id],
      [room.players[2].id, room.players[3].id]
    ]
  );

  const engine = new GameEngine(room, io, () => 0.75);
  let completedDealerId = null;
  engine.drawingManager = {
    completeDealerAssignment(playerId) {
      completedDealerId = playerId;
    }
  };
  room.gameState.isTrumpDeclarationLocked = true;
  room.gameState.pendingDealerPlayerId = room.players[3].id;

  assert.equal(engine.handleDealerSelected(room.players[3]), true);
  assert.equal(room.gameState.removeFirewoodCurrentDecision.counteredPlayerId, room.players[2].id);
  const playerTwoHand = room.players[1].cards.map(value => value.id);
  const playerThreeHand = room.players[2].cards.map(value => value.id);

  const latestDecline = engine.respondRemoveFirewood(room.players[2].id, false);
  assert.equal(latestDecline.accepted, false);
  assert.deepEqual(room.players[2].cards.map(value => value.id), playerThreeHand);
  assert.equal(room.gameState.removeFirewoodCurrentDecision.counteredPlayerId, room.players[1].id);

  const middleExchange = engine.respondRemoveFirewood(room.players[1].id, true);
  assert.equal(middleExchange.accepted, true);
  assert.deepEqual(room.players[1].cards.map(value => value.id).sort(), [...playerThreeHand].sort());
  assert.deepEqual(room.players[2].cards.map(value => value.id).sort(), [...playerTwoHand].sort());
  assert.equal(room.gameState.removeFirewoodCurrentDecision.counteredPlayerId, room.players[0].id);

  const earliestDecline = engine.respondRemoveFirewood(room.players[0].id, false);
  assert.equal(earliestDecline.accepted, false);
  assert.equal(completedDealerId, room.players[3].id, '最终反主者仍是庄家，不随换手改变');
  assert.equal(room.gameState.removeFirewoodCurrentDecision, null);
  assert.equal(room.gameState.postDrawStage, null);
  assert.deepEqual(
    room.gameState.removeFirewoodExchangeResults.map(result => result.accepted),
    [false, true, false]
  );
  const exchangeEvents = io.events.filter(({ event }) => event === 'whole_hand_exchange_resolved');
  assert.equal(exchangeEvents.length, 1, '只有明确同意的一次才交换');
  assert.equal(exchangeEvents[0].payload.exchangeKind, 'pair');
});

test('一国两制按无声明、一对王、单方声明和双方声明结算主花色', () => {
  assert.equal(ONE_COUNTRY_TWO_SYSTEMS_RULE.name, '一国两制');

  const noDeclarations = resolveOneCountryTwoSystems(new Map(), 0);
  assert.equal(noDeclarations.isNoTrump, true);
  assert.equal(noDeclarations.canonicalTrumpSuit, 'no_trump');

  const jokerDeclaration = resolveOneCountryTwoSystems(new Map([
    [0, { suit: 'hearts' }],
    [1, { suit: 'joker', declarationType: 'pair_big_joker' }]
  ]), 0);
  assert.equal(jokerDeclaration.isNoTrump, true);
  assert.deepEqual(jokerDeclaration.teamTrumpSuits, { 0: null, 1: null });

  const singleSide = resolveOneCountryTwoSystems(new Map([
    [1, { suit: 'spades' }]
  ]), 0);
  assert.equal(singleSide.canonicalTrumpSuit, 'spades');
  assert.deepEqual(singleSide.teamTrumpSuits, { 0: 'spades', 1: 'spades' });

  const twoSides = resolveOneCountryTwoSystems(new Map([
    [0, { suit: 'hearts' }],
    [1, { suit: 'spades' }]
  ]), 0);
  assert.equal(twoSides.canonicalTrumpSuit, 'hearts');
  assert.equal(twoSides.hasDistinctTeamSuits, true);
  assert.deepEqual(twoSides.teamTrumpSuits, { 0: 'hearts', 1: 'spades' });

  const attackerCards = mapOneCountryCards([
    card('spades', '9', 900),
    card('hearts', '10', 901),
    card('clubs', 'J', 902)
  ], 1, twoSides);
  assert.deepEqual(
    attackerCards.map(value => value.suit),
    ['hearts', 'spades', 'clubs'],
    '闲家方在规范坐标中互换双方声明花色'
  );
  assert.deepEqual(
    attackerCards.map(value => value.id),
    ['spades-9-900', 'hearts-10-901', 'clubs-J-902'],
    '花色投影不得改变实体牌ID'
  );
});

test('一国两制双方在本方内反主，异方同强度声明互不覆盖', () => {
  const room = createRoom();
  const io = createIo();
  room.gameState.phase = GamePhases.DRAWING;
  room.gameState.selectedRule = ONE_COUNTRY_TWO_SYSTEMS_RULE;
  room.gameState.trumpRank = '2';
  room.players[0].addCard(card('hearts', '2', 910));
  room.players[1].addCard(card('spades', '2', 911));
  room.players[2].addCard(card('diamonds', '2', 912));
  room.players[3].addCard(card('joker', 'big_joker', 913));
  room.players[3].addCard(card('joker', 'big_joker', 914));

  const register = playerIndex => {
    const handlers = new Map();
    const socketEvents = [];
    const socket = {
      id: room.players[playerIndex].socketId,
      on(event, handler) {
        handlers.set(event, handler);
      },
      emit(event, payload) {
        socketEvents.push({ event, payload });
      }
    };
    registerPlayerHandlers(io, socket, {
      getRoom: roomId => roomId === room.id ? room : null
    });
    return { handlers, socketEvents };
  };

  const team0 = register(0);
  const team1 = register(1);
  team0.handlers.get('declare_trump')({ roomId: room.id, suit: 'hearts', count: 1 });
  team1.handlers.get('declare_trump')({ roomId: room.id, suit: 'spades', count: 1 });

  assert.equal(team0.socketEvents.length, 0);
  assert.equal(team1.socketEvents.length, 0);
  assert.equal(room.gameState.oneCountryDeclarationsByTeam.get(0).suit, 'hearts');
  assert.equal(room.gameState.oneCountryDeclarationsByTeam.get(1).suit, 'spades');
  assert.equal(room.gameState.currentTrumpDeclaration.playerId, room.players[1].id);
  assert.ok(io.events.some(({ event, payload }) =>
    event === 'trump_declared' && payload.teamIndex === 0
  ));
  assert.ok(io.events.some(({ event, payload }) =>
    event === 'trump_declared' && payload.teamIndex === 1
  ));

  const jokerPlayer = register(3);
  jokerPlayer.handlers.get('declare_trump')({
    roomId: room.id,
    suit: 'joker',
    count: 2
  });
  assert.equal(room.gameState.oneCountryDeclarationsByTeam.get(1).suit, 'joker');
  assert.equal(room.gameState.trumpSuit, 'no_trump');

  const blockedAfterJoker = register(2);
  blockedAfterJoker.handlers.get('declare_trump')({
    roomId: room.id,
    suit: 'diamonds',
    count: 1
  });
  assert.match(
    blockedAfterJoker.socketEvents.at(-1).payload.message,
    /一对王.*无主/
  );

  const manager = new DrawingPhaseManager(room, io);
  manager.assignDealer();
  assert.equal(room.gameState.dealerPlayerIndex, 3);
  assert.equal(room.gameState.oneCountryResolved.isNoTrump, true);
  assert.equal(room.gameState.trumpSuit, 'no_trump');
});

test('一国两制在花色互换后统一执行双向跟牌和大小判定', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const hands = [
    [card('hearts', '9', 920), card('spades', 'A', 921), card('clubs', 'Q', 922)],
    [card('spades', '10', 923), card('hearts', '6', 924)],
    [card('hearts', '8', 925), card('spades', 'K', 926)],
    [card('spades', 'J', 927), card('hearts', '7', 928)]
  ];
  room.players.forEach((player, index) => hands[index].forEach(value => player.addCard(value)));
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = ONE_COUNTRY_TWO_SYSTEMS_RULE;
  room.gameState.trumpRank = '2';
  room.gameState.trumpSuit = 'hearts';
  room.gameState.dealerPlayerIndex = 0;
  room.gameState.buryingPlayerId = room.players[0].id;
  room.gameState.oneCountryResolved = resolveOneCountryTwoSystems(new Map([
    [0, { suit: 'hearts' }],
    [1, { suit: 'spades' }]
  ]), 0);
  engine.setFirstPlayer(room.players[0].id);

  engine.playCards(room.players[0].id, [hands[0][0].id]);
  assert.throws(
    () => engine.playCards(room.players[1].id, [hands[1][1].id]),
    /must|follow|suit|跟|花色|张数/i,
    '庄家方红桃主牌首发时，闲家方必须跟自己的黑桃主牌'
  );
  engine.playCards(room.players[1].id, [hands[1][0].id]);
  engine.playCards(room.players[2].id, [hands[2][0].id]);
  const firstRound = engine.playCards(room.players[3].id, [hands[3][0].id]);
  assert.equal(firstRound.roundUpdate.roundWinner.playerIndex, 3);

  engine.playCards(room.players[3].id, [hands[3][1].id]);
  assert.throws(
    () => engine.playCards(room.players[0].id, [hands[0][2].id]),
    /must|follow|suit|跟|花色|张数/i,
    '闲家方红桃相当于庄家方黑桃，庄家方必须跟黑桃'
  );
  engine.playCards(room.players[0].id, [hands[0][1].id]);
  engine.playCards(room.players[1].id, [hands[1][1].id]);
  const secondRound = engine.playCards(room.players[2].id, [hands[2][1].id]);
  assert.equal(secondRound.roundUpdate.roundWinner.playerIndex, 0);
});

test('一国两制使用本方主花色毙对方的副牌', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const trick = [
    card('clubs', 'A', 930),
    card('spades', '5', 931),
    card('clubs', 'K', 932),
    card('diamonds', 'A', 933)
  ];
  room.players.forEach((player, index) => {
    player.addCard(trick[index]);
    player.addCard(card('diamonds', String(index + 3), 940 + index));
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = ONE_COUNTRY_TWO_SYSTEMS_RULE;
  room.gameState.trumpRank = '2';
  room.gameState.trumpSuit = 'hearts';
  room.gameState.dealerPlayerIndex = 0;
  room.gameState.buryingPlayerId = room.players[0].id;
  room.gameState.oneCountryResolved = resolveOneCountryTwoSystems(new Map([
    [0, { suit: 'hearts' }],
    [1, { suit: 'spades' }]
  ]), 0);
  engine.setFirstPlayer(room.players[0].id);

  engine.playCards(room.players[0].id, [trick[0].id]);
  engine.playCards(room.players[1].id, [trick[1].id]);
  engine.playCards(room.players[2].id, [trick[2].id]);
  const result = engine.playCards(room.players[3].id, [trick[3].id]);
  assert.equal(result.roundUpdate.roundWinner.playerIndex, 1);
});

test('锱铢必较已注册，闲家以-10分开局且A至7分别计1至7分', () => {
  assert.equal(METICULOUS_ACCOUNTING_RULE.name, '锱铢必较');
  assert.deepEqual(getRuleSetup(METICULOUS_ACCOUNTING_RULE), {
    bottomCardsCount: 8,
    attackerStartingScore: -10
  });
  assert.deepEqual(
    ['A', '2', '3', '4', '5', '6', '7', '8', '10', 'K']
      .map(rank => getMeticulousAccountingCardPoints(card('hearts', rank))),
    [1, 2, 3, 4, 5, 6, 7, 0, 0, 0]
  );
});

test('锱铢必较按新分值结算每墩和底牌，原10与K不再计分', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const trickCards = [
    card('hearts', '2', 400),
    card('hearts', 'A', 401),
    card('hearts', '3', 402),
    card('hearts', '4', 403)
  ];
  room.players.forEach((player, index) => {
    player.addCard(trickCards[index]);
    player.addCard(card('clubs', ['8', '9', 'J', 'Q'][index], 410 + index));
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = METICULOUS_ACCOUNTING_RULE;
  room.gameState.attackerScore = -10;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = 'K';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  engine.playCards(room.players[0].id, [trickCards[0].id]);
  engine.playCards(room.players[1].id, [trickCards[1].id]);
  engine.playCards(room.players[2].id, [trickCards[2].id]);
  const roundResult = engine.playCards(room.players[3].id, [trickCards[3].id]);

  assert.equal(roundResult.roundUpdate.scoreInfo.winnerIsAttacker, true);
  assert.equal(roundResult.roundUpdate.scoreInfo.roundPoints, 10);
  assert.equal(roundResult.roundUpdate.scoreInfo.roundPointCards.length, 4);
  assert.equal(room.gameState.attackerScore, 0);

  room.gameState.bottomCards = [
    card('diamonds', 'A', 420),
    card('diamonds', '2', 421),
    card('diamonds', '7', 422),
    card('diamonds', '10', 423),
    card('diamonds', 'K', 424)
  ];
  room.gameState.lastRoundWinnerIndex = 1;
  room.gameState.lastRoundLeadingPattern = { type: PatternTypes.SINGLE, length: 1 };
  const bottomResult = engine.calculateBottomScore();

  assert.equal(bottomResult.bottomPoints, 10);
  assert.equal(bottomResult.bottomScoreGained, 20);
  assert.equal(bottomResult.totalScore, 20);
});

test('如堕云雾已注册，并在出牌阶段从公共快照隐藏得分牌和分值', () => {
  assert.equal(LOST_IN_FOG_RULE.name, '如堕云雾');
  assert.deepEqual(getRuleSetup(LOST_IN_FOG_RULE), {
    bottomCardsCount: 8,
    attackerStartingScore: 0
  });

  const room = createRoom();
  room.gameState.selectedRule = LOST_IN_FOG_RULE;
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.attackerScore = 15;
  room.gameState.collectedPointCards = [card('hearts', '5', 430)];
  const hiddenState = room.gameState.toJSON();
  assert.equal(hiddenState.attackerScore, null);
  assert.equal(hiddenState.collectedPointCards, null);

  room.gameState.phase = GamePhases.REVEALING;
  const revealedState = room.gameState.toJSON();
  assert.equal(revealedState.attackerScore, 15);
  assert.equal(revealedState.collectedPointCards.length, 1);
});

test('如堕云雾正常结算但轮末事件不泄露本轮分值、总分或得分牌', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const trickCards = [
    card('hearts', '2', 440),
    card('hearts', 'A', 441),
    card('hearts', '3', 442),
    card('hearts', '5', 443)
  ];
  room.players.forEach((player, index) => {
    player.addCard(trickCards[index]);
    player.addCard(card('clubs', ['6', '7', '8', '9'][index], 450 + index));
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = LOST_IN_FOG_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = 'K';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  engine.playCards(room.players[0].id, [trickCards[0].id]);
  engine.playCards(room.players[1].id, [trickCards[1].id]);
  engine.playCards(room.players[2].id, [trickCards[2].id]);
  const result = engine.playCards(room.players[3].id, [trickCards[3].id]);

  assert.deepEqual(result.roundUpdate.scoreInfo, { hidden: true });
  assert.equal(room.gameState.attackerScore, 5);
  assert.deepEqual(room.gameState.collectedPointCards.map(value => value.id), [trickCards[3].id]);
});

test('鸟尽弓藏已注册，并在同花色六张传统分牌全部打出后公开弓藏花色', () => {
  assert.equal(BIRDS_GONE_BOW_HIDDEN_RULE.name, '鸟尽弓藏');
  assert.deepEqual(getRuleSetup(BIRDS_GONE_BOW_HIDDEN_RULE), {
    bottomCardsCount: 8,
    attackerStartingScore: 0
  });

  const room = createRoom();
  room.gameState.selectedRule = BIRDS_GONE_BOW_HIDDEN_RULE;
  const firstFive = [
    card('hearts', '5', 0),
    card('hearts', '5', 1),
    card('hearts', '10', 0),
    card('hearts', '10', 1),
    card('hearts', 'K', 0),
    card('hearts', 'A', 0)
  ];
  assert.deepEqual(recordBirdsGoneBowHiddenPointCards({
    gameState: room.gameState,
    cards: firstFive
  }), []);
  assert.deepEqual(room.gameState.toJSON().birdsGoneBowHidden.exhaustedSuits, []);

  assert.deepEqual(recordBirdsGoneBowHiddenPointCards({
    gameState: room.gameState,
    cards: [card('hearts', 'K', 1)]
  }), ['hearts']);
  assert.deepEqual(room.gameState.toJSON().birdsGoneBowHidden.exhaustedSuits, ['hearts']);
});

test('鸟尽弓藏把带分级牌统一计入主花色，并从原牌面副花色中排除', () => {
  const room = createRoom();
  room.gameState.selectedRule = BIRDS_GONE_BOW_HIDDEN_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '5';

  const heartLevelCards = [card('hearts', '5', 0), card('hearts', '5', 1)];
  const firstHeartSidePoints = [
    ...heartLevelCards,
    card('hearts', '10', 0),
    card('hearts', '10', 1),
    card('hearts', 'K', 0)
  ];
  assert.deepEqual(recordBirdsGoneBowHiddenPointCards({
    gameState: room.gameState,
    cards: firstHeartSidePoints
  }), []);
  assert.ok(heartLevelCards.every(value => (
    room.gameState.birdPlayedPointCardSuitsById.get(value.id) === 'trump'
  )));

  assert.deepEqual(recordBirdsGoneBowHiddenPointCards({
    gameState: room.gameState,
    cards: [card('hearts', 'K', 1)]
  }), ['hearts'], '红桃副牌只需等待两张10和两张K，红桃5级牌不计入其中');

  const remainingTrumpPoints = [
    ...['diamonds', 'clubs', 'spades'].flatMap(suit => [
      card(suit, '5', 0),
      card(suit, '5', 1)
    ]),
    card('spades', '10', 0),
    card('spades', '10', 1),
    card('spades', 'K', 0),
    card('spades', 'K', 1)
  ];
  assert.deepEqual(recordBirdsGoneBowHiddenPointCards({
    gameState: room.gameState,
    cards: remainingTrumpPoints
  }), ['trump'], '主花色应等待八张5级牌及两张主10、两张主K全部打出');

  const hand = [
    card('diamonds', '5', 600),
    card('spades', 'Q', 601),
    card('clubs', '8', 602)
  ];
  assert.deepEqual(getBirdsGoneBowHiddenDisabledCards({
    gameState: room.gameState,
    playerCards: hand,
    isLeading: true
  }).map(value => value.id), hand.slice(0, 2).map(value => value.id));
});

test('鸟尽弓藏只限制主动首发，跟牌放行且无其他花色可出时自动解除', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const plays = [
    [card('hearts', '5', 0), card('hearts', '5', 1)],
    [card('hearts', '10', 0), card('hearts', '10', 1)],
    [card('hearts', 'K', 0), card('hearts', 'K', 1)],
    [card('hearts', '7', 0), card('hearts', '7', 1)]
  ];
  const nextCards = [
    card('clubs', '3', 500),
    card('clubs', '4', 501),
    card('hearts', 'A', 502),
    card('clubs', 'A', 503)
  ];
  room.players.forEach((player, index) => {
    plays[index].forEach(value => player.addCard(value));
    player.addCard(nextCards[index]);
    if (index === 2) player.addCard(card('clubs', 'Q', 504));
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = BIRDS_GONE_BOW_HIDDEN_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  engine.playCards(room.players[0].id, plays[0].map(value => value.id));
  assert.equal(room.gameState.birdPlayedPointCardIds.size, 0, '未完成的墩不能提前固化分牌');
  engine.undoLastPlay(room.players[0].id);
  assert.equal(room.gameState.birdPlayedPointCardIds.size, 0, '撤回的分牌不能计入鸟尽弓藏');
  engine.playCards(room.players[0].id, plays[0].map(value => value.id));
  engine.playCards(room.players[1].id, plays[1].map(value => value.id));
  engine.playCards(room.players[2].id, plays[2].map(value => value.id));
  assert.doesNotThrow(
    () => engine.playCards(room.players[3].id, plays[3].map(value => value.id)),
    '第六张分牌出现后，本墩尚未出牌的玩家仍可正常跟牌'
  );

  assert.deepEqual([...room.gameState.birdExhaustedSuits], ['hearts']);
  assert.equal(room.gameState.currentPlayerIndex, 2, '红桃K对子应赢得本墩并成为下一墩一号位');
  assert.throws(
    () => engine.playCards(room.players[2].id, [nextCards[2].id]),
    /鸟尽弓藏/
  );
  assert.doesNotThrow(() => engine.playCards(room.players[2].id, [card('clubs', 'Q', 504).id]));

  const onlyExhaustedSuit = [card('hearts', '8', 510), card('hearts', '9', 511)];
  assert.deepEqual(getBirdsGoneBowHiddenDisabledCards({
    gameState: room.gameState,
    playerCards: onlyExhaustedSuit,
    isLeading: true
  }), [], '只剩弓藏花色时必须解除限制');

  const bot = new BotService('simple');
  assert.deepEqual(
    bot.getFallbackAction({
      selectedRule: BIRDS_GONE_BOW_HIDDEN_RULE,
      currentRound: 2,
      leadingPattern: null,
      trumpSuit: 'spades',
      trumpRank: '2',
      birdExhaustedSuits: new Set(['hearts'])
    }, [card('hearts', '8', 520), card('clubs', '8', 521)], room.players[0].id),
    [card('clubs', '8', 521).id]
  );
});

test('无独有偶奇数轮不收分牌且计0分，偶数轮只收当轮分牌并计双倍', () => {
  assert.equal(ODD_EVEN_SCORING_RULE.name, '无独有偶');
  assert.deepEqual(getRuleSetup(ODD_EVEN_SCORING_RULE), {
    bottomCardsCount: 8,
    attackerStartingScore: 0
  });
  assert.equal(getOddEvenRoundMultiplier(ODD_EVEN_SCORING_RULE, 1), 0);
  assert.equal(getOddEvenRoundMultiplier(ODD_EVEN_SCORING_RULE, 2), 2);

  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const firstRoundCards = [
    card('hearts', '9', 700),
    card('hearts', 'A', 701),
    card('hearts', 'Q', 702),
    card('hearts', '10', 703)
  ];
  const secondRoundCards = [
    card('clubs', '9', 710),
    card('clubs', 'A', 711),
    card('clubs', 'Q', 712),
    card('clubs', '10', 713)
  ];
  room.players.forEach((player, index) => {
    player.addCard(firstRoundCards[index]);
    player.addCard(secondRoundCards[index]);
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = ODD_EVEN_SCORING_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[1].id);

  engine.playCards(room.players[1].id, [firstRoundCards[1].id]);
  engine.playCards(room.players[2].id, [firstRoundCards[2].id]);
  engine.playCards(room.players[3].id, [firstRoundCards[3].id]);
  const oddResult = engine.playCards(room.players[0].id, [firstRoundCards[0].id]);
  assert.equal(oddResult.roundUpdate.scoreInfo.baseRoundPoints, 10);
  assert.equal(oddResult.roundUpdate.scoreInfo.roundPointMultiplier, 0);
  assert.equal(oddResult.roundUpdate.scoreInfo.roundPoints, 0);
  assert.equal(oddResult.roundUpdate.scoreInfo.attackerRoundPointsAwarded, 0);
  assert.equal(room.gameState.attackerScore, 0);
  assert.deepEqual(room.gameState.collectedPointCards, [], '奇数轮分牌不能进入左上角计分区');

  engine.playCards(room.players[1].id, [secondRoundCards[1].id]);
  engine.playCards(room.players[2].id, [secondRoundCards[2].id]);
  engine.playCards(room.players[3].id, [secondRoundCards[3].id]);
  const evenResult = engine.playCards(room.players[0].id, [secondRoundCards[0].id]);
  assert.equal(evenResult.roundUpdate.scoreInfo.baseRoundPoints, 10);
  assert.equal(evenResult.roundUpdate.scoreInfo.roundPointMultiplier, 2);
  assert.equal(evenResult.roundUpdate.scoreInfo.roundPoints, 20);
  assert.equal(evenResult.roundUpdate.scoreInfo.attackerRoundPointsAwarded, 20);
  assert.equal(room.gameState.attackerScore, 20);
  assert.deepEqual(
    room.gameState.collectedPointCards.map(value => value.id),
    [secondRoundCards[3].id],
    '计分区只能放入偶数轮赢得的分牌'
  );
});

test('无独有偶不改变底牌的常规抠底计分', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  room.gameState.selectedRule = ODD_EVEN_SCORING_RULE;
  room.gameState.buryingPlayerId = room.players[0].id;
  room.gameState.bottomCards = [card('hearts', '5', 720)];
  room.gameState.lastRoundWinnerIndex = 1;
  room.gameState.lastRoundLeadingPattern = { type: PatternTypes.SINGLE, length: 1 };

  const result = engine.calculateBottomScore();
  assert.equal(result.bottomPoints, 5);
  assert.equal(result.bottomScoreGained, 10);
});

test('第二战场按德州牌型选出最佳五张，忽略王并支持双副牌五条', () => {
  const straightFlush = evaluateBestPokerHand([
    card('hearts', '2', 800),
    card('hearts', '3', 801),
    card('hearts', '4', 802),
    card('hearts', '5', 803),
    card('hearts', '6', 804),
    card('joker', 'big_joker', 805),
    card('hearts', '6', 806)
  ]);
  const fourOfAKind = evaluateBestPokerHand([
    card('hearts', 'A', 810),
    card('diamonds', 'A', 811),
    card('clubs', 'A', 812),
    card('spades', 'A', 813),
    card('clubs', 'K', 814)
  ]);
  const fiveOfAKind = evaluateBestPokerHand([
    card('hearts', 'A', 815),
    card('hearts', 'A', 816),
    card('diamonds', 'A', 817),
    card('clubs', 'A', 818),
    card('spades', 'A', 819)
  ]);

  assert.equal(straightFlush.categoryName, '同花顺');
  assert.equal(fourOfAKind.categoryName, '四条');
  assert.equal(comparePokerScores(straightFlush.score, fourOfAKind.score), 1);
  assert.equal(fiveOfAKind.categoryName, '五条');
  assert.equal(comparePokerScores(fiveOfAKind.score, straightFlush.score), 1);
});

test('第二战场开局亮五张公共牌，只在轮末四家满5张时开牌，剩余手牌严格少于5张才延至终局', () => {
  assert.equal(SECOND_BATTLEFIELD_RULE.name, '第二战场');
  const room = createRoom();
  const engine = new GameEngine(room, createIo(), () => 0.5);
  room.gameState.selectedRule = SECOND_BATTLEFIELD_RULE;
  room.gameState.buryingPlayerId = room.players[0].id;
  room.gameState.phase = GamePhases.PLAYING;
  const initialCommunity = engine.initializeSecondBattlefield();
  assert.equal(initialCommunity.cards.length, 5, '第一场必须直接公开完整五张公共牌');
  assert.equal(room.gameState.toJSON().secondBattlefield.communityCards.length, 5);

  room.gameState.secondBattlefieldCommunityCards = [
    card('hearts', '2', 820),
    card('hearts', '3', 821),
    card('hearts', '4', 822),
    card('clubs', '9', 823),
    card('diamonds', 'K', 824)
  ];
  room.players.forEach((player, playerIndex) => {
    player.cards = Array.from({ length: 12 }, (_, index) => card('spades', '2', 900 + playerIndex * 20 + index));
  });
  const accumulatedCards = [
    [card('hearts', '5', 830), card('hearts', '6', 831), card('clubs', '7', 832), card('spades', '8', 833), card('diamonds', '10', 834)],
    [card('spades', '5', 840), card('diamonds', '6', 841), card('clubs', '7', 842), card('spades', '8', 843), card('diamonds', '10', 844)],
    [card('clubs', '5', 850), card('spades', '7', 851), card('diamonds', '8', 852), card('clubs', 'J', 853), card('spades', 'Q', 854)],
    [card('diamonds', '5', 860), card('clubs', '6', 861), card('spades', '9', 862), card('diamonds', 'J', 863), card('clubs', 'Q', 864)]
  ];

  for (let roundIndex = 0; roundIndex < 5; roundIndex++) {
    room.gameState.currentRoundPlays = room.players.map((player, playerIndex) => ({
      playerId: player.id,
      originalCards: [accumulatedCards[playerIndex][roundIndex]],
      cards: [accumulatedCards[playerIndex][roundIndex]]
    }));
    const result = engine.applySecondBattlefieldAtRoundEnd();
    if (roundIndex < 4) {
      assert.equal(result.triggered, false, '任一家累计不足5张时不能提前开牌');
      const publicBattlefield = room.gameState.toJSON().secondBattlefield;
      room.players.forEach((player, playerIndex) => {
        assert.deepEqual(
          publicBattlefield.accumulatedCardsByPlayerId[player.id].map(value => value.id),
          accumulatedCards[playerIndex].slice(0, roundIndex + 1).map(value => value.id),
          '尚未参与德州的出牌必须作为牌面公开留在玩家桌前'
        );
      });
    } else {
      assert.equal(result.triggered, true);
      assert.equal(result.triggerRound, 0);
      assert.deepEqual(result.winnerPlayerIds, [room.players[0].id]);
      assert.equal(result.winningCategoryName, '同花顺');
      assert.equal(result.scoreDelta, -5, '庄家阵营胜出应使闲家总分减少5分');
      assert.equal(result.nextCommunityCards.length, 5, '结算后必须立即亮出下一场五张公共牌');
      assert.ok(result.players.every(player => player.accumulatedCards.length === 5));
    }
  }
  assert.equal(room.gameState.secondBattlefieldShowdownCount, 1);
  assert.ok(
    [...room.gameState.secondBattlefieldAccumulatedCardsByPlayerId.values()].every(cards => cards.length === 0),
    '正常开牌后应重新累计'
  );
  assert.ok(
    Object.values(room.gameState.toJSON().secondBattlefield.accumulatedCardsByPlayerId)
      .every(cards => cards.length === 0),
    '已经参与德州的牌必须从公开桌面收走'
  );

  room.players.forEach(player => {
    player.cards = Array(5).fill(null);
  });
  room.gameState.currentRoundPlays = room.players.map((player, playerIndex) => ({
    playerId: player.id,
    originalCards: [
      card('hearts', '7', 870 + playerIndex * 10),
      card('diamonds', '8', 871 + playerIndex * 10),
      card('clubs', '9', 872 + playerIndex * 10),
      card('spades', '10', 873 + playerIndex * 10),
      card('hearts', 'J', 874 + playerIndex * 10)
    ]
  }));
  const exactFiveRemainingResult = engine.applySecondBattlefieldAtRoundEnd();
  assert.equal(exactFiveRemainingResult.triggered, true, '正好剩5张手牌时仍须正常开牌');
  assert.equal(exactFiveRemainingResult.isFinal, false);
  assert.equal(room.gameState.secondBattlefieldFinalStage, false);

  room.players.forEach(player => {
    player.cards = Array(4).fill(null);
  });
  room.gameState.currentRoundPlays = room.players.map((player, playerIndex) => ({
    playerId: player.id,
    originalCards: [
      card('hearts', '2', 920 + playerIndex * 10),
      card('diamonds', '3', 921 + playerIndex * 10),
      card('clubs', '4', 922 + playerIndex * 10),
      card('spades', '5', 923 + playerIndex * 10),
      card('hearts', '6', 924 + playerIndex * 10)
    ]
  }));
  const deferredResult = engine.applySecondBattlefieldAtRoundEnd();
  assert.equal(deferredResult.triggered, false);
  assert.equal(deferredResult.isFinalStage, true, '四家剩余手牌严格少于5张后才延至最终开牌');

  const finalCommunityIds = room.gameState.secondBattlefieldCommunityCards.map(value => value.id);
  room.players.forEach(player => {
    player.cards = [];
  });
  room.gameState.currentRoundPlays = room.players.map((player, playerIndex) => ({
    playerId: player.id,
    originalCards: [card('clubs', String(2 + playerIndex), 880 + playerIndex)]
  }));
  const finalResult = engine.applySecondBattlefieldAtRoundEnd();
  assert.equal(finalResult.triggered, true);
  assert.equal(finalResult.isFinal, true);
  assert.equal(finalResult.showdownNumber, 3);
  assert.deepEqual(
    room.gameState.secondBattlefieldCommunityCards.map(value => value.id),
    finalCommunityIds,
    '最终场结算后不应再发一组无用的公共牌'
  );
});

test('三条明牌规则已注册并保持默认底牌与初始分', () => {
  const cases = [
    [RuleIds.ICEBERG_TIP, '冰山一角'],
    [RuleIds.MUTUAL_VISIBILITY, '互通有无'],
    [RuleIds.OPEN_AND_HONEST, '为人坦荡']
  ];
  for (const [ruleId, name] of cases) {
    assert.equal(getRuleById(ruleId).name, name);
    assert.deepEqual(getRuleSetup({ id: ruleId }), {
      bottomCardsCount: 8,
      attackerStartingScore: 0
    });
  }
});

test('十面埋伏已注册并保持默认底牌与初始分', () => {
  assert.equal(getRuleById(RuleIds.TEN_SIDED_AMBUSH).name, '十面埋伏');
  assert.deepEqual(getRuleSetup({ id: RuleIds.TEN_SIDED_AMBUSH }), {
    bottomCardsCount: 8,
    attackerStartingScore: 0
  });
});

test('三权分立已注册并保持默认底牌与初始分', () => {
  assert.equal(THREE_POWERS_RULE.name, '三权分立');
  assert.deepEqual(getRuleSetup(THREE_POWERS_RULE), {
    bottomCardsCount: 8,
    attackerStartingScore: 0
  });
});

test('君子一言和再衰三竭已注册并保持默认牌局配置', () => {
  for (const [rule, name] of [
    [GENTLEMAN_PROMISE_RULE, '君子一言'],
    [REPEATED_EXHAUSTION_RULE, '再衰三竭']
  ]) {
    assert.equal(rule.name, name);
    assert.deepEqual(getRuleSetup(rule), {
      bottomCardsCount: 8,
      attackerStartingScore: 0
    });
  }
});

test('焦点人物已注册并保持默认底牌与初始分', () => {
  assert.equal(FOCUS_FIGURE_RULE.name, '焦点人物');
  assert.deepEqual(getRuleSetup(FOCUS_FIGURE_RULE), {
    bottomCardsCount: 8,
    attackerStartingScore: 0
  });
});

test('冷却时间与时间冷却已注册并保持默认底牌与初始分', () => {
  for (const [rule, name] of [
    [COOLDOWN_TIME_RULE, '冷却时间'],
    [TIME_COOLING_RULE, '时间冷却']
  ]) {
    assert.equal(rule.name, name);
    assert.deepEqual(getRuleSetup(rule), {
      bottomCardsCount: 8,
      attackerStartingScore: 0
    });
  }
});

test('李代桃僵以通用主动技能元数据注册', () => {
  assert.equal(SUBSTITUTE_SACRIFICE_RULE.name, '李代桃僵');
  assert.deepEqual(SUBSTITUTE_SACRIFICE_RULE.activeSkill, {
    id: ActiveSkillIds.SUBSTITUTE_SACRIFICE,
    name: '李代桃僵',
    usageLimit: 1,
    timing: 'following_play',
    effect: 'free_discard_treated_small'
  });
});

test('势如破竹和单步调试已注册并保持默认底牌与初始分', () => {
  const cases = [
    [RuleIds.IRRESISTIBLE_FORCE, '势如破竹'],
    [RuleIds.SINGLE_STEP_DEBUG, '单步调试']
  ];
  for (const [ruleId, name] of cases) {
    assert.equal(getRuleById(ruleId).name, name);
    assert.deepEqual(getRuleSetup({ id: ruleId }), {
      bottomCardsCount: 8,
      attackerStartingScore: 0
    });
  }
});

test('改革开放已注册，使用八张底牌且闲家以40分开局', () => {
  assert.equal(getRuleById(RuleIds.REFORM_AND_OPENING_UP).name, '改革开放');
  assert.deepEqual(getRuleSetup({ id: RuleIds.REFORM_AND_OPENING_UP }), {
    bottomCardsCount: 8,
    attackerStartingScore: 40
  });
});

test('六六大顺和太极四象已注册并使用默认牌局配置', () => {
  const cases = [
    [RuleIds.SIX_SIX_GREAT_SUCCESS, '六六大顺'],
    [RuleIds.TAI_CHI_FOUR_SYMBOLS, '太极四象']
  ];
  for (const [ruleId, name] of cases) {
    assert.equal(getRuleById(ruleId).name, name);
    assert.deepEqual(getRuleSetup({ id: ruleId }), {
      bottomCardsCount: 8,
      attackerStartingScore: 0
    });
  }
});

test('一马当先和迷雾重重已注册并使用默认牌局配置', () => {
  const cases = [
    [RuleIds.ONE_HORSE_LEADS, '一马当先'],
    [RuleIds.HEAVY_FOG, '迷雾重重']
  ];
  for (const [ruleId, name] of cases) {
    assert.equal(getRuleById(ruleId).name, name);
    assert.deepEqual(getRuleSetup({ id: ruleId }), {
      bottomCardsCount: 8,
      attackerStartingScore: 0
    });
  }
});

test('路线摇摆、一带一路和昼夜轮转已注册，昼夜轮转以20分开局', () => {
  assert.deepEqual(getRuleSetup(ROUTE_SWING_RULE), {
    bottomCardsCount: 8,
    attackerStartingScore: 0
  });
  assert.deepEqual(getRuleSetup(BELT_AND_ROAD_RULE), {
    bottomCardsCount: 8,
    attackerStartingScore: 0
  });
  assert.deepEqual(BELT_AND_ROAD_RULE.activeSkill, {
    id: ActiveSkillIds.BELT_AND_ROAD,
    name: '一带一路',
    usageLimit: 1,
    timing: 'leading_play',
    effect: 'belt_and_road_lead'
  });
  assert.deepEqual(getRuleSetup(DAY_NIGHT_ROTATION_RULE), {
    bottomCardsCount: 8,
    attackerStartingScore: 20
  });
});

test('尊老爱幼已注册并使用默认牌局配置', () => {
  assert.equal(RESPECT_ELDERS_AND_CHILDREN_RULE.name, '尊老爱幼');
  assert.deepEqual(getRuleSetup(RESPECT_ELDERS_AND_CHILDREN_RULE), {
    bottomCardsCount: 8,
    attackerStartingScore: 0
  });
});

test('尊老爱幼按异花色、牌型、点数与后出顺序判定最小牌', () => {
  const trumpSuit = 'spades';
  const makePlay = (cards, playerIndex, trumpRank = '2') => ({
    cards,
    playerIndex,
    pattern: detectPattern(cards, trumpSuit, trumpRank, RESPECT_ELDERS_AND_CHILDREN_RULE)
  });
  const makeThrowPlay = (cards, playerIndex, trumpRank = '6') => {
    const parsed = parseThrowCombination(
      cards,
      trumpSuit,
      trumpRank,
      RESPECT_ELDERS_AND_CHILDREN_RULE
    );
    return {
      cards,
      playerIndex,
      pattern: {
        type: PatternTypes.THROW,
        suit: parsed.suit,
        components: parsed.components,
        length: cards.length,
        strength: Math.max(...parsed.components.map(component => component.strength))
      }
    };
  };
  const makeFollowingThrowPlay = (
    cards,
    playerIndex,
    leadingPlay,
    trumpRank = '7'
  ) => {
    const validation = validateFollowingPlay(
      cards,
      cards,
      leadingPlay.pattern,
      trumpSuit,
      trumpRank,
      RESPECT_ELDERS_AND_CHILDREN_RULE
    );
    assert.equal(validation.valid, true, validation.message);
    return {
      cards,
      playerIndex,
      pattern: validation.pattern
    };
  };
  const find = (plays, trumpRank = '2') => findSmallestPlayForRespectElders(
    plays,
    trumpSuit,
    trumpRank,
    RESPECT_ELDERS_AND_CHILDREN_RULE
  ).playerIndex;

  const differentSuitBeatsLeadingMismatch = [
    makePlay([card('hearts', '10', 0), card('hearts', '10', 1)], 0),
    makePlay([card('hearts', '3', 0), card('hearts', '4', 0)], 1),
    makePlay([card('diamonds', '3', 0), card('diamonds', '3', 1)], 2),
    makePlay([card('spades', '5', 0), card('spades', '5', 1)], 3)
  ];
  assert.equal(find(differentSuitBeatsLeadingMismatch), 2, '异花色的方块对3最小');

  const invalidTrumpHasNoPrivilege = [
    makePlay([card('hearts', '10', 2), card('hearts', '10', 3)], 0),
    makePlay([card('spades', '3', 2), card('spades', '4', 2)], 1),
    makePlay([card('diamonds', '3', 2), card('diamonds', '3', 3)], 2),
    makePlay([card('hearts', '9', 2), card('hearts', '9', 3)], 3)
  ];
  assert.equal(find(invalidTrumpHasNoPrivilege), 2, '无法毙牌的主3+4只按自然点数比较');

  const partialLeadingSuitIsLargerThanPureDiscard = [
    makePlay([card('hearts', 'A', 30), card('hearts', 'A', 31)], 0, '7'),
    makePlay([card('hearts', '9', 30), card('clubs', '2', 30)], 1, '7'),
    makePlay([card('diamonds', '6', 30), card('diamonds', '6', 31)], 2, '7'),
    makePlay([card('hearts', 'K', 30), card('hearts', 'Q', 30)], 3, '7')
  ];
  assert.equal(
    find(partialLeadingSuitIsLargerThanPureDiscard, '7'),
    2,
    '红桃9加梅花2含一张首家花色，因此纯异花色的方块对6更小'
  );

  const partialLeadingSuitBeatsRawRankCounterexample = [
    makePlay([card('hearts', 'A', 32), card('hearts', 'A', 33)], 0, '7'),
    makePlay([card('hearts', '3', 32), card('clubs', '2', 32)], 1, '7'),
    makePlay([card('diamonds', '6', 32), card('diamonds', '6', 33)], 2, '7'),
    makePlay([card('hearts', 'K', 32), card('hearts', 'Q', 32)], 3, '7')
  ];
  assert.equal(
    find(partialLeadingSuitBeatsRawRankCounterexample, '7'),
    2,
    '即使混合垫牌的自然点数更低，纯异花色仍优先判小'
  );

  const leadingFourCardThrow = makeThrowPlay([
    card('hearts', 'A', 40),
    card('hearts', 'K', 40),
    card('hearts', 'Q', 40),
    card('hearts', 'J', 40)
  ], 0, '7');
  const throwFollowersWithDifferentSuitCounts = [
    leadingFourCardThrow,
    makeFollowingThrowPlay([
      card('hearts', '3', 40),
      card('clubs', '2', 40),
      card('clubs', '4', 40),
      card('clubs', '5', 40)
    ], 1, leadingFourCardThrow),
    makeFollowingThrowPlay([
      card('diamonds', '10', 40),
      card('diamonds', 'J', 40),
      card('diamonds', 'Q', 40),
      card('diamonds', 'K', 40)
    ], 2, leadingFourCardThrow),
    makeFollowingThrowPlay([
      card('hearts', '4', 40),
      card('hearts', '5', 40),
      card('clubs', '8', 40),
      card('clubs', '9', 40)
    ], 3, leadingFourCardThrow)
  ];
  assert.equal(
    find(throwFollowersWithDifferentSuitCounts, '7'),
    2,
    '跟四张甩牌时，四张均为异花色者最小，即使其自然点数最高'
  );

  const throwFollowersWithEqualSuitCounts = [
    leadingFourCardThrow,
    makeFollowingThrowPlay([
      card('hearts', '9', 41),
      card('clubs', '2', 41),
      card('clubs', '3', 41),
      card('clubs', '4', 41)
    ], 1, leadingFourCardThrow),
    makeFollowingThrowPlay([
      card('hearts', '8', 41),
      card('diamonds', '2', 41),
      card('diamonds', '3', 41),
      card('diamonds', '4', 41)
    ], 2, leadingFourCardThrow),
    makeFollowingThrowPlay([
      card('hearts', '5', 41),
      card('hearts', '6', 41),
      card('clubs', '2', 42),
      card('clubs', '3', 42)
    ], 3, leadingFourCardThrow)
  ];
  assert.equal(
    find(throwFollowersWithEqualSuitCounts, '7'),
    2,
    '异花色张数相同时才继续比较整手点数'
  );

  const offSuitSingles = [
    makePlay([card('hearts', 'A', 4)], 0, '6'),
    makePlay([card('diamonds', 'K', 4)], 1, '6'),
    makePlay([card('clubs', '2', 4)], 2, '6'),
    makePlay([card('diamonds', '5', 4)], 3, '6')
  ];
  assert.equal(find(offSuitSingles, '6'), 2, '异花色单牌中2最小');

  const throwAndTrump = [
    makeThrowPlay([card('hearts', 'A', 5), card('hearts', 'K', 5)], 0),
    makeThrowPlay([card('hearts', 'Q', 5), card('hearts', 'J', 5)], 1),
    makePlay([card('diamonds', '2', 5), card('diamonds', '2', 6)], 2, '6'),
    makeThrowPlay([card('spades', '3', 5), card('spades', '4', 5)], 3)
  ];
  assert.equal(find(throwAndTrump, '6'), 2, '异花色对2比同花色和有效毙牌都小');

  const laterEqualPlayIsSmaller = [
    makePlay([card('hearts', '10', 7), card('hearts', '10', 8)], 0),
    makePlay([card('hearts', '5', 7), card('hearts', '5', 8)], 1),
    makePlay([card('hearts', '5', 9), card('hearts', '5', 10)], 2),
    makePlay([card('hearts', '6', 7), card('hearts', '6', 8)], 3)
  ];
  assert.equal(find(laterEqualPlayIsSmaller), 2, '同点数时后出的红桃5更小');
});

test('尊老爱幼不改变本轮获胜与计分，只把下轮首发权交给最小牌', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const trickCards = [
    card('hearts', 'A', 20),
    card('hearts', 'K', 20),
    card('clubs', '3', 20),
    card('diamonds', '5', 20)
  ];
  room.players.forEach((player, index) => {
    player.addCard(trickCards[index]);
    player.addCard(card('clubs', String(index + 7), index + 30));
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = RESPECT_ELDERS_AND_CHILDREN_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  engine.playCards(room.players[0].id, [trickCards[0].id]);
  engine.playCards(room.players[1].id, [trickCards[1].id]);
  engine.playCards(room.players[2].id, [trickCards[2].id]);
  const result = engine.playCards(room.players[3].id, [trickCards[3].id]);

  assert.equal(result.roundUpdate.roundWinner.playerIndex, 0, '红桃A仍是本轮获胜牌');
  assert.equal(result.roundUpdate.smallestPlayer.playerIndex, 2, '异花色的草花3是本轮最小牌');
  assert.equal(result.roundUpdate.nextRoundLeader.playerIndex, 2);
  assert.equal(room.gameState.currentPlayerIndex, 2);
  assert.equal(room.gameState.roundStartPlayerIndex, 2);
  assert.equal(room.gameState.lastRoundWinnerIndex, 0, '最后一轮真正胜者记录不得被改写');
});

test('尊老爱幼与力争上游把同花色的牌型不完整程度纳入全序', () => {
  const trumpSuit = 'spades';
  const trumpRank = '2';
  const makePlay = (cards, playerIndex) => ({
    cards,
    playerIndex,
    pattern: detectPattern(cards, trumpSuit, trumpRank, STRIVE_UPSTREAM_RULE)
  });
  const leadingTractor = makePlay([
    card('hearts', '5', 60),
    card('hearts', '5', 61),
    card('hearts', '6', 60),
    card('hearts', '6', 61)
  ], 0);
  assert.equal(leadingTractor.pattern.type, PatternTypes.TRACTOR);

  const twoLoosePairs = makePlay([
    card('hearts', '3', 60),
    card('hearts', '3', 61),
    card('hearts', '8', 60),
    card('hearts', '8', 61)
  ], 1);
  const onePairAndSingles = makePlay([
    card('hearts', '4', 60),
    card('hearts', '4', 61),
    card('hearts', '9', 60),
    card('hearts', '10', 60)
  ], 2);
  const fourSingles = makePlay([
    card('hearts', 'J', 60),
    card('hearts', 'Q', 60),
    card('hearts', 'K', 60),
    card('hearts', 'A', 60)
  ], 3);

  const ranked = rankRoundPlaysByRespectOrder(
    [leadingTractor, fourSingles, onePairAndSingles, twoLoosePairs],
    trumpSuit,
    trumpRank,
    STRIVE_UPSTREAM_RULE
  );
  assert.deepEqual(
    ranked.map(play => play.playerIndex),
    [0, 1, 2, 3],
    '同首花色的牌型不完整时，散对越多越大，不能被单牌点数反超'
  );
});

test('力争上游把上轮四手牌由大到小设为下轮完整出牌顺序', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const firstTrick = [
    card('hearts', '10', 70),
    card('hearts', 'A', 70),
    card('hearts', '3', 70),
    card('hearts', '3', 71)
  ];
  const secondTrick = [
    card('clubs', '6', 70),
    card('clubs', '5', 70),
    card('clubs', '7', 70),
    card('clubs', '8', 70)
  ];
  room.players.forEach((player, index) => {
    player.addCard(firstTrick[index]);
    player.addCard(secondTrick[index]);
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = STRIVE_UPSTREAM_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  engine.playCards(room.players[0].id, [firstTrick[0].id]);
  engine.playCards(room.players[1].id, [firstTrick[1].id]);
  engine.playCards(room.players[2].id, [firstTrick[2].id]);
  const firstResult = engine.playCards(room.players[3].id, [firstTrick[3].id]);

  assert.deepEqual(room.gameState.striveUpstreamPlayOrder, [1, 0, 2, 3]);
  assert.deepEqual(firstResult.roundUpdate.striveUpstreamOrder.playerIndexes, [1, 0, 2, 3]);
  assert.equal(
    firstResult.currentWinningPlayerId,
    room.players[1].id,
    '桌面“大”应跟随力争上游第一名，也就是实际取得下轮牌权的玩家'
  );
  assert.equal(room.gameState.currentPlayerIndex, 1, '上轮最大的玩家1先出');

  engine.playCards(room.players[1].id, [secondTrick[1].id]);
  assert.equal(room.gameState.currentPlayerIndex, 0, '玩家1之后应轮到上轮第二大的玩家0');
  engine.playCards(room.players[0].id, [secondTrick[0].id]);
  assert.equal(room.gameState.currentPlayerIndex, 2);
  engine.playCards(room.players[2].id, [secondTrick[2].id]);
  assert.equal(room.gameState.currentPlayerIndex, 3);
});

test('路线摇摆只在出现单张10分牌的整轮结束后翻转下一轮方向', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const firstTrick = [
    card('hearts', 'A', 10),
    card('hearts', 'Q', 11),
    card('hearts', 'J', 12),
    card('hearts', '10', 13)
  ];
  const secondTrick = [
    card('clubs', 'A', 20),
    card('clubs', '6', 21),
    card('clubs', '5', 22),
    card('clubs', '5', 23)
  ];
  room.players.forEach((player, index) => {
    player.addCard(firstTrick[index]);
    player.addCard(secondTrick[index]);
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = ROUTE_SWING_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  assert.equal(room.gameState.turnDirection, TurnOrders.COUNTER_CLOCKWISE);
  let result;
  for (const playerIndex of [0, 1, 2, 3]) {
    result = engine.playCards(room.players[playerIndex].id, [firstTrick[playerIndex].id]);
  }
  assert.deepEqual(result.roundUpdate.turnDirectionChange, {
    previousDirection: TurnOrders.COUNTER_CLOCKWISE,
    nextDirection: TurnOrders.CLOCKWISE,
    triggerRound: 1
  });
  assert.equal(room.gameState.turnDirection, TurnOrders.CLOCKWISE);
  assert.equal(room.gameState.currentPlayerIndex, 0);

  engine.playCards(room.players[0].id, [secondTrick[0].id]);
  assert.equal(room.gameState.currentPlayerIndex, 3);
  for (const playerIndex of [3, 2]) {
    engine.playCards(room.players[playerIndex].id, [secondTrick[playerIndex].id]);
  }
  result = engine.playCards(room.players[1].id, [secondTrick[1].id]);
  // 本轮两张5合计10分，但没有任何单张10分牌，因此不会再次翻转。
  assert.equal(result.roundUpdate.turnDirectionChange, null);
  assert.equal(room.gameState.turnDirection, TurnOrders.CLOCKWISE);
});

test('一带一路未发动时仍按普通甩牌，发动后小甩牌无需牌面必大', () => {
  const trumpSuit = 'spades';
  const trumpRank = '2';
  const lower = [card('hearts', 'A', 30), card('hearts', '5', 31)];
  const higher = [card('hearts', 'A', 32), card('hearts', '6', 33)];
  const activeBeltAndRoadRule = {
    ...BELT_AND_ROAD_RULE,
    beltAndRoadSkillActive: true
  };
  const lowerPattern = detectPattern(lower, trumpSuit, trumpRank, activeBeltAndRoadRule);
  const higherPattern = detectPattern(higher, trumpSuit, trumpRank, activeBeltAndRoadRule);
  assert.equal(lowerPattern.type, PatternTypes.BELT_AND_ROAD);
  assert.equal(higherPattern.type, PatternTypes.BELT_AND_ROAD);
  assert.equal(compareCards(
    { cards: higher, pattern: higherPattern },
    { cards: lower, pattern: lowerPattern },
    'hearts',
    trumpSuit,
    trumpRank,
    BELT_AND_ROAD_RULE
  ), 1);
  assert.equal(
    detectPattern(lower, trumpSuit, trumpRank, BELT_AND_ROAD_RULE).type,
    PatternTypes.INVALID
  );

  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const plays = [
    [card('hearts', 'K', 40), card('hearts', '3', 41)],
    [card('hearts', 'A', 42), card('hearts', 'Q', 43)],
    [card('hearts', 'J', 44), card('hearts', '9', 45)],
    [card('hearts', '8', 46), card('hearts', '7', 47)]
  ];
  room.players.forEach((player, index) => plays[index].forEach(value => player.addCard(value)));
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = BELT_AND_ROAD_RULE;
  room.gameState.trumpSuit = trumpSuit;
  room.gameState.trumpRank = trumpRank;
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  const ordinaryThrowResult = engine.playCards(
    room.players[0].id,
    plays[0].map(value => value.id)
  );
  assert.ok(ordinaryThrowResult.throwFailed);
  assert.equal(ordinaryThrowResult.playedCards.length, 1);
  assert.equal(engine.hasUsedActiveSkill(room.players[0].id, ActiveSkillIds.BELT_AND_ROAD), false);
  engine.undoLastPlay(room.players[0].id);

  let leadResult = engine.playCards(
    room.players[0].id,
    plays[0].map(value => value.id),
    null,
    ActiveSkillIds.BELT_AND_ROAD
  );
  assert.equal(leadResult.throwFailed, null);
  assert.equal(leadResult.activeSkillActivation.id, ActiveSkillIds.BELT_AND_ROAD);
  assert.equal(room.gameState.leadingPattern.type, PatternTypes.BELT_AND_ROAD);
  assert.equal(engine.hasUsedActiveSkill(room.players[0].id, ActiveSkillIds.BELT_AND_ROAD), true);

  const undoResult = engine.undoLastPlay(room.players[0].id);
  assert.equal(undoResult.restoredActiveSkillId, ActiveSkillIds.BELT_AND_ROAD);
  assert.equal(engine.hasUsedActiveSkill(room.players[0].id, ActiveSkillIds.BELT_AND_ROAD), false);
  leadResult = engine.playCards(
    room.players[0].id,
    plays[0].map(value => value.id),
    null,
    ActiveSkillIds.BELT_AND_ROAD
  );
  assert.equal(leadResult.activeSkillActivation.id, ActiveSkillIds.BELT_AND_ROAD);
  engine.playCards(room.players[1].id, plays[1].map(value => value.id));
  assert.equal(engine.hasUsedActiveSkill(room.players[1].id, ActiveSkillIds.BELT_AND_ROAD), false);

  const blockedRoom = createRoom();
  const blockedEngine = new GameEngine(blockedRoom, createIo());
  const blockedCards = [card('clubs', '9', 50), card('clubs', '4', 51)];
  blockedCards.forEach(value => blockedRoom.players[0].addCard(value));
  blockedRoom.gameState.phase = GamePhases.PLAYING;
  blockedRoom.gameState.selectedRule = BELT_AND_ROAD_RULE;
  blockedRoom.gameState.trumpSuit = trumpSuit;
  blockedRoom.gameState.trumpRank = trumpRank;
  blockedEngine.recordActiveSkillUse(blockedRoom.players[0].id, ActiveSkillIds.BELT_AND_ROAD);
  blockedEngine.setFirstPlayer(blockedRoom.players[0].id);
  assert.throws(
    () => blockedEngine.playCards(
      blockedRoom.players[0].id,
      blockedCards.map(value => value.id),
      null,
      ActiveSkillIds.BELT_AND_ROAD
    ),
    /每名玩家每局只能发动一次/
  );

  const successfulThrowRoom = createRoom();
  const successfulThrowEngine = new GameEngine(successfulThrowRoom, createIo());
  const successfulThrowPlays = [
    [card('diamonds', 'A', 60), card('diamonds', 'K', 61)],
    [card('diamonds', 'Q', 62), card('diamonds', 'J', 63)],
    [card('diamonds', '10', 64), card('diamonds', '9', 65)],
    [card('diamonds', '8', 66), card('diamonds', '7', 67)]
  ];
  successfulThrowRoom.players.forEach((player, index) => {
    successfulThrowPlays[index].forEach(value => player.addCard(value));
  });
  successfulThrowRoom.gameState.phase = GamePhases.PLAYING;
  successfulThrowRoom.gameState.selectedRule = BELT_AND_ROAD_RULE;
  successfulThrowRoom.gameState.trumpSuit = trumpSuit;
  successfulThrowRoom.gameState.trumpRank = trumpRank;
  successfulThrowRoom.gameState.buryingPlayerId = successfulThrowRoom.players[0].id;
  successfulThrowEngine.setFirstPlayer(successfulThrowRoom.players[0].id);
  const successfulThrow = successfulThrowEngine.playCards(
    successfulThrowRoom.players[0].id,
    successfulThrowPlays[0].map(value => value.id)
  );
  assert.equal(successfulThrow.throwFailed, null);
  assert.equal(successfulThrowRoom.gameState.leadingPattern.type, PatternTypes.THROW);
  assert.equal(
    successfulThrowEngine.hasUsedActiveSkill(
      successfulThrowRoom.players[0].id,
      ActiveSkillIds.BELT_AND_ROAD
    ),
    false
  );
});

test('昼夜轮转从第1轮的2开始，只提升目标点数并在目标为级牌时跳过', () => {
  const trumpSuit = 'spades';
  const trumpRank = '3';
  const roundOneRule = { ...DAY_NIGHT_ROTATION_RULE, currentRound: 1 };
  const roundTwoRule = { ...DAY_NIGHT_ROTATION_RULE, currentRound: 2 };
  const two = card('hearts', '2', 60);
  const ace = card('hearts', 'A', 61);
  const level = card('hearts', '3', 62);

  assert.ok(getCardStrength(two, trumpSuit, trumpRank, roundOneRule) >
    getCardStrength(ace, trumpSuit, trumpRank, roundOneRule));
  assert.ok(getCardStrength(level, trumpSuit, trumpRank, roundOneRule) >
    getCardStrength(two, trumpSuit, trumpRank, roundOneRule));
  assert.ok(getCardStrength(ace, trumpSuit, trumpRank, roundTwoRule) >
    getCardStrength(two, trumpSuit, trumpRank, roundTwoRule));
  assert.equal(getDayNightHighestRank(1, trumpRank), '2');
  assert.equal(getDayNightHighestRank(2, trumpRank), 'A');

  const topTractor = [
    card('hearts', 'A', 63), card('hearts', 'A', 64),
    card('hearts', '2', 65), card('hearts', '2', 66)
  ];
  assert.equal(
    detectPattern(topTractor, trumpSuit, trumpRank, roundOneRule).type,
    PatternTypes.TRACTOR
  );

  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const trickCards = [
    card('hearts', 'A', 70),
    card('hearts', '2', 71),
    card('hearts', 'K', 72),
    card('hearts', 'Q', 73)
  ];
  room.players.forEach((player, index) => {
    player.addCard(trickCards[index]);
    player.addCard(card('clubs', String(4 + index), 80 + index));
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = DAY_NIGHT_ROTATION_RULE;
  room.gameState.trumpSuit = trumpSuit;
  room.gameState.trumpRank = trumpRank;
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);
  engine.playCards(room.players[0].id, [trickCards[0].id]);
  engine.playCards(room.players[1].id, [trickCards[1].id]);
  assert.equal(room.gameState.currentWinnerIndex, 1);
  engine.playCards(room.players[2].id, [trickCards[2].id]);
  engine.playCards(room.players[3].id, [trickCards[3].id]);
  assert.equal(room.gameState.lastRoundWinnerIndex, 1);
  assert.equal(room.gameState.toJSON().dayNightHighestRank, 'A');
});

test('六六大顺识别六张起步的同花顺，副牌序列跳过级牌', () => {
  const acrossLevel = ['3', '4', '5', '6', '8', '9']
    .map((rank, index) => card('hearts', rank, index));
  const fiveCards = acrossLevel.slice(0, 5);
  const withGap = ['3', '4', '5', '6', '9', '10']
    .map((rank, index) => card('hearts', rank, index + 10));
  const withDuplicateRank = [
    card('hearts', '3', 20),
    card('hearts', '4', 20),
    card('hearts', '5', 20),
    card('hearts', '6', 20),
    card('hearts', '8', 20),
    card('hearts', '8', 21)
  ];

  const pattern = detectPattern(
    acrossLevel,
    'spades',
    '7',
    SIX_SIX_GREAT_SUCCESS_RULE
  );
  assert.equal(pattern.type, PatternTypes.STRAIGHT_FLUSH);
  assert.equal(pattern.suit, 'hearts');
  assert.equal(pattern.length, 6);
  assert.equal(
    detectPattern(acrossLevel, 'spades', '7', NORMAL_RULE).type,
    PatternTypes.INVALID
  );
  assert.equal(
    detectPattern(fiveCards, 'spades', '7', SIX_SIX_GREAT_SUCCESS_RULE).type,
    PatternTypes.INVALID
  );
  assert.equal(
    detectPattern(withGap, 'spades', '7', SIX_SIX_GREAT_SUCCESS_RULE).type,
    PatternTypes.INVALID
  );
  assert.equal(
    detectPattern(withDuplicateRank, 'spades', '7', SIX_SIX_GREAT_SUCCESS_RULE).type,
    PatternTypes.INVALID
  );
});

test('六六大顺的主同花顺可从普通主牌连续到级牌和大小王', () => {
  const trumpStraight = [
    card('spades', 'Q'),
    card('spades', 'K'),
    card('spades', 'A'),
    card('hearts', '7'),
    card('spades', '7'),
    card('joker', 'small_joker'),
    card('joker', 'big_joker')
  ];

  const pattern = detectPattern(
    trumpStraight,
    'spades',
    '7',
    SIX_SIX_GREAT_SUCCESS_RULE
  );
  assert.equal(pattern.type, PatternTypes.STRAIGHT_FLUSH);
  assert.equal(pattern.suit, 'trump');
  assert.equal(pattern.length, 7);
  assert.deepEqual(pattern.strengths, [994, 995, 996, 997, 998, 999, 1000]);
});

test('六六大顺按同花顺高张比较，主同花顺可毙副同花顺', () => {
  const lowCards = ['2', '3', '4', '5', '6', '7']
    .map((rank, index) => card('hearts', rank, index));
  const highCards = ['3', '4', '5', '6', '7', '8']
    .map((rank, index) => card('hearts', rank, index + 10));
  const trumpCards = ['2', '3', '4', '5', '6', '7']
    .map((rank, index) => card('spades', rank, index + 20));
  const play = cards => ({
    cards,
    pattern: detectPattern(cards, 'spades', 'A', SIX_SIX_GREAT_SUCCESS_RULE)
  });

  assert.equal(
    compareCards(
      play(highCards),
      play(lowCards),
      'hearts',
      'spades',
      'A',
      SIX_SIX_GREAT_SUCCESS_RULE
    ),
    1
  );
  assert.equal(
    compareCards(
      play(trumpCards),
      play(lowCards),
      'hearts',
      'spades',
      'A',
      SIX_SIX_GREAT_SUCCESS_RULE
    ),
    1
  );
});

test('跟六六大顺时有同花顺必须跟同花顺，无首花色时可用主同花顺毙牌', () => {
  const leadingCards = ['2', '3', '4', '5', '6', '7']
    .map((rank, index) => card('hearts', rank, index));
  const leadingPattern = detectPattern(
    leadingCards,
    'spades',
    'A',
    SIX_SIX_GREAT_SUCCESS_RULE
  );
  const sameSuitHand = [
    ...['3', '4', '5', '6', '7', '8']
      .map((rank, index) => card('hearts', rank, index + 10)),
    card('hearts', '10', 30)
  ];
  const brokenStraight = [
    ...sameSuitHand.slice(0, 5),
    sameSuitHand[6]
  ];
  assert.equal(
    validateFollowingPlay(
      brokenStraight,
      sameSuitHand,
      leadingPattern,
      'spades',
      'A',
      SIX_SIX_GREAT_SUCCESS_RULE
    ).valid,
    false
  );
  assert.equal(
    validateFollowingPlay(
      sameSuitHand.slice(0, 6),
      sameSuitHand,
      leadingPattern,
      'spades',
      'A',
      SIX_SIX_GREAT_SUCCESS_RULE
    ).valid,
    true
  );

  const trumpStraight = ['2', '3', '4', '5', '6', '7']
    .map((rank, index) => card('spades', rank, index + 40));
  const trumpResponse = validateFollowingPlay(
    trumpStraight,
    trumpStraight,
    leadingPattern,
    'spades',
    'A',
    SIX_SIX_GREAT_SUCCESS_RULE
  );
  assert.equal(trumpResponse.valid, true);
  assert.equal(
    compareCards(
      { cards: trumpStraight, pattern: trumpResponse.pattern },
      { cards: leadingCards, pattern: leadingPattern },
      leadingPattern.suit,
      'spades',
      'A',
      SIX_SIX_GREAT_SUCCESS_RULE
    ),
    1
  );
});

test('六六大顺在牌局中作为完整牌型出牌，不会进入甩牌失败流程', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const player = room.players[0];
  const straight = ['2', '3', '4', '5', '6', '7']
    .map((rank, index) => card('hearts', rank, index));
  [...straight, card('clubs', '9')].forEach(value => player.addCard(value));
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = 'A';
  room.gameState.selectedRule = SIX_SIX_GREAT_SUCCESS_RULE;
  engine.setFirstPlayer(player.id);

  const result = engine.playCards(player.id, straight.map(value => value.id));

  assert.equal(result.throwFailed, null);
  assert.equal(room.gameState.currentRoundPlays[0].pattern.type, PatternTypes.STRAIGHT_FLUSH);
  assert.equal(room.gameState.currentRoundPlays[0].cards.length, 6);
  assert.equal(player.cards.length, 1);
});

test('太极四象要求四种普通花色同点数，且大小只按点数比较', () => {
  const taiChiNines = ['hearts', 'diamonds', 'clubs', 'spades']
    .map((suit, index) => card(suit, '9', index));
  const taiChiJacks = ['hearts', 'diamonds', 'clubs', 'spades']
    .map((suit, index) => card(suit, 'J', index + 10));
  const duplicatedSuit = [
    card('hearts', '9', 20),
    card('hearts', '9', 21),
    card('clubs', '9', 20),
    card('spades', '9', 20)
  ];

  const ninesPattern = detectPattern(
    taiChiNines,
    'spades',
    '9',
    TAI_CHI_FOUR_SYMBOLS_RULE
  );
  const jacksPattern = detectPattern(
    taiChiJacks,
    'spades',
    '9',
    TAI_CHI_FOUR_SYMBOLS_RULE
  );
  assert.equal(ninesPattern.type, PatternTypes.TAI_CHI_FOUR_SYMBOLS);
  assert.equal(ninesPattern.suit, 'tai_chi');
  assert.equal(ninesPattern.strength, 9);
  assert.equal(
    detectPattern(taiChiNines, 'spades', '9', NORMAL_RULE).type,
    PatternTypes.INVALID
  );
  assert.equal(
    detectPattern(duplicatedSuit, 'spades', '9', TAI_CHI_FOUR_SYMBOLS_RULE).type,
    PatternTypes.INVALID
  );
  assert.equal(
    compareCards(
      { cards: taiChiJacks, pattern: jacksPattern },
      { cards: taiChiNines, pattern: ninesPattern },
      'tai_chi',
      'spades',
      '9',
      TAI_CHI_FOUR_SYMBOLS_RULE
    ),
    1
  );
});

test('跟太极四象时有四象必须跟四象；全手主牌时可用任意四张主牌毙之', () => {
  const leadingCards = ['hearts', 'diamonds', 'clubs', 'spades']
    .map((suit, index) => card(suit, '9', index));
  const leadingPattern = detectPattern(
    leadingCards,
    'spades',
    '2',
    TAI_CHI_FOUR_SYMBOLS_RULE
  );
  const followerTaiChi = ['hearts', 'diamonds', 'clubs', 'spades']
    .map((suit, index) => card(suit, 'Q', index + 10));
  const followerHand = [...followerTaiChi, card('hearts', '3', 30)];
  assert.equal(
    validateFollowingPlay(
      followerHand.slice(1, 5),
      followerHand,
      leadingPattern,
      'spades',
      '2',
      TAI_CHI_FOUR_SYMBOLS_RULE
    ).valid,
    false
  );
  assert.equal(
    validateFollowingPlay(
      followerTaiChi,
      followerHand,
      leadingPattern,
      'spades',
      '2',
      TAI_CHI_FOUR_SYMBOLS_RULE
    ).valid,
    true
  );

  const fourTrumpCards = ['3', '4', '5', '6']
    .map((rank, index) => card('spades', rank, index + 40));
  const allTrumpHand = [...fourTrumpCards, card('joker', 'small_joker', 50)];
  const trumpResponse = validateFollowingPlay(
    fourTrumpCards,
    allTrumpHand,
    leadingPattern,
    'spades',
    '2',
    TAI_CHI_FOUR_SYMBOLS_RULE
  );
  assert.equal(trumpResponse.valid, true);
  assert.equal(trumpResponse.pattern.canTrumpTaiChi, true);
  assert.equal(
    compareCards(
      { cards: fourTrumpCards, pattern: trumpResponse.pattern },
      { cards: leadingCards, pattern: leadingPattern },
      'tai_chi',
      'spades',
      '2',
      TAI_CHI_FOUR_SYMBOLS_RULE
    ),
    1
  );

  const handWithSideCard = [...fourTrumpCards, card('hearts', '8', 60)];
  const ordinaryDiscard = validateFollowingPlay(
    fourTrumpCards,
    handWithSideCard,
    leadingPattern,
    'spades',
    '2',
    TAI_CHI_FOUR_SYMBOLS_RULE
  );
  assert.equal(ordinaryDiscard.valid, true);
  assert.notEqual(ordinaryDiscard.pattern.canTrumpTaiChi, true);
  assert.equal(
    compareCards(
      { cards: fourTrumpCards, pattern: ordinaryDiscard.pattern },
      { cards: leadingCards, pattern: leadingPattern },
      'tai_chi',
      'spades',
      '2',
      TAI_CHI_FOUR_SYMBOLS_RULE
    ),
    -1
  );
});

test('太极四象可在牌局中首发并由更高点数的四象压过', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const nines = ['hearts', 'diamonds', 'clubs', 'spades']
    .map((suit, index) => card(suit, '9', index));
  const jacks = ['hearts', 'diamonds', 'clubs', 'spades']
    .map((suit, index) => card(suit, 'J', index + 10));
  nines.forEach(value => room.players[0].addCard(value));
  jacks.forEach(value => room.players[1].addCard(value));
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.selectedRule = TAI_CHI_FOUR_SYMBOLS_RULE;
  engine.setFirstPlayer(room.players[0].id);

  const leadResult = engine.playCards(room.players[0].id, nines.map(value => value.id));
  assert.equal(leadResult.throwFailed, null);
  assert.equal(room.gameState.leadingPattern.type, PatternTypes.TAI_CHI_FOUR_SYMBOLS);
  const followResult = engine.playCards(room.players[1].id, jacks.map(value => value.id));
  assert.equal(followResult.currentWinningPlayerId, room.players[1].id);
  assert.equal(room.gameState.currentWinnerIndex, 1);
});

test('Bot保底出牌能识别太极四象的跨花色跟牌义务', () => {
  const botService = new BotService();
  const leadingCards = ['hearts', 'diamonds', 'clubs', 'spades']
    .map((suit, index) => card(suit, '9', index));
  const leadingPattern = detectPattern(
    leadingCards,
    'spades',
    '2',
    TAI_CHI_FOUR_SYMBOLS_RULE
  );
  const taiChiQueens = ['hearts', 'diamonds', 'clubs', 'spades']
    .map((suit, index) => card(suit, 'Q', index + 10));
  const hand = [
    card('hearts', '3', 30),
    ...taiChiQueens,
    card('clubs', 'A', 31)
  ];

  const selectedIds = botService.getFallbackAction({
    leadingPattern,
    trumpSuit: 'spades',
    trumpRank: '2',
    selectedRule: TAI_CHI_FOUR_SYMBOLS_RULE
  }, hand);
  const selectedIdSet = new Set(selectedIds);
  const selectedCards = hand.filter(value => selectedIdSet.has(value.id));

  assert.equal(selectedCards.length, 4);
  assert.equal(
    detectPattern(
      selectedCards,
      'spades',
      '2',
      TAI_CHI_FOUR_SYMBOLS_RULE
    ).type,
    PatternTypes.TAI_CHI_FOUR_SYMBOLS
  );
});

test('势如破竹仅在庄家方获胜时让原庄家连庄', () => {
  const calculate = (selectedRule, attackerScore) => {
    const room = createRoom();
    const engine = new GameEngine(room, createIo());
    room.gameState.selectedRule = selectedRule;
    room.gameState.buryingPlayerId = room.players[0].id;
    room.gameState.dealerPlayerIndex = 0;
    room.gameState.attackerScore = attackerScore;
    return { room, result: engine.calculateUpgrade() };
  };

  const dealerWin = calculate(IRRESISTIBLE_FORCE_RULE, 40);
  assert.equal(dealerWin.result.attackerWon, false);
  assert.equal(dealerWin.result.dealerContinues, true);
  assert.equal(dealerWin.result.nextDealerIndex, 0);
  assert.equal(dealerWin.room.gameState.dealerPlayerIndex, 0);

  const attackerWin = calculate(IRRESISTIBLE_FORCE_RULE, 80);
  assert.equal(attackerWin.result.attackerWon, true);
  assert.equal(attackerWin.result.dealerContinues, false);
  assert.equal(attackerWin.result.nextDealerIndex, 1);

  const normalDealerWin = calculate(NORMAL_RULE, 40);
  assert.equal(normalDealerWin.result.dealerContinues, false);
  assert.equal(normalDealerWin.result.nextDealerIndex, 2);
});

test('单步调试禁止甩牌，但保留单张、对子和拖拉机', () => {
  const throwCards = [card('hearts', '3'), card('hearts', '7')];
  const pairCards = [card('hearts', '3', 0), card('hearts', '3', 1)];
  const tractorCards = [
    card('hearts', '3', 0),
    card('hearts', '3', 1),
    card('hearts', '4', 0),
    card('hearts', '4', 1)
  ];

  assert.equal(validateLeadingPlay(throwCards, 'spades', '2', NORMAL_RULE).valid, true);
  assert.deepEqual(
    validateLeadingPlay(throwCards, 'spades', '2', SINGLE_STEP_DEBUG_RULE),
    { valid: false, message: '单步调试规则下不能甩牌', pattern: null }
  );
  assert.equal(
    validateLeadingPlay([throwCards[0]], 'spades', '2', SINGLE_STEP_DEBUG_RULE).valid,
    true
  );
  assert.equal(
    validateLeadingPlay(pairCards, 'spades', '2', SINGLE_STEP_DEBUG_RULE).pattern.type,
    PatternTypes.PAIR
  );
  assert.equal(
    validateLeadingPlay(tractorCards, 'spades', '2', SINGLE_STEP_DEBUG_RULE).pattern.type,
    PatternTypes.TRACTOR
  );

  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = SINGLE_STEP_DEBUG_RULE;
  throwCards.forEach(value => room.players[0].addCard(value));
  engine.setFirstPlayer(room.players[0].id);
  assert.throws(
    () => engine.playCards(room.players[0].id, throwCards.map(value => value.id)),
    /单步调试规则下不能甩牌/
  );
  assert.equal(room.players[0].cards.length, 2);
});

test('改革开放由庄家队友拿起首次底牌再埋，完成后仍由原庄家首发', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io);
  const dealer = room.players[0];
  const teammate = room.players[2];
  const suits = ['spades', 'hearts', 'clubs', 'diamonds'];
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deckCard = index => card(
    suits[index % suits.length],
    ranks[Math.floor(index / suits.length) % ranks.length],
    Math.floor(index / 52)
  );
  const dealerCards = Array.from({ length: 33 }, (_, index) => deckCard(index));
  const teammateCards = Array.from({ length: 25 }, (_, index) => deckCard(index + 60));
  dealerCards.forEach(value => dealer.addCard(value));
  teammateCards.forEach(value => teammate.addCard(value));
  room.gameState.phase = GamePhases.BURYING;
  room.gameState.selectedRule = REFORM_AND_OPENING_UP_RULE;
  room.gameState.buryingPlayerId = dealer.id;
  room.gameState.bottomCardsCount = 8;

  const firstBottom = dealerCards.slice(0, 8);
  const firstResult = engine.buryCards(dealer.id, firstBottom.map(value => value.id));

  assert.equal(firstResult.completed, false);
  assert.equal(room.gameState.phase, GamePhases.BURYING);
  assert.equal(room.gameState.buryingPlayerId, dealer.id);
  assert.equal(room.gameState.secondaryBuryingPlayerId, teammate.id);
  assert.equal(room.gameState.bottomCards.length, 0);
  assert.equal(dealer.cards.length, 25);
  assert.equal(teammate.cards.length, 33);
  assert.throws(
    () => engine.buryCards(dealer.id, dealer.cards.slice(0, 8).map(value => value.id)),
    /你不是埋底玩家/
  );

  const publicStart = io.events.find(({ event }) => event === 'secondary_burying_started');
  assert.equal(publicStart.payload.secondaryPlayerId, teammate.id);
  assert.equal(Object.hasOwn(publicStart.payload, 'bottomCards'), false);
  const privateBottom = io.events.find(({ event }) => event === 'secondary_bottom_cards_received');
  assert.equal(privateBottom.target, teammate.socketId);
  assert.deepEqual(
    new Set(privateBottom.payload.bottomCards.map(value => value.id)),
    new Set(firstBottom.map(value => value.id))
  );

  const finalBottom = [...firstBottom.slice(0, 2), ...teammateCards.slice(0, 6)];
  const finalResult = engine.buryCards(teammate.id, finalBottom.map(value => value.id));

  assert.equal(finalResult.completed, true);
  assert.equal(finalResult.isSecondary, true);
  assert.equal(room.gameState.phase, GamePhases.PLAYING);
  assert.equal(room.gameState.secondaryBuryingPlayerId, null);
  assert.equal(room.gameState.reformAndOpeningUpTeammatePlayerId, teammate.id);
  assert.equal(room.gameState.firstPlayerId, dealer.id);
  assert.equal(room.gameState.currentPlayerIndex, 0);
  assert.equal(room.gameState.roundStartPlayerIndex, 0);
  assert.equal(dealer.cards.length, 25);
  assert.equal(teammate.cards.length, 25);
  assert.deepEqual(
    new Set(room.gameState.bottomCards.map(value => value.id)),
    new Set(finalBottom.map(value => value.id))
  );
  assert.equal(
    io.events.filter(({ event }) => event === 'first_player_set').at(-1).payload.playerId,
    dealer.id
  );

  const viewBottomAs = viewer => {
    const handlers = new Map();
    const emitted = [];
    const socket = {
      id: viewer.socketId,
      on(event, handler) {
        handlers.set(event, handler);
      },
      emit(event, payload) {
        emitted.push({ event, payload });
      }
    };
    registerGameHandlers(createIo(), socket, {
      getRoom: roomId => roomId === room.id ? room : null
    });
    handlers.get('view_my_bottom_cards')({ roomId: room.id });
    return emitted;
  };
  const expectedBottomIds = new Set(finalBottom.map(value => value.id));
  for (const viewer of [dealer, teammate]) {
    const response = viewBottomAs(viewer)
      .find(({ event }) => event === 'my_bottom_cards');
    assert.ok(response);
    assert.equal(response.payload.isReformAndOpeningUp, true);
    assert.deepEqual(
      new Set(response.payload.bottomCards.map(value => value.id)),
      expectedBottomIds
    );
  }
  assert.match(
    viewBottomAs(room.players[1]).find(({ event }) => event === 'error').payload.message,
    /只有本局庄家和庄家队友/
  );
});

test('改革开放的庄家队友为Bot时会自动完成再埋底', async () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io);
  const dealer = room.players[0];
  const teammate = room.players[2];
  teammate.isBot = true;
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  Array.from({ length: 33 }, (_, index) =>
    card(['spades', 'hearts', 'clubs', 'diamonds'][index % 4], ranks[index % 13], Math.floor(index / 52))
  ).forEach(value => dealer.addCard(value));
  Array.from({ length: 25 }, (_, index) =>
    card(['spades', 'hearts', 'clubs', 'diamonds'][index % 4], ranks[(index + 5) % 13], 1)
  ).forEach(value => teammate.addCard(value));
  room.gameState.phase = GamePhases.BURYING;
  room.gameState.selectedRule = REFORM_AND_OPENING_UP_RULE;
  room.gameState.buryingPlayerId = dealer.id;
  room.gameState.bottomCardsCount = 8;

  engine.buryCards(dealer.id, dealer.cards.slice(0, 8).map(value => value.id));
  await new Promise(resolve => setTimeout(resolve, 650));

  assert.equal(room.gameState.phase, GamePhases.PLAYING);
  assert.equal(room.gameState.secondaryBuryingPlayerId, null);
  assert.equal(room.gameState.firstPlayerId, dealer.id);
  assert.equal(teammate.cards.length, 25);
  assert.equal(room.gameState.bottomCards.length, 8);
  assert.equal(
    io.events.filter(({ event }) => event === 'cards_buried').at(-1).payload.isSecondary,
    true
  );
});

test('一马当先只让庄家队友领出第一轮，不改变庄家、底牌归属或后续领出者', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io);
  const dealer = room.players[0];
  const dealerTeammate = room.players[2];
  const buriedCards = ['2', '3', '4', '5', '6', '7', '8', '9']
    .map((rank, index) => card('spades', rank, index));
  const trickCards = [
    card('hearts', '4', 20),
    card('hearts', 'A', 20),
    card('hearts', '2', 20),
    card('hearts', '3', 20)
  ];
  const spareCards = ['6', '7', '8', '9']
    .map((rank, index) => card('clubs', rank, 30 + index));

  buriedCards.forEach(value => dealer.addCard(value));
  room.players.forEach((player, index) => {
    player.addCard(trickCards[index]);
    player.addCard(spareCards[index]);
  });
  room.gameState.phase = GamePhases.BURYING;
  room.gameState.selectedRule = ONE_HORSE_LEADS_RULE;
  room.gameState.buryingPlayerId = dealer.id;
  room.gameState.dealerPlayerIndex = 0;
  room.gameState.bottomCardsCount = 8;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '5';

  engine.buryCards(dealer.id, buriedCards.map(value => value.id));

  assert.equal(room.gameState.buryingPlayerId, dealer.id);
  assert.equal(room.gameState.dealerPlayerIndex, 0);
  assert.deepEqual(
    room.gameState.bottomCards.map(value => value.id),
    buriedCards.map(value => value.id)
  );
  assert.equal(room.gameState.firstPlayerId, dealerTeammate.id);
  assert.equal(room.gameState.currentPlayerIndex, 2);
  assert.equal(room.gameState.roundStartPlayerIndex, 2);
  assert.ok(io.events.some(({ event, payload }) =>
    event === 'first_player_set' && payload.playerId === dealerTeammate.id));

  let result;
  for (const playerIndex of [2, 3, 0, 1]) {
    result = engine.playCards(room.players[playerIndex].id, [trickCards[playerIndex].id]);
  }

  assert.equal(result.roundWinner.playerId, room.players[1].id);
  assert.equal(room.gameState.currentPlayerIndex, 1);
  assert.equal(room.gameState.roundStartPlayerIndex, 1);
  assert.equal(room.gameState.firstPlayerId, dealerTeammate.id);
});

test('冰山一角由每家暗选两张，全部确认后统一公开，打出后由原玩家补选', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io);
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = getRuleById(RuleIds.ICEBERG_TIP);
  room.players.forEach((player, playerIndex) => {
    ['2', '3', '4', '5'].forEach((rank, cardIndex) => {
      player.addCard(card(['spades', 'hearts', 'clubs', 'diamonds'][playerIndex], rank, cardIndex));
    });
  });

  engine.activateRuleHandVisibility();

  assert.deepEqual([...room.gameState.icebergPendingPlayerIds], room.players.map(player => player.id));
  assert.equal(io.events.filter(({ event }) => event === 'iceberg_reveal_selection_required').length, 4);
  assert.equal(io.events.some(({ event }) => event === 'rule_visible_hands_updated'), false);

  const chosenByPlayer = new Map(room.players.map(player => [
    player.id,
    [player.cards[0].id, player.cards[2].id]
  ]));
  assert.throws(
    () => engine.submitIcebergRevealSelection(room.players[0].id, []),
    /必须选择2张牌明置/
  );
  room.players.slice(0, 3).forEach(player => {
    engine.submitIcebergRevealSelection(player.id, chosenByPlayer.get(player.id));
  });
  assert.equal(io.events.some(({ event }) => event === 'rule_visible_hands_updated'), false);
  engine.submitIcebergRevealSelection(
    room.players[3].id,
    chosenByPlayer.get(room.players[3].id)
  );

  assert.equal(room.gameState.icebergPendingPlayerIds.size, 0);
  room.players.forEach(player => {
    assert.deepEqual(
      [...room.gameState.icebergRevealedCardIdsByPlayer.get(player.id)].sort(),
      [...chosenByPlayer.get(player.id)].sort()
    );
  });
  const initialUpdates = io.events.filter(({ event }) => event === 'rule_visible_hands_updated');
  assert.equal(initialUpdates.length, 4);
  initialUpdates.forEach(({ target, payload }) => {
    assert.notEqual(target, room.id);
    assert.equal(payload.hands.length, 4);
    assert.ok(payload.hands.every(hand => hand.cards.length === 2));
  });

  const player = room.players[0];
  const initiallyRevealed = [...chosenByPlayer.get(player.id)];
  engine.setFirstPlayer(player.id);
  engine.playCards(player.id, [initiallyRevealed[0]]);

  assert.deepEqual([...room.gameState.icebergPendingPlayerIds], [player.id]);
  assert.equal(room.gameState.icebergRevealedCardIdsByPlayer.get(player.id).size, 1);
  assert.throws(
    () => engine.playCards(room.players[1].id, [room.players[1].cards[0].id]),
    /选择明牌/
  );

  const replacement = player.cards.find(value =>
    !room.gameState.icebergRevealedCardIdsByPlayer.get(player.id).has(value.id)
  );
  engine.submitIcebergRevealSelection(player.id, [replacement.id]);
  const replenished = room.gameState.icebergRevealedCardIdsByPlayer.get(player.id);
  assert.equal(replenished.size, 2);
  assert.equal(replenished.has(initiallyRevealed[0]), false);
  assert.equal(replenished.has(initiallyRevealed[1]), true);
  assert.equal(replenished.has(replacement.id), true);
});

test('冰山一角中的Bot会自动选择自己的两张明牌而不阻塞牌局', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io);
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = getRuleById(RuleIds.ICEBERG_TIP);
  room.players.forEach((player, playerIndex) => {
    player.isBot = true;
    ['2', '3', '4'].forEach((rank, cardIndex) => {
      player.addCard(card(['spades', 'hearts', 'clubs', 'diamonds'][playerIndex], rank, cardIndex));
    });
  });

  engine.activateRuleHandVisibility();

  assert.equal(engine.hasPendingIcebergSelection(), false);
  assert.equal(room.gameState.icebergPendingPlayerIds.size, 0);
  assert.equal(io.events.some(({ event }) => event === 'iceberg_reveal_selection_required'), false);
  room.players.forEach(player => {
    assert.equal(room.gameState.icebergRevealedCardIdsByPlayer.get(player.id).size, 2);
  });
  assert.equal(io.events.filter(({ event }) => event === 'rule_visible_hands_updated').length, 4);
});

test('互通有无只向每个玩家私发其对家手牌', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io);
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = getRuleById(RuleIds.MUTUAL_VISIBILITY);
  room.players.forEach((player, index) => player.addCard(card('spades', String(index + 2), index)));

  engine.activateRuleHandVisibility();

  const updates = io.events.filter(({ event }) => event === 'rule_visible_hands_updated');
  assert.equal(updates.length, 4);
  room.players.forEach((viewer, viewerIndex) => {
    const update = updates.find(({ target }) => target === viewer.socketId);
    assert.ok(update);
    assert.equal(update.payload.hands.length, 1);
    assert.equal(update.payload.hands[0].playerId, room.players[(viewerIndex + 2) % 4].id);
    assert.equal(update.payload.hands[0].cards.length, 1);
  });
  assert.equal(updates.some(({ target }) => target === room.id), false);
});

test('新增明牌规则在庄家埋底完成前都不会发送任何牌面', () => {
  for (const ruleId of [
    RuleIds.ICEBERG_TIP,
    RuleIds.MUTUAL_VISIBILITY,
    RuleIds.OPEN_AND_HONEST
  ]) {
    const room = createRoom();
    const io = createIo();
    const engine = new GameEngine(room, io);
    const dealer = room.players[0];
    ['2', '3', '4', '5', '6', '7', '8', '9']
      .map(rank => card('spades', rank))
      .forEach(value => dealer.addCard(value));
    room.players.slice(1).forEach((player, index) => {
      player.addCard(card('hearts', String(index + 2), index));
    });
    room.gameState.phase = GamePhases.BURYING;
    room.gameState.buryingPlayerId = dealer.id;
    room.gameState.bottomCardsCount = 8;
    room.gameState.selectedRule = getRuleById(ruleId);

    engine.handleDealerAssigned(dealer);
    assert.equal(io.events.some(({ event }) => event === 'rule_visible_hands_updated'), false);

    engine.buryCards(dealer.id, dealer.cards.map(value => value.id));
    const updates = io.events.filter(({ event }) => event === 'rule_visible_hands_updated');
    if (ruleId === RuleIds.OPEN_AND_HONEST) {
      assert.equal(updates.length, 0);
    } else {
      assert.equal(updates.length, 4);
    }
  }
});

test('为人坦荡只在一轮结束且四家手牌均不多于五张时同时公开', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io);
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = getRuleById(RuleIds.OPEN_AND_HONEST);
  room.players.forEach((player, playerIndex) => {
    ['2', '3', '4', '5', '6', '7', '8'].forEach((rank, cardIndex) => {
      player.addCard(card('spades', rank, playerIndex * 10 + cardIndex));
    });
  });

  engine.setFirstPlayer(room.players[0].id);
  engine.activateRuleHandVisibility();
  assert.equal(io.events.some(({ event }) => event === 'rule_visible_hands_updated'), false);
  let firstRoundFinalPlay;
  room.players.forEach(player => {
    firstRoundFinalPlay = engine.playCards(player.id, [player.cards[0].id]);
  });
  assert.equal(firstRoundFinalPlay.roundUpdate.type, 'round_ended');
  assert.deepEqual(room.players.map(player => player.cards.length), [6, 6, 6, 6]);
  assert.equal(room.gameState.areAllHandsRevealed, false);
  assert.equal(io.events.some(({ event }) => event === 'rule_visible_hands_updated'), false);

  room.players.slice(0, 3).forEach(player => {
    engine.playCards(player.id, [player.cards[0].id]);
    assert.equal(room.gameState.areAllHandsRevealed, false);
    assert.equal(io.events.some(({ event }) => event === 'rule_visible_hands_updated'), false);
  });
  const finalPlay = engine.playCards(room.players[3].id, [room.players[3].cards[0].id]);

  assert.equal(finalPlay.roundUpdate.type, 'round_ended');
  assert.equal(room.gameState.areAllHandsRevealed, true);
  const updates = io.events.filter(({ event }) => event === 'rule_visible_hands_updated');
  assert.equal(updates.length, 4);
  updates.forEach(({ payload }) => {
    assert.deepEqual(payload.hands.map(hand => hand.cards.length), [5, 5, 5, 5]);
    assert.match(payload.announcement, /本轮结束/);
  });
});

test('十面埋伏在庄家埋底后由队友暗选，首次出现前不进入公共快照', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io);
  const dealer = room.players[0];
  const selector = room.players[2];
  const bottomCards = ['3', '4', '6', '8', '9', 'J', 'Q', 'A']
    .map((rank, index) => card('clubs', rank, index));
  const firstPlayCard = card('hearts', '7', 20);
  [...bottomCards, firstPlayCard].forEach(value => dealer.addCard(value));
  room.players.slice(1).forEach((player, index) => {
    player.addCard(card('diamonds', String(index + 2), 30 + index));
  });
  room.gameState.phase = GamePhases.BURYING;
  room.gameState.buryingPlayerId = dealer.id;
  room.gameState.bottomCardsCount = 8;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.selectedRule = getRuleById(RuleIds.TEN_SIDED_AMBUSH);

  engine.buryCards(dealer.id, bottomCards.map(value => value.id));

  assert.equal(room.gameState.phase, GamePhases.PLAYING);
  assert.equal(room.gameState.tenSidedAmbushSelectorPlayerId, selector.id);
  assert.equal(room.gameState.isTenSidedAmbushSelectionPending, true);
  assert.equal(room.gameState.toJSON().tenSidedAmbush.rank, null);
  assert.equal(room.gameState.toJSON().tenSidedAmbush.attackerNetCardCount, 0);
  const selectionRequest = io.events.find(({ event }) =>
    event === 'ten_sided_ambush_selection_required'
  );
  assert.equal(selectionRequest.target, selector.socketId);
  assert.ok(selectionRequest.payload.eligibleRanks.includes('7'));
  ['2', '5', '10', 'K'].forEach(rank => {
    assert.equal(selectionRequest.payload.eligibleRanks.includes(rank), false);
  });
  assert.throws(() => engine.playCards(dealer.id, [firstPlayCard.id]), /等待.*指定/);
  assert.throws(() => engine.selectTenSidedAmbushRank(room.players[1].id, '7'), /只有庄家队友/);
  assert.throws(() => engine.selectTenSidedAmbushRank(selector.id, '2'), /不能选择/);
  assert.throws(() => engine.selectTenSidedAmbushRank(selector.id, '5'), /不能选择/);

  engine.selectTenSidedAmbushRank(selector.id, '7');
  assert.equal(room.gameState.tenSidedAmbushRank, '7');
  assert.equal(room.gameState.toJSON().tenSidedAmbush.rank, null);
  const privateConfirmation = io.events.find(({ event }) =>
    event === 'ten_sided_ambush_rank_selected'
  );
  assert.equal(privateConfirmation.target, selector.socketId);
  assert.equal(privateConfirmation.payload.rank, '7');
  const publicLock = io.events.find(({ event }) => event === 'ten_sided_ambush_rank_locked');
  assert.equal(Object.hasOwn(publicLock.payload, 'rank'), false);

  const result = engine.playCards(dealer.id, [firstPlayCard.id]);
  assert.equal(result.tenSidedAmbushReveal.rank, '7');
  assert.equal(result.tenSidedAmbushReveal.source, 'play');
  assert.equal(room.gameState.toJSON().tenSidedAmbush.rank, '7');
});

test('十面埋伏的Bot队友自动暗选，不阻塞庄家开始出牌', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo(), () => 0);
  const dealer = room.players[0];
  room.players[2].isBot = true;
  room.gameState.phase = GamePhases.BURYING;
  room.gameState.buryingPlayerId = dealer.id;
  room.gameState.bottomCardsCount = 0;
  room.gameState.trumpRank = '2';
  room.gameState.selectedRule = getRuleById(RuleIds.TEN_SIDED_AMBUSH);

  engine.buryCards(dealer.id, []);

  assert.equal(engine.hasPendingTenSidedAmbushSelection(), false);
  assert.equal(room.gameState.tenSidedAmbushRank, '3');
  assert.equal(room.gameState.toJSON().tenSidedAmbush.rank, null);
});

test('十面埋伏逐墩按赢家阵营对每张伏击牌反向计5分', () => {
  const playTrick = ({ cards, startingScore = 0 }) => {
    const room = createRoom();
    const engine = new GameEngine(room, createIo());
    room.gameState.phase = GamePhases.PLAYING;
    room.gameState.trumpSuit = 'spades';
    room.gameState.trumpRank = '2';
    room.gameState.selectedRule = getRuleById(RuleIds.TEN_SIDED_AMBUSH);
    room.gameState.buryingPlayerId = room.players[0].id;
    room.gameState.tenSidedAmbushSelectorPlayerId = room.players[2].id;
    room.gameState.tenSidedAmbushRank = '7';
    room.gameState.attackerScore = startingScore;
    room.players.forEach((player, index) => {
      player.addCard(cards[index]);
      player.addCard(card('clubs', String(index + 3), 80 + index));
    });
    engine.setFirstPlayer(room.players[0].id);
    let result;
    room.players.forEach((player, index) => {
      result = engine.playCards(player.id, [cards[index].id]);
    });
    return { room, result };
  };

  const defenderWin = playTrick({
    cards: [
      card('hearts', 'A', 40),
      card('hearts', '7', 41),
      card('hearts', '3', 42),
      card('hearts', '10', 43)
    ]
  });
  assert.equal(defenderWin.result.roundUpdate.scoreInfo.winnerIsAttacker, false);
  assert.equal(defenderWin.result.roundUpdate.scoreInfo.ambushCardCount, 1);
  assert.equal(defenderWin.result.roundUpdate.scoreInfo.ambushScoreDelta, 5);
  assert.equal(defenderWin.result.roundUpdate.scoreInfo.ambushAttackerNetCardDelta, -1);
  assert.equal(defenderWin.room.gameState.tenSidedAmbushAttackerNetCardCount, -1);
  assert.equal(defenderWin.room.gameState.attackerScore, 5);

  const attackerWin = playTrick({
    cards: [
      card('hearts', '3', 50),
      card('hearts', 'A', 51),
      card('hearts', '7', 52),
      card('hearts', '10', 53)
    ]
  });
  assert.equal(attackerWin.result.roundUpdate.scoreInfo.winnerIsAttacker, true);
  assert.equal(attackerWin.result.roundUpdate.scoreInfo.roundPoints, 10);
  assert.equal(attackerWin.result.roundUpdate.scoreInfo.ambushScoreDelta, -5);
  assert.equal(attackerWin.result.roundUpdate.scoreInfo.ambushAttackerNetCardDelta, 1);
  assert.equal(attackerWin.room.gameState.tenSidedAmbushAttackerNetCardCount, 1);
  assert.equal(attackerWin.room.gameState.attackerScore, 5);
});

test('十面埋伏底牌按抠底倍数：闲家拿底扣分，庄家守底加分', () => {
  const calculate = (lastRoundWinnerIndex) => {
    const room = createRoom();
    const engine = new GameEngine(room, createIo());
    room.gameState.selectedRule = getRuleById(RuleIds.TEN_SIDED_AMBUSH);
    room.gameState.buryingPlayerId = room.players[0].id;
    room.gameState.tenSidedAmbushSelectorPlayerId = room.players[2].id;
    room.gameState.tenSidedAmbushRank = '7';
    room.gameState.attackerScore = 40;
    room.gameState.bottomCards = [
      card('clubs', '5', 60),
      card('hearts', '7', 61),
      card('diamonds', '7', 62)
    ];
    room.gameState.lastRoundWinnerIndex = lastRoundWinnerIndex;
    room.gameState.lastRoundLeadingPattern = { type: PatternTypes.SINGLE, length: 1 };
    return { room, result: engine.calculateBottomScore() };
  };

  const attackerBottom = calculate(1);
  assert.equal(attackerBottom.result.bottomMultiplier, 2);
  assert.equal(attackerBottom.result.bottomPoints, 5);
  assert.equal(attackerBottom.result.ambushPoints, 10);
  assert.equal(attackerBottom.result.ambushScoreDelta, -20);
  assert.equal(attackerBottom.result.ambushAttackerNetCardDelta, 4);
  assert.equal(attackerBottom.result.ambushAttackerNetCardCount, 4);
  assert.equal(attackerBottom.result.bottomScoreGained, -10);
  assert.equal(attackerBottom.result.baseScore, 40);
  assert.equal(attackerBottom.room.gameState.attackerScore, 30);
  assert.equal(attackerBottom.result.ambushRevealedFromBottom, true);

  const dealerBottom = calculate(0);
  assert.equal(dealerBottom.result.ambushScoreDelta, 20);
  assert.equal(dealerBottom.result.ambushAttackerNetCardDelta, -4);
  assert.equal(dealerBottom.result.ambushAttackerNetCardCount, -4);
  assert.equal(dealerBottom.result.bottomScoreGained, 20);
  assert.equal(dealerBottom.result.baseScore, 40);
  assert.equal(dealerBottom.room.gameState.attackerScore, 60);
  assert.equal(dealerBottom.result.ambushRevealedFromBottom, true);
});

test('三权分立由初始2、3、4号位并行暗选，重复点数首次出现时一起揭晓并叠加计分', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io);
  const trickCards = [
    card('hearts', '3', 100),
    card('spades', '7', 101),
    card('hearts', '4', 102),
    card('hearts', '6', 103)
  ];

  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.selectedRule = THREE_POWERS_RULE;
  room.gameState.buryingPlayerId = room.players[0].id;
  room.players.forEach((player, index) => {
    player.addCard(trickCards[index]);
    player.addCard(card('clubs', String(index + 8), 110 + index));
  });
  engine.setFirstPlayer(room.players[0].id);
  engine.activateThreePowers();

  const slotsBySource = Object.fromEntries(
    room.gameState.threePowersSlots.map(slot => [slot.sourceRank, slot])
  );
  assert.equal(slotsBySource['10'].selectorPlayerId, room.players[1].id);
  assert.equal(slotsBySource['5'].selectorPlayerId, room.players[2].id);
  assert.equal(slotsBySource.K.selectorPlayerId, room.players[3].id);
  assert.deepEqual(room.gameState.threePowersSlots.map(slot => slot.sourceRank), ['5', '10', 'K']);
  assert.ok(engine.getEligibleThreePowersRanks().includes('5'));
  assert.ok(engine.getEligibleThreePowersRanks().includes('10'));
  assert.ok(engine.getEligibleThreePowersRanks().includes('K'));
  assert.equal(engine.getEligibleThreePowersRanks().includes('2'), false);
  assert.ok(room.gameState.toJSON().threePowers.slots.every(slot => slot.rank === null));
  assert.throws(
    () => engine.playCards(room.players[0].id, [trickCards[0].id]),
    /完成三权分立点数选择/
  );
  assert.throws(
    () => engine.selectThreePowersRank(room.players[1].id, '5', '7'),
    /不能设置这个分牌重载槽/
  );
  assert.throws(
    () => engine.selectThreePowersRank(room.players[1].id, '10', '2'),
    /不能选择级牌或王牌/
  );

  engine.selectThreePowersRank(room.players[1].id, '10', '7');
  engine.selectThreePowersRank(room.players[2].id, '5', '7');
  engine.selectThreePowersRank(room.players[3].id, 'K', '7');

  assert.equal(engine.hasPendingThreePowersSelection(), false);
  assert.ok(room.gameState.toJSON().threePowers.slots.every(slot => slot.rank === null));
  assert.equal(engine.getRuleCardPoints(card('diamonds', '5', 120)), 0);
  assert.equal(engine.getRuleCardPoints(card('diamonds', '7', 121)), 25);
  const privateConfirmations = io.events.filter(({ event }) => event === 'three_powers_rank_selected');
  assert.equal(privateConfirmations.length, 3);
  privateConfirmations.forEach(({ target, payload }) => {
    assert.equal(target, room.findPlayerById(slotsBySource[payload.sourceRank].selectorPlayerId)?.socketId);
    assert.equal(payload.rank, '7');
  });
  io.events
    .filter(({ event }) => event === 'three_powers_rank_locked')
    .forEach(({ payload }) => assert.equal(Object.hasOwn(payload, 'rank'), false));

  const leadResult = engine.playCards(room.players[0].id, [trickCards[0].id]);
  assert.equal(leadResult.threePowersReveal, null);
  const revealResult = engine.playCards(room.players[1].id, [trickCards[1].id]);
  assert.deepEqual(
    revealResult.threePowersReveal.slots.map(slot => [slot.sourceRank, slot.rank]),
    [['5', '7'], ['10', '7'], ['K', '7']]
  );
  assert.ok(room.gameState.toJSON().threePowers.slots.every(slot => slot.rank === '7'));
  engine.playCards(room.players[2].id, [trickCards[2].id]);
  const finalResult = engine.playCards(room.players[3].id, [trickCards[3].id]);

  assert.equal(finalResult.roundUpdate.scoreInfo.winnerIsAttacker, true);
  assert.equal(finalResult.roundUpdate.scoreInfo.roundPoints, 25);
  assert.equal(room.gameState.attackerScore, 25);
  assert.deepEqual(room.gameState.collectedPointCards.map(value => value.id), [trickCards[1].id]);
});

test('三权分立未曾出牌的重载点数在底牌揭晓并按抠底倍数计分', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  room.gameState.selectedRule = THREE_POWERS_RULE;
  room.gameState.buryingPlayerId = room.players[0].id;
  room.gameState.lastRoundWinnerIndex = 1;
  room.gameState.lastRoundLeadingPattern = { type: PatternTypes.SINGLE, length: 1 };
  room.gameState.bottomCards = [card('clubs', '7', 130), card('clubs', '5', 131)];
  room.gameState.threePowersSlots = [
    { sourceRank: '5', pointValue: 5, selectorPlayerId: room.players[2].id, selectedRank: '7', isRevealed: false },
    { sourceRank: '10', pointValue: 10, selectorPlayerId: room.players[1].id, selectedRank: '7', isRevealed: false },
    { sourceRank: 'K', pointValue: 10, selectorPlayerId: room.players[3].id, selectedRank: '7', isRevealed: false }
  ];

  const result = engine.calculateBottomScore();

  assert.equal(result.bottomPoints, 25);
  assert.equal(result.bottomMultiplier, 2);
  assert.equal(result.bottomScoreGained, 50);
  assert.equal(room.gameState.attackerScore, 50);
  assert.deepEqual(
    result.threePowersRevealFromBottom.slots.map(slot => [slot.sourceRank, slot.rank]),
    [['5', '7'], ['10', '7'], ['K', '7']]
  );
  assert.ok(room.gameState.toJSON().threePowers.slots.every(slot => slot.rank === '7'));
});

test('三条摸牌后换牌规则分别指向对家、上家和下家', () => {
  const cases = [
    [RuleIds.KNOW_YOURSELF_AND_ENEMY, '知己知彼', 2, [2, 3, 0, 1]],
    [RuleIds.NEWS_MINISTER_I, '新闻部长I', -1, [3, 0, 1, 2]],
    [RuleIds.NEWS_MINISTER_II, '新闻部长II', 1, [1, 2, 3, 0]]
  ];

  for (const [ruleId, name, offset, expectedTargets] of cases) {
    const room = createRoom();
    const engine = new GameEngine(room, createIo());
    room.gameState.phase = GamePhases.DRAWING;
    room.gameState.selectedRule = getRuleById(ruleId);

    assert.equal(getOpeningCardExchangeOffset(room.gameState.selectedRule), offset);
    assert.equal(room.gameState.selectedRule.name, name);
    engine.startOpeningCardExchange();

    room.players.forEach((player, index) => {
      assert.equal(
        room.gameState.cardExchange.targetByPlayerId[player.id],
        room.players[expectedTargets[index]].id
      );
    });
  }
});

test('开局换牌收齐前不改手牌，收齐后同时交换且只私发实际牌面', () => {
  const cases = [
    [RuleIds.KNOW_YOURSELF_AND_ENEMY, 2],
    [RuleIds.NEWS_MINISTER_I, -1],
    [RuleIds.NEWS_MINISTER_II, 1]
  ];
  const suits = ['spades', 'hearts', 'clubs', 'diamonds'];

  for (const [ruleId, offset] of cases) {
    const room = createRoom();
    const io = createIo();
    const engine = new GameEngine(room, io);
    let dealerCompletions = 0;
    let completedDealerId = null;
    engine.drawingManager = {
      completeDealerAssignment: dealerId => {
        dealerCompletions++;
        completedDealerId = dealerId;
      }
    };
    room.gameState.phase = GamePhases.DRAWING;
    room.gameState.selectedRule = getRuleById(ruleId);
    room.gameState.pendingDealerPlayerId = room.players[0].id;

    room.players.forEach((player, index) => {
      ['2', '3', '4', '5'].forEach(rank => player.addCard(card(suits[index], rank)));
    });
    const selectedByPlayer = room.players.map(player => player.cards.slice(0, 2));
    const originalHands = room.players.map(player => player.cards.map(value => value.id));

    engine.startOpeningCardExchange();
    room.players.slice(0, 3).forEach((player, index) => {
      engine.submitOpeningCardExchange(player.id, selectedByPlayer[index].map(value => value.id));
    });

    assert.deepEqual(
      room.players.map(player => player.cards.map(value => value.id)),
      originalHands,
      '收齐四份选择前不应改动任何手牌'
    );
    assert.equal(dealerCompletions, 0);

    engine.submitOpeningCardExchange(
      room.players[3].id,
      selectedByPlayer[3].map(value => value.id)
    );

    room.players.forEach((player, recipientIndex) => {
      const senderIndex = (recipientIndex - offset + room.players.length) % room.players.length;
      const expectedIncoming = selectedByPlayer[senderIndex].map(value => value.id);
      const handIds = new Set(player.cards.map(value => value.id));
      assert.equal(player.cards.length, 4);
      expectedIncoming.forEach(id => assert.ok(handIds.has(id)));
      selectedByPlayer[recipientIndex].forEach(value => assert.ok(!handIds.has(value.id)));
    });
    assert.equal(room.gameState.cardExchange, null);
    assert.equal(dealerCompletions, 1);
    assert.equal(completedDealerId, room.players[0].id);

    const publicResolution = io.events.find(({ event }) => event === 'card_exchange_resolved');
    assert.ok(publicResolution);
    assert.equal(publicResolution.payload.transfers.length, 4);
    assert.equal('receivedCards' in publicResolution.payload, false);
    const privateUpdates = io.events.filter(({ event }) => event === 'card_exchange_hand_updated');
    assert.equal(privateUpdates.length, 4);
    privateUpdates.forEach(update => {
      assert.notEqual(update.target, room.id);
      assert.equal(update.payload.sentCardIds.length, 2);
      assert.equal(update.payload.receivedCards.length, 2);
      assert.equal(update.payload.ruleName, getRuleById(ruleId).name);
      assert.equal(update.payload.operation, 'exchange');
      assert.equal(update.payload.animationDuration, publicResolution.payload.animationDuration);
    });
  }
});

test('发牌完成后先保留反主窗口，锁定庄家后换牌，换牌完成才发底牌', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io);
  const manager = new DrawingPhaseManager(
    room,
    io,
    dealer => engine.handleDealerAssigned(dealer),
    () => engine.handleDrawingComplete(),
    dealer => engine.handleDealerSelected(dealer)
  );
  engine.drawingManager = manager;
  room.gameState.phase = GamePhases.DRAWING;
  room.gameState.selectedRule = getRuleById(RuleIds.NEWS_MINISTER_II);
  room.gameState.currentTrumpDeclaration = {
    playerId: room.players[2].id,
    playerName: room.players[2].name,
    type: 'pair',
    suit: 'joker'
  };

  const suits = ['spades', 'hearts', 'clubs', 'diamonds'];
  room.players.forEach((player, index) => {
    ['2', '3', '4', '5'].forEach(rank => player.addCard(card(suits[index], rank)));
  });
  room.gameState.bottomCards = ['6', '7', '8', '9', '10', 'J', 'Q', 'K']
    .map(rank => card('spades', rank));
  const selectedByPlayer = room.players.map(player => player.cards.slice(0, 2));
  const dealer = room.players[2];

  engine.handleDrawingComplete();
  assert.equal(room.gameState.postDrawStage, 'trump_window');
  assert.equal(room.gameState.isTrumpDeclarationLocked, false);
  assert.equal(room.gameState.cardExchange, null);
  assert.ok(manager.dealerTimer, '发牌完成后应开启亮主/反主倒计时');

  manager.assignDealer();
  assert.equal(room.gameState.pendingDealerPlayerId, dealer.id);
  assert.equal(room.gameState.buryingPlayerId, null);
  assert.equal(room.gameState.phase, GamePhases.DRAWING);
  assert.equal(room.gameState.postDrawStage, 'card_exchange');
  assert.equal(room.gameState.isTrumpDeclarationLocked, true);
  assert.ok(room.gameState.cardExchange);
  assert.equal(dealer.cards.length, 4, '换牌完成前庄家不能收到任何底牌');
  assert.equal(io.events.some(({ event }) => event === 'bottom_cards_received'), false);
  assert.equal(manager.startDealerCountdown(), false, '锁定后反主不能重启庄家倒计时');
  assert.equal(manager.dealerTimer, null);

  room.players.forEach((player, index) => {
    engine.submitOpeningCardExchange(
      player.id,
      selectedByPlayer[index].map(value => value.id)
    );
  });

  assert.equal(room.gameState.cardExchange, null);
  assert.equal(room.gameState.pendingDealerPlayerId, null);
  assert.equal(room.gameState.buryingPlayerId, dealer.id);
  assert.equal(room.gameState.phase, GamePhases.BURYING);
  assert.equal(room.gameState.postDrawStage, null);
  assert.equal(dealer.cards.length, 12, '换牌净张数不变，完成后才加八张底牌');

  const eventNames = io.events.map(({ event }) => event);
  assert.ok(eventNames.indexOf('dealer_selected') < eventNames.indexOf('card_exchange_started'));
  assert.ok(eventNames.indexOf('card_exchange_resolved') < eventNames.indexOf('bottom_cards_received'));
});

test('中流砥柱必须等庄家完成埋底后才开始，并按埋底后的手牌判断', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io);
  const dealer = room.players[0];
  const cardsToBury = ['3', '4', '5', '6', '7', '8', '9', '10']
    .map((rank, index) => card('hearts', rank, 1900 + index));
  const keptCards = [
    card('spades', '3', 1910),
    card('clubs', 'J', 1911),
    card('clubs', 'Q', 1912),
    card('clubs', 'K', 1913),
    card('clubs', 'A', 1914)
  ];
  [...cardsToBury, ...keptCards].forEach(value => dealer.addCard(value));
  room.players.slice(1).forEach((player, playerIndex) => {
    ['3', '4', '6', '7', '8'].forEach((rank, rankIndex) => {
      player.addCard(card('clubs', rank, 1920 + playerIndex * 10 + rankIndex));
    });
  });

  room.gameState.selectedRule = MAINSTAY_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.dealerPlayerIndex = 0;
  room.gameState.bottomCardsCount = cardsToBury.length;
  room.gameState.phase = GamePhases.DRAWING;

  assert.equal(engine.handleDealerSelected(dealer), false);
  assert.equal(room.gameState.mainstayCurrentAction, null);
  assert.equal(io.events.some(({ event }) => event === 'mainstay_started'), false);

  room.gameState.phase = GamePhases.BURYING;
  room.gameState.buryingPlayerId = dealer.id;
  const result = engine.buryCards(dealer.id, cardsToBury.map(value => value.id));

  assert.equal(result.completed, true);
  assert.deepEqual(dealer.cards.map(value => value.id), keptCards.map(value => value.id));
  assert.equal(room.gameState.mainstayCurrentAction.actorPlayerId, dealer.id);
  assert.equal(room.gameState.mainstayCurrentAction.trumpCount, 1);
  assert.equal(room.gameState.currentPlayerIndex, null);
  assert.throws(
    () => engine.playCards(dealer.id, [keptCards[0].id]),
    /请先完成中流砥柱/
  );
  const eventNames = io.events.map(({ event }) => event);
  assert.ok(
    eventNames.indexOf('cards_buried') < eventNames.indexOf('mainstay_started'),
    '必须先完成并公布埋底，再询问中流砥柱'
  );
});

test('中流砥柱按实时手牌依次判断，同队两人可以先后发动并把全部主牌交回', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io);
  let resumedTurns = 0;
  engine.onBotTurn = () => {
    resumedTurns++;
  };
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = MAINSTAY_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.dealerPlayerIndex = 0;
  room.gameState.firstPlayerId = room.players[0].id;
  room.gameState.currentPlayerIndex = 0;
  room.gameState.roundStartPlayerIndex = 0;
  room.gameState.currentRound = 1;

  const hands = [
    [
      card('spades', '3', 2000), card('hearts', '2', 2001),
      card('hearts', '3', 2002), card('hearts', '4', 2003), card('hearts', '5', 2004),
      card('hearts', '6', 2005), card('hearts', '7', 2006), card('hearts', '8', 2007)
    ],
    ['3', '4', '5', '6', '7', '8', '9', '10'].map((rank, index) =>
      card('clubs', rank, 2100 + index)
    ),
    [
      card('spades', '4', 2200), card('diamonds', '2', 2201),
      card('diamonds', '3', 2202), card('diamonds', '4', 2203), card('diamonds', '5', 2204),
      card('diamonds', '6', 2205), card('diamonds', '7', 2206), card('diamonds', '8', 2207)
    ],
    ['3', '4', '5', '6', '7', '8', '9', '10'].map((rank, index) =>
      card('hearts', rank, 2300 + index)
    )
  ];
  room.players.forEach((player, index) => hands[index].forEach(value => player.addCard(value)));

  const firstPlayerOriginalTrumps = engine.getMainstayTrumpCards(room.players[0]);
  const teammateOriginalTrumps = engine.getMainstayTrumpCards(room.players[2]);
  engine.startMainstay();
  assert.equal(room.gameState.currentPlayerIndex, null, '四家决定期间必须冻结第一轮出牌权');
  assert.equal(room.gameState.mainstayCurrentAction.actorPlayerId, room.players[0].id);
  assert.equal(room.gameState.mainstayCurrentAction.trumpCount, 2);
  assert.equal('trumpCount' in room.gameState.toJSON().mainstay.currentAction, false);
  assert.equal(
    io.events.find(({ target, event }) => (
      target === room.players[0].socketId && event === 'mainstay_decision_required'
    ))?.payload?.trumpCount,
    2,
    '具体主牌数只应私发给当前玩家'
  );
  assert.equal(
    'trumpCount' in io.events.find(({ target, event }) => (
      target === room.id && event === 'mainstay_action_pending'
    )).payload,
    false
  );

  const firstActionId = room.gameState.mainstayCurrentAction.id;
  engine.respondMainstay(room.players[0].id, true);
  const firstGive = [
    ...firstPlayerOriginalTrumps,
    ...room.players[0].cards.filter(value => !isTrumpCard(value, 'spades', '2')).slice(0, 3)
  ];
  engine.submitMainstayCards(room.players[0].id, firstActionId, firstGive.map(value => value.id));
  assert.equal(room.gameState.mainstayCurrentAction.stage, 'return');
  assert.equal(room.gameState.mainstayCurrentAction.chooserPlayerId, room.players[2].id);

  // 队友第一次只返还副牌，保留刚收到的两张主牌，供自己稍后发动时一并交回。
  const firstReturn = room.players[2].cards
    .filter(value => !isTrumpCard(value, 'spades', '2'))
    .slice(0, 5);
  engine.submitMainstayCards(room.players[2].id, firstActionId, firstReturn.map(value => value.id));
  assert.equal(room.gameState.mainstayCurrentAction.actorPlayerId, room.players[1].id);
  engine.respondMainstay(room.players[1].id, false);

  assert.equal(room.gameState.mainstayCurrentAction.actorPlayerId, room.players[2].id);
  assert.equal(room.gameState.mainstayCurrentAction.trumpCount, 4);
  const teammateActionId = room.gameState.mainstayCurrentAction.id;
  engine.respondMainstay(room.players[2].id, true);
  const allCurrentTeammateTrumps = engine.getMainstayTrumpCards(room.players[2]);
  assert.deepEqual(
    new Set(allCurrentTeammateTrumps.map(value => value.id)),
    new Set([...firstPlayerOriginalTrumps, ...teammateOriginalTrumps].map(value => value.id))
  );
  const teammateGive = [
    ...allCurrentTeammateTrumps,
    room.players[2].cards.find(value => !isTrumpCard(value, 'spades', '2'))
  ];
  engine.submitMainstayCards(
    room.players[2].id,
    teammateActionId,
    teammateGive.map(value => value.id)
  );

  const secondReturn = room.players[0].cards
    .filter(value => !isTrumpCard(value, 'spades', '2'))
    .slice(0, 5);
  engine.submitMainstayCards(room.players[0].id, teammateActionId, secondReturn.map(value => value.id));
  const firstPlayerHandIds = new Set(room.players[0].cards.map(value => value.id));
  [...firstPlayerOriginalTrumps, ...teammateOriginalTrumps]
    .forEach(value => assert.ok(firstPlayerHandIds.has(value.id), '主牌应已被队友全部交回'));

  assert.equal(room.gameState.mainstayCurrentAction.actorPlayerId, room.players[3].id);
  engine.respondMainstay(room.players[3].id, false);
  assert.equal(room.gameState.mainstayCurrentAction, null);
  assert.equal(room.gameState.mainstayPlayerQueue.length, 0);
  assert.equal(room.gameState.currentPlayerIndex, 0, '全部决定完成后恢复原定首发玩家');
  assert.equal(resumedTurns, 1);
  assert.deepEqual(
    room.gameState.mainstayResults.filter(result => result.accepted).map(result => result.playerId),
    [room.players[0].id, room.players[2].id]
  );
});

test('中流砥柱首轮交牌必须包含当前全部主牌，无主局则不进入流程', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = MAINSTAY_RULE;
  room.gameState.trumpSuit = 'hearts';
  room.gameState.trumpRank = '2';
  room.gameState.dealerPlayerIndex = 0;
  room.gameState.currentPlayerIndex = 0;
  room.gameState.roundStartPlayerIndex = 0;
  room.gameState.currentRound = 1;
  const firstHand = [
    card('hearts', '3', 2400), card('clubs', '2', 2401),
    card('clubs', '3', 2402), card('clubs', '4', 2403), card('clubs', '5', 2404),
    card('clubs', '6', 2405), card('clubs', '7', 2406)
  ];
  firstHand.forEach(value => room.players[0].addCard(value));
  room.players.slice(1).forEach((player, playerOffset) => {
    ['3', '4', '5', '6', '7'].forEach((rank, rankOffset) => {
      player.addCard(card('spades', rank, 2500 + playerOffset * 10 + rankOffset));
    });
  });

  engine.startMainstay();
  const actionId = room.gameState.mainstayCurrentAction.id;
  engine.respondMainstay(room.players[0].id, true);
  assert.throws(
    () => engine.submitMainstayCards(
      room.players[0].id,
      actionId,
      firstHand.filter(value => value.id !== firstHand[1].id).slice(0, 5).map(value => value.id)
    ),
    /必须包括当前全部主牌/
  );

  const noTrumpRoom = createRoom();
  const noTrumpIo = createIo();
  const noTrumpEngine = new GameEngine(noTrumpRoom, noTrumpIo);
  noTrumpRoom.gameState.phase = GamePhases.PLAYING;
  noTrumpRoom.gameState.selectedRule = MAINSTAY_RULE;
  noTrumpRoom.gameState.trumpSuit = 'no_trump';
  noTrumpRoom.gameState.currentPlayerIndex = 0;
  assert.equal(noTrumpEngine.startMainstay(), false);
  assert.equal(noTrumpRoom.gameState.mainstayCurrentAction, null);
  assert.ok(noTrumpIo.events.some(({ event, payload }) => (
    event === 'mainstay_completed' && payload.reason === 'no_trump'
  )));
});

test('中流砥柱以庄家为一号位开始，而不是固定从房间数组下标零开始', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = MAINSTAY_RULE;
  room.gameState.trumpSuit = 'hearts';
  room.gameState.trumpRank = '2';
  room.gameState.dealerPlayerIndex = 1;
  room.gameState.currentPlayerIndex = 1;
  room.gameState.roundStartPlayerIndex = 1;
  room.gameState.currentRound = 1;
  room.players.forEach((player, playerIndex) => {
    ['3', '4', '5', '6', '7'].forEach((rank, rankIndex) => {
      player.addCard(card('clubs', rank, 2600 + playerIndex * 10 + rankIndex));
    });
  });

  engine.startMainstay();

  assert.equal(room.gameState.mainstayCurrentAction.actorPlayerId, room.players[1].id);
  assert.equal(room.gameState.mainstayCurrentAction.position, 1);
  assert.deepEqual(
    room.gameState.mainstayPlayerQueue,
    [room.players[2].id, room.players[3].id, room.players[0].id]
  );
});

test('欢乐成双在庄家锁定后让庄家与原上家交换位置', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io);
  const originalPlayers = [...room.players];
  const dealer = originalPlayers[0];
  const originalUpstream = originalPlayers[3];
  room.gameState.phase = GamePhases.DRAWING;
  room.gameState.selectedRule = HAPPY_TWINS_RULE;
  room.gameState.pendingDealerPlayerId = dealer.id;
  room.gameState.dealerPlayerIndex = 0;

  assert.equal(engine.handleDealerSelected(dealer), false);

  assert.deepEqual(
    room.players.map(player => player.id),
    [originalUpstream.id, originalPlayers[1].id, originalPlayers[2].id, dealer.id]
  );
  assert.deepEqual(room.players.map(player => player.position), [0, 1, 2, 3]);
  assert.equal(room.gameState.dealerPlayerIndex, 3);
  assert.equal(room.gameState.happyTwins.dealerPlayerId, dealer.id);
  assert.equal(room.gameState.happyTwins.upstreamPlayerId, originalUpstream.id);
  assert.equal(room.gameState.happyTwins.restored, false);
  assert.ok(io.events.some(({ event, payload }) => (
    event === 'happy_twins_positions_swapped'
    && payload.dealerPlayerId === dealer.id
    && payload.upstreamPlayerId === originalUpstream.id
  )));
});

test('欢乐成双首局换位后按玩家身份迁移牌权，并仍由庄家本人首发', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io);
  const originalPlayers = [...room.players];
  const dealer = originalPlayers[2];
  const originalUpstream = originalPlayers[1];
  const buriedCard = card('clubs', '3', 2700);
  const openingCard = card('diamonds', '6', 2701);
  dealer.addCard(buriedCard);
  dealer.addCard(openingCard);

  room.gameState.phase = GamePhases.DRAWING;
  room.gameState.selectedRule = HAPPY_TWINS_RULE;
  room.gameState.pendingDealerPlayerId = dealer.id;
  room.gameState.dealerPlayerIndex = 2;
  // 模拟庄家锁定前已经按座位保存的行动状态；换位后这些状态必须继续跟随原玩家。
  room.gameState.currentPlayerIndex = 2;
  room.gameState.roundStartPlayerIndex = 2;
  room.gameState.currentWinnerIndex = 2;
  room.gameState.lastRoundWinnerIndex = 2;
  room.gameState.nextRuleChooserIndex = 2;

  engine.applyHappyTwinsPositionSwap(dealer);

  assert.deepEqual(
    room.players.map(player => player.id),
    [originalPlayers[0].id, dealer.id, originalUpstream.id, originalPlayers[3].id]
  );
  assert.equal(room.gameState.dealerPlayerIndex, 1);
  assert.equal(room.gameState.currentPlayerIndex, 1);
  assert.equal(room.gameState.roundStartPlayerIndex, 1);
  assert.equal(room.gameState.currentWinnerIndex, 1);
  assert.equal(room.gameState.lastRoundWinnerIndex, 1);
  assert.equal(room.gameState.nextRuleChooserIndex, 1);

  room.gameState.phase = GamePhases.BURYING;
  room.gameState.pendingDealerPlayerId = null;
  room.gameState.buryingPlayerId = dealer.id;
  room.gameState.bottomCardsCount = 1;
  const result = engine.buryCards(dealer.id, [buriedCard.id]);

  assert.equal(result.firstPlayer.id, dealer.id);
  assert.equal(room.gameState.firstPlayerId, dealer.id);
  assert.equal(room.gameState.currentPlayerIndex, room.getPlayerIndex(dealer.id));
  assert.equal(room.gameState.roundStartPlayerIndex, room.getPlayerIndex(dealer.id));
  assert.notEqual(result.firstPlayer.id, originalUpstream.id);
  assert.ok(io.events.some(({ event, payload }) => (
    event === 'first_player_set'
    && payload.playerId === dealer.id
    && payload.currentPlayerIndex === room.getPlayerIndex(dealer.id)
  )));
});

test('欢乐成双终局恢复原座次：庄家方胜由固定队友上庄，闲家胜由原上家上庄', () => {
  const setup = attackerScore => {
    const room = createRoom();
    const io = createIo();
    const engine = new GameEngine(room, io);
    const originalPlayers = [...room.players];
    const dealer = originalPlayers[0];
    room.gameState.team1Level = 7;
    room.gameState.team2Level = 10;
    room.gameState.phase = GamePhases.DRAWING;
    room.gameState.selectedRule = HAPPY_TWINS_RULE;
    room.gameState.pendingDealerPlayerId = dealer.id;
    room.gameState.dealerPlayerIndex = 0;
    engine.applyHappyTwinsPositionSwap(dealer);
    room.gameState.buryingPlayerId = dealer.id;
    room.gameState.attackerScore = attackerScore;
    room.gameState.lastRoundWinnerIndex = 0;
    room.gameState.lastRoundLeadingPattern = { type: PatternTypes.SINGLE, length: 1 };
    return { room, io, engine, originalPlayers, dealer };
  };

  const dealerWin = setup(40);
  const dealerWinResult = dealerWin.engine.calculateUpgrade();
  assert.equal(dealerWinResult.attackerWon, false);
  assert.equal(
    dealerWinResult.nextDealerName,
    dealerWin.originalPlayers[2].name,
    '换位不改变组队关系，庄家的原队友应成为下一庄'
  );
  assert.equal(dealerWinResult.nextDealerIndex, 2);
  assert.equal(dealerWinResult.oldDealerLevel, 7);
  assert.equal(dealerWinResult.nextDealerLevel, 8);
  assert.equal(dealerWin.room.gameState.team1Level, 8);
  assert.equal(dealerWin.room.gameState.team2Level, 10);
  assert.deepEqual(
    dealerWin.room.players.map(player => player.id),
    dealerWin.originalPlayers.map(player => player.id)
  );
  assert.equal(dealerWin.room.gameState.happyTwins.restored, true);

  const attackerWin = setup(120);
  const originalUpstream = attackerWin.originalPlayers[3];
  attackerWin.engine.finishGame();
  const attackerWinResult = attackerWin.room.gameState.upgradeResult;
  assert.equal(attackerWinResult.attackerWon, true);
  assert.equal(
    attackerWinResult.nextDealerName,
    originalUpstream.name,
    '交换后庄家的下家，也就是交换前的上家，应成为下一庄'
  );
  assert.equal(attackerWinResult.nextDealerIndex, 3);
  assert.equal(attackerWinResult.oldAttackerLevel, 10);
  assert.equal(attackerWinResult.nextDealerLevel, 11);
  assert.equal(attackerWin.room.gameState.team1Level, 7);
  assert.equal(attackerWin.room.gameState.team2Level, 11);
  assert.deepEqual(
    attackerWin.room.players.map(player => player.id),
    attackerWin.originalPlayers.map(player => player.id)
  );
  assert.equal(attackerWin.room.gameState.dealerPlayerIndex, 3);
  assert.equal(attackerWin.room.gameState.lastRoundWinnerIndex, 3);
  assert.equal(attackerWin.room.gameState.nextRuleChooserIndex, 3);
  assert.ok(attackerWin.io.events.some(({ event, payload }) => (
    event === 'happy_twins_positions_restored'
    && payload.nextDealerPlayerId === originalUpstream.id
    && payload.nextDealerIndex === 3
  )));
});

test('欢乐成双只换座位不换队伍：与庄家隔座的原闲家赢墩仍计入闲家分', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io);
  const originalPlayers = [...room.players];
  const player = originalPlayers[0];
  const dealer = originalPlayers[3];
  const originalTeammate = originalPlayers[2];

  room.gameState.phase = GamePhases.DRAWING;
  room.gameState.selectedRule = HAPPY_TWINS_RULE;
  room.gameState.pendingDealerPlayerId = dealer.id;
  room.gameState.dealerPlayerIndex = 3;
  engine.applyHappyTwinsPositionSwap(dealer);

  assert.deepEqual(
    room.players.map(currentPlayer => currentPlayer.id),
    [player.id, originalPlayers[1].id, dealer.id, originalTeammate.id],
    '庄家应与玩家的原队友换位并坐到玩家对面'
  );
  assert.deepEqual(room.gameState.toJSON().happyTwins.teamIndexByPlayerId, {
    [originalPlayers[0].id]: 0,
    [originalPlayers[1].id]: 1,
    [originalPlayers[2].id]: 0,
    [originalPlayers[3].id]: 1
  });

  const trickCards = [
    card('hearts', 'A', 910),
    card('hearts', '10', 911),
    card('hearts', 'K', 912),
    card('hearts', '5', 913)
  ];
  room.players.forEach((currentPlayer, index) => {
    currentPlayer.addCard(trickCards[index]);
    currentPlayer.addCard(card('clubs', String(index + 3), 920 + index));
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = dealer.id;
  engine.setFirstPlayer(player.id);

  engine.playCards(player.id, [trickCards[0].id]);
  engine.playCards(originalPlayers[1].id, [trickCards[1].id]);
  engine.playCards(dealer.id, [trickCards[2].id]);
  const result = engine.playCards(originalTeammate.id, [trickCards[3].id]);

  assert.equal(result.roundWinner.playerId, player.id);
  assert.equal(result.roundUpdate.scoreInfo.winnerIsAttacker, true);
  assert.equal(result.roundUpdate.scoreInfo.attackerRoundPointsAwarded, 25);
  assert.equal(room.gameState.attackerScore, 25);
  assert.deepEqual(
    room.gameState.collectedPointCards.map(currentCard => currentCard.id),
    [trickCards[1].id, trickCards[2].id, trickCards[3].id]
  );
});

test('围三阙一不影响摸牌阶段亮主', () => {
  const room = createRoom();
  const io = createIo();
  const handlers = new Map();
  const socketEvents = [];
  const player = room.players[0];
  room.gameState.phase = GamePhases.DRAWING;
  room.gameState.selectedRule = ENCIRCLE_THREE_MISSING_ONE_RULE;
  room.gameState.trumpRank = '2';
  player.cards = [card('hearts', '2', 940)];

  const socket = {
    id: player.socketId,
    on(event, handler) {
      handlers.set(event, handler);
    },
    emit(event, payload) {
      socketEvents.push({ event, payload });
    }
  };
  registerPlayerHandlers(io, socket, {
    getRoom: roomId => roomId === room.id ? room : null
  });

  handlers.get('declare_trump')({ roomId: room.id, suit: 'hearts', count: 1 });

  assert.equal(socketEvents.some(({ event }) => event === 'error'), false);
  assert.equal(room.gameState.currentTrumpDeclaration.playerId, player.id);
  assert.equal(room.gameState.trumpSuit, 'hearts');
  assert.deepEqual(room.gameState.encircleThreeMissingOneSeenSuits, []);
  assert.ok(io.events.some(({ event, payload }) => (
    event === 'trump_declared'
    && payload.playerId === player.id
    && payload.suit === 'hearts'
  )));
});

test('围三阙一按每次出牌即时记录，集齐三种普通花色后只从下一轮换主并重置记录', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io);
  const firstRoundCards = [
    card('hearts', '3', 950),
    card('clubs', '4', 951),
    card('diamonds', '5', 952),
    card('hearts', '6', 953)
  ];
  const reserveCards = [
    card('spades', '7', 960),
    card('spades', '8', 961),
    card('spades', '9', 962),
    card('clubs', '10', 963)
  ];
  room.players.forEach((player, index) => {
    player.addCard(firstRoundCards[index]);
    player.addCard(reserveCards[index]);
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = ENCIRCLE_THREE_MISSING_ONE_RULE;
  room.gameState.trumpSuit = 'hearts';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  engine.playCards(room.players[0].id, [firstRoundCards[0].id]);
  assert.deepEqual(room.gameState.encircleThreeMissingOneSeenSuits, ['hearts']);
  assert.equal(room.gameState.trumpSuit, 'hearts');

  engine.undoLastPlay(room.players[0].id);
  assert.deepEqual(
    room.gameState.encircleThreeMissingOneSeenSuits,
    [],
    '撤回出牌时必须同时撤回该次原子记录'
  );

  engine.playCards(room.players[0].id, [firstRoundCards[0].id]);
  engine.playCards(room.players[1].id, [firstRoundCards[1].id]);
  assert.deepEqual(room.gameState.encircleThreeMissingOneSeenSuits, ['hearts', 'clubs']);
  assert.equal(room.gameState.trumpSuit, 'hearts');

  engine.playCards(room.players[2].id, [firstRoundCards[2].id]);
  assert.deepEqual(
    room.gameState.encircleThreeMissingOneSeenSuits,
    ['hearts', 'clubs', 'diamonds']
  );
  assert.equal(room.gameState.trumpSuit, 'hearts', '第三种花色出现时本轮主花色不能立刻改变');

  const result = engine.playCards(room.players[3].id, [firstRoundCards[3].id]);
  const transition = result.roundUpdate.encircleThreeMissingOneTransition;

  assert.deepEqual(transition.recordedSuits, ['hearts', 'clubs', 'diamonds']);
  assert.equal(transition.missingSuit, 'spades');
  assert.equal(transition.previousTrumpSuit, 'hearts');
  assert.equal(transition.nextTrumpSuit, 'spades');
  assert.equal(transition.replaced, true);
  assert.equal(transition.effectiveRound, 2);
  assert.equal(room.gameState.trumpSuit, 'spades');
  assert.deepEqual(room.gameState.encircleThreeMissingOneSeenSuits, []);

  engine.recordEncircleThreeMissingOnePlay([
    card('joker', 'big_joker', 970),
    card('spades', '2', 971),
    card('hearts', '7', 972)
  ]);
  assert.deepEqual(room.gameState.encircleThreeMissingOneSeenSuits, ['hearts']);
  engine.recordEncircleThreeMissingOnePlay([card('clubs', '8', 973)]);
  engine.recordEncircleThreeMissingOnePlay([card('diamonds', '9', 974)]);
  const unchanged = engine.applyEncircleThreeMissingOneAtRoundEnd(2);
  assert.deepEqual(unchanged.recordedSuits, ['hearts', 'clubs', 'diamonds']);
  assert.equal(unchanged.missingSuit, 'spades');
  assert.equal(unchanged.replaced, false, '缺少的正是当前主花色时不得换主');
  assert.equal(room.gameState.trumpSuit, 'spades');
  assert.deepEqual(room.gameState.encircleThreeMissingOneSeenSuits, []);
  assert.equal(
    io.events.filter(({ event }) => event === 'trump_updated').length,
    1,
    '只有真正换主时才广播主花色更新'
  );
});

test('围三阙一一次出牌凑齐四种花色时清空整批记录并从下一次出牌重新记录', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  room.gameState.selectedRule = ENCIRCLE_THREE_MISSING_ONE_RULE;
  room.gameState.trumpRank = '2';

  const initial = engine.recordEncircleThreeMissingOnePlay([
    card('hearts', '3', 980),
    card('clubs', '4', 981)
  ]);
  assert.equal(initial.flushed, false);
  assert.deepEqual(room.gameState.encircleThreeMissingOneSeenSuits, ['hearts', 'clubs']);

  const flushed = engine.recordEncircleThreeMissingOnePlay([
    card('diamonds', '5', 982),
    card('spades', '6', 983),
    card('joker', 'big_joker', 984),
    card('hearts', '2', 985)
  ]);
  assert.equal(flushed.flushed, true);
  assert.deepEqual(flushed.previousSuits, ['hearts', 'clubs']);
  assert.deepEqual(flushed.addedSuits, ['diamonds', 'spades']);
  assert.deepEqual(flushed.seenSuits, []);
  assert.deepEqual(room.gameState.encircleThreeMissingOneSeenSuits, []);

  const restarted = engine.recordEncircleThreeMissingOnePlay([card('clubs', '7', 986)]);
  assert.equal(restarted.flushed, false);
  assert.deepEqual(restarted.seenSuits, ['clubs']);
  assert.deepEqual(room.gameState.encircleThreeMissingOneSeenSuits, ['clubs']);
});

test('三六九等把亮主与亮劣分成独立反亮链，并全桌锁定已用花色', () => {
  const room = createRoom();
  const io = createIo();
  room.gameState.phase = GamePhases.DRAWING;
  room.gameState.selectedRule = THREE_SIX_NINE_GRADES_RULE;
  room.gameState.trumpRank = '2';
  room.players[0].cards = [card('hearts', '2', 990), card('hearts', '2', 991)];
  room.players[1].cards = [
    card('hearts', '2', 992), card('hearts', '2', 993), card('clubs', '2', 994)
  ];
  room.players[2].cards = [card('diamonds', '2', 995), card('diamonds', '2', 996)];
  room.players[3].cards = [card('joker', 'small_joker', 997), card('joker', 'small_joker', 998)];

  const connect = player => {
    const handlers = new Map();
    const emitted = [];
    registerPlayerHandlers(io, {
      id: player.socketId,
      on(event, handler) {
        handlers.set(event, handler);
      },
      emit(event, payload) {
        emitted.push({ event, payload });
      }
    }, {
      getRoom: roomId => roomId === room.id ? room : null
    });
    return { handlers, emitted };
  };
  const sockets = room.players.map(connect);
  const declare = (playerIndex, suit, count, declarationRole) => {
    const socket = sockets[playerIndex];
    const before = socket.emitted.length;
    socket.handlers.get('declare_trump')({
      roomId: room.id,
      suit,
      count,
      declarationRole
    });
    return socket.emitted.slice(before);
  };

  assert.equal(declare(0, 'hearts', 1, 'trump').some(event => event.event === 'error'), false);
  assert.equal(room.gameState.trumpSuit, 'hearts');
  assert.equal(room.gameState.threeSixNineClaimedSuits.get('hearts').declarationRole, 'trump');

  const blocked = declare(1, 'hearts', 2, 'inferior');
  assert.match(blocked.at(-1).payload.message, /已经用于亮主或亮劣/);
  assert.equal(room.gameState.currentInferiorDeclaration, null);

  assert.equal(declare(0, 'hearts', 2, 'trump').some(event => event.event === 'error'), false);
  assert.equal(room.gameState.currentTrumpDeclaration.count, 2, '原声明者仍可用第二张同花色级牌加固');

  assert.equal(declare(1, 'clubs', 1, 'inferior').some(event => event.event === 'error'), false);
  assert.equal(room.gameState.inferiorSuit, 'clubs');
  assert.equal(room.gameState.currentInferiorDeclaration.playerId, room.players[1].id);

  assert.equal(declare(2, 'diamonds', 2, 'inferior').some(event => event.event === 'error'), false);
  assert.equal(room.gameState.inferiorSuit, 'diamonds');
  assert.equal(room.gameState.currentInferiorDeclaration.playerId, room.players[2].id);
  assert.deepEqual(
    Object.keys(room.gameState.toJSON().threeSixNine.claimedSuits).sort(),
    ['clubs', 'diamonds', 'hearts']
  );

  const jokerInferior = declare(3, 'joker', 2, 'inferior');
  assert.match(jokerInferior.at(-1).payload.message, /王只能用于亮主/);
  assert.ok(io.events.some(({ event, payload }) => (
    event === 'trump_declared'
    && payload.declarationRole === 'inferior'
    && payload.suit === 'diamonds'
  )));

  const jokerTrump = declare(3, 'joker', 2, 'trump');
  assert.equal(jokerTrump.some(event => event.event === 'error'), false);
  assert.equal(room.gameState.trumpSuit, 'no_trump');
  assert.equal(room.gameState.currentTrumpDeclaration.suit, 'joker');
  assert.equal(room.gameState.currentInferiorDeclaration, null);
  assert.equal(room.gameState.inferiorSuit, null);
});

test('三六九等无人亮主而自然无主时保留已经亮出的劣花色', () => {
  const room = createRoom();
  const io = createIo();
  room.gameState.phase = GamePhases.DRAWING;
  room.gameState.selectedRule = THREE_SIX_NINE_GRADES_RULE;
  room.gameState.trumpRank = '2';
  room.gameState.currentInferiorDeclaration = {
    playerId: room.players[1].id,
    playerName: room.players[1].name,
    suit: 'clubs',
    count: 1,
    declarationType: 'single_rank',
    strength: 1,
    declarationRole: 'inferior',
    cards: [card('clubs', '2', 1000)]
  };
  room.gameState.inferiorSuit = 'clubs';
  room.gameState.dealerPlayerIndex = 0;

  const drawingManager = new DrawingPhaseManager(room, io);
  drawingManager.assignDealer();

  assert.equal(room.gameState.currentTrumpDeclaration, null);
  assert.equal(room.gameState.currentInferiorDeclaration?.suit, 'clubs');
  assert.equal(room.gameState.inferiorSuit, 'clubs');
  assert.ok(io.events.some(({ event, payload }) => (
    event === 'three_six_nine_updated'
    && payload.locked === true
    && payload.inferiorSuit === 'clubs'
    && payload.currentInferiorDeclaration?.suit === 'clubs'
  )));
});

test('三六九等按主牌、普通副牌、劣牌分层比较，劣花色级牌低于其他副级牌', () => {
  const trumpSuit = 'spades';
  const trumpRank = '2';
  const rule = { ...THREE_SIX_NINE_GRADES_RULE, inferiorSuit: 'hearts' };
  const trumpAce = card('spades', 'A', 1010);
  const inferiorLevel = card('hearts', '2', 1011);
  const sideLevel = card('clubs', '2', 1012);
  const trumpLevel = card('spades', '2', 1013);

  assert.equal(getCardStrength(trumpAce, trumpSuit, trumpRank, rule), 995);
  assert.equal(getCardStrength(inferiorLevel, trumpSuit, trumpRank, rule), 996);
  assert.equal(getCardStrength(sideLevel, trumpSuit, trumpRank, rule), 997);
  assert.equal(getCardStrength(trumpLevel, trumpSuit, trumpRank, rule), 998);

  const inferiorAce = singlePlay(card('hearts', 'A', 1020), trumpSuit, trumpRank, rule);
  const lowClub = singlePlay(card('clubs', '3', 1021), trumpSuit, trumpRank, rule);
  const highClub = singlePlay(card('clubs', 'K', 1022), trumpSuit, trumpRank, rule);
  const highDiamond = singlePlay(card('diamonds', 'A', 1023), trumpSuit, trumpRank, rule);

  assert.equal(
    compareCards(lowClub, inferiorAce, 'hearts', trumpSuit, trumpRank, rule),
    1,
    '任意合法普通副花色都能毙劣花色'
  );
  assert.equal(
    compareCards(inferiorAce, lowClub, 'clubs', trumpSuit, trumpRank, rule),
    -1,
    '劣花色不能反过来毙普通副花色'
  );
  assert.equal(
    compareCards(highClub, lowClub, 'hearts', trumpSuit, trumpRank, rule),
    1,
    '同一普通副花色连续毙牌时仍按点数比较'
  );
  assert.equal(
    compareCards(highDiamond, lowClub, 'hearts', trumpSuit, trumpRank, rule),
    0,
    '不同普通副花色彼此不可比较，保留先毙者'
  );

  const inferiorTractorCards = [
    card('hearts', '3', 1030), card('hearts', '3', 1031),
    card('hearts', '4', 1032), card('hearts', '4', 1033)
  ];
  const brokenClubRuffCards = [
    card('clubs', '5', 1040), card('clubs', '5', 1041),
    card('clubs', '7', 1042), card('clubs', '7', 1043)
  ];
  const clubTractorCards = [
    card('clubs', '5', 1050), card('clubs', '5', 1051),
    card('clubs', '6', 1052), card('clubs', '6', 1053)
  ];
  const asPlay = cards => ({
    cards,
    pattern: detectPattern(cards, trumpSuit, trumpRank, rule)
  });
  assert.equal(
    compareCards(
      asPlay(brokenClubRuffCards),
      asPlay(inferiorTractorCards),
      'hearts',
      trumpSuit,
      trumpRank,
      rule
    ),
    -1,
    '普通副牌毙劣牌时也必须满足拖拉机结构'
  );
  assert.equal(
    compareCards(
      asPlay(clubTractorCards),
      asPlay(inferiorTractorCards),
      'hearts',
      trumpSuit,
      trumpRank,
      rule
    ),
    1,
    '结构匹配的普通副牌拖拉机可以毙劣牌拖拉机'
  );
});

test('铁证如山只识别小王、红桃Q、黑桃J、梅花J，并按实体张数增加倍数', () => {
  const cards = [
    card('joker', 'small_joker', 1060),
    card('joker', 'small_joker', 1061),
    card('hearts', 'Q', 1062),
    card('spades', 'J', 1063),
    card('clubs', 'J', 1064),
    card('clubs', 'K', 1065)
  ];
  assert.deepEqual(cards.map(isIronEvidenceSpecialCard), [true, true, true, true, true, false]);
  assert.deepEqual(
    calculateIronEvidenceRoundScoring(cards, 15, IronEvidenceModes.MULTIPLY),
    {
      mode: IronEvidenceModes.MULTIPLY,
      specialCardCount: 5,
      multiplier: 6,
      baseRoundPoints: 15,
      roundPoints: 90
    }
  );
  assert.equal(
    calculateIronEvidenceRoundScoring(cards, 15, IronEvidenceModes.ZERO).roundPoints,
    0
  );
  assert.deepEqual(
    calculateIronEvidenceRoundScoring([], 15, IronEvidenceModes.ZERO),
    {
      mode: IronEvidenceModes.ZERO,
      specialCardCount: 0,
      multiplier: 1,
      baseRoundPoints: 15,
      roundPoints: 15
    }
  );
});

test('铁证如山在轮初锁定效果：本轮打完两张大王仍翻倍，之后有铁证才清零', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io);
  room.gameState.selectedRule = IRON_EVIDENCE_RULE;
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  room.players[0].cards = [
    card('hearts', '5', 1070), card('clubs', '3', 1071), card('diamonds', '3', 1078)
  ];
  room.players[1].cards = [
    card('joker', 'small_joker', 1072), card('clubs', '4', 1073), card('diamonds', '4', 1079)
  ];
  room.players[2].cards = [
    card('joker', 'big_joker', 1074), card('clubs', '5', 1075), card('diamonds', '5', 1085)
  ];
  room.players[3].cards = [
    card('joker', 'big_joker', 1076), card('spades', 'J', 1077), card('diamonds', '6', 1086)
  ];
  engine.setFirstPlayer(room.players[0].id);

  engine.playCards(room.players[0].id, [room.players[0].cards[0].id]);
  engine.playCards(room.players[1].id, [room.players[1].cards[0].id]);
  engine.playCards(room.players[2].id, [room.players[2].cards[0].id]);
  const firstRound = engine.playCards(room.players[3].id, [room.players[3].cards[0].id]);

  assert.equal(firstRound.roundUpdate.scoreInfo.baseRoundPoints, 5);
  assert.equal(firstRound.roundUpdate.scoreInfo.roundPoints, 10);
  assert.deepEqual(firstRound.roundUpdate.scoreInfo.ironEvidence, {
    round: 1,
    mode: IronEvidenceModes.MULTIPLY,
    specialCardCount: 1,
    multiplier: 2,
    baseRoundPoints: 5,
    roundPoints: 10,
    winnerPlayerId: room.players[2].id,
    winnerPlayerName: room.players[2].name,
    winnerIsAttacker: false
  });
  assert.equal(room.gameState.ironEvidencePlayedBigJokerIds.size, 2);
  assert.equal(room.gameState.ironEvidenceRoundMode, IronEvidenceModes.ZERO);

  engine.playCards(room.players[2].id, [room.players[2].cards[0].id]);
  engine.playCards(room.players[3].id, [room.players[3].cards[0].id]);
  engine.playCards(room.players[0].id, [room.players[0].cards[0].id]);
  const secondRound = engine.playCards(room.players[1].id, [room.players[1].cards[0].id]);

  assert.equal(secondRound.roundUpdate.scoreInfo.baseRoundPoints, 5);
  assert.equal(secondRound.roundUpdate.scoreInfo.roundPoints, 0);
  assert.equal(secondRound.roundUpdate.scoreInfo.ironEvidence.mode, IronEvidenceModes.ZERO);
  assert.equal(secondRound.roundUpdate.scoreInfo.ironEvidence.specialCardCount, 1);
  assert.equal(secondRound.roundUpdate.scoreInfo.ironEvidence.multiplier, 0);
  assert.equal(room.gameState.attackerScore, 0);

  engine.playCards(room.players[3].id, [room.players[3].cards[0].id]);
  engine.playCards(room.players[0].id, [room.players[0].cards[0].id]);
  engine.playCards(room.players[1].id, [room.players[1].cards[0].id]);
  const thirdRound = engine.playCards(room.players[2].id, [room.players[2].cards[0].id]);

  assert.equal(thirdRound.roundUpdate.scoreInfo.baseRoundPoints, 5);
  assert.equal(thirdRound.roundUpdate.scoreInfo.roundPoints, 5);
  assert.equal(thirdRound.roundUpdate.scoreInfo.ironEvidence.mode, IronEvidenceModes.ZERO);
  assert.equal(thirdRound.roundUpdate.scoreInfo.ironEvidence.specialCardCount, 0);
  assert.equal(thirdRound.roundUpdate.scoreInfo.ironEvidence.multiplier, 1);
  assert.equal(room.gameState.attackerScore, 5);
});

test('铁证如山撤回大王时同步撤销已打出记录', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io);
  room.gameState.selectedRule = IRON_EVIDENCE_RULE;
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  const bigJoker = card('joker', 'big_joker', 1080);
  room.players[0].cards = [bigJoker, card('clubs', '3', 1081)];
  room.players[1].cards = [card('clubs', '4', 1082)];
  room.players[2].cards = [card('clubs', '5', 1083)];
  room.players[3].cards = [card('clubs', '6', 1084)];
  engine.setFirstPlayer(room.players[0].id);

  engine.playCards(room.players[0].id, [bigJoker.id]);
  assert.equal(room.gameState.ironEvidencePlayedBigJokerIds.size, 1);
  engine.undoLastPlay(room.players[0].id);
  assert.equal(room.gameState.ironEvidencePlayedBigJokerIds.size, 0);
});

test('守株待兔允许把5、10、K设为目标，但拒绝王和当前级牌', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io, () => 0);
  room.gameState.selectedRule = WAITING_RABBIT_RULE;
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  room.players.forEach((player, index) => {
    player.cards = [card('clubs', String(index + 3), 1090 + index)];
  });
  engine.setFirstPlayer(room.players[0].id);
  engine.activateWaitingRabbit();

  const options = engine.getWaitingRabbitSelectionOptions();
  assert.ok(options.eligibleRanks.includes('5'));
  assert.ok(options.eligibleRanks.includes('10'));
  assert.ok(options.eligibleRanks.includes('K'));
  assert.ok(!options.eligibleRanks.includes('2'));
  assert.ok(!options.eligibleRanks.includes('small_joker'));

  for (const levelRank of ['5', '10', 'K']) {
    room.gameState.trumpRank = levelRank;
    const levelOptions = engine.getWaitingRabbitSelectionOptions();
    assert.ok(!levelOptions.eligibleRanks.includes(levelRank));
    assert.throws(
      () => engine.selectWaitingRabbitTarget(room.players[0].id, 'hearts', levelRank),
      /当前级牌/
    );
  }
  room.gameState.trumpRank = '2';

  engine.selectWaitingRabbitTarget(room.players[0].id, 'hearts', '5');
  engine.selectWaitingRabbitTarget(room.players[1].id, 'diamonds', '10');
  engine.selectWaitingRabbitTarget(room.players[2].id, 'clubs', 'K');
  engine.selectWaitingRabbitTarget(room.players[3].id, 'spades', 'A');
  assert.equal(engine.hasPendingWaitingRabbitSelection(), false);
  assert.deepEqual(
    room.gameState.waitingRabbitDeclarationsByPlayerId.get(room.players[2].id),
    { suit: 'clubs', rank: 'K' }
  );
  assert.equal(
    Object.hasOwn(room.gameState.toJSON().waitingRabbit, 'declarationsByPlayerId'),
    false,
    '公共快照不能泄露暗选牌面'
  );
  const publicRecords = room.gameState.toJSON().waitingRabbit.behaviorRecords;
  assert.deepEqual(publicRecords.map(record => record.type), [
    'target_locked',
    'target_locked',
    'target_locked',
    'target_locked'
  ]);
  assert.equal(
    publicRecords.some(record => record.suit || record.rank || record.targetCard),
    false,
    '暗选行为记录也不能泄露目标牌面'
  );
});

test('守株待兔只在轮末换牌，目标先参与本轮结算且分牌实体只在首次上桌时计分', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io);
  room.gameState.selectedRule = WAITING_RABBIT_RULE;
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;

  const targetFive = card('hearts', '5', 1100);
  const sourceSecondCard = card('hearts', '3', 1101);
  const discardThree = card('clubs', '3', 1102);
  const followerAce = card('clubs', 'A', 1103);
  const forbiddenDiscardKing = card('diamonds', 'K', 1104);
  const followerClubFour = card('clubs', '4', 1105);
  const followerHeartFour = card('hearts', '4', 1106);
  const followerClubSix = card('clubs', '6', 1107);
  const followerHeartSix = card('hearts', '6', 1108);

  room.players[0].cards = [targetFive, sourceSecondCard];
  room.players[1].cards = [discardThree, followerAce, forbiddenDiscardKing];
  room.players[2].cards = [followerClubFour, followerHeartFour];
  room.players[3].cards = [followerClubSix, followerHeartSix];
  engine.setFirstPlayer(room.players[0].id);
  room.gameState.waitingRabbitDeclarationsByPlayerId = new Map([
    [room.players[0].id, { suit: 'diamonds', rank: 'A' }],
    [room.players[1].id, { suit: 'hearts', rank: '5' }],
    [room.players[2].id, { suit: 'diamonds', rank: '10' }],
    [room.players[3].id, { suit: 'clubs', rank: 'K' }]
  ]);
  room.gameState.waitingRabbitPendingSelectionPlayerIds.clear();

  const firstPlay = engine.playCards(room.players[0].id, [targetFive.id]);
  assert.equal(firstPlay.waitingRabbitDecision, null);
  assert.equal(engine.hasPendingWaitingRabbitDecision(), false);
  assert.equal(room.players[0].cards.some(currentCard => currentCard.id === targetFive.id), false);
  engine.playCards(room.players[1].id, [followerAce.id]);
  engine.playCards(room.players[2].id, [followerHeartFour.id]);
  const firstRound = engine.playCards(room.players[3].id, [followerHeartSix.id]);

  assert.equal(firstRound.roundUpdate.type, 'round_ended');
  assert.equal(firstRound.waitingRabbitDecision.chooserPlayerId, room.players[1].id);
  assert.equal(engine.hasPendingWaitingRabbitDecision(), true);
  assert.equal(firstRound.roundWinner.playerId, room.players[3].id);
  assert.equal(firstRound.roundUpdate.scoreInfo.baseRoundPoints, 5);
  assert.deepEqual(
    firstRound.roundUpdate.scoreInfo.roundPointCards.map(currentCard => currentCard.id),
    [targetFive.id]
  );
  assert.equal(room.gameState.attackerScore, 5);

  assert.throws(
    () => engine.resolveWaitingRabbitDecision(room.players[1].id, {
      accept: true,
      discardCardId: forbiddenDiscardKing.id
    }),
    /非分牌/
  );
  assert.equal(engine.hasPendingWaitingRabbitDecision(), true);

  const { roundResult: exchanged } = engine.resolveWaitingRabbitDecision(
    room.players[1].id,
    { accept: true, discardCardId: discardThree.id }
  );
  assert.equal(exchanged.waitingRabbitResolution.accepted, true);
  assert.deepEqual(
    exchanged.waitingRabbitResolution.tableCards.map(currentCard => currentCard.id),
    [discardThree.id]
  );
  assert.equal(room.gameState.lastRoundWinnerIndex, room.getPlayerIndex(room.players[3].id));
  assert.equal(room.gameState.attackerScore, 5, '轮末换牌不能倒改已结算分数');
  assert.equal(room.players[1].cards.some(currentCard => currentCard.id === targetFive.id), true);
  assert.equal(room.players[1].cards.some(currentCard => currentCard.id === discardThree.id), false);
  assert.equal(room.gameState.waitingRabbitUsedPlayerIds.has(room.players[1].id), true);
  const behaviorRecords = room.gameState.toJSON().waitingRabbit.behaviorRecords;
  assert.deepEqual(
    behaviorRecords.map(record => record.type),
    ['target_triggered', 'target_exchanged']
  );
  assert.equal(behaviorRecords[0].targetCard.id, targetFive.id);
  assert.equal(behaviorRecords[1].discardedCard.id, discardThree.id);

  engine.playCards(room.players[3].id, [followerClubSix.id]);
  engine.playCards(room.players[0].id, [sourceSecondCard.id]);
  engine.playCards(room.players[1].id, [targetFive.id]);
  const secondRound = engine.playCards(room.players[2].id, [followerClubFour.id]);
  assert.equal(secondRound.roundUpdate.scoreInfo.baseRoundPoints, 0);
  assert.deepEqual(secondRound.roundUpdate.scoreInfo.roundPointCards, []);
  assert.equal(room.gameState.attackerScore, 5);
});

test('换牌期间即使客户端直接发送亮主事件也会被服务端拒绝', () => {
  const room = createRoom();
  const io = createIo();
  const handlers = new Map();
  const socketEvents = [];
  const socket = {
    id: room.players[0].socketId,
    on(event, handler) {
      handlers.set(event, handler);
    },
    emit(event, payload) {
      socketEvents.push({ event, payload });
    }
  };
  registerPlayerHandlers(io, socket, { getRoom: roomId => roomId === room.id ? room : null });
  room.gameState.phase = GamePhases.DRAWING;
  room.gameState.isTrumpDeclarationLocked = true;
  room.gameState.cardExchange = { requiredCards: 2 };

  handlers.get('declare_trump')({ roomId: room.id, suit: 'diamonds', count: 1 });

  assert.deepEqual(socketEvents.at(-1), {
    event: 'error',
    payload: { message: '亮主和反主阶段已经结束' }
  });
  assert.equal(room.gameState.currentTrumpDeclaration, null);
});

test('开局换牌拒绝数量错误、重复牌、非手牌和重复提交', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  room.gameState.phase = GamePhases.DRAWING;
  room.gameState.selectedRule = getRuleById(RuleIds.NEWS_MINISTER_II);
  room.players.forEach((player, index) => {
    player.addCard(card('spades', String(index + 2), index));
    player.addCard(card('hearts', String(index + 2), index));
    player.addCard(card('clubs', String(index + 2), index));
  });
  engine.startOpeningCardExchange();

  const player = room.players[0];
  assert.throws(() => engine.submitOpeningCardExchange(player.id, [player.cards[0].id]), /必须选择2张牌/);
  assert.throws(
    () => engine.submitOpeningCardExchange(player.id, [player.cards[0].id, player.cards[0].id]),
    /不能重复选择/
  );
  assert.throws(
    () => engine.submitOpeningCardExchange(player.id, [player.cards[0].id, 'not-in-hand']),
    /不在手中/
  );
  engine.submitOpeningCardExchange(player.id, player.cards.slice(0, 2).map(value => value.id));
  assert.throws(
    () => engine.submitOpeningCardExchange(player.id, player.cards.slice(0, 2).map(value => value.id)),
    /已经确认过换牌/
  );
});

test('选择底牌规则后立即写入本局底牌数和闲家初始分，重置后恢复默认', () => {
  const cases = [
    [RuleIds.ABUNDANT_HARVEST, 12, 30],
    [RuleIds.EXTREME_CHALLENGE, 16, 60],
    [RuleIds.HALF_REALM, 4, -10],
    [RuleIds.SHARED_PROSPERITY, 0, -20],
    [RuleIds.PERFECT_STRATEGY, 8, 10]
  ];

  for (const [ruleId, bottomCardsCount, attackerStartingScore] of cases) {
    const room = createRoom();
    const engine = new GameEngine(room, createIo());
    const chooser = room.players[0];
    const rule = getRuleById(ruleId);
    room.gameState.isWaitingForReady = true;
    room.gameState.isRuleSelectionPending = true;
    room.gameState.ruleChooserPlayerId = chooser.id;
    room.gameState.ruleOptions = [rule, NORMAL_RULE];

    engine.selectRule(chooser.id, rule);

    assert.equal(room.gameState.bottomCardsCount, bottomCardsCount);
    assert.equal(room.gameState.attackerScore, attackerStartingScore);
    assert.equal(room.gameState.toJSON().bottomCardsCount, bottomCardsCount);

    room.gameState.reset();
    assert.equal(room.gameState.bottomCardsCount, 8);
    assert.equal(room.gameState.attackerScore, 0);
  }
});

test('迷雾重重按洗牌后牌堆顶移除八张，牌面在终局前不进入公开状态', () => {
  const room = createRoom();
  const io = createIo();
  const manager = new DrawingPhaseManager(room, io);
  const orderedDeck = DeckService.createDeck();
  const originalShuffle = DeckService.shuffle;
  room.gameState.selectedRule = HEAVY_FOG_RULE;
  room.gameState.bottomCardsCount = 8;

  try {
    DeckService.shuffle = deck => [...deck];
    manager.start();
    manager.stop();
  } finally {
    DeckService.shuffle = originalShuffle;
  }

  assert.deepEqual(
    room.gameState.mistyFogCards.map(value => value.id),
    orderedDeck.slice(0, 8).map(value => value.id)
  );
  assert.deepEqual(
    room.gameState.bottomCards.map(value => value.id),
    orderedDeck.slice(8, 16).map(value => value.id)
  );
  assert.deepEqual(
    room.gameState.deck.map(value => value.id),
    orderedDeck.slice(16).map(value => value.id)
  );
  assert.equal(room.gameState.deck.length, 92);
  assert.equal(room.gameState.deck.length % room.players.length, 0);
  assert.equal(Object.hasOwn(room.gameState.toJSON(), 'mistyFogCards'), false);

  const drawingStarted = io.events.find(({ event }) => event === 'drawing_started');
  assert.equal(drawingStarted.payload.removedCardsCount, 8);
  assert.equal(Object.hasOwn(drawingStarted.payload, 'mistyFogCards'), false);
  assert.equal(Object.hasOwn(drawingStarted.payload, 'cards'), false);
});

test('迷雾牌在逐墩分与底牌分之后公开补一半分，再据最终总分计算升级', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  room.gameState.selectedRule = HEAVY_FOG_RULE;
  room.gameState.buryingPlayerId = room.players[0].id;
  room.gameState.dealerPlayerIndex = 0;
  room.gameState.attackerScore = 60;
  room.gameState.bottomCards = [
    card('diamonds', '5', 40),
    card('clubs', '2', 40)
  ];
  room.gameState.mistyFogCards = [
    card('hearts', '5', 41),
    card('hearts', '10', 41),
    card('hearts', 'K', 41),
    card('hearts', '3', 41)
  ];
  room.gameState.lastRoundWinnerIndex = 1;
  room.gameState.lastRoundLeadingPattern = {
    type: PatternTypes.SINGLE,
    length: 1
  };

  assert.equal(Object.hasOwn(room.gameState.toJSON(), 'mistyFogCards'), false);
  engine.finishGame();

  assert.equal(room.gameState.bottomScoreResult.scoreBeforeMistyFog, 70);
  assert.equal(room.gameState.bottomScoreResult.mistyFogPoints, 25);
  assert.equal(room.gameState.bottomScoreResult.mistyFogBonus, 12.5);
  assert.equal(room.gameState.bottomScoreResult.totalScore, 82.5);
  assert.equal(room.gameState.attackerScore, 82.5);
  assert.deepEqual(
    room.gameState.bottomScoreResult.mistyFogCards.map(value => value.id),
    room.gameState.mistyFogCards.map(value => value.id)
  );
  assert.equal(room.gameState.upgradeResult.attackerWon, true);
});

test('发牌阶段按本局规则预留底牌并保证四家手牌可均分', () => {
  for (const bottomCardsCount of [0, 4, 8, 12, 16]) {
    const room = createRoom();
    const manager = new DrawingPhaseManager(room, createIo());
    room.gameState.bottomCardsCount = bottomCardsCount;

    manager.start();
    manager.stop();

    assert.equal(room.gameState.bottomCards.length, bottomCardsCount);
    assert.equal(room.gameState.deck.length, 108 - bottomCardsCount);
    assert.equal(room.gameState.deck.length % room.players.length, 0);
  }
});

test('昭然若揭从摸牌开始公开底牌，普通规则的公开状态仍不泄露牌面', () => {
  const room = createRoom();
  const io = createIo();
  const manager = new DrawingPhaseManager(room, io);
  const orderedDeck = DeckService.createDeck();
  const originalShuffle = DeckService.shuffle;
  room.gameState.selectedRule = OPENLY_REVEALED_RULE;

  try {
    DeckService.shuffle = deck => [...deck];
    manager.start();
    manager.stop();
  } finally {
    DeckService.shuffle = originalShuffle;
  }

  const expectedBottomCards = orderedDeck.slice(0, room.gameState.bottomCardsCount)
    .map(value => value.toJSON());
  const drawingStarted = io.events.find(({ event }) => event === 'drawing_started');
  assert.deepEqual(drawingStarted.payload.publicBottomCards, expectedBottomCards);
  assert.deepEqual(room.gameState.toJSON().publicBottomCards, expectedBottomCards);

  room.gameState.selectedRule = NORMAL_RULE;
  assert.equal(Object.hasOwn(room.gameState.toJSON(), 'publicBottomCards'), false);

  const normalRoom = createRoom();
  const normalIo = createIo();
  const normalManager = new DrawingPhaseManager(normalRoom, normalIo);
  normalRoom.gameState.selectedRule = NORMAL_RULE;
  normalManager.start();
  normalManager.stop();
  const normalDrawingStarted = normalIo.events.find(({ event }) => event === 'drawing_started');
  assert.equal(Object.hasOwn(normalDrawingStarted.payload, 'publicBottomCards'), false);
});

test('昭然若揭允许非庄家随时请求查看当前底牌', () => {
  const room = createRoom();
  room.gameState.selectedRule = OPENLY_REVEALED_RULE;
  room.gameState.buryingPlayerId = room.players[0].id;
  room.gameState.bottomCards = [card('hearts', '5', 810), card('spades', 'A', 811)];
  const handlers = new Map();
  const emitted = [];
  const socket = {
    id: room.players[1].socketId,
    on(event, handler) {
      handlers.set(event, handler);
    },
    emit(event, payload) {
      emitted.push({ event, payload });
    }
  };

  registerGameHandlers(createIo(), socket, { getRoom: roomId => roomId === room.id ? room : null });
  handlers.get('view_my_bottom_cards')({ roomId: room.id });

  const response = emitted.find(({ event }) => event === 'my_bottom_cards');
  assert.equal(response.payload.isPublic, true);
  assert.deepEqual(
    response.payload.bottomCards,
    room.gameState.bottomCards.map(value => value.toJSON())
  );
  assert.equal(emitted.some(({ event }) => event === 'error'), false);
});

test('计划经济开局只发每人20张，20张封存牌在埋底完成前不会摸取', () => {
  const room = createRoom();
  const io = createIo();
  const manager = new DrawingPhaseManager(room, io);
  const engine = new GameEngine(room, io);
  room.gameState.selectedRule = PLANNED_ECONOMY_RULE;

  manager.start();
  manager.stop();

  assert.equal(room.gameState.bottomCards.length, 8);
  assert.equal(room.gameState.deck.length, 80);
  assert.equal(room.gameState.plannedEconomyReserveCards.length, 20);
  const drawingStarted = io.events.find(({ event }) => event === 'drawing_started');
  assert.equal(drawingStarted.payload.totalCards, 80);
  assert.equal(drawingStarted.payload.reservedCardsCount, 20);

  while (room.gameState.drawingIndex < room.gameState.deck.length) {
    manager.dealOneCard();
  }
  assert.deepEqual(room.players.map(player => player.cards.length), [20, 20, 20, 20]);
  assert.equal(room.gameState.plannedEconomyReserveCards.length, 20);

  room.gameState.phase = GamePhases.BURYING;
  assert.equal(engine.drawPlannedEconomyRoundCards(0), null);
  assert.equal(room.gameState.plannedEconomyReserveCards.length, 20);
  assert.deepEqual(room.players.map(player => player.cards.length), [20, 20, 20, 20]);
});

test('计划经济从第一轮结束起四家各摸1张，摸完封存牌后停止', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const trickCards = [
    card('hearts', '3', 200),
    card('hearts', '4', 201),
    card('hearts', '5', 202),
    card('hearts', '6', 203)
  ];
  const spareCards = [
    card('clubs', '7', 204),
    card('clubs', '8', 205),
    card('clubs', '9', 206),
    card('clubs', '10', 207)
  ];
  const reservedCards = [
    card('diamonds', 'J', 208),
    card('diamonds', 'Q', 209),
    card('diamonds', 'K', 210),
    card('diamonds', 'A', 211)
  ];
  room.players.forEach((player, index) => {
    player.addCard(trickCards[index]);
    player.addCard(spareCards[index]);
  });
  room.gameState.selectedRule = PLANNED_ECONOMY_RULE;
  room.gameState.plannedEconomyReserveCards = [...reservedCards];
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  engine.playCards(room.players[0].id, [trickCards[0].id]);
  engine.playCards(room.players[1].id, [trickCards[1].id]);
  engine.playCards(room.players[2].id, [trickCards[2].id]);
  const result = engine.playCards(room.players[3].id, [trickCards[3].id]);

  assert.equal(result.gameFinished, false);
  assert.equal(result.plannedEconomyDraw.round, 1);
  assert.equal(result.plannedEconomyDraw.drawCount, 4);
  assert.equal(result.plannedEconomyDraw.remainingCards, 0);
  assert.deepEqual(
    result.plannedEconomyDraw.draws.map(draw => draw.playerId),
    room.players.map(player => player.id)
  );
  assert.deepEqual(room.players.map(player => player.cards.length), [2, 2, 2, 2]);
  assert.ok(room.players.every((player, index) => player.cards.some(value => value.id === reservedCards[index].id)));
  assert.deepEqual(result.roundUpdate.plannedEconomyDraw, {
    round: 1,
    drawCount: 4,
    remainingCards: 0
  });
  assert.deepEqual(room.gameState.toJSON().plannedEconomy, {
    totalReservedCards: 20,
    remainingCards: 0,
    completedDrawRounds: 1,
    isDrawingEnabled: true
  });
  assert.equal(engine.drawPlannedEconomyRoundCards(2), null);
});

test('逐张发牌进度会公开该玩家最新手牌数', () => {
  const room = createRoom();
  const io = createIo();
  const manager = new DrawingPhaseManager(room, io);
  room.gameState.deck = [card('spades', '2')];
  room.gameState.drawingIndex = 0;

  manager.dealOneCard();

  const progress = io.events.find(({ event }) => event === 'deal_progress');
  assert.ok(progress);
  assert.equal(progress.payload.playerId, room.players[0].id);
  assert.equal(progress.payload.cardsCount, 1);
  assert.equal(room.players[0].cards.length, 1);
});

test('最后一家反超时出牌结果仍保留本墩最终的大牌玩家', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const trickCards = [
    card('hearts', '2'),
    card('hearts', '3'),
    card('hearts', '4'),
    card('hearts', 'A')
  ];
  const spareCards = [
    card('clubs', '6'),
    card('clubs', '7'),
    card('clubs', '8'),
    card('clubs', '9')
  ];

  room.players.forEach((player, index) => {
    player.addCard(trickCards[index]);
    player.addCard(spareCards[index]);
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '5';
  room.gameState.selectedRule = NORMAL_RULE;
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  let result;
  room.players.forEach((player, index) => {
    result = engine.playCards(player.id, [trickCards[index].id]);
  });

  assert.equal(result.roundUpdate.type, 'round_ended');
  assert.equal(result.roundWinner.playerId, room.players[3].id);
  assert.equal(result.currentWinningPlayerId, room.players[3].id);
  assert.equal(room.gameState.currentWinnerIndex, null);
});

test('埋底校验使用本局规则张数而不是固定房间配置', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const dealer = room.players[0];
  const cards = [
    card('spades', '2'),
    card('hearts', '3'),
    card('clubs', '4'),
    card('diamonds', '5')
  ];
  cards.forEach(value => dealer.addCard(value));
  room.gameState.phase = GamePhases.BURYING;
  room.gameState.buryingPlayerId = dealer.id;
  room.gameState.bottomCardsCount = 4;

  assert.throws(() => engine.buryCards(dealer.id, cards.slice(0, 3).map(value => value.id)));
  engine.buryCards(dealer.id, cards.map(value => value.id));

  assert.equal(room.gameState.bottomCards.length, 4);
  assert.equal(room.gameState.phase, GamePhases.PLAYING);
});

test('与民同乐会为真人庄家自动跳过零张埋底并开始出牌', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io);
  const dealer = room.players[0];
  room.gameState.phase = GamePhases.BURYING;
  room.gameState.bottomCardsCount = 0;
  room.gameState.buryingPlayerId = dealer.id;

  engine.handleDealerAssigned(dealer);

  assert.equal(room.gameState.phase, GamePhases.PLAYING);
  assert.equal(room.gameState.currentRound, 1);
  assert.equal(room.gameState.currentPlayerIndex, 0);
  assert.equal(room.gameState.bottomCards.length, 0);
  assert.ok(io.events.some(({ event, payload }) =>
    event === 'phase_changed' && payload.message.includes('没有底牌')));
});

test('算无遗策在庄家埋底完成前不会泄露队友手牌', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io);
  const dealer = room.players[0];
  const openHandPlayer = room.players[2];
  const dealerCards = ['2', '3', '4', '5', '6', '7', '8', '9']
    .map(rank => card('spades', rank));
  dealerCards.forEach(value => dealer.addCard(value));
  openHandPlayer.addCard(card('joker', 'big_joker'));
  openHandPlayer.addCard(card('hearts', 'K'));
  room.gameState.phase = GamePhases.BURYING;
  room.gameState.buryingPlayerId = dealer.id;
  room.gameState.bottomCardsCount = 8;
  room.gameState.selectedRule = getRuleById(RuleIds.PERFECT_STRATEGY);

  engine.handleDealerAssigned(dealer);

  assert.equal(room.gameState.phase, GamePhases.BURYING);
  assert.equal(room.gameState.openHandPlayerId, null);
  assert.equal(room.toJSON().gameState.openHand, null);
  assert.equal(io.events.some(({ event }) => event === 'open_hand_revealed'), false);

  engine.buryCards(dealer.id, dealerCards.map(value => value.id));

  assert.equal(room.gameState.phase, GamePhases.PLAYING);
  assert.equal(room.gameState.openHandPlayerId, openHandPlayer.id);
  assert.equal(room.gameState.openHandControllerPlayerId, dealer.id);
  assert.equal(io.events.filter(({ event }) => event === 'open_hand_revealed').length, 1);
});

test('算无遗策公开庄家队友的完整手牌并由庄家代打', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io);
  const dealer = room.players[0];
  const openHandPlayer = room.players[2];
  const openCards = [card('hearts', '6'), card('clubs', '9')];
  openCards.forEach(value => openHandPlayer.addCard(value));
  room.gameState.selectedRule = getRuleById(RuleIds.PERFECT_STRATEGY);

  engine.activatePerfectStrategy(dealer);

  assert.equal(room.gameState.openHandPlayerId, openHandPlayer.id);
  assert.equal(room.gameState.openHandControllerPlayerId, dealer.id);
  assert.deepEqual(
    room.toJSON().gameState.openHand.cards.map(value => value.id),
    openCards.map(value => value.id)
  );
  const revealed = io.events.find(({ event }) => event === 'open_hand_revealed');
  assert.equal(revealed.payload.playerId, openHandPlayer.id);
  assert.equal(revealed.payload.controllerPlayerId, dealer.id);
});

test('算无遗策拒绝明手本人和闲家操作，只接受庄家按明手座位出牌及撤回', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const dealer = room.players[0];
  const attacker = room.players[1];
  const openHandPlayer = room.players[2];
  const openCards = [card('hearts', '6'), card('clubs', '9')];
  openCards.forEach(value => openHandPlayer.addCard(value));
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = getRuleById(RuleIds.PERFECT_STRATEGY);
  engine.activatePerfectStrategy(dealer);
  engine.setFirstPlayer(openHandPlayer.id);

  assert.throws(
    () => engine.playCards(openHandPlayer.id, [openCards[0].id]),
    /由庄家代为操作/
  );
  assert.throws(
    () => engine.playCards(attacker.id, [openCards[0].id], openHandPlayer.id),
    /只有庄家/
  );

  const result = engine.playCards(dealer.id, [openCards[0].id], openHandPlayer.id);
  assert.equal(result.playerId, openHandPlayer.id);
  assert.equal(result.controllerPlayerId, dealer.id);
  assert.equal(result.isProxy, true);
  assert.equal(openHandPlayer.cards.length, 1);
  assert.equal(room.gameState.currentRoundPlays[0].playerId, openHandPlayer.id);

  const undoResult = engine.undoLastPlay(dealer.id);
  assert.equal(undoResult.playerId, openHandPlayer.id);
  assert.equal(undoResult.isProxy, true);
  assert.equal(openHandPlayer.cards.length, 2);
  assert.equal(room.gameState.currentRoundPlays.length, 0);
  assert.equal(room.gameState.leadingPattern, null);
  const replayResult = engine.playCards(dealer.id, [openCards[0].id], openHandPlayer.id);
  assert.equal(replayResult.playerId, openHandPlayer.id);
  assert.equal(room.gameState.currentRoundPlays.length, 1);
  assert.throws(() => engine.undoLastPlay(openHandPlayer.id), /由庄家代为操作/);
});

test('算无遗策由庄家代甩失败时只移除服务端强制打出的实体牌', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const openHandPlayer = room.players[0];
  const dealer = room.players[2];
  const hands = [
    [card('hearts', 'K', 20), card('hearts', '3', 21)],
    [card('hearts', 'A', 22), card('hearts', 'Q', 23)],
    [card('hearts', 'J', 24), card('hearts', '9', 25)],
    [card('hearts', '8', 26), card('hearts', '7', 27)]
  ];
  room.players.forEach((player, index) => {
    hands[index].forEach(value => player.addCard(value));
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = getRuleById(RuleIds.PERFECT_STRATEGY);
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  engine.activatePerfectStrategy(dealer);
  engine.setFirstPlayer(openHandPlayer.id);

  const result = engine.playCards(
    dealer.id,
    hands[0].map(value => value.id),
    openHandPlayer.id
  );

  assert.ok(result.throwFailed);
  assert.equal(result.isProxy, true);
  assert.equal(result.playedCards.length, 1);
  assert.deepEqual(
    openHandPlayer.cards.map(value => value.id),
    room.toJSON().gameState.openHand.cards.map(value => value.id)
  );
  assert.equal(openHandPlayer.cards.length, 1);
});

test('李代桃僵可违背跟牌要求且永远视为小，撤回会返还唯一使用次数', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const leader = room.players[0];
  const follower = room.players[1];
  const leadAces = [card('hearts', 'A', 0), card('hearts', 'A', 1)];
  const protectedKings = [card('hearts', 'K', 0), card('hearts', 'K', 1)];
  const discardedJokers = [card('joker', 'big_joker', 0), card('joker', 'big_joker', 1)];

  leadAces.forEach(value => leader.addCard(value));
  [...protectedKings, ...discardedJokers].forEach(value => follower.addCard(value));
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.selectedRule = SUBSTITUTE_SACRIFICE_RULE;
  engine.setFirstPlayer(leader.id);

  assert.throws(
    () => engine.playCards(
      leader.id,
      leadAces.map(value => value.id),
      null,
      ActiveSkillIds.SUBSTITUTE_SACRIFICE
    ),
    /只能在跟牌时发动/
  );

  engine.playCards(leader.id, leadAces.map(value => value.id));
  assert.throws(
    () => engine.playCards(follower.id, discardedJokers.map(value => value.id)),
    /必须优先出/
  );

  const result = engine.playCards(
    follower.id,
    discardedJokers.map(value => value.id),
    null,
    ActiveSkillIds.SUBSTITUTE_SACRIFICE
  );
  assert.equal(result.treatedAsSmall, true);
  assert.equal(result.activeSkillActivation.name, '李代桃僵');
  assert.equal(result.currentWinningPlayerId, leader.id);
  assert.deepEqual(follower.cards.map(value => value.id), protectedKings.map(value => value.id));
  assert.equal(engine.hasUsedActiveSkill(follower.id, ActiveSkillIds.SUBSTITUTE_SACRIFICE), true);
  assert.deepEqual(
    room.gameState.toJSON().activeSkillUsesByPlayerId[follower.id],
    [ActiveSkillIds.SUBSTITUTE_SACRIFICE]
  );

  const undoResult = engine.undoLastPlay(follower.id);
  assert.equal(undoResult.restoredActiveSkillId, ActiveSkillIds.SUBSTITUTE_SACRIFICE);
  assert.equal(engine.hasUsedActiveSkill(follower.id, ActiveSkillIds.SUBSTITUTE_SACRIFICE), false);
  assert.equal(room.gameState.currentWinnerIndex, 0);

  engine.playCards(
    follower.id,
    discardedJokers.map(value => value.id),
    null,
    ActiveSkillIds.SUBSTITUTE_SACRIFICE
  );
  room.gameState.currentPlayerIndex = 1;
  assert.throws(
    () => engine.playCards(
      follower.id,
      protectedKings.map(value => value.id),
      null,
      ActiveSkillIds.SUBSTITUTE_SACRIFICE
    ),
    /每名玩家每局只能发动一次/
  );
});

test('房间底牌配置固定为八张，客户端无法覆盖', () => {
  const room = new Room('固定底牌', 'socket-host', { bottomCardsCount: 16, dealInterval: 10 });
  assert.equal(room.config.bottomCardsCount, 8);
  room.updateConfig({ bottomCardsCount: 4 });
  assert.equal(room.config.bottomCardsCount, 8);
});

test('后续规则均已注册，主动技能元数据与初始分正确', () => {
  const defaultRules = [
    RuleIds.CONCEALED_PASSAGE,
    RuleIds.STEALING_BEAMS,
    RuleIds.COSMIC_SHIFT,
    RuleIds.LAST_STAND,
    RuleIds.LATE_MOVER_ADVANTAGE,
    RuleIds.GO_WITH_THE_FLOW,
    RuleIds.MINOR_DISTURBANCE,
    RuleIds.PLANNED_ECONOMY
  ];
  defaultRules.forEach(ruleId => {
    assert.deepEqual(getRuleSetup({ id: ruleId }), {
      bottomCardsCount: 8,
      attackerStartingScore: 0
    });
  });
  assert.deepEqual(getRuleSetup({ id: RuleIds.FATAL_BEAUTY }), {
    bottomCardsCount: 8,
    attackerStartingScore: 20
  });
  assert.deepEqual(getRuleSetup({ id: RuleIds.FREQUENT_FLUCTUATION }), {
    bottomCardsCount: 8,
    attackerStartingScore: -10
  });
  assert.equal(getRuleById(RuleIds.FREQUENT_FLUCTUATION).name, '频繁波动');
  assert.equal(getRuleById(RuleIds.MINOR_DISTURBANCE).name, '微小扰动');
  assert.equal(getRuleById(RuleIds.CONCEALED_PASSAGE).activeSkill.effect, 'concealed_until_round_end');
  assert.equal(getRuleById(RuleIds.STEALING_BEAMS).activeSkill.effect, 'joker_wildcards');
  assert.deepEqual(getRuleById(RuleIds.LATE_MOVER_ADVANTAGE).activeSkill, {
    id: ActiveSkillIds.LATE_MOVER_ADVANTAGE,
    name: '后发制人',
    usageLimit: 1,
    timing: 'third_position_before_play',
    effect: 'yield_turn_to_next_player'
  });
});

test('暗度陈仓不能由一号位发动，跟牌暗置后只在轮末统一给出牌面', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const trickCards = [
    card('hearts', '3'),
    card('spades', '4'),
    card('hearts', '5'),
    card('hearts', '6')
  ];
  const spareCards = [
    card('clubs', '7'),
    card('clubs', '8'),
    card('clubs', '9'),
    card('clubs', '10')
  ];
  room.players.forEach((player, index) => {
    player.addCard(trickCards[index]);
    player.addCard(spareCards[index]);
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.selectedRule = getRuleById(RuleIds.CONCEALED_PASSAGE);
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  assert.throws(
    () => engine.playCards(
      room.players[0].id,
      [trickCards[0].id],
      null,
      ActiveSkillIds.CONCEALED_PASSAGE
    ),
    /只能在跟牌时发动/
  );
  engine.playCards(room.players[0].id, [trickCards[0].id]);
  const concealed = engine.playCards(
    room.players[1].id,
    [trickCards[1].id],
    null,
    ActiveSkillIds.CONCEALED_PASSAGE
  );
  assert.equal(concealed.concealed, true);
  assert.equal(concealed.roundReveal, null);
  assert.equal(concealed.currentWinningPlayerId, null);
  assert.equal(concealed.trumpAction, null);
  assert.equal(engine.hasUsedActiveSkill(room.players[1].id, ActiveSkillIds.CONCEALED_PASSAGE), true);
  assert.equal(room.gameState.toJSON().currentWinnerIndex, null);

  const undone = engine.undoLastPlay(room.players[1].id);
  assert.equal(undone.concealed, true);
  assert.deepEqual(undone.cards.map(value => value.id), [trickCards[1].id]);
  assert.equal(engine.hasUsedActiveSkill(room.players[1].id, ActiveSkillIds.CONCEALED_PASSAGE), false);
  engine.playCards(
    room.players[1].id,
    [trickCards[1].id],
    null,
    ActiveSkillIds.CONCEALED_PASSAGE
  );

  engine.playCards(room.players[2].id, [trickCards[2].id]);
  const final = engine.playCards(room.players[3].id, [trickCards[3].id]);
  assert.equal(final.roundUpdate.type, 'round_ended');
  assert.equal(final.roundReveal.plays.length, 4);
  assert.deepEqual(
    final.roundReveal.plays.find(play => play.playerId === room.players[1].id).cards.map(value => value.id),
    [trickCards[1].id]
  );
});

test('无人生还让二至四号位自动暗置，并在四家出完后统一展示和正常结算', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const trickCards = [
    card('hearts', '5', 2100),
    card('hearts', '6', 2101),
    card('hearts', '7', 2102),
    card('hearts', 'K', 2103)
  ];
  const spareCards = [
    card('clubs', '3', 2110),
    card('clubs', '4', 2111),
    card('clubs', '6', 2112),
    card('clubs', '7', 2113)
  ];
  room.players.forEach((player, index) => {
    player.addCard(trickCards[index]);
    player.addCard(spareCards[index]);
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.selectedRule = NO_ONE_SURVIVES_RULE;
  room.gameState.buryingPlayerId = room.players[0].id;
  room.gameState.dealerPlayerIndex = 0;
  engine.setFirstPlayer(room.players[0].id);

  const leading = engine.playCards(room.players[0].id, [trickCards[0].id]);
  assert.equal(leading.concealed, false);
  assert.equal(leading.currentWinningPlayerId, room.players[0].id);
  assert.equal(leading.roundReveal, null);

  const second = engine.playCards(room.players[1].id, [trickCards[1].id]);
  assert.equal(second.concealed, true);
  assert.equal(second.activeSkillActivation, null);
  assert.equal(second.currentWinningPlayerId, null);
  assert.equal(second.roundReveal, null);
  assert.equal(room.gameState.toJSON().currentWinnerIndex, null);

  const third = engine.playCards(room.players[2].id, [trickCards[2].id]);
  assert.equal(third.concealed, true);
  assert.equal(third.currentWinningPlayerId, null);

  const final = engine.playCards(room.players[3].id, [trickCards[3].id]);
  assert.equal(final.concealed, true);
  assert.equal(final.roundUpdate.type, 'round_ended');
  assert.equal(final.roundUpdate.roundWinner.playerId, room.players[3].id);
  assert.equal(final.roundReveal.plays.length, 4);
  assert.deepEqual(
    final.roundReveal.plays.map(play => play.concealed),
    [false, true, true, true]
  );
  assert.deepEqual(
    final.roundReveal.plays.map(play => play.cards[0].id),
    trickCards.map(value => value.id)
  );
  assert.equal(room.gameState.attackerScore, 15);
  assert.equal(
    engine.hasUsedActiveSkill(room.players[1].id, ActiveSkillIds.CONCEALED_PASSAGE),
    false
  );

  const nextLeading = engine.playCards(room.players[3].id, [spareCards[3].id]);
  const nextSecond = engine.playCards(room.players[0].id, [spareCards[0].id]);
  assert.equal(nextLeading.concealed, false, '新一轮赢家成为一号位后应当明置');
  assert.equal(nextSecond.concealed, true, '暗置按每轮出牌位置判断，而不是固定座位');
});

test('暗置出牌先私发本人牌面再广播牌背，其他玩家收不到真实牌面', () => {
  const room = createRoom();
  const io = createIo();
  const playedCard = card('hearts', '10', 2120).toJSON();

  emitCardsPlayed(io, room, {
    playerId: room.players[1].id,
    playerName: room.players[1].name,
    playedCards: [playedCard],
    concealed: true,
    remainingCount: 12,
    currentWinningPlayerId: null
  });

  assert.equal(io.events.length, 2);
  assert.deepEqual(io.events[0], {
    target: room.players[1].socketId,
    event: 'concealed_cards_played_private',
    payload: {
      playerId: room.players[1].id,
      cards: [playedCard]
    }
  });
  assert.equal(io.events[1].target, room.id);
  assert.equal(io.events[1].event, 'cards_played');
  assert.deepEqual(io.events[1].payload.cards, []);
  assert.deepEqual(io.events[1].payload.removedCardIds, [playedCard.id]);
  assert.equal(io.events[1].payload.cardsCount, 1);
  assert.equal(io.events[1].payload.concealed, true);
});

test('红颜祸水把黑桃转换为带来源标记的红桃，红桃为主时补足40分', () => {
  const transformed = DeckService.transformSpadesToHearts([
    card('spades', 'A', 0),
    card('hearts', 'A', 0)
  ]);
  assert.equal(transformed[0].suit, 'hearts');
  assert.equal(transformed[0].originalSuit, 'spades');
  assert.equal(transformed[0].id, 'spades-A-0');
  assert.equal(transformed[1].originalSuit, null);

  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io);
  room.gameState.selectedRule = getRuleById(RuleIds.FATAL_BEAUTY);
  room.gameState.attackerScore = getRuleSetup(room.gameState.selectedRule).attackerStartingScore;
  room.gameState.trumpSuit = 'hearts';
  assert.equal(engine.applyFatalBeautyTrumpBonus(), true);
  assert.equal(engine.applyFatalBeautyTrumpBonus(), false);
  assert.equal(room.gameState.attackerScore, 40);
  assert.equal(io.events.filter(({ event }) => event === 'fatal_beauty_trump_bonus').length, 1);
});

test('偷梁换柱只采用玩家明确指定的牌面，可组成对子和拖拉机且王仍不计分', () => {
  const five = card('hearts', '5');
  const six = card('hearts', '6');
  const smallJoker = card('joker', 'small_joker');
  const bigJoker = card('joker', 'big_joker');
  const rule = getRuleById(RuleIds.STEALING_BEAMS);

  const pair = resolveJokerSubstitutionPlay({
    selectedCards: [five, smallJoker],
    handCards: [five, smallJoker],
    substitutions: [{ cardId: smallJoker.id, suit: 'hearts', rank: '5' }],
    trumpSuit: 'spades',
    trumpRank: '2',
    activeRule: rule
  });
  assert.equal(pair.valid, true);
  assert.equal(pair.pattern.type, PatternTypes.PAIR);
  assert.equal(pair.usesSkill, true);
  assert.equal(pair.substitutions[0].rank, '5');
  assert.equal(calculateRoundPoints(pair.effectiveCards), 5);

  const tractor = resolveJokerSubstitutionPlay({
    selectedCards: [five, six, smallJoker, bigJoker],
    handCards: [five, six, smallJoker, bigJoker],
    substitutions: [
      { cardId: smallJoker.id, suit: 'hearts', rank: '5' },
      { cardId: bigJoker.id, suit: 'hearts', rank: '6' }
    ],
    trumpSuit: 'spades',
    trumpRank: '2',
    activeRule: rule
  });
  assert.equal(tractor.valid, true);
  assert.equal(tractor.pattern.type, PatternTypes.TRACTOR);

  const singleJoker = resolveJokerSubstitutionPlay({
    selectedCards: [bigJoker],
    handCards: [bigJoker],
    trumpSuit: 'spades',
    trumpRank: '2',
    activeRule: rule
  });
  assert.equal(singleJoker.valid, true);
  assert.equal(singleJoker.usesSkill, false);
  assert.equal(singleJoker.pattern.type, PatternTypes.SINGLE);

  const missingChoice = resolveJokerSubstitutionPlay({
    selectedCards: [five, smallJoker],
    handCards: [five, smallJoker],
    trumpSuit: 'spades',
    trumpRank: '2',
    activeRule: rule
  });
  assert.equal(missingChoice.valid, false);
  assert.match(missingChoice.message, /明确选择/);

  const spoofedChoice = resolveJokerSubstitutionPlay({
    selectedCards: [five, smallJoker],
    handCards: [five, smallJoker, bigJoker],
    substitutions: [{ cardId: bigJoker.id, suit: 'hearts', rank: '5' }],
    trumpSuit: 'spades',
    trumpRank: '2',
    activeRule: rule
  });
  assert.equal(spoofedChoice.valid, false);
  assert.match(spoofedChoice.message, /必须包含/);

  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  room.players[0].cards = [five, smallJoker, card('clubs', '3', 0)];
  room.players.slice(1).forEach((player, index) => {
    player.cards = [card('hearts', String(index + 6), index), card('clubs', '4', index)];
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = rule;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  const result = engine.playCards(
    room.players[0].id,
    [five.id, smallJoker.id],
    null,
    ActiveSkillIds.STEALING_BEAMS,
    { jokerSubstitutions: [{ cardId: smallJoker.id, suit: 'hearts', rank: '5' }] }
  );
  assert.deepEqual(result.playedCards.map(currentCard => currentCard.rank), ['5', '5']);
  assert.equal(result.playedCards.some(currentCard => currentCard.isJokerSubstitution), true);
  assert.equal(calculateRoundPoints(result.playedCards), 5, '变成5的王仍不产生牌面分');
  assert.equal(engine.hasUsedActiveSkill(room.players[0].id, ActiveSkillIds.STEALING_BEAMS), true);
});

test('斗转星移和随波逐流只在轮末且四家均达到阈值后交换整手', () => {
  const cosmicRoom = createRoom();
  const cosmicEngine = new GameEngine(cosmicRoom, createIo());
  cosmicRoom.gameState.selectedRule = getRuleById(RuleIds.COSMIC_SHIFT);
  cosmicRoom.players.forEach((player, playerIndex) => {
    const ranks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '3'];
    for (let index = 0; index < 13; index++) {
      player.addCard(card('hearts', ranks[index], playerIndex * 100 + index));
    }
  });
  cosmicRoom.gameState.phase = GamePhases.PLAYING;
  cosmicRoom.gameState.trumpSuit = 'spades';
  cosmicRoom.gameState.trumpRank = '2';
  cosmicRoom.gameState.buryingPlayerId = cosmicRoom.players[0].id;
  cosmicEngine.setFirstPlayer(cosmicRoom.players[0].id);

  const firstResult = cosmicEngine.playCards(
    cosmicRoom.players[0].id,
    [cosmicRoom.players[0].cards[0].id]
  );
  assert.equal(firstResult.wholeHandExchange, null, '一号位出完后不能立刻换牌');
  assert.equal(cosmicRoom.gameState.wholeHandExchangeTriggers.size, 0);
  cosmicEngine.playCards(cosmicRoom.players[1].id, [cosmicRoom.players[1].cards[0].id]);
  cosmicEngine.playCards(cosmicRoom.players[2].id, [cosmicRoom.players[2].cards[0].id]);
  const expectedCosmicHands = cosmicRoom.players.map((player, index) =>
    index === 3 ? player.cards.slice(1).map(value => value.id) : player.cards.map(value => value.id)
  );
  const finalResult = cosmicEngine.playCards(
    cosmicRoom.players[3].id,
    [cosmicRoom.players[3].cards[0].id]
  );
  const cosmicResult = finalResult.wholeHandExchange;
  assert.equal(cosmicResult.triggerKey, 'cosmic_shift_12');
  assert.deepEqual(cosmicRoom.players[0].cards.map(value => value.id).sort(), [...expectedCosmicHands[2]].sort());
  assert.deepEqual(cosmicRoom.players[1].cards.map(value => value.id).sort(), [...expectedCosmicHands[3]].sort());

  const flowRoom = createRoom();
  const flowEngine = new GameEngine(flowRoom, createIo());
  flowRoom.gameState.selectedRule = getRuleById(RuleIds.GO_WITH_THE_FLOW);
  flowRoom.players.forEach((player, playerIndex) => {
    for (let index = 0; index < 16; index++) {
      player.addCard(card(['hearts', 'diamonds', 'clubs', 'spades'][playerIndex], String(3 + (index % 10)), index));
    }
  });
  const flowSnapshots = flowRoom.players.map(player => player.cards.map(value => value.id));
  const firstFlow = flowEngine.applyWholeHandExchangeAtRoundEnd();
  assert.equal(firstFlow.triggerKey, 'go_with_the_flow_16');
  assert.deepEqual(flowRoom.players[1].cards.map(value => value.id).sort(), [...flowSnapshots[0]].sort());
  flowRoom.players[0].cards = flowRoom.players[0].cards.slice(0, 9);
  assert.equal(flowEngine.applyWholeHandExchangeAtRoundEnd(), null, '不能只因一家的手牌达到阈值就交换');
  flowRoom.players.forEach(player => {
    player.cards = player.cards.slice(0, 9);
  });
  const secondFlow = flowEngine.applyWholeHandExchangeAtRoundEnd();
  assert.equal(secondFlow.triggerKey, 'go_with_the_flow_9');
});

test('频繁波动和微小扰动只在对应轮末收齐四家选择后同时交换一张牌', () => {
  const playExchangeRound = ({ ruleId, trickRanks }) => {
    const room = createRoom();
    const io = createIo();
    const engine = new GameEngine(room, io);
    const trickCards = trickRanks.map((rank, index) => card('hearts', rank, index));
    const giftCards = ['9', 'J', 'Q', 'A'].map((rank, index) => card('clubs', rank, index + 10));
    room.players.forEach((player, index) => {
      player.addCard(trickCards[index]);
      player.addCard(giftCards[index]);
    });
    room.gameState.phase = GamePhases.PLAYING;
    room.gameState.trumpSuit = 'spades';
    room.gameState.trumpRank = '2';
    room.gameState.selectedRule = getRuleById(ruleId);
    room.gameState.attackerScore = getRuleSetup(room.gameState.selectedRule).attackerStartingScore;
    room.gameState.buryingPlayerId = room.players[0].id;
    engine.setFirstPlayer(room.players[0].id);

    const first = engine.playCards(room.players[0].id, [trickCards[0].id]);
    assert.equal(first.roundCardExchange, null, '不能在一号位出牌后提前触发');
    engine.playCards(room.players[1].id, [trickCards[1].id]);
    engine.playCards(room.players[2].id, [trickCards[2].id]);
    const final = engine.playCards(room.players[3].id, [trickCards[3].id]);
    return { room, io, engine, final, giftCards };
  };

  const frequent = playExchangeRound({
    ruleId: RuleIds.FREQUENT_FLUCTUATION,
    trickRanks: ['5', '6', '7', '8']
  });
  assert.equal(frequent.final.roundCardExchange.stage, 'round');
  assert.equal(frequent.final.roundCardExchange.requiredCards, 1);
  assert.equal(frequent.room.gameState.cardExchange.triggerRound, 1);
  assert.equal(
    frequent.room.gameState.cardExchange.targetByPlayerId[frequent.room.players[0].id],
    frequent.room.players[1].id
  );
  assert.throws(
    () => frequent.engine.playCards(frequent.room.players[3].id, [frequent.giftCards[3].id]),
    /先完成本轮换牌/
  );
  frequent.room.players.forEach((player, index) => {
    const result = frequent.engine.submitOpeningCardExchange(player.id, [frequent.giftCards[index].id]);
    if (index < 3) assert.equal(result.resolved, false);
    else assert.equal(result.resolved, true);
  });
  assert.equal(frequent.room.gameState.cardExchange, null);
  assert.deepEqual(
    frequent.room.players.map(player => player.cards[0].id),
    [frequent.giftCards[3].id, frequent.giftCards[0].id, frequent.giftCards[1].id, frequent.giftCards[2].id]
  );
  assert.equal(
    frequent.io.events.filter(({ event }) => event === 'card_exchange_resolved').length,
    1
  );

  const minor = playExchangeRound({
    ruleId: RuleIds.MINOR_DISTURBANCE,
    trickRanks: ['3', '6', '7', '8']
  });
  assert.equal(minor.final.roundCardExchange.stage, 'round');
  assert.equal(
    minor.room.gameState.cardExchange.targetByPlayerId[minor.room.players[0].id],
    minor.room.players[2].id
  );
  minor.room.players[0].isBot = true;
  minor.room.players[2].isBot = true;
  const automatic = minor.engine.submitAutomaticRoundCardExchanges();
  assert.equal(automatic.resolved, false);
  assert.deepEqual(
    [...minor.room.gameState.cardExchange.submittedPlayerIds].sort(),
    [minor.room.players[0].id, minor.room.players[2].id].sort()
  );
  minor.engine.submitOpeningCardExchange(minor.room.players[1].id, [minor.giftCards[1].id]);
  minor.engine.submitOpeningCardExchange(minor.room.players[3].id, [minor.giftCards[3].id]);
  assert.deepEqual(
    minor.room.players.map(player => player.cards[0].id),
    [minor.giftCards[2].id, minor.giftCards[3].id, minor.giftCards[0].id, minor.giftCards[1].id]
  );

  const noTriggerRoom = createRoom();
  noTriggerRoom.gameState.selectedRule = getRuleById(RuleIds.FREQUENT_FLUCTUATION);
  noTriggerRoom.players.forEach((player, index) => player.addCard(card('clubs', '3', index + 30)));
  const noTriggerEngine = new GameEngine(noTriggerRoom, createIo());
  assert.equal(
    noTriggerEngine.prepareRoundCardExchangeAtRoundEnd([card('hearts', '4', 99)]),
    null,
    '频繁波动在无分轮不能触发'
  );
});

test('弃掷逦迤在含分轮末同时暗弃，庄家方分牌只在终局公开并补分', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io);
  const trickCards = ['5', '6', '7', '8'].map((rank, index) => card('hearts', rank, index));
  const discardedCards = [
    card('clubs', '4', 10),
    card('clubs', 'K', 11),
    card('diamonds', '5', 12),
    card('clubs', '3', 13)
  ];
  const remainingCards = ['A', 'Q', 'J', '9'].map(
    (rank, index) => card('spades', rank, index + 20)
  );
  room.players.forEach((player, index) => {
    player.addCard(trickCards[index]);
    player.addCard(discardedCards[index]);
    player.addCard(remainingCards[index]);
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.selectedRule = getRuleById(RuleIds.LINGERING_DISCARD);
  room.gameState.buryingPlayerId = room.players[0].id;
  room.gameState.dealerPlayerIndex = 0;
  engine.setFirstPlayer(room.players[0].id);

  engine.playCards(room.players[0].id, [trickCards[0].id]);
  engine.playCards(room.players[1].id, [trickCards[1].id]);
  engine.playCards(room.players[2].id, [trickCards[2].id]);
  const final = engine.playCards(room.players[3].id, [trickCards[3].id]);

  assert.equal(final.roundCardExchange.operation, 'discard');
  assert.equal(room.gameState.cardExchange.operation, 'discard');
  assert.ok(Object.values(room.gameState.cardExchange.targetByPlayerId).every(value => value === null));
  assert.equal(Object.hasOwn(room.gameState.toJSON(), 'lingeringDiscardedCards'), false);

  room.players.slice(0, 3).forEach((player, index) => {
    const result = engine.submitOpeningCardExchange(player.id, [discardedCards[index].id]);
    assert.equal(result.resolved, false);
  });
  assert.deepEqual(room.players.map(player => player.cards.length), [2, 2, 2, 2]);
  assert.equal(room.gameState.attackerScore, 5, '弃出的分牌不能在终局前改变分数');

  const resolved = engine.submitOpeningCardExchange(
    room.players[3].id,
    [discardedCards[3].id]
  );
  assert.equal(resolved.resolved, true);
  assert.equal(resolved.operation, 'discard');
  assert.deepEqual(room.players.map(player => player.cards.length), [1, 1, 1, 1]);
  assert.deepEqual(
    room.players.map(player => player.cards[0].id),
    remainingCards.map(value => value.id)
  );
  assert.equal(room.gameState.attackerScore, 5);
  const publicResolution = io.events.find(({ event }) => event === 'card_exchange_resolved');
  assert.equal(publicResolution.payload.operation, 'discard');
  assert.equal(JSON.stringify(publicResolution.payload).includes(discardedCards[0].id), false);
  assert.equal(JSON.stringify(room.toJSON()).includes(discardedCards[0].id), false);
  const privateUpdates = io.events.filter(({ event }) => event === 'card_exchange_hand_updated');
  assert.equal(privateUpdates.length, 4);
  privateUpdates.forEach(({ target, payload }) => {
    const playerIndex = room.players.findIndex(player => player.socketId === target);
    assert.deepEqual(payload.sentCardIds, [discardedCards[playerIndex].id]);
    assert.deepEqual(payload.receivedCards, []);
    assert.equal(payload.ruleName, '弃掷逦迤');
    assert.equal(payload.operation, 'discard');
    assert.equal(payload.animationDuration, publicResolution.payload.animationDuration);
    assert.equal(
      discardedCards.some((value, index) =>
        index !== playerIndex && JSON.stringify(payload).includes(value.id)
      ),
      false,
      '每名玩家的私有结果也不能包含他人的弃牌'
    );
  });

  engine.finishGame();
  const settlement = room.gameState.bottomScoreResult;
  assert.equal(settlement.scoreBeforeLingeringDiscard, 5);
  assert.equal(settlement.lingeringDiscardPoints, 5);
  assert.equal(settlement.lingeringDiscardBonus, 5);
  assert.equal(settlement.totalScore, 10);
  assert.deepEqual(
    settlement.lingeringDiscardCards.map(value => value.id).sort(),
    [discardedCards[2].id],
    '只公开庄家方弃出的分牌，庄家本人弃出的非分牌也不展示'
  );
  assert.equal(
    settlement.lingeringDiscardCards.some(value => value.id === discardedCards[1].id),
    false,
    '闲家弃牌不应在终局公开'
  );

  const noTriggerRoom = createRoom();
  noTriggerRoom.gameState.selectedRule = getRuleById(RuleIds.LINGERING_DISCARD);
  noTriggerRoom.players.forEach((player, index) => {
    player.addCard(card('clubs', '3', index + 40));
  });
  const noTriggerEngine = new GameEngine(noTriggerRoom, createIo());
  assert.equal(
    noTriggerEngine.prepareRoundDiscardAtRoundEnd([card('hearts', '4', 99)]),
    null,
    '无分轮不能触发暗弃'
  );
});

test('弃掷逦迤暗弃最后一张手牌后直接进入终局结算', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const finalCards = ['10', '3', '5', '4'].map(
    (rank, index) => card('clubs', rank, index + 70)
  );
  room.players.forEach((player, index) => player.addCard(finalCards[index]));
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = getRuleById(RuleIds.LINGERING_DISCARD);
  room.gameState.buryingPlayerId = room.players[0].id;
  room.gameState.dealerPlayerIndex = 0;
  room.gameState.lastRoundWinnerIndex = 0;
  room.gameState.lastRoundLeadingPattern = { type: PatternTypes.SINGLE, length: 1 };

  const pending = engine.prepareRoundDiscardAtRoundEnd([card('hearts', '5', 99)]);
  assert.equal(pending.operation, 'discard');
  let resolved;
  room.players.forEach((player, index) => {
    resolved = engine.submitOpeningCardExchange(player.id, [finalCards[index].id]);
  });

  assert.equal(resolved.gameFinished, true);
  assert.equal(room.gameState.phase, GamePhases.REVEALING);
  assert.equal(room.gameState.bottomScoreResult.lingeringDiscardPoints, 15);
  assert.deepEqual(room.players.map(player => player.cards.length), [0, 0, 0, 0]);
});

test('后发制人只让三号位与四号位换序，不改变本轮牌力结算', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const trickCards = ['3', '4', '5', '6'].map((rank, index) => card('hearts', rank, index));
  room.players.forEach((player, index) => {
    player.addCard(trickCards[index]);
    player.addCard(card('clubs', String(index + 7), index + 10));
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.selectedRule = getRuleById(RuleIds.LATE_MOVER_ADVANTAGE);
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  assert.throws(
    () => engine.activateLateMoverAdvantage(room.players[0].id),
    /只能由本轮三号位/
  );
  engine.playCards(room.players[0].id, [trickCards[0].id]);
  engine.playCards(room.players[1].id, [trickCards[1].id]);

  const activation = engine.activateLateMoverAdvantage(room.players[2].id);
  assert.equal(activation.currentPlayerIndex, 3);
  assert.equal(room.gameState.currentPlayerIndex, 3);
  assert.equal(
    engine.hasUsedActiveSkill(room.players[2].id, ActiveSkillIds.LATE_MOVER_ADVANTAGE),
    true
  );
  assert.throws(
    () => engine.activateLateMoverAdvantage(room.players[2].id),
    /只能发动一次|还没有轮到你/
  );

  const fourthPlay = engine.playCards(room.players[3].id, [trickCards[3].id]);
  assert.equal(fourthPlay.roundUpdate.type, 'turn_changed');
  assert.equal(room.gameState.currentPlayerIndex, 2, '四号位出完后应回到原三号位');
  const finalPlay = engine.playCards(room.players[2].id, [trickCards[2].id]);
  assert.equal(finalPlay.roundUpdate.type, 'round_ended');
  assert.equal(finalPlay.roundUpdate.roundWinner.playerId, room.players[3].id);
  assert.deepEqual(
    room.gameState.playHistory.slice(-4).map(play => play.playerId),
    [room.players[0].id, room.players[1].id, room.players[3].id, room.players[2].id],
    '实际行动顺序应为一、二、四、三号位'
  );
});

test('礼崩乐坏禁止一号位主动出A，但不妨碍跟牌出A', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const leaderAce = card('hearts', 'A', 80);
  const leaderThree = card('hearts', '3', 80);
  const followerAce = card('hearts', 'A', 81);
  room.players[0].addCard(leaderAce);
  room.players[0].addCard(leaderThree);
  room.players[1].addCard(followerAce);
  room.players[1].addCard(card('clubs', '4', 80));
  room.players[2].addCard(card('hearts', '5', 80));
  room.players[2].addCard(card('clubs', '6', 80));
  room.players[3].addCard(card('hearts', '7', 80));
  room.players[3].addCard(card('clubs', '8', 80));
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = RITES_COLLAPSE_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  assert.throws(
    () => engine.playCards(room.players[0].id, [leaderAce.id]),
    /不能主动打出A/
  );
  engine.playCards(room.players[0].id, [leaderThree.id]);
  assert.doesNotThrow(() => engine.playCards(room.players[1].id, [followerAce.id]));

  const bot = new BotService('simple');
  assert.deepEqual(
    bot.getFallbackAction({
      selectedRule: RITES_COLLAPSE_RULE,
      currentRound: 1,
      leadingPattern: null,
      trumpSuit: 'spades',
      trumpRank: '2'
    }, [leaderAce, leaderThree]),
    [leaderThree.id],
    'Bot首发兜底同样必须避开A'
  );

  const onlyARoom = createRoom();
  const onlyAEngine = new GameEngine(onlyARoom, createIo());
  const onlyA = [card('hearts', 'A', 180), card('spades', 'A', 181)];
  onlyA.forEach(value => onlyARoom.players[0].addCard(value));
  onlyARoom.players.slice(1).forEach((player, index) => {
    player.addCard(card('clubs', String(index + 3), 180 + index));
  });
  onlyARoom.gameState.phase = GamePhases.PLAYING;
  onlyARoom.gameState.selectedRule = RITES_COLLAPSE_RULE;
  onlyARoom.gameState.trumpSuit = 'spades';
  onlyARoom.gameState.trumpRank = '2';
  onlyARoom.gameState.buryingPlayerId = onlyARoom.players[0].id;
  onlyAEngine.setFirstPlayer(onlyARoom.players[0].id);
  assert.doesNotThrow(() => onlyAEngine.playCards(onlyARoom.players[0].id, [onlyA[0].id]));
  assert.deepEqual(
    bot.getFallbackAction({
      selectedRule: RITES_COLLAPSE_RULE,
      currentRound: 1,
      leadingPattern: null,
      trumpSuit: 'spades',
      trumpRank: '2'
    }, onlyA),
    [onlyA[0].id],
    'Bot只剩A时也必须能够首发'
  );
});

test('君子一言按埋底后的有效花色统计，唯一最短自动声明，并列时等待本人选择', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io, () => 0);
  const hands = [
    [card('diamonds', '3', 190), card('clubs', '4', 191), card('spades', '5', 192)],
    [card('clubs', '5', 193), card('diamonds', '2', 194)],
    [card('hearts', '7', 195), card('clubs', '8', 196), card('diamonds', '2', 197)],
    [card('hearts', '10', 198), card('diamonds', 'J', 199), card('spades', 'Q', 200)]
  ];
  room.players.forEach((player, index) => hands[index].forEach(value => player.addCard(value)));
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = GENTLEMAN_PROMISE_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  const playerOneCounts = engine.getGentlemanPromiseSuitCounts(room.players[1]);
  assert.equal(Object.hasOwn(playerOneCounts, 'spades'), false, '原主花色不应保留为永远为0的独立栏目');
  assert.deepEqual(playerOneCounts, {
    hearts: 0,
    diamonds: 0,
    clubs: 1,
    trump: 1
  }, '方片级牌只能计入主，不能再计入方片');

  const activation = engine.activateGentlemanPromise();
  assert.equal(activation.pending, true);
  assert.deepEqual(
    Object.fromEntries(room.gameState.gentlemanPromiseDeclarationsByPlayerId),
    {
      [room.players[0].id]: 'hearts',
      [room.players[2].id]: 'diamonds',
      [room.players[3].id]: 'clubs'
    }
  );
  const requestEvent = io.events.find(({ target, event }) => (
    target === room.players[1].socketId && event === 'gentleman_promise_selection_required'
  ));
  assert.deepEqual(requestEvent?.payload?.eligibleSuits, ['hearts', 'diamonds']);
  assert.throws(
    () => engine.playCards(room.players[0].id, [hands[0][0].id]),
    /完成最短花色声明/
  );
  assert.throws(
    () => engine.selectGentlemanPromiseSuit(room.players[1].id, 'clubs'),
    /并列最少/
  );

  const result = engine.selectGentlemanPromiseSuit(room.players[1].id, 'diamonds');
  assert.equal(result.pending, false);
  assert.equal(
    room.gameState.toJSON().gentlemanPromise.declarationsByPlayerId[room.players[1].id],
    'diamonds'
  );
  assert.doesNotThrow(() => engine.playCards(room.players[0].id, [hands[0][0].id]));
});

test('潜龙在渊排除级牌统计最多点数，唯一候选自动声明，并列时等待本人选择', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io, () => 0);
  const hands = [
    [card('hearts', '3', 601), card('diamonds', '3', 602), card('clubs', '4', 603)],
    [card('hearts', '5', 604), card('diamonds', '5', 605), card('clubs', '10', 606), card('spades', '10', 607)],
    [card('hearts', '2', 608), card('diamonds', '2', 609), card('clubs', '2', 610), card('spades', '2', 611), card('hearts', 'Q', 612), card('diamonds', 'Q', 613), card('clubs', 'K', 614)],
    [card('hearts', 'A', 615), card('diamonds', 'A', 616), card('clubs', 'K', 617)]
  ];
  room.players.forEach((player, index) => hands[index].forEach(value => player.addCard(value)));
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = HIDDEN_DRAGON_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  assert.deepEqual(engine.getHiddenDragonRankCounts(room.players[2]), {
    3: 0,
    4: 0,
    5: 0,
    6: 0,
    7: 0,
    8: 0,
    9: 0,
    10: 0,
    J: 0,
    Q: 2,
    K: 1,
    A: 0
  });

  const activation = engine.activateHiddenDragonInAbyss();
  assert.equal(activation.pending, true);
  assert.deepEqual(
    Object.fromEntries(room.gameState.hiddenDragonDeclarationsByPlayerId),
    {
      [room.players[0].id]: '3',
      [room.players[2].id]: 'Q',
      [room.players[3].id]: 'A'
    }
  );
  const requestEvent = io.events.find(({ target, event }) => (
    target === room.players[1].socketId && event === 'hidden_dragon_selection_required'
  ));
  assert.deepEqual(requestEvent?.payload?.eligibleRanks, ['5', '10']);
  assert.equal(requestEvent?.payload?.maximumCount, 2);
  assert.throws(
    () => engine.playCards(room.players[0].id, [hands[0][2].id]),
    /完成潜龙点数声明/
  );
  assert.throws(
    () => engine.selectHiddenDragonRank(room.players[1].id, 'J'),
    /并列最多/
  );

  const result = engine.selectHiddenDragonRank(room.players[1].id, '10');
  assert.equal(result.pending, false);
  assert.equal(
    room.gameState.toJSON().hiddenDragon.declarationsByPlayerId[room.players[1].id],
    '10'
  );
});

test('潜龙在渊在本次出牌后首次降至12张时结算，且撤回会恢复点数历史与阵营分', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io, () => 0);
  const crossingCard = card('hearts', '4', 630);
  const declaredCard = card('hearts', 'K', 631);
  const fillerRanks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'A'];
  room.players[0].addCard(crossingCard);
  room.players[0].addCard(declaredCard);
  fillerRanks.forEach((rank, index) => {
    room.players[0].addCard(card('diamonds', rank, 640 + index));
  });
  const followerCards = room.players.slice(1).map((player, index) => {
    const value = card('clubs', String(index + 3), 660 + index);
    player.addCard(value);
    return value;
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = HIDDEN_DRAGON_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  room.gameState.hiddenDragonDeclarationsByPlayerId.set(room.players[0].id, 'K');
  engine.setFirstPlayer(room.players[0].id);

  engine.playCards(room.players[0].id, [crossingCard.id]);
  assert.equal(room.players[0].cards.length, 12);
  assert.equal(room.gameState.attackerScore, -10, '庄家方成功应使闲家净得分减少10');
  assert.equal(room.gameState.hiddenDragonResults[0].success, true);
  assert.equal(room.gameState.hiddenDragonResults[0].awardedPoints, 10);
  assert.equal(room.gameState.hiddenDragonEvaluatedPlayerIds.has(room.players[0].id), true);

  engine.undoLastPlay(room.players[0].id);
  assert.equal(room.players[0].cards.length, 13);
  assert.equal(room.gameState.attackerScore, 0);
  assert.equal(room.gameState.hiddenDragonResults.length, 0);
  assert.equal(room.gameState.hiddenDragonEvaluatedPlayerIds.has(room.players[0].id), false);
  assert.deepEqual(
    Array.from(room.gameState.hiddenDragonPlayedRanksByPlayerId.get(room.players[0].id)),
    []
  );

  engine.playCards(room.players[0].id, [declaredCard.id]);
  assert.equal(room.players[0].cards.length, 12);
  assert.equal(room.gameState.attackerScore, 0);
  assert.equal(room.gameState.hiddenDragonResults[0].success, false, '跨过12张门槛的本次出牌也必须计入历史');
  assert.equal(room.gameState.hiddenDragonPlayedRanksByPlayerId.get(room.players[0].id).has('K'), true);
  assert.equal(
    room.gameState.toJSON().hiddenDragon.playedDeclaredRankByPlayerId[room.players[0].id],
    true
  );
  room.gameState.hiddenDragonDeclarationsByPlayerId.set(room.players[1].id, 'A');
  engine.playCards(room.players[1].id, [followerCards[0].id]);
  assert.equal(room.gameState.hiddenDragonResults[1].success, true);
  assert.equal(room.gameState.hiddenDragonResults[1].team, 'attacker');
  assert.equal(room.gameState.attackerScore, 10, '闲家方成功应使闲家净得分增加10');
  assert.deepEqual(room.gameState.toJSON().hiddenDragon.results, room.gameState.hiddenDragonResults);
});

test('行政审查以24张初始手牌开打，公开声明后只由庄家方共同满足条件再看底埋底', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io, () => 0);
  const openingCards = [
    card('hearts', '3', 710),
    card('hearts', '7', 711),
    card('clubs', '7', 712),
    card('hearts', '5', 713)
  ];
  room.players.forEach((player, playerIndex) => {
    player.addCard(openingCards[playerIndex]);
    for (let index = 0; index < 23; index += 1) {
      player.addCard(card(
        playerIndex === 2 ? 'clubs' : 'diamonds',
        String(3 + (index % 7)),
        720 + playerIndex * 30 + index
      ));
    }
  });
  const sealedBottomCards = Array.from({ length: 12 }, (_, index) => (
    card('spades', String(3 + (index % 7)), 850 + index)
  ));
  room.gameState.phase = GamePhases.DRAWING;
  room.gameState.selectedRule = ADMINISTRATIVE_REVIEW_RULE;
  room.gameState.bottomCardsCount = 12;
  room.gameState.bottomCards = sealedBottomCards;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  const dealer = room.players[0];
  const drawingManager = new DrawingPhaseManager(
    room,
    io,
    assignedDealer => engine.handleDealerAssigned(assignedDealer)
  );
  engine.drawingManager = drawingManager;

  drawingManager.completeDealerAssignment(dealer);
  assert.deepEqual(room.players.map(player => player.cards.length), [24, 24, 24, 24]);
  assert.equal(
    io.events.some(({ event }) => event === 'bottom_cards_received'),
    false,
    '条件满足前不能把底牌牌面私发给庄家'
  );
  assert.equal(room.gameState.phase, GamePhases.PLAYING);
  assert.equal(room.gameState.currentPlayerIndex, null, '两项公开声明完成前不能开始出牌');
  assert.equal(room.gameState.administrativeReview.suitSelectorPlayerId, room.players[1].id);
  assert.equal(room.gameState.administrativeReview.rankSelectorPlayerId, room.players[3].id);

  assert.throws(
    () => engine.selectAdministrativeReviewDeclaration(room.players[1].id, 'suit', 'spades'),
    /当前副花色/
  );
  engine.selectAdministrativeReviewDeclaration(room.players[1].id, 'suit', 'hearts');
  assert.equal(room.gameState.toJSON().administrativeReview.suit, 'hearts');
  const finalDeclaration = engine.selectAdministrativeReviewDeclaration(
    room.players[3].id,
    'rank',
    '7'
  );
  assert.equal(finalDeclaration.pending, false);
  assert.equal(room.gameState.currentPlayerIndex, 0);
  assert.equal(room.gameState.currentRound, 1);
  assert.deepEqual(
    io.events.filter(({ event }) => event === 'administrative_review_declared')
      .map(({ payload }) => [payload.type, payload.value]),
    [['suit', 'hearts'], ['rank', '7']],
    '两项声明都必须向全桌广播'
  );

  engine.playCards(dealer.id, [openingCards[0].id]);
  assert.equal(room.gameState.administrativeReview.suitMatched, true);
  assert.equal(room.gameState.administrativeReview.rankMatched, false);
  engine.undoLastPlay(dealer.id);
  assert.equal(room.gameState.administrativeReview.suitMatched, false, '撤回需恢复审查进度');
  engine.playCards(dealer.id, [openingCards[0].id]);

  engine.playCards(room.players[1].id, [openingCards[1].id]);
  assert.equal(
    room.gameState.administrativeReview.rankMatched,
    false,
    '闲家打出指定点数不能替庄家方满足条件'
  );
  engine.playCards(room.players[2].id, [openingCards[2].id]);
  assert.equal(room.gameState.administrativeReview.rankMatched, true);
  assert.equal(room.gameState.administrativeReview.isBottomReleased, true);
  assert.equal(room.gameState.phase, GamePhases.BURYING);
  assert.equal(dealer.cards.length, 35, '庄家打过一张后收到12张封存底牌');
  const bottomEvent = io.events.find(({ target, event }) => (
    target === dealer.socketId && event === 'bottom_cards_received'
  ));
  assert.deepEqual(
    bottomEvent?.payload?.bottomCards?.map(value => value.id),
    sealedBottomCards.map(value => value.id)
  );
  assert.equal(
    io.events.some(({ target, event }) => (
      target !== dealer.socketId && event === 'bottom_cards_received'
    )),
    false
  );

  const cardsToBury = dealer.cards.slice(0, 12);
  const preservedRound = room.gameState.currentRound;
  const preservedPlayerIndex = room.gameState.currentPlayerIndex;
  const preservedPlayCount = room.gameState.currentRoundPlays.length;
  engine.buryCards(dealer.id, cardsToBury.map(value => value.id));
  assert.equal(room.gameState.phase, GamePhases.PLAYING);
  assert.equal(room.gameState.administrativeReview.isBuried, true);
  assert.equal(room.gameState.currentRound, preservedRound);
  assert.equal(room.gameState.currentPlayerIndex, preservedPlayerIndex);
  assert.equal(room.gameState.currentRoundPlays.length, preservedPlayCount);
  assert.equal(dealer.cards.length, 23);
  assert.deepEqual(room.gameState.bottomCards.map(value => value.id), cardsToBury.map(value => value.id));
  assert.doesNotThrow(() => engine.playCards(room.players[3].id, [openingCards[3].id]));
});

test('政治审查逐次询问未使用技能的队友，收回不禁牌且第四手审查前不结算', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io, () => 0.9);
  const trickCards = ['3', '4', '5', '6'].map((rank, index) => (
    card('hearts', rank, 720 + index)
  ));
  room.players.forEach((player, index) => player.addCard(trickCards[index]));
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = POLITICAL_REVIEW_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  const firstPending = engine.playCards(room.players[0].id, [trickCards[0].id]);
  assert.equal(firstPending.politicalReviewDeferred, true);
  assert.equal(room.players[0].cards.length, 1, '审查决定前不得真正移除手牌');
  assert.equal(room.gameState.currentRoundPlays.length, 0);
  assert.equal(room.gameState.currentPlayerIndex, 0);
  assert.equal(room.gameState.politicalReviewPending.reviewerPlayerId, room.players[2].id);

  const firstDecision = engine.respondPoliticalReview(room.players[2].id, false);
  assert.equal(firstDecision.returned, false);
  assert.equal(engine.hasUsedActiveSkill(room.players[2].id, RuleIds.POLITICAL_REVIEW), false);
  const firstCommitted = engine.playCards(
    room.players[0].id,
    [trickCards[0].id],
    null,
    null,
    { politicalReviewApprovalId: firstDecision.id }
  );
  assert.equal(firstCommitted.politicalReviewDeferred, undefined);
  assert.equal(room.players[0].cards.length, 0);
  assert.equal(room.gameState.currentPlayerIndex, 1);

  const secondPending = engine.playCards(room.players[1].id, [trickCards[1].id]);
  assert.equal(secondPending.politicalReviewPending.reviewerPlayerId, room.players[3].id);
  const secondDecision = engine.respondPoliticalReview(room.players[3].id, true);
  assert.equal(secondDecision.returned, true);
  assert.equal(room.players[1].cards.length, 1, '选择收回后牌仍须留在原出牌者手中');
  assert.equal(room.gameState.currentPlayerIndex, 1);
  assert.equal(engine.hasUsedActiveSkill(room.players[3].id, RuleIds.POLITICAL_REVIEW), true);
  const repeatedSecond = engine.playCards(room.players[1].id, [trickCards[1].id]);
  assert.equal(repeatedSecond.politicalReviewDeferred, undefined, '完全相同的牌必须允许立即重出');
  assert.equal(room.gameState.bushGateRestriction, null, '政治审查不得生成任何禁出牌记录');

  const thirdPending = engine.playCards(room.players[2].id, [trickCards[2].id]);
  assert.equal(thirdPending.politicalReviewPending.reviewerPlayerId, room.players[0].id);
  engine.respondPoliticalReview(room.players[0].id, true);
  assert.equal(room.players[2].cards.length, 1);
  engine.playCards(room.players[2].id, [trickCards[2].id]);

  const fourthPending = engine.playCards(room.players[3].id, [trickCards[3].id]);
  assert.equal(fourthPending.politicalReviewDeferred, true);
  assert.equal(room.gameState.currentRound, 1, '第四手审查完成前不能提前推进轮次');
  assert.equal(room.gameState.currentRoundPlays.length, 3, '第四手尚未真正进入牌桌');
  assert.equal(room.gameState.phase, GamePhases.PLAYING);
  engine.respondPoliticalReview(room.players[1].id, true);
  assert.equal(room.players[3].cards.length, 1);
  const finalResult = engine.playCards(room.players[3].id, [trickCards[3].id]);
  assert.equal(finalResult.gameFinished, true);
  assert.deepEqual(
    room.gameState.toJSON().politicalReview.usedPlayerIds.sort(),
    [room.players[0].id, room.players[1].id, room.players[3].id].sort()
  );
});

test('政治审查放行Bot时固定提交原候选牌，不受Bot再次计算动作影响', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo(), () => 0.9);
  const approvedCard = card('hearts', '3', 730);
  const recalculatedCard = card('hearts', '7', 731);
  room.players[0].isBot = true;
  room.players[0].addCard(approvedCard);
  room.players[0].addCard(recalculatedCard);
  room.players.slice(1).forEach((player, index) => (
    player.addCard(card('hearts', `${index + 4}`, 732 + index))
  ));
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = POLITICAL_REVIEW_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  engine.playCards(room.players[0].id, [approvedCard.id]);
  engine.respondPoliticalReview(room.players[2].id, false);
  const result = engine.playCards(room.players[0].id, [recalculatedCard.id]);
  assert.equal(result.playedCards[0].id, approvedCard.id);
  assert.deepEqual(room.players[0].cards.map(value => value.id), [recalculatedCard.id]);
});

test('焦点人物按队内一致表决反复轮换候选，逐墩只算焦点双倍而底牌正常结算', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io, sequenceRandom([0.1, 0.1]));
  const trickCards = [
    card('hearts', '5', 310),
    card('hearts', 'A', 311),
    card('hearts', '10', 312),
    card('hearts', 'K', 313)
  ];
  room.players.forEach((player, index) => player.addCard(trickCards[index]));
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = FOCUS_FIGURE_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  room.gameState.bottomCards = [card('clubs', '5', 314)];
  engine.setFirstPlayer(room.players[0].id);

  engine.activateFocusFigure();
  assert.equal(engine.hasPendingFocusFigureVote(), true);
  assert.equal(room.gameState.toJSON().focusFigure.isVotingPending, true);
  assert.equal(room.gameState.toJSON().focusFigure.teams, undefined, '终局前不能公开候选或焦点');
  assert.deepEqual(
    room.gameState.toJSON().focusFigure.capturedPointsByPlayerId,
    Object.fromEntries(room.players.map(player => [player.id, 0])),
    '终局前应公开每名玩家打出的分牌被闲家收走的牌面分'
  );
  assert.equal(room.gameState.toJSON().attackerScore, null, '终局前公共快照不能泄露实际得分');

  const teamOneRequests = io.events.filter(({ event, payload }) => (
    event === 'focus_figure_vote_required' && payload.team === 1
  ));
  assert.deepEqual(
    new Set(teamOneRequests.map(({ target }) => target)),
    new Set([room.players[0].socketId, room.players[2].socketId])
  );
  assert.ok(teamOneRequests.every(({ payload }) => payload.nomineePlayerId === room.players[0].id));
  assert.equal(
    io.events.some(({ target, event, payload }) => (
      event === 'focus_figure_vote_required' &&
      payload.team === 1 &&
      [room.players[1].socketId, room.players[3].socketId].includes(target)
    )),
    false,
    '另一队不能收到本队候选'
  );
  assert.throws(
    () => engine.playCards(room.players[0].id, [trickCards[0].id]),
    /完成焦点人物表决/
  );

  engine.submitFocusFigureVote(room.players[0].id, false, { team: 1, attempt: 1 });
  const switched = engine.submitFocusFigureVote(room.players[2].id, true, { team: 1, attempt: 1 });
  assert.equal(switched.nomineeChanged, true);
  assert.equal(room.gameState.focusFigureTeams[0].nomineePlayerId, room.players[2].id);
  assert.equal(room.gameState.focusFigureTeams[0].attempt, 2);
  assert.throws(
    () => engine.submitFocusFigureVote(room.players[0].id, true, { team: 1, attempt: 1 }),
    /候选已经变更/
  );

  engine.submitFocusFigureVote(room.players[1].id, true, { team: 2, attempt: 1 });
  engine.submitFocusFigureVote(room.players[3].id, true, { team: 2, attempt: 1 });
  engine.submitFocusFigureVote(room.players[0].id, true, { team: 1, attempt: 2 });
  const completed = engine.submitFocusFigureVote(room.players[2].id, true, { team: 1, attempt: 2 });
  assert.equal(completed.pending, false);
  assert.equal(room.gameState.focusFigureTeams[0].finalPlayerId, room.players[2].id);
  assert.equal(room.gameState.focusFigureTeams[1].finalPlayerId, room.players[1].id);
  assert.equal(room.gameState.toJSON().focusFigure.teams, undefined);

  engine.playCards(room.players[0].id, [trickCards[0].id]);
  engine.playCards(room.players[1].id, [trickCards[1].id]);
  engine.playCards(room.players[2].id, [trickCards[2].id]);
  const result = engine.playCards(room.players[3].id, [trickCards[3].id]);

  assert.equal(result.roundUpdate.scoreInfo.focusFigureScoringPending, true);
  assert.equal(result.roundUpdate.scoreInfo.attackerScore, null);
  assert.deepEqual(
    room.gameState.collectedPointCards.map(value => value.id),
    [trickCards[0].id, trickCards[2].id, trickCards[3].id]
  );
  assert.equal(room.gameState.bottomScoreResult.focusFigure.focusTrickScore, 20);
  assert.equal(
    room.gameState.bottomScoreResult.focusFigure.normalBottomScore,
    10,
    '底牌5分应不看庄家是否焦点，仍按单张抠底2倍正常结算'
  );
  assert.equal(room.gameState.bottomScoreResult.totalScore, 30);
  assert.equal(room.gameState.attackerScore, 30);
  const playerBreakdown = Object.fromEntries(
    room.gameState.bottomScoreResult.focusFigure.players.map(player => [player.playerId, player])
  );
  assert.deepEqual(
    [playerBreakdown[room.players[2].id].capturedPoints, playerBreakdown[room.players[2].id].countedPoints],
    [10, 20]
  );
  assert.deepEqual(
    [playerBreakdown[room.players[3].id].capturedPoints, playerBreakdown[room.players[3].id].countedPoints],
    [10, 0]
  );
  assert.equal(room.gameState.toJSON().focusFigure.isRevealed, true);
  assert.equal(room.gameState.toJSON().focusFigure.teams.length, 2);
  assert.equal(room.gameState.toJSON().attackerScore, 30);
});

test('再衰三竭从连续第三次最大开始递增罚分，换人接牌的当轮计为新连续第1轮', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const ranksByPlayer = ['A', 'K', 'Q', 'J'];
  const cardsByPlayer = room.players.map((player, playerIndex) => (
    Array.from({ length: 4 }, (_, roundIndex) => (
      card('hearts', ranksByPlayer[playerIndex], 270 + playerIndex * 10 + roundIndex)
    ))
  ));
  room.players.forEach((player, index) => {
    cardsByPlayer[index].forEach(value => player.addCard(value));
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = REPEATED_EXHAUSTION_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  let finalResult = null;
  for (let roundIndex = 0; roundIndex < 3; roundIndex++) {
    room.players.forEach((player, playerIndex) => {
      finalResult = engine.playCards(player.id, [cardsByPlayer[playerIndex][roundIndex].id]);
    });
    assert.equal(room.gameState.attackerScore, roundIndex === 2 ? 5 : 0);
  }
  assert.deepEqual(finalResult.roundUpdate.scoreInfo.repeatedExhaustion, {
    playerId: room.players[0].id,
    playerName: room.players[0].name,
    streak: 3,
    penalty: 5,
    scoreDelta: 5,
    winnerIsAttacker: false
  });

  const firstTakeover = engine.applyRepeatedExhaustionAtRoundEnd(1);
  const secondAttackerWin = engine.applyRepeatedExhaustionAtRoundEnd(1);
  const thirdAttackerWin = engine.applyRepeatedExhaustionAtRoundEnd(1);
  assert.equal(firstTakeover.streak, 1, '接到牌权的当轮就是新赢家连续记录的第1轮');
  assert.equal(secondAttackerWin.streak, 2);
  assert.deepEqual(
    { streak: thirdAttackerWin.streak, penalty: thirdAttackerWin.penalty, scoreDelta: thirdAttackerWin.scoreDelta },
    { streak: 3, penalty: 5, scoreDelta: -5 }
  );
  assert.equal(room.gameState.attackerScore, 0);
});

test('冷却时间与时间冷却记录上轮出牌，但遇到基本跟牌义务时解禁首花色', () => {
  const cases = [
    {
      rule: COOLDOWN_TIME_RULE,
      type: 'rank',
      playerOneFirst: card('diamonds', '7', 200),
      secondLead: card('clubs', '9', 201),
      restricted: card('clubs', '7', 202),
      alternative: card('spades', '8', 203),
      expectedValue: '7'
    },
    {
      rule: TIME_COOLING_RULE,
      type: 'suit',
      playerOneFirst: card('diamonds', '4', 210),
      secondLead: card('diamonds', '9', 211),
      restricted: card('diamonds', 'K', 212),
      alternative: card('clubs', '8', 213),
      expectedValue: 'diamonds'
    }
  ];

  for (const testCase of cases) {
    const room = createRoom();
    const engine = new GameEngine(room, createIo());
    const firstRoundCards = [
      card('hearts', 'A', 220),
      testCase.playerOneFirst,
      card('clubs', '5', 221),
      card('spades', '6', 222)
    ];
    const remainingByPlayer = [
      [testCase.secondLead, card('clubs', 'Q', 223)],
      [testCase.restricted, testCase.alternative],
      [card('diamonds', '8', 224), card('clubs', '8', 225)],
      [card('diamonds', '9', 226), card('clubs', '9', 227)]
    ];
    room.players.forEach((player, index) => {
      player.addCard(firstRoundCards[index]);
      remainingByPlayer[index].forEach(value => player.addCard(value));
    });
    room.gameState.phase = GamePhases.PLAYING;
    room.gameState.selectedRule = testCase.rule;
    room.gameState.trumpSuit = 'no_trump';
    room.gameState.trumpRank = '2';
    room.gameState.buryingPlayerId = room.players[0].id;
    engine.setFirstPlayer(room.players[0].id);

    room.players.forEach((player, index) => {
      engine.playCards(player.id, [firstRoundCards[index].id]);
    });

    assert.equal(room.gameState.currentRound, 2);
    assert.equal(room.gameState.currentPlayerIndex, 0);
    assert.equal(room.gameState.cardCooldownType, testCase.type);
    assert.deepEqual(
      room.gameState.cardCooldownValuesByPlayerId.get(room.players[1].id),
      [testCase.expectedValue]
    );
    assert.deepEqual(
      room.gameState.toJSON().cardCooldown.valuesByPlayerId[room.players[1].id],
      [testCase.expectedValue]
    );

    engine.playCards(room.players[0].id, [testCase.secondLead.id]);
    assert.throws(
      () => engine.playCards(room.players[1].id, [testCase.alternative.id]),
      /必须|花色|跟牌/
    );
    assert.doesNotThrow(
      () => engine.playCards(room.players[1].id, [testCase.restricted.id]),
      '冷却不能凌驾于基本跟牌花色义务之上'
    );
  }
});

test('冷却规则在手牌全部受限时解除，Bot也只从未冷却牌中选择', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const twoSevens = [card('hearts', '7', 230), card('clubs', '7', 231)];
  twoSevens.forEach(value => room.players[0].addCard(value));
  room.players.slice(1).forEach((player, index) => {
    player.addCard(card('clubs', String(index + 3), 232 + index));
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = COOLDOWN_TIME_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  room.gameState.cardCooldownType = 'rank';
  room.gameState.cardCooldownValuesByPlayerId.set(room.players[0].id, ['7']);
  engine.setFirstPlayer(room.players[0].id);
  assert.doesNotThrow(() => engine.playCards(room.players[0].id, [twoSevens[0].id]));

  const bot = new BotService('simple');
  const cooled = card('diamonds', '7', 240);
  const available = card('diamonds', '8', 241);
  const botState = {
    selectedRule: COOLDOWN_TIME_RULE,
    currentRound: 2,
    leadingPattern: null,
    trumpSuit: 'spades',
    trumpRank: '2',
    cardCooldownValuesByPlayerId: new Map([[room.players[1].id, ['7']]])
  };
  assert.deepEqual(
    bot.getFallbackAction(botState, [cooled, available], room.players[1].id),
    [available.id]
  );
});

test('时间冷却把主花色、各花色级牌和王统一视为主花色', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const playedLevelCard = card('diamonds', '2', 250);
  room.gameState.selectedRule = TIME_COOLING_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.currentRoundPlays = [{
    playerId: room.players[0].id,
    cards: [playedLevelCard]
  }];

  engine.updateCardCooldownRestrictionsForNextRound();
  assert.deepEqual(
    room.gameState.cardCooldownValuesByPlayerId.get(room.players[0].id),
    ['trump'],
    '非主花色的级牌也应记录为主花色'
  );

  const hand = [
    card('clubs', '2', 251),
    card('spades', 'K', 252),
    card('joker', 'small_joker', 253),
    card('hearts', '7', 254)
  ];
  assert.deepEqual(
    getCardCooldownDisabledCards({
      gameState: room.gameState,
      playerId: room.players[0].id,
      playerCards: hand
    }).map(value => value.id),
    hand.slice(0, 3).map(value => value.id),
    '任意一张主牌触发的冷却都应禁用全部主牌'
  );
});

test('举贤任能只由一号位发动，并把原一号位移到本轮最后', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const trickCards = ['3', '4', '5', '6'].map(
    (rank, index) => card('hearts', rank, index + 90)
  );
  room.players.forEach((player, index) => {
    player.addCard(trickCards[index]);
    player.addCard(card('clubs', String(index + 7), index + 90));
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = RECOMMEND_TALENT_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  const activation = engine.activateRecommendTalent(room.players[0].id);
  assert.equal(activation.currentPlayerIndex, 1);
  assert.equal(
    engine.hasUsedActiveSkill(room.players[0].id, ActiveSkillIds.RECOMMEND_TALENT),
    true
  );
  assert.throws(
    () => engine.activateRecommendTalent(room.players[1].id),
    /一号位/
  );

  engine.playCards(room.players[1].id, [trickCards[1].id]);
  engine.playCards(room.players[2].id, [trickCards[2].id]);
  engine.playCards(room.players[3].id, [trickCards[3].id]);
  const finalPlay = engine.playCards(room.players[0].id, [trickCards[0].id]);
  assert.equal(finalPlay.roundUpdate.type, 'round_ended');
  assert.deepEqual(
    room.gameState.playHistory.slice(-4).map(play => play.playerId),
    [room.players[1].id, room.players[2].id, room.players[3].id, room.players[0].id]
  );
});

test('意外保险让闲家赢高分轮最多计30分，庄家方赢高分轮则补超额给闲家', () => {
  const playFortyPointTrick = ({ attackerWins }) => {
    const room = createRoom();
    const engine = new GameEngine(room, createIo());
    const trickCards = attackerWins
      ? [
          card('hearts', 'K', 100),
          card('spades', 'K', 100),
          card('clubs', 'K', 100),
          card('diamonds', 'K', 100)
        ]
      : [
          card('hearts', 'K', 110),
          card('diamonds', 'K', 110),
          card('clubs', 'K', 110),
          card('spades', 'K', 110)
        ];
    room.players.forEach((player, index) => {
      player.addCard(trickCards[index]);
      player.addCard(card('clubs', String(index + 3), index + 120));
    });
    room.gameState.phase = GamePhases.PLAYING;
    room.gameState.selectedRule = ACCIDENT_INSURANCE_RULE;
    room.gameState.trumpSuit = attackerWins ? 'spades' : 'no_trump';
    room.gameState.trumpRank = '2';
    room.gameState.buryingPlayerId = room.players[0].id;
    engine.setFirstPlayer(room.players[0].id);

    let result;
    room.players.forEach((player, index) => {
      result = engine.playCards(player.id, [trickCards[index].id]);
    });
    return { room, scoreInfo: result.roundUpdate.scoreInfo };
  };

  const attackerResult = playFortyPointTrick({ attackerWins: true });
  assert.equal(attackerResult.scoreInfo.winnerIsAttacker, true);
  assert.equal(attackerResult.scoreInfo.attackerRoundPointsAwarded, 30);
  assert.equal(attackerResult.scoreInfo.accidentInsuranceWithheld, 10);
  assert.equal(attackerResult.room.gameState.attackerScore, 30);

  const dealerResult = playFortyPointTrick({ attackerWins: false });
  assert.equal(dealerResult.scoreInfo.winnerIsAttacker, false);
  assert.equal(dealerResult.scoreInfo.attackerRoundPointsAwarded, 10);
  assert.equal(dealerResult.scoreInfo.accidentInsuranceBonus, 10);
  assert.equal(dealerResult.room.gameState.attackerScore, 10);
});

test('绝处逢生可暂拒后再次询问，确认后整手都按主牌处理', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io);
  const player = room.players[0];
  const opponentHeart = card('hearts', 'Q', 99);
  ['3', '4', '6', '7', '8'].forEach((rank, index) => player.addCard(card('hearts', rank, index)));
  room.players[1].addCard(opponentHeart);
  room.gameState.selectedRule = getRuleById(RuleIds.LAST_STAND);
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';

  assert.ok(engine.requestLastStandIfEligible(player));
  assert.equal(engine.hasPendingLastStandDecision(), true);
  engine.respondLastStand(player.id, false);
  assert.equal(room.gameState.lastStandActivatedPlayerIds.has(player.id), false);
  assert.ok(engine.requestLastStandIfEligible(player));
  engine.respondLastStand(player.id, true);
  assert.equal(room.gameState.lastStandActivatedPlayerIds.has(player.id), true);
  assert.ok(player.cards.every(value => value.isLastStandTrump));
  assert.ok(player.cards.every(value => getCardStrength(value, 'spades', '2', room.gameState.selectedRule) > 900));
  assert.equal(opponentHeart.isLastStandTrump, false);
  assert.equal(isTrumpCard(opponentHeart, 'spades', '2'), false, '对手同花色牌仍然是副牌');
  assert.ok(getCardStrength(opponentHeart, 'spades', '2', room.gameState.selectedRule) < 900);
});

test('绝处逢生无人亮主时随机定主、拒绝一对王，并在埋底手牌变化后检查发动条件', () => {
  const randomRoom = createRoom();
  const randomIo = createIo();
  randomRoom.gameState.selectedRule = getRuleById(RuleIds.LAST_STAND);
  randomRoom.gameState.phase = GamePhases.DRAWING;
  const manager = new DrawingPhaseManager(
    randomRoom,
    randomIo,
    null,
    null,
    null,
    () => 0.8
  );
  manager.assignDealer();
  assert.equal(randomRoom.gameState.trumpSuit, 'spades');
  assert.ok(randomIo.events.some(({ event, payload }) =>
    event === 'trump_updated' && payload.systemSelected === true
  ));

  const declarationRoom = createRoom();
  const declarationIo = createIo();
  const handlers = new Map();
  const socketEvents = [];
  const socket = {
    id: declarationRoom.players[0].socketId,
    on(event, handler) {
      handlers.set(event, handler);
    },
    emit(event, payload) {
      socketEvents.push({ event, payload });
    }
  };
  declarationRoom.gameState.phase = GamePhases.DRAWING;
  declarationRoom.gameState.selectedRule = getRuleById(RuleIds.LAST_STAND);
  declarationRoom.players[0].addCard(card('joker', 'big_joker', 0));
  declarationRoom.players[0].addCard(card('joker', 'big_joker', 1));
  registerPlayerHandlers(declarationIo, socket, {
    getRoom: roomId => roomId === declarationRoom.id ? declarationRoom : null
  });
  handlers.get('declare_trump')({
    roomId: declarationRoom.id,
    suit: 'joker',
    count: 2
  });
  assert.equal(socketEvents.at(-1).payload.message, '绝处逢生不能用一对王反主');

  const buryRoom = createRoom();
  const buryIo = createIo();
  const buryEngine = new GameEngine(buryRoom, buryIo);
  const dealer = buryRoom.players[0];
  const survivorCards = ['3', '4', '6', '7', '8']
    .map((rank, index) => card('hearts', rank, index));
  const buriedCards = ['3', '4', '5', '6', '7', '8', '9', '10']
    .map((rank, index) => card('spades', rank, index + 20));
  [...survivorCards, ...buriedCards].forEach(value => dealer.addCard(value));
  buryRoom.gameState.phase = GamePhases.BURYING;
  buryRoom.gameState.selectedRule = getRuleById(RuleIds.LAST_STAND);
  buryRoom.gameState.trumpSuit = 'spades';
  buryRoom.gameState.trumpRank = '2';
  buryRoom.gameState.buryingPlayerId = dealer.id;
  buryEngine.buryCards(dealer.id, buriedCards.map(value => value.id));
  assert.equal(buryRoom.gameState.lastStandPendingPlayerIds.has(dealer.id), true);
  assert.ok(buryIo.events.some(({ target, event }) =>
    target === dealer.socketId && event === 'last_stand_decision_required'
  ));
});

test('时间倒流注册为每人一次、可在轮中预备的主动技能', () => {
  const rule = getRuleById(RuleIds.TIME_REVERSAL);
  assert.equal(rule.name, '时间倒流');
  assert.deepEqual(rule.activeSkill, {
    id: ActiveSkillIds.TIME_REVERSAL,
    name: '时间倒流',
    usageLimit: 1,
    timing: 'anytime_during_round',
    effect: 'rewind_completed_round'
  });
});

test('时间倒流允许多人预备，首个确认发动者完整恢复手牌、得分与牌权', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io);
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = getRuleById(RuleIds.TIME_REVERSAL);
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;

  const trickCards = [
    card('hearts', 'K'),
    card('hearts', 'A'),
    card('hearts', '5'),
    card('hearts', '10')
  ];
  room.players.forEach((player, index) => {
    player.addCard(trickCards[index]);
    player.addCard(card('clubs', String(index + 3)));
  });
  engine.setFirstPlayer(room.players[0].id);

  const reservation = engine.activateTimeReversal(room.players[2].id);
  assert.equal(reservation.round, 1);
  const secondReservation = engine.activateTimeReversal(room.players[3].id);
  assert.equal(secondReservation.round, 1);
  const thirdReservation = engine.activateTimeReversal(room.players[1].id);
  assert.equal(thirdReservation.round, 1);

  engine.playCards(room.players[0].id, [trickCards[0].id]);
  engine.playCards(room.players[1].id, [trickCards[1].id]);
  engine.playCards(room.players[2].id, [trickCards[2].id]);
  const finalPlay = engine.playCards(room.players[3].id, [trickCards[3].id]);

  assert.equal(finalPlay.timeReversalPending, true);
  assert.equal(room.gameState.currentRound, 2);
  assert.equal(room.gameState.attackerScore, 25);
  assert.throws(
    () => engine.playCards(room.players[1].id, [room.players[1].cards[0].id]),
    /等待时间倒流决定/
  );

  engine.promptTimeReversalDecision();
  assert.deepEqual(
    io.events
      .filter(({ event }) => event === 'time_reversal_decision_required')
      .map(({ target }) => target)
      .sort(),
    [room.players[1].socketId, room.players[2].socketId, room.players[3].socketId].sort()
  );
  const declined = engine.respondTimeReversal(room.players[3].id, false);
  assert.equal(declined.resolved, false);
  assert.equal(
    engine.hasUsedActiveSkill(room.players[3].id, ActiveSkillIds.TIME_REVERSAL),
    false
  );
  const result = engine.respondTimeReversal(room.players[2].id, true);
  assert.equal(result.accepted, true);
  assert.equal(room.gameState.currentRound, 1);
  assert.equal(room.gameState.currentPlayerIndex, 0);
  assert.equal(room.gameState.roundStartPlayerIndex, 0);
  assert.equal(room.gameState.currentRoundPlays.length, 0);
  assert.equal(room.gameState.playHistory.length, 0);
  assert.equal(room.gameState.attackerScore, 0);
  assert.equal(room.gameState.collectedPointCards.length, 0);
  assert.deepEqual(room.players.map(player => player.cards.length), [2, 2, 2, 2]);
  assert.equal(
    engine.hasUsedActiveSkill(room.players[2].id, ActiveSkillIds.TIME_REVERSAL),
    true
  );
  assert.throws(
    () => engine.respondTimeReversal(room.players[1].id, true),
    /当前没有等待你的时间倒流决定/
  );
  assert.equal(
    engine.hasUsedActiveSkill(room.players[1].id, ActiveSkillIds.TIME_REVERSAL),
    false
  );
  assert.throws(
    () => engine.activateTimeReversal(room.players[3].id),
    /本轮已经发动过/
  );
});

test('第四家出牌后的两秒仍可为刚结束的一轮预备时间倒流', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = getRuleById(RuleIds.TIME_REVERSAL);
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  const trickCards = ['7', '8', '9', '10'].map((rank, index) => card('hearts', rank, index));
  room.players.forEach((player, index) => {
    player.addCard(trickCards[index]);
    player.addCard(card('clubs', String(index + 3), index + 10));
  });
  engine.setFirstPlayer(room.players[0].id);

  room.players.forEach((player, index) => {
    engine.playCards(player.id, [trickCards[index].id]);
  });
  assert.equal(room.gameState.currentRound, 2);
  assert.equal(room.gameState.timeReversalDecisionState, 'holding');
  assert.equal(room.gameState.timeReversalWindowRound, 1);
  const pendingLeader = room.players[room.gameState.currentPlayerIndex];
  const pendingLeaderCardId = pendingLeader.cards[0].id;
  assert.throws(
    () => engine.playCards(pendingLeader.id, [pendingLeaderCardId]),
    /本轮正在等待时间倒流决定/
  );
  assert.equal(pendingLeader.cards.some(cardData => cardData.id === pendingLeaderCardId), true);

  const lateReservation = engine.activateTimeReversal(room.players[1].id);
  assert.equal(lateReservation.round, 1, '轮末窗口预备的目标必须是刚结束的第一轮');
  engine.promptTimeReversalDecision();
  const result = engine.respondTimeReversal(room.players[1].id, true);
  assert.equal(result.round, 1);
  assert.equal(room.gameState.currentRound, 1);
  assert.equal(room.gameState.currentPlayerIndex, 0);
  assert.deepEqual(room.players.map(player => player.cards.length), [2, 2, 2, 2]);
});

test('时间倒流选择保留结果不消耗技能，末轮也要等决定后才结算游戏', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = getRuleById(RuleIds.TIME_REVERSAL);
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  const trickCards = [
    card('hearts', '3'),
    card('hearts', '4'),
    card('hearts', '5'),
    card('hearts', '6')
  ];
  room.players.forEach((player, index) => player.addCard(trickCards[index]));
  engine.setFirstPlayer(room.players[0].id);
  engine.activateTimeReversal(room.players[0].id);

  engine.playCards(room.players[0].id, [trickCards[0].id]);
  engine.playCards(room.players[1].id, [trickCards[1].id]);
  engine.playCards(room.players[2].id, [trickCards[2].id]);
  const finalPlay = engine.playCards(room.players[3].id, [trickCards[3].id]);
  assert.equal(finalPlay.gameFinished, false);
  assert.equal(finalPlay.timeReversalPending, true);
  assert.equal(room.gameState.phase, GamePhases.PLAYING);

  engine.promptTimeReversalDecision();
  const result = engine.respondTimeReversal(room.players[0].id, false);
  assert.equal(result.accepted, false);
  assert.equal(result.gameFinished, true);
  assert.equal(room.gameState.phase, GamePhases.REVEALING);
  assert.equal(
    engine.hasUsedActiveSkill(room.players[0].id, ActiveSkillIds.TIME_REVERSAL),
    false
  );
});

test('等价互惠注册为一号位每人一次的主动拼点技能', () => {
  assert.equal(EQUIVALENT_RECIPROCITY_RULE.name, '等价互惠');
  assert.deepEqual(EQUIVALENT_RECIPROCITY_RULE.activeSkill, {
    id: ActiveSkillIds.EQUIVALENT_RECIPROCITY,
    name: '等价互惠',
    usageLimit: 1,
    timing: 'first_position_before_play',
    effect: 'compare_and_exchange'
  });
});

test('等价互惠由一号位选人并秘密拼点，主牌胜副牌后交换且输家一方失去5分', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const initiator = room.players[0];
  const target = room.players[1];
  const sideAce = card('hearts', 'A');
  const trumpThree = card('spades', '3');
  initiator.addCard(sideAce);
  initiator.addCard(card('clubs', '4'));
  target.addCard(trumpThree);
  target.addCard(card('diamonds', '5'));
  room.players[2].addCard(card('clubs', '6'));
  room.players[3].addCard(card('clubs', '7'));
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = EQUIVALENT_RECIPROCITY_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.dealerPlayerIndex = 0;
  room.gameState.attackerScore = 20;
  engine.setFirstPlayer(initiator.id);

  const challenge = engine.startEquivalentReciprocity(initiator.id, target.id);
  assert.equal(room.gameState.toJSON().equivalentReciprocity.initiatorPlayerId, initiator.id);
  assert.throws(
    () => engine.playCards(initiator.id, [sideAce.id]),
    /先完成等价互惠拼点/
  );
  const firstSelection = engine.submitEquivalentReciprocityCard(
    initiator.id,
    challenge.challengeId,
    sideAce.id
  );
  assert.equal(firstSelection.resolved, false);
  assert.deepEqual(room.gameState.toJSON().equivalentReciprocity.selectedPlayerIds, [initiator.id]);

  const result = engine.submitEquivalentReciprocityCard(
    target.id,
    challenge.challengeId,
    trumpThree.id
  );
  assert.equal(result.resolved, true);
  assert.equal(result.winnerPlayerId, target.id, '任意主牌必须大于任意副牌');
  assert.equal(result.loserPlayerId, initiator.id);
  assert.equal(result.attackerScoreDelta, 5, '庄家方输掉拼点时闲家应增加5分');
  assert.equal(room.gameState.attackerScore, 25);
  assert.ok(initiator.cards.some(value => value.id === trumpThree.id));
  assert.ok(target.cards.some(value => value.id === sideAce.id));
  assert.equal(room.gameState.equivalentReciprocityChallenge, null);
  assert.equal(
    engine.hasUsedActiveSkill(initiator.id, ActiveSkillIds.EQUIVALENT_RECIPROCITY),
    true
  );
  assert.throws(
    () => engine.startEquivalentReciprocity(initiator.id, room.players[2].id),
    /只能发动一次/
  );
});

test('等价互惠的副牌只比较点数，同点平局不改分但仍交换', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const initiator = room.players[0];
  const target = room.players[2];
  const heartKing = card('hearts', 'K');
  const diamondKing = card('diamonds', 'K');
  initiator.addCard(heartKing);
  target.addCard(diamondKing);
  room.players[1].addCard(card('clubs', '3'));
  room.players[3].addCard(card('clubs', '4'));
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = EQUIVALENT_RECIPROCITY_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.dealerPlayerIndex = 0;
  room.gameState.attackerScore = 35;
  engine.setFirstPlayer(initiator.id);

  const challenge = engine.startEquivalentReciprocity(initiator.id, target.id);
  engine.submitEquivalentReciprocityCard(initiator.id, challenge.challengeId, heartKing.id);
  const result = engine.submitEquivalentReciprocityCard(
    target.id,
    challenge.challengeId,
    diamondKing.id
  );

  assert.equal(result.isTie, true);
  assert.equal(result.winnerPlayerId, null);
  assert.equal(result.loserPlayerId, null);
  assert.equal(result.attackerScoreDelta, 0);
  assert.equal(room.gameState.attackerScore, 35);
  assert.ok(initiator.cards.some(value => value.id === diamondKing.id));
  assert.ok(target.cards.some(value => value.id === heartKing.id));
});

test('经久不衰已注册并使用默认牌局配置', () => {
  assert.equal(ENDURING_RULE.name, '经久不衰');
  assert.deepEqual(getRuleSetup(ENDURING_RULE), {
    bottomCardsCount: 8,
    attackerStartingScore: 0
  });
});

test('经久不衰只在有效花色、牌型和长度一致时继承较高牌力', () => {
  const trumpSuit = 'spades';
  const trumpRank = '2';
  const bigJoker = card('joker', 'big_joker');
  const previousSingle = {
    cards: [bigJoker],
    pattern: detectPattern([bigJoker], trumpSuit, trumpRank, ENDURING_RULE)
  };
  const lowTrump = card('spades', '3');
  const matchingSingle = {
    cards: [lowTrump],
    pattern: detectPattern([lowTrump], trumpSuit, trumpRank, ENDURING_RULE)
  };

  const inherited = resolveEnduringComparison(
    matchingSingle,
    previousSingle,
    trumpSuit,
    trumpRank,
    ENDURING_RULE
  );
  assert.equal(inherited.inherited, true);
  assert.equal(inherited.comparisonPattern.suit, 'trump');
  assert.equal(
    inherited.comparisonPattern.strength,
    previousSingle.pattern.strength,
    '任意主牌可继承上轮大王的牌力'
  );

  const sideAce = card('hearts', 'A');
  const wrongSuit = resolveEnduringComparison(
    {
      cards: [sideAce],
      pattern: detectPattern([sideAce], trumpSuit, trumpRank, ENDURING_RULE)
    },
    previousSingle,
    trumpSuit,
    trumpRank,
    ENDURING_RULE
  );
  assert.equal(wrongSuit.inherited, false, '副牌不能继承上轮主牌牌力');

  const lowTrumpPairCards = [card('spades', '3', 0), card('spades', '3', 1)];
  const wrongPattern = resolveEnduringComparison(
    {
      cards: lowTrumpPairCards,
      pattern: detectPattern(lowTrumpPairCards, trumpSuit, trumpRank, ENDURING_RULE)
    },
    previousSingle,
    trumpSuit,
    trumpRank,
    ENDURING_RULE
  );
  assert.equal(wrongPattern.inherited, false, '对子不能继承上轮单牌牌力');
});

test('经久不衰的甩牌必须同花色且逐项匹配相同组件结构', () => {
  const trumpSuit = 'spades';
  const trumpRank = '2';
  const createThrowPlay = cards => {
    const parsed = parseThrowCombination(cards, trumpSuit, trumpRank, ENDURING_RULE);
    return {
      cards,
      pattern: {
        type: PatternTypes.THROW,
        suit: parsed.suit,
        components: parsed.components,
        length: cards.length,
        strength: Math.max(...parsed.components.map(component => component.strength))
      }
    };
  };
  const previous = createThrowPlay([
    card('hearts', 'A', 0),
    card('hearts', 'A', 1),
    card('hearts', 'K')
  ]);
  const matching = createThrowPlay([
    card('hearts', '4', 0),
    card('hearts', '4', 1),
    card('hearts', '3')
  ]);
  const matchingResolution = resolveEnduringComparison(
    matching,
    previous,
    trumpSuit,
    trumpRank,
    ENDURING_RULE
  );
  assert.equal(matchingResolution.inherited, true);
  assert.equal(matchingResolution.inheritedComponentCount, 2);
  assert.deepEqual(
    matchingResolution.comparisonPattern.components
      .map(component => `${component.type}:${component.length}`)
      .sort(),
    previous.pattern.components
      .map(component => `${component.type}:${component.length}`)
      .sort()
  );

  const differentStructure = createThrowPlay([
    card('hearts', 'Q'),
    card('hearts', 'J'),
    card('hearts', '10')
  ]);
  assert.equal(
    resolveEnduringComparison(
      differentStructure,
      previous,
      trumpSuit,
      trumpRank,
      ENDURING_RULE
    ).inherited,
    false
  );

  const differentSuit = createThrowPlay([
    card('diamonds', '4', 0),
    card('diamonds', '4', 1),
    card('diamonds', '3')
  ]);
  assert.equal(
    resolveEnduringComparison(
      differentSuit,
      previous,
      trumpSuit,
      trumpRank,
      ENDURING_RULE
    ).inherited,
    false
  );
});

test('经久不衰在整轮结束后固化上轮，并在下轮实际参与胜负比较', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const firstRoundCards = [
    card('joker', 'big_joker'),
    card('spades', '4'),
    card('spades', '5'),
    card('spades', '6')
  ];
  const secondRoundCards = [
    card('spades', '3'),
    card('joker', 'small_joker'),
    card('spades', '7'),
    card('spades', '8')
  ];
  room.players.forEach((player, index) => {
    player.addCard(firstRoundCards[index]);
    player.addCard(secondRoundCards[index]);
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = ENDURING_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  room.players.forEach((player, index) => {
    engine.playCards(player.id, [firstRoundCards[index].id]);
  });
  assert.equal(room.gameState.currentRound, 2);
  assert.equal(
    room.gameState.enduringLastPlaysByPlayerId.get(room.players[0].id).pattern.strength,
    1000
  );

  const inheritedLead = engine.playCards(room.players[0].id, [secondRoundCards[0].id]);
  assert.equal(inheritedLead.enduringInheritance?.sourceCards[0].rank, 'big_joker');
  assert.equal(room.gameState.currentRoundPlays[0].comparisonPattern.strength, 1000);
  engine.playCards(room.players[1].id, [secondRoundCards[1].id]);
  assert.equal(
    room.gameState.currentWinnerIndex,
    0,
    '继承大王牌力的低主牌应压住小王'
  );
  engine.playCards(room.players[2].id, [secondRoundCards[2].id]);
  const finalResult = engine.playCards(room.players[3].id, [secondRoundCards[3].id]);
  assert.equal(finalResult.roundWinner.playerId, room.players[0].id);
});

test('平均池化只在整轮结束后以队友有效单牌的平均牌力重算赢家', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const trickCards = [
    card('hearts', 'A'),
    card('hearts', 'Q'),
    card('hearts', '3'),
    card('hearts', 'K')
  ];
  room.players.forEach((player, index) => {
    player.addCard(trickCards[index]);
    player.addCard(card('clubs', String(index + 4)));
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = AVERAGE_POOLING_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  engine.playCards(room.players[0].id, [trickCards[0].id]);
  engine.playCards(room.players[1].id, [trickCards[1].id]);
  engine.playCards(room.players[2].id, [trickCards[2].id]);
  const result = engine.playCards(room.players[3].id, [trickCards[3].id]);

  assert.equal(result.roundWinner.playerId, room.players[1].id);
  assert.equal(result.roundUpdate.averagePooling.triggered, true);
  assert.deepEqual(
    result.roundUpdate.averagePooling.teams.map(team => team.averageStrength),
    [8.5, 12.5]
  );
});

test('average pooling: one pooled team beats a pair plus loose same-suit cards', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const trickCards = [
    [card('clubs', '9', 0), card('clubs', '9', 1)],
    [card('clubs', 'Q', 0), card('clubs', 'Q', 1)],
    [card('clubs', '5', 0), card('clubs', '5', 1)],
    [card('clubs', '3', 0), card('clubs', '4', 0)]
  ];
  room.players.forEach((player, index) => {
    trickCards[index].forEach(currentCard => player.addCard(currentCard));
    player.addCard(card('diamonds', String(index + 6)));
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = AVERAGE_POOLING_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  engine.playCards(room.players[0].id, trickCards[0].map(currentCard => currentCard.id));
  engine.playCards(room.players[1].id, trickCards[1].map(currentCard => currentCard.id));
  engine.playCards(room.players[2].id, trickCards[2].map(currentCard => currentCard.id));
  const result = engine.playCards(
    room.players[3].id,
    trickCards[3].map(currentCard => currentCard.id)
  );

  assert.equal(result.roundUpdate.averagePooling.exclusiveTeam, 1);
  assert.equal(result.roundWinner.playerId, room.players[0].id);
  assert.equal(result.roundUpdate.nextRoundLeader.playerId, room.players[0].id);
  assert.equal(result.roundUpdate.averagePooling.teams[0].averageStrength, 7);
});

test('average pooling: pairs split into single channels against an AK throw', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const trickCards = [
    [card('clubs', 'A', 0), card('clubs', 'K', 0)],
    [card('clubs', 'Q', 0), card('clubs', 'Q', 1)],
    [card('hearts', '8', 0), card('hearts', '7', 0)],
    [card('clubs', '10', 0), card('clubs', '10', 1)]
  ];
  room.players.forEach((player, index) => {
    trickCards[index].forEach(currentCard => player.addCard(currentCard));
    player.addCard(card('diamonds', String(index + 3)));
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = AVERAGE_POOLING_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  engine.playCards(room.players[0].id, trickCards[0].map(currentCard => currentCard.id));
  engine.playCards(room.players[1].id, trickCards[1].map(currentCard => currentCard.id));
  engine.playCards(room.players[2].id, trickCards[2].map(currentCard => currentCard.id));
  const result = engine.playCards(
    room.players[3].id,
    trickCards[3].map(currentCard => currentCard.id)
  );

  assert.equal(result.roundUpdate.averagePooling.exclusiveTeam, 2);
  assert.equal(result.roundWinner.playerId, room.players[1].id);
  assert.equal(result.roundUpdate.nextRoundLeader.playerId, room.players[1].id);
  assert.deepEqual(result.roundUpdate.averagePooling.teams[0].averageStrengths, [11, 11]);
});

test('average pooling: a complete ruff outranks the other team pooling successfully', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const trickCards = [
    [card('clubs', '9', 0), card('clubs', '9', 1)],
    [card('spades', '3', 0), card('spades', '3', 1)],
    [card('clubs', '5', 0), card('clubs', '5', 1)],
    [card('hearts', '8', 0), card('hearts', '7', 0)]
  ];
  room.players.forEach((player, index) => {
    trickCards[index].forEach(currentCard => player.addCard(currentCard));
    player.addCard(card('diamonds', String(index + 3)));
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = AVERAGE_POOLING_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  engine.playCards(room.players[0].id, trickCards[0].map(currentCard => currentCard.id));
  engine.playCards(room.players[1].id, trickCards[1].map(currentCard => currentCard.id));
  engine.playCards(room.players[2].id, trickCards[2].map(currentCard => currentCard.id));
  const result = engine.playCards(
    room.players[3].id,
    trickCards[3].map(currentCard => currentCard.id)
  );

  assert.equal(result.roundUpdate.averagePooling.triggered, false);
  assert.equal(result.roundUpdate.averagePooling.exclusiveTeam, null);
  assert.deepEqual(result.roundUpdate.averagePooling.teams, []);
  assert.equal(result.roundUpdate.averagePooling.ruffPriority, true);
  assert.deepEqual(result.roundUpdate.averagePooling.ruffPlayerIds, [room.players[1].id]);
  assert.equal(result.roundWinner.playerId, room.players[1].id);
  assert.equal(result.roundUpdate.nextRoundLeader.playerId, room.players[1].id);
});

test('梦中杀人允许同点数或同有效花色醒来，多人成功时先出者保持最大', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const trickCards = [
    card('hearts', 'A'),
    card('diamonds', 'A'),
    card('hearts', '3'),
    card('hearts', 'K')
  ];
  room.players.forEach((player, index) => {
    player.addCard(trickCards[index]);
    player.addCard(card('clubs', String(index + 4)));
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = DREAM_KILLING_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  assert.equal(engine.activateDreamKilling(room.players[1].id).sleeping, true);
  assert.equal(engine.activateDreamKilling(room.players[2].id).sleeping, true);
  assert.deepEqual(
    new Set(room.gameState.toJSON().dreamKilling.sleepingPlayerIds),
    new Set([room.players[1].id, room.players[2].id])
  );

  engine.playCards(room.players[0].id, [trickCards[0].id]);
  const rankMatch = engine.playCards(
    room.players[1].id,
    [trickCards[1].id],
    null,
    null,
    { dreamKillingRandom: true }
  );
  assert.equal(rankMatch.dreamKilling.success, true);
  assert.equal(rankMatch.dreamKilling.matchedRank, true);
  const suitMatch = engine.playCards(
    room.players[2].id,
    [trickCards[2].id],
    null,
    null,
    { dreamKillingRandom: true }
  );
  assert.equal(suitMatch.dreamKilling.success, true);
  assert.equal(suitMatch.dreamKilling.matchedSuit, true);
  assert.equal(engine.isDreamKillingSleeping(room.players[1].id), false);
  assert.equal(engine.isDreamKillingSleeping(room.players[2].id), false);

  const result = engine.playCards(room.players[3].id, [trickCards[3].id]);
  assert.equal(result.roundWinner.playerId, room.players[1].id);
  assert.equal(result.roundUpdate.nextRoundLeader.playerId, room.players[1].id);
});

test('梦中杀人只允许没有主牌的玩家发动，梦中不能手动指定出牌', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = DREAM_KILLING_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.players[0].addCard(card('spades', '4'));
  room.players[1].addCard(card('hearts', '4'));
  engine.setFirstPlayer(room.players[1].id);

  assert.throws(() => engine.activateDreamKilling(room.players[0].id), /仍有主牌/);
  engine.activateDreamKilling(room.players[1].id);
  assert.throws(
    () => engine.playCards(room.players[1].id, [room.players[1].cards[0].id]),
    /仍在梦中/
  );
});

test('dream killing random play ignores suit and pattern-following legality while asleep', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const leadingPair = [card('hearts', '9', 0), card('hearts', '9', 1)];
  const requiredPair = [card('hearts', '3', 0), card('hearts', '3', 1)];
  const illegalRandomCards = [card('clubs', '4', 0), card('diamonds', '5', 0)];
  leadingPair.forEach(currentCard => room.players[0].addCard(currentCard));
  room.players[0].addCard(card('clubs', '6'));
  [...requiredPair, ...illegalRandomCards].forEach(currentCard =>
    room.players[1].addCard(currentCard)
  );
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = DREAM_KILLING_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);
  engine.activateDreamKilling(room.players[1].id);

  engine.playCards(room.players[0].id, leadingPair.map(currentCard => currentCard.id));
  const botService = new BotService(room.config.botType);
  const randomIds = botService.getRandomAction(
    room.gameState,
    room.players[1].cards,
    sequenceRandom([0.6, 0.9])
  );
  assert.deepEqual(randomIds, illegalRandomCards.map(currentCard => currentCard.id));

  const result = engine.playCards(
    room.players[1].id,
    randomIds,
    null,
    null,
    { dreamKillingRandom: true }
  );
  assert.equal(result.dreamKilling.success, false);
  assert.equal(engine.isDreamKillingSleeping(room.players[1].id), true);
  assert.equal(room.gameState.currentRoundPlays[1].pattern.type, PatternTypes.INVALID);
  assert.equal(room.gameState.currentWinnerIndex, 0);
});

test('珠联璧合仅一队达成时由该队后出者获胜并取得下轮牌权', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const trickCards = [
    card('hearts', '3', 0),
    card('hearts', 'A', 0),
    card('hearts', '3', 1),
    card('hearts', 'K', 0)
  ];
  room.players.forEach((player, index) => {
    player.addCard(trickCards[index]);
    player.addCard(card('clubs', String(index + 4)));
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = JOINT_HARMONY_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  trickCards.slice(0, 3).forEach((value, index) => {
    engine.playCards(room.players[index].id, [value.id]);
  });
  const result = engine.playCards(room.players[3].id, [trickCards[3].id]);
  assert.equal(result.roundUpdate.jointHarmony.triggered, true);
  assert.equal(result.roundUpdate.jointHarmony.bothTeams, false);
  assert.equal(result.roundWinner.playerId, room.players[2].id);
  assert.equal(result.roundUpdate.nextRoundLeader.playerId, room.players[2].id);
});

test('两队同时珠联璧合时不覆盖牌面正常结算结果', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const trickCards = [
    card('hearts', '3', 0),
    card('hearts', 'A', 0),
    card('hearts', '3', 1),
    card('hearts', 'A', 1)
  ];
  room.players.forEach((player, index) => {
    player.addCard(trickCards[index]);
    player.addCard(card('clubs', String(index + 4)));
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = JOINT_HARMONY_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  trickCards.slice(0, 3).forEach((value, index) => {
    engine.playCards(room.players[index].id, [value.id]);
  });
  const result = engine.playCards(room.players[3].id, [trickCards[3].id]);
  assert.equal(result.roundUpdate.jointHarmony.bothTeams, true);
  assert.equal(result.roundWinner.playerId, room.players[1].id);
});

test('神兵天降使用独立无王牌堆，发动后本轮互斥且轮末两张一起替换', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo(), sequenceRandom([0.17, 0.71, 0.33, 0.89]));
  const trickCards = [
    card('hearts', '3', 0),
    card('hearts', '4', 0),
    card('hearts', '5', 0),
    card('hearts', '6', 0)
  ];
  room.players.forEach((player, index) => {
    player.addCard(trickCards[index]);
    player.addCard(card('clubs', String(index + 7), 0));
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = DIVINE_WEAPON_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  assert.equal(room.gameState.divineWeaponCards.length, 2);
  assert.equal(room.gameState.divineWeaponReserveCards.length, 50);
  assert.equal(
    [...room.gameState.divineWeaponCards, ...room.gameState.divineWeaponReserveCards]
      .some(currentCard => currentCard.suit === 'joker'),
    false
  );

  const divineAce = card('hearts', 'A', 0);
  divineAce.id = 'divine-hearts-A';
  const divineTwo = card('diamonds', '2', 0);
  divineTwo.id = 'divine-diamonds-2';
  room.gameState.divineWeaponCards = [divineAce, divineTwo];
  room.gameState.divineWeaponReserveCards = room.gameState.divineWeaponReserveCards.filter(
    currentCard => currentCard.id !== divineAce.id && currentCard.id !== divineTwo.id
  );

  const firstResult = engine.playCards(
    room.players[0].id,
    [trickCards[0].id],
    null,
    ActiveSkillIds.DIVINE_WEAPON,
    {
      divineWeaponCardId: divineAce.id,
      divineWeaponSourceCardId: trickCards[0].id
    }
  );
  assert.equal(firstResult.playedCards[0].rank, 'A');
  assert.equal(firstResult.playedCards[0].suit, 'hearts');
  assert.equal(firstResult.playedCards[0].originalRank, '3');
  assert.equal(firstResult.playedCards[0].isDivineWeaponTransformed, true);
  assert.equal(room.gameState.divineWeaponUsedThisRound, true);
  assert.equal(room.gameState.divineWeaponUsedCardId, divineAce.id);
  assert.throws(() => engine.playCards(
    room.players[1].id,
    [trickCards[1].id],
    null,
    ActiveSkillIds.DIVINE_WEAPON,
    {
      divineWeaponCardId: divineAce.id,
      divineWeaponSourceCardId: trickCards[1].id
    }
  ), /本轮已有玩家发动/);

  engine.playCards(room.players[1].id, [trickCards[1].id]);
  engine.playCards(room.players[2].id, [trickCards[2].id]);
  const roundResult = engine.playCards(room.players[3].id, [trickCards[3].id]);
  assert.equal(roundResult.roundWinner.playerId, room.players[0].id);
  assert.equal(roundResult.roundUpdate.divineWeaponRefresh.generation, 2);
  assert.deepEqual(
    roundResult.roundUpdate.divineWeaponRefresh.previousCards.map(currentCard => currentCard.id),
    [divineAce.id, divineTwo.id]
  );
  assert.equal(room.gameState.divineWeaponUsedThisRound, false);
  assert.equal(room.gameState.divineWeaponUsedCardId, null);
  assert.equal(room.gameState.divineWeaponCards.length, 2);
  assert.equal(room.gameState.divineWeaponCards.some(card => card.id === divineTwo.id), false);
  assert.equal(room.gameState.divineWeaponCards.some(card => card.id === divineAce.id), false);
  assert.equal(
    room.gameState.activeSkillUsesByPlayerId.get(room.players[0].id)
      .has(ActiveSkillIds.DIVINE_WEAPON),
    true
  );
});

test('神兵天降出牌撤回后恢复原牌并返还技能次数与本轮名额', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo(), () => 0.5);
  const sourceCard = card('clubs', '7', 0);
  room.players[0].addCard(sourceCard);
  room.players[0].addCard(card('diamonds', '3', 0));
  room.players.slice(1).forEach((player, index) => {
    player.addCard(card('clubs', String(index + 8), 0));
    player.addCard(card('diamonds', String(index + 4), 0));
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = DIVINE_WEAPON_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  const targetCard = card('clubs', 'K', 0);
  targetCard.id = 'divine-clubs-K';
  room.gameState.divineWeaponCards[0] = targetCard;
  engine.playCards(
    room.players[0].id,
    [sourceCard.id],
    null,
    ActiveSkillIds.DIVINE_WEAPON,
    {
      divineWeaponCardId: targetCard.id,
      divineWeaponSourceCardId: sourceCard.id
    }
  );

  const undoResult = engine.undoLastPlay(room.players[0].id);
  const restoredCard = room.players[0].cards.find(currentCard => currentCard.id === sourceCard.id);
  assert.equal(undoResult.restoredActiveSkillId, ActiveSkillIds.DIVINE_WEAPON);
  assert.equal(restoredCard.suit, 'clubs');
  assert.equal(restoredCard.rank, '7');
  assert.equal(room.gameState.divineWeaponUsedThisRound, false);
  assert.equal(room.gameState.divineWeaponUsedByPlayerId, null);
  assert.equal(room.gameState.divineWeaponUsedCardId, null);
  assert.equal(engine.hasUsedActiveSkill(room.players[0].id, ActiveSkillIds.DIVINE_WEAPON), false);
});

test('神兵天降本轮无人发动时保留原有两张神兵牌', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo(), () => 0.5);
  const firstRoundCards = ['3', '4', '5', '6'].map(rank => card('hearts', rank, 0));
  room.players.forEach((player, index) => {
    player.addCard(firstRoundCards[index]);
    player.addCard(card('clubs', String(index + 7), 0));
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = DIVINE_WEAPON_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  const originalIds = room.gameState.divineWeaponCards.map(currentCard => currentCard.id);
  const originalGeneration = room.gameState.divineWeaponGeneration;
  for (let index = 0; index < room.players.length; index += 1) {
    const result = engine.playCards(room.players[index].id, [firstRoundCards[index].id]);
    if (index === room.players.length - 1) {
      assert.equal(result.roundUpdate.divineWeaponRefresh, null);
    }
  }

  assert.deepEqual(room.gameState.divineWeaponCards.map(currentCard => currentCard.id), originalIds);
  assert.equal(room.gameState.divineWeaponGeneration, originalGeneration);
});

test('神兵天降只改变牌面牌力，仍按转化前的实体牌计分', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo(), () => 0.5);
  const physicalFive = card('hearts', '5', 0);
  const trickCards = [physicalFive, card('hearts', '3', 0), card('hearts', '4', 0), card('hearts', '6', 0)];
  room.players.forEach((player, index) => player.addCard(trickCards[index]));
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = DIVINE_WEAPON_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  const divineTen = card('hearts', '10', 0);
  divineTen.id = 'divine-hearts-10';
  room.gameState.divineWeaponCards[0] = divineTen;
  const transformedResult = engine.playCards(
    room.players[0].id,
    [physicalFive.id],
    null,
    ActiveSkillIds.DIVINE_WEAPON,
    {
      divineWeaponCardId: divineTen.id,
      divineWeaponSourceCardId: physicalFive.id
    }
  );
  assert.equal(transformedResult.playedCards[0].rank, '10');
  assert.equal(transformedResult.playedCards[0].originalRank, '5');
  assert.equal(getCardPoints(transformedResult.playedCards[0]), 5);

  engine.playCards(room.players[1].id, [trickCards[1].id]);
  engine.playCards(room.players[2].id, [trickCards[2].id]);
  const roundResult = engine.playCards(room.players[3].id, [trickCards[3].id]);
  assert.equal(roundResult.roundUpdate.scoreInfo.roundPoints, 5);
  assert.equal(roundResult.roundUpdate.scoreInfo.roundPointCards.length, 1);
  assert.equal(roundResult.roundUpdate.scoreInfo.roundPointCards[0].rank, '10');
  assert.equal(roundResult.roundUpdate.scoreInfo.roundPointCards[0].originalRank, '5');
});

test('神兵天降不能把最后一张首花色副牌变成级牌来伪造缺门毙牌', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo(), () => 0.5);
  const leadCard = card('clubs', '9', 0);
  const lastLeadSuitCard = card('clubs', '7', 0);
  room.players[0].addCard(leadCard);
  room.players[1].addCard(lastLeadSuitCard);
  room.players[2].addCard(card('clubs', '6', 0));
  room.players[3].addCard(card('clubs', '5', 0));
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = DIVINE_WEAPON_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  const offSuitLevelCard = card('clubs', '2', 0);
  offSuitLevelCard.id = 'divine-clubs-2';
  room.gameState.divineWeaponCards[0] = offSuitLevelCard;
  engine.playCards(room.players[0].id, [leadCard.id]);

  assert.throws(() => engine.playCards(
    room.players[1].id,
    [lastLeadSuitCard.id],
    null,
    ActiveSkillIds.DIVINE_WEAPON,
    {
      divineWeaponCardId: offSuitLevelCard.id,
      divineWeaponSourceCardId: lastLeadSuitCard.id
    }
  ), /同花色.*必须优先出/);
  assert.equal(room.players[1].cards.some(currentCard => currentCard.id === lastLeadSuitCard.id), true);
  assert.equal(room.gameState.divineWeaponUsedThisRound, false);

  room.players[1].removeCards([lastLeadSuitCard.id]);
  const trueVoidSourceCard = card('diamonds', '7', 0);
  room.players[1].addCard(trueVoidSourceCard);
  const allowedLevelCard = card('diamonds', '2', 0);
  allowedLevelCard.id = 'divine-diamonds-2';
  room.gameState.divineWeaponCards[0] = allowedLevelCard;

  const legalRuffResult = engine.playCards(
    room.players[1].id,
    [trueVoidSourceCard.id],
    null,
    ActiveSkillIds.DIVINE_WEAPON,
    {
      divineWeaponCardId: allowedLevelCard.id,
      divineWeaponSourceCardId: trueVoidSourceCard.id
    }
  );
  assert.equal(legalRuffResult.playedCards[0].suit, 'diamonds');
  assert.equal(legalRuffResult.playedCards[0].rank, '2');
  assert.equal(room.gameState.currentRoundPlays.at(-1).pattern.suit, 'trump');
  assert.equal(room.gameState.divineWeaponUsedThisRound, true);
});

test('魔术戏法只在整轮结算时交换两个座位的出牌结果', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const trickCards = [
    card('hearts', '9', 0),
    card('hearts', 'Q', 0),
    card('hearts', '5', 0),
    card('hearts', '6', 0)
  ];
  room.players.forEach((player, index) => {
    player.addCard(trickCards[index]);
    player.addCard(card('clubs', String(index + 3), 0));
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = MAGIC_TRICK_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  assert.throws(() => engine.prepareMagicTrick(
    room.players[0].id,
    [room.players[0].id, room.players[1].id]
  ), /不能选择自己/);

  const prepared = engine.prepareMagicTrick(
    room.players[0].id,
    [room.players[1].id, room.players[2].id]
  );
  assert.deepEqual(prepared.targetPlayerIds, [room.players[1].id, room.players[2].id]);
  assert.equal(engine.hasUsedActiveSkill(room.players[0].id, ActiveSkillIds.MAGIC_TRICK), false);
  assert.equal(room.toJSON().gameState.magicTrickSelection, undefined);

  engine.playCards(room.players[0].id, [trickCards[0].id]);
  engine.playCards(room.players[1].id, [trickCards[1].id]);
  assert.equal(room.gameState.currentWinnerIndex, 1);
  engine.playCards(room.players[2].id, [trickCards[2].id]);
  const result = engine.playCards(room.players[3].id, [trickCards[3].id]);

  assert.equal(result.roundUpdate.magicTrick.triggered, true);
  assert.equal(result.roundWinner.playerId, room.players[2].id);
  assert.equal(result.roundUpdate.nextRoundLeader.playerId, room.players[2].id);
  assert.equal(
    result.roundUpdate.magicTrick.plays.find(play => play.playerId === room.players[2].id).cards[0].rank,
    'Q'
  );
  assert.equal(engine.hasUsedActiveSkill(room.players[0].id, ActiveSkillIds.MAGIC_TRICK), true);
  assert.equal(room.gameState.magicTrickSelection, null);
});

test('戛然而止只在完整轮末触发，底牌照常归属并补庄家本人余牌半分', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const trickCards = [
    card('hearts', '3', 0),
    card('hearts', 'A', 0),
    card('hearts', '4', 0),
    card('hearts', '6', 0)
  ];
  room.players[0].cards = [
    trickCards[0],
    card('clubs', 'K', 0),
    card('clubs', '5', 0),
    card('clubs', '7', 0),
    card('clubs', '8', 0)
  ];
  room.players.slice(1).forEach((player, offset) => {
    player.cards = [
      trickCards[offset + 1],
      card('diamonds', '3', offset),
      card('diamonds', '4', offset),
      card('diamonds', '6', offset),
      card('diamonds', '7', offset)
    ];
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = ABRUPT_STOP_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  room.gameState.bottomCards = [card('diamonds', 'K', 1)];
  engine.setFirstPlayer(room.players[0].id);

  for (let index = 0; index < 3; index += 1) {
    const partial = engine.playCards(room.players[index].id, [trickCards[index].id]);
    assert.equal(partial.gameFinished, false);
    assert.equal(room.gameState.phase, GamePhases.PLAYING);
  }
  const result = engine.playCards(room.players[3].id, [trickCards[3].id]);

  assert.equal(result.roundUpdate.abruptStop.triggered, true);
  assert.equal(result.roundWinner.playerId, room.players[1].id);
  assert.equal(result.gameFinished, true);
  assert.equal(room.gameState.bottomScoreResult.attackerWonBottom, true);
  assert.equal(room.gameState.bottomScoreResult.bottomScoreGained, 20);
  assert.equal(room.gameState.bottomScoreResult.abruptStop.dealerPlayerId, room.players[0].id);
  assert.equal(room.gameState.bottomScoreResult.abruptStop.dealerRemainingPoints, 15);
  assert.deepEqual(
    room.gameState.bottomScoreResult.abruptStop.dealerRemainingCards
      .map(currentCard => currentCard.rank)
      .sort(),
    ['5', '7', '8', 'K']
  );
  assert.equal(room.gameState.bottomScoreResult.abruptStop.attackerBonus, 7.5);
  assert.equal(room.gameState.bottomScoreResult.totalScore, 27.5);
});

test('聚类分析可把一张数字牌临时转成相邻点数并组成对子', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const seven = card('hearts', '7', 0);
  const eight = card('hearts', '8', 0);
  room.players[0].cards = [seven, eight, card('clubs', '3', 0)];
  room.players.slice(1).forEach((player, index) => {
    player.cards = [card('hearts', String(index + 3), 0), card('clubs', String(index + 4), 0)];
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = CLUSTER_ANALYSIS_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  const preview = resolveClusterAnalysisPlay({
    selectedCards: [seven, eight],
    handCards: room.players[0].cards,
    substitutions: [{
      cardId: seven.id,
      suit: 'hearts',
      fromRank: '7',
      toRank: '8'
    }],
    trumpSuit: 'spades',
    trumpRank: '2',
    activeRule: CLUSTER_ANALYSIS_RULE
  });
  assert.equal(preview.valid, true);
  assert.equal(preview.pattern.type, PatternTypes.PAIR);

  const invalidJump = resolveClusterAnalysisPlay({
    selectedCards: [seven, eight],
    handCards: room.players[0].cards,
    substitutions: [{ cardId: seven.id, fromRank: '7', toRank: '9' }],
    trumpSuit: 'spades',
    trumpRank: '2',
    activeRule: CLUSTER_ANALYSIS_RULE
  });
  assert.equal(invalidJump.valid, false);
  assert.match(invalidJump.message, /不能转换/);

  const result = engine.playCards(
    room.players[0].id,
    [seven.id, eight.id],
    null,
    ActiveSkillIds.CLUSTER_ANALYSIS,
    {
      clusterAnalysisSubstitutions: [{
        cardId: seven.id,
        suit: 'hearts',
        fromRank: '7',
        toRank: '8'
      }]
    }
  );
  assert.deepEqual(result.playedCards.map(currentCard => currentCard.rank), ['8', '8']);
  assert.equal(result.playedCards.some(currentCard => currentCard.isClusterAnalysisTransformed), true);
  assert.equal(room.gameState.leadingPattern.type, PatternTypes.PAIR);
  assert.equal(engine.hasUsedActiveSkill(room.players[0].id, ActiveSkillIds.CLUSTER_ANALYSIS), false);
});

test('聚类分析支持把多张 J 分别转成 Q，且不受已出牌面限制', () => {
  const firstJack = card('spades', 'J', 0);
  const secondJack = card('spades', 'J', 1);
  const result = resolveClusterAnalysisPlay({
    selectedCards: [firstJack, secondJack],
    handCards: [firstJack, secondJack],
    substitutions: [
      { cardId: firstJack.id, suit: 'spades', fromRank: 'J', toRank: 'Q' },
      { cardId: secondJack.id, suit: 'spades', fromRank: 'J', toRank: 'Q' }
    ],
    trumpSuit: 'hearts',
    trumpRank: '2',
    activeRule: CLUSTER_ANALYSIS_RULE
  });

  assert.equal(result.valid, true);
  assert.equal(result.pattern.type, PatternTypes.PAIR);
  assert.deepEqual(result.effectiveCards.map(currentCard => currentCard.rank), ['Q', 'Q']);
  assert.equal(result.substitutions.length, 2);
});

test('聚类分析能以多张转化组成更大组件时会令对手甩牌失败', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const leadingThrow = [
    card('hearts', '9', 0),
    card('hearts', '9', 1),
    card('hearts', 'A', 0)
  ];
  room.players[0].cards = [...leadingThrow, card('clubs', '3', 0)];
  room.players[1].cards = [card('hearts', 'J', 0), card('hearts', 'J', 1), card('clubs', '4', 0)];
  room.players[2].cards = [card('hearts', '3', 0), card('hearts', '4', 0), card('clubs', '5', 0)];
  room.players[3].cards = [card('hearts', '5', 0), card('hearts', '6', 0), card('clubs', '6', 0)];
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = CLUSTER_ANALYSIS_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  const result = engine.playCards(room.players[0].id, leadingThrow.map(currentCard => currentCard.id));
  assert.ok(result.throwFailed);
  assert.equal(result.playedCards.length, 2);
  assert.deepEqual(result.playedCards.map(currentCard => currentCard.rank), ['9', '9']);
});

test('禁术秘法把原主牌降为副牌，级牌恢复原点数且王不能变成主花色', () => {
  assert.equal(FORBIDDEN_MAGIC_RULE.name, '禁术秘法');
  assert.equal(FORBIDDEN_MAGIC_RULE.activeSkill.timing, 'anytime_prepare_round_start_confirm');
  assert.equal(FORBIDDEN_MAGIC_RULE.activeSkill.usageLimit, 1);

  const mainAce = card('hearts', 'A', 300);
  const offSuitLevel = card('clubs', '6', 301);
  const bigJoker = card('joker', 'big_joker', 302);
  const hand = [mainAce, offSuitLevel, bigJoker];

  const demotedAce = resolveForbiddenMagicPlay({
    selectedCards: [mainAce],
    handCards: hand,
    trumpSuit: 'hearts',
    trumpRank: '6',
    activeRule: FORBIDDEN_MAGIC_RULE
  });
  assert.equal(demotedAce.valid, true);
  assert.equal(demotedAce.pattern.suit, 'hearts');
  assert.equal(isTrumpCard(demotedAce.effectiveCards[0], 'hearts', '6'), false);
  assert.equal(getCardStrength(demotedAce.effectiveCards[0], 'hearts', '6'), 14);

  const demotedLevel = resolveForbiddenMagicPlay({
    selectedCards: [offSuitLevel],
    handCards: hand,
    trumpSuit: 'hearts',
    trumpRank: '6',
    activeRule: FORBIDDEN_MAGIC_RULE
  });
  assert.equal(demotedLevel.valid, true);
  assert.equal(demotedLevel.pattern.suit, 'clubs');
  assert.equal(getCardStrength(demotedLevel.effectiveCards[0], 'hearts', '6'), 6);

  const forbiddenJokerSuit = resolveForbiddenMagicPlay({
    selectedCards: [bigJoker],
    handCards: hand,
    substitutions: [{ cardId: bigJoker.id, suit: 'hearts', rank: 'Q' }],
    trumpSuit: 'hearts',
    trumpRank: '6',
    activeRule: FORBIDDEN_MAGIC_RULE
  });
  assert.equal(forbiddenJokerSuit.valid, false);
  assert.match(forbiddenJokerSuit.message, /不能转化为当前主牌花色/);

  const legalJoker = resolveForbiddenMagicPlay({
    selectedCards: [bigJoker],
    handCards: hand,
    substitutions: [{ cardId: bigJoker.id, suit: 'spades', rank: 'Q' }],
    trumpSuit: 'hearts',
    trumpRank: '6',
    activeRule: FORBIDDEN_MAGIC_RULE
  });
  assert.equal(legalJoker.valid, true);
  assert.equal(legalJoker.effectiveCards[0].rank, 'Q');
  assert.equal(legalJoker.effectiveCards[0].suit, 'spades');
  assert.equal(getCardPoints(legalJoker.effectiveCards[0]), 0, '王变成分牌点数也仍按原牌0分');
});

test('禁术秘法允许多人随时预备、轮首逐个确认，确认后永久生效且拒绝不消耗', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const firstCards = [
    card('clubs', '3', 310),
    card('hearts', '5', 311),
    card('clubs', '4', 312),
    card('clubs', '6', 313)
  ];
  room.players.forEach((player, index) => {
    player.addCard(firstCards[index]);
    player.addCard(card('diamonds', String(index + 7), 320 + index));
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = FORBIDDEN_MAGIC_RULE;
  room.gameState.trumpSuit = 'hearts';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  const secondSeat = engine.activateForbiddenMagic(room.players[1].id);
  const thirdSeat = engine.activateForbiddenMagic(room.players[2].id);
  assert.equal(secondSeat.targetRound, 1);
  assert.equal(thirdSeat.targetRound, 1);
  assert.equal(room.gameState.forbiddenMagicCurrentDecisionPlayerId, room.players[1].id);
  assert.deepEqual(room.gameState.forbiddenMagicDecisionQueue, [room.players[2].id]);
  assert.equal(room.gameState.forbiddenMagicActivePlayerIds.size, 0);
  assert.deepEqual(
    new Set(room.gameState.toJSON().forbiddenMagic.reservations.map(item => item.playerId)),
    new Set([room.players[1].id, room.players[2].id])
  );
  assert.throws(
    () => engine.playCards(room.players[0].id, [firstCards[0].id]),
    /确认是否发动禁术秘法/
  );

  const secondAccepted = engine.respondForbiddenMagic(room.players[1].id, true);
  assert.equal(secondAccepted.resolved, false);
  assert.equal(room.gameState.forbiddenMagicCurrentDecisionPlayerId, room.players[2].id);
  const thirdAccepted = engine.respondForbiddenMagic(room.players[2].id, true);
  assert.equal(thirdAccepted.resolved, true);
  assert.deepEqual(
    new Set(room.gameState.forbiddenMagicActivePlayerIds),
    new Set([room.players[1].id, room.players[2].id])
  );

  engine.playCards(room.players[0].id, [firstCards[0].id]);
  const fourthSeat = engine.activateForbiddenMagic(room.players[3].id);
  assert.equal(fourthSeat.targetRound, 2, '轮中预备应留到下一轮确认');
  const transformed = engine.playCards(
    room.players[1].id,
    [firstCards[1].id],
    null,
    null,
    {
      forbiddenMagicSubstitutions: [{
        cardId: firstCards[1].id,
        suit: 'clubs',
        rank: '5'
      }]
    }
  );
  assert.equal(transformed.playedCards[0].suit, 'clubs');
  assert.equal(transformed.playedCards[0].isForbiddenMagicDemoted, true);
  assert.equal(getCardPoints(transformed.playedCards[0]), 5);
  engine.playCards(room.players[2].id, [firstCards[2].id]);
  engine.playCards(room.players[3].id, [firstCards[3].id]);

  assert.equal(room.gameState.currentRound, 2);
  assert.deepEqual(
    new Set(room.gameState.forbiddenMagicActivePlayerIds),
    new Set([room.players[1].id, room.players[2].id]),
    '已发动者在轮末后仍应永久生效'
  );
  assert.equal(room.gameState.forbiddenMagicCurrentDecisionPlayerId, room.players[3].id);
  assert.throws(
    () => engine.activateForbiddenMagic(room.players[1].id),
    /只能发动一次/
  );
  const declined = engine.respondForbiddenMagic(room.players[3].id, false);
  assert.equal(declined.resolved, true);
  assert.equal(room.gameState.activeSkillUsesByPlayerId.has(room.players[3].id), false);
  assert.doesNotThrow(() => engine.activateForbiddenMagic(room.players[3].id));
});

test('禁术秘法发动者的潜在转化牌也能阻止其他玩家甩牌', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const leadingThrow = [
    card('clubs', '9', 340),
    card('clubs', 'K', 341)
  ];
  const mainSuitAce = card('hearts', 'A', 342);
  room.players[0].cards = [...leadingThrow, card('diamonds', '3', 343)];
  room.players[1].cards = [mainSuitAce, card('diamonds', '4', 344)];
  room.players[2].cards = [card('clubs', '3', 345), card('diamonds', '5', 346)];
  room.players[3].cards = [card('clubs', '4', 347), card('diamonds', '6', 348)];
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = FORBIDDEN_MAGIC_RULE;
  room.gameState.trumpSuit = 'hearts';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  engine.activateForbiddenMagic(room.players[1].id);
  engine.respondForbiddenMagic(room.players[1].id, true);
  const result = engine.playCards(
    room.players[0].id,
    leadingThrow.map(currentCard => currentCard.id)
  );

  assert.ok(result.throwFailed);
  assert.equal(result.playedCards.length, 1);
  assert.equal(result.playedCards[0].rank, '9');
});

test('取长补短注册特殊牌面，并为未来叠加变动保留完整边界', () => {
  assert.equal(STRENGTH_COMPENSATION_RULE.name, '取长补短');
  const shift = (suit, rank, trumpSuit, trumpRank, delta) => (
    shiftStrengthCompensationCardFace({ suit, rank }, trumpSuit, trumpRank, delta)
  );
  assert.deepEqual(shift('hearts', 'A', 'spades', '2', 1), { suit: 'hearts', rank: 'B' });
  assert.deepEqual(shift('hearts', 'A', 'spades', '2', 2), { suit: 'hearts', rank: 'C' });
  assert.deepEqual(shift('hearts', 'A', 'spades', '2', 3), { suit: 'hearts', rank: 'D' });
  assert.deepEqual(shift('hearts', '3', 'spades', '2', -1), { suit: 'hearts', rank: '1' });
  assert.deepEqual(shift('hearts', '1', 'spades', '2', -1), { suit: 'hearts', rank: '0' });
  assert.deepEqual(shift('hearts', '0', 'spades', '2', -1), { suit: 'hearts', rank: '-1' });
  assert.deepEqual(shift('hearts', '-1', 'spades', '2', -1), { suit: 'hearts', rank: '-2' });
  assert.deepEqual(shift('joker', 'big_joker', 'spades', '2', 1), {
    suit: 'joker', rank: 'county_prince_joker'
  });
  assert.deepEqual(shift('joker', 'big_joker', 'spades', '2', 2), {
    suit: 'joker', rank: 'prince_joker'
  });
  assert.deepEqual(shift('joker', 'big_joker', 'spades', '2', 3), {
    suit: 'joker', rank: 'white_joker'
  });
  assert.deepEqual(
    ['A', 'B', 'C', 'D'].map(rank => (
      getCardStrength(card('hearts', rank), 'spades', '2', STRENGTH_COMPENSATION_RULE)
    )),
    [14, 15, 16, 17]
  );
  assert.deepEqual(
    ['big_joker', 'county_prince_joker', 'prince_joker', 'white_joker'].map(rank => (
      getCardStrength(card('joker', rank), 'spades', '2', STRENGTH_COMPENSATION_RULE)
    )),
    [1000, 1001, 1002, 1003]
  );
});

test('取长补短沿主牌完整序列平移，不把主级牌按普通点数改写', () => {
  const plusCases = [
    [card('spades', 'A'), { suit: 'hearts', rank: '2' }],
    [card('hearts', '2'), { suit: 'spades', rank: '2' }],
    [card('spades', '2'), { suit: 'joker', rank: 'small_joker' }],
    [card('joker', 'small_joker'), { suit: 'joker', rank: 'big_joker' }],
    [card('joker', 'big_joker'), { suit: 'joker', rank: 'county_prince_joker' }]
  ];
  const minusCases = [
    [card('joker', 'big_joker'), { suit: 'joker', rank: 'small_joker' }],
    [card('joker', 'small_joker'), { suit: 'spades', rank: '2' }],
    [card('spades', '2'), { suit: 'hearts', rank: '2' }],
    [card('hearts', '2'), { suit: 'spades', rank: 'A' }],
    [card('spades', 'A'), { suit: 'spades', rank: 'K' }]
  ];

  plusCases.forEach(([source, expected]) => {
    assert.deepEqual(
      shiftStrengthCompensationCardFace(source, 'spades', '2', 1),
      expected
    );
  });
  minusCases.forEach(([source, expected]) => {
    assert.deepEqual(
      shiftStrengthCompensationCardFace(source, 'spades', '2', -1),
      expected
    );
  });

  const originalMainChain = [
    card('spades', 'A'),
    card('hearts', '2'),
    card('spades', '2'),
    card('joker', 'small_joker'),
    card('joker', 'big_joker')
  ];
  const shiftedMainChain = originalMainChain.map(source => ({
    ...shiftStrengthCompensationCardFace(source, 'spades', '2', 1),
    isStrengthCompensated: true
  }));
  const shiftedStrengths = shiftedMainChain.map(source => (
    getCardStrength(source, 'spades', '2', STRENGTH_COMPENSATION_RULE)
  ));
  assert.deepEqual(shiftedStrengths, [997, 998, 999, 1000, 1001]);
});

test('取长补短的无主M牌仍是主牌，副牌再大也不能跨入主牌链', () => {
  const underLevel = shiftStrengthCompensationCardFace(
    card('hearts', '2'),
    'no_trump',
    '2',
    -1
  );
  assert.deepEqual(underLevel, { suit: 'hearts', rank: Ranks.NO_TRUMP_MINUS });
  assert.deepEqual(
    shiftStrengthCompensationCardFace(underLevel, 'no_trump', '2', 1),
    { suit: 'hearts', rank: '2' }
  );
  assert.deepEqual(
    shiftStrengthCompensationCardFace(card('hearts', 'A'), 'no_trump', '2', 10000),
    { suit: 'hearts', rank: 'D' }
  );

  const compensatedUnderLevel = { ...underLevel, isStrengthCompensated: true };
  const noTrumpLevel = card('spades', '2');
  const maximumSideCard = card('clubs', 'D');
  assert.equal(isTrumpCard(compensatedUnderLevel, 'no_trump', '2'), true);
  assert.ok(
    getCardStrength(compensatedUnderLevel, 'no_trump', '2', STRENGTH_COMPENSATION_RULE)
      > getCardStrength(maximumSideCard, 'no_trump', '2', STRENGTH_COMPENSATION_RULE)
  );
  assert.ok(
    getCardStrength(noTrumpLevel, 'no_trump', '2', STRENGTH_COMPENSATION_RULE)
      > getCardStrength(compensatedUnderLevel, 'no_trump', '2', STRENGTH_COMPENSATION_RULE)
  );
});

test('取长补短开局实际把主A、副级、主级和王按整条主牌链改面', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = STRENGTH_COMPENSATION_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  room.players[0].cards = [card('clubs', '5', 790)];
  room.players[1].cards = [
    card('spades', 'A', 791),
    card('hearts', '2', 792),
    card('spades', '2', 793),
    card('joker', 'small_joker', 794),
    card('joker', 'big_joker', 795)
  ];
  room.players[2].cards = [card('diamonds', '6', 796)];
  room.players[3].cards = [card('clubs', '7', 797)];

  engine.setFirstPlayer(room.players[0].id);

  assert.deepEqual(
    room.players[1].cards.map(value => [value.suit, value.rank]),
    [
      ['hearts', '2'],
      ['spades', '2'],
      ['joker', 'small_joker'],
      ['joker', 'big_joker'],
      ['joker', 'county_prince_joker']
    ]
  );
});

test('取长补短以庄家为0逆时针编号，B和郡王参与真实牌力但沿用实体分值', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io);
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = STRENGTH_COMPENSATION_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '9';
  room.gameState.buryingPlayerId = room.players[2].id;
  room.players[0].cards = [card('diamonds', '7', 800)];
  room.players[1].cards = [card('clubs', '2', 801), card('joker', 'big_joker', 802)];
  room.players[2].cards = [card('spades', '8', 803)];
  room.players[3].cards = [
    card('hearts', 'A', 804),
    card('joker', 'big_joker', 805),
    card('hearts', '5', 806)
  ];

  engine.setFirstPlayer(room.players[2].id);

  assert.deepEqual(
    room.players[3].cards.map(value => value.rank),
    ['B', 'county_prince_joker', '6']
  );
  assert.deepEqual(room.players[1].cards.map(value => value.rank), ['1', 'small_joker']);
  assert.ok(room.players[3].cards.every(value => value.isStrengthCompensated));
  assert.equal(room.players[3].cards[0].originalRank, 'A');
  assert.equal(room.players[1].cards[0].originalRank, '2');
  assert.ok(
    getCardStrength(room.players[3].cards[0], 'spades', '9', STRENGTH_COMPENSATION_RULE) >
    getCardStrength(card('hearts', 'A', 807), 'spades', '9', STRENGTH_COMPENSATION_RULE)
  );
  assert.ok(
    getCardStrength(room.players[3].cards[1], 'spades', '9', STRENGTH_COMPENSATION_RULE) >
    getCardStrength(card('joker', 'big_joker', 808), 'spades', '9', STRENGTH_COMPENSATION_RULE)
  );
  assert.equal(getCardPoints(room.players[3].cards[2]), 5);

  const status = room.gameState.toJSON().strengthCompensation;
  assert.equal(status.round, 1);
  assert.equal(status.dealerPlayerId, room.players[2].id);
  assert.equal(status.plusSeatNumber, 1);
  assert.equal(status.plusPlayerId, room.players[3].id);
  assert.equal(status.minusSeatNumber, 3);
  assert.equal(status.minusPlayerId, room.players[1].id);
  assert.equal(
    io.events.filter(event => event.event === 'strength_compensation_hand_updated').length,
    4
  );
});

test('取长补短在完整一轮结算后恢复旧牌面并轮换到下一组座位', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io);
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = STRENGTH_COMPENSATION_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '9';
  room.gameState.buryingPlayerId = room.players[0].id;
  room.players[0].cards = [card('hearts', '5', 810), card('clubs', '5', 811)];
  room.players[1].cards = [card('hearts', 'A', 812), card('clubs', 'A', 813)];
  room.players[2].cards = [card('hearts', '4', 814), card('clubs', '4', 815)];
  room.players[3].cards = [card('hearts', '2', 816), card('clubs', '2', 817)];
  engine.setFirstPlayer(room.players[0].id);

  engine.playCards(room.players[0].id, ['hearts-5-810']);
  engine.playCards(room.players[1].id, ['hearts-A-812']);
  engine.playCards(room.players[2].id, ['hearts-4-814']);
  const result = engine.playCards(room.players[3].id, ['hearts-2-816']);

  assert.equal(result.roundUpdate.type, 'round_ended');
  assert.equal(result.roundWinner.playerId, room.players[1].id);
  assert.equal(room.gameState.currentRound, 2);
  assert.equal(room.players[0].cards[0].rank, '4');
  assert.equal(room.players[0].cards[0].originalRank, '5');
  assert.equal(room.players[1].cards[0].rank, 'A');
  assert.equal(room.players[1].cards[0].isStrengthCompensated, false);
  assert.equal(room.players[2].cards[0].rank, '5');
  assert.equal(room.players[2].cards[0].originalRank, '4');
  assert.equal(room.players[3].cards[0].rank, '2');
  assert.equal(room.players[3].cards[0].isStrengthCompensated, false);
  assert.equal(result.roundUpdate.strengthCompensation.plusSeatNumber, 2);
  assert.equal(result.roundUpdate.strengthCompensation.minusSeatNumber, 0);
});

test('以守为攻按力争上游全序给上一轮首家临时加牌面，并区分A与大王以上三级', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io);
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = DEFENSE_AS_OFFENSE_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  room.gameState.dealerPlayerIndex = 0;

  const firstRoundCards = [
    card('hearts', '3', 1810),
    card('hearts', '4', 1811),
    card('hearts', '5', 1812),
    card('hearts', '6', 1813)
  ];
  const secondRoundCards = [
    card('hearts', '5', 1820),
    card('hearts', '6', 1821),
    card('hearts', '5', 1822),
    card('hearts', '7', 1823)
  ];
  const cappedBigJoker = card('joker', 'big_joker', 1830);
  const promotedAce = card('hearts', 'A', 1831);
  const cappedWhiteJoker = card('joker', 'white_joker', 1832);
  const nextTargetBigJoker = card('joker', 'big_joker', 1833);
  const cappedD = card('hearts', 'D', 1834);

  room.players[0].cards = [
    firstRoundCards[0],
    secondRoundCards[0],
    cappedBigJoker,
    promotedAce,
    cappedWhiteJoker,
    cappedD
  ];
  room.players[1].cards = [
    firstRoundCards[1],
    secondRoundCards[1],
    card('clubs', '3', 1841),
    card('diamonds', '4', 1842),
    card('spades', '5', 1843)
  ];
  room.players[2].cards = [
    firstRoundCards[2],
    secondRoundCards[2],
    card('clubs', '4', 1851),
    card('diamonds', '5', 1852),
    card('spades', '6', 1853)
  ];
  room.players[3].cards = [
    firstRoundCards[3],
    secondRoundCards[3],
    nextTargetBigJoker,
    card('clubs', '5', 1861),
    card('diamonds', '6', 1862)
  ];
  engine.setFirstPlayer(room.players[0].id);

  engine.playCards(room.players[0].id, [firstRoundCards[0].id]);
  engine.playCards(room.players[1].id, [firstRoundCards[1].id]);
  engine.playCards(room.players[2].id, [firstRoundCards[2].id]);
  const firstRoundResult = engine.playCards(room.players[3].id, [firstRoundCards[3].id]);

  assert.deepEqual(firstRoundResult.roundUpdate.defenseAsOffense, {
    triggerRound: 1,
    round: 2,
    playerIndex: 0,
    playerId: room.players[0].id,
    playerName: room.players[0].name,
    delta: 3,
    active: true
  });
  assert.equal(room.gameState.toJSON().defenseAsOffense.delta, 3);
  assert.equal(secondRoundCards[0].rank, '8');
  assert.equal(secondRoundCards[0].originalRank, '5');
  assert.equal(secondRoundCards[0].isDefenseAsOffenseBoosted, true);
  assert.equal(getCardPoints(secondRoundCards[0]), 5);
  assert.equal(cappedBigJoker.rank, 'white_joker');
  assert.equal(promotedAce.rank, 'D');
  assert.equal(cappedD.rank, 'D');
  assert.equal(cappedWhiteJoker.rank, 'white_joker');

  engine.emitDefenseAsOffenseHands(firstRoundResult.roundUpdate.defenseAsOffense);
  const privateUpdates = io.events.filter(
    event => event.event === 'defense_as_offense_hand_updated'
  );
  assert.equal(privateUpdates.length, 4);
  assert.equal(privateUpdates[0].payload.delta, 3);

  engine.playCards(room.players[3].id, [secondRoundCards[3].id]);
  const boostedPlay = engine.playCards(room.players[0].id, [secondRoundCards[0].id]);
  assert.equal(boostedPlay.currentWinningPlayerId, room.players[0].id);
  assert.equal(boostedPlay.playedCards[0].rank, '8');
  engine.undoLastPlay(room.players[0].id);
  const restoredBoostedCard = room.players[0].cards.find(
    value => value.id === secondRoundCards[0].id
  );
  assert.equal(restoredBoostedCard.rank, '8');
  assert.equal(restoredBoostedCard.originalRank, '5');
  assert.equal(restoredBoostedCard.isDefenseAsOffenseBoosted, true);
  engine.playCards(room.players[0].id, [secondRoundCards[0].id]);
  engine.playCards(room.players[1].id, [secondRoundCards[1].id]);
  const secondRoundResult = engine.playCards(room.players[2].id, [secondRoundCards[2].id]);

  assert.equal(secondRoundResult.roundWinner.playerId, room.players[0].id);
  assert.equal(cappedBigJoker.rank, 'big_joker');
  assert.equal(cappedBigJoker.isDefenseAsOffenseBoosted, false);
  assert.equal(promotedAce.rank, 'A');
  assert.equal(cappedD.rank, 'D');
  assert.equal(cappedWhiteJoker.rank, 'white_joker');
  assert.equal(room.gameState.defenseAsOffense.playerId, room.players[3].id);
  assert.equal(room.gameState.defenseAsOffense.delta, 1);
  assert.equal(room.gameState.defenseAsOffenseLastRound.playerId, room.players[0].id);
  assert.equal(room.gameState.defenseAsOffenseLastRound.round, 2);
  assert.equal(room.gameState.defenseAsOffenseLastRound.delta, 3);
  assert.equal(nextTargetBigJoker.rank, 'county_prince_joker');
});

test('以守为攻只统计严格大于一号位的玩家，同牌力不会增加X', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  room.gameState.selectedRule = DEFENSE_AS_OFFENSE_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  const playedCards = [
    card('hearts', '5', 1870),
    card('hearts', '5', 1871),
    card('hearts', '6', 1872),
    card('hearts', '4', 1873)
  ];
  room.gameState.currentRoundPlays = playedCards.map((playedCard, playerIndex) => ({
    playerIndex,
    playerId: room.players[playerIndex].id,
    cards: [playedCard],
    pattern: detectPattern(
      [playedCard],
      room.gameState.trumpSuit,
      room.gameState.trumpRank,
      room.gameState.selectedRule
    )
  }));

  const status = engine.getDefenseAsOffenseStatusForNextRound(1);
  assert.equal(status.playerId, room.players[0].id);
  assert.equal(status.delta, 1);
});

test('以守为攻在无主局把级牌提升两级为大王', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  room.gameState.selectedRule = DEFENSE_AS_OFFENSE_RULE;
  room.gameState.trumpSuit = 'no_trump';
  room.gameState.trumpRank = '2';
  room.gameState.currentRound = 2;
  const levelCard = card('hearts', '2', 1880);
  room.players[1].cards = [levelCard];

  const transition = engine.applyDefenseAsOffenseForRound({
    triggerRound: 1,
    round: 2,
    playerIndex: 1,
    playerId: room.players[1].id,
    playerName: room.players[1].name,
    delta: 2
  }, { emit: false });

  assert.equal(transition.delta, 2);
  assert.equal(levelCard.originalRank, '2');
  assert.equal(levelCard.rank, 'big_joker');
});

test('手无寸铁移除四张王，并让四家各持24张牌', () => {
  assert.equal(UNARMED_RULE.name, '手无寸铁');
  const preparedDeck = DeckService.prepareUnarmedDeck(DeckService.createDeck());
  assert.equal(preparedDeck.length, 104);
  assert.ok(preparedDeck.every(value => value.suit !== 'joker'));
  assert.ok(preparedDeck.every(value => value.isUnarmed));
  assert.ok(preparedDeck.every(value => value.toJSON().isUnarmed));

  const room = createRoom();
  const io = createIo();
  const manager = new DrawingPhaseManager(room, io);
  const originalShuffle = DeckService.shuffle;
  room.gameState.selectedRule = UNARMED_RULE;
  room.gameState.bottomCardsCount = 8;
  try {
    DeckService.shuffle = deck => [...deck];
    manager.start();
    manager.stop();
  } finally {
    DeckService.shuffle = originalShuffle;
  }

  assert.equal(room.gameState.bottomCards.length, 8);
  assert.equal(room.gameState.deck.length, 96);
  while (room.gameState.drawingIndex < room.gameState.deck.length) {
    manager.dealOneCard();
  }
  assert.deepEqual(room.players.map(player => player.cards.length), [24, 24, 24, 24]);
  const drawingStarted = io.events.find(({ event }) => event === 'drawing_started');
  assert.equal(drawingStarted.payload.removedCardsCount, 4);
});

test('手无寸铁的级牌只负责亮主，出牌时回到原花色和点数', () => {
  const makeUnarmed = (suit, rank, copyIndex = 0) => {
    const value = card(suit, rank, copyIndex);
    value.isUnarmed = true;
    return value;
  };
  const heartLevel = makeUnarmed('hearts', '2', 900);
  const clubLevel = makeUnarmed('clubs', '2', 901);
  const clubThree = makeUnarmed('clubs', '3', 902);
  const sideAce = makeUnarmed('spades', 'A', 903);

  assert.equal(validateDeclaration([heartLevel], 'hearts', 1, '2').valid, true);
  assert.equal(isTrumpCard(heartLevel, 'hearts', '2'), true);
  assert.equal(isTrumpCard(clubLevel, 'hearts', '2'), false);
  assert.ok(
    getCardStrength(clubThree, 'hearts', '2', UNARMED_RULE)
      > getCardStrength(clubLevel, 'hearts', '2', UNARMED_RULE)
  );
  assert.ok(
    getCardStrength(heartLevel, 'hearts', '2', UNARMED_RULE)
      > getCardStrength(sideAce, 'hearts', '2', UNARMED_RULE)
  );

  const tractor = detectPattern([
    makeUnarmed('clubs', '2', 0),
    makeUnarmed('clubs', '2', 1),
    makeUnarmed('clubs', '3', 0),
    makeUnarmed('clubs', '3', 1)
  ], 'hearts', '2', UNARMED_RULE);
  assert.equal(tractor.type, PatternTypes.TRACTOR);
  assert.equal(tractor.suit, 'clubs');

  const cannotSkipLevelRank = detectPattern([
    makeUnarmed('clubs', 'Q', 0),
    makeUnarmed('clubs', 'Q', 1),
    makeUnarmed('clubs', 'A', 0),
    makeUnarmed('clubs', 'A', 1)
  ], 'hearts', 'K', UNARMED_RULE);
  assert.equal(cannotSkipLevelRank.type, PatternTypes.INVALID);
});

test('木牛流马只在轮首等待持有者，放入新牌后必须立即交给队友', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io);
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = WOODEN_OX_FLOWING_HORSE_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.players[0].cards = [card('hearts', '9', 900), card('clubs', '4', 901)];
  room.players[1].cards = [card('diamonds', '5', 902), card('clubs', '6', 903)];
  room.players[2].cards = [card('clubs', '7', 904), card('spades', '7', 905)];
  room.players[3].cards = [card('spades', '8', 906), card('diamonds', '3', 907)];

  engine.setFirstPlayer(room.players[0].id);
  const teamOneMule = room.gameState.woodenOxMulesByTeam.get(1);
  const teamZeroMule = room.gameState.woodenOxMulesByTeam.get(0);
  assert.equal(teamOneMule.holderPlayerId, room.players[1].id);
  assert.equal(teamZeroMule.holderPlayerId, room.players[2].id);
  assert.deepEqual(
    [...room.gameState.woodenOxRoundWindow.pendingPlayerIds].sort(),
    [room.players[1].id, room.players[2].id].sort()
  );
  assert.throws(
    () => engine.playCards(room.players[0].id, [room.players[0].cards[0].id]),
    /木牛流马/
  );

  const loadedCard = room.players[1].cards[0];
  engine.manageWoodenOx(room.players[1].id, 'load_and_pass', loadedCard.id);
  assert.equal(teamOneMule.holderPlayerId, room.players[3].id);
  assert.equal(teamOneMule.storedCard.id, loadedCard.id);
  assert.equal(teamOneMule.transfersUsed, 1);
  assert.equal(room.players[1].cards.some(item => item.id === loadedCard.id), false);
  engine.manageWoodenOx(room.players[2].id, 'skip');
  assert.equal(engine.hasPendingWoodenOxDecision(), false);

  engine.playCards(room.players[0].id, [room.players[0].cards[0].id]);
  assert.throws(
    () => engine.manageWoodenOx(room.players[3].id, 'skip'),
    /首张牌打出前/
  );
  engine.playCards(room.players[1].id, [room.players[1].cards[0].id]);
  engine.playCards(room.players[2].id, [room.players[2].cards[0].id]);
  engine.playCards(room.players[3].id, [room.players[3].cards[0].id]);

  assert.equal(room.gameState.currentRound, 2);
  assert.equal(teamOneMule.storedCard.id, loadedCard.id);
  assert.equal(room.gameState.woodenOxRoundWindow.pendingPlayerIds.has(room.players[3].id), true);
  const publicMule = room.gameState.toJSON().woodenOx.mules.find(mule => mule.teamIndex === 1);
  assert.equal(publicMule.hasStoredCard, true);
  assert.equal(Object.hasOwn(publicMule, 'storedCard'), false);
});

test('木牛流马以庄家为1号位并逆时针发给2、3号位', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io);
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = WOODEN_OX_FLOWING_HORSE_RULE;
  room.gameState.buryingPlayerId = room.players[2].id;
  room.players.slice(1).forEach(player => {
    player.isBot = true;
  });

  engine.setFirstPlayer(room.players[2].id);

  const teamOneMule = room.gameState.woodenOxMulesByTeam.get(1);
  const teamZeroMule = room.gameState.woodenOxMulesByTeam.get(0);
  assert.equal(teamOneMule.initialHolderPlayerId, room.players[3].id);
  assert.equal(teamZeroMule.initialHolderPlayerId, room.players[0].id);
  assert.deepEqual(
    [...room.gameState.woodenOxRoundWindow.pendingPlayerIds].sort(),
    [room.players[0].id]
  );
  assert.deepEqual(
    io.events
      .filter(({ event }) => event === 'wooden_ox_decision_required')
      .map(({ target }) => target)
      .sort(),
    [room.players[0].socketId]
  );
});

test('木牛流马中的牌可延后打出但不产生跟牌义务，撤回时仍回到盒中', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = WOODEN_OX_FLOWING_HORSE_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.players.forEach((player, index) => {
    player.cards = [card('clubs', `${index + 4}`, 920 + index)];
  });
  room.players[0].cards = [card('hearts', '9', 930), card('clubs', '4', 931)];
  room.players[1].cards = [card('spades', 'A', 932), card('clubs', '5', 933)];

  engine.setFirstPlayer(room.players[0].id);
  const teamOneMule = room.gameState.woodenOxMulesByTeam.get(1);
  teamOneMule.storedCard = card('hearts', '2', 934);
  engine.manageWoodenOx(room.players[1].id, 'skip');
  engine.manageWoodenOx(room.players[2].id, 'skip');
  engine.playCards(room.players[0].id, [room.players[0].cards[0].id]);

  // 盒中有首花色牌，但实体手牌缺门，因此仍可打黑桃。
  const offSuitPhysicalCard = room.players[1].cards[0];
  assert.doesNotThrow(() => engine.playCards(room.players[1].id, [offSuitPhysicalCard.id]));
  assert.equal(teamOneMule.storedCard.id, 'hearts-2-934');

  const undoRoom = createRoom();
  const undoEngine = new GameEngine(undoRoom, createIo());
  undoRoom.gameState.phase = GamePhases.PLAYING;
  undoRoom.gameState.selectedRule = WOODEN_OX_FLOWING_HORSE_RULE;
  undoRoom.gameState.trumpSuit = 'spades';
  undoRoom.gameState.trumpRank = '2';
  undoRoom.players.forEach((player, index) => {
    player.cards = [card('clubs', `${index + 4}`, 940 + index)];
  });
  undoRoom.gameState.buryingPlayerId = undoRoom.players[2].id;
  undoEngine.setFirstPlayer(undoRoom.players[2].id);
  const teamZeroMule = undoRoom.gameState.woodenOxMulesByTeam.get(0);
  const storedCard = card('clubs', 'A', 950);
  teamZeroMule.storedCard = storedCard;
  undoEngine.manageWoodenOx(undoRoom.players[3].id, 'skip');
  undoEngine.manageWoodenOx(undoRoom.players[0].id, 'skip');
  undoEngine.playCards(undoRoom.players[2].id, [undoRoom.players[2].cards[0].id]);
  undoEngine.playCards(undoRoom.players[3].id, [undoRoom.players[3].cards[0].id]);
  const physicalCountBefore = undoRoom.players[0].cards.length;
  undoEngine.playCards(undoRoom.players[0].id, [storedCard.id]);
  assert.equal(teamZeroMule.storedCard, null);
  assert.equal(undoRoom.players[0].cards.length, physicalCountBefore);

  const undoResult = undoEngine.undoLastPlay(undoRoom.players[0].id);
  assert.equal(teamZeroMule.storedCard.id, storedCard.id);
  assert.equal(undoRoom.players[0].cards.length, physicalCountBefore);
  assert.deepEqual(undoResult.cards, []);
  assert.deepEqual(undoResult.woodenOxCards.map(item => item.id), [storedCard.id]);
});

test('每队木牛流马最多四次单程传递，即两次完整往返', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = WOODEN_OX_FLOWING_HORSE_RULE;
  room.players.forEach((player, index) => {
    player.cards = [
      card('clubs', '4', 960 + index * 2),
      card('diamonds', '6', 961 + index * 2)
    ];
  });
  engine.setFirstPlayer(room.players[0].id);

  const mule = room.gameState.woodenOxMulesByTeam.get(1);
  for (let transfer = 0; transfer < 4; transfer += 1) {
    const holder = room.findPlayerById(mule.holderPlayerId);
    const otherPendingPlayerId = [...room.gameState.woodenOxRoundWindow.pendingPlayerIds]
      .find(playerId => playerId !== holder.id);
    engine.manageWoodenOx(holder.id, 'load_and_pass', holder.cards[0].id);
    if (otherPendingPlayerId) engine.manageWoodenOx(otherPendingPlayerId, 'skip');
    if (transfer < 3) {
      room.gameState.currentRound += 1;
      engine.openWoodenOxRoundWindow();
    }
  }

  assert.equal(mule.transfersUsed, 4);
  assert.equal(mule.holderPlayerId, room.players[1].id);
  room.gameState.currentRound += 1;
  engine.openWoodenOxRoundWindow();
  assert.equal(room.gameState.woodenOxRoundWindow.pendingPlayerIds.has(mule.holderPlayerId), false);
  const publicMule = room.gameState.toJSON().woodenOx.mules.find(item => item.teamIndex === 1);
  assert.equal(publicMule.completedRoundTrips, 2);
  assert.equal(publicMule.maxRoundTrips, 2);
});

test('队友已无牌可出时，轮首不能继续扣留木牛流马', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = WOODEN_OX_FLOWING_HORSE_RULE;
  room.players[0].cards = [card('clubs', '4', 980)];
  room.players[1].cards = [card('diamonds', '6', 981), card('clubs', '7', 982)];
  room.players[2].cards = [card('hearts', '8', 983)];
  room.players[3].cards = [];
  engine.setFirstPlayer(room.players[0].id);

  assert.equal(
    room.gameState.woodenOxRoundWindow.requiredTransferPlayerIds.has(room.players[1].id),
    true
  );
  assert.throws(
    () => engine.manageWoodenOx(room.players[1].id, 'skip'),
    /必须把木牛流马交给队友/
  );
  const selected = room.players[1].cards[0];
  assert.doesNotThrow(() => (
    engine.manageWoodenOx(room.players[1].id, 'load_and_pass', selected.id)
  ));
  assert.equal(engine.getPlayableCardCount(room.players[3]), 1);
});

test('木牛流马持有者为Bot时会自动跳过，必须平衡牌数时则自动交给队友', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = WOODEN_OX_FLOWING_HORSE_RULE;
  room.players.forEach((player, index) => {
    player.cards = [card('clubs', `${index + 4}`, 990 + index)];
  });
  room.players[1].isBot = true;
  room.players[2].isBot = true;
  engine.setFirstPlayer(room.players[0].id);
  assert.equal(engine.hasPendingWoodenOxDecision(), false);

  room.players[3].cards = [];
  room.gameState.currentRound += 1;
  engine.openWoodenOxRoundWindow();
  const teamOneMule = room.gameState.woodenOxMulesByTeam.get(1);
  assert.equal(teamOneMule.holderPlayerId, room.players[3].id);
  assert.equal(teamOneMule.transfersUsed, 1);
  assert.equal(engine.getPlayableCardCount(room.players[3]), 1);
  assert.equal(engine.hasPendingWoodenOxDecision(), false);
});

test('同舟共济在自己的出牌回合即时给队友牌，并在轮末由收牌者等量返还', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const hands = [
    [card('hearts', '3'), card('hearts', '4'), card('hearts', '5')],
    [card('hearts', '6'), card('hearts', '7'), card('hearts', '8')],
    [card('hearts', '9'), card('hearts', '10'), card('hearts', 'J')],
    [card('hearts', 'Q'), card('hearts', 'K'), card('hearts', 'A')]
  ];
  hands.forEach((cards, index) => cards.forEach(value => room.players[index].addCard(value)));
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = MUTUAL_SUPPORT_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  room.gameState.dealerPlayerIndex = 0;
  engine.setFirstPlayer(room.players[0].id);

  const activation = engine.activateMutualSupport(
    room.players[0].id,
    'give',
    [hands[0][0].id]
  );
  assert.equal(activation.resolved, true);
  assert.equal(activation.transfer.cardsCount, 1);
  assert.equal(room.players[0].cards.length, 2);
  assert.equal(room.players[2].cards.length, 4);
  assert.equal(
    room.gameState.activeSkillUsesByPlayerId.get(room.players[0].id).has(ActiveSkillIds.MUTUAL_SUPPORT),
    true
  );
  assert.throws(
    () => engine.activateMutualSupport(room.players[0].id, 'request'),
    /只能发动一次/
  );

  engine.playCards(room.players[0].id, [hands[0][1].id]);
  engine.playCards(room.players[1].id, [hands[1][0].id]);
  engine.playCards(room.players[2].id, [hands[2][0].id]);
  const roundResult = engine.playCards(room.players[3].id, [hands[3][0].id]);

  assert.equal(roundResult.roundUpdate.type, 'round_ended');
  assert.equal(roundResult.roundUpdate.mutualSupportReturnPending, true);
  assert.equal(roundResult.mutualSupportReturn.stage, 'return');
  assert.equal(roundResult.mutualSupportReturn.chooserPlayerId, room.players[2].id);
  assert.equal(roundResult.mutualSupportReturn.requiredCards, 1);
  assert.equal(room.gameState.toJSON().mutualSupport.pendingAction.requiredCards, 1);
  assert.throws(
    () => engine.playCards(room.players[3].id, [hands[3][1].id]),
    /同舟共济交牌/
  );

  const returnedCardId = hands[2][1].id;
  const returnResult = engine.submitMutualSupportCards(
    room.players[2].id,
    roundResult.mutualSupportReturn.id,
    [returnedCardId]
  );
  assert.equal(returnResult.stage, 'return');
  assert.equal(returnResult.allReturnsCompleted, true);
  assert.equal(room.gameState.mutualSupportPendingAction, null);
  assert.equal(room.players[0].cards.some(value => value.id === returnedCardId), true);
  assert.equal(room.players[0].cards.length, 2);
  assert.equal(room.players[2].cards.length, 2);
});

test('同舟共济向队友要牌允许明确给0张，Bot也会在可给范围内自动选择', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  for (let playerIndex = 0; playerIndex < 4; playerIndex += 1) {
    [3, 4, 5].forEach((rank, copyIndex) => {
      room.players[playerIndex].addCard(card('clubs', String(rank), playerIndex * 3 + copyIndex));
    });
  }
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = MUTUAL_SUPPORT_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  room.gameState.dealerPlayerIndex = 0;
  engine.setFirstPlayer(room.players[0].id);

  const request = engine.activateMutualSupport(room.players[0].id, 'request');
  assert.equal(request.pending, true);
  assert.equal(request.chooserPlayerId, room.players[2].id);
  assert.equal(request.minCards, 0);
  assert.equal(request.maxCards, 2);
  assert.throws(
    () => engine.playCards(room.players[0].id, [room.players[0].cards[0].id]),
    /同舟共济交牌/
  );

  const declined = engine.submitMutualSupportCards(room.players[2].id, request.actionId, []);
  assert.equal(declined.transfer.cardsCount, 0);
  assert.equal(room.gameState.mutualSupportPendingAction, null);
  assert.equal(room.gameState.mutualSupportRoundTransfers.length, 0);

  const secondRoom = createRoom();
  const secondEngine = new GameEngine(secondRoom, createIo());
  secondRoom.players.forEach((player, playerIndex) => {
    [6, 7, 8].forEach((rank, copyIndex) => {
      player.addCard(card('diamonds', String(rank), playerIndex * 3 + copyIndex));
    });
  });
  secondRoom.players[2].isBot = true;
  secondRoom.gameState.phase = GamePhases.PLAYING;
  secondRoom.gameState.selectedRule = MUTUAL_SUPPORT_RULE;
  secondRoom.gameState.trumpSuit = 'spades';
  secondRoom.gameState.trumpRank = '2';
  secondRoom.gameState.buryingPlayerId = secondRoom.players[0].id;
  secondRoom.gameState.dealerPlayerIndex = 0;
  secondEngine.setFirstPlayer(secondRoom.players[0].id);

  const botRequest = secondEngine.activateMutualSupport(secondRoom.players[0].id, 'request');
  const botCardIds = secondEngine.selectMutualSupportCardsForBot(secondRoom.players[2].id);
  assert.equal(botCardIds.length, 2);
  const botResponse = secondEngine.submitMutualSupportCards(
    secondRoom.players[2].id,
    botRequest.actionId,
    botCardIds
  );
  assert.equal(botResponse.transfer.cardsCount, 2);
  assert.equal(secondRoom.gameState.mutualSupportRoundTransfers[0].count, 2);
});

test('烛尽天明由庄家队友选择初始烛态，选择前不能出牌', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io);
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = CANDLE_TO_DAWN_RULE;
  room.gameState.buryingPlayerId = room.players[0].id;
  room.gameState.dealerPlayerIndex = 0;
  room.players.forEach((player, index) => player.addCard(card('clubs', String(index + 3), index)));
  engine.setFirstPlayer(room.players[0].id);

  const initialized = engine.initializeCandleToDawn(room.players[0]);
  assert.equal(initialized.selectorPlayerId, room.players[2].id);
  assert.equal(room.gameState.candleSelectionPending, true);
  assert.equal(room.gameState.candleLit, null);
  assert.equal(
    io.events.some(entry => (
      entry.target === room.players[2].socketId
      && entry.event === 'candle_initial_choice_required'
    )),
    true
  );
  assert.throws(
    () => engine.playCards(room.players[0].id, [room.players[0].cards[0].id]),
    /初始状态/
  );
  assert.throws(
    () => engine.selectInitialCandleState(room.players[1].id, true),
    /庄家队友/
  );

  const selected = engine.selectInitialCandleState(room.players[2].id, true);
  assert.equal(selected.isLit, true);
  assert.equal(room.gameState.candleSelectionPending, false);
  assert.equal(room.gameState.toJSON().candleToDawn.isLit, true);
});

test('烛尽天明先按本轮烛态计分，结算后才由第四手切换下轮烛态', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const roundCards = [
    card('hearts', '5'),
    card('clubs', '10'),
    card('hearts', 'K'),
    card('spades', '3')
  ];
  room.players.forEach((player, index) => {
    player.addCard(roundCards[index]);
    player.addCard(card(index === 2 ? 'hearts' : 'clubs', String(index + 6), 20 + index));
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = CANDLE_TO_DAWN_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  room.gameState.dealerPlayerIndex = 0;
  room.gameState.candleSelectorPlayerId = room.players[2].id;
  room.gameState.candleSelectionPending = false;
  room.gameState.candleLit = true;
  engine.setFirstPlayer(room.players[0].id);

  engine.playCards(room.players[0].id, [roundCards[0].id]);
  engine.playCards(room.players[1].id, [roundCards[1].id]);
  engine.playCards(room.players[2].id, [roundCards[2].id]);
  const result = engine.playCards(room.players[3].id, [roundCards[3].id]);

  assert.equal(result.roundUpdate.scoreInfo.originalRoundPoints, 25);
  assert.equal(result.roundUpdate.scoreInfo.roundPoints, 30);
  assert.equal(result.roundUpdate.scoreInfo.candleLit, true);
  assert.equal(result.roundUpdate.scoreInfo.attackerScore, 30);
  assert.deepEqual(result.roundUpdate.candleTransition, {
    round: 1,
    previousLit: true,
    nextLit: false,
    changed: true,
    triggerColor: 'black',
    fourthPlayerId: room.players[3].id,
    fourthPlayerName: room.players[3].name
  });
  assert.equal(room.gameState.candleLit, false);
  assert.equal(room.gameState.candleLastTransition.previousLit, true);
  assert.equal(room.gameState.currentRound, 2);
  assert.equal(result.roundUpdate.scoreInfo.roundPointCards.length, 3);

  assert.equal(engine.getCandleRoundCardPoints(card('hearts', '5'), true), 10);
  assert.equal(engine.getCandleRoundCardPoints(card('clubs', '5'), true), 0);
  assert.equal(engine.getCandleRoundCardPoints(card('hearts', '5'), false), 0);
  assert.equal(engine.getCandleRoundCardPoints(card('clubs', '5'), false), 10);
  assert.equal(engine.getCandleCardColor(card('joker', Ranks.SMALL_JOKER)), 'black');
  assert.equal(engine.getCandleCardColor(card('joker', Ranks.BIG_JOKER)), 'red');
  // 烛只改每轮分数；底牌仍走通用原分解析。
  assert.equal(engine.getRuleCardPoints(card('hearts', '5')), 5);
});

test('文化革命先二选一再替换原主，花色声明会让原主花色回到副牌', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = CULTURAL_REVOLUTION_RULE;
  room.gameState.trumpSuit = 'hearts';
  room.gameState.trumpRank = '2';
  engine.setFirstPlayer(room.players[0].id);

  const activation = engine.activateCulturalRevolution(
    room.players[0].id,
    'suit',
    'spades'
  );

  assert.equal(activation.declarationType, 'suit');
  assert.equal(activation.expiresAfterRound, 2);
  assert.equal(room.gameState.trumpSuit, 'spades');
  assert.equal(room.gameState.trumpRank, '2');
  assert.equal(isTrumpCard(card('spades', '3'), room.gameState.trumpSuit, room.gameState.trumpRank), true);
  assert.equal(isTrumpCard(card('hearts', '3'), room.gameState.trumpSuit, room.gameState.trumpRank), false);
  assert.equal(room.gameState.toJSON().culturalRevolution.declaration.value, 'spades');
  assert.throws(
    () => engine.activateCulturalRevolution(room.players[0].id, 'rank', 'K'),
    /每名玩家每局只能发动一次/
  );
});

test('文化革命允许10和K成为级牌，覆盖旧声明时不叠加并重新持续两轮', () => {
  for (const replacementRank of ['10', 'K']) {
    const room = createRoom();
    const engine = new GameEngine(room, createIo());
    room.gameState.phase = GamePhases.PLAYING;
    room.gameState.selectedRule = CULTURAL_REVOLUTION_RULE;
    room.gameState.trumpSuit = 'hearts';
    room.gameState.trumpRank = '2';
    engine.setFirstPlayer(room.players[0].id);

    engine.activateCulturalRevolution(room.players[0].id, 'suit', 'spades');
    assert.equal(engine.expireCulturalRevolutionAtRoundEnd(1), null);

    room.gameState.currentRound = 2;
    room.gameState.currentPlayerIndex = 1;
    room.gameState.roundStartPlayerIndex = 1;
    room.gameState.currentRoundPlays = [];
    room.gameState.playersPlayedThisRound.clear();
    const overwritten = engine.activateCulturalRevolution(
      room.players[1].id,
      'rank',
      replacementRank
    );

    assert.equal(overwritten.expiresAfterRound, 3);
    assert.equal(room.gameState.trumpSuit, 'hearts');
    assert.equal(room.gameState.trumpRank, replacementRank);
    assert.equal(isTrumpCard(card('spades', '3'), room.gameState.trumpSuit, room.gameState.trumpRank), false);
    assert.equal(isTrumpCard(card('clubs', replacementRank), room.gameState.trumpSuit, room.gameState.trumpRank), true);
    assert.equal(isTrumpCard(card('clubs', '2'), room.gameState.trumpSuit, room.gameState.trumpRank), false);
    assert.equal(engine.expireCulturalRevolutionAtRoundEnd(2), null);

    const expired = engine.expireCulturalRevolutionAtRoundEnd(3);
    assert.equal(expired.restoredTrumpSuit, 'hearts');
    assert.equal(expired.restoredTrumpRank, '2');
    assert.equal(room.gameState.trumpSuit, 'hearts');
    assert.equal(room.gameState.trumpRank, '2');
    assert.equal(room.gameState.culturalRevolution, null);
  }
});

test('三人成虎按扩展牌面降低四级，并保持实体牌原分值', () => {
  assert.deepEqual(
    ['2', '3', '4', '5', 'A'].map(rank => shiftThreeTigersRank(rank)),
    ['-2', '-1', '0', '1', '10']
  );
  assert.equal(shiftThreeTigersRank('4', '4'), '-1');
  assert.equal(shiftThreeTigersRank('5', '4'), '0');
  assert.equal(shiftThreeTigersRank('8', '4'), '3');
  assert.equal(shiftThreeTigersRank('9', '4'), '5');

  const transformedTwo = transformThreeTigersCard(
    card('hearts', '2'),
    'hearts',
    '9',
    'spades'
  );
  const transformedThree = transformThreeTigersCard(
    card('hearts', '3'),
    'hearts',
    '9',
    'spades'
  );
  assert.equal(transformedTwo.rank, '-2');
  assert.equal(transformedTwo.originalRank, '2');
  assert.equal(transformedTwo.isThreeTigersTrump, true);
  assert.equal(isTrumpCard(transformedTwo, 'spades', '9'), true);
  assert.ok(
    getCardStrength(transformedThree, 'spades', '9', THREE_TIGERS_RULE)
      > getCardStrength(transformedTwo, 'spades', '9', THREE_TIGERS_RULE)
  );

  const transformedFive = transformThreeTigersCard(
    card('hearts', '5'),
    'hearts',
    '9',
    'spades'
  );
  assert.equal(transformedFive.rank, '1');
  assert.equal(getCardPoints(transformedFive), 5);

  const levelCard = transformThreeTigersCard(
    card('hearts', '4'),
    'hearts',
    '4',
    'spades'
  );
  const trumpSuitCard = transformThreeTigersCard(
    card('spades', '8'),
    'spades',
    '4',
    'spades'
  );
  const joker = transformThreeTigersCard(
    card('joker', 'small_joker'),
    'joker',
    '4',
    'spades'
  );
  assert.equal(levelCard.rank, '4');
  assert.equal(levelCard.isThreeTigersTransformed, undefined);
  assert.equal(trumpSuitCard.rank, '8');
  assert.equal(trumpSuitCard.isThreeTigersTransformed, undefined);
  assert.equal(joker.rank, 'small_joker');
  assert.equal(joker.isThreeTigersTransformed, undefined);
});

test('三人成虎在第三名同花色玩家落牌后立刻转换整桌、重算赢家且按原牌计分', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const roundCards = [
    card('hearts', '5', 900),
    card('hearts', '6', 901),
    card('hearts', '10', 902),
    card('hearts', 'K', 903)
  ];
  room.players.forEach((player, index) => {
    player.addCard(roundCards[index]);
    player.addCard(card('clubs', ['2', '3', '6', '7'][index], 910 + index));
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = THREE_TIGERS_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '4';
  room.gameState.buryingPlayerId = room.players[0].id;
  room.gameState.dealerPlayerIndex = 0;
  engine.setFirstPlayer(room.players[0].id);

  const first = engine.playCards(room.players[0].id, [roundCards[0].id]);
  const second = engine.playCards(room.players[1].id, [roundCards[1].id]);
  assert.equal(first.threeTigersTransformation.active, false);
  assert.equal(second.threeTigersTransformation.active, false);
  assert.equal(second.threeTigersTransformation.suitCounts.hearts, 2);

  const third = engine.playCards(room.players[2].id, [roundCards[2].id]);
  assert.equal(third.threeTigersTransformation.active, true);
  assert.equal(third.threeTigersTransformation.triggeredNow, true);
  assert.equal(third.threeTigersTransformation.triggeredSuit, 'hearts');
  assert.deepEqual(
    third.threeTigersTransformation.plays.map(play => play.cards[0].rank),
    ['0', '1', '6']
  );
  assert.ok(
    third.threeTigersTransformation.plays
      .every(play => play.cards[0].isThreeTigersTrump === true)
  );
  assert.equal(third.currentWinningPlayerId, room.players[2].id);

  const fourth = engine.playCards(room.players[3].id, [roundCards[3].id]);
  assert.equal(fourth.threeTigersTransformation.triggeredNow, false);
  assert.equal(fourth.playedCards[0].rank, '9');
  assert.equal(fourth.playedCards[0].isThreeTigersTransformed, true);
  assert.equal(fourth.threeTigersTransformation.plays[3].cards[0].rank, '9');
  assert.equal(fourth.roundUpdate.threeTigers.plays[3].cards[0].rank, '9');
  assert.equal(fourth.roundUpdate.roundWinner.playerId, room.players[3].id);
  assert.equal(fourth.roundUpdate.scoreInfo.baseRoundPoints, 25);
  assert.equal(fourth.roundUpdate.scoreInfo.roundPoints, 25);
  assert.equal(fourth.roundUpdate.threeTigers.triggeredSuit, 'hearts');
  assert.equal(room.gameState.threeTigersRoundState, null);
  assert.equal(room.gameState.threeTigersLastRoundState.triggeredSuit, 'hearts');
});

test('三人成虎不统计或转换主花色牌，四家连续出主牌也不会触发', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const roundCards = ['5', '10', 'K', 'A'].map((rank, index) => (
    card('hearts', rank, 920 + index)
  ));
  room.players.forEach((player, index) => {
    player.addCard(roundCards[index]);
    player.addCard(card('clubs', ['2', '3', '6', '7'][index], 930 + index));
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = THREE_TIGERS_RULE;
  room.gameState.trumpSuit = 'hearts';
  room.gameState.trumpRank = '4';
  room.gameState.buryingPlayerId = room.players[0].id;
  room.gameState.dealerPlayerIndex = 0;
  engine.setFirstPlayer(room.players[0].id);

  assert.equal(engine.getThreeTigersPlaySuit([card('clubs', '8')]), 'clubs');
  assert.equal(engine.getThreeTigersPlaySuit([card('hearts', '8')]), null);
  assert.equal(engine.getThreeTigersPlaySuit([card('clubs', '4')]), null);
  assert.equal(engine.getThreeTigersPlaySuit([card('joker', 'big_joker')]), null);

  const results = roundCards.map((playedCard, index) => (
    engine.playCards(room.players[index].id, [playedCard.id])
  ));

  for (const result of results) {
    assert.equal(result.threeTigersTransformation.active, false);
    assert.equal(result.threeTigersTransformation.suitCounts.hearts, 0);
    assert.equal(result.playedCards[0].isThreeTigersTransformed, undefined);
  }
  const last = results[3];
  assert.equal(last.roundUpdate.threeTigers.triggeredSuit, null);
  assert.equal(last.roundUpdate.threeTigers.suitCounts.hearts, 0);
  assert.equal(room.gameState.threeTigersLastRoundState.triggeredSuit, null);
});

test('撤回第三人的出牌会撤销三人成虎并恢复桌面原牌', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const roundCards = ['5', '10', 'K', 'A'].map((rank, index) => (
    card('diamonds', rank, 930 + index)
  ));
  room.players.forEach((player, index) => {
    player.addCard(roundCards[index]);
    player.addCard(card('clubs', String(index + 3), 940 + index));
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = THREE_TIGERS_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  room.gameState.dealerPlayerIndex = 0;
  engine.setFirstPlayer(room.players[0].id);

  engine.playCards(room.players[0].id, [roundCards[0].id]);
  engine.playCards(room.players[1].id, [roundCards[1].id]);
  engine.playCards(room.players[2].id, [roundCards[2].id]);
  assert.equal(room.gameState.threeTigersRoundState.triggeredSuit, 'diamonds');

  const undone = engine.undoLastPlay(room.players[2].id);
  assert.equal(undone.threeTigersTransformation.active, false);
  assert.equal(undone.threeTigersTransformation.reverted, true);
  assert.equal(undone.threeTigersTransformation.suitCounts.diamonds, 2);
  assert.deepEqual(
    undone.threeTigersTransformation.plays.map(play => play.cards[0].rank),
    ['5', '10']
  );
  assert.equal(room.gameState.threeTigersRoundState.triggeredSuit, null);
  assert.equal(room.gameState.currentWinnerIndex, 1);
});

test('请君入瓮按本轮实体牌面固定扣5分，多张命中也不重复扣分', () => {
  const selfTargetRoom = createRoom();
  const selfTargetEngine = new GameEngine(selfTargetRoom, createIo());
  selfTargetRoom.gameState.phase = GamePhases.PLAYING;
  selfTargetRoom.gameState.selectedRule = INVITE_INTO_URN_RULE;
  selfTargetEngine.setFirstPlayer(selfTargetRoom.players[0].id);
  assert.throws(
    () => selfTargetEngine.activateInviteIntoUrn(
      selfTargetRoom.players[0].id,
      selfTargetRoom.players[0].id,
      'hearts',
      '8'
    ),
    /不能指定自己/
  );

  const whiteTargetRoom = createRoom();
  const whiteTargetEngine = new GameEngine(whiteTargetRoom, createIo());
  whiteTargetRoom.gameState.phase = GamePhases.PLAYING;
  whiteTargetRoom.gameState.selectedRule = INVITE_INTO_URN_RULE;
  whiteTargetEngine.setFirstPlayer(whiteTargetRoom.players[0].id);
  const whiteDeclaration = whiteTargetEngine.activateInviteIntoUrn(
    whiteTargetRoom.players[0].id,
    whiteTargetRoom.players[1].id,
    'joker',
    Ranks.WHITE_JOKER
  );
  assert.equal(whiteDeclaration.rank, Ranks.WHITE_JOKER);

  const runScenario = ({ leaderIndex, targetIndex, expectedScoreDelta }) => {
    const room = createRoom();
    const engine = new GameEngine(room, createIo());
    const ranks = ['3', '4', '6', '7'];
    ranks[targetIndex] = '8';
    const pairs = room.players.map((player, playerIndex) => {
      const pair = [0, 1].map(copyOffset => (
        card('hearts', ranks[playerIndex], 1000 + playerIndex * 2 + copyOffset)
      ));
      pair.forEach(value => player.addCard(value));
      player.addCard(card('clubs', String(playerIndex + 2), 1020 + playerIndex));
      return pair;
    });
    room.gameState.phase = GamePhases.PLAYING;
    room.gameState.selectedRule = INVITE_INTO_URN_RULE;
    room.gameState.trumpSuit = 'spades';
    room.gameState.trumpRank = '2';
    room.gameState.buryingPlayerId = room.players[0].id;
    room.gameState.dealerPlayerIndex = 0;
    engine.setFirstPlayer(room.players[leaderIndex].id);

    const activation = engine.activateInviteIntoUrn(
      room.players[leaderIndex].id,
      room.players[targetIndex].id,
      'hearts',
      '8'
    );
    assert.equal(activation.targetPlayerId, room.players[targetIndex].id);
    assert.equal(
      engine.hasUsedActiveSkill(room.players[leaderIndex].id, ActiveSkillIds.INVITE_INTO_URN),
      true
    );

    let finalResult = null;
    for (let offset = 0; offset < room.players.length; offset += 1) {
      const playerIndex = (leaderIndex + offset) % room.players.length;
      finalResult = engine.playCards(
        room.players[playerIndex].id,
        pairs[playerIndex].map(value => value.id)
      );
    }

    const urnResult = finalResult.roundUpdate.scoreInfo.inviteIntoUrn;
    const targetResult = urnResult.declarations[0];
    assert.equal(targetResult.triggered, true);
    assert.equal(targetResult.matchingCardCount, 2);
    assert.equal(targetResult.penalty, 5);
    assert.equal(targetResult.scoreDelta, expectedScoreDelta);
    assert.equal(urnResult.scoreDelta, expectedScoreDelta);
    assert.equal(room.gameState.attackerScore, expectedScoreDelta);
    assert.equal(room.gameState.inviteIntoUrnDeclarations.length, 0);
    assert.equal(room.gameState.inviteIntoUrnLastResult.round, 1);
  };

  runScenario({ leaderIndex: 0, targetIndex: 1, expectedScoreDelta: -5 });
  runScenario({ leaderIndex: 2, targetIndex: 0, expectedScoreDelta: 5 });
});

test('老骥伏枥只在四人都首次获得过牌权后生效，非法首发不消耗绝大', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const leadCard = card('hearts', '3', 1100);
  const invalidExtra = card('clubs', '4', 1101);
  room.players[3].addCard(leadCard);
  room.players[3].addCard(invalidExtra);
  const followCards = [
    card('hearts', 'A', 1110),
    card('hearts', 'K', 1111),
    card('hearts', 'Q', 1112)
  ];
  [0, 1, 2].forEach(playerIndex => {
    room.players[playerIndex].addCard(followCards[playerIndex]);
    room.players[playerIndex].addCard(card('clubs', String(playerIndex + 6), 1120 + playerIndex));
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = OLD_HORSE_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  room.gameState.dealerPlayerIndex = 0;
  engine.setFirstPlayer(room.players[0].id);

  assert.deepEqual(
    Array.from(room.gameState.oldHorseRightHolderPlayerIds),
    [room.players[0].id]
  );
  engine.updateOldHorseAtRoundEnd(1);
  engine.updateOldHorseAtRoundEnd(2);
  const armed = engine.updateOldHorseAtRoundEnd(3);
  assert.equal(armed.armedNow, true);
  assert.equal(room.gameState.oldHorseProtectedPlayerId, room.players[3].id);

  room.gameState.currentRound = 4;
  room.gameState.currentPlayerIndex = 3;
  room.gameState.roundStartPlayerIndex = 3;
  room.gameState.playersPlayedThisRound.clear();
  room.gameState.currentRoundPlays = [];
  room.gameState.leadingPattern = null;
  room.gameState.currentWinnerIndex = null;

  assert.throws(
    () => engine.playCards(room.players[3].id, [leadCard.id, invalidExtra.id]),
    /无效|花色|牌型/
  );
  assert.equal(room.gameState.oldHorseProtectedPlayerId, room.players[3].id);

  const firstLead = engine.playCards(room.players[3].id, [leadCard.id]);
  assert.equal(firstLead.oldHorseAbsolute, true);
  assert.equal(firstLead.currentWinningPlayerId, room.players[3].id);
  assert.equal(room.gameState.oldHorseProtectedPlayerId, null);

  const undone = engine.undoLastPlay(room.players[3].id);
  assert.equal(undone.restoredOldHorseAbsolute, true);
  assert.equal(room.gameState.oldHorseProtectedPlayerId, room.players[3].id);

  engine.playCards(room.players[3].id, [leadCard.id]);
  const aceFollow = engine.playCards(room.players[0].id, [followCards[0].id]);
  assert.equal(aceFollow.currentWinningPlayerId, room.players[3].id);
  engine.playCards(room.players[1].id, [followCards[1].id]);
  const finalResult = engine.playCards(room.players[2].id, [followCards[2].id]);
  assert.equal(finalResult.roundUpdate.roundWinner.playerId, room.players[3].id);
  assert.equal(finalResult.roundUpdate.oldHorse.protectedPlayerId, null);
});

test('Trump wins按各家实体出牌分值决定下轮牌权，并列时先出者优先', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const roundCards = [
    card('hearts', '5', 1200),
    card('hearts', 'K', 1201),
    card('hearts', '10', 1202),
    card('hearts', 'A', 1203)
  ];
  room.players.forEach((player, index) => {
    player.addCard(roundCards[index]);
    player.addCard(card('clubs', String(index + 3), 1210 + index));
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = TRUMP_WINS_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  room.gameState.dealerPlayerIndex = 0;
  engine.setFirstPlayer(room.players[0].id);

  let finalResult = null;
  room.players.forEach((player, index) => {
    finalResult = engine.playCards(player.id, [roundCards[index].id]);
  });

  assert.equal(finalResult.roundUpdate.roundWinner.playerId, room.players[3].id);
  assert.deepEqual(
    finalResult.roundUpdate.trumpWins.players.map(player => player.points),
    [5, 10, 10, 0]
  );
  assert.equal(finalResult.roundUpdate.trumpWins.highestPoints, 10);
  assert.equal(finalResult.roundUpdate.trumpWins.leaderPlayerId, room.players[1].id);
  assert.equal(finalResult.roundUpdate.nextRoundLeader.playerId, room.players[1].id);
  assert.equal(room.gameState.currentPlayerIndex, 1);
  assert.equal(room.gameState.attackerScore, 25);
});

test('草船借箭在首置至少10分失守后冻结下一轮，并公开弃牌换取最大非分数牌', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const roundCards = [
    card('hearts', '10', 1300),
    card('hearts', 'A', 1301),
    card('hearts', '3', 1302),
    card('hearts', '4', 1303)
  ];
  const reserveCards = [
    card('clubs', '3', 1310),
    card('clubs', '4', 1311),
    card('clubs', '6', 1312),
    card('clubs', '7', 1313)
  ];
  room.players.forEach((player, index) => {
    player.addCard(roundCards[index]);
    player.addCard(reserveCards[index]);
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = STRAW_BOAT_BORROWING_ARROWS_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  room.gameState.dealerPlayerIndex = 0;
  engine.setFirstPlayer(room.players[0].id);

  let finalResult = null;
  room.players.forEach((player, index) => {
    finalResult = engine.playCards(player.id, [roundCards[index].id]);
  });

  assert.equal(finalResult.roundUpdate.roundWinner.playerId, room.players[1].id);
  assert.equal(finalResult.strawBoatDecision.playerId, room.players[0].id);
  assert.equal(finalResult.strawBoatDecision.leadingPoints, 10);
  assert.equal(finalResult.strawBoatDecision.borrowedCard.id, roundCards[1].id);
  assert.equal(room.gameState.currentRound, 2);
  assert.throws(
    () => engine.playCards(room.players[1].id, [reserveCards[1].id]),
    /草船借箭/
  );

  const botChoice = engine.selectStrawBoatBorrowingArrowsForBot(room.players[0].id);
  assert.deepEqual(botChoice, { accept: true, cardId: reserveCards[0].id });

  const resolved = engine.resolveStrawBoatBorrowingArrows(room.players[0].id, botChoice);
  assert.equal(resolved.accepted, true);
  assert.equal(resolved.discardedCard.id, reserveCards[0].id);
  assert.equal(resolved.borrowedCard.id, roundCards[1].id);
  assert.deepEqual(room.players[0].cards.map(value => value.id), [roundCards[1].id]);
  assert.equal(room.gameState.strawBoatBorrowingArrowsDecision, null);
  assert.equal(
    room.gameState.toJSON().strawBoatBorrowingArrows.lastResult.discardedCard.id,
    reserveCards[0].id
  );
});

test('草船借箭在首置分牌由本方赢得时不触发', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const roundCards = [
    card('hearts', '10', 1320),
    card('hearts', '3', 1321),
    card('hearts', 'A', 1322),
    card('hearts', '4', 1323)
  ];
  room.players.forEach((player, index) => {
    player.addCard(roundCards[index]);
    player.addCard(card('clubs', String(index + 3), 1330 + index));
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = STRAW_BOAT_BORROWING_ARROWS_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  room.gameState.dealerPlayerIndex = 0;
  engine.setFirstPlayer(room.players[0].id);

  let finalResult = null;
  room.players.forEach((player, index) => {
    finalResult = engine.playCards(player.id, [roundCards[index].id]);
  });

  assert.equal(finalResult.roundUpdate.roundWinner.playerId, room.players[2].id);
  assert.equal(finalResult.strawBoatDecision, null);
  assert.equal(room.gameState.strawBoatBorrowingArrowsDecision, null);
});

test('布什戈门由二号位迫使一号位收回首发，退回牌只禁用于紧接着的重新首发', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const returnedAceA = card('hearts', 'A', 1400);
  const returnedAceB = card('hearts', 'A', 1401);
  const alternativeLead = card('hearts', '3', 1402);
  const playerCards = [
    [returnedAceA, returnedAceB, alternativeLead],
    [card('hearts', '4', 1410), card('hearts', '8', 1411)],
    [card('hearts', '5', 1420), card('hearts', '9', 1421)],
    [card('hearts', '6', 1430), card('hearts', '7', 1431)]
  ];
  room.players.forEach((player, index) => {
    playerCards[index].forEach(value => player.addCard(value));
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = BUSH_GATE_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  room.gameState.dealerPlayerIndex = 0;
  engine.setFirstPlayer(room.players[0].id);

  engine.playCards(room.players[0].id, [returnedAceA.id, returnedAceB.id]);
  assert.throws(
    () => engine.activateBushGate(room.players[2].id),
    /二号位/
  );

  const activation = engine.activateBushGate(room.players[1].id);
  assert.equal(activation.leaderPlayerId, room.players[0].id);
  assert.deepEqual(activation.forbiddenCardIds, [returnedAceA.id, returnedAceB.id]);
  assert.equal(room.gameState.currentRoundPlays.length, 0);
  assert.equal(room.gameState.currentPlayerIndex, 0);
  assert.deepEqual(
    new Set(room.players[0].cards.map(value => value.id)),
    new Set([returnedAceA.id, returnedAceB.id, alternativeLead.id])
  );
  assert.equal(
    engine.hasUsedActiveSkill(room.players[1].id, ActiveSkillIds.BUSH_GATE),
    true
  );
  assert.throws(
    () => engine.playCards(room.players[0].id, [returnedAceA.id]),
    /布什戈门/
  );
  assert.throws(
    () => engine.playCards(room.players[0].id, [alternativeLead.id, returnedAceB.id]),
    /布什戈门/
  );

  engine.playCards(room.players[0].id, [alternativeLead.id]);
  assert.equal(room.gameState.bushGateRestriction, null);
  assert.equal(room.gameState.bushGateLastResult.replayCompleted, true);
  assert.throws(
    () => engine.activateBushGate(room.players[1].id),
    /只能发动一次/
  );

  const undone = engine.undoLastPlay(room.players[0].id);
  assert.equal(undone.restoredBushGateRestriction, true);
  assert.equal(room.gameState.bushGateRestriction.leaderPlayerId, room.players[0].id);
  assert.throws(
    () => engine.playCards(room.players[0].id, [returnedAceA.id]),
    /布什戈门/
  );

  engine.playCards(room.players[0].id, [alternativeLead.id]);
  engine.playCards(room.players[1].id, [playerCards[1][0].id]);
  engine.playCards(room.players[2].id, [playerCards[2][0].id]);
  const firstRound = engine.playCards(room.players[3].id, [playerCards[3][0].id]);
  assert.equal(firstRound.roundUpdate.roundWinner.playerId, room.players[3].id);

  engine.playCards(room.players[3].id, [playerCards[3][1].id]);
  const laterUse = engine.playCards(room.players[0].id, [returnedAceA.id]);
  assert.equal(laterUse.playedCards[0].id, returnedAceA.id);
  assert.equal(laterUse.currentWinningPlayerId, room.players[0].id);
});

test('布什戈门在一号位没有其他牌可改出时不能发动且不消耗次数', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const onlyCard = card('hearts', 'A', 1440);
  room.players[0].addCard(onlyCard);
  room.players[1].addCard(card('hearts', '4', 1441));
  room.players[2].addCard(card('hearts', '5', 1442));
  room.players[3].addCard(card('hearts', '6', 1443));
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = BUSH_GATE_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  engine.playCards(room.players[0].id, [onlyCard.id]);
  assert.throws(
    () => engine.activateBushGate(room.players[1].id),
    /没有其他手牌/
  );
  assert.equal(
    engine.hasUsedActiveSkill(room.players[1].id, ActiveSkillIds.BUSH_GATE),
    false
  );
  assert.equal(room.gameState.currentRoundPlays.length, 1);
});

test('队友加油在出牌后无主时询问，并沿完整牌力链给对家永久提升一级', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const openingCard = card('clubs', '3', 1450);
  const remainingSideCard = card('clubs', '4', 1451);
  const targetCards = [
    card('clubs', 'A', 1460),
    card('hearts', 'A', 1461),
    card('clubs', '2', 1462),
    card('hearts', '2', 1463),
    card('joker', 'small_joker', 1464),
    card('joker', 'big_joker', 1465),
    card('hearts', '5', 1466)
  ];
  room.players[0].addCard(openingCard);
  room.players[0].addCard(remainingSideCard);
  room.players[1].addCard(card('clubs', '6', 1470));
  targetCards.forEach(value => room.players[2].addCard(value));
  room.players[3].addCard(card('clubs', '7', 1480));
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = TEAMMATE_CHEER_RULE;
  room.gameState.trumpSuit = 'hearts';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  const playResult = engine.playCards(room.players[0].id, [openingCard.id]);
  assert.equal(playResult.teammateCheerRequest.playerId, room.players[0].id);
  assert.equal(playResult.teammateCheerRequest.teammatePlayerId, room.players[2].id);
  assert.equal(engine.hasPendingTeammateCheerDecision(), true);
  assert.throws(
    () => engine.playCards(room.players[1].id, [room.players[1].cards[0].id]),
    /队友加油/
  );

  const declined = engine.respondTeammateCheer(room.players[0].id, false);
  assert.equal(declined.accepted, false);
  assert.equal(room.gameState.teammateCheerUsedPlayerIds.has(room.players[0].id), false);
  assert.ok(engine.requestTeammateCheerIfEligible(room.players[0]));

  const accepted = engine.respondTeammateCheer(room.players[0].id, true);
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.buffedPlayerId, room.players[2].id);
  assert.equal(room.gameState.teammateCheerUsedPlayerIds.has(room.players[0].id), true);
  assert.equal(room.gameState.teammateCheerBuffedPlayerIds.has(room.players[2].id), true);

  const transformedById = new Map(room.players[2].cards.map(value => [value.id, value]));
  assert.deepEqual(
    [transformedById.get(targetCards[0].id).suit, transformedById.get(targetCards[0].id).rank],
    ['clubs', 'B']
  );
  assert.deepEqual(
    [transformedById.get(targetCards[1].id).suit, transformedById.get(targetCards[1].id).rank],
    ['diamonds', '2']
  );
  assert.deepEqual(
    [transformedById.get(targetCards[2].id).suit, transformedById.get(targetCards[2].id).rank],
    ['hearts', '2']
  );
  assert.equal(transformedById.get(targetCards[3].id).rank, 'small_joker');
  assert.equal(transformedById.get(targetCards[4].id).rank, 'big_joker');
  assert.equal(transformedById.get(targetCards[5].id).rank, 'county_prince_joker');
  assert.equal(transformedById.get(targetCards[6].id).rank, '6');
  assert.ok(room.players[2].cards.every(value => value.isTeammateCheered));
  assert.equal(getCardPoints(transformedById.get(targetCards[6].id)), 5);
  assert.ok(
    getCardStrength(
      transformedById.get(targetCards[0].id),
      'hearts',
      '2',
      TEAMMATE_CHEER_RULE
    ) > getCardStrength(card('clubs', 'A', 1490), 'hearts', '2', TEAMMATE_CHEER_RULE)
  );

  const publicState = room.gameState.toJSON().teammateCheer;
  assert.deepEqual(publicState.buffedPlayerIds, [room.players[2].id]);
  assert.equal(publicState.lastResult.playerId, room.players[0].id);
  assert.equal(publicState.lastResult.transformedCards, undefined);
  assert.equal(engine.requestTeammateCheerIfEligible(room.players[0]), null);

  const undoResult = engine.undoLastPlay(room.players[0].id);
  assert.equal(undoResult.teammateCheerReverted.buffedPlayerId, room.players[2].id);
  assert.equal(room.gameState.teammateCheerUsedPlayerIds.has(room.players[0].id), false);
  assert.equal(room.gameState.teammateCheerBuffedPlayerIds.has(room.players[2].id), false);
  const restoredById = new Map(room.players[2].cards.map(value => [value.id, value]));
  assert.deepEqual(
    targetCards.map(value => {
      const restored = restoredById.get(value.id);
      return [restored.suit, restored.rank];
    }),
    [
      ['clubs', 'A'],
      ['hearts', 'A'],
      ['clubs', '2'],
      ['hearts', '2'],
      ['joker', 'small_joker'],
      ['joker', 'big_joker'],
      ['hearts', '5']
    ]
  );
  assert.ok(room.players[2].cards.every(value => !value.isTeammateCheered));
  assert.equal(room.gameState.teammateCheerLastResult, null);
});

test('队友加油不会在出牌者仍持有主牌或已经出完牌时询问', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const sideCard = card('clubs', '3', 1500);
  const remainingTrump = card('hearts', '4', 1501);
  room.players[0].addCard(sideCard);
  room.players[0].addCard(remainingTrump);
  room.players[1].addCard(card('clubs', '5', 1502));
  room.players[2].addCard(card('clubs', '6', 1503));
  room.players[3].addCard(card('clubs', '7', 1504));
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = TEAMMATE_CHEER_RULE;
  room.gameState.trumpSuit = 'hearts';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  const result = engine.playCards(room.players[0].id, [sideCard.id]);
  assert.equal(result.teammateCheerRequest, null);
  assert.equal(engine.hasPendingTeammateCheerDecision(), false);

  const emptyRoom = createRoom();
  const emptyEngine = new GameEngine(emptyRoom, createIo());
  const lastCard = card('clubs', '8', 1510);
  emptyRoom.players[0].addCard(lastCard);
  emptyRoom.players[1].addCard(card('clubs', '9', 1511));
  emptyRoom.players[2].addCard(card('clubs', '10', 1512));
  emptyRoom.players[3].addCard(card('clubs', 'J', 1513));
  emptyRoom.gameState.phase = GamePhases.PLAYING;
  emptyRoom.gameState.selectedRule = TEAMMATE_CHEER_RULE;
  emptyRoom.gameState.trumpSuit = 'hearts';
  emptyRoom.gameState.trumpRank = '2';
  emptyRoom.gameState.buryingPlayerId = emptyRoom.players[0].id;
  emptyEngine.setFirstPlayer(emptyRoom.players[0].id);

  const finalHandResult = emptyEngine.playCards(emptyRoom.players[0].id, [lastCard.id]);
  assert.equal(emptyRoom.players[0].cards.length, 0);
  assert.equal(finalHandResult.teammateCheerRequest, null);
  assert.equal(emptyEngine.hasPendingTeammateCheerDecision(), false);
});

test('回光返照允许持有1至3张主牌的开局一号位在首次出牌前直接发动', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io);
  const openingTrumps = [
    card('spades', 'K', 1512),
    card('joker', 'small_joker', 1513)
  ];
  [...openingTrumps, card('clubs', '4', 1514)].forEach(value => (
    room.players[0].addCard(value)
  ));
  room.players[1].addCard(card('spades', 'Q', 1515));
  room.players[2].addCard(card('spades', 'J', 1516));
  room.players[3].addCard(card('spades', '10', 1517));
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = AFTERGLOW_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;

  engine.setFirstPlayer(room.players[0].id);

  const pending = room.gameState.afterglowPending;
  assert.equal(pending.playerId, room.players[0].id);
  assert.equal(pending.trumpCount, 2);
  assert.equal(pending.triggerTiming, 'before_first_play');
  assert.ok(io.events.some(event => (
    event.target === room.players[0].socketId
    && event.event === 'afterglow_decision_required'
    && event.payload.triggerTiming === 'before_first_play'
  )));
  assert.throws(
    () => engine.playCards(room.players[0].id, [openingTrumps[0].id]),
    /回光返照/
  );

  const accepted = engine.respondAfterglow(room.players[0].id, true);
  assert.equal(accepted.accepted, true);
  assert.equal(room.gameState.afterglowActivePlayerIds.has(room.players[0].id), true);
  const boostedById = new Map(room.players[0].cards.map(value => [value.id, value]));
  assert.equal(boostedById.get(openingTrumps[0].id).rank, 'A');
  assert.equal(boostedById.get(openingTrumps[1].id).rank, 'big_joker');

  const firstPlay = engine.playCards(room.players[0].id, [openingTrumps[0].id]);
  assert.equal(room.gameState.playHistory.at(-1).afterglowActive, true);
  assert.equal(firstPlay.playedCards[0].rank, 'A');
});

test('回光返照在无主局不询问且不能强制发动', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io);
  const player = room.players[0];
  [
    card('spades', '2', 1518),
    card('joker', 'small_joker', 1519),
    card('clubs', '4', 1520)
  ].forEach(value => player.addCard(value));
  room.players[1].addCard(card('clubs', '5', 1521));
  room.players[2].addCard(card('clubs', '6', 1522));
  room.players[3].addCard(card('clubs', '7', 1523));
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = AFTERGLOW_RULE;
  room.gameState.trumpSuit = 'no_trump';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = player.id;

  engine.setFirstPlayer(player.id);

  assert.equal(engine.isEligibleForAfterglow(player), false);
  assert.equal(engine.requestAfterglowIfEligible(player), null);
  assert.equal(room.gameState.afterglowPending, null);
  assert.equal(
    io.events.some(event => event.event === 'afterglow_decision_required'),
    false
  );

  room.gameState.afterglowPending = {
    playerId: player.id,
    playerName: player.name,
    trumpCount: 2,
    remainingCount: player.cards.length,
    triggerTiming: 'before_first_play',
    triggerRound: 1
  };
  assert.throws(
    () => engine.respondAfterglow(player.id, true),
    /无主局不能发动回光返照/
  );
  assert.equal(room.gameState.afterglowPending, null);
  assert.equal(room.gameState.afterglowUsedPlayerIds.has(player.id), false);
});

test('回光返照只在出牌后仍有手牌且剩余1至3张主牌时询问，暂拒不消耗机会', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const openingCard = card('clubs', '4', 1520);
  const remainingTrumps = [
    card('clubs', '2', 1522),
    card('joker', 'small_joker', 1523),
    card('joker', 'big_joker', 1524)
  ];
  [openingCard, ...remainingTrumps].forEach(value => (
    room.players[0].addCard(value)
  ));
  room.players[1].addCard(card('clubs', '5', 1525));
  room.players[2].addCard(card('clubs', '6', 1526));
  room.players[3].addCard(card('clubs', '7', 1527));
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = AFTERGLOW_RULE;
  room.gameState.trumpSuit = 'clubs';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  const playResult = engine.playCards(room.players[0].id, [openingCard.id]);
  assert.equal(playResult.afterglowRequest.playerId, room.players[0].id);
  assert.equal(playResult.afterglowRequest.trumpCount, 3);
  assert.equal(engine.hasPendingAfterglowDecision(), true);
  assert.throws(
    () => engine.playCards(room.players[1].id, [room.players[1].cards[0].id]),
    /回光返照/
  );

  const declined = engine.respondAfterglow(room.players[0].id, false);
  assert.equal(declined.accepted, false);
  assert.equal(room.gameState.afterglowUsedPlayerIds.has(room.players[0].id), false);
  assert.ok(engine.requestAfterglowIfEligible(room.players[0]));

  const accepted = engine.respondAfterglow(room.players[0].id, true);
  assert.equal(accepted.accepted, true);
  assert.equal(room.gameState.afterglowUsedPlayerIds.has(room.players[0].id), true);
  assert.equal(room.gameState.afterglowActivePlayerIds.has(room.players[0].id), true);
  assert.deepEqual(room.gameState.toJSON().afterglow.activePlayerIds, [room.players[0].id]);
  const boostedById = new Map(room.players[0].cards.map(value => [value.id, value]));
  assert.deepEqual(
    remainingTrumps.map(value => {
      const boosted = boostedById.get(value.id);
      return [boosted.suit, boosted.rank, boosted.originalSuit, boosted.originalRank];
    }),
    [
      ['joker', 'small_joker', 'clubs', '2'],
      ['joker', 'big_joker', 'joker', 'small_joker'],
      ['joker', 'county_prince_joker', 'joker', 'big_joker']
    ]
  );
  assert.ok(room.players[0].cards.every(value => value.isAfterglowBoosted));
  assert.deepEqual(
    accepted.transformedCards.map(value => value.id).sort(),
    room.players[0].cards.map(value => value.id).sort()
  );

  const undoResult = engine.undoLastPlay(room.players[0].id);
  assert.equal(undoResult.afterglowReverted.activationReverted, true);
  assert.equal(room.gameState.afterglowUsedPlayerIds.has(room.players[0].id), false);
  assert.equal(room.gameState.afterglowActivePlayerIds.has(room.players[0].id), false);
  assert.equal(room.gameState.afterglowLastResult, null);
  const restoredById = new Map(room.players[0].cards.map(value => [value.id, value]));
  assert.deepEqual(
    remainingTrumps.map(value => {
      const restored = restoredById.get(value.id);
      return [restored.suit, restored.rank, restored.isAfterglowBoosted];
    }),
    [
      ['clubs', '2', false],
      ['joker', 'small_joker', false],
      ['joker', 'big_joker', false]
    ]
  );
  assert.equal(undoResult.afterglowRestoredCards.length, 4);
});

test('回光返照不会在零主牌、超过三张主牌或最后一手之后误触发', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = AFTERGLOW_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';

  room.players[0].cards = [card('clubs', '3', 1530), card('diamonds', '4', 1531)];
  assert.equal(engine.isEligibleForAfterglow(room.players[0]), false);

  room.players[0].cards = [
    card('spades', '3', 1532),
    card('spades', '4', 1533),
    card('spades', '5', 1534),
    card('spades', '6', 1535)
  ];
  assert.equal(engine.isEligibleForAfterglow(room.players[0]), false);

  const finalRoom = createRoom();
  const finalEngine = new GameEngine(finalRoom, createIo());
  const lastCard = card('clubs', '8', 1540);
  finalRoom.players[0].addCard(lastCard);
  finalRoom.players[1].addCard(card('clubs', '9', 1541));
  finalRoom.players[2].addCard(card('clubs', '10', 1542));
  finalRoom.players[3].addCard(card('clubs', 'J', 1543));
  finalRoom.gameState.phase = GamePhases.PLAYING;
  finalRoom.gameState.selectedRule = AFTERGLOW_RULE;
  finalRoom.gameState.trumpSuit = 'spades';
  finalRoom.gameState.trumpRank = '2';
  finalRoom.gameState.buryingPlayerId = finalRoom.players[0].id;
  finalEngine.setFirstPlayer(finalRoom.players[0].id);

  const finalResult = finalEngine.playCards(finalRoom.players[0].id, [lastCard.id]);
  assert.equal(finalResult.afterglowRequest, null);
  assert.equal(finalEngine.hasPendingAfterglowDecision(), false);
});

test('回光返照发动后整次出牌只能由主牌组成，主牌+1且出尽后效果结束', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const leadPair = [card('clubs', '6', 1550), card('clubs', '6', 1551)];
  const heldLedSuit = card('clubs', '7', 1552);
  const trumpKing = card('spades', 'K', 1553);
  const offSuitFive = card('diamonds', '5', 1554);
  const trumpQueen = card('spades', 'Q', 1558);
  leadPair.forEach(value => room.players[0].addCard(value));
  room.players[0].addCard(card('diamonds', '8', 1555));
  [heldLedSuit, trumpKing, offSuitFive, trumpQueen].forEach(value => room.players[1].addCard(value));
  room.players[2].addCard(card('clubs', '8', 1556));
  room.players[3].addCard(card('clubs', '9', 1557));
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = AFTERGLOW_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  room.gameState.afterglowUsedPlayerIds.add(room.players[1].id);
  room.gameState.afterglowActivePlayerIds.add(room.players[1].id);
  engine.setFirstPlayer(room.players[0].id);

  engine.playCards(room.players[0].id, leadPair.map(value => value.id));
  assert.throws(
    () => engine.playCards(room.players[1].id, [trumpKing.id, offSuitFive.id]),
    /只能由主牌组成/
  );

  const result = engine.playCards(
    room.players[1].id,
    [trumpKing.id, trumpQueen.id]
  );
  const boostedTrump = result.playedCards.find(value => value.id === trumpKing.id);
  assert.equal(boostedTrump.rank, 'A');
  assert.equal(boostedTrump.isAfterglowBoosted, true);
  assert.equal(getCardPoints(boostedTrump), 10);
  assert.equal(result.currentWinningPlayerId, room.players[1].id);
  assert.equal(result.afterglowExpired.playerId, room.players[1].id);
  assert.equal(room.gameState.afterglowActivePlayerIds.has(room.players[1].id), false);

  const undoResult = engine.undoLastPlay(room.players[1].id);
  assert.equal(undoResult.afterglowReverted.effectRestored, true);
  assert.equal(room.gameState.afterglowActivePlayerIds.has(room.players[1].id), true);
  assert.ok(room.players[1].cards.some(value => value.id === trumpKing.id));
});

test('虚虚实实只虚置奇数张首家副花色，并禁止把虚置牌打出', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const leadPair = [card('clubs', '6', 1600), card('clubs', '6', 1601)];
  const oddLedSuitCards = [
    card('clubs', '7', 1610),
    card('clubs', '8', 1611),
    card('clubs', '8', 1612)
  ];
  const trumpPair = [card('spades', '3', 1620), card('spades', '3', 1621)];
  leadPair.forEach(value => room.players[0].addCard(value));
  room.players[0].addCard(card('diamonds', '4', 1602));
  [...oddLedSuitCards, ...trumpPair].forEach(value => room.players[1].addCard(value));
  room.players[2].addCard(card('clubs', '9', 1630));
  room.players[3].addCard(card('clubs', '10', 1640));
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = ILLUSION_AND_REALITY_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  engine.playCards(room.players[0].id, leadPair.map(value => value.id));
  assert.throws(
    () => engine.playCards(room.players[1].id, trumpPair.map(value => value.id)),
    /必须优先出|跟出|副牌/
  );
  assert.throws(
    () => engine.playCards(
      room.players[1].id,
      oddLedSuitCards.slice(0, 2).map(value => value.id),
      null,
      ActiveSkillIds.ILLUSION_AND_REALITY
    ),
    /不能打出被虚置/
  );

  const result = engine.playCards(
    room.players[1].id,
    trumpPair.map(value => value.id),
    null,
    ActiveSkillIds.ILLUSION_AND_REALITY
  );
  assert.equal(result.activeSkillActivation.id, ActiveSkillIds.ILLUSION_AND_REALITY);
  assert.equal(result.activeSkillActivation.ignoredSuit, 'clubs');
  assert.equal(engine.hasUsedActiveSkill(
    room.players[1].id,
    ActiveSkillIds.ILLUSION_AND_REALITY
  ), true);
  assert.equal(room.gameState.currentRoundPlays[1].pattern.suit, 'trump');

  engine.undoLastPlay(room.players[1].id);
  assert.equal(engine.hasUsedActiveSkill(
    room.players[1].id,
    ActiveSkillIds.ILLUSION_AND_REALITY
  ), false);
  room.players[1].removeCards([oddLedSuitCards[0].id]);
  assert.throws(
    () => engine.playCards(
      room.players[1].id,
      trumpPair.map(value => value.id),
      null,
      ActiveSkillIds.ILLUSION_AND_REALITY
    ),
    /奇数张/
  );
});

test('貌合神离忽略花色比较牌型，但区分两个对子、一对两单与四张单牌', () => {
  const trumpSuit = 'spades';
  const trumpRank = '2';
  const heartPair = [card('hearts', '6', 1700), card('hearts', '6', 1701)];
  const clubPair = [card('clubs', '9', 1702), card('clubs', '9', 1703)];
  const twoPairs = [
    card('hearts', '6', 1704),
    card('hearts', '6', 1705),
    card('hearts', '9', 1706),
    card('hearts', '9', 1707)
  ];
  const pairAndSingles = [
    card('hearts', '6', 1708),
    card('hearts', '6', 1709),
    card('hearts', '9', 1710),
    card('hearts', 'J', 1711)
  ];
  const singles = ['4', '6', '9', 'J'].map((rank, index) => (
    card('hearts', rank, 1712 + index)
  ));
  const profile = cards => getSuitlessPatternProfile(
    {
      cards,
      pattern: detectPattern(
        cards,
        trumpSuit,
        trumpRank,
        OUTWARD_HARMONY_INNER_DIVISION_RULE
      )
    },
    trumpSuit,
    trumpRank,
    OUTWARD_HARMONY_INNER_DIVISION_RULE
  );

  assert.equal(profile(heartPair).key, profile(clubPair).key);
  assert.equal(profile(heartPair).label, '对子');
  assert.equal(profile(twoPairs).label, '对子×2');
  assert.equal(profile(pairAndSingles).label, '对子＋单牌×2');
  assert.equal(profile(singles).label, '单牌×4');
  assert.notEqual(profile(twoPairs).key, profile(pairAndSingles).key);
  assert.notEqual(profile(pairAndSingles).key, profile(singles).key);
});

test('貌合神离在轮末分别判定两队，单方失和给对方5分、双方失和相互抵消', () => {
  const runRound = ({ dealerPartnerPair, lastAttackerPair }) => {
    const room = createRoom();
    const engine = new GameEngine(room, createIo());
    const pair = (rank, seed) => [
      card('hearts', rank, seed),
      card('hearts', rank, seed + 1)
    ];
    const singles = (ranks, seed) => ranks.map((rank, index) => (
      card('hearts', rank, seed + index)
    ));
    const hands = [
      pair('3', 1720),
      pair('6', 1730),
      dealerPartnerPair ? pair('8', 1740) : singles(['7', '8'], 1740),
      lastAttackerPair ? pair('9', 1750) : singles(['9', 'J'], 1750)
    ];
    hands.forEach((hand, playerIndex) => {
      hand.forEach(value => room.players[playerIndex].addCard(value));
    });
    room.gameState.phase = GamePhases.PLAYING;
    room.gameState.selectedRule = OUTWARD_HARMONY_INNER_DIVISION_RULE;
    room.gameState.trumpSuit = 'spades';
    room.gameState.trumpRank = '2';
    room.gameState.buryingPlayerId = room.players[0].id;
    engine.setFirstPlayer(room.players[0].id);

    engine.playCards(room.players[0].id, hands[0].map(value => value.id));
    engine.playCards(room.players[1].id, hands[1].map(value => value.id));
    engine.playCards(room.players[2].id, hands[2].map(value => value.id));
    return engine.playCards(room.players[3].id, hands[3].map(value => value.id));
  };

  const dealerMismatch = runRound({
    dealerPartnerPair: false,
    lastAttackerPair: true
  }).roundUpdate.scoreInfo.outwardHarmonyInnerDivision;
  assert.equal(dealerMismatch.dealerTeam.mismatched, true);
  assert.equal(dealerMismatch.attackerTeam.mismatched, false);
  assert.equal(dealerMismatch.attackerAward, 5);
  assert.equal(dealerMismatch.dealerAward, 0);
  assert.equal(dealerMismatch.attackerScoreDelta, 5);
  assert.equal(dealerMismatch.attackerScore, 5);

  const attackerMismatch = runRound({
    dealerPartnerPair: true,
    lastAttackerPair: false
  }).roundUpdate.scoreInfo.outwardHarmonyInnerDivision;
  assert.equal(attackerMismatch.dealerTeam.mismatched, false);
  assert.equal(attackerMismatch.attackerTeam.mismatched, true);
  assert.equal(attackerMismatch.attackerAward, 0);
  assert.equal(attackerMismatch.dealerAward, 5);
  assert.equal(attackerMismatch.attackerScoreDelta, -5);
  assert.equal(attackerMismatch.attackerScore, -5);

  const bothMismatch = runRound({
    dealerPartnerPair: false,
    lastAttackerPair: false
  }).roundUpdate.scoreInfo.outwardHarmonyInnerDivision;
  assert.equal(bothMismatch.dealerTeam.mismatched, true);
  assert.equal(bothMismatch.attackerTeam.mismatched, true);
  assert.equal(bothMismatch.attackerAward, 5);
  assert.equal(bothMismatch.dealerAward, 5);
  assert.equal(bothMismatch.attackerScoreDelta, 0);
  assert.equal(bothMismatch.attackerScore, 0);
});

test('模棱两可只允许二三号位发动，且两套方案必须不同并各自合法', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const hands = [
    [card('hearts', '4', 1800), card('clubs', '3', 1801)],
    [card('hearts', '5', 1810), card('hearts', '10', 1811), card('clubs', '4', 1812)],
    [card('hearts', '6', 1820), card('hearts', '7', 1821), card('clubs', '5', 1822)],
    [card('hearts', '8', 1830), card('hearts', '9', 1831), card('clubs', '6', 1832)]
  ];
  hands.forEach((hand, playerIndex) => {
    hand.forEach(value => room.players[playerIndex].addCard(value));
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = AMBIGUOUS_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  assert.throws(
    () => engine.playCards(
      room.players[0].id,
      [hands[0][0].id],
      null,
      ActiveSkillIds.AMBIGUOUS,
      { ambiguousAlternativeCardIds: [hands[0][1].id] }
    ),
    /二号位或三号位/
  );

  engine.playCards(room.players[0].id, [hands[0][0].id]);
  assert.throws(
    () => engine.playCards(
      room.players[1].id,
      [hands[1][0].id],
      null,
      ActiveSkillIds.AMBIGUOUS,
      { ambiguousAlternativeCardIds: [hands[1][0].id] }
    ),
    /两种不同/
  );
  engine.playCards(room.players[1].id, [hands[1][0].id]);
  engine.playCards(room.players[2].id, [hands[2][0].id]);
  assert.throws(
    () => engine.playCards(
      room.players[3].id,
      [hands[3][0].id],
      null,
      ActiveSkillIds.AMBIGUOUS,
      { ambiguousAlternativeCardIds: [hands[3][1].id] }
    ),
    /二号位或三号位/
  );
});

test('模棱两可公开两套牌，轮末按三号位到二号位选择后才结算', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const hands = [
    [card('hearts', '4', 1840), card('clubs', '3', 1841)],
    [card('hearts', '5', 1850), card('hearts', '10', 1851), card('clubs', '4', 1852)],
    [card('hearts', '6', 1860), card('hearts', '7', 1861), card('clubs', '5', 1862)],
    [card('hearts', '8', 1870), card('clubs', '6', 1871)]
  ];
  hands.forEach((hand, playerIndex) => {
    hand.forEach(value => room.players[playerIndex].addCard(value));
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = AMBIGUOUS_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  engine.playCards(room.players[0].id, [hands[0][0].id]);
  const secondPlay = engine.playCards(
    room.players[1].id,
    [hands[1][0].id],
    null,
    ActiveSkillIds.AMBIGUOUS,
    { ambiguousAlternativeCardIds: [hands[1][1].id] }
  );
  assert.deepEqual(
    secondPlay.ambiguousOptions.map(option => option.cards.map(value => value.id)),
    [[hands[1][0].id], [hands[1][1].id]]
  );
  assert.equal(engine.hasUsedActiveSkill(room.players[1].id, ActiveSkillIds.AMBIGUOUS), true);

  const thirdPlay = engine.playCards(
    room.players[2].id,
    [hands[2][0].id],
    null,
    ActiveSkillIds.AMBIGUOUS,
    { ambiguousAlternativeCardIds: [hands[2][1].id] }
  );
  assert.equal(thirdPlay.activeSkillActivation.usageConsumed, false);
  assert.equal(engine.hasUsedActiveSkill(room.players[2].id, ActiveSkillIds.AMBIGUOUS), false);

  const held = engine.playCards(room.players[3].id, [hands[3][0].id]);
  assert.equal(held.ambiguousDecisionPending, true);
  assert.equal(held.roundUpdate.type, 'ambiguous_choice_pending');
  assert.equal(room.gameState.currentPlayerIndex, null);
  assert.equal(room.gameState.currentRound, 1);
  assert.equal(room.gameState.currentRoundPlays.length, 3);
  assert.deepEqual(
    held.ambiguousDecision.queuePlayerIds,
    [room.players[2].id, room.players[1].id]
  );

  const thirdChoice = engine.resolveAmbiguousChoice(room.players[2].id, 1);
  assert.equal(thirdChoice.completed, false);
  assert.equal(thirdChoice.nextDecision.playerId, room.players[1].id);
  assert.equal(room.players[2].cards.some(value => value.id === hands[2][0].id), true);
  assert.equal(room.players[2].cards.some(value => value.id === hands[2][1].id), false);

  const secondChoice = engine.resolveAmbiguousChoice(room.players[1].id, 1);
  assert.equal(secondChoice.completed, true);
  assert.equal(secondChoice.roundResult.roundUpdate.type, 'round_ended');
  assert.equal(secondChoice.roundResult.roundUpdate.roundWinner.playerId, room.players[1].id);
  assert.equal(room.players[1].cards.some(value => value.id === hands[1][0].id), true);
  assert.equal(room.players[1].cards.some(value => value.id === hands[1][1].id), false);
  assert.equal(room.gameState.ambiguousRoundDecision, null);
});

test('调虎离山在轮首按座次询问，并由先选定目标者抢占本方次数', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const hands = [
    [card('hearts', 'A', 2100), card('clubs', '5', 2101), card('diamonds', '6', 2102)],
    [card('hearts', 'K', 2110), card('clubs', 'K', 2111), card('diamonds', '7', 2112)],
    [card('hearts', 'Q', 2120), card('clubs', '4', 2121), card('diamonds', '8', 2122)],
    [card('hearts', 'J', 2130), card('clubs', '3', 2131), card('diamonds', '9', 2132)]
  ];
  hands.forEach((hand, playerIndex) => {
    hand.forEach(value => room.players[playerIndex].addCard(value));
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = LURE_TIGER_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[1].id;
  engine.setFirstPlayer(room.players[0].id);

  engine.playCards(room.players[0].id, [hands[0][0].id]);
  const firstReservation = engine.activateLureTiger(room.players[0].id);
  const teammateReservation = engine.activateLureTiger(room.players[2].id);
  const opposingReservation = engine.activateLureTiger(room.players[1].id);
  assert.equal(firstReservation.targetRound, 2);
  assert.equal(teammateReservation.targetRound, 2);
  assert.equal(opposingReservation.targetRound, 2);

  engine.playCards(room.players[1].id, [hands[1][0].id]);
  engine.playCards(room.players[2].id, [hands[2][0].id]);
  engine.playCards(room.players[3].id, [hands[3][0].id]);

  assert.equal(room.gameState.currentRound, 2);
  assert.equal(room.gameState.lureTigerCurrentDecision.playerId, room.players[0].id);
  assert.deepEqual(
    room.gameState.lureTigerDecisionQueue,
    [room.players[1].id, room.players[2].id]
  );

  const confirmation = engine.respondLureTiger(room.players[0].id, true);
  assert.equal(confirmation.needsTarget, true);
  assert.equal(room.gameState.lureTigerCurrentDecision.stage, 'target');
  const activation = engine.selectLureTigerTarget(
    room.players[0].id,
    room.players[1].id
  );
  assert.equal(activation.targetPlayerId, room.players[1].id);
  assert.deepEqual(Array.from(room.gameState.lureTigerUsedTeamIndexes), [0]);
  assert.equal(room.gameState.lureTigerReservations.has(room.players[2].id), false);
  assert.equal(room.gameState.lureTigerCurrentDecision.playerId, room.players[1].id);
  assert.throws(
    () => engine.activateLureTiger(room.players[2].id),
    /阵营本局已经发动过/
  );
  engine.respondLureTiger(room.players[1].id, true);
  const opposingActivation = engine.selectLureTigerTarget(
    room.players[1].id,
    room.players[2].id
  );
  assert.equal(opposingActivation.targetPlayerId, room.players[2].id);
  assert.deepEqual(
    Array.from(room.gameState.lureTigerUsedTeamIndexes).sort(),
    [0, 1]
  );
  assert.equal(engine.hasPendingLureTigerDecision(), false);
  const attackerScoreBeforeSilencedRound = room.gameState.attackerScore;

  engine.playCards(room.players[0].id, [hands[0][1].id]);
  const silencedPlay = engine.playCards(room.players[1].id, [hands[1][1].id]);
  assert.equal(silencedPlay.lureTigerSilenced, true);
  assert.equal(room.gameState.currentWinnerIndex, 0, '沉默目标的K不能压过首发5');
  engine.playCards(room.players[2].id, [hands[2][1].id]);
  const roundResult = engine.playCards(room.players[3].id, [hands[3][1].id]);
  assert.equal(roundResult.roundUpdate.roundWinner.playerId, room.players[0].id);
  assert.equal(roundResult.roundUpdate.scoreInfo.baseRoundPoints, 5);
  assert.equal(roundResult.roundUpdate.scoreInfo.roundPoints, 5);
  assert.equal(
    roundResult.roundUpdate.scoreInfo.attackerScore,
    attackerScoreBeforeSilencedRound + 5
  );
  assert.equal(room.gameState.currentRound, 3);
  assert.equal(room.gameState.lureTigerSilencedPlayerIds.size, 0);
});

test('调虎离山的沉默目标不会令一号位甩牌失败', () => {
  const createThrowRoom = selectedRule => {
    const room = createRoom();
    const leaderCards = [card('hearts', 'A', 2200), card('hearts', 'K', 2201)];
    const hands = [
      leaderCards,
      [card('hearts', 'A', 2210), card('hearts', '4', 2211)],
      [card('hearts', '9', 2220), card('hearts', '8', 2221)],
      [card('hearts', '7', 2230), card('hearts', '6', 2231)]
    ];
    hands.forEach((hand, playerIndex) => {
      hand.forEach(value => room.players[playerIndex].addCard(value));
    });
    room.gameState.phase = GamePhases.PLAYING;
    room.gameState.selectedRule = selectedRule;
    room.gameState.trumpSuit = 'spades';
    room.gameState.trumpRank = '2';
    const engine = new GameEngine(room, createIo());
    engine.setFirstPlayer(room.players[0].id);
    return { room, engine, leaderCards };
  };

  const normal = createThrowRoom(NORMAL_RULE);
  const failed = normal.engine.playCards(
    normal.room.players[0].id,
    normal.leaderCards.map(value => value.id)
  );
  assert.ok(failed.throwFailed);

  const silenced = createThrowRoom(LURE_TIGER_RULE);
  silenced.engine.activateLureTiger(silenced.room.players[2].id);
  silenced.engine.respondLureTiger(silenced.room.players[2].id, true);
  silenced.engine.selectLureTigerTarget(
    silenced.room.players[2].id,
    silenced.room.players[1].id
  );
  const successful = silenced.engine.playCards(
    silenced.room.players[0].id,
    silenced.leaderCards.map(value => value.id)
  );
  assert.equal(successful.throwFailed, null);
  assert.equal(silenced.room.gameState.leadingPattern.type, PatternTypes.THROW);
});

test('二律背反只在庄家埋完底后选择，收齐前不泄露牌面并同时亮出', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io, () => 0);
  const buriedCards = Array.from({ length: 8 }, (_, index) => (
    card('diamonds', String(3 + index), 2300 + index)
  ));
  const openingCards = [
    card('hearts', '3', 2310),
    card('hearts', '4', 2311),
    card('hearts', '6', 2312),
    card('hearts', '8', 2313)
  ];
  buriedCards.forEach(value => room.players[0].addCard(value));
  openingCards.forEach((value, index) => room.players[index].addCard(value));
  room.gameState.phase = GamePhases.BURYING;
  room.gameState.selectedRule = ANTINOMY_RULE;
  room.gameState.bottomCardsCount = 8;
  room.gameState.buryingPlayerId = room.players[0].id;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';

  assert.equal(io.events.some(({ event }) => event.startsWith('antinomy_')), false);
  engine.buryCards(room.players[0].id, buriedCards.map(value => value.id));
  assert.equal(room.gameState.phase, GamePhases.PLAYING);
  assert.equal(room.gameState.currentRound, 1);
  assert.equal(room.gameState.antinomyPendingPlayerIds.size, 4);
  assert.deepEqual(room.gameState.toJSON().antinomy.declarationsByPlayerId, {});
  assert.throws(
    () => engine.playCards(room.players[0].id, [openingCards[0].id]),
    /二律背反.*完成选择/
  );

  const choices = [
    ['hearts', '5'],
    ['hearts', '5'],
    ['clubs', '7'],
    ['spades', '9']
  ];
  choices.slice(0, 3).forEach(([suit, rank], index) => {
    engine.selectAntinomyCard(room.players[index].id, suit, rank);
    assert.deepEqual(
      room.gameState.toJSON().antinomy.declarationsByPlayerId,
      {},
      '最后一人提交前不能公开任何人的选择'
    );
  });
  const revealed = engine.selectAntinomyCard(
    room.players[3].id,
    choices[3][0],
    choices[3][1]
  );
  assert.equal(revealed.pending, false);
  assert.equal(
    room.gameState.antinomyDeclarationsByPlayerId.get(room.players[0].id).effective,
    false
  );
  assert.equal(
    room.gameState.antinomyDeclarationsByPlayerId.get(room.players[2].id).effective,
    true
  );
  assert.equal(
    io.events.filter(({ event }) => event === 'antinomy_declarations_revealed').length,
    1
  );
});

test('二律背反的唯一声明拆散实体对子和拖拉机，重复声明则取消效果', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  room.gameState.selectedRule = ANTINOMY_RULE;
  const declarations = [
    ['hearts', '5'],
    ['hearts', '5'],
    ['clubs', '7'],
    ['spades', '9']
  ];
  declarations.forEach(([suit, rank], index) => {
    room.gameState.antinomyDeclarationsByPlayerId.set(room.players[index].id, {
      suit,
      rank,
      faceKey: `${suit}:${rank}`
    });
  });
  engine.recomputeAntinomyDeclarations();
  const runtimeRule = engine.getRuleRuntimeContext();
  const duplicatedPair = [card('hearts', '5', 0), card('hearts', '5', 1)];
  const splitPair = [card('clubs', '7', 0), card('clubs', '7', 1)];
  const wouldBeTractor = [
    ...splitPair,
    card('clubs', '8', 0),
    card('clubs', '8', 1)
  ];

  assert.equal(
    detectPattern(duplicatedPair, 'spades', '2', runtimeRule).type,
    PatternTypes.PAIR,
    '多人重复声明的牌面仍可成对'
  );
  assert.equal(
    detectPattern(splitPair, 'spades', '2', runtimeRule).type,
    PatternTypes.INVALID,
    '唯一声明的两张实体牌必须视为不同牌'
  );
  assert.equal(
    detectPattern(wouldBeTractor, 'spades', '2', runtimeRule).type,
    PatternTypes.INVALID
  );
  assert.deepEqual(
    parseThrowCombination(splitPair, 'spades', '2', runtimeRule).components
      .map(component => component.type),
    [PatternTypes.SINGLE, PatternTypes.SINGLE]
  );
});

test('二律背反下未被拆散的对A正常压过同花对8', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const hands = [
    [card('spades', '8', 0), card('spades', '8', 1), card('clubs', '3', 0)],
    [card('spades', 'J', 0), card('spades', '3', 0), card('clubs', '4', 0)],
    [card('spades', 'A', 0), card('spades', 'A', 1), card('clubs', '5', 0)],
    [card('spades', '7', 0), card('spades', '7', 1), card('clubs', '6', 0)]
  ];
  hands.forEach((hand, playerIndex) => {
    hand.forEach(value => room.players[playerIndex].addCard(value));
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = ANTINOMY_RULE;
  room.gameState.trumpSuit = 'diamonds';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);
  [
    ['clubs', 'K'],
    ['diamonds', '2'],
    ['clubs', 'K'],
    ['clubs', '9']
  ].forEach(([suit, rank], playerIndex) => {
    engine.selectAntinomyCard(room.players[playerIndex].id, suit, rank);
  });

  engine.playCards(room.players[0].id, hands[0].slice(0, 2).map(value => value.id));
  engine.playCards(room.players[1].id, hands[1].slice(0, 2).map(value => value.id));
  const acePlay = engine.playCards(
    room.players[2].id,
    hands[2].slice(0, 2).map(value => value.id)
  );

  assert.equal(room.gameState.currentWinnerIndex, 2);
  assert.equal(acePlay.currentWinningPlayerId, room.players[2].id);

  const roundEnd = engine.playCards(
    room.players[3].id,
    hands[3].slice(0, 2).map(value => value.id)
  );
  assert.equal(roundEnd.roundWinner.playerId, room.players[2].id);
});

test('二律背反在轮末命中声明后才要求对应声明者重选，并冻结下一轮', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io, () => 0);
  const hands = [
    [card('hearts', '3', 2330), card('spades', '3', 2331)],
    [card('hearts', '5', 2332), card('spades', '4', 2333)],
    [card('hearts', '7', 2334), card('spades', '5', 2335)],
    [card('hearts', '9', 2336), card('spades', '6', 2337)]
  ];
  hands.forEach((hand, playerIndex) => {
    hand.forEach(value => room.players[playerIndex].addCard(value));
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = ANTINOMY_RULE;
  room.gameState.trumpSuit = 'clubs';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);
  const choices = [
    ['hearts', '5'],
    ['diamonds', '6'],
    ['clubs', '7'],
    ['spades', '8']
  ];
  choices.forEach(([suit, rank], index) => {
    engine.selectAntinomyCard(room.players[index].id, suit, rank);
  });

  hands.forEach((hand, index) => engine.playCards(room.players[index].id, [hand[0].id]));
  assert.equal(room.gameState.currentRound, 2);
  assert.deepEqual(
    Array.from(room.gameState.antinomyPendingPlayerIds),
    [room.players[0].id],
    '红桃5由别人打出，也应让声明红桃5的玩家重选'
  );
  assert.equal(
    room.gameState.antinomyDeclarationsByPlayerId.get(room.players[0].id).faceKey,
    'hearts:5',
    '重选收齐前继续公开旧声明，不泄露新选择'
  );
  assert.throws(
    () => engine.playCards(room.players[3].id, [hands[3][1].id]),
    /二律背反.*完成选择/
  );

  engine.selectAntinomyCard(room.players[0].id, 'diamonds', 'A');
  assert.equal(
    room.gameState.antinomyDeclarationsByPlayerId.get(room.players[0].id).faceKey,
    'diamonds:A'
  );
  assert.doesNotThrow(() => engine.playCards(room.players[3].id, [hands[3][1].id]));
});

test('改稻为桑由两名闲家各选向下取整的一半分牌，完成前冻结出牌', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io);
  const dealerLead = card('clubs', '3', 2400);
  const trumpFive = card('hearts', '5', 2401);
  const sideKing = card('clubs', 'K', 2402);
  const sideTen = card('diamonds', '10', 2403);
  const sideFive = card('spades', '5', 2404);
  const nonPoint = card('clubs', '4', 2405);
  const otherTrumpTen = card('hearts', '10', 2406);
  const otherSideKing = card('diamonds', 'K', 2407);

  room.players[0].addCard(dealerLead);
  [trumpFive, sideKing, sideTen, sideFive, nonPoint]
    .forEach(value => room.players[1].addCard(value));
  room.players[2].addCard(card('clubs', '6', 2408));
  [otherTrumpTen, otherSideKing, card('spades', '4', 2409)]
    .forEach(value => room.players[3].addCard(value));
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = CHANGE_RICE_TO_MULBERRY_RULE;
  room.gameState.trumpSuit = 'hearts';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;

  engine.setFirstPlayer(room.players[0].id);

  assert.deepEqual(
    Array.from(room.gameState.riceToMulberryPendingPlayerIds),
    [room.players[1].id, room.players[3].id]
  );
  assert.deepEqual(room.gameState.toJSON().riceToMulberry.completedPlayerIds, []);
  assert.throws(
    () => engine.playCards(room.players[0].id, [dealerLead.id]),
    /改稻为桑/
  );
  assert.throws(
    () => engine.selectRiceToMulberryCards(room.players[1].id, [trumpFive.id]),
    /必须选择 2 张/
  );
  assert.throws(
    () => engine.selectRiceToMulberryCards(
      room.players[1].id,
      [trumpFive.id, nonPoint.id]
    ),
    /只能选择.*分牌/
  );

  engine.selectRiceToMulberryCards(
    room.players[1].id,
    [trumpFive.id, sideKing.id]
  );
  assert.equal(trumpFive.suit, 'joker');
  assert.equal(trumpFive.rank, 'big_joker');
  assert.equal(trumpFive.originalSuit, 'hearts');
  assert.equal(trumpFive.originalRank, '5');
  assert.equal(sideKing.suit, 'clubs');
  assert.equal(sideKing.rank, 'A');
  assert.equal(sideKing.originalRank, 'K');
  assert.equal(getCardPoints(trumpFive), 0);
  assert.equal(getCardPoints(sideKing), 0);
  assert.equal(getCardPoints(sideTen), 10, '未被选择的分牌仍保留分值');
  assert.equal(room.gameState.riceToMulberryPendingPlayerIds.size, 1);

  engine.selectRiceToMulberryCards(room.players[3].id, [otherSideKing.id]);
  assert.equal(otherSideKing.suit, 'diamonds');
  assert.equal(otherSideKing.rank, 'A');
  assert.equal(getCardPoints(otherSideKing), 0);
  assert.equal(room.gameState.riceToMulberryPendingPlayerIds.size, 0);
  assert.deepEqual(
    new Set(room.gameState.toJSON().riceToMulberry.completedPlayerIds),
    new Set([room.players[1].id, room.players[3].id])
  );
  assert.equal(
    io.events.filter(({ event }) => event === 'rice_to_mulberry_completed').length,
    1
  );

  engine.playCards(room.players[0].id, [dealerLead.id]);
  engine.playCards(room.players[1].id, [sideKing.id]);
  engine.undoLastPlay(room.players[1].id);
  const restored = room.players[1].cards.find(value => value.id === sideKing.id);
  assert.equal(restored.rank, 'A');
  assert.equal(restored.isRiceToMulberryTransformed, true);
  assert.equal(getCardPoints(restored), 0, '撤回后仍应永久为0分');
});

test('改稻为桑的闲家Bot自动完成各自的改造份额', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  room.players[1].isBot = true;
  room.players[3].isBot = true;
  room.players[0].addCard(card('clubs', '3', 2420));
  [
    card('hearts', '5', 2421),
    card('clubs', '10', 2422),
    card('spades', 'K', 2423)
  ].forEach(value => room.players[1].addCard(value));
  room.players[2].addCard(card('clubs', '4', 2424));
  [
    card('hearts', '10', 2425),
    card('diamonds', '5', 2426),
    card('clubs', 'K', 2427),
    card('spades', '10', 2428)
  ].forEach(value => room.players[3].addCard(value));
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = CHANGE_RICE_TO_MULBERRY_RULE;
  room.gameState.trumpSuit = 'hearts';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;

  engine.setFirstPlayer(room.players[0].id);

  assert.equal(room.gameState.riceToMulberryPendingPlayerIds.size, 0);
  assert.equal(
    room.players[1].cards.filter(value => value.isRiceToMulberryTransformed).length,
    1
  );
  assert.equal(
    room.players[3].cards.filter(value => value.isRiceToMulberryTransformed).length,
    2
  );
  assert.ok(
    [...room.players[1].cards, ...room.players[3].cards]
      .filter(value => value.isRiceToMulberryTransformed)
      .every(value => getCardPoints(value) === 0)
  );
});

test('毁堤淹田在闲家赢分后先冻结计分，发动后只统计接下来的三轮', () => {
  const room = createRoom();
  const io = createIo();
  const engine = new GameEngine(room, io);
  const roundsByPlayer = [
    [card('clubs', '3', 2500), card('diamonds', '4', 2501), card('clubs', 'K', 2502), card('hearts', '4', 2503), card('spades', '3', 2516)],
    [card('clubs', 'A', 2504), card('diamonds', 'A', 2505), card('clubs', '3', 2506), card('hearts', '5', 2507), card('spades', '4', 2517)],
    [card('clubs', '5', 2508), card('diamonds', '3', 2509), card('clubs', 'A', 2510), card('hearts', '3', 2511), card('spades', '5', 2518)],
    [card('clubs', '10', 2512), card('diamonds', '10', 2513), card('clubs', '10', 2514), card('hearts', 'A', 2515), card('spades', '6', 2519)]
  ];
  roundsByPlayer.forEach((cards, playerIndex) => {
    cards.forEach(value => room.players[playerIndex].addCard(value));
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = DESTROY_DYKE_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  const playRound = roundIndex => {
    let result = null;
    for (let playIndex = 0; playIndex < 4; playIndex += 1) {
      const playerIndex = room.gameState.currentPlayerIndex;
      result = engine.playCards(
        room.players[playerIndex].id,
        [roundsByPlayer[playerIndex][roundIndex].id]
      );
    }
    return result;
  };

  const pendingRound = playRound(0);
  assert.equal(pendingRound.destroyDykeDecisionPending, true);
  assert.equal(pendingRound.destroyDykeDecision.roundPoints, 15);
  assert.equal(room.gameState.attackerScore, 0, '庄家决定前不能先把本轮分数加给闲家');
  assert.equal(room.gameState.currentRound, 1);
  assert.equal(room.gameState.currentPlayerIndex, null);
  assert.equal(room.gameState.toJSON().destroyDyke.pending.deferredFinalPlay, undefined);
  assert.throws(
    () => engine.respondDestroyDyke(room.players[2].id, true),
    /只有庄家/
  );

  const activation = engine.respondDestroyDyke(room.players[0].id, true);
  assert.equal(activation.accepted, true);
  assert.equal(activation.roundResult.roundUpdate.type, 'round_ended');
  assert.equal(room.gameState.attackerScore, 0);
  assert.deepEqual(room.gameState.destroyDykeDisaster, {
    triggerRound: 1,
    voidedPoints: 15,
    roundsElapsed: 0,
    disasterAttackerPoints: 0
  });
  assert.equal(room.gameState.currentRound, 2);

  playRound(1);
  assert.equal(room.gameState.attackerScore, 10);
  assert.equal(room.gameState.destroyDykeDisaster.roundsElapsed, 1);
  assert.equal(room.gameState.destroyDykeDisaster.disasterAttackerPoints, 10);

  playRound(2);
  assert.equal(room.gameState.attackerScore, 10, '庄家方赢得的分牌不计入灾期闲家累计');
  assert.equal(room.gameState.destroyDykeDisaster.roundsElapsed, 2);
  assert.equal(room.gameState.destroyDykeDisaster.disasterAttackerPoints, 10);

  playRound(3);
  assert.equal(room.gameState.attackerScore, 15);
  assert.equal(room.gameState.destroyDykeDisaster, null);
  assert.equal(room.gameState.destroyDykeLastResult.status, 'expired');
  assert.equal(room.gameState.destroyDykeLastResult.voidedPoints, 15);
  assert.equal(room.gameState.destroyDykeLastResult.disasterAttackerPoints, 15);
  assert.ok(
    room.gameState.collectedPointCards.every(value => ![
      roundsByPlayer[2][0].id,
      roundsByPlayer[3][0].id
    ].includes(value.id)),
    '发动轮作废的分牌不应进入闲家收分区'
  );
  assert.equal(
    io.events.filter(({ event }) => event === 'destroy_dyke_disaster_resolved').at(-1).payload.status,
    'expired'
  );
});

test('毁堤淹田灾期累计达到20分时立即事发并补回作废分与20分', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  room.gameState.selectedRule = DESTROY_DYKE_RULE;
  room.gameState.destroyDykeUsed = true;
  room.gameState.destroyDykeDisaster = {
    triggerRound: 1,
    voidedPoints: 15,
    roundsElapsed: 0,
    disasterAttackerPoints: 0
  };

  room.gameState.attackerScore += 10;
  const first = engine.advanceDestroyDykeDisasterAtRoundEnd({
    round: 2,
    winnerIsAttacker: true,
    roundPoints: 10
  });
  assert.equal(first.status, 'active');
  room.gameState.attackerScore += 10;
  const incident = engine.advanceDestroyDykeDisasterAtRoundEnd({
    round: 3,
    winnerIsAttacker: true,
    roundPoints: 10
  });

  assert.equal(incident.status, 'incident');
  assert.equal(incident.reason, 'attacker_reached_20');
  assert.equal(incident.returnedPoints, 15);
  assert.equal(incident.incidentBonus, 20);
  assert.equal(room.gameState.attackerScore, 55);
  assert.equal(room.gameState.destroyDykeDisaster, null);
});

test('毁堤淹田发动轮即结束牌局时按提前结束事发', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const hands = [
    card('clubs', '3', 2520),
    card('clubs', 'A', 2521),
    card('clubs', '5', 2522),
    card('clubs', '10', 2523)
  ];
  hands.forEach((value, playerIndex) => room.players[playerIndex].addCard(value));
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = DESTROY_DYKE_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);
  hands.forEach((value, playerIndex) => {
    engine.playCards(room.players[playerIndex].id, [value.id]);
  });

  const response = engine.respondDestroyDyke(room.players[0].id, true);
  assert.equal(response.roundResult.gameFinished, true);
  assert.equal(room.gameState.destroyDykeLastResult.status, 'incident');
  assert.equal(room.gameState.destroyDykeLastResult.reason, 'game_ended_early');
  assert.equal(room.gameState.destroyDykeLastResult.returnedPoints, 15);
  assert.equal(room.gameState.attackerScore, 35);
  assert.equal(room.gameState.bottomScoreResult.destroyDyke.scoreDelta, 35);
});

test('毁堤淹田第三个灾期轮恰好结束牌局时闲家拿底仍然事发', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const hands = [
    card('clubs', '3', 2524),
    card('clubs', 'A', 2525),
    card('clubs', '5', 2526),
    card('clubs', '10', 2527)
  ];
  hands.forEach((value, playerIndex) => room.players[playerIndex].addCard(value));
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = DESTROY_DYKE_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  room.gameState.bottomCards = [card('diamonds', 'K', 2528)];
  room.gameState.destroyDykeUsed = true;
  room.gameState.destroyDykeDisaster = {
    triggerRound: 1,
    voidedPoints: 15,
    roundsElapsed: 2,
    disasterAttackerPoints: 0
  };
  engine.setFirstPlayer(room.players[0].id);
  room.gameState.currentRound = 4;

  let result = null;
  hands.forEach((value, playerIndex) => {
    result = engine.playCards(room.players[playerIndex].id, [value.id]);
  });

  assert.equal(result.gameFinished, true);
  assert.equal(room.gameState.destroyDykeLastResult.status, 'incident');
  assert.equal(room.gameState.destroyDykeLastResult.reason, 'attacker_won_bottom');
  assert.equal(room.gameState.destroyDykeLastResult.returnedPoints, 15);
  assert.equal(room.gameState.destroyDykeLastResult.incidentBonus, 20);
  assert.equal(room.gameState.bottomScoreResult.attackerWonBottom, true);
  assert.equal(room.gameState.bottomScoreResult.bottomScoreGained, 20);
  assert.equal(room.gameState.bottomScoreResult.destroyDyke.scoreDelta, 35);
  assert.equal(room.gameState.attackerScore, 70);
});

test('毁堤淹田本轮不发动时正常计分且保留后续机会', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const hands = [
    [card('clubs', '3', 2530), card('diamonds', '3', 2531)],
    [card('clubs', 'A', 2532), card('diamonds', 'A', 2533)],
    [card('clubs', '5', 2534), card('diamonds', '5', 2535)],
    [card('clubs', '10', 2536), card('diamonds', '10', 2537)]
  ];
  hands.forEach((cards, playerIndex) => cards.forEach(value => room.players[playerIndex].addCard(value)));
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = DESTROY_DYKE_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);
  hands.forEach((cards, playerIndex) => engine.playCards(room.players[playerIndex].id, [cards[0].id]));

  const declined = engine.respondDestroyDyke(room.players[0].id, false);
  assert.equal(declined.accepted, false);
  assert.equal(room.gameState.attackerScore, 15);
  assert.equal(room.gameState.destroyDykeUsed, false);
  assert.equal(room.gameState.destroyDykeDisaster, null);
  assert.equal(room.gameState.destroyDykeLastResult.status, 'declined');
});

test('毁堤淹田在闲家赢得零分轮后也保留规则写明的发动窗口', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const hands = [
    [card('clubs', '3', 2540), card('diamonds', '3', 2541)],
    [card('clubs', 'A', 2542), card('diamonds', 'A', 2543)],
    [card('clubs', '4', 2544), card('diamonds', '4', 2545)],
    [card('clubs', '6', 2546), card('diamonds', '6', 2547)]
  ];
  hands.forEach((cards, playerIndex) => cards.forEach(value => room.players[playerIndex].addCard(value)));
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = DESTROY_DYKE_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);
  let result = null;
  hands.forEach((cards, playerIndex) => {
    result = engine.playCards(room.players[playerIndex].id, [cards[0].id]);
  });

  assert.equal(result.destroyDykeDecisionPending, true);
  assert.equal(result.destroyDykeDecision.roundPoints, 0);
  engine.respondDestroyDyke(room.players[0].id, false);
  assert.equal(room.gameState.destroyDykeUsed, false);
});

test('记录在案由每轮分牌独立触发下一轮，并在连续有分时逐轮续期', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const roundsByPlayer = [
    [
      card('hearts', '5', 0),
      card('clubs', '3', 2600),
      card('diamonds', '10', 2601),
      card('spades', 'K', 2602),
      card('clubs', '8', 2603)
    ],
    [
      card('hearts', '5', 1),
      card('clubs', '4', 2610),
      card('diamonds', '3', 2611),
      card('spades', '3', 2612),
      card('clubs', '9', 2613)
    ],
    [
      card('hearts', '6', 2620),
      card('clubs', '6', 2621),
      card('diamonds', '4', 2622),
      card('spades', '4', 2623),
      card('clubs', 'J', 2624)
    ],
    [
      card('hearts', 'A', 2630),
      card('clubs', '7', 2631),
      card('diamonds', 'A', 2632),
      card('spades', 'A', 2633),
      card('clubs', 'Q', 2634)
    ]
  ];
  roundsByPlayer.forEach((cards, playerIndex) => {
    cards.forEach(value => room.players[playerIndex].addCard(value));
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = RECORD_ON_FILE_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  const playRound = roundIndex => {
    let result = null;
    for (let playIndex = 0; playIndex < room.players.length; playIndex++) {
      const playerIndex = room.gameState.currentPlayerIndex;
      const player = room.players[playerIndex];
      result = engine.playCards(player.id, [roundsByPlayer[playerIndex][roundIndex].id]);
    }
    return result;
  };

  const first = playRound(0);
  assert.deepEqual(first.roundUpdate.recordOnFile, {
    completedRound: 1,
    wasActive: false,
    hadPointCards: true,
    hadLevelOrJoker: false,
    nextActiveRound: 2
  });
  assert.equal(room.gameState.recordOnFileActiveRound, 2);
  assert.equal(room.gameState.toJSON().recordOnFile.counts.hearts['5'], 2);

  const second = playRound(1);
  assert.equal(second.roundUpdate.recordOnFile.hadPointCards, false);
  assert.equal(room.gameState.recordOnFileActiveRound, null);
  assert.equal(room.gameState.recordOnFileLastActiveRound, 2);

  const third = playRound(2);
  assert.equal(third.roundUpdate.recordOnFile.nextActiveRound, 4);
  assert.equal(room.gameState.recordOnFileActiveRound, 4);
  assert.equal(room.gameState.recordOnFileLastActiveRound, null);

  const fourth = playRound(3);
  assert.equal(fourth.roundUpdate.recordOnFile.wasActive, true);
  assert.equal(fourth.roundUpdate.recordOnFile.nextActiveRound, 5);
  assert.equal(room.gameState.recordOnFileActiveRound, 5);
  assert.equal(room.gameState.recordOnFileLastActiveRound, 4);
});

test('记录在案不会通过记牌器提前泄露本轮尚未揭晓的暗置牌', () => {
  const room = createRoom();
  const publicCard = card('hearts', '5', 2640);
  const concealedCard = card('spades', 'A', 2641);
  room.gameState.selectedRule = {
    id: 'double_happiness',
    rules: [RECORD_ON_FILE_RULE, NO_ONE_SURVIVES_RULE]
  };
  room.gameState.currentRound = 2;
  room.gameState.recordOnFileActiveRound = 2;
  room.gameState.playHistory = [
    { round: 2, concealed: false, cards: [publicCard.toJSON()] },
    { round: 2, concealed: true, cards: [concealedCard.toJSON()] }
  ];
  room.gameState.currentRoundPlays = [
    { concealed: false, cards: [publicCard] },
    { concealed: true, cards: [concealedCard] }
  ];

  const hiddenState = room.gameState.toJSON().recordOnFile;
  assert.equal(hiddenState.playedCardCount, 1);
  assert.equal(hiddenState.counts.hearts['5'], 1);
  assert.equal(hiddenState.counts.spades.A, undefined);

  room.gameState.currentRoundPlays = [];
  const revealedState = room.gameState.toJSON().recordOnFile;
  assert.equal(revealedState.playedCardCount, 2);
  assert.equal(revealedState.counts.spades.A, 1);
});

test('记录在案在零分轮出现当前级牌或王牌时也会触发下一轮', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const roundsByPlayer = [
    [
      card('clubs', '2', 2650),
      card('joker', 'small_joker', 0),
      card('diamonds', '3', 2651)
    ],
    [
      card('hearts', '2', 2660),
      card('joker', 'small_joker', 1),
      card('diamonds', '4', 2661)
    ],
    [
      card('diamonds', '2', 2670),
      card('joker', 'big_joker', 0),
      card('diamonds', '6', 2671)
    ],
    [
      card('spades', '2', 2680),
      card('joker', 'big_joker', 1),
      card('diamonds', '7', 2681)
    ]
  ];
  roundsByPlayer.forEach((cards, playerIndex) => {
    cards.forEach(value => room.players[playerIndex].addCard(value));
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = RECORD_ON_FILE_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  engine.setFirstPlayer(room.players[0].id);

  const playRound = roundIndex => {
    let result = null;
    for (let playIndex = 0; playIndex < room.players.length; playIndex++) {
      const playerIndex = room.gameState.currentPlayerIndex;
      const player = room.players[playerIndex];
      result = engine.playCards(player.id, [roundsByPlayer[playerIndex][roundIndex].id]);
    }
    return result;
  };

  const levelRound = playRound(0);
  assert.equal(levelRound.roundUpdate.scoreInfo.roundPoints, 0);
  assert.equal(levelRound.roundUpdate.recordOnFile.hadPointCards, false);
  assert.equal(levelRound.roundUpdate.recordOnFile.hadLevelOrJoker, true);
  assert.equal(levelRound.roundUpdate.recordOnFile.nextActiveRound, 2);

  const jokerRound = playRound(1);
  assert.equal(jokerRound.roundUpdate.scoreInfo.roundPoints, 0);
  assert.equal(jokerRound.roundUpdate.recordOnFile.hadPointCards, false);
  assert.equal(jokerRound.roundUpdate.recordOnFile.hadLevelOrJoker, true);
  assert.equal(jokerRound.roundUpdate.recordOnFile.nextActiveRound, 3);
});

function playWeighingThousandJinRound(plays) {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  plays.forEach((cards, playerIndex) => {
    cards.forEach(value => room.players[playerIndex].addCard(value));
    room.players[playerIndex].addCard(
      card('clubs', String(playerIndex + 3), 2700 + playerIndex)
    );
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = WEIGHING_THOUSAND_JIN_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[0].id;
  room.gameState.dealerPlayerIndex = 0;
  engine.setFirstPlayer(room.players[0].id);

  let result = null;
  plays.forEach((cards, playerIndex) => {
    result = engine.playCards(
      room.players[playerIndex].id,
      cards.map(value => value.id)
    );
  });
  return { room, result };
}

test('上称千斤在庄家压过至少一名闲家时逐张减5分', () => {
  const { room, result } = playWeighingThousandJinRound([
    [card('hearts', 'Q', 0), card('hearts', 'Q', 1)],
    [card('hearts', 'J', 0), card('hearts', 'J', 1)],
    [card('hearts', '10', 0), card('hearts', '10', 1)],
    [card('hearts', 'A', 0), card('hearts', 'A', 1)]
  ]);
  const scoring = result.roundUpdate.scoreInfo.weighingThousandJin;

  assert.equal(result.roundUpdate.scoreInfo.winnerIsAttacker, true);
  assert.equal(scoring.mode, 'subtract_five');
  assert.equal(scoring.dealerRank, 2);
  assert.equal(scoring.outrankedAttackerCount, 1);
  assert.equal(scoring.originalRoundPoints, 20);
  assert.equal(scoring.adjustedRoundPoints, 10);
  assert.equal(result.roundUpdate.scoreInfo.baseRoundPoints, 10);
  assert.equal(result.roundUpdate.scoreInfo.roundPoints, 10);
  assert.equal(result.roundUpdate.scoreInfo.roundPointCards.length, 2);
  assert.equal(room.gameState.attackerScore, 10);
});

test('上称千斤在庄家未压过任一闲家时逐张翻倍', () => {
  const { room, result } = playWeighingThousandJinRound([
    [card('hearts', 'J', 10)],
    [card('hearts', 'Q', 10)],
    [card('hearts', 'K', 10)],
    [card('hearts', 'A', 10)]
  ]);
  const scoring = result.roundUpdate.scoreInfo.weighingThousandJin;

  assert.equal(result.roundUpdate.scoreInfo.winnerIsAttacker, true);
  assert.equal(scoring.mode, 'double');
  assert.equal(scoring.dealerRank, 4);
  assert.equal(scoring.outrankedAttackerCount, 0);
  assert.equal(scoring.originalRoundPoints, 10);
  assert.equal(scoring.adjustedRoundPoints, 20);
  assert.equal(result.roundUpdate.scoreInfo.roundPoints, 20);
  assert.equal(room.gameState.attackerScore, 20);
});

test('上称千斤沿用力争上游完全相同时后出者更小的顺序', () => {
  const { result } = playWeighingThousandJinRound([
    [card('hearts', 'J', 20)],
    [card('hearts', 'J', 21)],
    [card('hearts', 'K', 20)],
    [card('hearts', 'A', 20)]
  ]);
  const scoring = result.roundUpdate.scoreInfo.weighingThousandJin;
  const tiedAttacker = scoring.attackerComparisons.find(
    comparison => comparison.playerIndex === 1
  );

  assert.equal(scoring.mode, 'subtract_five');
  assert.equal(scoring.outrankedAttackerCount, 1);
  assert.equal(tiedAttacker.dealerOutranks, true);
  assert.equal(scoring.originalRoundPoints, 10);
  assert.equal(scoring.adjustedRoundPoints, 5);
});

function playFearOfBreakingVaseRound(plays, {
  dealerIndex = 0,
  startingScore = 0
} = {}) {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  plays.forEach((cards, playerIndex) => {
    cards.forEach(value => room.players[playerIndex].addCard(value));
    room.players[playerIndex].addCard(
      card('clubs', String(playerIndex + 3), 2800 + playerIndex)
    );
  });
  room.gameState.phase = GamePhases.PLAYING;
  room.gameState.selectedRule = FEAR_OF_BREAKING_VASE_RULE;
  room.gameState.trumpSuit = 'spades';
  room.gameState.trumpRank = '2';
  room.gameState.buryingPlayerId = room.players[dealerIndex].id;
  room.gameState.dealerPlayerIndex = dealerIndex;
  room.gameState.attackerScore = startingScore;
  engine.setFirstPlayer(room.players[0].id);

  let result = null;
  plays.forEach((cards, playerIndex) => {
    result = engine.playCards(
      room.players[playerIndex].id,
      cards.map(value => value.id)
    );
  });
  return { room, engine, result };
}

test('投鼠忌器：首家最大且队友打出至少两对时，赢家庄家方失去10分', () => {
  const { room, result } = playFearOfBreakingVaseRound([
    [
      card('hearts', 'A', 0), card('hearts', 'A', 1),
      card('hearts', 'K', 0), card('hearts', 'K', 1)
    ],
    [
      card('hearts', '10', 0), card('hearts', '10', 1),
      card('hearts', '9', 0), card('hearts', '9', 1)
    ],
    [
      card('hearts', 'Q', 0), card('hearts', 'Q', 1),
      card('hearts', 'J', 0), card('hearts', 'J', 1)
    ],
    [
      card('hearts', '8', 0), card('hearts', '8', 1),
      card('hearts', '7', 0), card('hearts', '7', 1)
    ]
  ]);
  const penalty = result.roundUpdate.scoreInfo.fearOfBreakingVase;

  assert.equal(penalty.winnerPlayerIndex, 0);
  assert.equal(penalty.triggerType, 'leader_over_protected_teammate');
  assert.equal(penalty.vesselPlayerId, room.players[2].id);
  assert.equal(penalty.pairCount, 2);
  assert.equal(penalty.penalizedSide, 'dealer');
  assert.equal(penalty.scoreDelta, 10);
  assert.equal(room.gameState.attackerScore, 10);
});

test('投鼠忌器：第二家唯一毙牌且队友本为其余三家最大时，赢家闲家方失去10分', () => {
  const { room, result } = playFearOfBreakingVaseRound([
    [card('hearts', 'Q', 10)],
    [card('spades', '3', 10)],
    [card('hearts', 'J', 10)],
    [card('hearts', 'A', 10)]
  ]);
  const penalty = result.roundUpdate.scoreInfo.fearOfBreakingVase;

  assert.equal(penalty.winnerPlayerIndex, 1);
  assert.equal(penalty.triggerType, 'sole_second_ruff_over_teammate');
  assert.equal(penalty.vesselPlayerId, room.players[3].id);
  assert.equal(penalty.penalizedSide, 'attacker');
  assert.equal(penalty.scoreDelta, -10);
  assert.equal(room.gameState.attackerScore, -10);
});

test('投鼠忌器：第二家唯一毙牌但队友并非其余三家最大时不扣分', () => {
  const { room, result } = playFearOfBreakingVaseRound([
    [card('hearts', 'Q', 20)],
    [card('spades', '3', 20)],
    [card('hearts', 'A', 20)],
    [card('hearts', 'J', 20)]
  ]);

  assert.equal(room.gameState.lastRoundWinnerIndex, 1);
  assert.equal(result.roundUpdate.scoreInfo.fearOfBreakingVase, null);
  assert.equal(room.gameState.attackerScore, 0);
});

test('投鼠忌器按实体牌面统计两对，并将任意两张王视为“器”', () => {
  const room = createRoom();
  const engine = new GameEngine(room, createIo());
  const twoPairs = engine.getFearOfBreakingVaseProtectedCards({
    cards: [
      card('hearts', '9', 30), card('hearts', '9', 31),
      card('clubs', 'A', 30), card('clubs', 'A', 31)
    ]
  });
  const twoJokers = engine.getFearOfBreakingVaseProtectedCards({
    cards: [
      card('joker', Ranks.SMALL_JOKER, 30),
      card('joker', Ranks.BIG_JOKER, 30)
    ]
  });
  const onePair = engine.getFearOfBreakingVaseProtectedCards({
    cards: [
      card('diamonds', '7', 30),
      card('diamonds', '7', 31),
      card('spades', 'K', 30)
    ]
  });

  assert.deepEqual(twoPairs, { pairCount: 2, jokerCount: 0, qualifies: true });
  assert.deepEqual(twoJokers, { pairCount: 0, jokerCount: 2, qualifies: true });
  assert.deepEqual(onePair, { pairCount: 1, jokerCount: 0, qualifies: false });
});
