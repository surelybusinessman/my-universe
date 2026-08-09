import { useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { pickLang } from '../i18n/pickLang';
import { NODE_TYPES, NODE_STATUSES } from '../data/schema';
import ConfirmDelete from './ConfirmDelete';
import './EditorForm.css';

export default function NodeForm({
  initialNode,
  lang,
  allNodes,
  nodeEdges,
  onSave,
  onDelete,
  onCancel,
  onAddEdge,
  onDeleteEdge,
}) {
  const { t } = useI18n();
  const isEditing = Boolean(initialNode);

  const [titleRu, setTitleRu] = useState(initialNode?.title?.ru ?? '');
  const [titleEn, setTitleEn] = useState(initialNode?.title?.en ?? '');
  const [descRu, setDescRu] = useState(initialNode?.description?.ru ?? '');
  const [descEn, setDescEn] = useState(initialNode?.description?.en ?? '');
  const [type, setType] = useState(initialNode?.type ?? 'achievement');
  const [status, setStatus] = useState(initialNode?.status ?? 'planned');
  const [progress, setProgress] = useState(initialNode?.progress ?? 0);
  const [level, setLevel] = useState(initialNode?.level ?? 3);
  const [startedAt, setStartedAt] = useState(initialNode?.startedAt ?? '');
  const [completedAt, setCompletedAt] = useState(initialNode?.completedAt ?? '');
  const [tagsText, setTagsText] = useState((initialNode?.tags ?? []).join(', '));
  const [nextSteps, setNextSteps] = useState(initialNode?.nextSteps ?? []);
  const [newStepText, setNewStepText] = useState('');
  const [error, setError] = useState('');

  const [connTargetId, setConnTargetId] = useState('');
  const [connKind, setConnKind] = useState('leads_to');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!titleRu.trim() && !titleEn.trim()) {
      setError(t('editor.requiredTitle'));
      return;
    }
    const tags = tagsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    onSave({
      title: { ru: titleRu.trim(), en: titleEn.trim() },
      description: { ru: descRu.trim(), en: descEn.trim() },
      type,
      status,
      progress: Number(progress) || 0,
      level: Number(level) || 1,
      startedAt: startedAt.trim() || null,
      completedAt: completedAt.trim() || null,
      tags,
      nextSteps,
    });
  };

  const addStep = () => {
    if (!newStepText.trim()) return;
    setNextSteps((steps) => [...steps, { title: newStepText.trim(), done: false }]);
    setNewStepText('');
  };

  const toggleStep = (i) => {
    setNextSteps((steps) => steps.map((s, idx) => (idx === i ? { ...s, done: !s.done } : s)));
  };

  const removeStep = (i) => {
    setNextSteps((steps) => steps.filter((_, idx) => idx !== i));
  };

  const targetOptions = (allNodes ?? []).filter((n) => n.id !== initialNode?.id);

  const handleAddConnection = () => {
    if (!connTargetId) return;
    onAddEdge({ from: initialNode.id, to: connTargetId, kind: connKind });
    setConnTargetId('');
  };

  return (
    <form className="mu-editor-form" onSubmit={handleSubmit}>
      <h2>{isEditing ? t('editor.edit') : t('editor.addStar')}</h2>

      <label>
        {t('editor.titleRu')}
        <input type="text" value={titleRu} onChange={(e) => setTitleRu(e.target.value)} autoFocus />
      </label>
      <label>
        {t('editor.titleEn')}
        <input type="text" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
      </label>

      <div className="mu-form-row">
        <label>
          {t('editor.type')}
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {NODE_TYPES.map((tp) => (
              <option key={tp} value={tp}>
                {t(`nodeType.${tp}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('editor.status')}
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {NODE_STATUSES.map((st) => (
              <option key={st} value={st}>
                {t(`nodeStatus.${st}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mu-form-row">
        <label>
          {t('editor.progress')} ({progress}%)
          <input
            type="range"
            min="0"
            max="100"
            value={progress}
            onChange={(e) => setProgress(e.target.value)}
          />
        </label>
        <label>
          {t('editor.level')} ({level})
          <input type="range" min="1" max="5" value={level} onChange={(e) => setLevel(e.target.value)} />
        </label>
      </div>

      <div className="mu-form-row">
        <label>
          {t('editor.startedAt')}
          <input
            type="text"
            placeholder="2024-05"
            value={startedAt}
            onChange={(e) => setStartedAt(e.target.value)}
          />
        </label>
        <label>
          {t('editor.completedAt')}
          <input
            type="text"
            placeholder="2025-01"
            value={completedAt}
            onChange={(e) => setCompletedAt(e.target.value)}
          />
        </label>
      </div>

      <label>
        {t('editor.descriptionRu')}
        <textarea rows={3} value={descRu} onChange={(e) => setDescRu(e.target.value)} />
      </label>
      <label>
        {t('editor.descriptionEn')}
        <textarea rows={3} value={descEn} onChange={(e) => setDescEn(e.target.value)} />
      </label>

      <label>
        {t('editor.tags')}
        <input
          type="text"
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          placeholder={t('editor.tagsHint')}
        />
      </label>

      <div className="mu-form-section">
        <span className="mu-form-section-label">{t('editor.nextSteps')}</span>
        {nextSteps.map((step, i) => (
          <div key={i} className="mu-step-row">
            <input type="checkbox" checked={step.done} onChange={() => toggleStep(i)} />
            <span className={step.done ? 'mu-step-done-text' : ''}>{step.title}</span>
            <button type="button" className="mu-step-remove" onClick={() => removeStep(i)}>
              ×
            </button>
          </div>
        ))}
        <div className="mu-step-add-row">
          <input
            type="text"
            value={newStepText}
            onChange={(e) => setNewStepText(e.target.value)}
            placeholder={t('editor.nextStepPlaceholder')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addStep();
              }
            }}
          />
          <button type="button" className="mu-btn-ghost" onClick={addStep}>
            {t('editor.addStep')}
          </button>
        </div>
      </div>

      {isEditing && (
        <div className="mu-form-section">
          <span className="mu-form-section-label">{t('editor.connections')}</span>
          {nodeEdges?.length > 0 && (
            <div className="mu-conn-list">
              {nodeEdges.map(({ index, direction, other, edge }) => (
                <div key={index} className="mu-conn-row">
                  <span>
                    {direction === 'out' ? '→' : '←'} {pickLang(other?.title, lang) || '…'}
                    <em> ({t(`editor.kind.${edge.kind}`)})</em>
                  </span>
                  <button type="button" className="mu-step-remove" onClick={() => onDeleteEdge(index)}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          {targetOptions.length > 0 ? (
            <div className="mu-conn-add-row">
              <select value={connTargetId} onChange={(e) => setConnTargetId(e.target.value)}>
                <option value="">{t('editor.connectionTarget')}</option>
                {targetOptions.map((n) => (
                  <option key={n.id} value={n.id}>
                    {pickLang(n.title, lang)}
                  </option>
                ))}
              </select>
              <select value={connKind} onChange={(e) => setConnKind(e.target.value)}>
                <option value="leads_to">{t('editor.kind.leads_to')}</option>
                <option value="requires">{t('editor.kind.requires')}</option>
              </select>
              <button type="button" className="mu-btn-ghost" onClick={handleAddConnection}>
                {t('editor.addConnection')}
              </button>
            </div>
          ) : (
            <p className="mu-form-hint">{t('editor.noNodesYet')}</p>
          )}
        </div>
      )}

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
