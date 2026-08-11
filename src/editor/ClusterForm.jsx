import { useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import ConfirmDelete from './ConfirmDelete';
import { DEFAULT_COLORS } from './colors';
import './EditorForm.css';

/**
 * Форма контейнера ("Плана") — минимальная: название на двух языках и цвет,
 * как у галактики. Состав (какие галактики внутри) редактируется не здесь,
 * а в форме самой галактики — контейнер не владеет ими, только группирует.
 */
export default function ClusterForm({ initialCluster, onSave, onDelete, onCancel }) {
  const { t } = useI18n();
  const isEditing = Boolean(initialCluster);

  const [titleRu, setTitleRu] = useState(initialCluster?.title?.ru ?? '');
  const [titleEn, setTitleEn] = useState(initialCluster?.title?.en ?? '');
  const [color, setColor] = useState(initialCluster?.color ?? DEFAULT_COLORS[0]);
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!titleRu.trim() && !titleEn.trim()) {
      setError(t('editor.requiredTitle'));
      return;
    }
    onSave({ title: { ru: titleRu.trim(), en: titleEn.trim() }, color });
  };

  return (
    <form className="mu-editor-form" onSubmit={handleSubmit}>
      <h2>{isEditing ? t('editor.editCluster') : t('editor.addCluster')}</h2>
      <p className="mu-form-hint">{t('editor.clusterHint')}</p>

      <label>
        {t('editor.titleRu')}
        <input type="text" value={titleRu} onChange={(e) => setTitleRu(e.target.value)} autoFocus />
      </label>
      <label>
        {t('editor.titleEn')}
        <input type="text" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
      </label>

      <label>
        {t('editor.color')}
        <div className="mu-color-row">
          {DEFAULT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`mu-color-swatch ${color === c ? 'mu-color-swatch-active' : ''}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
              aria-label={c}
            />
          ))}
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="mu-color-custom"
          />
        </div>
      </label>

      {error && <p className="mu-form-error">{error}</p>}

      <div className="mu-form-actions">
        <button type="submit" className="mu-btn-primary">
          {isEditing ? t('editor.save') : t('editor.create')}
        </button>
        <button type="button" className="mu-btn-ghost" onClick={onCancel}>
          {t('editor.cancel')}
        </button>
      </div>

      {isEditing && onDelete && (
        <div className="mu-form-danger-zone">
          <p className="mu-form-hint">{t('editor.clusterDeleteHint')}</p>
          <ConfirmDelete onConfirm={onDelete} />
        </div>
      )}
    </form>
  );
}
