export const BACKUP_REMINDER_DAYS = 14;

/** Показывать напоминание, если вселенная не пуста и копии давно не было или не было вовсе. */
export function shouldShowBackupReminder(isEmpty, lastBackupAt, now = new Date()) {
  if (isEmpty) return false;
  if (!lastBackupAt) return true;
  const days = (now.getTime() - new Date(lastBackupAt).getTime()) / (1000 * 60 * 60 * 24);
  return days > BACKUP_REMINDER_DAYS;
}
