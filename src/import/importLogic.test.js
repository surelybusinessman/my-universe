import { describe, it, expect } from 'vitest';
import {
  parseImportJson,
  buildReviewRows,
  applyImport,
  findExistingDuplicates,
} from './importLogic';

function emptyData() {
  return { galaxies: [], nodes: [], edges: [] };
}

describe('parseImportJson', () => {
  it('parses valid JSON with nodes', () => {
    const result = parseImportJson('{"galaxies":[],"nodes":[{"title":{"ru":"Тест"}}]}');
    expect(result.nodes).toHaveLength(1);
  });

  it('throws INVALID_JSON on unparsable text', () => {
    expect(() => parseImportJson('not json')).toThrow('INVALID_JSON');
  });

  it('throws INVALID_SHAPE on a JSON array', () => {
    expect(() => parseImportJson('[1,2,3]')).toThrow('INVALID_SHAPE');
  });

  it('throws NO_NODES when nodes is empty', () => {
    expect(() => parseImportJson('{"nodes":[]}')).toThrow('NO_NODES');
  });
});

describe('buildReviewRows', () => {
  it('marks an exact title match against existing data as a duplicate to skip', () => {
    const existing = {
      ...emptyData(),
      nodes: [{ id: 'n_1', title: { ru: 'Плавание, медали' } }],
    };
    const parsed = { galaxies: [], nodes: [{ title: { ru: 'Плавание, медали' } }] };
    const rows = buildReviewRows(parsed, existing);
    expect(rows[0].decision).toBe('skip');
    expect(rows[0].duplicateOf?.id).toBe('n_1');
  });

  it('marks a semantically similar title (same words, different order) as a duplicate', () => {
    // similarity() is a bag-of-words Jaccard score with no stemming, so it catches
    // reordered words but not different word forms (e.g. "плавание" vs "плавании").
    const existing = {
      ...emptyData(),
      nodes: [{ id: 'n_1', title: { ru: 'Медали, плавание' } }],
    };
    const parsed = { galaxies: [], nodes: [{ title: { ru: 'Плавание, медали' } }] };
    const rows = buildReviewRows(parsed, existing);
    expect(rows[0].decision).toBe('skip');
    expect(rows[0].duplicateOf?.id).toBe('n_1');
  });

  it('deduplicates within the same import batch, keeping the first occurrence', () => {
    const parsed = {
      galaxies: [],
      nodes: [
        { title: { ru: 'Новый навык' }, level: 3, status: 'done' },
        { title: { ru: 'Новый навык' }, level: 3, status: 'done' },
      ],
    };
    const rows = buildReviewRows(parsed, emptyData());
    expect(rows[0].decision).toBe('add');
    expect(rows[1].decision).toBe('skip');
  });

  it('flags low-confidence rows as noise to skip', () => {
    const parsed = {
      galaxies: [],
      nodes: [{ title: { ru: 'Что-то неясное' }, confidence: 'low' }],
    };
    const rows = buildReviewRows(parsed, emptyData());
    expect(rows[0].decision).toBe('skip');
    expect(rows[0].noiseReason).toBe('lowConfidence');
  });

  it('accepts a distinct, confident, substantial row', () => {
    const parsed = {
      galaxies: [],
      nodes: [{ title: { ru: 'Выучил React' }, level: 4, status: 'done' }],
    };
    const rows = buildReviewRows(parsed, emptyData());
    expect(rows[0].decision).toBe('add');
    expect(rows[0].duplicateOf).toBeNull();
    expect(rows[0].noiseReason).toBeNull();
  });
});

describe('applyImport', () => {
  it('adds rows marked "add" as new nodes, creating a galaxy on demand', () => {
    const parsed = {
      galaxies: [],
      nodes: [{ title: { ru: 'Выучил React' }, galaxy: 'Карьера', level: 4, status: 'done' }],
    };
    const rows = buildReviewRows(parsed, emptyData());
    const { data, added, merged, skipped } = applyImport(emptyData(), parsed, rows, 'chatgpt');

    expect(added).toBe(1);
    expect(merged).toBe(0);
    expect(skipped).toBe(0);
    expect(data.nodes).toHaveLength(1);
    expect(data.galaxies).toHaveLength(1);
    expect(data.nodes[0].galaxyId).toBe(data.galaxies[0].id);
    expect(data.nodes[0].source).toBe('chatgpt');
  });

  it('does not add rows marked "skip"', () => {
    const existing = {
      ...emptyData(),
      nodes: [{ id: 'n_1', title: { ru: 'Плавание, медали' } }],
    };
    const parsed = { galaxies: [], nodes: [{ title: { ru: 'Плавание, медали' } }] };
    const rows = buildReviewRows(parsed, existing);
    const { data, added, skipped } = applyImport(existing, parsed, rows, 'chatgpt');

    expect(added).toBe(0);
    expect(skipped).toBe(1);
    expect(data.nodes).toHaveLength(1);
  });

  it('merges tags and description into the existing node when decision is "merge"', () => {
    const existing = {
      ...emptyData(),
      nodes: [{ id: 'n_1', title: { ru: 'Плавание' }, tags: ['спорт'] }],
    };
    const parsed = {
      galaxies: [],
      // Same normalized title as the existing node -> exact-match duplicate, so
      // buildReviewRows populates duplicateOf (needed by applyImport's merge branch).
      nodes: [{ title: { ru: 'Плавание' }, tags: ['медали'], description: { ru: 'до 2020' } }],
    };
    const rows = buildReviewRows(parsed, existing);
    rows[0].decision = 'merge';

    const { data, merged } = applyImport(existing, parsed, rows, 'chatgpt');
    expect(merged).toBe(1);
    expect(data.nodes).toHaveLength(1);
    expect(data.nodes[0].tags.sort()).toEqual(['медали', 'спорт'].sort());
    expect(data.nodes[0].description.ru).toBe('до 2020');
  });
});

describe('findExistingDuplicates', () => {
  it('groups nodes with matching or reordered-word titles', () => {
    const data = {
      ...emptyData(),
      nodes: [
        { id: 'n_1', title: { ru: 'Плавание, медали' } },
        { id: 'n_2', title: { ru: 'Медали, плавание' } },
        { id: 'n_3', title: { ru: 'Совсем другое' } },
      ],
    };
    const groups = findExistingDuplicates(data);
    expect(groups).toHaveLength(1);
    expect(groups[0].map((n) => n.id).sort()).toEqual(['n_1', 'n_2']);
  });

  it('returns no groups when all titles are distinct', () => {
    const data = {
      ...emptyData(),
      nodes: [{ id: 'n_1', title: { ru: 'Один' } }, { id: 'n_2', title: { ru: 'Два' } }],
    };
    expect(findExistingDuplicates(data)).toHaveLength(0);
  });
});
