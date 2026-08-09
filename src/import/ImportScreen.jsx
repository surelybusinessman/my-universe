import { useState, useMemo, useCallback } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { pickLang } from '../i18n/pickLang';
import { parseImportJson, buildReviewRows, applyImport } from './importLogic';
import './ImportScreen.css';

const ERROR_KEYS = {
  INVALID_JSON: 'import.errorInvalidJson',
  INVALID_SHAPE: 'import.errorShape',
  NO_NODES: 'import.errorNoNodes',
};

export default function ImportScreen({ data, lang, onClose, onImport }) {
  const { t } = useI18n();
  const [step, setStep] = useState('paste'); // paste | review | done
  const [text, setText] = useState('');
  const [source, setSource] = useState('chatgpt');
  const [error, setError] = useState('');
  const [parsed, setParsed] = useState(null);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);

  const handleParse = useCallback(() => {
    setError('');
    try {
      const result = parseImportJson(text);
      setParsed(result);
      setRows(buildReviewRows(result, data));
      setStep('review');
    } catch (err) {
      setError(t(ERROR_KEYS[err.message] || 'import.errorInvalidJson'));
    }
  }, [text, data, t]);

  const setDecision = useCallback((index, decision) => {
    setRows((rs) => rs.map((r) => (r.index === index ? { ...r, decision } : r)));
  }, []);

  const commitCount = useMemo(() => rows.filter((r) => r.decision !== 'skip').length, [rows]);
  const filteredCount = useMemo(
    () => rows.filter((r) => r.duplicateOf || r.noiseReason).length,
    [rows]
  );

  const setAll = useCallback((decision) => {
    setRows((rs) =>
      rs.map((r) => (decision === 'add' && r.duplicateOf ? { ...r, decision: 'merge' } : { ...r, decision }))
    );
  }, []);

  const handleCommit = useCallback(() => {
    const result = applyImport(data, parsed, rows, source);
    onImport(result.data);
    setSummary({ added: result.added, merged: result.merged, skipped: result.skipped });
    setStep('done');
  }, [data, parsed, rows, source, onImport]);

  return (
    <div className="mu-import-screen">
      <button type="button" className="mu-detail-close mu-import-close" onClick={onClose}>
        ×
      </button>

      <div className="mu-import-content">
        {step === 'paste' && (
          <>
            <h1>{t('import.title')}</h1>
            <p className="mu-import-intro">{t('import.intro')}</p>

            <label className="mu-import-field">
              {t('import.sourceLabel')}
              <select value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="chatgpt">{t('import.source.chatgpt')}</option>
                <option value="gemini">{t('import.source.gemini')}</option>
                <option value="claude">{t('import.source.claude')}</option>
                <option value="other">{t('import.source.other')}</option>
              </select>
            </label>

            <label className="mu-import-field">
              {t('import.pasteLabel')}
              <textarea
                rows={12}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t('import.pastePlaceholder')}
              />
            </label>

            {error && <p className="mu-form-error">{error}</p>}

            <button type="button" className="mu-btn-primary mu-import-parse-btn" onClick={handleParse} disabled={!text.trim()}>
              {t('import.parseButton')}
            </button>
          </>
        )}

        {step === 'review' && (
          <>
            <h1>{t('import.reviewTitle')}</h1>
            <p className="mu-import-intro">
              {t('import.reviewCount', { count: rows.length })}
              {filteredCount > 0 && ` · ${t('import.autoFiltered', { count: filteredCount })}`}
            </p>

            <div className="mu-import-bulk">
              <button type="button" className="mu-import-decision-btn" onClick={() => setAll('add')}>
                {t('import.selectAll')}
              </button>
              <button type="button" className="mu-import-decision-btn" onClick={() => setAll('skip')}>
                {t('import.deselectAll')}
              </button>
            </div>

            <div className="mu-import-rows">
              {rows.map((row) => (
                <div key={row.index} className="mu-import-row">
                  <div className="mu-import-row-main">
                    <span className="mu-import-row-title">{pickLang(row.raw.title, lang)}</span>
                    <span className="mu-badge">{row.galaxyTitle || '—'}</span>
                    {row.raw.confidence && (
                      <span className="mu-import-confidence">
                        {t(`import.confidence.${row.raw.confidence}`) || row.raw.confidence}
                      </span>
                    )}
                  </div>
                  {row.duplicateOf && (
                    <p className="mu-import-duplicate-note">
                      {t('import.duplicateNote', { title: pickLang(row.duplicateOf.title, lang) })}
                    </p>
                  )}
                  {!row.duplicateOf && row.noiseReason && (
                    <p className="mu-import-noise-note">{t(`import.noise.${row.noiseReason}`)}</p>
                  )}
                  <div className="mu-import-decision-row">
                    <button
                      type="button"
                      className={`mu-import-decision-btn ${row.decision === 'add' ? 'mu-import-decision-active' : ''}`}
                      onClick={() => setDecision(row.index, 'add')}
                    >
                      {t('import.decisionAdd')}
                    </button>
                    {row.duplicateOf && (
                      <button
                        type="button"
                        className={`mu-import-decision-btn ${row.decision === 'merge' ? 'mu-import-decision-active' : ''}`}
                        onClick={() => setDecision(row.index, 'merge')}
                      >
                        {t('import.decisionMerge')}
                      </button>
                    )}
                    <button
                      type="button"
                      className={`mu-import-decision-btn ${row.decision === 'skip' ? 'mu-import-decision-active' : ''}`}
                      onClick={() => setDecision(row.index, 'skip')}
                    >
                      {t('import.decisionSkip')}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mu-form-actions">
              <button type="button" className="mu-btn-primary" onClick={handleCommit} disabled={commitCount === 0}>
                {t('import.commitButton', { count: commitCount })}
              </button>
              <button type="button" className="mu-btn-ghost" onClick={() => setStep('paste')}>
                {t('import.backButton')}
              </button>
            </div>
          </>
        )}

        {step === 'done' && summary && (
          <>
            <h1>{t('import.doneTitle')}</h1>
            <p className="mu-import-intro">
              {t('import.doneSummary', {
                added: summary.added,
                merged: summary.merged,
                skipped: summary.skipped,
              })}
            </p>
            <button type="button" className="mu-btn-primary mu-import-parse-btn" onClick={onClose}>
              {t('import.closeButton')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
