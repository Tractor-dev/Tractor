import { create } from 'zustand';
import { sortCards } from '../utils/cardUtils.js';

export const useGameStore = create((set, get) => ({
  // 当前房间
  currentRoom: null,
  // 当前玩家
  currentPlayer: null,
  // 当前观战者信息
  currentSpectator: null,
  // 是否是观战模式
  isSpectator: false,
  // 手牌
  myCards: [],
  // 选中的牌
  selectedCards: [],
  // 房间列表
  roomList: [],
  // 连接状态
  isConnected: false,
  // 主牌信息
  trumpSuit: null,
  trumpRank: null,

  // Actions
  setCurrentRoom: (room) => set({ currentRoom: room }),
  setCurrentPlayer: (player) => set({ currentPlayer: player }),
  setCurrentSpectator: (spectator) => set({ currentSpectator: spectator, isSpectator: !!spectator }),
  setIsSpectator: (isSpectator) => set({ isSpectator }),
  setMyCards: (cards) => set((state) => ({
    myCards: sortCards(cards, state.trumpSuit, state.trumpRank)
  })),
  setSelectedCards: (cards) => set({ selectedCards: cards }),
  setRoomList: (rooms) => set({ roomList: rooms }),
  setIsConnected: (status) => set({ isConnected: status }),

  // 设置主牌信息
  setTrumpInfo: (trumpSuit, trumpRank) => set((state) => ({
    trumpSuit,
    trumpRank,
    // 主牌变更时自动重新排序手牌
    myCards: sortCards(state.myCards, trumpSuit, trumpRank)
  })),

  // 切换选中的牌
  toggleCardSelection: (cardId) => set((state) => {
    const isSelected = state.selectedCards.includes(cardId);
    return {
      selectedCards: isSelected
        ? state.selectedCards.filter(id => id !== cardId)
        : [...state.selectedCards, cardId]
    };
  }),

  // 清空选中
  clearSelection: () => set({ selectedCards: [] }),

  // 添加手牌
  addCard: (card) => set((state) => ({
    myCards: sortCards([...state.myCards, card], state.trumpSuit, state.trumpRank)
  })),

  // 移除手牌
  removeCards: (cardIds) => set((state) => ({
    myCards: state.myCards.filter(card => !cardIds.includes(card.id))
  })),

  // 重新排序手牌（不自动排序）
  reorderCards: (newCards) => set({
    myCards: newCards
  }),

  // 重置
  reset: () => set({
    currentRoom: null,
    currentPlayer: null,
    currentSpectator: null,
    isSpectator: false,
    myCards: [],
    selectedCards: [],
    isConnected: false,
    trumpSuit: null,
    trumpRank: null
  })
}));
