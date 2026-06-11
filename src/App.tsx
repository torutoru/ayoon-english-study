// 화면 라우팅 (상태 기반 전환)
import { useEffect, useState } from 'react';
import { hasApiKey } from './config';
import { ChatScreen } from './screens/ChatScreen';
import { GameScreen } from './screens/GameScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { MainScreen } from './screens/MainScreen';
import type { Difficulty, Screen } from './types';

// 컨테이너 기준 크기 (index.css 의 #app 과 일치)
const BASE_W = 360;
const BASE_H = 640;

export default function App() {
  const [screen, setScreen] = useState<Screen>('main');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');

  const startMode = (mode: 'chat' | 'game', d: Difficulty) => {
    setDifficulty(d);
    setScreen(mode);
  };

  // 비율을 유지한 채 뷰포트를 채우도록 #app 배율 계산
  useEffect(() => {
    const fit = () => {
      const scale = Math.min(
        window.innerHeight / BASE_H,
        window.innerWidth / BASE_W,
      ) * 0.98; // 가장자리 여백
      document.documentElement.style.setProperty('--app-scale', String(scale));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  return (
    <div id="app">
      {!hasApiKey && (
        <div className="api-warning">
          ⚠️ OpenAI API 키가 없어요. <code>.env.local</code> 에{' '}
          <code>VITE_OPENAI_API_KEY</code> 를 넣어주세요.
        </div>
      )}
      {screen === 'main' && (
        <MainScreen onNav={setScreen} onStart={startMode} />
      )}
      {screen === 'chat' && (
        <ChatScreen key={`chat-${difficulty}`} onNav={setScreen} difficulty={difficulty} />
      )}
      {screen === 'game' && (
        <GameScreen key={`game-${difficulty}`} onNav={setScreen} difficulty={difficulty} />
      )}
      {screen === 'history' && <HistoryScreen key="history" onNav={setScreen} />}
    </div>
  );
}
