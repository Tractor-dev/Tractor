import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getRuleTableContent,
  ORIGINAL_RULE_CONTENT_BY_NAME,
  TABLE_RULE_CONTENT_BY_NAME
} from '../src/utils/ruleDisplayContent.js';
import { getImplementedRules } from '../../server/src/rules/ruleRegistry.js';

test('牌桌规则说明采用准确且适合局中阅读的文案', () => {
  assert.equal(
    getRuleTableContent({
      name: '时间倒流',
      content: '这是一段服务端为了精确实现而保留的很长说明'
    }),
    '每名玩家限一次，可在本轮及轮末停留时预备；轮末依次询问，首个确认者令牌局回到本轮开始前。'
  );
  assert.equal(
    getRuleTableContent({
      name: '欢乐成双',
      content: '详细说明'
    }),
    '庄家锁定后与上家换位，但原队伍不变，牌局结束后恢复座次；庄家方胜则由庄家的固定队友上庄，闲家方胜则由换位后庄家的下家上庄。'
  );
  assert.equal(
    getRuleTableContent({
      name: '取长补短',
      content: '包含郡王、亲王与完整牌力链的实现说明'
    }),
    '以庄家为0号位逆时针编号。第x轮，x%4号位全部牌升一级，(x+2)%4号位降一级；副牌不跨入主牌，升降可越过牌序端点，实体分值不变。'
  );
  assert.equal(Object.keys(TABLE_RULE_CONTENT_BY_NAME).length, 115);
  assert.equal(Object.keys(ORIGINAL_RULE_CONTENT_BY_NAME).length, 115);
});

test('所有已实现规则都有牌桌文案，已知失真条件不再沿用历史短版', () => {
  getImplementedRules().forEach(rule => {
    assert.equal(typeof TABLE_RULE_CONTENT_BY_NAME[rule.name], 'string', rule.name);
    assert.ok(TABLE_RULE_CONTENT_BY_NAME[rule.name].length > 0, rule.name);
  });

  assert.match(TABLE_RULE_CONTENT_BY_NAME['一马当先'], /仅第一轮/);
  assert.match(TABLE_RULE_CONTENT_BY_NAME['焦点人物'], /秘密表决/);
  assert.doesNotMatch(TABLE_RULE_CONTENT_BY_NAME['焦点人物'], /随机/);
  assert.match(TABLE_RULE_CONTENT_BY_NAME['文化革命'], /包括10、K/);
  assert.doesNotMatch(TABLE_RULE_CONTENT_BY_NAME['文化革命'], /不能为10\/K/);
  assert.match(TABLE_RULE_CONTENT_BY_NAME['三六九等'], /王只能亮主/);
  assert.match(TABLE_RULE_CONTENT_BY_NAME['三六九等'], /自然无主仍保留/);
  assert.match(TABLE_RULE_CONTENT_BY_NAME['守株待兔'], /可选5、10、K/);
  assert.match(TABLE_RULE_CONTENT_BY_NAME['中流砥柱'], /^庄家完成埋底后/);
  assert.match(TABLE_RULE_CONTENT_BY_NAME['模棱两可'], /仅本轮二、三号位/);
  assert.match(TABLE_RULE_CONTENT_BY_NAME['改稻为桑'], /副牌变同花色A，主牌变大王/);
  assert.match(TABLE_RULE_CONTENT_BY_NAME['偷梁换柱'], /普通牌/);
  assert.doesNotMatch(TABLE_RULE_CONTENT_BY_NAME['偷梁换柱'], /数字牌/);
  assert.match(TABLE_RULE_CONTENT_BY_NAME['神兵天降'], /未发动则保留/);
  assert.match(TABLE_RULE_CONTENT_BY_NAME['回光返照'], /首次出牌前/);
  assert.match(TABLE_RULE_CONTENT_BY_NAME['回光返照'], /一次出牌后仍有手牌/);
  assert.match(TABLE_RULE_CONTENT_BY_NAME['欢乐成双'], /固定队友上庄/);
  assert.match(TABLE_RULE_CONTENT_BY_NAME['铁证如山'], /第二张大王只影响下一轮/);
  assert.match(TABLE_RULE_CONTENT_BY_NAME['记录在案'], /重新独立显示一轮/);
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
