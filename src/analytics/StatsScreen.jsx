import { useMemo } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { pickLang } from '../i18n/pickLang';
import {
  overallProgress,
  galaxyProgress,
  statusCounts,
  gapsList,
  developNextList,
  timelineByYear,
} from './stats';
import './StatsScreen.css';

function Ring({ percent, size = 96 }) {
  return (
    <div
      className="mu-ring"
      style={{ '--pct': percent, width: size, height: size }}
    >
      <span>{percent}%</span>
    </div>
  );
}

function NodeChip({ node, lang, onSelect }) {
  return (
    <button type="button" className="mu-stats-chip" onClick={() => onSelect(node)}>
      {pickLang(node.title, lang)}
    </button>
  );
}

export default function StatsScreen({ data, lang, onClose, onSelectNode }) {
  const { t } = useI18n();

  const overall = useMemo(() => overallProgress(data), [data]);
  const counts = useMemo(() => statusCounts(data.nodes), [data.nodes]);
  const gaps = useMemo(() => gapsList(data.nodes), [data.nodes]);
  const developNext = useMemo(() => developNextList(data), [data]);
  const timeline = useMemo(() => timelineByYear(data.nodes), [data.nodes]);

  const hasData = data.nodes.length > 0;

  return (
    <div className="mu-stats-screen">
      <button type="button" className="mu-detail-close mu-stats-close" onClick={onClose}>
        ×
      </button>

      {!hasData && (
        <div className="mu-stats-empty">
          <h1>{t('stats.noData')}</h1>
        </div>
      )}

      {hasData && (
        <div className="mu-stats-content">
          <section className="mu-stats-hero">
            <Ring percent={overall} size={140} />
            <h1>{t('stats.overall')}</h1>
          </section>

          <section className="mu-stats-section">
            <h2>{t('stats.byGalaxy')}</h2>
            <div className="mu-stats-galaxy-grid">
              {data.galaxies.map((g) => (
                <div key={g.id} className="mu-stats-galaxy-card">
                  <Ring percent={galaxyProgress(data, g.id)} size={64} />
                  <span style={{ color: g.color }}>{pickLang(g.title, lang)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="mu-stats-section">
            <h2>{t('stats.counts')}</h2>
            <div className="mu-stats-counts-grid">
              {['done', 'in_progress', 'planned', 'abandoned'].map((status) => (
                <div key={status} className={`mu-stats-count-tile mu-badge-status-${status}`}>
                  <span className="mu-stats-count-number">{counts[status]}</span>
                  <span className="mu-stats-count-label">{t(`nodeStatus.${status}`)}</span>
                </div>
              ))}
            </div>
          </section>

          {developNext.length > 0 && (
            <section className="mu-stats-section">
              <h2>{t('stats.developNext')}</h2>
              <div className="mu-stats-chip-row">
                {developNext.map((n) => (
                  <NodeChip key={n.id} node={n} lang={lang} onSelect={onSelectNode} />
                ))}
              </div>
            </section>
          )}

          {gaps.length > 0 && (
            <section className="mu-stats-section">
              <h2>{t('stats.gaps')}</h2>
              <div className="mu-stats-chip-row">
                {gaps.map((n) => (
                  <NodeChip key={n.id} node={n} lang={lang} onSelect={onSelectNode} />
                ))}
              </div>
            </section>
          )}

          {timeline.length > 0 && (
            <section className="mu-stats-section">
              <h2>{t('stats.timeline')}</h2>
              <div className="mu-stats-timeline">
                {timeline.map(([year, nodes]) => (
                  <div key={year} className="mu-stats-timeline-row">
                    <span className="mu-stats-timeline-year">{year}</span>
                    <div className="mu-stats-chip-row">
                      {nodes.map((n) => (
                        <NodeChip key={n.id} node={n} lang={lang} onSelect={onSelectNode} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
