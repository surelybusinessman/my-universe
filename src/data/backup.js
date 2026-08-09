// Резервная копия — это тот же зашифрованный контейнер, что лежит в IndexedDB.
// Файл безопасно хранить где угодно: без пароля он нечитаем, а расшифровать
// его может только владелец пароля или кода восстановления.

const FILE_PREFIX = 'my-universe-backup';

export function backupFileName(date = new Date()) {
  const stamp = date.toISOString().slice(0, 10);
  return `${FILE_PREFIX}-${stamp}.json`;
}

/** Скачивает зашифрованный контейнер как файл. */
export function downloadBackup(container, date = new Date()) {
  const blob = new Blob([JSON.stringify(container, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = backupFileName(date);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Освобождаем ссылку не сразу: Safari успевает начать скачивание.
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Читает файл копии и проверяет, что это действительно наш контейнер,
 * а не случайный JSON — иначе можно затереть рабочее хранилище мусором.
 */
export function readBackupFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('READ_FAILED'));
    reader.onload = () => {
      let parsed;
      try {
        parsed = JSON.parse(String(reader.result));
      } catch {
        reject(new Error('INVALID_FILE'));
        return;
      }
      const looksValid =
        parsed &&
        typeof parsed === 'object' &&
        parsed.kdf?.salt &&
        parsed.passwordWrap?.data &&
        parsed.data?.data;
      if (!looksValid) {
        reject(new Error('NOT_A_BACKUP'));
        return;
      }
      resolve(parsed);
    };
    reader.readAsText(file);
  });
}
