import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { I18nProvider, useI18n } from './i18n/I18nProvider';
import LockScreen from './auth/LockScreen';
import { loadContainer, saveContainer, loadMeta, saveMeta } from './data/store';
import { downloadBackup } from './data/backup';
import { pickAutoBackupFolder, ensureWritePermission, writeAutoBackup } from './data/autoBackup';
import { pullRemoteVault, createDebouncedPusher } from './data/sync';
import { encryptData, decryptData } from './crypto/vault';
import SyncConflictDialog from './ui/SyncConflictDialog';
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
  const [conflict, setConflict] = useState(null); // { current, mine } | null

  // updatedAt последней версии, о которой точно знает сервер — не состояние,
  // потому что его изменение не должно вызывать перерисовку.
  const remoteBaseRef = useRef(null);
  const pushRef = useRef(null);
  if (!pushRef.current) pushRef.current = createDebouncedPusher();

  useEffect(() => {
    (async () => {
      const localContainer = await loadContainer();
      // GitHub Pages не имеет этого эндпоинта вовсе, Cloudflare — только если
      // подключён KV. В обоих случаях отсутствие ответа означает "работаем
      // без синхронизации", а не ошибку.
      const pullResult = await pullRemoteVault();
      let effective = localContainer;
      if (pullResult.ok && pullResult.container) {
        remoteBaseRef.current = pullResult.container.updatedAt;
        if (!localContainer || pullResult.container.updatedAt > localContainer.updatedAt) {
          effective = pullResult.container;
          await saveContainer(effective);
        }
      }
      setContainer(effective);
      setPhase('lock');
    })();
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
    // Ручное восстановление из файла или создание новой вселенной — точка
    // отсчёта для сервера неизвестна; следующий push сверится с ним заново
    // и, если там что-то есть, сам поднимет диалог конфликта.
    remoteBaseRef.current = null;
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
      pushRef.current(updatedContainer, remoteBaseRef.current, (result) => {
        if (result.ok) {
          remoteBaseRef.current = result.updatedAt;
        } else if (result.reason === 'CONFLICT') {
          setConflict({ current: result.current, mine: updatedContainer });
        }
        // NETWORK / NOT_CONFIGURED / ERROR: локальная копия уже сохранена,
        // молча пробуем снова при следующей правке.
      });
    },
    [container, session, autoBackupDir]
  );

  // Оставляем свою версию: перезаписываем сервер, теперь зная актуальный updatedAt как базу.
  const handleKeepMine = useCallback(() => {
    if (!conflict) return;
    const { mine, current } = conflict;
    setConflict(null);
    pushRef.current(mine, current.updatedAt, (result) => {
      if (result.ok) {
        remoteBaseRef.current = result.updatedAt;
      } else if (result.reason === 'CONFLICT') {
        setConflict({ current: result.current, mine });
      }
    });
  }, [conflict]);

  // Берём версию с другого устройства: оба контейнера зашифрованы одним masterKey,
  // расшифровываем без пароля через уже открытую сессию.
  const handleTakeRemote = useCallback(async () => {
    if (!conflict || !session) return;
    const { current } = conflict;
    const data = await decryptData(session.masterKey, current);
    await saveContainer(current);
    setContainer(current);
    setSession((s) => (s ? { ...s, data } : s));
    remoteBaseRef.current = current.updatedAt;
    setConflict(null);
  }, [conflict, session]);

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
    <>
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
      {conflict && <SyncConflictDialog onKeepMine={handleKeepMine} onTakeRemote={handleTakeRemote} />}
    </>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AppShell />
    </I18nProvider>
  );
}
