import { useState, useEffect, useMemo, useRef } from 'react';
import { Button, Space, Typography, Modal, Select, InputNumber, Input, message, Divider, Tag } from 'antd';
import { useGameStore } from '../../store/gameStore';
import socketService from '../../services/socket';
import { SOCKET_EVENTS, GamePhases } from '../../utils/constants';
import {
  detectAvailableDeclarations,
  detectThreeSixNineDeclarations
} from '../../utils/trumpUtils';
import {
  calculateMustPlayCards,
  demoteForbiddenMagicHand,
  getClusterAnalysisTargetRanks,
  isTrumpCard
} from '../../utils/cardPatternUtils';
import {
  canPlayerViewBottomCards,
  getActiveBuryingPlayerId,
  getActiveSkillAvailability,
  getFinalTrickAutoSelectedCardIds,
  getPlayActionLabel,
  getRuleDisabledCardIds,
  getRuleDisabledCardReason,
  isBurySelectionValid,
  isCurrentPlayersTurn,
  mapOneCountryCardsForCurrentPlayer,
  validatePlaySelection
} from '../../utils/actionAvailability';
import { calculateCardPoints, getCardPoints, getMeticulousAccountingCardPoints } from '../../utils/scoringUtils';
import {
  formatLevel,
  getCanonicalOpenHandCards,
  getPendingPoliticalReviewDecision,
  getRuleSelectionAccess,
  getThrowFailedPreview,
  mergeTransferredHandCards,
  mergeLivePlayerCardCounts,
  THROW_FAILED_PREVIEW_DURATION_MS
} from '../../utils/gameViewUtils';
import { ruleIncludesId } from '../../utils/ruleCatalog';
import { sortCards } from '../../utils/cardUtils';
import Hand from './Hand';
import Card from './Card';
import GameTable from './GameTable';
import RuleSelector from './RuleSelector';
import TrumpDeclaration from './TrumpDeclaration';
import './GameBoard.css';

const { Title, Text } = Typography;
const EFFECTIVE_SUIT_LABELS = Object.freeze({
  hearts: '♥ 红桃',
  diamonds: '♦ 方片',
  clubs: '♣ 梅花',
  spades: '♠ 黑桃',
  trump: '★ 主'
});
const TRANSFORMATION_SUITS = Object.freeze([
  { value: 'hearts', label: '♥ 红桃' },
  { value: 'diamonds', label: '♦ 方片' },
  { value: 'clubs', label: '♣ 梅花' },
  { value: 'spades', label: '♠ 黑桃' }
]);
const TRANSFORMATION_RANKS = Object.freeze([
  '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'
]);
const INVITE_INTO_URN_SUITS = Object.freeze([
  ...TRANSFORMATION_SUITS,
  { value: 'joker', label: '🃏 王' }
]);
const INVITE_INTO_URN_JOKER_RANKS = Object.freeze([
  { value: 'small_joker', label: '小王' },
  { value: 'big_joker', label: '大王' },
  { value: 'white_joker', label: '白王（皇）' }
]);
const CARD_SUIT_SYMBOLS = Object.freeze({
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠'
});
const formatPublicCard = card => {
  if (!card) return '未知牌';
  if (card.rank === 'small_joker') return '小王';
  if (card.rank === 'big_joker') return '大王';
  if (card.rank === 'county_prince_joker') return '郡王';
  if (card.rank === 'prince_joker') return '亲王';
  if (card.rank === 'white_joker') return '白王（皇）';
  return `${CARD_SUIT_SYMBOLS[card.suit] || ''}${card.rank}`;
};

export default function GameBoard({ onLeaveRoom }) {
  const {
    currentRoom,
    currentPlayer,
    myCards,
    selectedCards,
    toggleCardSelection,
    clearSelection,
    setSelectedCards,
    setMyCards,
    addCard,
    removeCards,
    reorderCards,
    setTrumpInfo
  } = useGameStore();

  const [messageApi, contextHolder] = message.useMessage();
  const [modalApi, modalContextHolder] = Modal.useModal();
  const [buryingPlayerModal, setBuryingPlayerModal] = useState(false);
  const [firstPlayerModal, setFirstPlayerModal] = useState(false);
  const [selectedBuryingPlayer, setSelectedBuryingPlayer] = useState(null);
  const [selectedFirstPlayer, setSelectedFirstPlayer] = useState(null);
  const [scoreAdjustModal, setScoreAdjustModal] = useState(false);
  const [levelAdjustModal, setLevelAdjustModal] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [adjustValue, setAdjustValue] = useState(0);
  const [viewBottomModal, setViewBottomModal] = useState(false);
  const [shownCards, setShownCards] = useState({}); // { [playerId]: { playerName, cards } }
  const [playedCards, setPlayedCards] = useState({}); // { [playerId]: { playerName, cards } }
  const [throwFailedPreviews, setThrowFailedPreviews] = useState({});
  const [playHistory, setPlayHistory] = useState([]); // 出牌历史记录 [{ playerId, playerName, timestamp }, ...]
  const [revealedBottomCards, setRevealedBottomCards] = useState([]); // 终局展示的底牌
  const [publicBottomCards, setPublicBottomCards] = useState([]); // “昭然若揭”发牌开始即公开的底牌
  const [myBottomCards, setMyBottomCards] = useState([]); // 查看底牌弹窗中的牌
  const [trumpSuit, setTrumpSuit] = useState(null); // 主牌花色
  const [trumpRank, setTrumpRank] = useState(null); // 主牌点数
  const [roomConfigModal, setRoomConfigModal] = useState(false); // 房间设置弹窗
  const [newDealInterval, setNewDealInterval] = useState(500); // 新的发牌间隔
  const [newBotType, setNewBotType] = useState('who_designed');
  const [renameModal, setRenameModal] = useState(false); // 修改昵称弹窗
  const [newPlayerName, setNewPlayerName] = useState(''); // 新昵称
  const [chatModal, setChatModal] = useState(false); // 聊天弹窗
  const [chatMessage, setChatMessage] = useState(''); // 当前输入的聊天消息
  const [chatHistory, setChatHistory] = useState([]); // 聊天历史
  const [quickPhrases, setQuickPhrases] = useState(() => {
    // 从localStorage加载快捷短语
    const saved = localStorage.getItem('tractorQuickPhrases');
    return saved ? JSON.parse(saved) : ['快点出牌！', '好牌！', '加油！'];
  });
  const [quickPhraseModal, setQuickPhraseModal] = useState(false); // 快捷短语管理弹窗
  const [newQuickPhrase, setNewQuickPhrase] = useState(''); // 新的快捷短语输入
  const [ruleSelectorModal, setRuleSelectorModal] = useState(false); // 规则选择器弹窗
  const [selectedRule, setSelectedRule] = useState(null); // 当前选择的规则 { name, content }
  const [availableDeclarations, setAvailableDeclarations] = useState([]); // 可用的亮主选项
  const [currentTrumpDeclaration, setCurrentTrumpDeclaration] = useState(null); // 当前主牌亮主信息
  const [currentInferiorDeclaration, setCurrentInferiorDeclaration] = useState(null);
  const [threeSixNineState, setThreeSixNineState] = useState(null);
  const [oneCountryTwoSystemsState, setOneCountryTwoSystemsState] = useState(null);
  const [woodenOxDecision, setWoodenOxDecision] = useState(null);
  const [woodenOxPrivateState, setWoodenOxPrivateState] = useState(null);
  const [woodenOxSelectedCardId, setWoodenOxSelectedCardId] = useState(null);
  const [dealerCountdown, setDealerCountdown] = useState(null); // 庄家倒计时
  const [trumpAnimation, setTrumpAnimation] = useState(null); // 毙牌局部动画：攻击者标签 + 被压牌打击点
  const [cardExchangeAnimation, setCardExchangeAnimation] = useState(null);
  const [privateCardTransferReveal, setPrivateCardTransferReveal] = useState(null);
  const [bottomPickup, setBottomPickup] = useState(null);
  const [handArrivalHighlight, setHandArrivalHighlight] = useState(null);
  const [ruleVisibleHands, setRuleVisibleHands] = useState([]);
  const [icebergSelection, setIcebergSelection] = useState(null);
  const [tenSidedAmbushSelection, setTenSidedAmbushSelection] = useState(null);
  const [selectedTenSidedAmbushRank, setSelectedTenSidedAmbushRank] = useState(null);
  const [tenSidedAmbushPrivateRank, setTenSidedAmbushPrivateRank] = useState(null);
  const [tenSidedAmbushRevealAnimation, setTenSidedAmbushRevealAnimation] = useState(null);
  const [waitingRabbitSelection, setWaitingRabbitSelection] = useState(null);
  const [selectedWaitingRabbitSuit, setSelectedWaitingRabbitSuit] = useState(null);
  const [selectedWaitingRabbitRank, setSelectedWaitingRabbitRank] = useState(null);
  const [waitingRabbitPrivateTarget, setWaitingRabbitPrivateTarget] = useState(null);
  const [waitingRabbitDecision, setWaitingRabbitDecision] = useState(null);
  const [waitingRabbitDiscardCardId, setWaitingRabbitDiscardCardId] = useState(null);
  const [threePowersSelection, setThreePowersSelection] = useState(null);
  const [selectedThreePowersRank, setSelectedThreePowersRank] = useState(null);
  const [threePowersPrivateRanks, setThreePowersPrivateRanks] = useState({});
  const [threePowersRevealAnimation, setThreePowersRevealAnimation] = useState(null);
  const [gentlemanPromiseSelection, setGentlemanPromiseSelection] = useState(null);
  const [selectedGentlemanPromiseSuit, setSelectedGentlemanPromiseSuit] = useState(null);
  const [hiddenDragonSelection, setHiddenDragonSelection] = useState(null);
  const [selectedHiddenDragonRank, setSelectedHiddenDragonRank] = useState(null);
  const [antinomySelection, setAntinomySelection] = useState(null);
  const [selectedAntinomySuit, setSelectedAntinomySuit] = useState(null);
  const [selectedAntinomyRank, setSelectedAntinomyRank] = useState(null);
  const [riceToMulberrySelection, setRiceToMulberrySelection] = useState(null);
  const [selectedRiceToMulberryCardIds, setSelectedRiceToMulberryCardIds] = useState([]);
  const [destroyDykeDecision, setDestroyDykeDecision] = useState(null);
  const [administrativeReviewSelection, setAdministrativeReviewSelection] = useState(null);
  const [selectedAdministrativeReviewValue, setSelectedAdministrativeReviewValue] = useState(null);
  const [politicalReviewDecision, setPoliticalReviewDecision] = useState(null);
  const [focusFigureVote, setFocusFigureVote] = useState(null);
  const [focusFigurePrivate, setFocusFigurePrivate] = useState(null);
  const [armedActiveSkillId, setArmedActiveSkillId] = useState(null);
  const [explicitCardTransformations, setExplicitCardTransformations] = useState({});
  const [cardTransformationDialog, setCardTransformationDialog] = useState(null);
  const [selectedDivineWeaponCardId, setSelectedDivineWeaponCardId] = useState(null);
  const [divineWeaponSourceCardId, setDivineWeaponSourceCardId] = useState(null);
  const [activeSkillAnimation, setActiveSkillAnimation] = useState(null);
  const [lastStandDecision, setLastStandDecision] = useState(null);
  const [teammateCheerDecision, setTeammateCheerDecision] = useState(null);
  const [afterglowDecision, setAfterglowDecision] = useState(null);
  const [removeFirewoodDecision, setRemoveFirewoodDecision] = useState(null);
  const [mainstaySelectedCardIds, setMainstaySelectedCardIds] = useState([]);
  const [ambiguousFirstOptionCardIds, setAmbiguousFirstOptionCardIds] = useState([]);
  const [ambiguousChoice, setAmbiguousChoice] = useState(null);
  const [lateMoverDecisionOpen, setLateMoverDecisionOpen] = useState(false);
  const [bushGateDecisionOpen, setBushGateDecisionOpen] = useState(false);
  const [timeReversalDecision, setTimeReversalDecision] = useState(null);
  const [surrenderDecision, setSurrenderDecision] = useState(null);
  const [forbiddenMagicDecision, setForbiddenMagicDecision] = useState(null);
  const [lureTigerDecision, setLureTigerDecision] = useState(null);
  const [equivalentReciprocityTarget, setEquivalentReciprocityTarget] = useState(null);
  const [equivalentReciprocitySelection, setEquivalentReciprocitySelection] = useState(null);
  const [equivalentReciprocityCardId, setEquivalentReciprocityCardId] = useState(null);
  const [equivalentReciprocityResult, setEquivalentReciprocityResult] = useState(null);
  const [mutualSupportDirectionOpen, setMutualSupportDirectionOpen] = useState(false);
  const [mutualSupportSelection, setMutualSupportSelection] = useState(null);
  const [mutualSupportSelectedCardIds, setMutualSupportSelectedCardIds] = useState([]);
  const [strawBoatDecision, setStrawBoatDecision] = useState(null);
  const [strawBoatDiscardCardId, setStrawBoatDiscardCardId] = useState(null);
  const [culturalRevolutionSelection, setCulturalRevolutionSelection] = useState(null);
  const [inviteIntoUrnSelection, setInviteIntoUrnSelection] = useState(null);
  const [magicTrickTargetIds, setMagicTrickTargetIds] = useState([]);
  const [magicTrickPreparedRound, setMagicTrickPreparedRound] = useState(null);
  const [attackerScore, setAttackerScore] = useState(0); // 闲家当前得分
  const [collectedPointCards, setCollectedPointCards] = useState([]); // 闲家收集的分数牌
  const [bottomScoreResult, setBottomScoreResult] = useState(null); // 底牌得分结果
  const [upgradeResult, setUpgradeResult] = useState(null); // 升级结果
  const [isReadyForNext, setIsReadyForNext] = useState(false); // 是否已准备下一局
  const [justPlayedCards, setJustPlayedCards] = useState(false); // 标记是否刚刚出过牌
  const [lastRoundPlayedCards, setLastRoundPlayedCards] = useState({}); // 上一轮的出牌信息
  const [livePlayerCardCounts, setLivePlayerCardCounts] = useState({}); // 发牌中的实时手牌数
  const [currentWinningPlayerId, setCurrentWinningPlayerId] = useState(null);
  const [lastRoundWinnerPlayerId, setLastRoundWinnerPlayerId] = useState(null);
  const [viewingLastRound, setViewingLastRound] = useState(false); // 是否正在查看上轮
  const [lastRoundTimer, setLastRoundTimer] = useState(null); // 查看上轮的定时器
  const [isHoldingCompletedRound, setIsHoldingCompletedRound] = useState(false);
  const [heldCompletedRoundNumber, setHeldCompletedRoundNumber] = useState(null);
  // Socket 轮末事件中同步写入；不等 React state 提交，避免 room_updated
  // 的下轮烛态在中央计分或右上状态中抢先闪现。
  const heldCompletedRoundNumberRef = useRef(null);
  const playedCardsRef = useRef({});
  const pendingOwnConcealedCardsRef = useRef(new Map());
  const throwFailedPreviewTimersRef = useRef(new Map());
  const roundClearTimerRef = useRef(null);
  const awaitingRoundClearRef = useRef(false);
  const exchangeAnimationTimerRef = useRef(null);
  const exchangeHandUpdateTimerRef = useRef(null);
  const privateCardRevealTimerRef = useRef(null);
  const bottomCardsMergeTimerRef = useRef(null);
  const handArrivalHighlightTimerRef = useRef(null);
  const exchangeAnimationEndsAtRef = useRef(0);
  const tenSidedAmbushAnimationTimerRef = useRef(null);
  const threePowersAnimationTimerRef = useRef(null);
  const activeSkillAnimationTimerRef = useRef(null);
  const exchangeAnimationDurationRef = useRef(2200);
  const equivalentReciprocityTimerRef = useRef(null);
  const politicalReviewApprovalSubmittingRef = useRef(new Set());

  const clearCardTransitionTimers = () => {
    [
      exchangeAnimationTimerRef,
      exchangeHandUpdateTimerRef,
      privateCardRevealTimerRef,
      bottomCardsMergeTimerRef,
      handArrivalHighlightTimerRef
    ].forEach(timerRef => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    });
    exchangeAnimationEndsAtRef.current = 0;
  };

  const socket = socketService.socket;
  const isHost = currentPlayer?.socketId === currentRoom?.hostId;
  const gameState = currentRoom?.gameState;
  const surrenderState = gameState?.surrender || null;
  const hasRequestedSurrender = Boolean(
    surrenderState?.requestedPlayerIds?.includes(currentPlayer?.id)
    || surrenderState?.currentDecision?.initiatorPlayerId === currentPlayer?.id
    || surrenderState?.queuedPlayerIds?.includes(currentPlayer?.id)
  );
  const isSurrenderFeatureVisible = Boolean(
    [GamePhases.DRAWING, GamePhases.BURYING, GamePhases.PLAYING].includes(gameState?.phase)
    && !ruleIncludesId(gameState?.selectedRule, 'burn_the_boats')
  );
  const canRequestSurrender = Boolean(
    currentRoom
    && currentPlayer
    && isSurrenderFeatureVisible
    && !surrenderState?.currentDecision
    && !(surrenderState?.queuedPlayerIds?.length > 0)
  );
  const waitingRabbitState = gameState?.waitingRabbit || null;
  const mainstayAction = gameState?.mainstay?.currentAction || null;
  const ownMainstayAction = mainstayAction?.chooserPlayerId === currentPlayer?.id
    ? mainstayAction
    : null;
  useEffect(() => {
    if (!ownMainstayAction || ownMainstayAction.stage === 'decision') {
      setMainstaySelectedCardIds([]);
      return;
    }
    if (ownMainstayAction.stage === 'give') {
      setMainstaySelectedCardIds(
        myCards
          .filter(card => isTrumpCard(card, gameState?.trumpSuit, gameState?.trumpRank))
          .map(card => card.id)
      );
      return;
    }
    setMainstaySelectedCardIds([]);
  }, [
    ownMainstayAction?.id,
    ownMainstayAction?.stage,
    ownMainstayAction?.chooserPlayerId,
    currentPlayer?.id,
    gameState?.trumpSuit,
    gameState?.trumpRank,
    myCards
  ]);
  useEffect(() => {
    const pending = surrenderState?.currentDecision;
    if (pending?.teammatePlayerId === currentPlayer?.id) {
      setSurrenderDecision(pending);
    } else if (!pending) {
      setSurrenderDecision(null);
    }
  }, [
    surrenderState?.currentDecision?.id,
    surrenderState?.currentDecision?.teammatePlayerId,
    currentPlayer?.id
  ]);
  // 刷新或断线重连时，从冻结中的公共状态恢复不可关闭的交互框。
  useEffect(() => {
    if (waitingRabbitState?.pendingSelectionPlayerIds?.includes(currentPlayer?.id)) {
      setWaitingRabbitSelection(previous => previous || {
        eligibleSuits: TRANSFORMATION_SUITS.map(option => option.value),
        eligibleRanks: TRANSFORMATION_RANKS.filter(rank => rank !== gameState?.trumpRank),
        trumpRank: gameState?.trumpRank
      });
    }

    const pendingDecision = waitingRabbitState?.pendingDecision;
    if (pendingDecision?.chooserPlayerId === currentPlayer?.id) {
      setWaitingRabbitDecision({
        ...pendingDecision,
        eligibleDiscardCardIds: myCards
          .filter(card => getCardPoints(card) === 0)
          .map(card => card.id)
      });
    } else if (!pendingDecision) {
      setWaitingRabbitDecision(null);
      setWaitingRabbitDiscardCardId(null);
    }
  }, [
    waitingRabbitState?.pendingSelectionPlayerIds,
    waitingRabbitState?.pendingDecision?.id,
    waitingRabbitState?.pendingDecision?.chooserPlayerId,
    currentPlayer?.id,
    gameState?.trumpRank,
    myCards
  ]);
  useEffect(() => {
    const antinomy = gameState?.antinomy;
    if (!antinomy?.pendingPlayerIds?.includes(currentPlayer?.id)) {
      setAntinomySelection(null);
      return;
    }
    setAntinomySelection(previous => previous || {
      stage: antinomy.selectionStage || 'opening',
      triggerRound: antinomy.triggerRound ?? null,
      eligibleSuits: TRANSFORMATION_SUITS.map(option => option.value),
      eligibleRanks: [...TRANSFORMATION_RANKS],
      currentDeclaration: antinomy.declarationsByPlayerId?.[currentPlayer?.id] || null
    });
  }, [
    gameState?.antinomy?.pendingPlayerIds,
    gameState?.antinomy?.selectionStage,
    gameState?.antinomy?.triggerRound,
    currentPlayer?.id
  ]);
  useEffect(() => {
    const isPending = gameState?.riceToMulberry?.pendingPlayerIds?.includes(currentPlayer?.id);
    if (!isPending) {
      setRiceToMulberrySelection(null);
      setSelectedRiceToMulberryCardIds([]);
      return;
    }
    const eligibleCardIds = myCards
      .filter(card => !card.isRiceToMulberryTransformed && getCardPoints(card) > 0)
      .map(card => card.id);
    setRiceToMulberrySelection(previous => previous || {
      requiredCount: Math.floor(eligibleCardIds.length / 2),
      eligibleCardIds
    });
  }, [
    gameState?.riceToMulberry?.pendingPlayerIds,
    currentPlayer?.id,
    myCards
  ]);
  useEffect(() => {
    const pending = gameState?.destroyDyke?.pending;
    setDestroyDykeDecision(
      pending?.dealerPlayerId === currentPlayer?.id ? pending : null
    );
  }, [gameState?.destroyDyke?.pending, currentPlayer?.id]);
  useEffect(() => {
    const pending = getPendingPoliticalReviewDecision(gameState, currentPlayer?.id);
    setPoliticalReviewDecision(previous => {
      if (!pending) return null;
      return previous?.id === pending.id ? previous : pending;
    });
  }, [gameState?.politicalReview?.pending, currentPlayer?.id]);
  const ownAfterglowPending = gameState?.afterglow?.pending?.playerId === currentPlayer?.id
    ? gameState.afterglow.pending
    : null;
  useEffect(() => {
    if (ownAfterglowPending) setAfterglowDecision(ownAfterglowPending);
  }, [ownAfterglowPending?.playerId, ownAfterglowPending?.triggerRound]);
  const ownAmbiguousPending = gameState?.ambiguous?.pending?.currentPlayerId === currentPlayer?.id
    ? gameState.ambiguous.pending.selections?.find(
        selection => selection.playerId === currentPlayer?.id
      )
    : null;
  useEffect(() => {
    if (!ownAmbiguousPending) return;
    setAmbiguousChoice({
      round: gameState?.ambiguous?.pending?.round,
      ...ownAmbiguousPending
    });
  }, [
    ownAmbiguousPending?.playerId,
    ownAmbiguousPending?.selectedOptionIndex,
    gameState?.ambiguous?.pending?.round
  ]);
  const isOneCountryTwoSystemsRule = ruleIncludesId(gameState?.selectedRule, 'one_country_two_systems');
  const isThreeSixNineRule = ruleIncludesId(gameState?.selectedRule, 'three_six_nine_grades');
  const displayedInferiorSuit = isThreeSixNineRule
    ? threeSixNineState?.inferiorSuit
      || currentInferiorDeclaration?.suit
      || gameState?.threeSixNine?.inferiorSuit
      || null
    : null;
  const baseRuleRuntimeStatus = oneCountryTwoSystemsState
    ? { ...gameState, oneCountryTwoSystems: oneCountryTwoSystemsState }
    : gameState;
  const ruleRuntimeStatus = ruleIncludesId(gameState?.selectedRule, 'waiting_rabbit')
    ? {
        ...baseRuleRuntimeStatus,
        waitingRabbit: {
          ...baseRuleRuntimeStatus?.waitingRabbit,
          ownPrivateTarget: waitingRabbitPrivateTarget
        }
      }
    : baseRuleRuntimeStatus;
  const isLostInFogRule = ruleIncludesId(gameState?.selectedRule, 'lost_in_fog');
  const isOpenlyRevealedRule = ruleIncludesId(selectedRule, 'openly_revealed')
    || ruleIncludesId(gameState?.selectedRule, 'openly_revealed');
  const isPeopleCommuneRule = ruleIncludesId(selectedRule, 'people_commune')
    || ruleIncludesId(gameState?.selectedRule, 'people_commune');
  const isReformAndOpeningUpRule = ruleIncludesId(selectedRule, 'reform_and_opening_up')
    || ruleIncludesId(gameState?.selectedRule, 'reform_and_opening_up');
  const displayedPublicBottomCards = isOpenlyRevealedRule
    ? (gameState?.publicBottomCards?.length ? gameState.publicBottomCards : publicBottomCards)
    : [];
  const candleToDawn = gameState?.candleToDawn || null;
  const mustChooseInitialCandleState = Boolean(
    candleToDawn?.isSelectionPending
    && candleToDawn?.selectorPlayerId === currentPlayer?.id
  );
  const activeBuryingPlayerId = getActiveBuryingPlayerId(gameState);
  const isSecondaryBurying = Boolean(gameState?.secondaryBuryingPlayerId);
  const activeBottomCardsCount = Number.isInteger(gameState?.peopleCommune?.requiredCards)
    ? gameState.peopleCommune.requiredCards
    : Number.isInteger(gameState?.bottomCardsCount)
      ? gameState.bottomCardsCount
      : 8;
  const roomPhase = gameState?.phase || GamePhases.WAITING;
  const phase = isHoldingCompletedRound && roomPhase === GamePhases.REVEALING
    ? GamePhases.PLAYING
    : roomPhase;
  const {
    canView: canViewRuleSelection,
    canChoose: isRuleChooser
  } = getRuleSelectionAccess(gameState, currentPlayer?.id);
  const isDoubleHappinessSelection = Boolean(
    gameState?.isRuleSelectionPending
    && gameState?.ruleSelectionMode === 'double_happiness'
  );
  const canRefreshDoubleHappiness = Boolean(isHost && isDoubleHappinessSelection);
  const canOpenRuleSelector = canViewRuleSelection;
  const cardExchange = gameState?.cardExchange || null;
  const hasSubmittedCardExchange = Boolean(
    cardExchange?.submittedPlayerIds?.includes(currentPlayer?.id)
  );
  const icebergPendingPlayerIds = gameState?.icebergPendingPlayerIds || [];
  const hasPendingIcebergSelection = icebergPendingPlayerIds.length > 0;
  const tenSidedAmbush = gameState?.tenSidedAmbush || null;
  const isTenSidedAmbushSelector = Boolean(
    tenSidedAmbush?.selectorPlayerId === currentPlayer?.id
  );
  const tenSidedAmbushView = tenSidedAmbush ? {
    ...tenSidedAmbush,
    rank: tenSidedAmbush.rank || (isTenSidedAmbushSelector ? tenSidedAmbushPrivateRank : null),
    isPrivate: Boolean(!tenSidedAmbush.isRevealed && isTenSidedAmbushSelector && tenSidedAmbushPrivateRank)
  } : null;
  const threePowers = gameState?.threePowers || null;
  const threePowersView = threePowers ? {
    ...threePowers,
    slots: (threePowers.slots || []).map(slot => {
      const privateRank = slot.selectorPlayerId === currentPlayer?.id
        ? threePowersPrivateRanks[slot.sourceRank]
        : null;
      return {
        ...slot,
        rank: slot.rank || privateRank || null,
        isPrivate: Boolean(!slot.isRevealed && privateRank)
      };
    })
  } : null;
  const tablePlayers = mergeLivePlayerCardCounts(
    currentRoom?.players,
    livePlayerCardCounts,
    phase === GamePhases.DRAWING
  );
  const openHand = gameState?.openHand || null;
  const canonicalOpenHandCards = getCanonicalOpenHandCards(
    gameState,
    currentPlayer?.id
  );

  // 明手本人不实际操作自己的牌，始终用服务端公开快照校准本地牌架。
  // 这也能清除旧版本在代打甩牌失败时留下的重复牌与重复ID。
  useEffect(() => {
    if (!canonicalOpenHandCards) return;
    setMyCards(canonicalOpenHandCards);
  }, [canonicalOpenHandCards, setMyCards]);

  // 二鬼拍门的明置牌也写入公共房间快照，保证重连或切回页面时能立即恢复。
  useEffect(() => {
    if (!ruleIncludesId(selectedRule, 'two_ghosts_knock_door')) return;
    setRuleVisibleHands(gameState?.twoGhosts?.revealedHands || []);
  }, [selectedRule?.id, gameState?.twoGhosts?.revealedHands]);
  const currentTurnOwner = Number.isInteger(gameState?.currentPlayerIndex)
    ? currentRoom?.players?.[gameState.currentPlayerIndex]
    : null;
  const isProxyTurn = Boolean(
    phase === GamePhases.PLAYING &&
    currentTurnOwner?.id === openHand?.playerId &&
    currentPlayer?.id === openHand?.controllerPlayerId
  );
  const isOpenHandSelf = Boolean(openHand?.playerId === currentPlayer?.id);
  const woodenOxDisplayCard = woodenOxPrivateState?.storedCard
    && woodenOxPrivateState?.holderPlayerId === currentPlayer?.id
    ? { ...woodenOxPrivateState.storedCard, isWoodenOxCard: true }
    : null;
  const woodenOxPlayableCard = woodenOxDisplayCard
    && currentTurnOwner?.id === currentPlayer?.id
    ? woodenOxDisplayCard
    : null;
  const activePlayCards = useMemo(() => {
    if (isProxyTurn) return openHand?.cards || [];
    return woodenOxPlayableCard ? [...myCards, woodenOxPlayableCard] : myCards;
  }, [isProxyTurn, openHand?.cards, myCards, woodenOxPlayableCard?.id]);
  const ownPublicWoodenOxMule = gameState?.woodenOx?.mules?.find(
    mule => mule.holderPlayerId === currentPlayer?.id
  ) || null;
  const ruleDisabledCardIds = getRuleDisabledCardIds({
    gameState,
    handCards: activePlayCards,
    players: currentRoom?.players,
    currentPlayerId: currentPlayer?.id
  });
  const ruleDisabledCardReason = getRuleDisabledCardReason(gameState);
  const activeSkillAvailability = getActiveSkillAvailability({
    gameState,
    players: currentRoom?.players,
    currentPlayerId: currentPlayer?.id,
    roomConfig: currentRoom?.config,
    handCards: activePlayCards
  });
  const activeSkill = activeSkillAvailability.skill;
  const mutualSupportMaxGiveCount = Math.min(
    2,
    Math.max(0, myCards.length - (gameState?.leadingPattern?.length || 1))
  );
  const isActiveSkillArmed = Boolean(
    activeSkill && armedActiveSkillId === activeSkill.id
  );
  const virtualizedCardIds = isActiveSkillArmed
    && activeSkill?.effect === 'ignore_odd_led_side_suit'
    ? (activeSkillAvailability.virtualizedCardIds || [])
    : [];
  const forbiddenMagicState = gameState?.forbiddenMagic || null;
  const lureTigerState = gameState?.lureTiger || null;
  const removeFirewoodState = gameState?.removeFirewood || null;
  const isForbiddenMagicActiveByMe = Boolean(
    activeSkill?.effect === 'demote_trumps_and_transform'
    && forbiddenMagicState?.activePlayerIds?.includes(currentPlayer?.id)
  );
  const isForbiddenMagicReservedByMe = Boolean(
    activeSkill?.effect === 'demote_trumps_and_transform'
    && forbiddenMagicState?.reservations?.some(
      reservation => reservation.playerId === currentPlayer?.id
    )
  );
  const isLureTigerReservedByMe = Boolean(
    activeSkill?.effect === 'silence_non_leader_for_round'
    && lureTigerState?.reservations?.some(
      reservation => reservation.playerId === currentPlayer?.id
    )
  );
  const isExplicitTransformationSkill = Boolean(
    activeSkill && [
      'joker_wildcards',
      'adjacent_rank_transform',
      'demote_trumps_and_transform'
    ].includes(activeSkill.effect)
  );
  const divineWeapon = gameState?.divineWeapon || null;
  const selectedDivineWeaponCard = divineWeapon?.cards?.find(
    card => card.id === selectedDivineWeaponCardId
  ) || null;
  const forbiddenMagicPreviewCards = isForbiddenMagicActiveByMe
    ? demoteForbiddenMagicHand(myCards, trumpSuit, trumpRank)
    : myCards;
  const divineWeaponPreviewCards = selectedDivineWeaponCard && divineWeaponSourceCardId
    ? forbiddenMagicPreviewCards.map(card => card.id === divineWeaponSourceCardId
      ? {
          ...card,
          suit: selectedDivineWeaponCard.suit,
          rank: selectedDivineWeaponCard.rank,
          originalSuit: card.suit,
          originalRank: card.rank,
          isDivineWeaponTransformed: true,
          divineWeaponPreview: true,
          divineWeaponCardId: selectedDivineWeaponCard.id
      }
      : card)
    : forbiddenMagicPreviewCards;
  const explicitTransformationList = Object.values(explicitCardTransformations);
  const jokerSubstitutions = explicitTransformationList
    .filter(item => item.kind === 'joker')
    .map(({ cardId, suit, rank }) => ({ cardId, suit, rank }));
  const clusterAnalysisSubstitutions = explicitTransformationList
    .filter(item => item.kind === 'cluster')
    .map(({ cardId, suit, fromRank, toRank }) => ({ cardId, suit, fromRank, toRank }));
  const forbiddenMagicSubstitutions = explicitTransformationList
    .filter(item => item.kind === 'forbidden_magic')
    .map(({ cardId, suit, rank }) => ({ cardId, suit, rank }));
  const hasCommittedActiveSkillTransformation = Boolean(
    activeSkill && (
      (activeSkill.effect === 'joker_wildcards' && jokerSubstitutions.length > 0)
      || (activeSkill.effect === 'adjacent_rank_transform' && clusterAnalysisSubstitutions.length > 0)
    )
  );
  // 关闭“编辑转化”只收起牌上的转化入口；已经完成的转化仍属于本次技能出牌，
  // 直到玩家逐张还原或成功出牌，避免为了选择原生牌而丢失全部转化。
  const effectiveActiveSkillId = isActiveSkillArmed || hasCommittedActiveSkillTransformation
    ? activeSkill?.id || null
    : null;
  const transformableCardIds = (isActiveSkillArmed || isForbiddenMagicActiveByMe)
    && isExplicitTransformationSkill
    ? activePlayCards
        .filter(card => {
          if (explicitCardTransformations[card.id]) return false;
          if (activeSkill.effect === 'joker_wildcards') return card.suit === 'joker';
          if (activeSkill.effect === 'demote_trumps_and_transform') {
            return isTrumpCard(card, trumpSuit, trumpRank);
          }
          return getClusterAnalysisTargetRanks(card, trumpRank).length > 0;
        })
        .map(card => card.id)
    : [];
  const unsortedTransformedPreviewCards = divineWeaponPreviewCards.map(card => {
    const transformation = explicitCardTransformations[card.id];
    if (!transformation) return card;
    if (transformation.kind === 'joker') {
      return {
        ...card,
        suit: transformation.suit,
        rank: transformation.rank,
        originalSuit: card.suit,
        originalRank: card.rank,
        isJokerSubstitution: true,
        explicitTransformationPreview: true
      };
    }
    if (transformation.kind === 'forbidden_magic') {
      return {
        ...card,
        suit: transformation.suit,
        rank: transformation.rank,
        originalSuit: transformation.fromSuit,
        originalRank: transformation.fromRank,
        isForbiddenMagicDemoted: true,
        isForbiddenMagicTransformed: true,
        explicitTransformationPreview: true
      };
    }
    return {
      ...card,
      rank: transformation.toRank,
      originalRank: card.rank,
      isClusterAnalysisTransformed: true,
      clusterAnalysisSourceRank: card.rank,
      explicitTransformationPreview: true
    };
  });
  // 显式转化只改变本次出牌的预览牌面；按新牌面重新排序，让王转成 J 后
  // 真正进入对应花色的 J 牌组，而不是继续占据原先的王牌位置。
  const transformedPreviewCards = explicitTransformationList.length > 0
    || isForbiddenMagicActiveByMe
    ? sortCards(
        unsortedTransformedPreviewCards,
        trumpSuit,
        trumpRank,
        displayedInferiorSuit
      )
    : unsortedTransformedPreviewCards;
  const isTimeReversalReservedByMe = Boolean(
    activeSkill?.effect === 'rewind_completed_round'
    && gameState?.timeReversal?.reservations?.some(
      reservation => reservation.playerId === currentPlayer?.id
    )
  );
  const hasTimeReversalDecisionPending = Boolean(
    gameState?.timeReversal?.decisionState || timeReversalDecision
  );
  const isMagicTrickPrepared = Boolean(
    activeSkill?.effect === 'swap_two_plays_at_round_end'
    && magicTrickPreparedRound === gameState?.currentRound
  );
  const mutualSupportPendingAction = gameState?.mutualSupport?.pendingAction || null;
  const strawBoatSnapshotDecision = gameState?.strawBoatBorrowingArrows?.pending || null;
  const isStrawBoatChooser = Boolean(
    strawBoatDecision?.playerId === currentPlayer?.id
  );
  const strawBoatDiscardOptions = useMemo(
    () => myCards.filter(card => getCardPoints(card) === 0),
    [myCards]
  );

  useEffect(() => {
    setStrawBoatDecision(previous => {
      if (!strawBoatSnapshotDecision) return null;
      return previous?.id === strawBoatSnapshotDecision.id
        ? previous
        : strawBoatSnapshotDecision;
    });
    if (!strawBoatSnapshotDecision) setStrawBoatDiscardCardId(null);
  }, [strawBoatSnapshotDecision]);

  useEffect(() => {
    if (
      mutualSupportPendingAction?.chooserPlayerId === currentPlayer?.id
      && mutualSupportPendingAction?.actionId
    ) {
      const otherPlayer = currentRoom?.players?.find(
        player => player.id === mutualSupportPendingAction.otherPlayerId
      );
      setMutualSupportSelection(previous => (
        previous?.actionId === mutualSupportPendingAction.actionId
          ? previous
          : {
              ...mutualSupportPendingAction,
              source: 'server',
              otherPlayerName: otherPlayer?.name || '队友'
            }
      ));
      setMutualSupportSelectedCardIds([]);
      return;
    }
    setMutualSupportSelection(previous => previous?.source === 'server' ? null : previous);
  }, [
    mutualSupportPendingAction?.actionId,
    mutualSupportPendingAction?.chooserPlayerId,
    mutualSupportPendingAction?.otherPlayerId,
    currentPlayer?.id
  ]);

  // 清理查看上轮的定时器
  useEffect(() => {
    return () => {
      if (lastRoundTimer) {
        clearTimeout(lastRoundTimer);
      }
    };
  }, [lastRoundTimer]);

  useEffect(() => {
    return () => {
      if (roundClearTimerRef.current) {
        clearTimeout(roundClearTimerRef.current);
      }
      clearCardTransitionTimers();
      if (activeSkillAnimationTimerRef.current) {
        clearTimeout(activeSkillAnimationTimerRef.current);
      }
      if (equivalentReciprocityTimerRef.current) {
        clearTimeout(equivalentReciprocityTimerRef.current);
      }
      throwFailedPreviewTimersRef.current.forEach(timer => clearTimeout(timer));
      throwFailedPreviewTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    setThrowFailedPreviews({});
    return () => {
      throwFailedPreviewTimersRef.current.forEach(timer => clearTimeout(timer));
      throwFailedPreviewTimersRef.current.clear();
    };
  }, [currentRoom?.id]);

  useEffect(() => {
    if (!socket || !currentRoom?.id || !ownPublicWoodenOxMule) {
      if (!ownPublicWoodenOxMule) setWoodenOxPrivateState(null);
      return;
    }
    socket.emit('request_wooden_ox_private_state', { roomId: currentRoom.id });
  }, [
    socket,
    currentRoom?.id,
    ownPublicWoodenOxMule?.holderPlayerId,
    ownPublicWoodenOxMule?.hasStoredCard
  ]);

  // 同步房间状态中的主牌信息到本地状态和store
  useEffect(() => {
    if (gameState) {
      const roomTrumpSuit = gameState.trumpSuit;
      const roomTrumpRank = gameState.trumpRank;
      const roomInferiorSuit = gameState?.threeSixNine?.inferiorSuit || null;

      console.log(`🔄 同步房间状态: trumpSuit=${roomTrumpSuit}, trumpRank=${roomTrumpRank}`);

      // 更新本地状态
      setTrumpSuit(roomTrumpSuit);
      setTrumpRank(roomTrumpRank);
      // 更新store，触发手牌重新排序
      setTrumpInfo(roomTrumpSuit, roomTrumpRank, roomInferiorSuit);
    }
  }, [
    gameState?.trumpSuit,
    gameState?.trumpRank,
    gameState?.threeSixNine?.inferiorSuit,
    setTrumpInfo
  ]);

  useEffect(() => {
    setOneCountryTwoSystemsState(
      isOneCountryTwoSystemsRule ? gameState?.oneCountryTwoSystems || null : null
    );
  }, [isOneCountryTwoSystemsRule, gameState?.oneCountryTwoSystems]);

  useEffect(() => {
    const state = isThreeSixNineRule ? gameState?.threeSixNine || null : null;
    setThreeSixNineState(state);
    setCurrentInferiorDeclaration(state?.currentInferiorDeclaration || null);
    if (state?.currentTrumpDeclaration) {
      setCurrentTrumpDeclaration(state.currentTrumpDeclaration);
    }
  }, [isThreeSixNineRule, gameState?.threeSixNine]);

  useEffect(() => {
    if (Number.isFinite(gameState?.attackerScore)) {
      setAttackerScore(gameState.attackerScore);
    }
    if (Array.isArray(gameState?.collectedPointCards)) {
      setCollectedPointCards(gameState.collectedPointCards);
    }
  }, [gameState?.attackerScore, gameState?.collectedPointCards]);

  // 每次选规则时全房间自动展示候选，确认权仍只属于服务端指定的选择者。
  useEffect(() => {
    setRuleSelectorModal(canViewRuleSelection);
  }, [
    canViewRuleSelection,
    gameState?.ruleSelectionMode
  ]);

  // 检测手牌变化，更新可亮主选项（仅在摸牌阶段）
  useEffect(() => {
    if (
      phase !== GamePhases.DRAWING
      || !trumpRank
      || gameState?.isTrumpDeclarationLocked
      || cardExchange
    ) {
      setAvailableDeclarations([]);
      return;
    }

    const myPlayerIndex = currentRoom?.players?.findIndex(
      player => player.id === currentPlayer?.id
    );
    const myTeamDeclaration = isOneCountryTwoSystemsRule && myPlayerIndex >= 0
      ? oneCountryTwoSystemsState?.declarationsByTeam?.[myPlayerIndex % 2] || null
      : currentTrumpDeclaration;
    if (isOneCountryTwoSystemsRule && oneCountryTwoSystemsState?.hasJokerDeclaration) {
      setAvailableDeclarations([]);
      return;
    }

    const declarations = (isThreeSixNineRule
      ? detectThreeSixNineDeclarations(
          myCards,
          trumpRank,
          {
            currentTrumpDeclaration: threeSixNineState?.currentTrumpDeclaration
              || currentTrumpDeclaration,
            currentInferiorDeclaration: threeSixNineState?.currentInferiorDeclaration
              || currentInferiorDeclaration,
            claimedSuits: threeSixNineState?.claimedSuits || {}
          },
          currentPlayer?.id
        )
      : detectAvailableDeclarations(
          myCards,
          trumpRank,
          myTeamDeclaration,
          currentPlayer?.id
        )).filter(declaration => !(
      ruleIncludesId(gameState?.selectedRule, 'last_stand')
      && declaration.suit === 'joker'
    ));
    setAvailableDeclarations(declarations);
    console.log('🎯 可亮主选项更新:', declarations);
  }, [
    myCards,
    trumpRank,
    phase,
    currentTrumpDeclaration,
    currentRoom?.players,
    currentPlayer?.id,
    gameState?.isTrumpDeclarationLocked,
    gameState?.selectedRule?.id,
    isOneCountryTwoSystemsRule,
    isThreeSixNineRule,
    oneCountryTwoSystemsState,
    threeSixNineState,
    currentInferiorDeclaration,
    cardExchange
  ]);

  // 监听游戏事件
  useEffect(() => {
    if (!socket) return;

    const resetRoundDisplay = () => {
      if (roundClearTimerRef.current) {
        clearTimeout(roundClearTimerRef.current);
        roundClearTimerRef.current = null;
      }
      awaitingRoundClearRef.current = false;
      heldCompletedRoundNumberRef.current = null;
      playedCardsRef.current = {};
      setPlayedCards({});
      setCurrentWinningPlayerId(null);
      setIsHoldingCompletedRound(false);
      setHeldCompletedRoundNumber(null);
    };

    const showSkillActivation = ({
      id = null,
      name,
      playerId = null,
      playerName,
      treatedAsSmall = false,
      concealed = false,
      variant = 'default',
      actionLabel = '发动主动技能',
      detail = null
    }) => {
      if (activeSkillAnimationTimerRef.current) {
        clearTimeout(activeSkillAnimationTimerRef.current);
      }
      setArmedActiveSkillId(null);
      setActiveSkillAnimation({
        id,
        name,
        playerId,
        playerName,
        treatedAsSmall,
        concealed,
        variant,
        actionLabel,
        detail,
        key: `${variant}-${Date.now()}`
      });
      activeSkillAnimationTimerRef.current = setTimeout(() => {
        setActiveSkillAnimation(null);
        activeSkillAnimationTimerRef.current = null;
      }, 1800);
    };

    // 游戏开始
    socket.on('game_started', ({ gameState }) => {
      clearCardTransitionTimers();
      messageApi.success('游戏开始！');
      setShownCards({}); // 清空展示的牌
      setLivePlayerCardCounts({});
      setCurrentWinningPlayerId(null);
      setLastRoundWinnerPlayerId(null);
      heldCompletedRoundNumberRef.current = null;
      setHeldCompletedRoundNumber(null);
      setPublicBottomCards([]);
      setMyBottomCards([]);
      setViewBottomModal(false);
      setCardExchangeAnimation(null);
      setPrivateCardTransferReveal(null);
      setBottomPickup(null);
      setHandArrivalHighlight(null);
      setRuleVisibleHands([]);
      setIcebergSelection(null);
      setTenSidedAmbushSelection(null);
      setSelectedTenSidedAmbushRank(null);
      setTenSidedAmbushPrivateRank(null);
      setTenSidedAmbushRevealAnimation(null);
      setWaitingRabbitSelection(null);
      setSelectedWaitingRabbitSuit(null);
      setSelectedWaitingRabbitRank(null);
      setWaitingRabbitPrivateTarget(null);
      setWaitingRabbitDecision(null);
      setWaitingRabbitDiscardCardId(null);
      setThreePowersSelection(null);
      setSelectedThreePowersRank(null);
      setThreePowersPrivateRanks({});
      setThreePowersRevealAnimation(null);
      setGentlemanPromiseSelection(null);
      setSelectedGentlemanPromiseSuit(null);
      setHiddenDragonSelection(null);
      setSelectedHiddenDragonRank(null);
      setAdministrativeReviewSelection(null);
      setSelectedAdministrativeReviewValue(null);
      setPoliticalReviewDecision(null);
      setFocusFigureVote(null);
      setFocusFigurePrivate(null);
      setArmedActiveSkillId(null);
      setExplicitCardTransformations({});
      setCardTransformationDialog(null);
      setSelectedDivineWeaponCardId(null);
      setDivineWeaponSourceCardId(null);
      setActiveSkillAnimation(null);
      setLastStandDecision(null);
      setTeammateCheerDecision(null);
      setAfterglowDecision(null);
      setRemoveFirewoodDecision(null);
      setMainstaySelectedCardIds([]);
      setAmbiguousFirstOptionCardIds([]);
      setAmbiguousChoice(null);
      setBushGateDecisionOpen(false);
      setWoodenOxDecision(null);
      setWoodenOxPrivateState(null);
      setWoodenOxSelectedCardId(null);
      setForbiddenMagicDecision(null);
      setLureTigerDecision(null);
      setSurrenderDecision(null);
      setEquivalentReciprocityTarget(null);
      setEquivalentReciprocitySelection(null);
      setEquivalentReciprocityCardId(null);
      setEquivalentReciprocityResult(null);
      setMutualSupportDirectionOpen(false);
      setMutualSupportSelection(null);
      setMutualSupportSelectedCardIds([]);
      setStrawBoatDecision(null);
      setStrawBoatDiscardCardId(null);
    });

    // 底牌在逐张摸牌前已经确定；本规则下从发牌动画开始便在牌桌中央明置。
    socket.on('drawing_started', ({ publicBottomCards: openlyRevealedCards }) => {
      if (Array.isArray(openlyRevealedCards)) {
        setPublicBottomCards(openlyRevealedCards);
      }
    });

    // 游戏重新开始
    socket.on('game_restarted', () => {
      clearCardTransitionTimers();
      messageApi.success('游戏重新开始！');
      setSurrenderDecision(null);
      setMyCards([]); // 清空手牌
      setLivePlayerCardCounts({});
      setShownCards({}); // 清空展示的牌
      resetRoundDisplay(); // 清空已出的牌
      setPlayHistory([]); // 清空出牌历史
      clearSelection(); // 清空选中的牌
      setCurrentTrumpDeclaration(null); // 清空亮主信息
      setCurrentInferiorDeclaration(null);
      setThreeSixNineState(null);
      setAvailableDeclarations([]); // 清空可用亮主选项
      setAttackerScore(0); // 清空闲家得分
      setCollectedPointCards([]); // 清空收集的分数牌
      setBottomScoreResult(null); // 清空底牌得分结果
      setUpgradeResult(null); // 清空升级结果
      setRevealedBottomCards([]); // 清空底牌展示
      setPublicBottomCards([]);
      setMyBottomCards([]);
      setViewBottomModal(false);
      setCardExchangeAnimation(null);
      setPrivateCardTransferReveal(null);
      setBottomPickup(null);
      setHandArrivalHighlight(null);
      setRuleVisibleHands([]);
      setIcebergSelection(null);
      setTenSidedAmbushSelection(null);
      setSelectedTenSidedAmbushRank(null);
      setTenSidedAmbushPrivateRank(null);
      setTenSidedAmbushRevealAnimation(null);
      setWaitingRabbitSelection(null);
      setSelectedWaitingRabbitSuit(null);
      setSelectedWaitingRabbitRank(null);
      setWaitingRabbitPrivateTarget(null);
      setWaitingRabbitDecision(null);
      setWaitingRabbitDiscardCardId(null);
      setThreePowersSelection(null);
      setSelectedThreePowersRank(null);
      setThreePowersPrivateRanks({});
      setThreePowersRevealAnimation(null);
      setGentlemanPromiseSelection(null);
      setSelectedGentlemanPromiseSuit(null);
      setHiddenDragonSelection(null);
      setSelectedHiddenDragonRank(null);
      setAdministrativeReviewSelection(null);
      setSelectedAdministrativeReviewValue(null);
      setPoliticalReviewDecision(null);
      setFocusFigureVote(null);
      setFocusFigurePrivate(null);
      setArmedActiveSkillId(null);
      setExplicitCardTransformations({});
      setCardTransformationDialog(null);
      setSelectedDivineWeaponCardId(null);
      setDivineWeaponSourceCardId(null);
      setActiveSkillAnimation(null);
      setLastStandDecision(null);
      setTeammateCheerDecision(null);
      setAfterglowDecision(null);
      setRemoveFirewoodDecision(null);
      setAmbiguousFirstOptionCardIds([]);
      setAmbiguousChoice(null);
      setBushGateDecisionOpen(false);
      setWoodenOxDecision(null);
      setWoodenOxPrivateState(null);
      setWoodenOxSelectedCardId(null);
      setForbiddenMagicDecision(null);
      setLureTigerDecision(null);
      setEquivalentReciprocityTarget(null);
      setEquivalentReciprocitySelection(null);
      setEquivalentReciprocityCardId(null);
      setEquivalentReciprocityResult(null);
      setMutualSupportDirectionOpen(false);
      setMutualSupportSelection(null);
      setMutualSupportSelectedCardIds([]);
      setStrawBoatDecision(null);
      setStrawBoatDiscardCardId(null);
      setIsReadyForNext(false); // 重置准备状态
      setLastRoundPlayedCards({}); // 清空上轮出牌记录
      setLastRoundWinnerPlayerId(null);
      setViewingLastRound(false); // 取消查看上轮状态
      if (lastRoundTimer) {
        clearTimeout(lastRoundTimer);
        setLastRoundTimer(null);
      }
    });

    // 收到手牌
    socket.on('card_dealt', ({ card }) => {
      addCard(card);
    });

    // 发牌时房间快照不会逐张广播；用不含牌面的公开进度实时更新每家的手牌数。
    socket.on('deal_progress', ({ playerId, cardsCount }) => {
      if (!playerId || !Number.isInteger(cardsCount)) return;
      setLivePlayerCardCounts(prev => ({
        ...prev,
        [playerId]: cardsCount
      }));
    });

    socket.on('card_exchange_started', ({ ruleName, requiredCards, transfers, operation = 'exchange' }) => {
      clearSelection();
      const myTransfer = transfers?.find(transfer => transfer.fromPlayerId === currentPlayer?.id);
      if (operation === 'discard') {
        messageApi.info(`${ruleName}：请选择 ${requiredCards} 张牌暗中弃置`);
      } else {
        const targetText = myTransfer?.toPlayerName ? `交给 ${myTransfer.toPlayerName}` : '完成换牌';
        messageApi.info(`${ruleName}：请选择 ${requiredCards} 张牌${targetText}`);
      }
    });

    socket.on('card_exchange_submitted', ({
      playerId,
      playerName,
      operation = 'exchange',
      submittedCount,
      totalCount
    }) => {
      const actionName = operation === 'discard' ? '弃牌' : '换牌';
      if (playerId === currentPlayer?.id) {
        clearSelection();
        messageApi.success(`已确认${actionName}，等待其他玩家 (${submittedCount}/${totalCount})`);
      } else {
        messageApi.info(`${playerName} 已确认${actionName} (${submittedCount}/${totalCount})`);
      }
    });

    socket.on('card_exchange_resolved', ({
      ruleName,
      operation = 'exchange',
      transfers,
      animationDuration = 2200
    }) => {
      if (exchangeAnimationTimerRef.current) {
        clearTimeout(exchangeAnimationTimerRef.current);
      }
      if (privateCardRevealTimerRef.current) {
        clearTimeout(privateCardRevealTimerRef.current);
        privateCardRevealTimerRef.current = null;
      }
      setPrivateCardTransferReveal(null);
      const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const effectiveDuration = prefersReducedMotion ? 0 : animationDuration;
      exchangeAnimationDurationRef.current = effectiveDuration;
      if (effectiveDuration > 0) {
        const lastCardDelay = Math.max(0, ...((transfers || []).map((transfer, transferIndex) =>
          transferIndex * 35 + Math.max(0, (transfer.cardsCount || 1) - 1) * 90
        )));
        const animationLifetime = animationDuration + lastCardDelay + 260;
        exchangeAnimationEndsAtRef.current = Date.now() + animationLifetime;
        setCardExchangeAnimation({
          kind: operation === 'discard' ? 'discard' : 'exchange',
          operation,
          ruleName,
          transfers,
          animationDuration,
          key: Date.now()
        });
        exchangeAnimationTimerRef.current = setTimeout(() => {
          setCardExchangeAnimation(null);
          exchangeAnimationTimerRef.current = null;
          exchangeAnimationEndsAtRef.current = 0;
        }, animationLifetime);
      } else {
        setCardExchangeAnimation(null);
        exchangeAnimationTimerRef.current = null;
        exchangeAnimationEndsAtRef.current = 0;
      }
      messageApi.info(
        operation === 'discard'
          ? `${ruleName}：正在暗中弃牌`
          : `${ruleName}：换牌中，请留意牌的来源与落点`,
        Math.max(2, Math.ceil((animationDuration + 500) / 1000))
      );
    });

    socket.on('mainstay_started', () => {
      clearSelection();
      setMainstaySelectedCardIds([]);
      messageApi.info('中流砥柱：从一号位开始依次检查每名玩家的当前主牌数', 4);
    });

    socket.on('mainstay_decision_required', ({ trumpCount = 0 }) => {
      setMainstaySelectedCardIds([]);
      messageApi.info(`中流砥柱：你当前有${trumpCount}张主牌，可以选择是否发动`, 4);
    });

    socket.on('mainstay_cards_required', ({ stage, requiredCards = 5 }) => {
      messageApi.info(
        stage === 'return'
          ? `中流砥柱：请选择${requiredCards}张牌返还给队友`
          : `中流砥柱：请选择${requiredCards}张牌交给队友，必须包含全部主牌`,
        4
      );
    });

    socket.on('mainstay_player_skipped', ({ playerName, reason }) => {
      if (reason === 'too_many_trumps') {
        messageApi.info(`中流砥柱：${playerName}的主牌超过5张，本次不能发动`, 3);
      }
    });

    socket.on('mainstay_decision_resolved', ({ playerName, accepted }) => {
      if (!accepted) messageApi.info(`${playerName}放弃发动中流砥柱`, 3);
    });

    socket.on('mainstay_transfer_resolved', ({
      actionId,
      stage,
      fromPlayerId,
      fromPlayerName,
      toPlayerId,
      toPlayerName,
      cardsCount = 5,
      animationDuration = 1100
    }) => {
      setMainstaySelectedCardIds([]);
      if (exchangeAnimationTimerRef.current) clearTimeout(exchangeAnimationTimerRef.current);
      setCardExchangeAnimation({
        kind: 'mainstay',
        ruleName: '中流砥柱',
        title: stage === 'return' ? '中流砥柱 · 队友返牌' : '中流砥柱 · 交出全部主牌',
        transfers: [{ fromPlayerId, toPlayerId, cardsCount }],
        animationDuration,
        key: `${actionId}-${stage}`
      });
      exchangeAnimationTimerRef.current = setTimeout(() => {
        setCardExchangeAnimation(null);
        exchangeAnimationTimerRef.current = null;
      }, animationDuration + 220);
      messageApi.info(
        `${fromPlayerName}${stage === 'return' ? '返还给' : '交给'}${toPlayerName}${cardsCount}张牌`,
        3
      );
    });

    socket.on('mainstay_hand_updated', ({ cards = [] }) => {
      setMyCards(cards);
      clearSelection();
      setMainstaySelectedCardIds([]);
    });

    socket.on('mainstay_completed', ({ skipped, activatedCount = 0 }) => {
      setMainstaySelectedCardIds([]);
      messageApi.info(
        skipped
          ? '中流砥柱：本局无主，规则跳过'
          : `中流砥柱处理完成，共发动${activatedCount}次`,
        4
      );
    });

    socket.on('happy_twins_positions_swapped', ({
      dealerPlayerName = '庄家',
      upstreamPlayerName = '上家'
    }) => {
      messageApi.info(
        `欢乐成双：${dealerPlayerName}与原上家${upstreamPlayerName}交换位置`,
        4
      );
    });

    socket.on('happy_twins_positions_restored', ({ nextDealerPlayerName = '下一位玩家' }) => {
      messageApi.success(
        `欢乐成双：已恢复原座次，下一局由${nextDealerPlayerName}上庄`,
        5
      );
    });

    socket.on('encircle_three_missing_one_transition', ({
      missingSuit,
      replaced = false,
      effectiveRound
    }) => {
      if (replaced) return;
      const suitSymbol = {
        hearts: '♥',
        diamonds: '♦',
        clubs: '♣',
        spades: '♠'
      }[missingSuit] || missingSuit;
      messageApi.info(
        `围三阙一：缺少的 ${suitSymbol} 正是当前主花色，第${effectiveRound}轮主花色不变`,
        4
      );
    });

    socket.on('planned_economy_cards_drawn', ({
      round,
      draws = [],
      remainingCards = 0,
      animationDuration = 1500
    }) => {
      if (exchangeAnimationTimerRef.current) clearTimeout(exchangeAnimationTimerRef.current);
      const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const effectiveDuration = prefersReducedMotion ? 0 : animationDuration;
      if (effectiveDuration > 0) {
        setCardExchangeAnimation({
          kind: 'planned_economy_draw',
          ruleName: '计划经济',
          title: `计划经济 · 第${round}轮补牌 · 剩余${remainingCards}张`,
          transfers: draws.map(draw => ({
            fromPlayerId: null,
            toPlayerId: draw.playerId,
            cardsCount: 1
          })),
          animationDuration,
          key: `${round}-${Date.now()}`
        });
        exchangeAnimationTimerRef.current = setTimeout(() => {
          setCardExchangeAnimation(null);
          exchangeAnimationTimerRef.current = null;
        }, animationDuration + 220);
      } else {
        setCardExchangeAnimation(null);
      }
      messageApi.info(`计划经济：第${round}轮结束，四家各摸1张；储备牌剩余${remainingCards}张`, 3);
    });

    socket.on('magic_trick_prepared', ({ round, targetPlayerNames = [] }) => {
      setMagicTrickPreparedRound(round);
      setMagicTrickTargetIds([]);
      setArmedActiveSkillId(null);
      setExplicitCardTransformations({});
      setCardTransformationDialog(null);
      clearSelection();
      messageApi.success(`魔术戏法已暗中准备：本轮结算时交换 ${targetPlayerNames.join(' 与 ')} 的出牌`, 4);
    });

    socket.on('equivalent_reciprocity_started', ({
      initiatorPlayerId,
      initiatorPlayerName,
      targetPlayerName
    }) => {
      setArmedActiveSkillId(null);
      setEquivalentReciprocityTarget(null);
      clearSelection();
      messageApi.info(
        initiatorPlayerId === currentPlayer?.id
          ? `已向 ${targetPlayerName} 发起拼点，请秘密选择一张牌`
          : `${initiatorPlayerName} 与 ${targetPlayerName} 开始拼点`,
        3
      );
    });

    socket.on('equivalent_reciprocity_card_required', ({
      challengeId,
      opponentPlayerId,
      opponentPlayerName
    }) => {
      clearSelection();
      setEquivalentReciprocityCardId(null);
      setEquivalentReciprocitySelection({
        challengeId,
        opponentPlayerId,
        opponentPlayerName,
        submitted: false
      });
    });

    socket.on('equivalent_reciprocity_selection_recorded', ({
      challengeId,
      playerId,
      playerName
    }) => {
      if (playerId === currentPlayer?.id) {
        setEquivalentReciprocitySelection(previous => previous?.challengeId === challengeId
          ? { ...previous, submitted: true }
          : previous);
        messageApi.success('拼点牌已暗置，等待对方选择');
      } else {
        messageApi.info(`${playerName} 已暗置拼点牌`);
      }
    });

    socket.on('equivalent_reciprocity_resolved', (result) => {
      const animationDuration = result.animationDuration || 1600;
      setEquivalentReciprocitySelection(null);
      setEquivalentReciprocityCardId(null);
      setEquivalentReciprocityResult(result);
      setAttackerScore(result.attackerScore);
      exchangeAnimationDurationRef.current = animationDuration;
      if (exchangeAnimationTimerRef.current) clearTimeout(exchangeAnimationTimerRef.current);
      setCardExchangeAnimation({
        kind: 'equivalent_reciprocity',
        ruleName: '等价互惠',
        title: '等价互惠 · 拼点换牌',
        transfers: [
          {
            fromPlayerId: result.initiatorPlayerId,
            toPlayerId: result.targetPlayerId,
            cardsCount: 1
          },
          {
            fromPlayerId: result.targetPlayerId,
            toPlayerId: result.initiatorPlayerId,
            cardsCount: 1
          }
        ],
        animationDuration,
        key: result.challengeId
      });
      exchangeAnimationTimerRef.current = setTimeout(() => {
        setCardExchangeAnimation(null);
        exchangeAnimationTimerRef.current = null;
      }, animationDuration + 220);
      if (equivalentReciprocityTimerRef.current) {
        clearTimeout(equivalentReciprocityTimerRef.current);
      }
      equivalentReciprocityTimerRef.current = setTimeout(() => {
        setEquivalentReciprocityResult(null);
        equivalentReciprocityTimerRef.current = null;
      }, animationDuration + 900);
      messageApi[result.isTie ? 'info' : 'success'](
        result.isTie
          ? '拼点相同：无人失去5分，两张牌照常交换'
          : `${result.winnerPlayerName} 拼点胜出，${result.loserPlayerName} 一方失去5分`,
        4
      );
    });

    socket.on('equivalent_reciprocity_hand_updated', ({ cards, animationDuration = 1600 }) => {
      if (exchangeHandUpdateTimerRef.current) clearTimeout(exchangeHandUpdateTimerRef.current);
      const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const updateDelay = prefersReducedMotion ? 0 : Math.round(animationDuration * 0.68);
      exchangeHandUpdateTimerRef.current = setTimeout(() => {
        setMyCards(cards || []);
        clearSelection();
        exchangeHandUpdateTimerRef.current = null;
      }, updateDelay);
    });

    socket.on('mutual_support_started', ({
      direction,
      initiatorPlayerId,
      initiatorPlayerName,
      teammatePlayerName,
      pending
    }) => {
      setMutualSupportDirectionOpen(false);
      setArmedActiveSkillId(null);
      clearSelection();
      if (initiatorPlayerId === currentPlayer?.id) {
        messageApi.info(
          direction === 'request'
            ? `已向 ${teammatePlayerName} 请求手牌，等待队友选择0至2张`
            : `已将所选手牌交给 ${teammatePlayerName}，轮末由对方等量返还`,
          4
        );
      } else if (pending) {
        messageApi.info(`${initiatorPlayerName} 向队友发起了同舟共济请求`, 3);
      }
    });

    socket.on('mutual_support_cards_required', payload => {
      if (payload?.chooserPlayerId !== currentPlayer?.id) return;
      setMutualSupportSelectedCardIds([]);
      setMutualSupportSelection({ ...payload, source: 'server' });
    });

    socket.on('mutual_support_transfer_resolved', ({
      actionId,
      stage,
      fromPlayerId,
      fromPlayerName,
      toPlayerId,
      toPlayerName,
      cardsCount = 0,
      animationDuration = 1100
    }) => {
      setMutualSupportSelection(previous => previous?.actionId === actionId ? null : previous);
      setMutualSupportSelectedCardIds([]);
      if (cardsCount > 0) {
        if (exchangeAnimationTimerRef.current) clearTimeout(exchangeAnimationTimerRef.current);
        setCardExchangeAnimation({
          kind: 'mutual_support',
          ruleName: '同舟共济',
          title: stage === 'return' ? '同舟共济 · 轮末返还' : '同舟共济 · 临时交牌',
          transfers: [{ fromPlayerId, toPlayerId, cardsCount }],
          animationDuration,
          key: actionId
        });
        exchangeAnimationTimerRef.current = setTimeout(() => {
          setCardExchangeAnimation(null);
          exchangeAnimationTimerRef.current = null;
        }, animationDuration + 220);
      }
      const actionText = stage === 'return'
        ? `${fromPlayerName} 向 ${toPlayerName} 返还${cardsCount}张牌`
        : cardsCount > 0
          ? `${fromPlayerName} 交给 ${toPlayerName} ${cardsCount}张牌`
          : `${fromPlayerName} 选择不给牌`;
      messageApi.info(`同舟共济：${actionText}`, 3);
    });

    socket.on('mutual_support_hand_updated', ({ cards = [] }) => {
      setMyCards(cards);
      clearSelection();
      setMutualSupportSelectedCardIds([]);
    });

    socket.on('straw_boat_borrowing_arrows_required', payload => {
      setStrawBoatDecision(payload || null);
      setStrawBoatDiscardCardId(null);
      if (payload?.playerId === currentPlayer?.id) {
        messageApi.info('草船借箭：请选择一张非分数牌公开弃置，或放弃发动', 4);
      } else if (payload?.playerName) {
        messageApi.info(`${payload.playerName} 正在决定是否发动草船借箭`, 3);
      }
    });

    socket.on('straw_boat_borrowing_arrows_resolved', result => {
      setStrawBoatDecision(null);
      setStrawBoatDiscardCardId(null);
      if (result?.accepted) {
        messageApi.success(
          `${result.playerName} 发动草船借箭：公开弃置 ${formatPublicCard(result.discardedCard)}，获得 ${formatPublicCard(result.borrowedCard)}`,
          5
        );
      } else if (result?.playerName) {
        messageApi.info(`${result.playerName} 放弃发动草船借箭`, 3);
      }
    });

    socket.on('straw_boat_borrowing_arrows_hand_updated', ({ cards = [] }) => {
      setMyCards(cards);
      clearSelection();
    });

    socket.on('card_exchange_hand_updated', ({
      sentCardIds,
      receivedCards,
      fromPlayerName,
      ruleName = '换牌',
      operation = 'exchange',
      animationDuration
    }) => {
      if (exchangeHandUpdateTimerRef.current) {
        clearTimeout(exchangeHandUpdateTimerRef.current);
      }
      if (privateCardRevealTimerRef.current) {
        clearTimeout(privateCardRevealTimerRef.current);
        privateCardRevealTimerRef.current = null;
      }
      const incomingCards = Array.isArray(receivedCards) ? receivedCards : [];
      const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const effectiveDuration = Number.isFinite(animationDuration)
        ? animationDuration
        : exchangeAnimationDurationRef.current;
      if (operation !== 'discard' && incomingCards.length > 0) {
        setPrivateCardTransferReveal({
          ruleName,
          fromPlayerName,
          cards: incomingCards,
          revealDelay: prefersReducedMotion ? 0 : Math.round(effectiveDuration * 0.36),
          revealDuration: prefersReducedMotion ? 1800 : Math.round(effectiveDuration * 0.8),
          reducedMotion: Boolean(prefersReducedMotion),
          key: `${ruleName}-${Date.now()}`
        });
        privateCardRevealTimerRef.current = setTimeout(() => {
          setPrivateCardTransferReveal(null);
          privateCardRevealTimerRef.current = null;
        }, prefersReducedMotion ? 1800 : effectiveDuration + 680);
      } else {
        setPrivateCardTransferReveal(null);
      }
      // 先让牌背完成飞行、让接收者看清正面，再一次性更新和排序整手牌。
      const updateDelay = prefersReducedMotion
        ? 0
        : operation === 'discard'
          ? Math.max(
              Math.round(effectiveDuration * 0.82),
              exchangeAnimationEndsAtRef.current - Date.now() - 120
            )
          : Math.max(
              effectiveDuration + 180,
              exchangeAnimationEndsAtRef.current - Date.now() - 120
            );
      exchangeHandUpdateTimerRef.current = setTimeout(() => {
        setMyCards(mergeTransferredHandCards(
          useGameStore.getState().myCards,
          sentCardIds,
          incomingCards
        ));
        clearSelection();
        exchangeHandUpdateTimerRef.current = null;
        if (incomingCards.length > 0) {
          if (handArrivalHighlightTimerRef.current) {
            clearTimeout(handArrivalHighlightTimerRef.current);
          }
          setHandArrivalHighlight({
            cardIds: incomingCards.map(card => card.id),
            label: '收',
            kind: 'exchange'
          });
          handArrivalHighlightTimerRef.current = setTimeout(() => {
            setHandArrivalHighlight(null);
            handArrivalHighlightTimerRef.current = null;
          }, 1800);
        }
        if (fromPlayerName && incomingCards.length > 0) {
          messageApi.success(`已收到 ${fromPlayerName} 的 ${incomingCards.length} 张牌`);
        }
      }, updateDelay);
    });

    socket.on('whole_hand_exchange_resolved', ({
      ruleName,
      transfers,
      animationDuration = 1300,
      exchangeKind,
      actorPlayerName,
      targetPlayerName
    }) => {
      if (exchangeAnimationTimerRef.current) clearTimeout(exchangeAnimationTimerRef.current);
      const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const effectiveDuration = prefersReducedMotion ? 0 : animationDuration;
      exchangeAnimationDurationRef.current = effectiveDuration;
      if (effectiveDuration > 0) {
        setCardExchangeAnimation({
          kind: 'whole_hand',
          ruleName,
          transfers,
          animationDuration,
          key: Date.now()
        });
        exchangeAnimationTimerRef.current = setTimeout(() => {
          setCardExchangeAnimation(null);
          exchangeAnimationTimerRef.current = null;
        }, animationDuration + 320);
      }
      messageApi.info(
        exchangeKind === 'pair'
          ? `${ruleName}：${actorPlayerName} 与 ${targetPlayerName} 交换全部手牌`
          : `${ruleName}：全员整手交换`,
        3
      );
    });

    socket.on('whole_hand_exchange_hand_updated', ({ cards, fromPlayerName, exchangeKind }) => {
      if (exchangeHandUpdateTimerRef.current) {
        clearTimeout(exchangeHandUpdateTimerRef.current);
        exchangeHandUpdateTimerRef.current = null;
      }
      if (exchangeKind === 'pair') {
        // 釜底抽薪结算后庄家会立刻收底牌；先同步整手，避免延迟动画覆盖新收到的底牌。
        setMyCards(cards || []);
        clearSelection();
        messageApi.success(`收到 ${fromPlayerName || '反主者'} 的全部手牌`);
        return;
      }
      const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const updateDelay = prefersReducedMotion
        ? 0
        : Math.max(0, Math.round(exchangeAnimationDurationRef.current * 0.72));
      exchangeHandUpdateTimerRef.current = setTimeout(() => {
        setMyCards(cards || []);
        clearSelection();
        exchangeHandUpdateTimerRef.current = null;
        messageApi.success(`收到 ${fromPlayerName || '其他玩家'} 的全部手牌`);
      }, updateDelay);
    });

    socket.on('remove_firewood_exchange_started', ({ totalCount }) => {
      messageApi.info(`釜底抽薪：共有 ${totalCount} 次反主，开始由后向前询问`, 4);
    });
    socket.on('remove_firewood_decision_required', decision => {
      clearSelection();
      setRemoveFirewoodDecision(decision);
    });
    socket.on('remove_firewood_decision_resolved', ({
      counteredPlayerId,
      counteredPlayerName,
      counteringPlayerName,
      accepted
    }) => {
      if (counteredPlayerId === currentPlayer?.id) setRemoveFirewoodDecision(null);
      if (!accepted) {
        messageApi.info(`${counteredPlayerName} 选择不与 ${counteringPlayerName} 交换手牌`, 3);
      }
    });
    socket.on('remove_firewood_exchange_completed', ({ exchangedCount, totalCount }) => {
      setRemoveFirewoodDecision(null);
      messageApi.info(`釜底抽薪结算完成：${totalCount} 次机会中交换 ${exchangedCount} 次`, 3);
    });

    socket.on('last_stand_decision_required', ({ cardsCount, suit }) => {
      clearSelection();
      setLastStandDecision({ cardsCount, suit });
    });
    socket.on('last_stand_hand_updated', ({ cards }) => {
      setMyCards(cards || []);
      setLastStandDecision(null);
      clearSelection();
    });
    socket.on('last_stand_activated', ({ playerName, cardsCount }) => {
      messageApi.success(`${playerName} 发动绝处逢生，${cardsCount} 张牌全部视为主牌`, 4);
    });

    socket.on('teammate_cheer_decision_required', payload => {
      clearSelection();
      setTeammateCheerDecision(payload);
    });
    socket.on('teammate_cheer_hand_updated', ({ cards = [] }) => {
      setMyCards(cards);
      clearSelection();
    });
    socket.on('teammate_cheer_activated', ({ playerName, buffedPlayerName }) => {
      setTeammateCheerDecision(null);
      messageApi.success(
        `${playerName} 发动队友加油：${buffedPlayerName} 获得永久牌面 +1 Buff`,
        5
      );
    });
    socket.on('teammate_cheer_declined', ({ playerName }) => {
      setTeammateCheerDecision(null);
      messageApi.info(`${playerName} 暂不发动队友加油`, 3);
    });
    socket.on('teammate_cheer_reverted', ({ playerName, buffedPlayerName }) => {
      setTeammateCheerDecision(null);
      messageApi.info(
        `${playerName} 撤回出牌，${buffedPlayerName} 的队友加油 Buff 已同步撤销`,
        4
      );
    });

    socket.on('afterglow_decision_required', payload => {
      clearSelection();
      setAfterglowDecision(payload);
    });
    socket.on('afterglow_hand_updated', ({ cards = [] }) => {
      setMyCards(cards);
      clearSelection();
    });
    socket.on('afterglow_activated', ({ playerName }) => {
      setAfterglowDecision(null);
      messageApi.success(
        `${playerName} 发动回光返照：剩余主牌立即 +1，只要仍有主牌，每次只能出主牌`,
        5
      );
    });
    socket.on('afterglow_declined', ({ playerName }) => {
      setAfterglowDecision(null);
      messageApi.info(`${playerName} 暂不发动回光返照`, 3);
    });
    socket.on('afterglow_expired', ({ playerName }) => {
      messageApi.info(`${playerName} 的主牌已经出尽，回光返照效果结束`, 3);
    });
    socket.on('afterglow_reverted', ({ playerName, activationReverted, effectRestored }) => {
      setAfterglowDecision(null);
      messageApi.info(
        activationReverted
          ? `${playerName} 撤回出牌，回光返照的发动已同步撤销`
          : effectRestored
            ? `${playerName} 撤回出牌，回光返照效果已恢复`
            : `${playerName} 的回光返照状态已同步`,
        4
      );
    });

    socket.on('wooden_ox_decision_required', payload => {
      setWoodenOxDecision(payload);
      setWoodenOxSelectedCardId(null);
    });
    socket.on('wooden_ox_private_state', payload => {
      setWoodenOxPrivateState(payload);
    });
    socket.on('wooden_ox_hand_updated', ({ cards = [] }) => {
      setMyCards(cards);
    });
    socket.on('wooden_ox_action_recorded', () => {
      setWoodenOxDecision(null);
      setWoodenOxSelectedCardId(null);
    });
    socket.on('wooden_ox_round_ready', () => {
      setWoodenOxDecision(null);
      setWoodenOxSelectedCardId(null);
    });
    socket.on('wooden_ox_transferred', ({ fromPlayerName, toPlayerName, transfersUsed }) => {
      messageApi.info(
        `木牛流马：${fromPlayerName}交给${toPlayerName}（第${transfersUsed}次单程传递）`,
        3
      );
    });

    socket.on('strength_compensation_hand_updated', ({ cards = [] }) => {
      clearSelection();
      setMyCards(cards);
    });

    socket.on('defense_as_offense_hand_updated', ({ cards = [] }) => {
      clearSelection();
      setMyCards(cards);
    });

    socket.on('time_reversal_activated', ({ playerId, playerName, round }) => {
      clearSelection();
      messageApi.info(
        playerId === currentPlayer?.id
          ? `已预备第${round}轮时间倒流，轮末再确认是否发动`
          : `${playerName} 已预备第${round}轮时间倒流`,
        4
      );
    });
    socket.on('time_reversal_decision_required', ({ round }) => {
      clearSelection();
      setTimeReversalDecision({ round });
    });
    socket.on('time_reversal_hand_restored', ({ cards }) => {
      setMyCards(cards || []);
      clearSelection();
    });
    socket.on('time_reversal_response_recorded', ({ playerName, pendingPlayerIds = [] }) => {
      messageApi.info(
        `${playerName} 选择保留本轮结果，仍等待 ${pendingPlayerIds.length} 名预备者决定`,
        4
      );
    });
    socket.on('time_reversal_resolved', ({ accepted, playerName, round, reason }) => {
      setTimeReversalDecision(null);
      if (!accepted) {
        if (reason === 'all_declined') {
          messageApi.info(`所有预备者均保留第${round}轮结果，未发动时间倒流`, 4);
        }
        return;
      }
      if (roundClearTimerRef.current) {
        clearTimeout(roundClearTimerRef.current);
        roundClearTimerRef.current = null;
      }
      awaitingRoundClearRef.current = false;
      heldCompletedRoundNumberRef.current = null;
      playedCardsRef.current = {};
      setPlayedCards({});
      setLastRoundPlayedCards({});
      setPlayHistory([]);
      setCurrentWinningPlayerId(null);
      setLastRoundWinnerPlayerId(null);
      setViewingLastRound(false);
      setIsHoldingCompletedRound(false);
      setHeldCompletedRoundNumber(null);
      messageApi.success(`${playerName} 发动时间倒流：重新开始第${round}轮`, 4);
    });

    socket.on('forbidden_magic_reserved', ({ playerId, playerName, targetRound }) => {
      messageApi.info(
        playerId === currentPlayer?.id
          ? `已预备禁术秘法，将在第${targetRound}轮开始时确认`
          : `${playerName} 已预备禁术秘法`,
        4
      );
    });
    socket.on('forbidden_magic_decision_required', ({ round }) => {
      clearSelection();
      setForbiddenMagicDecision({ round });
    });
    socket.on('forbidden_magic_activated', ({ playerId, playerName }) => {
      if (playerId === currentPlayer?.id) {
        setForbiddenMagicDecision(null);
        clearSelection();
        setExplicitCardTransformations({});
        setCardTransformationDialog(null);
      }
      messageApi.success(`${playerName} 发动禁术秘法，本局永久生效`, 4);
    });
    socket.on('forbidden_magic_declined', ({ playerId, playerName }) => {
      if (playerId === currentPlayer?.id) setForbiddenMagicDecision(null);
      messageApi.info(`${playerName} 暂不发动禁术秘法，未消耗技能`, 3);
    });
    socket.on('forbidden_magic_decisions_completed', () => {
      setForbiddenMagicDecision(null);
    });

    socket.on('lure_tiger_reserved', ({ playerId, playerName, targetRound }) => {
      messageApi.info(
        playerId === currentPlayer?.id
          ? `已预备调虎离山，将在第${targetRound}轮开始时确认`
          : `${playerName} 已预备调虎离山`,
        4
      );
    });
    socket.on('lure_tiger_decision_required', decision => {
      clearSelection();
      setLureTigerDecision(decision);
    });
    socket.on('lure_tiger_target_required', decision => {
      clearSelection();
      setLureTigerDecision(decision);
    });
    socket.on('lure_tiger_activated', ({
      playerId,
      playerName,
      targetPlayerName
    }) => {
      if (playerId === currentPlayer?.id) setLureTigerDecision(null);
      messageApi.warning(
        `${playerName} 发动调虎离山：${targetPlayerName} 本轮沉默，出牌不计大小与分数`,
        5
      );
    });
    socket.on('lure_tiger_declined', ({ playerId, playerName }) => {
      if (playerId === currentPlayer?.id) setLureTigerDecision(null);
      messageApi.info(`${playerName} 暂不发动调虎离山，未占用本方次数`, 3);
    });
    socket.on('lure_tiger_decisions_completed', () => {
      setLureTigerDecision(null);
    });

    // 玩家展示手牌
    socket.on('cards_shown', ({ playerId, playerName, cards }) => {
      messageApi.info(`${playerName} 展示了 ${cards.length} 张牌`);
      // 更新该玩家的展示牌区域（覆盖之前的牌）
      setShownCards(prev => ({
        ...prev,
        [playerId]: { playerName, cards }
      }));
    });

    // 收到底牌（埋底玩家）
    socket.on('bottom_cards_received', ({
      bottomCards,
      totalCards,
      administrativeReview = false
    }) => {
      const receivedBottomCards = Array.isArray(bottomCards) ? bottomCards : [];
      if (bottomCardsMergeTimerRef.current) {
        clearTimeout(bottomCardsMergeTimerRef.current);
      }
      if (handArrivalHighlightTimerRef.current) {
        clearTimeout(handArrivalHighlightTimerRef.current);
        handArrivalHighlightTimerRef.current = null;
      }
      if (receivedBottomCards.length === 0) {
        setBottomPickup(null);
        messageApi.info('本局没有底牌');
      } else {
        const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        const pickupKey = `bottom-${Date.now()}`;
        const pickupTitle = administrativeReview ? '行政审查 · 解封底牌' : '庄家拿起底牌';
        const revealDelay = prefersReducedMotion
          ? 0
          : Math.max(0, exchangeAnimationEndsAtRef.current - Date.now() + 100);
        setBottomPickup({
          cards: receivedBottomCards,
          title: pickupTitle,
          visible: revealDelay === 0,
          merged: false,
          key: pickupKey
        });
        bottomCardsMergeTimerRef.current = setTimeout(() => {
          setBottomPickup(previous => previous?.key === pickupKey
            ? { ...previous, visible: true }
            : previous);
          bottomCardsMergeTimerRef.current = setTimeout(() => {
            setMyCards(mergeTransferredHandCards(
              useGameStore.getState().myCards,
              [],
              receivedBottomCards
            ));
            setHandArrivalHighlight({
              cardIds: receivedBottomCards.map(card => card.id),
              kind: 'bottom'
            });
            setBottomPickup(previous => previous?.key === pickupKey
              ? { ...previous, merged: true }
              : previous);
            clearSelection();
            bottomCardsMergeTimerRef.current = null;
            messageApi.success(
              `收到 ${receivedBottomCards.length} 张底牌，牌面已换色 · 当前共 ${totalCards} 张牌`,
              4
            );
          }, prefersReducedMotion ? 0 : 520);
        }, revealDelay);
      }
    });

    socket.on('secondary_burying_started', ({
      dealerPlayerId,
      secondaryPlayerId,
      secondaryPlayerName,
      cardsCount = 8,
      animationDuration = 1400
    }) => {
      clearSelection();
      if (exchangeAnimationTimerRef.current) {
        clearTimeout(exchangeAnimationTimerRef.current);
      }
      const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const effectiveDuration = prefersReducedMotion ? 0 : animationDuration;
      exchangeAnimationDurationRef.current = effectiveDuration;
      if (effectiveDuration > 0) {
        setCardExchangeAnimation({
          kind: 'secondary_bury',
          ruleName: '改革开放 · 底牌交接',
          transfers: [{
            fromPlayerId: dealerPlayerId,
            toPlayerId: secondaryPlayerId,
            cardsCount
          }],
          animationDuration,
          key: Date.now()
        });
        const delayedCardsDuration = Math.max(0, cardsCount - 1) * 90;
        exchangeAnimationEndsAtRef.current = Date.now()
          + animationDuration + delayedCardsDuration + 220;
        exchangeAnimationTimerRef.current = setTimeout(() => {
          setCardExchangeAnimation(null);
          exchangeAnimationTimerRef.current = null;
          exchangeAnimationEndsAtRef.current = 0;
        }, animationDuration + delayedCardsDuration + 220);
      } else {
        setCardExchangeAnimation(null);
        exchangeAnimationEndsAtRef.current = 0;
      }
      messageApi.info(`改革开放：底牌交给 ${secondaryPlayerName} 重新埋底`, 4);
    });

    socket.on('secondary_bottom_cards_received', ({ bottomCards, totalCards }) => {
      if (exchangeHandUpdateTimerRef.current) {
        clearTimeout(exchangeHandUpdateTimerRef.current);
      }
      const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const updateDelay = prefersReducedMotion
        ? 0
        : Math.max(0, exchangeAnimationEndsAtRef.current - Date.now() + 100);
      exchangeHandUpdateTimerRef.current = setTimeout(() => {
        const receivedBottomCards = Array.isArray(bottomCards) ? bottomCards : [];
        setBottomPickup(receivedBottomCards.length > 0 ? {
          cards: receivedBottomCards,
          title: '改革开放 · 接过底牌',
          visible: true,
          merged: true,
          key: `secondary-bottom-${Date.now()}`
        } : null);
        setMyCards(mergeTransferredHandCards(
          useGameStore.getState().myCards,
          [],
          receivedBottomCards
        ));
        if (handArrivalHighlightTimerRef.current) {
          clearTimeout(handArrivalHighlightTimerRef.current);
          handArrivalHighlightTimerRef.current = null;
        }
        setHandArrivalHighlight(receivedBottomCards.length > 0 ? {
          cardIds: receivedBottomCards.map(card => card.id),
          kind: 'bottom'
        } : null);
        clearSelection();
        exchangeHandUpdateTimerRef.current = null;
        messageApi.success(`拿起 ${receivedBottomCards.length} 张底牌，牌面已换色 · 当前共 ${totalCards} 张牌`, 4);
      }, updateDelay);
    });

    // 埋底玩家设置
    socket.on('burying_player_set', ({ playerName }) => {
      messageApi.info(`${playerName} 被指定为庄家`);
    });

    socket.on('dealer_selected', ({ playerName }) => {
      messageApi.info(`主牌与庄家已锁定：${playerName}`);
    });

    socket.on('open_hand_revealed', ({ playerName, controllerPlayerName }) => {
      clearSelection();
      messageApi.info(`算无遗策：${playerName} 明牌，由 ${controllerPlayerName} 代打`, 4);
    });

    socket.on('iceberg_reveal_selection_required', ({
      reason,
      requiredCount,
      targetCount,
      currentlyRevealedCardIds = []
    }) => {
      clearSelection();
      setIcebergSelection({
        reason,
        requiredCount,
        targetCount,
        currentlyRevealedCardIds,
        isSubmitted: false
      });
      messageApi.info(reason === 'initial'
        ? `冰山一角：请选择 ${requiredCount} 张牌明置`
        : `请补选 ${requiredCount} 张牌明置`);
    });

    socket.on('iceberg_reveal_selection_confirmed', () => {
      setIcebergSelection(previous => previous
        ? { ...previous, isSubmitted: true }
        : previous);
      messageApi.success('明牌选择已确认');
    });

    socket.on('waiting_rabbit_selection_started', () => {
      clearSelection();
      messageApi.info('守株待兔：四家分别暗中指定一张目标牌');
    });

    socket.on('waiting_rabbit_selection_required', ({
      eligibleSuits = [],
      eligibleRanks = [],
      trumpRank: levelRank
    }) => {
      setSelectedWaitingRabbitSuit(null);
      setSelectedWaitingRabbitRank(null);
      setWaitingRabbitSelection({ eligibleSuits, eligibleRanks, trumpRank: levelRank });
    });

    socket.on('waiting_rabbit_target_selected', ({ suit, rank }) => {
      setWaitingRabbitPrivateTarget({ suit, rank });
      setWaitingRabbitSelection(null);
      setSelectedWaitingRabbitSuit(null);
      setSelectedWaitingRabbitRank(null);
      messageApi.success(`守株待兔目标已暗定为 ${formatPublicCard({ suit, rank })}`);
    });

    socket.on('waiting_rabbit_target_locked', ({ playerId, playerName, remainingCount }) => {
      if (playerId !== currentPlayer?.id) {
        messageApi.info(`${playerName} 已完成守株待兔暗选（剩余${remainingCount}人）`);
      }
    });

    socket.on('waiting_rabbit_triggered', ({ sourcePlayerName, chooserPlayerName, targetCard }) => {
      messageApi.warning(
        `守株待兔轮末：${sourcePlayerName} 打出了 ${formatPublicCard(targetCard)}，等待 ${chooserPlayerName} 决定是否交换`,
        5
      );
    });

    socket.on('waiting_rabbit_exchange_required', payload => {
      clearSelection();
      setWaitingRabbitDiscardCardId(null);
      setWaitingRabbitDecision(payload);
    });

    socket.on('waiting_rabbit_resolved', ({
      chooserPlayerId,
      chooserPlayerName,
      sourcePlayerId,
      sourcePlayerName,
      targetCard,
      discardedCard,
      tableCards,
      accepted
    }) => {
      if (chooserPlayerId === currentPlayer?.id) {
        setWaitingRabbitDecision(null);
        setWaitingRabbitDiscardCardId(null);
      }
      if (accepted && Array.isArray(tableCards)) {
        setPlayedCards(previous => {
          const sourcePlay = previous[sourcePlayerId];
          if (!sourcePlay) return previous;
          const updated = {
            ...previous,
            [sourcePlayerId]: {
              ...sourcePlay,
              cards: tableCards
            }
          };
          playedCardsRef.current = updated;
          return updated;
        });
      }
      messageApi.info(accepted
        ? `守株待兔轮末：${chooserPlayerName} 用 ${formatPublicCard(discardedCard)} 换走了 ${sourcePlayerName} 的 ${formatPublicCard(targetCard)}`
        : `守株待兔轮末：${chooserPlayerName} 放弃交换 ${formatPublicCard(targetCard)}`,
      5);
    });

    socket.on('waiting_rabbit_hand_updated', ({ cards = [] }) => {
      setMyCards(cards);
      clearSelection();
    });

    socket.on('ten_sided_ambush_selection_started', ({ selectorPlayerId, selectorPlayerName }) => {
      clearSelection();
      if (selectorPlayerId !== currentPlayer?.id) {
        messageApi.info(`十面埋伏：等待 ${selectorPlayerName} 暗中指定点数`);
      }
    });

    socket.on('ten_sided_ambush_selection_required', ({ eligibleRanks = [], trumpRank }) => {
      clearSelection();
      setSelectedTenSidedAmbushRank(null);
      setTenSidedAmbushSelection({ eligibleRanks, trumpRank });
      messageApi.info('十面埋伏：请暗中指定一个点数');
    });

    socket.on('ten_sided_ambush_rank_selected', ({ rank }) => {
      setTenSidedAmbushPrivateRank(rank);
      setTenSidedAmbushSelection(null);
      setSelectedTenSidedAmbushRank(null);
      messageApi.success(`已暗中指定 ${rank}，首次出现前仅你可见`, 4);
    });

    socket.on('ten_sided_ambush_rank_locked', ({ selectorPlayerId, selectorPlayerName }) => {
      if (selectorPlayerId !== currentPlayer?.id) {
        messageApi.info(`${selectorPlayerName} 已完成十面埋伏布置，点数仍未揭晓`);
      }
    });

    socket.on('ten_sided_ambush_revealed', ({ rank, source = 'play', playerName = null }) => {
      if (tenSidedAmbushAnimationTimerRef.current) {
        clearTimeout(tenSidedAmbushAnimationTimerRef.current);
      }
      setTenSidedAmbushPrivateRank(rank);
      setTenSidedAmbushRevealAnimation({ rank, source, playerName, key: Date.now() });
      tenSidedAmbushAnimationTimerRef.current = setTimeout(() => {
        setTenSidedAmbushRevealAnimation(null);
        tenSidedAmbushAnimationTimerRef.current = null;
      }, 1800);
      messageApi.warning(source === 'bottom'
        ? `底牌揭示十面埋伏点数：${rank}`
        : `十面埋伏揭晓：${rank}`, 4);
    });

    socket.on('three_powers_selection_started', ({ slots = [] }) => {
      clearSelection();
      const ownSlot = slots.find(slot => slot.selectorPlayerId === currentPlayer?.id);
      if (!ownSlot) {
        messageApi.info('三权分立：等待2、3、4号位暗选重载点数');
      }
    });

    socket.on('three_powers_selection_required', ({
      sourceRank,
      pointValue,
      selectorPosition,
      eligibleRanks = [],
      trumpRank: levelRank
    }) => {
      clearSelection();
      setSelectedThreePowersRank(null);
      setThreePowersSelection({
        sourceRank,
        pointValue,
        selectorPosition,
        eligibleRanks,
        trumpRank: levelRank
      });
      messageApi.info(`三权分立：请暗选重载原${sourceRank}分牌的点数`);
    });

    socket.on('three_powers_rank_selected', ({ sourceRank, pointValue, rank }) => {
      setThreePowersPrivateRanks(previous => ({ ...previous, [sourceRank]: rank }));
      setThreePowersSelection(null);
      setSelectedThreePowersRank(null);
      messageApi.success(`已暗选 ${rank} 作为新的${pointValue}分牌，首次出现前仅你可见`, 4);
    });

    socket.on('three_powers_rank_locked', ({ selectorPlayerId, sourceRank, selectorPlayerName }) => {
      if (selectorPlayerId !== currentPlayer?.id) {
        messageApi.info(`${selectorPlayerName} 已完成原${sourceRank}分牌重载，点数仍未揭晓`);
      }
    });

    socket.on('three_powers_revealed', ({ slots = [], source = 'play', playerName = null }) => {
      if (threePowersAnimationTimerRef.current) {
        clearTimeout(threePowersAnimationTimerRef.current);
      }
      setThreePowersPrivateRanks(previous => ({
        ...previous,
        ...Object.fromEntries(slots.map(slot => [slot.sourceRank, slot.rank]))
      }));
      setThreePowersRevealAnimation({ slots, source, playerName, key: Date.now() });
      threePowersAnimationTimerRef.current = setTimeout(() => {
        setThreePowersRevealAnimation(null);
        threePowersAnimationTimerRef.current = null;
      }, 1800);
      const revealText = slots.map(slot => `${slot.sourceRank}→${slot.rank}`).join('，');
      messageApi.warning(
        source === 'bottom'
          ? `底牌揭晓三权分立：${revealText}`
          : `三权分立揭晓：${revealText}`,
        4
      );
    });

    socket.on('gentleman_promise_selection_started', () => {
      clearSelection();
      messageApi.info('君子一言：正在声明各自最少的有效花色');
    });

    socket.on('gentleman_promise_selection_required', ({
      eligibleSuits = [],
      suitCounts = {},
      minimumCount = 0
    }) => {
      clearSelection();
      setSelectedGentlemanPromiseSuit(null);
      setGentlemanPromiseSelection({ eligibleSuits, suitCounts, minimumCount });
      messageApi.info('君子一言：请选择一个并列最短的有效花色');
    });

    socket.on('gentleman_promise_declared', ({ playerId, playerName, suit, source }) => {
      if (playerId === currentPlayer?.id) {
        setGentlemanPromiseSelection(null);
        setSelectedGentlemanPromiseSuit(null);
      }
      const suitLabel = EFFECTIVE_SUIT_LABELS[suit] || suit;
      messageApi.success(
        source === 'system'
          ? `君子一言：${playerName} 的唯一最短花色为 ${suitLabel}，系统已代为声明`
          : `君子一言：${playerName} 声明 ${suitLabel}`,
        3
      );
    });

    socket.on('gentleman_promise_completed', () => {
      setGentlemanPromiseSelection(null);
      setSelectedGentlemanPromiseSuit(null);
      messageApi.success('君子一言：四家声明完成，开始出牌');
    });

    socket.on('hidden_dragon_selection_started', () => {
      clearSelection();
      messageApi.info('潜龙在渊：正在声明各自最多的非级牌点数');
    });

    socket.on('hidden_dragon_selection_required', ({
      eligibleRanks = [],
      rankCounts = {},
      maximumCount = 0,
      trumpRank = null
    }) => {
      clearSelection();
      setSelectedHiddenDragonRank(null);
      setHiddenDragonSelection({ eligibleRanks, rankCounts, maximumCount, trumpRank });
      messageApi.info('潜龙在渊：请选择一个并列最多的点数');
    });

    socket.on('hidden_dragon_declared', ({ playerId, playerName, rank, source }) => {
      if (playerId === currentPlayer?.id) {
        setHiddenDragonSelection(null);
        setSelectedHiddenDragonRank(null);
      }
      messageApi.success(
        source === 'system'
          ? `潜龙在渊：${playerName} 的唯一最多点数为 ${rank}，系统已代为声明`
          : `潜龙在渊：${playerName} 声明 ${rank}`,
        3
      );
    });

    socket.on('hidden_dragon_completed', () => {
      setHiddenDragonSelection(null);
      setSelectedHiddenDragonRank(null);
      messageApi.success('潜龙在渊：四家声明完成，开始出牌');
    });

    socket.on('hidden_dragon_resolved', ({ playerName, declaredRank, success }) => {
      if (success) {
        messageApi.success(`潜龙在渊：${playerName} 从未打出 ${declaredRank}，所属阵营获得10分`, 4);
      } else {
        messageApi.warning(`潜龙在渊：${playerName} 已经打出过 ${declaredRank}，本次未得分`, 4);
      }
    });

    socket.on('antinomy_selection_started', ({ stage }) => {
      clearSelection();
      messageApi.info(
        stage === 'opening'
          ? '二律背反：庄家已埋底，四家开始选择牌面'
          : '二律背反：命中声明牌面的玩家正在重新选择'
      );
    });

    socket.on('antinomy_selection_required', ({
      stage = 'opening',
      triggerRound = null,
      eligibleSuits = [],
      eligibleRanks = [],
      currentDeclaration = null
    }) => {
      clearSelection();
      setSelectedAntinomySuit(null);
      setSelectedAntinomyRank(null);
      setAntinomySelection({
        stage,
        triggerRound,
        eligibleSuits,
        eligibleRanks,
        currentDeclaration
      });
    });

    socket.on('antinomy_selection_submitted', ({ playerId, playerName, pendingPlayerIds = [] }) => {
      if (playerId === currentPlayer?.id) {
        setAntinomySelection(null);
        setSelectedAntinomySuit(null);
        setSelectedAntinomyRank(null);
      }
      messageApi.info(
        `二律背反：${playerName} 已提交选择，仍待 ${pendingPlayerIds.length} 人`,
        3
      );
    });

    socket.on('antinomy_declarations_revealed', ({ stage }) => {
      setAntinomySelection(null);
      setSelectedAntinomySuit(null);
      setSelectedAntinomyRank(null);
      messageApi.success(
        stage === 'opening'
          ? '二律背反：四家声明同时亮出，现在可以开始出牌'
          : '二律背反：重选声明同时更新，现在可以开始下一轮',
        4
      );
    });

    socket.on('rice_to_mulberry_selection_started', () => {
      clearSelection();
      messageApi.info('改稻为桑：两名闲家正在选择要改造的分牌');
    });

    socket.on('rice_to_mulberry_selection_required', ({
      requiredCount = 0,
      eligibleCardIds = []
    }) => {
      clearSelection();
      setSelectedRiceToMulberryCardIds([]);
      setRiceToMulberrySelection({ requiredCount, eligibleCardIds });
    });

    socket.on('rice_to_mulberry_hand_updated', ({ cards = [] }) => {
      setMyCards(cards);
      clearSelection();
      setRiceToMulberrySelection(null);
      setSelectedRiceToMulberryCardIds([]);
    });

    socket.on('rice_to_mulberry_transformed', ({
      playerId,
      playerName,
      transformedCount = 0,
      pendingPlayerIds = []
    }) => {
      if (playerId === currentPlayer?.id) {
        setRiceToMulberrySelection(null);
        setSelectedRiceToMulberryCardIds([]);
      }
      messageApi.info(
        `改稻为桑：${playerName}已改造${transformedCount}张分牌，仍待${pendingPlayerIds.length}人`,
        3
      );
    });

    socket.on('rice_to_mulberry_completed', () => {
      setRiceToMulberrySelection(null);
      setSelectedRiceToMulberryCardIds([]);
      messageApi.success('改稻为桑：两名闲家均已完成改造，现在可以开始出牌', 4);
    });

    socket.on('surrender_requested', ({ initiatorPlayerId, initiatorPlayerName }) => {
      messageApi.warning(
        initiatorPlayerId === currentPlayer?.id
          ? '已发起投降，本墩完整结束后将询问你的队友'
          : `${initiatorPlayerName}发起了投降，本墩结束后处理`,
        4
      );
    });

    socket.on('surrender_decision_pending', ({ initiatorPlayerName, teammatePlayerName }) => {
      messageApi.info(
        `投降表决：正在询问${teammatePlayerName}是否同意${initiatorPlayerName}投降`,
        4
      );
    });

    socket.on('surrender_decision_required', decision => {
      clearSelection();
      setSurrenderDecision(decision);
    });

    socket.on('surrender_rejected', ({ initiatorPlayerName, teammatePlayerName }) => {
      setSurrenderDecision(null);
      messageApi.success(
        `${teammatePlayerName}不同意${initiatorPlayerName}投降，牌局继续`,
        4
      );
    });

    socket.on('game_surrendered', ({ initiatorPlayerName, winningSide }) => {
      setSurrenderDecision(null);
      messageApi.warning(
        `${initiatorPlayerName}一方投降，${winningSide === 'attacker' ? '闲家方' : '庄家方'}获胜`,
        5
      );
    });

    socket.on('destroy_dyke_decision_pending', ({ dealerPlayerName, roundPoints }) => {
      clearSelection();
      messageApi.info(`毁堤淹田：闲家赢得${roundPoints}分，等待${dealerPlayerName}决定`, 4);
    });

    socket.on('destroy_dyke_decision_required', (decision) => {
      clearSelection();
      setDestroyDykeDecision(decision);
    });

    socket.on('destroy_dyke_activated', ({
      dealerPlayerId,
      dealerPlayerName,
      voidedPoints
    }) => {
      setDestroyDykeDecision(null);
      showSkillActivation({
        id: 'destroy_dyke_flood_fields',
        name: '毁堤淹田',
        playerId: dealerPlayerId,
        playerName: dealerPlayerName,
        variant: 'destroy-dyke',
        actionLabel: '发动规则',
        detail: `本轮 ${voidedPoints} 分封存 · 三轮灾期开始`
      });
      messageApi.warning(
        `毁堤淹田：${dealerPlayerName}令本轮${voidedPoints}分作废，三轮灾期开始`,
        5
      );
    });

    socket.on('destroy_dyke_declined', () => {
      setDestroyDykeDecision(null);
      messageApi.info('毁堤淹田：庄家本轮不发动，分数照常结算', 3);
    });

    socket.on('destroy_dyke_disaster_updated', ({
      roundsElapsed,
      disasterAttackerPoints
    }) => {
      messageApi.info(
        `毁堤淹田：灾期${roundsElapsed}/3，闲家已累计${disasterAttackerPoints}/20分`,
        4
      );
    });

    socket.on('destroy_dyke_disaster_resolved', ({
      status,
      returnedPoints = 0,
      incidentBonus = 0,
      voidedPoints = 0
    }) => {
      if (status === 'incident') {
        messageApi.error(
          `毁堤淹田事发：返还${returnedPoints}分并额外获得${incidentBonus}分`,
          6
        );
      } else {
        messageApi.success(`毁堤淹田：灾期结束，${voidedPoints}分永久作废`, 5);
      }
    });

    socket.on('hidden_dragon_reverted', ({ playerName }) => {
      messageApi.info(`潜龙在渊：${playerName} 撤回出牌，本次判定已回退`);
    });

    socket.on('administrative_review_selection_started', ({
      suitSelectorPlayerName,
      rankSelectorPlayerName
    }) => {
      clearSelection();
      messageApi.info(
        `行政审查：${suitSelectorPlayerName}公开指定副花色，${rankSelectorPlayerName}公开指定点数`,
        4
      );
    });

    socket.on('administrative_review_selection_required', ({
      type,
      eligibleOptions = [],
      trumpSuit: reviewTrumpSuit,
      trumpRank: reviewTrumpRank
    }) => {
      clearSelection();
      setSelectedAdministrativeReviewValue(null);
      setAdministrativeReviewSelection({
        type,
        eligibleOptions,
        trumpSuit: reviewTrumpSuit,
        trumpRank: reviewTrumpRank
      });
    });

    socket.on('administrative_review_declared', ({ playerId, playerName, type, value }) => {
      if (playerId === currentPlayer?.id) {
        setAdministrativeReviewSelection(null);
        setSelectedAdministrativeReviewValue(null);
      }
      const valueLabel = type === 'suit'
        ? (EFFECTIVE_SUIT_LABELS[value] || value)
        : value;
      messageApi.success(
        `行政审查：${playerName}公开指定${type === 'suit' ? '副花色' : '点数'} ${valueLabel}`,
        4
      );
    });

    socket.on('administrative_review_completed', ({ dealerPlayerName }) => {
      setAdministrativeReviewSelection(null);
      setSelectedAdministrativeReviewValue(null);
      messageApi.success(`行政审查声明完成，${dealerPlayerName}先出；底牌仍不可查看`, 4);
    });

    socket.on('administrative_review_progressed', ({
      playerName,
      suitMatched,
      rankMatched
    }) => {
      messageApi.info(
        `行政审查：${playerName}推进审查（副花色${suitMatched ? '已满足' : '未满足'}，点数${rankMatched ? '已满足' : '未满足'}）`,
        3
      );
    });

    socket.on('administrative_review_burying_unlocked', ({ dealerPlayerName }) => {
      clearSelection();
      messageApi.success(`行政审查条件全部满足，${dealerPlayerName}现在查看底牌并埋12张`, 5);
    });

    socket.on('administrative_review_buried', ({ dealerPlayerName, currentRound }) => {
      messageApi.success(`行政审查：${dealerPlayerName}埋底完成，继续第${currentRound}轮`, 4);
    });

    socket.on('political_review_play_pending', ({
      teammatePlayerId,
      teammatePlayerName,
      cards = []
    }) => {
      const startsNewRound = awaitingRoundClearRef.current;
      if (startsNewRound) {
        if (roundClearTimerRef.current) {
          clearTimeout(roundClearTimerRef.current);
          roundClearTimerRef.current = null;
        }
        awaitingRoundClearRef.current = false;
        heldCompletedRoundNumberRef.current = null;
        setIsHoldingCompletedRound(false);
        setHeldCompletedRoundNumber(null);
      }
      const updated = {
        ...(startsNewRound ? {} : playedCardsRef.current),
        [teammatePlayerId]: {
          playerName: teammatePlayerName,
          cards,
          cardsCount: cards.length,
          politicalReviewPending: true
        }
      };
      playedCardsRef.current = updated;
      setPlayedCards(updated);
    });

    socket.on('political_review_play_held', ({ teammatePlayerName }) => {
      clearSelection();
      messageApi.info(`政治审查：${teammatePlayerName}的出牌正在等待队友表态`, 3);
    });

    socket.on('political_review_decision_required', request => {
      setPoliticalReviewDecision(request);
    });

    socket.on('political_review_play_approved', ({
      id,
      cardIds = [],
      controlledPlayerId = null,
      activeSkillId = null,
      jokerSubstitutions = [],
      clusterAnalysisSubstitutions = [],
      forbiddenMagicSubstitutions = [],
      divineWeaponCardId = null,
      divineWeaponSourceCardId = null,
      ambiguousAlternativeCardIds = []
    }) => {
      if (!id || politicalReviewApprovalSubmittingRef.current.has(id)) return;
      politicalReviewApprovalSubmittingRef.current.add(id);
      socket.emit(SOCKET_EVENTS.PLAY_CARDS, {
        roomId: currentRoom.id,
        cardIds,
        controlledPlayerId,
        activeSkillId,
        jokerSubstitutions,
        clusterAnalysisSubstitutions,
        forbiddenMagicSubstitutions,
        divineWeaponCardId,
        divineWeaponSourceCardId,
        ambiguousAlternativeCardIds,
        politicalReviewApprovalId: id
      });
    });

    socket.on('political_review_resolved', ({
      reviewerPlayerId,
      reviewerPlayerName,
      teammatePlayerId,
      teammatePlayerName,
      cards = [],
      returned
    }) => {
      if (reviewerPlayerId === currentPlayer?.id) setPoliticalReviewDecision(null);
      const cardsLabel = cards.map(formatPublicCard).join('、');
      if (returned) {
        const updated = { ...playedCardsRef.current };
        delete updated[teammatePlayerId];
        playedCardsRef.current = updated;
        setPlayedCards(updated);
        if (teammatePlayerId === currentPlayer?.id) {
          setJustPlayedCards(false);
          clearSelection();
        }
        messageApi.warning(
          `${reviewerPlayerName}令${teammatePlayerName}收回 ${cardsLabel || '本次出牌'}；没有禁出限制，可以原样再出`,
          5
        );
      } else {
        messageApi.success(`${reviewerPlayerName}放行${teammatePlayerName}的本次出牌`, 3);
      }
    });

    socket.on('focus_figure_voting_started', () => {
      clearSelection();
      setFocusFigurePrivate(null);
      messageApi.info('焦点人物：两队开始秘密表决本队焦点');
    });

    socket.on('focus_figure_vote_required', ({
      team,
      attempt,
      nomineePlayerId,
      nomineePlayerName
    }) => {
      clearSelection();
      setFocusFigureVote({ team, attempt, nomineePlayerId, nomineePlayerName });
    });

    socket.on('focus_figure_vote_recorded', ({
      voterPlayerName,
      agree,
      voteCount
    }) => {
      messageApi.info(`${voterPlayerName}${agree ? '同意' : '反对'}当前候选（${voteCount}/2）`);
    });

    socket.on('focus_figure_nominee_changed', ({ nomineePlayerName }) => {
      messageApi.warning(`本队未能一致通过，焦点候选改为 ${nomineePlayerName}，请重新表决`, 4);
    });

    socket.on('focus_figure_team_finalized', ({ team, focusPlayerId, focusPlayerName }) => {
      setFocusFigureVote(null);
      setFocusFigurePrivate({ team, focusPlayerId, focusPlayerName });
      messageApi.success(`本队已一致确定 ${focusPlayerName} 为焦点；本队持续可见，终局向所有人公开`, 4);
    });

    socket.on('focus_figure_voting_completed', ({ message: completedMessage }) => {
      setFocusFigureVote(null);
      messageApi.success(completedMessage || '两队焦点人物表决完成；己方焦点已标在玩家身边', 4);
    });

    socket.on('rule_visible_hands_updated', ({ hands = [], announcement = null }) => {
      setRuleVisibleHands(hands);
      const ownVisibleHand = hands.find(hand =>
        hand.playerId === currentPlayer?.id && hand.kind === 'partial'
      );
      if (ownVisibleHand) {
        setIcebergSelection(previous => {
          if (!previous || ownVisibleHand.cards.length < previous.targetCount) return previous;
          clearSelection();
          return null;
        });
      }
      if (announcement) messageApi.info(announcement, 4);
    });

    // 埋底完成
    socket.on('cards_buried', ({
      playerName,
      playerId,
      skipped = false,
      isSecondary = false,
      completed = true,
      peopleCommune = false,
      submittedCount = 0,
      totalCount = 4
    }) => {
      const buryMessage = peopleCommune
        ? completed
          ? '人民公社：四家均已埋好两张牌'
          : `${playerName} 已埋两张牌（${submittedCount}/${totalCount}）`
        : skipped
        ? `本局无底牌，${playerName} 直接先出`
        : isSecondary
          ? `${playerName} 完成再埋底`
          : completed
            ? `${playerName} 完成埋底`
            : `${playerName} 完成首次埋底`;
      messageApi.success(buryMessage);
      // 如果是我自己埋的底，清空我的底牌缓存（已经埋了）
      if (playerId === currentPlayer?.id) {
        setBottomPickup(null);
        setHandArrivalHighlight(previous => previous?.kind === 'bottom' ? null : previous);
      }
    });

    // 首发玩家设置
    socket.on('first_player_set', ({ playerName }) => {
      messageApi.info(`${playerName} 先出牌`);
    });

    socket.on('active_skill_activated', ({
      id,
      name,
      playerId,
      playerName,
      treatedAsSmall = false,
      concealed = false
    }) => {
      showSkillActivation({
        id,
        name,
        playerId,
        playerName,
        treatedAsSmall,
        concealed
      });
      const effectText = treatedAsSmall
        ? '，本次垫牌视为小'
        : concealed
          ? '，牌面将在本轮结束时公开'
          : '';
      messageApi.warning(`${playerName} 发动了${name}${effectText}`, 3);
    });

    socket.on('invite_into_urn_activated', ({
      sourcePlayerName,
      targetPlayerName,
      suit,
      rank
    }) => {
      const suitLabel = INVITE_INTO_URN_SUITS.find(option => option.value === suit)?.label || suit;
      const rankLabel = INVITE_INTO_URN_JOKER_RANKS.find(option => option.value === rank)?.label || rank;
      messageApi.warning(
        `${sourcePlayerName} 请 ${targetPlayerName} 入瓮：本轮打出 ${rankLabel}${suit === 'joker' ? '' : suitLabel} 即扣5分`,
        4
      );
    });

    socket.on('bush_gate_activated', ({
      activatorPlayerName,
      leaderPlayerId,
      leaderPlayerName,
      returnedCards = []
    }) => {
      setBushGateDecisionOpen(false);
      setCurrentWinningPlayerId(null);
      setPlayedCards(previous => {
        const updated = { ...previous };
        delete updated[leaderPlayerId];
        playedCardsRef.current = updated;
        return updated;
      });
      setPlayHistory(previous => {
        const lastIndex = previous.map(play => play.playerId).lastIndexOf(leaderPlayerId);
        if (lastIndex < 0) return previous;
        const updated = [...previous];
        updated.splice(lastIndex, 1);
        return updated;
      });
      if (leaderPlayerId === currentPlayer?.id) {
        returnedCards.forEach(cardData => addCard(cardData));
        clearSelection();
      }
      const returnedLabel = returnedCards.map(formatPublicCard).join('、');
      messageApi.warning(
        `${activatorPlayerName} 发动布什戈门：${leaderPlayerName} 收回 ${returnedLabel || `${returnedCards.length}张牌`}，须改用其他牌重新首发`,
        5
      );
    });

    socket.on('dream_killing_started', ({ playerName }) => {
      messageApi.info(`${playerName} 进入梦中：手牌暗置，之后由系统随机出牌`, 3);
    });

    socket.on('dream_killing_awakened', ({ playerName, matchedSuit, matchedRank }) => {
      const reason = matchedSuit && matchedRank
        ? '花色与点数均命中'
        : matchedSuit
          ? '命中首家花色'
          : '命中首家点数';
      messageApi.success(`${playerName} 梦中杀人成功（${reason}），本轮视为最大并醒来`, 4);
    });

    // 玩家出牌
    socket.on('cards_played', ({
      playerId,
      playerName,
      cards,
      removedCardIds = cards.map(card => card.id),
      currentWinningPlayerId: winningPlayerId,
      controllerPlayerId,
      controllerPlayerName,
      isProxy = false,
      treatedAsSmall = false,
      activeSkillId = null,
      activeSkillName = null,
      concealed = false,
      cardsCount = cards.length,
      jokerSubstitutions = [],
      clusterAnalysisSubstitutions = [],
      forbiddenMagicSubstitutions = [],
      enduringInheritance = null,
      dreamKilling = null,
      oldHorseAbsolute = false,
      lureTigerSilenced = false,
      ironEvidenceMode = null,
      ambiguousOptions = null
    }) => {
      const cachedOwnCards = concealed && playerId === currentPlayer?.id
        ? pendingOwnConcealedCardsRef.current.get(playerId) || null
        : null;
      const ownConcealedCards = Array.isArray(cachedOwnCards)
        && cachedOwnCards.length === cardsCount
        ? cachedOwnCards
        : null;
      if (cachedOwnCards) pendingOwnConcealedCardsRef.current.delete(playerId);
      const displayedCards = ownConcealedCards || cards;
      console.log('收到 cards_played 事件:', { playerId, playerName, cardsCount });
      if (treatedAsSmall) {
        messageApi.info(`${playerName} 垫了 ${cards.length} 张牌（视为小）`);
      } else {
        messageApi.info(isProxy
          ? `${controllerPlayerName} 代 ${playerName} 出了 ${cards.length} 张牌`
          : concealed
            ? ownConcealedCards
              ? `${playerName} 出了 ${cardsCount} 张牌`
              : `${playerName} 暗置了 ${cardsCount} 张牌`
            : `${playerName} 出了 ${cards.length} 张牌`);
      }
      if (enduringInheritance) {
        messageApi.success(`${playerName} 触发经久不衰，本次按上轮较高牌力结算`, 2);
      }
      if (oldHorseAbsolute) {
        messageApi.warning(`老骥伏枥：${playerName} 本次合法首发绝对最大`, 4);
      }
      if (lureTigerSilenced) {
        messageApi.info(`调虎离山：${playerName} 的本次出牌不计大小与分数`, 3);
      }
      // 只在服务端确认出牌后更新本地手牌，避免拒绝时出现“牌先消失、后恢复”。
      if (playerId === currentPlayer?.id) {
        setJustPlayedCards(true);
        removeCards(removedCardIds);
      }
      if (controllerPlayerId === currentPlayer?.id) {
        setJustPlayedCards(true);
      }
      // 如果玩家在清桌延迟期间已经开始下一墩，直接切换到新墩，避免新旧牌混在一起。
      const startsNewRound = awaitingRoundClearRef.current;
      if (startsNewRound) {
        if (roundClearTimerRef.current) {
          clearTimeout(roundClearTimerRef.current);
          roundClearTimerRef.current = null;
        }
        awaitingRoundClearRef.current = false;
        heldCompletedRoundNumberRef.current = null;
        setIsHoldingCompletedRound(false);
        setHeldCompletedRoundNumber(null);
      }
      const visualCards = ironEvidenceMode
        ? displayedCards.map(card => ({ ...card, ironEvidenceMode }))
        : displayedCards;
      const playedCardView = { playerName, cards: visualCards, cardsCount, concealed, ownConcealedCards: Boolean(ownConcealedCards), treatedAsSmall, activeSkillId, activeSkillName, jokerSubstitutions, clusterAnalysisSubstitutions, forbiddenMagicSubstitutions, enduringInheritance, dreamKilling, oldHorseAbsolute, lureTigerSilenced, ironEvidenceMode, ambiguousOptions };
      const updated = startsNewRound
        ? { [playerId]: playedCardView }
        : {
            ...playedCardsRef.current,
            [playerId]: playedCardView
          };
      playedCardsRef.current = updated;
      setPlayedCards(updated);
      setCurrentWinningPlayerId(concealed ? (winningPlayerId || null) : (winningPlayerId ?? playerId));
      console.log('更新后的 playedCards:', Object.keys(updated));
      // 添加到出牌历史
      setPlayHistory(prev => startsNewRound
        ? [{ playerId, playerName, controllerPlayerId, controllerPlayerName, isProxy, treatedAsSmall, lureTigerSilenced, activeSkillId, activeSkillName, enduringInheritance, timestamp: Date.now() }]
        : [...prev, { playerId, playerName, controllerPlayerId, controllerPlayerName, isProxy, treatedAsSmall, lureTigerSilenced, activeSkillId, activeSkillName, enduringInheritance, timestamp: Date.now() }]);
    });

    socket.on('ambiguous_choice_required', request => {
      setAmbiguousChoice(request);
    });

    socket.on('ambiguous_choice_pending', ({ playerName, position }) => {
      setAmbiguousChoice(previous => (
        previous?.playerId === currentPlayer?.id ? previous : null
      ));
      messageApi.info(`模棱两可：等待${position || ''}号位 ${playerName || ''} 选择结算方案`, 3);
    });

    socket.on('ambiguous_choice_resolved', ({ playerId, playerName, optionIndex, cards }) => {
      const updated = { ...playedCardsRef.current };
      if (updated[playerId]) {
        updated[playerId] = {
          ...updated[playerId],
          cards,
          cardsCount: cards.length,
          ambiguousSelectedOptionIndex: optionIndex
        };
        playedCardsRef.current = updated;
        setPlayedCards(updated);
      }
      if (playerId === currentPlayer?.id) setAmbiguousChoice(null);
      messageApi.success(`${playerName} 选择方案${optionIndex === 0 ? 'A' : 'B'}`, 2);
    });

    socket.on('ambiguous_hand_updated', ({ cards }) => {
      setMyCards(cards);
    });

    socket.on('ambiguous_round_resolved', () => {
      setAmbiguousChoice(null);
    });

    socket.on('three_tigers_transformed', ({
      active,
      triggeredNow,
      reverted,
      triggeredSuit,
      plays = [],
      currentWinningPlayerId: winningPlayerId
    }) => {
      const updated = { ...playedCardsRef.current };
      plays.forEach(play => {
        const current = updated[play.playerId];
        if (!current || current.concealed) return;
        updated[play.playerId] = {
          ...current,
          cards: play.cards,
          cardsCount: play.cards.length,
          threeTigersTransformed: Boolean(active)
        };
      });
      playedCardsRef.current = updated;
      setPlayedCards(updated);
      setCurrentWinningPlayerId(winningPlayerId || null);

      const suitLabel = TRANSFORMATION_SUITS.find(option => option.value === triggeredSuit)?.label
        || triggeredSuit
        || '';
      if (triggeredNow) {
        messageApi.warning(`三人成虎：${suitLabel}已有三人打出，相关牌立即降低四级并视为主牌`, 4);
      } else if (reverted) {
        messageApi.info('三人成虎已撤销：第三人的出牌被撤回，桌面牌恢复原状', 3);
      }
    });

    socket.on('concealed_cards_played_private', ({ playerId, cards }) => {
      const current = playedCardsRef.current[playerId];
      if (!current || awaitingRoundClearRef.current) {
        pendingOwnConcealedCardsRef.current.set(playerId, cards);
        return;
      }
      const visualCards = current.ironEvidenceMode
        ? cards.map(card => ({ ...card, ironEvidenceMode: current.ironEvidenceMode }))
        : cards;
      const updated = {
        ...playedCardsRef.current,
        [playerId]: { ...current, cards: visualCards, ownConcealedCards: true }
      };
      playedCardsRef.current = updated;
      setPlayedCards(updated);
    });

    socket.on('concealed_plays_revealed', ({ plays = [] }) => {
      const updated = { ...playedCardsRef.current };
      plays.forEach(play => {
        if (!updated[play.playerId]) return;
        const wasOwnConcealed = Boolean(updated[play.playerId].ownConcealedCards);
        const ironEvidenceMode = play.ironEvidenceMode
          || updated[play.playerId].ironEvidenceMode
          || null;
        const visualCards = ironEvidenceMode
          ? play.cards.map(card => ({ ...card, ironEvidenceMode }))
          : play.cards;
        updated[play.playerId] = {
          ...updated[play.playerId],
          cards: visualCards,
          cardsCount: play.cards.length,
          concealed: false,
          ownConcealedCards: false,
          justRevealed: Boolean(play.concealed && !wasOwnConcealed),
          ironEvidenceMode,
          jokerSubstitutions: play.jokerSubstitutions || []
        };
      });
      playedCardsRef.current = updated;
      setPlayedCards(updated);
      messageApi.info('暗置牌同时公开，开始结算本轮', 2);
    });

    // 玩家跳过
    socket.on('turn_passed', ({ playerName }) => {
      messageApi.info(`${playerName} 跳过了回合`);
    });

    // 展示底牌（修正事件名）
    socket.on('bottom_revealed', ({ bottomCards, bottomScoreResult, upgradeResult }) => {
      setSurrenderDecision(null);
      messageApi.info(`底牌已展示: ${bottomCards.length} 张`);
      setRevealedBottomCards(bottomCards);
      if (bottomScoreResult) {
        setBottomScoreResult(bottomScoreResult);
        setAttackerScore(bottomScoreResult.totalScore);
        setCollectedPointCards(bottomScoreResult.collectedPointCards || []);
        // 显示底牌得分结果
        if (bottomScoreResult.surrender) {
          messageApi.warning(bottomScoreResult.resultText || '投降结算完成', 6);
        } else if (bottomScoreResult.focusFigure) {
          const focusNames = bottomScoreResult.focusFigure.teams
            .map(team => `${team.side === 'dealer' ? '庄家方' : '闲家方'}：${team.focusPlayerName}`)
            .join('，');
          messageApi.success(
            `焦点人物揭晓（${focusNames}）：逐墩焦点分${bottomScoreResult.focusFigure.focusTrickScore}分，` +
            `正常底牌分${bottomScoreResult.focusFigure.normalBottomScore}分，最终${bottomScoreResult.totalScore}分`,
            6
          );
        } else {
          const hasAmbushBottomCards = bottomScoreResult.ambushCardCount > 0;
          const scoreAfterBottom = bottomScoreResult.scoreBeforeMistyFog
            ?? bottomScoreResult.scoreBeforeLingeringDiscard
            ?? bottomScoreResult.totalScore;
          const terminalRevealMessage = bottomScoreResult.mistyFogCards?.length > 0
            ? `；随后公开迷雾牌${bottomScoreResult.mistyFogPoints}分，闲家补${bottomScoreResult.mistyFogBonus}分，最终${bottomScoreResult.totalScore}分`
            : bottomScoreResult.lingeringDiscardCards?.length > 0
              ? `；随后公开庄家方弃出的分牌${bottomScoreResult.lingeringDiscardPoints}分，闲家补${bottomScoreResult.lingeringDiscardBonus}分，最终${bottomScoreResult.totalScore}分`
              : '';
          const resultMsg = bottomScoreResult.peopleCommune
            ? bottomScoreResult.attackerWonBottom
              ? `闲家抄庄家底！庄家方埋分${bottomScoreResult.peopleCommune.dealerBuriedPoints}分×${bottomScoreResult.bottomMultiplier}倍，闲家获得${bottomScoreResult.bottomScoreGained}分，总分：${scoreAfterBottom}分`
              : `庄家方抄闲家底！闲家方埋分${bottomScoreResult.peopleCommune.attackerBuriedPoints}分×${bottomScoreResult.bottomMultiplier}倍，闲家扣${Math.abs(bottomScoreResult.bottomScoreGained)}分，总分：${scoreAfterBottom}分`
            : hasAmbushBottomCards
            ? bottomScoreResult.attackerWonBottom
              ? `闲家拿底！常规底分获得${bottomScoreResult.bottomPoints * bottomScoreResult.bottomMultiplier}分，伏击牌${bottomScoreResult.ambushRank}×${bottomScoreResult.ambushCardCount}扣${Math.abs(bottomScoreResult.ambushScoreDelta)}分；底牌净变化${bottomScoreResult.bottomScoreGained > 0 ? '+' : ''}${bottomScoreResult.bottomScoreGained}分，闲家总分：${scoreAfterBottom}分${terminalRevealMessage}`
              : `庄家守底！底中伏击牌${bottomScoreResult.ambushRank}×${bottomScoreResult.ambushCardCount}按${bottomScoreResult.bottomMultiplier}倍给闲家加${bottomScoreResult.ambushScoreDelta}分，闲家总分：${scoreAfterBottom}分${terminalRevealMessage}`
            : bottomScoreResult.attackerWonBottom
              ? `闲家拿底！底牌${bottomScoreResult.bottomPoints}分×${bottomScoreResult.bottomMultiplier}倍=${bottomScoreResult.bottomScoreGained}分，闲家总分：${scoreAfterBottom}分${terminalRevealMessage}`
              : `庄家守底！闲家总分：${scoreAfterBottom}分${terminalRevealMessage}`;
          messageApi.success(resultMsg, 5);
        }
      }
      if (upgradeResult) {
        setUpgradeResult(upgradeResult);
        // 显示升级结果
        const winnerMsg = upgradeResult.attackerWon ? '闲家获胜' : '庄家获胜';
        const upgradeMsg = upgradeResult.attackerWon
          ? `闲家升${upgradeResult.attackerLevelUp}级`
          : `庄家升${upgradeResult.dealerLevelUp}级`;
        const continuationMsg = upgradeResult.dealerContinues ? '，势如破竹继续连庄' : '';
        messageApi.success(`${winnerMsg}！${upgradeMsg}${continuationMsg}`, 5);
      }
    });

    // 收到我的底牌
    socket.on('my_bottom_cards', ({ bottomCards }) => {
      setMyBottomCards(bottomCards);
      setViewBottomModal(true);
    });

    // 玩家准备下一局
    socket.on('player_ready_for_next', ({ playerName, readyCount, totalCount }) => {
      messageApi.info(`${playerName} 已准备 (${readyCount}/${totalCount})`);
    });

    // 下一局开始
    socket.on('next_game_started', () => {
      clearCardTransitionTimers();
      messageApi.success('开始下一局！');
      // 清空所有前端状态
      setSelectedRule(null);
      setMyCards([]);
      setLivePlayerCardCounts({});
      setShownCards({});
      resetRoundDisplay();
      setPlayHistory([]);
      clearSelection();
      setCurrentTrumpDeclaration(null);
      setCurrentInferiorDeclaration(null);
      setThreeSixNineState(null);
      setAvailableDeclarations([]);
      setAttackerScore(0);
      setCollectedPointCards([]);
      setBottomScoreResult(null);
      setUpgradeResult(null);
      setRevealedBottomCards([]);
      setPublicBottomCards([]);
      setMyBottomCards([]);
      setViewBottomModal(false);
      setCardExchangeAnimation(null);
      setPrivateCardTransferReveal(null);
      setBottomPickup(null);
      setHandArrivalHighlight(null);
      setRuleVisibleHands([]);
      setIcebergSelection(null);
      setTenSidedAmbushSelection(null);
      setSelectedTenSidedAmbushRank(null);
      setTenSidedAmbushPrivateRank(null);
      setTenSidedAmbushRevealAnimation(null);
      setWaitingRabbitSelection(null);
      setSelectedWaitingRabbitSuit(null);
      setSelectedWaitingRabbitRank(null);
      setWaitingRabbitPrivateTarget(null);
      setWaitingRabbitDecision(null);
      setWaitingRabbitDiscardCardId(null);
      setGentlemanPromiseSelection(null);
      setSelectedGentlemanPromiseSuit(null);
      setHiddenDragonSelection(null);
      setSelectedHiddenDragonRank(null);
      setAdministrativeReviewSelection(null);
      setSelectedAdministrativeReviewValue(null);
      setPoliticalReviewDecision(null);
      setFocusFigureVote(null);
      setFocusFigurePrivate(null);
      setArmedActiveSkillId(null);
      setActiveSkillAnimation(null);
      setTeammateCheerDecision(null);
      setAfterglowDecision(null);
      setRemoveFirewoodDecision(null);
      setAmbiguousFirstOptionCardIds([]);
      setAmbiguousChoice(null);
      setBushGateDecisionOpen(false);
      setMutualSupportDirectionOpen(false);
      setMutualSupportSelection(null);
      setMutualSupportSelectedCardIds([]);
      setStrawBoatDecision(null);
      setStrawBoatDiscardCardId(null);
      setIsReadyForNext(false); // 重置准备状态
      setLastRoundPlayedCards({}); // 清空上轮出牌记录
      setLastRoundWinnerPlayerId(null);
      setViewingLastRound(false); // 取消查看上轮状态
      if (lastRoundTimer) {
        clearTimeout(lastRoundTimer);
        setLastRoundTimer(null);
      }
      // 主牌信息会通过房间状态同步的useEffect自动更新
    });

    // 分数更新
    socket.on('score_updated', ({ playerId, newScore }) => {
      messageApi.success('分数已更新');
    });

    // 等级更新
    socket.on('level_updated', ({ playerId, newLevel }) => {
      messageApi.success('等级已更新');
    });

    // 撤回出牌
    socket.on('play_undone', ({
      playerId,
      playerName,
      cards,
      controllerPlayerName,
      isProxy = false,
      restoredActiveSkillId = null,
      restoredActiveSkillName = null
    }) => {
      console.log('收到 play_undone 事件:', { playerId, playerName, cardsCount: cards.length });
      const restoredSuffix = restoredActiveSkillName
        ? `，${restoredActiveSkillName}次数已返还`
        : '';
      messageApi.info(`${isProxy ? `${controllerPlayerName} 撤回了代 ${playerName} 的出牌` : `${playerName} 撤回了出牌`}${restoredSuffix}`);
      if (restoredActiveSkillId && playerId === currentPlayer?.id) {
        setArmedActiveSkillId(null);
      }
      // 撤回可能改变当前最大者；先释放事件态，随后以 room_updated 中重算的赢家为准。
      setCurrentWinningPlayerId(null);
      // 清除该玩家的已出牌显示
      setPlayedCards(prev => {
        const updated = { ...prev };
        delete updated[playerId];
        playedCardsRef.current = updated;
        console.log('撤回后的 playedCards:', Object.keys(updated));
        return updated;
      });

      // 从出牌历史中移除该玩家的最后一次出牌
      setPlayHistory(prev => {
        const lastIndex = prev.map(p => p.playerId).lastIndexOf(playerId);
        if (lastIndex !== -1) {
          const updated = [...prev];
          updated.splice(lastIndex, 1);
          return updated;
        }
        return prev;
      });

      // 如果是自己撤回，将牌添加回手牌
      if (playerId === currentPlayer?.id) {
        console.log('将牌添加回手牌:', cards.length, '张');
        cards.forEach(cardData => {
          addCard(cardData);
        });
      }
    });

    socket.on('concealed_play_undone_private', ({ cards = [] }) => {
      cards.forEach(cardData => addCard(cardData));
    });

    // 主牌更新
    socket.on('trump_updated', ({
      trumpSuit,
      trumpRank,
      inferiorSuit,
      systemSelected = false,
      oneCountryTwoSystems = null,
      culturalRevolution = null,
      culturalRevolutionExpired = null,
      encircleThreeMissingOne = null
    }) => {
      console.log(`🃏 收到trump_updated事件: trumpSuit=${trumpSuit}, trumpRank=${trumpRank}`);
      setTrumpSuit(trumpSuit);
      setTrumpRank(trumpRank);
      // 更新store中的主牌信息，自动重排手牌
      setTrumpInfo(trumpSuit, trumpRank, inferiorSuit);
      if (oneCountryTwoSystems) {
        setOneCountryTwoSystemsState(oneCountryTwoSystems);
      }
      if (culturalRevolution) {
        const actionLabel = culturalRevolution.declarationType === 'suit' ? '革花色' : '革点数';
        const valueLabel = culturalRevolution.declarationType === 'suit'
          ? TRANSFORMATION_SUITS.find(option => option.value === culturalRevolution.value)?.label
            || culturalRevolution.value
          : culturalRevolution.value;
        messageApi.success(
          `文化革命：${actionLabel} ${valueLabel}，持续至第${culturalRevolution.expiresAfterRound}轮结束`,
          4
        );
      } else if (culturalRevolutionExpired) {
        messageApi.info('文化革命效果结束，已恢复本局原主', 4);
      } else if (encircleThreeMissingOne) {
        const suitSymbol = {
          hearts: '♥',
          diamonds: '♦',
          clubs: '♣',
          spades: '♠'
        }[encircleThreeMissingOne.nextTrumpSuit] || encircleThreeMissingOne.nextTrumpSuit;
        messageApi.success(
          `围三阙一：第${encircleThreeMissingOne.effectiveRound}轮起改为 ${suitSymbol} 主`,
          4
        );
      } else if (systemSelected && trumpSuit) {
        const suitSymbol = {
          hearts: '♥',
          diamonds: '♦',
          clubs: '♣',
          spades: '♠'
        }[trumpSuit] || trumpSuit;
        messageApi.warning(`无人亮主，系统随机选择 ${suitSymbol} 为主花色`, 4);
      } else if (oneCountryTwoSystems?.resolved) {
        const resolved = oneCountryTwoSystems.resolved;
        messageApi.info(
          resolved.isNoTrump
            ? '一国两制：双方无主'
            : resolved.hasDistinctTeamSuits
              ? '一国两制：双方主花色已分别锁定'
              : '一国两制：双方共用主花色'
        );
      } else if (!oneCountryTwoSystems && trumpSuit && trumpRank) {
        messageApi.info(`主牌已设置: ${trumpSuit} ${trumpRank}`);
      } else if (trumpRank) {
        console.log(`📢 级牌已设置: ${trumpRank}`);
      }
    });

    // 甩牌失败
    socket.on('throw_failed', ({
      playerId,
      playerName,
      message: msg,
      attemptedCardObjects,
      forcedCards
    }) => {
      messageApi.warning(`${playerName} ${msg}，实际出牌 ${forcedCards.length} 张`, 3);

      // 先把完整的甩牌尝试留在牌桌上一秒；实际强制出牌由紧随其后的
      // cards_played 在底层更新，预览退场后自然显露。
      const previewKey = `${Date.now()}-${playerId}`;
      const preview = getThrowFailedPreview(playerName, attemptedCardObjects, previewKey);
      if (preview) {
        setThrowFailedPreviews(previous => ({
          ...previous,
          [playerId]: preview
        }));
      }

      const previewTimer = setTimeout(() => {
        setThrowFailedPreviews(previous => {
          if (previous[playerId]?.previewKey !== previewKey) return previous;
          const next = { ...previous };
          delete next[playerId];
          return next;
        });
        throwFailedPreviewTimersRef.current.delete(previewKey);
      }, THROW_FAILED_PREVIEW_DURATION_MS);
      throwFailedPreviewTimersRef.current.set(previewKey, previewTimer);
    });

    // 毙牌动作
    socket.on('trump_action', ({
      type,
      playerId,
      playerName,
      targetPlayerId,
      targetPlayerName
    }) => {
      const key = `${Date.now()}-${playerId}-${type}`;
      setTrumpAnimation({
        key,
        type,
        playerId,
        playerName,
        targetPlayerId,
        targetPlayerName
      });
      // 参考视频使用短促局部反馈：打击先结束，金字稍后退场。
      setTimeout(() => {
        setTrumpAnimation(current => current?.key === key ? null : current);
      }, 1650);
    });

    // 亮主成功
    socket.on('trump_declared', ({
      playerId,
      playerName,
      suit,
      count,
      declarationType,
      strength,
      isCounter,
      cards,
      teamIndex,
      declarationRole = 'trump',
      oneCountryTwoSystems = false
    }) => {
      const action = declarationRole === 'inferior'
        ? (isCounter ? '反劣' : '亮劣')
        : (isCounter ? '反主' : '亮主');
      const suitMap = {
        'spades': '♠',
        'hearts': '♥',
        'clubs': '♣',
        'diamonds': '♦',
        'joker': '王'
      };
      const suitSymbol = suitMap[suit] || suit;

      console.log(`🎺 ${action}成功: ${playerName} ${action}了 ${count} 张 ${suitSymbol}`);
      messageApi.success(`${playerName} ${action}: ${count === 2 ? '一对' : '单张'}${suitSymbol}`);

      const nextDeclaration = {
        playerId: playerId,
        playerName: playerName,
        suit: suit,
        count: count,
        declarationType: declarationType,
        strength: strength,
        isCounter: isCounter,
        declarationRole,
        cards: cards || []
      };
      if (declarationRole === 'inferior') {
        setCurrentInferiorDeclaration(nextDeclaration);
      } else {
        setCurrentTrumpDeclaration(nextDeclaration);
      }

      if (oneCountryTwoSystems && Number.isInteger(teamIndex)) {
        setOneCountryTwoSystemsState(previous => ({
          declarationsByTeam: {
            ...(previous?.declarationsByTeam || {}),
            [teamIndex]: {
              playerId,
              playerName,
              suit,
              count,
              declarationType,
              strength,
              isCounter,
              cards: cards || []
            }
          },
          resolved: null,
          hasJokerDeclaration: previous?.hasJokerDeclaration || suit === 'joker'
        }));
      }

      // 立即同步主牌信息到本地并重排手牌，避免在网络延迟或缺少 trump_updated 事件前出现无主排序
      try {
        if (oneCountryTwoSystems || declarationRole === 'inferior') return;
        const immediateTrumpSuit = suit !== 'joker' ? suit : 'no_trump';
        console.log(`📡 即时更新主牌: ${immediateTrumpSuit}, trumpRank=${trumpRank}`);
        setTrumpSuit(immediateTrumpSuit);
        // trumpRank 保持不变（由房间配置决定），但也再次传入以保证排序正确
        setTrumpInfo(
          immediateTrumpSuit,
          trumpRank,
          suit === 'joker' ? null : threeSixNineState?.inferiorSuit || null
        );
      } catch (e) {
        console.warn('同步主牌信息失败:', e);
      }
    });

    socket.on('three_six_nine_updated', (state) => {
      setThreeSixNineState(state);
      setCurrentTrumpDeclaration(state?.currentTrumpDeclaration || null);
      setCurrentInferiorDeclaration(state?.currentInferiorDeclaration || null);
      const nextTrumpSuit = state?.trumpSuit ?? trumpSuit;
      const nextTrumpRank = state?.trumpRank ?? trumpRank;
      setTrumpSuit(nextTrumpSuit);
      setTrumpRank(nextTrumpRank);
      setTrumpInfo(nextTrumpSuit, nextTrumpRank, state?.inferiorSuit || null);
    });

    // 房间配置更新
    socket.on('config_updated', ({ config }) => {
      messageApi.success('房间设置已更新，将在下一局游戏生效');
      setNewDealInterval(config.dealInterval);
    });

    socket.on('bot_type_updated', ({ botType, botTypeName }) => {
      setNewBotType(botType);
      messageApi.success(`Bot策略已切换为 ${botTypeName}`);
    });

    // 玩家昵称更新
    socket.on('player_name_updated', ({ playerId, oldName, newName }) => {
      if (playerId === currentPlayer?.id) {
        messageApi.success(`昵称已修改为: ${newName}`);
      } else {
        messageApi.info(`${oldName} 修改昵称为: ${newName}`);
      }
    });

    // 接收聊天消息
    socket.on('chat_message_received', ({ playerName, message, timestamp }) => {
      setChatHistory(prev => [...prev, { playerName, message, timestamp }]);
      messageApi.info(`${playerName}: ${message}`);
    });

    // Bot添加
    socket.on('bot_added', ({ player }) => {
      messageApi.success(`Bot ${player.name} 已加入房间`);
    });

    // Bot移除
    socket.on('bot_removed', ({ playerName }) => {
      messageApi.info(`Bot ${playerName} 已离开房间`);
    });

    // 玩家准备状态更新
    socket.on('player_ready_status', ({ playerName, isReady }) => {
      messageApi.info(`${playerName} ${isReady ? '已准备' : '取消准备'}`);
    });

    // 所有玩家准备完毕
    socket.on('all_players_ready', ({ message }) => {
      messageApi.success(message);
    });

    // 规则选择
    socket.on('rule_selected', ({ playerName, rule }) => {
      setSelectedRule(rule);
      setRuleSelectorModal(false);
      const selectedNames = Array.isArray(rule.rules)
        ? rule.rules.map(childRule => childRule.name).join(' + ')
        : rule.name;
      messageApi.info(`${playerName} 选择了规则: ${selectedNames}`);
    });

    socket.on('double_happiness_selection_started', () => {
      messageApi.info('双喜临门：请从新的三条规则中选择两条');
    });

    socket.on('double_happiness_option_refreshed', ({
      oldRule,
      rule,
      refreshedByPlayerName
    }) => {
      messageApi.info(
        `${refreshedByPlayerName || '房主'}将“${oldRule?.name || '原候选'}”换成了“${rule?.name || '新候选'}”`
      );
    });

    socket.on('candle_initial_state_selected', ({ selectorPlayerName, isLit }) => {
      messageApi.info(`${selectorPlayerName}将烛${isLit ? '点燃' : '熄灭'}，第1轮按该状态计分`);
    });

    // 庄家倒计时开始/重置
    socket.on('dealer_countdown_start', ({ countdown }) => {
      setDealerCountdown(countdown);
    });

    // 庄家倒计时结束
    socket.on('dealer_countdown_end', () => {
      setDealerCountdown(null);
    });

    // 回合状态更新
    socket.on('round_updated', (roundUpdate) => {
      console.log('收到 round_updated 事件:', roundUpdate);
      if (roundUpdate.type === 'turn_changed') {
        const currentPlayer = currentRoom.players[roundUpdate.currentPlayerIndex];
        if (currentPlayer) {
          messageApi.info(`现在轮到 ${currentPlayer.name} 出牌`);
        }
        // 轮次变化时，重置出牌标记
        setJustPlayedCards(false);
      } else if (roundUpdate.type === 'round_started') {
        heldCompletedRoundNumberRef.current = null;
        setHeldCompletedRoundNumber(null);
        messageApi.success(roundUpdate.message || `轮次 ${roundUpdate.round} 开始`);
        // 新一轮开始，清空出牌历史（因为是新的一轮，之前的牌不能再撤回）
        setPlayHistory([]);
        // 重置出牌标记
        setJustPlayedCards(false);
        // 取消查看上轮状态
        setViewingLastRound(false);
        // 清除定时器
        if (lastRoundTimer) {
          clearTimeout(lastRoundTimer);
          setLastRoundTimer(null);
        }
      } else if (roundUpdate.type === 'round_ended') {
        // 必须在读取下轮公开快照前同步锁住刚结算的轮次。
        heldCompletedRoundNumberRef.current = roundUpdate.round;
        if (roundUpdate.threeTigers?.triggeredSuit && roundUpdate.threeTigers.plays?.length) {
          const updated = { ...playedCardsRef.current };
          roundUpdate.threeTigers.plays.forEach(play => {
            const current = updated[play.playerId];
            if (!current || current.concealed) return;
            updated[play.playerId] = {
              ...current,
              cards: play.cards,
              cardsCount: play.cards.length,
              threeTigersTransformed: true
            };
          });
          playedCardsRef.current = updated;
          setPlayedCards(updated);
        }
        if (roundUpdate.magicTrick?.triggered) {
          const targetIds = new Set(roundUpdate.magicTrick.targetPlayerIds || []);
          const updated = { ...playedCardsRef.current };
          (roundUpdate.magicTrick.plays || []).forEach(play => {
            if (!updated[play.playerId]) return;
            updated[play.playerId] = {
              ...updated[play.playerId],
              cards: play.cards,
              cardsCount: play.cards.length,
              magicTrickSwapped: targetIds.has(play.playerId)
            };
          });
          playedCardsRef.current = updated;
          setPlayedCards(updated);
          setMagicTrickPreparedRound(null);
          setMagicTrickTargetIds([]);
          messageApi.warning(
            `魔术戏法揭晓：交换 ${roundUpdate.magicTrick.targetPlayerNames.join(' 与 ')} 的结算出牌`,
            4
          );
        }
        if (roundUpdate.averagePooling?.triggered || roundUpdate.jointHarmony?.triggered) {
          const updated = { ...playedCardsRef.current };
          (roundUpdate.averagePooling?.teams || []).forEach(team => {
            team.playerIds.forEach(playerId => {
              if (updated[playerId]) updated[playerId] = { ...updated[playerId], averagePooling: true };
            });
          });
          (roundUpdate.jointHarmony?.teams || []).forEach(team => {
            team.playerIds.forEach(playerId => {
              if (updated[playerId]) updated[playerId] = { ...updated[playerId], jointHarmony: true };
            });
          });
          playedCardsRef.current = updated;
          setPlayedCards(updated);
          if (roundUpdate.averagePooling?.triggered) {
            messageApi.info('平均池化：按队内有效单牌/对子的平均牌力重新结算本轮', 3);
          }
          if (roundUpdate.jointHarmony?.triggered) {
            messageApi.success(
              roundUpdate.jointHarmony.bothTeams
                ? '双方同时珠联璧合，按牌面大小正常结算'
                : '珠联璧合：达成一方视为最大，由该方后出者获得牌权',
              4
            );
          }
        }
        // 轮次结束，显示获胜者信息
        if (roundUpdate.roundWinner) {
          setCurrentWinningPlayerId(roundUpdate.roundWinner.playerId);
          setLastRoundWinnerPlayerId(roundUpdate.roundWinner.playerId);
          const nextLeader = roundUpdate.nextRoundLeader || roundUpdate.roundWinner;
          const leaderChanged = nextLeader.playerId !== roundUpdate.roundWinner.playerId;
          const resultMessage = leaderChanged
            ? `第${roundUpdate.round}轮结束，${roundUpdate.roundWinner.playerName} 获胜；` +
              `${nextLeader.playerName} 获得下一轮出牌权`
            : `第${roundUpdate.round}轮结束，${roundUpdate.roundWinner.playerName} 获胜，获得下一轮出牌权`;
          messageApi.success(resultMessage);
        }
        if (roundUpdate.trumpWins?.leaderPlayerId) {
          const tiedCount = (roundUpdate.trumpWins.players || []).filter(
            player => player.points === roundUpdate.trumpWins.highestPoints
          ).length;
          messageApi.info(
            `Trump wins：${roundUpdate.trumpWins.leaderPlayerName} 以 ${roundUpdate.trumpWins.highestPoints} 分获得牌权` +
            (tiedCount > 1 ? '（并列中最先出牌）' : ''),
            4
          );
        }
        if (roundUpdate.oldHorse?.armedNow) {
          const protectedPlayer = currentRoom.players.find(
            player => player.id === roundUpdate.oldHorse.protectedPlayerId
          );
          messageApi.warning(
            `老骥伏枥：${protectedPlayer?.name || '最后获得牌权者'} 下次合法首发绝对最大`,
            4
          );
        }
        if (roundUpdate.turnDirectionChange) {
          const directionName = roundUpdate.turnDirectionChange.nextDirection === 'clockwise'
            ? '顺时针'
            : '逆时针';
          messageApi.warning(`路线摇摆：下一轮改为${directionName}出牌`, 3);
        }
        if (roundUpdate.abruptStop?.triggered) {
          messageApi.warning('戛然而止：本轮完整结算后结束牌局，底牌仍按本轮胜负结算', 5);
        }
        if (roundUpdate.secondBattlefield?.triggered) {
          const battle = roundUpdate.secondBattlefield;
          const awardText = battle.scoreDelta > 0
            ? '闲家阵营获得5分'
            : battle.scoreDelta < 0
              ? '庄家阵营获得5分'
              : '跨阵营并列，双方各得5分';
          messageApi.success(
            `第二战场第${battle.showdownNumber}场：系统判定${battle.winnerPlayerNames.join('、')}` +
            `以${battle.winningCategoryName}胜出，${awardText}`,
            5
          );
        }
        // 处理得分信息
        if (roundUpdate.scoreInfo && !roundUpdate.scoreInfo.hidden) {
          const {
            roundPoints,
            roundPointCards = [],
            winnerIsAttacker,
            attackerScore: newScore,
            collectedPointCards: newCards,
            attackerRoundPointsAwarded = winnerIsAttacker ? roundPoints : 0,
            accidentInsuranceWithheld = 0,
            accidentInsuranceBonus = 0,
            ambushRank,
            ambushCardCount = 0,
            ambushScoreDelta = 0,
            repeatedExhaustion = null,
            inviteIntoUrn = null,
            outwardHarmonyInnerDivision = null,
            fearOfBreakingVase = null,
            ironEvidence = null,
            destroyDyke = null,
            weighingThousandJin = null,
            focusFigureScoringPending = false
          } = roundUpdate.scoreInfo;
          if (weighingThousandJin) {
            const {
              mode,
              outrankedAttackerCount = 0,
              originalRoundPoints = 0,
              adjustedRoundPoints = 0
            } = weighingThousandJin;
            messageApi.info(
              mode === 'subtract_five'
                ? `上称千斤：庄家压过${outrankedAttackerCount}名闲家，每张分牌−5；` +
                  `本轮${originalRoundPoints}分调整为${adjustedRoundPoints}分`
                : `上称千斤：庄家未压过闲家，每张分牌×2；` +
                  `本轮${originalRoundPoints}分调整为${adjustedRoundPoints}分`,
              4
            );
          }
          if (destroyDyke?.status === 'activated' && winnerIsAttacker) {
            messageApi.warning(
              `毁堤淹田：本轮${roundPoints}分作废，闲家总分仍为${newScore}分`,
              4
            );
          } else if (focusFigureScoringPending && winnerIsAttacker && roundPoints > 0) {
            messageApi.info(
              `闲家收下 ${roundPointCards.length} 张分牌；焦点身份与实际得分将在终局揭晓`,
              4
            );
          } else if (winnerIsAttacker && roundPoints > 0) {
            if (accidentInsuranceWithheld > 0) {
              messageApi.warning(
                `意外保险：本轮牌面 ${roundPoints} 分，闲家只计 ${attackerRoundPointsAwarded} 分，总分：${newScore}分`,
                4
              );
            } else {
              messageApi.info(`闲家得${attackerRoundPointsAwarded}分，总分：${newScore}分`, 3);
            }
          } else if (accidentInsuranceBonus > 0) {
            messageApi.warning(
              `意外保险：庄家方赢得 ${roundPoints} 分，超出的 ${accidentInsuranceBonus} 分补给闲家，总分：${newScore}分`,
              4
            );
          }
          if (ambushCardCount > 0) {
            messageApi.warning(
              `十面埋伏 ${ambushRank} × ${ambushCardCount}：闲家${ambushScoreDelta > 0 ? '+' : ''}${ambushScoreDelta}分，总分：${newScore}分`,
              4
            );
          }
          if (repeatedExhaustion?.penalty > 0) {
            messageApi.warning(
              `再衰三竭：${repeatedExhaustion.playerName}连续第${repeatedExhaustion.streak}轮最大，` +
              `失去${repeatedExhaustion.penalty}分；闲家总分${repeatedExhaustion.scoreDelta > 0 ? '+' : ''}` +
              `${repeatedExhaustion.scoreDelta}，当前${newScore}分`,
              5
            );
          }
          if (fearOfBreakingVase?.triggered) {
            const triggerText = fearOfBreakingVase.triggerType === 'leader_over_protected_teammate'
              ? `${fearOfBreakingVase.winnerPlayerName}从首家守到最大，但队友` +
                `${fearOfBreakingVase.vesselPlayerName}打出了至少两对或两张王`
              : `${fearOfBreakingVase.winnerPlayerName}作为第二家独自毙牌，而队友` +
                `${fearOfBreakingVase.vesselPlayerName}本是其余三家最大`;
            messageApi.warning(
              `投鼠忌器：${triggerText}；` +
              `${fearOfBreakingVase.penalizedSide === 'attacker' ? '闲家方' : '庄家方'}` +
              `失去${fearOfBreakingVase.penalty}分，闲家当前${newScore}分`,
              6
            );
          }
          if (inviteIntoUrn?.triggeredCount > 0) {
            const triggeredNames = inviteIntoUrn.declarations
              .filter(declaration => declaration.triggered)
              .map(declaration => declaration.targetPlayerName)
              .join('、');
            messageApi.warning(
              `请君入瓮：${triggeredNames} 命中指定牌面；闲家总分` +
              `${inviteIntoUrn.scoreDelta > 0 ? '+' : ''}${inviteIntoUrn.scoreDelta}，` +
              `当前${inviteIntoUrn.attackerScore}分`,
              5
            );
          }
          if (outwardHarmonyInnerDivision?.triggered) {
            const descriptions = [];
            if (outwardHarmonyInnerDivision.dealerTeam?.mismatched) {
              const patterns = outwardHarmonyInnerDivision.dealerTeam.players
                .map(player => `${player.playerName}：${player.patternLabel}`)
                .join('、');
              descriptions.push(`庄家方牌型不一致（${patterns}），闲家获得5分`);
            }
            if (outwardHarmonyInnerDivision.attackerTeam?.mismatched) {
              const patterns = outwardHarmonyInnerDivision.attackerTeam.players
                .map(player => `${player.playerName}：${player.patternLabel}`)
                .join('、');
              descriptions.push(`闲家方牌型不一致（${patterns}），庄家获得5分`);
            }
            messageApi.warning(
              `貌合神离：${descriptions.join('；')}。闲家当前${outwardHarmonyInnerDivision.attackerScore}分`,
              6
            );
          }
          if (ironEvidence?.mode === 'zero' && ironEvidence.specialCardCount > 0) {
            messageApi.warning(
              `铁证如山：本轮出现 ${ironEvidence.specialCardCount} 张铁证牌，牌面 ${ironEvidence.baseRoundPoints} 分清零`,
              4
            );
          } else if (ironEvidence?.specialCardCount > 0) {
            messageApi.info(
              `铁证如山：本轮出现 ${ironEvidence.specialCardCount} 张铁证牌，` +
              `${ironEvidence.baseRoundPoints} × ${ironEvidence.multiplier} = ${ironEvidence.roundPoints} 分`,
              4
            );
          }
          if (Number.isFinite(newScore)) setAttackerScore(newScore);
          setCollectedPointCards(newCards || []);
        }
        if (roundUpdate.candleTransition?.changed) {
          messageApi.info(
            `第四手为纯${roundUpdate.candleTransition.triggerColor === 'red' ? '红' : '黑'}色；` +
            `本轮结算完成，下轮烛将${roundUpdate.candleTransition.nextLit ? '点燃' : '熄灭'}`,
            3
          );
        }
        // 轮末短暂保留完整牌面和赢家提示；如堕云雾只是不保存可回看的上轮历史。
        const completedRoundCards = playedCardsRef.current;
        if (roundClearTimerRef.current) {
          clearTimeout(roundClearTimerRef.current);
          roundClearTimerRef.current = null;
        }
        if (isLostInFogRule) {
          setLastRoundPlayedCards({});
          setViewingLastRound(false);
        } else {
          console.log('保存上轮出牌，玩家数量:', Object.keys(completedRoundCards).length, completedRoundCards);
          setLastRoundPlayedCards(completedRoundCards);
        }
        awaitingRoundClearRef.current = true;
        setHeldCompletedRoundNumber(roundUpdate.round);
        setIsHoldingCompletedRound(true);
        const completedRoundHoldMs = ruleIncludesId(
          currentRoom?.gameState?.selectedRule,
          'time_reversal'
        )
          ? 2000
          : roundUpdate.magicTrick?.triggered
            ? 1800
            : 1000;
        roundClearTimerRef.current = setTimeout(() => {
          if (!awaitingRoundClearRef.current) return;
          awaitingRoundClearRef.current = false;
          heldCompletedRoundNumberRef.current = null;
          roundClearTimerRef.current = null;
          playedCardsRef.current = {};
          setPlayedCards({});
          setCurrentWinningPlayerId(null);
          setIsHoldingCompletedRound(false);
          setHeldCompletedRoundNumber(null);
        }, completedRoundHoldMs);
        // 清空出牌历史
        setPlayHistory([]);
      }
    });

    return () => {
      socket.off('game_started');
      socket.off('drawing_started');
      socket.off('candle_initial_state_selected');
      socket.off('card_dealt');
      socket.off('deal_progress');
      socket.off('card_exchange_started');
      socket.off('card_exchange_submitted');
      socket.off('card_exchange_resolved');
      socket.off('mainstay_started');
      socket.off('mainstay_decision_required');
      socket.off('mainstay_cards_required');
      socket.off('mainstay_player_skipped');
      socket.off('mainstay_decision_resolved');
      socket.off('mainstay_transfer_resolved');
      socket.off('mainstay_hand_updated');
      socket.off('mainstay_completed');
      socket.off('happy_twins_positions_swapped');
      socket.off('happy_twins_positions_restored');
      socket.off('encircle_three_missing_one_transition');
      socket.off('planned_economy_cards_drawn');
      socket.off('magic_trick_prepared');
      socket.off('equivalent_reciprocity_started');
      socket.off('equivalent_reciprocity_card_required');
      socket.off('equivalent_reciprocity_selection_recorded');
      socket.off('equivalent_reciprocity_resolved');
      socket.off('equivalent_reciprocity_hand_updated');
      socket.off('mutual_support_started');
      socket.off('mutual_support_cards_required');
      socket.off('mutual_support_transfer_resolved');
      socket.off('mutual_support_hand_updated');
      socket.off('straw_boat_borrowing_arrows_required');
      socket.off('straw_boat_borrowing_arrows_resolved');
      socket.off('straw_boat_borrowing_arrows_hand_updated');
      socket.off('card_exchange_hand_updated');
      socket.off('whole_hand_exchange_resolved');
      socket.off('whole_hand_exchange_hand_updated');
      socket.off('remove_firewood_exchange_started');
      socket.off('remove_firewood_decision_required');
      socket.off('remove_firewood_decision_resolved');
      socket.off('remove_firewood_exchange_completed');
      socket.off('last_stand_decision_required');
      socket.off('last_stand_hand_updated');
      socket.off('last_stand_activated');
      socket.off('teammate_cheer_decision_required');
      socket.off('teammate_cheer_hand_updated');
      socket.off('teammate_cheer_activated');
      socket.off('teammate_cheer_declined');
      socket.off('teammate_cheer_reverted');
      socket.off('afterglow_decision_required');
      socket.off('afterglow_hand_updated');
      socket.off('afterglow_activated');
      socket.off('afterglow_declined');
      socket.off('afterglow_expired');
      socket.off('afterglow_reverted');
      socket.off('wooden_ox_decision_required');
      socket.off('wooden_ox_private_state');
      socket.off('wooden_ox_hand_updated');
      socket.off('wooden_ox_action_recorded');
      socket.off('wooden_ox_round_ready');
      socket.off('wooden_ox_transferred');
      socket.off('strength_compensation_hand_updated');
      socket.off('defense_as_offense_hand_updated');
      socket.off('time_reversal_activated');
      socket.off('time_reversal_decision_required');
      socket.off('time_reversal_hand_restored');
      socket.off('time_reversal_response_recorded');
      socket.off('time_reversal_resolved');
      socket.off('forbidden_magic_reserved');
      socket.off('forbidden_magic_decision_required');
      socket.off('forbidden_magic_activated');
      socket.off('forbidden_magic_declined');
      socket.off('forbidden_magic_decisions_completed');
      socket.off('lure_tiger_reserved');
      socket.off('lure_tiger_decision_required');
      socket.off('lure_tiger_target_required');
      socket.off('lure_tiger_activated');
      socket.off('lure_tiger_declined');
      socket.off('lure_tiger_decisions_completed');
      socket.off('cards_shown');
      socket.off('bottom_cards_received');
      socket.off('secondary_burying_started');
      socket.off('secondary_bottom_cards_received');
      socket.off('burying_player_set');
      socket.off('dealer_selected');
      socket.off('open_hand_revealed');
      socket.off('iceberg_reveal_selection_required');
      socket.off('iceberg_reveal_selection_confirmed');
      socket.off('waiting_rabbit_selection_started');
      socket.off('waiting_rabbit_selection_required');
      socket.off('waiting_rabbit_target_selected');
      socket.off('waiting_rabbit_target_locked');
      socket.off('waiting_rabbit_triggered');
      socket.off('waiting_rabbit_exchange_required');
      socket.off('waiting_rabbit_resolved');
      socket.off('waiting_rabbit_hand_updated');
      socket.off('ten_sided_ambush_selection_started');
      socket.off('ten_sided_ambush_selection_required');
      socket.off('ten_sided_ambush_rank_selected');
      socket.off('ten_sided_ambush_rank_locked');
      socket.off('ten_sided_ambush_revealed');
      socket.off('three_powers_selection_started');
      socket.off('three_powers_selection_required');
      socket.off('three_powers_rank_selected');
      socket.off('three_powers_rank_locked');
      socket.off('three_powers_revealed');
      socket.off('gentleman_promise_selection_started');
      socket.off('gentleman_promise_selection_required');
      socket.off('gentleman_promise_declared');
      socket.off('gentleman_promise_completed');
      socket.off('hidden_dragon_selection_started');
      socket.off('hidden_dragon_selection_required');
      socket.off('hidden_dragon_declared');
      socket.off('hidden_dragon_completed');
      socket.off('hidden_dragon_resolved');
      socket.off('hidden_dragon_reverted');
      socket.off('antinomy_selection_started');
      socket.off('antinomy_selection_required');
      socket.off('antinomy_selection_submitted');
      socket.off('antinomy_declarations_revealed');
      socket.off('rice_to_mulberry_selection_started');
      socket.off('rice_to_mulberry_selection_required');
      socket.off('rice_to_mulberry_hand_updated');
      socket.off('rice_to_mulberry_transformed');
      socket.off('rice_to_mulberry_completed');
      socket.off('surrender_requested');
      socket.off('surrender_decision_pending');
      socket.off('surrender_decision_required');
      socket.off('surrender_rejected');
      socket.off('game_surrendered');
      socket.off('destroy_dyke_decision_pending');
      socket.off('destroy_dyke_decision_required');
      socket.off('destroy_dyke_activated');
      socket.off('destroy_dyke_declined');
      socket.off('destroy_dyke_disaster_updated');
      socket.off('destroy_dyke_disaster_resolved');
      socket.off('administrative_review_selection_started');
      socket.off('administrative_review_selection_required');
      socket.off('administrative_review_declared');
      socket.off('administrative_review_completed');
      socket.off('administrative_review_progressed');
      socket.off('administrative_review_burying_unlocked');
      socket.off('administrative_review_buried');
      socket.off('political_review_play_pending');
      socket.off('political_review_play_held');
      socket.off('political_review_decision_required');
      socket.off('political_review_play_approved');
      socket.off('political_review_resolved');
      socket.off('focus_figure_voting_started');
      socket.off('focus_figure_vote_required');
      socket.off('focus_figure_vote_recorded');
      socket.off('focus_figure_nominee_changed');
      socket.off('focus_figure_team_finalized');
      socket.off('focus_figure_voting_completed');
      socket.off('rule_visible_hands_updated');
      socket.off('cards_buried');
      socket.off('first_player_set');
      socket.off('active_skill_activated');
      socket.off('invite_into_urn_activated');
      socket.off('bush_gate_activated');
      socket.off('dream_killing_started');
      socket.off('dream_killing_awakened');
      socket.off('cards_played');
      socket.off('ambiguous_choice_required');
      socket.off('ambiguous_choice_pending');
      socket.off('ambiguous_choice_resolved');
      socket.off('ambiguous_hand_updated');
      socket.off('ambiguous_round_resolved');
      socket.off('three_tigers_transformed');
      socket.off('concealed_cards_played_private');
      socket.off('concealed_plays_revealed');
      socket.off('turn_passed');
      socket.off('play_undone');
      socket.off('concealed_play_undone_private');
      socket.off('bottom_revealed');
      socket.off('my_bottom_cards');
      socket.off('player_ready_for_next');
      socket.off('next_game_started');
      socket.off('game_restarted');
      socket.off('score_updated');
      socket.off('level_updated');
      socket.off('trump_updated');
      socket.off('throw_failed');
      socket.off('trump_action');
      socket.off('trump_declared');
      socket.off('three_six_nine_updated');
      socket.off('config_updated');
      socket.off('bot_type_updated');
      socket.off('player_name_updated');
      socket.off('chat_message_received');
      socket.off('bot_added');
      socket.off('bot_removed');
      socket.off('player_ready_status');
      socket.off('all_players_ready');
      socket.off('rule_selected');
      socket.off('double_happiness_selection_started');
      socket.off('double_happiness_option_refreshed');
      socket.off('dealer_countdown_start');
      socket.off('dealer_countdown_end');
      socket.off('trump_action');
      socket.off('round_updated');
      if (tenSidedAmbushAnimationTimerRef.current) {
        clearTimeout(tenSidedAmbushAnimationTimerRef.current);
        tenSidedAmbushAnimationTimerRef.current = null;
      }
      if (threePowersAnimationTimerRef.current) {
        clearTimeout(threePowersAnimationTimerRef.current);
        threePowersAnimationTimerRef.current = null;
      }
    };
  }, [socket, messageApi, clearSelection, addCard, removeCards, currentPlayer, currentRoom]);

  // GameBoard 的私密事件监听器全部挂载后再主动拉取一次个人待办。
  // 依赖 socketId 可同时覆盖整页刷新和 Socket 断线后换连接恢复，且不会随普通 room_updated 重复请求。
  useEffect(() => {
    if (!socket || !currentRoom?.id || !currentPlayer?.id) return;
    // 同一连接内拦截 StrictMode 等造成的重复重放；一旦换了连接，则必须允许
    // 尚未送达服务端的政治审查放行凭证重新提交。
    politicalReviewApprovalSubmittingRef.current.clear();
    socket.emit(SOCKET_EVENTS.REQUEST_PRIVATE_GAME_STATE_SYNC, {
      roomId: currentRoom.id
    });
  }, [
    socket,
    currentRoom?.id,
    currentPlayer?.id,
    currentPlayer?.socketId
  ]);

  // 庄家倒计时递减
  useEffect(() => {
    if (dealerCountdown === null || dealerCountdown <= 0) return;

    const timer = setInterval(() => {
      setDealerCountdown(prev => {
        if (prev === null || prev <= 1) {
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [dealerCountdown]);

  // 断线重连或刷新后，当前被轮询的玩家仍能恢复不可关闭的确认框。
  useEffect(() => {
    if (forbiddenMagicState?.decisionPlayerId === currentPlayer?.id) {
      setForbiddenMagicDecision({ round: forbiddenMagicState.decisionRound });
    } else {
      setForbiddenMagicDecision(null);
    }
  }, [
    forbiddenMagicState?.decisionPlayerId,
    forbiddenMagicState?.decisionRound,
    currentPlayer?.id
  ]);

  // 调虎离山分“确认发动”和“选择目标”两步；刷新后按服务端阶段恢复同一个强制窗口。
  useEffect(() => {
    const decision = lureTigerState?.currentDecision;
    if (decision?.playerId === currentPlayer?.id) {
      setLureTigerDecision(decision);
    } else {
      setLureTigerDecision(null);
    }
  }, [
    lureTigerState?.currentDecision?.playerId,
    lureTigerState?.currentDecision?.stage,
    lureTigerState?.currentDecision?.round,
    currentPlayer?.id
  ]);

  // 釜底抽薪发生在亮主结束后的冻结阶段；刷新后仍应恢复到当前被询问者的可选确认框。
  useEffect(() => {
    const decision = removeFirewoodState?.currentDecision;
    if (decision?.counteredPlayerId === currentPlayer?.id) {
      setRemoveFirewoodDecision(decision);
    } else {
      setRemoveFirewoodDecision(null);
    }
  }, [
    removeFirewoodState?.currentDecision?.sequence,
    removeFirewoodState?.currentDecision?.counteredPlayerId,
    currentPlayer?.id
  ]);

  // 切换出牌人时先清掉上一手选择，再计算新出牌人的自动选择。
  useEffect(() => {
    clearSelection();
    setJustPlayedCards(false);
    setArmedActiveSkillId(null);
    setLateMoverDecisionOpen(false);
    setCulturalRevolutionSelection(null);
  }, [gameState?.currentPlayerIndex, clearSelection]);

  // 自动选中必须出的牌
  useEffect(() => {
    // 只在出牌阶段且轮到当前玩家时执行
    if (phase !== GamePhases.PLAYING || !gameState || !currentPlayer) return;
    if (icebergSelection || hasPendingIcebergSelection) return;
    if (isActiveSkillArmed) return;

    const isMyTurn = isCurrentPlayersTurn(gameState, currentRoom?.players, currentPlayer?.id);

    if (!isMyTurn) return;

    // 如果刚刚出过牌，不要自动选中
    if (justPlayedCards) return;

    // 检查当前玩家是否已经在本轮出过牌了
    const hasPlayedThisRound = playedCards[currentTurnOwner?.id] !== undefined;
    if (hasPlayedThisRound) return; // 已经出过牌了，不要再自动选中

    // 检查是否是首发
    const isLeading = gameState?.currentRoundPlays === 0 ||
                     gameState?.playersPlayedThisRound?.length === 0 ||
                     (Array.isArray(gameState?.playersPlayedThisRound) && gameState.playersPlayedThisRound.length === 0);

    // 如果是首发，不自动选中（让用户自己决定出什么牌）
    if (isLeading) return;

    // 如果是跟牌，使用辅助函数计算必须出的牌
    const leadingPattern = gameState?.leadingPattern;
    if (!leadingPattern || activePlayCards.length === 0) return;

    const regularHandCards = activePlayCards.filter(card => !card.isWoodenOxCard);
    const finalTrickCardIds = getFinalTrickAutoSelectedCardIds({
      gameState,
      players: currentRoom?.players,
      handCards: regularHandCards
    });
    const cardsToAutoSelect = finalTrickCardIds ? null : calculateMustPlayCards(
      mapOneCountryCardsForCurrentPlayer(
        regularHandCards,
        gameState
      ),
      leadingPattern,
      trumpSuit,
      trumpRank,
      gameState?.selectedRule
        ? {
            ...gameState.selectedRule,
            currentRound: gameState.currentRound,
            inferiorSuit: gameState?.threeSixNine?.inferiorSuit || null,
            antinomySplitFaceKeys: Object.values(
              gameState?.antinomy?.declarationsByPlayerId || {}
            )
              .filter(declaration => declaration?.effective)
              .map(declaration => declaration.faceKey)
          }
        : null
    );

    // 如果有需要自动选中的牌，进行选中
    const cardIdsToSelect = finalTrickCardIds
      || cardsToAutoSelect?.map(card => card.id)
      || [];
    if (cardIdsToSelect.length > 0) {

      // 检查当前选中的牌是否已经包含了所有必须出的牌
      const mustPlayCardIds = new Set(cardIdsToSelect);
      const currentlySelectedMustCards = selectedCards.filter(id => mustPlayCardIds.has(id));

      // 如果用户已经选中了所有必须出的牌，并且还选了其他牌（在手动凑数），不要重置选中状态
      if (currentlySelectedMustCards.length === cardIdsToSelect.length && selectedCards.length > cardIdsToSelect.length) {
        return; // 用户正在手动添加其他牌，不干扰
      }

      // 只在选中的牌不同时才更新（避免无限循环）
      const currentSorted = [...selectedCards].sort().join(',');
      const newSorted = [...cardIdsToSelect].sort().join(',');
      if (currentSorted !== newSorted) {
        setSelectedCards(cardIdsToSelect);
      }
    }
  }, [phase, gameState?.currentPlayerIndex, gameState?.currentRoundPlays, gameState?.playersPlayedThisRound,
      gameState?.leadingPattern, gameState?.selectedRule?.id, gameState?.oneCountryTwoSystems?.resolved,
      gameState?.antinomy?.declarationsByPlayerId,
      activePlayCards, trumpSuit, trumpRank,
      currentPlayer, currentRoom,
      gameState?.playMode, selectedCards, setSelectedCards, playedCards, justPlayedCards,
      icebergSelection, hasPendingIcebergSelection, isActiveSkillArmed]);

  useEffect(() => {
    if (!armedActiveSkillId) return;
    if (activeSkill?.id !== armedActiveSkillId || !activeSkillAvailability.canActivate) {
      setArmedActiveSkillId(null);
    }
  }, [
    armedActiveSkillId,
    activeSkill?.id,
    activeSkillAvailability.canActivate
  ]);

  useEffect(() => {
    if (!isActiveSkillArmed || activeSkill?.effect !== 'two_legal_plays_choose_at_round_end') {
      setAmbiguousFirstOptionCardIds([]);
    }
  }, [isActiveSkillArmed, activeSkill?.effect]);

  useEffect(() => {
    const isDivineWeaponArmed = isActiveSkillArmed
      && activeSkill?.effect === 'transform_matching_card';
    const targetStillExists = divineWeapon?.cards?.some(
      card => card.id === selectedDivineWeaponCardId
    );
    if (!isDivineWeaponArmed || (selectedDivineWeaponCardId && !targetStillExists)) {
      setSelectedDivineWeaponCardId(null);
      setDivineWeaponSourceCardId(null);
    }
  }, [
    isActiveSkillArmed,
    activeSkill?.effect,
    divineWeapon?.generation,
    divineWeapon?.cards,
    selectedDivineWeaponCardId
  ]);

  // 同步主牌状态和规则
  useEffect(() => {
    if (gameState) {
      setTrumpSuit(gameState.trumpSuit);
      setTrumpRank(gameState.trumpRank);
      setSelectedRule(gameState.selectedRule || null);
    }
  }, [gameState]);

  // 同步房间配置
  useEffect(() => {
    if (currentRoom?.config) {
      setNewDealInterval(currentRoom.config.dealInterval);
      setNewBotType(currentRoom.config.botType || 'who_designed');
    }
  }, [currentRoom]);

  // 开始游戏
  const handleStartGame = () => {
    socket.emit(SOCKET_EVENTS.START_GAME, { roomId: currentRoom.id });
  };

  // 玩家准备
  const handlePlayerReady = () => {
    socket.emit('player_ready', { roomId: currentRoom.id });
  };

  // 亮主处理
  const handleDeclare = (suitType, count, declarationRole = 'trump') => {
    // 映射suitType到实际的花色
    const suitMap = {
      'spades': 'spades',
      'hearts': 'hearts',
      'clubs': 'clubs',
      'diamonds': 'diamonds',
      'joker': 'joker'
    };

    const suit = suitMap[suitType];
    if (!suit) {
      messageApi.error('无效的花色');
      return;
    }

    console.log(`🎺 尝试亮${declarationRole === 'inferior' ? '劣' : '主'}: ${suitType}, 数量: ${count}`);

    // 发送亮主请求到服务器
    socket.emit(SOCKET_EVENTS.DECLARE_TRUMP, {
      roomId: currentRoom.id,
      suit: suit,
      count: count,
      declarationRole
    });
  };

  // 一键选中所有手牌
  const handleSelectAllCards = () => {
    const baseCards = phase === GamePhases.PLAYING ? activePlayCards : myCards;
    const disabledCardIds = new Set(
      phase === GamePhases.PLAYING ? ruleDisabledCardIds : []
    );
    const selectableCards = baseCards.filter(card => !disabledCardIds.has(card.id));
    if (selectableCards.length === 0) {
      messageApi.warning(baseCards.length > 0 ? '当前没有可选择的牌' : '没有手牌可选择');
      return;
    }
    const allCardIds = selectableCards.map(card => card.id);
    // 如果已经全选，则取消全选
    if (
      selectedCards.length === selectableCards.length
      && allCardIds.every(cardId => selectedCards.includes(cardId))
    ) {
      clearSelection();
    } else {
      // 选中所有牌
      setSelectedCards(allCardIds);
    }
  };

  // 设置埋底玩家
  const handleSetBuryingPlayer = () => {
    if (!selectedBuryingPlayer) {
      messageApi.warning('请选择埋底玩家');
      return;
    }
    socket.emit(SOCKET_EVENTS.SET_BURYING_PLAYER, {
      roomId: currentRoom.id,
      playerId: selectedBuryingPlayer
    });
    setBuryingPlayerModal(false);
  };

  // 埋底
  const handleBuryCards = () => {
    if (!isBurySelectionValid(selectedCards, activeBottomCardsCount)) {
      messageApi.warning(`请选择 ${activeBottomCardsCount} 张牌进行埋底`);
      return;
    }
    const cardsToRemove = [...selectedCards];
    socket.emit(SOCKET_EVENTS.BURY_CARDS, {
      roomId: currentRoom.id,
      cardIds: cardsToRemove
    });
    // 立即从手牌中移除（乐观更新）
    removeCards(cardsToRemove);
    clearSelection();
  };

  // 设置首发玩家
  const handleSetFirstPlayer = () => {
    if (!selectedFirstPlayer) {
      messageApi.warning('请选择首发玩家');
      return;
    }
    socket.emit(SOCKET_EVENTS.SET_FIRST_PLAYER, {
      roomId: currentRoom.id,
      playerId: selectedFirstPlayer
    });
    setFirstPlayerModal(false);
  };

  // 出牌
  const handleEquivalentReciprocityTarget = (player) => {
    if (
      activeSkill?.effect === 'swap_two_plays_at_round_end'
      && isActiveSkillArmed
      && player
    ) {
      if (player.id === currentPlayer?.id) {
        messageApi.warning('魔术戏法不能选择自己');
        return;
      }
      setMagicTrickTargetIds(previous => previous.includes(player.id)
        ? previous.filter(playerId => playerId !== player.id)
        : previous.length < 2
          ? [...previous, player.id]
          : previous
      );
      return;
    }
    if (
      activeSkill?.effect !== 'compare_and_exchange'
      || !isActiveSkillArmed
      || !player
      || player.id === currentPlayer?.id
    ) return;
    if ((player.cardsCount || 0) < 1) {
      messageApi.warning('对方已经没有手牌，不能与其拼点');
      return;
    }
    setEquivalentReciprocityTarget(player);
  };

  const handleSubmitEquivalentReciprocityCard = () => {
    if (!equivalentReciprocitySelection || !equivalentReciprocityCardId) {
      messageApi.warning('请选择一张拼点牌');
      return;
    }
    socket.emit(SOCKET_EVENTS.SUBMIT_EQUIVALENT_RECIPROCITY_CARD, {
      roomId: currentRoom.id,
      challengeId: equivalentReciprocitySelection.challengeId,
      cardId: equivalentReciprocityCardId
    });
  };

  const handleRespondMainstay = (accept) => {
    if (!ownMainstayAction || ownMainstayAction.stage !== 'decision') return;
    socket.emit(SOCKET_EVENTS.RESPOND_MAINSTAY, {
      roomId: currentRoom.id,
      accept
    });
  };

  const handleToggleMainstayCard = (cardId) => {
    if (!ownMainstayAction || !['give', 'return'].includes(ownMainstayAction.stage)) return;
    const card = myCards.find(value => value.id === cardId);
    setMainstaySelectedCardIds(previous => {
      if (previous.includes(cardId)) {
        if (
          ownMainstayAction.stage === 'give'
          && card
          && isTrumpCard(card, gameState?.trumpSuit, gameState?.trumpRank)
        ) {
          messageApi.warning('发动中流砥柱时必须交出当前全部主牌');
          return previous;
        }
        return previous.filter(id => id !== cardId);
      }
      if (previous.length >= (ownMainstayAction.requiredCards || 5)) return previous;
      return [...previous, cardId];
    });
  };

  const handleSubmitMainstayCards = () => {
    if (!ownMainstayAction || !['give', 'return'].includes(ownMainstayAction.stage)) return;
    const requiredCards = ownMainstayAction.requiredCards || 5;
    if (mainstaySelectedCardIds.length !== requiredCards) {
      messageApi.warning(`必须选择${requiredCards}张牌`);
      return;
    }
    if (ownMainstayAction.stage === 'give') {
      const selectedIds = new Set(mainstaySelectedCardIds);
      const missingTrump = myCards.some(card => (
        isTrumpCard(card, gameState?.trumpSuit, gameState?.trumpRank)
        && !selectedIds.has(card.id)
      ));
      if (missingTrump) {
        messageApi.warning('交出的5张牌必须包含当前全部主牌');
        return;
      }
    }
    socket.emit(SOCKET_EVENTS.SUBMIT_MAINSTAY_CARDS, {
      roomId: currentRoom.id,
      actionId: ownMainstayAction.id,
      cardIds: mainstaySelectedCardIds
    });
  };

  const getMutualSupportTeammate = () => {
    const playerIndex = currentRoom?.players?.findIndex(player => player.id === currentPlayer?.id);
    if (!Number.isInteger(playerIndex) || playerIndex < 0 || currentRoom?.players?.length !== 4) {
      return null;
    }
    return currentRoom.players[(playerIndex + 2) % 4] || null;
  };

  const handleMutualSupportRequest = () => {
    socket.emit(SOCKET_EVENTS.ACTIVATE_MUTUAL_SUPPORT, {
      roomId: currentRoom.id,
      direction: 'request',
      cardIds: []
    });
    setMutualSupportDirectionOpen(false);
  };

  const handleMutualSupportGive = () => {
    const teammate = getMutualSupportTeammate();
    const maxCards = mutualSupportMaxGiveCount;
    if (maxCards < 1) {
      messageApi.warning('必须先保留本轮出牌所需的手牌，现在没有牌可以交给队友');
      return;
    }
    setMutualSupportSelectedCardIds([]);
    setMutualSupportSelection({
      source: 'activation',
      stage: 'initial',
      otherPlayerId: teammate?.id || null,
      otherPlayerName: teammate?.name || '队友',
      minCards: 1,
      maxCards
    });
    setMutualSupportDirectionOpen(false);
  };

  const handleToggleMutualSupportCard = (cardId) => {
    setMutualSupportSelectedCardIds(previous => {
      if (previous.includes(cardId)) return previous.filter(id => id !== cardId);
      if (previous.length >= (mutualSupportSelection?.maxCards || 0)) return previous;
      return [...previous, cardId];
    });
  };

  const handleSubmitMutualSupportCards = () => {
    if (!mutualSupportSelection) return;
    const selectedCount = mutualSupportSelectedCardIds.length;
    if (
      selectedCount < mutualSupportSelection.minCards
      || selectedCount > mutualSupportSelection.maxCards
    ) {
      messageApi.warning(
        mutualSupportSelection.minCards === mutualSupportSelection.maxCards
          ? `必须选择${mutualSupportSelection.minCards}张牌`
          : `请选择${mutualSupportSelection.minCards}至${mutualSupportSelection.maxCards}张牌`
      );
      return;
    }
    if (mutualSupportSelection.source === 'activation') {
      socket.emit(SOCKET_EVENTS.ACTIVATE_MUTUAL_SUPPORT, {
        roomId: currentRoom.id,
        direction: 'give',
        cardIds: mutualSupportSelectedCardIds
      });
    } else {
      socket.emit(SOCKET_EVENTS.SUBMIT_MUTUAL_SUPPORT_CARDS, {
        roomId: currentRoom.id,
        actionId: mutualSupportSelection.actionId,
        cardIds: mutualSupportSelectedCardIds
      });
    }
    setMutualSupportSelection(null);
    setMutualSupportSelectedCardIds([]);
  };

  const handleConfirmCulturalRevolution = () => {
    const declarationType = culturalRevolutionSelection?.declarationType;
    const value = culturalRevolutionSelection?.value;
    if (!declarationType || !value) {
      messageApi.warning(declarationType ? '请选择要声明的目标' : '请先选择革花色或革点数');
      return;
    }
    socket.emit(SOCKET_EVENTS.ACTIVATE_CULTURAL_REVOLUTION, {
      roomId: currentRoom.id,
      declarationType,
      value
    });
    setCulturalRevolutionSelection(null);
  };

  const handleConfirmInviteIntoUrn = () => {
    const { targetPlayerId, suit, rank } = inviteIntoUrnSelection || {};
    if (!targetPlayerId || !suit || !rank) {
      messageApi.warning('请依次选择玩家、花色和点数');
      return;
    }
    socket.emit(SOCKET_EVENTS.ACTIVATE_INVITE_INTO_URN, {
      roomId: currentRoom.id,
      targetPlayerId,
      suit,
      rank
    });
    setInviteIntoUrnSelection(null);
  };

  const handleToggleActiveSkill = () => {
    if (!activeSkill) return;
    if (activeSkill.effect === 'declare_target_card') {
      if (!activeSkillAvailability.canActivate) {
        messageApi.warning(activeSkillAvailability.reason || '现在不能发动这个技能');
        return;
      }
      clearSelection();
      setInviteIntoUrnSelection({ targetPlayerId: null, suit: null, rank: null });
      return;
    }
    if (activeSkill.effect === 'temporarily_replace_trump') {
      if (!activeSkillAvailability.canActivate) {
        messageApi.warning(activeSkillAvailability.reason || '现在不能发动这个技能');
        return;
      }
      clearSelection();
      setCulturalRevolutionSelection({ declarationType: null, value: null });
      return;
    }
    if (activeSkill.effect === 'silence_non_leader_for_round') {
      if (isLureTigerReservedByMe) {
        messageApi.info(activeSkillAvailability.reason || '已经预备调虎离山，请等待轮首确认');
        return;
      }
      if (!activeSkillAvailability.canActivate) {
        messageApi.warning(activeSkillAvailability.reason || '现在不能预备这个技能');
        return;
      }
      clearSelection();
      socket.emit(SOCKET_EVENTS.ACTIVATE_LURE_TIGER, {
        roomId: currentRoom.id
      });
      return;
    }
    if (activeSkill.effect === 'demote_trumps_and_transform') {
      if (isForbiddenMagicActiveByMe) {
        messageApi.info('禁术秘法已在本局永久生效，可点击原主牌上的“转”改变牌面');
        return;
      }
      if (isForbiddenMagicReservedByMe) {
        messageApi.info(activeSkillAvailability.reason || '已经预备禁术秘法，请等待轮首确认');
        return;
      }
      if (!activeSkillAvailability.canActivate) {
        messageApi.warning(activeSkillAvailability.reason || '现在不能预备这个技能');
        return;
      }
      clearSelection();
      setExplicitCardTransformations({});
      setCardTransformationDialog(null);
      socket.emit(SOCKET_EVENTS.ACTIVATE_FORBIDDEN_MAGIC, {
        roomId: currentRoom.id
      });
      return;
    }
    if (activeSkill.effect === 'rewind_completed_round') {
      if (!activeSkillAvailability.canActivate) {
        messageApi.warning(activeSkillAvailability.reason || '现在不能预备这个技能');
        return;
      }
      clearSelection();
      socket.emit(SOCKET_EVENTS.ACTIVATE_TIME_REVERSAL, {
        roomId: currentRoom.id
      });
      return;
    }
    if (activeSkill.effect === 'sleep_random_play') {
      if (!activeSkillAvailability.canActivate) {
        messageApi.warning(activeSkillAvailability.reason || '现在不能发动这个技能');
        return;
      }
      clearSelection();
      socket.emit(SOCKET_EVENTS.ACTIVATE_DREAM_KILLING, {
        roomId: currentRoom.id
      });
      return;
    }
    if (activeSkill.effect === 'temporary_teammate_card_transfer') {
      if (!activeSkillAvailability.canActivate) {
        messageApi.warning(activeSkillAvailability.reason || '现在不能发动这个技能');
        return;
      }
      clearSelection();
      setMutualSupportSelectedCardIds([]);
      setMutualSupportDirectionOpen(true);
      return;
    }
    if (activeSkill.effect === 'force_leader_replay') {
      if (!activeSkillAvailability.canActivate) {
        messageApi.warning(activeSkillAvailability.reason || '现在不能发动这个技能');
        return;
      }
      clearSelection();
      setBushGateDecisionOpen(true);
      return;
    }
    if (activeSkill.effect === 'yield_turn_to_next_player') {
      if (!activeSkillAvailability.canActivate) {
        messageApi.warning(activeSkillAvailability.reason || '现在不能发动这个技能');
        return;
      }
      clearSelection();
      setLateMoverDecisionOpen(true);
      return;
    }
    if (activeSkill.effect === 'compare_and_exchange') {
      if (isActiveSkillArmed) {
        setArmedActiveSkillId(null);
        setEquivalentReciprocityTarget(null);
        return;
      }
      if (!activeSkillAvailability.canActivate) {
        messageApi.warning(activeSkillAvailability.reason || '现在不能发动这个技能');
        return;
      }
      clearSelection();
      setEquivalentReciprocityTarget(null);
      setArmedActiveSkillId(activeSkill.id);
      messageApi.info('等价互惠已就绪：请点击另一名玩家的玩家框');
      return;
    }
    if (activeSkill.effect === 'swap_two_plays_at_round_end') {
      if (isMagicTrickPrepared) {
        messageApi.info('本轮魔术戏法已经暗中准备');
        return;
      }
      if (isActiveSkillArmed) {
        setArmedActiveSkillId(null);
        setMagicTrickTargetIds([]);
        return;
      }
      if (!activeSkillAvailability.canActivate) {
        messageApi.warning(activeSkillAvailability.reason || '现在不能发动这个技能');
        return;
      }
      clearSelection();
      setMagicTrickTargetIds([]);
      setArmedActiveSkillId(activeSkill.id);
      messageApi.info('魔术戏法已就绪：请依次点击两名其他玩家');
      return;
    }
    if (activeSkill.effect === 'two_legal_plays_choose_at_round_end') {
      if (isActiveSkillArmed) {
        setArmedActiveSkillId(null);
        setAmbiguousFirstOptionCardIds([]);
        clearSelection();
        messageApi.info('已取消模棱两可');
        return;
      }
      if (!activeSkillAvailability.canActivate) {
        messageApi.warning(activeSkillAvailability.reason || '现在不能发动这个技能');
        return;
      }
      clearSelection();
      setAmbiguousFirstOptionCardIds([]);
      setArmedActiveSkillId(activeSkill.id);
      messageApi.info('模棱两可已就绪：请先选择并保存合法的方案A');
      return;
    }
    if (isActiveSkillArmed) {
      setArmedActiveSkillId(null);
      setCardTransformationDialog(null);
      if (isExplicitTransformationSkill) {
        messageApi.info('已关闭转化编辑；完成的转化仍会保留，可点牌面选牌或点“还”恢复原牌');
        return;
      }
      setExplicitCardTransformations({});
      if (activeSkill.effect === 'transform_matching_card') {
        setSelectedDivineWeaponCardId(null);
        setDivineWeaponSourceCardId(null);
      }
      clearSelection();
      return;
    }
    if (!activeSkillAvailability.canActivate) {
      messageApi.warning(activeSkillAvailability.reason || '现在不能发动这个技能');
      return;
    }
    if (!isExplicitTransformationSkill) {
      clearSelection();
      setExplicitCardTransformations({});
    }
    setCardTransformationDialog(null);
    setArmedActiveSkillId(activeSkill.id);
    const prompt = activeSkill.effect === 'concealed_until_round_end'
      ? '请选择要暗置打出的牌'
      : activeSkill.effect === 'ignore_odd_led_side_suit'
        ? `已虚置${virtualizedCardIds.length || activeSkillAvailability.virtualizedCardIds?.length || 0}张对应副牌，请从其余手牌中完成本次出牌`
      : activeSkill.effect === 'joker_wildcards'
        ? '请点王牌左侧的“转”，先选花色、再选点数；点牌面仍是正常选牌'
        : activeSkill.effect === 'adjacent_rank_transform'
          ? '请点普通牌左侧的“转”选择相邻点数；点牌面仍是正常选牌'
        : activeSkill.effect === 'transform_matching_card'
          ? '请先选择牌桌中央的一张神兵牌'
        : activeSkill.effect === 'belt_and_road_lead'
          ? '请选择同一有效花色的两张非对子单牌'
        : '请选择要垫出的牌';
    messageApi.info(`${activeSkill.name}已就绪：${prompt}`);
  };

  const handlePlayCards = () => {
    if (hasTimeReversalDecisionPending) {
      messageApi.warning('本轮正在等待时间倒流决定');
      return;
    }
    if (
      ['compare_and_exchange', 'swap_two_plays_at_round_end'].includes(activeSkill?.effect)
      && isActiveSkillArmed
    ) {
      messageApi.warning('请先完成玩家选择，或再次点击技能取消');
      return;
    }
    if (!isCurrentPlayersTurn(gameState, currentRoom?.players, currentPlayer?.id)) {
      messageApi.warning('现在还没有轮到你出牌');
      return;
    }
    const selectionValidation = validatePlaySelection({
      selectedCardIds: selectedCards,
      handCards: activePlayCards,
      gameState,
      trumpSuit,
      trumpRank,
      activeSkillId: effectiveActiveSkillId,
      currentPlayerId: isProxyTurn ? openHand?.playerId : currentPlayer?.id,
      jokerSubstitutions,
      clusterAnalysisSubstitutions,
      forbiddenMagicSubstitutions,
      divineWeaponCardId: selectedDivineWeaponCardId,
      divineWeaponSourceCardId
    });
    if (!selectionValidation.valid) {
      messageApi.warning(selectionValidation.message);
      return;
    }
    const cardsToPlay = [...selectedCards];
    const isAmbiguousPlay = isActiveSkillArmed
      && activeSkill?.effect === 'two_legal_plays_choose_at_round_end';
    if (isAmbiguousPlay && ambiguousFirstOptionCardIds.length === 0) {
      setAmbiguousFirstOptionCardIds(cardsToPlay);
      clearSelection();
      messageApi.success('方案A已保存；请选择一套不同且同样合法的方案B');
      return;
    }
    if (isAmbiguousPlay) {
      const firstKey = [...ambiguousFirstOptionCardIds].sort().join('|');
      const secondKey = [...cardsToPlay].sort().join('|');
      if (firstKey === secondKey) {
        messageApi.warning('方案B必须与方案A不同');
        return;
      }
    }
    console.log('发送 PLAY_CARDS 事件:', { cardIds: cardsToPlay });

    socket.emit(SOCKET_EVENTS.PLAY_CARDS, {
      roomId: currentRoom.id,
      cardIds: isAmbiguousPlay ? ambiguousFirstOptionCardIds : cardsToPlay,
      controlledPlayerId: isProxyTurn ? openHand.playerId : null,
      activeSkillId: effectiveActiveSkillId,
      jokerSubstitutions,
      clusterAnalysisSubstitutions,
      forbiddenMagicSubstitutions,
      divineWeaponCardId: selectedDivineWeaponCardId,
      divineWeaponSourceCardId,
      ambiguousAlternativeCardIds: isAmbiguousPlay ? cardsToPlay : []
    });
    setArmedActiveSkillId(null);
    setAmbiguousFirstOptionCardIds([]);
    setExplicitCardTransformations({});
    setCardTransformationDialog(null);
    clearSelection();
  };

  // 跳过
  const handlePass = () => {
    socket.emit(SOCKET_EVENTS.PASS_TURN, {
      roomId: currentRoom.id
    });
  };

  // 撤回出牌
  const handleUndoPlay = () => {
    socket.emit(SOCKET_EVENTS.UNDO_PLAY, {
      roomId: currentRoom.id
    });
  };

  const handleRespondStrawBoatBorrowingArrows = accept => {
    if (accept && !strawBoatDiscardCardId) {
      messageApi.warning('请先选择一张非分数牌公开弃置');
      return;
    }
    socket.emit(SOCKET_EVENTS.RESPOND_STRAW_BOAT_BORROWING_ARROWS, {
      roomId: currentRoom.id,
      accept,
      cardId: accept ? strawBoatDiscardCardId : null
    });
  };

  // 普通规则仅庄家可查看；特殊规则由服务端按请求者身份返回可见的底牌。
  const handleViewMyBottomCards = () => {
    socket.emit(SOCKET_EVENTS.VIEW_MY_BOTTOM_CARDS, {
      roomId: currentRoom.id
    });
  };

  const handleReadyForNext = () => {
    if (isReadyForNext) {
      return; // 已经准备过了，防止重复点击
    }
    setIsReadyForNext(true);
    socket.emit('ready_for_next_game', {
      roomId: currentRoom.id
    });
  };

  // 查看上轮出牌
  const handleViewLastRound = () => {
    // 如果正在查看，重复点击则刷新计时
    if (lastRoundTimer) {
      clearTimeout(lastRoundTimer);
    }

    // 设置为查看模式
    setViewingLastRound(true);

    // 2秒后自动恢复
    const timer = setTimeout(() => {
      setViewingLastRound(false);
      setLastRoundTimer(null);
    }, 2000);

    setLastRoundTimer(timer);
  };

  // 调整分数
  const handleUpdateScore = () => {
    if (!selectedPlayerId) {
      messageApi.warning('请选择玩家');
      return;
    }
    socket.emit(SOCKET_EVENTS.UPDATE_SCORE, {
      roomId: currentRoom.id,
      playerId: selectedPlayerId,
      newScore: adjustValue
    });
    setScoreAdjustModal(false);
  };

  // 调整等级
  const handleUpdateLevel = () => {
    if (!selectedPlayerId) {
      messageApi.warning('请选择玩家');
      return;
    }
    socket.emit(SOCKET_EVENTS.UPDATE_LEVEL, {
      roomId: currentRoom.id,
      playerId: selectedPlayerId,
      newLevel: adjustValue
    });
    setLevelAdjustModal(false);
  };

  // 重新开始
  const handleRestartGame = () => {
    socket.emit(SOCKET_EVENTS.RESTART_GAME, {
      roomId: currentRoom.id
    });
  };

  // 快速调整分数（快捷按钮）
  const handleQuickAdjustScore = (amount) => {
    socket.emit(SOCKET_EVENTS.UPDATE_SCORE, {
      roomId: currentRoom.id,
      amount
    });
  };

  // 快速调整等级（快捷按钮）
  const handleQuickAdjustLevel = (amount) => {
    socket.emit(SOCKET_EVENTS.UPDATE_LEVEL, {
      roomId: currentRoom.id,
      amount
    });
  };

  // 更新房间配置
  const handleUpdateRoomConfig = () => {
    if (newDealInterval < 10 || newDealInterval > 5000) {
      messageApi.warning('发牌间隔必须在10-5000毫秒之间');
      return;
    }
    socket.emit(SOCKET_EVENTS.UPDATE_CONFIG, {
      roomId: currentRoom.id,
      config: {
        dealInterval: newDealInterval
      }
    });
    if (newBotType !== currentRoom.config?.botType) {
      socket.emit(SOCKET_EVENTS.SET_BOT_TYPE, {
        roomId: currentRoom.id,
        botType: newBotType
      });
    }
    setRoomConfigModal(false);
  };

  // 修改玩家昵称
  const handleUpdatePlayerName = () => {
    const trimmedName = newPlayerName.trim();
    if (!trimmedName) {
      messageApi.warning('昵称不能为空');
      return;
    }
    if (trimmedName.length > 20) {
      messageApi.warning('昵称长度不能超过20个字符');
      return;
    }
    socket.emit(SOCKET_EVENTS.UPDATE_PLAYER_NAME, {
      roomId: currentRoom.id,
      newName: trimmedName
    });
    setRenameModal(false);
    setNewPlayerName('');
  };

  // 打开修改昵称对话框
  const handleOpenRenameModal = () => {
    setNewPlayerName(currentPlayer?.name || '');
    setRenameModal(true);
  };

  const handleConfirmLeaveRoom = () => {
    modalApi.confirm({
      title: '退出房间？',
      content: '退出后会立即释放当前座位，且无法通过刷新恢复。若牌局正在进行，本局也会同时终止。',
      okText: '确认退出',
      cancelText: '继续游戏',
      okButtonProps: { danger: true },
      centered: true,
      onOk: () => onLeaveRoom?.()
    });
  };

  const handleRequestSurrender = () => {
    if (!canRequestSurrender || hasRequestedSurrender) return;
    modalApi.confirm({
      title: '发起投降？',
      content: '申请会等本墩完整结束，再询问你的队友；只有队友同意后投降才会生效。',
      okText: '确认发起',
      cancelText: '继续游戏',
      okButtonProps: { danger: true },
      centered: true,
      onOk: () => socket.emit(SOCKET_EVENTS.REQUEST_SURRENDER, {
        roomId: currentRoom.id
      })
    });
  };

  const handleRespondSurrender = accept => {
    if (!surrenderDecision) return;
    socket.emit(SOCKET_EVENTS.RESPOND_SURRENDER, {
      roomId: currentRoom.id,
      accept
    });
  };

  // 处理规则选择
  const handleRuleSelected = (ruleOrRuleIds) => {
    // 发送规则选择事件到服务器
    socket.emit(SOCKET_EVENTS.SELECT_RULE, {
      roomId: currentRoom.id,
      rule: Array.isArray(ruleOrRuleIds)
        ? { ids: ruleOrRuleIds }
        : { id: ruleOrRuleIds.id }
    });
  };

  const handleRefreshDoubleHappinessOption = optionIndex => {
    socket.emit(SOCKET_EVENTS.REFRESH_DOUBLE_HAPPINESS_OPTION, {
      roomId: currentRoom.id,
      optionIndex
    });
  };

  const handleManageWoodenOx = action => {
    if (action === 'load_and_pass' && !woodenOxSelectedCardId) {
      messageApi.warning('请先选择一张要放入木牛流马的手牌');
      return;
    }
    socket.emit('manage_wooden_ox', {
      roomId: currentRoom.id,
      action,
      cardId: action === 'load_and_pass' ? woodenOxSelectedCardId : null
    });
  };

  const handleDrawingCardClick = (cardId) => {
    if (cardExchangeAnimation) return;
    if (!cardExchange) {
      toggleCardSelection(cardId);
      return;
    }
    if (hasSubmittedCardExchange) return;
    const isSelected = selectedCards.includes(cardId);
    if (!isSelected && selectedCards.length >= cardExchange.requiredCards) {
      messageApi.warning(`只能选择 ${cardExchange.requiredCards} 张牌`);
      return;
    }
    toggleCardSelection(cardId);
  };

  const handleSubmitCardExchange = () => {
    if (!cardExchange || selectedCards.length !== cardExchange.requiredCards) {
      messageApi.warning(
        `请选择 ${cardExchange?.requiredCards || 2} 张牌进行${cardExchange?.operation === 'discard' ? '弃置' : '交换'}`
      );
      return;
    }
    socket.emit(SOCKET_EVENTS.SUBMIT_CARD_EXCHANGE, {
      roomId: currentRoom.id,
      cardIds: [...selectedCards]
    });
  };

  const handleCancelExplicitTransformation = (cardId) => {
    setExplicitCardTransformations(previous => {
      const next = { ...previous };
      delete next[cardId];
      return next;
    });
    if (selectedCards.includes(cardId)) toggleCardSelection(cardId);
    setCardTransformationDialog(null);
  };

  const handleCommitJokerTransformation = (rank) => {
    const cardId = cardTransformationDialog?.cardId;
    const suit = cardTransformationDialog?.selectedSuit;
    const sourceCard = activePlayCards.find(card => card.id === cardId);
    if (!sourceCard || sourceCard.suit !== 'joker' || !suit || !rank) return;
    setExplicitCardTransformations(previous => ({
      ...previous,
      [cardId]: {
        kind: 'joker',
        cardId,
        suit,
        rank,
        fromSuit: sourceCard.suit,
        fromRank: sourceCard.rank
      }
    }));
    if (selectedCards.includes(cardId)) toggleCardSelection(cardId);
    setCardTransformationDialog(null);
    messageApi.success(`已将王牌临时转换为 ${EFFECTIVE_SUIT_LABELS[suit]?.replace(/\s/g, '') || suit}${rank}`);
  };

  const handleCommitClusterTransformation = (toRank) => {
    const cardId = cardTransformationDialog?.cardId;
    const sourceCard = activePlayCards.find(card => card.id === cardId);
    if (!sourceCard || !toRank) return;
    setExplicitCardTransformations(previous => ({
      ...previous,
      [cardId]: {
        kind: 'cluster',
        cardId,
        suit: sourceCard.suit,
        fromRank: sourceCard.rank,
        toRank
      }
    }));
    if (selectedCards.includes(cardId)) toggleCardSelection(cardId);
    setCardTransformationDialog(null);
    messageApi.success(`聚类分析：${sourceCard.rank} 已临时视为 ${toRank}，可继续转换其他牌`);
  };

  const handleCommitForbiddenMagicTransformation = (suit, rank = null) => {
    const cardId = cardTransformationDialog?.cardId;
    const sourceCard = activePlayCards.find(card => card.id === cardId);
    const targetRank = sourceCard?.suit === 'joker' ? rank : sourceCard?.rank;
    if (
      !sourceCard
      || !isTrumpCard(sourceCard, trumpSuit, trumpRank)
      || !suit
      || !targetRank
    ) return;
    if (
      sourceCard.suit === 'joker'
      && trumpSuit
      && trumpSuit !== 'no_trump'
      && suit === trumpSuit
    ) {
      messageApi.warning('王不能转化为当前主牌花色');
      return;
    }
    setExplicitCardTransformations(previous => ({
      ...previous,
      [cardId]: {
        kind: 'forbidden_magic',
        cardId,
        suit,
        rank: targetRank,
        fromSuit: sourceCard.suit,
        fromRank: sourceCard.rank
      }
    }));
    if (selectedCards.includes(cardId)) toggleCardSelection(cardId);
    setCardTransformationDialog(null);
    messageApi.success(`禁术秘法：已临时视为 ${EFFECTIVE_SUIT_LABELS[suit]?.replace(/\s/g, '') || suit}${targetRank}`);
  };

  const handleRequestCardTransformation = (cardId) => {
    if ((!isActiveSkillArmed && !isForbiddenMagicActiveByMe) || !isExplicitTransformationSkill) return;
    if (explicitCardTransformations[cardId]) return;
    const sourceCard = activePlayCards.find(card => card.id === cardId);
    if (!sourceCard) return;

    if (activeSkill.effect === 'demote_trumps_and_transform') {
      if (!isTrumpCard(sourceCard, trumpSuit, trumpRank)) return;
      setCardTransformationDialog({
        kind: 'forbidden_magic',
        cardId,
        isJoker: sourceCard.suit === 'joker',
        sourceRank: sourceCard.rank,
        selectedSuit: null
      });
      return;
    }

    if (activeSkill.effect === 'joker_wildcards') {
      if (sourceCard.suit !== 'joker') return;
      setCardTransformationDialog({ kind: 'joker', cardId, selectedSuit: null });
      return;
    }

    const targetRanks = getClusterAnalysisTargetRanks(sourceCard, trumpRank);
    if (targetRanks.length > 0) {
      setCardTransformationDialog({ kind: 'cluster', cardId, targetRanks });
    }
  };

  const handlePlayingCardClick = (cardId) => {
    if (!icebergSelection) {
      if (isActiveSkillArmed && activeSkill?.effect === 'transform_matching_card') {
        if (!selectedDivineWeaponCard) {
          messageApi.warning('请先选择牌桌中央的一张神兵牌');
          return;
        }
        if (cardId === divineWeaponSourceCardId) {
          setDivineWeaponSourceCardId(null);
          if (selectedCards.includes(cardId)) toggleCardSelection(cardId);
          return;
        }
        if (!divineWeaponSourceCardId) {
          const sourceCard = activePlayCards.find(card => card.id === cardId);
          if (
            !sourceCard
            || (sourceCard.suit !== selectedDivineWeaponCard.suit
              && sourceCard.rank !== selectedDivineWeaponCard.rank)
          ) {
            messageApi.warning('请选择与神兵牌花色或点数相同的手牌');
            return;
          }
          setDivineWeaponSourceCardId(cardId);
          if (!selectedCards.includes(cardId)) toggleCardSelection(cardId);
          return;
        }
      }
      toggleCardSelection(cardId);
      return;
    }
    if (icebergSelection.isSubmitted) return;
    if (icebergSelection.currentlyRevealedCardIds.includes(cardId)) {
      messageApi.info('这张牌已经明置');
      return;
    }
    const isSelected = selectedCards.includes(cardId);
    if (!isSelected && selectedCards.length >= icebergSelection.requiredCount) {
      messageApi.warning(`只能再选择 ${icebergSelection.requiredCount} 张明牌`);
      return;
    }
    toggleCardSelection(cardId);
  };

  const handleDivineWeaponCardClick = (cardId) => {
    if (!isActiveSkillArmed || activeSkill?.effect !== 'transform_matching_card') return;
    const nextCardId = selectedDivineWeaponCardId === cardId ? null : cardId;
    setSelectedDivineWeaponCardId(nextCardId);
    setDivineWeaponSourceCardId(null);
    clearSelection();
    if (nextCardId) {
      messageApi.info('神兵已选定：请再选择一张同花色或同点数手牌');
    }
  };

  const handleSubmitIcebergReveals = () => {
    if (!icebergSelection || icebergSelection.isSubmitted) return;
    if (selectedCards.length !== icebergSelection.requiredCount) {
      messageApi.warning(`请选择 ${icebergSelection.requiredCount} 张牌明置`);
      return;
    }
    socket.emit(SOCKET_EVENTS.SUBMIT_ICEBERG_REVEALS, {
      roomId: currentRoom.id,
      cardIds: [...selectedCards]
    });
  };

  const handleSelectWaitingRabbitTarget = () => {
    if (!selectedWaitingRabbitSuit || !selectedWaitingRabbitRank) {
      messageApi.warning('请选择目标牌的花色和点数');
      return;
    }
    socket.emit(SOCKET_EVENTS.SELECT_WAITING_RABBIT_TARGET, {
      roomId: currentRoom.id,
      suit: selectedWaitingRabbitSuit,
      rank: selectedWaitingRabbitRank
    });
  };

  const handleRespondWaitingRabbit = (accept) => {
    if (accept && !waitingRabbitDiscardCardId) {
      messageApi.warning('请选择一张非分牌交换');
      return;
    }
    socket.emit(SOCKET_EVENTS.RESPOND_WAITING_RABBIT, {
      roomId: currentRoom.id,
      accept,
      discardCardId: accept ? waitingRabbitDiscardCardId : null
    });
  };

  const handleSelectTenSidedAmbushRank = () => {
    if (!selectedTenSidedAmbushRank) {
      messageApi.warning('请选择一个伏击点数');
      return;
    }
    socket.emit(SOCKET_EVENTS.SELECT_TEN_SIDED_AMBUSH_RANK, {
      roomId: currentRoom.id,
      rank: selectedTenSidedAmbushRank
    });
  };

  const handleSelectThreePowersRank = () => {
    if (!threePowersSelection || !selectedThreePowersRank) {
      messageApi.warning('请选择一个重载点数');
      return;
    }
    socket.emit(SOCKET_EVENTS.SELECT_THREE_POWERS_RANK, {
      roomId: currentRoom.id,
      sourceRank: threePowersSelection.sourceRank,
      rank: selectedThreePowersRank
    });
  };

  const handleSelectGentlemanPromiseSuit = () => {
    if (!gentlemanPromiseSelection || !selectedGentlemanPromiseSuit) {
      messageApi.warning('请选择一个并列最短的有效花色');
      return;
    }
    socket.emit(SOCKET_EVENTS.SELECT_GENTLEMAN_PROMISE_SUIT, {
      roomId: currentRoom.id,
      suit: selectedGentlemanPromiseSuit
    });
  };

  const handleSelectHiddenDragonRank = () => {
    if (!hiddenDragonSelection || !selectedHiddenDragonRank) {
      messageApi.warning('请选择一个并列最多的非级牌点数');
      return;
    }
    socket.emit(SOCKET_EVENTS.SELECT_HIDDEN_DRAGON_RANK, {
      roomId: currentRoom.id,
      rank: selectedHiddenDragonRank
    });
  };

  const handleSelectAntinomyCard = () => {
    if (!antinomySelection || !selectedAntinomySuit || !selectedAntinomyRank) {
      messageApi.warning('请选择花色和点数');
      return;
    }
    socket.emit(SOCKET_EVENTS.SELECT_ANTINOMY_CARD, {
      roomId: currentRoom.id,
      suit: selectedAntinomySuit,
      rank: selectedAntinomyRank
    });
  };

  const handleToggleRiceToMulberryCard = (cardId) => {
    const requiredCount = riceToMulberrySelection?.requiredCount || 0;
    setSelectedRiceToMulberryCardIds(previous => {
      if (previous.includes(cardId)) {
        return previous.filter(id => id !== cardId);
      }
      if (previous.length >= requiredCount) return previous;
      return [...previous, cardId];
    });
  };

  const handleSelectRiceToMulberryCards = () => {
    const requiredCount = riceToMulberrySelection?.requiredCount || 0;
    if (selectedRiceToMulberryCardIds.length !== requiredCount) {
      messageApi.warning(`请选择恰好${requiredCount}张分牌`);
      return;
    }
    socket.emit(SOCKET_EVENTS.SELECT_RICE_TO_MULBERRY_CARDS, {
      roomId: currentRoom.id,
      cardIds: selectedRiceToMulberryCardIds
    });
  };

  const handleRespondDestroyDyke = (accept) => {
    if (!destroyDykeDecision) return;
    socket.emit(SOCKET_EVENTS.RESPOND_DESTROY_DYKE, {
      roomId: currentRoom.id,
      accept: accept === true
    });
  };

  const handleSelectAdministrativeReview = () => {
    if (!administrativeReviewSelection || !selectedAdministrativeReviewValue) {
      messageApi.warning('请选择一项行政审查条件');
      return;
    }
    socket.emit(SOCKET_EVENTS.SELECT_ADMINISTRATIVE_REVIEW, {
      roomId: currentRoom.id,
      type: administrativeReviewSelection.type,
      value: selectedAdministrativeReviewValue
    });
  };

  // 发送聊天消息
  const handleSendChatMessage = (msg) => {
    const messageToSend = msg || chatMessage.trim();
    if (!messageToSend) {
      messageApi.warning('消息不能为空');
      return;
    }
    if (messageToSend.length > 200) {
      messageApi.warning('消息长度不能超过200个字符');
      return;
    }
    socket.emit(SOCKET_EVENTS.SEND_CHAT_MESSAGE, {
      roomId: currentRoom.id,
      message: messageToSend
    });
    setChatMessage('');
  };

  // 添加快捷短语
  const handleAddQuickPhrase = () => {
    const trimmed = newQuickPhrase.trim();
    if (!trimmed) {
      messageApi.warning('快捷短语不能为空');
      return;
    }
    if (trimmed.length > 50) {
      messageApi.warning('快捷短语长度不能超过50个字符');
      return;
    }
    if (quickPhrases.includes(trimmed)) {
      messageApi.warning('该快捷短语已存在');
      return;
    }
    const newPhrases = [...quickPhrases, trimmed];
    setQuickPhrases(newPhrases);
    localStorage.setItem('tractorQuickPhrases', JSON.stringify(newPhrases));
    setNewQuickPhrase('');
    messageApi.success('快捷短语已添加');
  };

  // 删除快捷短语
  const handleDeleteQuickPhrase = (phrase) => {
    const newPhrases = quickPhrases.filter(p => p !== phrase);
    setQuickPhrases(newPhrases);
    localStorage.setItem('tractorQuickPhrases', JSON.stringify(newPhrases));
    messageApi.success('快捷短语已删除');
  };

  // 添加Bot
  const handleAddBot = () => {
    const botCount = currentRoom.players.filter(p => p.isBot).length;
    socket.emit(SOCKET_EVENTS.ADD_BOT, {
      roomId: currentRoom.id,
      botName: `AI Bot ${botCount + 1}`
    });
  };

  // 移除Bot
  const handleRemoveBot = (playerId) => {
    socket.emit(SOCKET_EVENTS.REMOVE_BOT, {
      roomId: currentRoom.id,
      playerId
    });
  };

  const isActiveBuryingPlayer = activeBuryingPlayerId === currentPlayer?.id;
  const canViewBottomCards = canPlayerViewBottomCards({
    gameState,
    currentPlayerId: currentPlayer?.id,
    selectedRule,
    bottomCardsCount: activeBottomCardsCount
  });
  const knownThreePowersSlots = ruleIncludesId(selectedRule, 'three_powers')
    ? (threePowersView?.slots || []).filter(slot => slot.rank)
    : [];
  const isThreePowersBottomScoreHidden = ruleIncludesId(selectedRule, 'three_powers') && (
    knownThreePowersSlots.length !== (threePowersView?.slots || []).length ||
    knownThreePowersSlots.length === 0
  );
  const bottomCardsScore = isThreePowersBottomScoreHidden
    ? null
    : ruleIncludesId(selectedRule, 'three_powers')
      ? myBottomCards.reduce((total, card) => total + knownThreePowersSlots.reduce(
          (cardPoints, slot) => cardPoints + (slot.rank === card.rank ? slot.pointValue : 0),
          0
        ), 0)
      : calculateCardPoints(
          myBottomCards,
          ruleIncludesId(selectedRule, 'meticulous_accounting')
            ? getMeticulousAccountingCardPoints
            : undefined
        );

  // 渲染控制按钮区域 - 简化版,只保留核心功能按钮
  const renderControlButtons = () => {
    const buttonStyle = { width: '100px', fontSize: '13px' };

    switch (phase) {
      case GamePhases.WAITING:
        if (!currentRoom) return null;

        const isWaitingForReady = gameState?.isWaitingForReady || false;

        if (isWaitingForReady) {
          const buttons = [];

          if (!currentPlayer?.isBot) {
            buttons.push(
              <Button
                key="ready"
                type="primary"
                onClick={handlePlayerReady}
                style={buttonStyle}
              >
                {currentPlayer?.isReady ? '取消准备' : '准备'}
              </Button>
            );
          }

          return (
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              {buttons}
            </div>
          );
        }
        return null;

      case GamePhases.DRAWING:
        if (cardExchangeAnimation) {
          return (
            <div className="card-exchange-controls">
              <Button disabled style={{ ...buttonStyle, width: '160px' }}>
                正在交换手牌…
              </Button>
            </div>
          );
        }
        if (cardExchange) {
          const targetId = cardExchange.targetByPlayerId?.[currentPlayer?.id];
          const target = currentRoom.players.find(player => player.id === targetId);
          const submittedCount = cardExchange.submittedPlayerIds?.length || 0;
          return (
            <div className="card-exchange-controls">
              <Text className="card-exchange-target">
                {hasSubmittedCardExchange
                  ? `等待其他玩家 (${submittedCount}/${currentRoom.players.length})`
                  : `交给 ${target?.name || '目标玩家'}`}
              </Text>
              <Button
                key="exchange"
                type="primary"
                onClick={handleSubmitCardExchange}
                disabled={hasSubmittedCardExchange || selectedCards.length !== cardExchange.requiredCards}
                style={{ ...buttonStyle, width: '160px' }}
              >
                {hasSubmittedCardExchange
                  ? '已确认换牌'
                  : `确认换牌(${selectedCards.length}/${cardExchange.requiredCards})`}
              </Button>
            </div>
          );
        }
        return (
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            {canViewBottomCards && (
              <Button key="viewBottom" onClick={handleViewMyBottomCards} style={buttonStyle}>
                查看底牌
              </Button>
            )}
            <Button
              key="selectAll"
              onClick={handleSelectAllCards}
              disabled={myCards.length === 0}
              style={buttonStyle}
            >
              全选
            </Button>
          </div>
        );

      case GamePhases.BURYING:
        const buryingButtons = [];
        const canBury = isBurySelectionValid(
          selectedCards,
          activeBottomCardsCount
        );

        if (cardExchangeAnimation?.kind === 'secondary_bury') {
          buryingButtons.push(
            <Button key="transferring" disabled style={{ ...buttonStyle, width: '170px' }}>
              底牌交接中…
            </Button>
          );
        } else if (isActiveBuryingPlayer) {
          buryingButtons.push(
            <Button
              key="bury"
              type="primary"
              onClick={handleBuryCards}
              disabled={!canBury}
              style={{ ...buttonStyle, width: '150px' }}
            >
              {isSecondaryBurying ? '再埋底' : '埋底'}({selectedCards.length}/{activeBottomCardsCount})
            </Button>
          );
        } else {
          buryingButtons.push(
            <Button key="waiting" disabled style={{ ...buttonStyle, width: '150px' }}>
              {isSecondaryBurying
                ? `等待 ${currentRoom.players.find(player => player.id === activeBuryingPlayerId)?.name || '庄家队友'} 再埋底`
                : gameState?.peopleCommune
                  ? `等待 ${currentRoom.players.find(player => player.id === activeBuryingPlayerId)?.name || '其他玩家'} 埋底`
                  : '等待庄家埋底'}
            </Button>
          );
        }

        return (
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            {buryingButtons}
            {canViewBottomCards && (
              <Button key="viewBottom" onClick={handleViewMyBottomCards} style={buttonStyle}>
                查看底牌
              </Button>
            )}
          </div>
        );

      case GamePhases.PLAYING:
        if (cardExchangeAnimation) {
          return (
            <div className="card-exchange-controls">
              <Button disabled style={{ ...buttonStyle, width: '180px' }}>
                {`${cardExchangeAnimation.ruleName} · ${
                  cardExchangeAnimation.kind === 'whole_hand'
                    ? '整手交换中…'
                    : cardExchangeAnimation.kind === 'discard'
                      ? '暗弃中…'
                      : '交换中…'
                }`}
              </Button>
            </div>
          );
        }
        if (strawBoatDecision) {
          return (
            <div className="card-exchange-controls">
              <Button disabled style={{ ...buttonStyle, width: '210px' }}>
                {isStrawBoatChooser
                  ? '请完成草船借箭选择'
                  : `等待 ${strawBoatDecision.playerName || '首置位玩家'} 草船借箭`}
              </Button>
            </div>
          );
        }
        if (gameState?.equivalentReciprocity) {
          const selectedCount = gameState.equivalentReciprocity.selectedPlayerIds?.length || 0;
          return (
            <div className="card-exchange-controls">
              <Button disabled style={{ ...buttonStyle, width: '190px' }}>
                等价互惠 · 等待拼点 ({selectedCount}/2)
              </Button>
            </div>
          );
        }
        if (cardExchange) {
          const isDiscard = cardExchange.operation === 'discard';
          const targetId = cardExchange.targetByPlayerId?.[currentPlayer?.id];
          const target = currentRoom.players.find(player => player.id === targetId);
          const submittedCount = cardExchange.submittedPlayerIds?.length || 0;
          return (
            <div className="card-exchange-controls">
              <Text className="card-exchange-target">
                {hasSubmittedCardExchange
                  ? `等待其他玩家 (${submittedCount}/${currentRoom.players.length})`
                  : isDiscard
                    ? '本轮结束 · 暗中弃置 1 张牌'
                    : `本轮结束 · 交给 ${target?.name || '目标玩家'}`}
              </Text>
              <Button
                key="round-exchange"
                type="primary"
                onClick={handleSubmitCardExchange}
                disabled={hasSubmittedCardExchange || selectedCards.length !== cardExchange.requiredCards}
                style={{ ...buttonStyle, width: '160px' }}
              >
                {hasSubmittedCardExchange
                  ? (isDiscard ? '已确认弃牌' : '已确认交牌')
                  : `${isDiscard ? '确认弃牌' : '确认交牌'}(${selectedCards.length}/${cardExchange.requiredCards})`}
              </Button>
            </div>
          );
        }
        if (gameState?.focusFigure?.isVotingPending) {
          return (
            <div className="ten-sided-ambush-wait-controls">
              <Button disabled style={{ ...buttonStyle, width: '210px' }}>
                {focusFigureVote ? '请表决本队焦点候选' : '等待两队完成焦点表决'}
              </Button>
              {canViewBottomCards && (
                <Button key="viewBottom" onClick={handleViewMyBottomCards} style={buttonStyle}>
                  查看底牌
                </Button>
              )}
            </div>
          );
        }
        if (tenSidedAmbush?.isSelectionPending) {
          const selectorName = currentRoom.players.find(
            player => player.id === tenSidedAmbush.selectorPlayerId
          )?.name;
          return (
            <div className="ten-sided-ambush-wait-controls">
              <Button disabled style={{ ...buttonStyle, width: '210px' }}>
                {isTenSidedAmbushSelector
                  ? '请暗中选择伏击点数'
                  : `等待 ${selectorName || '庄家队友'} 布置`}
              </Button>
              {canViewBottomCards && (
                <Button key="viewBottom" onClick={handleViewMyBottomCards} style={buttonStyle}>
                  查看底牌
                </Button>
              )}
            </div>
          );
        }
        if (icebergSelection) {
          return (
            <div className="iceberg-selection-controls">
              <Text className="iceberg-selection-hint">
                {icebergSelection.reason === 'initial' ? '选择两张牌明置' : '补选明牌'}
              </Text>
              <Button
                key="icebergReveal"
                type="primary"
                onClick={handleSubmitIcebergReveals}
                disabled={icebergSelection.isSubmitted || selectedCards.length !== icebergSelection.requiredCount}
                style={{ ...buttonStyle, width: '160px' }}
              >
                {icebergSelection.isSubmitted
                  ? '等待其他玩家'
                  : `确认明牌(${selectedCards.length}/${icebergSelection.requiredCount})`}
              </Button>
              {canViewBottomCards && (
                <Button key="viewBottom" onClick={handleViewMyBottomCards} style={buttonStyle}>
                  查看底牌
                </Button>
              )}
            </div>
          );
        }
        if (hasPendingIcebergSelection) {
          const pendingNames = icebergPendingPlayerIds
            .map(playerId => currentRoom.players.find(player => player.id === playerId)?.name)
            .filter(Boolean)
            .join('、');
          return (
            <div className="iceberg-selection-controls">
              <Button disabled style={{ ...buttonStyle, width: '180px' }}>
                等待 {pendingNames || '玩家'} 选择明牌
              </Button>
              {canViewBottomCards && (
                <Button key="viewBottom" onClick={handleViewMyBottomCards} style={buttonStyle}>
                  查看底牌
                </Button>
              )}
            </div>
          );
        }
        if (
          waitingRabbitState?.pendingSelectionPlayerIds?.length > 0
          || waitingRabbitState?.pendingDecision
        ) {
          const pendingDecision = waitingRabbitState.pendingDecision;
          const pendingNames = (waitingRabbitState.pendingSelectionPlayerIds || [])
            .map(playerId => currentRoom.players.find(player => player.id === playerId)?.name)
            .filter(Boolean)
            .join('、');
          return (
            <div className="iceberg-selection-controls">
              <Button disabled style={{ ...buttonStyle, width: '210px' }}>
                {pendingDecision
                  ? `等待 ${pendingDecision.chooserPlayerName} 决定换牌`
                  : `等待 ${pendingNames || '玩家'} 暗选目标牌`}
              </Button>
              {canViewBottomCards && (
                <Button key="viewBottom" onClick={handleViewMyBottomCards} style={buttonStyle}>
                  查看底牌
                </Button>
              )}
            </div>
          );
        }

        // 检查是否轮到当前玩家出牌
        const isMyTurn = isCurrentPlayersTurn(
          gameState,
          currentRoom?.players,
          currentPlayer?.id
        );

        // 检查是否可以撤回
        const lastPlay = playHistory[playHistory.length - 1];
        const hasForbiddenMagicDecisionPending = Boolean(
          forbiddenMagicState?.decisionPlayerId
        );
        const hasLureTigerDecisionPending = Boolean(
          lureTigerState?.currentDecision?.playerId
        );
        const hasPoliticalReviewDecisionPending = Boolean(
          gameState?.politicalReview?.pending
        );
        const hasAntinomySelectionPending = Boolean(
          gameState?.antinomy?.pendingPlayerIds?.length
        );
        const hasRiceToMulberrySelectionPending = Boolean(
          gameState?.riceToMulberry?.pendingPlayerIds?.length
        );
        const hasDestroyDykeDecisionPending = Boolean(
          gameState?.destroyDyke?.pending
        );
        const hasSurrenderDecisionPending = Boolean(
          gameState?.surrender?.currentDecision
          || gameState?.surrender?.queuedPlayerIds?.length
          || surrenderDecision
        );
        const canUndo = Boolean(lastPlay &&
          (lastPlay.controllerPlayerId || lastPlay.playerId) === currentPlayer?.id &&
          !isOpenHandSelf &&
          !hasForbiddenMagicDecisionPending &&
          !hasLureTigerDecisionPending &&
          !hasPoliticalReviewDecisionPending &&
          !hasAntinomySelectionPending &&
          !hasRiceToMulberrySelectionPending &&
          !hasDestroyDykeDecisionPending &&
          !hasSurrenderDecisionPending &&
          !hasTimeReversalDecisionPending);

        // 验证选中的牌是否合法
        const validateSelectedCards = validatePlaySelection({
          selectedCardIds: selectedCards,
          handCards: activePlayCards,
          gameState,
          trumpSuit,
          trumpRank,
          activeSkillId: effectiveActiveSkillId,
          currentPlayerId: isProxyTurn ? openHand?.playerId : currentPlayer?.id,
          jokerSubstitutions,
          clusterAnalysisSubstitutions,
          forbiddenMagicSubstitutions,
          divineWeaponCardId: selectedDivineWeaponCardId,
          divineWeaponSourceCardId
        });

        const isPlayerTargeting = Boolean(
          ['compare_and_exchange', 'swap_two_plays_at_round_end'].includes(activeSkill?.effect)
          && isActiveSkillArmed
        );
        const canPlay = isMyTurn
          && validateSelectedCards.valid
          && !isPlayerTargeting
          && !hasForbiddenMagicDecisionPending
          && !hasLureTigerDecisionPending
          && !hasPoliticalReviewDecisionPending
          && !hasAntinomySelectionPending
          && !hasRiceToMulberrySelectionPending
          && !hasDestroyDykeDecisionPending
          && !hasSurrenderDecisionPending
          && !hasTimeReversalDecisionPending;
        const playActionLabel = isActiveSkillArmed
          && activeSkill?.effect === 'two_legal_plays_choose_at_round_end'
          ? (ambiguousFirstOptionCardIds.length > 0 ? '公开A/B' : '保存方案A')
          : getPlayActionLabel({
              isActiveSkillArmed: Boolean(effectiveActiveSkillId),
              activeSkill
            });
        const isDecisionSkillReady = Boolean(
          ['yield_turn_to_next_player', 'force_leader_replay', 'compare_and_exchange', 'swap_two_plays_at_round_end', 'declare_target_card', 'ignore_odd_led_side_suit', 'two_legal_plays_choose_at_round_end', 'silence_non_leader_for_round'].includes(activeSkill?.effect)
          && activeSkillAvailability.canActivate
        );
        const playButtonTitle = hasSurrenderDecisionPending
                               ? '正在处理本轮投降表决' :
                               hasTimeReversalDecisionPending
                               ? '本轮正在等待时间倒流决定' :
                               hasPoliticalReviewDecisionPending
                               ? '等待队友完成政治审查' :
                               hasAntinomySelectionPending
                               ? '等待二律背反选择同时公开' :
                               hasRiceToMulberrySelectionPending
                               ? '等待两名闲家完成改稻为桑' :
                               hasDestroyDykeDecisionPending
                               ? '等待庄家决定是否发动毁堤淹田' :
                               hasForbiddenMagicDecisionPending
                               ? '请先完成轮首的禁术秘法确认' :
                               hasLureTigerDecisionPending
                               ? '请先完成轮首的调虎离山决定' :
                               !isMyTurn ? '还没轮到你出牌' :
                               !validateSelectedCards.valid ? validateSelectedCards.message : '';

        // 检查是否有上轮出牌记录
        const hasLastRound = Object.keys(lastRoundPlayedCards).length > 0;

        // 右上角操作区：出牌、撤回、庄家查看底牌、查看上轮、聊天、全选
        return (
          <div className="play-controls" style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
            {activeSkillAvailability.visible && activeSkill && (
              <Button
                key="activeSkill"
                className={`active-skill-button ${isActiveSkillArmed || isTimeReversalReservedByMe || isMagicTrickPrepared || isForbiddenMagicReservedByMe || isForbiddenMagicActiveByMe || isLureTigerReservedByMe ? 'is-armed' : ''} ${isDecisionSkillReady ? 'is-ready' : ''} ${activeSkillAvailability.isUsed && !activeSkillAvailability.isFreeActivation && !isForbiddenMagicActiveByMe ? 'is-used' : ''}`}
                onClick={handleToggleActiveSkill}
                disabled={(activeSkillAvailability.isUsed && !activeSkillAvailability.isFreeActivation) || isMagicTrickPrepared || (!activeSkillAvailability.canActivate && !isActiveSkillArmed)}
                style={{ ...buttonStyle, width: '96px' }}
                title={activeSkillAvailability.reason}
                aria-pressed={isActiveSkillArmed || isTimeReversalReservedByMe || isMagicTrickPrepared || isForbiddenMagicReservedByMe || isForbiddenMagicActiveByMe || isLureTigerReservedByMe}
                data-active-skill-id={activeSkill.id}
              >
                {activeSkill.name}
              </Button>
            )}
            <Button
              key="play"
              type="primary"
              onClick={handlePlayCards}
              disabled={!canPlay}
              style={{ ...buttonStyle, width: playActionLabel.length > 4 ? '112px' : '88px' }}
              title={playButtonTitle}
            >
              {playActionLabel}({selectedCards.length})
            </Button>
            <Button
              key="undo"
              onClick={handleUndoPlay}
              disabled={!canUndo}
              style={buttonStyle}
              title={!canUndo ? '无法撤回' : ''}
            >
              撤回
            </Button>
            {!isLostInFogRule && (
              <Button
                key="viewLastRound"
                onClick={handleViewLastRound}
                disabled={!hasLastRound}
                style={{
                  ...buttonStyle,
                  backgroundColor: viewingLastRound ? '#52c41a' : undefined,
                  borderColor: viewingLastRound ? '#52c41a' : undefined,
                  color: viewingLastRound ? '#fff' : undefined
                }}
                title={!hasLastRound ? '第一轮没有上轮记录' : viewingLastRound ? '正在查看上轮（2秒后恢复）' : ''}
              >
                查看上轮
              </Button>
            )}
            {canViewBottomCards && (
              <Button key="viewBottom" onClick={handleViewMyBottomCards} style={buttonStyle}>
                查看底牌
              </Button>
            )}
            <Button key="chat" onClick={() => setChatModal(true)} style={buttonStyle}>
              聊天
            </Button>
            <Button key="selectAll" onClick={handleSelectAllCards} disabled={activePlayCards.length === 0 || isOpenHandSelf} style={buttonStyle}>
              全选
            </Button>
          </div>
        );

      case GamePhases.REVEALING:
        return (
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            {canViewBottomCards && (
              <Button key="viewBottom" onClick={handleViewMyBottomCards} style={buttonStyle}>
                查看底牌
              </Button>
            )}
            <Button
              key="ready"
              type="primary"
              onClick={handleReadyForNext}
              disabled={isReadyForNext}
              style={buttonStyle}
            >
              {isReadyForNext ? '已准备' : '开始下一局'}
            </Button>
          </div>
        );

      case GamePhases.FINISHED:
        return null;

      default:
        return null;
    }
  };

  // 渲染游戏阶段内容
  const renderPhaseContent = () => {
    switch (phase) {
      case GamePhases.WAITING:
        if (!currentRoom) {
          return <div className="phase-content"><Text>等待加入房间...</Text></div>;
        }

        const isWaitingForReady = gameState?.isWaitingForReady || false;
        const isWaitingForRule = gameState?.isRuleSelectionPending || false;

        // 准备或选规则都属于牌桌内流程；下一局选规则时继续保留牌桌。
        if (isWaitingForReady || isWaitingForRule) {
          return (
            <div className="phase-content playing-phase">
              {/* 游戏桌面 */}
              <GameTable
                players={tablePlayers}
                currentPlayer={currentPlayer}
                onLeaveRoom={handleConfirmLeaveRoom}
                onRequestSurrender={isSurrenderFeatureVisible ? handleRequestSurrender : undefined}
                canRequestSurrender={canRequestSurrender}
                hasRequestedSurrender={hasRequestedSurrender}
                playedCards={{}}
                shownCards={{}}
                myCards={[]}
                buryingPlayerId={gameState?.buryingPlayerId}
                dealerCountdown={dealerCountdown}
                selectedCards={[]}
                onCardClick={() => {}}
                onReorder={() => {}}
                currentTurnPlayerId={null}
                trumpSuit={trumpSuit}
                trumpRank={trumpRank}
                publicBottomCards={displayedPublicBottomCards}
                selectedRule={selectedRule}
                ruleRuntimeStatus={ruleRuntimeStatus}
                ownFocusFigurePlayerId={focusFigurePrivate?.focusPlayerId || null}
                onSelectRule={canOpenRuleSelector ? () => setRuleSelectorModal(true) : undefined}
                ruleChooserPlayerId={gameState?.ruleChooserPlayerId}
                isRuleSelectionPending={gameState?.isRuleSelectionPending}
                renderControls={renderControlButtons()}
                isWaitingForReady={isWaitingForReady || isWaitingForRule}
                team1Level={gameState?.team1Level}
                team2Level={gameState?.team2Level}
                dealerPlayerIndex={gameState?.dealerPlayerIndex}
                onRename={handleOpenRenameModal}
              />
            </div>
          );
        }

        // 正常的房间等待界面
        return (
          <div className="phase-content">
            <Title level={3}>等待开始</Title>
            <Text>当前玩家: {currentRoom.playerCount} / {currentRoom.maxPlayers}</Text>
            <br />
            <Text type="secondary">默认底牌: 8 张（特殊规则可能调整） | 发牌间隔: {currentRoom.config?.dealInterval || 500}ms</Text>
            <br />
            <br />

            <Space direction="vertical" size="middle" style={{ width: '100%', alignItems: 'center' }}>
              {/* 房主操作按钮 */}
              {isHost && (
                <Space size="middle">
                  {currentRoom.playerCount === currentRoom.maxPlayers && (
                    <Button type="primary" size="large" onClick={handleStartGame}>
                      开始游戏
                    </Button>
                  )}
                  <Button size="large" onClick={() => setRoomConfigModal(true)}>
                    房间设置
                  </Button>
                  <Button size="large" onClick={handleAddBot} disabled={currentRoom.playerCount >= currentRoom.maxPlayers}>
                    添加Bot
                  </Button>
                </Space>
              )}

              {/* Bot列表 */}
              {isHost && currentRoom.players.some(p => p.isBot) && (
                <div style={{ width: '80%', maxWidth: '600px' }}>
                  <Divider>房间内的Bot</Divider>
                  <Space wrap>
                    {currentRoom.players.filter(p => p.isBot).map(bot => (
                      <Tag
                        key={bot.id}
                        closable
                        onClose={() => handleRemoveBot(bot.id)}
                        color="blue"
                      >
                        🤖 {bot.name}
                      </Tag>
                    ))}
                  </Space>
                </div>
              )}

              {/* 所有玩家可用按钮 */}
              <Button onClick={handleOpenRenameModal}>
                修改昵称
              </Button>
            </Space>
          </div>
        );

      case GamePhases.DRAWING:
        return (
          <div className="phase-content playing-phase">
            {/* 游戏桌面 - 摸牌阶段显示展示的牌 */}
            <GameTable
              trumpDeclarationComponent={
                <TrumpDeclaration
                  availableDeclarations={
                    cardExchange || cardExchangeAnimation || gameState?.isTrumpDeclarationLocked
                      ? []
                      : availableDeclarations
                  }
                  onDeclare={handleDeclare}
                  currentTrump={currentTrumpDeclaration}
                  isThreeSixNine={isThreeSixNineRule}
                />
              }
              currentTrumpDeclaration={currentTrumpDeclaration}
              currentInferiorDeclaration={currentInferiorDeclaration}
              players={tablePlayers}
              currentPlayer={currentPlayer}
              onLeaveRoom={handleConfirmLeaveRoom}
              onRequestSurrender={isSurrenderFeatureVisible ? handleRequestSurrender : undefined}
              canRequestSurrender={canRequestSurrender}
              hasRequestedSurrender={hasRequestedSurrender}
              playedCards={{}}
              shownCards={shownCards}
              myCards={myCards}
              selectedCards={selectedCards}
              onCardClick={handleDrawingCardClick}
              onReorder={hasSubmittedCardExchange || cardExchangeAnimation ? undefined : reorderCards}
              currentTurnPlayerId={null}
              trumpSuit={trumpSuit}
              trumpRank={trumpRank}
              publicBottomCards={displayedPublicBottomCards}
              selectedRule={selectedRule}
              ruleRuntimeStatus={ruleRuntimeStatus}
              ownFocusFigurePlayerId={focusFigurePrivate?.focusPlayerId || null}
              onSelectRule={canOpenRuleSelector ? () => setRuleSelectorModal(true) : undefined}
              ruleChooserPlayerId={gameState?.ruleChooserPlayerId}
              isRuleSelectionPending={gameState?.isRuleSelectionPending}
              renderControls={renderControlButtons()}
              isWaitingForReady={false}
              buryingPlayerId={gameState?.buryingPlayerId}
              dealerCountdown={dealerCountdown}
              attackerScore={attackerScore}
              collectedPointCards={collectedPointCards}
              team1Level={gameState?.team1Level}
              team2Level={gameState?.team2Level}
              dealerPlayerIndex={gameState?.dealerPlayerIndex}
              onRename={handleOpenRenameModal}
              cardExchange={cardExchange}
              mainstay={gameState?.mainstay}
              cardExchangeAnimation={cardExchangeAnimation}
              privateCardTransferReveal={privateCardTransferReveal}
              highlightedCardIds={handArrivalHighlight?.cardIds || []}
              highlightedCardLabel={handArrivalHighlight?.kind === 'exchange' ? '收' : ''}
              highlightedCardTone={handArrivalHighlight?.kind === 'bottom' ? 'bottom' : 'arrival'}
              ruleVisibleHands={ruleVisibleHands}
            />
          </div>
        );

      case GamePhases.BURYING:
        return (
          <div className="phase-content playing-phase">
            {/* 游戏桌面 - 埋底阶段 */}
            <GameTable
              players={tablePlayers}
              currentPlayer={currentPlayer}
              onLeaveRoom={handleConfirmLeaveRoom}
              onRequestSurrender={isSurrenderFeatureVisible ? handleRequestSurrender : undefined}
              canRequestSurrender={canRequestSurrender}
              hasRequestedSurrender={hasRequestedSurrender}
              playedCards={{}}
              shownCards={{}}
              myCards={myCards}
              selectedCards={selectedCards}
              onCardClick={toggleCardSelection}
              onReorder={cardExchangeAnimation ? undefined : reorderCards}
              disableMyHand={
                !isActiveBuryingPlayer
                || Boolean(cardExchangeAnimation)
                || Boolean(bottomPickup && !bottomPickup.merged)
              }
              openHand={openHand}
              currentTurnPlayerId={null}
              trumpSuit={trumpSuit}
              trumpRank={trumpRank}
              publicBottomCards={displayedPublicBottomCards}
              selectedRule={selectedRule}
              ruleRuntimeStatus={ruleRuntimeStatus}
              ownFocusFigurePlayerId={focusFigurePrivate?.focusPlayerId || null}
              onSelectRule={canOpenRuleSelector ? () => setRuleSelectorModal(true) : undefined}
              ruleChooserPlayerId={gameState?.ruleChooserPlayerId}
              isRuleSelectionPending={gameState?.isRuleSelectionPending}
              renderControls={renderControlButtons()}
              isWaitingForReady={false}
              currentTrumpDeclaration={currentTrumpDeclaration}
              currentInferiorDeclaration={currentInferiorDeclaration}
              buryingPlayerId={gameState?.buryingPlayerId}
              secondaryBuryingPlayerId={gameState?.secondaryBuryingPlayerId}
              dealerCountdown={dealerCountdown}
              attackerScore={attackerScore}
              collectedPointCards={collectedPointCards}
              team1Level={gameState?.team1Level}
              team2Level={gameState?.team2Level}
              dealerPlayerIndex={gameState?.dealerPlayerIndex}
              onRename={handleOpenRenameModal}
              cardExchangeAnimation={cardExchangeAnimation}
              privateCardTransferReveal={privateCardTransferReveal}
              highlightedCardIds={handArrivalHighlight?.cardIds || []}
              highlightedCardLabel={handArrivalHighlight?.kind === 'exchange' ? '收' : ''}
              highlightedCardTone={handArrivalHighlight?.kind === 'bottom' ? 'bottom' : 'arrival'}
              ruleVisibleHands={ruleVisibleHands}
            />
          </div>
        );

      case GamePhases.PLAYING:
        // 获取当前轮到出牌的玩家ID
        const currentTurnPlayerId = gameState?.currentPlayerIndex !== null && gameState?.currentPlayerIndex !== undefined
          ? currentRoom.players[gameState.currentPlayerIndex]?.id
          : null;

        // 根据是否查看上轮来决定显示哪些出牌
        const displayedPlayedCards = !isLostInFogRule && viewingLastRound
          ? lastRoundPlayedCards
          : playedCards;

        return (
          <div className="phase-content playing-phase">
            {/* 游戏桌面 - 出牌阶段不显示展示的牌 */}
            <GameTable
              players={tablePlayers}
              currentPlayer={currentPlayer}
              onLeaveRoom={handleConfirmLeaveRoom}
              onRequestSurrender={isSurrenderFeatureVisible ? handleRequestSurrender : undefined}
              canRequestSurrender={canRequestSurrender}
              hasRequestedSurrender={hasRequestedSurrender}
              playedCards={displayedPlayedCards}
              throwFailedPreviews={viewingLastRound ? {} : throwFailedPreviews}
              shownCards={{}}
              myCards={transformedPreviewCards}
              woodenOxCard={woodenOxDisplayCard}
              selectedCards={selectedCards}
              disabledCardIds={ruleDisabledCardIds}
              disabledCardReason={ruleDisabledCardReason}
              virtualizedCardIds={virtualizedCardIds}
              transformableCardIds={transformableCardIds}
              onCardClick={cardExchangeAnimation || isProxyTurn || isOpenHandSelf
                ? undefined
                : (cardExchange ? handleDrawingCardClick : handlePlayingCardClick)}
              onRequestCardTransformation={handleRequestCardTransformation}
              onCancelCardTransformation={handleCancelExplicitTransformation}
              onReorder={cardExchangeAnimation || hasSubmittedCardExchange || icebergSelection || isProxyTurn || isOpenHandSelf || hasTimeReversalDecisionPending || explicitTransformationList.length > 0
                ? undefined
                : reorderCards}
              disableMyHand={cardExchangeAnimation
                ? true
                : strawBoatDecision
                  ? true
                : forbiddenMagicState?.decisionPlayerId
                  ? true
                : gameState?.dreamKilling?.sleepingPlayerIds?.includes(currentPlayer?.id)
                  ? true
                : hasTimeReversalDecisionPending
                  ? true
                : gameState?.equivalentReciprocity || (
                    ['compare_and_exchange', 'swap_two_plays_at_round_end'].includes(activeSkill?.effect)
                    && isActiveSkillArmed
                  )
                  ? true
                : gameState?.antinomy?.pendingPlayerIds?.length
                  ? true
                : cardExchange
                  ? hasSubmittedCardExchange
                  : gameState?.focusFigure?.isVotingPending
                    ? true
                  : tenSidedAmbush?.isSelectionPending
                    ? true
                    : icebergSelection
                      ? false
                      : hasPendingIcebergSelection
                        ? true
                        : !isCurrentPlayersTurn(gameState, currentRoom?.players, currentPlayer?.id) || isProxyTurn || isOpenHandSelf}
              openHand={openHand}
              ruleVisibleHands={ruleVisibleHands}
              playerTargeting={{
                active: ['compare_and_exchange', 'swap_two_plays_at_round_end'].includes(activeSkill?.effect)
                  && isActiveSkillArmed,
                targetPlayerId: equivalentReciprocityTarget?.id || null,
                selectedPlayerIds: magicTrickTargetIds,
                allowSelf: false,
                requireCards: activeSkill?.effect !== 'swap_two_plays_at_round_end',
                label: activeSkill?.effect === 'swap_two_plays_at_round_end'
                  ? '选择交换结算出牌的玩家'
                  : '选择进行拼点的玩家'
              }}
              onPlayerTargetClick={handleEquivalentReciprocityTarget}
              openHandSelectedCards={selectedCards}
              onOpenHandCardClick={isProxyTurn && !hasTimeReversalDecisionPending ? toggleCardSelection : undefined}
              canControlOpenHand={isProxyTurn && !hasTimeReversalDecisionPending}
              currentTurnPlayerId={currentTurnPlayerId}
              currentWinningPlayerId={viewingLastRound
                ? lastRoundWinnerPlayerId
                : (currentWinningPlayerId ?? currentRoom.players[gameState?.currentWinnerIndex]?.id)}
              trumpAnimation={viewingLastRound ? null : trumpAnimation}
              trumpSuit={trumpSuit}
              trumpRank={trumpRank}
              publicBottomCards={displayedPublicBottomCards}
              selectedRule={selectedRule}
              ruleRuntimeStatus={ruleRuntimeStatus}
              displayRoundNumber={heldCompletedRoundNumberRef.current
                ?? heldCompletedRoundNumber
                ?? gameState?.currentRound}
              ownFocusFigurePlayerId={focusFigurePrivate?.focusPlayerId || null}
              tenSidedAmbush={tenSidedAmbushView}
              threePowers={threePowersView}
              divineWeapon={divineWeapon}
              selectedDivineWeaponCardId={selectedDivineWeaponCardId}
              onDivineWeaponCardClick={handleDivineWeaponCardClick}
              canSelectDivineWeapon={Boolean(
                isActiveSkillArmed
                && activeSkill?.effect === 'transform_matching_card'
                && !divineWeapon?.usedThisRound
              )}
              onSelectRule={canOpenRuleSelector ? () => setRuleSelectorModal(true) : undefined}
              ruleChooserPlayerId={gameState?.ruleChooserPlayerId}
              isRuleSelectionPending={gameState?.isRuleSelectionPending}
              renderControls={renderControlButtons()}
              isWaitingForReady={false}
              currentTrumpDeclaration={currentTrumpDeclaration}
              currentInferiorDeclaration={currentInferiorDeclaration}
              buryingPlayerId={gameState?.buryingPlayerId}
              dealerCountdown={dealerCountdown}
              attackerScore={attackerScore}
              collectedPointCards={collectedPointCards}
              team1Level={gameState?.team1Level}
              team2Level={gameState?.team2Level}
              dealerPlayerIndex={gameState?.dealerPlayerIndex}
              onRename={handleOpenRenameModal}
              cardExchange={cardExchange}
              cardExchangeAnimation={cardExchangeAnimation}
              privateCardTransferReveal={privateCardTransferReveal}
              highlightedCardIds={handArrivalHighlight?.cardIds || []}
              highlightedCardLabel={handArrivalHighlight?.kind === 'exchange' ? '收' : ''}
              highlightedCardTone={handArrivalHighlight?.kind === 'bottom' ? 'bottom' : 'arrival'}
            />
          </div>
        );

      case GamePhases.REVEALING:
        // 揭示底牌阶段不需要高亮边框，传递 null
        return (
          <div className="phase-content playing-phase">
            {/* 游戏桌面 - 展示底牌，保留所有人的出牌 */}
            <GameTable
              players={tablePlayers}
              currentPlayer={currentPlayer}
              onLeaveRoom={handleConfirmLeaveRoom}
              onRequestSurrender={isSurrenderFeatureVisible ? handleRequestSurrender : undefined}
              canRequestSurrender={canRequestSurrender}
              hasRequestedSurrender={hasRequestedSurrender}
              playedCards={playedCards}
              shownCards={{}}
              myCards={myCards}
              selectedCards={selectedCards}
              onCardClick={toggleCardSelection}
              onReorder={reorderCards}
              disableMyHand
              openHand={openHand}
              currentTurnPlayerId={null}
              trumpSuit={trumpSuit}
              trumpRank={trumpRank}
              publicBottomCards={displayedPublicBottomCards}
              revealedBottomCards={revealedBottomCards}
              selectedRule={selectedRule}
              ruleRuntimeStatus={ruleRuntimeStatus}
              ownFocusFigurePlayerId={focusFigurePrivate?.focusPlayerId || null}
              tenSidedAmbush={tenSidedAmbushView}
              threePowers={threePowersView}
              onSelectRule={canOpenRuleSelector ? () => setRuleSelectorModal(true) : undefined}
              ruleChooserPlayerId={gameState?.ruleChooserPlayerId}
              isRuleSelectionPending={gameState?.isRuleSelectionPending}
              renderControls={renderControlButtons()}
              isWaitingForReady={false}
              currentTrumpDeclaration={currentTrumpDeclaration}
              currentInferiorDeclaration={currentInferiorDeclaration}
              buryingPlayerId={gameState?.buryingPlayerId}
              dealerCountdown={dealerCountdown}
              attackerScore={attackerScore}
              collectedPointCards={collectedPointCards}
              bottomScoreResult={bottomScoreResult}
              upgradeResult={upgradeResult}
              team1Level={gameState?.team1Level}
              team2Level={gameState?.team2Level}
              dealerPlayerIndex={gameState?.dealerPlayerIndex}
            />
          </div>
        );

      case GamePhases.FINISHED:
        // 游戏结束阶段不需要高亮边框，传递 null
        return (
          <div className="phase-content playing-phase">
            {/* 游戏桌面 - 游戏结束，保留所有人的出牌和底牌 */}
            <GameTable
              players={tablePlayers}
              currentPlayer={currentPlayer}
              onLeaveRoom={handleConfirmLeaveRoom}
              onRequestSurrender={isSurrenderFeatureVisible ? handleRequestSurrender : undefined}
              canRequestSurrender={canRequestSurrender}
              hasRequestedSurrender={hasRequestedSurrender}
              playedCards={playedCards}
              shownCards={{}}
              myCards={myCards}
              selectedCards={selectedCards}
              onCardClick={toggleCardSelection}
              onReorder={reorderCards}
              disableMyHand
              openHand={openHand}
              currentTurnPlayerId={null}
              trumpSuit={trumpSuit}
              trumpRank={trumpRank}
              publicBottomCards={displayedPublicBottomCards}
              revealedBottomCards={revealedBottomCards}
              selectedRule={selectedRule}
              ruleRuntimeStatus={ruleRuntimeStatus}
              ownFocusFigurePlayerId={focusFigurePrivate?.focusPlayerId || null}
              tenSidedAmbush={tenSidedAmbushView}
              threePowers={threePowersView}
              onSelectRule={canOpenRuleSelector ? () => setRuleSelectorModal(true) : undefined}
              ruleChooserPlayerId={gameState?.ruleChooserPlayerId}
              isRuleSelectionPending={gameState?.isRuleSelectionPending}
              renderControls={renderControlButtons()}
              isWaitingForReady={false}
              currentTrumpDeclaration={currentTrumpDeclaration}
              currentInferiorDeclaration={currentInferiorDeclaration}
              buryingPlayerId={gameState?.buryingPlayerId}
              dealerCountdown={dealerCountdown}
              attackerScore={attackerScore}
              collectedPointCards={collectedPointCards}
              bottomScoreResult={bottomScoreResult}
              upgradeResult={upgradeResult}
              team1Level={gameState?.team1Level}
              team2Level={gameState?.team2Level}
              dealerPlayerIndex={gameState?.dealerPlayerIndex}
              onRename={handleOpenRenameModal}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className="game-board"
      data-inferior-suit={displayedInferiorSuit || undefined}
      data-iron-evidence-mode={gameState?.ironEvidence?.roundMode || undefined}
    >
      {contextHolder}
      {modalContextHolder}

      <Modal
        title="烛尽天明 · 初始烛态"
        open={mustChooseInitialCandleState}
        className="candle-initial-choice-modal"
        closable={false}
        maskClosable={false}
        keyboard={false}
        width={440}
        footer={(
          <div className="candle-initial-choice-actions">
            <Button
              size="large"
              onClick={() => socket.emit('select_initial_candle_state', {
                roomId: currentRoom.id,
                isLit: false
              })}
            >
              熄灭烛
            </Button>
            <Button
              type="primary"
              size="large"
              onClick={() => socket.emit('select_initial_candle_state', {
                roomId: currentRoom.id,
                isLit: true
              })}
            >
              点燃烛
            </Button>
          </div>
        )}
      >
        <div className="candle-initial-choice-copy">
          <span className="candle-choice-icon" aria-hidden="true">🕯️</span>
          <p>你是庄家队友，请选择第1轮的烛态。</p>
          <p>
            点燃：红色分牌每张 +5，黑色分牌每张 −5；
            熄灭则相反。小王是黑色，大王是红色。
          </p>
        </div>
      </Modal>

      {equivalentReciprocityResult && (
        <div className="equivalent-reciprocity-result" role="status" aria-live="assertive">
          <div className="equivalent-reciprocity-result-title">等价互惠 · 拼点</div>
          <div className="equivalent-reciprocity-card-row">
            {(equivalentReciprocityResult.cards || []).map(entry => (
              <div
                className={`equivalent-reciprocity-card-side ${entry.playerId === equivalentReciprocityResult.winnerPlayerId ? 'is-winner' : ''}`}
                key={entry.playerId}
              >
                <span>{entry.playerName}</span>
                <Card
                  card={entry.card}
                  small
                  disabled
                  trumpSuit={trumpSuit}
                  trumpRank={trumpRank}
                />
              </div>
            ))}
          </div>
          <strong>
            {equivalentReciprocityResult.isTie
              ? '平局 · 不失分 · 交换拼点牌'
              : `${equivalentReciprocityResult.winnerPlayerName} 胜 · ${equivalentReciprocityResult.loserPlayerName}一方失去5分`}
          </strong>
        </div>
      )}

      {tenSidedAmbushRevealAnimation && (
        <div className="ten-sided-ambush-reveal-overlay" aria-live="assertive">
          <div className="ten-sided-ambush-reveal" key={tenSidedAmbushRevealAnimation.key}>
            <span className="ten-sided-ambush-reveal-title">十面埋伏</span>
            <strong>{tenSidedAmbushRevealAnimation.rank}</strong>
            <span className="ten-sided-ambush-reveal-subtitle">
              {tenSidedAmbushRevealAnimation.source === 'bottom'
                ? '伏兵现于底牌'
                : '伏击点数首次现身'}
            </span>
          </div>
        </div>
      )}

      {threePowersRevealAnimation && (
        <div className="ten-sided-ambush-reveal-overlay" aria-live="assertive">
          <div
            className="ten-sided-ambush-reveal three-powers-reveal"
            key={threePowersRevealAnimation.key}
          >
            <span className="ten-sided-ambush-reveal-title">三权分立</span>
            <strong>
              {threePowersRevealAnimation.slots
                .map(slot => `${slot.sourceRank}→${slot.rank}`)
                .join('　')}
            </strong>
            <span className="ten-sided-ambush-reveal-subtitle">
              {threePowersRevealAnimation.source === 'bottom'
                ? '重载分牌现于底牌'
                : '重载点数首次现身'}
            </span>
          </div>
        </div>
      )}

      {activeSkillAnimation && (
        <div
          className={`active-skill-activation-overlay is-${activeSkillAnimation.variant || 'default'}`}
          aria-live="assertive"
        >
          <div
            className={`active-skill-activation is-${activeSkillAnimation.variant || 'default'}`}
            key={activeSkillAnimation.key}
          >
            <span>
              {activeSkillAnimation.playerName} {activeSkillAnimation.actionLabel || '发动主动技能'}
            </span>
            <strong>{activeSkillAnimation.name}</strong>
            <small>
              {activeSkillAnimation.detail
                || (activeSkillAnimation.treatedAsSmall
                ? '本次垫牌始终视为小'
                : activeSkillAnimation.concealed
                  ? '本轮结束时同时公开'
                  : '技能已发动')}
            </small>
          </div>
        </div>
      )}

      {/* 主游戏区域 */}
      <div className="main-game-area">
        {renderPhaseContent()}
      </div>

      <Modal
        title={`木牛流马 · 第${woodenOxDecision?.round || gameState?.currentRound || 1}轮轮首`}
        open={Boolean(woodenOxDecision)}
        closable={false}
        maskClosable={false}
        keyboard={false}
        footer={null}
        width={720}
        destroyOnClose
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Text>
            本窗口关闭后才能打出本轮第一张牌。放入或替换新牌时，
            木牛流马会立即交给队友。
          </Text>
          <Text type="secondary">
            已传递 {woodenOxDecision?.transfersUsed || 0} / {woodenOxDecision?.maxTransfers || 4} 次
            （每2次为一个完整往返）
          </Text>
          {woodenOxDecision?.mustTransfer && (
            <Text type="danger" strong>
              队友已无牌可出，本轮必须交出木牛流马，不能继续保留。
            </Text>
          )}
          {woodenOxDecision?.storedCard && (
            <div>
              <Text strong>当前盒中牌</Text>
              <div style={{ marginTop: 8 }}>
                <Card
                  card={woodenOxDecision.storedCard}
                  disabled
                  trumpSuit={trumpSuit}
                  trumpRank={trumpRank}
                />
              </div>
            </div>
          )}
          <Divider style={{ margin: '4px 0' }}>选择要放入的新牌</Divider>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 250, overflowY: 'auto' }}>
            {myCards.map(card => (
              <Card
                key={card.id}
                card={card}
                selected={woodenOxSelectedCardId === card.id}
                onClick={() => setWoodenOxSelectedCardId(previous => (
                  previous === card.id ? null : card.id
                ))}
                trumpSuit={trumpSuit}
                trumpRank={trumpRank}
              />
            ))}
          </div>
          <Space wrap>
            <Button type="primary" onClick={() => handleManageWoodenOx('load_and_pass')}>
              {woodenOxDecision?.hasStoredCard ? '替换并交给队友' : '放入并交给队友'}
            </Button>
            {woodenOxDecision?.hasStoredCard && (
              <Button onClick={() => handleManageWoodenOx('pass')}>
                原牌不变，直接交给队友
              </Button>
            )}
            <Button
              disabled={Boolean(woodenOxDecision?.mustTransfer)}
              onClick={() => handleManageWoodenOx('skip')}
            >
              本轮不操作
            </Button>
          </Space>
        </Space>
      </Modal>

      <Modal
        title={cardTransformationDialog?.kind === 'joker'
          ? '偷梁换柱 · 选择目标牌面'
          : cardTransformationDialog?.kind === 'forbidden_magic'
            ? '禁术秘法 · 选择目标牌面'
          : '聚类分析 · 选择目标点数'}
        open={Boolean(cardTransformationDialog)}
        wrapClassName="player-decision-modal-wrap card-transformation-modal-wrap"
        width={cardTransformationDialog?.kind === 'joker' || (
          cardTransformationDialog?.kind === 'forbidden_magic'
          && cardTransformationDialog?.isJoker
        ) ? 520 : 420}
        footer={null}
        destroyOnClose
        onCancel={() => setCardTransformationDialog(null)}
      >
        {cardTransformationDialog?.kind === 'joker' && (
          <div className="card-transformation-dialog">
            {!cardTransformationDialog.selectedSuit ? <>
              <p className="player-decision-primary-text">第一步：选择这张王要变成的花色</p>
              <div className="card-transformation-option-grid suit-options">
                {TRANSFORMATION_SUITS.map(option => (
                  <Button
                    key={option.value}
                    className={`transformation-suit-option suit-${option.value}`}
                    onClick={() => setCardTransformationDialog(previous => ({
                      ...previous,
                      selectedSuit: option.value
                    }))}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              <Divider />
              <Button
                block
                onClick={() => {
                  const cardId = cardTransformationDialog.cardId;
                  setCardTransformationDialog(null);
                  if (!selectedCards.includes(cardId)) toggleCardSelection(cardId);
                }}
              >
                保持王牌并选中
              </Button>
            </> : <>
              <div className="card-transformation-step-heading">
                <Button
                  size="small"
                  onClick={() => setCardTransformationDialog(previous => ({
                    ...previous,
                    selectedSuit: null
                  }))}
                >
                  返回选花色
                </Button>
                <span>
                  第二步：选择 {TRANSFORMATION_SUITS.find(
                    option => option.value === cardTransformationDialog.selectedSuit
                  )?.label} 的点数
                </span>
              </div>
              <div className="card-transformation-option-grid rank-options">
                {TRANSFORMATION_RANKS.map(rank => (
                  <Button
                    key={rank}
                    className="transformation-rank-option"
                    onClick={() => handleCommitJokerTransformation(rank)}
                  >
                    {rank}
                  </Button>
                ))}
              </div>
            </>}
          </div>
        )}
        {cardTransformationDialog?.kind === 'cluster' && (
          <div className="card-transformation-dialog">
            <p className="player-decision-primary-text">
              请选择这张牌要临时视为的相邻点数。分牌和级牌已自动排除。
            </p>
            <div className="card-transformation-option-grid cluster-rank-options">
              {(cardTransformationDialog.targetRanks || []).map(rank => (
                <Button
                  key={rank}
                  className="transformation-rank-option"
                  onClick={() => handleCommitClusterTransformation(rank)}
                >
                  {rank}
                </Button>
              ))}
            </div>
          </div>
        )}
        {cardTransformationDialog?.kind === 'forbidden_magic' && (
          <div className="card-transformation-dialog">
            {!cardTransformationDialog.selectedSuit ? <>
              <p className="player-decision-primary-text">
                {cardTransformationDialog.isJoker
                  ? '第一步：选择王要变成的副牌花色。当前主花色不可选。'
                  : `选择这张 ${cardTransformationDialog.sourceRank} 要视为的花色；点数保持不变。`}
              </p>
              <div className="card-transformation-option-grid suit-options">
                {TRANSFORMATION_SUITS
                  .filter(option => !(
                    cardTransformationDialog.isJoker
                    && trumpSuit
                    && trumpSuit !== 'no_trump'
                    && option.value === trumpSuit
                  ))
                  .map(option => (
                    <Button
                      key={option.value}
                      className={`transformation-suit-option suit-${option.value}`}
                      onClick={() => {
                        if (cardTransformationDialog.isJoker) {
                          setCardTransformationDialog(previous => ({
                            ...previous,
                            selectedSuit: option.value
                          }));
                          return;
                        }
                        handleCommitForbiddenMagicTransformation(option.value);
                      }}
                    >
                      {option.label}
                    </Button>
                  ))}
              </div>
              <p className="player-decision-secondary-text">
                未主动改变花色的普通主牌会按牌面原花色、原点数作为副牌；级牌同样恢复原点数。
              </p>
            </> : <>
              <div className="card-transformation-step-heading">
                <Button
                  size="small"
                  onClick={() => setCardTransformationDialog(previous => ({
                    ...previous,
                    selectedSuit: null
                  }))}
                >
                  返回选花色
                </Button>
                <span>
                  第二步：选择 {TRANSFORMATION_SUITS.find(
                    option => option.value === cardTransformationDialog.selectedSuit
                  )?.label} 的点数
                </span>
              </div>
              <div className="card-transformation-option-grid rank-options">
                {TRANSFORMATION_RANKS.map(rank => (
                  <Button
                    key={rank}
                    className="transformation-rank-option"
                    onClick={() => handleCommitForbiddenMagicTransformation(
                      cardTransformationDialog.selectedSuit,
                      rank
                    )}
                  >
                    {rank}
                  </Button>
                ))}
              </div>
            </>}
          </div>
        )}
      </Modal>

      <Modal
        title={`焦点人物 · 队伍${focusFigureVote?.team || ''}表决`}
        open={Boolean(focusFigureVote)}
        wrapClassName="player-decision-modal-wrap focus-figure-vote-modal-wrap"
        width={430}
        closable={false}
        maskClosable={false}
        keyboard={false}
        okText="同意"
        cancelText="不同意，换另一人"
        onOk={() => {
          socket.emit(SOCKET_EVENTS.VOTE_FOCUS_FIGURE, {
            roomId: currentRoom.id,
            team: focusFigureVote?.team,
            attempt: focusFigureVote?.attempt,
            agree: true
          });
          setFocusFigureVote(null);
        }}
        onCancel={() => {
          socket.emit(SOCKET_EVENTS.VOTE_FOCUS_FIGURE, {
            roomId: currentRoom.id,
            team: focusFigureVote?.team,
            attempt: focusFigureVote?.attempt,
            agree: false
          });
          setFocusFigureVote(null);
        }}
      >
        <p className="player-decision-primary-text">
          是否同意由 <strong>{focusFigureVote?.nomineePlayerName || ''}</strong> 担任本队焦点人物？
        </p>
        <p className="player-decision-secondary-text">
          选择不同意不会结束表决；系统会把候选切换给本队另一名玩家，再由两人重新投票。
          候选与票型只在本队内部可见。
        </p>
      </Modal>

      <Modal
        title="绝处逢生"
        open={Boolean(lastStandDecision)}
        wrapClassName="player-decision-modal-wrap"
        width={420}
        closable={false}
        maskClosable={false}
        keyboard={false}
        okText="发动"
        cancelText="暂不发动"
        onOk={() => {
          socket.emit('respond_last_stand', { roomId: currentRoom.id, accept: true });
          setLastStandDecision(null);
        }}
        onCancel={() => {
          socket.emit('respond_last_stand', { roomId: currentRoom.id, accept: false });
          setLastStandDecision(null);
        }}
      >
        <p className="player-decision-primary-text">
          你目前有 {lastStandDecision?.cardsCount || 0} 张同花色手牌且没有主牌，
          是否令这些牌全部视为主牌？
        </p>
        <p className="player-decision-secondary-text">
          暂不发动不会消耗机会；下次手牌变化后若仍满足条件，会再次询问。
        </p>
      </Modal>

      <Modal
        title="队友加油"
        open={Boolean(teammateCheerDecision)}
        wrapClassName="player-decision-modal-wrap"
        width={460}
        closable={false}
        maskClosable={false}
        keyboard={false}
        okText="给队友加油"
        cancelText="暂不发动"
        onOk={() => {
          socket.emit(SOCKET_EVENTS.RESPOND_TEAMMATE_CHEER, {
            roomId: currentRoom.id,
            accept: true
          });
          setTeammateCheerDecision(null);
        }}
        onCancel={() => {
          socket.emit(SOCKET_EVENTS.RESPOND_TEAMMATE_CHEER, {
            roomId: currentRoom.id,
            accept: false
          });
          setTeammateCheerDecision(null);
        }}
      >
        <p className="player-decision-primary-text">
          你出牌后已经没有主牌。是否为队友{' '}
          <strong>{teammateCheerDecision?.teammatePlayerName || ''}</strong> 加油，
          令其余下牌面永久全部提升一级？
        </p>
        <p className="player-decision-secondary-text">
          副牌不会跨入主牌链；副A升为B，大王升为郡王，实体牌原有分值不变。
          暂不发动不会消耗机会，之后仍满足条件时会再次询问。
        </p>
      </Modal>

      <Modal
        title="政治审查"
        open={Boolean(politicalReviewDecision)}
        wrapClassName="player-decision-modal-wrap"
        width={470}
        closable={false}
        maskClosable={false}
        keyboard={false}
        okText="令队友收回"
        cancelText="放行本次出牌"
        onOk={() => {
          socket.emit(SOCKET_EVENTS.RESPOND_POLITICAL_REVIEW, {
            roomId: currentRoom.id,
            returnPlay: true
          });
        }}
        onCancel={() => {
          socket.emit(SOCKET_EVENTS.RESPOND_POLITICAL_REVIEW, {
            roomId: currentRoom.id,
            returnPlay: false
          });
        }}
      >
        <p className="player-decision-primary-text">
          队友 {politicalReviewDecision?.teammatePlayerName || ''} 打出了：
        </p>
        <Space size={[6, 6]} wrap>
          {(politicalReviewDecision?.cards || []).map(card => (
            <Tag key={card.id} color="gold">{formatPublicCard(card)}</Tag>
          ))}
        </Space>
        <p className="player-decision-secondary-text">
          选择收回才会消耗你本局唯一一次政治审查。收回仅表示你不赞成这手牌，
          不会禁用其中任何牌；队友仍可立刻把完全相同的牌再出一次。选择放行不消耗次数，
          以后队友出牌时仍会继续询问。
        </p>
      </Modal>

      <Modal
        title="回光返照"
        open={Boolean(afterglowDecision)}
        wrapClassName="player-decision-modal-wrap"
        width={470}
        closable={false}
        maskClosable={false}
        keyboard={false}
        okText="发动回光返照"
        cancelText="暂不发动"
        onOk={() => {
          socket.emit(SOCKET_EVENTS.RESPOND_AFTERGLOW, {
            roomId: currentRoom.id,
            accept: true
          });
          setAfterglowDecision(null);
        }}
        onCancel={() => {
          socket.emit(SOCKET_EVENTS.RESPOND_AFTERGLOW, {
            roomId: currentRoom.id,
            accept: false
          });
          setAfterglowDecision(null);
        }}
      >
        <p className="player-decision-primary-text">
          {afterglowDecision?.triggerTiming === 'before_first_play'
            ? `你是开局一号位，手中有 ${afterglowDecision?.trumpCount || 0} 张主牌，是否在首次出牌前直接发动回光返照？`
            : `你出牌后还剩 ${afterglowDecision?.trumpCount || 0} 张主牌，是否发动回光返照？`}
        </p>
        <p className="player-decision-secondary-text">
          回光返照仅在非无主局生效。确认后剩余主牌会立即沿完整主牌序列提升一级。
          从下一次出牌起，只要手中仍有主牌
          便无视通常的跟牌要求，但整次出牌只能由主牌组成，不能混入任何副牌；实体牌原有分值不变。
          主牌出尽后效果结束，
          暂不发动不会消耗机会。
        </p>
      </Modal>

      <Modal
        title={`模棱两可 · 第${ambiguousChoice?.round || gameState?.currentRound || 1}轮`}
        open={Boolean(ambiguousChoice)}
        wrapClassName="player-decision-modal-wrap ambiguous-choice-modal-wrap"
        width={700}
        closable={false}
        maskClosable={false}
        keyboard={false}
        footer={null}
      >
        <p className="player-decision-primary-text">
          四家已经出完。请选择本轮最终采用的出牌方案；确认后不能更改。
        </p>
        <p className="player-decision-secondary-text">
          {ambiguousChoice?.usageConsumed
            ? '本次发动会消耗你每局一次的机会。'
            : '你是本轮后续发动者，本次不消耗发动次数。'}
        </p>
        <div className="ambiguous-choice-options">
          {(ambiguousChoice?.options || []).map(option => (
            <button
              type="button"
              className="ambiguous-choice-option"
              key={option.index}
              onClick={() => {
                socket.emit(SOCKET_EVENTS.RESPOND_AMBIGUOUS_CHOICE, {
                  roomId: currentRoom.id,
                  optionIndex: option.index
                });
                setAmbiguousChoice(null);
              }}
            >
              <strong>采用方案{option.index === 0 ? 'A' : 'B'}</strong>
              <span className="ambiguous-choice-cards">
                {(option.cards || []).map(card => (
                  <Card
                    key={card.id}
                    card={card}
                    small
                    disabled
                    trumpSuit={trumpSuit}
                    trumpRank={trumpRank}
                  />
                ))}
              </span>
            </button>
          ))}
        </div>
      </Modal>

      <Modal
        title="布什戈门"
        open={bushGateDecisionOpen}
        wrapClassName="player-decision-modal-wrap"
        width={440}
        closable={false}
        maskClosable={false}
        keyboard={false}
        okText="令一号位收回重出"
        cancelText="暂不发动"
        onOk={() => {
          socket.emit(SOCKET_EVENTS.ACTIVATE_BUSH_GATE, {
            roomId: currentRoom.id
          });
          setBushGateDecisionOpen(false);
        }}
        onCancel={() => setBushGateDecisionOpen(false)}
      >
        <p className="player-decision-primary-text">
          是否令本轮一号位收回刚才的全部首发牌，并重新合法首发？
        </p>
        <p className="player-decision-secondary-text">
          被收回的每一张牌都不能用于紧接着的重新首发；一号位成功改出其他牌后，限制立即解除。
          选择暂不发动不会消耗每局一次的机会。
        </p>
      </Modal>

      <Modal
        title={activeSkill?.name || '调整牌序'}
        open={lateMoverDecisionOpen}
        wrapClassName="player-decision-modal-wrap"
        width={400}
        closable={false}
        maskClosable={false}
        keyboard={false}
        okText="是，让下家先出"
        cancelText="否，保持当前牌序"
        onOk={() => {
          const eventName = activeSkill?.id === 'recommend_talent'
            ? SOCKET_EVENTS.ACTIVATE_RECOMMEND_TALENT
            : SOCKET_EVENTS.ACTIVATE_LATE_MOVER_ADVANTAGE;
          socket.emit(eventName, {
            roomId: currentRoom.id
          });
          setLateMoverDecisionOpen(false);
        }}
        onCancel={() => setLateMoverDecisionOpen(false)}
      >
        <p className="player-decision-primary-text">
          是否令下家先出牌，并把自己改为本轮最后出牌？
        </p>
        <p className="player-decision-secondary-text">
          选择“否”不会消耗本局唯一一次发动机会；本技能只改变牌序，不改变牌的大小。
        </p>
      </Modal>

      <Modal
        title="请君入瓮"
        open={Boolean(inviteIntoUrnSelection)}
        wrapClassName="player-decision-modal-wrap card-transformation-modal-wrap"
        width={620}
        closable={false}
        maskClosable={false}
        keyboard={false}
        footer={(
          <Space wrap>
            <Button onClick={() => setInviteIntoUrnSelection(null)}>暂不发动</Button>
            <Button
              type="primary"
              disabled={!inviteIntoUrnSelection?.targetPlayerId || !inviteIntoUrnSelection?.suit || !inviteIntoUrnSelection?.rank}
              onClick={handleConfirmInviteIntoUrn}
            >
              确认发动
            </Button>
          </Space>
        )}
      >
        <div className="card-transformation-dialog">
          <div className="card-transformation-step-heading">
            <Tag color="gold">指定玩家</Tag>
            <span>本轮命中指定实体牌面即失去5分</span>
          </div>
          <Select
            style={{ width: '100%' }}
            placeholder="选择一名玩家"
            value={inviteIntoUrnSelection?.targetPlayerId || undefined}
            options={(currentRoom?.players || [])
              .filter(player => player.id !== currentPlayer?.id)
              .map(player => ({
              value: player.id,
              label: player.name
            }))}
            onChange={targetPlayerId => setInviteIntoUrnSelection(previous => ({
              ...previous,
              targetPlayerId
            }))}
          />
          <div className="card-transformation-step-heading">
            <Tag color="gold">指定牌面</Tag>
            <span>先选花色，再选点数</span>
          </div>
          <div className="card-transformation-option-grid suit-options">
            {INVITE_INTO_URN_SUITS.map(option => (
              <Button
                key={option.value}
                type={inviteIntoUrnSelection?.suit === option.value ? 'primary' : 'default'}
                className={`transformation-suit-option suit-${option.value}`}
                onClick={() => setInviteIntoUrnSelection(previous => ({
                  ...previous,
                  suit: option.value,
                  rank: null
                }))}
              >
                {option.label}
              </Button>
            ))}
          </div>
          {inviteIntoUrnSelection?.suit && (
            <div className="card-transformation-option-grid rank-options">
              {(inviteIntoUrnSelection.suit === 'joker'
                ? INVITE_INTO_URN_JOKER_RANKS
                : TRANSFORMATION_RANKS.map(rank => ({ value: rank, label: rank })))
                .map(option => (
                  <Button
                    key={option.value}
                    type={inviteIntoUrnSelection?.rank === option.value ? 'primary' : 'default'}
                    onClick={() => setInviteIntoUrnSelection(previous => ({
                      ...previous,
                      rank: option.value
                    }))}
                  >
                    {option.label}
                  </Button>
                ))}
            </div>
          )}
          <p className="player-decision-secondary-text">
            同一手打出多张指定牌也只扣5分；指定庄家方玩家时，等价为闲家加5分。
          </p>
        </div>
      </Modal>

      <Modal
        title="文化革命"
        open={Boolean(culturalRevolutionSelection)}
        wrapClassName="player-decision-modal-wrap card-transformation-modal-wrap"
        width={620}
        closable={false}
        maskClosable={false}
        keyboard={false}
        footer={culturalRevolutionSelection?.declarationType ? (
          <Space wrap>
            <Button onClick={() => setCulturalRevolutionSelection(null)}>暂不发动</Button>
            <Button onClick={() => setCulturalRevolutionSelection({ declarationType: null, value: null })}>
              返回二选一
            </Button>
            <Button
              type="primary"
              disabled={!culturalRevolutionSelection?.value}
              onClick={handleConfirmCulturalRevolution}
            >
              确认发动
            </Button>
          </Space>
        ) : (
          <Button onClick={() => setCulturalRevolutionSelection(null)}>暂不发动</Button>
        )}
      >
        {!culturalRevolutionSelection?.declarationType ? (
          <div className="card-transformation-dialog">
            <p className="player-decision-primary-text">
              先选择本次革命的性质。两种效果二选一，不会同时改变主花色和级牌点数。
            </p>
            <div className="cultural-revolution-type-grid">
              <Button
                onClick={() => setCulturalRevolutionSelection({ declarationType: 'suit', value: null })}
              >
                革花色
                <small>替换原主花色</small>
              </Button>
              <Button
                onClick={() => setCulturalRevolutionSelection({ declarationType: 'rank', value: null })}
              >
                革点数
                <small>替换原级牌点数</small>
              </Button>
            </div>
          </div>
        ) : (
          <div className="card-transformation-dialog">
            <div className="card-transformation-step-heading">
              <Tag color="gold">
                {culturalRevolutionSelection.declarationType === 'suit' ? '革花色' : '革点数'}
              </Tag>
              <span>
                {culturalRevolutionSelection.declarationType === 'suit'
                  ? '选择新的主花色'
                  : '选择新的级牌点数（10、K均可）'}
              </span>
            </div>
            <div className={`card-transformation-option-grid ${culturalRevolutionSelection.declarationType === 'suit' ? 'suit-options' : 'rank-options'}`}>
              {(culturalRevolutionSelection.declarationType === 'suit'
                ? TRANSFORMATION_SUITS
                : TRANSFORMATION_RANKS.map(rank => ({ value: rank, label: rank })))
                .map(option => (
                  <Button
                    key={option.value}
                    type={culturalRevolutionSelection.value === option.value ? 'primary' : 'default'}
                    className={culturalRevolutionSelection.declarationType === 'suit'
                      ? `transformation-suit-option suit-${option.value}`
                      : undefined}
                    onClick={() => setCulturalRevolutionSelection(previous => ({
                      ...previous,
                      value: option.value
                    }))}
                  >
                    {option.label}
                  </Button>
                ))}
            </div>
            <p className="player-decision-secondary-text">
              发动当轮和下一轮生效；原主对应项暂时变回副牌。若期间另一名玩家发动，新声明会覆盖旧声明并重新计两轮。
            </p>
          </div>
        )}
      </Modal>

      <Modal
        title={
          ownMainstayAction?.stage === 'decision'
            ? '中流砥柱 · 是否发动'
            : ownMainstayAction?.stage === 'return'
              ? '中流砥柱 · 队友返牌'
              : '中流砥柱 · 交牌'
        }
        open={Boolean(ownMainstayAction)}
        wrapClassName="equivalent-reciprocity-selection-modal player-decision-modal-wrap"
        width={820}
        closable={false}
        maskClosable={false}
        keyboard={false}
        footer={
          ownMainstayAction?.stage === 'decision' ? (
            <Space>
              <Button onClick={() => handleRespondMainstay(false)}>暂不发动</Button>
              <Button type="primary" onClick={() => handleRespondMainstay(true)}>
                发动中流砥柱
              </Button>
            </Space>
          ) : (
            <Button
              type="primary"
              disabled={mainstaySelectedCardIds.length !== (ownMainstayAction?.requiredCards || 5)}
              onClick={handleSubmitMainstayCards}
            >
              {ownMainstayAction?.stage === 'return' ? '确认返还' : '确认交牌'}
              ({mainstaySelectedCardIds.length}/{ownMainstayAction?.requiredCards || 5})
            </Button>
          )
        }
      >
        {ownMainstayAction?.stage === 'decision' ? (
          <>
            <p className="player-decision-primary-text">
              你当前的主牌不超过5张，可以发动中流砥柱。
            </p>
            <p className="player-decision-secondary-text">
              发动后须将包含当前全部主牌的5张牌交给队友，再由队友选择5张牌返还。
              队友稍后轮到自己时仍会按当时的手牌重新判断，也可以再次发动并把主牌交回来。
            </p>
          </>
        ) : (
          <>
            <p className="player-decision-primary-text">
              {ownMainstayAction?.stage === 'return'
                ? `请选择5张牌返还给 ${currentRoom?.players?.find(player => player.id === ownMainstayAction?.actorPlayerId)?.name || '队友'}。`
                : `请选择5张牌交给 ${currentRoom?.players?.find(player => player.id === ownMainstayAction?.teammatePlayerId)?.name || '队友'}；当前全部主牌已预先选中且不可取消。`}
            </p>
            <div className="equivalent-reciprocity-hand-picker">
              <Hand
                cards={myCards}
                selectedCards={mainstaySelectedCardIds}
                onCardClick={handleToggleMainstayCard}
                small
                trumpSuit={trumpSuit}
                trumpRank={trumpRank}
                minimumVisibleWidth={16}
              />
            </div>
            <p className="player-decision-secondary-text">
              已选择 {mainstaySelectedCardIds.length} 张，本次必须正好选择5张。
            </p>
          </>
        )}
      </Modal>

      <Modal
        title="同舟共济 · 选择方向"
        open={mutualSupportDirectionOpen}
        wrapClassName="player-decision-modal-wrap"
        width={460}
        closable={false}
        maskClosable={false}
        keyboard={false}
        footer={(
          <Space wrap>
            <Button onClick={() => setMutualSupportDirectionOpen(false)}>暂不发动</Button>
            <Button onClick={handleMutualSupportRequest}>向队友要牌</Button>
            <Button
              type="primary"
              disabled={mutualSupportMaxGiveCount < 1}
              onClick={handleMutualSupportGive}
            >
              给队友牌
            </Button>
          </Space>
        )}
      >
        <p className="player-decision-primary-text">
          选择本次同舟共济的方向。向队友要牌时，队友可以交给你0至2张，也可以不给；
          主动给牌时，你必须交给队友1至2张。
        </p>
        <p className="player-decision-secondary-text">
          无论哪个方向，本轮结束时都由当前收牌的一方选择等量手牌返还给原持有者。
          只有实际确认发动才会消耗每局一次的机会。
        </p>
        {mutualSupportMaxGiveCount < 1 && (
          <p className="player-decision-secondary-text">
            你目前必须保留全部手牌完成本轮出牌，因此暂时只能向队友要牌。
          </p>
        )}
      </Modal>

      <Modal
        title={
          mutualSupportSelection?.stage === 'return'
            ? '同舟共济 · 轮末返还'
            : mutualSupportSelection?.stage === 'request'
              ? '同舟共济 · 回应队友'
              : '同舟共济 · 交给队友'
        }
        open={Boolean(mutualSupportSelection)}
        wrapClassName="equivalent-reciprocity-selection-modal player-decision-modal-wrap"
        width={820}
        closable={false}
        maskClosable={false}
        keyboard={false}
        footer={(
          <Space>
            {mutualSupportSelection?.source === 'activation' && (
              <Button onClick={() => {
                setMutualSupportSelection(null);
                setMutualSupportSelectedCardIds([]);
                setMutualSupportDirectionOpen(true);
              }}>
                返回
              </Button>
            )}
            <Button
              type="primary"
              disabled={
                mutualSupportSelectedCardIds.length < (mutualSupportSelection?.minCards || 0)
                || mutualSupportSelectedCardIds.length > (mutualSupportSelection?.maxCards || 0)
              }
              onClick={handleSubmitMutualSupportCards}
            >
              {mutualSupportSelection?.stage === 'request'
                && mutualSupportSelectedCardIds.length === 0
                ? '不给牌'
                : mutualSupportSelection?.stage === 'return'
                  ? `返还${mutualSupportSelectedCardIds.length}张`
                  : `交出${mutualSupportSelectedCardIds.length}张`}
            </Button>
          </Space>
        )}
      >
        <p className="player-decision-primary-text">
          {mutualSupportSelection?.stage === 'return'
            ? `本轮结束，请选择${mutualSupportSelection?.requiredCards || 0}张手牌返还给 ${mutualSupportSelection?.otherPlayerName || '队友'}。`
            : mutualSupportSelection?.stage === 'request'
              ? `${mutualSupportSelection?.otherPlayerName || '队友'} 请求你交牌；你可以选择0至${mutualSupportSelection?.maxCards || 0}张。`
              : `请选择1至${mutualSupportSelection?.maxCards || 2}张手牌交给 ${mutualSupportSelection?.otherPlayerName || '队友'}。`}
        </p>
        <div className="equivalent-reciprocity-hand-picker">
          <Hand
            cards={myCards}
            selectedCards={mutualSupportSelectedCardIds}
            onCardClick={handleToggleMutualSupportCard}
            disabled={(mutualSupportSelection?.maxCards || 0) === 0}
            small
            trumpSuit={trumpSuit}
            trumpRank={trumpRank}
            minimumVisibleWidth={16}
          />
        </div>
        <p className="player-decision-secondary-text">
          已选择 {mutualSupportSelectedCardIds.length} 张；
          {mutualSupportSelection?.minCards === mutualSupportSelection?.maxCards
            ? ` 本次必须正好选择${mutualSupportSelection?.minCards || 0}张。`
            : ` 本次可以选择${mutualSupportSelection?.minCards || 0}至${mutualSupportSelection?.maxCards || 0}张。`}
        </p>
      </Modal>

      <Modal
        title="等价互惠"
        open={Boolean(equivalentReciprocityTarget)}
        wrapClassName="player-decision-modal-wrap"
        width={400}
        closable={false}
        maskClosable={false}
        keyboard={false}
        okText="是，与其拼点"
        cancelText="否，重新选择"
        onOk={() => {
          socket.emit(SOCKET_EVENTS.ACTIVATE_EQUIVALENT_RECIPROCITY, {
            roomId: currentRoom.id,
            targetPlayerId: equivalentReciprocityTarget?.id
          });
          setEquivalentReciprocityTarget(null);
        }}
        onCancel={() => setEquivalentReciprocityTarget(null)}
      >
        <p className="player-decision-primary-text">
          是否与 <strong>{equivalentReciprocityTarget?.name || ''}</strong> 拼点？
        </p>
        <p className="player-decision-secondary-text">
          确认后双方各自秘密选择一张牌；主牌大于副牌，副牌只比较点数。
          输家一方失去5分，点数相同则无人失分，但拼点牌仍会交换。
        </p>
      </Modal>

      <Modal
        title="魔术戏法"
        open={magicTrickTargetIds.length === 2}
        wrapClassName="player-decision-modal-wrap"
        width={430}
        closable={false}
        maskClosable={false}
        keyboard={false}
        okText="确认暗选"
        cancelText="重新选择"
        onOk={() => {
          socket.emit(SOCKET_EVENTS.ACTIVATE_MAGIC_TRICK, {
            roomId: currentRoom.id,
            targetPlayerIds: magicTrickTargetIds
          });
        }}
        onCancel={() => setMagicTrickTargetIds([])}
      >
        <p className="player-decision-primary-text">
          是否暗中交换
          {' '}
          <strong>
            {magicTrickTargetIds
              .map(playerId => currentRoom?.players?.find(player => player.id === playerId)?.name)
              .filter(Boolean)
              .join(' 与 ')}
          </strong>
          {' '}本轮的结算出牌？
        </p>
        <p className="player-decision-secondary-text">
          两人仍按各自真实手牌正常出牌；交换只在四家出完后影响本轮胜负、得分归属和下轮牌权。
        </p>
      </Modal>

      <Modal
        title="等价互惠 · 选择拼点牌"
        open={Boolean(equivalentReciprocitySelection)}
        wrapClassName="equivalent-reciprocity-selection-modal player-decision-modal-wrap"
        width={820}
        closable={false}
        maskClosable={false}
        keyboard={false}
        footer={(
          <Button
            type="primary"
            className="equivalent-reciprocity-confirm-button"
            disabled={
              equivalentReciprocitySelection?.submitted
              || !equivalentReciprocityCardId
            }
            onClick={handleSubmitEquivalentReciprocityCard}
          >
            {equivalentReciprocitySelection?.submitted ? '已暗置，等待对方' : '确认拼点牌'}
          </Button>
        )}
      >
        <p className="player-decision-primary-text">
          请暗选一张牌，与 <strong>{equivalentReciprocitySelection?.opponentPlayerName || ''}</strong> 拼点。
        </p>
        <div className="equivalent-reciprocity-hand-picker">
          <Hand
            cards={myCards}
            selectedCards={equivalentReciprocityCardId ? [equivalentReciprocityCardId] : []}
            onCardClick={equivalentReciprocitySelection?.submitted
              ? undefined
              : cardId => setEquivalentReciprocityCardId(previous => previous === cardId ? null : cardId)}
            disabled={Boolean(equivalentReciprocitySelection?.submitted)}
            small
            trumpSuit={trumpSuit}
            trumpRank={trumpRank}
            minimumVisibleWidth={16}
          />
        </div>
        <p className="player-decision-secondary-text">
          你的选择在双方都提交前不会公开；提交后不能更改。
        </p>
      </Modal>

      <Modal
        title={`草船借箭 · 第${strawBoatDecision?.round || ''}轮`}
        open={Boolean(strawBoatDecision && isStrawBoatChooser && !isHoldingCompletedRound)}
        wrapClassName="equivalent-reciprocity-selection-modal player-decision-modal-wrap"
        width={820}
        closable={false}
        maskClosable={false}
        keyboard={false}
        footer={(
          <Space>
            <Button onClick={() => handleRespondStrawBoatBorrowingArrows(false)}>
              放弃发动
            </Button>
            <Button
              type="primary"
              disabled={!strawBoatDiscardCardId}
              onClick={() => handleRespondStrawBoatBorrowingArrows(true)}
            >
              公开弃牌并取箭
            </Button>
          </Space>
        )}
      >
        <p className="player-decision-primary-text">
          你首置的 {strawBoatDecision?.leadingPoints || 0} 分未被本方获得，可以弃置一张非分数牌，
          换取本轮打出的最大非分数牌：
        </p>
        {strawBoatDecision?.borrowedCard && (
          <div style={{ display: 'flex', justifyContent: 'center', margin: '12px 0 18px' }}>
            <Card
              card={strawBoatDecision.borrowedCard}
              small
              trumpSuit={trumpSuit}
              trumpRank={trumpRank}
            />
          </div>
        )}
        <div className="equivalent-reciprocity-hand-picker">
          <Hand
            cards={strawBoatDiscardOptions}
            selectedCards={strawBoatDiscardCardId ? [strawBoatDiscardCardId] : []}
            onCardClick={cardId => setStrawBoatDiscardCardId(
              previous => previous === cardId ? null : cardId
            )}
            small
            trumpSuit={trumpSuit}
            trumpRank={trumpRank}
            minimumVisibleWidth={20}
          />
        </div>
        <p className="player-decision-secondary-text">
          请选择恰好一张非分数牌。弃掉的牌和获得的牌都会向全场公开；选择放弃则不交换任何牌。
        </p>
      </Modal>

      <Modal
        title="调虎离山"
        open={Boolean(lureTigerDecision)}
        wrapClassName="player-decision-modal-wrap"
        width={480}
        closable={false}
        maskClosable={false}
        keyboard={false}
        footer={null}
      >
        {lureTigerDecision?.stage === 'confirm' && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <p className="player-decision-primary-text">
              是否在第 {lureTigerDecision.round} 轮发动调虎离山？
            </p>
            <p className="player-decision-secondary-text">
              确认后还需选择一名本轮非一号位玩家。选定目标才会抢占本方阵营唯一一次机会；
              暂不发动不会占用次数，同轮其他预备者会继续依次确认。
            </p>
            <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
              <Button onClick={() => {
                socket.emit(SOCKET_EVENTS.RESPOND_LURE_TIGER, {
                  roomId: currentRoom.id,
                  accept: false
                });
                setLureTigerDecision(null);
              }}>
                暂不发动
              </Button>
              <Button type="primary" onClick={() => {
                socket.emit(SOCKET_EVENTS.RESPOND_LURE_TIGER, {
                  roomId: currentRoom.id,
                  accept: true
                });
              }}>
                发动并选择目标
              </Button>
            </Space>
          </Space>
        )}
        {lureTigerDecision?.stage === 'target' && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <p className="player-decision-primary-text">
              请选择本轮要沉默的非一号位玩家
            </p>
            <p className="player-decision-secondary-text">
              目标本轮不参与甩牌询问，且整次出牌不计大小与分数；下一轮自动解除。
            </p>
            <div className="card-transformation-option-grid">
              {(lureTigerDecision.eligibleTargetIds || []).map(targetPlayerId => {
                const target = currentRoom.players.find(player => player.id === targetPlayerId);
                if (!target) return null;
                return (
                  <Button
                    key={target.id}
                    onClick={() => {
                      socket.emit(SOCKET_EVENTS.SELECT_LURE_TIGER_TARGET, {
                        roomId: currentRoom.id,
                        targetPlayerId: target.id
                      });
                      setLureTigerDecision(null);
                    }}
                  >
                    {target.name}{target.id === currentPlayer?.id ? '（自己）' : ''}
                  </Button>
                );
              })}
            </div>
          </Space>
        )}
      </Modal>

      <Modal
        title="禁术秘法"
        open={Boolean(forbiddenMagicDecision)}
        wrapClassName="player-decision-modal-wrap"
        width={420}
        closable={false}
        maskClosable={false}
        keyboard={false}
        okText="确定发动"
        cancelText="暂不发动"
        onOk={() => {
          socket.emit(SOCKET_EVENTS.RESPOND_FORBIDDEN_MAGIC, {
            roomId: currentRoom.id,
            accept: true
          });
          setForbiddenMagicDecision(null);
        }}
        onCancel={() => {
          socket.emit(SOCKET_EVENTS.RESPOND_FORBIDDEN_MAGIC, {
            roomId: currentRoom.id,
            accept: false
          });
          setForbiddenMagicDecision(null);
        }}
      >
        <p className="player-decision-primary-text">
          是否从第 {forbiddenMagicDecision?.round || ''} 轮起发动禁术秘法？
        </p>
        <p className="player-decision-secondary-text">
          确认后技能将立即生效并持续到本局结束，不能撤销；暂不发动不会消耗机会，以后仍可再次预备。
          同轮其他预备者会继续依次确认，不受你的选择影响。
        </p>
      </Modal>

      <Modal
        title="釜底抽薪"
        open={Boolean(removeFirewoodDecision)}
        wrapClassName="player-decision-modal-wrap"
        width={460}
        closable={false}
        maskClosable={false}
        keyboard={false}
        okText="交换全部手牌"
        cancelText="不交换"
        onOk={() => {
          socket.emit(SOCKET_EVENTS.RESPOND_REMOVE_FIREWOOD, {
            roomId: currentRoom.id,
            accept: true
          });
        }}
        onCancel={() => {
          socket.emit(SOCKET_EVENTS.RESPOND_REMOVE_FIREWOOD, {
            roomId: currentRoom.id,
            accept: false
          });
        }}
      >
        <p className="player-decision-primary-text">
          <strong>{removeFirewoodDecision?.counteringPlayerName || ''}</strong> 反了你的主。
          是否与其交换当前的全部手牌？
        </p>
        <p className="player-decision-secondary-text">
          这是一次可选机会，并非必须发动；选择“不交换”不会改动双方手牌。
          若本局发生多次反主，系统会继续按照由后向前的顺序逐项询问。
        </p>
      </Modal>

      <Modal
        title="时间倒流"
        open={Boolean(timeReversalDecision)}
        wrapClassName="player-decision-modal-wrap"
        width={420}
        closable={false}
        maskClosable={false}
        keyboard={false}
        okText="倒流，重打本轮"
        cancelText="保留本轮结果"
        onOk={() => {
          socket.emit(SOCKET_EVENTS.RESPOND_TIME_REVERSAL, {
            roomId: currentRoom.id,
            accept: true
          });
          setTimeReversalDecision(null);
        }}
        onCancel={() => {
          socket.emit(SOCKET_EVENTS.RESPOND_TIME_REVERSAL, {
            roomId: currentRoom.id,
            accept: false
          });
          setTimeReversalDecision(null);
        }}
      >
        <p className="player-decision-primary-text">
          是否回到第 {timeReversalDecision?.round || ''} 轮开始前，收回本轮四家的出牌并重新出牌？
        </p>
        <p className="player-decision-secondary-text">
          选择保留结果不会消耗技能；多名玩家预备时，首个确认倒流的人发动成功。
        </p>
      </Modal>

      {/* 埋底玩家选择弹窗 */}
      <Modal
        title="选择埋底玩家"
        open={buryingPlayerModal}
        onOk={handleSetBuryingPlayer}
        onCancel={() => setBuryingPlayerModal(false)}
      >
        <Select
          style={{ width: '100%' }}
          placeholder="选择玩家"
          onChange={setSelectedBuryingPlayer}
        >
          {currentRoom.players.map(player => (
            <Select.Option key={player.id} value={player.id}>
              {player.name}
            </Select.Option>
          ))}
        </Select>
      </Modal>

      {/* 首发玩家选择弹窗 */}
      <Modal
        title="选择首发玩家"
        open={firstPlayerModal}
        onOk={handleSetFirstPlayer}
        onCancel={() => setFirstPlayerModal(false)}
      >
        <Select
          style={{ width: '100%' }}
          placeholder="选择玩家"
          onChange={setSelectedFirstPlayer}
        >
          {currentRoom.players.map(player => (
            <Select.Option key={player.id} value={player.id}>
              {player.name}
            </Select.Option>
          ))}
        </Select>
      </Modal>

      {/* 调整分数弹窗 */}
      <Modal
        title="调整分数"
        open={scoreAdjustModal}
        onOk={handleUpdateScore}
        onCancel={() => setScoreAdjustModal(false)}
      >
        <Select
          style={{ width: '100%', marginBottom: 16 }}
          placeholder="选择玩家"
          onChange={setSelectedPlayerId}
        >
          {currentRoom.players.map(player => (
            <Select.Option key={player.id} value={player.id}>
              {player.name} (当前: {player.score})
            </Select.Option>
          ))}
        </Select>
        <InputNumber
          style={{ width: '100%' }}
          placeholder="新分数"
          value={adjustValue}
          onChange={setAdjustValue}
        />
      </Modal>

      {/* 调整等级弹窗 */}
      <Modal
        title="调整等级"
        open={levelAdjustModal}
        onOk={handleUpdateLevel}
        onCancel={() => setLevelAdjustModal(false)}
      >
        <Select
          style={{ width: '100%', marginBottom: 16 }}
          placeholder="选择玩家"
          onChange={setSelectedPlayerId}
        >
          {currentRoom.players.map(player => (
            <Select.Option key={player.id} value={player.id}>
              {player.name} (当前: {formatLevel(player.level)})
            </Select.Option>
          ))}
        </Select>
        <InputNumber
          style={{ width: '100%' }}
          placeholder="新等级"
          min={2}
          max={14}
          value={adjustValue}
          onChange={setAdjustValue}
        />
      </Modal>

      {/* 普通规则由庄家查看；人民公社只展示请求者自己埋下的两张牌。 */}
      <Modal
        title={isPeopleCommuneRule
          ? '我埋的底牌'
          : isOpenlyRevealedRule
            ? '公开底牌'
            : '庄家底牌'}
        className="bottom-cards-modal"
        open={viewBottomModal}
        onOk={() => setViewBottomModal(false)}
        onCancel={() => setViewBottomModal(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setViewBottomModal(false)}>
            关闭
          </Button>
        ]}
      >
        <div style={{ textAlign: 'center' }}>
          <div className="bottom-cards-summary">
            <Text>
              {isPeopleCommuneRule
                ? `你埋下的 ${myBottomCards.length} 张牌仅自己可随时查看。`
                : isOpenlyRevealedRule
                  ? `当前 ${myBottomCards.length} 张底牌始终明置，所有玩家均可随时查看。`
                  : isReformAndOpeningUpRule
                    ? `本局最终 ${myBottomCards.length} 张底牌，庄家与庄家队友均可随时查看。`
                  : `本局已埋 ${myBottomCards.length} 张底牌，仅庄家可随时查看。`}
            </Text>
            <span className="bottom-cards-score">
              {bottomCardsScore === null ? (
                <>底牌分数：<strong>?</strong> 分（按重载点数结算）</>
              ) : (
                <>{isPeopleCommuneRule ? '这两张牌分数' : '底牌分数'}：<strong>{bottomCardsScore}</strong> 分</>
              )}
            </span>
          </div>
          {myBottomCards.length > 0 && (
            <Hand cards={myBottomCards} disabled small trumpSuit={trumpSuit} trumpRank={trumpRank} />
          )}
        </div>
      </Modal>

      {/* 房间设置弹窗 */}
      <Modal
        title="房间设置"
        open={roomConfigModal}
        onOk={handleUpdateRoomConfig}
        onCancel={() => setRoomConfigModal(false)}
        okText="保存"
        cancelText="取消"
      >
        <div>
          <Text strong>Bot策略:</Text>
          <br />
          <Select
            style={{ width: '100%', marginTop: 8, marginBottom: 16 }}
            value={newBotType}
            onChange={setNewBotType}
            options={[
              { value: 'who_designed', label: 'WhoDesigned 智能Bot' },
              { value: 'simple', label: '简单Bot（测试用）' }
            ]}
          />
          <br />
          <Text strong>发牌间隔（毫秒）:</Text>
          <br />
          <InputNumber
            style={{ width: '100%', marginTop: 8 }}
            min={10}
            max={5000}
            step={100}
            value={newDealInterval}
            onChange={setNewDealInterval}
          />
          <br />
          <br />
          <Text type="secondary">设置将在下一局游戏开始时生效</Text>
        </div>
      </Modal>

      {/* 修改昵称弹窗 */}
      <Modal
        title="修改昵称"
        open={renameModal}
        onOk={handleUpdatePlayerName}
        onCancel={() => {
          setRenameModal(false);
          setNewPlayerName('');
        }}
        okText="保存"
        cancelText="取消"
      >
        <div>
          <Text strong>新昵称:</Text>
          <br />
          <Input
            style={{ width: '100%', marginTop: 8 }}
            placeholder="请输入新昵称（最多20字符）"
            maxLength={20}
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
            onPressEnter={handleUpdatePlayerName}
          />
        </div>
      </Modal>

      {/* 聊天弹窗 */}
      <Modal
        title="聊天"
        open={chatModal}
        onCancel={() => setChatModal(false)}
        footer={null}
        width={500}
      >
        <div>
          {/* 聊天历史 */}
          <div style={{
            maxHeight: '200px',
            overflowY: 'auto',
            marginBottom: 12,
            border: '1px solid #d9d9d9',
            borderRadius: 4,
            padding: 8
          }}>
            {chatHistory.length === 0 ? (
              <Text type="secondary">暂无聊天记录</Text>
            ) : (
              chatHistory.map((chat, idx) => (
                <div key={idx} style={{ marginBottom: 8 }}>
                  <Text strong>{chat.playerName}: </Text>
                  <Text>{chat.message}</Text>
                </div>
              ))
            )}
          </div>

          <Divider style={{ margin: '12px 0' }}>快捷短语</Divider>

          {/* 快捷短语按钮 */}
          <Space wrap style={{ marginBottom: 12 }}>
            {quickPhrases.map((phrase, idx) => (
              <Button
                key={idx}
                onClick={() => handleSendChatMessage(phrase)}
                size="small"
              >
                {phrase}
              </Button>
            ))}
            <Button
              size="small"
              type="dashed"
              onClick={() => setQuickPhraseModal(true)}
            >
              管理快捷短语
            </Button>
          </Space>

          <Divider style={{ margin: '12px 0' }}>发送消息</Divider>

          {/* 消息输入 */}
          <Input.TextArea
            placeholder="输入消息（最多200字符，支持emoji）"
            maxLength={200}
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSendChatMessage();
              }
            }}
            rows={3}
          />

          {/* Emoji 选择器 */}
          <div style={{ marginTop: 8, marginBottom: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>常用表情：</Text>
            <div style={{ marginTop: 4 }}>
              <Space wrap>
                {['😀', '😃', '😄', '😁', '😊', '😂', '🤣', '😍', '🥰', '😘', '😎', '🤔', '😮', '😢', '😭', '😡', '👍', '👎', '👏', '🙏', '💪', '🎉', '🎊', '❤️', '💯', '🔥', '✨', '⭐', '🌟', '💎'].map((emoji, idx) => (
                  <Button
                    key={idx}
                    size="small"
                    onClick={() => setChatMessage(prev => prev + emoji)}
                    style={{ padding: '0 8px', minWidth: 32 }}
                  >
                    {emoji}
                  </Button>
                ))}
              </Space>
            </div>
          </div>

          <div style={{ marginTop: 8, textAlign: 'right' }}>
            <Button type="primary" onClick={() => handleSendChatMessage()}>
              发送
            </Button>
          </div>
        </div>
      </Modal>

      {/* 快捷短语管理弹窗 */}
      <Modal
        title="管理快捷短语"
        open={quickPhraseModal}
        onCancel={() => {
          setQuickPhraseModal(false);
          setNewQuickPhrase('');
        }}
        footer={null}
      >
        <div>
          {/* 现有快捷短语 */}
          <div style={{ marginBottom: 12 }}>
            <Text strong>现有快捷短语:</Text>
            <div style={{ marginTop: 8 }}>
              {quickPhrases.length === 0 ? (
                <Text type="secondary">暂无快捷短语</Text>
              ) : (
                quickPhrases.map((phrase, idx) => (
                  <Tag
                    key={idx}
                    closable
                    onClose={() => handleDeleteQuickPhrase(phrase)}
                    style={{ marginBottom: 8 }}
                  >
                    {phrase}
                  </Tag>
                ))
              )}
            </div>
          </div>

          <Divider style={{ margin: '12px 0' }}>添加新短语</Divider>

          {/* 添加新快捷短语 */}
          <Input
            placeholder="输入新的快捷短语（最多50字符）"
            maxLength={50}
            value={newQuickPhrase}
            onChange={(e) => setNewQuickPhrase(e.target.value)}
            onPressEnter={handleAddQuickPhrase}
          />
          <div style={{ marginTop: 8, textAlign: 'right' }}>
            <Button type="primary" onClick={handleAddQuickPhrase}>
              添加
            </Button>
          </div>
        </div>
      </Modal>

      {/* 规则选择器弹窗 */}
      <RuleSelector
        visible={ruleSelectorModal}
        rules={gameState?.ruleOptions || []}
        selectionMode={gameState?.ruleSelectionMode || 'single'}
        canChoose={isRuleChooser}
        canRefresh={canRefreshDoubleHappiness}
        onRuleSelected={handleRuleSelected}
        onRefreshRule={handleRefreshDoubleHappinessOption}
        onClose={() => setRuleSelectorModal(false)}
      />

      <Modal
        title="守株待兔 · 暗选目标牌"
        className="ten-sided-ambush-modal"
        open={Boolean(waitingRabbitSelection)}
        closable={false}
        maskClosable={false}
        keyboard={false}
        zIndex={2250}
        footer={null}
      >
        <div className="ten-sided-ambush-selector">
          <Text className="ten-sided-ambush-secret-note">
            目标只对你可见。可以选 5、10、K；王和本局级牌不能选。
          </Text>
          <div className="gentleman-promise-suit-grid" role="group" aria-label="选择目标花色">
            {(waitingRabbitSelection?.eligibleSuits || []).map(suit => (
              <Button
                key={suit}
                className={selectedWaitingRabbitSuit === suit ? 'is-selected' : ''}
                aria-pressed={selectedWaitingRabbitSuit === suit}
                onClick={() => setSelectedWaitingRabbitSuit(suit)}
              >
                {TRANSFORMATION_SUITS.find(option => option.value === suit)?.label || suit}
              </Button>
            ))}
          </div>
          <div className="ten-sided-ambush-rank-grid" role="group" aria-label="选择目标点数">
            {(waitingRabbitSelection?.eligibleRanks || []).map(rank => (
              <Button
                key={rank}
                className={selectedWaitingRabbitRank === rank ? 'is-selected' : ''}
                aria-pressed={selectedWaitingRabbitRank === rank}
                onClick={() => setSelectedWaitingRabbitRank(rank)}
              >
                {rank}
              </Button>
            ))}
          </div>
          <Button
            className="ten-sided-ambush-confirm"
            type="primary"
            size="large"
            disabled={!selectedWaitingRabbitSuit || !selectedWaitingRabbitRank}
            onClick={handleSelectWaitingRabbitTarget}
          >
            {selectedWaitingRabbitSuit && selectedWaitingRabbitRank
              ? `暗定 ${formatPublicCard({ suit: selectedWaitingRabbitSuit, rank: selectedWaitingRabbitRank })}`
              : '请选择花色和点数'}
          </Button>
        </div>
      </Modal>

      <Modal
        title="守株待兔 · 是否交换"
        className="ten-sided-ambush-modal"
        open={Boolean(waitingRabbitDecision)}
        closable={false}
        maskClosable={false}
        keyboard={false}
        zIndex={2300}
        footer={null}
      >
        <div className="ten-sided-ambush-selector">
          <Text>
            {waitingRabbitDecision?.sourcePlayerName} 打出了你的目标牌
            {' '}{formatPublicCard(waitingRabbitDecision?.targetCard)}。选择一张非分牌后可将它换回手中。
          </Text>
          <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0 16px' }}>
            {waitingRabbitDecision?.targetCard && (
              <Card
                card={waitingRabbitDecision.targetCard}
                small
                trumpSuit={trumpSuit}
                trumpRank={trumpRank}
              />
            )}
          </div>
          <Text type="secondary">
            本轮胜负和分数已经结算，交换不会倒改本轮结果；被换走的分牌以后再次打出只比较大小，不再计分。
          </Text>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 16 }}>
            {myCards
              .filter(card => waitingRabbitDecision?.eligibleDiscardCardIds?.includes(card.id))
              .map(card => (
                <Card
                  key={card.id}
                  card={card}
                  small
                  selected={waitingRabbitDiscardCardId === card.id}
                  onClick={() => setWaitingRabbitDiscardCardId(card.id)}
                  trumpSuit={trumpSuit}
                  trumpRank={trumpRank}
                />
              ))}
          </div>
          <Space style={{ width: '100%', justifyContent: 'center', marginTop: 18 }}>
            <Button onClick={() => handleRespondWaitingRabbit(false)}>放弃本次交换</Button>
            <Button
              type="primary"
              disabled={!waitingRabbitDiscardCardId}
              onClick={() => handleRespondWaitingRabbit(true)}
            >
              交换这一张
            </Button>
          </Space>
        </div>
      </Modal>

      <Modal
        title="十面埋伏 · 暗选点数"
        className="ten-sided-ambush-modal"
        open={Boolean(tenSidedAmbushSelection)}
        closable={false}
        maskClosable={false}
        keyboard={false}
        zIndex={2200}
        footer={null}
      >
        <div className="ten-sided-ambush-selector">
          <Text className="ten-sided-ambush-secret-note">
            只有你能看到本次选择；该点数首次出牌后才会向所有玩家揭晓。
          </Text>
          <div className="ten-sided-ambush-rank-grid" role="group" aria-label="选择伏击点数">
            {(tenSidedAmbushSelection?.eligibleRanks || []).map(rank => (
              <Button
                key={rank}
                className={selectedTenSidedAmbushRank === rank ? 'is-selected' : ''}
                aria-pressed={selectedTenSidedAmbushRank === rank}
                onClick={() => setSelectedTenSidedAmbushRank(rank)}
              >
                {rank}
              </Button>
            ))}
          </div>
          <Text type="secondary">
            级牌 {tenSidedAmbushSelection?.trumpRank} 以及分牌 5、10、K 不可选择。
          </Text>
          <Button
            className="ten-sided-ambush-confirm"
            type="primary"
            size="large"
            disabled={!selectedTenSidedAmbushRank}
            onClick={handleSelectTenSidedAmbushRank}
          >
            {selectedTenSidedAmbushRank
              ? `确认伏击 ${selectedTenSidedAmbushRank}`
              : '请选择伏击点数'}
          </Button>
        </div>
      </Modal>

      <Modal
        title={`三权分立 · 重载原${threePowersSelection?.sourceRank || ''}分牌`}
        className="ten-sided-ambush-modal three-powers-modal"
        open={Boolean(threePowersSelection)}
        closable={false}
        maskClosable={false}
        keyboard={false}
        zIndex={2200}
        footer={null}
      >
        <div className="ten-sided-ambush-selector">
          <Text className="ten-sided-ambush-secret-note">
            你选择的点数将成为 {threePowersSelection?.pointValue || 0} 分牌；首次出现前只有你能看到。
          </Text>
          <div className="ten-sided-ambush-rank-grid" role="group" aria-label="选择重载点数">
            {(threePowersSelection?.eligibleRanks || []).map(rank => (
              <Button
                key={rank}
                className={selectedThreePowersRank === rank ? 'is-selected' : ''}
                aria-pressed={selectedThreePowersRank === rank}
                onClick={() => setSelectedThreePowersRank(rank)}
              >
                {rank}
              </Button>
            ))}
          </div>
          <Text type="secondary">
            仅级牌 {threePowersSelection?.trumpRank} 与王牌不可选；5、10、K可以选择，也可以与其他玩家重复。
          </Text>
          <Button
            className="ten-sided-ambush-confirm"
            type="primary"
            size="large"
            disabled={!selectedThreePowersRank}
            onClick={handleSelectThreePowersRank}
          >
            {selectedThreePowersRank
              ? `确认用 ${selectedThreePowersRank} 重载原${threePowersSelection?.sourceRank}分牌`
              : '请选择重载点数'}
          </Button>
        </div>
      </Modal>

      <Modal
        title="君子一言 · 声明最短花色"
        className="ten-sided-ambush-modal gentleman-promise-modal"
        open={Boolean(gentlemanPromiseSelection)}
        closable={false}
        maskClosable={false}
        keyboard={false}
        zIndex={2200}
        footer={null}
      >
        <div className="ten-sided-ambush-selector gentleman-promise-selector">
          <Text className="ten-sided-ambush-secret-note">
            以下有效花色均为最少的 {gentlemanPromiseSelection?.minimumCount ?? 0} 张；请选择其中一个公开声明。
          </Text>
          <div className="gentleman-promise-suit-grid" role="group" aria-label="选择最短有效花色">
            {(gentlemanPromiseSelection?.eligibleSuits || []).map(suit => (
              <Button
                key={suit}
                className={selectedGentlemanPromiseSuit === suit ? 'is-selected' : ''}
                aria-pressed={selectedGentlemanPromiseSuit === suit}
                onClick={() => setSelectedGentlemanPromiseSuit(suit)}
              >
                <span>{EFFECTIVE_SUIT_LABELS[suit] || suit}</span>
                <small>{gentlemanPromiseSelection?.suitCounts?.[suit] ?? 0} 张</small>
              </Button>
            ))}
          </div>
          <Text type="secondary">
            级牌、主花色牌和王统一计入“主”，不再计入牌面原花色。
          </Text>
          <Button
            className="ten-sided-ambush-confirm"
            type="primary"
            size="large"
            disabled={!selectedGentlemanPromiseSuit}
            onClick={handleSelectGentlemanPromiseSuit}
          >
            {selectedGentlemanPromiseSuit
              ? `声明 ${EFFECTIVE_SUIT_LABELS[selectedGentlemanPromiseSuit]}`
              : '请选择最短花色'}
          </Button>
        </div>
      </Modal>

      <Modal
        title="潜龙在渊 · 声明最多点数"
        className="ten-sided-ambush-modal hidden-dragon-modal"
        open={Boolean(hiddenDragonSelection)}
        closable={false}
        maskClosable={false}
        keyboard={false}
        zIndex={2200}
        footer={null}
      >
        <div className="ten-sided-ambush-selector hidden-dragon-selector">
          <Text className="ten-sided-ambush-secret-note">
            以下点数在手牌中均为最多的 {hiddenDragonSelection?.maximumCount ?? 0} 张；请选择其中一个公开声明。
          </Text>
          <div className="ten-sided-ambush-rank-grid" role="group" aria-label="选择最多点数">
            {(hiddenDragonSelection?.eligibleRanks || []).map(rank => (
              <Button
                key={rank}
                className={selectedHiddenDragonRank === rank ? 'is-selected' : ''}
                aria-pressed={selectedHiddenDragonRank === rank}
                onClick={() => setSelectedHiddenDragonRank(rank)}
              >
                <span>{rank}</span>
                <small>{hiddenDragonSelection?.rankCounts?.[rank] ?? 0} 张</small>
              </Button>
            ))}
          </div>
          <Text type="secondary">
            本局级牌 {hiddenDragonSelection?.trumpRank} 与王牌不参与统计；5、10、K若不是级牌，可以正常声明。
          </Text>
          <Button
            className="ten-sided-ambush-confirm"
            type="primary"
            size="large"
            disabled={!selectedHiddenDragonRank}
            onClick={handleSelectHiddenDragonRank}
          >
            {selectedHiddenDragonRank
              ? `声明 ${selectedHiddenDragonRank}`
              : '请选择最多点数'}
          </Button>
        </div>
      </Modal>

      <Modal
        title={antinomySelection?.stage === 'round'
          ? `二律背反 · 第${antinomySelection?.triggerRound || ''}轮后重选`
          : '二律背反 · 开局选择'}
        className="ten-sided-ambush-modal antinomy-modal"
        open={Boolean(antinomySelection)}
        closable={false}
        maskClosable={false}
        keyboard={false}
        zIndex={2200}
        footer={null}
      >
        <div className="ten-sided-ambush-selector antinomy-selector">
          <Text className="ten-sided-ambush-secret-note">
            请选择一个普通花色牌面。你的选择在所有待选玩家提交前不会公开。
          </Text>
          <div className="gentleman-promise-suit-grid" role="group" aria-label="选择二律背反花色">
            {(antinomySelection?.eligibleSuits || []).map(suit => (
              <Button
                key={suit}
                className={selectedAntinomySuit === suit ? 'is-selected' : ''}
                aria-pressed={selectedAntinomySuit === suit}
                onClick={() => setSelectedAntinomySuit(suit)}
              >
                {EFFECTIVE_SUIT_LABELS[suit] || suit}
              </Button>
            ))}
          </div>
          <div className="ten-sided-ambush-rank-grid" role="group" aria-label="选择二律背反点数">
            {(antinomySelection?.eligibleRanks || []).map(rank => (
              <Button
                key={rank}
                className={selectedAntinomyRank === rank ? 'is-selected' : ''}
                aria-pressed={selectedAntinomyRank === rank}
                onClick={() => setSelectedAntinomyRank(rank)}
              >
                {rank}
              </Button>
            ))}
          </div>
          <Text type="secondary">
            王不能指定；级牌仍可按其实体花色和点数指定。同一牌面被多人指定时，拆对效果取消。
          </Text>
          <Button
            className="ten-sided-ambush-confirm"
            type="primary"
            size="large"
            disabled={!selectedAntinomySuit || !selectedAntinomyRank}
            onClick={handleSelectAntinomyCard}
          >
            {selectedAntinomySuit && selectedAntinomyRank
              ? `选择 ${EFFECTIVE_SUIT_LABELS[selectedAntinomySuit]} ${selectedAntinomyRank}`
              : '请选择花色和点数'}
          </Button>
        </div>
      </Modal>

      <Modal
        title="改稻为桑 · 选择分牌"
        className="player-decision-modal rice-to-mulberry-modal"
        open={Boolean(riceToMulberrySelection)}
        closable={false}
        maskClosable={false}
        keyboard={false}
        zIndex={2200}
        footer={null}
      >
        <div className="player-decision-content">
          <p className="player-decision-primary-text">
            请选择恰好<strong>{riceToMulberrySelection?.requiredCount || 0}</strong>张分牌。
            副牌会变为同花色A，主牌会变为大王；改造后的实体牌永久计0分。
          </p>
          <div className="equivalent-reciprocity-hand-picker">
            <Hand
              cards={myCards.filter(card => (
                riceToMulberrySelection?.eligibleCardIds?.includes(card.id)
              ))}
              selectedCards={selectedRiceToMulberryCardIds}
              onCardClick={handleToggleRiceToMulberryCard}
              small
              trumpSuit={trumpSuit}
              trumpRank={trumpRank}
              minimumVisibleWidth={16}
            />
          </div>
          <Text type="secondary">
            已选择 {selectedRiceToMulberryCardIds.length}/{riceToMulberrySelection?.requiredCount || 0}
          </Text>
          <Button
            type="primary"
            size="large"
            block
            disabled={selectedRiceToMulberryCardIds.length !== (riceToMulberrySelection?.requiredCount || 0)}
            onClick={handleSelectRiceToMulberryCards}
          >
            确认改造
          </Button>
        </div>
      </Modal>

      <Modal
        title="投降表决"
        className="player-decision-modal surrender-decision-modal"
        open={Boolean(surrenderDecision)}
        closable={false}
        maskClosable={false}
        keyboard={false}
        zIndex={2350}
        footer={[
          <Button key="reject" onClick={() => handleRespondSurrender(false)}>
            不同意，继续打
          </Button>,
          <Button
            key="accept"
            danger
            type="primary"
            onClick={() => handleRespondSurrender(true)}
          >
            同意投降
          </Button>
        ]}
      >
        <p className="player-decision-primary-text">
          你的队友 <strong>{surrenderDecision?.initiatorPlayerName || ''}</strong> 发起了投降，
          是否同意？
        </p>
        <p className="player-decision-secondary-text">
          {surrenderDecision?.surrenderingSide === 'dealer'
            ? `同意后闲家按当前${surrenderDecision?.attackerScore || 0}分再加80分结算，闲家方直接获胜。`
            : surrenderDecision?.completedRound <= 2
              ? '这是前两墩投降：同意后庄家方直接获胜并升1级。'
              : `同意后庄家方直接获胜，并按闲家当前实得${surrenderDecision?.attackerScore || 0}分结算。`}
        </p>
      </Modal>

      <Modal
        title="毁堤淹田 · 轮末决定"
        className="player-decision-modal destroy-dyke-modal"
        open={Boolean(destroyDykeDecision)}
        closable={false}
        maskClosable={false}
        keyboard={false}
        zIndex={2250}
        footer={[
          <Button key="decline" onClick={() => handleRespondDestroyDyke(false)}>
            本轮不发动
          </Button>,
          <Button
            key="accept"
            type="primary"
            danger
            onClick={() => handleRespondDestroyDyke(true)}
          >
            发动并作废{destroyDykeDecision?.roundPoints || 0}分
          </Button>
        ]}
      >
        <p className="player-decision-primary-text">
          闲家赢得第{destroyDykeDecision?.round || ''}轮，本轮原本获得
          <strong>{destroyDykeDecision?.roundPoints || 0}分</strong>。
        </p>
        <Text type="secondary">
          发动后这些分数暂时作废，接下来三轮进入灾期。灾期内闲家累计达到20分，
          或牌局提前结束，将返还作废分数并额外给予闲家20分。
        </Text>
      </Modal>

      <Modal
        title={administrativeReviewSelection?.type === 'suit'
          ? '行政审查 · 公开指定副花色'
          : '行政审查 · 公开指定点数'}
        className="ten-sided-ambush-modal administrative-review-modal"
        open={Boolean(administrativeReviewSelection)}
        closable={false}
        maskClosable={false}
        keyboard={false}
        zIndex={2200}
        footer={null}
      >
        <div className="ten-sided-ambush-selector administrative-review-selector">
          <Text className="ten-sided-ambush-secret-note">
            本次选择会立即明告全桌。庄家与其队友都能共同推进这项审查条件。
          </Text>
          <div
            className={administrativeReviewSelection?.type === 'suit'
              ? 'gentleman-promise-suit-grid'
              : 'ten-sided-ambush-rank-grid'}
            role="group"
            aria-label="选择行政审查条件"
          >
            {(administrativeReviewSelection?.eligibleOptions || []).map(value => (
              <Button
                key={value}
                className={selectedAdministrativeReviewValue === value ? 'is-selected' : ''}
                aria-pressed={selectedAdministrativeReviewValue === value}
                onClick={() => setSelectedAdministrativeReviewValue(value)}
              >
                {administrativeReviewSelection?.type === 'suit'
                  ? (EFFECTIVE_SUIT_LABELS[value] || value)
                  : value}
              </Button>
            ))}
          </div>
          <Text type="secondary">
            {administrativeReviewSelection?.type === 'suit'
              ? '只能选择当前主花色以外的普通副花色。'
              : '可选择2至A中的任意点数，包括本局级牌；王不属于点数。'}
          </Text>
          <Button
            className="ten-sided-ambush-confirm"
            type="primary"
            size="large"
            disabled={!selectedAdministrativeReviewValue}
            onClick={handleSelectAdministrativeReview}
          >
            {selectedAdministrativeReviewValue
              ? `公开指定 ${administrativeReviewSelection?.type === 'suit'
                ? (EFFECTIVE_SUIT_LABELS[selectedAdministrativeReviewValue] || selectedAdministrativeReviewValue)
                : selectedAdministrativeReviewValue}`
              : '请选择审查条件'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
