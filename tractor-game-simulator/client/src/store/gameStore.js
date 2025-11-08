import { create } from 'zustand';

export const useGameStore = create((set) => ({
  // 当前房间
  currentRoom: null,
  // 当前玩家
  currentPlayer: null,
  // 手牌
  myCards: [],
  // 选中的牌
  selectedCards: [],
  // 房间列表
  roomList: [],
  // 连接状态
  isConnected: false,

  // Actions
  setCurrentRoom: (room) => set({ currentRoom: room }),
  setCurrentPlayer: (player) => set({ currentPlayer: player }),
  setMyCards: (cards) => set({ myCards: cards }),
  setSelectedCards: (cards) => set({ selectedCards: cards }),
  setRoomList: (rooms) => set({ roomList: rooms }),
  setIsConnected: (status) => set({ isConnected: status }),

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
    myCards: [...state.myCards, card]
  })),

  // 移除手牌
  removeCards: (cardIds) => set((state) => ({
    myCards: state.myCards.filter(card => !cardIds.includes(card.id))
  })),

  // 重置
  reset: () => set({
    currentRoom: null,
    currentPlayer: null,
    myCards: [],
    selectedCards: [],
    isConnected: false
  })
}));
