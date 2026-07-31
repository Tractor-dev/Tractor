import { useMemo } from 'react';
import { isTrumpCard } from '../../utils/cardUtils';
import { isIronEvidenceSpecialCard } from '../../utils/ironEvidenceUtils';
import './Card.css';

const SUIT_SYMBOLS = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
  joker: '🃏'
};

const SUIT_COLORS = {
  hearts: 'red',
  diamonds: 'red',
  clubs: 'black',
  spades: 'black'
};

const RANK_DISPLAY = {
  A: 'A',
  '-2': '-2',
  '-1': '-1',
  '0': '0',
  '1': '1',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  J: 'J',
  Q: 'Q',
  K: 'K',
  B: 'B',
  C: 'C',
  D: 'D',
  M: 'M',
  small_joker: 'JOKER',
  big_joker: 'JOKER',
  county_prince_joker: 'JOKER',
  prince_joker: 'JOKER',
  white_joker: 'JOKER'
};

const JOKER_META = {
  small_joker: { className: 'small-joker', color: '#121513', label: '小王' },
  big_joker: { className: 'big-joker', color: '#d82035', label: '大王' },
  county_prince_joker: {
    className: 'county-prince-joker',
    color: '#7b4bb7',
    label: '郡王'
  },
  prince_joker: { className: 'prince-joker', color: '#276fa8', label: '亲王' },
  white_joker: { className: 'white-joker', color: '#c28b12', label: '白王（皇）' }
};

const getRankLabel = rank => JOKER_META[rank]?.label || (rank === 'M' ? 'M（Minus）' : rank);

const getOriginalFaceLabel = (suit, rank) => {
  if (!rank) return '';
  if (JOKER_META[rank]) return JOKER_META[rank].label;
  return `${SUIT_SYMBOLS[suit] || ''}${RANK_DISPLAY[rank] || rank}`;
};

const getOriginalFaceTone = (suit, rank) => {
  if (rank === 'big_joker' || suit === 'hearts' || suit === 'diamonds') return 'is-red';
  if (rank === 'county_prince_joker') return 'is-purple';
  if (rank === 'prince_joker') return 'is-blue';
  if (rank === 'white_joker') return 'is-gold';
  return 'is-black';
};

export default function Card({
  card,
  selected = false,
  onClick,
  onRequestTransformation,
  onCancelTransformation,
  disabled = false,
  ruleDisabled = false,
  ruleDisabledReason = '',
  virtualized = false,
  faceDown = false,
  small = false,
  micro = false,
  showOriginalFace = false,
  draggable = false,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  trumpSuit = null,
  trumpRank = null
}) {
  const isJoker = card.suit === 'joker';
  const jokerMeta = isJoker ? JOKER_META[card.rank] || JOKER_META.small_joker : null;
  const isNoTrumpMinus = card.rank === 'M';
  const isTrump = isTrumpCard(card, trumpSuit, trumpRank);
  const isDivineWeaponTransformed = Boolean(
    card.isDivineWeaponTransformed || card.divineWeaponPreview
  );
  const isClusterAnalysisTransformed = Boolean(card.isClusterAnalysisTransformed);
  const isJokerSubstitution = Boolean(card.isJokerSubstitution);
  const isForbiddenMagicDemoted = Boolean(card.isForbiddenMagicDemoted);
  const isStrengthCompensated = Boolean(card.isStrengthCompensated);
  const isDefenseAsOffenseBoosted = Boolean(card.isDefenseAsOffenseBoosted);
  const isTeammateCheered = Boolean(card.isTeammateCheered);
  const isAfterglowBoosted = Boolean(card.isAfterglowBoosted);
  const isThreeTigersTransformed = Boolean(card.isThreeTigersTransformed);
  const isRiceToMulberryTransformed = Boolean(card.isRiceToMulberryTransformed);
  const isIronEvidenceCard = isIronEvidenceSpecialCard(card);
  const ironEvidenceModeClass = isIronEvidenceCard && ['multiply', 'zero'].includes(
    card.ironEvidenceMode
  )
    ? `iron-evidence-${card.ironEvidenceMode}`
    : '';
  const isConvertedSpade = !isDivineWeaponTransformed
    && !isStrengthCompensated
    && !isDefenseAsOffenseBoosted
    && !isTeammateCheered
    && !isAfterglowBoosted
    && card.originalSuit === 'spades'
    && card.suit === 'hearts';
  const originalSuit = card.originalSuit || card.suit;
  const originalRank = card.originalRank || null;
  const hasChangedFace = Boolean(
    originalRank
    && (
      String(originalSuit) !== String(card.suit)
      || String(originalRank) !== String(card.rank)
    )
  );
  const originalFaceLabel = hasChangedFace
    ? getOriginalFaceLabel(originalSuit, originalRank)
    : '';
  const currentFaceLabel = getOriginalFaceLabel(card.suit, card.rank);

  const displayRank = useMemo(() => {
    return RANK_DISPLAY[card.rank] || card.rank;
  }, [card.rank]);

  const suitSymbol = SUIT_SYMBOLS[card.suit] || '';
  const color = isJoker
    ? jokerMeta.color
    : (SUIT_COLORS[card.suit] || 'black');
  const cornerRank = isJoker ? '♛' : displayRank;

  return (
    <div
      data-card-id={card.id}
      className={`card card-suit-${card.suit} ${isTrump ? 'is-trump-card' : ''} ${faceDown ? 'face-down' : ''} ${isJoker ? `joker-card ${jokerMeta.className}` : ''} ${isNoTrumpMinus ? 'no-trump-minus' : ''} ${isConvertedSpade ? 'converted-spade' : ''} ${isDivineWeaponTransformed ? 'divine-weapon-transformed' : ''} ${isClusterAnalysisTransformed ? 'cluster-analysis-transformed' : ''} ${isForbiddenMagicDemoted ? 'forbidden-magic-demoted' : ''} ${isStrengthCompensated ? 'strength-compensated' : ''} ${isDefenseAsOffenseBoosted ? 'defense-as-offense-boosted' : ''} ${isTeammateCheered ? 'teammate-cheered' : ''} ${isAfterglowBoosted ? 'afterglow-boosted' : ''} ${isThreeTigersTransformed ? 'three-tigers-transformed' : ''} ${isRiceToMulberryTransformed ? 'rice-to-mulberry-transformed' : ''} ${isIronEvidenceCard ? 'iron-evidence-card' : ''} ${ironEvidenceModeClass} ${card.isForbiddenMagicTransformed ? 'forbidden-magic-transformed' : ''} ${card.divineWeaponPreview ? 'divine-weapon-preview' : ''} ${card.isLastStandTrump ? 'last-stand-trump' : ''} ${virtualized ? 'virtualized' : ''} ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''} ${ruleDisabled ? 'rule-disabled' : ''} ${small ? 'small' : ''} ${micro ? 'micro' : ''}`}
      onClick={disabled ? undefined : onClick}
      title={virtualized
        ? '虚虚实实：本次出牌视为手中没有这张副花色牌'
        : ruleDisabled
          ? ruleDisabledReason || '当前规则下本轮不能打出这张牌'
          : jokerMeta?.label}
      aria-disabled={disabled}
      draggable={draggable && !disabled}
      onDragStart={(e) => onDragStart && onDragStart(e, card)}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop && onDrop(e, card)}
      style={{
        color: color,
        borderColor: selected ? '#1890ff' : '#d9d9d9',
        // 系统 grab 是一只面积很大的张掌，叠在紧凑牌面上会遮挡点数；
        // 普通 pointer 同样明确表示可点/可拖，同时视觉尺寸更克制。
        cursor: disabled ? 'not-allowed' : 'pointer'
      }}
    >
      {faceDown ? (
        <div className="card-back-surface" aria-label="暗置手牌">
          <span>梦</span>
        </div>
      ) : <>
      <div className="card-corner top-left">
        <div className="card-rank">{cornerRank}</div>
        {!isJoker && <div className="card-suit">{suitSymbol}</div>}
      </div>

      <div className="card-center">
        {isJoker ? (
          <div className="joker-center">
            <span className="joker-text" aria-label={jokerMeta?.label || displayRank}>
              {displayRank.split('').map((letter, index) => (
                <span className="joker-letter" key={`${letter}-${index}`} aria-hidden="true">
                  {letter}
                </span>
              ))}
            </span>
          </div>
        ) : (
          <div className="suit-symbol">{suitSymbol}</div>
        )}
      </div>

      <div className="card-corner bottom-right">
        <div className="card-rank">{cornerRank}</div>
        {!isJoker && <div className="card-suit">{suitSymbol}</div>}
      </div>

      {showOriginalFace && hasChangedFace && (
        <div
          className={`original-face-badge ${getOriginalFaceTone(originalSuit, originalRank)}`}
          data-original-suit={originalSuit}
          data-original-rank={originalRank}
          aria-label={`实体原牌：${originalFaceLabel}，当前牌面：${currentFaceLabel}`}
          title={`实体原牌 ${originalFaceLabel}，本次按 ${currentFaceLabel} 参与牌型与大小`}
        >
          <span>原</span>
          <strong>{originalFaceLabel}</strong>
        </div>
      )}

      {/* 主牌星标 */}
      {isTrump && (
        <div className="trump-badge">
          <span className="trump-star">★</span>
        </div>
      )}
      {!isJoker && (
        <div className="inferior-badge" title="三六九等：劣花色">−</div>
      )}
      {isConvertedSpade && (
        <div className="converted-spade-badge" title="原黑桃牌，红颜祸水中视为红桃">
          ♠→♥
        </div>
      )}
      {isRiceToMulberryTransformed && (
        <div
          className="rice-to-mulberry-card-badge"
          title={`改稻为桑：原${SUIT_SYMBOLS[card.originalSuit] || ''}${card.originalRank || ''}，现按新牌面参与牌型与大小，永久计0分`}
        >
          桑
        </div>
      )}
      {isDivineWeaponTransformed && (
        <div className="divine-weapon-card-badge" title="神兵天降转化牌">神兵</div>
      )}
      {isClusterAnalysisTransformed && (
        <div
          className="cluster-analysis-card-badge"
          title={`聚类分析：${card.clusterAnalysisSourceRank || card.originalRank}视为${card.rank}`}
        >
          聚
        </div>
      )}
      {isJokerSubstitution && (
        <div
          className="joker-substitution-card-badge"
          title={`偷梁换柱：王牌视为${card.rank}`}
        >
          换
        </div>
      )}
      {isForbiddenMagicDemoted && (
        <div
          className="forbidden-magic-card-badge"
          title={card.isForbiddenMagicTransformed
            ? `禁术秘法：原 ${card.originalRank || ''} 已改作 ${card.rank}`
            : '禁术秘法：本局不再视为主牌'}
        >
          禁
        </div>
      )}
      {isStrengthCompensated && (
        <div
          className={`strength-compensation-card-badge ${card.strengthCompensationDelta > 0 ? 'is-plus' : 'is-minus'}`}
          title={`取长补短：原 ${getRankLabel(card.originalRank || card.rank)} ${card.strengthCompensationDelta > 0 ? '升' : '降'}一级，当前为 ${getRankLabel(card.rank)}`}
        >
          {card.strengthCompensationDelta > 0 ? '+1' : '−1'}
        </div>
      )}
      {isTeammateCheered && (
        <div
          className="teammate-cheer-card-badge"
          title={`队友加油：原 ${getRankLabel(card.originalRank || card.rank)} 提升一级，当前为 ${getRankLabel(card.rank)}`}
        >
          油+1
        </div>
      )}
      {isAfterglowBoosted && (
        <div
          className="afterglow-card-badge"
          title={`回光返照：原 ${getRankLabel(card.originalRank || card.rank)} 提升一级，当前为 ${getRankLabel(card.rank)}`}
        >
          返+1
        </div>
      )}
      {isThreeTigersTransformed && (
        <div
          className="three-tigers-card-badge"
          title={`三人成虎：原 ${card.originalRank || card.rank} 降低四级并视为主牌`}
        >
          虎−4
        </div>
      )}
      {onRequestTransformation && (
        <button
          type="button"
          className="card-transformation-control card-transformation-trigger"
          aria-label="转化此牌"
          title="转化此牌；点击牌面仍可正常选牌"
          onClick={(event) => {
            event.stopPropagation();
            onRequestTransformation();
          }}
        >
          转
        </button>
      )}
      {onCancelTransformation && (
        <button
          type="button"
          className="card-transformation-control card-transformation-cancel"
          aria-label="取消转化，还原原牌"
          title="取消转化，还原原牌"
          onClick={(event) => {
            event.stopPropagation();
            onCancelTransformation();
          }}
        >
          还
        </button>
      )}
      </>}
    </div>
  );
}
