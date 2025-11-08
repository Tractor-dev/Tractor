import { Typography } from 'antd';
import Hand from './Hand';
import './GameTable.css';

const { Text } = Typography;

/**
 * 游戏桌面组件 - 4人位置布局
 * @param {Object} props
 * @param {Array} props.players - 所有玩家
 * @param {Object} props.currentPlayer - 当前玩家
 * @param {Object} props.playedCards - 每个玩家出的牌 { [playerId]: { playerName, cards } }
 * @param {Object} props.shownCards - 摸牌阶段展示的牌 { [playerId]: { playerName, cards } }
 * @param {Array} props.myCards - 我的手牌
 * @param {Array} props.selectedCards - 选中的牌
 * @param {Function} props.onCardClick - 点击牌的回调
 * @param {String} props.currentTurnPlayerId - 当前轮到谁出牌
 */
export default function GameTable({
  players,
  currentPlayer,
  playedCards = {},
  shownCards = {},
  myCards = [],
  selectedCards = [],
  onCardClick,
  currentTurnPlayerId
}) {
  // 根据玩家数量和当前玩家位置，计算每个位置显示哪个玩家
  const getPlayerPositions = () => {
    if (!currentPlayer || !players || players.length === 0) {
      return { bottom: null, top: null, left: null, right: null };
    }

    const myIndex = players.findIndex(p => p.id === currentPlayer.id);
    if (myIndex === -1) {
      return { bottom: null, top: null, left: null, right: null };
    }

    const positions = { bottom: players[myIndex] };

    // 根据玩家数量分配位置
    if (players.length === 2) {
      positions.top = players[(myIndex + 1) % 2];
    } else if (players.length === 3) {
      positions.left = players[(myIndex + 1) % 3];
      positions.right = players[(myIndex + 2) % 3];
    } else if (players.length === 4) {
      positions.right = players[(myIndex + 1) % 4];
      positions.top = players[(myIndex + 2) % 4];
      positions.left = players[(myIndex + 3) % 4];
    }

    return positions;
  };

  const positions = getPlayerPositions();

  // 渲染单个玩家区域
  const renderPlayerArea = (player, position) => {
    if (!player) return null;

    const isCurrentTurn = player.id === currentTurnPlayerId;
    const played = playedCards[player.id];
    const shown = shownCards[player.id];

    return (
      <div className={`player-area player-${position} ${isCurrentTurn ? 'current-turn' : ''}`}>
        <div className="player-info">
          <Text strong>{player.name}</Text>
          {isCurrentTurn && <Text type="warning"> (出牌中)</Text>}
          <br />
          <Text type="secondary">手牌: {player.cardsCount || 0}</Text>
          <br />
          <Text type="secondary">分数: {player.score || 0} | 等级: {player.level || 2}</Text>
        </div>

        <div className="player-cards-area">
          {played && played.cards && played.cards.length > 0 && (
            <div className="played-cards">
              <Text type="success">出牌:</Text>
              <Hand cards={played.cards} disabled small />
            </div>
          )}
          {shown && shown.cards && shown.cards.length > 0 && (
            <div className="shown-cards">
              <Text type="info">展示:</Text>
              <Hand cards={shown.cards} disabled small />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="game-table">
      {/* 上方玩家 */}
      {positions.top && (
        <div className="position-top">
          {renderPlayerArea(positions.top, 'top')}
        </div>
      )}

      {/* 中间区域：左、中央、右 */}
      <div className="position-middle">
        {/* 左边玩家 */}
        {positions.left && (
          <div className="position-left">
            {renderPlayerArea(positions.left, 'left')}
          </div>
        )}

        {/* 中央桌面 */}
        <div className="table-center">
          <div className="center-content">
            {/* 可以放置公共信息，如底牌数量等 */}
          </div>
        </div>

        {/* 右边玩家 */}
        {positions.right && (
          <div className="position-right">
            {renderPlayerArea(positions.right, 'right')}
          </div>
        )}
      </div>

      {/* 下方玩家（自己） */}
      {positions.bottom && (
        <div className="position-bottom">
          <div className="player-area player-bottom current-player">
            <div className="player-info">
              <Text strong>{positions.bottom.name} (我)</Text>
              <br />
              <Text type="secondary">分数: {positions.bottom.score || 0} | 等级: {positions.bottom.level || 2}</Text>
            </div>

            {/* 自己的出牌区域 */}
            <div className="my-play-area">
              {playedCards[positions.bottom.id] && playedCards[positions.bottom.id].cards && (
                <div className="my-played-cards">
                  <Text type="success">我的出牌:</Text>
                  <Hand cards={playedCards[positions.bottom.id].cards} disabled small />
                </div>
              )}
              {shownCards[positions.bottom.id] && shownCards[positions.bottom.id].cards && (
                <div className="my-shown-cards">
                  <Text type="info">我的展示:</Text>
                  <Hand cards={shownCards[positions.bottom.id].cards} disabled small />
                </div>
              )}
            </div>

            {/* 自己的手牌 - 偏左放置 */}
            <div className="my-hand">
              <Hand
                cards={myCards}
                selectedCards={selectedCards}
                onCardClick={onCardClick}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
