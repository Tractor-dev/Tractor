import { Typography, Button } from 'antd';
import Hand from './Hand';
import { sortCards } from '../../utils/cardUtils';
import { useI18n } from '../../locales/index.jsx';
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
 * @param {Boolean} props.isRevealingPhase - 是否是揭示底牌阶段，移除边框避免遮挡
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
  dealerPlayerIndex = null,
  isRevealingPhase = false
}) {
  const { t } = useI18n();

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
      joker: t('suits.joker'),
      no_trump: t('trump.noTrump')
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

    // 在揭示阶段隐藏边框，添加 compact 样式让区域更紧凑
    const playerAreaClasses = [
      'player-area',
      `player-${position}`,
      isCurrentTurn && !isRevealingPhase ? 'current-turn' : '',
      isRevealingPhase ? 'revealing-phase compact' : ''
    ].filter(Boolean).join(' ');

    return (
      <div className={playerAreaClasses}>
        <div className="player-info compact-info">
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Text strong style={{ fontSize: 'inherit' }}>{player.name}</Text>
            {isDealer && (
              <span style={{
                background: 'linear-gradient(135deg, #ffd700, #ffed4e)',
                color: '#8B4513',
                fontSize: '10px',
                fontWeight: 'bold',
                padding: '1px 6px',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
              }}>
                {t('common.dealer')}
              </span>
            )}
            {isWaitingForReady && player.isReady !== undefined && (
              <Text
                strong
                style={{
                  fontSize: '10px',
                  color: player.isReady ? '#52c41a' : '#d9d9d9'
                }}
              >
                {player.isReady ? '✓' : '○'}
              </Text>
            )}
          </div>
          {isCurrentTurn && !isRevealingPhase && <Text type="warning" style={{ fontSize: '10px' }}> ({t('play.myTurn')})</Text>}
          <Text type="secondary" style={{ display: 'block', fontSize: 'inherit', lineHeight: 1.3 }}>
            {t('hand.cardCount', { count: player.cardsCount || 0 })} | {t('common.score')}: {player.score || 0} | {t('common.level')}: {player.level || 2}
          </Text>
        </div>

        {/* 只在有内容时渲染牌区域 */}
        {!isRevealingPhase && (hasDeclaredTrump || (shown && shown.cards && shown.cards.length > 0)) && (
          <div className="player-cards-area">
            {/* 亮主区域 - 其他玩家的亮主在这里居中显示 */}
            {hasDeclaredTrump && currentTrumpDeclaration.cards && currentTrumpDeclaration.cards.length > 0 && (
              <div className="declared-trump-zone">
                <Hand cards={currentTrumpDeclaration.cards} disabled trumpSuit={trumpSuit} trumpRank={trumpRank} />
              </div>
            )}

            {shown && shown.cards && shown.cards.length > 0 && (
              <div className="shown-cards">
                <Text type="info">{t('hand.show')}</Text>
                <Hand cards={shown.cards} disabled trumpSuit={trumpSuit} trumpRank={trumpRank} />
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // 判断我方队伍（索引0和2是队伍1，索引1和3是队伍2）
  const getTeamLabels = () => {
    if (!currentPlayer || !players || players.length === 0) {
      return { myTeamLabel: t('team.myTeam'), opponentTeamLabel: t('team.opponentTeam'), myTeamLevel: team1Level, opponentTeamLevel: team2Level };
    }

    const myIndex = players.findIndex(p => p.id === currentPlayer.id);
    if (myIndex === -1) {
      return { myTeamLabel: t('team.myTeam'), opponentTeamLabel: t('team.opponentTeam'), myTeamLevel: team1Level, opponentTeamLevel: team2Level };
    }

    // 索引0和2是队伍1，索引1和3是队伍2
    const myTeam = myIndex % 2 === 0 ? 1 : 2;

    if (myTeam === 1) {
      return {
        myTeamLabel: t('team.myTeam'),
        opponentTeamLabel: t('team.opponentTeam'),
        myTeamLevel: team1Level,
        opponentTeamLevel: team2Level
      };
    } else {
      return {
        myTeamLabel: t('team.myTeam'),
        opponentTeamLabel: t('team.opponentTeam'),
        myTeamLevel: team2Level,
        opponentTeamLevel: team1Level
      };
    }
  };

  const teamLabels = getTeamLabels();

  // 渲染出牌区域（在玩家框和桌面中央之间）
  const renderPlayedCardsArea = (player, position) => {
    if (!player) return null;
    const played = playedCards[player.id];

    // 始终渲染出牌区域，即使没有牌，以保持布局稳定
    return (
      <div className={`played-cards-area played-cards-${position}`}>
        {played && played.cards && played.cards.length > 0 && (
          <Hand cards={sortCards(played.cards, trumpSuit, trumpRank)} disabled trumpSuit={trumpSuit} trumpRank={trumpRank} />
        )}
      </div>
    );
  };

  return (
    <div className="game-table">
      {/* 左上角得分和等级显示 - 始终显示 */}
      <div className="score-panel">
        {/* 队伍等级显示 */}
        <div className="score-panel-teams">
          <div className="score-panel-team">
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', display: 'block' }}>{teamLabels.myTeamLabel} {t('team.teamLevel')}</Text>
            <Text strong style={{ color: '#52c41a', fontSize: '18px' }}>{teamLabels.myTeamLevel}</Text>
          </div>
          <div className="score-panel-team">
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', display: 'block' }}>{teamLabels.opponentTeamLabel} {t('team.teamLevel')}</Text>
            <Text strong style={{ color: '#ff4d4f', fontSize: '18px' }}>{teamLabels.opponentTeamLevel}</Text>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Text strong style={{ color: '#ffd700', fontSize: '14px' }}>{t('bottom.attackerScore')}</Text>
        </div>
        <div className="score-panel-score">
          {attackerScore} {t('common.points')}
        </div>
        <div className="score-panel-cards">
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', display: 'block', marginBottom: '4px' }}>
            {t('bottom.pointCards')} ({collectedPointCards.length}):
          </Text>
          {collectedPointCards.length > 0 ? (
            <div className="score-panel-cards-list">
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
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{t('common.none')}</Text>
          )}
        </div>
      </div>

      {/* 上方玩家 */}
      {positions.top && (
        <div className="position-top">
          {renderPlayerArea(positions.top, 'top')}
          {renderPlayedCardsArea(positions.top, 'top')}
        </div>
      )}

      {/* 中间区域：左、中央、右 */}
      <div className="position-middle">
        {/* 左边玩家 */}
        {positions.left && (
          <div className="position-left">
            {renderPlayerArea(positions.left, 'left')}
            {renderPlayedCardsArea(positions.left, 'left')}
          </div>
        )}

        {/* 中央桌面 */}
        <div className="table-center">
          <div className="center-content">
            {/* 底牌展示（优先显示） */}
            {revealedBottomCards && revealedBottomCards.length > 0 ? (
              <div style={{ textAlign: 'center' }}>
                <Text strong style={{ fontSize: '18px', color: 'white', display: 'block', marginBottom: '12px' }}>
                  {t('bottom.bottomCards')}:
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
                      {bottomScoreResult.attackerWonBottom ? t('bottom.attackerWonBottom') : t('bottom.dealerKeptBottom')}
                    </Text>
                    {bottomScoreResult.attackerWonBottom && (
                      <Text style={{ color: 'white', fontSize: '14px' }}>
                        {t('bottom.bottomPoints', { points: bottomScoreResult.bottomPoints, multiplier: bottomScoreResult.bottomMultiplier, gained: bottomScoreResult.bottomScoreGained })}
                      </Text>
                    )}
                    <div style={{ marginTop: '8px' }}>
                      <Text strong style={{ color: '#ffd700', fontSize: '16px' }}>
                        {t('bottom.totalScore', { score: bottomScoreResult.totalScore })}
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
                      {upgradeResult.attackerWon ? t('bottom.attackerWins') : t('bottom.dealerWins')}
                    </Text>

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-around',
                      marginBottom: '12px',
                      paddingBottom: '12px',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.2)'
                    }}>
                      <div style={{ textAlign: 'center' }}>
                        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', display: 'block' }}>{t('bottom.dealerTeam')}</Text>
                        <Text style={{ color: 'white', fontSize: '16px' }}>
                          {upgradeResult.oldDealerLevel} → <Text strong style={{ color: '#ffd700', fontSize: '18px' }}>{upgradeResult.newDealerLevel}</Text>
                        </Text>
                        {upgradeResult.dealerLevelUp > 0 && (
                          <Text style={{ color: '#52c41a', fontSize: '14px', display: 'block' }}>
                            {t('bottom.levelUp', { count: upgradeResult.dealerLevelUp })}
                          </Text>
                        )}
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', display: 'block' }}>{t('bottom.attackerTeam')}</Text>
                        <Text style={{ color: 'white', fontSize: '16px' }}>
                          {upgradeResult.oldAttackerLevel} → <Text strong style={{ color: '#ffd700', fontSize: '18px' }}>{upgradeResult.newAttackerLevel}</Text>
                        </Text>
                        {upgradeResult.attackerLevelUp > 0 && (
                          <Text style={{ color: '#52c41a', fontSize: '14px', display: 'block' }}>
                            {t('bottom.levelUp', { count: upgradeResult.attackerLevelUp })}
                          </Text>
                        )}
                      </div>
                    </div>

                    <div style={{ textAlign: 'center' }}>
                      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                        {t('bottom.nextDealer')}
                      </Text>
                      <Text strong style={{ color: '#ffd700', fontSize: '16px' }}>
                        {upgradeResult.nextDealerName} ({t('bottom.level')} {upgradeResult.nextDealerLevel})
                      </Text>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
                {/* 主牌显示 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Text strong style={{ fontSize: '16px' }}>{t('trump.trump')}:</Text>
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
                    <Text type="secondary">{t('trump.notSet')}</Text>
                  )}
                  {isHost && onSetTrump && (
                    <Button size="small" onClick={onSetTrump}>
                      {trumpSuit && trumpRank ? t('trump.modifyTrump') : t('trump.setTrump')}
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
                        <Text strong style={{ fontSize: '14px', color: '#ffd700' }}>{t('trump.dealerCountdown')}</Text>
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
                      {currentTrumpDeclaration ? t('trump.countdownReset') : t('trump.randomDealer')}
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
                    <Text strong style={{ fontSize: '16px', color: 'white' }}>{t('rules.rule')}:</Text>
                    <Button size="small" onClick={onSelectRule}>
                      {selectedRule ? t('rules.changeRule') : t('rules.selectRule')}
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
                      {t('rules.noRuleSelected')}
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
            {renderPlayedCardsArea(positions.right, 'right')}
          </div>
        )}
      </div>

      {/* 下方玩家（自己） */}
      {positions.bottom && (
        <div className="position-bottom">
          {/* 我的出牌区域 - 在玩家框上方居中（揭示阶段隐藏） */}
          {!isRevealingPhase && renderPlayedCardsArea(positions.bottom, 'bottom')}

          <div className={[
            'player-area',
            'player-bottom',
            'current-player',
            positions.bottom.id === currentTurnPlayerId && !isRevealingPhase ? 'current-turn' : '',
            isRevealingPhase ? 'revealing-phase compact' : ''
          ].filter(Boolean).join(' ')}>
            {/* 上半部分：玩家信息和控制按钮 */}
            <div className="bottom-player-header">
              <div className="player-info compact-info">
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                  <Text strong style={{ fontSize: 'inherit' }}>{positions.bottom.name} ({t('common.me')})</Text>
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
                        fontSize: '10px',
                        fontWeight: 'bold',
                        padding: '1px 6px',
                        borderRadius: '8px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                      }}>
                        {t('common.dealer')}
                      </span>
                    ) : null;
                  })()}
                  {isWaitingForReady && positions.bottom.isReady !== undefined && (
                    <Text
                      strong
                      style={{
                        fontSize: '12px',
                        color: positions.bottom.isReady ? '#52c41a' : '#d9d9d9'
                      }}
                    >
                      {positions.bottom.isReady ? `✓ ${t('common.readied')}` : `○ ${t('common.notReady')}`}
                    </Text>
                  )}
                </div>
                <Text type="secondary" style={{ display: 'block', fontSize: 'inherit', lineHeight: 1.3 }}>
                  {t('common.score')}: {positions.bottom.score || 0} | {t('common.level')}: {positions.bottom.level || 2}
                </Text>
              </div>

              {/* 控制按钮区域 - 右侧 */}
              {renderControls && (
                <div className="inline-controls">
                  {renderControls}
                </div>
              )}
            </div>

            {/* 亮主条（仅摸牌阶段显示，揭示阶段隐藏） */}
            {trumpDeclarationComponent && !isRevealingPhase && (
              <div className="trump-declaration-wrapper">
                {trumpDeclarationComponent}
              </div>
            )}

            {/* 自己的手牌区域 - 左端分一小块作为亮主区（揭示阶段隐藏） */}
            {!isRevealingPhase && (
              <div className="my-hand-container">
                {/* 亮主区域 - 只在有亮主时显示 */}
                {currentTrumpDeclaration && currentTrumpDeclaration.playerId === positions.bottom.id && (
                  <div className="bottom-trump-zone">
                    {currentTrumpDeclaration.cards && currentTrumpDeclaration.cards.length > 0 && (
                      <Hand cards={currentTrumpDeclaration.cards} disabled trumpSuit={trumpSuit} trumpRank={trumpRank} />
                    )}
                  </div>
                )}
                {/* 我自己展示的牌区域 - 在手牌左侧 */}
                {(() => {
                  const myShownCards = shownCards[positions.bottom.id];
                  const hasShownCards = myShownCards && myShownCards.cards && myShownCards.cards.length > 0;
                  if (!hasShownCards) return null;
                  return (
                    <div className="bottom-shown-zone" style={{ marginRight: '16px' }}>
                      <Text type="info" style={{ fontSize: '12px', marginBottom: '4px', display: 'block' }}>{t('hand.myShow')}</Text>
                      <Hand cards={myShownCards.cards} disabled trumpSuit={trumpSuit} trumpRank={trumpRank} />
                    </div>
                  );
                })()}
                {/* 手牌区域 */}
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}
