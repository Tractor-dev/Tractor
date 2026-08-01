import { useEffect, useState } from 'react';

export default function MobileLandscapeGuard() {
  const [status, setStatus] = useState('');

  useEffect(() => {
    const resetViewportOrigin = () => {
      window.requestAnimationFrame(() => window.scrollTo({ left: 0, top: 0, behavior: 'instant' }));
    };
    resetViewportOrigin();
    window.addEventListener('resize', resetViewportOrigin);
    window.screen?.orientation?.addEventListener?.('change', resetViewportOrigin);
    return () => {
      window.removeEventListener('resize', resetViewportOrigin);
      window.screen?.orientation?.removeEventListener?.('change', resetViewportOrigin);
    };
  }, []);

  const requestLandscape = async () => {
    const orientation = window.screen?.orientation;

    if (typeof orientation?.lock !== 'function') {
      setStatus('当前浏览器不能自动旋转，请关闭竖屏锁定后横置手机');
      return;
    }

    try {
      if (document.fullscreenEnabled && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      }
      await orientation.lock('landscape');
      setStatus('已请求横屏显示');
    } catch {
      setStatus('请关闭竖屏锁定后横置手机');
    }
  };

  return (
    <aside
      className="portrait-orientation-guard"
      data-testid="portrait-orientation-guard"
      aria-label="请横屏游戏"
    >
      <div className="portrait-orientation-card">
        <div className="portrait-orientation-icon" aria-hidden="true">
          <span className="portrait-phone-shape" />
          <span className="portrait-rotate-arrow">↻</span>
        </div>
        <strong>请横屏游戏</strong>
        <p>横置手机后，牌桌、操作按钮和完整手牌会同时显示。</p>
        <button type="button" onClick={requestLandscape}>尝试进入横屏</button>
        <small aria-live="polite">
          {status || '若屏幕没有旋转，请先关闭系统的竖屏锁定'}
        </small>
      </div>
    </aside>
  );
}
