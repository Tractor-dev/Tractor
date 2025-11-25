import { useEffect } from 'react';
import { Modal, Form, Input } from 'antd';
import { useI18n } from '../../locales/index.jsx';

export default function JoinRoomModal({ visible, onClose, onJoinRoom, roomId = '' }) {
  const [form] = Form.useForm();
  const { t } = useI18n();

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
      title={t('room.joinRoom')}
      open={visible}
      onOk={handleSubmit}
      onCancel={handleCancel}
      okText={t('common.join')}
      cancelText={t('common.cancel')}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          playerName: `${t('room.defaultPlayerName')}${Math.floor(Math.random() * 1000)}`
        }}
      >
        <Form.Item
          label={t('joinRoomForm.roomIdLabel')}
          name="roomId"
          rules={[{ required: true, message: t('joinRoomForm.roomIdRequired') }]}
        >
          <Input placeholder={t('room.enterRoomId')} disabled={!!roomId} />
        </Form.Item>

        <Form.Item
          label={t('createRoomForm.playerNameLabel')}
          name="playerName"
          rules={[{ required: true, message: t('createRoomForm.playerNameRequired') }]}
        >
          <Input placeholder={t('createRoomForm.playerNamePlaceholder')} maxLength={20} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
