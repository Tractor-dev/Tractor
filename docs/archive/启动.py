import random
import json


def get_random_item(file_path):
    with open(file_path, 'r', encoding='utf-8') as file:
        data = json.load(file)
    return random.choice(data)


file_path = 'DLC.json'
random_item = get_random_item(file_path)
event_name = random_item.get("name", "未知事件")
event_content = random_item.get("content", "未知效果")

print(f"本局事件：“{event_name}”，效果是：“{event_content}”")
