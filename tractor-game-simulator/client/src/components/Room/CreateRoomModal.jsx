import { Modal, Form, Input, InputNumber, Checkbox, Select, Typography } from 'antd';
import { RULE_SELECT_OPTIONS } from '../../utils/ruleCatalog';

export default function CreateRoomModal({ visible, onClose, onCreateRoom }) {
  const [form] = Form.useForm();
  const testMode = Form.useWatch('testMode', form);
  const normalModeOnly = Form.useWatch('normalModeOnly', form);

  const handleSubmit = () => {
    form.validateFields().then(values => {
      onCreateRoom(values);
      form.resetFields();
    });
  };

  return (
    <Modal
      title="创建房间"
      open={visible}
      onOk={handleSubmit}
      onCancel={onClose}
      okText="创建"
      cancelText="取消"
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          roomName: '我的房间',
          playerName: '玩家1',
          dealInterval: 500,
          normalModeOnly: false,
          testMode: false,
          testRuleId: 'normal_game'
        }}
      >
        <Form.Item
          label="房间名称"
          name="roomName"
          rules={[{ required: true, message: '请输入房间名称' }]}
        >
          <Input placeholder="请输入房间名称" />
        </Form.Item>

        <Form.Item
          label="你的昵称"
          name="playerName"
          rules={[{ required: true, message: '请输入昵称' }]}
        >
          <Input placeholder="请输入你的昵称" />
        </Form.Item>

        <Form.Item
          label="发牌间隔（毫秒）"
          name="dealInterval"
          rules={[{ required: true, message: '请输入发牌间隔' }]}
        >
          <InputNumber min={10} max={5000} step={100} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="normalModeOnly" valuePropName="checked" style={{ marginBottom: 8 }}>
          <Checkbox
            onChange={(e) => {
              if (e.target.checked) {
                form.setFieldsValue({ testMode: false });
              }
            }}
          >
            无特殊规则（普通对局）
          </Checkbox>
        </Form.Item>
        <Typography.Text type="secondary">
          开启后每局直接使用「世事无常」，跳过随机二选一。
        </Typography.Text>

        {!normalModeOnly && (
          <>
            <Form.Item name="testMode" valuePropName="checked" style={{ marginBottom: 8, marginTop: 12 }}>
              <Checkbox>规则测试模式</Checkbox>
            </Form.Item>
            <Typography.Text type="secondary">
              开启后跳过随机二选一，每局直接使用指定规则。
            </Typography.Text>
            {testMode && (
              <Form.Item
                label="测试规则"
                name="testRuleId"
                rules={[{ required: true, message: '请选择测试规则' }]}
                style={{ marginTop: 12 }}
              >
                <Select options={RULE_SELECT_OPTIONS} showSearch optionFilterProp="label" />
              </Form.Item>
            )}
          </>
        )}
      </Form>
    </Modal>
  );
}
