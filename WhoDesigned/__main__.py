import json
import os
from mvGen import move_generator
from myutils import setMajor, call_Snatch, cover_Pub, playCard


_online = os.environ.get("USER", "") == "root"

if _online:
    full_input = json.loads(input())
else:
    with open("input/log_forAI.json") as fo:
        full_input = json.load(fo)


hold = []
played = [[], [], [], []]
cards_left = [] 
# fill cards_left
for i in range(108):
    cards_left.append(i)
 
for i in range(len(full_input["requests"])-1):
    req = full_input["requests"][i]
    if req["stage"] == "deal":
        hold.extend(req["deliver"])
    elif req["stage"] == "cover":
        hold.extend(req["deliver"])
        action_cover = full_input["responses"][i]
        for id in action_cover:
            hold.remove(id)
            cards_left.remove(id) 
    elif req["stage"] == "play":
        history = req["history"]
        selfid = (history[3] + len(history[1])) % 4
        if len(history[0]) != 0:
            self_move = history[0][(selfid-history[2]) % 4]
            #print(hold)
            #print(self_move)
            for id in self_move:
                hold.remove(id)
            for player_rec in range(len(history[0])): # Recovering played cards
                played[(history[2]+player_rec) % 4].extend(history[0][player_rec])
                for id in history[0][player_rec]:
                    cards_left.remove(id)
curr_request = full_input["requests"][-1]
if curr_request["stage"] == "deal":
    get_card = curr_request["deliver"][0]
    called = curr_request["global"]["banking"]["called"]
    snatched = curr_request["global"]["banking"]["snatched"]
    level = curr_request["global"]["level"]
    major = curr_request["global"]["banking"]["major"]
    response = call_Snatch(get_card, hold, called, snatched, level, major)
elif curr_request["stage"] == "cover":
    publiccard = curr_request["deliver"]    
    level = curr_request["global"]["level"]
    major = curr_request["global"]["banking"]["major"]
    mv_gen = move_generator(level, major,full_input)
    response = mv_gen.cover_Pub()
    #response = publiccard
elif curr_request["stage"] == "play":
    level = curr_request["global"]["level"]
    major = curr_request["global"]["banking"]["major"]
    setMajor(major, level)
    # instantiate move_generator
    mv_gen = move_generator(level, major,full_input)
    history = curr_request["history"]
    selfid = (history[3] + len(history[1])) % 4
    if len(history[0]) != 0:
        self_move = history[0][(selfid-history[2]) % 4]
        #print(hold)
        #print(self_move)
        for id in self_move:
            hold.remove(id)
        for player_rec in range(len(history[0])): # Recovering played cards
            played[(history[2]+player_rec) % 4].extend(history[0][player_rec])
        for player_rec in range(len(history[1])):
            played[(history[3]+player_rec) % 4].extend(history[1][player_rec])
    history_curr = history[1]

    response = playCard(history_curr, hold, played, level, mv_gen, selfid)

print(json.dumps({
    "response":response
}))



