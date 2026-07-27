import assert from 'node:assert/strict';
import test from 'node:test';

import {
  IMPLEMENTED_RULES,
  RULE_SELECT_OPTIONS,
  ruleIncludesId
} from '../src/utils/ruleCatalog.js';
import { getImplementedRules } from '../../server/src/rules/ruleRegistry.js';

test('前端规则测试目录与服务端已实现规则保持一致', () => {
  const byId = (left, right) => left.id.localeCompare(right.id);
  assert.deepEqual(
    IMPLEMENTED_RULES.map(({ id, name }) => ({ id, name })).sort(byId),
    getImplementedRules().map(({ id, name }) => ({ id, name })).sort(byId)
  );
});

test('近期实现的规则已进入规则测试模式目录', () => {
  const expectedRules = [
    { id: 'divine_weapon', name: '神兵天降' },
    { id: 'magic_trick', name: '魔术戏法' },
    { id: 'abrupt_stop', name: '戛然而止' },
    { id: 'cluster_analysis', name: '聚类分析' },
    { id: 'forbidden_magic', name: '禁术秘法' },
    { id: 'meticulous_accounting', name: '锱铢必较' },
    { id: 'lost_in_fog', name: '如堕云雾' },
    { id: 'birds_gone_bow_hidden', name: '鸟尽弓藏' },
    { id: 'odd_even_scoring', name: '无独有偶' },
    { id: 'second_battlefield', name: '第二战场' },
    { id: 'one_country_two_systems', name: '一国两制' },
    { id: 'wooden_ox_flowing_horse', name: '木牛流马' },
    { id: 'strength_compensation', name: '取长补短' },
    { id: 'unarmed', name: '手无寸铁' },
    { id: 'mutual_support', name: '同舟共济' },
    { id: 'candle_to_dawn', name: '烛尽天明' },
    { id: 'cultural_revolution', name: '文化革命' },
    { id: 'three_tigers', name: '三人成虎' },
    { id: 'invite_into_urn', name: '请君入瓮' },
    { id: 'old_horse_still_has_strength', name: '老骥伏枥' },
    { id: 'trump_wins', name: 'Trump wins' },
    { id: 'openly_revealed', name: '昭然若揭' },
    { id: 'straw_boat_borrowing_arrows', name: '草船借箭' },
    { id: 'bush_gate', name: '布什戈门' },
    { id: 'teammate_cheer', name: '队友加油' },
    { id: 'illusion_and_reality', name: '虚虚实实' },
    { id: 'outward_harmony_inner_division', name: '貌合神离' },
    { id: 'ambiguous', name: '模棱两可' },
    { id: 'two_ghosts_knock_door', name: '二鬼拍门' },
    { id: 'people_commune', name: '人民公社' },
    { id: 'remove_firewood_from_under_cauldron', name: '釜底抽薪' },
    { id: 'mainstay', name: '中流砥柱' },
    { id: 'happy_twins', name: '欢乐成双' },
    { id: 'encircle_three_missing_one', name: '围三阙一' },
    { id: 'three_six_nine_grades', name: '三六九等' },
    { id: 'iron_evidence', name: '铁证如山' },
    { id: 'waiting_rabbit', name: '守株待兔' },
    { id: 'hidden_dragon_in_abyss', name: '潜龙在渊' },
    { id: 'administrative_review', name: '行政审查' },
    { id: 'political_review', name: '政治审查' },
    { id: 'no_one_survives', name: '无人生还' },
    { id: 'lure_tiger_from_mountain', name: '调虎离山' },
    { id: 'defense_as_offense', name: '以守为攻' },
    { id: 'antinomy', name: '二律背反' },
    { id: 'change_rice_to_mulberry', name: '改稻为桑' },
    { id: 'destroy_dyke_flood_fields', name: '毁堤淹田' },
    { id: 'record_on_file', name: '记录在案' },
    { id: 'weighing_thousand_jin', name: '上称千斤' },
    { id: 'king_over_white', name: '王上加白' },
    { id: 'fear_of_breaking_vase', name: '投鼠忌器' },
    { id: 'double_happiness', name: '双喜临门' }
  ];

  expectedRules.forEach(rule => {
    assert.deepEqual(IMPLEMENTED_RULES.find(item => item.id === rule.id), rule);
    assert.deepEqual(
      RULE_SELECT_OPTIONS.find(option => option.value === rule.id),
      { value: rule.id, label: rule.name }
    );
  });
});

test('双喜临门组合规则可同时识别两条子规则', () => {
  const rule = {
    id: 'double_happiness',
    rules: [
      { id: 'reverse_rank_order' },
      { id: 'single_step_debug' }
    ]
  };
  assert.equal(ruleIncludesId(rule, 'double_happiness'), true);
  assert.equal(ruleIncludesId(rule, 'reverse_rank_order'), true);
  assert.equal(ruleIncludesId(rule, 'single_step_debug'), true);
  assert.equal(ruleIncludesId(rule, 'normal_game'), false);
});
