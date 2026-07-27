import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getRuleTableContent,
  ORIGINAL_RULE_CONTENT_BY_NAME
} from '../src/utils/ruleDisplayContent.js';

test('牌桌规则说明采用 rule-website DLC.json 的原始短文案', () => {
  assert.equal(
    getRuleTableContent({
      name: '时间倒流',
      content: '这是一段服务端为了精确实现而保留的很长说明'
    }),
    '每名玩家限1次，在一轮出牌结束后可以选择回溯到上一轮出牌结束时的状态。'
  );
  assert.equal(
    getRuleTableContent({
      name: '欢乐成双',
      content: '详细说明'
    }),
    '庄家与上家交换位置。'
  );
  assert.equal(Object.keys(ORIGINAL_RULE_CONTENT_BY_NAME).length, 115);
});

test('双喜临门分别显示两条子规则的短文案', () => {
  assert.equal(
    getRuleTableContent({
      name: '双喜临门',
      content: '冗长的组合规则说明',
      rules: [
        { name: '世事无常', content: '详细说明一' },
        { name: '王上加白', content: '详细说明二' }
      ]
    }),
    '世事无常：正常对局。；王上加白：本局随机一张王牌变为全局最大的白王（皇）。'
  );
});

test('未收录规则仍回退到服务端提供的说明', () => {
  assert.equal(
    getRuleTableContent({ name: '未来规则', content: '未来规则说明' }),
    '未来规则说明'
  );
});
