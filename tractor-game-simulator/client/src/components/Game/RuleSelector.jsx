import { useState, useEffect } from 'react';
import { Modal, Button, Input, List, Space, Typography, Divider, message } from 'antd';
import { SearchOutlined, ReloadOutlined, EditOutlined } from '@ant-design/icons';
import './RuleSelector.css';

const { Text, Title } = Typography;
const { TextArea } = Input;

/**
 * 规则选择器组件
 * @param {Object} props
 * @param {Boolean} props.visible - 是否显示弹窗
 * @param {Function} props.onClose - 关闭弹窗的回调
 * @param {Function} props.onRuleSelected - 选择规则的回调，参数为 { name, content }
 */
export default function RuleSelector({ visible, onClose, onRuleSelected }) {
  const [rules, setRules] = useState([]);
  const [filteredRules, setFilteredRules] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [customRuleName, setCustomRuleName] = useState('');
  const [customRuleContent, setCustomRuleContent] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  // 加载规则数据
  useEffect(() => {
    if (visible) {
      fetch('/DLC.json')
        .then(res => res.json())
        .then(data => {
          setRules(data);
          setFilteredRules(data);
        })
        .catch(err => {
          console.error('加载规则失败:', err);
          messageApi.error('加载规则失败，请检查DLC.json文件');
        });
    }
  }, [visible]);

  // 搜索规则
  useEffect(() => {
    if (searchText.trim() === '') {
      setFilteredRules(rules);
    } else {
      const filtered = rules.filter(rule =>
        rule.name.includes(searchText) || rule.content.includes(searchText)
      );
      setFilteredRules(filtered);
    }
  }, [searchText, rules]);

  // 随机选择规则
  const handleRandomSelect = () => {
    if (rules.length === 0) {
      messageApi.warning('没有可用的规则');
      return;
    }
    const randomIndex = Math.floor(Math.random() * rules.length);
    const selectedRule = rules[randomIndex];
    onRuleSelected(selectedRule);
    messageApi.success(`已随机选择规则: ${selectedRule.name}`);
    handleClose();
  };

  // 选择指定规则
  const handleSelectRule = (rule) => {
    onRuleSelected(rule);
    messageApi.success(`已选择规则: ${rule.name}`);
    handleClose();
  };

  // 保存自定义规则
  const handleSaveCustomRule = () => {
    const trimmedName = customRuleName.trim();
    const trimmedContent = customRuleContent.trim();

    if (!trimmedName) {
      messageApi.warning('规则名称不能为空');
      return;
    }
    if (!trimmedContent) {
      messageApi.warning('规则内容不能为空');
      return;
    }
    if (trimmedName.length > 20) {
      messageApi.warning('规则名称不能超过20个字符');
      return;
    }
    if (trimmedContent.length > 200) {
      messageApi.warning('规则内容不能超过200个字符');
      return;
    }

    const customRule = {
      name: trimmedName,
      content: trimmedContent
    };

    onRuleSelected(customRule);
    messageApi.success(`已保存自定义规则: ${trimmedName}`);
    handleClose();
  };

  // 关闭弹窗
  const handleClose = () => {
    setSearchText('');
    setCustomRuleName('');
    setCustomRuleContent('');
    setShowCustomInput(false);
    onClose();
  };

  return (
    <>
      {contextHolder}
      <Modal
        title="选择游戏规则"
        open={visible}
        onCancel={handleClose}
        footer={null}
        width={700}
        destroyOnClose
      >
        {!showCustomInput ? (
          <>
            {/* 操作按钮区域 */}
            <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
              <Space>
                <Button
                  type="primary"
                  icon={<ReloadOutlined />}
                  onClick={handleRandomSelect}
                >
                  随机选择
                </Button>
                <Button
                  icon={<EditOutlined />}
                  onClick={() => setShowCustomInput(true)}
                >
                  自定义规则
                </Button>
              </Space>
            </Space>

            {/* 搜索框 */}
            <Input
              placeholder="搜索规则名称或内容..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              style={{ marginBottom: 16 }}
            />

            {/* 规则列表 */}
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <List
                dataSource={filteredRules}
                renderItem={(rule) => (
                  <List.Item
                    style={{ cursor: 'pointer', padding: '12px' }}
                    onClick={() => handleSelectRule(rule)}
                    hoverable
                  >
                    <List.Item.Meta
                      title={<Text strong>{rule.name}</Text>}
                      description={rule.content}
                    />
                  </List.Item>
                )}
                locale={{ emptyText: '没有找到匹配的规则' }}
              />
            </div>

            <Divider style={{ margin: '12px 0' }} />

            <div style={{ textAlign: 'center' }}>
              <Text type="secondary">
                共 {filteredRules.length} 条规则
                {searchText && ` (从 ${rules.length} 条中筛选)`}
              </Text>
            </div>
          </>
        ) : (
          <>
            {/* 自定义规则输入 */}
            <div>
              <Title level={5}>自定义规则</Title>

              <Text strong>规则名称：</Text>
              <Input
                placeholder="请输入规则名称（最多20字符）"
                maxLength={20}
                value={customRuleName}
                onChange={(e) => setCustomRuleName(e.target.value)}
                style={{ marginTop: 8, marginBottom: 16 }}
              />

              <Text strong>规则内容：</Text>
              <TextArea
                placeholder="请输入规则内容（最多200字符）"
                maxLength={200}
                rows={6}
                value={customRuleContent}
                onChange={(e) => setCustomRuleContent(e.target.value)}
                style={{ marginTop: 8, marginBottom: 16 }}
              />

              <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button onClick={() => setShowCustomInput(false)}>
                  返回
                </Button>
                <Button type="primary" onClick={handleSaveCustomRule}>
                  确认
                </Button>
              </Space>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
