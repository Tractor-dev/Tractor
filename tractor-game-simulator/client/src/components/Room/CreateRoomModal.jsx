import { Modal, Form, Input, InputNumber, Switch, Typography } from 'antd';
import { PlayModes } from '../../utils/constants';
import { useI18n } from '../../locales/index.jsx';

const { Text } = Typography;

export default function CreateRoomModal({ visible, onClose, onCreateRoom }) {
  const [form] = Form.useForm();
  const { t } = useI18n();

  const handleSubmit = () => {
    form.validateFields().then(values => {
      onCreateRoom(values);
      form.resetFields();
    });
  };

  return (
    <Modal
      title={t('room.createRoom')}
      open={visible}
      onOk={handleSubmit}
      onCancel={onClose}
      okText={t('common.create')}
      cancelText={t('common.cancel')}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          roomName: t('room.defaultRoomName'),
          playerName: `${t('room.defaultPlayerName')}1`,
          bottomCardsCount: 8,
          dealInterval: 100,
          isFreeMode: false
        }}
      >
        <Form.Item
          label={t('createRoomForm.roomNameLabel')}
          name="roomName"
          rules={[{ required: true, message: t('createRoomForm.roomNameRequired') }]}
        >
          <Input placeholder={t('createRoomForm.roomNamePlaceholder')} />
        </Form.Item>

        <Form.Item
          label={t('createRoomForm.playerNameLabel')}
          name="playerName"
          rules={[{ required: true, message: t('createRoomForm.playerNameRequired') }]}
        >
          <Input placeholder={t('createRoomForm.playerNamePlaceholder')} />
        </Form.Item>

        <Form.Item
          label={t('createRoomForm.bottomCardsLabel')}
          name="bottomCardsCount"
          rules={[{ required: true, message: t('createRoomForm.bottomCardsRequired') }]}
        >
          <InputNumber min={1} max={20} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          label={t('createRoomForm.dealIntervalLabel')}
          name="dealInterval"
          rules={[{ required: true, message: t('createRoomForm.dealIntervalRequired') }]}
        >
          <InputNumber min={10} max={5000} step={100} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item label={t('createRoomForm.gameModeLabel')}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text strong>{t('createRoomForm.freeMode')}:</Text>
              <Form.Item name="isFreeMode" noStyle valuePropName="checked">
                <Switch
                  checkedChildren={t('createRoomForm.freeModeOn')}
                  unCheckedChildren={t('createRoomForm.freeModeOff')}
                />
              </Form.Item>
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('createRoomForm.freeModeDesc')}<br />
              {t('createRoomForm.basicModeDesc')}
            </Text>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
}
