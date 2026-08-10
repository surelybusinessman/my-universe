// Хранение зашифрованного контейнера в IndexedDB. Пароль и masterKey сюда не попадают —
// только уже зашифрованный container из crypto/vault.js.
const DB_NAME = 'my-universe';
const DB_VERSION = 1;
const STORE = 'vault';
const KEY = 'main';
// Служебные данные (дата последней копии и т.п.) в том же object store, под
// отдельным ключом — не требует ни нового store, ни миграции DB_VERSION.
const META_KEY = 'meta';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadContainer() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function saveContainer(container) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(container, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Служебные данные не шифруются: это только даты и ссылки-хэндлы, не сами записи. */
export async function loadMeta() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(META_KEY);
    req.onsuccess = () => resolve(req.result || {});
    req.onerror = () => reject(req.error);
  });
}

export async function saveMeta(patch) {
  const current = await loadMeta();
  const next = { ...current, ...patch };
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(next, META_KEY);
    tx.oncomplete = () => resolve(next);
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearContainer() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
