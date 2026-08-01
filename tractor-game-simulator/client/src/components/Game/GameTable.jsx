import { Typography, Button } from 'antd';
import Hand from './Hand';
import Card from './Card';
import OpenHandPanel from './OpenHandPanel';
import RecordOnFileTracker from './RecordOnFileTracker';
import SurrenderShowdown from './SurrenderShowdown';
import { sortCards } from '../../utils/cardUtils';
import {
  calculateCardPoints,
  getScoringDisplayCard,
  getOddEvenRoundMultiplier,
  getCandleToDawnCardPoints,
  getDisplayedCandleState,
  getMeticulousAccountingCardPoints,
  getThreePowersCardPoints
} from '../../utils/scoringUtils';
import {
  formatLevel,
  getDestroyDykeDisplayState,
  getDisplayedDefenseAsOffense,
  getRecordOnFileTrackerView,
  getStriveUpstreamActionOrder
} from '../../utils/gameViewUtils';
import { ruleIncludesId } from '../../utils/ruleCatalog';
import { getRuleTableContent } from '../../utils/ruleDisplayContent';
import './GameTable.css';

const { Text } = Typography;

const ORIGINAL_JOKER_LABELS = Object.freeze({
  small_joker: '小王',
  big_joker: '大王',
  county_prince_joker: '郡王',
  prince_joker: '亲王',
  white_joker: '白王'
});

const getJokerSubstitutionSourceLabel = (played, substitution) => {
  const transformedCard = (played?.cards || []).find(card => card.id === substitution.cardId);
  const originalRank = substitution.fromRank || transformedCard?.originalRank;
  return ORIGINAL_JOKER_LABELS[originalRank] || '王';
};

/**
 * 游戏桌面组件 - 4人位置布局
 * @param {Object} props
 * @param {Array} props.players - 所有玩家
 * @param {Object} props.currentPlayer - 当前玩家
 * @param {Function} props.onReturnToRoom - 返回组房界面的回调，不退出房间
 * @param {Function} props.onRequestSurrender - 发起投降的回调
 * @param {Object} props.playedCards - 每个玩家出的牌 { [playerId]: { playerName, cards } }
 * @param {Object} props.throwFailedPreviews - 甩牌失败时短暂停留的完整尝试牌面
 * @param {Object} props.shownCards - 摸牌阶段展示的牌 { [playerId]: { playerName, cards } }
 * @param {Array} props.myCards - 我的手牌
 * @param {Array} props.selectedCards - 选中的牌
 * @param {Array} props.disabledCardIds - 因规则不可选择的手牌ID
 * @param {String} props.disabledCardReason - 规则禁用牌的提示
 * @param {Array} props.virtualizedCardIds - “虚虚实实”本次视为不存在的手牌ID
 * @param {Function} props.onCardClick - 点击牌的回调
 * @param {Function} props.onReorder - 重新排序手牌的回调
 * @param {String} props.currentTurnPlayerId - 当前轮到谁出牌
 * @param {Object} props.trumpAnimation - 毙牌/盖毙的局部打击动画
 * @param {String} props.trumpSuit - 主牌花色
 * @param {String} props.trumpRank - 主牌点数
 * @param {Array} props.publicBottomCards - “昭然若揭”整局明置的当前底牌
 * @param {Array} props.revealedBottomCards - 揭示的底牌
 * @param {Object} props.selectedRule - 选中的规则 { name, content }
 * @param {Number} props.displayRoundNumber - 当前牌面对应的轮次；轮末停留时锁定为刚结束的轮次
 * @param {Object} props.heldRoundCandle - 轮末停留期间冻结的本轮烛态
 * @param {Function} props.onSelectRule - 选择规则的回调
 * @param {ReactNode} props.renderControls - 渲染控制区域的函数或组件
 * @param {Boolean} props.isWaitingForReady - 是否在等待玩家准备阶段
 * @param {ReactNode} props.trumpDeclarationComponent - 亮主条组件
 * @param {Object} props.currentTrumpDeclaration - 当前亮主信息
 * @param {Object} props.currentInferiorDeclaration - “三六九等”当前亮劣信息
 * @param {Number} props.attackerScore - 闲家当前得分
 * @param {Array} props.collectedPointCards - 闲家收集的分数牌
 * @param {Object} props.bottomScoreResult - 底牌得分结果
 * @param {Object} props.upgradeResult - 升级结果
 * @param {Number} props.team1Level - 队伍1等级
 * @param {Number} props.team2Level - 队伍2等级
 * @param {Number} props.dealerPlayerIndex - 庄家玩家索引
 * @param {Object} props.cardExchange - 摸牌后的公开换牌进度
 * @param {Object} props.mainstay - “中流砥柱”当前依次处理进度
 * @param {Object} props.cardExchangeAnimation - 换牌路径动画
 * @param {Object} props.privateCardTransferReveal - 仅接收者可见的换入牌面
 * @param {Object} props.threePowers - 三权分立三个重载分牌槽的可见状态
 */
export default function GameTable({
  players,
  currentPlayer,
  onReturnToRoom,
  onRequestSurrender,
  canRequestSurrender = false,
  hasRequestedSurrender = false,
  playedCards = {},
  throwFailedPreviews = {},
  shownCards = {},
  myCards = [],
  woodenOxCard = null,
  selectedCards = [],
  disabledCardIds = [],
  disabledCardReason = '',
  virtualizedCardIds = [],
  transformableCardIds = [],
  onCardClick,
  onRequestCardTransformation,
  onCancelCardTransformation,
  onReorder,
  currentTurnPlayerId,
  currentWinningPlayerId = null,
  trumpAnimation = null,
  trumpSuit = null,
  trumpRank = null,
  publicBottomCards = null,
  revealedBottomCards = null,
  selectedRule = null,
  ruleRuntimeStatus = null,
  displayRoundNumber = null,
  heldRoundCandle = null,
  ownFocusFigurePlayerId = null,
  tenSidedAmbush = null,
  threePowers = null,
  divineWeapon = null,
  selectedDivineWeaponCardId = null,
  onDivineWeaponCardClick,
  canSelectDivineWeapon = false,
  onSelectRule,
  ruleChooserPlayerId = null,
  isRuleSelectionPending = false,
  renderControls = null,
  isWaitingForReady = false,
  trumpDeclarationComponent = null,
  currentTrumpDeclaration = null,
  currentInferiorDeclaration = null,
  buryingPlayerId = null,
  secondaryBuryingPlayerId = null,
  dealerCountdown = null,
  attackerScore = 0,
  collectedPointCards = [],
  bottomScoreResult = null,
  upgradeResult = null,
  team1Level = 2,
  team2Level = 2,
  dealerPlayerIndex = null,
  cardExchange = null,
  mainstay = null,
  cardExchangeAnimation = null,
  privateCardTransferReveal = null,
  highlightedCardIds = [],
  highlightedCardLabel = '',
  highlightedCardTone = 'arrival',
  openHand = null,
  ruleVisibleHands = [],
  playerTargeting = null,
  onPlayerTargetClick,
  openHandSelectedCards = [],
  onOpenHandCardClick,
  canControlOpenHand = false,
  disableMyHand = false
}) {
  const ruleChooser = players.find(player => player.id === ruleChooserPlayerId);
  const mainstayAction = mainstay?.currentAction || null;
  const mainstayActor = players.find(player => player.id === mainstayAction?.actorPlayerId);
  const mainstayChooser = players.find(player => player.id === mainstayAction?.chooserPlayerId);
  const ruleVisibleHandsByPlayerId = new Map(
    ruleVisibleHands.map(hand => [hand.playerId, hand])
  );
  const hasRevealedHand = player => Boolean(
    player && (openHand?.playerId === player.id || ruleVisibleHandsByPlayerId.has(player.id))
  );
  // 根据玩家数量和当前玩家位置，计算每个位置显示哪个玩家
  const getPlayerPositions = () => {
    if (!currentPlayer || !players || players.length === 0) {
      return { bottom: null, top: null, left: null, right: null };
    }

    const myIndex = players.findIndex(p => p.id === currentPlayer.id);
    if (myIndex === -1) {
      return { bottom: null, top: null, left: null, right: null };
    }

    const positions = { bottom: players[myIndex] };

    // 根据玩家数量分配位置
    if (players.length === 2) {
      positions.top = players[(myIndex + 1) % 2];
    } else if (players.length === 3) {
      positions.left = players[(myIndex + 1) % 3];
      positions.right = players[(myIndex + 2) % 3];
    } else if (players.length === 4) {
      positions.right = players[(myIndex + 1) % 4];
      positions.top = players[(myIndex + 2) % 4];
      positions.left = players[(myIndex + 3) % 4];
    }

    return positions;
  };

  const positions = getPlayerPositions();
  const renderTurnIndicator = isSelf => (
    <span
      className="turn-indicator"
      role="status"
      aria-label={isSelf ? '轮到你出牌' : '当前玩家正在出牌'}
    >
      <span className="turn-indicator-pip" aria-hidden="true" />
      <span className="turn-indicator-label">{isSelf ? '轮到你' : '出牌中'}</span>
    </span>
  );
  const renderStriveUpstreamOrderBadge = player => {
    const actionOrder = getStriveUpstreamActionOrder(players, ruleRuntimeStatus, player?.id);
    if (!actionOrder) return null;
    return (
      <span
        className={`strive-upstream-order-badge order-${actionOrder}`}
        data-action-order={actionOrder}
        title={`力争上游：行动顺序 ${actionOrder}`}
      >
        {actionOrder}
      </span>
    );
  };
  const isSettlementView = Boolean(
    revealedBottomCards?.length && (bottomScoreResult || upgradeResult)
  );
  const surrenderRevealedHands = bottomScoreResult?.surrender?.revealedHands || [];
  const hasSurrenderShowdown = surrenderRevealedHands.length > 0;
  const isPublicBottomVisible = Boolean(
    ruleIncludesId(selectedRule, 'openly_revealed')
    && publicBottomCards?.length
    && !isSettlementView
  );
  const isFocusFigureRule = ruleIncludesId(selectedRule, 'focus_figure');
  const isLostInFogScoringHidden = ruleIncludesId(selectedRule, 'lost_in_fog') && !isSettlementView;
  const focusFigure = ruleRuntimeStatus?.focusFigure || null;
  const knownFocusPlayerIds = new Set(
    focusFigure?.isRevealed
      ? (focusFigure.teams || []).map(team => team.focusPlayerId).filter(Boolean)
      : [ownFocusFigurePlayerId].filter(Boolean)
  );
  const focusCapturedPointsByPlayerId = focusFigure?.capturedPointsByPlayerId || {};
  const dreamKillingSleepingPlayerIds = new Set(
    ruleRuntimeStatus?.dreamKilling?.sleepingPlayerIds || []
  );
  const showFocusFigureProgress = isFocusFigureRule && Boolean(focusFigure);
  const secondBattlefield = ruleRuntimeStatus?.secondBattlefield || null;
  const oneCountryTwoSystems = ruleIncludesId(selectedRule, 'one_country_two_systems')
    ? ruleRuntimeStatus?.oneCountryTwoSystems || null
    : null;
  const oneCountryDeclarations = oneCountryTwoSystems?.declarationsByTeam || {};
  const oneCountryResolution = oneCountryTwoSystems?.resolved || null;
  const encircleThreeMissingOne = ruleIncludesId(selectedRule, 'encircle_three_missing_one')
    ? ruleRuntimeStatus?.encircleThreeMissingOne || null
    : null;
  const isHoldingSecondBattlefieldResult = Boolean(
    secondBattlefield?.lastResult?.triggerRound === displayRoundNumber
    && displayRoundNumber !== ruleRuntimeStatus?.currentRound
  );
  const displayedSecondBattlefieldCards = isHoldingSecondBattlefieldResult
    ? secondBattlefield.lastResult.communityCards
    : secondBattlefield?.communityCards;
  const displayedSecondBattlefieldAccumulatedCards = isHoldingSecondBattlefieldResult
    ? Object.fromEntries(
        (secondBattlefield?.lastResult?.players || []).map(
          player => [player.playerId, player.accumulatedCards || []]
        )
      )
    : secondBattlefield?.accumulatedCardsByPlayerId || {};
  const ambushAttackerNetCardCount = Number.isFinite(tenSidedAmbush?.attackerNetCardCount)
    ? tenSidedAmbush.attackerNetCardCount
    : 0;
  const currentRoundNumber = Math.max(
    1,
    displayRoundNumber ?? ruleRuntimeStatus?.currentRound ?? 1
  );
  const showRecordOnFileWhiteJoker = ruleIncludesId(selectedRule, 'king_over_white');
  const showRecordOnFileRoyalJokers = ruleIncludesId(selectedRule, 'eight_kings_council');
  const recordOnFileTrackerView = getRecordOnFileTrackerView(
    ruleRuntimeStatus?.recordOnFile,
    currentRoundNumber,
    {
      showWhiteJoker: showRecordOnFileWhiteJoker,
      showRoyalJokers: showRecordOnFileRoyalJokers
    }
  );
  const candleToDawn = ruleRuntimeStatus?.candleToDawn || null;
  const threeTigers = ruleRuntimeStatus?.threeTigers || null;
  const inviteIntoUrn = ruleRuntimeStatus?.inviteIntoUrn || null;
  const oldHorse = ruleRuntimeStatus?.oldHorse || null;
  const trumpWins = ruleRuntimeStatus?.trumpWins || null;
  const strawBoatBorrowingArrows = ruleRuntimeStatus?.strawBoatBorrowingArrows || null;
  const bushGate = ruleRuntimeStatus?.bushGate || null;
  const teammateCheer = ruleRuntimeStatus?.teammateCheer || null;
  const teammateCheerBuffedPlayerIds = new Set(teammateCheer?.buffedPlayerIds || []);
  const afterglowActivePlayerIds = new Set(
    ruleRuntimeStatus?.afterglow?.activePlayerIds || []
  );
  const defenseAsOffense = ruleIncludesId(selectedRule, 'defense_as_offense')
    ? getDisplayedDefenseAsOffense(ruleRuntimeStatus, currentRoundNumber)
    : null;
  const destroyDykeDisplayState = ruleIncludesId(selectedRule, 'destroy_dyke_flood_fields')
    ? getDestroyDykeDisplayState(ruleRuntimeStatus?.destroyDyke)
    : null;
  const lureTigerSilencedPlayerIds = new Set(
    ruleRuntimeStatus?.lureTiger?.silencedPlayerIds || []
  );
  const displayedThreeTigers = threeTigers?.currentRound?.round === currentRoundNumber
    ? threeTigers.currentRound
    : threeTigers?.lastRound?.round === currentRoundNumber
      ? threeTigers.lastRound
      : threeTigers?.currentRound || null;
  const threeTigersProgress = Object.entries(displayedThreeTigers?.suitCounts || {})
    .reduce((best, entry) => entry[1] > (best?.[1] || 0) ? entry : best, null);
  const displayedInviteDeclarations = (inviteIntoUrn?.declarations || []).length > 0
    ? inviteIntoUrn.declarations
    : inviteIntoUrn?.lastResult?.round === currentRoundNumber
      ? inviteIntoUrn.lastResult.declarations || []
      : [];
  // round_updated 与 room_updated 是两个连续事件。即使 React 尚未来得及写入
  // heldCompletedRoundNumber，只要四家的末手仍完整留在桌上，就仍属于刚结束的那轮。
  // 这样服务端的新烛态不会在清桌前闪现一帧。
  const displayedCandleState = getDisplayedCandleState({
    candleToDawn,
    currentRound: ruleRuntimeStatus?.currentRound,
    displayRoundNumber,
    heldRoundCandle,
    visiblePlayCount: Object.keys(playedCards).length,
    playerCount: players.length
  });
  const displayedCandleLit = displayedCandleState.isLit;
  const displayedCandleRoundNumber = displayedCandleState.round;
  const currentRoundPointResolver = ruleIncludesId(selectedRule, 'three_powers')
    ? card => getThreePowersCardPoints(card, threePowers)
    : ruleIncludesId(selectedRule, 'meticulous_accounting')
      ? getMeticulousAccountingCardPoints
      : ruleIncludesId(selectedRule, 'candle_to_dawn')
        ? card => getCandleToDawnCardPoints(card, displayedCandleLit)
        : undefined;
  const visibleRoundPlays = Object.values(playedCards);
  const hasConcealedRoundPlay = visibleRoundPlays.some(play => play?.concealed);
  const hasCompleteRevealedRound = players.length > 0
    && visibleRoundPlays.length >= players.length
    && !hasConcealedRoundPlay;
  const shouldHideCurrentRoundPoints = ruleIncludesId(selectedRule, 'no_one_survives')
    ? !hasCompleteRevealedRound
    : hasConcealedRoundPlay;
  const baseCurrentRoundPoints = visibleRoundPlays.reduce((total, play) => {
    return total + calculateCardPoints(play?.cards || [], currentRoundPointResolver);
  }, 0);
  const oddEvenRoundMultiplier = getOddEvenRoundMultiplier(selectedRule, currentRoundNumber);
  const currentRoundPoints = shouldHideCurrentRoundPoints
    ? 0
    : baseCurrentRoundPoints * oddEvenRoundMultiplier;
  const positionByPlayerId = Object.fromEntries(
    Object.entries(positions)
      .filter(([, player]) => player?.id)
      .map(([position, player]) => [player.id, position])
  );
  const exchangeCoordinates = {
    top: { x: '50%', y: '11%' },
    right: { x: '91%', y: '50%' },
    bottom: { x: '50%', y: '91%' },
    left: { x: '9%', y: '50%' }
  };
  const myExchangeTarget = cardExchange
    ? players.find(player => player.id === cardExchange.targetByPlayerId?.[currentPlayer?.id])
    : null;

  // 获取花色符号
  const getSuitSymbol = (suit) => {
    const symbols = {
      hearts: '♥',
      diamonds: '♦',
      clubs: '♣',
      spades: '♠'
    };
    return symbols[suit] || '';
  };

  // 获取花色颜色
  const getSuitColor = (suit) => {
    return (suit === 'hearts' || suit === 'diamonds') ? '#ff4d4f' : '#f5f5f5';
  };

  // 获取花色符号（扩展版）
  const getSuitSymbolExtended = (suit) => {
    const symbols = {
      hearts: '♥',
      diamonds: '♦',
      clubs: '♣',
      spades: '♠',
      trump: '主',
      joker: '王',
      no_trump: '无主'
    };
    return symbols[suit] || suit;
  };

  const getPublicCardLabel = card => {
    if (!card) return '未知牌';
    if (card.rank === 'small_joker') return '小王';
    if (card.rank === 'big_joker') return '大王';
    if (card.rank === 'county_prince_joker') return '郡王';
    if (card.rank === 'prince_joker') return '亲王';
    if (card.rank === 'white_joker') return '白王（皇）';
    return `${getSuitSymbolExtended(card.suit)}${card.rank}`;
  };

  const waitingRabbit = ruleIncludesId(selectedRule, 'waiting_rabbit')
    ? ruleRuntimeStatus?.waitingRabbit || null
    : null;
  const getWaitingRabbitRecordText = record => {
    switch (record.type) {
      case 'target_locked':
        return record.playerId === currentPlayer?.id && waitingRabbit?.ownPrivateTarget
          ? `${record.playerName} 已暗选 ${getPublicCardLabel(waitingRabbit.ownPrivateTarget)}`
          : `${record.playerName} 已完成暗选`;
      case 'target_triggered':
        return `${record.sourcePlayerName} 打出 ${record.playerName} 的目标 ${getPublicCardLabel(record.targetCard)}`;
      case 'target_exchanged':
        return `${record.playerName} 用 ${getPublicCardLabel(record.discardedCard)} 换回 ${getPublicCardLabel(record.targetCard)}`;
      case 'exchange_declined':
        return `${record.playerName} 放弃换回 ${getPublicCardLabel(record.targetCard)}`;
      default:
        return `${record.playerName || '玩家'} 完成守株待兔操作`;
    }
  };

  const getPlayerTeamIndex = player => {
    const fixedTeamIndex = ruleRuntimeStatus?.happyTwins
      ?.teamIndexByPlayerId?.[player?.id];
    if (Number.isInteger(fixedTeamIndex)) return fixedTeamIndex;
    const playerIndex = players.findIndex(candidate => candidate.id === player?.id);
    return playerIndex >= 0 ? playerIndex % 2 : null;
  };

  const getPlayerTrumpSuit = player => {
    if (!oneCountryTwoSystems) return trumpSuit;
    if (oneCountryTwoSystems.hasJokerDeclaration || oneCountryResolution?.isNoTrump) {
      return 'no_trump';
    }
    const teamIndex = getPlayerTeamIndex(player);
    const resolvedSuit = oneCountryResolution?.teamTrumpSuits?.[teamIndex];
    if (resolvedSuit) return resolvedSuit;

    const declaredSuits = [...new Set(
      Object.values(oneCountryDeclarations)
        .map(declaration => declaration?.suit)
        .filter(suit => suit && suit !== 'joker')
    )];
    if (declaredSuits.length === 1) return declaredSuits[0];
    return oneCountryDeclarations?.[teamIndex]?.suit || trumpSuit;
  };

  const getPlayerTrumpDeclaration = player => {
    if (!oneCountryTwoSystems) return currentTrumpDeclaration;
    const teamIndex = getPlayerTeamIndex(player);
    return oneCountryDeclarations?.[teamIndex] || null;
  };
  const getPlayerInferiorDeclaration = player => (
    currentInferiorDeclaration?.playerId === player?.id
      ? currentInferiorDeclaration
      : null
  );
  const renderDeclarationCardSlot = ({
    cards,
    declarationRole,
    player,
    playerTrumpSuit
  }) => {
    if (!cards?.length) return null;
    const isInferior = declarationRole === 'inferior';
    return (
      <div
        className={`declaration-card-slot ${isInferior ? 'is-inferior' : 'is-trump'}`}
        aria-label={`${player?.name || '玩家'}亮${isInferior ? '劣' : '主'}${cards.length === 2 ? '一对' : '单张'}`}
        title={isInferior ? '三六九等：当前亮劣' : '当前亮主'}
      >
        <div className="declaration-card-pair">
          {cards.map(card => (
            <Card
              key={card.id}
              card={card}
              disabled
              small
              trumpSuit={playerTrumpSuit}
              trumpRank={trumpRank}
            />
          ))}
        </div>
      </div>
    );
  };

  const oneCountryTrumpRows = (() => {
    if (!oneCountryTwoSystems) return [];
    const dealerTeamIndex = oneCountryResolution?.dealerTeamIndex
      ?? (Number.isInteger(dealerPlayerIndex) ? dealerPlayerIndex % 2 : null);
    return [0, 1].map(teamIndex => {
      const declaration = oneCountryDeclarations?.[teamIndex];
      const resolvedSuit = oneCountryResolution?.teamTrumpSuits?.[teamIndex];
      const suit = oneCountryTwoSystems.hasJokerDeclaration || oneCountryResolution?.isNoTrump
        ? 'no_trump'
        : resolvedSuit || declaration?.suit || null;
      const label = dealerTeamIndex === null
        ? `队伍${teamIndex + 1}`
        : teamIndex === dealerTeamIndex ? '庄家方' : '闲家方';
      return {
        teamIndex,
        label,
        suit,
        playerName: declaration?.playerName || null
      };
    });
  })();

  // 渲染单个玩家区域
  const renderPlayerArea = (player, position) => {
    if (!player) return null;

    const isCurrentTurn = player.id === currentTurnPlayerId;
    const played = playedCards[player.id];
    const shown = shownCards[player.id];

    // 检查是否是当前亮主的玩家
    const playerTrumpDeclaration = getPlayerTrumpDeclaration(player);
    const playerTrumpSuit = getPlayerTrumpSuit(player);
    const hasDeclaredTrump = playerTrumpDeclaration?.playerId === player.id;
    const playerInferiorDeclaration = getPlayerInferiorDeclaration(player);
    const hasInferiorDeclaration = Boolean(playerInferiorDeclaration?.cards?.length);
    const hasAnyDeclaration = hasDeclaredTrump || hasInferiorDeclaration;
    const isOpenHand = hasRevealedHand(player);
    const isSecondaryBuryingPlayer = player.id === secondaryBuryingPlayerId;
    const isKnownFocusFigure = knownFocusPlayerIds.has(player.id);
    const isDreamKillingSleeping = dreamKillingSleepingPlayerIds.has(player.id);
    const hasTeammateCheerBuff = teammateCheerBuffedPlayerIds.has(player.id);
    const hasAfterglow = afterglowActivePlayerIds.has(player.id);
    const defenseAsOffenseDelta = defenseAsOffense?.playerId === player.id
      ? Number(defenseAsOffense.delta) || 0
      : 0;
    const isLureTigerSilenced = lureTigerSilencedPlayerIds.has(player.id);
    const focusCapturedPoints = Number(focusCapturedPointsByPlayerId[player.id]) || 0;
    const isSelectableTarget = Boolean(
      playerTargeting?.active
      && (playerTargeting?.allowSelf || player.id !== currentPlayer?.id)
      && (playerTargeting?.requireCards === false || player.cardsCount > 0)
    );
    const isSelectedTarget = playerTargeting?.targetPlayerId === player.id
      || playerTargeting?.selectedPlayerIds?.includes(player.id);

    // 检查是否是庄家
    // 优先使用 dealerPlayerIndex（从第二局开始就知道了）
    // 如果 dealerPlayerIndex 存在，根据索引判断
    // 否则使用 buryingPlayerId（第一局摸完牌后才知道）
    let isDealer = false;
    if (dealerPlayerIndex !== null && players && players.length > 0) {
      const playerIndex = players.findIndex(p => p.id === player.id);
      isDealer = playerIndex === dealerPlayerIndex;
    } else if (buryingPlayerId) {
      isDealer = player.id === buryingPlayerId;
    }

    return (
      <div
        className={`player-area player-${position} ${hasAnyDeclaration ? 'has-declaration' : ''} ${isCurrentTurn ? 'current-turn' : ''} ${isSelectableTarget ? 'skill-targetable' : ''} ${isSelectedTarget ? 'skill-target-selected' : ''}`}
        data-player-id={player.id}
        onClick={isSelectableTarget ? () => onPlayerTargetClick?.(player) : undefined}
        role={isSelectableTarget ? 'button' : undefined}
        tabIndex={isSelectableTarget ? 0 : undefined}
        aria-label={isSelectableTarget
          ? `${playerTargeting?.label || '选择玩家'}：${player.name}`
          : undefined}
        onKeyDown={isSelectableTarget ? (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onPlayerTargetClick?.(player);
          }
        } : undefined}
      >
        {isCurrentTurn && renderTurnIndicator(false)}
        <div className="player-info">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
            <span className="player-avatar-wrap">
              <span className="player-avatar" aria-hidden="true">
                {player.isBot ? 'AI' : (player.name || '?').slice(0, 1).toUpperCase()}
              </span>
              {isDealer && <span className="dealer-badge">庄</span>}
              {isSecondaryBuryingPlayer && <span className="secondary-burying-badge">埋</span>}
              {isOpenHand && <span className="open-hand-avatar-badge">明</span>}
              {isWaitingForReady && player.isReady !== undefined && (
                <span
                  className={`ready-badge ${player.isReady ? 'is-ready' : 'not-ready'}`}
                  aria-label={player.isReady ? '已准备' : '未准备'}
                  title={player.isReady ? '已准备' : '未准备'}
                >
                  {player.isReady ? '✓' : '○'}
                </span>
              )}
            </span>
            <Text strong className="player-name" title={player.name}>{player.name}</Text>
            {renderStriveUpstreamOrderBadge(player)}
            {defenseAsOffenseDelta > 0 && (
              <span
                className="defense-as-offense-player-badge"
                title={`以守为攻：上一轮一号位，本轮牌面+${defenseAsOffenseDelta}`}
              >
                +{defenseAsOffenseDelta}
              </span>
            )}
            {isKnownFocusFigure && (
              <span className="focus-figure-player-badge" title="己方焦点人物">焦点</span>
            )}
            {isDreamKillingSleeping && (
              <span className="dream-killing-player-badge" title="梦中：由系统随机出牌">梦中</span>
            )}
            {hasTeammateCheerBuff && (
              <span className="teammate-cheer-player-badge" title="队友加油：本局余下牌面永久+1">
                加油+1
              </span>
            )}
            {hasAfterglow && (
              <span className="afterglow-player-badge" title="回光返照：仍有主牌时每次只能出主牌，牌面+1">
                返照+1
              </span>
            )}
            {isLureTigerSilenced && (
              <span className="lure-tiger-player-badge" title="调虎离山：本轮不参与甩牌询问，出牌不计大小与分数">
                沉默
              </span>
            )}
          </div>
          {showFocusFigureProgress && (
            <div className="focus-figure-captured-points" data-focus-captured-player-id={player.id}>
              被闲家收走 {focusCapturedPoints} 分
            </div>
          )}
        </div>

        <span
          className={`player-hand-count player-hand-count-${position}`}
          aria-label={`手牌 ${player.cardsCount || 0} 张`}
          title={`手牌：${player.cardsCount || 0} 张`}
        >
          {player.cardsCount || 0}张
        </span>

        <div className="player-cards-area">
          {/* 亮主占玩家框左下角，亮劣占右下角，都不参与框体尺寸计算。 */}
          <div
            className={`declared-trump-zone declaration-sidecar declaration-sidecar-${position} ${hasDeclaredTrump && hasInferiorDeclaration ? 'has-dual-declaration' : ''}`}
            aria-live="polite"
          >
            {hasDeclaredTrump && renderDeclarationCardSlot({
              cards: playerTrumpDeclaration.cards,
              declarationRole: 'trump',
              player,
              playerTrumpSuit
            })}
            {renderDeclarationCardSlot({
              cards: playerInferiorDeclaration?.cards,
              declarationRole: 'inferior',
              player,
              playerTrumpSuit
            })}
          </div>

          {shown && shown.cards && shown.cards.length > 0 && (
            <div className="shown-cards">
              <Text type="info">展示:</Text>
              <Hand cards={shown.cards} disabled trumpSuit={playerTrumpSuit} trumpRank={trumpRank} />
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderOpenHand = (player, position) => {
    if (!player) return null;
    const isControlledOpenHand = openHand?.playerId === player.id;
    const visibleHand = ruleVisibleHandsByPlayerId.get(player.id);
    const revealedHand = isControlledOpenHand ? openHand : visibleHand;
    if (!revealedHand) return null;
    return (
      <OpenHandPanel
        openHand={revealedHand}
        position={position}
        selectedCards={openHandSelectedCards}
        onCardClick={isControlledOpenHand ? onOpenHandCardClick : undefined}
        interactive={isControlledOpenHand && position === 'top' && canControlOpenHand}
        label={isControlledOpenHand ? '明牌' : visibleHand.label}
        trumpSuit={getPlayerTrumpSuit(player)}
        trumpRank={trumpRank}
      />
    );
  };

  // 判断我方队伍（索引0和2是队伍1，索引1和3是队伍2）
  const getTeamLabels = () => {
    if (!currentPlayer || !players || players.length === 0) {
      return { myTeamLabel: '我方', opponentTeamLabel: '对方', myTeamLevel: team1Level, opponentTeamLevel: team2Level };
    }

    const myIndex = players.findIndex(p => p.id === currentPlayer.id);
    if (myIndex === -1) {
      return { myTeamLabel: '我方', opponentTeamLabel: '对方', myTeamLevel: team1Level, opponentTeamLevel: team2Level };
    }

    // 欢乐成双只换座位，队伍仍按换位前的固定玩家组合。
    const myTeam = (getPlayerTeamIndex(currentPlayer) ?? (myIndex % 2)) + 1;

    if (myTeam === 1) {
      return {
        myTeamLabel: '我方',
        opponentTeamLabel: '对方',
        myTeamLevel: team1Level,
        opponentTeamLevel: team2Level
      };
    } else {
      return {
        myTeamLabel: '我方',
        opponentTeamLabel: '对方',
        myTeamLevel: team2Level,
        opponentTeamLevel: team1Level
      };
    }
  };

  const teamLabels = getTeamLabels();

  // 渲染出牌区域（在玩家框和桌面中央之间）
  const renderPlayedCardsArea = (player, position) => {
    if (!player) return null;
    const played = throwFailedPreviews[player.id] || playedCards[player.id];

    // 始终渲染出牌区域，即使没有牌，以保持布局稳定
    const hasPlayedCards = Boolean(played && (played.cards?.length > 0 || played.concealed));
    const isWinningPlay = !played?.throwFailedAttempt
      && player.id === currentWinningPlayerId
      && played?.cards?.length > 0;
    const isTrumpActionPlayer = trumpAnimation?.playerId === player.id;
    const isTrumpActionTarget = trumpAnimation?.targetPlayerId === player.id;
    return (
      <div
        className={`played-cards-area played-cards-${position} ${hasPlayedCards ? 'has-cards' : 'is-empty'} ${isWinningPlay ? 'winning-play' : ''} ${isTrumpActionPlayer ? 'trump-action-player' : ''} ${isTrumpActionTarget ? 'trump-action-target' : ''} ${played?.throwFailedAttempt ? 'throw-failed-preview' : ''} ${played?.treatedAsSmall ? 'treated-as-small' : ''} ${played?.lureTigerSilenced ? 'lure-tiger-silenced-play' : ''} ${played?.justRevealed ? 'concealed-just-revealed' : ''} ${played?.enduringInheritance ? 'enduring-inherited' : ''} ${played?.averagePooling ? 'average-pooled' : ''} ${played?.jointHarmony ? 'joint-harmony' : ''} ${played?.dreamKilling?.success ? 'dream-killing-success' : ''} ${played?.magicTrickSwapped ? 'magic-trick-swapped' : ''} ${played?.oldHorseAbsolute ? 'old-horse-absolute' : ''}`}
        data-treated-as-small={played?.treatedAsSmall ? 'true' : undefined}
        data-enduring-inherited={played?.enduringInheritance ? 'true' : undefined}
      >
        {played?.throwFailedAttempt && (
          <div className="throw-failed-preview-label" role="status">
            甩牌失败
          </div>
        )}
        {isTrumpActionTarget && (
          <div
            className={`trump-strike-impact ${trumpAnimation.type}`}
            key={`impact-${trumpAnimation.key}`}
            aria-hidden="true"
          >
            <span className="trump-strike-smoke" />
            <span className="trump-strike-shockwave" />
            <span className="trump-strike-flare" />
            <span className="trump-strike-dart dart-left" />
            <span className="trump-strike-dart dart-right" />
          </div>
        )}
        {played?.ambiguousOptions?.length === 2 && (
          <div className="ambiguous-play-options" aria-label="模棱两可的两套公开方案">
            {played.ambiguousOptions.map(option => (
              <div
                className={`ambiguous-play-option ${played.ambiguousSelectedOptionIndex === option.index ? 'is-selected' : ''}`}
                key={option.index}
              >
                <span className="ambiguous-play-option-label">
                  {option.index === 0 ? 'A' : 'B'}
                </span>
                <Hand
                  cards={sortCards(option.cards || [], getPlayerTrumpSuit(player), trumpRank)}
                  disabled
                  small
                  showOriginalFace
                  anticipateNextCard={false}
                  trumpSuit={getPlayerTrumpSuit(player)}
                  trumpRank={trumpRank}
                  minimumVisibleWidth={22}
                />
              </div>
            ))}
          </div>
        )}
        {(!played?.ambiguousOptions || played.ambiguousOptions.length !== 2)
          && played?.cards?.length > 0 && (
          <Hand
            cards={sortCards(played.cards, getPlayerTrumpSuit(player), trumpRank)}
            disabled
            showOriginalFace
            anticipateNextCard={false}
            showWinningBadge={isWinningPlay}
            trumpSuit={getPlayerTrumpSuit(player)}
            trumpRank={trumpRank}
            minimumVisibleWidth={position === 'left' || position === 'right' ? 30 : 32}
          />
        )}
        {played?.concealed && !played?.ownConcealedCards && (
          <div className="concealed-play-stack" aria-label={`暗置 ${played.cardsCount || 0} 张牌`}>
            {Array.from({ length: played.cardsCount || 0 }, (_, index) => (
              <span
                className="concealed-play-card"
                key={index}
                style={{
                  '--concealed-offset-x': `${Math.min(index, 7) * 3.5}px`,
                  '--concealed-offset-y': `${Math.min(index, 7)}px`
                }}
              />
            ))}
            <span className="concealed-play-label">暗置 · {played.cardsCount || 0}</span>
          </div>
        )}
        {played?.treatedAsSmall && (
          <span className="active-skill-play-badge">
            {played.activeSkillName || '李代桃僵'} · 小
          </span>
        )}
        {played?.lureTigerSilenced && (
          <span className="round-rule-play-badge lure-tiger-silenced-badge">
            默 · 不比大小 · 不计分
          </span>
        )}
        {played?.jokerSubstitutions?.length > 0 && (
          <span className="joker-substitution-badge">
            {played.jokerSubstitutions.map(substitution => {
              const suit = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }[substitution.suit] || '';
              return `${getJokerSubstitutionSourceLabel(played, substitution)}→${substitution.rank}${suit}`;
            }).join(' · ')}
          </span>
        )}
        {played?.clusterAnalysisSubstitutions?.length > 0 && (
          <span className="round-rule-play-badge cluster-analysis-badge">
            聚 · {played.clusterAnalysisSubstitutions
              .map(substitution => `${substitution.fromRank}→${substitution.toRank}`)
              .join(' · ')}
          </span>
        )}
        {played?.enduringInheritance && (
          <div
            className="enduring-inheritance-ribbon"
            role="status"
            aria-label="经久不衰生效，本次按上轮较高牌力结算"
            title="实际出牌不变，比大小时沿用上轮同结构的较高牌力"
          >
            <span className="enduring-inheritance-seal">承</span>
            <span className="enduring-inheritance-label">上轮牌力</span>
            <span className="enduring-inheritance-cards" aria-hidden="true">
              {(played.enduringInheritance.sourceCards || []).slice(0, 6).map((card, index) => (
                <Card
                  key={`${card.id || `${card.suit}-${card.rank}`}-${index}`}
                  card={card}
                  micro
                  disabled
                  trumpSuit={trumpSuit}
                  trumpRank={trumpRank}
                />
              ))}
              {(played.enduringInheritance.sourceCards?.length || 0) > 6 && (
                <span className="enduring-inheritance-more">
                  +{played.enduringInheritance.sourceCards.length - 6}
                </span>
              )}
            </span>
          </div>
        )}
        {played?.averagePooling && (
          <span className="round-rule-play-badge average-pooling-badge">均 · 队友平均</span>
        )}
        {played?.jointHarmony && (
          <span className="round-rule-play-badge joint-harmony-badge">合 · 珠联璧合</span>
        )}
        {played?.dreamKilling?.success && (
          <span className="round-rule-play-badge dream-killing-success-badge">醒 · 视为最大</span>
        )}
        {played?.oldHorseAbsolute && (
          <span className="round-rule-play-badge old-horse-absolute-badge">骥 · 绝对最大</span>
        )}
        {played?.magicTrickSwapped && (
          <span className="round-rule-play-badge magic-trick-badge">术 · 结算换位</span>
        )}
        {isTrumpActionPlayer && (
          <div
            className={`trump-action-callout ${trumpAnimation.type}`}
            key={`callout-${trumpAnimation.key}`}
            role="status"
            aria-live="assertive"
            aria-label={`${trumpAnimation.playerName}${trumpAnimation.type === 'overtrump' ? '盖毙' : '毙了'}${trumpAnimation.targetPlayerName ? `，压过${trumpAnimation.targetPlayerName}` : ''}`}
          >
            <strong>{trumpAnimation.type === 'overtrump' ? '盖毙' : '毙了'}</strong>
            <span aria-hidden="true" />
          </div>
        )}
      </div>
    );
  };

  const renderSecondBattlefieldStagedArea = (player, position) => {
    if (!player || !ruleIncludesId(selectedRule, 'second_battlefield')) return null;
    const currentCardIds = new Set(
      (playedCards[player.id]?.cards || []).map(card => card.id).filter(Boolean)
    );
    const stagedCards = (
      displayedSecondBattlefieldAccumulatedCards?.[player.id] || []
    ).filter(card => !currentCardIds.has(card.id));
    if (stagedCards.length === 0) return null;

    return (
      <div
        className={`second-battlefield-staged-cards second-battlefield-staged-${position}`}
        data-testid={`second-battlefield-staged-${player.id}`}
        data-position={position}
        aria-label={`${player.name}尚未参与德州的牌`}
      >
        <span className="second-battlefield-staged-label">待比牌</span>
        <div className="second-battlefield-staged-card-row">
          {sortCards(stagedCards, trumpSuit, trumpRank).map((card, index) => (
            <span
              className="second-battlefield-staged-card"
              key={card.id || `${card.suit}-${card.rank}-${index}`}
            >
              <Card
                card={card}
                small
                disabled
                trumpSuit={trumpSuit}
                trumpRank={trumpRank}
              />
            </span>
          ))}
        </div>
      </div>
    );
  };

  const bottomTrumpDeclaration = positions.bottom
    ? getPlayerTrumpDeclaration(positions.bottom)
    : null;
  const bottomInferiorDeclaration = positions.bottom
    ? getPlayerInferiorDeclaration(positions.bottom)
    : null;
  const bottomHasTrumpDeclaration = Boolean(
    positions.bottom
    && bottomTrumpDeclaration?.playerId === positions.bottom.id
    && bottomTrumpDeclaration?.cards?.length
  );
  const bottomHasInferiorDeclaration = Boolean(bottomInferiorDeclaration?.cards?.length);
  const hasCenterTableFeature = Boolean(
    isPublicBottomVisible
    || (ruleIncludesId(selectedRule, 'second_battlefield')
      && displayedSecondBattlefieldCards?.length === 5)
    || (ruleIncludesId(selectedRule, 'divine_weapon') && divineWeapon?.cards?.length > 0)
  );
  const hasTopOpenHand = hasRevealedHand(positions.top);

  return (
    <div className={`game-table ${isSettlementView ? 'settlement-view' : ''} ${hasSurrenderShowdown ? 'has-surrender-showdown' : ''} ${hasCenterTableFeature ? 'has-center-table-feature' : ''} ${hasTopOpenHand ? 'has-top-open-hand' : ''}`}>
      {cardExchange && (
        <div className="card-exchange-status" role="status" aria-live="polite">
          <span className="card-exchange-status-title">{cardExchange.ruleName}</span>
          <span>
            {cardExchange.submittedPlayerIds?.includes(currentPlayer?.id)
              ? `等待其他玩家 · ${cardExchange.submittedPlayerIds.length}/${players.length}`
              : cardExchange.operation === 'discard'
                ? `请选择 ${cardExchange.requiredCards} 张牌暗中弃置`
                : `请选择 ${cardExchange.requiredCards} 张牌交给 ${myExchangeTarget?.name || '目标玩家'}`}
          </span>
        </div>
      )}

      {mainstayAction && (
        <div className="card-exchange-status" role="status" aria-live="polite">
          <span className="card-exchange-status-title">中流砥柱</span>
          <span>
            {mainstayAction.stage === 'decision'
              ? `等待${mainstayActor?.name || '当前玩家'}决定是否发动`
              : mainstayAction.stage === 'give'
                ? `等待${mainstayChooser?.name || '当前玩家'}交出包含全部主牌的5张牌`
                : `等待${mainstayChooser?.name || '队友'}返还5张牌`}
          </span>
        </div>
      )}

      {cardExchangeAnimation && (
        <div
          key={cardExchangeAnimation.key}
          className={`card-exchange-animation-layer ${cardExchangeAnimation.kind === 'planned_economy_draw' ? 'planned-economy-draw-layer' : ''}`}
          aria-label={`${cardExchangeAnimation.ruleName} ${cardExchangeAnimation.kind === 'discard' ? '弃牌' : cardExchangeAnimation.kind === 'planned_economy_draw' ? '摸牌' : '换牌'}动画`}
        >
          <div className="card-exchange-animation-title">
            {cardExchangeAnimation.title || cardExchangeAnimation.ruleName}
          </div>
          {cardExchangeAnimation.kind === 'exchange' && (
            <div className="card-exchange-animation-detail">
              {(cardExchangeAnimation.transfers || []).map(transfer => (
                <span key={`${transfer.fromPlayerId}-${transfer.toPlayerId}`}>
                  {transfer.fromPlayerName || '玩家'}
                  <b>→</b>
                  {transfer.toPlayerName || '玩家'}
                  <em>{transfer.cardsCount || 0}张</em>
                </span>
              ))}
            </div>
          )}
          {(cardExchangeAnimation.transfers || []).flatMap((transfer, transferIndex) => {
            const isPlannedEconomyDraw = cardExchangeAnimation.kind === 'planned_economy_draw';
            const start = isPlannedEconomyDraw
              ? { x: '50%', y: '50%' }
              : exchangeCoordinates[positionByPlayerId[transfer.fromPlayerId]];
            const discardEnds = [
              { x: '49%', y: '49%' },
              { x: '51%', y: '49%' },
              { x: '49%', y: '51%' },
              { x: '51%', y: '51%' }
            ];
            const end = cardExchangeAnimation.kind === 'discard'
              ? discardEnds[transferIndex % discardEnds.length]
              : exchangeCoordinates[positionByPlayerId[transfer.toPlayerId]];
            if (!start || !end) return [];
            const visualCardCount = cardExchangeAnimation.kind === 'whole_hand'
              ? Math.min(7, transfer.cardsCount || 0)
              : isPlannedEconomyDraw
                ? 1
                : (transfer.cardsCount || 2);
            return Array.from({ length: visualCardCount }, (_, cardIndex) => (
              <span
                key={`${transfer.fromPlayerId || 'reserve'}-${transfer.toPlayerId}-${cardIndex}`}
                className="exchange-flying-card"
                style={{
                  '--exchange-start-x': start.x,
                  '--exchange-start-y': start.y,
                  '--exchange-end-x': end.x,
                  '--exchange-end-y': end.y,
                  '--exchange-delay': `${transferIndex * 35 + cardIndex * 90}ms`,
                  '--exchange-tilt': `${cardIndex === 0 ? -7 : 7}deg`,
                  '--exchange-duration': `${cardExchangeAnimation.animationDuration || 1200}ms`
                }}
              />
            ));
          })}
        </div>
      )}

      {privateCardTransferReveal?.cards?.length > 0 && (
        <div
          key={privateCardTransferReveal.key}
          className={`private-card-transfer-reveal ${privateCardTransferReveal.reducedMotion ? 'is-static' : ''}`}
          style={{
            '--private-reveal-delay': `${privateCardTransferReveal.revealDelay || 0}ms`,
            '--private-reveal-duration': `${privateCardTransferReveal.revealDuration || 1500}ms`
          }}
          role="status"
          aria-live="polite"
        >
          <div className="private-card-transfer-heading">
            <strong>{privateCardTransferReveal.ruleName} · 收到的牌</strong>
            <span>来自 {privateCardTransferReveal.fromPlayerName || '其他玩家'}</span>
          </div>
          <Hand
            cards={privateCardTransferReveal.cards}
            disabled
            small
            minimumVisibleWidth={44}
            trumpSuit={trumpSuit}
            trumpRank={trumpRank}
          />
          <div className="private-card-transfer-hint">即将落入你的手牌</div>
        </div>
      )}

      {/* 左上角得分和等级显示 - 始终显示 */}
      <div className="score-panel" style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: '12px 16px',
        borderRadius: '8px',
        border: '2px solid #ffd700',
        zIndex: 100,
        width: '300px'
      }}>
        {/* 队伍等级显示 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '12px',
          paddingBottom: '8px',
          borderBottom: '1px solid rgba(255, 215, 0, 0.3)'
        }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', display: 'block' }}>{teamLabels.myTeamLabel}等级</Text>
            <Text strong style={{ color: '#52c41a', fontSize: '18px' }}>{formatLevel(teamLabels.myTeamLevel)}</Text>
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', display: 'block' }}>{teamLabels.opponentTeamLabel}等级</Text>
            <Text strong style={{ color: '#ff4d4f', fontSize: '18px' }}>{formatLevel(teamLabels.opponentTeamLevel)}</Text>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Text strong style={{ color: '#ffd700', fontSize: '14px' }}>
            {isFocusFigureRule ? '闲家收牌' : '闲家得分'}
          </Text>
        </div>
        <div style={{
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#fff',
          textAlign: 'center',
          marginBottom: '8px'
        }}>
          {isFocusFigureRule || isLostInFogScoringHidden ? (
            <span className="focus-figure-score-hidden">
              {isLostInFogScoringHidden ? '分值终局揭晓' : '实际得分终局揭晓'}
            </span>
          ) : (
            `${attackerScore} 分`
          )}
        </div>
        {!isSettlementView && !isLostInFogScoringHidden && currentRoundPoints > 0
          && !ruleIncludesId(selectedRule, 'second_battlefield') && (
          <div className="mobile-round-points-indicator" role="status" aria-live="polite">
            <span>本轮</span>
            <strong>{currentRoundPoints}</strong>
            <span>分</span>
          </div>
        )}
        {tenSidedAmbush && (
          <div
            className={`ten-sided-ambush-score-counter ${ambushAttackerNetCardCount > 0 ? 'is-negative-score' : ambushAttackerNetCardCount < 0 ? 'is-positive-score' : ''}`}
            aria-label={`伏击点数 ${tenSidedAmbush.rank || '未揭晓'}，闲家净拿 ${ambushAttackerNetCardCount} 张`}
          >
            <span>伏击 <strong>{tenSidedAmbush.rank || '?'}</strong></span>
            <span>
              闲家净拿 <strong>{ambushAttackerNetCardCount > 0 ? '+' : ''}{ambushAttackerNetCardCount}</strong> 张
            </span>
          </div>
        )}
        <div style={{
          height: '100px',
          position: 'relative'
        }}>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', display: 'block', marginBottom: '4px' }}>
            {isLostInFogScoringHidden ? '得分牌:' : `分数牌 (${collectedPointCards.length}):`}
          </Text>
          {isLostInFogScoringHidden ? (
            <Text
              className="focus-figure-score-hidden"
              data-testid="lost-in-fog-score-hidden"
            >
              牌面与分值已隐藏
            </Text>
          ) : collectedPointCards.length > 0 ? (
            <div className="score-card-list">
              {collectedPointCards.map((card, index) => (
                <div key={card.id || index} className="score-card-item">
                  <Card
                    card={getScoringDisplayCard(card)}
                    disabled
                    small
                    trumpSuit={trumpSuit}
                    trumpRank={trumpRank}
                  />
                </div>
              ))}
            </div>
          ) : (
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>暂无</Text>
          )}
        </div>
      </div>

      {/* 上方玩家 */}
      {positions.top && (
        <div className={`position-top ${hasRevealedHand(positions.top) ? 'has-open-hand' : ''}`}>
          {renderPlayerArea(positions.top, 'top')}
          {renderOpenHand(positions.top, 'top')}
          {renderPlayedCardsArea(positions.top, 'top')}
          {renderSecondBattlefieldStagedArea(positions.top, 'top')}
        </div>
      )}

      {/* 中间区域：左、中央、右 */}
      <div className="position-middle">
        {/* 左边玩家 */}
        {positions.left && (
          <div className={`position-left ${hasRevealedHand(positions.left) ? 'has-open-hand' : ''}`}>
            <div className="second-battlefield-side-player">
              {renderPlayerArea(positions.left, 'left')}
              {renderSecondBattlefieldStagedArea(positions.left, 'left')}
            </div>
            {renderOpenHand(positions.left, 'left')}
            {renderPlayedCardsArea(positions.left, 'left')}
          </div>
        )}

        {/* 中央桌面 */}
        <div className={`table-center ${isSettlementView ? 'settlement-table-center' : ''} ${isPublicBottomVisible ? 'has-public-bottom' : ''}`}>
          {!isSettlementView && !isLostInFogScoringHidden && currentRoundPoints > 0
            && !ruleIncludesId(selectedRule, 'second_battlefield') && (
            <div className="round-points-indicator" role="status" aria-live="polite">
              <span className="round-points-label">本轮</span>
              <strong className="round-points-value">{currentRoundPoints}</strong>
              <span className="round-points-unit">分</span>
            </div>
          )}
          {isPublicBottomVisible && (
            <div className="public-bottom-tray" data-testid="public-bottom-tray">
              <div className="public-bottom-heading">
                <strong>昭然若揭 · 明置底牌</strong>
                <span>
                  {ruleRuntimeStatus?.phase === 'drawing' ? '摸牌开始即公开' : '所有玩家随时可见'}
                </span>
              </div>
              <Hand
                cards={publicBottomCards}
                disabled
                small
                minimumVisibleWidth={30}
                trumpSuit={trumpSuit}
                trumpRank={trumpRank}
              />
            </div>
          )}
          {ruleIncludesId(selectedRule, 'second_battlefield') && displayedSecondBattlefieldCards?.length === 5 && (
            <div
              className={`second-battlefield-tray ${secondBattlefield.isFinalStage ? 'is-final-stage' : ''} ${isSettlementView ? 'is-settlement' : ''}`}
              data-testid="second-battlefield-tray"
              data-generation={isHoldingSecondBattlefieldResult && !secondBattlefield.lastResult?.isFinal
                ? Math.max(1, secondBattlefield.generation - 1)
                : secondBattlefield.generation}
            >
              <div className="second-battlefield-heading">
                <div>
                  <strong>
                    第二战场 · {isHoldingSecondBattlefieldResult
                      ? `第${secondBattlefield.lastResult.showdownNumber}场判定`
                      : secondBattlefield.lastResult?.isFinal
                      ? `最终第${secondBattlefield.showdownCount}场`
                      : `第${secondBattlefield.showdownCount + 1}场`}
                  </strong>
                  <span>{isHoldingSecondBattlefieldResult
                    ? `${secondBattlefield.lastResult.winnerPlayerNames.join('、')} · ${secondBattlefield.lastResult.winningCategoryName}`
                    : secondBattlefield.lastResult?.isFinal
                    ? '最终场已由系统判定'
                    : secondBattlefield.isFinalStage
                      ? '残局锁定 · 出完后最终开牌'
                      : '五张公共牌已全部亮出'}</span>
                </div>
              </div>
              <div className="second-battlefield-card-row">
                {displayedSecondBattlefieldCards.map(card => (
                  <Card key={card.id} card={card} disabled small />
                ))}
              </div>
              {!isSettlementView && !isLostInFogScoringHidden && currentRoundPoints > 0 && (
                <div
                  className="second-battlefield-round-points"
                  role="status"
                  aria-live="polite"
                >
                  <span>本轮分数</span>
                  <strong>{currentRoundPoints}</strong>
                  <span>分</span>
                </div>
              )}
              {secondBattlefield.lastResult && (
                <div className="second-battlefield-last-result" role="status">
                  上场：{secondBattlefield.lastResult.winnerPlayerNames.join('、')}
                  · {secondBattlefield.lastResult.winningCategoryName}
                  · {secondBattlefield.lastResult.scoreDelta > 0
                    ? '闲家+5分'
                    : secondBattlefield.lastResult.scoreDelta < 0
                      ? '庄家+5分'
                      : '跨阵营平分'}
                </div>
              )}
            </div>
          )}
          {!isSettlementView && ruleIncludesId(selectedRule, 'divine_weapon') && divineWeapon?.cards?.length > 0 && (
            <div
              className={`divine-weapon-tray ${divineWeapon.usedThisRound ? 'is-spent' : ''} ${canSelectDivineWeapon ? 'is-selectable' : ''}`}
              data-testid="divine-weapon-tray"
            >
              <div className="divine-weapon-tray-heading">
                <strong>本轮神兵</strong>
                <span>{divineWeapon.usedThisRound ? '已发动·轮末两张全换' : canSelectDivineWeapon ? '请选择一张' : '可供转化'}</span>
              </div>
              <div className="divine-weapon-card-row">
                {divineWeapon.cards.map(card => (
                  <div
                    key={card.id}
                    className={`divine-weapon-card-option ${selectedDivineWeaponCardId === card.id ? 'is-selected' : ''} ${divineWeapon.usedCardId === card.id ? 'is-used' : ''} ${divineWeapon.usedThisRound ? 'is-pending-refresh' : ''}`}
                    role={canSelectDivineWeapon ? 'button' : undefined}
                    tabIndex={canSelectDivineWeapon ? 0 : -1}
                    onClick={canSelectDivineWeapon ? () => onDivineWeaponCardClick?.(card.id) : undefined}
                    onKeyDown={canSelectDivineWeapon ? event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onDivineWeaponCardClick?.(card.id);
                      }
                    } : undefined}
                  >
                    <Card
                      card={card}
                      selected={selectedDivineWeaponCardId === card.id}
                      disabled={!canSelectDivineWeapon}
                      small
                      trumpSuit={trumpSuit}
                      trumpRank={trumpRank}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className={`center-content ${isSettlementView ? 'settlement-panel' : ''} ${hasSurrenderShowdown ? 'has-surrender-showdown' : ''} ${!revealedBottomCards?.length ? 'table-tools' : ''}`}>
            {recordOnFileTrackerView && !revealedBottomCards?.length && (
              <RecordOnFileTracker
                recordOnFile={ruleRuntimeStatus?.recordOnFile}
                displayRoundNumber={currentRoundNumber}
                showWhiteJoker={showRecordOnFileWhiteJoker}
                showRoyalJokers={showRecordOnFileRoyalJokers}
              />
            )}
            {/* 底牌展示（优先显示） */}
            {revealedBottomCards && revealedBottomCards.length > 0 ? (
              <div className={isSettlementView ? 'settlement-content' : ''} style={{ textAlign: 'center' }}>
                <Text
                  strong
                  className={isSettlementView ? 'settlement-bottom-title' : ''}
                  style={{ fontSize: '18px', color: 'white', display: 'block', marginBottom: '12px' }}
                >
                  底牌：
                </Text>
                <div className={isSettlementView ? 'settlement-bottom-cards' : ''}>
                  <Hand
                    cards={revealedBottomCards}
                    disabled
                    small
                    anticipateNextCard={!isSettlementView}
                    trumpSuit={bottomScoreResult?.currentGameTrumpSuit || trumpSuit}
                    trumpRank={bottomScoreResult?.currentGameTrumpRank || trumpRank}
                  />
                </div>

                {/* 底牌得分结果 */}
                {bottomScoreResult && (
                  <div className="settlement-bottom-result" style={{
                    marginTop: '16px',
                    padding: '12px 20px',
                    backgroundColor: bottomScoreResult.attackerWonBottom ? 'rgba(82, 196, 26, 0.2)' : 'rgba(255, 215, 0, 0.2)',
                    borderRadius: '8px',
                    border: `2px solid ${bottomScoreResult.attackerWonBottom ? '#52c41a' : '#ffd700'}`
                  }}>
                    <Text strong style={{
                      fontSize: '20px',
                      color: bottomScoreResult.attackerWonBottom ? '#52c41a' : '#ffd700',
                      display: 'block',
                      marginBottom: '8px'
                    }}>
                      {bottomScoreResult.resultText}
                    </Text>
                    {bottomScoreResult.peopleCommune ? (
                      <div className="ten-sided-ambush-bottom-summary people-commune-bottom-summary">
                        <Text style={{ color: 'white', fontSize: '14px' }}>
                          庄家方埋分：{bottomScoreResult.peopleCommune.dealerBuriedPoints} 分　
                          闲家方埋分：{bottomScoreResult.peopleCommune.attackerBuriedPoints} 分
                        </Text>
                        <Text style={{ color: bottomScoreResult.bottomScoreGained >= 0 ? '#95de64' : '#ff8f8f', fontSize: '14px' }}>
                          {bottomScoreResult.attackerWonBottom ? '闲家抄庄家底' : '庄家方抄闲家底'}：
                          {bottomScoreResult.bottomPoints} × {bottomScoreResult.bottomMultiplier}
                        </Text>
                        <Text strong style={{ color: '#fff1a8', fontSize: '15px' }}>
                          闲家分数变化：{bottomScoreResult.bottomScoreGained > 0 ? '+' : ''}{bottomScoreResult.bottomScoreGained} 分
                        </Text>
                      </div>
                    ) : bottomScoreResult.ambushCardCount > 0 ? (
                      <div className="ten-sided-ambush-bottom-summary">
                        <Text style={{ color: 'white', fontSize: '14px' }}>
                          常规底分：{bottomScoreResult.attackerWonBottom
                            ? `${bottomScoreResult.bottomPoints} × ${bottomScoreResult.bottomMultiplier} = ${bottomScoreResult.bottomPoints * bottomScoreResult.bottomMultiplier}`
                            : '0'} 分
                        </Text>
                        <Text style={{ color: bottomScoreResult.ambushScoreDelta > 0 ? '#ffd666' : '#ff8f8f', fontSize: '14px' }}>
                          伏击 {bottomScoreResult.ambushRank} × {bottomScoreResult.ambushCardCount}：闲家{bottomScoreResult.ambushScoreDelta > 0 ? '+' : ''}{bottomScoreResult.ambushScoreDelta} 分
                        </Text>
                        <Text strong style={{ color: '#fff1a8', fontSize: '15px' }}>
                          底牌净变化：{bottomScoreResult.bottomScoreGained > 0 ? '+' : ''}{bottomScoreResult.bottomScoreGained} 分
                        </Text>
                      </div>
                    ) : bottomScoreResult.attackerWonBottom && (
                      <Text style={{ color: 'white', fontSize: '14px' }}>
                        底牌 {bottomScoreResult.bottomPoints} 分 × {bottomScoreResult.bottomMultiplier} 倍 = {bottomScoreResult.bottomScoreGained} 分
                      </Text>
                    )}
                    {bottomScoreResult.focusFigure && (
                      <div className="focus-figure-settlement" data-testid="focus-figure-settlement">
                        <div className="focus-figure-settlement-title">
                          <strong>焦点人物 · 终局揭晓</strong>
                          <span>
                            {bottomScoreResult.focusFigure.teams.map(team => (
                              `${team.side === 'dealer' ? '庄家方' : '闲家方'}：${team.focusPlayerName}`
                            )).join('　')}
                          </span>
                        </div>
                        <div className="focus-figure-player-grid">
                          {bottomScoreResult.focusFigure.players.map(player => (
                            <div
                              key={player.playerId}
                              className={player.isFocus ? 'is-focus' : 'is-not-focus'}
                            >
                              <span>{player.isFocus ? '★ ' : ''}{player.playerName}</span>
                              <strong>
                                {player.capturedPoints} × {player.isFocus ? 2 : 0} = {player.countedPoints}
                              </strong>
                            </div>
                          ))}
                        </div>
                        <div className="focus-figure-score-formula">
                          <span>焦点逐墩 {bottomScoreResult.focusFigure.focusTrickScore} 分</span>
                          <span>正常底牌 {bottomScoreResult.focusFigure.normalBottomScore} 分</span>
                        </div>
                      </div>
                    )}
                    {bottomScoreResult.abruptStop && (
                      <div className="abrupt-stop-settlement" data-testid="abrupt-stop-settlement">
                        <strong>戛然而止 · 庄家余牌</strong>
                        <span>
                          {bottomScoreResult.abruptStop.dealerPlayerName} 剩余牌面分
                          {' '}{bottomScoreResult.abruptStop.dealerRemainingPoints}，
                          闲家获得一半 +{bottomScoreResult.abruptStop.attackerBonus} 分
                        </span>
                        {bottomScoreResult.abruptStop.dealerRemainingCards?.length > 0 && (
                          <Hand
                            cards={bottomScoreResult.abruptStop.dealerRemainingCards}
                            disabled
                            small
                            minimumVisibleWidth={34}
                            trumpSuit={bottomScoreResult.currentGameTrumpSuit || trumpSuit}
                            trumpRank={bottomScoreResult.currentGameTrumpRank || trumpRank}
                          />
                        )}
                      </div>
                    )}
                    <div style={{ marginTop: '8px' }}>
                      <Text strong style={{ color: '#ffd700', fontSize: '16px' }}>
                        闲家总分：{bottomScoreResult.scoreBeforeMistyFog
                          ?? bottomScoreResult.scoreBeforeLingeringDiscard
                          ?? bottomScoreResult.totalScore} 分
                      </Text>
                    </div>
                  </div>
                )}

                {hasSurrenderShowdown && (
                  <SurrenderShowdown
                    hands={surrenderRevealedHands}
                    currentPlayerId={currentPlayer?.id}
                    trumpSuit={bottomScoreResult?.currentGameTrumpSuit || trumpSuit}
                    trumpRank={bottomScoreResult?.currentGameTrumpRank || trumpRank}
                  />
                )}

                {/* 迷雾牌在逐墩分和底牌分之后才公开并补分。 */}
                {bottomScoreResult?.mistyFogCards?.length > 0 && (
                  <div className="settlement-misty-fog">
                    <div className="settlement-misty-fog-summary">
                      <Text strong>迷雾牌 · 终局公开</Text>
                      <Text>牌面 {bottomScoreResult.mistyFogPoints} 分</Text>
                      <Text strong>闲家补 +{bottomScoreResult.mistyFogBonus} 分</Text>
                      <Text strong>最终 {bottomScoreResult.totalScore} 分</Text>
                    </div>
                    <div className="settlement-misty-fog-cards">
                      <Hand
                        cards={bottomScoreResult.mistyFogCards}
                        disabled
                        small
                        minimumVisibleWidth={24}
                        trumpSuit={bottomScoreResult.currentGameTrumpSuit || trumpSuit}
                        trumpRank={bottomScoreResult.currentGameTrumpRank || trumpRank}
                      />
                    </div>
                  </div>
                )}

                {/* 庄家方暗弃的分牌只在终局公开。 */}
                {bottomScoreResult?.lingeringDiscardCards?.length > 0 && (
                  <div className="settlement-misty-fog settlement-lingering-discard">
                    <div className="settlement-misty-fog-summary">
                      <Text strong>弃掷逦迤 · 分牌公开</Text>
                      <Text>牌面 {bottomScoreResult.lingeringDiscardPoints} 分</Text>
                      <Text strong>闲家补 +{bottomScoreResult.lingeringDiscardBonus} 分</Text>
                      <Text strong>最终 {bottomScoreResult.totalScore} 分</Text>
                    </div>
                    <div className="settlement-misty-fog-cards">
                      <Hand
                        cards={bottomScoreResult.lingeringDiscardCards}
                        disabled
                        small
                        minimumVisibleWidth={24}
                        trumpSuit={bottomScoreResult.currentGameTrumpSuit || trumpSuit}
                        trumpRank={bottomScoreResult.currentGameTrumpRank || trumpRank}
                      />
                    </div>
                  </div>
                )}

                {/* 升级结果 */}
                {upgradeResult && (
                  <div className="settlement-upgrade-result" style={{
                    marginTop: '16px',
                    padding: '12px 20px',
                    backgroundColor: upgradeResult.attackerWon ? 'rgba(82, 196, 26, 0.2)' : 'rgba(255, 77, 79, 0.2)',
                    borderRadius: '8px',
                    border: `2px solid ${upgradeResult.attackerWon ? '#52c41a' : '#ff4d4f'}`
                  }}>
                    <Text strong style={{
                      fontSize: '24px',
                      color: upgradeResult.attackerWon ? '#52c41a' : '#ff4d4f',
                      display: 'block',
                      marginBottom: '12px',
                      textAlign: 'center'
                    }}>
                      {upgradeResult.attackerWon ? '🎉 闲家获胜！' : '👑 庄家获胜！'}
                    </Text>

                    <div className="settlement-team-levels" style={{
                      display: 'flex',
                      justifyContent: 'space-around',
                      marginBottom: '12px',
                      paddingBottom: '12px',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.2)'
                    }}>
                      <div style={{ textAlign: 'center' }}>
                        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', display: 'block' }}>庄家队伍</Text>
                        <Text style={{ color: 'white', fontSize: '16px' }}>
                          {formatLevel(upgradeResult.oldDealerLevel)} → <Text strong style={{ color: '#ffd700', fontSize: '18px' }}>{formatLevel(upgradeResult.newDealerLevel)}</Text>
                        </Text>
                        {upgradeResult.dealerLevelUp > 0 && (
                          <Text style={{ color: '#52c41a', fontSize: '14px', display: 'block' }}>
                            ↑ 升{upgradeResult.dealerLevelUp}级
                          </Text>
                        )}
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', display: 'block' }}>闲家队伍</Text>
                        <Text style={{ color: 'white', fontSize: '16px' }}>
                          {formatLevel(upgradeResult.oldAttackerLevel)} → <Text strong style={{ color: '#ffd700', fontSize: '18px' }}>{formatLevel(upgradeResult.newAttackerLevel)}</Text>
                        </Text>
                        {upgradeResult.attackerLevelUp > 0 && (
                          <Text style={{ color: '#52c41a', fontSize: '14px', display: 'block' }}>
                            ↑ 升{upgradeResult.attackerLevelUp}级
                          </Text>
                        )}
                      </div>
                    </div>

                    <div className="settlement-next-dealer" style={{ textAlign: 'center' }}>
                      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                        {upgradeResult.dealerContinues ? '势如破竹 · 庄家连庄' : '下一局庄家'}
                      </Text>
                      <Text strong style={{ color: '#ffd700', fontSize: '16px' }}>
                        {upgradeResult.nextDealerName} (等级 {formatLevel(upgradeResult.nextDealerLevel)})
                      </Text>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="table-status-stack" style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
                {/* 主牌显示 */}
                <div className="table-trump-summary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Text strong style={{ fontSize: '16px', color: '#fff' }}>主牌：</Text>
                  {oneCountryTwoSystems ? (
                    <div
                      className="one-country-trump-summary"
                      data-resolved={oneCountryResolution ? 'true' : 'false'}
                      style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}
                    >
                      {oneCountryTrumpRows.map(row => (
                        <Text
                          key={row.teamIndex}
                          style={{
                            fontSize: '17px',
                            fontWeight: 'bold',
                            color: !row.suit || row.suit === 'no_trump' || row.suit === 'joker'
                              ? '#fff'
                              : getSuitColor(row.suit)
                          }}
                        >
                          {row.label} {row.suit === 'no_trump' || row.suit === 'joker'
                            ? '无主'
                            : row.suit
                              ? `${getSuitSymbol(row.suit)} ${trumpRank || ''}`
                              : '未亮'}
                        </Text>
                      ))}
                    </div>
                  ) : (
                    <Text
                      style={{
                        fontSize: '24px',
                        fontWeight: 'bold',
                        color: !trumpSuit || trumpSuit === 'no_trump' ? '#fff' : getSuitColor(trumpSuit)
                      }}
                    >
                      {!trumpSuit || trumpSuit === 'no_trump' ? '无主' : getSuitSymbol(trumpSuit)}{trumpRank ? ` ${trumpRank}` : ''}
                    </Text>
                  )}
                </div>
                {ruleIncludesId(selectedRule, 'three_six_nine_grades') && (
                  <div className="three-six-nine-summary">
                    <Text strong style={{ color: '#f3d6c8' }}>劣牌：</Text>
                    <Text
                      strong
                      style={{
                        color: currentInferiorDeclaration?.suit
                          ? getSuitColor(currentInferiorDeclaration.suit)
                          : 'rgba(255,255,255,0.78)'
                      }}
                    >
                      {currentInferiorDeclaration?.suit
                        ? `${getSuitSymbol(currentInferiorDeclaration.suit)} ${trumpRank || ''}`
                        : '无劣花色'}
                    </Text>
                  </div>
                )}

                {/* 庄家倒计时显示 */}
                {dealerCountdown !== null && dealerCountdown > 0 && (
                  <div className="dealer-countdown-panel" style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: 'rgba(255, 215, 0, 0.2)',
                    padding: '16px 24px',
                    borderRadius: '12px',
                    border: '2px solid #ffd700',
                    boxShadow: '0 4px 12px rgba(255, 215, 0, 0.3)'
                  }}>
                    <div className="dealer-countdown-main" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span className="dealer-countdown-icon" style={{ fontSize: '32px' }}>⏰</span>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <Text strong style={{ fontSize: '14px', color: '#ffd700' }}>指定庄家倒计时</Text>
                        <Text className="dealer-countdown-value" style={{
                          fontSize: '36px',
                          fontWeight: 'bold',
                          color: dealerCountdown <= 3 ? '#ff4757' : '#ffd700',
                          textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                        }}>
                          {dealerCountdown}
                        </Text>
                      </div>
                    </div>
                    <Text className="dealer-countdown-hint" style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.8)' }}>
                      {currentTrumpDeclaration ? '有人亮主，倒计时已重置' : '无人亮主将随机指定'}
                    </Text>
                  </div>
                )}

                {/* 规则显示 */}
                <div className="table-rule-summary" style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  padding: '12px 20px',
                  borderRadius: '8px',
                  minWidth: '250px',
                  maxWidth: '400px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Text strong style={{ fontSize: '16px', color: 'white' }}>规则：</Text>
                    {isRuleSelectionPending && onSelectRule && (
                      <Button size="small" type="primary" onClick={onSelectRule}>
                        {ruleRuntimeStatus?.ruleSelectionMode === 'double_happiness'
                          ? '查看三选二'
                          : '二选一'}
                      </Button>
                    )}
                  </div>
                  {selectedRule ? (
                    <div className="table-rule-body" style={{ textAlign: 'center', width: '100%' }}>
                      <Text strong className="table-rule-title" style={{ fontSize: '18px', color: '#ffd700', display: 'block', marginBottom: '6px' }}>
                        {selectedRule.name}
                      </Text>
                      {Array.isArray(selectedRule.rules) && (
                        <div className="double-happiness-selected-rules">
                          {selectedRule.rules.map(rule => (
                            <span key={rule.id}>{rule.name}</span>
                          ))}
                        </div>
                      )}
                      {ruleIncludesId(selectedRule, 'route_swing') && ruleRuntimeStatus?.phase === 'playing' && (
                        <div
                          key={`route-${ruleRuntimeStatus?.turnDirection || 'counter-clockwise'}`}
                          className="rule-runtime-status"
                          data-testid="route-direction-status"
                          data-direction={ruleRuntimeStatus?.turnDirection || 'counter-clockwise'}
                        >
                          <span className="rule-runtime-status-icon">
                            {ruleRuntimeStatus?.turnDirection === 'clockwise' ? '↻' : '↺'}
                          </span>
                          当前：{ruleRuntimeStatus?.turnDirection === 'clockwise' ? '顺时针' : '逆时针'}
                        </div>
                      )}
                      {ruleIncludesId(selectedRule, 'day_night_rotation') && ruleRuntimeStatus?.phase === 'playing' && (
                        <div
                          key={`day-night-${ruleRuntimeStatus?.currentRound || 1}-${ruleRuntimeStatus?.dayNightHighestRank || ''}`}
                          className="rule-runtime-status"
                          data-testid="day-night-rank-status"
                          data-round={ruleRuntimeStatus?.currentRound || 1}
                          data-highest-rank={ruleRuntimeStatus?.dayNightHighestRank || ''}
                        >
                          <span className="rule-runtime-status-icon">☯</span>
                          第{Math.max(1, ruleRuntimeStatus?.currentRound || 1)}轮 · 当前最大点数：
                          <strong>{ruleRuntimeStatus?.dayNightHighestRank || '—'}</strong>
                        </div>
                      )}
                      {ruleIncludesId(selectedRule, 'encircle_three_missing_one') && encircleThreeMissingOne && (
                        <div className="rule-runtime-status" data-testid="encircle-three-missing-one-status">
                          <span className="rule-runtime-status-icon">围</span>
                          <strong>
                            记录：{encircleThreeMissingOne.seenSuits?.length
                              ? encircleThreeMissingOne.seenSuits.map(getSuitSymbolExtended).join(' ')
                              : '—'} ({encircleThreeMissingOne.seenSuits?.length || 0}/3)
                          </strong>
                        </div>
                      )}
                      {ruleIncludesId(selectedRule, 'waiting_rabbit') && waitingRabbit && (
                        <div className="waiting-rabbit-records" data-testid="waiting-rabbit-records">
                          <div className="waiting-rabbit-records-heading">
                            <span aria-hidden="true">兔</span>
                            <strong>行为记录</strong>
                          </div>
                          <div className="waiting-rabbit-records-list">
                            {(waitingRabbit.behaviorRecords || []).length > 0 ? (
                              waitingRabbit.behaviorRecords.map(record => (
                                <div
                                  className={`waiting-rabbit-record is-${record.type}`}
                                  key={record.id || record.sequence}
                                  data-record-type={record.type}
                                >
                                  <small>{record.type === 'target_locked' ? '暗选' : `第${record.round}轮`}</small>
                                  <span>{getWaitingRabbitRecordText(record)}</span>
                                </div>
                              ))
                            ) : (
                              <div className="waiting-rabbit-record is-empty">
                                <span>等待四家暗选目标牌</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {ruleIncludesId(selectedRule, 'strength_compensation') && ruleRuntimeStatus?.strengthCompensation && (
                        <div
                          key={`strength-compensation-${ruleRuntimeStatus.strengthCompensation.round}`}
                          className="rule-runtime-status strength-compensation-status"
                          data-testid="strength-compensation-status"
                          data-round={ruleRuntimeStatus.strengthCompensation.round}
                        >
                          <div className="strength-compensation-heading">
                            第{ruleRuntimeStatus.strengthCompensation.round}轮
                          </div>
                          <div className="strength-compensation-lanes">
                            <div className="strength-compensation-lane is-plus">
                              <span className="strength-compensation-delta">+1</span>
                              <span>{ruleRuntimeStatus.strengthCompensation.plusSeatNumber}号位</span>
                              <strong title={players.find(player => player.id === ruleRuntimeStatus.strengthCompensation.plusPlayerId)?.name || ''}>
                                {players.find(player => player.id === ruleRuntimeStatus.strengthCompensation.plusPlayerId)?.name || '未知玩家'}
                              </strong>
                            </div>
                            <div className="strength-compensation-lane is-minus">
                              <span className="strength-compensation-delta">−1</span>
                              <span>{ruleRuntimeStatus.strengthCompensation.minusSeatNumber}号位</span>
                              <strong title={players.find(player => player.id === ruleRuntimeStatus.strengthCompensation.minusPlayerId)?.name || ''}>
                                {players.find(player => player.id === ruleRuntimeStatus.strengthCompensation.minusPlayerId)?.name || '未知玩家'}
                              </strong>
                            </div>
                          </div>
                        </div>
                      )}
                      {ruleIncludesId(selectedRule, 'odd_even_scoring') && ruleRuntimeStatus?.phase === 'playing' && (
                        <div
                          key={`odd-even-${currentRoundNumber}`}
                          className={`rule-runtime-status odd-even-round-status ${oddEvenRoundMultiplier === 2 ? 'is-even' : 'is-odd'}`}
                          data-testid="odd-even-round-status"
                          data-round={currentRoundNumber}
                          data-parity={oddEvenRoundMultiplier === 2 ? 'even' : 'odd'}
                          data-multiplier={oddEvenRoundMultiplier}
                        >
                          <span className="rule-runtime-status-icon">
                            {oddEvenRoundMultiplier === 2 ? '双' : '零'}
                          </span>
                          第{currentRoundNumber}轮 · {oddEvenRoundMultiplier === 2 ? '偶数轮' : '奇数轮'}
                          <strong>{oddEvenRoundMultiplier === 2 ? '本轮双倍' : '本轮0分'}</strong>
                        </div>
                      )}
                      {ruleIncludesId(selectedRule, 'candle_to_dawn') && candleToDawn && (
                        <div
                          className={`candle-to-dawn-status ${displayedCandleLit ? 'is-lit' : 'is-unlit'} ${candleToDawn.isSelectionPending ? 'is-pending' : ''}`}
                          data-testid="candle-to-dawn-status"
                          data-round={displayedCandleRoundNumber}
                          data-candle-state={candleToDawn.isSelectionPending
                            ? 'pending'
                            : displayedCandleLit ? 'lit' : 'unlit'}
                        >
                          <span className="candle-to-dawn-visual" aria-hidden="true">
                            <i className="candle-flame" />
                            <i className="candle-wick" />
                            <i className="candle-body" />
                          </span>
                          <span className="candle-to-dawn-copy">
                            <strong>
                              {candleToDawn.isSelectionPending
                                ? '等待选择初始烛态'
                                : `第${displayedCandleRoundNumber}轮 · 烛已${displayedCandleLit ? '点燃' : '熄灭'}`}
                            </strong>
                            <small>
                              {candleToDawn.isSelectionPending
                                ? '确定后才能开始第1轮'
                                : displayedCandleLit
                                  ? '红色分牌 +5 · 黑色分牌 −5'
                                  : '黑色分牌 +5 · 红色分牌 −5'}
                            </small>
                            <small>小王黑 · 大王红</small>
                          </span>
                        </div>
                      )}
                      {ruleIncludesId(selectedRule, 'cultural_revolution') && ruleRuntimeStatus?.culturalRevolution && (
                        <div
                          className={`cultural-revolution-status ${ruleRuntimeStatus.culturalRevolution.active ? 'is-active' : 'is-idle'}`}
                          data-testid="cultural-revolution-status"
                          data-active={ruleRuntimeStatus.culturalRevolution.active ? 'true' : 'false'}
                        >
                          {ruleRuntimeStatus.culturalRevolution.declaration ? (
                            <>
                              <div className="cultural-revolution-status-heading">
                                <span>革</span>
                                <strong>
                                  第{ruleRuntimeStatus.culturalRevolution.declaration.activatedRound}–
                                  {ruleRuntimeStatus.culturalRevolution.declaration.expiresAfterRound}轮
                                </strong>
                              </div>
                              <div className="cultural-revolution-status-main">
                                {ruleRuntimeStatus.culturalRevolution.declaration.declarationType === 'suit'
                                  ? '革花色'
                                  : '革点数'}
                                <strong>
                                  {ruleRuntimeStatus.culturalRevolution.declaration.declarationType === 'suit'
                                    ? getSuitSymbolExtended(ruleRuntimeStatus.culturalRevolution.declaration.value)
                                    : ruleRuntimeStatus.culturalRevolution.declaration.value}
                                </strong>
                              </div>
                              <small>
                                原主：
                                {getSuitSymbolExtended(ruleRuntimeStatus.culturalRevolution.baseTrumpSuit)}
                                {' '}{ruleRuntimeStatus.culturalRevolution.baseTrumpRank || '—'}；被替换项暂为副牌
                              </small>
                            </>
                          ) : (
                            <>
                              <div className="cultural-revolution-status-heading">
                                <span>革</span>
                                <strong>尚未发动</strong>
                              </div>
                              <small>一号位可选择革花色或革点数</small>
                            </>
                          )}
                        </div>
                      )}
                      {ruleIncludesId(selectedRule, 'three_tigers') && (
                        <div
                          className={`three-tigers-status ${displayedThreeTigers?.triggeredSuit ? 'is-triggered' : 'is-waiting'}`}
                          data-testid="three-tigers-status"
                          data-round={displayedThreeTigers?.round || currentRoundNumber}
                          data-triggered-suit={displayedThreeTigers?.triggeredSuit || ''}
                        >
                          <div className="three-tigers-status-heading">
                            <span>虎</span>
                            <strong>第{displayedThreeTigers?.round || currentRoundNumber}轮</strong>
                          </div>
                          {displayedThreeTigers?.triggeredSuit ? (
                            <>
                              <div className="three-tigers-status-main">
                                <strong>{getSuitSymbolExtended(displayedThreeTigers.triggeredSuit)}</strong>
                                已成虎
                              </div>
                              <small>
                                {(displayedThreeTigers.contributingPlayerIds || []).length}人同花色 · 视为主牌，牌面−4
                              </small>
                            </>
                          ) : (
                            <>
                              <div className="three-tigers-status-main">
                                <span>待成虎</span>
                                {threeTigersProgress?.[1] > 0 && (
                                  <strong>
                                    {getSuitSymbolExtended(threeTigersProgress[0])} {threeTigersProgress[1]}/3
                                  </strong>
                                )}
                              </div>
                              <small>
                                {threeTigersProgress?.[1] > 0
                                  ? '同花色整手再累计至三人即刻转换'
                                  : '等待本轮同花色整手出牌'}
                              </small>
                            </>
                          )}
                        </div>
                      )}
                      {ruleIncludesId(selectedRule, 'invite_into_urn') && (
                        <div className="rule-runtime-status" data-testid="invite-into-urn-status">
                          <span className="rule-runtime-status-icon">瓮</span>
                          {displayedInviteDeclarations.length > 0 ? (
                            <span>
                              {displayedInviteDeclarations[0].targetPlayerName} · {' '}
                              <strong>
                                {displayedInviteDeclarations[0].rank === 'small_joker'
                                  ? '小王'
                                  : displayedInviteDeclarations[0].rank === 'big_joker'
                                    ? '大王'
                                    : `${displayedInviteDeclarations[0].rank}${getSuitSymbolExtended(displayedInviteDeclarations[0].suit)}`}
                              </strong>
                              {displayedInviteDeclarations[0].triggered === true
                                ? ' · 已命中，扣5分'
                                : displayedInviteDeclarations[0].triggered === false
                                  ? ' · 未命中'
                                  : ' · 本轮监视中'}
                            </span>
                          ) : (
                            <span>一号位可指定玩家与牌面</span>
                          )}
                        </div>
                      )}
                      {ruleIncludesId(selectedRule, 'old_horse_still_has_strength') && oldHorse && (
                        <div className="rule-runtime-status" data-testid="old-horse-status">
                          <span className="rule-runtime-status-icon">骥</span>
                          <span>
                            已获牌权 {oldHorse.rightHolderPlayerIds?.length || 0}/{players.length}
                          </span>
                          <strong>
                            {oldHorse.protectedPlayerId
                              ? `${players.find(player => player.id === oldHorse.protectedPlayerId)?.name || '目标玩家'}下次首发绝大`
                              : oldHorse.lastAbsolutePlay
                                ? '绝大已发动'
                                : '等待最后一人'}
                          </strong>
                        </div>
                      )}
                      {ruleIncludesId(selectedRule, 'trump_wins') && (
                        <div className="rule-runtime-status" data-testid="trump-wins-status">
                          <span className="rule-runtime-status-icon">T</span>
                          {trumpWins?.lastResult?.leaderPlayerId ? (
                            <span>
                              上轮：{trumpWins.lastResult.leaderPlayerName} {' '}
                              <strong>{trumpWins.lastResult.highestPoints}分获权</strong>
                            </span>
                          ) : (
                            <span>本轮按各家出牌分值争夺牌权</span>
                          )}
                        </div>
                      )}
                      {ruleIncludesId(selectedRule, 'straw_boat_borrowing_arrows') && (
                        <div className="rule-runtime-status" data-testid="straw-boat-status">
                          <span className="rule-runtime-status-icon">箭</span>
                          {strawBoatBorrowingArrows?.pending ? (
                            <span>
                              {strawBoatBorrowingArrows.pending.playerName} 正在决定 · {' '}
                              <strong>
                                可取 {getPublicCardLabel(strawBoatBorrowingArrows.pending.borrowedCard)}
                              </strong>
                            </span>
                          ) : strawBoatBorrowingArrows?.lastResult?.accepted ? (
                            <span>
                              {strawBoatBorrowingArrows.lastResult.playerName}：
                              <strong>
                                {getPublicCardLabel(strawBoatBorrowingArrows.lastResult.discardedCard)}
                                {' → '}
                                {getPublicCardLabel(strawBoatBorrowingArrows.lastResult.borrowedCard)}
                              </strong>
                            </span>
                          ) : strawBoatBorrowingArrows?.lastResult ? (
                            <span>{strawBoatBorrowingArrows.lastResult.playerName} 上轮放弃发动</span>
                          ) : (
                            <span>首置至少10分失守时，可公开弃牌取箭</span>
                          )}
                        </div>
                      )}
                      {ruleIncludesId(selectedRule, 'bush_gate') && (
                        <div className="rule-runtime-status" data-testid="bush-gate-status">
                          <span className="rule-runtime-status-icon">门</span>
                          {bushGate?.restriction ? (
                            <span>
                              {bushGate.restriction.leaderPlayerName} 重新首发中 · 禁用 {' '}
                              <strong>
                                {(bushGate.restriction.returnedCards || [])
                                  .map(getPublicCardLabel)
                                  .join('、')}
                              </strong>
                            </span>
                          ) : bushGate?.lastResult ? (
                            <span>
                              {bushGate.lastResult.activatorPlayerName} 令 {' '}
                              {bushGate.lastResult.leaderPlayerName} 收回重出
                              <strong>{bushGate.lastResult.replayCompleted ? ' · 已完成' : ''}</strong>
                            </span>
                          ) : (
                            <span>二号位可令一号位收回首发并改出其他牌</span>
                          )}
                        </div>
                      )}
                      {ruleIncludesId(selectedRule, 'ten_sided_ambush') && tenSidedAmbush && (
                        <div className={`ten-sided-ambush-status ${tenSidedAmbush.isRevealed ? 'is-revealed' : ''}`}>
                          <span className="ten-sided-ambush-status-label">
                            {tenSidedAmbush.isSelectionPending
                              ? '布置中'
                              : tenSidedAmbush.rank
                                ? '伏击点数'
                                : '伏兵未现'}
                          </span>
                          {tenSidedAmbush.rank ? (
                            <strong>{tenSidedAmbush.rank}</strong>
                          ) : (
                            <span className="ten-sided-ambush-hidden-rank">?</span>
                          )}
                          <span className="ten-sided-ambush-status-note">
                            {tenSidedAmbush.isSelectionPending
                              ? '等待庄家队友暗选'
                              : tenSidedAmbush.isPrivate
                                ? '仅你可见'
                                : tenSidedAmbush.isRevealed
                                  ? '已向全场揭晓'
                                  : '首次出现时揭晓'}
                          </span>
                        </div>
                      )}
                      {ruleIncludesId(selectedRule, 'three_powers') && threePowers && (
                        <div className="three-powers-status" data-testid="three-powers-status">
                          <span className="three-powers-status-title">重载分牌</span>
                          <div className="three-powers-grid">
                            {(threePowers.slots || []).map(slot => (
                              <div
                                className={`three-powers-slot ${slot.isRevealed ? 'is-revealed' : ''} ${slot.isPrivate ? 'is-private' : ''}`}
                                key={slot.sourceRank}
                                data-source-rank={slot.sourceRank}
                              >
                                <span>{slot.sourceRank}</span>
                                <strong>{slot.rank || '?'}</strong>
                                <small>
                                  {slot.isPrivate
                                    ? '仅你可见'
                                    : slot.isRevealed
                                      ? `${slot.pointValue}分`
                                      : '待揭晓'}
                                </small>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {ruleIncludesId(selectedRule, 'gentleman_promise') && ruleRuntimeStatus?.gentlemanPromise && (
                        <div className="gentleman-promise-status" data-testid="gentleman-promise-status">
                          <span className="gentleman-promise-status-title">最短有效花色</span>
                          <div className="gentleman-promise-status-grid">
                            {players.map(player => {
                              const declaration = ruleRuntimeStatus.gentlemanPromise
                                ?.declarationsByPlayerId?.[player.id];
                              const isPending = ruleRuntimeStatus.gentlemanPromise
                                ?.pendingPlayerIds?.includes(player.id);
                              return (
                                <div className={isPending ? 'is-pending' : ''} key={player.id}>
                                  <span title={player.name}>{player.name}</span>
                                  <strong>{declaration ? getSuitSymbolExtended(declaration) : '…'}</strong>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {ruleIncludesId(selectedRule, 'hidden_dragon_in_abyss') && ruleRuntimeStatus?.hiddenDragon && (
                        <div
                          className="gentleman-promise-status hidden-dragon-status"
                          data-testid="hidden-dragon-status"
                        >
                          <span className="gentleman-promise-status-title">潜龙点数</span>
                          <div className="gentleman-promise-status-grid">
                            {players.map(player => {
                              const declaration = ruleRuntimeStatus.hiddenDragon
                                ?.declarationsByPlayerId?.[player.id];
                              const isPending = ruleRuntimeStatus.hiddenDragon
                                ?.pendingPlayerIds?.includes(player.id);
                              const hasPlayedDeclaredRank = ruleRuntimeStatus.hiddenDragon
                                ?.playedDeclaredRankByPlayerId?.[player.id];
                              const result = ruleRuntimeStatus.hiddenDragon
                                ?.results?.find(item => item.playerId === player.id);
                              return (
                                <div
                                  className={isPending ? 'is-pending' : ''}
                                  key={player.id}
                                >
                                  <span title={player.name}>{player.name}</span>
                                  <strong>{declaration || '…'}</strong>
                                  <small
                                    className={
                                      result
                                        ? result.success ? 'score-success' : 'score-zero'
                                        : hasPlayedDeclaredRank ? 'has-played' : 'not-played'
                                    }
                                  >
                                    {isPending
                                      ? '待声明'
                                      : result
                                        ? result.success ? '+10' : '0'
                                        : hasPlayedDeclaredRank ? '已打出' : '未打出'}
                                  </small>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {ruleIncludesId(selectedRule, 'antinomy') && ruleRuntimeStatus?.antinomy && (
                        <div
                          className="gentleman-promise-status antinomy-status"
                          data-testid="antinomy-status"
                        >
                          <span className="gentleman-promise-status-title">二律背反声明</span>
                          <div className="gentleman-promise-status-grid">
                            {players.map(player => {
                              const declaration = ruleRuntimeStatus.antinomy
                                ?.declarationsByPlayerId?.[player.id];
                              const isPending = ruleRuntimeStatus.antinomy
                                ?.pendingPlayerIds?.includes(player.id);
                              return (
                                <div
                                  className={`${isPending ? 'is-pending' : ''} ${declaration?.effective ? 'is-effective' : 'is-duplicated'}`}
                                  key={player.id}
                                >
                                  <span title={player.name}>{player.name}</span>
                                  <strong>
                                    {declaration
                                      ? `${getSuitSymbolExtended(declaration.suit)}${declaration.rank}`
                                      : '…'}
                                  </strong>
                                  <small>
                                    {isPending
                                      ? declaration ? '重选中' : '选择中'
                                      : declaration?.effective
                                        ? '拆对生效'
                                        : declaration ? '重复·不拆对' : '待声明'}
                                  </small>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {destroyDykeDisplayState && (
                        <div
                          className={`destroy-dyke-status is-${destroyDykeDisplayState.tone}`}
                          data-testid="destroy-dyke-status"
                        >
                          <div className="destroy-dyke-status-heading">
                            <span className="destroy-dyke-status-mark" aria-hidden="true">堤</span>
                            <strong className="destroy-dyke-status-title">毁堤淹田</strong>
                            <span className="destroy-dyke-status-badge">
                              {destroyDykeDisplayState.badge}
                            </span>
                            {destroyDykeDisplayState.value ? (
                              <>
                                <strong className="destroy-dyke-status-value">
                                  {destroyDykeDisplayState.value}
                                </strong>
                                <span className="destroy-dyke-status-detail">
                                  {destroyDykeDisplayState.detail}
                                </span>
                              </>
                            ) : (
                              <span className="destroy-dyke-status-detail">
                                {destroyDykeDisplayState.detail}
                              </span>
                            )}
                          </div>
                          {destroyDykeDisplayState.progress !== null && (
                            <div
                              className="destroy-dyke-status-progress"
                              role="progressbar"
                              aria-label="毁堤淹田事发进度"
                              aria-valuemin="0"
                              aria-valuemax="20"
                              aria-valuenow={Math.round(destroyDykeDisplayState.progress / 5)}
                            >
                              <i style={{ width: `${destroyDykeDisplayState.progress}%` }} />
                            </div>
                          )}
                        </div>
                      )}
                      {ruleIncludesId(selectedRule, 'administrative_review') && ruleRuntimeStatus?.administrativeReview && (
                        <div
                          className="gentleman-promise-status administrative-review-status"
                          data-testid="administrative-review-status"
                        >
                          <span className="gentleman-promise-status-title">行政审查</span>
                          <div className="administrative-review-status-grid">
                            <div>
                              <span>
                                {players.find(player => (
                                  player.id === ruleRuntimeStatus.administrativeReview.suitSelectorPlayerId
                                ))?.name || '庄家下家'} · 副花色
                              </span>
                              <strong>
                                {ruleRuntimeStatus.administrativeReview.suit
                                  ? getSuitSymbolExtended(ruleRuntimeStatus.administrativeReview.suit)
                                  : '…'}
                              </strong>
                              <small className={ruleRuntimeStatus.administrativeReview.suitMatched ? 'is-matched' : ''}>
                                {ruleRuntimeStatus.administrativeReview.suitMatched ? '已满足' : '未满足'}
                              </small>
                            </div>
                            <div>
                              <span>
                                {players.find(player => (
                                  player.id === ruleRuntimeStatus.administrativeReview.rankSelectorPlayerId
                                ))?.name || '庄家上家'} · 点数
                              </span>
                              <strong>{ruleRuntimeStatus.administrativeReview.rank || '…'}</strong>
                              <small className={ruleRuntimeStatus.administrativeReview.rankMatched ? 'is-matched' : ''}>
                                {ruleRuntimeStatus.administrativeReview.rankMatched ? '已满足' : '未满足'}
                              </small>
                            </div>
                          </div>
                          <div className="administrative-review-bottom-state">
                            {ruleRuntimeStatus.administrativeReview.isBuried
                              ? '底牌已埋 · 牌局继续'
                              : ruleRuntimeStatus.administrativeReview.isBottomReleased
                                ? '条件满足 · 庄家正在埋底'
                                : '12张底牌封存 · 庄家不可查看'}
                          </div>
                        </div>
                      )}
                      {ruleIncludesId(selectedRule, 'political_review') && ruleRuntimeStatus?.politicalReview && (
                        <div
                          className="gentleman-promise-status political-review-status"
                          data-testid="political-review-status"
                        >
                          <span className="gentleman-promise-status-title">政治审查</span>
                          <div className="political-review-status-grid">
                            {players.map(player => {
                              const used = ruleRuntimeStatus.politicalReview.usedPlayerIds?.includes(player.id);
                              return (
                                <div key={player.id}>
                                  <span>{player.name}</span>
                                  <small className={used ? 'is-used' : 'is-available'}>
                                    {used ? '已使用' : '未使用'}
                                  </small>
                                </div>
                              );
                            })}
                          </div>
                          {ruleRuntimeStatus.politicalReview.pending && (
                            <div className="political-review-pending">
                              {ruleRuntimeStatus.politicalReview.pending.reviewerPlayerName}
                              正在审查
                              {ruleRuntimeStatus.politicalReview.pending.teammatePlayerName}：
                              {ruleRuntimeStatus.politicalReview.pending.cards.map(card => (
                                card.suit === 'joker'
                                  ? (card.rank === 'big_joker' ? '大王' : '小王')
                                  : `${getSuitSymbolExtended(card.suit)}${card.rank}`
                              )).join('、')}
                            </div>
                          )}
                        </div>
                      )}
                      {ruleIncludesId(selectedRule, 'repeated_exhaustion') && ruleRuntimeStatus?.repeatedExhaustion && (
                        <div
                          className="rule-runtime-status repeated-exhaustion-status"
                          data-testid="repeated-exhaustion-status"
                        >
                          <span className="rule-runtime-status-icon">衰</span>
                          <span>
                            {players.find(player => player.id === ruleRuntimeStatus.repeatedExhaustion.playerId)?.name || '当前赢家'}
                            连续 {ruleRuntimeStatus.repeatedExhaustion.streak} 轮
                          </span>
                          <strong>
                            {ruleRuntimeStatus.repeatedExhaustion.streak >= 2
                              ? `再赢扣${Math.max(1, ruleRuntimeStatus.repeatedExhaustion.streak - 1) * 5}分`
                              : '尚未受罚'}
                          </strong>
                        </div>
                      )}
                      {ruleIncludesId(selectedRule, 'planned_economy') && ruleRuntimeStatus?.plannedEconomy && (
                        <div
                          className="rule-runtime-status planned-economy-status"
                          data-testid="planned-economy-status"
                        >
                          <span className="rule-runtime-status-icon">计</span>
                          <span>封存牌</span>
                          <strong>{ruleRuntimeStatus.plannedEconomy.remainingCards} / 20</strong>
                          <small>
                            {ruleRuntimeStatus.plannedEconomy.isDrawingEnabled
                              ? '每轮结束四家各摸1张'
                              : '埋底完成前不摸牌'}
                          </small>
                        </div>
                      )}
                      {ruleIncludesId(selectedRule, 'wooden_ox_flowing_horse') && ruleRuntimeStatus?.woodenOx && (
                        <div className="wooden-ox-rule-status" data-testid="wooden-ox-rule-status">
                          {(ruleRuntimeStatus.woodenOx.mules || []).map(mule => {
                            const holder = players.find(player => player.id === mule.holderPlayerId);
                            return (
                              <div key={mule.teamIndex}>
                                <span>
                                  {mule.teamIndex === ((dealerPlayerIndex ?? 0) % 2)
                                    ? '庄家方'
                                    : '闲家方'}
                                </span>
                                <strong>{holder?.name || '未知玩家'}</strong>
                                <small>{mule.hasStoredCard ? '已装牌' : '空'}</small>
                                <small>往返 {mule.completedRoundTrips} / {mule.maxRoundTrips}</small>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <Text className="table-rule-description" style={{ display: 'block', width: '100%', fontSize: '14px', color: '#ffffff', lineHeight: '1.5' }}>
                        {getRuleTableContent(selectedRule)}
                      </Text>
                    </div>
                  ) : (
                    <Text type="secondary" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                      {isRuleSelectionPending
                        ? `等待 ${ruleChooser?.name || '指定玩家'} 选择规则`
                        : '未选择规则'}
                    </Text>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 右边玩家 */}
        {positions.right && (
          <div className={`position-right ${hasRevealedHand(positions.right) ? 'has-open-hand' : ''}`}>
            <div className="second-battlefield-side-player">
              {renderPlayerArea(positions.right, 'right')}
              {renderSecondBattlefieldStagedArea(positions.right, 'right')}
            </div>
            {renderOpenHand(positions.right, 'right')}
            {renderPlayedCardsArea(positions.right, 'right')}
          </div>
        )}
      </div>

      {/* 下方玩家（自己） */}
      {positions.bottom && (
        <div className="position-bottom">
          {renderSecondBattlefieldStagedArea(positions.bottom, 'bottom')}

          <div
            className={`player-area player-bottom current-player ${positions.bottom.id === currentTurnPlayerId ? 'current-turn' : ''} ${playerTargeting?.active && playerTargeting?.allowSelf && (playerTargeting?.requireCards === false || positions.bottom.cardsCount > 0) ? 'skill-targetable' : ''} ${playerTargeting?.selectedPlayerIds?.includes(positions.bottom.id) ? 'skill-target-selected' : ''}`}
            data-player-id={positions.bottom.id}
            onClick={playerTargeting?.active && playerTargeting?.allowSelf
              && (playerTargeting?.requireCards === false || positions.bottom.cardsCount > 0)
              ? () => onPlayerTargetClick?.(positions.bottom)
              : undefined}
            role={playerTargeting?.active && playerTargeting?.allowSelf ? 'button' : undefined}
            tabIndex={playerTargeting?.active && playerTargeting?.allowSelf ? 0 : undefined}
            aria-label={playerTargeting?.active && playerTargeting?.allowSelf
              ? `${playerTargeting?.label || '选择玩家'}：${positions.bottom.name}`
              : undefined}
            onKeyDown={playerTargeting?.active && playerTargeting?.allowSelf ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onPlayerTargetClick?.(positions.bottom);
              }
            } : undefined}
          >
            {positions.bottom.id === currentTurnPlayerId && renderTurnIndicator(true)}
            {/* 我的出牌区域锚定在玩家框上方，不参与挤压手牌框高度。 */}
            {renderPlayedCardsArea(positions.bottom, 'bottom')}
            {/* 上半部分：玩家信息和控制按钮 */}
            <div className="bottom-player-header">
              <div className="player-info">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="player-avatar player-avatar-self" aria-hidden="true">
                    {(positions.bottom.name || '我').slice(0, 1).toUpperCase()}
                  </span>
                  <Text
                    strong
                    className="player-name player-name-self"
                    title={positions.bottom.name}
                  >
                    {positions.bottom.name} (我)
                  </Text>
                  {renderStriveUpstreamOrderBadge(positions.bottom)}
                  {defenseAsOffense?.playerId === positions.bottom.id && Number(defenseAsOffense.delta) > 0 && (
                    <span
                      className="defense-as-offense-player-badge"
                      title={`以守为攻：上一轮一号位，本轮牌面+${defenseAsOffense.delta}`}
                    >
                      +{defenseAsOffense.delta}
                    </span>
                  )}
                  {knownFocusPlayerIds.has(positions.bottom.id) && (
                    <span className="focus-figure-player-badge" title="己方焦点人物">焦点</span>
                  )}
                  {teammateCheerBuffedPlayerIds.has(positions.bottom.id) && (
                    <span className="teammate-cheer-player-badge" title="队友加油：本局余下牌面永久+1">
                      加油+1
                    </span>
                  )}
                  {afterglowActivePlayerIds.has(positions.bottom.id) && (
                    <span className="afterglow-player-badge" title="回光返照：仍有主牌时每次只能出主牌，牌面+1">
                      返照+1
                    </span>
                  )}
                  {lureTigerSilencedPlayerIds.has(positions.bottom.id) && (
                    <span className="lure-tiger-player-badge" title="调虎离山：本轮不参与甩牌询问，出牌不计大小与分数">
                      沉默
                    </span>
                  )}
                  {showFocusFigureProgress && (
                    <span
                      className="focus-figure-captured-points focus-figure-captured-points-self"
                      data-focus-captured-player-id={positions.bottom.id}
                    >
                      被闲家收走 {Number(focusCapturedPointsByPlayerId[positions.bottom.id]) || 0} 分
                    </span>
                  )}
                  {positions.bottom.id === secondaryBuryingPlayerId && (
                    <span className="secondary-burying-self-status">再埋底</span>
                  )}
                  {(() => {
                    // 检查是否是庄家 - 使用和其他位置相同的判断逻辑
                    let isDealer = false;
                    if (dealerPlayerIndex !== null && players && players.length > 0) {
                      const playerIndex = players.findIndex(p => p.id === positions.bottom.id);
                      isDealer = playerIndex === dealerPlayerIndex;
                    } else if (buryingPlayerId) {
                      isDealer = positions.bottom.id === buryingPlayerId;
                    }

                    return isDealer ? (
                      <span style={{
                        background: 'linear-gradient(135deg, #ffd700, #ffed4e)',
                        color: '#8B4513',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        marginLeft: '4px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }}>
                        庄
                      </span>
                    ) : null;
                  })()}
                  {isWaitingForReady && positions.bottom.isReady !== undefined && (
                    <Text
                      strong
                      style={{
                        fontSize: '14px',
                        color: positions.bottom.isReady ? '#52c41a' : '#d9d9d9'
                      }}
                    >
                      {positions.bottom.isReady ? '✓ 已准备' : '○ 未准备'}
                    </Text>
                  )}
                  {openHand?.playerId === positions.bottom.id && (
                    <span className="open-hand-self-status">明牌 · 由 {openHand.controllerPlayerName} 代打</span>
                  )}
                  {ruleVisibleHandsByPlayerId.has(positions.bottom.id) && (
                    <span className="open-hand-self-status">
                      {ruleVisibleHandsByPlayerId.get(positions.bottom.id).kind === 'partial'
                        ? `已明置 ${ruleVisibleHandsByPlayerId.get(positions.bottom.id).cards.length} 张`
                        : ruleVisibleHandsByPlayerId.get(positions.bottom.id).kind === 'jokers'
                          ? `二鬼拍门 · 明置 ${ruleVisibleHandsByPlayerId.get(positions.bottom.id).cards.length} 张王`
                          : ruleVisibleHandsByPlayerId.get(positions.bottom.id).label}
                    </span>
                  )}
                  {dreamKillingSleepingPlayerIds.has(positions.bottom.id) && (
                    <span className="open-hand-self-status dream-killing-self-status">梦中 · 系统随机出牌</span>
                  )}
                </div>
              </div>

              {/* 控制按钮区域 - 右侧 */}
              {(renderControls || onReturnToRoom || onRequestSurrender) && (
                <div className="inline-controls">
                  {renderControls}
                  {(onReturnToRoom || onRequestSurrender) && (
                    <div className={`room-action-stack${onRequestSurrender ? ' has-surrender' : ''}`}>
                      {onRequestSurrender && (
                        <Button
                          className="surrender-button"
                          danger
                          disabled={!canRequestSurrender || hasRequestedSurrender}
                          onClick={onRequestSurrender}
                          title={hasRequestedSurrender
                            ? '已申请，等待本墩结束'
                            : !canRequestSurrender
                              ? '当前不能发起投降'
                              : '本墩结束后询问队友'}
                        >
                          {hasRequestedSurrender ? '已申请' : '投降'}
                        </Button>
                      )}
                      {onReturnToRoom && (
                        <Button
                          className="return-room-button"
                          onClick={onReturnToRoom}
                          title="返回房间界面，座位会继续保留"
                        >
                          返回房间
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 亮主条（仅摸牌阶段显示） */}
            {trumpDeclarationComponent && (
              <div className="trump-declaration-wrapper">
                {trumpDeclarationComponent}
              </div>
            )}

            {/* 自己的手牌区域 - 左端分一小块作为亮主区 */}
            <div className="my-hand-container">
              {woodenOxCard && (
                <div className="wooden-ox-card-tray" aria-label="木牛流马中的牌">
                  <span className="wooden-ox-card-label">木牛流马 · 可保留后出</span>
                  <Card
                    card={woodenOxCard}
                    selected={selectedCards.includes(woodenOxCard.id)}
                    onClick={() => onCardClick?.(woodenOxCard.id)}
                    disabled={disableMyHand || !onCardClick}
                    trumpSuit={getPlayerTrumpSuit(positions.bottom)}
                    trumpRank={trumpRank}
                  />
                </div>
              )}

              {/* 自己的亮主在手牌左下角，亮劣在右下角。 */}
              {bottomHasTrumpDeclaration && (
                <div className="bottom-declaration-dock is-trump">
                  {renderDeclarationCardSlot({
                    cards: bottomTrumpDeclaration.cards,
                    declarationRole: 'trump',
                    player: positions.bottom,
                    playerTrumpSuit: getPlayerTrumpSuit(positions.bottom)
                  })}
                </div>
              )}
              {/* 手牌区域 */}
              <div className="my-hand">
                <Hand
                  cards={myCards}
                  selectedCards={selectedCards}
                  disabledCardIds={disabledCardIds}
                  disabledCardReason={disabledCardReason}
                  virtualizedCardIds={virtualizedCardIds}
                  revealedCardIds={
                    ['partial', 'jokers'].includes(
                      ruleVisibleHandsByPlayerId.get(positions.bottom.id)?.kind
                    )
                      ? ruleVisibleHandsByPlayerId.get(positions.bottom.id).cards.map(card => card.id)
                      : []
                  }
                  highlightedCardIds={highlightedCardIds}
                  highlightedCardLabel={highlightedCardLabel}
                  highlightedCardTone={highlightedCardTone}
                  onCardClick={onCardClick}
                  transformableCardIds={transformableCardIds}
                  onRequestCardTransformation={onRequestCardTransformation}
                  onCancelCardTransformation={onCancelCardTransformation}
                  onReorder={onReorder}
                  disabled={disableMyHand}
                  faceDown={dreamKillingSleepingPlayerIds.has(positions.bottom.id)}
                  anticipateNextCard
                  trumpSuit={getPlayerTrumpSuit(positions.bottom)}
                  trumpRank={trumpRank}
                />
              </div>
              {bottomHasInferiorDeclaration && (
                <div className="bottom-declaration-dock is-inferior">
                  {renderDeclarationCardSlot({
                    cards: bottomInferiorDeclaration.cards,
                    declarationRole: 'inferior',
                    player: positions.bottom,
                    playerTrumpSuit: getPlayerTrumpSuit(positions.bottom)
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
