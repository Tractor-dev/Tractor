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


def get_smart_action(deck, history, played):
    """
    稍微智能一点的策略：
    1. 如果是第一次出牌或轮到自己开局，出最小的1-2张牌
    2. 否则跟着前面的玩家出相同数量的牌

    Args:
        deck: 手牌列表
        history: 最近的出牌历史
        played: 所有玩家的已出牌记录

    Returns:
        要出的牌列表
    """
    if not deck:
        return []

    # 如果没有历史记录，说明是开局，出最小的1-2张牌
    if not history or len(history) == 0:
        num_cards = random.randint(1, min(2, len(deck)))
        # 简单排序（按字母顺序），取前几张
        sorted_deck = sorted(deck)
        return sorted_deck[:num_cards]

    # 获取最近一次出牌的数量
    last_play = history[-1] if history else []
    num_to_play = len(last_play) if last_play else 1

    # 确保不超过手牌数量
    num_to_play = min(num_to_play, len(deck))

    # 随机选择相应数量的牌
    if num_to_play > 0:
        return random.sample(deck, num_to_play)
    else:
        return [random.choice(deck)]


def main():
    """主函数：从stdin读取游戏状态，输出决策"""
    try:
        # 读取输入
        input_data = sys.stdin.read()
        game_state = json.loads(input_data)

        # 提取游戏状态
        player_id = game_state.get('id', 0)
        deck = game_state.get('deck', [])
        history = game_state.get('history', [])
        major = game_state.get('major', [])
        played = game_state.get('played', [[], [], [], []])

        # 如果没有手牌，返回空动作
        if not deck:
            response = {
                'player': player_id,
                'action': []
            }
            print(json.dumps(response))
            return

        # 使用智能策略（可以改为 get_random_action 使用随机策略）
        action = get_smart_action(deck, history, played)

        # 构建响应
        response = {
            'player': player_id,
            'action': action
        }

        # 输出JSON响应
        print(json.dumps(response))

    except Exception as e:
        # 错误处理：返回空动作
        print(json.dumps({
            'player': 0,
            'action': []
        }), file=sys.stderr)
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
