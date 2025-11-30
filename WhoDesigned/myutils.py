from collections import Counter

cardscale = ['A','2','3','4','5','6','7','8','9','0','J','Q','K']
suitset = ['s','h','c','d']
Major = ['jo', 'Jo']
pointorder = ['2','3','4','5','6','7','8','9','0','J','Q','K','A']
valuecards = ['5','0','K']

def setMajor(major, level):
    global Major
    if major != 'n': # 非无主
        Major = [major+point for point in pointorder if point != level] + [suit + level for suit in suitset if suit != major] + [major + level] + Major
    else: # 无主
        Major = [suit + level for suit in suitset] + Major
    pointorder.remove(level)
    
def Num2Poker(num): # num: int-[0,107]
    # Already a poker
    if type(num) is str and (num in Major or (num[0] in suitset and num[1] in cardscale)):
        return num
    # Locate in 1 single deck
    NumInDeck = num % 54
    # joker and Joker:
    if NumInDeck == 52:
        return "jo"
    if NumInDeck == 53:
        return "Jo"
    # Normal cards:
    pokernumber = cardscale[NumInDeck // 4]
    pokersuit = suitset[NumInDeck % 4]
    return pokersuit + pokernumber

def Num2Poker_seq(nums):
    return [Num2Poker(num) for num in nums]

def Poker2Num(poker, deck): # poker: str
    NumInDeck = -1
    if poker[0] == "j":
        NumInDeck = 52
    elif poker[0] == "J":
        NumInDeck = 53
    else:
        NumInDeck = cardscale.index(poker[1])*4 + suitset.index(poker[0])
    if NumInDeck in deck:
        return NumInDeck
    else:
        return NumInDeck + 54

def Poker2Num_seq(pokers, deck):
    id_seq = []
    deck_copy = deck + []
    for card_name in pokers:
        card_id = Poker2Num(card_name, deck_copy)
        id_seq.append(card_id)
        deck_copy.remove(card_id)
    return id_seq

def get_suit(poker,major,level):
    if isMajor(poker,major,level):
        return major
    return poker[0]
    
def checkPokerType(poker, level): #poker: list[int]
    poker = [Num2Poker(p) for p in poker]
    if len(poker) == 1:
        return "single" #一张牌必定为单牌
    if len(poker) == 2:
        if poker[0] == poker[1]:
            return "pair" #同点数同花色才是对子
        else:
            return "suspect" #怀疑是甩牌
    if len(poker) % 2 == 0: #其他情况下只有偶数张牌可能是整牌型（连对）
    # 连对：每组两张；各组花色相同；各组点数在大小上连续(需排除大小王和级牌)
        count = Counter(poker)
        if "jo" in count.keys() and "Jo" in count.keys() and count['jo'] == 2 and count['Jo'] == 2:
            return "tractor"
        elif "jo" in count.keys() or "Jo" in count.keys(): # 排除大小王
            return "suspect"
        for v in count.values(): # 每组两张
            if v != 2:
                return "suspect"
        pointpos = []
        suit = list(count.keys())[0][0] # 花色相同
        for k in count.keys():
            if k[0] != suit or k[1] == level: # 排除级牌
                return "suspect"
            pointpos.append(pointorder.index(k[1])) # 点数在大小上连续
        pointpos.sort()
        for i in range(len(pointpos)-1):
            if pointpos[i+1] - pointpos[i] != 1:
                return "suspect"
        return "tractor" # 说明是拖拉机
    
    return "suspect"


def isMajor(card,major,level):
    if card==None:
        return False
    if len(card)==1:
        return card[0]==major
    return card[0] == major or card[1] == 'o' or card[1] == level

def card_level(card, major, level):
    if card==None:
        return -1
    if not isMajor(card, major, level):
        return pointorder.index(card[1])
    else:
        if card[1] == level:
            if card[0] == major:
                return 114
            else:
                return 113
        if card == "Jo":
            return 116
        if card == "jo":
            return 115
        return pointorder.index(card[1])+100
    
def divide_suit(tgt):
    #把某种花色分为单牌和对子
    singles = []
    pairs = []
    for card in tgt:
        #如果有两张
        if tgt.count(card) == 2 and card not in pairs:
            pairs.append(card)
        if card not in singles:
            singles.append(card)
    return singles, pairs

def evaluate_suit(suit_poker, level):
    singles, pairs = divide_suit(suit_poker)
    singles = [card for card in singles if card not in pairs]
    score = 0.0
    for card in singles:
        score += 1.0
        if card[1] == level:
            score += 0.5 
        elif pointorder.index(card[1]) >= 8: # 10,J,Q,K,A
            score += 0.1 * (pointorder.index(card[1]) - 7)
    for card in pairs:
        score += (2.0 + 0.2) 
        if card[1] == level:
            score += 1.0
        elif pointorder.index(card[1]) >= 8: # 10,J,Q,K,A
            score += 2 * 0.1 * (pointorder.index(card[1]) - 7)
    return score

def evaluate_score(deck_poker,level):
    suit_poker = {suit : [] for suit in suitset}
    suit_poker['n'] = []
    for card in deck_poker:
        if card[1] == 'o':
            suit_poker['n'].append(card)
        else:
            suit_poker[card[0]].append(card)
    suit_score = {suit : evaluate_suit(suit_poker[suit], level) for suit in suitset}
    # 级牌和王牌
    suit_score['n'] = 0
    singles, pairs = divide_suit(deck_poker)
    for card in singles:
        suit_score['n'] += 1.0
        if card[1] == 'j':
            suit_score['n'] += 0.5
        elif card[1] == 'J':
            suit_score['n'] += 1.0

    for card in pairs:
        suit_score['n'] += (2.0 + 0.3)
        if card[1] == 'j':
            suit_score['n'] += 1.0
        elif card[1] == 'J':
            suit_score['n'] += 2.0
    return sorted(suit_score.items(), key=lambda item: item[1], reverse=True) # 从大到小考虑

def call_Snatch(get_card, deck, called, snatched, level, major):
# get_card: new card in this turn (int)
# deck: your deck (list[int]) before getting the new card
# called & snatched: player_id, -1 if not called/snatched
# level: level
# return -> list[int]
#     response = []
# ## 目前的策略是一拿到牌立刻报/反，之后不再报/反
# ## 不反无主
#     deck_poker = [Num2Poker(id) for id in deck]
#     get_poker = Num2Poker(get_card)
#     if get_poker[1] == level:
#         if called == -1:
#             response = [get_card]
#         elif snatched == -1:
#             if (get_card + 54) % 108 in deck:
#                 response = [get_card, (get_card + 54) % 108]
#     return response
    response = []
    deck = deck + [get_card]
    deck_poker = [Num2Poker(id) for id in deck]
    level_poker = [p[0] for p in deck_poker if isMajor(p,'n',level)]
    if len(level_poker) == 0 or snatched != -1: # 无级牌或已被反
        return response
    suit_score = evaluate_score(deck_poker,level)
    if called == -1:
        for suit, score in suit_score:
            if suit not in level_poker:
                continue
            if suit == 'n':
                if score >= 100.0: # TODO : 无主
                    break
                continue
            if score >= 5.6: # 亮
                response = [Poker2Num(suit + level,deck)]
                break
    elif snatched == -1:
        cnt = Counter(level_poker)
        level_poker2 = [p for p in cnt.keys() if cnt[p] == 2]
        major_score = dict(suit_score)[major]
        for suit, score in suit_score:
            if suit not in level_poker2:
                continue
            if suit == 'n' and score >= 100.0: # TODO : 无主
                break
            if major_score <= 4.0 or score >= major_score + 0.5: # 亮
                lp = Poker2Num(suit + level,deck)
                response = [lp, (lp + 54) % 108]
                break
    return response


def cover_Pub(old_public, deck, major, level):
    return
    # # old_public: raw publiccard (list[int])
    # deck_poker = [Num2Poker(id) for id in deck]
    # # 整理各个花色的手牌
    # suit_cards = {suit: [] for suit in suitset}
    # other_suit = [suit for suit in suitset].remove(major)
    # for s in other_suit:
    #     suit_cards[s] = [p for p in deck_poker if p[0] == s and p[1] != level]
    # suit_cards[major] = [p for p in deck_poker if isMajor(p, major, level)]
    
    # for s in suit_cards.keys():
    #     tgt = suit_cards[s]  
    #     suit_cards[s] = divide_suit(tgt)

    # # 去掉各个花色不打算埋的牌
        
    
    # # 贪心地尽量埋尽可能多的花色
    # public_cards = []

    # return old_public
    # return old_public

def playCard(history, hold, played, level, mv_gen, selfid):
    # generating action_options
    action_options = get_action_options(hold, history, level, mv_gen)
    # Since action_options always has length 1, directly use action_options[0]
    response = action_intpt(action_options[0], hold)
    return response


def get_action_options(deck, history, level, mv_gen):
    deck = [Num2Poker(p) for p in deck]
    if len(history) == 4 or len(history) == 0: # first to play
        #return mv_gen.gen_all(deck)
        return [mv_gen.gen_one_action()]
        #return mv_gen.gen_action_options()
    else:
        tgt = [Num2Poker(p) for p in history[0]]
        poktype = checkPokerType(history[0], level)
        if poktype == "single":
            #return mv_gen.gen_single(deck, tgt)
            return [mv_gen.gen_single_new(history)]
            #return mv_gen.gen_single_options(tgt)
        elif poktype == "pair":
            #return mv_gen.gen_pair(deck, tgt)
            return [mv_gen.gen_pair_new(history)]
        elif poktype == "tractor":
            return [mv_gen.gen_tractor_new(history)]
        elif poktype == "suspect":
            return [mv_gen.gen_throw_new(history)]    

def action_intpt(action, deck):
    '''
    interpreting action(cardname) to response(dick{'player': int, 'action': list[int]})
    action: list[str(cardnames)]
    '''
    action = Poker2Num_seq(action, deck)
    return action