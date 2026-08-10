import { useI18n } from '../i18n/I18nProvider';
import './SyncConflictDialog.css';

// Правки разошлись между устройствами. Автослияние здесь невозможно: сервер
// видит только шифротекст, сравнить содержимое может лишь пользователь.
export default function SyncConflictDialog({ onKeepMine, onTakeRemote }) {
  const { t } = useI18n();

  return (
    <div className="mu-sync-overlay">
      <div className="mu-sync-dialog">
        <h2>{t('sync.conflictTitle')}</h2>
        <p>{t('sync.conflictBody')}</p>
        <div className="mu-sync-actions">
          <button type="button" className="mu-btn-ghost" onClick={onKeepMine}>
            {t('sync.keepMine')}
          </button>
          <button type="button" className="mu-sync-primary" onClick={onTakeRemote}>
            {t('sync.takeRemote')}
          </button>
        </div>
      </div>
    </div>
  );
}
