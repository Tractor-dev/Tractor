#!/bin/bash

# 测试 simple bot 的输入输出

echo "=== 测试 simple_bot.py ==="

# 创建测试输入
TEST_INPUT='{
  "id": 0,
  "deck": ["h3", "h4", "h5", "s2", "s3", "d6"],
  "history": [],
  "major": [],
  "played": [[], [], [], []]
}'

echo "输入数据:"
echo "$TEST_INPUT"
echo ""

echo "Bot 输出:"
echo "$TEST_INPUT" | python3 /home/user/Tractor/simple-bot/simple_bot.py

echo ""
echo "=== 测试完成 ==="
