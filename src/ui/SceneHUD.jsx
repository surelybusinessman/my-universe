import { useState, useMemo, useCallback, useEffect } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { pickLang, pickLangMeta } from '../i18n/pickLang';
import GalaxyForm from '../editor/GalaxyForm';
import NodeForm from '../editor/NodeForm';
import ConfirmDelete from '../editor/ConfirmDelete';
import StatsScreen from '../analytics/StatsScreen';
import { overallProgress, galaxyProgress } from '../analytics/stats';
import ImportScreen from '../import/ImportScreen';
import './SceneHUD.css';

function matchesQuery(node, lang, query) {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  const title = pickLang(node.title, lang).toLowerCase();
  const titleOther = (node.title?.ru || '').toLowerCase() + ' ' + (node.title?.en || '').toLowerCase();
  return title.includes(q) || titleOther.includes(q);
}

function computeNodeEdges(edges, nodes, nodeId) {
  return edges
    .map((edge, index) => ({ edge, index }))
    .filter(({ edge }) => edge.from === nodeId || edge.to === nodeId)
    .map(({ edge, index }) => {
      const direction = edge.from === nodeId ? 'out' : 'in';
      const otherId = direction === 'out' ? edge.to : edge.from;
      return { edge, index, direction, other: nodes.find((n) => n.id === otherId) };
    });
}

export default function SceneHUD({
  data,
  lang,
  focus,
  currentGalaxy,
  focusedNode,
  onBack,
  onHome,
  onSearchSelect,
  onLockNow,
  onCreateGalaxy,
  onUpdateGalaxy,
  onDeleteGalaxy,
  onCreateNode,
  onUpdateNode,
  onDeleteNode,
  onAddEdge,
  onDeleteEdge,
  onImportData,
}) {
  const { t, lang: uiLang, setLang } = useI18n();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState(null); // null | create-galaxy | edit-galaxy | create-node | edit-node
  const [statsOpen, setStatsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // Смена уровня карты (например, клик по другой звезде) закрывает открытую форму.
  useEffect(() => {
    setMode(null);
  }, [focus.level, focus.galaxyId, focus.nodeId]);

  const handleSelectFromStats = useCallback(
    (node) => {
      setStatsOpen(false);
      onSearchSelect(node);
    },
    [onSearchSelect]
  );

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    return data.nodes.filter((n) => matchesQuery(n, lang, query)).slice(0, 8);
  }, [data.nodes, lang, query]);

  const handleSelect = useCallback(
    (node) => {
      onSearchSelect(node);
      setQuery('');
    },
    [onSearchSelect]
  );

  const isEmpty = data.galaxies.length === 0;
  const showPanel = mode !== null || Boolean(focusedNode);

  return (
    <div className="mu-hud">
      <div className="mu-hud-top">
        <div className="mu-breadcrumb">
          <button type="button" className="mu-crumb" onClick={onHome} disabled={focus.level === 'universe'}>
            {t('hud.breadcrumbUniverse')}
          </button>
          {currentGalaxy && (
            <>
              <span className="mu-crumb-sep">/</span>
              <span className="mu-crumb mu-crumb-current" style={{ color: currentGalaxy.color }}>
                {pickLang(currentGalaxy.title, lang)} · {galaxyProgress(data, currentGalaxy.id)}%
              </span>
            </>
          )}
          {focusedNode && (
            <>
              <span className="mu-crumb-sep">/</span>
              <span className="mu-crumb mu-crumb-current">{pickLang(focusedNode.title, lang)}</span>
            </>
          )}
          {!currentGalaxy && data.galaxies.length > 0 && (
            <span className="mu-crumb-overall">{overallProgress(data)}%</span>
          )}
        </div>

        <div className="mu-hud-actions">
          <button type="button" className="mu-hud-btn" onClick={() => setImportOpen(true)}>
            {t('hud.importBtn')}
          </button>
          <button type="button" className="mu-hud-btn" onClick={() => setStatsOpen(true)}>
            {t('hud.statsBtn')}
          </button>
          <button type="button" className="mu-hud-btn" onClick={() => setLang(uiLang === 'ru' ? 'en' : 'ru')}>
            {t('lang.switch')}
          </button>
          <button type="button" className="mu-hud-btn" onClick={onLockNow}>
            {t('hud.lockNow')}
          </button>
        </div>
      </div>

      {statsOpen && (
        <StatsScreen
          data={data}
          lang={lang}
          onClose={() => setStatsOpen(false)}
          onSelectNode={handleSelectFromStats}
        />
      )}

      {importOpen && (
        <ImportScreen
          data={data}
          lang={lang}
          onClose={() => setImportOpen(false)}
          onImport={onImportData}
        />
      )}

      {focus.level !== 'universe' && (
        <button type="button" className="mu-back-btn" onClick={onBack}>
          ← {t('hud.back')}
        </button>
      )}

      {mode === null && focus.level === 'universe' && (
        <div className="mu-fab-row">
          <button type="button" className="mu-fab-btn" onClick={() => setMode('create-galaxy')}>
            {t('editor.addGalaxyBtn')}
          </button>
        </div>
      )}

      {mode === null && focus.level === 'galaxy' && (
        <div className="mu-fab-row">
          <button type="button" className="mu-fab-btn" onClick={() => setMode('edit-galaxy')}>
            ✎ {t('editor.editGalaxy')}
          </button>
          <button type="button" className="mu-fab-btn mu-fab-btn-primary" onClick={() => setMode('create-node')}>
            {t('editor.addStarBtn')}
          </button>
        </div>
      )}

      <div className="mu-search-wrap">
        <input
          type="text"
          className="mu-search-input"
          placeholder={t('hud.searchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query.trim() && (
          <div className="mu-search-results">
            {searchResults.length === 0 && <div className="mu-search-empty">{t('hud.searchNoResults')}</div>}
            {searchResults.map((node) => (
              <button
                key={node.id}
                type="button"
                className="mu-search-result"
                onClick={() => handleSelect(node)}
              >
                {pickLang(node.title, lang)}
              </button>
            ))}
          </div>
        )}
      </div>

      {isEmpty && mode === null && (
        <div className="mu-empty-state">
          <h1>{t('hud.emptyUniverseTitle')}</h1>
          <p>{t('hud.emptyUniverseHint')}</p>
        </div>
      )}

      {showPanel && (
        <div className="mu-detail-panel">
          {mode === null && focusedNode && (
            <DetailPanel
              node={focusedNode}
              lang={lang}
              onClose={onBack}
              onEdit={() => setMode('edit-node')}
              onDelete={() => onDeleteNode(focusedNode.id)}
            />
          )}

          {(mode === 'create-galaxy' || mode === 'edit-galaxy') && (
            <>
              <button type="button" className="mu-detail-close" onClick={() => setMode(null)}>
                ×
              </button>
              <GalaxyForm
                initialGalaxy={mode === 'edit-galaxy' ? currentGalaxy : null}
                onSave={(patch) => {
                  if (mode === 'edit-galaxy') onUpdateGalaxy(currentGalaxy.id, patch);
                  else onCreateGalaxy(patch);
                  setMode(null);
                }}
                onDelete={
                  mode === 'edit-galaxy'
                    ? () => {
                        onDeleteGalaxy(currentGalaxy.id);
                        setMode(null);
                      }
                    : undefined
                }
                onCancel={() => setMode(null)}
              />
            </>
          )}

          {(mode === 'create-node' || mode === 'edit-node') && (
            <>
              <button type="button" className="mu-detail-close" onClick={() => setMode(null)}>
                ×
              </button>
              <NodeForm
                initialNode={mode === 'edit-node' ? focusedNode : null}
                lang={lang}
                allNodes={data.nodes}
                nodeEdges={
                  mode === 'edit-node' && focusedNode
                    ? computeNodeEdges(data.edges, data.nodes, focusedNode.id)
                    : []
                }
                onSave={(patch) => {
                  if (mode === 'edit-node') onUpdateNode(focusedNode.id, patch);
                  else onCreateNode(patch);
                  setMode(null);
                }}
                onDelete={
                  mode === 'edit-node'
                    ? () => {
                        onDeleteNode(focusedNode.id);
                        setMode(null);
                      }
                    : undefined
                }
                onCancel={() => setMode(null)}
                onAddEdge={onAddEdge}
                onDeleteEdge={onDeleteEdge}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function DetailPanel({ node, lang, onClose, onEdit, onDelete }) {
  const { t } = useI18n();
  const titleMeta = pickLangMeta(node.title, lang);
  const descMeta = pickLangMeta(node.description, lang);

  return (
    <>
      <button type="button" className="mu-detail-close" onClick={onClose} aria-label={t('detail.close')}>
        ×
      </button>
      <h2>
        {titleMeta.text}
        {titleMeta.isFallback && (
          <span className="mu-fallback-tag">{titleMeta.fallbackLang.toUpperCase()}</span>
        )}
      </h2>

      <div className="mu-detail-badges">
        <span className={`mu-badge mu-badge-status-${node.status}`}>{t(`nodeStatus.${node.status}`)}</span>
        <span className="mu-badge">{t(`nodeType.${node.type}`)}</span>
      </div>

      {node.status === 'in_progress' && (
        <div className="mu-detail-progress">
          <div className="mu-progress-track">
            <div className="mu-progress-fill" style={{ width: `${node.progress ?? 0}%` }} />
          </div>
          <span>{node.progress ?? 0}%</span>
        </div>
      )}

      {descMeta.text && (
        <div className="mu-detail-section">
          <h3>
            {t('detail.description')}
            {descMeta.isFallback && (
              <span className="mu-fallback-tag">{descMeta.fallbackLang.toUpperCase()}</span>
            )}
          </h3>
          <p>{descMeta.text}</p>
        </div>
      )}

      {(node.startedAt || node.completedAt) && (
        <div className="mu-detail-section">
          <h3>{t('detail.period')}</h3>
          <p>
            {node.startedAt || '—'} → {node.completedAt || '…'}
          </p>
        </div>
      )}

      {node.tags?.length > 0 && (
        <div className="mu-detail-section">
          <h3>{t('detail.tags')}</h3>
          <div className="mu-tag-list">
            {node.tags.map((tag) => (
              <span key={tag} className="mu-tag">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {node.nextSteps?.length > 0 && (
        <div className="mu-detail-section">
          <h3>{t('detail.nextSteps')}</h3>
          <ul className="mu-next-steps">
            {node.nextSteps.map((step, i) => (
              <li key={i} className={step.done ? 'mu-step-done' : ''}>
                {step.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      {node.source && node.source !== 'manual' && (
        <div className="mu-detail-source">{t(`source.${node.source}`)}</div>
      )}

      <div className="mu-detail-edit-actions">
        <button type="button" className="mu-btn-ghost" onClick={onEdit}>
          ✎ {t('editor.editPencil')}
        </button>
        <ConfirmDelete onConfirm={onDelete} />
      </div>
    </>
  );
}
