// Шифрование хранилища: envelope encryption.
// - Один случайный masterKey шифрует сами данные (AES-256-GCM).
// - masterKey хранится в двух "обёртках": одна закрыта паролем (через PBKDF2),
//   другая — кодом восстановления. Смена пароля не требует перешифровки данных.
// - Пароль и код восстановления нигде не сохраняются — используются только
//   в момент создания/разблокировки, живут в памяти вкладки.

const AES_ALGO = 'AES-GCM';
export const PBKDF2_ITERATIONS = 600000;

// Crockford base32: без похожих друг на друга символов (0/O, 1/I/L, U), удобно вводить руками.
const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function randomBytes(len) {
  return crypto.getRandomValues(new Uint8Array(len));
}

function toB64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromB64(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKeyFromPassword(password, salt, iterations = PBKDF2_ITERATIONS) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    baseKey,
    { name: AES_ALGO, length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function deriveKeyFromRecoveryCode(code) {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(code));
  return crypto.subtle.importKey('raw', digest, AES_ALGO, false, ['encrypt', 'decrypt']);
}

async function generateMasterKey() {
  return crypto.subtle.generateKey({ name: AES_ALGO, length: 256 }, true, ['encrypt', 'decrypt']);
}

async function aesEncryptBytes(key, plainBytes) {
  const iv = randomBytes(12);
  const cipher = await crypto.subtle.encrypt({ name: AES_ALGO, iv }, key, plainBytes);
  return { iv: toB64(iv), data: toB64(new Uint8Array(cipher)) };
}

async function aesDecryptBytes(key, ivB64, dataB64) {
  const iv = fromB64(ivB64);
  const cipherBytes = fromB64(dataB64);
  // GCM проверяет целостность сам: неверный ключ -> исключение, а не "мусор на выходе".
  const plain = await crypto.subtle.decrypt({ name: AES_ALGO, iv }, key, cipherBytes);
  return new Uint8Array(plain);
}

function bytesToBase32(bytes) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      output += CROCKFORD_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += CROCKFORD_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

/** Генерирует код восстановления: 20 случайных байт (160 бит) в группах по 4 символа. */
export function generateRecoveryCode() {
  const bytes = randomBytes(20);
  const raw = bytesToBase32(bytes);
  return raw.match(/.{1,4}/g).join('-');
}

export function normalizeRecoveryCode(code) {
  return code.toUpperCase().replace(/[^0-9A-Z]/g, '');
}

async function importAndDecryptData(masterKeyBytes, container) {
  const masterKey = await crypto.subtle.importKey('raw', masterKeyBytes, AES_ALGO, true, [
    'encrypt',
    'decrypt',
  ]);
  let plainBytes;
  try {
    plainBytes = await aesDecryptBytes(masterKey, container.data.iv, container.data.data);
  } catch {
    throw new Error('CORRUPT_DATA');
  }
  const data = JSON.parse(new TextDecoder().decode(plainBytes));
  return { masterKey, masterKeyBytes, data };
}

/**
 * Создаёт новое хранилище: генерирует masterKey, шифрует переданные данные,
 * заворачивает masterKey и паролем, и кодом восстановления.
 * Возвращает { container, recoveryCode, masterKey, masterKeyBytes, data } —
 * container кладётся в IndexedDB, recoveryCode показывается пользователю один раз.
 */
export async function createVault(password, plainDataObj) {
  const masterKey = await generateMasterKey();
  const masterKeyBytes = new Uint8Array(await crypto.subtle.exportKey('raw', masterKey));

  const salt = randomBytes(16);
  const passwordKey = await deriveKeyFromPassword(password, salt);
  const passwordWrap = await aesEncryptBytes(passwordKey, masterKeyBytes);

  const recoveryCode = generateRecoveryCode();
  const recoveryKey = await deriveKeyFromRecoveryCode(normalizeRecoveryCode(recoveryCode));
  const recoveryWrap = await aesEncryptBytes(recoveryKey, masterKeyBytes);

  const dataBytes = new TextEncoder().encode(JSON.stringify(plainDataObj));
  const data = await aesEncryptBytes(masterKey, dataBytes);

  const container = {
    version: 1,
    kdf: { iterations: PBKDF2_ITERATIONS, salt: toB64(salt) },
    passwordWrap,
    recoveryWrap,
    data,
    updatedAt: new Date().toISOString(),
  };

  return { container, recoveryCode, masterKey, masterKeyBytes, data: plainDataObj };
}

/** Разблокировка паролем. Бросает Error('WRONG_PASSWORD') при неверном пароле. */
export async function unlockWithPassword(container, password) {
  const salt = fromB64(container.kdf.salt);
  const passwordKey = await deriveKeyFromPassword(password, salt, container.kdf.iterations);
  let masterKeyBytes;
  try {
    masterKeyBytes = await aesDecryptBytes(
      passwordKey,
      container.passwordWrap.iv,
      container.passwordWrap.data
    );
  } catch {
    throw new Error('WRONG_PASSWORD');
  }
  return importAndDecryptData(masterKeyBytes, container);
}

/** Разблокировка кодом восстановления. Бросает Error('WRONG_RECOVERY_CODE'). */
export async function unlockWithRecoveryCode(container, code) {
  const recoveryKey = await deriveKeyFromRecoveryCode(normalizeRecoveryCode(code));
  let masterKeyBytes;
  try {
    masterKeyBytes = await aesDecryptBytes(
      recoveryKey,
      container.recoveryWrap.iv,
      container.recoveryWrap.data
    );
  } catch {
    throw new Error('WRONG_RECOVERY_CODE');
  }
  return importAndDecryptData(masterKeyBytes, container);
}

/** Шифрует и сохраняет новые данные тем же masterKey (используется при каждом сохранении в редакторе). */
export async function encryptData(container, masterKey, dataObj) {
  const bytes = new TextEncoder().encode(JSON.stringify(dataObj));
  const data = await aesEncryptBytes(masterKey, bytes);
  return { ...container, data, updatedAt: new Date().toISOString() };
}

/** Меняет пароль, не трогая ни сами данные, ни код восстановления. */
export async function changePassword(container, masterKeyBytes, newPassword) {
  const salt = randomBytes(16);
  const passwordKey = await deriveKeyFromPassword(newPassword, salt);
  const passwordWrap = await aesEncryptBytes(passwordKey, masterKeyBytes);
  return {
    ...container,
    kdf: { iterations: PBKDF2_ITERATIONS, salt: toB64(salt) },
    passwordWrap,
  };
}
