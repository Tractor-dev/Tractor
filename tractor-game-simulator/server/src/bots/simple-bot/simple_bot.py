#!/usr/bin/env python3
"""
简化版拖拉机游戏Bot - 不依赖torch和模型
使用简单的随机策略
"""

import json
import sys
import random

def get_random_action(deck, history, played):
    """
    简单的随机策略：随机出1-3张牌

    Args:
        deck: 手牌列表，如 ['hA', 's2', 'c3']
        history: 最近的出牌历史
        played: 所有玩家的已出牌记录

    Returns:
        要出的牌列表
    """
    if not deck:
        return []

    # 随机决定出几张牌（1-3张，但不超过手牌数量）
    num_cards = random.randint(1, min(3, len(deck)))

    # 随机选择牌
    selected_cards = random.sample(deck, num_cards)

    return selected_cards


def get_smart_action(deck, history, played, trump=None):
    """
    稍微智能一点的策略：
    1. 如果是第一次出牌或轮到自己开局，出同一花色的最小的1张非级牌
    2. 否则跟着前面的玩家出相同数量的同花色牌

    Args:
        deck: 手牌列表，格式如 ['hA', 's2', 'c3', 'jo', 'Jo']
        history: 最近的出牌历史，是一个二维数组，每个元素是一次出牌的牌列表
        played: 所有玩家的已出牌记录
        trump: 主牌信息 {'suit': 'hearts', 'rank': '2'}

    Returns:
        要出的牌列表
    """
    if not deck:
        return []
    
    # 获取级牌信息
    trump_rank = None
    trump_suit = None
    if trump:
        trump_rank = trump.get('rank', '2')
        trump_suit = trump.get('suit')
        # 将rank转换为bot格式
        if trump_rank == '10':
            trump_rank = '0'
    
    # 将牌按花色分组，级牌分开处理
    # 大小王和级牌单独归为trump组
    suits = {'h': [], 'd': [], 's': [], 'c': [], 'trump': []}
    
    # 主花色的字母映射
    suit_map = {'hearts': 'h', 'diamonds': 'd', 'spades': 's', 'clubs': 'c'}
    trump_suit_char = suit_map.get(trump_suit, None)
    
    for card in deck:
        if card == 'jo' or card == 'Jo':
            suits['trump'].append(card)
        elif trump_rank and len(card) > 1 and card[1:] == trump_rank:
            # 级牌归入trump
            suits['trump'].append(card)
        elif trump_suit_char and card[0] == trump_suit_char:
            # 主花色归入trump
            suits['trump'].append(card)
        elif card[0] in suits:
            suits[card[0]].append(card)
    
    # 定义牌值排序（越小越好先出）
    rank_order = {'2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6, '9': 7, '0': 8, 'J': 9, 'Q': 10, 'K': 11, 'A': 12}
    
    def get_rank_value(card):
        if card in ['jo', 'Jo']:
            return 100  # 大小王最大
        return rank_order.get(card[1:], 50)
    
    # 对每个花色的牌排序
    for suit in suits:
        suits[suit].sort(key=get_rank_value)
    
    # 如果没有历史记录，说明是开局，出同一花色最小的1张牌（非trump）
    if not history or len(history) == 0:
        # 找一个非空的副牌花色
        for suit in ['h', 'd', 's', 'c']:
            if suits[suit]:
                return [suits[suit][0]]  # 出最小的一张
        # 如果只有trump牌
        if suits['trump']:
            return [suits['trump'][0]]
        return [deck[0]]
    
    # 获取本轮首发的牌
    first_play = history[0] if history else []
    if not first_play:
        # 没有首发牌，自己首发
        for suit in ['h', 'd', 's', 'c']:
            if suits[suit]:
                return [suits[suit][0]]
        if suits['trump']:
            return [suits['trump'][0]]
        return [deck[0]]
    
    # 确定首发的花色
    first_card = first_play[0] if first_play else None
    num_to_play = len(first_play)
    
    lead_suit = None
    if first_card:
        if first_card in ['jo', 'Jo']:
            lead_suit = 'trump'
        elif trump_rank and len(first_card) > 1 and first_card[1:] == trump_rank:
            lead_suit = 'trump'
        elif trump_suit_char and first_card[0] == trump_suit_char:
            lead_suit = 'trump'
        elif first_card[0] in suits:
            lead_suit = first_card[0]
    
    # 找同花色的牌
    if lead_suit and suits.get(lead_suit):
        same_suit_cards = suits[lead_suit]
        cards_to_play = same_suit_cards[:min(num_to_play, len(same_suit_cards))]
        return cards_to_play
    
    # 如果没有同花色的牌，出trump或其他花色的最小牌
    if suits['trump']:
        cards_to_play = suits['trump'][:min(num_to_play, len(suits['trump']))]
        return cards_to_play
    
    for suit in ['h', 'd', 's', 'c']:
        if suits[suit]:
            cards_to_play = suits[suit][:min(num_to_play, len(suits[suit]))]
            return cards_to_play
    
    # 兜底：随机选择
    return [deck[0]] if deck else []


def main():
    """主函数：从stdin读取游戏状态，输出决策"""
    try:
        # 读取输入
        input_data = sys.stdin.read()
        print(f"[simple_bot] 接收到输入: {input_data}", file=sys.stderr)

        game_state = json.loads(input_data)
        print(f"[simple_bot] 解析后的游戏状态: {json.dumps(game_state)}", file=sys.stderr)

        # 提取游戏状态
        player_id = game_state.get('id', 0)
        deck = game_state.get('deck', [])
        history = game_state.get('history', [])
        major = game_state.get('major', [])
        played = game_state.get('played', [[], [], [], []])
        trump = game_state.get('trump', None)

        print(f"[simple_bot] player_id={player_id}, deck_size={len(deck)}, history_size={len(history)}", file=sys.stderr)
        print(f"[simple_bot] deck={deck}", file=sys.stderr)
        print(f"[simple_bot] trump={trump}", file=sys.stderr)

        # 如果没有手牌，返回空动作
        if not deck:
            print(f"[simple_bot] 没有手牌，返回空动作", file=sys.stderr)
            response = {
                'player': player_id,
                'action': []
            }
            print(json.dumps(response))
            return

        # 使用智能策略
        action = get_smart_action(deck, history, played, trump)
        print(f"[simple_bot] 决策完成，选择的牌: {action}", file=sys.stderr)

        # 构建响应
        response = {
            'player': player_id,
            'action': action
        }

        # 输出JSON响应
        print(f"[simple_bot] 输出响应: {json.dumps(response)}", file=sys.stderr)
        print(json.dumps(response))

    except Exception as e:
        # 错误处理：返回空动作（输出到stdout以便正确解析）
        print(f"Error in simple_bot: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)

        # 即使出错，也要输出有效的JSON到stdout
        response = {
            'player': 0,
            'action': []
        }
        print(json.dumps(response))
        sys.exit(0)  # 正常退出，因为已经输出了有效的响应


if __name__ == '__main__':
    main()
