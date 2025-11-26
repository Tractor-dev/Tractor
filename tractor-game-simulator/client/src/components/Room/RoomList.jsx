import { useEffect } from 'react';
import { Table, Button, Tag, Space } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useI18n } from '../../locales/index.jsx';
import './RoomList.css';

export default function RoomList({ rooms, onJoinRoom, onRefresh, loading = false }) {
  const { t } = useI18n();

  const columns = [
    {
      title: t('room.roomName'),
      dataIndex: 'name',
      key: 'name',
      render: (text) => <strong>{text}</strong>
    },
    {
      title: t('room.roomId'),
      dataIndex: 'id',
      key: 'id',
      render: (text) => <code style={{ fontSize: '14px', fontWeight: 'bold' }}>{text}</code>
    },
    {
      title: t('room.players'),
      key: 'players',
      render: (_, record) => (
        <span>
          {record.playerCount} / {record.maxPlayers}
          {record.playerCount >= record.maxPlayers && (
            <Tag color="red" style={{ marginLeft: 8 }}>{t('room.full')}</Tag>
          )}
        </span>
      )
    },
    {
      title: t('connection.connectionStatus'),
      dataIndex: 'gameState',
      key: 'status',
      render: (gameState) => {
        const phase = gameState?.phase || 'waiting';
        const statusMap = {
          waiting: { text: t('roomStatus.waiting'), color: 'blue' },
          drawing: { text: t('roomStatus.drawing'), color: 'orange' },
          burying: { text: t('roomStatus.burying'), color: 'purple' },
          playing: { text: t('roomStatus.playing'), color: 'green' },
          revealing: { text: t('roomStatus.revealing'), color: 'cyan' },
          finished: { text: t('roomStatus.finished'), color: 'default' }
        };
        const status = statusMap[phase] || { text: phase, color: 'default' };
        return <Tag color={status.color}>{status.text}</Tag>;
      }
    },
    {
      title: t('game.bottomCards'),
      key: 'bottomCards',
      render: (_, record) => `${record.config?.bottomCardsCount || 8} ${t('common.cards')}`
    },
    {
      title: '',
      key: 'action',
      render: (_, record) => {
        const isFull = record.playerCount >= record.maxPlayers;
        const phase = record.gameState?.phase;
        const isPlaying = phase && phase !== 'waiting' && phase !== 'finished';
        const canJoin = !isFull && !isPlaying;

        return (
          <Button
            type="primary"
            size="small"
            onClick={() => onJoinRoom(record.id)}
            disabled={!canJoin}
          >
            {isFull ? t('room.full') : isPlaying ? t('room.inGame') : t('common.join')}
          </Button>
        );
      }
    }
  ];

  return (
    <div className="room-list">
      <div className="room-list-header">
        <h3>{t('room.roomList')}</h3>
        <Button
          icon={<ReloadOutlined />}
          onClick={onRefresh}
          loading={loading}
        >
          {t('common.refresh')}
        </Button>
      </div>
      <Table
        dataSource={rooms}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{
          pageSize: 10,
          showTotal: (total) => t('room.totalRooms', { count: total })
        }}
        locale={{
          emptyText: t('room.noRooms')
        }}
      />
    </div>
  );
}
