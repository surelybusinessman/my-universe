import { useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import ConfirmDelete from './ConfirmDelete';
import './EditorForm.css';

const DEFAULT_COLORS = ['#4FC3F7', '#B98BFF', '#7CFFB2', '#FFD166', '#FF6B6B', '#6FD3FF'];

export default function GalaxyForm({ initialGalaxy, onSave, onDelete, onCancel }) {
  const { t } = useI18n();
  const isEditing = Boolean(initialGalaxy);

  const [titleRu, setTitleRu] = useState(initialGalaxy?.title?.ru ?? '');
  const [titleEn, setTitleEn] = useState(initialGalaxy?.title?.en ?? '');
  const [color, setColor] = useState(initialGalaxy?.color ?? DEFAULT_COLORS[0]);
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
      <h2>{isEditing ? t('editor.editGalaxy') : t('editor.addGalaxy')}</h2>

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
          <ConfirmDelete onConfirm={onDelete} />
        </div>
      )}
    </form>
  );
}
