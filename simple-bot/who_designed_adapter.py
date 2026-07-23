#!/usr/bin/env python3
"""Adapter between the Tractor server snapshot and the WhoDesigned strategy."""

import json
import os
import sys
import types


# mvGen imports numpy but never uses it.  Supplying a tiny placeholder keeps the
# deployment dependency-free while leaving the original bot repository intact.
sys.modules.setdefault("numpy", types.ModuleType("numpy"))

WHO_DESIGNED_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "WhoDesigned")
)
sys.path.insert(0, WHO_DESIGNED_DIR)

from mvGen import move_generator  # noqa: E402
from myutils import get_action_options, setMajor  # noqa: E402


CARD_SCALE = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "0", "J", "Q", "K"]
SUITS = ["s", "h", "c", "d"]


def card_base_id(card_name):
    if card_name == "jo":
        return 52
    if card_name == "Jo":
        return 53
    return CARD_SCALE.index(card_name[1]) * 4 + SUITS.index(card_name[0])


class CardAllocator:
    def __init__(self):
        self.available = set(range(108))

    def allocate(self, card_name):
        base = card_base_id(card_name)
        for card_id in (base, base + 54):
            if card_id in self.available:
                self.available.remove(card_id)
                return card_id
        raise ValueError(f"Too many copies of card {card_name}")


def normalize_level(level):
    return "0" if str(level) == "10" else str(level)


def protect_point_trick_with_trump(generator, hand_ids, current_trick, history_ids, action):
    """Keep WhoDesigned's heuristics, but close its unsafe single-card point gap.

    When this player is void in the led side suit, protect table points if an
    opponent is currently winning, or if a known-void opponent still acts after
    a winning teammate. This uses the same empty-suit memory as the original
    full-request constructor.
    """
    if not current_trick or any(len(cards) != 1 for cards in history_ids):
        return action

    lead = generator.Num2Poker(history_ids[0][0])
    if generator.isMajor(lead):
        return action
    lead_suit = generator.get_suit(lead)

    hand_pokers = [generator.Num2Poker(card_id) for card_id in hand_ids]
    if any(not generator.isMajor(card) and card[0] == lead_suit for card in hand_pokers):
        return action

    if not any(
        generator.Num2Poker(card_id)[1] in ("5", "0", "K")
        for cards in history_ids
        for card_id in cards
    ):
        return action

    winner_position = 0
    winner = generator.Num2Poker(history_ids[0][0])
    for position in range(1, len(history_ids)):
        challenger = generator.Num2Poker(history_ids[position][0])
        if challenger != winner and generator.bigger_card(winner, challenger) == challenger:
            winner = challenger
            winner_position = position

    winner_id = int(current_trick[winner_position]["playerIndex"])
    should_trump = winner_id != generator.teammate_id
    if not should_trump and winner_id == generator.teammate_id:
        already_played = {int(play["playerIndex"]) for play in current_trick}
        future_opponents = [
            player_id
            for player_id in range(4)
            if player_id not in already_played
            and player_id != generator.selfid
            and player_id != generator.teammate_id
        ]
        should_trump = any(
            lead_suit in generator.empty_suits[player_id]
            and generator.major not in generator.empty_suits[player_id]
            for player_id in future_opponents
        )

    if not should_trump:
        return action

    trumps = [
        card_id
        for card_id in hand_ids
        if generator.isMajor(generator.Num2Poker(card_id))
    ]
    trumps.sort(key=lambda card_id: generator.card_level(generator.Num2Poker(card_id)))
    for card_id in trumps:
        poker = generator.Num2Poker(card_id)
        if not generator.isMajor(winner) or generator.card_level(poker) > generator.card_level(winner):
            return [card_id]
    return action


def main():
    data = json.loads(sys.stdin.read())
    player_id = int(data.get("id", 0))
    hand_names = data.get("deck", [])
    played_names = data.get("played", [[], [], [], []])
    current_trick = data.get("history", [])
    empty_suits = data.get("emptySuits", [[], [], [], []])
    level = normalize_level(data.get("level", "2"))
    major = data.get("trumpSuit") or "n"

    allocator = CardAllocator()
    played_ids = [[], [], [], []]
    for index in range(4):
        for card_name in played_names[index]:
            played_ids[index].append(allocator.allocate(card_name))

    hand_ids = [allocator.allocate(card_name) for card_name in hand_names]

    # Current-trick cards are the tail of each player's cumulative played list.
    history_ids = []
    for play in current_trick:
        index = int(play["playerIndex"])
        count = len(play["cards"])
        history_ids.append(played_ids[index][-count:] if count else [])

    setMajor(major, level)
    generator = move_generator(level, major)
    generator.selfid = player_id
    generator.teammate_id = (player_id + 2) % 4
    generator.next_id = (player_id + 1) % 4
    generator.prev_id = (player_id + 3) % 4
    generator.hold = hand_ids[:]
    generator.played = played_ids
    generator.empty_suits = [
        list(dict.fromkeys(empty_suits[index])) if index < len(empty_suits) else []
        for index in range(4)
    ]
    generator.cards_left = sorted(allocator.available)
    generator.organized_hold_cards = generator.organize_cards(generator.hold)
    generator.organized_left_cards = generator.organize_cards(generator.cards_left)

    options = get_action_options(hand_ids, history_ids, level, generator)
    action = options[0] if options and options[0] else []
    if not isinstance(action, list):
        action = [action]
    action = protect_point_trick_with_trump(
        generator,
        hand_ids,
        current_trick,
        history_ids,
        action,
    )
    action_names = [generator.Num2Poker(card_id) for card_id in action]

    print(json.dumps({"player": player_id, "action": action_names}))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"WhoDesigned adapter failed: {exc}", file=sys.stderr)
        raise
