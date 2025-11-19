import { useState, useMemo } from 'react';
import Card from './Card';
import { getCardStrength, getEffectiveSuit } from '../../utils/cardPatternUtils';
import { RANK_ORDER } from '../../utils/constants.js';
import './Hand.css';

export default function Hand({ cards, selectedCards = [], onCardClick, disabled = false, small = false, onReorder, trumpSuit = null, trumpRank = null }) {
  const [draggedCard, setDraggedCard] = useState(null);
  const cardIndexMap = useMemo(() => {
    const map = new Map();
    cards.forEach((card, index) => {
      map.set(card.id, index);
    });
    return map;
  }, [cards]);

  const getCardIndex = (cardId) => cardIndexMap.get(cardId) ?? -1;

  // 防御性检查：确保cards是数组
  if (!Array.isArray(cards)) {
    console.warn('Hand component received non-array cards:', cards);
    return <div className={`hand ${small ? 'small' : ''}`}></div>;
  }

  // 检测手牌中的所有拖拉机
  const tractorGroups = useMemo(() => {
    if (!trumpSuit || !trumpRank || cards.length < 4) {
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

          // 主牌的特殊连接
          if ((prevStrength === 997 && currStrength === 998) ||
              (prevStrength === 998 && currStrength === 999) ||
              (prevStrength === 999 && currStrength === 1000)) {
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

  // 获取卡片所属的拖拉机索引
  const getCardTractorIndex = (cardId) => {
    for (let i = 0; i < tractorGroups.length; i++) {
      if (tractorGroups[i].cardIds.includes(cardId)) {
        return i;
      }
    }
    return -1;
  };

  // 检查卡片是否是拖拉机的第一张
  const isTractorStart = (cardId) => {
    for (const tractor of tractorGroups) {
      const cardIndex = getCardIndex(cardId);
      const firstTractorCardIndex = getCardIndex(tractor.cardIds[0]);
      if (cardIndex === firstTractorCardIndex) {
        return tractor;
      }
    }
    return null;
  };

  // 检查卡片是否是拖拉机的最后一张
  const isTractorEnd = (cardId) => {
    for (const tractor of tractorGroups) {
      const cardIndex = getCardIndex(cardId);
      const lastTractorCardIndex = getCardIndex(tractor.cardIds[tractor.cardIds.length - 1]);
      if (cardIndex === lastTractorCardIndex) {
        return true;
      }
    }
    return false;
  };

  // 根据牌数计算紧凑程度
  const getCompactClass = () => {
    const cardCount = cards.length;
    if (cardCount > 28) return 'compact-3';
    if (cardCount > 22) return 'compact-2';
    if (cardCount > 15) return 'compact-1';
    return '';
  };

  const compactClass = getCompactClass();

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

  // 拖拉机颜色数组
  const tractorColors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7'];

  return (
    <div className={`hand ${small ? 'small' : ''} ${compactClass}`}>
      {cards.map((card) => {
        const tractorIndex = getCardTractorIndex(card.id);
        const tractorStart = isTractorStart(card.id);
        const isLastInTractor = isTractorEnd(card.id);
        const isTractor = tractorIndex !== -1;
        const tractorColor = isTractor ? tractorColors[tractorIndex % tractorColors.length] : null;
        const cardIndex = getCardIndex(card.id);
        const isRightmostCard = cardIndex === cards.length - 1;

        // 计算拖拉机线的样式
        // 如果是拖拉机的最后一张牌，限制线的宽度，不延伸到右边
        const tractorLineStyle = {
          position: 'absolute',
          bottom: small ? '-2px' : '-4px',
          left: 0,
          height: small ? '2px' : '3px',
          backgroundColor: tractorColor,
          borderRadius: '2px'
        };

        if (isLastInTractor) {
          // 最后一张牌：根据是否到手牌末尾决定宽度
          if (isRightmostCard) {
            tractorLineStyle.width = 'var(--card-width, 80px)';
          } else {
            tractorLineStyle.width = 'calc(var(--card-width, 80px) - var(--card-overlap, 25px))';
          }
        } else {
          // 非最后一张：延伸到右边，会被下一张牌覆盖
          tractorLineStyle.right = 0;
        }

        return (
          <div key={card.id} className="card-wrapper" style={{ position: 'relative' }}>
            <Card
              card={card}
              selected={selectedCards.includes(card.id)}
              onClick={() => onCardClick && onCardClick(card.id)}
              disabled={disabled}
              small={small}
              draggable={!disabled && !!onReorder}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              trumpSuit={trumpSuit}
              trumpRank={trumpRank}
            />
            {isTractor && (
              <div
                className="tractor-line"
                style={tractorLineStyle}
              />
            )}
            {tractorStart && (
              <div
                className="tractor-label"
                style={{
                  position: 'absolute',
                  bottom: small ? '-16px' : '-20px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: small ? '9px' : '10px',
                  color: tractorColor,
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap',
                  textShadow: '0 0 2px white, 0 0 2px white'
                }}
              >
                拖拉机
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

