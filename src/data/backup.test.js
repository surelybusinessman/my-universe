import { describe, it, expect } from 'vitest';
import { backupFileName, isBackupContainer } from './backup';

describe('backupFileName', () => {
  it('formats the date as my-universe-backup-YYYY-MM-DD.json', () => {
    expect(backupFileName(new Date('2026-08-10T15:30:00Z'))).toBe(
      'my-universe-backup-2026-08-10.json'
    );
  });
});

describe('isBackupContainer', () => {
  const validContainer = {
    kdf: { iterations: 600000, salt: 'abc' },
    passwordWrap: { iv: 'iv', data: 'data' },
    data: { iv: 'iv', data: 'data' },
  };

  it('accepts a well-formed container', () => {
    expect(isBackupContainer(validContainer)).toBe(true);
  });

  it('rejects null and non-objects', () => {
    expect(isBackupContainer(null)).toBe(false);
    expect(isBackupContainer('a string')).toBe(false);
    expect(isBackupContainer(42)).toBe(false);
  });

  it('rejects an unrelated JSON object', () => {
    expect(isBackupContainer({ hello: 'world' })).toBe(false);
  });

  it('rejects a container missing kdf.salt', () => {
    expect(isBackupContainer({ ...validContainer, kdf: {} })).toBe(false);
  });

  it('rejects a container missing passwordWrap.data', () => {
    expect(isBackupContainer({ ...validContainer, passwordWrap: {} })).toBe(false);
  });

  it('rejects a container missing data.data', () => {
    expect(isBackupContainer({ ...validContainer, data: {} })).toBe(false);
  });
});
