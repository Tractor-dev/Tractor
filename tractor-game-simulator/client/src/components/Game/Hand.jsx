import { useState } from 'react';
import Card from './Card';
import './Hand.css';

export default function Hand({ cards, selectedCards = [], onCardClick, disabled = false, small = false, onReorder, trumpSuit = null, trumpRank = null }) {
  const [draggedCard, setDraggedCard] = useState(null);

  // 防御性检查：确保cards是数组
  if (!Array.isArray(cards)) {
    console.warn('Hand component received non-array cards:', cards);
    return <div className={`hand ${small ? 'small' : ''}`}></div>;
  }

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

  return (
    <div className={`hand ${small ? 'small' : ''} ${compactClass}`}>
      {cards.map((card) => (
        <Card
          key={card.id}
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
      ))}
    </div>
  );
}
