import { useState } from 'react';
import { Button, Tooltip } from 'antd';
import { Suits } from '../../utils/constants';
import './TrumpDeclaration.css';

/**
 * 亮主条组件
 * @param {Object} props
 * @param {Array} props.availableDeclarations - 可用的亮主选项 [{type: 'joker|spades|hearts|clubs|diamonds', count: 1|2, canDeclare: boolean, description: string}]
 * @param {Function} props.onDeclare - 亮主回调 (type, count) => void
 * @param {Object} props.currentTrump - 当前主牌 {suit: string, declarationType: 'single'|'pair'|'pair_joker'}
 */
export default function TrumpDeclaration({ availableDeclarations = [], onDeclare, currentTrump }) {
  const [hoveredSlot, setHoveredSlot] = useState(null);

  // 定义五个格子：王、♠、♥、♣、♦
  const slots = [
    { type: 'joker', label: '王', suit: Suits.JOKER },
    { type: 'spades', label: '♠', suit: Suits.SPADES },
    { type: 'hearts', label: '♥', suit: Suits.HEARTS },
    { type: 'clubs', label: '♣', suit: Suits.CLUBS },
    { type: 'diamonds', label: '♦', suit: Suits.DIAMONDS }
  ];

  // 获取某个格子的可用亮主选项
  const getSlotOptions = (slotType) => {
    return availableDeclarations.filter(d => d.type === slotType);
  };

  // 处理点击格子
  const handleSlotClick = (slotType) => {
    const options = getSlotOptions(slotType);
    if (options.length === 0) return;

    // 如果只有一个选项，直接亮主
    if (options.length === 1) {
      const option = options[0];
      if (option.canDeclare) {
        onDeclare(slotType, option.count);
      }
      return;
    }

    // 王必须一次亮一对
    if (slotType === 'joker') {
      const pairOption = options.find(o => o.count === 2 && o.canDeclare);
      if (pairOption) {
        onDeclare(slotType, 2);
      }
      return;
    }

    // 花色牌：检查是否有加固选项
    const reinforceOption = options.find(o => o.isReinforce && o.canDeclare);
    if (reinforceOption) {
      // 加固：亮一对
      onDeclare(slotType, 2);
      return;
    }

    // 花色牌：默认亮一张，后续可以加固
    const singleOption = options.find(o => o.count === 1 && o.canDeclare);
    if (singleOption) {
      onDeclare(slotType, 1);
    } else {
      // 没有单张选项（可能被别人亮过单张了），尝试一对
      const pairOption = options.find(o => o.count === 2 && o.canDeclare);
      if (pairOption) {
        onDeclare(slotType, 2);
      }
    }
  };

  // 判断格子是否应该高亮（只在玩家可以亮或反时高亮）
  const isSlotActive = (slotType) => {
    const options = getSlotOptions(slotType);
    return options.some(o => o.canDeclare);
  };

  // 获取格子的提示文本
  const getSlotTooltip = (slotType) => {
    const options = getSlotOptions(slotType);
    if (options.length === 0) return '';

    const tips = options.map(o => o.description).join('\n');
    return tips;
  };

  return (
    <div className="trump-declaration">
      <div className="declaration-label">亮主：</div>
      <div className="declaration-slots">
        {slots.map(slot => {
          const isActive = isSlotActive(slot.type);
          const tooltip = getSlotTooltip(slot.type);

          return (
            <Tooltip key={slot.type} title={tooltip} placement="top">
              <div
                className={`declaration-slot ${isActive ? 'active' : ''}`}
                onClick={() => handleSlotClick(slot.type)}
                onMouseEnter={() => setHoveredSlot(slot.type)}
                onMouseLeave={() => setHoveredSlot(null)}
              >
                <span className="slot-label">{slot.label}</span>
              </div>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
