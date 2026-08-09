import { useState, useEffect, useCallback } from 'react';
import { I18nProvider, useI18n } from './i18n/I18nProvider';
import LockScreen from './auth/LockScreen';
import UniverseScene from './scene/UniverseScene';
import { loadContainer, saveContainer } from './data/store';
import { encryptData } from './crypto/vault';
import './App.css';

// Бездействие дольше этого — сессия сама блокируется, masterKey и данные уходят из памяти.
const AUTO_LOCK_MS = 15 * 60 * 1000;

function AppShell() {
  const { lang } = useI18n();
  const [phase, setPhase] = useState('loading'); // loading | lock | unlocked
  const [container, setContainer] = useState(null);
  const [session, setSession] = useState(null); // { masterKey, masterKeyBytes, data }

  useEffect(() => {
    loadContainer().then((c) => {
      setContainer(c);
      setPhase('lock');
    });
  }, []);

  const handleUnlocked = useCallback((newContainer, sessionData) => {
    setContainer(newContainer);
    setSession(sessionData);
    setPhase('unlocked');
  }, []);

  const handlePersistContainer = useCallback(async (newContainer) => {
    await saveContainer(newContainer);
    setContainer(newContainer);
  }, []);

  const lockNow = useCallback(() => {
    setSession(null);
    setPhase('lock');
  }, []);

  // Каждое сохранение из редактора шифрует свежий снимок данных тем же masterKey
  // и сразу пишет его в IndexedDB — отдельного шага "публикации" нет.
  const handleUpdateData = useCallback(
    async (newData) => {
      setSession((s) => (s ? { ...s, data: newData } : s));
      const updatedContainer = await encryptData(container, session.masterKey, newData);
      await saveContainer(updatedContainer);
      setContainer(updatedContainer);
    },
    [container, session]
  );

  // Автоблокировка по бездействию: сбрасываем сессию из памяти и возвращаемся на экран пароля.
  useEffect(() => {
    if (phase !== 'unlocked') return undefined;
    let timer;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(lockNow, AUTO_LOCK_MS);
    };
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, resetTimer));
    resetTimer();
    return () => {
      clearTimeout(timer);
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
  }, [phase, lockNow]);

  if (phase === 'loading') {
    return <div className="mu-loading">…</div>;
  }

  if (phase === 'lock') {
    return (
      <LockScreen
        existingContainer={container}
        onPersistContainer={handlePersistContainer}
        onUnlocked={handleUnlocked}
      />
    );
  }

  // Этап 4 добавит сюда аналитику поверх той же сцены.
  return (
    <UniverseScene data={session.data} lang={lang} onLockNow={lockNow} onUpdateData={handleUpdateData} />
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AppShell />
    </I18nProvider>
  );
}
