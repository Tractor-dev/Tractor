import { Modal, Form, Input } from 'antd';

export default function JoinRoomModal({ visible, onClose, onJoinRoom, roomId }) {
  const [form] = Form.useForm();

  const handleSubmit = () => {
    form.validateFields().then(values => {
      onJoinRoom({ ...values, roomId });
      form.resetFields();
    });
  };

  return (
    <Modal
      title="加入房间"
      open={visible}
      onOk={handleSubmit}
      onCancel={onClose}
      okText="加入"
      cancelText="取消"
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          playerName: '玩家'
        }}
      >
        <Form.Item
          label="房间ID"
          name="roomId"
        >
          <Input disabled value={roomId} />
        </Form.Item>

        <Form.Item
          label="你的昵称"
          name="playerName"
          rules={[{ required: true, message: '请输入昵称' }]}
        >
          <Input placeholder="请输入你的昵称" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
