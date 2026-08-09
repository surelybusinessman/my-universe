import { useState, useCallback } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import {
  createVault,
  unlockWithPassword,
  unlockWithRecoveryCode,
  changePassword,
} from '../crypto/vault';
import { createEmptyVault } from '../data/schema';
import './LockScreen.css';

const LOCKOUT_KEY = 'mu_lockout_state';

function readLockoutState() {
  try {
    const raw = localStorage.getItem(LOCKOUT_KEY);
    if (!raw) return { attempts: 0, until: 0 };
    return JSON.parse(raw);
  } catch {
    return { attempts: 0, until: 0 };
  }
}

function writeLockoutState(state) {
  localStorage.setItem(LOCKOUT_KEY, JSON.stringify(state));
}

// Нарастающая задержка после неудачных попыток — мягкий тормоз для перебора через UI.
function registerFailure() {
  const state = readLockoutState();
  const attempts = state.attempts + 1;
  const delayMs = attempts >= 3 ? Math.min(30000, 1000 * 2 ** (attempts - 3)) : 0;
  const until = delayMs > 0 ? Date.now() + delayMs : 0;
  writeLockoutState({ attempts, until });
  return { attempts, until };
}

function registerSuccess() {
  writeLockoutState({ attempts: 0, until: 0 });
}

/**
 * existingContainer === null  -> первый запуск, режим создания пароля
 * existingContainer !== null  -> обычная разблокировка / восстановление по коду
 */
export default function LockScreen({ existingContainer, onPersistContainer, onUnlocked }) {
  const { t, lang, setLang } = useI18n();
  const mode = existingContainer ? 'unlock' : 'create';

  const [view, setView] = useState(mode === 'create' ? 'create-password' : 'unlock-password');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryInput, setRecoveryInput] = useState('');
  const [newPasswordAfterRecovery, setNewPasswordAfterRecovery] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [lockoutUntil, setLockoutUntil] = useState(() => readLockoutState().until);
  const [pendingRecovery, setPendingRecovery] = useState(null);
  const [recoveryConfirmedSaved, setRecoveryConfirmedSaved] = useState(false);
  const [recoveredSession, setRecoveredSession] = useState(null);

  const isLockedOut = lockoutUntil > Date.now();
  const lockoutSeconds = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));

  const handleCreateSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setError('');
      if (password.length < 8) {
        setError(t('lock.errorPasswordTooShort'));
        return;
      }
      if (password !== confirmPassword) {
        setError(t('lock.errorPasswordsMismatch'));
        return;
      }
      setBusy(true);
      try {
        const result = await createVault(password, createEmptyVault());
        setPendingRecovery(result);
        setView('recovery-display');
      } finally {
        setBusy(false);
      }
    },
    [password, confirmPassword, t]
  );

  const handleFinishCreate = useCallback(async () => {
    if (!pendingRecovery) return;
    setBusy(true);
    try {
      await onPersistContainer(pendingRecovery.container);
      onUnlocked(pendingRecovery.container, {
        masterKey: pendingRecovery.masterKey,
        masterKeyBytes: pendingRecovery.masterKeyBytes,
        data: pendingRecovery.data,
      });
    } finally {
      setBusy(false);
    }
  }, [pendingRecovery, onPersistContainer, onUnlocked]);

  const handleUnlockSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setError('');
      if (isLockedOut) return;
      setBusy(true);
      try {
        const session = await unlockWithPassword(existingContainer, password);
        registerSuccess();
        setLockoutUntil(0);
        onUnlocked(existingContainer, session);
      } catch {
        const { until } = registerFailure();
        setLockoutUntil(until);
        setError(t('lock.errorWrongPassword'));
      } finally {
        setBusy(false);
      }
    },
    [existingContainer, password, isLockedOut, onUnlocked, t]
  );

  const handleRecoverySubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setError('');
      if (isLockedOut) return;
      setBusy(true);
      try {
        const session = await unlockWithRecoveryCode(existingContainer, recoveryInput);
        registerSuccess();
        setLockoutUntil(0);
        setRecoveredSession(session);
        setView('recovery-newpassword');
      } catch {
        const { until } = registerFailure();
        setLockoutUntil(until);
        setError(t('lock.errorWrongRecovery'));
      } finally {
        setBusy(false);
      }
    },
    [existingContainer, recoveryInput, isLockedOut, t]
  );

  const handleSetNewPasswordAfterRecovery = useCallback(
    async (e) => {
      e.preventDefault();
      setError('');
      if (newPasswordAfterRecovery.length < 8) {
        setError(t('lock.errorPasswordTooShort'));
        return;
      }
      setBusy(true);
      try {
        const updatedContainer = await changePassword(
          existingContainer,
          recoveredSession.masterKeyBytes,
          newPasswordAfterRecovery
        );
        await onPersistContainer(updatedContainer);
        onUnlocked(updatedContainer, recoveredSession);
      } finally {
        setBusy(false);
      }
    },
    [existingContainer, recoveredSession, newPasswordAfterRecovery, onPersistContainer, onUnlocked, t]
  );

  return (
    <div className="mu-lock-screen">
      <div className="mu-stars-bg" aria-hidden="true" />
      <button type="button" className="mu-lang-toggle" onClick={() => setLang(lang === 'ru' ? 'en' : 'ru')}>
        {t('lang.switch')}
      </button>
      <div className="mu-lock-card">
        <h1 className="mu-lock-app-title">{t('app.title')}</h1>

        {view === 'create-password' && (
          <form onSubmit={handleCreateSubmit} className="mu-lock-form">
            <h2>{t('lock.createTitle')}</h2>
            <label>
              {t('lock.passwordLabel')}
              <input
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('lock.passwordPlaceholder')}
                minLength={8}
                required
              />
            </label>
            <label>
              {t('lock.confirmPasswordLabel')}
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </label>
            {error && <p className="mu-lock-error">{error}</p>}
            <button type="submit" disabled={busy}>
              {t('lock.createButton')}
            </button>
          </form>
        )}

        {view === 'recovery-display' && pendingRecovery && (
          <div className="mu-lock-form">
            <h2>{t('lock.recoveryScreenTitle')}</h2>
            <p className="mu-recovery-warning">{t('lock.recoveryScreenWarning')}</p>
            <div className="mu-recovery-code">{pendingRecovery.recoveryCode}</div>
            <label className="mu-recovery-confirm-row">
              <input
                type="checkbox"
                checked={recoveryConfirmedSaved}
                onChange={(e) => setRecoveryConfirmedSaved(e.target.checked)}
              />
              {t('lock.recoveryScreenConfirm')}
            </label>
            <button type="button" disabled={!recoveryConfirmedSaved || busy} onClick={handleFinishCreate}>
              {t('lock.recoveryScreenContinue')}
            </button>
          </div>
        )}

        {view === 'unlock-password' && (
          <form onSubmit={handleUnlockSubmit} className="mu-lock-form">
            <h2>{t('lock.unlockTitle')}</h2>
            <label>
              {t('lock.passwordLabel')}
              <input
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('lock.unlockPasswordPlaceholder')}
                required
              />
            </label>
            {error && <p className="mu-lock-error">{error}</p>}
            {isLockedOut && (
              <p className="mu-lock-error">{t('lock.errorTooManyAttempts', { seconds: lockoutSeconds })}</p>
            )}
            <button type="submit" disabled={busy || isLockedOut}>
              {t('lock.unlockButton')}
            </button>
            <button
              type="button"
              className="mu-lock-link"
              onClick={() => {
                setView('recovery-input');
                setError('');
              }}
            >
              {t('lock.forgotPassword')}
            </button>
          </form>
        )}

        {view === 'recovery-input' && (
          <form onSubmit={handleRecoverySubmit} className="mu-lock-form">
            <h2>{t('lock.recoveryCodeLabel')}</h2>
            <label>
              {t('lock.recoveryCodeLabel')}
              <input
                type="text"
                autoFocus
                value={recoveryInput}
                onChange={(e) => setRecoveryInput(e.target.value)}
                placeholder={t('lock.recoveryCodePlaceholder')}
                required
              />
            </label>
            {error && <p className="mu-lock-error">{error}</p>}
            {isLockedOut && (
              <p className="mu-lock-error">{t('lock.errorTooManyAttempts', { seconds: lockoutSeconds })}</p>
            )}
            <button type="submit" disabled={busy || isLockedOut}>
              {t('lock.recoveryUnlockButton')}
            </button>
            <button
              type="button"
              className="mu-lock-link"
              onClick={() => {
                setView('unlock-password');
                setError('');
              }}
            >
              {t('lock.backToPassword')}
            </button>
          </form>
        )}

        {view === 'recovery-newpassword' && (
          <form onSubmit={handleSetNewPasswordAfterRecovery} className="mu-lock-form">
            <h2>{t('lock.newPasswordAfterRecovery')}</h2>
            <label>
              {t('lock.newPasswordAfterRecovery')}
              <input
                type="password"
                autoFocus
                value={newPasswordAfterRecovery}
                onChange={(e) => setNewPasswordAfterRecovery(e.target.value)}
                minLength={8}
                required
              />
            </label>
            {error && <p className="mu-lock-error">{error}</p>}
            <button type="submit" disabled={busy}>
              {t('lock.setNewPasswordButton')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
