import { useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import './EditorForm.css';

// Свой inline-confirm вместо window.confirm(): не блокирует поток и одинаково
// работает при автоматизированном тестировании через CDP.
export default function ConfirmDelete({ onConfirm, label }) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type="button" className="mu-btn-danger-outline" onClick={() => setConfirming(true)}>
        {label ?? t('editor.delete')}
      </button>
    );
  }

  return (
    <div className="mu-confirm-row">
      <span>{t('editor.confirmDelete')}</span>
      <button type="button" className="mu-btn-danger" onClick={onConfirm}>
        {t('editor.confirmYes')}
      </button>
      <button type="button" className="mu-btn-ghost" onClick={() => setConfirming(false)}>
        {t('editor.confirmNo')}
      </button>
    </div>
  );
}
