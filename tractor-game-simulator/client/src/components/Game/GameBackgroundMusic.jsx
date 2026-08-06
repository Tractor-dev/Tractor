import { useEffect, useRef, useState } from 'react';

const MUSIC_PREFERENCE_KEY = 'tractor-game-bgm-enabled';
const MUSIC_SOURCE = '/audio/qingyuan-xu-peidong.mp3';

const readMusicPreference = () => {
  try {
    const savedPreference = window.localStorage.getItem(MUSIC_PREFERENCE_KEY);
    return savedPreference === null ? true : savedPreference === 'true';
  } catch {
    return true;
  }
};

export default function GameBackgroundMusic() {
  const audioRef = useRef(null);
  const [isEnabled, setIsEnabled] = useState(readMusicPreference);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isWaitingForInteraction, setIsWaitingForInteraction] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(MUSIC_PREFERENCE_KEY, String(isEnabled));
    } catch {
      // 浏览器禁用本地存储时仍允许本次牌局正常播放。
    }
  }, [isEnabled]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;
    audio.volume = 0.28;

    if (!isEnabled) {
      audio.pause();
      setIsPlaying(false);
      setIsWaitingForInteraction(false);
      return undefined;
    }

    let isActive = true;
    const stopUnlockListeners = () => {
      window.removeEventListener('pointerdown', attemptPlayback, true);
      window.removeEventListener('keydown', attemptPlayback, true);
      window.removeEventListener('touchstart', attemptPlayback, true);
    };
    const attemptPlayback = async () => {
      if (!isActive || !isEnabled || !audio.paused) {
        if (!audio.paused) stopUnlockListeners();
        return;
      }
      try {
        await audio.play();
        if (!isActive) return;
        setIsPlaying(true);
        setIsWaitingForInteraction(false);
        stopUnlockListeners();
      } catch {
        if (isActive) setIsWaitingForInteraction(true);
      }
    };

    void attemptPlayback();
    // 移动浏览器通常会拦截无手势的有声自动播放；玩家第一次触碰牌桌时立即补播。
    window.addEventListener('pointerdown', attemptPlayback, true);
    window.addEventListener('keydown', attemptPlayback, true);
    window.addEventListener('touchstart', attemptPlayback, true);

    return () => {
      isActive = false;
      stopUnlockListeners();
    };
  }, [isEnabled]);

  const handleToggle = () => {
    const audio = audioRef.current;
    if (isEnabled) {
      audio?.pause();
      setIsEnabled(false);
      return;
    }

    setIsEnabled(true);
    setIsWaitingForInteraction(false);
    // 此处处于按钮点击的用户手势中，直接播放可避开移动端自动播放限制。
    audio?.play().catch(() => setIsWaitingForInteraction(true));
  };

  const label = !isEnabled
    ? '音乐已关'
    : isWaitingForInteraction
      ? '播放音乐'
      : '情缘';

  return (
    <div className="game-bgm-control">
      <audio
        ref={audioRef}
        className="game-bgm-audio"
        src={MUSIC_SOURCE}
        loop
        preload="auto"
        onPlay={() => {
          setIsPlaying(true);
          setIsWaitingForInteraction(false);
        }}
        onPause={() => setIsPlaying(false)}
        onError={() => {
          setIsPlaying(false);
          setIsWaitingForInteraction(false);
        }}
      />
      <button
        type="button"
        className={`game-bgm-toggle ${isEnabled ? 'is-enabled' : 'is-disabled'} ${isPlaying ? 'is-playing' : ''}`}
        onClick={handleToggle}
        aria-pressed={isEnabled}
        aria-label={isEnabled ? '关闭背景音乐《情缘》' : '播放背景音乐《情缘》'}
        title={isEnabled
          ? '背景音乐：《情缘》· 徐沛东（点击关闭）'
          : '背景音乐已关闭（点击播放）'}
      >
        <span className="game-bgm-note" aria-hidden="true">♪</span>
        <span className="game-bgm-label">{label}</span>
        <span className="game-bgm-levels" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </button>
    </div>
  );
}
