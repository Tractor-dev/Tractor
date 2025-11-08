import { useEffect } from 'react';
import { Modal, Form, Input } from 'antd';

export default function JoinRoomModal({ visible, onClose, onJoinRoom, roomId = '' }) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible && roomId) {
      form.setFieldsValue({ roomId });
    }
  }, [visible, roomId, form]);

  const handleSubmit = () => {
    form.validateFields().then(values => {
      onJoinRoom(values);
      form.resetFields();
    });
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title="加入房间"
      open={visible}
      onOk={handleSubmit}
      onCancel={handleCancel}
      okText="加入"
      cancelText="取消"
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          playerName: `玩家${Math.floor(Math.random() * 1000)}`
        }}
      >
        <Form.Item
          label="房间ID"
          name="roomId"
          rules={[{ required: true, message: '请输入房间ID' }]}
        >
          <Input placeholder="请输入房间ID或从列表选择" disabled={!!roomId} />
        </Form.Item>

        <Form.Item
          label="你的昵称"
          name="playerName"
          rules={[{ required: true, message: '请输入昵称' }]}
        >
          <Input placeholder="请输入你的昵称" maxLength={20} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
