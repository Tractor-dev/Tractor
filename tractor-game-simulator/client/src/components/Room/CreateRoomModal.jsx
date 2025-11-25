import { Modal, Form, Input, InputNumber, Switch, Typography } from 'antd';
import { PlayModes } from '../../utils/constants';

const { Text } = Typography;

export default function CreateRoomModal({ visible, onClose, onCreateRoom }) {
  const [form] = Form.useForm();

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
          bottomCardsCount: 8,
          dealInterval: 500,
          playMode: PlayModes.ORDERED
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
          label="底牌数量"
          name="bottomCardsCount"
          rules={[{ required: true, message: '请输入底牌数量' }]}
        >
          <InputNumber min={1} max={20} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          label="发牌间隔（毫秒）"
          name="dealInterval"
          rules={[{ required: true, message: '请输入发牌间隔' }]}
        >
          <InputNumber min={10} max={5000} step={100} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          label="游戏模式"
          name="playMode"
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text strong>自由模式:</Text>
              <Form.Item name="playMode" noStyle valuePropName="checked" getValueFromEvent={(checked) => checked ? PlayModes.FREE : PlayModes.ORDERED}>
                <Switch
                  checkedChildren="开启"
                  unCheckedChildren="关闭"
                />
              </Form.Item>
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              自由模式：无出牌顺序限制，可随时出牌、展示牌、调整分数等级<br />
              基础模式：按顺序出牌，完善的亮主、得分和升级规则
            </Text>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
}
