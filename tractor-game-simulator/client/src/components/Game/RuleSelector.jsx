import { useEffect, useState } from 'react';
import { Modal, Button, Typography, Space, Empty } from 'antd';
import { CheckCircleFilled, ReloadOutlined } from '@ant-design/icons';
import './RuleSelector.css';

const { Text, Title } = Typography;

export default function RuleSelector({
  visible,
  rules = [],
  selectionMode = 'single',
  canChoose = true,
  canRefresh = false,
  onRuleSelected,
  onRefreshRule,
  onClose
}) {
  const isDoubleHappiness = selectionMode === 'double_happiness';
  const [selectedRuleIds, setSelectedRuleIds] = useState([]);

  useEffect(() => {
    setSelectedRuleIds(previous => (
      previous.filter(id => rules.some(rule => rule.id === id))
    ));
  }, [rules]);

  useEffect(() => {
    if (!visible || !isDoubleHappiness) setSelectedRuleIds([]);
  }, [visible, isDoubleHappiness]);

  const toggleRule = ruleId => {
    if (!canChoose) return;
    setSelectedRuleIds(previous => {
      if (previous.includes(ruleId)) {
        return previous.filter(id => id !== ruleId);
      }
      if (previous.length >= 2) return previous;
      return [...previous, ruleId];
    });
  };

  const submitDoubleHappiness = () => {
    if (selectedRuleIds.length !== 2) return;
    onRuleSelected?.(selectedRuleIds);
  };

  return (
    <Modal
      title={isDoubleHappiness ? '双喜临门 · 三选二' : '选择本局特殊规则'}
      open={visible}
      footer={isDoubleHappiness && canChoose ? (
        <Button
          type="primary"
          disabled={selectedRuleIds.length !== 2}
          onClick={submitDoubleHappiness}
        >
          确认采用这两条规则
        </Button>
      ) : null}
      closable={!canChoose && Boolean(onClose)}
      maskClosable={false}
      keyboard={!canChoose}
      onCancel={!canChoose ? onClose : undefined}
      width={760}
      destroyOnClose
    >
      <Text type="secondary">
        {isDoubleHappiness
          ? canChoose
            ? '请选择两条同时生效的规则。若候选组合不合理，可以请房主刷新其中一条。'
            : canRefresh
              ? '本局选择者正在挑选两条规则；你可以刷新任意一条不合理的候选。'
              : '本局选择者正在挑选两条规则；所有玩家都可以查看当前候选。'
          : canChoose
            ? '你是本局的规则选择者。请选择一条规则，选择后本局立即采用且不能更换。'
            : '本局选择者正在挑选规则；所有玩家都可以查看当前候选，但只有选择者可以确认。'}
      </Text>

      {rules.length === 0 ? (
        <Empty description="正在等待服务端生成候选规则" />
      ) : (
        <Space direction="vertical" size={12} style={{ width: '100%', marginTop: 20 }}>
          {rules.map((rule, index) => {
            const selected = selectedRuleIds.includes(rule.id);
            const selectionLocked = (
              isDoubleHappiness
              && !selected
              && selectedRuleIds.length >= 2
            );
            return (
              <div
                className={`rule-option-shell ${selected ? 'is-selected' : ''}`}
                key={rule.id}
              >
                <Button
                  className="rule-option"
                  block
                  disabled={!canChoose || selectionLocked}
                  onClick={() => (
                    isDoubleHappiness
                      ? toggleRule(rule.id)
                      : onRuleSelected?.(rule)
                  )}
                >
                  <span className="rule-option-layout">
                    <Title className="rule-option-name" level={5}>
                      {selected && <CheckCircleFilled className="rule-option-check" />}
                      {rule.name}
                    </Title>
                    <Text className="rule-option-description">{rule.content}</Text>
                  </span>
                </Button>
                {isDoubleHappiness && canRefresh && (
                  <Button
                    className="rule-option-refresh"
                    icon={<ReloadOutlined />}
                    onClick={() => onRefreshRule?.(index)}
                    title={`刷新“${rule.name}”`}
                  >
                    换一条
                  </Button>
                )}
              </div>
            );
          })}
        </Space>
      )}
    </Modal>
  );
}
