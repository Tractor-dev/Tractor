import { Typography, Button } from 'antd';
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
 * @param {Function} props.onReorder - 重新排序手牌的回调
 * @param {String} props.currentTurnPlayerId - 当前轮到谁出牌
 * @param {String} props.trumpSuit - 主牌花色
 * @param {String} props.trumpRank - 主牌点数
 * @param {Boolean} props.isHost - 是否是房主
 * @param {Function} props.onSetTrump - 设置主牌的回调
 * @param {Array} props.revealedBottomCards - 揭示的底牌
 * @param {Object} props.selectedRule - 选中的规则 { name, content }
 * @param {Function} props.onSelectRule - 选择规则的回调
 * @param {ReactNode} props.renderControls - 渲染控制区域的函数或组件
 * @param {Boolean} props.isWaitingForReady - 是否在等待玩家准备阶段
 * @param {ReactNode} props.trumpDeclarationComponent - 亮主条组件
 * @param {Object} props.currentTrumpDeclaration - 当前亮主信息
 * @param {Number} props.attackerScore - 闲家当前得分
 * @param {Array} props.collectedPointCards - 闲家收集的分数牌
 * @param {Object} props.bottomScoreResult - 底牌得分结果
 * @param {Object} props.upgradeResult - 升级结果
 * @param {Number} props.team1Level - 队伍1等级
 * @param {Number} props.team2Level - 队伍2等级
 * @param {Number} props.dealerPlayerIndex - 庄家玩家索引
 */
export default function GameTable({
  players,
  currentPlayer,
  playedCards = {},
  shownCards = {},
  myCards = [],
  selectedCards = [],
  onCardClick,
  onReorder,
  currentTurnPlayerId,
  trumpSuit = null,
  trumpRank = null,
  isHost = false,
  onSetTrump,
  revealedBottomCards = null,
  selectedRule = null,
  onSelectRule,
  renderControls = null,
  isWaitingForReady = false,
  trumpDeclarationComponent = null,
  currentTrumpDeclaration = null,
  buryingPlayerId = null,
  dealerCountdown = null,
  attackerScore = 0,
  collectedPointCards = [],
  bottomScoreResult = null,
  upgradeResult = null,
  team1Level = 2,
  team2Level = 2,
  dealerPlayerIndex = null
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

  // 获取花色符号
  const getSuitSymbol = (suit) => {
    const symbols = {
      hearts: '♥',
      diamonds: '♦',
      clubs: '♣',
      spades: '♠'
    };
    return symbols[suit] || '';
  };

  // 获取花色颜色
  const getSuitColor = (suit) => {
    return (suit === 'hearts' || suit === 'diamonds') ? 'red' : 'black';
  };

  // 获取花色符号（扩展版）
  const getSuitSymbolExtended = (suit) => {
    const symbols = {
      hearts: '♥',
      diamonds: '♦',
      clubs: '♣',
      spades: '♠',
      joker: '王',
      no_trump: '无主'
    };
    return symbols[suit] || suit;
  };

  // 渲染单个玩家区域
  const renderPlayerArea = (player, position) => {
    if (!player) return null;

    const isCurrentTurn = player.id === currentTurnPlayerId;
    const played = playedCards[player.id];
    const shown = shownCards[player.id];

    // 检查是否是当前亮主的玩家
    const hasDeclaredTrump = currentTrumpDeclaration && currentTrumpDeclaration.playerId === player.id;

    // 检查是否是庄家
    // 优先使用 dealerPlayerIndex（从第二局开始就知道了）
    // 如果 dealerPlayerIndex 存在，根据索引判断
    // 否则使用 buryingPlayerId（第一局摸完牌后才知道）
    let isDealer = false;
    if (dealerPlayerIndex !== null && players && players.length > 0) {
      const playerIndex = players.findIndex(p => p.id === player.id);
      isDealer = playerIndex === dealerPlayerIndex;
    } else if (buryingPlayerId) {
      isDealer = player.id === buryingPlayerId;
    }

    return (
      <div className={`player-area player-${position} ${isCurrentTurn ? 'current-turn' : ''}`}>
        <div className="player-info">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
            <Text strong>{player.name}</Text>
            {isDealer && (
              <span style={{
                background: 'linear-gradient(135deg, #ffd700, #ffed4e)',
                color: '#8B4513',
                fontSize: '12px',
                fontWeight: 'bold',
                padding: '2px 8px',
                borderRadius: '10px',
                marginLeft: '4px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }}>
                庄
              </span>
            )}
            {isWaitingForReady && player.isReady !== undefined && (
              <Text
                strong
                style={{
                  fontSize: '12px',
                  color: player.isReady ? '#52c41a' : '#d9d9d9'
                }}
              >
                {player.isReady ? '✓' : '○'}
              </Text>
            )}
          </div>
          {isCurrentTurn && <Text type="warning"> (出牌中)</Text>}
          <br />
          <Text type="secondary">手牌: {player.cardsCount || 0}</Text>
          <br />
          <Text type="secondary">分数: {player.score || 0} | 等级: {player.level || 2}</Text>
        </div>

        <div className="player-cards-area">
          {/* 显示亮主信息 */}
          {hasDeclaredTrump && (
            <div className="declared-trump">
              <Text
                strong
                style={{
                  color: '#f5222d',
                  fontSize: '14px',
                  background: 'rgba(255, 255, 255, 0.9)',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  display: 'inline-block',
                  marginBottom: '6px'
                }}
              >
                {currentTrumpDeclaration.isCounter ? '反主' : '亮主'}
              </Text>
              {currentTrumpDeclaration.cards && currentTrumpDeclaration.cards.length > 0 && (
                <Hand cards={currentTrumpDeclaration.cards} disabled small trumpSuit={trumpSuit} trumpRank={trumpRank} />
              )}
            </div>
          )}

          {played && played.cards && played.cards.length > 0 && (
            <div className="played-cards">
              <Text type="success">出牌:</Text>
              <Hand cards={played.cards} disabled small trumpSuit={trumpSuit} trumpRank={trumpRank} />
            </div>
          )}
          {shown && shown.cards && shown.cards.length > 0 && (
            <div className="shown-cards">
              <Text type="info">展示:</Text>
              <Hand cards={shown.cards} disabled small trumpSuit={trumpSuit} trumpRank={trumpRank} />
            </div>
          )}
        </div>
      </div>
    );
  };

  // 判断我方队伍（索引0和2是队伍1，索引1和3是队伍2）
  const getTeamLabels = () => {
    if (!currentPlayer || !players || players.length === 0) {
      return { myTeamLabel: '我方', opponentTeamLabel: '对方', myTeamLevel: team1Level, opponentTeamLevel: team2Level };
    }

    const myIndex = players.findIndex(p => p.id === currentPlayer.id);
    if (myIndex === -1) {
      return { myTeamLabel: '我方', opponentTeamLabel: '对方', myTeamLevel: team1Level, opponentTeamLevel: team2Level };
    }

    // 索引0和2是队伍1，索引1和3是队伍2
    const myTeam = myIndex % 2 === 0 ? 1 : 2;

    if (myTeam === 1) {
      return {
        myTeamLabel: '我方',
        opponentTeamLabel: '对方',
        myTeamLevel: team1Level,
        opponentTeamLevel: team2Level
      };
    } else {
      return {
        myTeamLabel: '我方',
        opponentTeamLabel: '对方',
        myTeamLevel: team2Level,
        opponentTeamLevel: team1Level
      };
    }
  };

  const teamLabels = getTeamLabels();

  return (
    <div className="game-table">
      {/* 左上角得分和等级显示 - 始终显示 */}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: '12px 16px',
        borderRadius: '8px',
        border: '2px solid #ffd700',
        zIndex: 100,
        width: '300px'
      }}>
        {/* 队伍等级显示 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '12px',
          paddingBottom: '8px',
          borderBottom: '1px solid rgba(255, 215, 0, 0.3)'
        }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', display: 'block' }}>{teamLabels.myTeamLabel}等级</Text>
            <Text strong style={{ color: '#52c41a', fontSize: '18px' }}>{teamLabels.myTeamLevel}</Text>
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', display: 'block' }}>{teamLabels.opponentTeamLabel}等级</Text>
            <Text strong style={{ color: '#ff4d4f', fontSize: '18px' }}>{teamLabels.opponentTeamLevel}</Text>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Text strong style={{ color: '#ffd700', fontSize: '14px' }}>闲家得分</Text>
        </div>
        <div style={{
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#fff',
          textAlign: 'center',
          marginBottom: '8px'
        }}>
          {attackerScore} 分
        </div>
        <div style={{
          height: '100px',
          position: 'relative'
        }}>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', display: 'block', marginBottom: '4px' }}>
            分数牌 ({collectedPointCards.length}):
          </Text>
          {collectedPointCards.length > 0 ? (
            <div style={{
              display: 'flex',
              flexWrap: 'nowrap',
              overflowX: 'auto',
              overflowY: 'hidden',
              maxHeight: '80px',
              paddingBottom: '8px'
            }}>
              {collectedPointCards.map((card, index) => (
                <div
                  key={card.id || index}
                  style={{
                    marginLeft: index === 0 ? '0' : '-20px',
                    flexShrink: 0
                  }}
                >
                  <Hand cards={[card]} disabled small trumpSuit={trumpSuit} trumpRank={trumpRank} />
                </div>
              ))}
            </div>
          ) : (
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>暂无</Text>
          )}
        </div>
      </div>

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
            {/* 底牌展示（优先显示） */}
            {revealedBottomCards && revealedBottomCards.length > 0 ? (
              <div style={{ textAlign: 'center' }}>
                <Text strong style={{ fontSize: '18px', color: 'white', display: 'block', marginBottom: '12px' }}>
                  底牌：
                </Text>
                <Hand
                  cards={revealedBottomCards}
                  disabled
                  small
                  trumpSuit={bottomScoreResult?.currentGameTrumpSuit || trumpSuit}
                  trumpRank={bottomScoreResult?.currentGameTrumpRank || trumpRank}
                />

                {/* 底牌得分结果 */}
                {bottomScoreResult && (
                  <div style={{
                    marginTop: '16px',
                    padding: '12px 20px',
                    backgroundColor: bottomScoreResult.attackerWonBottom ? 'rgba(82, 196, 26, 0.2)' : 'rgba(255, 215, 0, 0.2)',
                    borderRadius: '8px',
                    border: `2px solid ${bottomScoreResult.attackerWonBottom ? '#52c41a' : '#ffd700'}`
                  }}>
                    <Text strong style={{
                      fontSize: '20px',
                      color: bottomScoreResult.attackerWonBottom ? '#52c41a' : '#ffd700',
                      display: 'block',
                      marginBottom: '8px'
                    }}>
                      {bottomScoreResult.resultText}
                    </Text>
                    {bottomScoreResult.attackerWonBottom && (
                      <Text style={{ color: 'white', fontSize: '14px' }}>
                        底牌 {bottomScoreResult.bottomPoints} 分 × {bottomScoreResult.bottomMultiplier} 倍 = {bottomScoreResult.bottomScoreGained} 分
                      </Text>
                    )}
                    <div style={{ marginTop: '8px' }}>
                      <Text strong style={{ color: '#ffd700', fontSize: '16px' }}>
                        闲家总分：{bottomScoreResult.totalScore} 分
                      </Text>
                    </div>
                  </div>
                )}

                {/* 升级结果 */}
                {upgradeResult && (
                  <div style={{
                    marginTop: '16px',
                    padding: '12px 20px',
                    backgroundColor: upgradeResult.attackerWon ? 'rgba(82, 196, 26, 0.2)' : 'rgba(255, 77, 79, 0.2)',
                    borderRadius: '8px',
                    border: `2px solid ${upgradeResult.attackerWon ? '#52c41a' : '#ff4d4f'}`
                  }}>
                    <Text strong style={{
                      fontSize: '24px',
                      color: upgradeResult.attackerWon ? '#52c41a' : '#ff4d4f',
                      display: 'block',
                      marginBottom: '12px',
                      textAlign: 'center'
                    }}>
                      {upgradeResult.attackerWon ? '🎉 闲家获胜！' : '👑 庄家获胜！'}
                    </Text>

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-around',
                      marginBottom: '12px',
                      paddingBottom: '12px',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.2)'
                    }}>
                      <div style={{ textAlign: 'center' }}>
                        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', display: 'block' }}>庄家队伍</Text>
                        <Text style={{ color: 'white', fontSize: '16px' }}>
                          {upgradeResult.oldDealerLevel} → <Text strong style={{ color: '#ffd700', fontSize: '18px' }}>{upgradeResult.newDealerLevel}</Text>
                        </Text>
                        {upgradeResult.dealerLevelUp > 0 && (
                          <Text style={{ color: '#52c41a', fontSize: '14px', display: 'block' }}>
                            ↑ 升{upgradeResult.dealerLevelUp}级
                          </Text>
                        )}
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', display: 'block' }}>闲家队伍</Text>
                        <Text style={{ color: 'white', fontSize: '16px' }}>
                          {upgradeResult.oldAttackerLevel} → <Text strong style={{ color: '#ffd700', fontSize: '18px' }}>{upgradeResult.newAttackerLevel}</Text>
                        </Text>
                        {upgradeResult.attackerLevelUp > 0 && (
                          <Text style={{ color: '#52c41a', fontSize: '14px', display: 'block' }}>
                            ↑ 升{upgradeResult.attackerLevelUp}级
                          </Text>
                        )}
                      </div>
                    </div>

                    <div style={{ textAlign: 'center' }}>
                      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                        下一局庄家
                      </Text>
                      <Text strong style={{ color: '#ffd700', fontSize: '16px' }}>
                        {upgradeResult.nextDealerName} (等级 {upgradeResult.nextDealerLevel})
                      </Text>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
                {/* 主牌显示 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Text strong style={{ fontSize: '16px' }}>主牌：</Text>
                  {trumpSuit && trumpRank ? (
                    <Text
                      style={{
                        fontSize: '24px',
                        fontWeight: 'bold',
                        color: getSuitColor(trumpSuit)
                      }}
                    >
                      {getSuitSymbol(trumpSuit)} {trumpRank}
                    </Text>
                  ) : (
                    <Text type="secondary">未设置</Text>
                  )}
                  {isHost && (
                    <Button size="small" onClick={onSetTrump}>
                      {trumpSuit && trumpRank ? '修改' : '设置'}
                    </Button>
                  )}
                </div>

                {/* 庄家倒计时显示 */}
                {dealerCountdown !== null && dealerCountdown > 0 && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: 'rgba(255, 215, 0, 0.2)',
                    padding: '16px 24px',
                    borderRadius: '12px',
                    border: '2px solid #ffd700',
                    boxShadow: '0 4px 12px rgba(255, 215, 0, 0.3)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '32px' }}>⏰</span>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <Text strong style={{ fontSize: '14px', color: '#ffd700' }}>指定庄家倒计时</Text>
                        <Text style={{
                          fontSize: '36px',
                          fontWeight: 'bold',
                          color: dealerCountdown <= 3 ? '#ff4757' : '#ffd700',
                          textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                        }}>
                          {dealerCountdown}
                        </Text>
                      </div>
                    </div>
                    <Text style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.8)' }}>
                      {currentTrumpDeclaration ? '有人亮主，倒计时已重置' : '无人亮主将随机指定'}
                    </Text>
                  </div>
                )}

                {/* 规则显示 */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  padding: '12px 20px',
                  borderRadius: '8px',
                  minWidth: '250px',
                  maxWidth: '400px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Text strong style={{ fontSize: '16px', color: 'white' }}>规则：</Text>
                    <Button size="small" onClick={onSelectRule}>
                      {selectedRule ? '更换' : '选择'}规则
                    </Button>
                  </div>
                  {selectedRule ? (
                    <div style={{ textAlign: 'center', width: '100%' }}>
                      <Text strong style={{ fontSize: '18px', color: '#ffd700', display: 'block', marginBottom: '6px' }}>
                        {selectedRule.name}
                      </Text>
                      <Text style={{ fontSize: '14px', color: '#ffffff', lineHeight: '1.5' }}>
                        {selectedRule.content}
                      </Text>
                    </div>
                  ) : (
                    <Text type="secondary" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                      未选择规则
                    </Text>
                  )}
                </div>
              </div>
            )}
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
            {/* 上半部分：玩家信息、出牌区、控制按钮 */}
            <div className="bottom-player-header">
              <div className="player-info">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Text strong>{positions.bottom.name} (我)</Text>
                  {(() => {
                    // 检查是否是庄家 - 使用和其他位置相同的判断逻辑
                    let isDealer = false;
                    if (dealerPlayerIndex !== null && players && players.length > 0) {
                      const playerIndex = players.findIndex(p => p.id === positions.bottom.id);
                      isDealer = playerIndex === dealerPlayerIndex;
                    } else if (buryingPlayerId) {
                      isDealer = positions.bottom.id === buryingPlayerId;
                    }

                    return isDealer ? (
                      <span style={{
                        background: 'linear-gradient(135deg, #ffd700, #ffed4e)',
                        color: '#8B4513',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        marginLeft: '4px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }}>
                        庄
                      </span>
                    ) : null;
                  })()}
                  {isWaitingForReady && positions.bottom.isReady !== undefined && (
                    <Text
                      strong
                      style={{
                        fontSize: '14px',
                        color: positions.bottom.isReady ? '#52c41a' : '#d9d9d9'
                      }}
                    >
                      {positions.bottom.isReady ? '✓ 已准备' : '○ 未准备'}
                    </Text>
                  )}
                </div>
                <Text type="secondary">分数: {positions.bottom.score || 0} | 等级: {positions.bottom.level || 2}</Text>
              </div>

              {/* 我的出牌/展示区域 - 在控制按钮左边 */}
              <div className="my-play-area-inline">
                {/* 显示我的亮主信息 */}
                {currentTrumpDeclaration && currentTrumpDeclaration.playerId === positions.bottom.id && (
                  <div className="my-declared-trump-inline" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <Text
                      strong
                      style={{
                        color: '#f5222d',
                        fontSize: '14px',
                        background: 'rgba(255, 255, 255, 0.9)',
                        padding: '4px 8px',
                        borderRadius: '12px',
                        display: 'inline-block',
                        marginBottom: '6px'
                      }}
                    >
                      {currentTrumpDeclaration.isCounter ? '反主' : '亮主'}
                    </Text>
                    {currentTrumpDeclaration.cards && currentTrumpDeclaration.cards.length > 0 && (
                      <Hand cards={currentTrumpDeclaration.cards} disabled small trumpSuit={trumpSuit} trumpRank={trumpRank} />
                    )}
                  </div>
                )}

                {playedCards[positions.bottom.id] && playedCards[positions.bottom.id].cards && playedCards[positions.bottom.id].cards.length > 0 && (
                  <div className="my-played-cards-inline">
                    <Text type="success" style={{ color: '#52c41a', fontSize: '12px', marginBottom: '4px', display: 'block' }}>我的出牌:</Text>
                    <Hand cards={playedCards[positions.bottom.id].cards} disabled small trumpSuit={trumpSuit} trumpRank={trumpRank} />
                  </div>
                )}
                {shownCards[positions.bottom.id] && shownCards[positions.bottom.id].cards && shownCards[positions.bottom.id].cards.length > 0 && (
                  <div className="my-shown-cards-inline">
                    <Text type="info" style={{ color: '#1890ff', fontSize: '12px', marginBottom: '4px', display: 'block' }}>我的展示:</Text>
                    <Hand cards={shownCards[positions.bottom.id].cards} disabled small trumpSuit={trumpSuit} trumpRank={trumpRank} />
                  </div>
                )}
              </div>

              {/* 控制按钮区域 - 在出牌区右边 */}
              {renderControls && (
                <div className="inline-controls">
                  {renderControls}
                </div>
              )}
            </div>

            {/* 亮主条（仅摸牌阶段显示） */}
            {trumpDeclarationComponent && (
              <div className="trump-declaration-wrapper">
                {trumpDeclarationComponent}
              </div>
            )}

            {/* 自己的手牌 */}
            <div className="my-hand">
              <Hand
                cards={myCards}
                selectedCards={selectedCards}
                onCardClick={onCardClick}
                onReorder={onReorder}
                trumpSuit={trumpSuit}
                trumpRank={trumpRank}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
