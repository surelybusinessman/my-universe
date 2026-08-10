import { describe, it, expect } from 'vitest';
import {
  createVault,
  unlockWithPassword,
  unlockWithRecoveryCode,
  changePassword,
  encryptData,
  decryptData,
  generateRecoveryCode,
  normalizeRecoveryCode,
} from './vault';
import fixtureV1 from './__fixtures__/v1-container.json';

const PASSWORD = 'correct horse battery staple';
const SAMPLE_DATA = { version: 1, galaxies: [{ id: 'g_1' }], nodes: [], edges: [] };

describe('createVault / unlockWithPassword', () => {
  it('roundtrips data through the correct password', async () => {
    const { container } = await createVault(PASSWORD, SAMPLE_DATA);
    const session = await unlockWithPassword(container, PASSWORD);
    expect(session.data).toEqual(SAMPLE_DATA);
  });

  it('rejects a wrong password with WRONG_PASSWORD', async () => {
    const { container } = await createVault(PASSWORD, SAMPLE_DATA);
    await expect(unlockWithPassword(container, 'wrong password')).rejects.toThrow(
      'WRONG_PASSWORD'
    );
  });

  it('rejects a corrupted data blob with CORRUPT_DATA', async () => {
    const { container } = await createVault(PASSWORD, SAMPLE_DATA);
    const corrupted = {
      ...container,
      data: { ...container.data, data: container.data.data.slice(0, -4) + 'abcd' },
    };
    await expect(unlockWithPassword(corrupted, PASSWORD)).rejects.toThrow('CORRUPT_DATA');
  });
});

describe('createVault / unlockWithRecoveryCode', () => {
  it('unlocks with the recovery code and returns the same data', async () => {
    const { container, recoveryCode } = await createVault(PASSWORD, SAMPLE_DATA);
    const session = await unlockWithRecoveryCode(container, recoveryCode);
    expect(session.data).toEqual(SAMPLE_DATA);
  });

  it('rejects a wrong recovery code with WRONG_RECOVERY_CODE', async () => {
    const { container } = await createVault(PASSWORD, SAMPLE_DATA);
    await expect(
      unlockWithRecoveryCode(container, 'ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ')
    ).rejects.toThrow('WRONG_RECOVERY_CODE');
  });

  it('accepts recovery codes typed without dashes or in lowercase', async () => {
    const { container, recoveryCode } = await createVault(PASSWORD, SAMPLE_DATA);
    const messy = recoveryCode.toLowerCase().replace(/-/g, ' ');
    const session = await unlockWithRecoveryCode(container, messy);
    expect(session.data).toEqual(SAMPLE_DATA);
  });
});

describe('changePassword', () => {
  it('lets the new password unlock the vault, and the old one no longer works', async () => {
    const { container, masterKeyBytes } = await createVault(PASSWORD, SAMPLE_DATA);
    const updated = await changePassword(container, masterKeyBytes, 'a brand new password');

    const session = await unlockWithPassword(updated, 'a brand new password');
    expect(session.data).toEqual(SAMPLE_DATA);
    await expect(unlockWithPassword(updated, PASSWORD)).rejects.toThrow('WRONG_PASSWORD');
  });

  it('does not invalidate the recovery code (main envelope invariant)', async () => {
    const { container, masterKeyBytes, recoveryCode } = await createVault(PASSWORD, SAMPLE_DATA);
    const updated = await changePassword(container, masterKeyBytes, 'a brand new password');

    const session = await unlockWithRecoveryCode(updated, recoveryCode);
    expect(session.data).toEqual(SAMPLE_DATA);
  });
});

describe('encryptData', () => {
  it('produces a container decryptable with the same masterKey', async () => {
    const { container, masterKey } = await createVault(PASSWORD, SAMPLE_DATA);
    const newData = { ...SAMPLE_DATA, nodes: [{ id: 'n_1' }] };
    const updatedContainer = await encryptData(container, masterKey, newData);

    const session = await unlockWithPassword(updatedContainer, PASSWORD);
    expect(session.data).toEqual(newData);
  });
});

describe('backward compatibility with a version-1 container', () => {
  // Зафиксированный контейнер (сгенерированный тестовыми данными, не настоящим
  // бэкапом пользователя) ловит случайную смену параметров KDF или формата.
  it('unlocks the recorded fixture with its recorded password', async () => {
    const session = await unlockWithPassword(fixtureV1.container, fixtureV1.password);
    expect(session.data).toEqual(fixtureV1.expectedData);
  });

  it('unlocks the recorded fixture with its recorded recovery code', async () => {
    const session = await unlockWithRecoveryCode(fixtureV1.container, fixtureV1.recoveryCode);
    expect(session.data).toEqual(fixtureV1.expectedData);
  });
});

describe('decryptData', () => {
  it('decrypts a container using only the masterKey, without a password', async () => {
    const { container, masterKey } = await createVault(PASSWORD, SAMPLE_DATA);
    const data = await decryptData(masterKey, container);
    expect(data).toEqual(SAMPLE_DATA);
  });

  it('reads a later encryptData revision with the same masterKey (sync scenario)', async () => {
    const { container, masterKey } = await createVault(PASSWORD, SAMPLE_DATA);
    const revised = { ...SAMPLE_DATA, nodes: [{ id: 'n_new' }] };
    const newContainer = await encryptData(container, masterKey, revised);

    const data = await decryptData(masterKey, newContainer);
    expect(data).toEqual(revised);
  });
});

describe('generateRecoveryCode / normalizeRecoveryCode', () => {
  it('generates codes made only of the Crockford base32 alphabet, grouped by 4', () => {
    const code = generateRecoveryCode();
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4})*$/);
  });

  it('normalizes by uppercasing and stripping non-alphanumerics', () => {
    expect(normalizeRecoveryCode('ab12-cd34 ef56')).toBe('AB12CD34EF56');
  });
});
