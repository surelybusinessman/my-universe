// Автосохранение копии в папку, выбранную пользователем один раз (например, в
// OneDrive). Доступно только там, где браузер поддерживает File System Access
// API (Chrome, Edge) — в Safari и Firefox эта функция просто не показывается,
// обычная кнопка "Копия" продолжает работать везде.
import { backupFileName } from './backup';

export function isAutoBackupSupported() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/** Открывает системный диалог выбора папки. Должно вызываться из обработчика клика. */
export async function pickAutoBackupFolder() {
  return window.showDirectoryPicker({ mode: 'readwrite' });
}

/** Проверяет право на запись без диалога; при необходимости — с диалогом (нужен клик пользователя). */
export async function ensureWritePermission(dirHandle) {
  const opts = { mode: 'readwrite' };
  if ((await dirHandle.queryPermission(opts)) === 'granted') return true;
  return (await dirHandle.requestPermission(opts)) === 'granted';
}

/** Пишет зашифрованный контейнер как файл в выбранную папку. Не требует пользовательского жеста. */
export async function writeAutoBackup(dirHandle, container, date = new Date()) {
  const fileHandle = await dirHandle.getFileHandle(backupFileName(date), { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(container, null, 2));
  await writable.close();
}
