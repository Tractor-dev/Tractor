import { useEffect } from 'react';
import { Table, Button, Tag, Space } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import './RoomList.css';

export default function RoomList({ rooms, onJoinRoom, onRefresh, loading = false }) {
  const columns = [
    {
      title: '房间名称',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <strong>{text}</strong>
    },
    {
      title: '房间ID',
      dataIndex: 'id',
      key: 'id',
      render: (text) => <code style={{ fontSize: '14px', fontWeight: 'bold' }}>{text}</code>
    },
    {
      title: '玩家',
      key: 'players',
      render: (_, record) => (
        <span>
          {record.playerCount} / {record.maxPlayers}
          {record.playerCount >= record.maxPlayers && (
            <Tag color="red" style={{ marginLeft: 8 }}>已满</Tag>
          )}
        </span>
      )
    },
    {
      title: '状态',
      dataIndex: 'gameState',
      key: 'status',
      render: (gameState, record) => {
        const phase = gameState?.phase || record.phase || 'waiting';
        if (phase === 'waiting' && gameState?.isWaitingForReady) {
          return <Tag color="gold">准备中</Tag>;
        }
        const statusMap = {
          waiting: { text: '等待中', color: 'blue' },
          drawing: { text: '摸牌中', color: 'orange' },
          burying: { text: '埋底中', color: 'purple' },
          playing: { text: '游戏中', color: 'green' },
          revealing: { text: '揭底中', color: 'cyan' },
          finished: { text: '已结束', color: 'default' }
        };
        const status = statusMap[phase] || { text: phase, color: 'default' };
        return <Tag color={status.color}>{status.text}</Tag>;
      }
    },
    {
      title: '默认底牌',
      key: 'bottomCards',
      render: () => '8 张'
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => {
        const isFull = record.playerCount >= record.maxPlayers;
        const phase = record.gameState?.phase || record.phase;
        const isPlaying = phase && phase !== 'waiting' && phase !== 'finished';
        const canJoin = !isFull && !isPlaying;

        return (
          <Button
            type="primary"
            size="small"
            onClick={() => onJoinRoom(record.id)}
            disabled={!canJoin}
          >
            {isFull ? '已满' : isPlaying ? '游戏中' : '加入'}
          </Button>
        );
      }
    }
  ];

  return (
    <div className="room-list">
      <div className="room-list-header">
        <h3>房间列表</h3>
        <Button
          icon={<ReloadOutlined />}
          onClick={onRefresh}
          loading={loading}
        >
          刷新
        </Button>
      </div>
      <Table
        dataSource={rooms}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{
          pageSize: 10,
          showTotal: (total) => `共 ${total} 个房间`
        }}
        locale={{
          emptyText: '暂无房间，点击上方"创建房间"开始游戏'
        }}
      />
    </div>
  );
}
