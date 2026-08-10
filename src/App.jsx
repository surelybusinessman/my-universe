import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { I18nProvider, useI18n } from './i18n/I18nProvider';
import LockScreen from './auth/LockScreen';
import { loadContainer, saveContainer, loadMeta, saveMeta } from './data/store';
import { downloadBackup } from './data/backup';
import { pickAutoBackupFolder, ensureWritePermission, writeAutoBackup } from './data/autoBackup';
import { encryptData } from './crypto/vault';
import './App.css';

// Three.js со всей 3D-обвязкой весит больше мегабайта и нужен только после входа.
// Ленивая загрузка убирает его из стартового бандла — экран пароля появляется сразу.
const UniverseScene = lazy(() => import('./scene/UniverseScene'));

// Бездействие дольше этого — сессия сама блокируется, masterKey и данные уходят из памяти.
const AUTO_LOCK_MS = 15 * 60 * 1000;

function AppShell() {
  const { lang } = useI18n();
  const [phase, setPhase] = useState('loading'); // loading | lock | unlocked
  const [container, setContainer] = useState(null);
  const [session, setSession] = useState(null); // { masterKey, masterKeyBytes, data }
  const [lastBackupAt, setLastBackupAt] = useState(null);
  const [autoBackupDir, setAutoBackupDir] = useState(null);

  useEffect(() => {
    loadContainer().then((c) => {
      setContainer(c);
      setPhase('lock');
    });
    loadMeta().then((meta) => {
      setLastBackupAt(meta.lastBackupAt || null);
      setAutoBackupDir(meta.autoBackupDirHandle || null);
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

  // Скачиваем именно зашифрованный контейнер, а не расшифрованные данные:
  // файл можно спокойно хранить в облаке или на флешке.
  const handleExportBackup = useCallback(() => {
    if (!container) return;
    downloadBackup(container);
    const stamp = new Date().toISOString();
    saveMeta({ lastBackupAt: stamp });
    setLastBackupAt(stamp);
  }, [container]);

  // Каждое сохранение из редактора шифрует свежий снимок данных тем же masterKey
  // и сразу пишет его в IndexedDB — отдельного шага "публикации" нет.
  const handleUpdateData = useCallback(
    async (newData) => {
      setSession((s) => (s ? { ...s, data: newData } : s));
      const updatedContainer = await encryptData(container, session.masterKey, newData);
      await saveContainer(updatedContainer);
      setContainer(updatedContainer);
      // Лучшее из возможного: если папка для автокопии выбрана, пишем туда же.
      // Право могло быть отозвано пользователем в системе — тогда просто молчим,
      // основная копия в IndexedDB в любом случае уже сохранена.
      if (autoBackupDir) {
        writeAutoBackup(autoBackupDir, updatedContainer).catch(() => {});
      }
    },
    [container, session, autoBackupDir]
  );

  // Запускается только по клику пользователя — showDirectoryPicker и
  // requestPermission требуют пользовательского жеста.
  const handleSetupAutoBackup = useCallback(async () => {
    try {
      const dirHandle = await pickAutoBackupFolder();
      const granted = await ensureWritePermission(dirHandle);
      if (!granted) return;
      await saveMeta({ autoBackupDirHandle: dirHandle });
      setAutoBackupDir(dirHandle);
      if (container) await writeAutoBackup(dirHandle, container);
    } catch {
      // Пользователь закрыл диалог выбора папки — ничего не делаем.
    }
  }, [container]);

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

  return (
    <Suspense fallback={<div className="mu-loading">…</div>}>
      <UniverseScene
        data={session.data}
        lang={lang}
        onLockNow={lockNow}
        onUpdateData={handleUpdateData}
        onExportBackup={handleExportBackup}
        lastBackupAt={lastBackupAt}
        autoBackupOn={Boolean(autoBackupDir)}
        onSetupAutoBackup={handleSetupAutoBackup}
      />
    </Suspense>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AppShell />
    </I18nProvider>
  );
}
