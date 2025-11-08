import { Modal, Form, Input, InputNumber } from 'antd';

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
          dealInterval: 500
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
      </Form>
    </Modal>
  );
}
