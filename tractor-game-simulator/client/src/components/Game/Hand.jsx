import { useState, useMemo, useLayoutEffect, useRef } from 'react';
import Card from './Card';
import { getCardStrength, getEffectiveSuit } from '../../utils/cardPatternUtils';
import { RANK_ORDER } from '../../utils/constants.js';
import './Hand.css';

export default function Hand({ cards, selectedCards = [], disabledCardIds = [], disabledCardReason = '', virtualizedCardIds = [], revealedCardIds = [], transformableCardIds = [], onCardClick, onRequestCardTransformation, onCancelCardTransformation, disabled = false, faceDown = false, small = false, anticipateNextCard = false, showWinningBadge = false, onReorder, trumpSuit = null, trumpRank = null, minimumVisibleWidth = null }) {
  const [draggedCard, setDraggedCard] = useState(null);
  const handRef = useRef(null);
  const cardWrapperRefs = useRef(new Map());
  const [layoutMetrics, setLayoutMetrics] = useState(null);
  const cardIndexMap = useMemo(() => {
    const map = new Map();
    cards.forEach((card, index) => {
      map.set(card.id, index);
    });
    return map;
  }, [cards]);
  // 转化牌会在牌数不变的情况下重新排序。布局测量必须感知实际牌序，
  // 否则拖拉机标线会继续读取这些牌转换前所在位置的旧坐标。
  const cardOrderKey = useMemo(
    () => cards.map(card => card.id).join('|'),
    [cards]
  );

  const getCardIndex = (cardId) => cardIndexMap.get(cardId) ?? -1;

  // 防御性检查：确保cards是数组
  if (!Array.isArray(cards)) {
    console.warn('Hand component received non-array cards:', cards);
    return <div className={`hand ${small ? 'small' : ''}`}></div>;
  }

  // 检测手牌中的所有拖拉机
  const tractorGroups = useMemo(() => {
    if (cards.length < 4) {
      return [];
    }

    const tractors = [];

    // 按有效花色分组
    const suitGroups = {};
    cards.forEach(card => {
      const suit = getEffectiveSuit(card, trumpSuit, trumpRank);
      if (!suitGroups[suit]) {
        suitGroups[suit] = [];
      }
      suitGroups[suit].push(card);
    });

    // 在每个花色中找拖拉机
    Object.entries(suitGroups).forEach(([suit, suitCards]) => {
      if (suitCards.length < 4) return;

      // 找出所有对子
      const pairs = [];
      const used = new Set();

      for (let i = 0; i < suitCards.length; i++) {
        if (used.has(i)) continue;
        for (let j = i + 1; j < suitCards.length; j++) {
          if (used.has(j)) continue;
          if (suitCards[i].rank === suitCards[j].rank && suitCards[i].suit === suitCards[j].suit) {
            pairs.push({
              cards: [suitCards[i], suitCards[j]],
              strength: getCardStrength(suitCards[i], trumpSuit, trumpRank)
            });
            used.add(i);
            used.add(j);
            break;
          }
        }
      }

      if (pairs.length < 2) return;

      // 按强度排序
      pairs.sort((a, b) => a.strength - b.strength);

      // 找连续的对子组成拖拉机
      let tractorStart = 0;
      for (let i = 1; i <= pairs.length; i++) {
        let isConsecutive = false;
        if (i < pairs.length) {
          const prevStrength = pairs[i-1].strength;
          const currStrength = pairs[i].strength;
          const strengthDiff = currStrength - prevStrength;

          // 检查是否无主局
          const isNoTrump = !trumpSuit || trumpSuit === 'no_trump';

          // 主牌的特殊连接
          if ((prevStrength === 997 && currStrength === 998) ||
              (prevStrength === 998 && currStrength === 999) ||
              (prevStrength === 999 && currStrength === 1000) ||
              (prevStrength === 997 && currStrength === 999 && isNoTrump)) {  // 仅无主局：级牌(997) -> 小王(999)
            isConsecutive = true;
          }
          // 强度差为1，直接连续
          else if (strengthDiff === 1) {
            isConsecutive = true;
          }
          // 副牌：强度差为2，检查是否跳过级牌
          else if (strengthDiff === 2) {
            const trumpRankValue = RANK_ORDER[trumpRank] || 0;
            // 检查级牌是否在两个对子的rank值之间
            if (trumpRankValue === prevStrength + 1) {
              isConsecutive = true;
            }
          }
        }

        if (!isConsecutive) {
          // 当前拖拉机结束
          const tractorLength = i - tractorStart;
          if (tractorLength >= 2) {
            const tractorCards = [];
            for (let j = tractorStart; j < i; j++) {
              tractorCards.push(...pairs[j].cards);
            }

            // 按照实际手牌顺序排序，以便标记时使用正确的起止卡片
            tractorCards.sort((a, b) => getCardIndex(a.id) - getCardIndex(b.id));

            tractors.push({
              cardIds: tractorCards.map(c => c.id),
              length: tractorLength
            });
          }
          tractorStart = i;
        }
      }
    });

    return tractors;
  }, [cards, trumpSuit, trumpRank]);

  // 根据牌数计算紧凑程度
  const getCompactClass = () => {
    const cardCount = cards.length;
    if (cardCount > 31) return 'compact-4'; // 33张牌（看底牌时）
    if (cardCount > 28) return 'compact-3';
    if (cardCount > 22) return 'compact-2';
    if (cardCount > 15) return 'compact-1';
    return '';
  };

  const compactClass = getCompactClass();

  // 按容器的真实宽度连续计算叠牌量，并提前预留一张牌的露出宽度。
  useLayoutEffect(() => {
    const handElement = handRef.current;
    if (!handElement) return undefined;

    const updateOverlap = () => {
      const cardCount = cards.length;
      const cardWidth = small ? 50 : 78;
      const naturalOverlap = small ? 18 : 25;
      const minimumCardReveal = Number.isFinite(minimumVisibleWidth)
        ? Math.max(1, Math.min(cardWidth, minimumVisibleWidth))
        : (small ? 12 : 18);
      const computedStyle = window.getComputedStyle(handElement);
      const paddingLeft = Number.parseFloat(computedStyle.paddingLeft) || 0;
      const paddingRight = Number.parseFloat(computedStyle.paddingRight) || 0;
      const paddingBottom = Number.parseFloat(computedStyle.paddingBottom) || 0;
      const horizontalPadding = paddingLeft + paddingRight;
      const nextCardReserve = anticipateNextCard && cardCount > 1 ? cardWidth - naturalOverlap : 0;
      const usableWidth = Math.max(
        cardWidth,
        handElement.clientWidth - horizontalPadding - nextCardReserve
      );
      const requiredOverlap = cardCount > 1
        ? cardWidth - (usableWidth - cardWidth) / (cardCount - 1)
        : naturalOverlap;
      const overlap = Math.min(
        cardWidth - minimumCardReveal,
        Math.max(naturalOverlap, Math.ceil(requiredOverlap))
      );

      handElement.style.setProperty('--card-overlap', `${overlap}px`);
      const cardPositions = {};
      cards.forEach((card) => {
        const wrapper = cardWrapperRefs.current.get(card.id);
        if (!wrapper) return;
        // 弹窗入场会用 transform 缩放整只手牌。视觉矩形会暂时变小，
        // 而 offset 坐标始终对应最终布局，可避免拖拉机标线停在动画中的旧位置。
        cardPositions[card.id] = {
          left: wrapper.offsetLeft,
          right: wrapper.offsetLeft + wrapper.offsetWidth,
          bottom: wrapper.offsetTop + wrapper.offsetHeight
        };
      });
      const nextMetrics = {
        width: handElement.clientWidth,
        height: handElement.clientHeight,
        paddingLeft,
        paddingRight,
        paddingBottom,
        cardWidth,
        overlap,
        cardPositions
      };
      setLayoutMetrics((previous) => {
        const sameScalarMetrics = previous && [
          'width', 'height', 'paddingLeft', 'paddingRight', 'paddingBottom', 'cardWidth', 'overlap'
        ].every((key) => previous[key] === nextMetrics[key]);
        const sameCardPositions = sameScalarMetrics && cards.every((card) => {
          const previousPosition = previous.cardPositions?.[card.id];
          const nextPosition = cardPositions[card.id];
          return previousPosition && nextPosition &&
            previousPosition.left === nextPosition.left &&
            previousPosition.right === nextPosition.right &&
            previousPosition.bottom === nextPosition.bottom;
        });
        if (sameCardPositions) {
          return previous;
        }
        return nextMetrics;
      });
    };

    updateOverlap();
    const resizeObserver = new ResizeObserver(updateOverlap);
    resizeObserver.observe(handElement);
    return () => resizeObserver.disconnect();
  }, [cards.length, cardOrderKey, small, anticipateNextCard, minimumVisibleWidth]);

  // 拖拽开始
  const handleDragStart = (e, card) => {
    setDraggedCard(card);
    e.dataTransfer.effectAllowed = 'move';
  };

  // 拖拽结束
  const handleDragEnd = () => {
    setDraggedCard(null);
  };

  // 拖拽经过
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // 放置
  const handleDrop = (e, targetCard) => {
    e.preventDefault();

    if (!draggedCard || draggedCard.id === targetCard.id) {
      return;
    }

    // 找到拖拽卡片和目标卡片的索引
    const dragIndex = cards.findIndex(c => c.id === draggedCard.id);
    const dropIndex = cards.findIndex(c => c.id === targetCard.id);

    if (dragIndex === -1 || dropIndex === -1) {
      return;
    }

    // 创建新的牌序列
    const newCards = [...cards];
    const [removed] = newCards.splice(dragIndex, 1);
    newCards.splice(dropIndex, 0, removed);

    // 通知父组件
    if (onReorder) {
      onReorder(newCards);
    }

    setDraggedCard(null);
  };

  return (
    <div ref={handRef} className={`hand ${small ? 'small' : ''} ${faceDown ? 'face-down-hand' : ''} ${compactClass}`}>
      {cards.map((card) => {
        const cardIndex = getCardIndex(card.id);
        const isRightmostCard = cardIndex === cards.length - 1;
        const isSelected = selectedCards.includes(card.id);
        const isRuleDisabled = disabledCardIds.includes(card.id);
        const isVirtualized = virtualizedCardIds.includes(card.id);
        const isPubliclyRevealed = revealedCardIds.includes(card.id);

        return (
          <div
            key={card.id}
            ref={(element) => {
              if (element) cardWrapperRefs.current.set(card.id, element);
              else cardWrapperRefs.current.delete(card.id);
            }}
            className={`card-wrapper ${isPubliclyRevealed ? 'is-publicly-revealed' : ''} ${isVirtualized ? 'is-virtualized' : ''}`}
            style={{ zIndex: cardIndex + 1 }}
          >
            <Card
              card={card}
              selected={isSelected}
              onClick={() => onCardClick && onCardClick(card.id)}
              onRequestTransformation={transformableCardIds.includes(card.id) && onRequestCardTransformation
                ? () => onRequestCardTransformation(card.id)
                : undefined}
              onCancelTransformation={card.explicitTransformationPreview && onCancelCardTransformation
                ? () => onCancelCardTransformation(card.id)
                : undefined}
              disabled={disabled || isRuleDisabled || isVirtualized}
              ruleDisabled={isRuleDisabled}
              ruleDisabledReason={disabledCardReason}
              virtualized={isVirtualized}
              faceDown={faceDown}
              small={small}
              draggable={!disabled && !isRuleDisabled && !isVirtualized && !!onReorder}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              trumpSuit={trumpSuit}
              trumpRank={trumpRank}
            />
            {showWinningBadge && isRightmostCard && (
              <span className="winning-play-badge" aria-label="当前最大">大</span>
            )}
          </div>
        );
      })}
      {layoutMetrics && tractorGroups.map((tractor, tractorIndex) => {
        const indices = tractor.cardIds.map(getCardIndex).filter((index) => index >= 0);
        if (indices.length === 0) return null;
        const firstIndex = Math.min(...indices);
        const lastIndex = Math.max(...indices);
        const firstPosition = layoutMetrics.cardPositions?.[cards[firstIndex]?.id];
        const lastPosition = layoutMetrics.cardPositions?.[cards[lastIndex]?.id];
        if (!firstPosition || !lastPosition) return null;
        const nextPosition = layoutMetrics.cardPositions?.[cards[lastIndex + 1]?.id];
        const groupLeft = firstPosition.left;
        const groupRight = lastIndex === cards.length - 1
          ? lastPosition.right
          : nextPosition?.left ?? lastPosition.right;
        const groupWidth = Math.max(3, groupRight - groupLeft);

        return (
          <div
            key={`tractor-label-${tractorIndex}`}
            className="tractor-group-marker"
            style={{
              left: `${groupLeft}px`,
              top: `${firstPosition.bottom - (small ? 4 : 5)}px`,
              width: `${groupWidth}px`
            }}
          >
            <span className="tractor-group-label">拖拉机</span>
          </div>
        );
      })}
    </div>
  );
}

