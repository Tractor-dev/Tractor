from textwrap import indent
import numpy as np
from collections import Counter
from itertools import combinations

import myutils
class move_generator():
    def __init__(self, level, major,req=None):
        self.card_scale = myutils.cardscale
        self.suit_set = myutils.suitset
        self.point_order = myutils.pointorder
        self.value_cards = myutils.valuecards
        self.Major = myutils.Major
        self.major = major
        self.level = level
        
        # 初始化手牌、已打牌和剩余牌
        self.hold = []  # 玩家手牌
        self.played = [[], [], [], []]  # 每个玩家已打牌
        self.cards_left = []  # 剩余牌
        self.selfid = -1  # 玩家编号
        self.teammate_id = -1  # 队友编号
        self.next_id = -1  # 下家编号
        self.prev_id = -1  # 上家编号
        self.empty_suits = [[], [], [], []]  # 空花色
        for i in range(108):
            self.cards_left.append(i)

        if req is not None:
            # 还原历史
            lenreq = len(req["requests"])
            self.selfid = req["requests"][0]["playerpos"]
            self.teammate_id = (self.selfid + 2) % 4
            self.next_id = (self.selfid + 1) % 4
            self.prev_id = (self.selfid + 3) % 4
            for i in range(len(req["requests"])):
                stage_req = req["requests"][i]
                if stage_req["stage"] == "deal":
                    self.hold.extend(stage_req["deliver"])
                    for card in stage_req["deliver"]:
                        self.cards_left.remove(card)
                elif stage_req["stage"] == "cover":
                    self.hold.extend(stage_req["deliver"])
                    for card in stage_req["deliver"]:
                        self.cards_left.remove(card)
                    if i < lenreq - 1:
                        action_cover = req["responses"][i]
                        for card in action_cover:
                            self.hold.remove(card)
                elif stage_req["stage"] == "play":
                    history = stage_req["history"]
                    if len(history[0]) != 0:
                        self_move = history[0][(self.selfid - history[2]) % 4]
                        first_id=history[2]
                        first_card=self.Num2Poker(history[0][0][0])
                        if self.isMajor(first_card):
                            for i in range(3):
                                if any([not self.isMajor(self.Num2Poker(card)) for card in history[0][i+1]]):
                                    self.empty_suits[(first_id+i+1)%4].append(self.major)
                        else:
                            for i in range(3):
                                if any([(self.Num2Poker(card)[0]!=first_card[0]or self.isMajor(self.Num2Poker(card))) for card in history[0][i+1]]):
                                    self.empty_suits[(first_id+i+1)%4].append(self.get_suit(first_card))
                        for card in self_move:
                            self.hold.remove(card)
                        for player_rec in range(len(history[0])):
                            self.played[(history[2] + player_rec) % 4].extend(history[0][player_rec])
                            if player_rec != (self.selfid - history[2]) % 4:
                                for card in history[0][player_rec]:
                                    self.cards_left.remove(card)
            # 还原当前请求
            curr_request = req["requests"][-1]
            if curr_request["stage"] == "play":
                his_current=curr_request["history"][1]
                for cards in his_current:
                    for card in cards:
                        self.cards_left.remove(card)      
            self.organized_hold_cards = self.organize_cards(self.hold)
            self.organized_left_cards = self.organize_cards(self.cards_left)      
        # else:# test cover
        #     import random
        #     self.all_cards = list(range(108))
        #     self.hold = random.sample(self.all_cards, 32)
        #     self.cards_left = [card for card in self.all_cards if card not in self.hold]
        #     self.organized_hold_cards = self.organize_cards(self.hold)
        #     self.organized_left_cards = self.organize_cards(self.cards_left)
        #     print(self.organized_hold_cards["other_suits_cards"]['h'])
        #     print(self.organized_hold_cards["other_suits_cards"]['d'])
        #     print(self.organized_hold_cards["other_suits_cards"]['s'])
            
    # train
    def reset(self,player,deck,played):
        # self_id, teammate_id, next_id, prev_id, hold, card_left
        self.selfid = player
        self.teammate_id = (self.selfid + 2) % 4
        self.next_id = (self.selfid + 1) % 4
        self.prev_id = (self.selfid + 3) % 4
        self.hold = deck[player]+[]
        all_played = played[0] + played[1] + played[2] + played[3]
        self.cards_left = [card for card in range(108) if card not in all_played]
        self.organized_hold_cards = self.organize_cards(self.hold)
        self.organized_left_cards = self.organize_cards(self.cards_left)  
        

    # 埋牌

    def cover_Pub(self):
        # 找到每个副花色并排序
        converted_cards = [self.Num2Poker(card) for card in self.hold]
        other_suits_cards = {suit: [] for suit in self.suit_set if suit != self.major}
        other_useless_singles = {suit: [] for suit in self.suit_set if suit != self.major}
        other_value_singles = {suit: [] for suit in self.suit_set if suit != self.major}
        other_useless_pairs = {suit: [] for suit in self.suit_set if suit != self.major}
        for card in converted_cards:   
            if not self.isMajor(card):
                other_suits_cards[card[0]].append(card)
        # 去掉各个花色不打算埋的牌
        for suit in other_suits_cards:
            other_suits_cards[suit].sort(key=lambda x: self.card_level(x))
            singles, pairs = self.divide_suit(other_suits_cards[suit])
            other_useless_singles[suit] = [p for p in singles if ((p not in pairs) and (not self.is_value(p)) and (not self.is_largest_single(p)))]
            other_value_singles[suit] = [p for p in singles if ((p not in pairs) and self.is_value(p))]
            other_useless_pairs[suit] = [p for p in pairs if ((not self.is_value(p)) and (not self.is_largest_pair(p)))] # 还要考虑一下拖拉机
        
        other_useless_singles = dict(sorted(other_useless_singles.items(), key=lambda item: len(item[1])))
        other_value_singles = dict(sorted(other_value_singles.items(), key=lambda item: len(item[1])))
        other_useless_pairs = dict(sorted(other_useless_pairs.items(), key=lambda item: len(item[1])))
        
        major_singles = self.organized_hold_cards["main_suit_cards"]["singles"]
        major_pairs = self.organized_hold_cards["main_suit_cards"]["pairs"]
                
        public_cards = []
        for suit, singles in other_useless_singles.items():# 先埋散牌
            len_singles = len(singles)
            len_left = 8 - len(public_cards)
            if len_singles >= len_left:
                public_cards.extend(singles[:len_left])
                break
            else:
                public_cards.extend(singles)
        while len(public_cards) < 8:
            len_left = 8 - len(public_cards)
            existvalue = 0
            if existvalue == 0: # 补一张分
                for suit, singles in other_value_singles.items():
                    if len(singles) > 0:
                        public_cards.append(singles[0])
                        other_value_singles[suit].remove(singles[0])
                        existvalue = 1
                        break
            if existvalue == 0: # 拆副对
                for suit, pairs in other_useless_pairs.items():
                    if len(pairs) > 0 and len_left >= 2:
                        public_cards.append(pairs[0])
                        public_cards.append(pairs[0])
                        other_useless_pairs[suit].remove(pairs[0])
                        existvalue = 1
                        break
            if existvalue == 0:# 补一张主
               for major_single in major_singles:
                   if major_single not in major_pairs and not self.is_value(major_single):
                       public_cards.append(major_single)
                       major_singles.remove(major_single)
                       existvalue = 1
                       break
            if existvalue == 0: # 拆主对
                public_cards.append(major_pairs[0])
                major_singles.append(major_pairs[0])
                major_pairs.remove(major_pairs[0])

        #print(public_cards)
        return self.Poker2Num_seq(public_cards)

    # 生成出法(学习)

    def gen_single_options(self,tgt):
        suit=self.get_suit(tgt[0])
        options = []
        if not self.isMajor(tgt[0]):
            options.append([self.play_small(suit)])
            options.append([self.play_large(suit)])
            options.append([self.other_value(suit)])
        options.append([self.play_small()])
        options.append([self.other_value()])
        options.append([self.play_small_major()])
        options.append([self.major_value()])
        if self.major != 'n':
            card_to_beat = self.get_card_to_beat()
            if card_to_beat!= None:
                options.append([self.beat_card(card_to_beat)])
        options_1 = [option for option in options if option[0] != None]
        if suit != self.major:
            if self.have_single(suit):
                options_2 = [option for option in options_1 if (option[0][0] == suit and not self.isMajor(option[0]))]
                return options_2
            return options_1
        if self.have_major():
            options_2 = [option for option in options_1 if self.isMajor(option[0])]
            return options_2
        return options_1
    
    def gen_action_options(self):
        options = []
        #拖拉机：
        for suit in self.organized_hold_cards["other_suits_cards"]:
            options.append(self.play_tractor(suit,first=True))
        options.append(self.play_major_tractor(first=True))

        #大牌
        for suit in self.organized_hold_cards["other_suits_cards"]:
            options.append(self.play_other_suit(suit))
            
        #队友没有的花色
        for suit in self.organized_hold_cards["other_suits_cards"]:
            oth_v = self.other_value(suit)
            if oth_v!= None:
                options.append([oth_v])
            oth_s = self.play_small(suit)
            if oth_s != None:
                options.append([oth_s])
                
        #副对子
        for suit in self.organized_hold_cards["other_suits_cards"]:
            options.append(self.play_large_pair(suit))

        #出主
        options.append(self.play_large_major_pair())
        small_major = self.play_small_major()
        if small_major!= None:
            options.append([small_major])
        if self.major != 'n':
            card_to_beat = self.get_card_to_beat()
            if card_to_beat!= None:
                bc = self.beat_card(card_to_beat)
                if bc != None:
                    options.append([self.beat_card(card_to_beat)])
        
        #副单牌
        for suit in self.organized_hold_cards["other_suits_cards"]:
            options.append(self.play_single(suit))

        options_1 = [option for option in options if option != None]

        return options_1
    
    # 生成出法(启发式)

    def gen_single_new(self, history):
        first_card=self.Num2Poker(history[0][0])
        suit=self.get_suit(first_card)
        if not self.isMajor(first_card):
            if self.teammate_trump(history,suit): #队友大了
                if len(self.organized_hold_cards["other_suits_cards"][suit]["singles"])==0:
                    suit=None
                result= self.other_value(suit)
                if result == None:
                    result = self.play_small(suit)
                if result == None:
                    result = self.major_value()
                if result == None:
                    result = self.play_small()
                if result == None:
                    result = self.play_small_major()
                return [result]
            else:
                if len(self.organized_hold_cards["other_suits_cards"][suit]["singles"])==0:#我这门空了，尝试毙牌
                    card_to_beat=None#寻找需要毙的最大牌
                    for card in self.organized_left_cards["main_suit_cards"]["singles"]:
                        if self.is_value(card):#至少盖过最大分
                            card_to_beat=card

                    if(len(history)==1):#上家出牌
                        if(self.empty_suits[self.next_id].count(suit)==0):#下家还有
                            card_to_beat=None#不用怕被盖毙
                        if card_to_beat==None:
                            result=self.major_value() #找到一张主的分牌
                            if(self.empty_suits[self.next_id].count(suit)!=0 and not self.is_largest_single(result)):#下家没有且分不大
                                result = None
                            if result==None:
                                result=self.play_small_major() #找到一张主的小牌
                            if result==None:
                                result=self.play_small() #找到一张非主的小牌
                        else:
                            result=self.beat_card(card_to_beat) #盖毙
                            if result==None:
                                result=self.play_small() #找到一张非主的小牌
                            if result==None:
                                result=self.play_small_major() #找到一张主的小牌
                        return [result]
                    elif(len(history)==2):#队友出牌
                        second_card=self.Num2Poker(history[1][0])
                        if self.isMajor(second_card):#被毙了
                            card_to_beat=self.bigger_card(card_to_beat,second_card)#盖毙
                        elif (self.empty_suits[self.next_id].count(suit)==0):#下家还有
                            card_to_beat=None  #不用怕被盖毙
                        if card_to_beat==None:
                            result=self.major_value() #找到一张主的分牌
                            if(self.empty_suits[self.next_id].count(suit)!=0 and not self.is_largest_single(result)):#下家没有且分不大
                                result = None
                            if result==None:
                                result=self.play_small_major() #找到一张主的小牌
                            if result==None:
                                result=self.play_small() #找到一张非主的小牌
                        else:
                            result=self.beat_card(card_to_beat) #盖毙
                            if result==None:
                                result=self.play_small() #找到一张非主的小牌
                            if result==None:
                                result=self.play_small_major() #找到一张主的小牌
                        return [result]
                    elif(len(history)==3): #下家出牌
                        first_card=self.Num2Poker(history[0][0])
                        third_card=self.Num2Poker(history[2][0])
                        big_card=self.bigger_card(first_card,third_card)
                        if self.value_in(history) and self.isMajor(big_card):  #有分，且被毙了  #此时没有通过teammate_trump，只能是对面大
                                card_to_beat=big_card #盖毙
                        else:
                            card_to_beat=None
                        if card_to_beat==None:
                            result=self.major_value() #找到一张主的分牌
                            if(result != None and self.isMajor(big_card) and self.card_level(result) <= self.card_level(big_card)):# 这张分不能拿下
                                result = None
                            if result == None:
                                result=self.play_small() #找到一张非主的小牌
                            if result==None:
                                result=self.play_small_major() #找到一张主的小牌
                        else:
                            result=self.beat_card(card_to_beat) #盖毙
                            if result==None:
                                result=self.play_small() #找到一张非主的小牌
                            if result==None:
                                result=self.play_small_major() #找到一张主的小牌
                        return [result]
                else: #我这门还有牌
                     result=None
                     if(len(history)==1 ): #上家出牌
                        large_card = self.largest_single_left(suit)
                        big_card = self.bigger_card(large_card,first_card)
                        if large_card != None and large_card == big_card:
                            result = self.beat_card(large_card,if_equal=True) #盖过上家，以及剩余牌中的最大单牌
                        else:
                            result = self.beat_card(first_card,if_equal=False) #盖过上家，以及剩余牌中的最大单牌
                     elif (len(history)==2):    #队友出牌
                        second_card=self.Num2Poker(history[1][0])
                        large_card = self.largest_single_left(suit)
                        big_card = self.bigger_card(large_card,second_card)
                        result=self.beat_card(self.bigger_card(self.largest_single_left(suit),second_card))  #盖过上家，以及剩余牌中的最大单牌
                        if large_card != None and large_card == big_card:
                            result = self.beat_card(large_card,if_equal=True) #盖过上家，以及剩余牌中的最大单牌
                            if result==None: #盖不过，至少盖过上家
                                if self.card_level(second_card)>self.card_level(first_card) and second_card[0]==suit:
                                    result=self.beat_card(second_card,if_equal=False)
                        else:
                            result = self.beat_card(second_card,if_equal=False) #盖过上家，以及剩余牌中的最大单牌
                     elif (len(history)==3): #下家出牌
                        first_card=self.Num2Poker(history[0][0])
                        third_card=self.Num2Poker(history[2][0])
                        if not self.isMajor(third_card):#上家没毙
                            result=self.beat_card(self.bigger_card(first_card,third_card))
                     if result != None and (result[0] != suit or self.isMajor(result)):
                         result = None
                     if result==None:
                         result=self.play_small(suit)
                     return [result]
        else:#主牌
            if self.teammate_trump_major(history): #队友大了
                if len(self.organized_hold_cards["main_suit_cards"]["singles"])==0:
                    result= self.other_value()
                    if result == None:
                        result = self.play_small()
                    return [result]
                else:
                    result=self.major_value()
                    if result == None:
                        result = self.play_small_major()
                    return [result]
            card_to_beat=None
            first_card=self.Num2Poker(history[0][0])
            result=None
            for card in self.organized_left_cards["main_suit_cards"]["singles"]:
                if self.is_value(card):#至少盖过最大分
                    card_to_beat=card
            if(len(history)==1):#上家出牌
                card_to_beat=self.bigger_card(card_to_beat,first_card) #盖过上家
            elif (len(history)==2):   #队友出牌
                second_card=self.Num2Poker(history[1][0])
                if self.card_level(second_card)<=self.card_level(first_card):#队友大
                    if self.card_level(first_card)>self.card_level(card_to_beat):#队友大过最大分
                        card_to_beat = None
                else:#队友小
                    card_to_beat=second_card
            elif(len(history)==3): #下家出牌
                second_card=self.Num2Poker(history[1][0])
                third_card=self.Num2Poker(history[2][0])
                card_to_beat=None
                if self.card_level(third_card)<=self.card_level(second_card) and self.card_level(second_card)>self.card_level(first_card): #队友大
                    result = self.major_value() #找到一张主的分牌
                elif self.value_in(history): #有分
                    card_to_beat=self.bigger_card(first_card,third_card) #盖过上家和下家
            if card_to_beat!=None:
                result=self.beat_card(card_to_beat)
            if result==None:
                result=self.play_small_major()
            if result==None:
                result=self.play_small()
            return [result]
        
    def gen_pair_new(self, history):
        first_card=self.Num2Poker(history[0][0])
        first_cards=self.Num2Poker(history[0])
        suit=self.get_suit(first_card)
        if not self.isMajor(first_card):
            if len(self.organized_hold_cards["other_suits_cards"][suit]["singles"])==0 :#我这门空了，尝试毙牌
                if(len(history)==1):#上家出牌
                    if self.have_major_pair(): #有对就毙
                        return self.play_major_value_pair() #试图找到一对主
                    else:#无对垫牌
                        return self.play_small_tachi(2,suit)
                elif(len(history)==2):#队友出牌
                    second_cards=self.Num2Poker(history[1])
                    teammate_win = self.bigger_pair(first_cards,second_cards) == first_cards
                    if teammate_win:# 队友大
                        return self.play_value_tachi(2) # 优先给分
                    else:   
                        if self.have_major_pair():
                            mypair = self.beat_pair(second_cards)#尝试盖过上家
                            if self.bigger_pair(second_cards, mypair) == mypair: # 打得过
                                return mypair
                            else:# 打不过
                                return self.play_small_tachi(2)
                        else:# 无主对
                            return self.play_small_tachi(2)
                elif(len(history)==3): #下家出牌
                    second_cards=self.Num2Poker(history[1])
                    third_cards=self.Num2Poker(history[2])
                    teammate_win = (not self.bigger_pair(first_cards,second_cards)==first_cards and self.bigger_pair(second_cards,third_cards) == second_cards)
                    if teammate_win:# 队友大
                        return self.play_value_tachi(2) # 优先给分
                    else:
                        if self.have_major_pair() and self.value_in(history):
                            mypair = self.beat_pair(self.bigger_pair(first_cards,third_cards))#尝试盖过对面
                            if self.bigger_pair(third_cards,mypair) == mypair: # 打得过
                                return mypair
                        return self.play_small_tachi(2) # 无主对或无分或对面大
            else: #我这门还有牌
                 result=None
                 if(len(history)==1): #上家出牌
                    if self.have_pair(suit): #有对出对
                        return self.beat_pair(first_cards)#尝试盖过上家
                    else:#无对垫牌
                        return self.play_small_tachi(2,suit)
                 elif (len(history)==2):    #队友出牌
                    second_cards=self.Num2Poker(history[1])
                    teammate_win = self.bigger_pair(first_cards,second_cards) == first_cards
                    if teammate_win:# 队友大
                        if self.have_pair(suit):
                            result = self.play_value_pair(suit) # 优先给分
                            if result == None:
                                result = self.play_large_pair(suit) # 从大到小
                            return result
                        else:
                            return self.play_value_tachi(2,suit)
                    else:
                        if self.have_pair(suit):
                            if (not self.isMajor(second_cards[0])):
                                return self.beat_pair(second_cards)#尝试盖过上家
                            return self.play_small_pair(suit)
                        else:
                            return self.play_small_tachi(2,suit)
                 elif (len(history)==3): #下家出牌
                    second_cards=self.Num2Poker(history[1])
                    third_cards=self.Num2Poker(history[2])
                    teammate_win = (not self.bigger_pair(first_cards,second_cards)==first_cards and self.bigger_pair(second_cards,third_cards)==second_cards)
                    if teammate_win:# 队友大
                        if self.have_pair(suit):
                            result = self.play_value_pair(suit) # 优先给分
                            if result == None:
                                result = self.play_small_pair(suit) # 从小到大
                            return result
                        else:
                            return self.play_value_tachi(2,suit)
                    else:# 对面大
                        big_cards = self.bigger_pair(first_cards,third_cards)
                        if self.have_pair(suit):
                            if (not self.isMajor(big_cards[0])):
                                return self.beat_pair(big_cards)#尝试盖过对面
                            return self.play_small_pair(suit)
                        else:
                            return self.play_small_tachi(2,suit)
        else:#主牌
            first_card=self.Num2Poker(history[0][0])
            first_cards=self.Num2Poker(history[0])
            result=None
            if(len(history)==1):#上家出牌
                if self.have_major_pair(): #有对出对
                        return self.beat_pair(first_cards)#尝试盖过上家
                else:#无对垫牌
                    return self.play_small_major_tachi(2)
            elif (len(history)==2):   #队友出牌
                second_cards=self.Num2Poker(history[1])
                teammate_win = self.bigger_pair(first_cards,second_cards) == first_cards
                if teammate_win:# 队友大
                    if self.have_major_pair():
                        result = self.play_major_value_pair() # 优先给分 
                        if result == None:
                            result = self.play_small_major_pair() # 从小到大
                        return result
                    else:
                        return self.play_major_value_tachi(2)
                else:
                    if self.have_major_pair():
                        return self.beat_pair(second_cards)#尝试盖过上家
                    else:
                        return self.play_small_major_tachi(2)
            elif(len(history)==3): #下家出牌
                second_cards=self.Num2Poker(history[1])
                third_cards=self.Num2Poker(history[2])
                teammate_win = (not self.bigger_pair(first_cards,second_cards)==first_cards and self.bigger_pair(second_cards,third_cards)==second_cards)
                if teammate_win:# 队友大
                    if self.have_major_pair():
                        result = self.play_major_value_pair() # 优先给分
                        if result == None:
                            result = self.play_small_major_pair() # 从小到大
                        return result
                    else:
                        return self.play_major_value_tachi(2)
                else:# 对面大
                    if self.have_major_pair():
                        if self.value_in(history):
                            return self.beat_pair(self.bigger_pair(first_cards,third_cards))#尝试盖过对面
                        else:
                            return self.play_small_major_pair() # 无分或对面大
                    else:
                        return self.play_small_major_tachi(2)       
        return result
    
    def gen_tractor_new(self, history):#假设1号位是大的orz
        first_card = self.Num2Poker(history[0][0])
        first_cards = self.Num2Poker(history[0])
        tractor_len = len(first_cards)
        suit = self.get_suit(first_card)
        result = None
        if not self.isMajor(first_card):#非主
            if len(history) == 1 or len(history) == 3: #对面出牌
                result = self.play_tractor(suit,tractor_len) # 有拖打拖
                if result == None:# 无拖垫牌
                    result = self.play_small_pair_tachi(tractor_len,suit)
            elif len(history) == 2: #队友出牌
                result = self.play_tractor(suit,tractor_len) # 有拖打拖
                if result == None:# 无拖垫牌
                    result = self.play_value_pair_tachi(tractor_len,suit)
        else:#主牌
            if len(history) == 1 or len(history) == 3: #对面出牌
                result = self.play_major_tractor(tractor_len) # 有拖打拖
                if result == None:# 无拖垫牌
                    result = self.play_small_major_pair_tachi(tractor_len)
            elif len(history) == 2: #队友出牌
                result = self.play_major_tractor(tractor_len) # 有拖打拖
                if result == None:# 无拖垫牌
                    result = self.play_major_value_pair_tachi(tractor_len)
        return result
    
    def gen_throw_new(self, history):#假设只有队友会甩牌(一对加一张)且没有人会毙orz
        first_card = self.Num2Poker(history[0][0])
        first_cards = self.Num2Poker(history[0])
        suit = self.get_suit(first_card)
        first_count = Counter(first_cards)
        outpok = []
        for k,v in first_count.items(): # 对牌型作基础的拆分 
            outpok.append([k for i in range(v)])
        result_all = []
        for tgt in outpok:
            result = None
            move_uni = []
            if not self.isMajor(first_card):#非主
                if len(history) == 1 or len(history) == 3: #对面出牌
                    if len(tgt) == 0:
                        move_uni = []
                    elif len(tgt) == 1:
                        result = self.play_small(suit)
                        if result == None:
                            result = self.play_small()
                        if result == None:
                            result = self.play_small_major()
                        move_uni.append(result)
                        self.remove_one_card(result)
                    elif len(tgt) == 2:
                        if self.have_pair(suit):
                            result = self.play_small_pair(suit)
                            self.remove_one_pair(result[0])
                        else:
                            result = self.play_small_tachi(2,suit)
                        move_uni = result
                    elif len(tgt) > 2: 
                        result = self.play_small_tachi(len(tgt),suit)
                        move_uni = result
                elif len(history) == 2: #队友出牌
                    if len(tgt) == 0:
                        move_uni = []
                    elif len(tgt) == 1:
                        result= self.other_value(suit)
                        if result == None:
                            result = self.play_small(suit)
                        if result == None:
                            result = self.major_value()
                        if result == None:
                            result = self.play_small()
                        if result == None:
                            result = self.play_small_major()
                        move_uni.append(result)
                        self.remove_one_card(result)
                    elif len(tgt) == 2:
                        if self.have_pair(suit):
                            result = self.play_value_pair(suit) # 优先给分
                            if result == None:
                                result = self.play_small_pair(suit) # 从小到大
                            self.remove_one_pair(result[0])
                        else:
                            result = self.play_value_tachi(2,suit)
                        move_uni = result
                    elif len(tgt) > 2: 
                        result = self.play_value_tachi(len(tgt),suit)
                        move_uni = result
            else:#主牌(好像不会甩)
                if len(history) == 1 or len(history) == 3: #对面出牌
                    if len(tgt) == 0:
                        move_uni = []
                    elif len(tgt) == 1:
                        result = self.play_small_major()
                        if result == None:
                            result = self.play_small()
                        move_uni.append(result)
                        self.remove_one_card(result)
                    elif len(tgt) == 2:
                        if self.have_major_pair():
                            result = self.play_small_major_pair()
                            self.remove_one_pair(result[0])
                        else:
                            return self.play_small_major_tachi(2)
                        move_uni = result
                    elif len(tgt) > 2: 
                        result = self.play_small_major_tachi(len(tgt))
                        move_uni = result
                elif len(history) == 2: #队友出牌
                    if len(tgt) == 0:
                        move_uni = []
                    elif len(tgt) == 1:
                        result= self.major_value()
                        if result == None:
                            result = self.play_small_major()
                        if result == None:
                            result = self.other_value()
                        if result == None:
                            result = self.play_small()
                        move_uni.append(result)
                        self.remove_one_card(result)
                    elif len(tgt) == 2:
                        if self.have_major_pair():
                            result = self.play_major_value_pair() # 优先给分
                            if result == None:
                                result = self.play_small_major_pair() # 从小到大
                            self.remove_one_pair(result[0])
                        else:
                            return self.play_major_value_tachi(2)
                        move_uni = result
                    elif len(tgt) > 2: 
                        result = self.play_major_value_tachi(len(tgt))
                        move_uni = result
            result_all.extend(move_uni)
        return result_all
    
    def gen_one_action(self):
        result=None
        #查看是否有拖拉机：
        for suit in self.organized_hold_cards["other_suits_cards"]:
            result=self.play_tractor(suit,first=True)
            if result!=None:
                return result
        result=self.play_major_tractor(first=True)
        if result!=None:
            return result

        #如果没有拖拉机，从短往长出大牌
        for suit in self.organized_hold_cards["other_suits_cards"]:
            result=self.play_other_suit(suit)
            if result!=None:
                return result
            
        #出队友没有的花色
        for suit in self.organized_hold_cards["other_suits_cards"]:
            if self.trump_in(suit): 
                result= self.other_value(suit)
                if result == None:
                    result = self.play_small(suit)
            if result!=None:
                return [result]
            
        # 如果某门副牌只有一对或者只有对子，尝试出对子
        for suit in self.organized_hold_cards["other_suits_cards"]:
            if len(self.organized_hold_cards["other_suits_cards"][suit]["pairs"])==1 and len(self.organized_hold_cards["other_suits_cards"][suit]["singles"])==1:
                result=self.play_large_pair(suit)
                if result!=None:
                    return result
            if len(self.organized_hold_cards["other_suits_cards"][suit]["pairs"])==len(self.organized_hold_cards["other_suits_cards"][suit]["singles"]):
                result=self.play_large_pair(suit)
                if result!=None:
                    return result
        #如果某门副牌只有一张牌，尝试出单牌
        for suit in self.organized_hold_cards["other_suits_cards"]:
            if len(self.organized_hold_cards["other_suits_cards"][suit]["singles"])==1:
                result=self.play_single(suit)
                if result!=None:
                    return result
        #尝试出副对子
        for suit in self.organized_hold_cards["other_suits_cards"]:
            result=self.play_large_pair(suit)
            if result!=None:
                return result

        #如果没有副对，尝试出主
        result=self.play_major()
        if self.major != 'n':
            major_level = self.major+self.level
            if result!=None and len(result) == 2 and (len(self.organized_hold_cards["main_suit_cards"]["pairs"]) == 1) :# 留一个主对
                result = [self.play_small_major()]
            if result!=None and len(result) == 1 and (self.bigger_card(result[0],major_level) == result[0] or len(self.organized_hold_cards["main_suit_cards"]["singles"]) == 1):# 最小的主太大了或主太短了
                result = None
        if result!=None:
            return result

        
        #如果没有主，尝试出副单牌
        for suit in self.organized_hold_cards["other_suits_cards"]:
            result=self.play_single(suit)
            if result!=None:
                return result
            
        #如果只有主，正常出
        result=self.play_major()
        if result!=None:
            return result

        #不应该到这里
        assert False
        print("Error: No action generated") 
        return None

    # 理牌

    def organize_cards(self,cards):
        # 1. 将 hold 中的每张牌转化为扑克格式
        converted_cards = [self.Num2Poker(card) for card in cards]

        # 2. 按照主花色和副花色分类
        main_suit_cards = [card for card in converted_cards if self.isMajor(card)]
        other_suits_cards = {suit: [] for suit in self.suit_set if suit != self.major}

        for card in converted_cards:   
            if not self.isMajor(card):
                other_suits_cards[card[0]].append(card)

        # 3. 对每一类牌进行排序（按点数排序）
        main_suit_cards.sort(key=lambda x: self.card_level(x) )
        for suit in other_suits_cards:
            other_suits_cards[suit].sort(key=lambda x: self.card_level(x))

        major_single, major_pairs=self.divide_suit(main_suit_cards)

        major_tractors=self.divide_pairs(major_pairs,1)

        #移除长度为1的拖拉机
        major_tractors=[tractor for tractor in major_tractors if int(tractor[-1])>1]

        #把拖拉机按照长度排序
        major_tractors.sort(key=lambda x: int(x[-1]))

        main_suit_cards = {
            "singles": major_single,
            "pairs": major_pairs,
            "tractors": major_tractors
        }

        #按照长度排序
        other_suits_cards = sorted(other_suits_cards.items(), key=lambda item: len(item[1]))
        other_suits_cards = dict(other_suits_cards)

        for suit in other_suits_cards:
            singles, pairs=self.divide_suit(other_suits_cards[suit])
            tractors=self.divide_pairs(pairs,1)
            tractors=[tractor for tractor in tractors if int(tractor[-1])>1]
            tractors.sort(key=lambda x: int(x[-1]))
            other_suits_cards[suit] = {
                "singles": singles,
                "pairs": pairs,
                "tractors": tractors
            }
        return {
            "main_suit_cards": main_suit_cards,
            "other_suits_cards": other_suits_cards
        }
    
    def Num2Poker(self,num): # num: int-[0,107]
        if type(num) is list:
            return myutils.Num2Poker_seq(num) 
        return myutils.Num2Poker(num) 
    
    def Poker2Num(self,poker):
        return myutils.Poker2Num(poker,self.hold)
    
    def Poker2Num_seq(self,pokers):
        return myutils.Poker2Num_seq(pokers,self.hold)
    
    def get_suit(self,card):
        return myutils.get_suit(card,self.major,self.level)
    
    def bigger_card(self, card1, card2):
        if card1==None:
            return card2
        if card2==None:
            return card1
        major1 = self.isMajor(card1)
        major2 = self.isMajor(card2)
        if major1 and not major2:
            return card1
        if not major1 and major2:
            return card2
        if major1 and major2:
            if self.card_level(card1) >= self.card_level(card2):
                return card1
            else:
                return card2
        if not major1 and not major2:
            if card1[0] != card2[0]:
                return card1
            if self.card_level(card1) >= self.card_level(card2):
                return card1
            else:
                return card2
            
    def bigger_pair(self, pair1, pair2):
        if pair1==None:
            return pair2
        if pair2==None:
            return pair1
        if not self.is_pair(pair1):
            return pair2
        if not self.is_pair(pair2):
            return pair1
        major1 = self.isMajor(pair1[0])
        major2 = self.isMajor(pair2[0])
        if major1 and not major2:
            return pair1
        if not major1 and major2:
            return pair2
        if major1 and major2:
            if self.card_level(pair1[0]) >= self.card_level(pair2[0]):
                return pair1
            else:
                return pair2
            
        if not major1 and not major2:
            if pair1[0][0] != pair2[0][0]:
                return pair1
            if self.card_level(pair1[0]) >= self.card_level(pair2[0]):
                return pair1
            else:
                return pair2

    def divide_suit(self, tgt):
        #把某种花色分为单牌和对子
        return myutils.divide_suit(tgt)
    
    def divide_pairs(self, tgt,first_tractor_len):
        #从对子中提取拖拉机：
        if (len(tgt)==0):
            return []
        elif (len(tgt)==1):
            return [tgt[0]+str(first_tractor_len)]
        elif (self.card_level(tgt[0]) == 113 or self.card_level(tgt[0]) == 114):
            return [tgt[0]+str(first_tractor_len)]+self.divide_pairs(tgt[1:],1)
        elif (self.card_level(tgt[0])+1==self.card_level(tgt[1])):
            if tgt[1][1] != self.level:
                return self.divide_pairs(tgt[1:],first_tractor_len+1)
            else:
                return [tgt[0]+str(first_tractor_len)]+self.divide_pairs(tgt[1:],1)
        else:
            return [tgt[0]+str(first_tractor_len)]+self.divide_pairs(tgt[1:],1)
    
    def remove_one_card(self,card):
        card_num= self.Poker2Num(card)
        assert card_num in self.hold
        self.hold.remove(card_num)
        self.organized_hold_cards = self.organize_cards(self.hold)
    
    def remove_one_pair(self,card):
        card_num_small= self.Poker2Num(card)%54
        card_num_big = card_num_small + 54
        assert card_num_small in self.hold and card_num_big in self.hold
        self.hold.remove(card_num_small)
        self.hold.remove(card_num_big)
        self.organized_hold_cards = self.organize_cards(self.hold)
    


    # 打牌
    # 打单张

    def play_small(self,suit=None):
        if suit==None:
            #出最短的非空副花色的最小的牌
            for suit in self.organized_hold_cards["other_suits_cards"]:
                if len(self.organized_hold_cards["other_suits_cards"][suit]["singles"])>0:
                    for card in self.organized_hold_cards["other_suits_cards"][suit]["singles"]:
                        if not card in self.organized_hold_cards["other_suits_cards"][suit]["pairs"] and not self.is_value(card):
                            return card
            for suit in self.organized_hold_cards["other_suits_cards"]:
                if len(self.organized_hold_cards["other_suits_cards"][suit]["singles"])>0:
                    for card in self.organized_hold_cards["other_suits_cards"][suit]["singles"]:
                        if not self.is_value(card):
                            return card
            for suit in self.organized_hold_cards["other_suits_cards"]:
                if len(self.organized_hold_cards["other_suits_cards"][suit]["singles"])>0:
                    for card in self.organized_hold_cards["other_suits_cards"][suit]["singles"]:
                        return card
        else:
            if len(self.organized_hold_cards["other_suits_cards"][suit]["singles"])>0:
                for card in self.organized_hold_cards["other_suits_cards"][suit]["singles"]:
                    if not card in self.organized_hold_cards["other_suits_cards"][suit]["pairs"]and not self.is_value(card):
                        return card
                    # for card in self.organized_hold_cards["other_suits_cards"][suit]["singles"]:
                    #     if not card in self.organized_hold_cards["other_suits_cards"][suit]["pairs"]:
                    #        return card
                for card in self.organized_hold_cards["other_suits_cards"][suit]["singles"]:
                    if not self.is_value(card): # 拆对
                        return card
                return self.organized_hold_cards["other_suits_cards"][suit]["singles"][0]
        return None
    
    def play_large(self,suit):# 出最大的牌
        if self.have_single(suit):
            largest_single = self.organized_hold_cards["other_suits_cards"][suit]["singles"][-1]
            return largest_single
        return None   

    def play_single(self,suit):
        if self.have_single(suit):
            largest_single = self.organized_hold_cards["other_suits_cards"][suit]["singles"][-1]
            return [largest_single]
        return None   

    def play_major(self):   
        if self.have_major():
            #尝试出大对子
            result=self.play_large_major_pair()
            if result!=None:
                return result
            #尝试出小单张
            return [self.play_small_major()]
        return None
            
    def play_small_major(self):
        if self.have_major():
            #尝试出小单张
            for card in self.organized_hold_cards["main_suit_cards"]["singles"]:
                if not card in self.organized_hold_cards["main_suit_cards"]["pairs"] and not self.is_value(card):
                    return card
            for card in self.organized_hold_cards["main_suit_cards"]["singles"]:
                if not self.is_value(card):
                    return card
            return self.organized_hold_cards["main_suit_cards"]["singles"][0]
        return None
    
    def beat_card(self,card,if_equal=False):
        bias = 0
        if if_equal:
            bias = 0.5
        if self.isMajor(card):
            #找到最小的比card大的主牌
            if len(card)==1:
                if len(self.organized_hold_cards["main_suit_cards"]["singles"])>0:
                    return self.organized_hold_cards["main_suit_cards"]["singles"][0]
            for my_card in self.organized_hold_cards["main_suit_cards"]["singles"]:
                if self.card_level(my_card)+bias>self.card_level(card) and  not my_card in self.organized_hold_cards["main_suit_cards"]["pairs"]:
                    return my_card
            for my_card in self.organized_hold_cards["main_suit_cards"]["pairs"]:
                if self.card_level(my_card)+bias>self.card_level(card):
                    return my_card
        else:
            if len(card)==1:
                if len(self.organized_hold_cards["other_suits_cards"][card[0]]["singles"])>0:
                    return self.organized_hold_cards["other_suits_cards"][card[0]]["singles"][0]
            #找到最小的比card大的非主牌
            for my_card in self.organized_hold_cards["other_suits_cards"][card[0]]["singles"]:
                if self.card_level(my_card)+bias>self.card_level(card) and  not my_card in self.organized_hold_cards["other_suits_cards"][card[0]]["pairs"]:
                    return my_card
            for my_card in self.organized_hold_cards["other_suits_cards"][card[0]]["pairs"]:
                if self.card_level(my_card)+bias>self.card_level(card):
                    return my_card
        return None
    
    #打对
    
    def play_pair(self,suit): #弃用
        if self.have_pair(suit):
            largest_pair = self.organized_hold_cards["other_suits_cards"][suit]["pairs"][-1]
            return [largest_pair,largest_pair]
        return None
    
    def play_value_pair(self,suit):# 出分最多的对子，假设已检验过have_pair
        assert self.have_pair(suit) 
        if '0' in self.organized_hold_cards["other_suits_cards"][suit]["pairs"]:
            card = suit+'0'
            return [card,card]
        if 'K' in self.organized_hold_cards["other_suits_cards"][suit]["pairs"]:
            card = suit+'K'
            return [card,card]
        if '5' in self.organized_hold_cards["other_suits_cards"][suit]["pairs"]:
            card = suit+'5'
            return [card,card]
        card = self.organized_hold_cards["other_suits_cards"][suit]["pairs"][0]
        return [card,card]
    
    def play_small_pair(self,suit):# 出最小的对子，尽量不打分
        if self.have_pair(suit):
            for card in self.organized_hold_cards["other_suits_cards"][suit]["pairs"]:
                if not self.is_value(card):
                    return [card,card]
            card = self.organized_hold_cards["other_suits_cards"][suit]["pairs"][0]
            return [card,card]
        return None
    
    def play_large_pair(self,suit):# 出最大的对子
        if self.have_pair(suit):
            largest_pair = self.organized_hold_cards["other_suits_cards"][suit]["pairs"][-1]
            return [largest_pair,largest_pair]
        return None
    
    def play_major_pair(self):# 弃用
        result=self.play_major_value_pair()
        if result==None:
            result=self.play_small_major_pair()
        return result
    
    def play_major_value_pair(self):
        assert self.have_major_pair()
        if '0' in self.organized_hold_cards["main_suit_cards"]["pairs"]:
            card = self.major+'0'
            return [card,card]
        if 'K' in self.organized_hold_cards["main_suit_cards"]["pairs"]:
            card = self.major+'K'
            return [card,card]
        if '5' in self.organized_hold_cards["main_suit_cards"]["pairs"]:
            card = self.major+'5'
            return [card,card]
        card = self.organized_hold_cards["main_suit_cards"]["pairs"][0]
        return [card,card]
    
    def play_small_major_pair(self):
        if self.have_major_pair():
            for card in self.organized_hold_cards["main_suit_cards"]["pairs"]:
                if not self.is_value(card):
                    return [card,card]
            card = self.organized_hold_cards["main_suit_cards"]["pairs"][0]
            return [card,card]
        return None
    
    def play_large_major_pair(self):
        if self.have_major_pair():
            largest_pair = self.organized_hold_cards["main_suit_cards"]["pairs"][-1]
            return [largest_pair,largest_pair]
        return None

    def beat_pair(self,cards):
        if self.isMajor(cards[0]):
            #找到最小的比card大的主对子
            assert self.have_major_pair()
            for my_card in self.organized_hold_cards["main_suit_cards"]["pairs"]:
                if self.card_level(my_card)>self.card_level(cards[0]):
                    return [my_card,my_card]
            return self.play_small_major_pair()
        else:
            #找到最大的非主对子,若不比cards大，则打最小的非主对子,但尽量不打分
            assert self.have_pair(cards[0][0]) or self.have_major_pair()
            if self.have_pair(cards[0][0]):
                suit = self.get_suit(cards[0])
                result = self.play_large_pair(suit) # 假设已检验过have_pair
                if self.bigger_pair(cards,result) == result:
                    return result
                return self.play_small_pair(suit)
            else:
                for my_card in self.organized_hold_cards["main_suit_cards"]["pairs"]:
                    if self.is_value(my_card) and self.card_level(my_card)>self.card_level(cards[0]):
                        return [my_card,my_card]
                for my_card in self.organized_hold_cards["main_suit_cards"]["pairs"]:
                    if self.card_level(my_card)>self.card_level(cards[0]):
                        return [my_card,my_card]
                return self.play_small_major_pair()
        return None

    
    #打拖拉机

    def play_major_tractor(self,length=2,first=False):
        if self.have_major_tractor():
            if first:
                return self.tractor_to_action(self.organized_hold_cards["main_suit_cards"]["tractors"][-1])
            for tractor in reversed(self.organized_hold_cards["main_suit_cards"]["tractors"]):
                if int(tractor[2])>=length:
                    tractor_part = tractor[0:2]
                    tractor_part = tractor_part + str(length)
                    return self.tractor_to_action(tractor)
        return None
    
    def play_tractor(self,suit,length=2,first=False):
        if self.have_tractor(suit):
            if first:
                return self.tractor_to_action(self.organized_hold_cards["other_suits_cards"][suit]["tractors"][-1])
            for tractor in reversed(self.organized_hold_cards["other_suits_cards"][suit]["tractors"]):
                if int(tractor[2])>=length:
                    tractor_part = tractor[0:2]
                    tractor_part = tractor_part + str(length)
                    return self.tractor_to_action(tractor)
        return None
    
    #打很多张

    def play_other_suit(self,suit):
        if len(self.organized_hold_cards["other_suits_cards"][suit]["singles"])==0:
            return None
        largest_single = None
        for card in self.organized_hold_cards["other_suits_cards"][suit]["singles"]:
            if not card in self.organized_hold_cards["other_suits_cards"][suit]["pairs"]:
                largest_single = card
        if self.have_pair(suit):
            largest_pair = self.organized_hold_cards["other_suits_cards"][suit]["pairs"][-1]
            if self.is_largest_pair(largest_pair) and self.is_largest_single(largest_single):
                return [largest_pair,largest_pair,largest_single]
            if self.is_largest_pair(largest_pair):
                return [largest_pair,largest_pair]
        if largest_single!= None and self.is_largest_single(largest_single):
            return [largest_single]
        return None

    def play_small_major_tachi(self,num,then_value=False):
        if num==0:
            return []
        result=[]
        while len(result)<num:
            card=self.play_small_major()
            if card == None:
                break
            result.append(card)
            self.remove_one_card(card)
        if then_value:
            result.extend(self.play_value_tachi(num-len(result)))
        else:
            result.extend(self.play_small_tachi(num-len(result)))
        return result
    
    def play_small_tachi(self,num,suit=None):
        if num==0:
            return []
        result=[]
        if suit==None:
            while(len(result)<num):
                card=self.play_small()
                if card == None:
                    break
                result.append(card)
                self.remove_one_card(card)
            result.extend(self.play_small_major_tachi(num-len(result)))
        else:
            while(len(result)<num):
                card=self.play_small(suit)
                if card == None:
                    break
                result.append(card)
                self.remove_one_card(card)
            result.extend(self.play_small_tachi(num-len(result)))
        return result

    def play_value_tachi(self,num,suit=None):
        if num==0:
            return []
        result=[]
        if suit==None:
            while len(result)<num:
                card=self.other_value()
                if card == None:
                    break
                result.append(card)
                self.remove_one_card(card)
            while len(result)<num:
                card=self.major_value()
                if card == None:
                    break
                result.append(card)
                self.remove_one_card(card)
            result.extend(self.play_small_tachi(num-len(result)))
        else:
            while len(result)<num:
                card=self.other_value(suit)
                if card == None:
                    break
                result.append(card)
                self.remove_one_card(card)
            while len(result)<num:
                card=self.play_small(suit) 
                if card == None:
                    break
                result.append(card)
                self.remove_one_card(card)
            result.extend(self.play_value_tachi(num-len(result)))
        return result
    
    def play_major_value_tachi(self,num):
        if num==0:
            return []
        result=[]
        while len(result)<num:
            card=self.major_value()
            if card == None:
                break
            result.append(card)
            self.remove_one_card(card)
        result.extend(self.play_small_major_tachi(num-len(result),then_value=True))
        return result
    
    def play_small_pair_tachi(self,num,suit,then_value=False):
        if num==0:
            return []
        result=[]
        while(len(result)<num):
            pair=self.play_small_pair(suit)
            if pair == None:
                break
            card = pair[0]
            result.append(card)
            result.append(card)
            self.remove_one_pair(card)
        if then_value:
            result.extend(self.play_value_tachi(num-len(result),suit))
        else:
            result.extend(self.play_small_tachi(num-len(result),suit))
        return result
    
    def play_value_pair_tachi(self,num,suit):
        if num==0:
            return []
        result=[]
        if self.have_pair(suit):
            while(len(result)<num and self.have_pair(suit)):
                pair=self.play_value_pair(suit)
                if pair == None:
                    break
                card = pair[0]
                result.append(card)
                result.append(card)
                self.remove_one_pair(card)
            result.extend(self.play_small_pair_tachi(num-len(result),suit,then_value=True))
            return result
        else:
            return self.play_value_tachi(num,suit)

    def play_small_major_pair_tachi(self,num,then_value=False): 
        if num==0:
            return []
        result=[]
        while(len(result)<num):
            pair=self.play_small_major_pair()
            if pair == None:
                break
            card = pair[0]
            result.append(card)
            result.append(card)
            self.remove_one_pair(card)
        if then_value:
            result.extend(self.play_major_value_tachi(num-len(result)))
        else:
            result.extend(self.play_small_major_tachi(num-len(result)))
        return result
    
    def play_major_value_pair_tachi(self,num):
        if num==0:
            return []
        result=[]
        if self.have_major_pair():
            while(len(result)<num and self.have_major_pair()):
                pair=self.play_major_value_pair()
                if pair == None:
                    break
                card = pair[0]
                result.append(card)
                result.append(card)
                self.remove_one_pair(card)
            result.extend(self.play_small_major_pair_tachi(num-len(result),then_value=True))
            return result
        else:
            return self.play_major_value_tachi(num)
        
    # 找牌
        
    def major_value(self):
        #找到一张主的分牌
        for my_card in self.organized_hold_cards["main_suit_cards"]["singles"]:
            if self.is_big_value(my_card) and  not my_card in self.organized_hold_cards["main_suit_cards"]["pairs"]:
                return my_card
        for my_card in self.organized_hold_cards["main_suit_cards"]["singles"]:
            if self.is_value(my_card) and  not my_card in self.organized_hold_cards["main_suit_cards"]["pairs"]:
                return my_card
        return None
    
    def other_value(self,suit=None):
        #找到一张非主的分牌
        if suit==None:
            for suit in self.organized_hold_cards["other_suits_cards"]:
                for my_card in self.organized_hold_cards["other_suits_cards"][suit]["singles"]:
                    if self.is_big_value(my_card) and not my_card in self.organized_hold_cards["other_suits_cards"][suit]["pairs"]:
                        return my_card
            for suit in self.organized_hold_cards["other_suits_cards"]:
                for my_card in self.organized_hold_cards["other_suits_cards"][suit]["singles"]:
                    if self.is_value(my_card) and not my_card in self.organized_hold_cards["other_suits_cards"][suit]["pairs"]:
                        return my_card
            return None
        for my_card in self.organized_hold_cards["other_suits_cards"][suit]["singles"]:
            if self.is_big_value(my_card) and  not my_card in self.organized_hold_cards["other_suits_cards"][suit]["pairs"]:
                return my_card
        for my_card in self.organized_hold_cards["other_suits_cards"][suit]["singles"]:
            if self.is_value(my_card) and  not my_card in self.organized_hold_cards["other_suits_cards"][suit]["pairs"]:
                return my_card
        return None
    
    def get_shortest_other_suit(self,suits):
        #获得最短的非空副花色
        min_len = 100
        min_suit = ''
        for suit in suits:
            if len(self.organized_hold_cards["other_suits_cards"][suit]) < min_len :
                min_len = len(self.organized_hold_cards["other_suits_cards"][suit])
                min_suit = suit
        return min_suit, min_len

    def largest_single_left(self,suit):
        if len(self.organized_left_cards["other_suits_cards"][suit]["singles"])==0:
            return None
        else:
            return self.organized_left_cards["other_suits_cards"][suit]["singles"][-1]
        
    def tractor_to_action(self,tractor):
        action=[]
        len=int(tractor[-1])
        if tractor[1] == self.level or tractor[1] == 'o':
            return None
        first_card=self.point_order.index(tractor[1])-len+1 
        for i in range(len):
            action.append(tractor[0]+self.point_order[first_card+i])
            action.append(tractor[0]+self.point_order[first_card+i])
        return action
        # return ['d2','d2','c2','c2']
    
    def get_card_to_beat(self):
        card_to_beat=None
        for card in self.organized_left_cards["main_suit_cards"]["singles"]:
            if self.is_value(card):#至少盖过最大分
                card_to_beat=card
        return card_to_beat
    # 判断牌型
    def card_level(self, card):
        return myutils.card_level(card,self.major,self.level)

    def isMajor(self, card):
        return myutils.isMajor(card,self.major,self.level)
        
    def is_major_pair(self,cards):
        return self.isMajor(cards[0]) and self.is_pair(cards)
    
    def is_pair(self,cards):
        return len(cards)==2 and cards[0] == cards[1]
    
    def is_value(self, card):
        if card[1] in self.value_cards:
            return True
        else:   
            return False
        
    def is_big_value(self, card):
        if card[1] == '0' or card[1] == 'K':
            return True
        return False
    
    def is_largest_single(self, card):
        if card == None:
            return False
        if self.isMajor(card):
            if len(self.organized_left_cards["main_suit_cards"]["singles"])==0 or self.card_level(card) >= self.card_level(self.organized_left_cards["main_suit_cards"]["singles"][-1]):
                return True
        else:
            if len(self.organized_left_cards["other_suits_cards"][card[0]]["singles"])==0 or self.card_level(card) >= self.card_level(self.organized_left_cards["other_suits_cards"][card[0]]["singles"][-1]):
                return True
        return False

    def is_largest_pair(self, card):
        if self.isMajor(card):
            if len(self.organized_left_cards["main_suit_cards"]["pairs"])==0 or self.card_level(card) >= self.card_level(self.organized_left_cards["main_suit_cards"]["pairs"][-1]):
                return True
        else:
            if len(self.organized_left_cards["other_suits_cards"][card[0]]["pairs"])==0 or self.card_level(card) >= self.card_level(self.organized_left_cards["other_suits_cards"][card[0]]["pairs"][-1]):
                return True
        return False

    def have_major(self):
        return len(self.organized_hold_cards["main_suit_cards"]["singles"])>0

    def have_major_tractor(self):
        return len(self.organized_hold_cards["main_suit_cards"]["tractors"])>0

    def have_tractor(self,suit):
        return len(self.organized_hold_cards["other_suits_cards"][suit]["tractors"])>0

    def have_major_pair(self):
        return len(self.organized_hold_cards["main_suit_cards"]["pairs"])>0
    
    def have_pair(self,suit):
        return len(self.organized_hold_cards["other_suits_cards"][suit]["pairs"])>0
    
    def have_major_single(self):
        return len(self.organized_hold_cards["main_suit_cards"]["singles"])>0

    def have_single(self,suit):
        return len(self.organized_hold_cards["other_suits_cards"][suit]["singles"])>0
    
   #队友有把握在这一轮中是最大的
    def teammate_trump(self,history,suit):
        first_card=self.Num2Poker(history[0][0])
        if (len(history)==1): #上家出牌
            return self.canbeat(suit,self.teammate_id)
        if (len(history)==2): #队友出牌
            second_card=self.Num2Poker(history[1][0])
            return self.bigger_card(first_card,second_card) == first_card and (self.is_largest_single(first_card) and not self.canbeat(suit,self.next_id))
        if (len(history)==3): #下家出牌
            second_card=self.Num2Poker(history[1][0])
            third_card=self.Num2Poker(history[2][0])
            return self.bigger_card(first_card,second_card) != first_card and self.bigger_card(second_card,third_card) == second_card # 前半保证队友未垫，从而后半有意义
        
    def teammate_trump_major(self,history):
        first_card=self.Num2Poker(history[0][0])
        if (len(history)==1): #上家出牌
            return False
        if (len(history)==2): #队友出牌
            second_card=self.Num2Poker(history[1][0])
            return self.bigger_card(first_card,second_card) == first_card and (self.is_largest_single(first_card) or self.empty_suits[self.next_id].count(self.major) > 0)
        if (len(history)==3): #下家出牌
            second_card=self.Num2Poker(history[1][0])
            third_card=self.Num2Poker(history[2][0])
            return self.bigger_card(first_card,second_card) != first_card and self.bigger_card(second_card,third_card) == second_card # 前半保证队友未垫，从而后半有意义

    #当前出牌轮次（history）有分
    def value_in(self,history):
        for cards in history:
            for card in cards:
                if self.is_value(self.Num2Poker(card)):
                    return True
                
    def trump_in(self,suit):
        return self.empty_suits[self.teammate_id].count(suit)>0 and self.empty_suits[self.prev_id].count(suit)==0 and self.empty_suits[self.teammate_id].count(self.major) == 0
    

    #外面都没了
    def all_empty(self,suit):
        return self.empty_suits[self.teammate_id].count(suit)>0 and self.empty_suits[self.next_id].count(suit)>0 and self.empty_suits[self.prev_id].count(suit)>0
    
    #对面还有
    def enemy_not_empty(self,suit):
        return self.empty_suits[self.next_id].count(suit)==0 and self.empty_suits[self.prev_id].count(suit)==0
    

    #对面没了，队友还有
    def off_trump(self,suit):
        return self.empty_suits[self.teammate_id].count(suit)==0 and (self.empty_suits[self.next_id].count(suit)>0 or self.empty_suits[self.prev_id].count(suit)>0)
    
    #队友能毙
    def canbeat(self,suit,_id):
        return self.empty_suits[_id].count(suit)>0 and self.empty_suits[_id].count(self.major) == 0
    
        
    # 原有的gen系列

    def gen_single(self, deck, tgt):
        '''
        deck: player's deck
        tgt: target cardset(list of cardnames)
        '''
        moves = []
        if tgt[0] in self.Major:
            moves = [[p] for p in deck if p in self.Major]
            if len(moves) == 0: # No Major in deck
                moves = [[p] for p in deck]
        else:
            moves = [[p] for p in deck if p[0] == tgt[0][0] and p not in self.Major]
            if len(moves) == 0:
                moves = [[p] for p in deck]
        
        return moves 
    
    def gen_pair(self, deck, tgt):
        '''
        deck: player's deck
        tgt: target cardset(list of cardnames)
        '''
        moves = []
        if tgt[0] in self.Major:
            sel_deck = [p for p in deck if p in self.Major]
        else:
            sel_deck = [p for p in deck if p[0] == tgt[0][0] and p not in self.Major]
        sel_count = Counter(sel_deck)
        for k,v in sel_count.items():
            if v == 2:
                moves.append([k, k])
        if len(moves) == 0:
            if len(sel_deck) >= 2: # Generating cardset with same suit
                for i in range(len(sel_deck)-1):
                    for j in range(len(sel_deck)-i-1):
                        moves.append([sel_deck[i], sel_deck[i+j+1]])
            elif len(sel_deck) == 1:
                move_uni = sel_deck
                for p in deck:
                    if p != move_uni[0]:
                        moves.append(move_uni+[p])
            else:
                deck_cnt = Counter(deck)
                for k, v in deck_cnt:
                    if v == 2:
                        moves.append([k, k])
                if len(moves) == 0:
                    for i in range(len(deck)-1):
                        for j in range(len(deck)-i-1):
                            moves.append([deck[i], deck[i+j+1]])        
        return moves
    
    def gen_tractor(self, deck, tgt):
        moves = []
        tractor_len = len(tgt)
        pair_cnt = tractor_len // 2
        if tgt[0] in self.Major:
            sel_deck = [p for p in deck if p in self.Major]
        else:
            sel_deck = [p for p in deck if p[0] == tgt[0][0] and p not in self.Major]
        
        sel_count = Counter(sel_deck)
        sel_pairs = [k for k, v in sel_count.items() if v == 2] # Is actually list of cardname
        if "jo" in sel_pairs and "Jo" in sel_pairs and tractor_len == 4:
            moves.append(["jo", "jo", "Jo", "Jo"])
        if tgt[0] in self.Major:
            if self.major != 'n':
                trac_pairs = [p for p in sel_pairs if p[0] == self.major and p[1] != self.level]
                trac_pairs.sort(key=lambda x: self.point_order.index(x[1]))
            else:
                trac_pairs = []
        else:
            trac_pairs = sel_pairs + []
            trac_pairs.sort(key=lambda x: self.point_order.index(x[1]))
            
        if len(sel_deck) < len(tgt): # attaching cards with other suits
            other_deck = [p for p in deck if p not in sel_deck]
            move_uni = sel_deck
            sup_sets = list(combinations(other_deck, len(tgt)-len(sel_deck)))
            for cardset in sup_sets:
                moves.append(move_uni+list(cardset))
        
        else:  # attaching cards with same suits
            if len(sel_pairs) < pair_cnt:
                move_uni = [p for k in sel_pairs for p in [k, k]]
                sup_singles = [p for p in sel_deck if p not in sel_pairs] # enough to make a cardset
                sup_sets = list(combinations(sup_singles, tractor_len - len(sel_pairs)*2))
                for cardset in sup_sets:
                    moves.append(move_uni + list(cardset))
            elif len(trac_pairs) < pair_cnt: # can be compensated with sel_pairs
                pair_sets = list(combinations(sel_pairs, tractor_len//2))
                for pairset in pair_sets:
                    moves.append([p for k in pairset for p in [k, k]])
            else:
                for i in range(len(trac_pairs)-pair_cnt+1): # Try to retrieve a tractor
                    if trac_pairs[i+pair_cnt-1][1] == self.point_order[self.point_order.index(trac_pairs[i][1])+pair_cnt-1]:
                        pair_set = [[trac_pairs[k], trac_pairs[k]] for k in range(i, i+pair_cnt)]
                        moves.append([p for pair in pair_set for p in pair])
                if len(moves) == 0:
                    pairsets = list(combinations(sel_pairs, tractor_len//2))
                    moves = [[p for k in pairset for p in [k, k]] for pairset in pairsets]
                    
        return moves  
                        
    def gen_throw(self, deck, tgt):
        level = self.level
        major = self.major
        outpok = []
        tgt_count = Counter(tgt)
        pos = []
        tractor = []
        suit = ''
        for k, v in tgt_count.items():
            if v == 2:
                if k != 'jo' and k != 'Jo' and k[1] != level: # 大小王和级牌当然不会参与拖拉机
                    pos.append(self.point_order.index(k[1]))
                    suit = k[0]
        if len(pos) >= 2:
            pos.sort()
            tmp = []
            suc_flag = False
            for i in range(len(pos)-1):
                if pos[i+1]-pos[i] == 1:
                    if not suc_flag:
                        tmp = [suit + self.point_order[pos[i]], suit + self.point_order[pos[i]], suit + self.point_order[pos[i+1]], suit + self.point_order[pos[i+1]]]
                        del tgt_count[suit + self.point_order[pos[i]]]
                        del tgt_count[suit + self.point_order[pos[i+1]]] # 已计入拖拉机的，从牌组中删去
                        suc_flag = True
                    else:
                        tmp.extend([suit + self.point_order[pos[i+1]], suit + self.point_order[pos[i+1]]])
                        del tgt_count[suit + self.point_order[pos[i+1]]]
                elif suc_flag:
                    tractor.append(tmp)
                    suc_flag = False
            if suc_flag:
                tractor.append(tmp)
        # 对牌型作基础的拆分 
        for k,v in tgt_count.items(): 
            outpok.append([k for i in range(v)])
        outpok.extend(tractor)
        
        moves = []
        move_uni = []
        self.reg_generator(deck, move_uni, outpok, moves)
        
        return moves


    def reg_generator(self, deck, move, outpok, moves):
        if len(outpok) == 0:
            moves.append(move)
            return
        tgt = outpok[-1] + []
        new_pok = outpok[:-1] + []
        if len(tgt) > 2:
            move_unis = self.gen_tractor(deck, tgt)
        elif len(tgt) == 2:
            move_unis = self.gen_pair(deck, tgt)
        elif len(tgt) == 1:
            move_unis = self.gen_single(deck, tgt)
        
        for move_uni in move_unis:
            new_move = move + move_uni
            new_deck = deck + []
            for p in move_uni:
                new_deck.remove(p)
            self.reg_generator(new_deck, new_move, new_pok, moves)
            
        return
    
    def gen_all(self, deck): # Generating all cardset options
        moves = []
        suit_decks = []
        major_deck = [p for p in deck if p in self.Major]
        for i in range(4):
            suit_decks.append([p for p in deck if p[0] == self.suit_set[i] and p not in self.Major])
        # Do the major first
        major_count = Counter(major_deck)
        # Adding in all pairs and singles
        for k, v in major_count.items():
            if v == 1:
                moves.append([k])
            if v == 2:
                moves.append([k, k])
        # Adding in tractors
        if "jo" in major_count and major_count["jo"] == 2 and "Jo" in major_count and major_count["Jo"] == 2:
            moves.append(["jo", "jo", "Jo", "Jo"])
        trac_major = [k for k,v in major_count.items() if v == 2 and k[1] != self.level and k[1] != 'o']
        trac_major.sort(key=lambda x: self.point_order.index(x[1]))
        tracstreak = []
        for i in range(len(trac_major)):
            if len(tracstreak) == 0 or self.point_order.index(trac_major[i][1]) - self.point_order.index(tracstreak[-1][1]) > 1: # begin a new tracstreak
                tracstreak = [trac_major[i], trac_major[i]]
            else:
                tracstreak.extend([trac_major[i], trac_major[i]])
                moves.append(tracstreak+[])
                
        for suit_deck in suit_decks:
            suit_count = Counter(suit_deck)
            # Adding in all pairs and singles
            for k, v in suit_count.items():
                if v == 1:
                    moves.append([k])
                if v == 2:
                    moves.append([k, k])
            # Adding in tractors
            tracstreak = []
            trac_suit = [k for k,v in suit_count.items() if v==2]
            trac_suit.sort(key=lambda x: self.point_order.index(x[1]))
            for i in range(len(trac_suit)):
                if len(tracstreak) == 0 or self.point_order.index(trac_suit[i][1]) - self.point_order.index(tracstreak[-1][1]) > 1: # begin a new tracstreak
                    tracstreak = [trac_suit[i], trac_suit[i]]
                else:
                    tracstreak.extend([trac_suit[i], trac_suit[i]])
                    moves.append(tracstreak+[])
                    
        return moves