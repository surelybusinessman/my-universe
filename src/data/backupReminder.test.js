import { describe, it, expect } from 'vitest';
import { shouldShowBackupReminder } from './backupReminder';

const NOW = new Date('2026-08-10T12:00:00Z');

describe('shouldShowBackupReminder', () => {
  it('never shows for an empty universe, regardless of backup history', () => {
    expect(shouldShowBackupReminder(true, null, NOW)).toBe(false);
    expect(shouldShowBackupReminder(true, '2020-01-01T00:00:00Z', NOW)).toBe(false);
  });

  it('shows when the universe has data but no backup was ever made', () => {
    expect(shouldShowBackupReminder(false, null, NOW)).toBe(true);
  });

  it('does not show right after a backup', () => {
    expect(shouldShowBackupReminder(false, '2026-08-09T12:00:00Z', NOW)).toBe(false);
  });

  it('does not show exactly at the 14-day boundary', () => {
    expect(shouldShowBackupReminder(false, '2026-07-27T12:00:00Z', NOW)).toBe(false);
  });

  it('shows once the backup is older than 14 days', () => {
    expect(shouldShowBackupReminder(false, '2026-07-20T12:00:00Z', NOW)).toBe(true);
  });
});
