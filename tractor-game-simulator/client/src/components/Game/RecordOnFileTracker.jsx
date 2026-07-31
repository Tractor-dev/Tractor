import { getRecordOnFileTrackerView } from '../../utils/gameViewUtils';
import './RecordOnFileTracker.css';

export default function RecordOnFileTracker({
  recordOnFile,
  displayRoundNumber,
  showWhiteJoker = false,
  showRoyalJokers = false
}) {
  const view = getRecordOnFileTrackerView(
    recordOnFile,
    displayRoundNumber,
    { showWhiteJoker, showRoyalJokers }
  );
  if (!view) return null;

  const renderCount = (count, key, label) => (
    <span
      key={key}
      className={`record-cell record-count ${count >= 2 ? 'is-complete' : ''} ${count > 0 ? 'has-count' : ''}`}
      title={`${label} 已出 ${count} 张`}
      aria-label={`${label}已出${count}张`}
    >
      {count || ''}
    </span>
  );

  return (
    <aside
      className="record-on-file-tracker"
      aria-label={`记录在案记牌器，第${view.round}轮，本局已出${view.playedCardCount}张牌`}
      data-testid="record-on-file-tracker"
    >
      <header className="record-on-file-heading">
        <span className="record-on-file-seal" aria-hidden="true">记</span>
        <div>
          <strong>记录在案</strong>
          <small>第 {view.round} 轮 · 已出 {view.playedCardCount} 张</small>
        </div>
        <span className="record-on-file-legend">数字为已出张数</span>
      </header>

      <div className="record-on-file-body">
        <div className="record-on-file-grid" role="table" aria-label="按花色和点数统计已出普通牌">
          <span className="record-cell record-corner" aria-hidden="true" />
          {view.ranks.map(rank => (
            <span key={rank} className="record-cell record-rank" role="columnheader">
              {rank}
            </span>
          ))}

          {view.suits.flatMap(suit => [
            <span
              key={`${suit.id}-label`}
              className={`record-cell record-suit suit-${suit.id}`}
              role="rowheader"
            >
              {suit.label}
            </span>,
            ...suit.counts.map((count, index) => renderCount(
              count,
              `${suit.id}-${view.ranks[index]}`,
              `${suit.label}${view.ranks[index]}`
            ))
          ])}
        </div>

        <div
          className={[
            'record-on-file-jokers',
            view.showRoyalJokers ? 'has-royal-jokers' : '',
            view.showWhiteJoker ? 'has-white-joker' : ''
          ].filter(Boolean).join(' ')}
          aria-label="王牌已出牌统计"
        >
          <span className="record-on-file-jokers-title">王牌</span>
          <div className="record-joker-item">
            <span>小王</span>
            {renderCount(view.jokers[0], 'small-joker', '小王')}
          </div>
          <div className="record-joker-item">
            <span>大王</span>
            {renderCount(view.jokers[1], 'big-joker', '大王')}
          </div>
          {view.showRoyalJokers && (
            <>
              <div className="record-joker-item">
                <span>郡王</span>
                {renderCount(view.jokers[2], 'county-prince-joker', '郡王')}
              </div>
              <div className="record-joker-item">
                <span>亲王</span>
                {renderCount(view.jokers[3], 'prince-joker', '亲王')}
              </div>
            </>
          )}
          {view.showWhiteJoker && (
            <div className="record-joker-item">
              <span>白王</span>
              {renderCount(
                view.jokers[view.showRoyalJokers ? 4 : 2],
                'white-joker',
                '白王'
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
